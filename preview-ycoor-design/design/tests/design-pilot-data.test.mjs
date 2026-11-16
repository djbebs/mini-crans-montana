import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { validateDesignEvidence } from '../design-model.js';
import { createLocalBuildings } from '../local-buildings.js';
import { createDesignEnhancements } from '../design-enhancements.js';
import { createPilot, pickPilotGeometry } from '../pilot.js';

const evidenceUrl = new URL('../design-evidence.json', import.meta.url);
function evidence() {
  assert.ok(existsSync(evidenceUrl), 'The pilot needs its audited evidence register.');
  return validateDesignEvidence(JSON.parse(readFileSync(evidenceUrl, 'utf8')));
}
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('six visual matches preserve the dated source and keep the northern mass correction unresolved', () => {
  const data = evidence();
  const geometry = read('../../assets/ycoor-dxf.json');
  assert.deepEqual(data.buildingMatches.map(match => match.buildingId).sort(), geometry.buildings.map(building => building.id).sort());
  assert.equal(data.buildingMatches.filter(match => match.status === 'confirmed').length, 6);
  const north = data.buildingMatches.find(match => match.buildingId === '26152');
  assert.equal(north.status, 'confirmed');
  assert.deepEqual(north.sourceDate, { year: 2020, month: 6 });
  assert.ok(north.evidenceIds.includes('C013') && north.evidenceIds.includes('C017') && north.evidenceIds.includes('C022'));
  assert.equal(data.changes.find(change => change.changeId === 'NORTH-CONSTRUCTION-STATUS').status, 'unresolved');
  for (const match of data.buildingMatches) {
    assert.equal(match.sourceUuid, geometry.buildings.find(building => building.id === match.buildingId).sourceUuid);
  }
});

test('linked capture records retain every original field, including imagery and screenshot dates', () => {
  const data = evidence();
  const original = read('../../../crans-montana-p06/assets/streetview-survey/2026-11-15/survey-data.json');
  const byId = new Map(original.captures.map(capture => [capture.capture_id, capture]));
  for (const capture of data.captures) assert.deepEqual(capture, byId.get(capture.capture_id));
  assert.ok(data.captures.some(capture => capture.imagery_date === 'Jun 2025'));
  assert.ok(data.observations.some(observation => observation.observedAt === '2024-06'));
  assert.ok(data.observations.some(observation => observation.observedAt === '2025-06'));
});

test('three documented façades fit their actual source faces and leave unresolved changes absent', () => {
  const data = evidence();
  const scene = new THREE.Scene();
  const local = createLocalBuildings({ THREE, scene, data: read('../../assets/ycoor-dxf.json'), originHeight: 1497.1 });
  const ready = data.changes.filter(change => change.status === 'ready');
  assert.equal(ready.length, 3);
  assert.equal(ready[0].buildingId, '2997D');
  const face = local.faces.find(face => face.id === ready[0].faceId);
  assert.ok(face.facadeAllowed && !face.orientationAmbiguous);
  assert.ok(face.normal[0] < -.6 && face.normal[2] < -.6);
  assert.ok(face.maxPlanarityError < .005);
  const additions = createDesignEnhancements({ THREE, scene, changes: data.changes, faces: local.faces, originHeight: 1497.1 });
  const south = ready.find(change => change.changeId === 'SOUTH-RED-BALCONIES');
  assert.equal(south.buildingId, '2F7D6');
  assert.equal(south.faceId, '2F7D6:wall:001');
  const southFace = local.faces.find(face => face.id === south.faceId);
  assert.ok(southFace.facadeAllowed && southFace.normal[0] < -.99 && southFace.normal[2] > .09);
  assert.equal(south.details.filter(detail => detail.id.startsWith('south-balcony-')).length, 3);
  assert.equal(south.details.filter(detail => detail.id.startsWith('south-ground-glass-')).length, 4);
  assert.ok(south.details.every(detail => detail.u + detail.width / 2 < 8.5), 'only the documented northern frontage is interpreted');
  assert.equal(ready[0].details.length, 19, 'the first authored façade remains intact');
  assert.equal(south.details.length, 15, 'the second authored façade remains intact');
  const west = ready.find(change => change.changeId === 'WEST-SHUTTERS');
  assert.equal(west.buildingId, '2355E');
  assert.equal(west.faceId, '2355E:wall:001');
  const westFace = local.faces.find(face => face.id === west.faceId);
  assert.ok(westFace.facadeAllowed && !westFace.orientationAmbiguous);
  assert.ok(westFace.normal[0] < -.99 && westFace.normal[2] > .09);
  const shutters = west.details.filter(detail => detail.kind === 'shutter');
  assert.equal(shutters.length, 2, 'only the two unobscured lower closed shutters are authored');
  assert.ok(shutters.every(detail => detail.evidenceIds.includes('C003')));
  assert.equal(west.details.filter(detail => detail.kind === 'door').length, 1);
  assert.ok(west.details.every(detail => detail.v + detail.height / 2 < 1505), 'no upper row is inferred behind the UI or balcony');
  const westObservation = data.observations.find(observation => west.observationIds.includes(observation.observationId));
  assert.equal(westObservation.faceId, west.faceId);
  assert.deepEqual(westObservation.captureIds, ['C003', 'C026', 'C027']);
  assert.equal(additions.group.children.length, ready.reduce((sum, change) => sum + change.details.length, 0));
  for (const object of additions.group.children) assert.ok(ready.some(change => change.changeId === object.userData.changeId));
  additions.dispose(); local.dispose();
  assert.equal(scene.children.length, 0);
});

