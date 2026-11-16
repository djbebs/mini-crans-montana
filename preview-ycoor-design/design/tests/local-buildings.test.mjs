import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createLocalBuildings } from '../local-buildings.js';

const data = JSON.parse(await readFile(new URL('../../assets/ycoor-dxf.json', import.meta.url)));
const make = (source = data, extra = {}) => createLocalBuildings({ THREE, scene: new THREE.Scene(), data: source, originHeight: 1497.1, ...extra });
const near = (a,b,e=0.0001) => assert.ok(Math.abs(a-b)<e, `${a} ≈ ${b}`);
const triangleContains = (point,[a,b,c]) => {
  const sign = (p,q,r) => (p[0]-r[0])*(q[1]-r[1])-(q[0]-r[0])*(p[1]-r[1]);
  const sides=[sign(point,a,b),sign(point,b,c),sign(point,c,a)];
  return !sides.some(x=>x < -0.000001)||!sides.some(x=>x > 0.000001);
};

test('six original complete polyfaces, metadata and full metre coordinates survive', () => {
  const app = make();
  assert.deepEqual(data.buildings.map(b=>b.id), ['1A20B','2329F','2355E','26152','2997D','2F7D6']);
  assert.deepEqual(data.buildings.map(b=>[b.vertices.length,b.faces.length]), [[36,50],[58,93],[21,36],[18,24],[65,133],[28,52]]);
  assert.equal(app.meshes.length,6);
  for (const b of data.buildings) {
    assert.match(b.sourceUuid,/^[0-9A-F-]{36}$/); assert.ok(b.sourceDate.year >= 2016);
    const mesh=app.meshes.find(m=>m.userData.buildingId===b.id);
    assert.equal(mesh.userData.sourceTriangleCount,b.faces.length);
    assert.equal(mesh.geometry.attributes.position.count,mesh.userData.renderTriangleCount*3);
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<b.faces.length;i++) {
      const renderIndex=mesh.geometry.userData.sourceFaceIndices.findIndex(indices=>indices.includes(i));
      assert.ok(renderIndex>=0,'every source face retains a render representative');
      const expected=b.faces[i].map(j=>b.vertices[j]).map(([e,n,h])=>[e-data.origin.e,h,data.origin.n-n]);
      const rendered=[0,1,2].map(j=>[p.getX(renderIndex*3+j),p.getY(renderIndex*3+j),p.getZ(renderIndex*3+j)]);
      for(const sourcePoint of expected)assert.ok(rendered.some(point=>Math.hypot(...point.map((v,k)=>v-sourcePoint[k]))<0.0001));
      const n=mesh.geometry.attributes.normal;
      if(mesh.geometry.groups[renderIndex].materialIndex===1)assert.ok(n.getY(renderIndex*3)>0,'roof fronts face upward');
    }
    const box=new THREE.Box3().setFromObject(mesh);
    for (const [axis,index,sign,origin] of [['x',0,1,-data.origin.e],['z',1,-1,data.origin.n],['y',2,1,-1497.1]]) {
      const values=b.vertices.map(v=>v[index]*sign+origin); near(box.min[axis],Math.min(...values)); near(box.max[axis],Math.max(...values));
    }
  }
  assert.ok(new THREE.Box3().setFromObject(app.group).max.z > 50, 'no bbox clipping');
  app.dispose();
});

test('datum applies once, metre axes and repeated changes are exact', () => {
  const app=make(); const p=app.meshes[0].geometry.attributes.position; const raw=p.array.slice();
  app.setOriginHeight(1500); near(app.group.position.y,-1500);
  app.setOriginHeight(1497.1); app.setOriginHeight(1497.1);
  near(app.group.position.y,-1497.1); assert.deepEqual(p.array,raw);
  app.dispose();
});

test('hidden group cannot pick; visible pick selects the actual building', () => {
  let selected; const app=make(data,{onSelect:b=>selected=b});
  const b=data.buildings[0], [e,n,h]=b.vertices[0];
  const ray=new THREE.Raycaster(new THREE.Vector3(e-data.origin.e,100,data.origin.n-n),new THREE.Vector3(0,-1,0));
  app.group.updateMatrixWorld(true);
  app.setVisible(false); assert.equal(app.pick(ray),null); assert.equal(selected,undefined);
  app.setVisible(true); const hit=app.pick(ray); assert.ok(hit); assert.equal(selected.id,hit.buildingId);
  app.dispose(); assert.equal(app.pick(ray),null);
});

