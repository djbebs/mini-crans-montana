function axis(values, label) {
  if (!Array.isArray(values) || values.length < 2 || !Array.from(values).every(Number.isFinite)) {
    throw new Error(`Invalid terrain ${label} axis.`);
  }
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) throw new Error(`Terrain ${label} axis must increase strictly.`);
  }
  return [...values];
}

function legacyGrid(samples) {
  if (!Array.isArray(samples) || !samples.length || samples.some(sample => !sample
    || ![sample.x, sample.z, sample.height].every(Number.isFinite))) {
    throw new Error('Invalid legacy terrain samples.');
  }
  const xs = [...new Set(samples.map(sample => sample.x))].sort((a, b) => a - b);
  const zs = [...new Set(samples.map(sample => sample.z))].sort((a, b) => a - b);
  const heights = Array.from({ length: zs.length }, () => Array(xs.length));
  for (const sample of samples) {
    const row = zs.indexOf(sample.z), column = xs.indexOf(sample.x);
    if (heights[row][column] !== undefined) throw new Error('Duplicate legacy terrain sample.');
    heights[row][column] = sample.height;
  }
  if (samples.length !== xs.length * zs.length) throw new Error('Incomplete legacy terrain grid.');
  return { xs, zs, heights };
}

function cellIndex(values, coordinate) {
  let low = 0, high = values.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (values[middle] <= coordinate) low = middle;
    else high = middle;
  }
  return low;
}

/** Grid rows follow ascending local z; local x/east and z/south are in metres. */
export function createTerrainModel(snapshot) {
  if (!snapshot || ![1, 2].includes(snapshot.schemaVersion)) throw new Error('Unsupported terrain schema.');
  if (!snapshot.origin || ![snapshot.origin.e, snapshot.origin.n].every(Number.isFinite)) {
    throw new Error('Invalid terrain origin.');
  }
  const grid = snapshot.schemaVersion === 1 ? legacyGrid(snapshot.samples) : snapshot;
  const xs = axis(grid.xs, 'x'), zs = axis(grid.zs, 'z');
  if (!Array.isArray(grid.heights) || grid.heights.length !== zs.length
    || Array.from(grid.heights).some(row => !Array.isArray(row) || row.length !== xs.length
      || Array.from(row).some(height => !Number.isFinite(height)))) {
    throw new Error('Terrain height grid must be rectangular, complete and finite.');
  }
  const heights = grid.heights.map(row => Object.freeze([...row]));
  const bounds = Object.freeze({ minX: xs[0], maxX: xs.at(-1), minZ: zs[0], maxZ: zs.at(-1) });
  const contains = (x, z) => Number.isFinite(x) && Number.isFinite(z)
    && x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
  const absoluteHeight = (x, z) => {
    if (![x, z].every(Number.isFinite)) throw new Error('Terrain coordinates must be finite.');
    // Queries outside the measured footprint use its nearest boundary, never an extended slope.
    x = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    z = Math.max(bounds.minZ, Math.min(bounds.maxZ, z));
    const column = cellIndex(xs, x), row = cellIndex(zs, z);
    const u = (x - xs[column]) / (xs[column + 1] - xs[column]);
    const v = (z - zs[row]) / (zs[row + 1] - zs[row]);
    const a = heights[row][column], b = heights[row][column + 1];
    const c = heights[row + 1][column], d = heights[row + 1][column + 1];
    // Both mesh triangles share the 00 -> 11 diagonal. Bilinear interpolation would disagree.
    return u >= v ? a + (b - a) * u + (d - b) * v : a + (d - c) * u + (c - a) * v;
  };
  let datum = snapshot.centreHeight;
  if (datum === undefined) {
    if (!contains(0, 0)) throw new Error('Terrain centre datum is outside the sampled footprint.');
    datum = absoluteHeight(0, 0);
  }
  if (!Number.isFinite(datum)) throw new Error('Invalid terrain centre height datum.');
  let minHeight = Infinity, maxHeight = -Infinity;
  for (const row of heights) for (const height of row) {
    minHeight = Math.min(minHeight, height - datum);
    maxHeight = Math.max(maxHeight, height - datum);
  }
  return Object.freeze({
    schemaVersion: snapshot.schemaVersion,
    origin: Object.freeze({ e: snapshot.origin.e, n: snapshot.origin.n }),
    verticalDatum: snapshot.verticalDatum ?? null,
    datum, bounds, minHeight, maxHeight,
    xs: Object.freeze(xs), zs: Object.freeze(zs), heights: Object.freeze(heights),
    diagonal: '00-11', outsidePolicy: 'clamp', contains,
    height: (x, z) => absoluteHeight(x, z) - datum,
  });
}

/** Caller owns all returned geometries. Render edge with THREE.LineSegments. */
export function createTerrainGeometry({ THREE, model, baseDepth = 3 }) {
  if (!Number.isFinite(baseDepth) || baseDepth <= 0) throw new Error('Terrain base depth must be positive.');
  const { xs, zs, heights, datum } = model;
  const positions = [], triangles = [], boundary = [];
  const width = xs.length, depth = zs.length;
  for (let row = 0; row < depth; row++) for (let column = 0; column < width; column++) {
    positions.push(xs[column], heights[row][column] - datum, zs[row]);
    if (row < depth - 1 && column < width - 1) {
      const a = row * width + column, b = a + 1, c = a + width, d = c + 1;
      triangles.push(a, d, b, a, c, d);
    }
  }
  for (let column = 0; column < width; column++) boundary.push(column);
  for (let row = 1; row < depth; row++) boundary.push(row * width + width - 1);
  for (let column = width - 2; column >= 0; column--) boundary.push((depth - 1) * width + column);
  for (let row = depth - 2; row > 0; row--) boundary.push(row * width);

  const bottomY = model.minHeight - baseDepth;
  const skirtPositions = [], skirtTriangles = [], edgePositions = [];
  for (let i = 0; i < boundary.length; i++) {
    const a = positions.slice(boundary[i] * 3, boundary[i] * 3 + 3);
    const b = positions.slice(boundary[(i + 1) % boundary.length] * 3, boundary[(i + 1) % boundary.length] * 3 + 3);
    const start = skirtPositions.length / 3;
    skirtPositions.push(...a, a[0], bottomY, a[2], ...b, b[0], bottomY, b[2]);
    skirtTriangles.push(start, start + 2, start + 1, start + 2, start + 3, start + 1);
    edgePositions.push(...a, ...b);
  }
  const bottomStart = skirtPositions.length / 3;
  skirtPositions.push(xs[0], bottomY, zs[0], xs.at(-1), bottomY, zs[0],
    xs.at(-1), bottomY, zs.at(-1), xs[0], bottomY, zs.at(-1));
  skirtTriangles.push(bottomStart, bottomStart + 1, bottomStart + 2, bottomStart, bottomStart + 2, bottomStart + 3);

  const geometry = (vertices, indices) => {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (indices) {
      result.setIndex(indices);
      result.computeVertexNormals();
    }
    result.computeBoundingBox();
    result.computeBoundingSphere();
    return result;
  };
  return {
    surface: geometry(positions, triangles),
    skirt: geometry(skirtPositions, skirtTriangles),
    edge: geometry(edgePositions),
    bottomY,
  };
}
