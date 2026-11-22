import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTerrainModel } from '../terrain-model.js';

const module = await import('../ground-surfaces.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const rectangle = (x0,z0,x1,z1) => [{x:x0,z:z0},{x:x1,z:z0},{x:x1,z:z1},{x:x0,z:z1}];
const near = (a,b,tolerance=1e-5) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);

// Independent interpolation fixture, with the same explicit 00–11 diagonal as
// the terrain mesh. Abrupt, asymmetric slopes expose triangles bridging a cell.
function terrain(xs=[-5,-1,1,4,8],zs=[-5,-2,0,3,5]) {
  const heights = zs.map((z,j)=>xs.map((x,i)=>((i*7+j*11)%9)-4));
  const bounds={minX:xs[0],maxX:xs.at(-1),minZ:zs[0],maxZ:zs.at(-1)};
  const height=(x,z)=>{
    assert.ok(x>=bounds.minX-1e-7&&x<=bounds.maxX+1e-7&&z>=bounds.minZ-1e-7&&z<=bounds.maxZ+1e-7,'no elevation sampled outside measured grid');
    const i=Math.min(xs.length-2,Math.max(0,xs.findLastIndex(v=>v<=x)));
    const j=Math.min(zs.length-2,Math.max(0,zs.findLastIndex(v=>v<=z)));
    const u=(x-xs[i])/(xs[i+1]-xs[i]),v=(z-zs[j])/(zs[j+1]-zs[j]);
    const [a,b,c,d]=[heights[j][i],heights[j][i+1],heights[j+1][i],heights[j+1][i+1]];
    return u>=v ? a*(1-u)+b*(u-v)+d*v : a*(1-v)+d*u+c*(v-u);
  };
  return {xs,zs,heights,bounds,diagonal:'00-11',height};
}
function triangulate(rings,model,options={}) {
  assert.equal(typeof module.triangulateOfficialPolygon,'function','preview ground triangulator must exist');
  return module.triangulateOfficialPolygon(THREE,rings,model.height,{terrainModel:model,...options});
}
function triangles(geometry) {
  const a=geometry.getAttribute('position'),result=[];
  for(let i=0;i<a.count;i+=3)result.push([0,1,2].map(k=>({x:a.getX(i+k),y:a.getY(i+k),z:a.getZ(i+k)})));
  return result;
}
function area(geometry) {
  return triangles(geometry).reduce((sum,[a,b,c])=>sum+Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2,0);
}
function assertDraped(geometry,model,offset) {
  for(const vertices of triangles(geometry)) {
    for(const weights of [[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[0,.5,.5],[.5,0,.5],[1/3,1/3,1/3],[.2,.3,.5]]) {
      const p=vertices.reduce((p,v,i)=>({x:p.x+v.x*weights[i],y:p.y+v.y*weights[i],z:p.z+v.z*weights[i]}),{x:0,y:0,z:0});
      near(p.y-model.height(p.x,p.z),offset,2e-5);
    }
  }
}

test('preserves official holes, nested islands and disjoint footprints without editing source rings',()=>{
  const outer=rectangle(-4,-4,4,4),hole=rectangle(-2,-2,2,2),island=rectangle(-.5,-.5,.5,.5),separate=rectangle(5,-1,7,1);
  outer.push({...outer[0]});
  const rings=[hole.reverse(),separate,island,outer],original=JSON.stringify(rings),model=terrain();
  const geometry=triangulate(rings,model);
  near(area(geometry),53);
  for(const [a,b,c] of triangles(geometry)) {
    const x=(a.x+b.x+c.x)/3,z=(a.z+b.z+c.z)/3;
    assert.ok((x>=-4&&x<=4&&z>=-4&&z<=4&&!(Math.abs(x)<2&&Math.abs(z)<2&&!(Math.abs(x)<.5&&Math.abs(z)<.5))) || (x>=5&&x<=7&&z>=-1&&z<=1),'triangle filled outside official polygon or inside a hole');
  }
  assert.equal(JSON.stringify(rings),original);
  assertDraped(geometry,model,.012);
  geometry.dispose();
});

test('follows every terrain cell and diagonal at triangle edges and interior points',()=>{
  const model=terrain([-7,-3,1,3,7],[-5,-1,1,5]);
  const geometry=triangulate([rectangle(-6.7,-4.6,6.4,4.7)],model);
  near(area(geometry),13.1*9.3,5e-5);
  assertDraped(geometry,model,.012);
  const normals=geometry.getAttribute('normal');
  for(let i=0;i<normals.count;i++)assert.ok(normals.getY(i)>0,'ground normals face upward');
  geometry.dispose();
});

test('clips only to supplied terrain/display bounds and can render genuine polygons beyond the old 50 m box',()=>{
  const model=terrain([50,52,54,56],[0,1,2,3]);
  const rings=[rectangle(49,-1,58,4)];
  const full=triangulate(rings,model),clipped=triangulate(rings,model,{bounds:{minX:51,maxX:55,minZ:.5,maxZ:2.5}});
  near(area(full),18);near(area(clipped),8);
  assertDraped(full,model,.012);assertDraped(clipped,model,.012);
  assert.equal(triangulate([rectangle(60,10,62,12)],model),null);
  full.dispose();clipped.dispose();
});

test('clips a concave footprint without closing its missing corner',()=>{
  const model=terrain(),ring=[{x:-4,z:-4},{x:3,z:-4},{x:3,z:-1},{x:0,z:-1},{x:0,z:4},{x:-4,z:4}];
  const geometry=triangulate([ring],model);
  near(area(geometry),41);
  for(const [a,b,c] of triangles(geometry))assert.ok((a.x+b.x+c.x)/3<=0||(a.z+b.z+c.z)/3<=-1);
  assertDraped(geometry,model,.012);geometry.dispose();
});

test('a hole cut by the display boundary stays open and keeps its nested island',()=>{
  const model=terrain(),rings=[rectangle(-4,-4,4,4),rectangle(-2,-2,2,2),rectangle(-.5,-.5,.5,.5)];
  const geometry=triangulate(rings,model,{bounds:{minX:0,maxX:4,minZ:-4,maxZ:4}});
  near(area(geometry),24.5);
  for(const [a,b,c] of triangles(geometry)) {
    const x=(a.x+b.x+c.x)/3,z=(a.z+b.z+c.z)/3;
    assert.ok(x>=2||Math.abs(z)>=2||(x<=.5&&Math.abs(z)<=.5),'crop closed the official hole');
  }
  assertDraped(geometry,model,.012);geometry.dispose();
});

test('uses the real terrain model height datum once, including native offset grid coordinates',()=>{
  const model=createTerrainModel({schemaVersion:2,origin:{e:2603036,n:1128849},centreHeight:1497.1,verticalDatum:'LN02',xs:[-5,-3,-1,1,3,5],zs:[-5,-3,-1,1,3,5],heights:Array.from({length:6},(_,j)=>Array.from({length:6},(_,i)=>1497+((i*5+j*7)%9)/3))});
  const geometry=triangulate([rectangle(-4.8,-4.9,4.5,4.7)],model);
  assertDraped(geometry,model,.012);near(area(geometry),9.3*9.6,5e-5);
  geometry.dispose();
});

test('renderer uses centimetre layering and exact terrain slicing for official surfaces and line strips',()=>{
  assert.equal(typeof module.renderMOFeatures,'function');
  const model=terrain(),scene=new THREE.Scene(),objects=[];
  const features=[
    {objectID:1,layer:270,label:'Sol',genre:'ground',color:'#808080',geometry:{rings:[rectangle(-4,-4,4,4)]}},
    {objectID:2,layer:190,label:'Détail',genre:'misc',color:'#808080',geometry:{rings:[rectangle(-3,-3,3,3)]}},
    {objectID:3,layer:191,label:'Ligne',genre:'line',color:'#ffffff',displayWidth:.3,geometry:{paths:[[{x:-4,z:-3},{x:6,z:4}]]}},
  ];
  const drawn=module.renderMOFeatures(THREE,features,model.height,scene,objects,()=>assert.fail('legacy draper must not bridge terrain triangles'),{terrainModel:model});
  assert.deepEqual(drawn.map(f=>f.id),[1,2,3]);
  assert.equal(objects.length,3);assert.equal(scene.children.length,3);
  for(const [i,mesh] of scene.children.entries()) {
    assertDraped(mesh.geometry,model,[.012,.024,.035][i]);
    assert.equal(mesh.material.polygonOffset,true);
    assert.ok(mesh.material.polygonOffsetFactor<0);
    assert.equal(mesh.receiveShadow,true);assert.equal(mesh.castShadow,false);
    assert.match(mesh.userData.title,/Mensuration officielle/);
  }
  assert.notEqual(objects[0].material,objects[1].material,'different stacked layers require separate depth offsets');
  for(const mesh of objects)mesh.geometry.dispose();
});

test('the compatible no-model path retains the line callback and limits surface triangle edges to 1 m',()=>{
  assert.equal(typeof module.triangulateOfficialPolygon,'function');
  const geometry=module.triangulateOfficialPolygon(THREE,[rectangle(-2,-2,2,2)],()=>0);
  for(const [a,b,c] of triangles(geometry))for(const [p,q] of [[a,b],[b,c],[c,a]])assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<=1.00001);
  const calls=[],scene=new THREE.Scene();
  module.renderMOFeatures(THREE,[{objectID:4,layer:191,color:'#ffffff',geometry:{paths:[[{x:0,z:0},{x:1,z:1}]]}}],()=>0,scene,[],(...args)=>calls.push(args));
  assert.equal(calls.length,1);assert.equal(calls[0][3],.035);
  geometry.dispose();
});
