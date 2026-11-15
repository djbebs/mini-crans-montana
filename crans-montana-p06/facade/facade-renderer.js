import {CONFIG,STYLES} from './facade-config.js';
/** Visual-only P0.6.8 overlay. Never modifies original building/actor/collision meshes. */
export function hasFinitePlacement(w){
 const g=w?.group;
 return !!g&&[w.u,w.v,w.w,w.h,w.distance,g.tx,g.tz,g.nx,g.nz]
  .every(Number.isFinite)&&w.w>0&&w.h>0;
}
export function createOverlay(THREE,tileScene,windows,{contrast=false}={}){
 tileScene.updateMatrixWorld(true);
 const overlay=new THREE.Group();
 overlay.name='P0.6.8 estimated window overlay';
 const inverse=tileScene.matrixWorld.clone().invert();
 const geom=new THREE.PlaneGeometry(1,1);
 const created=[],valid=windows.filter(hasFinitePlacement);
 let rendered=0,invalid=windows.length-valid.length;
 for(const styleName of Object.keys(STYLES)){
  const items=valid.filter(w=>w.style===styleName);
  if(!items.length)continue;
  const s=STYLES[styleName];
  const glass=new THREE.MeshBasicMaterial({
   color:contrast?0xff00ff:s.glass,side:THREE.DoubleSide,depthWrite:true
  });
  const trim=new THREE.MeshBasicMaterial({
   color:contrast?0xffff00:s.frame,side:THREE.DoubleSide,depthWrite:true
  });
  const frame=new THREE.InstancedMesh(geom,trim,items.length);
  const panes=new THREE.InstancedMesh(geom,glass,items.length);
  frame.frustumCulled=false;panes.frustumCulled=false;
  let n=0;
  for(const w of items){
   const g=w.group;
   const orientation=new THREE.Matrix4().makeBasis(
    new THREE.Vector3(g.tx,0,g.tz),new THREE.Vector3(0,1,0),new THREE.Vector3(g.nx,0,g.nz)
   );
   const quaternion=new THREE.Quaternion().setFromRotationMatrix(orientation);
   const place=(offset,width,height)=>{
    const dist=w.distance+offset;
    const p=new THREE.Vector3(g.tx*w.u+g.nx*dist,w.v,g.tz*w.u+g.nz*dist);
    const world=new THREE.Matrix4().compose(p,quaternion,new THREE.Vector3(width,height,1));
    return new THREE.Matrix4().multiplyMatrices(inverse,world);
   };
   const outline=place(contrast?0.10:CONFIG.surfaceOffset,w.w+.14,w.h+.14);
   const pane=place(contrast?0.12:CONFIG.surfaceOffset+.008,w.w,w.h);
   if(!outline.elements.every(Number.isFinite)||!pane.elements.every(Number.isFinite)){
    invalid++;continue;
   }
   frame.setMatrixAt(n,outline);
   panes.setMatrixAt(n,pane);
   n++;rendered++;
  }
  frame.count=n;panes.count=n;
  frame.instanceMatrix.needsUpdate=true;
  panes.instanceMatrix.needsUpdate=true;
  overlay.add(frame,panes);
  created.push({glass,trim});
 }
 tileScene.add(overlay);
 return {overlay,rendered,invalid,
  dispose(){
   overlay.removeFromParent();
   for(const c of created){c.glass.dispose();c.trim.dispose();}
   geom.dispose();
  }
 };
}
