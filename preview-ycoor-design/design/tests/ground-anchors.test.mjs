import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTerrainModel } from '../terrain-model.js';

const module=await import('../ground-anchors.js').catch(error=>{
  if(error.code==='ERR_MODULE_NOT_FOUND')return {};
  throw error;
});
const rect=(a,b,c,d)=>[{x:a,z:b},{x:c,z:b},{x:c,z:d},{x:a,z:d}];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const model=()=>createTerrainModel({schemaVersion:2,origin:{e:2603036,n:1128849},centreHeight:1497,xs:[-2,0,2],zs:[-2,0,2],heights:[[1497,1499,1498],[1498,1497,1500],[1500,1498,1497]]});

function setup(sharedMaterial=new THREE.MeshLambertMaterial({color:'#abcdef'})) {
  assert.equal(typeof module.drawFurnitureGrounded,'function');
  const terrainModel=model(),parent=new THREE.Group(),objects=[],outer=rect(-1.8,-1.8,1.8,1.8),hole=rect(-.5,-.5,.5,.5);
  const feature={id:'way/12',geometry:'polygon',type:'playground',polygon:outer,rings:[outer,hole]};
  const oldGeometry=new THREE.PlaneGeometry(3,3);let disposed=0;
  oldGeometry.addEventListener('dispose',()=>disposed++);
  let point,surface,unrelated,nested,receivedLine;
  const lineGeom=()=>{};
  const painter=(T,data,height,target,pickables,line)=>{
    receivedLine=line;const group=new T.Group();target.add(group);
    point=new T.Group();point.position.set(1,height(1,1)+.12,1);group.add(point);
    surface=new T.Mesh(oldGeometry,sharedMaterial);surface.userData={source:'osm',osmID:feature.id,title:'Source OSM'};group.add(surface);pickables.push(surface);
    unrelated=new T.Mesh(new T.PlaneGeometry(),sharedMaterial);unrelated.userData={source:'osm',osmID:'other'};group.add(unrelated);
    nested=new T.Mesh(new T.PlaneGeometry(),sharedMaterial);nested.userData={source:'osm',osmID:feature.id};point.add(nested);
    return {group,drawn:data.features,counts:{playground:1}};
  };
  const result=module.drawFurnitureGrounded({THREE,painter,data:{features:[feature]},height:terrainModel.height,terrainModel,parent,objects,lineGeom});
  return {terrainModel,result,feature,surface,point,unrelated,nested,oldGeometry,disposed:()=>disposed,sharedMaterial,receivedLine,lineGeom,objects};
}

test('removes the legacy point float while preserving result, metadata and line callback',()=>{
  const s=setup();close(s.point.position.y,s.terrainModel.height(1,1)+.012);
  assert.equal(s.result.drawn[0],s.feature);assert.deepEqual(s.result.counts,{playground:1});
  assert.equal(s.receivedLine,s.lineGeom);assert.equal(s.objects[0],s.surface);
  assert.deepEqual(s.surface.userData,{source:'osm',osmID:'way/12',title:'Source OSM'});
  assert.equal(s.surface.renderOrder,0);
  assert.notEqual(s.unrelated.geometry,s.surface.geometry);assert.notEqual(s.nested.geometry,s.surface.geometry);
});

test('replaces only the mapped ground surface and disposes its old geometry once',()=>{
  const s=setup(),a=s.surface.geometry.getAttribute('position');
  assert.notEqual(s.surface.geometry,s.oldGeometry);assert.equal(s.disposed(),1);
  let area=0;
  for(let i=0;i<a.count;i+=3) {
    const vertices=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(a,i+k));
    area+=Math.abs((vertices[1].x-vertices[0].x)*(vertices[2].z-vertices[0].z)-(vertices[1].z-vertices[0].z)*(vertices[2].x-vertices[0].x))/2;
    for(const w of [[.5,.5,0],[0,.5,.5],[.5,0,.5],[1/3,1/3,1/3]]) {
      const p=vertices.reduce((p,v,j)=>p.addScaledVector(v,w[j]),new THREE.Vector3());
      close(p.y-s.terrainModel.height(p.x,p.z),.006);
    }
    const center=vertices.reduce((p,v)=>p.add(v),new THREE.Vector3()).divideScalar(3);
    assert.ok(Math.abs(center.x)>=.5||Math.abs(center.z)>=.5,'official hole remains empty');
  }
  close(area,11.96);
});

test('caches its ground material clone across rebuilds without altering the stable painter material',()=>{
  const material=new THREE.MeshLambertMaterial({color:'#123456'}),first=setup(material),second=setup(material);
  assert.notEqual(first.surface.material,material);assert.equal(first.surface.material,second.surface.material);
  assert.equal(material.polygonOffset,false);assert.equal(first.surface.material.polygonOffset,true);
  assert.equal(first.unrelated.material,material);assert.equal(first.nested.material,material);
});

test('photo and character callbacks retain their original relative offsets on the lowered ground anchor',()=>{
  assert.equal(typeof module.legacyPhotoHeight,'function');
  const height=(x,z)=>2*x-z,adapted=module.legacyPhotoHeight(height);
  close(adapted(3,2)+.27,height(3,2)+.012);
  close((adapted(3,2)+.25)-(adapted(3,2)+.27),-.02);
  close(height(3,2),4);
});
