/** Geometry-only façade extraction. Called once per loaded tile, never once per animation frame.
 * THREE and each mesh are supplied explicitly; testable with real BufferGeometry.
 */
import {CONFIG} from './facade-config.js';
export function pointInTriangle2D(p,a,b,c){
 const cross=(a,b,p)=>(b.u-a.u)*(p.v-a.v)-(b.v-a.v)*(p.u-a.u);
 const x=cross(a,b,p),y=cross(b,c,p),z=cross(c,a,p);
 return (x>=-1e-6&&y>=-1e-6&&z>=-1e-6)||(x<=1e-6&&y<=1e-6&&z<=1e-6);
}
export function surfaceDistance(group,u,v){
 for(const t of group.triangles){
  const [a,b,c]=t.uv,den=(b.v-c.v)*(a.u-c.u)+(c.u-b.u)*(a.v-c.v);
  if(Math.abs(den)<1e-9)continue;
  const p=(b.v-c.v)*(u-c.u)+(c.u-b.u)*(v-c.v);
  const q=(c.v-a.v)*(u-c.u)+(a.u-c.u)*(v-c.v);
  const alpha=p/den,beta=q/den,gamma=1-alpha-beta;
  if(alpha>=-1e-6&&beta>=-1e-6&&gamma>=-1e-6)
   return alpha*t.ds[0]+beta*t.ds[1]+gamma*t.ds[2];
 }
 return null;
}
export function wallContains(group,u,v,pad=0){
 const sample=(x,y)=>group.triangles.some(t=>pointInTriangle2D({u:x,v:y},...t.uv));
 return sample(u,v)&&sample(u-pad,v-pad)&&sample(u+pad,v-pad)&&
 sample(u-pad,v+pad)&&sample(u+pad,v+pad);
}
export function extractFacades(THREE,tileScene,options={}){
 const cfg={...CONFIG,...options},groups=new Map(),reasons={triangles:0,ignored:0,overflow:0};
 if(!tileScene)return {groups:[],reasons:{error:'no-tile'}};
 tileScene.updateMatrixWorld(true);
 const p0=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3();
 const a=new THREE.Vector3(),b=new THREE.Vector3(),normal=new THREE.Vector3(),centroid=new THREE.Vector3();
 const localOrigin=new THREE.Vector3();
 tileScene.traverse(object=>{
  if(!object.isMesh||!object.geometry?.getAttribute)return;
  const geometry=object.geometry,attr=geometry.getAttribute('position'),index=geometry.index;
  if(!attr||attr.itemSize!==3)return;
  const total=index?Math.floor(index.count/3):Math.floor(attr.count/3);
  const limit=Math.min(total,Math.max(0,cfg.maxTrianglesPerTile-reasons.triangles));
  reasons.overflow+=total-limit;
  for(let i=0;i<limit;i++){
   const ix=j=>index?index.getX(i*3+j):i*3+j;
   p0.fromBufferAttribute(attr,ix(0)).applyMatrix4(object.matrixWorld);
   p1.fromBufferAttribute(attr,ix(1)).applyMatrix4(object.matrixWorld);
   p2.fromBufferAttribute(attr,ix(2)).applyMatrix4(object.matrixWorld);
   reasons.triangles++;
   a.subVectors(p1,p0);b.subVectors(p2,p0);normal.crossVectors(a,b);
   const doubledArea=normal.length();
   if(!Number.isFinite(doubledArea)||doubledArea<cfg.minimumTriangleArea*2){reasons.ignored++;continue}
   normal.multiplyScalar(1/doubledArea);
   if(Math.abs(normal.y)>cfg.verticalNormalTolerance){reasons.ignored++;continue}
   centroid.copy(p0).add(p1).add(p2).multiplyScalar(1/3);
   if(Math.abs(centroid.x)>cfg.boundsHalfSize+5||Math.abs(centroid.z)>cfg.boundsHalfSize+5){reasons.ignored++;continue}
   const h=Math.hypot(normal.x,normal.z);
   if(h<0.001)continue;
   // Normal orientation is taken from mesh winding; unknown winding is not assumed verified.
   let nx=normal.x/h,nz=normal.z/h;
   const angle=Math.atan2(nz,nx),bin=((Math.round(angle/(Math.PI*2)*cfg.angleBins)%cfg.angleBins)+cfg.angleBins)%cfg.angleBins;
   const distance=(centroid.x*nx+centroid.z*nz);
   const plane=Math.round(distance/cfg.planeQuantization);
   const key=bin+':'+plane;
   let g=groups.get(key);
   if(!g){
    if(groups.size>=cfg.maxWallGroups)continue;
    g={key,nx,nz,tx:nz,tz:-nx,planeDistance:distance,triangles:[],area:0,
      minU:Infinity,maxU:-Infinity,minV:Infinity,maxV:-Infinity};
    groups.set(key,g);
   }
   const pts=[p0,p1,p2].map(p=>({u:p.x*g.tx+p.z*g.tz,v:p.y}));
   const us=pts.map(v=>v.u),vs=pts.map(v=>v.v);
   g.triangles.push({uv:pts,ds:[p0,p1,p2].map(p=>p.x*g.nx+p.z*g.nz)});
   g.area+=doubledArea*.5;
   g.minU=Math.min(g.minU,...us);g.maxU=Math.max(g.maxU,...us);
   g.minV=Math.min(g.minV,...vs);g.maxV=Math.max(g.maxV,...vs);
  }
 });
 const result=[...groups.values()].filter(g=>g.area>=cfg.minimumWallArea&&g.maxV-g.minV>=cfg.minimumWallHeight);
 return {groups:result,reasons};
}
