import {CONFIG,STYLES} from './facade-config.js';
/** Render simple reversible flat panels. Never modifies building, animation or collider meshes. */
export function createOverlay(THREE,tileScene,windows){
 const overlay=new THREE.Group();overlay.name='P0.6.8 experimental windows (estimated)';
 const inverse=tileScene.matrixWorld.clone().invert(),point=new THREE.Vector3(),matrix=new THREE.Matrix4();
 const geom=new THREE.PlaneGeometry(1,1),outlineGeom=new THREE.PlaneGeometry(1,1);
 const created=[];
 for(const name of Object.keys(STYLES)){
  const items=windows.filter(w=>w.style===name);
  if(!items.length)continue;
  const s=STYLES[name],glass=new THREE.MeshBasicMaterial({color:s.glass,side:THREE.DoubleSide,depthWrite:true});
  const trim=new THREE.MeshBasicMaterial({color:s.frame,side:THREE.DoubleSide,depthWrite:true});
  const frame=new THREE.InstancedMesh(outlineGeom,trim,items.length);
  const panes=new THREE.InstancedMesh(geom,glass,items.length);
  frame.frustumCulled=false;panes.frustumCulled=false;
  for(let i=0;i<items.length;i++){
   const w=items[i],g=w.group;
   // Tangent is local horizontal U; wall normal is local outward Z.
   const basis=new THREE.Matrix4().makeBasis(
    new THREE.Vector3(g.tx,0,g.tz),new THREE.Vector3(0,1,0),new THREE.Vector3(g.nx,0,g.nz));
   const q=new THREE.Quaternion().setFromRotationMatrix(basis);
   const make=(offset,width,height)=>{
    const dist=w.distance+offset;
    point.set(g.tx*w.u+g.nx*dist,w.v,g.tz*w.u+g.nz*dist).applyMatrix4(inverse);
    // world-space orientation must be converted to tileScene-local frame
    const rot=tileScene.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q.clone());
    matrix.compose(point,rot,new THREE.Vector3(width,height,1));
    return matrix;
   };
   frame.setMatrixAt(i,make(CONFIG.surfaceOffset,w.w+.13,w.h+.13));
   panes.setMatrixAt(i,make(CONFIG.surfaceOffset+.007,w.w,w.h));
  }
  frame.instanceMatrix.needsUpdate=true;panes.instanceMatrix.needsUpdate=true;
  overlay.add(frame,panes);created.push({geom,outlineGeom,glass,trim});
 }
 tileScene.add(overlay);
 return {overlay,dispose(){
  overlay.removeFromParent();
  overlay.traverse(o=>{if(o.isMesh)o.dispose?.()});
  for(const m of created){m.glass.dispose();m.trim.dispose()}
  // Shared geometries exclusively owned by this overlay
  geom.dispose();outlineGeom.dispose();
 }};
}
