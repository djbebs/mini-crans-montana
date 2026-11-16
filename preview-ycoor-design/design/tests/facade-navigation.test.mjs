import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createPilot } from '../pilot.js';

const source = JSON.parse(await readFile(new URL('../../assets/ycoor-dxf.json', import.meta.url)));
const recorded = JSON.parse(await readFile(new URL('../design-evidence.json', import.meta.url)));

async function setup(t) {
  const data = structuredClone(source), evidence = structuredClone(recorded);
  const first = evidence.changes.find(change => change.changeId === 'RAWYL-FACADE-PILOT');
  // A translated copy of the actual DXF volume gives a distinct, supported target.
  const copy = structuredClone(data.buildings.find(building => building.id === first.buildingId));
  copy.id = 'navigation-copy';
  copy.vertices.forEach(vertex => { vertex[0] += 30; });
  data.buildings.push(copy);
  const second = { ...structuredClone(first), changeId: 'SECOND-FACADE', buildingId: copy.id,
    faceId: first.faceId.replace(first.buildingId, copy.id), observationIds: ['copy-observation'] };
  evidence.buildingMatches.push({ ...structuredClone(evidence.buildingMatches.find(match => match.buildingId === first.buildingId)), buildingId: copy.id });
  evidence.observations.push({ ...structuredClone(evidence.observations.find(observation => observation.observationId === first.observationIds[0])),
    observationId: 'copy-observation', buildingId: copy.id, faceId: second.faceId });
  evidence.changes = [first, second, { ...structuredClone(first), changeId: 'UNRESOLVED', status: 'unresolved' }];
  t.mock.method(globalThis, 'fetch', async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/ycoor-dxf.json')) return { ok: true, json: async () => data };
    if (path.endsWith('/design-evidence.json')) return { ok: true, json: async () => evidence };
    if (path.endsWith('/terrain-snapshot.json')) return { ok: true, json: async () => null };
    // Panel failure must leave the independently usable geometry/navigation intact.
    return { ok: false, status: 503 };
  });
  t.mock.method(console, 'warn', () => {});
  const focused = [];
  const pilot = await createPilot({ THREE, scene: new THREE.Scene(), originHeight: 1497.1,
    dataBaseUrl: 'https://preview.test/assets/', designBaseUrl: 'https://preview.test/design/',
    surveyBaseUrl: 'https://preview.test/survey/', onFocus: target => focused.push(target) });
  t.after(() => pilot.dispose());
  return { pilot, first, second, focused };
}

test('requested ready facade resolves its actual building and translated DXF plane', async t => {
  const { pilot, second, focused } = await setup(t);
  assert.equal(typeof pilot.focusFacade, 'function');
  assert.equal(pilot.focusFacade('SECOND-FACADE'), true);
  assert.equal(focused.length, 1);
  assert.equal(focused[0].change, second);
  assert.equal(focused[0].building.id, 'navigation-copy');
  assert.equal(focused[0].face.id, 'navigation-copy:wall:002');
  const originalFace = pilot.local.faces.find(face => face.id === '2997D:wall:002');
  assert.ok(Math.abs(focused[0].face.origin[0] - originalFace.origin[0] - 30) < 0.000001);
});

test('omitted ID and backward alias retain the first ready facade default', async t => {
  const { pilot, first, focused } = await setup(t);
  assert.equal(typeof pilot.focusFacade, 'function');
  assert.equal(pilot.focusFacade(), true);
  assert.equal(pilot.focusFirstFacade(), true);
  assert.deepEqual(focused.map(target => target.change.changeId), [first.changeId, first.changeId]);
});

test('unknown, unresolved and missing geometry targets leave the current focus unchanged', async t => {
  const { pilot, first, second, focused } = await setup(t);
  assert.equal(typeof pilot.focusFacade, 'function');
  pilot.focusFacade(first.changeId);
  for (const id of ['missing', '', 'UNRESOLVED']) assert.equal(pilot.focusFacade(id), false);
  second.faceId = 'missing-face';
  assert.equal(pilot.focusFacade(second.changeId), false);
  second.faceId = first.faceId;
  assert.equal(pilot.focusFacade(second.changeId), false, 'another building cannot resolve this plane');
  second.buildingId = 'missing-building';
  assert.equal(pilot.focusFacade(second.changeId), false);
  assert.deepEqual(focused.map(target => target.change.changeId), [first.changeId]);
  pilot.dispose();
  assert.equal(pilot.focusFacade(first.changeId), false);
});

test('inventory can inspect an unreviewed source plane without creating a documented façade', async t => {
  const { pilot, focused } = await setup(t);
  assert.equal(typeof pilot.focusFace, 'function');
  const face = pilot.local.faces.find(face => face.buildingId === '2F7D6' && face.facadeAllowed && !face.orientationAmbiguous);
  assert.equal(pilot.focusFace(face.id), true);
  assert.equal(focused[0].face, face);
  assert.equal(focused[0].change, undefined);
  assert.equal(pilot.focusFace('missing-face'), false);
  face.orientationAmbiguous = true;
  assert.equal(pilot.focusFace(face.id), false);
  assert.equal(focused.length, 1);
  assert.equal(pilot.inventory.summary.faceCount, pilot.local.faces.length);
  pilot.dispose();
  assert.equal(pilot.focusFace(face.id), false);
});
