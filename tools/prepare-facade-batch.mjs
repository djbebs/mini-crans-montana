/** Small work packets for data-only facade batches; never infer unseen openings. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const blocked = new Set(['identity_unresolved', 'geometry_ambiguous', 'geometry_review']);
const unique = values => [...new Set(values)];

export function prepareBatch({ inventory, evidence, planes = [], buildingIds = [], limit = 5, maxFaces = 2, maxPhotos = 3 }) {
  const faceById = new Map(inventory.faces.map(face => [face.faceId, face]));
  const planeById = new Map(planes.map(face => [face.id, face]));
  const captureById = new Map(evidence.captures.map(capture => [capture.capture_id, capture]));
  const buildingById = new Map(inventory.buildings.map(building => [building.buildingId, building]));
  const facesOf = building => building.faceIds.map(id => faceById.get(id));
  const isBlocked = building => facesOf(building).some(face => blocked.has(face.status));
  const explicit = buildingIds.length > 0;
  const selected = explicit ? unique(buildingIds).map(id => {
    if (!buildingById.has(id)) throw new Error(`Unknown building: ${id}`);
    return buildingById.get(id);
  }) : inventory.buildings.filter(building => !isBlocked(building)).sort((a, b) => {
    const priority = building => facesOf(building).some(face => face.status === 'partial') ? 0 : 1;
    return priority(a) - priority(b) || a.buildingId.localeCompare(b.buildingId);
  }).slice(0, limit);
  return {
    mode: 'data-only-batch',
    scope: 'Selected source volumes only; candidate photographs do not prove every face. Unknown windows stay unknown.',
    coordinates: 'Metres: detail u follows the source-plane tangent; v is absolute LN02 height. Plane triangles define the supported surface; bounds alone may include gaps.',
    updateCommand: 'python tools/update-ycoor.py',
    buildings: selected.map(building => {
      const faces = facesOf(building).slice().sort((a, b) => Number(b.status === 'partial') - Number(a.status === 'partial') || a.faceId.localeCompare(b.faceId));
      const included = faces.slice(0, maxFaces);
      const captureIds = unique(included.flatMap(face => [...face.evidenceIds, ...face.candidateCaptureIds]));
      return {
        buildingId: building.buildingId, visualIds: building.visualIds, sourceDate: building.sourceDate,
        matchStatus: building.matchStatus ?? 'unknown',
        file: `preview-ycoor-design/design/facades/${building.buildingId}.json`, blocked: isBlocked(building),
        faceCount: faces.length,
        faces: included.map(face => {
          const plane = planeById.get(face.faceId);
          return { faceId: face.faceId, orientation: face.orientation, status: face.status, nextAction: face.nextAction ?? null,
            photosAssigned: face.evidenceIds.length > 0, evidenceIds: face.evidenceIds,
            plane: plane ? { origin: plane.origin, u: plane.u, normal: plane.normal, bounds: plane.bounds, triangles: plane.triangles } : null,
            details: evidence.changes.filter(change => change.status === 'ready' && change.faceId === face.faceId).flatMap(change => change.details.map(detail => ({
              id: detail.id, kind: detail.kind, u: detail.u, v: detail.v,
              size: [detail.width, detail.height, detail.depth ?? null], evidenceIds: detail.evidenceIds,
            }))),
          };
        }),
        remainingFaceIds: faces.slice(maxFaces).map(face => face.faceId),
        photos: captureIds.slice(0, maxPhotos).map(id => {
          const capture = captureById.get(id);
          if (!capture) throw new Error(`Missing capture: ${id}`);
          return { id, image: `crans-montana-p06/assets/streetview-survey/2026-11-15/${capture.screenshot}`,
            imageryDate: capture.imagery_date ?? null,
            camera: { latitude: capture.latitude ?? null, longitude: capture.longitude ?? null, viewerHeadingDeg: capture.heading_deg ?? null } };
        }),
        remainingCaptureIds: captureIds.slice(maxPhotos),
      };
    }),
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    building: { type: 'string', multiple: true }, limit: { type: 'string', default: '5' },
    faces: { type: 'string', default: '2' }, photos: { type: 'string', default: '3' },
    output: { type: 'string' },
  } });
  const number = (value, name) => {
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100) throw new Error(`${name} must be 1–100.`);
    return Number(value);
  };
  const folder = new URL('../preview-ycoor-design/design/', import.meta.url);
  const read = async url => JSON.parse(await readFile(url, 'utf8'));
  const inventory = await read(new URL('facade-inventory.json', folder));
  const evidence = await read(new URL('design-evidence.json', folder));
  const data = await read(new URL('../assets/ycoor-dxf.json', folder));
  const require = createRequire(new URL('package.json', folder));
  const THREE = require('three');
  const { createLocalBuildings } = await import('../preview-ycoor-design/design/local-buildings.js');
  const local = createLocalBuildings({ THREE, scene: new THREE.Scene(), data, originHeight: 1497.1 });
  try {
    const packet = prepareBatch({ inventory, evidence, planes: local.faces, buildingIds: values.building ?? [],
      limit: number(values.limit, '--limit'), maxFaces: number(values.faces, '--faces'), maxPhotos: number(values.photos, '--photos') });
    const text = JSON.stringify(packet) + '\n';
    if (values.output) await writeFile(resolve(values.output), text, 'utf8');
    else process.stdout.write(text);
  } finally { local.dispose(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
