// Preview-only draping of official cadastral footprints. Nesting parity is
// shared with the stable renderer; the stable rendering code stays untouched.
import { shapeNesting } from '../../crans-montana-p06/cadastre-mesh.js';

const EPS=1e-9;
const LEGACY_BOUNDS={minX:-50,maxX:50,minZ:-50,maxZ:50};
const OFFSETS={ground:.012,misc:.024,line:.035};
const cachedMaterials=new WeakMap();
const samePoint=(a,b)=>Math.abs(a.x-b.x)<EPS&&Math.abs(a.z-b.z)<EPS;

function clipHalfPlane(input,distance) {
  const output=[];
  const append=p=>{if(!output.length||!samePoint(output.at(-1),p))output.push(p);};
  for(let i=0;i<input.length;i++) {
    const a=input[i],b=input[(i+1)%input.length],da=distance(a),db=distance(b);
    const insideA=da>=-EPS,insideB=db>=-EPS;
    if(insideA!==insideB) {
      const t=da/(da-db);
      append({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
    }
    if(insideB)append(b);
  }
  if(output.length>1&&samePoint(output[0],output.at(-1)))output.pop();
  return output;
}

function clipBounds(polygon,bounds) {
  let result=polygon;
  for(const distance of [p=>p.x-bounds.minX,p=>bounds.maxX-p.x,p=>p.z-bounds.minZ,p=>bounds.maxZ-p.z]) {
    result=clipHalfPlane(result,distance);
    if(result.length<3)return [];
  }
  return result;
}

function drawingBounds(options) {
  const model=options.terrainModel;
  const measured=model?{minX:model.xs[0],maxX:model.xs.at(-1),minZ:model.zs[0],maxZ:model.zs.at(-1)}:LEGACY_BOUNDS;
  const requested=options.bounds??measured;
  return {minX:Math.max(measured.minX,requested.minX),maxX:Math.min(measured.maxX,requested.maxX),minZ:Math.max(measured.minZ,requested.minZ),maxZ:Math.min(measured.maxZ,requested.maxZ)};
}

function cellIndex(axis,value) {
  let lo=0,hi=axis.length-1;
  while(hi-lo>1) {
    const mid=(lo+hi)>>1;
    if(value<axis[mid])hi=mid;else lo=mid;
  }
  return Math.min(axis.length-2,lo);
}

function createDraper(height,options) {
  const {terrainModel:model,offset=OFFSETS.ground,maxEdge=1}=options;
  if(model) {
    for(const axis of [model.xs,model.zs])if(!Array.isArray(axis)||axis.length<2||axis.some((v,i)=>!Number.isFinite(v)||(i>0&&v<=axis[i-1])))throw new TypeError('Terrain axes must be finite and strictly increasing');
    if(model.diagonal&&model.diagonal!=='00-11')throw new TypeError('Unsupported terrain diagonal');
  }
  if(!Number.isFinite(offset)||!(maxEdge>0))throw new TypeError('Invalid ground draping options');
  const bounds=drawingBounds(options),vertices=[];
  const emit=(a,b,c)=>{
    const area=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
    if(Math.abs(area)<1e-10)return;
    // Clockwise in XZ gives upward-facing normals in XYZ.
    for(const p of area>0?[a,c,b]:[a,b,c])vertices.push(p.x,height(p.x,p.z)+offset,p.z);
  };
  const fan=polygon=>{for(let i=1;i<polygon.length-1;i++)emit(polygon[0],polygon[i],polygon[i+1]);};
  const subdivide=(a,b,c)=>{
    const longest=Math.max(Math.hypot(a.x-b.x,a.z-b.z),Math.hypot(b.x-c.x,b.z-c.z),Math.hypot(c.x-a.x,c.z-a.z));
    const count=Math.max(1,Math.ceil(longest/maxEdge));
    const point=(i,j)=>({x:a.x+(b.x-a.x)*i/count+(c.x-a.x)*j/count,z:a.z+(b.z-a.z)*i/count+(c.z-a.z)*j/count});
    for(let i=0;i<count;i++)for(let j=0;j<count-i;j++) {
      const A=point(i,j),B=point(i+1,j),C=point(i,j+1);
      emit(A,B,C);
      if(i+j+1<count)emit(B,point(i+1,j+1),C);
    }
  };
  const add=triangle=>{
    const polygon=clipBounds(triangle,bounds);
    if(polygon.length<3)return;
    if(!model) {
      for(let i=1;i<polygon.length-1;i++)subdivide(polygon[0],polygon[i],polygon[i+1]);
      return;
    }
    const {xs,zs}=model;
    const minI=cellIndex(xs,Math.min(...polygon.map(p=>p.x))),maxI=cellIndex(xs,Math.max(...polygon.map(p=>p.x)));
    const minJ=cellIndex(zs,Math.min(...polygon.map(p=>p.z))),maxJ=cellIndex(zs,Math.max(...polygon.map(p=>p.z)));
    for(let j=minJ;j<=maxJ;j++)for(let i=minI;i<=maxI;i++) {
      const minX=xs[i],maxX=xs[i+1],minZ=zs[j],maxZ=zs[j+1];
      const cell=clipBounds(polygon,{minX,maxX,minZ,maxZ});
      if(cell.length<3)continue;
      // Match the terrain's actual 00–11 diagonal. Each emitted polygon lies
      // on one terrain plane, including its edges and interior, not just its
      // sampled corners. Source triangles already exclude holes and notches.
      const diagonal=p=>(p.z-minZ)*(maxX-minX)-(p.x-minX)*(maxZ-minZ);
      fan(clipHalfPlane(cell,diagonal));
      fan(clipHalfPlane(cell,p=>-diagonal(p)));
    }
  };
  return {add,geometry(THREE) {
    if(!vertices.length)return null;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();
    return geometry;
  }};
}

export function triangulateOfficialPolygon(THREE,rings,height,options={}) {
  const draper=createDraper(height,options),nested=shapeNesting(rings);
  for(let i=0;i<nested.length;i++) {
    const item=nested[i];
    if(item.depth%2)continue;
    const contour=item.ring.map(p=>new THREE.Vector2(p.x,p.z));
    const holes=nested.filter(hole=>hole.parent===i&&hole.depth===item.depth+1).map(hole=>hole.ring.map(p=>new THREE.Vector2(p.x,p.z)));
    const points=[...contour,...holes.flat()];
    for(const triangle of THREE.ShapeUtils.triangulateShape(contour,holes))draper.add(triangle.map(index=>({x:points[index].x,z:points[index].y})));
  }
  return draper.geometry(THREE);
}

function drapedLine(THREE,points,width,height,options) {
  const draper=createDraper(height,{...options,offset:OFFSETS.line});
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    if(length<EPS)continue;
    // Display width is a symbol for an official line, never a road width.
    const px=-dz/length*width/2,pz=dx/length*width/2;
    const A={x:a.x+px,z:a.z+pz},B={x:a.x-px,z:a.z-pz},C={x:b.x+px,z:b.z+pz},D={x:b.x-px,z:b.z-pz};
    draper.add([A,B,C]);draper.add([B,D,C]);
  }
  return draper.geometry(THREE);
}

export function renderMOFeatures(THREE,features,height,parent,objectArray,lineGeom,options={}) {
  const drawn=[];
  if(!cachedMaterials.has(THREE))cachedMaterials.set(THREE,new Map());
  const cache=cachedMaterials.get(THREE);
  const material=(color,order)=>{
    const key=`${color}:${order}`;
    if(!cache.has(key))cache.set(key,new THREE.MeshLambertMaterial({color,flatShading:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-order,polygonOffsetUnits:-order}));
    return cache.get(key);
  };
  const attach=(geometry,feature,order)=>{
    if(!geometry)return false;
    const mesh=new THREE.Mesh(geometry,material(feature.color,order));
    mesh.receiveShadow=true;mesh.castShadow=false;mesh.renderOrder=order;
    mesh.userData={title:'Mensuration officielle : '+feature.label,desc:'État du Valais, couche '+feature.layer+', OBJECTID '+feature.objectID+'. Contours cadastraux officiels. Couleurs et représentation de terrain illustratives, non certifiées juridiquement.'};
    parent.add(mesh);objectArray.push(mesh);
    return true;
  };
  const surfaces=features.filter(f=>f.geometry.rings).sort((a,b)=>Number(a.layer===190)-Number(b.layer===190)||a.layer-b.layer);
  for(const feature of surfaces) {
    const order=feature.layer===190?2:1;
    const geometry=triangulateOfficialPolygon(THREE,feature.geometry.rings,height,{...options,offset:order===2?OFFSETS.misc:OFFSETS.ground});
    if(attach(geometry,feature,order))drawn.push({id:feature.objectID,layer:feature.layer,genre:feature.genre});
  }
  for(const feature of features.filter(f=>f.geometry.paths))for(const points of feature.geometry.paths) {
    if(points.length<2)continue;
    if(options.terrainModel||typeof lineGeom!=='function') {
      if(!attach(drapedLine(THREE,points,feature.displayWidth||1.2,height,options),feature,3))continue;
    } else lineGeom(points,feature.displayWidth||1.2,material(feature.color,3),OFFSETS.line,parent);
    drawn.push({id:feature.objectID,layer:feature.layer,genre:feature.genre});
  }
  return drawn;
}
