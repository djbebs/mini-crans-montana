// Evidence metadata stays separate from geometry and from derived numeric positions.
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const GOOGLE_MAPS_HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com']);

function numericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !DECIMAL.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinate(value, field, captureId) {
  const number = numericValue(value);
  const limit = field === 'latitude' ? 90 : 180;
  if (number === null || Math.abs(number) > limit) {
    throw new Error(`Capture ${captureId}: invalid ${field}; a finite numeric coordinate within range is required.`);
  }
  return number;
}

function recordId(value, kind) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${kind} ID.`);
  return value;
}

export function buildSurveyIndex(raw) {
  if (!Array.isArray(raw?.captures) || !Array.isArray(raw?.buildings)) {
    throw new Error('Survey captures and buildings must be arrays.');
  }
  const captures = raw.captures.slice();
  const buildings = raw.buildings.slice();
  const panoramas = [];
  const captureById = new Map();
  const panoramaById = new Map();
  const buildingById = new Map();

  for (const building of buildings) {
    const id = recordId(building.building_id, 'building');
    if (buildingById.has(id)) throw new Error(`Duplicate building ID: ${id}.`);
    buildingById.set(id, building);
  }
  for (const capture of captures) {
    const id = recordId(capture.capture_id, 'capture');
    if (captureById.has(id)) throw new Error(`Duplicate capture ID: ${id}.`);
    const panoramaId = recordId(capture.panorama_id, 'panorama');
    const position = {
      lat: coordinate(capture.latitude, 'latitude', id),
      lon: coordinate(capture.longitude, 'longitude', id)
    };
    captureById.set(id, capture);
    let panorama = panoramaById.get(panoramaId);
    if (panorama) {
      for (const field of ['latitude', 'longitude', 'provider', 'imagery_date']) {
        if (!Object.is(panorama[field], capture[field])) {
          throw new Error(`Panorama ${panoramaId}: conflicting ${field} in capture ${id}.`);
        }
      }
    } else {
      panorama = {
        panorama_id: panoramaId,
        map_id: `P${String(panoramas.length + 1).padStart(3, '0')}`,
        latitude: capture.latitude,
        longitude: capture.longitude,
        position,
        provider: capture.provider,
        imagery_date: capture.imagery_date,
        title: capture.title,
        captureIds: [],
        sourceType: capture.provider === 'Google Street View' ? 'google' : 'contributor'
      };
      panoramas.push(panorama);
      panoramaById.set(panoramaId, panorama);
    }
    panorama.captureIds.push(id);
  }
  return {
    captures, panoramas, buildings,
    summary: { captures: captures.length, panoramas: panoramas.length, buildings: buildings.length },
    captureById, panoramaById, buildingById
  };
}

export function filterSurvey(index, { buildingId = '', source = 'all' } = {}) {
  if (!['all', 'google', 'contributor'].includes(source)) throw new Error(`Invalid survey source: ${source}.`);
  const captures = index.captures.filter(capture => {
    const panorama = index.panoramaById.get(capture.panorama_id);
    return (source === 'all' || panorama.sourceType === source)
      && (!buildingId || capture.building_ids?.includes(buildingId));
  });
  const panoramaIds = new Set(captures.map(capture => capture.panorama_id));
  return { captures, panoramas: index.panoramas.filter(panorama => panoramaIds.has(panorama.panorama_id)) };
}

// This represents the viewer-reported heading, not calibrated geographic truth.
export function headingVector(heading) {
  const number = numericValue(heading);
  if (number === null) return null;
  const radians = (number % 360) * Math.PI / 180;
  return { x: Math.sin(radians), z: -Math.cos(radians) };
}

export function assetUrl(relativePath, baseUrl) {
  let base;
  try { base = new URL(baseUrl); } catch { throw new Error('Invalid asset base URL.'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Asset base URL must use HTTP or HTTPS without credentials.');
  }
  if (!base.pathname.endsWith('/') || base.search || base.hash) {
    throw new Error('Asset base URL must name a directory without a query or fragment.');
  }
  if (typeof relativePath !== 'string' || !relativePath.trim() || relativePath !== relativePath.trim()) {
    throw new Error('Asset path must be a nonempty relative path.');
  }
  let decoded = relativePath.split(/[?#]/, 1)[0];
  for (let depth = 0; depth < 6; depth++) {
    if (!decoded || /^[a-z][a-z\d+.-]*:/i.test(decoded) || /^[\/\\]/.test(decoded)
      || /[\\\u0000-\u001f\u007f]/.test(decoded) || /%(?:2f|5c)/i.test(decoded)
      || decoded.split('/').includes('..')) {
      throw new Error('Unsafe asset path: absolute paths, traversal and encoded separators are forbidden.');
    }
    let next;
    try { next = decodeURIComponent(decoded); } catch { throw new Error('Invalid asset path encoding.'); }
    if (next === decoded) break;
    if (depth === 5) throw new Error('Asset path encoding is too deeply nested.');
    decoded = next;
  }
  const resolved = new URL(relativePath, base);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) {
    throw new Error('Asset path escapes its base directory.');
  }
  return resolved.href;
}

export function isStreetViewUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && GOOGLE_MAPS_HOSTS.has(url.hostname)
      && !url.username && !url.password && !url.port
      && (url.pathname === '/maps' || url.pathname.startsWith('/maps/'));
  } catch {
    return false;
  }
}
