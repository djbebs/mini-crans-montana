import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTerrainModel, createTerrainGeometry } from '../terrain-model.js';

const fixture = () => ({
  schemaVersion: 2,
  origin: { e: 2603036, n: 1128849 },
  verticalDatum: 'LN02',
  xs: [-4, 0, 6],
  zs: [-3, 0, 5],
  heights: [[100, 110, 120], [104, 108, 124], [106, 114, 130]],
});
const close = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
};
const dispose = geometries => {
  for (const key of ['surface', 'skirt', 'edge']) geometries[key].dispose();
};

test('rectangular nonuniform grids preserve every measured height and the declared datum', () => {
  const snapshot = fixture(), before = JSON.stringify(snapshot);
  const model = createTerrainModel(snapshot);
  assert.equal(model.datum, 108);
  assert.equal(model.verticalDatum, 'LN02');
  assert.equal(model.diagonal, '00-11');
  assert.deepEqual(model.bounds, { minX: -4, maxX: 6, minZ: -3, maxZ: 5 });
  for (let row = 0; row < snapshot.zs.length; row++) {
    for (let column = 0; column < snapshot.xs.length; column++) {
      close(model.height(snapshot.xs[column], snapshot.zs[row]), snapshot.heights[row][column] - 108);
    }
  }
  assert.equal(JSON.stringify(snapshot), before, 'source heights must remain intact');
  snapshot.heights[0][0] = 999;
  snapshot.xs[0] = -999;
  assert.equal(model.height(-4, -3), -8, 'later source edits cannot split mesh and height sampling');
});

test('interior heights lie on the same diagonal triangle planes used by the surface', () => {
  const model = createTerrainModel({
    ...fixture(), xs: [-2, 6], zs: [-3, 5], heights: [[100, 120], [110, 200]], centreHeight: 100,
  });
  // Values come from the two triangle planes, not a bilinear surface.
  close(model.height(4, -1), 35);
  close(model.height(0, 3), 30);
  close(model.height(2, 1), 50);
  const geometry = createTerrainGeometry({ THREE, model });
  const positions = geometry.surface.getAttribute('position');
  const indices = geometry.surface.index.array;
  for (let start = 0; start < indices.length; start += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, indices[start]);
    const b = new THREE.Vector3().fromBufferAttribute(positions, indices[start + 1]);
    const c = new THREE.Vector3().fromBufferAttribute(positions, indices[start + 2]);
    const point = a.clone().multiplyScalar(.2).addScaledVector(b, .3).addScaledVector(c, .5);
    close(model.height(point.x, point.z), point.y);
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).y > 0, 'surface triangles must face upward');
  }
  dispose(geometry);
});

test('skirt top and perimeter line follow all sampled edge vertices with one lower flat bottom', () => {
  const model = createTerrainModel(fixture());
  const geometry = createTerrainGeometry({ THREE, model });
  assert.equal(geometry.bottomY, -11, 'bottom lies three metres below the lowest terrain vertex');
  const expected = [
    [-4, -8, -3], [0, 2, -3], [6, 12, -3], [6, 16, 0],
    [6, 22, 5], [0, 6, 5], [-4, -2, 5], [-4, -4, 0],
  ];
  const edge = geometry.edge.getAttribute('position');
  const skirt = geometry.skirt.getAttribute('position');
  const boundary = new Set(expected.map(([x, , z]) => `${x},${z}`));
  const edgePoints = new Set();
  for (let i = 0; i < edge.count; i++) {
    const x = edge.getX(i), y = edge.getY(i), z = edge.getZ(i);
    assert.ok(boundary.has(`${x},${z}`), 'line must remain on the snapshot perimeter');
    close(y, model.height(x, z));
    edgePoints.add(`${x},${y},${z}`);
  }
  assert.deepEqual(edgePoints, new Set(expected.map(point => point.join(','))));
  const skirtTop = new Set(), skirtBottom = new Set();
  for (let i = 0; i < skirt.count; i++) {
    const x = skirt.getX(i), y = skirt.getY(i), z = skirt.getZ(i);
    assert.ok(boundary.has(`${x},${z}`));
    if (y === geometry.bottomY) skirtBottom.add(`${x},${z}`);
    else {
      close(y, model.height(x, z));
      skirtTop.add(`${x},${y},${z}`);
    }
  }
  assert.deepEqual(skirtTop, new Set(expected.map(point => point.join(','))));
  assert.deepEqual(skirtBottom, boundary);
  assert.ok(new Set(expected.map(point => point[1])).size > 2, 'fixture exercises a sloping perimeter');
  dispose(geometry);
});

