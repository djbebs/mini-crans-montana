import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// A missing renderer is an assertion failure in the initial RED run.
const module = await import('../design-enhancements.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const create = module.createDesignEnhancements;
const rect = (a, b, c, d) => [[[a,b],[c,b],[c,d]],[[a,b],[c,d],[a,d]]];
const face = (overrides = {}) => ({
  id: 'face-a', buildingId: 'building-a', origin: [100,0,200],
  u: [0,0,-1], v: [0,1,0], normal: [1,0,0],
  triangles: rect(0, 1000, 10, 1010),
  bounds: {minU:0,maxU:10,minV:1000,maxV:1010}, ...overrides,
});
const detail = (overrides = {}) => ({id:'window-a',kind:'window',u:3,v:1004,width:2,height:2,color:'#123456',...overrides});
const change = (details = [detail()], overrides = {}) => ({
  changeId:'change-a', buildingId:'building-a', faceId:'face-a',status:'ready',
  evidenceIds:['capture-a'],details,...overrides,
});
const setup = (overrides = {}) => {
  assert.equal(typeof create, 'function', 'createDesignEnhancements must implement the renderer');
  const scene = new THREE.Scene();
  return {scene,...create({THREE,scene,changes:[change()],faces:[face()],originHeight:990,...overrides})};
};
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-5, `${actual} != ${expected}`);
const box = object => {object.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(object);};

test('broad thin balcony details can avoid shadow-map aliasing while retaining their cast silhouettes', () => {
  const original = setup(), clean = setup({changes:[change(undefined,{receiveShadow:false})]});
  assert.ok(original.meshes.every(mesh=>mesh.receiveShadow && mesh.castShadow));
  assert.ok(clean.meshes.every(mesh=>!mesh.receiveShadow && mesh.castShadow));
  const scene = new THREE.Scene();
  assert.throws(()=>create({THREE,scene,changes:[change(undefined,{receiveShadow:'false'})],faces:[face()],originHeight:990}),/receiveShadow/);
  assert.equal(scene.children.length,0);
  original.dispose();clean.dispose();
});

test('places a feature on a translated rotated face with one altitude subtraction', () => {
  const layer = setup();
  assert.equal(layer.group.name,'ycoor-design-enhancements');
  assert.equal(layer.group.visible,false);
  const bounds = box(layer.group);
  near(bounds.min.x,100.003); near(bounds.max.x,100.023);
  near(bounds.min.y,13); near(bounds.max.y,15);
  near(bounds.min.z,196); near(bounds.max.z,198);
  assert.deepEqual(layer.meshes[0].userData, {
    source:'design-evidence',changeId:'change-a',detailId:'window-a',buildingId:'building-a',faceId:'face-a',
  });
  assert.equal(layer.meshes[0].material.depthTest,true);
  layer.dispose();
});

test('two explicit details create exactly two independently selectable feature groups', () => {
  const layer = setup({changes:[change([detail(),detail({id:'door-a',kind:'door',u:7})])]});
  assert.equal(layer.group.children.length,2);
  assert.equal(layer.meshes.length,2);
  assert.deepEqual(layer.group.children.map(item=>item.userData.detailId),['window-a','door-a']);
  layer.dispose();
});

test('unknown faces and unresolved changes add no geometry', () => {
  const layer = setup({changes:[change(undefined,{faceId:'missing'}),change(undefined,{status:'unresolved'})]});
  assert.equal(layer.meshes.length,0); assert.equal(layer.group.children.length,0);
  layer.dispose();
});

test('a face from another building cannot receive a ready change', () => {
  const layer = setup({faces:[face({buildingId:'other'})]});
  assert.equal(layer.meshes.length,0); layer.dispose();
});

test('ambiguous outward orientation remains unresolved instead of decorating a hidden face', () => {
  for (const flags of [{facadeAllowed:false},{orientationAmbiguous:true}]) {
    const layer = setup({faces:[face(flags)]});
    assert.equal(layer.meshes.length,0); layer.dispose();
  }
});

test('rejects a rectangle crossing an L shape notch despite valid bounds', () => {
  const triangles = [...rect(0,1000,4,1010),...rect(4,1000,10,1004)];
  assert.throws(()=>setup({faces:[face({triangles})],changes:[change([detail({u:5,v:1005,width:4,height:4})])]}),/outside|unsupported/i);
});

test('rejects a rectangle bridging disjoint supported strips even when every corner is supported', () => {
  const triangles = [...rect(0,1000,4,1010),...rect(6,1000,10,1010)];
  assert.throws(()=>setup({faces:[face({triangles})],changes:[change([detail({u:5,v:1005,width:6,height:2})])]}),/outside|unsupported/i);
});

test('rejects a rectangle covering a cutout with all corners on the face', () => {
  const triangles = [...rect(0,1000,10,1004),...rect(0,1006,10,1010),...rect(0,1004,4,1006),...rect(6,1004,10,1006)];
  assert.throws(()=>setup({faces:[face({triangles})],changes:[change([detail({u:5,v:1005,width:6,height:6})])]}),/outside|unsupported/i);
});

