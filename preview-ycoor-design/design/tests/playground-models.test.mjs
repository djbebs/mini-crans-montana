import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { motionAt, selectMotionVariant } from '../../../crans-montana-p06/people-motion.js';
import { validatePrefabVariant } from '../../../crans-montana-p06/playground-collision.js';
import { pointInPolygon } from '../../../crans-montana-p06/photo-playground.js';
import { createTerrainModel } from '../terrain-model.js';

// The shared character module uses the browser import map; use the existing
// design test dependency for the same imports in Node, without installing twice.
const threeUrl=import.meta.resolve('three');
registerHooks({resolve(name,context,next){
  if(name==='three')return {url:threeUrl,shortCircuit:true};
  if(name.startsWith('three/addons/'))return {url:new URL('../examples/jsm/'+name.slice(13),threeUrl).href,shortCircuit:true};
  return next(name,context);
}});
const { planPopulation, createPopulation }=await import('../../../crans-montana-p06/characters.js');

const mod = await import('../playground-models.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const read = path => readFile(new URL(path, import.meta.url)).then(JSON.parse);
const site = await read('../../assets/playground-evidence/2026-11-23/osm-snapshot.json');
const mo = await read('../../assets/playground-evidence/2026-11-23/mo-snapshot.json');
const polygon = site.features.find(f => f.type === 'playground').polygon;
const lawn = mo.shapes.find(f => f.objectID === 362488).geometry.rings[0];
const setup = () => mod.drawObservedPlayground(THREE, site.features, () => -.258,
  new THREE.Group(), [], true, { groundFeatures: mo.shapes, groundHeight: () => 0 });

test('observed layout is tied to Ycoor and does not rearrange equipment to fill a different boundary', () => {
  assert.equal(typeof mod.planObservedPlayground, 'function');
  assert.equal(mod.planObservedPlayground([]).planned.length, 0);
  const unrelated = structuredClone(site.features); unrelated[0].id = 'way/elsewhere';
  assert.equal(mod.planObservedPlayground(unrelated).planned.length, 0);
  const plan = mod.planObservedPlayground(site.features);
  assert.equal(plan.planned.length, 7);
  const enlarged = structuredClone(site.features);
  enlarged[0].polygon = polygon.map(p => ({ x: p.x * 1.2, z: p.z * 1.2 }));
  assert.deepEqual(mod.planObservedPlayground(enlarged).planned.map(p => [p.key,p.x,p.z]),
    plan.planned.map(p => [p.key,p.x,p.z]));
  for (const p of plan.planned) for (let i=0;i<=8;i++) for (let j=0;j<=8;j++) {
    const point={x:p.x+p.w*(i/8-.5),z:p.z+p.d*(j/8-.5)};
    assert.ok(pointInPolygon(point,polygon),p.key+' footprint remains in mapped playground');
    assert.ok(pointInPolygon(point,lawn),p.key+' stays on the play surface, away from paths and pond');
  }
});

test('all reconstructed equipment receives usable child interactions inside the verified site', () => {
  const app=setup();
  assert.equal(app.drawn.length,7);
  const plan=planPopulation({furnitureFeatures:site.features,photoDrawn:app.drawn,maxActors:14});
  for(const model of app.drawn) {
    const riders=plan.people.filter(p=>p.modelKey===model.key&&p.kind==='enfant');
    assert.ok(riders.length,model.key+' has a child using its authored geometry');
    for(const interaction of model.interactions) {
      const check=validatePrefabVariant({variant:interaction,model,polygon});
      assert.ok(check.ok,model.key+': '+JSON.stringify(check));
    }
    for(const rider of riders) for(let t=0;t<35;t+=.17) {
      const pose=motionAt(rider,t,()=>-.258,{});
      assert.ok(Number.isFinite(pose.x+pose.y+pose.z));
      assert.ok(pointInPolygon(pose,polygon),model.key+' child remains in playground');
      assert.ok(pointInPolygon(pose,lawn),model.key+' return route avoids pond and path');
    }
  }
});

test('swing and spring seats stay synchronized with the seated children throughout the cycle', () => {
  const app=setup(), plan=planPopulation({furnitureFeatures:site.features,photoDrawn:app.drawn,maxActors:14});
  for(const rider of plan.people.filter(p=>p.role==='play-swing'||p.role==='play-rocker')) {
    assert.equal(typeof rider.onPose,'function');
    for(let t=0;t<10;t+=.13) {
      const pose=motionAt(rider,t,()=>-.258,{});
      rider.onPose(pose); app.group.updateMatrixWorld(true);
      const contact=app.group.getObjectByName(rider.contactName).getWorldPosition(new THREE.Vector3());
      const hips=pose.riderContact||{x:pose.x,y:pose.y+.42,z:pose.z};
      assert.ok(contact.distanceTo(new THREE.Vector3(hips.x,hips.y,hips.z))<.018,
        rider.modelKey+' child must follow the physical seat');
      assert.ok(Math.abs(pose.legL)>.7&&Math.abs(pose.legR)>.7,'seated rider does not walk in mid-air');
    }
  }
});

test('simple swing suspensions meet the seat rather than hanging outside its edges', () => {
  const app=setup(),root=app.group.getObjectByName('swing-south');
  root.updateWorldMatrix(true,true);
  const seat=root.getObjectByName('swing-south-seat');
  const anchors=['left','right'].map(side=>root.getObjectByName('swing-south-suspension-'+side));
  assert.ok(anchors.every(Boolean),'the two actual suspension endpoints are inspectable');
  const origin=seat.getWorldPosition(new THREE.Vector3());
  for(const anchor of anchors){
    const end=anchor.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(end.y-origin.y)<.005);
    assert.ok(end.distanceTo(origin)<=.325,'suspension attaches within the 65 cm seat');
  }
});