test('float32 skirt and surface retain coincident top vertices at large uneven edge heights', () => {
  const snapshot = fixture();
  snapshot.xs = [-70.125, -.125, 69.875];
  snapshot.zs = [-80.375, -.375, 89.625];
  snapshot.centreHeight = 1497.12345;
  snapshot.heights = [[1514.712345, 1506.34567, 1499.99999], [1503.234567, 1497.12345, 1494.234567], [1501.23456, 1490.0001, 1488.78901]];
  const model = createTerrainModel(snapshot);
  const geometry = createTerrainGeometry({ THREE, model });
  const surface = geometry.surface.getAttribute('position');
  const skirt = geometry.skirt.getAttribute('position');
  const surfacePoints = new Set();
  for (let i = 0; i < surface.count; i++) surfacePoints.add(`${surface.getX(i)},${surface.getY(i)},${surface.getZ(i)}`);
  for (let i = 0; i < skirt.count; i++) {
    if (Math.abs(skirt.getY(i) - geometry.bottomY) < 1e-5) continue;
    assert.ok(surfacePoints.has(`${skirt.getX(i)},${skirt.getY(i)},${skirt.getZ(i)}`));
  }
  dispose(geometry);
});

test('outside queries explicitly clamp to the sampled boundary without extending slopes', () => {
  const model = createTerrainModel(fixture());
  assert.equal(model.outsidePolicy, 'clamp');
  assert.equal(model.contains(-4, 5), true);
  assert.equal(model.contains(-4.001, 5), false);
  assert.equal(model.contains(1, 5.001), false);
  close(model.height(-1000, -3), -8);
  close(model.height(1000, 5), 22);
  close(model.height(0, -1000), 2);
  assert.throws(() => model.height(NaN, 0), /finite/i);
});

test('legacy snapshots use only their original sample bounds and retain unknown vertical datum', () => {
  const legacy = {
    schemaVersion: 1, origin: fixture().origin, centreHeight: 1497.1, verticalDatum: null,
    samples: [-50, 0, 50].flatMap(z => [-50, 0, 50].map(x => ({ x, z, height: 1497.1 + x / 10 + z / 20 }))),
  };
  const model = createTerrainModel(legacy);
  assert.deepEqual(model.bounds, { minX: -50, maxX: 50, minZ: -50, maxZ: 50 });
  assert.equal(model.verticalDatum, null);
  assert.equal(model.contains(60, 0), false);
  close(model.height(60, 0), 5);
  close(model.height(-50, -50), -7.5);
});

test('invalid or incomplete sampled grids are rejected instead of creating fabricated terrain', () => {
  const changes = [
    data => { data.xs = [-4, -4, 6]; },
    data => { data.zs = [-3, 5, 0]; },
    data => { data.xs[0] = NaN; },
    data => { delete data.xs[0]; },
    data => { data.heights[1].pop(); },
    data => { data.heights.pop(); },
    data => { delete data.heights[0]; },
    data => { delete data.heights[0][0]; },
    data => { data.heights[0][0] = Infinity; },
    data => { data.heights[0][0] = null; },
    data => { data.centreHeight = NaN; },
    data => { data.origin.e = null; },
    data => { data.schemaVersion = 99; },
  ];
  for (const change of changes) {
    const snapshot = fixture();
    change(snapshot);
    assert.throws(() => createTerrainModel(snapshot), /terrain|grid|height|origin|schema|axis|coordinate/i);
  }
  assert.throws(() => createTerrainModel({ ...fixture(), xs: [1, 2, 3] }), /centre|origin|datum/i,
    'a datum cannot be inferred outside the sampled footprint');
  const incomplete = { schemaVersion: 1, origin: fixture().origin, samples: [{ x: 0, z: 0, height: 100 }, { x: 1, z: 1, height: 101 }] };
  assert.throws(() => createTerrainModel(incomplete), /grid|sample/i);
  assert.throws(() => createTerrainGeometry({ THREE, model: createTerrainModel(fixture()), baseDepth: -1 }), /depth/i);
});
