// Raw capture records are referenced, never normalised or edited by this module.
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const ids = (records, key, name) => {
  if (!Array.isArray(records)) throw new Error(`${name} must be an array.`);
  const map = new Map();
  for (const record of records) {
    if (!nonempty(record?.[key])) throw new Error(`Missing ${name} ID.`);
    if (map.has(record[key])) throw new Error(`Duplicate ${name} ID: ${record[key]}.`);
    map.set(record[key], record);
  }
  return map;
};
const refs = (values, index, name) => {
  if (values === undefined) return [];
  if (!Array.isArray(values)) throw new Error(`${name} references must be an array.`);
  for (const id of values) if (!index.has(id)) throw new Error(`Missing ${name}: ${id}.`);
  return values;
};

export function validateDesignEvidence(data) {
  if (data?.schemaVersion !== 1) throw new Error('Unsupported design evidence schema.');
  const matches = ids(data.buildingMatches, 'buildingId', 'building match');
  const observations = ids(data.observations, 'observationId', 'observation');
  ids(data.changes, 'changeId', 'change');
  const captures = ids(data.captures, 'capture_id', 'capture');
  for (const match of matches.values()) {
    if (!['confirmed', 'unresolved'].includes(match.status)) throw new Error(`Invalid building match status: ${match.buildingId}.`);
    refs(match.evidenceIds, captures, 'capture evidence');
  }
  for (const observation of observations.values()) {
    refs(observation.captureIds, captures, 'capture');
    if (observation.observedAt !== undefined && observation.observedAt !== null && !nonempty(observation.observedAt)) {
      throw new Error(`Observation ${observation.observationId}: observedAt must be a raw date string or null.`);
    }
  }
  for (const change of data.changes) {
    if (!['ready', 'unresolved'].includes(change.status)) throw new Error(`Invalid change status: ${change.changeId}.`);
    if (change.receiveShadow !== undefined && typeof change.receiveShadow !== 'boolean') throw new Error(`Invalid receiveShadow flag: ${change.changeId}.`);
    if (!['missing_detail', 'dated_change_supported', 'unresolved'].includes(change.discrepancy)) throw new Error(`Invalid discrepancy: ${change.changeId}.`);
    const evidenceIds = refs(change.evidenceIds, captures, 'capture evidence');
    const observationIds = refs(change.observationIds, observations, 'observation');
    for (const detail of Array.isArray(change.details) ? change.details : []) {
      if (detail && typeof detail === 'object') refs(detail.evidenceIds, captures, 'individual detail capture evidence');
    }
    if (change.status !== 'ready') continue;
    if (matches.get(change.buildingId)?.status !== 'confirmed') throw new Error(`Ready change ${change.changeId} needs a confirmed building match.`);
    if (!nonempty(change.faceId)) throw new Error(`Ready change ${change.changeId} needs an explicit face.`);
    if (change.discrepancy === 'unresolved') throw new Error(`Ready change ${change.changeId} has unresolved evidence.`);
    if (!observationIds.length || !evidenceIds.length) throw new Error(`Ready change ${change.changeId} needs observations and capture evidence.`);
    for (const id of observationIds) {
      const observation = observations.get(id);
      if (observation.buildingId !== change.buildingId || observation.faceId !== change.faceId) throw new Error(`Observation ${id} targets another building or face.`);
      if (!(observation.captureIds?.length)) throw new Error(`Observation ${id} needs capture evidence.`);
    }
    if (change.approximate !== true) throw new Error(`Ready change ${change.changeId} must label its dimensions approximate.`);
    if (!Array.isArray(change.details) || !change.details.length) throw new Error(`Ready change ${change.changeId} needs explicit details.`);
    for (const detail of change.details) {
      if (!detail || typeof detail !== 'object') throw new Error(`Invalid detail in ${change.changeId}.`);
      if (['window', 'shutter', 'door', 'panel', 'beam', 'trim', 'balcony'].includes(detail.kind)
        || ['width', 'height', 'depth'].some(key => key in detail)) {
        for (const key of ['width', 'height', ...('depth' in detail ? ['depth'] : [])]) {
          if (typeof detail[key] !== 'number' || !Number.isFinite(detail[key]) || detail[key] <= 0) throw new Error(`Invalid or missing dimension ${key} in ${change.changeId}.`);
        }
      }
    }
  }
  return data;
}

export function checkedSourceUrl(value) {
  if (!nonempty(value) || value !== value.trim() || /[\\\u0000-\u0020\u007f]/.test(value)) throw new Error('Invalid source URL.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid source URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Source URL must use HTTPS without credentials or a custom port.');
  return url.href;
}

export function orderedSources(registry) {
  const sources = Array.isArray(registry) ? registry : registry?.sources;
  ids(sources, 'sourceId', 'source');
  const priorities = new Set();
  for (const source of sources) {
    if (!Number.isInteger(source.priority) || source.priority < 1 || priorities.has(source.priority)) throw new Error('Invalid or duplicate source priority.');
    priorities.add(source.priority);
    checkedSourceUrl(source.url);
    for (const link of source.links ?? []) checkedSourceUrl(link.url);
  }
  return sources.slice().sort((a, b) => a.priority - b.priority);
}

// Same confinement policy as the stable survey viewer; kept self-contained for preview use.
export function assetUrl(relativePath, baseUrl) {
  let base;
  try { base = new URL(baseUrl); } catch { throw new Error('Invalid asset base URL.'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password
    || !base.pathname.endsWith('/') || base.search || base.hash) throw new Error('Asset base URL must name an HTTP(S) directory without credentials.');
  if (!nonempty(relativePath) || relativePath !== relativePath.trim()) throw new Error('Invalid asset path.');
  let decoded = relativePath.split(/[?#]/, 1)[0];
  for (let depth = 0; depth < 6; depth++) {
    if (!decoded || /^[a-z][a-z\d+.-]*:/i.test(decoded) || /^[\/\\]/.test(decoded)
      || /[\\\u0000-\u001f\u007f]/.test(decoded) || /%(?:2f|5c)/i.test(decoded) || decoded.split('/').includes('..')) throw new Error('Unsafe asset path.');
    let next;
    try { next = decodeURIComponent(decoded); } catch { throw new Error('Invalid asset path encoding.'); }
    if (next === decoded) break;
    if (depth === 5) throw new Error('Asset path encoding is too deeply nested.');
    decoded = next;
  }
  const resolved = new URL(relativePath, base);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) throw new Error('Asset path escapes its base directory.');
  return resolved.href;
}

export function isStreetViewUrl(value) {
  try {
    const url = new URL(checkedSourceUrl(value));
    return ['google.com', 'www.google.com', 'maps.google.com'].includes(url.hostname)
      && (url.pathname === '/maps' || url.pathname.startsWith('/maps/'));
  } catch { return false; }
}
