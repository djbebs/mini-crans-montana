import {extractFacades} from './facade-extractor.js';
import {generateWindows} from './window-generator.js';
import {createOverlay} from './facade-renderer.js';
/** Tile-lifecycle manager; no changes to actor meshes or simulation.
 * fail-open: failures remove façade detail, not base buildings.
 */
export function createFacadeLifecycle(THREE,{onStatus=()=>{}}={}){
 let mode='off',epoch=0;const records=new Map();const stats={tiles:0,estimated:0,verified:0,errors:0};
 const report=()=>onStatus({...stats,mode});
 function disposeScene(scene){const record=records.get(scene);if(record){record.dispose?.();records.delete(scene);stats.tiles=records.size;report()}}
 function reset(){epoch++;for(const scene of [...records.keys()])disposeScene(scene);stats.estimated=0;stats.verified=0;stats.errors=0;report()}
 async function load(scene){
  if(!scene||mode==='off'||records.has(scene))return;
  const token=epoch;records.set(scene,{dispose:null});
  // Yield until the tiles renderer has mounted the model and settled transforms.
  await new Promise(resolve=>setTimeout(resolve,0));
  if(token!==epoch||mode==='off'||!records.has(scene))return;
  try{
   const {groups}=extractFacades(THREE,scene);
   const {windows}=generateWindows(groups);
   if(token!==epoch||mode==='off'||!records.has(scene))return;
   const handle=createOverlay(THREE,scene,windows);
   records.set(scene,handle);
   stats.tiles=records.size;stats.estimated+=windows.length;
  }catch(error){stats.errors++;records.delete(scene);console.warn('P0.6.8 façade skipped',error)}
  report();
 }
 function setMode(next){if(!['off','procedural','hybrid'].includes(next))return;mode=next;reset()}
 return {load,disposeScene,reset,setMode,get mode(){return mode},get stats(){return {...stats}}};
}
