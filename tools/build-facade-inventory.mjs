/** Validate all authored details and generate the source-face backlog/export. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createLocalBuildings } from '../preview-ycoor-design/design/local-buildings.js';
import { createDesignEnhancements } from '../preview-ycoor-design/design/design-enhancements.js';
import { buildFacadeInventory, inventoryToCsv } from '../preview-ycoor-design/design/coverage-model.js';

const require = createRequire(new URL('../preview-ycoor-design/design/package.json', import.meta.url));
const THREE = require('three');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node tools/build-facade-inventory.mjs [--check]');
const folder = new URL('../preview-ycoor-design/design/', import.meta.url);
const data = JSON.parse(await readFile(new URL('../assets/ycoor-dxf.json', folder), 'utf8'));
const evidence = JSON.parse(await readFile(new URL('design-evidence.json', folder), 'utf8'));
const scene = new THREE.Scene();
const local = createLocalBuildings({ THREE, scene, data, originHeight: 1497.1 });
let additions;
try {
  const inventory = buildFacadeInventory({ buildings: local.buildings, faces: local.faces, evidence });
  // The same renderer validates exact triangle support and all explicit dimensions.
  additions = createDesignEnhancements({ THREE, scene, changes: evidence.changes, faces: local.faces, originHeight: 1497.1 });
  const outputs = [
    ['facade-inventory.json', JSON.stringify(inventory, null, 2) + '\n'],
    ['facade-inventory.csv', inventoryToCsv(inventory)],
  ];
  for (const [name, text] of outputs) {
    const url = new URL(name, folder);
    if (check) {
      const actual = await readFile(url, 'utf8').catch(() => null);
      if (actual === null || actual.replaceAll('\r\n', '\n') !== text.replaceAll('\r\n', '\n')) {
        throw new Error(`${name} is stale. Run: python tools/update-ycoor.py`);
      }
    } else await writeFile(url, text, 'utf8');
  }
  console.log(`Facade inventory ${check ? 'is current' : 'built'}: ${inventory.summary.buildingCount} volumes, ${inventory.summary.faceCount} source wall planes, ${inventory.summary.partialFaceCount} partial; full window totals unknown.`);
} finally {
  additions?.dispose(); local.dispose();
}
