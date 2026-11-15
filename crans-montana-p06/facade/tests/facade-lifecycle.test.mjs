import test from 'node:test';import assert from 'node:assert/strict';import {createFacadeLifecycle} from '../facade-lifecycle.js';
test('off by default and reversible',()=>{const manager=createFacadeLifecycle({},{});assert.equal(manager.mode,'off');manager.setMode('procedural');assert.equal(manager.mode,'procedural');manager.setMode('off');assert.equal(manager.stats.tiles,0);assert.equal(manager.stats.rendered,0);assert.equal(manager.stats.invalid,0)});
test('invalid modes ignored',()=>{const f=createFacadeLifecycle({});f.setMode('unexpected');assert.equal(f.mode,'off')});

test('contrast reset never enables windows while mode is off',()=>{
 const f=createFacadeLifecycle({});f.setContrast(true);assert.equal(f.mode,'off');assert.equal(f.contrast,true);
 assert.equal(f.stats.rendered,0);
});
