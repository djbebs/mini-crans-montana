import { headingVector } from './survey-model.js';

const COLORS = { google: 0x2f5c9e, contributor: 0x8e5bb2, selected: 0xffdc53, edge: 0x1d221c };
const SYMBOL_HEIGHT = 1.8;

/** Camera evidence symbols. Positions are projected verbatim, including outside the pilot. */
export function createSurveyMarkers({ THREE, scene, panoramas, project, height }) {
  const group = new THREE.Group();
  group.name = 'streetview-survey-cameras';
  group.visible = false;
  const meshes = [];
  const outlines = new Map();
  let enabled = false;
  let disposed = false;
  let visibleIds = new Set(panoramas.map(p => p.panorama_id));
  let selectedPanorama = null;
  let selectedCapture = null;
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const material = color => new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, depthTest: false, depthWrite: false, fog: false,
  });

  for (const panorama of panoramas) {
    const point = project(panorama.position.lat, panorama.position.lon);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) {
      throw new Error(`Projection invalide pour ${panorama.map_id}.`);
    }
    const google = panorama.sourceType === 'google';
    const geometry = google ? new THREE.CircleGeometry(1.6, 20) : new THREE.PlaneGeometry(2.55, 2.55);
    const outlineGeometry = google ? new THREE.CircleGeometry(1.95, 20) : new THREE.PlaneGeometry(3.15, 3.15);
    const mesh = new THREE.Mesh(geometry, material(COLORS[panorama.sourceType] ?? COLORS.contributor));
    const outline = new THREE.Mesh(outlineGeometry, material(COLORS.edge));
    mesh.rotation.set(-Math.PI / 2, 0, google ? 0 : Math.PI / 4);
    outline.rotation.copy(mesh.rotation);
    mesh.position.set(point.x, 0, point.z);
    outline.position.set(point.x, 0, point.z);
    mesh.renderOrder = 31;
    outline.renderOrder = 30;
    mesh.name = `streetview-camera-${panorama.map_id}`;
    mesh.userData.panorama = panorama;
    outlines.set(mesh, outline);
    meshes.push(mesh);
    group.add(outline, mesh);
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.minZ = Math.min(bounds.minZ, point.z);
    bounds.maxZ = Math.max(bounds.maxZ, point.z);
  }
  if (!panoramas.length) Object.assign(bounds, { minX: 0, maxX: 0, minZ: 0, maxZ: 0 });

  // This is a symbolic viewer-heading indicator, not a surveyed camera pose.
  const arrow = new THREE.Group();
  arrow.name = 'streetview-viewer-heading';
  arrow.visible = false;
  const shaftGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 5.2, 0),
  ]);
  const shaftMaterial = new THREE.LineBasicMaterial({ color: COLORS.selected, depthTest: false, depthWrite: false, fog: false });
  const shaft = new THREE.Line(shaftGeometry, shaftMaterial);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 8), material(COLORS.selected));
  tip.position.y = 5.2;
  shaft.renderOrder = tip.renderOrder = 32;
  arrow.add(shaft, tip);
  group.add(arrow);
  scene.add(group);

  const elevationAt = (x, z) => {
    const elevation = height(x, z);
    return Number.isFinite(elevation) ? elevation : 0;
  };
  const updateArrow = () => {
    const vector = selectedPanorama?.sourceType === 'google' ? headingVector(selectedCapture?.heading_deg) : null;
    const marker = meshes.find(mesh => mesh.userData.panorama.panorama_id === selectedPanorama?.panorama_id);
    arrow.visible = Boolean(vector && marker?.visible);
    if (!arrow.visible) return;
    arrow.position.copy(marker.position);
    arrow.position.y += 0.15;
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(vector.x, 0, vector.z));
  };
  const refreshHeights = () => {
    if (disposed) return;
    for (const mesh of meshes) {
      mesh.position.y = elevationAt(mesh.position.x, mesh.position.z) + SYMBOL_HEIGHT;
      outlines.get(mesh).position.y = mesh.position.y - 0.05;
    }
    updateArrow();
    group.updateMatrixWorld(true);
  };
  refreshHeights();

  return {
    group, meshes, arrow, bounds,
    get enabled() { return enabled; },
    setEnabled(value) {
      if (disposed) return;
      enabled = Boolean(value);
      group.visible = enabled;
      group.updateMatrixWorld(true);
    },
    setPanoramas(filteredPanoramas) {
      if (disposed) return;
      visibleIds = new Set(filteredPanoramas.map(p => p.panorama_id));
      for (const mesh of meshes) {
        mesh.visible = visibleIds.has(mesh.userData.panorama.panorama_id);
        outlines.get(mesh).visible = mesh.visible;
      }
      updateArrow();
    },
    select(panorama, capture) {
      if (disposed) return;
      selectedPanorama = panorama;
      selectedCapture = capture;
      for (const mesh of meshes) {
        const source = mesh.userData.panorama;
        mesh.material.color.setHex(source.panorama_id === panorama?.panorama_id ? COLORS.selected : COLORS[source.sourceType] ?? COLORS.contributor);
      }
      updateArrow();
    },
    pick(raycaster) {
      if (!enabled || disposed) return null;
      group.updateMatrixWorld(true);
      const visible = meshes.filter(mesh => mesh.visible);
      return raycaster.intersectObjects(visible, false)[0]?.object.userData.panorama ?? null;
    },
    refreshHeights,
    dispose() {
      if (disposed) return;
      disposed = true;
      enabled = false;
      scene.remove(group);
      const resources = new Set();
      group.traverse(object => {
        if (object.geometry) resources.add(object.geometry);
        for (const item of Array.isArray(object.material) ? object.material : [object.material]) {
          if (item) resources.add(item);
        }
      });
      for (const resource of resources) resource.dispose();
      group.clear();
    },
  };
}
