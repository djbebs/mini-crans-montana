import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { motionAt } from '../../../crans-montana-p06/people-motion.js';
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
const { planPopulation }=await import('../../../crans-montana-p06/characters.js');

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
      assert.ok(contact.distanceTo(new THREE.Vector3(pose.x,pose.y+.42,pose.z))<.018,
        rider.modelKey+' child must follow the physical seat');
      assert.ok(pose.legL>.7&&pose.legR>.7,'seated rider does not walk in mid-air');
    }
  }
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