test('visible details select from the front, while walls and foreground objects occlude them', () => {
  const data = evidence(), scene = new THREE.Scene(), selected = [];
  const local = createLocalBuildings({ THREE, scene, data: read('../../assets/ycoor-dxf.json'), originHeight: 1497.1,
    onSelect: building => selected.push(building.id) });
  const additions = createDesignEnhancements({ THREE, scene, changes: data.changes, faces: local.faces, originHeight: 1497.1,
    onSelect: hit => selected.push(hit.detailId) });
  additions.setEnabled(true);
  const change = data.changes.find(change => change.status === 'ready');
  const face = local.faces.find(face => face.id === change.faceId);
  const detail = change.details.find(detail => detail.kind === 'window');
  const point = new THREE.Vector3(...face.origin).addScaledVector(new THREE.Vector3(...face.u), detail.u);
  point.y = detail.v - 1497.1;
  const normal = new THREE.Vector3(...face.normal);
  const front = new THREE.Raycaster(point.clone().addScaledVector(normal, 100), normal.clone().negate());
  assert.equal(pickPilotGeometry(front, { local, additions }), true);
  assert.equal(selected.at(-1), detail.id);
  selected.length = 0;
  const back = new THREE.Raycaster(point.clone().addScaledVector(normal, -100), normal);
  assert.equal(pickPilotGeometry(back, { local, additions }), true);
  assert.ok(local.buildings.some(building => building.id === selected.at(-1)), 'a nearer building wall selects instead of the hidden detail');
  selected.length = 0;
  assert.equal(pickPilotGeometry(front, { local, additions, maxDistance: 1 }), false);
  assert.deepEqual(selected, [], 'foreground objects prevent all background pilot selection');
  additions.dispose(); local.dispose();
});

test('unavailable evidence keeps all six local volumes usable', async t => {
  const geometry = read('../../assets/ycoor-dxf.json');
  t.mock.method(globalThis, 'fetch', async url => ({ ok: String(url).endsWith('ycoor-dxf.json'), status: 503, json: async () => geometry }));
  t.mock.method(console, 'warn', () => {});
  const scene = new THREE.Scene();
  const pilot = await createPilot({ THREE, scene, dataBaseUrl: 'https://example.test/assets/',
    designBaseUrl: 'https://example.test/design/', surveyBaseUrl: 'https://example.test/survey/', originHeight: 1497.1 });
  assert.equal(pilot.local.buildings.length, 6);
  assert.equal(pilot.local.group.visible, true);
  assert.equal(pilot.status.designReady, false);
  assert.equal(pilot.panelReady, false);
  pilot.setOriginHeight(1498);
  assert.equal(pilot.local.group.position.y, -1498);
  pilot.dispose();
  assert.equal(scene.children.length, 0);
});

test('unavailable source geometry rejects without leaving scene resources', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  t.mock.method(console, 'warn', () => {});
  const scene = new THREE.Scene();
  await assert.rejects(createPilot({ THREE, scene, dataBaseUrl: 'https://example.test/assets/',
    designBaseUrl: 'https://example.test/design/', originHeight: 1497.1 }), /HTTP 503/);
  assert.equal(scene.children.length, 0);
});
