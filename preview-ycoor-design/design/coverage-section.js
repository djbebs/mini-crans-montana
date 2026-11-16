import { assetUrl } from './design-model.js';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const statusLabels = {
  partial: 'Partiellement dessinée',
  not_reviewed: 'À examiner',
  identity_unresolved: 'Correspondance à vérifier',
  geometry_ambiguous: 'Géométrie à vérifier',
  geometry_review: 'Volume final à vérifier avant ajout',
};
const dateLabel = date => {
  if (typeof date === 'string' && date) return date;
  if (!Number.isInteger(date?.year)) return 'non renseignée';
  return [Number.isInteger(date.day) ? String(date.day).padStart(2, '0') : null,
    Number.isInteger(date.month) ? String(date.month).padStart(2, '0') : null, date.year].filter(value => value !== null).join('/');
};

/** Every row represents one source wall plane, never a count of physical façades. */
export function createCoverageSection({ inventory, onFocusFace, onShowChange, assetBaseUrl }) {
  const section = node('section', 'design-coverage');
  section.setAttribute('aria-labelledby', 'coverage-heading');
  const heading = node('h3', '', 'Inventaire des faces sources');
  heading.id = 'coverage-heading';
  section.append(heading);
  if (!inventory) {
    section.append(node('p', '', 'Inventaire indisponible pour le moment.'));
    return section;
  }
  const { summary, buildings, faces } = inventory;
  const faceById = new Map(faces.map(face => [face.faceId, face]));
  section.append(node('p', '', `${summary.buildingCount} volumes · ${summary.faceCount} plans de murs sources à examiner.`));
  section.append(node('p', 'design-note', 'Chaque face correspond à un plan de mur du DXF, pas nécessairement à une façade physique entière.'));
  const counts = node('dl', 'coverage-counts');
  for (const [label, value] of [
    ['Faces partiellement dessinées', summary.partialFaceCount],
    ['Faces à examiner', summary.notReviewedFaceCount],
    ['Faces avec vérification préalable', summary.blockedFaceCount],
    ['Faces terminées', summary.completeFaceCount],
  ]) counts.append(node('dt', '', label), node('dd', '', String(value)));
  section.append(counts);
  section.append(node('p', 'coverage-unknown', 'Fenêtres physiques · total inconnu · reste à dessiner inconnu.'));
  section.append(node('p', 'design-note', `${summary.detailCount} éléments dessinés, dont ${summary.openingDetailCount} composants de fenêtres, portes ou volets. Ces composants ne sont pas un décompte de fenêtres physiques uniques. Une face partiellement dessinée reste à compléter.`));
  const downloads = node('nav', 'coverage-downloads');
  downloads.setAttribute('aria-label', 'Télécharger l’inventaire des faces sources');
  for (const format of ['csv', 'json']) {
    const download = node('a', '', `Télécharger ${format.toUpperCase()}`);
    download.href = assetUrl(`facade-inventory.${format}`, assetBaseUrl);
    download.download = `facade-inventory.${format}`;
    downloads.append(download);
  }
  section.append(downloads);
  const list = node('div', 'coverage-buildings');
  for (const building of buildings) {
    const buildingFaces = building.faceIds.map(id => faceById.get(id)).filter(Boolean);
    const partialCount = buildingFaces.filter(face => face.status === 'partial').length;
    const blockedCount = buildingFaces.filter(face => ['identity_unresolved', 'geometry_ambiguous', 'geometry_review'].includes(face.status)).length;
    const disclosure = node('details', 'coverage-building');
    const title = node('summary', 'coverage-building-summary');
    title.append(node('strong', '', building.buildingId));
    title.append(node('span', 'coverage-visual', building.visualIds.length ? building.visualIds.join(' · ') : 'Repère visuel non attribué'));
    title.append(node('span', 'coverage-progress', `${buildingFaces.length} faces sources · ${partialCount} partielles · 0 terminée`));
    if (blockedCount) title.append(node('span', 'coverage-blocked', `${blockedCount} avec vérification préalable`));
    disclosure.append(title);
    const meta = node('div', 'coverage-building-meta');
    meta.append(node('p', 'design-date', `Géométrie · date source : ${dateLabel(building.sourceDate)}`));
    meta.append(node('p', 'design-note', building.matchStatus === 'confirmed' ? 'Correspondance visuelle confirmée ; identité cadastrale non présumée.' : 'Correspondance visuelle à vérifier ; identité cadastrale non établie.'));
    if (building.sourceUuid) meta.append(node('p', 'design-id', `UUID source : ${building.sourceUuid}`));
    disclosure.append(meta);
    const faceList = node('ul', 'coverage-faces');
    for (const face of buildingFaces) {
      const row = node('li', 'coverage-face');
      row.dataset.faceId = face.faceId;
      row.append(node('h4', '', face.faceId));
      row.append(node('p', 'design-note', `Orientation source : ${face.orientation || 'non renseignée'}`));
      row.append(node('p', `coverage-face-status coverage-status-${face.status}`, statusLabels[face.status] ?? 'À vérifier'));
      row.append(node('p', '', `${face.detailCount} éléments dessinés · ${face.openingDetailCount} composants de fenêtres, portes ou volets.`));
      row.append(node('p', 'design-note', 'Fenêtres physiques : total et reste inconnus.'));
      if (face.nextAction) row.append(node('p', 'coverage-next', `Suite : ${face.nextAction}`));
      const actions = node('div', 'coverage-face-actions');
      const focus = node('button', 'coverage-focus', 'Voir cette face');
      focus.type = 'button';
      focus.disabled = !face.canFocus || typeof onFocusFace !== 'function';
      if (!face.canFocus) focus.title = 'Cette face ne peut pas être ciblée dans la scène.';
      focus.addEventListener('click', () => onFocusFace?.(face.faceId));
      actions.append(focus);
      for (const changeId of face.changeIds) {
        const proof = node('button', 'coverage-proof', face.changeIds.length > 1 ? `Preuve · ${changeId}` : 'Voir la preuve');
        proof.type = 'button';
        proof.disabled = typeof onShowChange !== 'function';
        proof.addEventListener('click', () => onShowChange?.(changeId));
        actions.append(proof);
      }
      row.append(actions);
      faceList.append(row);
    }
    disclosure.append(faceList);
    list.append(disclosure);
  }
  section.append(list);
  return section;
}
