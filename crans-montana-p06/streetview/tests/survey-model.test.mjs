import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSurveyIndex, filterSurvey, headingVector, assetUrl, isStreetViewUrl
} from '../survey-model.js';

const capture = (overrides = {}) => ({
  capture_id: 'C001', building_ids: ['B001'], panorama_id: 'opaque-_PANO',
  latitude: '46.311036', longitude: '7.478052', heading_deg: '0',
  provider: 'Google Street View', imagery_date: 'Jun 2024', title: 'Viewer title',
  screenshot: 'evidence/C001.jpg', metadata_status: 'GPS_ACCURACY_UNVERIFIED',
  ...overrides
});

function fixture() {
  return {
    captures: [
      capture(),
      capture({ capture_id: 'C002', building_ids: ['B002'], heading_deg: '90' }),
      capture({ capture_id: 'C003', building_ids: ['B001'], panorama_id: 'contributor_opaque',
        latitude: '46.312', longitude: '7.48', provider: 'Photographer (third-party sphere)',
        imagery_date: '', title: 'Contributor title' }),
      capture({ capture_id: 'C004', building_ids: [], panorama_id: 'outside-pilot',
        latitude: '46.31', longitude: '7.479', heading_deg: '' })
    ],
    buildings: [{ building_id: 'B001', label: 'Visual group' },
      { building_id: 'B002', identity_status: 'UNVERIFIED' }],
    project_bbox: { south: 46.310568, west: 7.477380, north: 46.311508, east: 7.478730 }
  };
}

test('groups opaque panorama IDs in first-capture order without changing evidence records', () => {
  const raw = fixture();
  const before = structuredClone(raw);
  const index = buildSurveyIndex(raw);
  assert.deepEqual(index.summary, { captures: 4, panoramas: 3, buildings: 2 });
  assert.deepEqual(index.panoramas.map(p => [p.panorama_id, p.map_id]), [
    ['opaque-_PANO', 'P001'], ['contributor_opaque', 'P002'], ['outside-pilot', 'P003']
  ]);
  assert.deepEqual(index.panoramas[0].captureIds, ['C001', 'C002']);
  assert.deepEqual(index.panoramas[0].position, { lat: 46.311036, lon: 7.478052 });
  assert.equal(index.panoramas[0].latitude, '46.311036');
  assert.equal(index.panoramas[0].longitude, '7.478052');
  assert.equal(index.panoramas[0].sourceType, 'google');
  assert.equal(index.panoramas[1].sourceType, 'contributor');
  assert.equal(index.panoramas[1].imagery_date, '');
  assert.equal(index.captureById.get('C001'), raw.captures[0]);
  assert.equal(index.panoramaById.get('opaque-_PANO'), index.panoramas[0]);
  assert.equal(index.buildingById.get('B001'), raw.buildings[0]);
  assert.equal(index.captures[2], raw.captures[2]);
  assert.equal(index.buildings[1], raw.buildings[1]);
  assert.deepEqual(raw, before);
});

test('keeps absent metadata absent and never replaces it with inferred values', () => {
  const entry = capture();
  delete entry.imagery_date;
  delete entry.title;
  delete entry.provider;
  const result = buildSurveyIndex({ captures: [entry], buildings: [] });
  assert.equal(result.panoramas[0].imagery_date, undefined);
  assert.equal(result.panoramas[0].title, undefined);
  assert.equal(result.panoramas[0].provider, undefined);
  assert.equal(result.panoramas[0].sourceType, 'contributor');
  assert.equal(Object.hasOwn(entry, 'imagery_date'), false);
});

test('rejects missing, malformed and out-of-range coordinates instead of placing cameras at zero', () => {
  const invalid = ['', '  ', null, undefined, NaN, Infinity, true, [], '46.31north', '0x20'];
  for (const latitude of invalid) {
    assert.throws(() => buildSurveyIndex({ captures: [capture({ latitude })], buildings: [] }), /C001.*latitude/i);
  }
  for (const [field, value] of [['latitude', '90.01'], ['latitude', -91],
    ['longitude', '180.01'], ['longitude', '-181']]) {
    assert.throws(() => buildSurveyIndex({ captures: [capture({ [field]: value })], buildings: [] }), new RegExp(`C001.*${field}`, 'i'));
  }
  assert.deepEqual(buildSurveyIndex({ captures: [capture({ latitude: '0', longitude: '-180' })], buildings: [] })
    .panoramas[0].position, { lat: 0, lon: -180 });
});

test('reports conflicting coordinate, provider or date metadata for the same panorama', () => {
  for (const [field, value] of [['latitude', '46.311037'], ['longitude', '7.478053'],
    ['provider', 'A contributor'], ['imagery_date', 'Jul 2024']]) {
    const raw = { captures: [capture(), capture({ capture_id: 'C002', [field]: value })], buildings: [] };
    assert.throws(() => buildSurveyIndex(raw), new RegExp(`opaque-_PANO.*${field}`, 'i'));
  }
});

test('reports duplicate capture or visual building IDs rather than losing records in lookup maps', () => {
  assert.throws(() => buildSurveyIndex({ captures: [capture(), capture()], buildings: [] }), /duplicate.*capture.*C001/i);
  assert.throws(() => buildSurveyIndex({ captures: [], buildings: [{ building_id: 'B001' }, { building_id: 'B001' }] }), /duplicate.*building.*B001/i);
});

