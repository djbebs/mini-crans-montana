import {extractFacades} from './facade-extractor.js';
import {generateWindows} from './window-generator.js?v=068b';
import {createOverlay} from './facade-renderer.js?v=068b';
/** A fail-open visual layer: never changes source buildings, people or collisions. */
export function createFacadeLifecycle(THREE,{onStatus=()=>{}}={}){
 let mode='off',contrast=false,epoch=0,errors=0,lastError='';
 const records=new Map();
 const snapshot=()=>{
  const sum={tiles:records.size,triangles:0,facades:0,generated:0,rejected:0,rendered:0,
   invalid:0,estimated:0,verified:0,errors,lastError,mode,contrast};
  for(const r of records.values()){
   if(!r.stats)continue;
   for(const k of ['triangles','facades','generated','rejected','rendered','invalid','estimated','verified'])
    sum[k]+=r.stats[k]||0;
  }
  return sum;
 };
 const report=()=>onStatus(snapshot());
 function disposeScene(scene){
  const record=records.get(scene);if(!record)return;
  records.delete(scene);
  try{record.handle?.dispose()}catch(e){console.warn('Facade disposal',e)}
  report();
 }
 function reset(){
  epoch++;
  for(const scene of [...records.keys()])disposeScene(scene);
  errors=0;lastError='';
  report();
 }
 async function load(scene){
  if(!scene||mode==='off'||records.has(scene))return;
  const token=epoch,record={handle:null,stats:null};
  records.set(scene,record);report();
  // The renderer must finish attaching the tile to the transformed world.
  await new Promise(resolve=>setTimeout(resolve,0));
  if(token!==epoch||mode==='off'||records.get(scene)!==record)return;
  try{
   const {groups,reasons}=extractFacades(THREE,scene);
   const {windows,counts}=generateWindows(groups);
   if(token!==epoch||mode==='off'||records.get(scene)!==record)return;
   const handle=createOverlay(THREE,scene,windows,{contrast});
   if(token!==epoch||mode==='off'||records.get(scene)!==record){
    handle.dispose();return;
   }
   record.handle=handle;
   record.stats={
    triangles:reasons.triangles||0,
    facades:groups.length,
    generated:windows.length,
    rejected:counts.rejected,
    rendered:handle.rendered,
    invalid:handle.invalid,
    estimated:counts.estimated,
    verified:counts.verified
   };
  }catch(error){
   errors++;lastError=String(error?.message||error).slice(0,180);
   records.delete(scene);
   console.warn('P0.6.8 façade skipped without modifying buildings',error);
  }
  report();
 }
 function setMode(value){
  if(!['off','procedural','hybrid'].includes(value))return;
  mode=value;reset();
 }
 function setContrast(value){contrast=!!value;reset()}
 return {load,disposeScene,reset,setMode,setContrast,
  get mode(){return mode},get contrast(){return contrast},get stats(){return snapshot()}
 };
}
