import { assetUrl, buildSurveyIndex, filterSurvey, headingVector, isStreetViewUrl } from './survey-model.js';
import { createSurveyMarkers } from './survey-markers.js';

const KINDS = {
  EXTERIOR_FACADE_OR_CONTEXT_VIEW: 'Façade / contexte extérieur',
  EXTERIOR_FACADE_FRAGMENT_UNASSIGNED: 'Fragment extérieur · attribution non vérifiée',
  INDOOR_COVERAGE_CHECK: 'Intérieur · contrôle de couverture',
  OBSTRUCTED_OR_ENVIRONMENT_COVERAGE_CHECK: 'Vue obstruée / environnement',
};
const unknown = value => value === undefined || value === null || String(value).trim() === '';
const recorded = value => unknown(value) ? 'Indisponible / non vérifié' : String(value);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const option = (value, label) => {
  const node = element('option', '', label);
  node.value = value;
  return node;
};
const externalLink = (label, url) => {
  const link = element('a', '', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
};

/** Load the survey only when requested. Nothing joins visual references to atlas buildings. */
export async function createStreetViewLayer({
  THREE, scene, project, height, assetBaseUrl, onEnabledChange, onFocusCamera, onStatus,
}) {
  const response = await fetch(assetUrl('survey-data.json', assetBaseUrl));
  if (!response.ok) throw new Error(`Relevé Street View indisponible (${response.status}).`);
  const raw = await response.json();
  const index = buildSurveyIndex(raw);
  const markers = createSurveyMarkers({ THREE, scene, panoramas: index.panoramas, project, height });
  const removers = [];
  let enabled = false;
  let disposed = false;
  let filtered = filterSurvey(index);
  let selectedPanorama = filtered.panoramas[0] ?? null;
  let selectedCapture = filtered.captures[0] ?? null;
  let imageUrl = '';

  const panel = element('section', 'sv-panel');
  panel.id = 'streetview-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'streetview-heading');
  const header = element('header', 'sv-header');
  const title = element('h2', '', 'Street View · Ycoor');
  title.id = 'streetview-heading';
  const close = element('button', 'sv-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer la couche Street View');
  close.title = 'Fermer · Échap';
  header.append(title, close);
  const body = element('div', 'sv-body');
  const intro = element('p', 'sv-intro', `${index.summary.captures} captures · ${index.summary.panoramas} caméras · ${index.summary.buildings} repères visuels`);
  const legend = element('p', 'sv-legend');
  const googleLegend = element('span', 'sv-legend-google', 'Google');
  const contributorLegend = element('span', 'sv-legend-contributor', 'Contributeurs');
  legend.append(googleLegend, contributorLegend);
  const controls = element('div', 'sv-filters');
  const field = (label, id) => {
    const wrapper = element('div', 'sv-field');
    const text = element('label', '', label);
    text.htmlFor = id;
    const select = element('select');
    select.id = id;
    wrapper.append(text, select);
    return { wrapper, select };
  };
  const visual = field('Repère visuel', 'streetview-visual');
  visual.select.append(option('', 'Tous les repères'));
  for (const building of index.buildings) {
    visual.select.append(option(building.building_id, `${building.building_id} · ${recorded(building.label)}`));
  }
  const source = field('Source', 'streetview-source');
  source.select.append(option('all', 'Toutes les sources'), option('google', 'Google Street View'), option('contributor', 'Contributeurs'));
  controls.append(visual.wrapper, source.wrapper);
  const evidenceNote = element('p', 'sv-note', 'Les repères filtrent les captures. Aucun lien avec les bâtiments 3D n’est établi.');
  const referenceNote = element('p', 'sv-reference-note');
  referenceNote.hidden = true;
  const status = element('p', 'sv-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const cameraField = field('Caméra / panorama', 'streetview-panorama');
  const captureField = field('Capture', 'streetview-capture');
  const selectors = element('div', 'sv-selectors');
  selectors.append(cameraField.wrapper, captureField.wrapper);
  const navigation = element('div', 'sv-navigation');
  const previous = element('button', '', '←');
  previous.type = 'button';
  previous.setAttribute('aria-label', 'Capture précédente de cette caméra');
  const next = element('button', '', '→');
  next.type = 'button';
  next.setAttribute('aria-label', 'Capture suivante de cette caméra');
  const center = element('button', 'sv-center', 'Centrer la caméra');
  center.type = 'button';
  center.title = 'Centrer la carte sur les coordonnées rapportées de la caméra';
  navigation.append(previous, next, center);
  const selection = element('div', 'sv-selection');
  const kind = element('p', 'sv-kind');
  const figure = element('figure', 'sv-figure');
  const image = element('img', 'sv-image');
  image.decoding = 'async';
  const imageFailure = element('p', 'sv-image-failure', 'Capture indisponible. Les métadonnées restent consultables ci-dessous.');
  imageFailure.hidden = true;
  const caption = element('figcaption');
  figure.append(image, imageFailure, caption);
  const imageLink = externalLink('Ouvrir la capture complète', assetUrl('index.html', assetBaseUrl));
  const originalLink = externalLink('Ouvrir ce point dans Street View ↗', assetUrl('index.html', assetBaseUrl));
  const originalUnavailable = element('span', '', 'Lien Street View indisponible / non vérifié');
  originalUnavailable.hidden = true;
  const links = element('p', 'sv-view-links');
  links.append(imageLink, originalLink, originalUnavailable);
  const metadata = element('dl', 'sv-metadata');
  const values = {};
  for (const [name, label] of [
    ['capture', 'Capture'], ['provider', 'Source'], ['date', 'Imagerie · mois/année'],
    ['heading', 'Cap du visualiseur'], ['gps', 'GPS de la caméra · lat., lon.'],
    ['references', 'Repères visuels'], ['panorama', 'ID du panorama'], ['timestamp', 'Horodatage enregistré'],
  ]) {
    const value = element('dd');
    values[name] = value;
    metadata.append(element('dt', '', label), value);
  }
  const directionNote = element('p', 'sv-warning');
  const positionNote = element('p', 'sv-note', 'GPS = position de caméra rapportée par le visualiseur ; précision physique non vérifiée. Hauteur des symboles schématique.');
  const dateNote = element('p', 'sv-note', 'Mois/année affichés pour l’imagerie ; distincts de la date de capture d’écran. Ces vues ne prouvent pas l’état actuel des lieux.');
  const captureNotes = element('p', 'sv-capture-notes');
  const rawDetails = element('details', 'sv-details');
  rawDetails.append(element('summary', '', 'Statuts de vérification enregistrés'));
  const rawStatuses = element('dl', 'sv-metadata sv-raw-metadata');
  rawDetails.append(rawStatuses);
  selection.append(kind, figure, navigation, links, metadata, directionNote, positionNote, dateNote, captureNotes, rawDetails);
  const limitations = element('details', 'sv-details sv-limitations');
  limitations.append(element('summary', '', 'Limites du relevé et des positions'));
  limitations.append(element('p', '', 'Les coordonnées proviennent du visualiseur : leur précision physique est non vérifiée. Ce sont des positions de caméra, pas de bâtiment. La hauteur des symboles est schématique et suit le terrain du modèle.'));
  limitations.append(element('p', '', 'Les repères B, S et U sont des références visuelles, sans identité cadastrale vérifiée. Les captures incluent aussi des intérieurs, des vues obstruées et des fragments non attribués.'));
  limitations.append(element('p', '', 'Le relevé ne garantit pas l’exhaustivité des routes, des dates historiques, des visites intérieures ni des sphères non listées. Consulter la carte et les lacunes détaillées.'));
  const originalNotes = element('details', 'sv-details');
  originalNotes.append(element('summary', '', 'Notes originales du relevé'));
  const coverageNotes = Array.isArray(raw.coverage_notes) ? raw.coverage_notes : [raw.coverage_notes];
  for (const note of coverageNotes.filter(value => !unknown(value))) originalNotes.append(element('p', '', String(note)));
  limitations.append(originalNotes);
  const attribution = element('p', 'sv-attribution', 'Images originales intégrales : interface et attributions conservées. Les mentions visibles dans chaque image font foi.');
  const downloads = element('nav', 'sv-downloads');
  downloads.setAttribute('aria-label', 'Documents complets du relevé');
  for (const [label, path] of [
    ['Galerie complète ↗', 'index.html'], ['Index CSV ↗', 'index.csv'],
    ['Carte de couverture ↗', 'coverage-map.svg'], ['Lacunes CSV ↗', 'coverage-gaps.csv'],
  ]) downloads.append(externalLink(label, assetUrl(path, assetBaseUrl)));
  const filterDetails = element('details', 'sv-filter-details');
  const filterSummary = element('summary', '', 'Filtres');
  filterDetails.append(filterSummary);
  filterDetails.append(intro, legend, controls, evidenceNote, referenceNote, status);
  body.append(filterDetails, selectors, selection, limitations, attribution, downloads);
  panel.append(header, body);

  const listen = (target, event, callback) => {
    target.addEventListener(event, callback);
    removers.push(() => target.removeEventListener(event, callback));
  };
  const panoramaCaptures = () => filtered.captures.filter(capture => capture.panorama_id === selectedPanorama?.panorama_id);
  const report = () => {
    const message = `${filtered.captures.length} capture${filtered.captures.length === 1 ? '' : 's'} · ${filtered.panoramas.length} caméra${filtered.panoramas.length === 1 ? '' : 's'}`;
    filterSummary.textContent = `Filtres · ${message}`;
    status.textContent = filtered.captures.length ? message : 'Aucune capture pour ces filtres.';
    onStatus?.(status.textContent);
  };
  const showCapture = () => {
    selection.hidden = !selectedCapture;
    cameraField.select.disabled = !selectedPanorama;
    captureField.select.disabled = !selectedCapture;
    center.disabled = !selectedPanorama || !onFocusCamera;
    const captures = panoramaCaptures();
    const currentIndex = captures.indexOf(selectedCapture);
    previous.disabled = currentIndex <= 0;
    next.disabled = currentIndex < 0 || currentIndex >= captures.length - 1;
    markers.select(selectedPanorama, selectedCapture);
    if (!selectedCapture) return;
    const capture = selectedCapture;
    cameraField.select.value = selectedPanorama.panorama_id;
    captureField.select.value = capture.capture_id;
    kind.textContent = KINDS[capture.capture_kind] ?? 'Type de capture non vérifié';
    kind.dataset.kind = capture.capture_kind ?? '';
    caption.textContent = `${capture.capture_id} · capture intégrale, attribution conservée`;
    image.alt = `${capture.capture_id} · ${KINDS[capture.capture_kind] ?? 'Capture Street View'} · repères ${(capture.building_ids ?? []).join(', ') || 'non attribués'}`;
    if (enabled) {
      try {
        const url = assetUrl(capture.screenshot, assetBaseUrl);
        if (imageUrl !== url) {
          imageUrl = url;
          imageFailure.hidden = true;
          image.hidden = false;
          image.src = url;
        }
        imageLink.href = url;
        imageLink.hidden = false;
      } catch {
        image.removeAttribute('src');
        imageUrl = '';
        image.hidden = true;
        imageFailure.hidden = false;
        imageLink.hidden = true;
      }
    }
    const safeOriginal = isStreetViewUrl(capture.streetview_url);
    originalLink.hidden = !safeOriginal;
    originalUnavailable.hidden = safeOriginal;
    if (safeOriginal) originalLink.href = capture.streetview_url;
    else originalLink.removeAttribute('href');
    values.capture.textContent = capture.capture_id;
    values.provider.textContent = recorded(capture.provider);
    values.date.textContent = recorded(capture.imagery_date);
    const vector = headingVector(capture.heading_deg);
    values.heading.textContent = vector ? `${capture.heading_deg}°${unknown(capture.viewer_direction) ? '' : ` · ${capture.viewer_direction}`}` : 'Indisponible / non vérifié';
    values.gps.textContent = `${recorded(capture.latitude)}, ${recorded(capture.longitude)}`;
    values.references.textContent = capture.building_ids?.length ? capture.building_ids.join(', ') : 'Aucun repère attribué';
    values.panorama.textContent = recorded(capture.panorama_id);
    values.timestamp.textContent = recorded(capture.captured_at_utc);
    directionNote.textContent = selectedPanorama.sourceType === 'contributor'
      ? 'Contributeur : orientation géographique non calibrée. Cap du visualiseur conservé, sans flèche géographique.'
      : vector ? 'Flèche = cap du visualiseur. Calibration au nord vrai non vérifiée ; ce n’est pas une direction physique exacte.'
        : 'Cap indisponible / non vérifié : aucune flèche de direction.';
    captureNotes.textContent = unknown(capture.notes) ? 'Notes de cette capture indisponibles.' : String(capture.notes);
    rawStatuses.replaceChildren();
    for (const [key, label] of [
      ['capture_kind', 'Type original'], ['metadata_status', 'Métadonnées'], ['gps_status', 'GPS caméra'],
      ['building_gps_status', 'GPS bâtiment'], ['heading_status', 'Cap du visualiseur'],
      ['exact_physical_heading_status', 'Cap physique exact'], ['imagery_date_status', 'Date de l’imagerie'],
    ]) rawStatuses.append(element('dt', '', label), element('dd', '', recorded(capture[key])));
  };
  const fillCaptureOptions = () => {
    const captures = panoramaCaptures();
    if (!captures.includes(selectedCapture)) selectedCapture = captures[0] ?? null;
    captureField.select.replaceChildren(...captures.map(capture => option(capture.capture_id,
      `${capture.capture_id} · ${headingVector(capture.heading_deg) ? `${capture.heading_deg}°` : 'cap non vérifié'} · ${KINDS[capture.capture_kind] ?? 'type non vérifié'}`)));
    showCapture();
  };
  const applyFilters = () => {
    filtered = filterSurvey(index, { buildingId: visual.select.value, source: source.select.value });
    markers.setPanoramas(filtered.panoramas);
    if (!filtered.panoramas.includes(selectedPanorama)) selectedPanorama = filtered.panoramas[0] ?? null;
    cameraField.select.replaceChildren(...filtered.panoramas.map(panorama => option(panorama.panorama_id,
      `${panorama.map_id} · ${recorded(panorama.imagery_date)} · ${recorded(panorama.title).replace(/ - Google Maps$/, '')}`)));
    const reference = index.buildingById.get(visual.select.value);
    referenceNote.hidden = !reference;
    referenceNote.textContent = reference ? `${reference.building_id} · ${recorded(reference.label)}. ${unknown(reference.notes) ? '' : reference.notes}` : '';
    fillCaptureOptions();
    report();
  };
  const setEnabled = value => {
    if (disposed) return;
    const nextEnabled = Boolean(value);
    if (nextEnabled === enabled) return;
    enabled = nextEnabled;
    panel.hidden = !enabled;
    markers.setEnabled(enabled);
    if (enabled) {
      showCapture();
      close.focus({ preventScroll: true });
      report();
    } else onStatus?.('Couche Street View masquée.');
    onEnabledChange?.(enabled);
  };

  try {
    listen(close, 'click', () => setEnabled(false));
    listen(document, 'keydown', event => {
      if (enabled && event.key === 'Escape') {
        event.preventDefault();
        setEnabled(false);
      }
    });
    listen(visual.select, 'change', applyFilters);
    listen(source.select, 'change', applyFilters);
    listen(cameraField.select, 'change', () => {
      selectedPanorama = index.panoramaById.get(cameraField.select.value) ?? null;
      fillCaptureOptions();
    });
    listen(captureField.select, 'change', () => {
      selectedCapture = index.captureById.get(captureField.select.value) ?? null;
      showCapture();
    });
    const stepCapture = step => {
      const captures = panoramaCaptures();
      const nextCapture = captures[captures.indexOf(selectedCapture) + step];
      if (nextCapture) { selectedCapture = nextCapture; showCapture(); }
    };
    listen(previous, 'click', () => stepCapture(-1));
    listen(next, 'click', () => stepCapture(1));
    listen(center, 'click', () => { if (selectedPanorama) onFocusCamera?.(selectedPanorama); });
    listen(image, 'error', () => {
      imageUrl = '';
      image.hidden = true;
      imageFailure.hidden = false;
    });
    listen(image, 'load', () => { image.hidden = false; imageFailure.hidden = true; });
    document.body.append(panel);
    applyFilters();
  } catch (error) {
    for (const remove of removers) remove();
    panel.remove();
    markers.dispose();
    throw error;
  }

  return {
    get enabled() { return enabled; },
    bounds: markers.bounds,
    setEnabled,
    pick(raycaster) {
      if (!enabled || disposed) return false;
      const panorama = markers.pick(raycaster);
      if (!panorama) return false;
      selectedPanorama = panorama;
      fillCaptureOptions();
      return true;
    },
    refreshHeights: markers.refreshHeights,
    dispose() {
      if (disposed) return;
      if (enabled) setEnabled(false);
      disposed = true;
      for (const remove of removers) remove();
      image.removeAttribute('src');
      panel.remove();
      markers.dispose();
    },
  };
}
