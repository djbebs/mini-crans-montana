import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDesignPanel } from '../design-panel.js';

// The drawer uses native DOM construction and events; this fixture keeps those
// interactions observable without adding a browser or DOM package dependency.
class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.hidden = false;
    this.isConnected = true;
    this.textContent = '';
    this.classList = { toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
  focus() { document.activeElement = this; }
  scrollIntoView() {}
  querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
  remove() { this.isConnected = false; }
}
const read = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const findClass = (element, className) => {
  if (element.className?.split(' ').includes(className)) return element;
  for (const child of element.children) { const found = findClass(child, className); if (found) return found; }
};

test('coverage proof notifies the host after the evidence view updates, keeping drawer controls synchronized', async t => {
  const priorDocument = globalThis.document, priorFetch = globalThis.fetch;
  const fixtureDocument = new Element('document');
  fixtureDocument.createElement = tag => new Element(tag);
  fixtureDocument.activeElement = new Element('button');
  globalThis.document = fixtureDocument;
  globalThis.fetch = async () => ({ ok: true, json: async () => read('design-inputs.json') });
  t.after(() => { globalThis.document = priorDocument; globalThis.fetch = priorFetch; });
  const evidence = read('design-evidence.json');
  const change = evidence.changes.find(item => item.status === 'ready');
  const inventory = {
    summary: { buildingCount: 1, faceCount: 1, partialFaceCount: 1, notReviewedFaceCount: 0, blockedFaceCount: 0, completeFaceCount: 0, detailCount: change.details.length, openingDetailCount: 1 },
    buildings: [{ buildingId: change.buildingId, visualIds: ['B001'], faceIds: [change.faceId], matchStatus: 'confirmed' }],
    faces: [{ faceId: change.faceId, buildingId: change.buildingId, status: 'partial', orientation: 'Nord', detailCount: change.details.length, openingDetailCount: 1, changeIds: [change.changeId], canFocus: true }],
  };
  const notifications = [], focusViews = [];
  let panel, expanded = false, closed = 0;
  const synchronizeHost = () => { expanded = !panel.element.hidden && panel.view === 'coverage'; };
  panel = await createDesignPanel({
    evidence, inventory, assetBaseUrl: 'https://example.test/design/', surveyBaseUrl: 'https://example.test/survey/',
    onFocusChange: id => { assert.equal(id, change.changeId); focusViews.push(panel.view); synchronizeHost(); },
    onViewChange: view => {
      const coverage = findClass(panel.element, 'design-coverage');
      notifications.push({ view, observedView: panel.view, coverageHidden: coverage.hidden,
        selectionHidden: findClass(panel.element, 'design-selection').hidden,
        heading: panel.element.children[0].children[0].textContent,
        closeLabel: findClass(panel.element, 'design-close').getAttribute('aria-label') });
      synchronizeHost();
    },
    onClose: () => { closed++; synchronizeHost(); },
  });
  t.after(() => panel.dispose());
  assert.deepEqual(notifications, [], 'constructing the drawer must not notify before the host can retain its handle');
  panel.showCoverage();
  synchronizeHost(); // The host synchronizes opening after showCoverage returns.
  assert.equal(expanded, true);
  findClass(panel.element, 'coverage-proof').dispatch('click');
  assert.deepEqual(focusViews, ['coverage'], 'geometry focus runs before proof navigation');
  assert.equal(expanded, false, 'view notification must correct the host state after geometry focus observed coverage');
  assert.deepEqual(notifications.map(item => item.view), ['coverage', 'evidence']);
  assert.deepEqual(notifications.at(-1), {
    view: 'evidence', observedView: 'evidence', coverageHidden: true, selectionHidden: false,
    heading: 'Conception · sources & preuves', closeLabel: 'Fermer les sources et preuves',
  });
  assert.equal(panel.element.hidden, false);
  assert.equal(findClass(panel.element, 'design-status').textContent, `${change.title ?? change.changeId} · preuves et limites ci-dessous.`);
  panel.showCoverage();
  panel.showSources();
  assert.equal(notifications.at(-1).view, 'sources');
  assert.equal(findClass(panel.element, 'design-coverage').hidden, true);
  assert.equal(findClass(panel.element, 'design-selection').hidden, false);
  findClass(panel.element, 'design-close').dispatch('click');
  assert.equal(panel.element.hidden, true);
  assert.equal(closed, 1);
  panel.showCoverage();
  let prevented = false;
  fixtureDocument.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(panel.element.hidden, true);
  assert.equal(expanded, false);
  assert.equal(closed, 2);
});
