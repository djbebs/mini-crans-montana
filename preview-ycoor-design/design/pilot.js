import { createLocalBuildings } from './local-buildings.js';
import { createDesignEnhancements } from './design-enhancements.js';
import { createDesignPanel } from './design-panel.js';
import { assetUrl, validateDesignEvidence } from './design-model.js';

/** Pick the nearest visible pilot surface, respecting foreground scene objects. */
export function pickPilotGeometry(raycaster, { local, additions, maxDistance = Infinity }) {
  if (!local.group.visible) return false;
  local.group.updateWorldMatrix(true, true);
  const surface = raycaster.intersectObjects(local.meshes, false)[0];
  const limit = Math.min(maxDistance, surface?.distance ?? Infinity);
  if (additions?.pick(raycaster, { maxDistance: limit })) return true;
  return Boolean(surface && surface.distance <= maxDistance && local.pick(raycaster));
}

async function readJson(base, path) {
  const response = await fetch(assetUrl(path, base));
  if (!response.ok) throw new Error(`${path} : HTTP ${response.status}`);
  return response.json();
}

/** Coordinate the independent local source and its optional evidence additions. */
export async function createPilot({ THREE, scene, dataBaseUrl, designBaseUrl, surveyBaseUrl,
  originHeight, onTerrainSnapshot, onStatus, onPanelOpen, onPanelClose, onFocus }) {
  const [data, snapshot] = await Promise.all([
    readJson(dataBaseUrl, 'ycoor-dxf.json'),
    readJson(dataBaseUrl, 'terrain-snapshot.json').catch(error => {
      console.warn('Instantané du relief', error);
      return null;
    }),
  ]);
  if (snapshot) onTerrainSnapshot?.(snapshot);
  const datum = typeof originHeight === 'function' ? originHeight() : originHeight;
  const local = createLocalBuildings({ THREE, scene, data, originHeight: datum,
    onSelect: building => {
      if (!panel) return;
      onPanelOpen?.();
      panel.showBuilding(building.id);
    },
  });
  let panel = null, additions = null, evidence = null, visible = true, enabled = true, disposed = false;
  const status = { buildings: local.buildings.length, changes: 0, details: 0, designReady: false, error: null };
  try {
    evidence = validateDesignEvidence(await readJson(designBaseUrl, 'design-evidence.json'));
    additions = createDesignEnhancements({ THREE, scene, changes: evidence.changes, faces: local.faces,
      originHeight: datum,
      onSelect: hit => {
        onPanelOpen?.();
        panel?.showChange(hit.changeId, hit.detailId);
      },
    });
    status.changes = evidence.changes.filter(change => change.status === 'ready').length;
    status.details = evidence.changes.filter(change => change.status === 'ready').reduce((sum, change) => sum + change.details.length, 0);
    status.designReady = true;
    additions.setEnabled(true);
    try {
      panel = await createDesignPanel({ assetBaseUrl: designBaseUrl, surveyBaseUrl, evidence,
        onFocusBuilding: id => onFocus?.({ building: local.buildings.find(building => building.id === id) }),
        onClose: () => onPanelClose?.(),
      });
      document.body.append(panel.element);
    } catch (error) {
      console.warn('Panneau des preuves', error);
      status.error = 'Panneau des preuves indisponible.';
    }
  } catch (error) {
    additions?.dispose();
    additions = null;
    status.designReady = false;
    status.error = 'Ajouts indisponibles ; volumes DXF conservés.';
    console.warn('Ajouts documentés', error);
  }
  onStatus?.({ ...status });
  function focusFacade(changeId) {
    if (disposed || !status.designReady) return false;
    const change = evidence?.changes.find(change => change.status === 'ready'
      && (changeId === undefined || change.changeId === changeId));
    if (!change) return false;
    const building = local.buildings.find(building => building.id === change.buildingId);
    const face = local.faces.find(face => face.id === change.faceId && face.buildingId === change.buildingId);
    if (!building || !face || face.facadeAllowed === false || face.orientationAmbiguous) return false;
    onFocus?.({ building, face, change });
    return true;
  }
  return {
    local, data, evidence, status,
    get designEnabled() { return visible && enabled && status.designReady; },
    get panelOpen() { return Boolean(panel && !panel.element.hidden); },
    get panelReady() { return Boolean(panel); },
    setVisible(value) {
      if (disposed) return;
      visible = Boolean(value);
      local.setVisible(visible);
      additions?.setEnabled(visible && enabled);
    },
    setDesignEnabled(value) {
      if (disposed) return;
      enabled = Boolean(value);
      additions?.setEnabled(visible && enabled);
    },
    setOriginHeight(height) {
      if (disposed) return;
      local.setOriginHeight(height);
      additions?.setOriginHeight(height);
    },
    openSources(value = true) {
      if (disposed || !panel) return;
      if (value) onPanelOpen?.();
      if (value && panel.showSources) panel.showSources();
      else panel.setOpen(value);
    },
    focusFacade,
    focusFirstFacade: () => focusFacade(),
    pick(raycaster, { maxDistance = Infinity } = {}) {
      if (disposed || !visible) return false;
      return pickPilotGeometry(raycaster, { local, additions, maxDistance });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      panel?.dispose();
      additions?.dispose();
      local.dispose();
    },
  };
}
