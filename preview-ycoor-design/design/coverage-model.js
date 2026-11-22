import { validateDesignEvidence } from './design-model.js';

const openingKinds = new Set(['window', 'door', 'shutter']);
const directions = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
const unique = values => [...new Set(values)];
// Cache version for downloads, not a cryptographic provenance claim.
function revisionOf(value) {
  let hash = 2166136261;
  for (const character of JSON.stringify(value)) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
function keyed(values, key, label) {
  if (!Array.isArray(values)) throw new Error(`Missing ${label} array.`);
  const result = new Map();
  for (const value of values) {
    if (!value || typeof value[key] !== 'string' || !value[key]) throw new Error(`Invalid ${label} ID.`);
    if (result.has(value[key])) throw new Error(`Duplicate ${label}: ${value[key]}.`);
    result.set(value[key], value);
  }
  return result;
}

/** Source planes are a work queue, never an inferred census of hidden windows. */
export function buildFacadeInventory({ buildings, faces, evidence }) {
  const data = validateDesignEvidence(evidence);
  const buildingById = keyed(buildings, 'id', 'building');
  const faceById = keyed(faces, 'id', 'face');
  const matchById = new Map(data.buildingMatches.map(match => [match.buildingId, match]));
  for (const building of buildings) if (!matchById.has(building.id)) throw new Error(`Missing building match: ${building.id}.`);
  for (const match of data.buildingMatches) if (!buildingById.has(match.buildingId)) throw new Error(`Unknown building match: ${match.buildingId}.`);
  for (const face of faces) if (!buildingById.has(face.buildingId)) throw new Error(`Unknown face building: ${face.buildingId}.`);
  const changesByFace = new Map();
  const pendingByFace = new Map(data.changes.filter(change => change.status === 'unresolved' && change.faceId && change.reason).map(change => [change.faceId, change.reason]));
  const geometryReview = new Set(data.changes.filter(change => change.status === 'unresolved' && change.geometryReviewRequired === true).map(change => change.buildingId));
  for (const change of data.changes.filter(change => change.status === 'ready')) {
    const face = faceById.get(change.faceId);
    if (!face || face.buildingId !== change.buildingId) throw new Error(`Ready change targets an invalid source face: ${change.changeId}.`);
    if (geometryReview.has(change.buildingId)) throw new Error(`Building geometry review must be resolved before authoring: ${change.buildingId}.`);
    if (face.facadeAllowed === false || face.orientationAmbiguous) throw new Error(`Ready change targets an ambiguous face: ${change.changeId}.`);
    const list = changesByFace.get(face.id) ?? [];
    list.push(change); changesByFace.set(face.id, list);
  }
  const rows = faces.map(face => {
    const match = matchById.get(face.buildingId), changes = changesByFace.get(face.id) ?? [];
    const geometryAmbiguous = face.facadeAllowed === false || face.orientationAmbiguous === true;
    const status = geometryAmbiguous ? 'geometry_ambiguous' : match.status !== 'confirmed' ? 'identity_unresolved'
      : geometryReview.has(face.buildingId) ? 'geometry_review' : changes.length ? 'partial' : 'not_reviewed';
    const normal = face.normal;
    if (!Array.isArray(normal) || normal.length !== 3 || !normal.every(Number.isFinite)
      || Math.hypot(normal[0], normal[2]) < .5) throw new Error(`Invalid face normal: ${face.id}.`);
    const heading = (Math.atan2(normal[0], -normal[2]) * 180 / Math.PI + 360) % 360;
    const details = changes.flatMap(change => change.details);
    return {
      faceId: face.id, buildingId: face.buildingId,
      orientation: directions[Math.round(heading / 45) % 8], status,
      detailCount: details.length, openingDetailCount: details.filter(detail => openingKinds.has(detail.kind)).length,
      totalWindowCount: null, complete: false,
      changeIds: changes.map(change => change.changeId),
      evidenceIds: unique(changes.flatMap(change => change.evidenceIds)),
      candidateCaptureIds: [...(match.evidenceIds ?? [])],
      nextAction: status === 'partial' ? 'Comparer les parties non traitées avec les photos et relever les ouvertures encore visibles.'
        : status === 'identity_unresolved' ? 'Confirmer la correspondance visuelle avant d’attribuer des fenêtres à cette face.'
          : status === 'geometry_ambiguous' ? 'Vérifier le plan géométrique avant de placer des détails.'
            : status === 'geometry_review' ? 'Comparer le volume final daté et mesuré avec la source de 2020 avant de placer des fenêtres.'
            : pendingByFace.get(face.id) ?? 'Attribuer des photos à cette face, puis relever uniquement les ouvertures visibles.',
      canFocus: !geometryAmbiguous,
    };
  });
  return {
    schemaVersion: 1,
    revision: revisionOf({ buildings, evidence }),
    scope: 'Source wall planes of the six DXF volumes intersecting the Ycoor pilot; visual groups are not cadastral identities.',
    countMeaning: 'Opening detail count means drawn window/door/shutter components, not unique physical windows. Full and remaining window totals are unknown. No face has a complete visual census.',
    summary: {
      buildingCount: buildings.length, faceCount: rows.length,
      partialFaceCount: rows.filter(face => face.status === 'partial').length,
      notReviewedFaceCount: rows.filter(face => face.status === 'not_reviewed').length,
      blockedFaceCount: rows.filter(face => ['identity_unresolved', 'geometry_ambiguous', 'geometry_review'].includes(face.status)).length,
      detailCount: rows.reduce((sum, face) => sum + face.detailCount, 0),
      openingDetailCount: rows.reduce((sum, face) => sum + face.openingDetailCount, 0),
      completeFaceCount: 0, totalWindowCount: null,
    },
    buildings: buildings.map(building => {
      const match = matchById.get(building.id);
      return { buildingId: building.id, visualIds: [...(match.surveyIds ?? [])], matchStatus: match.status,
        sourceDate: building.sourceDate ?? null, sourceUuid: building.sourceUuid ?? null,
        faceIds: rows.filter(face => face.buildingId === building.id).map(face => face.faceId) };
    }),
    faces: rows,
  };
}

function cell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function inventoryToCsv(inventory) {
  const columns = ['building_id', 'visual_ids', 'face_id', 'orientation', 'status', 'detail_count', 'opening_detail_count',
    'total_window_count', 'complete', 'evidence_ids', 'candidate_capture_ids', 'next_action', 'geometry_source_date', 'source_uuid'];
  const buildings = new Map(inventory.buildings.map(building => [building.buildingId, building]));
  const lines = inventory.faces.map(face => {
    const building = buildings.get(face.buildingId), date = building.sourceDate;
    const sourceDate = date && Number.isInteger(date.year) ? `${date.year}${Number.isInteger(date.month) ? `-${String(date.month).padStart(2, '0')}` : ''}` : null;
    return [face.buildingId, building.visualIds.join('|'), face.faceId, face.orientation, face.status, face.detailCount,
      face.openingDetailCount, face.totalWindowCount, face.complete, face.evidenceIds.join('|'), face.candidateCaptureIds.join('|'),
      face.nextAction, sourceDate, building.sourceUuid].map(cell).join(',');
  });
  return '\uFEFF' + [columns.join(','), ...lines].join('\r\n') + '\r\n';
}