test('the original child GLB has visible legs extending in front of the swing seat', async () => {
  const app=setup(),population=await createPopulation({THREE,season:'summer',height:()=>-.258,
    furnitureData:site,photoDrawn:app.drawn,maxActors:12});
  for(const actor of population.actors.filter(a=>a.spec.role==='play-swing')){
    actor.elapsed=1.15; population.update(0);population.group.updateMatrixWorld(true);
    app.group.updateMatrixWorld(true);
    const hip=actor.parts.leftLeg.getWorldPosition(new THREE.Vector3())
      .add(actor.parts.rightLeg.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
    const seat=app.group.getObjectByName(actor.spec.contactName).getWorldPosition(new THREE.Vector3());
    assert.ok(hip.distanceTo(seat)<.018,'actual GLB hip joints follow the seat despite actor scale variation');
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(actor.anchor.quaternion);
    for(const leg of [actor.parts.leftLeg,actor.parts.rightLeg]){
      assert.ok(leg?.visible,'both original leg meshes remain visible');
      const localBox=new THREE.Box3(),inverse=new THREE.Matrix4().copy(leg.matrixWorld).invert();
      leg.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.geometry.computeBoundingBox();
        localBox.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));
      });
      const toe=leg.localToWorld(new THREE.Vector3(0,localBox.min.y,0));
      const hip=leg.getWorldPosition(new THREE.Vector3());
      assert.ok(toe.clone().sub(hip).dot(forward)>.28,'feet extend forward, away from the hidden underside of the seat');
    }
  }
  population.dispose();
});

