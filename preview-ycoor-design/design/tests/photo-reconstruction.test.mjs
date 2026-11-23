import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createPhotoReconstruction } from '../photo-reconstruction.js';
import { createPilot } from '../pilot.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const source = read('../../assets/ycoor-dxf.json'), photo = read('../photo-reconstruction.json');
const make = (scene, data = structuredClone(photo), reference = structuredClone(source)) =>
  createPhotoReconstruction({ THREE, scene, data, source: reference, originHeight: 1497.117 });

test('photo geometry stays separate, preserves footprint and estimates, and fits every detailed face', () => {
  const before = JSON.stringify(source), scene = new THREE.Scene(), data = structuredClone(photo), original = JSON.stringify(data);
  const layer = make(scene, data, source);
  assert.equal(layer.buildingId, '26152');
  assert.equal(layer.detailCount, 71);
  assert.equal(layer.model.faces.every(face => face.facadeAllowed && !face.orientationAmbiguous), true);
  assert.equal(layer.model.buildings[0].type, 'PHOTO_RECONSTRUCTION_ESTIMATED');
  assert.equal(layer.model.buildings[0].sourceUuid, null, 'estimated mesh never claims an official UUID');
  assert.ok(photo.heightStatus.includes('NOT_SURVEYED'));
  assert.equal(photo.facades.find(f => f.side === 'lake').details.filter(d => d.kind === 'balcony').length, 18);
  assert.equal(photo.facades.some(f => f.side === 'party'), false, 'hidden party openings stay unknown');
  assert.ok(layer.meshes.every(m => m.userData.approximate && m.userData.source === 'photo-reconstruction'));
  assert.ok(layer.meshes.every(m => !m.receiveShadow), 'thin decorative surfaces avoid sector-shadow self-aliasing');
  const old = source.buildings.find(b => b.id === '26152').bounds;
  for (const [e, n] of layer.model.buildings[0].vertices) {
    assert.ok(e >= old[0] - 1e-5 && e <= old[3] + 1e-5 && n >= old[1] - 1e-5 && n <= old[4] + 1e-5);
  }
  assert.equal(JSON.stringify(source), before); assert.equal(JSON.stringify(data), original);
  let freed = 0;
  layer.model.meshes[0].material[0].map.addEventListener('dispose', () => freed++);
  layer.setEnabled(true); layer.setOriginHeight(1500);
  assert.equal(layer.model.group.position.y, -1500); assert.equal(layer.additions.group.position.y, -1500);
  layer.dispose(); layer.dispose(); layer.setEnabled(true);
  assert.equal(freed, 1); assert.equal(layer.enabled, false); assert.equal(scene.children.length, 0);
});

test('a changed official volume or missing estimate/evidence labels rejects before scene attachment', () => {
  for (const mutate of [d => d.referenceSourceUuid = 'other', d => d.sourceBounds[5] += 2,
    d => d.referenceSourceGeometry.vertices[0][2] += .1,
    d => d.approximate = false, d => d.evidenceIds = [], d => d.heightStatus = 'measured']) {
    const scene = new THREE.Scene(), data = structuredClone(photo); mutate(data);
    assert.throws(() => make(scene, data)); assert.equal(scene.children.length, 0);
  }
});

test('an unsupported photographic detail rolls back the optional model without leaking scene objects', () => {
  const data = structuredClone(photo), scene = new THREE.Scene();
  data.facades[0].details[0].u = 500;
  assert.throws(() => make(scene, data), /outside/);
  assert.equal(scene.children.length, 0);
});

test('pilot toggles restore the exact source volume, preserve the official review block and move both layers together', async t => {
  const evidence = read('../design-evidence.json'), before = JSON.stringify(evidence), scene = new THREE.Scene();
  t.mock.method(globalThis, 'fetch', async url => {
    const value = String(url).endsWith('ycoor-dxf.json') ? source : String(url).endsWith('photo-reconstruction.json') ? photo
      : String(url).endsWith('design-evidence.json') ? evidence : null;
    return { ok: Boolean(value), status: value ? 200 : 404, json: async () => structuredClone(value) };
  });
  t.mock.method(console, 'warn', () => {});
  const pilot = await createPilot({ THREE, scene, dataBaseUrl: 'https://example.test/assets/', designBaseUrl: 'https://example.test/design/', originHeight: 1497.117, terrainSnapshot: null });
  const old = pilot.local.meshes.find(m => m.userData.buildingId === '26152');
  assert.equal(pilot.status.reconstructions, 1); assert.equal(pilot.status.photoDetails, 71);
  assert.equal(old.visible, false); assert.equal(pilot.reconstruction.enabled, true);
  assert.equal(pilot.inventory.faces.filter(f => f.buildingId === '26152').every(f => f.status === 'geometry_review'), true);
  assert.equal(pilot.evidence.changes.find(c => c.changeId === 'NORTH-CONSTRUCTION-STATUS').geometryReviewRequired, true);
  pilot.setDesignEnabled(false); assert.equal(old.visible, true); assert.equal(pilot.reconstruction.enabled, false);
  pilot.setDesignEnabled(true); assert.equal(old.visible, false);
  pilot.setVisible(false); assert.equal(old.visible, true); assert.equal(pilot.reconstruction.enabled, false);
  pilot.setVisible(true); assert.equal(old.visible, false); assert.equal(pilot.reconstruction.enabled, true);
  pilot.setOriginHeight(1500); assert.equal(pilot.reconstruction.model.group.position.y, -1500);
  assert.equal(JSON.stringify(evidence), before);
  pilot.dispose(); assert.equal(scene.children.length, 0);
});
