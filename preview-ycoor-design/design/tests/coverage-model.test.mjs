import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLocalBuildings } from '../local-buildings.js';
import { buildFacadeInventory, inventoryToCsv } from '../coverage-model.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const evidence = read('../design-evidence.json');
const data = read('../../assets/ycoor-dxf.json');
const local = createLocalBuildings({ THREE, scene: new THREE.Scene(), data, originHeight: 1497.1 });
const args = () => ({ buildings: structuredClone(data.buildings), faces: structuredClone(local.faces), evidence: structuredClone(evidence) });

test('every actual source wall plane appears once without inventing complete façades or window totals', () => {
  const input = args(), before = JSON.stringify(input), result = buildFacadeInventory(input);
  assert.equal(result.summary.buildingCount, 6);
  assert.equal(result.summary.faceCount, 43);
  assert.deepEqual(result.faces.map(face => face.faceId).sort(), local.faces.map(face => face.id).sort());
  assert.equal(result.summary.partialFaceCount, 3);
  assert.equal(result.summary.completeFaceCount, 0);
  assert.equal(result.summary.totalWindowCount, null);
  assert.equal(result.summary.detailCount, 44);
  for (const face of result.faces) {
    assert.equal(face.totalWindowCount, null);
    assert.equal(face.complete, false);
    assert.ok(result.buildings.find(building => building.buildingId === face.buildingId).faceIds.includes(face.faceId));
  }
  assert.equal(JSON.stringify(input), before, 'inventory must not edit evidence or source geometry');
});

test('unresolved identity blocks attribution, and candidate photos are not claimed as face evidence', () => {
  const input = args();
  input.evidence.buildingMatches.find(match => match.buildingId === '26152').status = 'unresolved';
  const result = buildFacadeInventory(input);
  const uncertain = result.faces.filter(face => face.buildingId === '26152');
  assert.ok(uncertain.length);
  assert.ok(uncertain.every(face => face.status === 'identity_unresolved' && face.evidenceIds.length === 0));
  assert.ok(uncertain.some(face => face.candidateCaptureIds.length));
  const south = result.faces.find(face => face.faceId === '2F7D6:wall:001');
  assert.equal(south.status, 'partial');
  assert.deepEqual(south.changeIds, ['SOUTH-RED-BALCONIES']);
  assert.ok(south.evidenceIds.includes('C029'));
  assert.equal(south.orientation, 'Ouest');
});

test('ready records cannot silently target missing, wrong-building or ambiguous source planes', () => {
  for (const changeTarget of ['missing', '2F7D6:wall:001']) {
    const input = args();
    const change = input.evidence.changes.find(change => change.changeId === 'RAWYL-FACADE-PILOT');
    change.faceId = changeTarget;
    for (const observation of input.evidence.observations.filter(item => change.observationIds.includes(item.observationId))) observation.faceId = changeTarget;
    assert.throws(() => buildFacadeInventory(input), /face|plane/i);
  }
  const input = args();
  input.faces.find(face => face.id === '2997D:wall:002').orientationAmbiguous = true;
  assert.throws(() => buildFacadeInventory(input), /ambiguous|face|plane/i);
});

test('duplicate or orphan geometry records are rejected instead of disappearing from the queue', () => {
  const input = args();
  input.faces.push(structuredClone(input.faces[0]));
  assert.throws(() => buildFacadeInventory(input), /duplicate/i);
  const orphan = args();
  orphan.faces[0].buildingId = 'unknown';
  assert.throws(() => buildFacadeInventory(orphan), /building/i);
});

test('ambiguous unreviewed planes stay in the inventory and cannot be focused', () => {
  const input = args();
  const face = input.faces.find(face => !input.evidence.changes.some(change => change.status === 'ready' && change.faceId === face.id));
  face.orientationAmbiguous = true;
  const result = buildFacadeInventory(input), row = result.faces.find(row => row.faceId === face.id);
  assert.equal(row.status, 'geometry_ambiguous');
  assert.equal(row.canFocus, false);
  assert.equal(result.summary.faceCount, 43);
});

test('a visually identified building still waits for a measured geometry check before window authoring', () => {
  const input = args();
  input.evidence.buildingMatches.find(match => match.buildingId === '26152').status = 'confirmed';
  input.evidence.changes.find(change => change.changeId === 'NORTH-CONSTRUCTION-STATUS').geometryReviewRequired = true;
  const result = buildFacadeInventory(input), north = result.faces.filter(face => face.buildingId === '26152');
  assert.ok(north.length);
  assert.ok(north.every(face => face.status === 'geometry_review' && face.canFocus && face.detailCount === 0));
  assert.ok(result.summary.blockedFaceCount >= north.length);
});

test('CSV distinguishes drawn opening components from unknown totals and escapes spreadsheet content', () => {
  const result = buildFacadeInventory(args());
  result.faces[0].nextAction = 'Voir "face", puis\nphoto';
  result.faces[0].orientation = '=1+2';
  const csv = inventoryToCsv(result);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('opening_detail_count,total_window_count,complete'));
  assert.ok(csv.includes('"Voir ""face"", puis\nphoto"'));
  assert.ok(csv.includes('"\'=1+2"'), 'spreadsheet formulas must remain text');
  assert.ok(csv.includes(',"","false",'));
});
