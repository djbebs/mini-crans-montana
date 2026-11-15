import {CONFIG,STYLES} from './facade-config.js';
import {wallContains,surfaceDistance} from './facade-extractor.js';
export function stableHash(input){let h=2166136261;for(const c of String(input)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function chooseStyle(group){const n=stableHash(group.key);return Object.keys(STYLES)[n%4]}
export function generateWindows(groups,{maxWindows=CONFIG.maxWindowsPerTile,overrides={}}={}){
 const windows=[],count={estimated:0,verified:0,rejected:0};
 for(const g of groups){
  const styleName=chooseStyle(g),style=STYLES[styleName],w=style.width,h=style.height;
  const uStart=Math.ceil((g.minU+CONFIG.edgeClearance)/CONFIG.columnPitch)*CONFIG.columnPitch;
  const vStart=Math.ceil((g.minV+CONFIG.sillOffset)/CONFIG.rowPitch)*CONFIG.rowPitch;
  const local=[];
  for(let v=vStart;v+h<g.maxV-CONFIG.edgeClearance;v+=CONFIG.rowPitch){
   for(let u=uStart;u+w<g.maxU-CONFIG.edgeClearance;u+=CONFIG.columnPitch){
    if(windows.length+local.length>=maxWindows)break;
    const cu=u+w/2,cv=v+h/2;
    if(!wallContains(g,cu,cv,Math.max(w,h)*.49)){count.rejected++;continue}
    const dist=surfaceDistance(g,cu,cv);if(!Number.isFinite(dist)){count.rejected++;continue}
    const tileKey=g.key+':'+Math.round(u*100)+':'+Math.round(v*100);
    const override=overrides[tileKey];
    // Overrides remain disabled unless a source-reviewed registration explicitly marks them verified.
    if(override?.status==='verified'){
     local.push({u:cu,v:cv,w:override.width||w,h:override.height||h,group:g,distance:dist,key:tileKey,style:styleName,provenance:'verified'});
     count.verified++;
    }else{
     local.push({u:cu,v:cv,w,h,group:g,distance:dist,key:tileKey,style:styleName,provenance:'estimated'});
     count.estimated++;
    }
   }
   if(windows.length+local.length>=maxWindows)break;
  }
  windows.push(...local);
  if(windows.length>=maxWindows)break;
 }
 return {windows,counts:count};
}
