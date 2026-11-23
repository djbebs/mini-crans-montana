/**
 * Explicit evidence façade layer. Dimensions are visual estimates, in metres.
 * No repetitions, inferred façades, floor counts, or automatic trim are authored here.
 *
 * Ready records on unknown/mismatched faces are skipped. Malformed ready records
 * on resolved faces throw before scene attachment or GPU resource allocation.
 * Used face triangles are checked for overlap > 1e-6 m² before allocation.
 * They must form a non-overlapping tessellation (holes are supported).
 * Flat detail depth + offset must be <= .08 m; offset defaults to .003 m.
 * Window frame: {width,color}, wholly inside the requested rectangle.
 * Balcony rails: explicit [{u,v,width,height,depth,offset,color}], u/v relative
 * to the detail centre, offset measured out from the face. No rail repetition.
 * Optional floor: {height,color}, at the bottom of the balcony rectangle.
 * pick callback receives {source,changeId,detailId,buildingId,faceId}.
 */
const KINDS = new Set(['window','shutter','door','panel','beam','trim','balcony']);
const EPSILON = 1e-7;
const OVERLAP_AREA_TOLERANCE = 1e-6;

function fail(context, message) { throw new Error(`Design detail ${context}: ${message}`); }
function finite(value, name, context) {
  if (!Number.isFinite(value)) fail(context, `${name} must be finite`);
  return value;
}
function positive(value, name, context) {
  finite(value,name,context);
  if (value <= 0) fail(context,`${name} must be positive`);
  return value;
}
function color(value, context) {
  if (!(typeof value === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value)) &&
      !(Number.isInteger(value) && value >= 0 && value <= 0xffffff)) {
    fail(context,'color must be a hexadecimal palette color');
  }
  return value;
}
function vector(value, name, context) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) fail(context,`${name} must be a finite 3-vector`);
}
function validateFace(face, context) {
  for (const name of ['origin','u','v','normal']) vector(face[name],name,context);
  if (Math.abs(face.origin[1]) > EPSILON || Math.abs(face.u[1]) > EPSILON || Math.abs(face.normal[1]) > EPSILON ||
      face.v.some((n,i)=>Math.abs(n-[0,1,0][i])>EPSILON)) fail(context,'face must have horizontal u/normal and absolute vertical v');
  const length = axis=>Math.hypot(...axis);
  if (Math.abs(length(face.u)-1)>EPSILON || Math.abs(length(face.normal)-1)>EPSILON ||
      Math.abs(face.u[0]*face.normal[0]+face.u[2]*face.normal[2])>EPSILON) fail(context,'face axes must be orthonormal');
  if (!Array.isArray(face.triangles) || !face.triangles.length) fail(context,'face triangles are required');
  for (const triangle of face.triangles) {
    if (!Array.isArray(triangle) || triangle.length!==3 || triangle.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)) || area(triangle)<=EPSILON) {
      fail(context,'face triangles must be finite and nondegenerate');
    }
  }
  for (let i=0;i<face.triangles.length;i++) {
    for (let j=i+1;j<face.triangles.length;j++) {
      if (triangleIntersectionArea(face.triangles[i],face.triangles[j])>OVERLAP_AREA_TOLERANCE) {
        fail(context,`face ${face.id} triangles ${i}/${j} overlap by more than 1e-6 m²`);
      }
    }
  }
}
function area(polygon) {
  if (polygon.length < 3) return 0;
  const [x,y] = polygon[0];
  let sum = 0;
  for (let i=1;i<polygon.length-1;i++) sum += (polygon[i][0]-x)*(polygon[i+1][1]-y)-(polygon[i][1]-y)*(polygon[i+1][0]-x);
  return Math.abs(sum)/2;
}
function triangleIntersectionArea(first, second) {
  // Convex Sutherland–Hodgman clipping, independent of either triangle's winding.
  const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const direction=Math.sign(cross(second[0],second[1],second[2]));
  let polygon=first;
  for (let edge=0;edge<3 && polygon.length;edge++) {
    const a=second[edge],b=second[(edge+1)%3],clipped=[];
    for (let i=0;i<polygon.length;i++) {
      const p=polygon[i],q=polygon[(i+1)%polygon.length];
      const sideP=cross(a,b,p)*direction,sideQ=cross(a,b,q)*direction;
      const insideP=sideP>=0,insideQ=sideQ>=0;
      if (insideP) clipped.push(p);
      if (insideP!==insideQ) {
        const t=sideP/(sideP-sideQ);
        clipped.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);
      }
    }
    polygon=clipped;
  }
  return area(polygon);
}
function clipAxis(polygon, axis, limit, greater) {
  const result = [];
  for (let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const insideA=greater?a[axis]>=limit:a[axis]<=limit;
    const insideB=greater?b[axis]>=limit:b[axis]<=limit;
    if (insideA) result.push(a);
    if (insideA!==insideB) {
      const t=(limit-a[axis])/(b[axis]-a[axis]);
      const p=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
      p[axis]=limit; result.push(p);
    }
  }
  return result;
}
function pointInTriangle(point, triangle) {
  const sides = triangle.map((a,i)=>{
    const b=triangle[(i+1)%3];
    return (b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);
  });
  return sides.every(n=>n>=-EPSILON)||sides.every(n=>n<=EPSILON);
}
function validateFootprint(detail, face, context) {
  const left=detail.u-detail.width/2,right=detail.u+detail.width/2;
  const bottom=detail.v-detail.height/2,top=detail.v+detail.height/2;
  const corners=[[left,bottom],[right,bottom],[right,top],[left,top]];
  let covered=0;
  for (const triangle of face.triangles) {
    let polygon=triangle;
    for (const [axis,limit,greater] of [[0,left,true],[0,right,false],[1,bottom,true],[1,top,false]]) {
      polygon=clipAxis(polygon,axis,limit,greater);
      if (!polygon.length) break;
    }
    covered+=area(polygon);
  }
  if (corners.some(p=>!face.triangles.some(t=>pointInTriangle(p,t))) ||
      Math.abs(covered-detail.width*detail.height)>Math.max(EPSILON,detail.width*detail.height*1e-8)) {
    fail(context,'rectangle lies outside the supported face triangle union');
  }
}
function flatParts(detail, context) {
  const depth=positive(detail.depth??0.02,'depth',context);
  const offset=finite(detail.offset??0.003,'offset',context);
  if (offset<0 || offset+depth>0.08+EPSILON) fail(context,'flat depth + offset must be within 0.08 m');
  const base={u:0,v:0,width:detail.width,height:detail.height,depth,offset,color:detail.color};
  if (detail.frame!==undefined) {
    if (detail.kind!=='window' || !detail.frame || typeof detail.frame!=='object') fail(context,'frame is supported only on windows');
    const thickness=positive(detail.frame.width,'frame.width',context);
    const frameColor=color(detail.frame.color,context);
    if (thickness*2>=Math.min(detail.width,detail.height)) fail(context,'frame.width leaves no pane');
    return [
      {...base,width:detail.width-2*thickness,height:detail.height-2*thickness},
      ...[-1,1].map(sign=>({...base,v:sign*(detail.height-thickness)/2,height:thickness,color:frameColor})),
      ...[-1,1].map(sign=>({...base,u:sign*(detail.width-thickness)/2,width:thickness,height:detail.height-2*thickness,color:frameColor})),
    ];
  }
  return [base];
}
function balconyParts(detail, context) {
  positive(detail.depth,'balcony depth',context);
  if (!Array.isArray(detail.rails)) fail(context,'balcony requires an explicit rails array');
  const parts=detail.rails.map((rail,index)=>{
    const label=`${context} rail ${index}`;
    if (!rail || typeof rail!=='object') fail(label,'rail must be an object');
    const part={...rail};
    for (const name of ['u','v','offset']) finite(part[name],name,label);
    for (const name of ['width','height','depth']) positive(part[name],name,label);
    color(part.color,label);
    if (Math.abs(part.u)+part.width/2>detail.width/2+EPSILON || Math.abs(part.v)+part.height/2>detail.height/2+EPSILON ||
        part.offset<0 || part.offset+part.depth>detail.depth+EPSILON) fail(label,'rail exceeds explicit balcony bounds');
    return part;
  });
  if (detail.floor!==undefined) {
    if (!detail.floor || typeof detail.floor!=='object') fail(context,'floor must be an object');
    const height=positive(detail.floor.height,'floor.height',context);
    if (height>detail.height) fail(context,'floor.height exceeds balcony height');
    parts.push({u:0,v:-detail.height/2+height/2,width:detail.width,height,depth:detail.depth,offset:0,color:color(detail.floor.color,context)});
  }
  if (!parts.length) fail(context,'balcony needs at least one explicit rail or floor');
  return parts;
}