test('vertical groups are deterministic outward planes with absolute heights and original triangle union', () => {
  const app=make(); assert.ok(app.faces.length>20);
  const reverse=structuredClone(data); for(const b of reverse.buildings)b.faces.reverse();
  const other=make(reverse);
  assert.deepEqual(app.faces.map(f=>f.id),other.faces.map(f=>f.id));
  for(let i=0;i<app.faces.length;i++) {
    assert.deepEqual(app.faces[i].origin,other.faces[i].origin);
    assert.deepEqual(app.faces[i].normal,other.faces[i].normal);
    assert.deepEqual(app.faces[i].bounds,other.faces[i].bounds);
  }
  for(const f of app.faces) {
    near(f.normal[1],0); near(Math.hypot(...f.normal),1); assert.deepEqual(f.v,[0,1,0]);
    near(f.u[0],f.normal[2]); near(f.u[2],-f.normal[0]);
    assert.ok(f.bounds.minV>1400); assert.ok(f.triangles.length);
    const b=data.buildings.find(b=>b.id===f.buildingId);
    for(const triangle of f.triangles)for(const [u,h] of triangle){
      const x=f.origin[0]+f.u[0]*u,z=f.origin[2]+f.u[2]*u;
      assert.ok(b.vertices.some(v=>Math.hypot(v[0]-data.origin.e-x,data.origin.n-v[1]-z,v[2]-h)<=f.maxPlanarityError+0.00001));
    }
    if(f.facadeAllowed) assert.ok(f.outwardCentroidDot>0);
    assert.ok(f.maxPlanarityError<=0.005);
  }
  app.dispose();other.dispose();
});

test('disconnected coplanar triangles retain empty space instead of a filled bounding rectangle', () => {
  const fixture={origin:data.origin,buildings:[{id:'hole',vertices:[[2603036,1128849,1500],[2603037,1128849,1500],[2603036,1128849,1501],[2603039,1128849,1500],[2603040,1128849,1500],[2603040,1128849,1501]],faces:[[0,1,2],[3,4,5]]}]};
  const app=make(fixture);assert.equal(app.faces.length,1); assert.equal(app.faces[0].triangles.length,2);
  const area=app.faces[0].triangles.reduce((sum,[a,b,c])=>sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2,0);
  near(area,1); app.dispose();
});

test('an explicit wall hole remains absent from the grouped triangle union', () => {
  const vertices=[[0,0],[4,0],[4,4],[0,4],[1,1],[3,1],[3,3],[1,3]].map(([x,h])=>[data.origin.e+x,data.origin.n,1500+h]);
  const fixture={origin:data.origin,buildings:[{id:'ring',vertices,faces:[[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]}]};
  const app=make(fixture),face=app.faces[0];assert.equal(app.faces.length,1);assert.equal(face.triangles.length,8);
  const area=face.triangles.reduce((sum,[a,b,c])=>sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2,0);
  near(area,12);near((face.bounds.maxU-face.bounds.minU)*(face.bounds.maxV-face.bounds.minV),16);app.dispose();
});

test('layout planes merge one-millimetre vertical kinks but reject more than five millimetres', () => {
  const fixture = kink => ({origin:data.origin,buildings:[{id:'kink',vertices:[[0,0,1500],[4,0,1500],[4,0,1504],[8,-kink,1500]].map(([e,n,h])=>[data.origin.e+e,data.origin.n+n,h]),faces:[[0,1,2],[1,3,2]]}]});
  const close=make(fixture(0.001));assert.equal(close.faces.length,1);assert.equal(close.faces[0].triangles.length,2);
  near(close.faces[0].maxPlanarityError,0.001,0.000001);close.dispose();
  const separate=make(fixture(0.006));assert.equal(separate.faces.length,2);separate.dispose();
});

test('real 2997D lower northwest triangle support survives millimetre CAD rounding', () => {
  const app=make(),face=app.faces.find(f=>f.id==='2997D:wall:002');
  const b=data.buildings.find(b=>b.id==='2997D');
  // Actual complementary lower-wall triangle, whose normal.y is 0.000010686.
  const points=b.faces[108].map(i=>b.vertices[i]).map(([e,n,h])=>[e-data.origin.e,h,data.origin.n-n]);
  const centroid=points[0].map((_,i)=>points.reduce((sum,p)=>sum+p[i],0)/3);
  const uv=[(centroid[0]-face.origin[0])*face.u[0]+(centroid[2]-face.origin[2])*face.u[2],centroid[1]];
  assert.ok(face.triangles.some(t=>triangleContains(uv,t)),'original triangle108 centroid must belong to layout union');
  assert.equal(face.triangles.length,15,'all15 actual NW source triangles belong to this plane');
  app.dispose();
});

test('a one-millimetre nearvertical quad includes both source triangles without changing mesh', () => {
  const fixture=kink=>({origin:data.origin,buildings:[{id:'nearvertical',vertices:[[0,0,1500],[4,0,1500],[4,-kink,1504],[0,0,1504]].map(([e,n,h])=>[data.origin.e+e,data.origin.n+n,h]),faces:[[0,1,3],[1,2,3]]}]});
  const app=make(fixture(0.001));assert.equal(app.faces.length,1);assert.equal(app.faces[0].triangles.length,2);
  near(Math.hypot(...app.faces[0].normal),1,0.000000001);
  near(Math.hypot(...app.faces[0].u),1,0.000000001);
  assert.ok(app.faces[0].maxPlanarityError<=0.001001);
  const p=app.meshes[0].geometry.attributes.position;
  assert.ok([...Array(p.count).keys()].some(i=>Math.abs(p.getZ(i)-0.001)<0.0000001),'source kink is retained in mesh');
  app.dispose();
  const overLimit=make(fixture(0.006));assert.equal(overLimit.faces.length,1);assert.equal(overLimit.faces[0].triangles.length,1,'triangle exceeding5mm horizontal-plane error is not added');overLimit.dispose();
});

test('real nearvertical wall triangle108 uses cream while genuine upward roofs keep roof material', () => {
  const app=make(),mesh=app.meshes.find(m=>m.userData.buildingId==='2997D');
  const renderIndex=mesh.geometry.userData.sourceFaceIndices.findIndex(indices=>indices.includes(108));
  assert.equal(mesh.geometry.groups[renderIndex].materialIndex,0,'nearvertical original wall108 must use cream wall material');
  const normals=mesh.geometry.attributes.normal;
  const genuineRoofs=mesh.geometry.groups.filter((_,i)=>normals.getY(i*3)>0.5);
  assert.ok(genuineRoofs.length>0,'fixture contains actual upward-facing roof slopes');
  for(const group of genuineRoofs)assert.equal(group.materialIndex,1);
  app.dispose();
});

test('coincident opposite real roof triangles render once with upward roof color while source faces remain intact', () => {
  const app=make(),b=data.buildings.find(b=>b.id==='2997D'),mesh=app.meshes.find(m=>m.userData.buildingId===b.id);
  assert.equal(b.faces.length,133,'original133source faces remain packaged');
  assert.equal(mesh.geometry.attributes.position.count,109*3,'24coincident source pairs have one render representative');
  assert.equal(mesh.userData.sourceTriangleCount,133);assert.equal(mesh.userData.renderTriangleCount,109);
  assert.equal(app.sourceTriangleCount,388);assert.equal(app.renderTriangleCount,351);
  const p=mesh.geometry.attributes.position,keys=new Set();
  for(let i=0;i<p.count;i+=3){const key=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)].join(',')).sort().join('|');assert.ok(!keys.has(key),'no coincident rendered triangle coordinate sets');keys.add(key);}
  const representatives=mesh.geometry.userData.sourceFaceIndices.map((source,i)=>({source,i})).filter(({source})=>source.includes(0)||source.includes(41));
  assert.equal(representatives.length,1);assert.deepEqual(representatives[0].source,[0,41]);
  const index=representatives[0].i;assert.equal(mesh.geometry.groups[index].materialIndex,1,'real duplicated sloped roof is terracotta');
  assert.ok(mesh.geometry.attributes.normal.getY(index*3)>0,'roof representative faces upward');
  assert.equal(app.faces.length,43,'layoutmetadata face IDs and extraction are unchanged');
  app.dispose();
});

