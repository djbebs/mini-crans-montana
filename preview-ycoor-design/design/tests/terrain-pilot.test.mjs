import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createTerrainModel, createTerrainGeometry } from '../terrain-model.js';
import { createLocalBuildings } from '../local-buildings.js';

const read = name => JSON.parse(readFileSync(new URL(`../../assets/${name}`, import.meta.url), 'utf8'));

test('the measured terrain covers every original DXF vertex, including the full southern building', () => {
  const snapshot = read('terrain-grid.json'), source = read('ycoor-dxf.json');
  const model = createTerrainModel(snapshot), original = JSON.stringify(source);
  assert.equal(model.verticalDatum, source.verticalDatum);
  assert.ok(model.xs.length * model.zs.length > 6000);
  for (const building of source.buildings) for (const [e, n] of building.vertices) {
    assert.ok(model.contains(e - source.origin.e, source.origin.n - n), `${building.id} extends beyond measured ground`);
  }
  const local = createLocalBuildings({ THREE, scene: new THREE.Scene(), data: source, originHeight: model.datum });
  assert.equal(local.group.position.y, -snapshot.centreHeight);
  assert.equal(JSON.stringify(source), original, 'terrain alignment must never raise or deform source buildings');
  local.dispose();
  const geometry = createTerrainGeometry({ THREE, model });
  for (const name of ['surface', 'skirt', 'edge']) {
    const positions = geometry[name].getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      assert.ok(model.contains(positions.getX(i), positions.getZ(i)), 'display geometry stays in its measured footprint');
    }
    geometry[name].dispose();
  }
});