export function createDesignEnhancements({THREE,scene,changes=[],faces=[],originHeight=0,onSelect}={}) {
  finite(originHeight,'originHeight','layer');
  if (!THREE || !scene?.add) throw new Error('Design layer requires THREE and a scene');
  if (!Array.isArray(changes)||!Array.isArray(faces)) throw new Error('Design changes and faces must be arrays');
  // Complete the entire validation pass before allocating any Three resources.
  const faceById=new Map(faces.map(face=>[face.id,face]));
  const records=[],validatedFaces=new Set();
  for (const change of changes) {
    if (change?.status!=='ready') continue;
    const face=faceById.get(change.faceId);
    if (!face || face.buildingId!==change.buildingId || face.facadeAllowed===false || face.orientationAmbiguous===true) continue;
    const context=change.changeId??'(missing changeId)';
    if (change.receiveShadow!==undefined && typeof change.receiveShadow!=='boolean') fail(context,'receiveShadow must be boolean');
    if (!Array.isArray(change.evidenceIds)||!change.evidenceIds.length||change.evidenceIds.some(id=>typeof id!=='string'||!id.trim())) fail(context,'ready changes require evidenceIds');
    if (typeof change.changeId!=='string'||!change.changeId.trim()) fail(context,'changeId is required');
    if (!Array.isArray(change.details)) fail(context,'details must be an explicit array');
    if (!validatedFaces.has(face)) {
      validateFace(face,context);
      validatedFaces.add(face);
    }
    const ids=new Set();
    for (const detail of change.details) {
      const label=`${context}/${detail?.id??'(missing id)'}`;
      if (!detail || typeof detail.id!=='string'||!detail.id.trim()||ids.has(detail.id)) fail(label,'detail id must be present and unique');
      ids.add(detail.id);
      if (!KINDS.has(detail.kind)) fail(label,`unsupported kind ${detail.kind}`);
      for (const name of ['u','v']) finite(detail[name],name,label);
      for (const name of ['width','height']) positive(detail[name],name,label);
      color(detail.color,label);
      validateFootprint(detail,face,label);
      const parts=detail.kind==='balcony'?balconyParts(detail,label):flatParts(detail,label);
      records.push({face,detail,change,parts});
    }
  }
  const group=new THREE.Group();
  group.name='ycoor-design-enhancements'; group.visible=false; group.position.y=-originHeight;
  const meshes=[],geometries=new Set(),materials=new Map();
  let disposed=false;
  for (const {face,detail,change,parts} of records) {
    const identity={source:'design-evidence',changeId:change.changeId,detailId:detail.id,buildingId:change.buildingId,faceId:face.id};
    const feature=new THREE.Group(); feature.name=detail.id; feature.userData={...identity};
    feature.matrixAutoUpdate=false;
    feature.matrix.makeBasis(new THREE.Vector3(...face.u),new THREE.Vector3(...face.v),new THREE.Vector3(...face.normal));
    feature.matrix.setPosition(face.origin[0]+face.u[0]*detail.u,detail.v,face.origin[2]+face.u[2]*detail.u);
    for (const part of parts) {
      const key=new THREE.Color(part.color).getHexString();
      if (!materials.has(key)) materials.set(key,new THREE.MeshLambertMaterial({color:part.color,side:THREE.DoubleSide,flatShading:true,depthTest:true,depthWrite:true}));
      const geometry=new THREE.BoxGeometry(part.width,part.height,part.depth); geometries.add(geometry);
      const mesh=new THREE.Mesh(geometry,materials.get(key));
      mesh.position.set(part.u,part.v,part.offset+part.depth/2);
      mesh.userData={...identity}; mesh.castShadow=true; mesh.receiveShadow=change.receiveShadow??true;
      feature.add(mesh); meshes.push(mesh);
    }
    group.add(feature);
  }
  scene.add(group);
  return {
    group,meshes,
    setEnabled(value) { if (!disposed) group.visible=Boolean(value); },
    setOriginHeight(height) {
      finite(height,'originHeight','layer');
      if (!disposed) group.position.y=-height;
    },
    pick(raycaster, { maxDistance = Infinity } = {}) {
      if (disposed || !group.visible) return false;
      let ancestor=group.parent;
      while (ancestor) {if (!ancestor.visible) return false;ancestor=ancestor.parent;}
      group.updateWorldMatrix(true,true);
      const visible=meshes.filter(mesh=>{
        let object=mesh;
        while (object!==group) {if (!object.visible) return false;object=object.parent;}
        return true;
      });
      const hit=raycaster.intersectObjects(visible,false)[0];
      if (!hit || hit.distance > maxDistance) return false;
      onSelect?.({...hit.object.userData}); return true;
    },
    dispose() {
      if (disposed) return;
      disposed=true; group.visible=false; group.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials.values()) material.dispose();
      group.clear(); meshes.length=0; geometries.clear(); materials.clear();
    },
  };
}
