import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createSurveyMarkers } from '../survey-markers.js';
import { buildSurveyIndex } from '../survey-model.js';

const panoramas = [
  { panorama_id: 'google', map_id: 'P001', position: { lat: 46.31, lon: 7.48 }, sourceType: 'google' },
  { panorama_id: 'contributor', map_id: 'P002', position: { lat: 46.32, lon: 7.49 }, sourceType: 'contributor' },
];
const project = (lat, lon) => ({ x: (lon - 7.48) * 10000, z: -(lat - 46.31) * 10000 });
const setup = () => {
  const scene = new THREE.Scene();
  let elevation = 3;
  const markers = createSurveyMarkers({ THREE, scene, panoramas, project, height: () => elevation });
  return { scene, markers, setElevation: value => { elevation = value; } };
};

test('all archived cameras produce symbols, including the five contributor records', async () => {
  const raw = JSON.parse(await readFile(new URL('../../assets/streetview-survey/2026-11-15/survey-data.json', import.meta.url), 'utf8'));
  const index = buildSurveyIndex(raw);
  const scene = new THREE.Scene();
  const markers = createSurveyMarkers({ THREE, scene, panoramas: index.panoramas, project, height: () => 0 });
  assert.equal(markers.meshes.length, 24);
  assert.equal(markers.meshes.filter(mesh => mesh.geometry.type === 'CircleGeometry').length, 19);
  assert.equal(markers.meshes.filter(mesh => mesh.geometry.type === 'PlaneGeometry').length, 5);
  for (const mesh of markers.meshes) {
    const expected = project(mesh.userData.panorama.position.lat, mesh.userData.panorama.position.lon);
    assert.equal(mesh.position.x, expected.x);
    assert.equal(mesh.position.z, expected.z);
  }
  markers.dispose();
});

test('camera overlay keeps outside-pilot coordinates and distinct, visible symbols', () => {
  const { scene, markers } = setup();
  assert.equal(scene.children.length, 1);
  assert.equal(markers.group.visible, false);
  assert.equal(markers.meshes.length, 2);
  assert.equal(markers.meshes[0].geometry.type, 'CircleGeometry');
  assert.equal(markers.meshes[1].geometry.type, 'PlaneGeometry');
  assert.ok(markers.meshes[1].position.x > 99, 'outside 100 m pilot was not clamped');
  assert.ok(markers.meshes[1].position.z < -99);
  assert.ok(markers.bounds.maxX > 99);
  assert.ok(markers.bounds.minZ < -99);
  for (const mesh of markers.meshes) {
    assert.equal(mesh.material.depthTest, false);
    assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.material.fog, false);
    assert.ok(mesh.position.y > 3, 'height is symbolic above the local terrain');
  }
  markers.dispose();
});

test('zero viewer heading points north; contributor heading never produces geographic arrow', () => {
  const { markers } = setup();
  markers.select(panoramas[0], { heading_deg: '0' });
  assert.equal(markers.arrow.visible, true);
  const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(markers.arrow.quaternion);
  assert.ok(Math.abs(direction.x) < 1e-9);
  assert.ok(Math.abs(direction.z + 1) < 1e-9);
  markers.select(panoramas[1], { heading_deg: '0' });
  assert.equal(markers.arrow.visible, false);
  markers.select(panoramas[0], { heading_deg: '' });
  assert.equal(markers.arrow.visible, false, 'unknown heading was not converted to zero');
  markers.dispose();
});

test('picking honors enabled state and evidence filters', () => {
  const { scene, markers } = setup();
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 30, 0), new THREE.Vector3(0, -1, 0));
  scene.updateMatrixWorld(true);
  assert.equal(markers.pick(raycaster), null);
  markers.setEnabled(true);
  scene.updateMatrixWorld(true);
  assert.equal(markers.pick(raycaster)?.panorama_id, 'google');
  markers.setPanoramas([panoramas[1]]);
  scene.updateMatrixWorld(true);
  assert.equal(markers.pick(raycaster), null);
  markers.setPanoramas(panoramas);
  markers.setEnabled(false);
  scene.updateMatrixWorld(true);
  assert.equal(markers.pick(raycaster), null);
  markers.dispose();
});

test('season height refresh and repeated toggles reuse resources; disposal releases all resources', () => {
  const { scene, markers, setElevation } = setup();
  const firstGeometry = markers.meshes[0].geometry;
  const oldY = markers.meshes[0].position.y;
  const disposed = new Map();
  markers.group.traverse(object => {
    const resources = [object.geometry, ...(Array.isArray(object.material) ? object.material : [object.material])];
    for (const resource of resources.filter(Boolean)) {
      if (!disposed.has(resource)) {
        disposed.set(resource, 0);
        resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
      }
    }
  });
  markers.select(panoramas[0], { heading_deg: '90' });
  setElevation(9);
  markers.refreshHeights();
  assert.ok(Math.abs(markers.meshes[0].position.y - oldY - 6) < 1e-9);
  assert.ok(markers.arrow.position.y > 9);
  for (let i = 0; i < 10; i++) { markers.setEnabled(true); markers.setEnabled(false); }
  assert.equal(scene.children.length, 1);
  assert.equal(markers.meshes[0].geometry, firstGeometry);
  markers.dispose();
  markers.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok(disposed.size >= 8);
  assert.ok([...disposed.values()].every(count => count === 1), 'each unique resource is disposed once');
});
