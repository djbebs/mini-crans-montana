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

test('inventory stays available without the design evidence view or source fetch', async t => {
  const priorDocument = globalThis.document, priorFetch = globalThis.fetch;
  const fixtureDocument = new Element('document');
  fixtureDocument.createElement = tag => new Element(tag);
  const trigger = new Element('button');
  fixtureDocument.activeElement = trigger;
  globalThis.document = fixtureDocument;
  globalThis.fetch = async () => { throw new Error('The inventory must not fetch design sources.'); };
  let panel;
  t.after(() => { panel?.dispose(); globalThis.document = priorDocument; globalThis.fetch = priorFetch; });
  const evidence = read('design-evidence.json');
  const change = evidence.changes.find(item => item.status === 'ready');
  const inventory = {
    summary: { buildingCount: 1, faceCount: 1, partialFaceCount: 1, notReviewedFaceCount: 0, blockedFaceCount: 0, completeFaceCount: 0, detailCount: change.details.length, openingDetailCount: 1 },
    buildings: [{ buildingId: change.buildingId, visualIds: ['B001'], faceIds: [change.faceId], matchStatus: 'confirmed' }],
    faces: [{ faceId: change.faceId, buildingId: change.buildingId, status: 'partial', orientation: 'Nord', detailCount: change.details.length, openingDetailCount: 1, changeIds: [change.changeId], canFocus: true }],
  };
  const focused = [], views = [];
  let closed = 0;
  panel = await createDesignPanel({ inventory, assetBaseUrl: 'https://example.test/design/',
    onFocusFace: id => { focused.push(id); return true; },
    onViewChange: view => views.push(view), onClose: () => closed++,
  });
  assert.equal(panel.element.hidden, true);
  panel.showCoverage();
  assert.equal(panel.element.hidden, false);
  assert.deepEqual(views, ['coverage']);
  assert.equal(panel.element.children[0].children[0].textContent, 'Ycoor · couverture des faces');
  assert.equal(findClass(panel.element, 'coverage-proof'), undefined);
  assert.equal(findClass(panel.element, 'design-selection'), undefined);
  findClass(panel.element, 'coverage-focus').dispatch('click');
  assert.deepEqual(focused, [change.faceId]);
  assert.equal(panel.element.hidden, true);
  assert.equal(fixtureDocument.activeElement, trigger);
  assert.equal(closed, 1);
  panel.showCoverage();
  let prevented = false;
  fixtureDocument.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(panel.element.hidden, true);
  assert.equal(closed, 2);
});
