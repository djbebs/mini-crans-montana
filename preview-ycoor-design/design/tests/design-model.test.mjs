import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateDesignEvidence, orderedSources, assetUrl, isStreetViewUrl } from '../design-model.js';

const fixture = () => ({
  schemaVersion: 1,
  buildingMatches: [{ buildingId: 'Y001', sourceUuid: 'official-uuid', surveyIds: ['B002'], status: 'confirmed', evidenceIds: ['C003'], reason: 'Visible alignment reviewed against geometry.', sourceDate: { year: 2020, month: 6 } }],
  observations: [{ observationId: 'O001', buildingId: 'Y001', faceId: 'west', sourceId: 'streetview', captureIds: ['C003'], observedAt: null, statement: 'Visible doors on lower façade.', confidence: 'medium', limitations: ['Upper floors outside frame.'] }],
  changes: [{ changeId: 'D001', buildingId: 'Y001', faceId: 'west', status: 'ready', title: 'Portes', discrepancy: 'missing_detail', evidenceIds: ['C003'], observationIds: ['O001'], reason: 'Visible detail omitted by volume geometry.', confidence: 'medium', approximate: true, details: [{ kind: 'door', width: 1, height: 2, depth: 0.08 }] }],
  captures: [{ capture_id: 'C003', screenshot: 'evidence/C003.jpg', imagery_date: null, captured_at_utc: '2026-11-15T22:39:01+00:00', streetview_url: 'https://www.google.com/maps/@46,7,90h', latitude: '46.3108635', longitude: '7.4773651' }],
});

test('a matched façade detail retains raw null dates and screenshot timestamp strings', () => {
  const raw = fixture();
  const validated = validateDesignEvidence(raw);
  assert.equal(validated.captures[0].imagery_date, null);
  assert.equal(validated.observations[0].observedAt, null);
  assert.equal(validated.captures[0].captured_at_utc, '2026-11-15T22:39:01+00:00');
  assert.equal(validated.buildingMatches[0].sourceDate.year, 2020);
});

test('ready details require a confirmed building match', () => {
  const raw = fixture(); raw.buildingMatches[0].status = 'unresolved';
  assert.throws(() => validateDesignEvidence(raw), /confirmed|confirmé/i);
});

test('ready details cannot point to absent observations or captures', () => {
  for (const change of [r => { r.changes[0].observationIds = ['O404']; }, r => { r.observations[0].captureIds = ['C404']; }, r => { r.changes[0].evidenceIds = ['C404']; }]) {
    const raw = fixture(); change(raw);
    assert.throws(() => validateDesignEvidence(raw), /observation|capture|evidence/i);
  }
});

test('a ready detail cannot borrow evidence from another face or building', () => {
  for (const key of ['faceId', 'buildingId']) {
    const raw = fixture(); raw.observations[0][key] = 'other';
    assert.throws(() => validateDesignEvidence(raw), /face|building|cible/i);
  }
});

test('duplicate IDs and ready details without physical dimensions are rejected', () => {
  const duplicate = fixture(); duplicate.captures.push({ ...duplicate.captures[0] });
  assert.throws(() => validateDesignEvidence(duplicate), /duplicate/i);
  const missing = fixture(); delete missing.changes[0].details[0].height;
  assert.throws(() => validateDesignEvidence(missing), /dimension|height/i);
});

test('a flat façade rectangle allows omitted depth, but rejects a nonpositive supplied depth', () => {
  const raw = fixture(); delete raw.changes[0].details[0].depth;
  assert.doesNotThrow(() => validateDesignEvidence(raw));
  raw.changes[0].details[0].depth = 0;
  assert.throws(() => validateDesignEvidence(raw), /depth/);
});

test('a ready window needs width and height even when every dimension was omitted', () => {
  const raw = fixture(); raw.changes[0].details = [{ kind: 'window' }];
  assert.throws(() => validateDesignEvidence(raw), /dimension|width|height/i);
});

test('ready proposals cannot suppress their approximation label or all explicit details', () => {
  for (const change of [r => { r.changes[0].approximate = false; }, r => { r.changes[0].details = []; }]) {
    const raw = fixture(); change(raw);
    assert.throws(() => validateDesignEvidence(raw), /approximate|detail/i);
  }
});

test('individual feature capture references must resolve without changing their raw records', () => {
  const raw = fixture();
  raw.changes[0].details[0].evidenceIds = ['C404'];
  assert.throws(() => validateDesignEvidence(raw), /capture|evidence/i);
  raw.changes[0].details[0].evidenceIds = ['C003'];
  assert.doesNotThrow(() => validateDesignEvidence(raw));
  assert.deepEqual(raw.changes[0].details[0].evidenceIds, ['C003']);
});

test('validation does not edit immutable capture records or coerce camera positions', () => {
  const raw = fixture(); const before = JSON.stringify(raw);
  Object.freeze(raw.captures[0]); Object.freeze(raw.captures);
  const validated = validateDesignEvidence(raw);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(validated.captures[0].latitude, '46.3108635');
  assert.equal(validated.captures[0], raw.captures[0]);
});

test('unresolved records may retain unknown matches and optional metadata', () => {
  const raw = fixture(); raw.changes[0].status = 'unresolved'; raw.changes[0].details = [];
  raw.buildingMatches[0].status = 'unresolved'; raw.buildingMatches[0].surveyIds = [];
  raw.observations[0].extra = { unknown: true };
  assert.equal(validateDesignEvidence(raw).buildingMatches[0].surveyIds.length, 0);
});

test('source priorities explicitly pair DXF and tiles and make Street View a design input', async () => {
  const registry = JSON.parse(await readFile(new URL('../design-inputs.json', import.meta.url)));
  const sources = orderedSources(registry);
  assert.deepEqual(sources.map(s => s.priority), [1, 2, 3, 4, 5, 6, 7]);
  assert.match(JSON.stringify(sources[1]), /DXF/);
  assert.match(JSON.stringify(sources[1]), /3D Tiles/);
  assert.match(sources[2].uses.join(' '), /conception|ajouts|détails/i);
  assert.equal(sources[1].observedAt, null);
  assert.match(sources[1].limitations.join(' '), /indépendante/);
});

test('source and capture links reject deceptive hosts, credentials, schemes and escaped assets', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://good.test@evil.test', 'https://example.com\\@evil.test']) {
    assert.throws(() => orderedSources([{ sourceId: 'x', priority: 1, label: 'x', url }]), /URL|HTTPS/i);
  }
  assert.equal(isStreetViewUrl('https://www.google.com.evil.test/maps/x'), false);
  assert.equal(isStreetViewUrl('https://www.google.com/maps/x'), true);
  for (const path of ['../outside.jpg', '%252e%252e/x.jpg', '//evil.test/x.jpg', 'evidence/%2foutside.jpg']) {
    assert.throws(() => assetUrl(path, 'https://example.test/survey/'), /asset|path/i);
  }
  assert.equal(assetUrl('evidence/C003.jpg', 'https://example.test/survey/'), 'https://example.test/survey/evidence/C003.jpg');
});
