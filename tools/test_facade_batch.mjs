import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBatch } from './prepare-facade-batch.mjs';

function fixture() {
  return {
    inventory: { buildings: [
      { buildingId: 'a', visualIds: ['B001'], sourceDate: { year: 2020 }, faceIds: ['a:1', 'a:2'] },
      { buildingId: 'b', visualIds: ['B002'], sourceDate: null, faceIds: ['b:1'] },
      { buildingId: 'c', visualIds: ['B003'], sourceDate: null, faceIds: ['c:1'] },
    ], faces: [
      { faceId: 'a:1', status: 'partial', orientation: 'Ouest', evidenceIds: ['C1'], candidateCaptureIds: ['C1', 'C2'] },
      { faceId: 'a:2', status: 'not_reviewed', orientation: 'Est', evidenceIds: [], candidateCaptureIds: ['C1', 'C2'] },
      { faceId: 'b:1', status: 'geometry_review', orientation: 'Nord', nextAction: 'Verify final volume.', evidenceIds: [], candidateCaptureIds: [] },
      { faceId: 'c:1', status: 'not_reviewed', orientation: 'Sud', evidenceIds: [], candidateCaptureIds: [] },
    ] },
    evidence: { changes: [{ changeId: 'change-a', buildingId: 'a', faceId: 'a:1', status: 'ready', details: [{ id: 'window-a', kind: 'window', u: 1, v: 10, width: 2, height: 1, evidenceIds: ['C1'] }] }],
      captures: [{ capture_id: 'C1', screenshot: 'evidence/C1.jpg', imagery_date: null, latitude: '46.1', longitude: '7.2', heading_deg: '90' },
        { capture_id: 'C2', screenshot: 'evidence/C2.jpg', imagery_date: 'Jun 2024', latitude: null, longitude: null, heading_deg: null }] },
    planes: [{ id: 'a:1', origin: [1, 0, 2], u: [1, 0, 0], normal: [0, 0, -1], bounds: { minU: 0, maxU: 5, minV: 8, maxV: 15 }, triangles: [[[0, 8], [5, 8], [0, 15]]] }],
  };
}

test('automatic batches prefer documented work, omit blocked buildings, and retain the complete face backlog', () => {
  const input = fixture(), before = JSON.stringify(input);
  const batch = prepareBatch({ ...input, limit: 2, maxFaces: 1, maxPhotos: 1 });
  assert.deepEqual(batch.buildings.map(building => building.buildingId), ['a', 'c']);
  assert.deepEqual(batch.buildings[0].remainingFaceIds, ['a:2']);
  assert.equal(batch.buildings[0].faceCount, 2);
  assert.equal(batch.buildings[0].faces[0].plane.bounds.maxU, 5);
  assert.deepEqual(batch.buildings[0].faces[0].plane.triangles, input.planes[0].triangles);
  assert.equal(batch.buildings[0].faces[0].details[0].id, 'window-a');
  assert.deepEqual(batch.buildings[0].remainingCaptureIds, ['C2']);
  assert.equal(batch.buildings[0].photos[0].imageryDate, null);
  assert.equal(JSON.stringify(input), before);
});

test('explicit blocked targets stay inspectable and unknown targets fail clearly', () => {
  const input = fixture();
  const batch = prepareBatch({ ...input, buildingIds: ['b'], limit: 1 });
  assert.equal(batch.buildings[0].blocked, true);
  assert.equal(batch.buildings[0].faces[0].status, 'geometry_review');
  assert.equal(batch.buildings[0].faces[0].nextAction, 'Verify final volume.');
  assert.deepEqual(batch.buildings[0].faces[0].details, []);
  assert.throws(() => prepareBatch({ ...input, buildingIds: ['missing'] }), /Unknown building/);
});

test('photos remain candidates unless a face has explicit evidence and raw unknowns remain unknown', () => {
  const input = fixture();
  const batch = prepareBatch({ ...input, buildingIds: ['a'], maxFaces: 2, maxPhotos: 2 });
  assert.equal(batch.buildings[0].faces[0].photosAssigned, true);
  assert.equal(batch.buildings[0].faces[1].photosAssigned, false);
  assert.equal(batch.buildings[0].photos[1].camera.latitude, null);
  assert.equal(batch.buildings[0].photos[0].camera.viewerHeadingDeg, '90');
});
