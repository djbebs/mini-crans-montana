import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

test('linked capture records retain every source field and original survey evidence stays unchanged', () => {
  const data = evidence();
  const surveyBase = new URL('../../../crans-montana-p06/assets/streetview-survey/2026-11-15/', import.meta.url);
  const original = read(new URL('survey-data.json', surveyBase));
  const supplementary = readdirSync(surveyBase).filter(name => /^supplement-.*\.json$/.test(name)).sort()
    .flatMap(name => read(new URL(name, surveyBase)).captures);
  const combined = [...original.captures, ...supplementary];
  const byId = new Map(combined.map(capture => [capture.capture_id, capture]));
  assert.equal(byId.size, combined.length, 'capture IDs are unique across all source files');
  for (const capture of data.captures) assert.deepEqual(capture, byId.get(capture.capture_id));
  const provenance = read(new URL('provenance-sha256.json', surveyBase));
  const originals = provenance.files.filter(file => file.path === 'survey-data.json' || /^evidence\/C\d{3}\.(jpg|txt)$/.test(file.path));
  assert.equal(originals.length, 111, 'the source survey and 55 original JPG/TXT pairs are protected');
  for (const file of originals) {
    const actual = createHash('sha256').update(readFileSync(new URL(file.path, surveyBase))).digest('hex');
    assert.equal(actual, file.sha256, `original source changed: ${file.path}`);
  }
  assert.ok(data.captures.some(capture => capture.imagery_date === 'Jun 2025'));
  assert.ok(data.observations.some(observation => observation.observedAt === '2024-06'));
  assert.ok(data.observations.some(observation => observation.observedAt === '2025-06'));
});

test('documented façade zones fit their actual source faces and leave unresolved changes absent', () => {
  const data = evidence();
  const scene = new THREE.Scene();
  const local = createLocalBuildings({ THREE, scene, data: read('../../assets/ycoor-dxf.json'), originHeight: 1497.1 });
  const ready = data.changes.filter(change => change.status === 'ready');
  const rawyl = ready.find(change => change.changeId === 'RAWYL-FACADE-PILOT');
  assert.equal(rawyl.buildingId, '2997D');
  const face = local.faces.find(face => face.id === rawyl.faceId);
  assert.ok(face.facadeAllowed && !face.orientationAmbiguous);
  assert.ok(face.normal[0] < -.6 && face.normal[2] < -.6);
  assert.ok(face.maxPlanarityError < .005);
  const additions = createDesignEnhancements({ THREE, scene, changes: data.changes, faces: local.faces, originHeight: 1497.1 });
  const b003West = ready.find(change => change.changeId === 'SOUTH-RED-BALCONIES');
  const b003WestExtension = ready.find(change => change.changeId === 'WEST-FRONTAGE-2024-EXTENSION');
  assert.equal(b003West.buildingId, '2F7D6');
  assert.equal(b003West.faceId, '2F7D6:wall:001');
  assert.equal(b003WestExtension.buildingId, b003West.buildingId);
  assert.equal(b003WestExtension.faceId, b003West.faceId);
  const b003WestFace = local.faces.find(face => face.id === b003West.faceId);
  assert.ok(b003WestFace.facadeAllowed && b003WestFace.normal[0] < -.99 && b003WestFace.normal[2] > .09);
  const balconies = b003West.details.filter(detail => detail.id.startsWith('south-balcony-'));
  assert.equal(balconies.length, 3, 'three continuous balcony components replace the original short sections');
  assert.ok(balconies.every(detail => detail.width > 30 && detail.evidenceIds.includes('B003-N002')));
  assert.equal(b003West.details.filter(detail => detail.id.startsWith('south-ground-glass-')).length, 4,
    'the four original glazing components remain documented, without implying a building window total');
  assert.ok(b003WestExtension.details.some(detail => detail.id === 'west-ground-entry-glass'));
  assert.ok(b003WestExtension.details.some(detail => detail.id === 'west-south-ground-door'));
  assert.ok(b003WestExtension.details.every(detail => detail.evidenceIds.length > 0));
  assert.equal(rawyl.details.length, 19, 'the first authored façade remains intact');
  for (const [changeId, faceId, captureId, axis, sign] of [
    ['B003-NORTH-RETURN', '2F7D6:wall:004', 'B003-N004', 2, -1],
    ['B003-SOUTH-RETURN', '2F7D6:wall:005', 'B003-N007', 2, 1],
  ]) {
    const change = ready.find(change => change.changeId === changeId);
    assert.equal(change.buildingId, '2F7D6');
    assert.equal(change.faceId, faceId);
    const returnFace = local.faces.find(face => face.id === faceId);
    assert.ok(returnFace.facadeAllowed && !returnFace.orientationAmbiguous);
    assert.ok(returnFace.normal[axis] * sign > .99, `${changeId} uses the outward source face`);
    assert.ok(change.evidenceIds.includes(captureId));
    assert.ok(change.details.every(detail => detail.evidenceIds.includes(captureId)));
    assert.equal(change.details.filter(detail => detail.kind === 'balcony' && detail.id.includes('balcony-')).length, 3,
      'only the three visible balcony returns are authored');
    for (const observationId of change.observationIds) {
      const observation = data.observations.find(item => item.observationId === observationId);
      assert.equal(observation.faceId, faceId);
      assert.ok(observation.captureIds.includes(captureId));
    }
  }
  const b003South = ready.find(change => change.changeId === 'B003-SOUTH-RETURN');
  assert.ok(b003South.details.every(detail => !['window', 'door', 'shutter'].includes(detail.kind)),
    'the obscured south openings remain unknown');
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