test('filters captures by visual association and source while retaining outside-pilot panoramas', () => {
  const index = buildSurveyIndex(fixture());
  assert.deepEqual(filterSurvey(index).captures.map(c => c.capture_id), ['C001', 'C002', 'C003', 'C004']);
  assert.deepEqual(filterSurvey(index).panoramas.map(p => p.map_id), ['P001', 'P002', 'P003']);
  assert.deepEqual(filterSurvey(index, { buildingId: 'B001' }).captures.map(c => c.capture_id), ['C001', 'C003']);
  assert.deepEqual(filterSurvey(index, { buildingId: 'B001' }).panoramas.map(p => p.map_id), ['P001', 'P002']);
  assert.deepEqual(filterSurvey(index, { source: 'google' }).captures.map(c => c.capture_id), ['C001', 'C002', 'C004']);
  assert.deepEqual(filterSurvey(index, { source: 'contributor', buildingId: 'B001' }).captures.map(c => c.capture_id), ['C003']);
  assert.deepEqual(filterSurvey(index, { buildingId: 'B404' }), { captures: [], panoramas: [] });
  assert.throws(() => filterSurvey(index, { source: 'unknown' }), /source/i);
  assert.deepEqual(index.panoramas[0].captureIds, ['C001', 'C002']);
});

test('converts valid viewer headings to local north, east, south and west vectors', () => {
  for (const [heading, x, z] of [['0', 0, -1], [90, 1, 0], ['180', 0, 1], [270, -1, 0], [360, 0, -1], [-90, -1, 0]]) {
    const result = headingVector(heading);
    assert.ok(Math.abs(result.x - x) < 1e-12);
    assert.ok(Math.abs(result.z - z) < 1e-12);
  }
  for (const invalid of ['', ' ', null, undefined, NaN, Infinity, true, [], '90east', '0x10']) {
    assert.equal(headingVector(invalid), null);
  }
});

test('resolves evidence paths inside the provided HTTP asset directory', () => {
  const base = new URL('https://example.test/atlas/assets/survey/2026-11-15/');
  assert.equal(assetUrl('evidence/C001.jpg', base), 'https://example.test/atlas/assets/survey/2026-11-15/evidence/C001.jpg');
  assert.equal(assetUrl('./coverage-map.html', base), 'https://example.test/atlas/assets/survey/2026-11-15/coverage-map.html');
  assert.equal(assetUrl('evidence/A B.jpg', base), 'https://example.test/atlas/assets/survey/2026-11-15/evidence/A%20B.jpg');
});

test('rejects asset traversal, external URLs, URL schemes and encoded separators', () => {
  const base = 'https://example.test/atlas/assets/survey/';
  for (const path of ['../secret', 'evidence/../../secret', '/outside.jpg', '//other.test/a',
    'https://other.test/a', 'javascript:alert(1)', 'data:image/png,abc', 'file:///tmp/a',
    'evidence\\..\\a', '%2e%2e/a', '%252e%252e/a', 'evidence/%2f..%2fsecret',
    'evidence/%5c..%5csecret', '', '  ', null]) {
    assert.throws(() => assetUrl(path, base), /asset|path/i, String(path));
  }
  assert.throws(() => assetUrl('evidence/C001.jpg', 'file:///tmp/survey/'), /base|http/i);
  assert.throws(() => assetUrl('evidence/C001.jpg', 'https://example.test/survey'), /base|directory/i);
});

test('allows HTTPS Google Maps source links and rejects deceptive hosts or protocols', () => {
  for (const url of ['https://www.google.com/maps/@46.31,7.47,3a,75y,0h,90t/data=!1e1',
    'https://google.com/maps?api=1&map_action=pano', 'https://maps.google.com/maps?layer=c']) {
    assert.equal(isStreetViewUrl(url), true, url);
  }
  for (const url of ['http://www.google.com/maps/@x', 'https://www.google.com.evil.test/maps/@x',
    'https://evil.test/maps/@x', 'https://google.com/maps.evil', 'https://google.com/search?q=maps',
    'https://user:pass@www.google.com/maps/@x', 'https://www.google.com:8443/maps/@x',
    'javascript:alert(1)', 'file:///maps/@x', '//www.google.com/maps/@x', '', null, {}]) {
    assert.equal(isStreetViewUrl(url), false, String(url));
  }
});

test('indexes all immutable survey evidence and preserves 116 associations plus four unassigned views', async () => {
  const raw = JSON.parse(await readFile(new URL('../../assets/streetview-survey/2026-11-15/survey-data.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(raw);
  const index = buildSurveyIndex(raw);
  assert.deepEqual(index.summary, { captures: 55, panoramas: 24, buildings: 22 });
  assert.equal(index.captures.reduce((count, c) => count + c.building_ids.length, 0), 116);
  assert.equal(index.captures.reduce((count, c) => count + Math.max(1, c.building_ids.length), 0), 120);
  assert.equal(index.panoramas[0].panorama_id, 'KYyatjHZFHgI668LQ0aCGw');
  assert.equal(index.panoramas[23].panorama_id, 'ob1EjSVlnSg4pDY-PzEOIg');
  assert.equal(index.panoramas[23].map_id, 'P024');
  assert.equal(index.captureById.get('C024').building_ids.length, 0);
  assert.equal(filterSurvey(index, { source: 'google' }).captures.length, 43);
  assert.equal(filterSurvey(index, { source: 'contributor' }).captures.length, 12);
  assert.equal(filterSurvey(index).captures.some(c => c.capture_id === 'C016'), true);
  assert.ok(index.panoramaById.get('F5LkD2GsMlvtEKX2wW7tqw').position.lat > raw.project_bbox.north);
  assert.ok(raw.captures.every(c => isStreetViewUrl(c.streetview_url)));
  assert.equal(JSON.stringify(raw), before);
});