test('rejects duplicated strips whose extra area would conceal an unsupported gap before resource allocation', () => {
  const triangles = [...rect(0,1000,4,1010),...rect(6,1000,10,1010),...rect(2,1004,4,1006)];
  const scene = new THREE.Scene();
  let allocations=0;
  const trackedThree={...THREE,
    BoxGeometry:class extends THREE.BoxGeometry {constructor(...args) {super(...args);allocations++;}},
    MeshLambertMaterial:class extends THREE.MeshLambertMaterial {constructor(...args) {super(...args);allocations++;}},
  };
  assert.throws(()=>setup({THREE:trackedThree,scene,faces:[face({triangles})],changes:[change([detail({u:5,v:1005,width:6,height:2})])]}),/overlap/i);
  assert.equal(allocations,0); assert.equal(scene.children.length,0);
});

test('rejects partially overlapping triangles outside the detail footprint in either winding', () => {
  const first=[[0,1000],[4,1000],[0,1004]], second=[[1,1001],[5,1001],[1,1005]];
  for (const triangle of [second,[...second].reverse()]) {
    assert.throws(()=>setup({faces:[face({triangles:[first,triangle]})],changes:[change([detail({u:0.5,v:1000.5,width:0.2,height:0.2})])]}),/overlap/i);
  }
});

test('accepts a supported rectangle crossing adjacent face triangles', () => {
  const layer = setup({changes:[change([detail({u:5,v:1005,width:8,height:8})])]});
  assert.equal(layer.meshes.length,1); layer.dispose();
});

test('validates all ready details before attaching a group or allocating geometry', () => {
  const scene = new THREE.Scene();
  let allocations=0;
  const trackedThree={...THREE,
    BoxGeometry:class extends THREE.BoxGeometry {constructor(...args) {super(...args);allocations++;}},
    MeshLambertMaterial:class extends THREE.MeshLambertMaterial {constructor(...args) {super(...args);allocations++;}},
  };
  assert.throws(()=>setup({THREE:trackedThree,scene,changes:[change([detail(),detail({id:'invalid',width:0})])]}),/invalid.*width|width.*positive/i);
  assert.equal(allocations,0);
  assert.equal(scene.children.length,0);
  for (const bad of [detail({kind:'roof'}),detail({depth:0.1}),detail({v:NaN})]) {
    assert.throws(()=>setup({changes:[change([bad])]}),/unsupported|depth|offset|finite/i);
  }
  assert.throws(()=>setup({changes:[change(undefined,{evidenceIds:[]})]}),/evidence/i);
});

test('datum updates use absolute altitude and never accumulate drift', () => {
  const layer = setup();
  layer.setOriginHeight(995); near(box(layer.group).min.y,8);
  layer.setOriginHeight(980); near(box(layer.group).min.y,23);
  layer.setOriginHeight(990); near(box(layer.group).min.y,13);
  layer.setOriginHeight(990); near(box(layer.group).min.y,13);
  layer.dispose();
});

test('normal offset follows an outward negative normal', () => {
  const layer = setup({faces:[face({normal:[-1,0,0]})]});
  near(box(layer.group).min.x,99.977); near(box(layer.group).max.x,99.997);
  layer.dispose();
});

test('picking uses real visible meshes and reports the explicit detail identity', () => {
  let selected;
  const layer = setup({onSelect: result=>{selected=result;}});
  const ray = new THREE.Raycaster(new THREE.Vector3(110,14,197),new THREE.Vector3(-1,0,0));
  assert.equal(layer.pick(ray),false);
  layer.setEnabled(true); assert.equal(layer.pick(ray),true);
  assert.equal(selected.changeId,'change-a'); assert.equal(selected.detailId,'window-a');
  layer.meshes[0].visible=false; assert.equal(layer.pick(ray),false);
  layer.meshes[0].visible=true; layer.setEnabled(false); assert.equal(layer.pick(ray),false);
  layer.dispose();
});

test('optional explicit frames add borders while an unframed window stays a single pane', () => {
  const layer = setup({changes:[change([detail({frame:{width:0.1,color:'#ffffff'}})])]});
  assert.equal(layer.group.children.length,1); assert.equal(layer.meshes.length,5);
  const bounds = box(layer.group); near(bounds.min.y,13); near(bounds.max.y,15);
  layer.dispose();
});

test('balconies contain only explicit rails and an explicitly requested floor', () => {
  const rail = {u:0,v:0,width:2,height:0.1,depth:0.05,offset:0.7,color:'#333333'};
  const balcony = detail({kind:'balcony',width:2,height:1,depth:0.8,rails:[rail]});
  const layer = setup({changes:[change([balcony])]});
  assert.equal(layer.meshes.length,1); near(box(layer.group).max.x,100.75);
  layer.dispose();
  const withFloor = setup({changes:[change([{...balcony,floor:{height:0.1,color:'#999999'}}])]});
  assert.equal(withFloor.meshes.length,2); near(box(withFloor.group).max.x,100.8);
  withFloor.dispose();
});

test('dispose releases each shared resource exactly once and removes the independent scene group', () => {
  const layer = setup({changes:[change([detail(),detail({id:'window-b',u:7})])]});
  const baseline = new THREE.Group(); layer.scene.add(baseline);
  const resources = new Set(layer.meshes.flatMap(mesh=>[mesh.geometry,...(Array.isArray(mesh.material)?mesh.material:[mesh.material])]));
  const counts = new Map();
  for (const resource of resources) resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)||0)+1));
  layer.dispose(); layer.dispose();
  for (const resource of resources) assert.equal(counts.get(resource),1);
  assert.deepEqual(layer.scene.children,[baseline]);
  assert.equal(layer.pick(new THREE.Raycaster()),false);
});