test('both material indices shade identical visible roof surfaces after Three DoubleSide normal correction', () => {
  const app=make(),[wall,roof]=app.meshes[0].material;
  const compile=material=>{
    const shader={fragmentShader:THREE.ShaderLib.lambert.fragmentShader,vertexShader:THREE.ShaderLib.lambert.vertexShader,uniforms:{}};
    material.onBeforeCompile(shader);return shader;
  };
  const a=compile(wall),b=compile(roof);
  assert.match(a.fragmentShader,/diffuseColor\.rgb\s*=\s*mix\(/,'surface color must be independent of source material index');
  assert.equal(a.fragmentShader,b.fragmentShader,'identical visible normals use identical roof/wall color paths');
  assert.deepEqual(a.uniforms,b.uniforms,'wall/roof palettes are identical in both material programs');
  assert.equal(wall.customProgramCacheKey(),roof.customProgramCacheKey());
  const expanded=a.fragmentShader.replace('#include <normal_fragment_begin>',THREE.ShaderChunk.normal_fragment_begin);
  assert.ok(expanded.indexOf('normal *= faceDirection')<expanded.indexOf('diffuseColor.rgb = mix'),'DoubleSide visible-normal correction must precede color classification');
  assert.match(expanded,/viewMatrix\s*\*\s*vec4\(\s*0\.0,\s*1\.0,\s*0\.0,\s*0\.0\s*\)/,'classification compares with world up transformed into view space');
  app.dispose();
});

test('dispose releases each real Three resource once and removes only local group', () => {
  const scene=new THREE.Scene(), survivor=new THREE.Group(); scene.add(survivor); const app=make(data,{scene});
  const resources=new Set(app.meshes.flatMap(m=>[m.geometry,...m.material]));const counts=new Map();
  for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));
  app.dispose();app.dispose();assert.equal(app.group.parent,null);assert.equal(survivor.parent,scene);
  assert.equal(counts.size,resources.size);for(const count of counts.values())assert.equal(count,1);
});

test('malformed coordinates, topology and datum are rejected before scene mutation', () => {
  for(const mutate of [d=>d.buildings[0].vertices[0][0]=NaN,d=>d.buildings[0].faces[0][0]=9999,d=>d.buildings[0].faces[0]=[0,1],d=>d.origin.n=Infinity]) {
    const d=structuredClone(data);mutate(d);const scene=new THREE.Scene();assert.throws(()=>make(d,{scene}));assert.equal(scene.children.length,0);
  }
  const app=make();assert.throws(()=>app.setOriginHeight(NaN));app.dispose();
});
