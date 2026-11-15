import test from 'node:test';import assert from 'node:assert/strict';import {createFacadeLifecycle} from '../facade-lifecycle.js';
test('off by default and reversible',()=>{const manager=createFacadeLifecycle({},{});assert.equal(manager.mode,'off');manager.setMode('procedural');assert.equal(manager.mode,'procedural');manager.setMode('off');assert.deepEqual(manager.stats,{tiles:0,estimated:0,verified:0,errors:0})});
test('invalid modes ignored',()=>{const f=createFacadeLifecycle({});f.setMode('unexpected');assert.equal(f.mode,'off')});
