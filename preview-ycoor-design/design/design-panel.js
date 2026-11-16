import { assetUrl, checkedSourceUrl, isStreetViewUrl, orderedSources, validateDesignEvidence } from './design-model.js';

const labels = { missing_detail: 'Détail absent du volume', dated_change_supported: 'Évolution datée étayée', unresolved: 'À vérifier' };
const confidenceLabels = { high: 'élevée', medium: 'moyenne', low: 'faible', unknown: 'non évaluée' };
const detailLabels = { window: 'Fenêtre', shutter: 'Volet', door: 'Porte', panel: 'Revêtement', beam: 'Poutre', trim: 'Bandeau', balcony: 'Balcon' };
const recorded = value => value === null || value === undefined || value === '' ? 'non renseigné' : String(value);
const node = (tag, className, text) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
};
const link = (label, href) => {
  const result = node('a', '', label);
  result.href = href;
  result.target = '_blank';
  result.rel = 'noopener noreferrer';
  return result;
};
const paragraph = text => node('p', '', text);
const sourceDate = date => {
  if (!date || !Number.isInteger(date.year)) return 'non renseignée';
  return [Number.isInteger(date.day) ? String(date.day).padStart(2, '0') : null,
    Number.isInteger(date.month) ? String(date.month).padStart(2, '0') : null, date.year].filter(value => value !== null).join('/');
};

