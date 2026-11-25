import test from 'node:test';import assert from 'node:assert/strict';
import {pointInTriangle2D,wallContains,surfaceDistance} from '../facade-extractor.js';
const group={triangles:[{uv:[{u:0,v:0},{u:5,v:0},{u:0,v:5}],ds:[3,3,3]}]};
test('triangle inclusion and exclusion',()=>{assert.equal(pointInTriangle2D({u:1,v:1},...group.triangles[0].uv),true);assert.equal(pointInTriangle2D({u:4,v:4},...group.triangles[0].uv),false)});
test('window corners require a valid wall',()=>{assert.equal(wallContains(group,1,1,.2),true);assert.equal(wallContains(group,4,4,.2),false);assert.equal(wallContains(group,2.4,2.4,.2),false)});
test('surface interpolation and outside rejection',()=>{assert.equal(surfaceDistance(group,1,1),3);assert.equal(surfaceDistance(group,5,5),null)});
