import test from 'node:test';import assert from 'node:assert/strict';import {stableHash,generateWindows} from '../window-generator.js';
function wall(){return {key:'7:8',nx:1,nz:0,tx:0,tz:-1,minU:0,maxU:12,minV:0,maxV:12,triangles:[{uv:[{u:0,v:0},{u:12,v:0},{u:0,v:12}],ds:[2,2,2]},{uv:[{u:12,v:12},{u:0,v:12},{u:12,v:0}],ds:[2,2,2]}]}}
test('deterministic estimated windows',()=>{const a=generateWindows([wall()]),b=generateWindows([wall()]);assert.deepEqual(a.windows.map(w=>[w.key,w.u,w.v,w.distance]),b.windows.map(w=>[w.key,w.u,w.v,w.distance]));assert.ok(a.windows.length>0);assert.equal(a.counts.verified,0);assert.ok(a.windows.every(w=>Number.isFinite(w.distance)),'Every estimated window must carry an actual finite facade distance');assert.ok(a.windows.every(w=>w.provenance==='estimated'))});
test('empty geometry and cap',()=>{assert.equal(generateWindows([]).windows.length,0);assert.ok(generateWindows([wall()],{maxWindows:2}).windows.length<=2)});
test('stable hashing',()=>assert.equal(stableHash('a'),stableHash('a')));

test('all generated coordinates are finite for both modes',()=>{
 for(const w of generateWindows([wall()]).windows){
  for(const key of ['u','v','w','h','distance'])assert.ok(Number.isFinite(w[key]),key+' must be finite');
 }
});
