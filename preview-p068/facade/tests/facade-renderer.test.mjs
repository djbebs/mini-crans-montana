import test from 'node:test';
import assert from 'node:assert/strict';
import {hasFinitePlacement} from '../facade-renderer.js';
const g={nx:1,nz:0,tx:0,tz:-1};
test('renderer only accepts valid finite placements',()=>{
 assert.equal(hasFinitePlacement({u:3,v:4,w:1,h:1,distance:12,group:g}),true);
 assert.equal(hasFinitePlacement({u:3,v:4,w:1,h:1,group:g}),false);
 assert.equal(hasFinitePlacement({u:3,v:4,w:1,h:1,distance:NaN,group:g}),false);
 assert.equal(hasFinitePlacement({u:3,v:4,w:-1,h:1,distance:12,group:g}),false);
});