/** An optional, independent evidence drawer. Opening this never enables design geometry. */
export async function createDesignPanel({ assetBaseUrl, surveyBaseUrl, evidence, onFocusBuilding, onClose, onStatus }) {
  const response = await fetch(assetUrl('design-inputs.json', assetBaseUrl));
  if (!response.ok) throw new Error(`Sources de conception indisponibles (${response.status}).`);
  const sources = orderedSources(await response.json());
  const data = validateDesignEvidence(evidence);
  const galleryUrl = assetUrl('index.html', surveyBaseUrl);
  const csvUrl = assetUrl('index.csv', surveyBaseUrl);
  const captureById = new Map(data.captures.map(capture => [capture.capture_id, capture]));
  const observationById = new Map(data.observations.map(observation => [observation.observationId, observation]));
  const matchById = new Map(data.buildingMatches.map(match => [match.buildingId, match]));
  const changes = data.changes.slice().sort((a, b) => {
    const priority = { missing_detail: 0, dated_change_supported: 1, unresolved: 2 };
    return priority[a.discrepancy] - priority[b.discrepancy];
  });
  const listeners = [];
  let disposed = false;
  let previousFocus = null;
  let selectedBuilding = null;
  const panel = node('section', 'design-panel');
  panel.id = 'design-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'design-heading');
  const header = node('header', 'design-header');
  const heading = node('h2', '', 'Conception · sources & preuves');
  heading.id = 'design-heading';
  const close = node('button', 'design-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer les sources et preuves');
  close.title = 'Fermer · Échap';
  header.append(heading, close);
  const body = node('div', 'design-body');
  const intro = paragraph('Les volumes officiels donnent le socle. Le relevé Street View étaye des ajouts de conception visibles, reliés ici à une cible et à une façade vérifiées.');
  const note = node('p', 'design-note', 'L’ordre décrit le travail de conception ; l’autorité dépend de la caractéristique. Les repères B/S/U sont visuels, sans identité cadastrale présumée.');
  const status = node('p', 'design-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const section = (title, className = '') => {
    const result = node('section', `design-section ${className}`.trim());
    result.append(node('h3', '', title));
    return result;
  };
  const sourceSection = section('Entrées de conception · par priorité');
  const sourceList = node('ol', 'design-sources');
  for (const source of sources) {
    const item = node('li', 'design-source');
    item.value = source.priority;
    const sourceHref = source.sourceId === 'streetview' ? galleryUrl : checkedSourceUrl(source.url);
    item.append(link(source.label, sourceHref));
    for (const use of source.uses ?? []) item.append(paragraph(use));
    item.append(node('p', 'design-date', recorded(source.dateMeaning)));
    for (const limitation of source.limitations ?? []) item.append(node('p', 'design-note', limitation));
    for (const extra of source.links ?? []) item.append(link(extra.label, checkedSourceUrl(extra.url)));
    sourceList.append(item);
  }
  sourceSection.append(sourceList);
  const targetsSection = section('Volumes locaux · correspondances');
  targetsSection.append(paragraph('La date source décrit la géométrie correspondante, pas la date d’édition du fichier DXF. Une correspondance visuelle confirmée ne vaut pas identité cadastrale.'));
  const targets = node('ul', 'design-targets');
  const targetRows = new Map();
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  };
  for (const match of data.buildingMatches) {
    const item = node('li', 'design-target');
    const title = node('strong', '', match.buildingId);
    const visual = Array.isArray(match.surveyIds) && match.surveyIds.length ? match.surveyIds.join(', ') : 'aucun repère attribué';
    item.append(title, paragraph(`${match.status === 'confirmed' ? 'Correspondance confirmée' : 'Correspondance à vérifier'} · ${visual}`));
    item.append(node('p', 'design-date', `Date source : ${sourceDate(match.sourceDate)}`));
    if (match.sourceUuid) item.append(node('p', 'design-id', `UUID source : ${match.sourceUuid}`));
    if (match.reason) item.append(node('p', 'design-note', match.reason));
    const focus = node('button', 'design-focus', 'Centrer ce volume');
    focus.type = 'button';
    focus.disabled = typeof onFocusBuilding !== 'function';
    listen(focus, 'click', () => { onFocusBuilding?.(match.buildingId); showBuilding(match.buildingId); });
    item.append(focus);
    targetRows.set(match.buildingId, item);
    targets.append(item);
  }
  targetsSection.append(targets);
  const discrepancies = section('Écarts à examiner · priorité de travail');
  discrepancies.append(node('p', 'design-note', 'Une façade sans détail peut refléter le niveau de représentation du volume. Elle ne prouve pas que la source soit ancienne.'));
  const changeList = node('ol', 'design-changes');
  const changeRows = new Map();
  for (const change of changes) {
    const item = node('li', 'design-change');
    const button = node('button', 'design-change-button', `${change.title ?? change.changeId} · ${change.buildingId}`);
    button.type = 'button';
    button.setAttribute('aria-controls', 'design-selection');
    listen(button, 'click', () => showChange(change.changeId));
    item.append(button, paragraph(`${labels[change.discrepancy]} · ${change.status === 'ready' ? 'documenté pour le pilote' : 'non appliqué'}`));
    if (change.reason) item.append(node('p', 'design-note', change.reason));
    changeList.append(item);
    changeRows.set(change.changeId, { item, button });
  }
  if (!changes.length) changeList.append(node('li', '', 'Aucun ajout documenté à ce stade.'));
  discrepancies.append(changeList);
  const firstFace = section('Premier relevé de façade');
  const first = data.observations[0];
  if (first) {
    firstFace.append(paragraph(`${first.buildingId} · face ${recorded(first.faceId)}`), paragraph(recorded(first.statement)));
    firstFace.append(node('p', 'design-date', `Observation : ${recorded(first.observedAt)} · confiance ${confidenceLabels[first.confidence] ?? recorded(first.confidence)}`));
    for (const limitation of first.limitations ?? []) firstFace.append(node('p', 'design-note', limitation));
  } else firstFace.append(paragraph('Aucune façade documentée à ce stade.'));
  const selection = section('Pourquoi ce détail ?', 'design-selection');
  selection.id = 'design-selection';
  selection.tabIndex = -1;
  const documents = node('nav', 'design-documents');
  documents.setAttribute('aria-label', 'Documents originaux du relevé');
  documents.append(link('Galerie originale ↗', galleryUrl), link('Index CSV original ↗', csvUrl));
  body.append(intro, note, status, sourceSection, targetsSection, discrepancies, firstFace, selection, documents);
  panel.append(header, body);

  function announce(message) { status.textContent = message; onStatus?.(message); }
  function setOpen(value) {
    if (disposed) return;
    const open = Boolean(value);
    if (open === !panel.hidden) return;
    panel.hidden = !open;
    if (open) { previousFocus = document.activeElement; close.focus({ preventScroll: true }); }
    else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function closePanel() { setOpen(false); onClose?.(); }
  function renderSelection(change, detailId) {
    selection.replaceChildren(node('h3', '', 'Pourquoi ce détail ?'));
    for (const { button } of changeRows.values()) button.removeAttribute('aria-current');
    if (!change) {
      selection.append(paragraph(selectedBuilding ? `Aucun détail de façade appliqué au volume ${selectedBuilding}. Les correspondances non résolues restent à examiner.` : 'Choisir un écart pour consulter sa façade et les captures originales.'));
      return;
    }
    changeRows.get(change.changeId)?.button.setAttribute('aria-current', 'true');
    const match = matchById.get(change.buildingId);
    const selectedDetail = (change.details ?? []).find(detail => detail.id === detailId && detailId !== undefined);
    selection.append(node('h4', '', change.title ?? change.changeId));
    if (selectedDetail) selection.append(node('p', 'design-selected-detail', `Élément sélectionné : ${selectedDetail.label ?? detailLabels[selectedDetail.kind] ?? selectedDetail.kind ?? selectedDetail.id}`));
    selection.append(paragraph(`${change.changeId} · volume ${change.buildingId} · face ${recorded(change.faceId)}`));
    selection.append(node('p', 'design-kind', `${labels[change.discrepancy]} · ${change.status === 'ready' ? 'documenté pour le pilote' : 'à vérifier · non appliqué'}`));
    selection.append(paragraph(recorded(change.reason)));
    selection.append(node('p', 'design-note', `Confiance : ${confidenceLabels[change.confidence] ?? recorded(change.confidence)}. ${change.approximate === true ? 'Interprétation et dimensions approximatives ; aucun report sur les faces cachées.' : 'Dimensions non établies.'}`));
    selection.append(node('p', 'design-date', `Géométrie · date source : ${sourceDate(match?.sourceDate)}`));
    const observations = (change.observationIds ?? []).map(id => observationById.get(id)).filter(Boolean);
    const captureIds = new Set([...(selectedDetail?.evidenceIds ?? []), ...(change.evidenceIds ?? [])]);
    for (const observation of observations) {
      for (const captureId of observation.captureIds ?? []) captureIds.add(captureId);
    }
    const appendCapture = captureId => {
      const capture = captureById.get(captureId);
      if (!capture) return;
      const figure = node('figure', 'design-figure');
      const caption = node('figcaption', '', `${captureId} · ${recorded(capture.provider)}. Capture originale intégrale ; interface et attributions conservées. Les mentions visibles font foi.`);
      try {
        const imageUrl = assetUrl(capture.screenshot, surveyBaseUrl);
        const image = node('img', 'design-image');
        image.src = imageUrl;
        image.alt = `${captureId} · photographie originale étayant ${change.title ?? change.changeId}`;
        image.loading = 'lazy'; image.decoding = 'async';
        image.addEventListener('error', () => { image.hidden = true; caption.textContent += ' Image indisponible ici ; consulter la galerie originale.'; }, { once: true });
        figure.append(image, caption);
        selection.append(figure, link(`Capture ${captureId} complète ↗`, imageUrl));
      } catch {
        figure.append(caption); selection.append(figure);
      }
      const captureInfo = node('dl', 'design-metadata');
      for (const [label, value] of [['Imagerie · libellé affiché', capture.imagery_date], ['Capture d’écran · horodatage brut', capture.captured_at_utc], ['Notes originales', capture.notes]]) {
        captureInfo.append(node('dt', '', label), node('dd', '', recorded(value)));
      }
      selection.append(captureInfo);
      const links = node('p', 'design-capture-links');
      const galleryCapture = new URL(galleryUrl); galleryCapture.hash = captureId;
      links.append(link(`Galerie · ${captureId} ↗`, galleryCapture.href));
      if (isStreetViewUrl(capture.streetview_url)) links.append(link('Point Google Street View ↗', capture.streetview_url));
      else links.append(node('span', '', 'Lien Google non renseigné / non vérifié.'));
      selection.append(links);
    };
    const [firstCapture, ...remainingCaptures] = captureIds;
    if (firstCapture) appendCapture(firstCapture);
    for (const observation of observations) {
      selection.append(paragraph(recorded(observation.statement)));
      selection.append(node('p', 'design-date', `Imagerie / observation : ${recorded(observation.observedAt)}`));
      for (const limitation of observation.limitations ?? []) selection.append(node('p', 'design-note', limitation));
    }
    if (Array.isArray(change.details) && change.details.length) {
      const disclosure = node('details', 'design-detail-disclosure');
      disclosure.append(node('summary', '', `${change.details.length} élément${change.details.length === 1 ? '' : 's'} interprété${change.details.length === 1 ? '' : 's'} · dimensions estimées`));
      const details = node('ul', 'design-detail-list');
      for (const detail of change.details) {
        const dimensions = typeof detail.width === 'number' && typeof detail.height === 'number'
          ? ` · ${detail.width} × ${detail.height}${typeof detail.depth === 'number' ? ` × ${detail.depth}` : ''} m, approximatif` : '';
        details.append(node('li', '', `${detail.label ?? detailLabels[detail.kind] ?? detail.kind ?? detail.type ?? 'Détail visible'}${dimensions}`));
      }
      disclosure.append(details);
      selection.append(disclosure);
    }
    for (const captureId of remainingCaptures) appendCapture(captureId);
    selection.append(node('p', 'design-note', 'La date de capture d’écran est distincte de celle de l’imagerie. Ces documents ne garantissent pas l’état actuel des lieux.'));
  }
  function showBuilding(id) {
    if (disposed) return;
    selectedBuilding = id;
    for (const [buildingId, row] of targetRows) row.classList.toggle('design-selected', buildingId === id);
    const change = changes.find(item => item.buildingId === id && item.status === 'ready') ?? changes.find(item => item.buildingId === id);
    renderSelection(change);
    setOpen(true);
    announce(matchById.has(id) ? `Volume ${id} · ${change ? 'preuve sélectionnée ci-dessous' : 'correspondance à examiner'}.` : `Volume ${id} absent du registre de preuves.`);
    selection.scrollIntoView?.({ block: 'nearest' });
    selection.focus({ preventScroll: true });
  }
  function showChange(id, detailId) {
    if (disposed) return;
    const change = changes.find(item => item.changeId === id);
    if (!change) { announce('Ce détail ne figure pas dans le registre.'); setOpen(true); return; }
    selectedBuilding = change.buildingId;
    for (const [buildingId, row] of targetRows) row.classList.toggle('design-selected', buildingId === selectedBuilding);
    renderSelection(change, detailId); setOpen(true);
    announce(`${change.title ?? id} · preuves et limites ci-dessous.`);
    selection.scrollIntoView?.({ block: 'nearest' });
    selection.focus({ preventScroll: true });
  }
  function showSources() {
    if (disposed) return;
    setOpen(true);
    body.scrollTop = 0;
    announce(`${sources.length} entrées de conception · sources par priorité.`);
  }
  listen(close, 'click', closePanel);
  listen(document, 'keydown', event => {
    if (!panel.hidden && event.key === 'Escape') { event.preventDefault(); closePanel(); }
  });
  renderSelection(changes.find(change => change.status === 'ready') ?? changes[0]);
  status.textContent = `${data.buildingMatches.length} volumes · ${changes.filter(change => change.status === 'ready').length} proposition(s) documentée(s).`;
  return {
    element: panel, showBuilding, showChange, showSources, setOpen,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const remove of listeners) remove();
      for (const image of panel.querySelectorAll('img')) image.removeAttribute('src');
      panel.remove();
    }
  };
}