test('all three slide postures keep the original GLB legs above the visible chute', async () => {
  const app=setup(),population=await createPopulation({THREE,season:'summer',height:()=>-.258,
    furnitureData:site,photoDrawn:app.drawn,maxActors:12});
  const actor=population.actors.find(a=>a.spec.modelKey==='combo');
  const variants=actor.spec.variants.filter(v=>v.name.endsWith('-calm'));
  assert.equal(variants.length,3);
  for(const v of variants){
    let t=0;
    for(const f of v.sequence){if(f[0].startsWith('slide-')&&f[1]===14){t+=f[3]/2;break;}t+=f[3];}
    actor.spec.variants=null;actor.spec.track=v.track;actor.spec.sequence=v.sequence;
    actor.elapsed=t;actor.cache.lastSafePose=null;population.update(0);
    population.group.updateMatrixWorld(true);app.group.updateMatrixWorld(true);
    const pose=motionAt(actor.spec,t,()=>-.258,{});
    const hip=actor.parts.leftLeg.getWorldPosition(new THREE.Vector3())
      .add(actor.parts.rightLeg.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
    assert.ok(hip.distanceTo(new THREE.Vector3(pose.riderContact.x,pose.riderContact.y,pose.riderContact.z))<.01,
      v.name+' uses the real hip joint as its slide contact');
    for(const leg of [actor.parts.leftLeg,actor.parts.rightLeg]){
      const toe=leg.localToWorld(new THREE.Vector3(0,-.46,0));
      const ray=new THREE.Raycaster(toe.clone().add(new THREE.Vector3(0,5,0)),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(app.group.getObjectByName('combo'),true)[0];
      assert.ok(hit,v.name+' feet remain over the actual rendered chute');
      assert.ok(toe.y>=hit.point.y-.02,v.name+' legs are not buried inside the slide');
    }
  }
  population.dispose();
});

test('an adult approaches the swing, pushes in time, then remains beside it watching', () => {
  const app=setup(),plan=planPopulation({furnitureFeatures:site.features,photoDrawn:app.drawn,maxActors:12});
  const helper=plan.people.find(p=>p.role==='swing-helper');
  assert.ok(helper,'an adult interaction is assigned to the simple swing');
  assert.equal(helper.kind,'adulte');
  const approach=motionAt(helper,4,()=>-.258,{});
  assert.equal(approach.phase,'return');
  const push=motionAt(helper,10.35,()=>-.258,{});
  assert.equal(push.phase,'pushSwing');assert.ok(push.pushStrength>.8);
  const late=motionAt(helper,60,()=>-.258,{}),later=motionAt(helper,120,()=>-.258,{});
  assert.equal(late.phase,'watchSwing');assert.equal(later.phase,'watchSwing');
  assert.ok(Math.hypot(late.x-later.x,late.z-later.z)<1e-6,'adult stays beside the swing');
  const child=plan.people.find(p=>p.modelKey===helper.modelKey&&p.kind==='enfant');
  for(let t=0;t<70;t+=.13){
    const adult=motionAt(helper,t,()=>-.258,{}),rider=motionAt(child,t,()=>-.258,{});
    assert.ok(Math.hypot(adult.x-rider.x,adult.z-rider.z)>.48,'adult avoids the child’s swept path');
    if(adult.phase==='watchSwing'){
      const expected=Math.atan2(rider.x-adult.x,rider.z-adult.z);
      assert.ok(Math.abs(Math.sin(adult.heading-expected))<1e-6,'adult looks toward the moving child');
    }
  }
});

test('slide cycles vary between sitting, lying on the back and prone, with occasional celebration', () => {
  const app=setup(),plan=planPopulation({furnitureFeatures:site.features,photoDrawn:app.drawn,maxActors:12});
  const child=plan.people.find(p=>p.modelKey==='combo'&&p.kind==='enfant');
  assert.ok(child.variants?.length>=3,'several complete authored slide circuits exist');
  const phases=new Set(child.variants.flatMap(v=>v.sequence.map(f=>f[0])));
  for(const phase of ['slide-sit','slide-back','slide-front','joyJump'])assert.ok(phases.has(phase),phase);
  assert.ok(child.variants.some(v=>!v.sequence.some(f=>f[0]==='joyJump')),'celebration is occasional');
  const cycle=child.variants.reduce((n,v)=>n+v.sequence.reduce((s,f)=>s+f[3],0),0);
  const names=new Set();
  for(let t=0;t<cycle*3;t+=1.7){
    const active=selectMotionVariant(child,t);names.add(active.variantName);
    assert.deepEqual(selectMotionVariant(child,t),active,'pose choice remains stable during a frame');
  }
  assert.equal(names.size,child.variants.length);
  const jumping=child.variants.find(v=>v.sequence.some(f=>f[0]==='joyJump'));
  let at=0;
  for(const frame of jumping.sequence){if(frame[0]==='joyJump')break;at+=frame[3];}
  const spec={...child,variants:null,track:jumping.track,sequence:jumping.sequence};
  const grounded=motionAt(spec,at,()=>-.258,{}),jump=motionAt(spec,at+.45,()=>-.258,{});
  assert.ok(jump.y-grounded.y>.20,'joy jump has a visible takeoff');
  assert.ok(jump.armL<-2&&jump.armR<-2,'both arms are raised');
});

test('the photo turf follows the official footprint and can be hidden with the equipment', () => {
  const app=setup(),surface=app.group.getObjectByName('photo-turf-MO-362488');
  assert.ok(surface,'green play surface is present');
  assert.equal(surface.userData.geometrySource,'MO/270/362488');
  assert.equal(surface.userData.appearanceStatus,'PHOTO_INTERPRETATION');
  const pos=surface.geometry.attributes.position;
  for(let i=0;i<pos.count;i++) assert.ok(Math.abs(pos.getY(i)-.018)<1e-5);
  app.group.visible=false;
  for(const mesh of app.group.children) assert.equal(mesh.parent.visible,false);
});

test('ground return circuits follow the real terrain while steps and seats retain model contacts', async () => {
  const terrain=createTerrainModel(await read('../../assets/terrain-grid.json'));
  const height=(x,z)=>terrain.height(x,z)-.258;
  const app=mod.drawObservedPlayground(THREE,site.features,height,new THREE.Group(),[],true);
  const plan=planPopulation({furnitureFeatures:site.features,photoDrawn:app.drawn,maxActors:14});
  let samples=0;
  for(const rider of plan.people.filter(p=>p.groundedPhases?.length))for(let t=0;t<40;t+=.19){
    const pose=motionAt(rider,t,height,{});
    if(!rider.groundedPhases.includes(pose.phase))continue;
    const clearance=pose.y-terrain.height(pose.x,pose.z);
    assert.ok(clearance>=.052-1e-6&&clearance<=.062+1e-6,'ground contact allows only the authored walking foot lift');
    samples++;
  }
  assert.ok(samples>20);
});
