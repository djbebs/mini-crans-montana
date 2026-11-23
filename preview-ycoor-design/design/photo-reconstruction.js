import { createLocalBuildings } from './local-buildings.js?v=2';
import { createDesignEnhancements } from './design-enhancements.js?v=2';

/** An explicitly approximate interpretation; never replaces the source dataset. */
export function createPhotoReconstruction({ THREE, scene, data, source, originHeight }) {
  if (data?.approximate !== true || data.method !== 'PHOTO_INTERPRETATION_ON_OFFICIAL_FOOTPRINT'
    || !Array.isArray(data.evidenceIds) || !data.evidenceIds.length || !data.heightStatus?.includes('NOT_SURVEYED')) {
    throw new Error('Photographic reconstruction must carry evidence and estimated-height metadata.');
  }
  const original = source.buildings.find(building => building.id === data.buildingId);
  if (!original || original.sourceUuid !== data.referenceSourceUuid
    || JSON.stringify(original.vertices) !== JSON.stringify(data.referenceSourceGeometry?.vertices)
    || JSON.stringify(original.faces) !== JSON.stringify(data.referenceSourceGeometry?.faces)
    || original.bounds.some((value, i) => Math.abs(value - data.sourceBounds[i]) > .01)
    || data.geometry.origin.e !== source.origin.e || data.geometry.origin.n !== source.origin.n) {
    throw new Error('Photographic reconstruction no longer matches the reference source.');
  }
  let model, additions, texture;
  try {
    model = createLocalBuildings({ THREE, scene, data: data.geometry, originHeight });
    model.group.name = 'ycoor-photo-reconstruction-B007';
    const length = Math.hypot(...data.along), [ue, un] = data.along.map(value => value / length);
    const normals = { street: [-un, 0, -ue], lake: [un, 0, ue], end: [ue, 0, -un] };
    const depth = Math.max(...original.vertices.map(([e, n]) => (e - data.anchor[0]) * un - (n - data.anchor[1]) * ue));
    const changes = data.facades.map(facade => {
      const normal = normals[facade.side];
      if (!normal) throw new Error('Unknown reconstruction facade.');
      const face = model.faces.filter(face => face.normal.reduce((sum, v, i) => sum + v * normal[i], 0) > .995)
        .sort((a, b) => (b.bounds.maxU - b.bounds.minU) - (a.bounds.maxU - a.bounds.minU))[0];
      if (!face || !face.facadeAllowed || face.orientationAmbiguous) throw new Error('Unusable reconstructed facade: ' + facade.side);
      const details = facade.details.map(detail => {
        const station = facade.side === 'end' ? length : detail.u;
        const across = facade.side === 'end' ? detail.u : facade.side === 'lake' ? depth : 0;
        const x = data.anchor[0] + ue * station + un * across - source.origin.e;
        const z = source.origin.n - (data.anchor[1] + un * station - ue * across);
        return { ...detail, u: (x - face.origin[0]) * face.u[0] + (z - face.origin[2]) * face.u[2] };
      });
      return { changeId: 'PHOTO-B007-' + facade.side, buildingId: data.buildingId, faceId: face.id,
        status: 'ready', evidenceIds: facade.evidenceIds, details };
    });
    additions = createDesignEnhancements({ THREE, scene, changes, faces: model.faces, originHeight });
    const bytes = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const shade = y % 8 === 0 ? .78 : .94 + (Math.floor(y / 8) % 2) * .035;
      const i = (y * 32 + x) * 4;
      bytes.set([Math.round(112 * shade), Math.round(102 * shade), Math.round(89 * shade), 255], i);
    }
    texture = new THREE.DataTexture(bytes, 32, 32);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter; texture.needsUpdate = true;
    for (const mesh of model.meshes) {
      const positions = mesh.geometry.attributes.position, uv = [];
      for (let i = 0; i < positions.count; i++) uv.push((positions.getX(i) + positions.getZ(i)) / 2, positions.getY(i) / .8);
      mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const [wall, roof] = mesh.material;
      // This model has its own palette; the source-only CAD classification shader is unnecessary.
      for (const material of mesh.material) { material.onBeforeCompile = () => {}; material.customProgramCacheKey = () => 'photo-B007-v1'; material.needsUpdate = true; }
      wall.color.set('#a29887'); wall.map = texture; roof.color.set('#4b5050');
      mesh.castShadow = true;
    }
    const meshes = [...model.meshes, ...additions.meshes];
    for (const mesh of meshes) {
      Object.assign(mesh.userData, { source: 'photo-reconstruction', approximate: true, buildingId: data.buildingId });
      // Millimetre-scale cladding and broad coplanar walls alias in the sector shadow map.
      // Keep their silhouettes on the ground; use Lambert shading on the model itself.
      mesh.receiveShadow = false;
    }
    model.setVisible(false); additions.setEnabled(false);
    let enabled = false, disposed = false;
    return {
      model, additions, meshes, buildingId: data.buildingId, detailCount: changes.reduce((n, c) => n + c.details.length, 0),
      get enabled() { return enabled; },
      setEnabled(value) { if (disposed) return; enabled = Boolean(value); model.setVisible(enabled); additions.setEnabled(enabled); },
      setOriginHeight(height) { if (disposed) return; model.setOriginHeight(height); additions.setOriginHeight(height); },
      pick(raycaster, { maxDistance = Infinity } = {}) {
        if (!enabled) return false;
        if (additions.pick(raycaster, { maxDistance })) return true;
        const hit = model.pick(raycaster); return Boolean(hit && hit.distance <= maxDistance);
      },
      dispose() { if (disposed) return; disposed = true; enabled = false; additions.dispose(); model.dispose(); texture.dispose(); },
    };
  } catch (error) { additions?.dispose(); model?.dispose(); texture?.dispose(); throw error; }
}
