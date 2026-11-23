// Source polyfaces in LV95/LN02 metres. Geometry keeps absolute H; the group
// alone subtracts the chosen height datum. Never drape, clip or rescale a mesh.
const EPS = 1e-7;
const PLANE_EPS = 0.00001;
const LAYOUT_PLANE_TOLERANCE = 0.005;
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mean = points => points[0].map((_,i)=>points.reduce((s,p)=>s+p[i],0)/points.length);
const lex = (a,b) => { for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]-b[i];} return 0; };
const normalOf = points => { const n=cross(sub(points[1],points[0]),sub(points[2],points[0])); const length=Math.hypot(...n);return n.map(x=>x/length); };
const coordinateKey = p => p.map(x=>Math.round(x/PLANE_EPS)).join(',');

function validate(data, originHeight) {
  if(!Number.isFinite(originHeight)) throw new TypeError('originHeight must be finite');
  if(!data || !Number.isFinite(data.origin?.e) || !Number.isFinite(data.origin?.n) || !Array.isArray(data.buildings)) throw new TypeError('Invalid local building data');
  const ids=new Set();
  for(const b of data.buildings) {
    if(typeof b.id!=='string'||!b.id||ids.has(b.id))throw new TypeError('Building IDs must be unique nonempty strings');
    ids.add(b.id);
    if(!Array.isArray(b.vertices)||b.vertices.length<3||!Array.isArray(b.faces)||!b.faces.length)throw new TypeError(`Missing polyface ${b.id}`);
    for(const v of b.vertices)if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw new TypeError(`Invalid coordinate in ${b.id}`);
    for(const face of b.faces) {
      if(!Array.isArray(face)||face.length!==3||!face.every(i=>Number.isInteger(i)&&i>=0&&i<b.vertices.length)||new Set(face).size!==3)throw new TypeError(`Invalid triangle index in ${b.id}`);
      const [a,c,d]=face.map(i=>b.vertices[i]);
      if(Math.hypot(...cross(sub(c,a),sub(d,a)))<EPS)throw new TypeError(`Degenerate triangle in ${b.id}`);
    }
  }
}

// Reconcile neighboring triangle winding before selecting the outward side of
// each closed component by signed volume. Original vertices/triangles stay intact.
function orientTriangles(vertices, sourceFaces) {
  const triangles=sourceFaces.map(indices=>({indices:[...indices]}));
  const edges=new Map(), keys=vertices.map(coordinateKey);
  for(let index=0;index<triangles.length;index++) {
    const f=triangles[index].indices;
    for(let i=0;i<3;i++) {
      const a=keys[f[i]],b=keys[f[(i+1)%3]], key=[a,b].sort().join('|');
      if(!edges.has(key))edges.set(key,[]);
      edges.get(key).push({index,forward:a<b});
    }
  }
  const adjacency=triangles.map(()=>[]);
  for(const edge of edges.values())if(edge.length===2) {
    const [a,b]=edge;adjacency[a.index].push([b.index,a.forward===b.forward]);adjacency[b.index].push([a.index,a.forward===b.forward]);
  }
  const flips=new Map();
  for(let start=0;start<triangles.length;start++)if(!flips.has(start)) {
    const component=[],queue=[start];flips.set(start,false);
    let consistent=true;
    for(let cursor=0;cursor<queue.length;cursor++) {
      const index=queue[cursor];component.push(index);
      for(const [next,opposite] of adjacency[index]) {
        const flip=flips.get(index)!==opposite;
        if(!flips.has(next)){flips.set(next,flip);queue.push(next);}
        else if(flips.get(next)!==flip)consistent=false;
      }
    }
    for(const index of component)if(flips.get(index))triangles[index].indices.reverse();
    const reference=mean(vertices),members=new Set(component);
    const closed=[...edges.values()].filter(edge=>edge.some(e=>members.has(e.index))).every(edge=>edge.length===2);
    let volume6=0;
    for(const index of component){const [a,b,c]=triangles[index].indices.map(i=>sub(vertices[i],reference));volume6+=dot(a,cross(b,c));}
    if(volume6<0)for(const index of component)triangles[index].indices.reverse();
    for(const index of component)triangles[index].reliableOrientation=closed&&consistent&&Math.abs(volume6)>EPS;
  }
  for(const triangle of triangles){triangle.points=triangle.indices.map(i=>vertices[i]);triangle.normal=normalOf(triangle.points);}
  return triangles;
}

function volumeCentroid(vertices,triangles) {
  const reference=mean(vertices);let total=0,acc=[0,0,0];
  for(const t of triangles) {
    const [a,b,c]=t.points.map(p=>sub(p,reference)),weight=dot(a,cross(b,c));total+=weight;
    for(let i=0;i<3;i++)acc[i]+=weight*(a[i]+b[i]+c[i])/4;
  }
  return Math.abs(total)>EPS ? acc.map((x,i)=>x/total+reference[i]) : reference;
}

function horizontalLayoutPlane(points) {
  const sorted=[...points].sort(lex),canonical=normalOf(sorted);
  const lengthXZ=Math.hypot(canonical[0],canonical[2]);
  if(lengthXZ<EPS)return null;
  const normal=[canonical[0]/lengthXZ,0,canonical[2]/lengthXZ],anchor=sorted[0];
  const distance=dot(normal,anchor);
  // Tiny CAD rounding may make a true wall triangle's normal.y nonzero.
  // Accept it by measured horizontal-plane error, never by filling its bounds.
  if(points.some(p=>Math.abs(dot(normal,p)-distance)>LAYOUT_PLANE_TOLERANCE))return null;
  return {normal,anchor};
}

function uniqueRenderTriangles(vertices,triangles) {
  const coincident=new Map(),centre=volumeCentroid(vertices,triangles);
  const minHeight=Math.min(...vertices.map(p=>p[1]));
  triangles.forEach((triangle,sourceIndex)=>{
    // Exact original coordinate sets only. No rounding, welding or movement.
    const key=[...triangle.points].sort(lex).map(p=>p.join(',')).join('|');
    if(!coincident.has(key))coincident.set(key,[]);
    coincident.get(key).push({triangle,sourceIndex});
  });
  return [...coincident.values()].map(candidates=>{
    let chosen=candidates[0].triangle;
    if(candidates.length>1) {
      const faceCentre=mean(chosen.points),isBase=chosen.points.every(p=>p[1]<=minHeight+EPS);
      const preferUp=!horizontalLayoutPlane(chosen.points)&&!isBase;
      const score=t=>preferUp?t.normal[1]:dot(t.normal,sub(faceCentre,centre));
      chosen=[...candidates].sort((a,b)=>score(b.triangle)-score(a.triangle))[0].triangle;
      // Source doublesided duplicates can form separate winding components.
      // Only the render representative is oriented upward/outward if required.
      if(score(chosen)<0) {
        const points=[...chosen.points].reverse();
        chosen={...chosen,indices:[...chosen.indices].reverse(),points,normal:normalOf(points)};
      }
    }
    return {...chosen,sourceFaceIndices:candidates.map(c=>c.sourceIndex)};
  });
}

function useVisibleSurfaceColor(material) {
  // Original CAD can contain overlapping, oppositely wound roof surfaces with
  // different triangulations. Classify the visible surface, not its draw group.
  // Three's normal chunk has already handled flat shading and DoubleSide here.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n'+
      'float ycoorVisibleRoof = smoothstep(0.4, 0.72, dot(normalize(normal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));\n'+
      'diffuseColor.rgb = mix(vec3(0.83, 0.78, 0.67), vec3(0.66, 0.35, 0.26), ycoorVisibleRoof);\n');
  };
  material.customProgramCacheKey=()=> 'ycoor-local-visible-world-up-v1';
}

function wallGroups(building,vertices,triangles) {
  const centre=volumeCentroid(vertices,triangles),groups=[];
  // Choose plane representatives by source coordinates, never renderer order.
  const ordered=[...triangles].sort((a,b)=>lex([...a.points].sort(lex).flat(),[...b.points].sort(lex).flat()));
  for(const t of ordered) {
    const plane=horizontalLayoutPlane(t.points);if(!plane)continue;
    let n=plane.normal;
    // Canonical plane sign merges opposite source winding on the same plane.
    if(n[0]<-EPS||(Math.abs(n[0])<=EPS&&n[2]<0))n=n.map(x=>-x);
    // Compare outward directions, so nearby opposite sides of a thin volume
    // cannot merge merely because their unoriented planes almost coincide.
    if(dot(n,sub(mean(t.points),centre))<0)n=n.map(x=>-x);
    const d=dot(n,plane.anchor);
    // This is an approximate layout plane only. Every original mesh triangle
    // stays untouched; all vertices must fit the fixed anchor plane within 5mm.
    let group=groups.find(g=>dot(g.planeNormal,n)>0.99999&&t.points.every(p=>Math.abs(dot(g.planeNormal,p)-g.distance)<=LAYOUT_PLANE_TOLERANCE));
    if(!group){group={planeNormal:n,distance:d,triangles:[]};groups.push(group);}
    group.triangles.push(t);
  }
  const faces=groups.map(g=>{
    const points=g.triangles.flatMap(t=>t.points),centroid=mean(points);
    const direction=dot(g.planeNormal,sub(centroid,centre));
    const normal=g.planeNormal.map(x=>x*(direction<0?-1:1));
    const u=[normal[2],0,-normal[0]],v=[0,1,0];
    const start=[...points].sort(lex)[0],delta=dot(g.planeNormal,start)-g.distance;
    const origin=[start[0]-g.planeNormal[0]*delta,0,start[2]-g.planeNormal[2]*delta];
    const maxPlanarityError=Math.max(...points.map(p=>Math.abs(dot(g.planeNormal,p)-g.distance)));
    const projected=g.triangles.map(t=>t.points.map(p=>[dot(sub(p,origin),u),p[1]]));
    // Sorting only affects metadata order; no polygon reconstruction fills gaps.
    projected.sort((a,b)=>lex([...a].sort(lex).flat(),[...b].sort(lex).flat()));
    const uv=projected.flat(),outwardCentroidDot=Math.abs(direction);
    const orientationConflict=g.triangles.some(t=>t.reliableOrientation&&dot(t.normal,normal)<0);
    return {buildingId:building.id,origin,u,v,normal,triangles:projected,
      bounds:{minU:Math.min(...uv.map(p=>p[0])),maxU:Math.max(...uv.map(p=>p[0])),minV:Math.min(...uv.map(p=>p[1])),maxV:Math.max(...uv.map(p=>p[1]))},
      centroid,volumeCentroid:centre,outwardCentroidDot,maxPlanarityError,facadeAllowed:outwardCentroidDot>PLANE_EPS&&!orientationConflict,
      orientationAmbiguous:outwardCentroidDot<=PLANE_EPS||orientationConflict,
      sortKey:[...normal.map(x=>Math.round(x/PLANE_EPS)),Math.round(dot(normal,origin)/PLANE_EPS),...origin,...uv.flat().sort((a,b)=>a-b)]};
  });
  faces.sort((a,b)=>lex(a.sortKey,b.sortKey));
  return faces.map((face,i)=>{delete face.sortKey;return {id:`${building.id}:wall:${String(i+1).padStart(3,'0')}`,...face};});
}

/** Build isolated full-source volumes, with facade planes independent of datum. */
export function createLocalBuildings({THREE,scene,data,originHeight,onSelect}) {
  validate(data,originHeight);
  if(!THREE||!scene?.add)throw new TypeError('THREE and scene are required');
  const group=new THREE.Group();group.name='ycoor-local-dxf';group.position.y=-originHeight;
  const wall=new THREE.MeshLambertMaterial({color:0xe4d6b5,flatShading:true,side:THREE.DoubleSide});
  const roof=new THREE.MeshLambertMaterial({color:0xa35e46,flatShading:true,side:THREE.DoubleSide});
  useVisibleSurfaceColor(wall);useVisibleSurfaceColor(roof);
  const meshes=[],faces=[],buildings=data.buildings;
  for(const b of buildings) {
    const vertices=b.vertices.map(([e,n,h])=>[e-data.origin.e,h,data.origin.n-n]);
    const triangles=orientTriangles(vertices,b.faces);
    const rendered=uniqueRenderTriangles(vertices,triangles);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(rendered.flatMap(t=>t.points.flat()),3));
    geometry.userData.sourceFaceIndices=rendered.map(t=>t.sourceFaceIndices);
    rendered.forEach((t,i)=>geometry.addGroup(i*3,3,t.normal[1]>EPS&&!horizontalLayoutPlane(t.points)?1:0));
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,[wall,roof]);mesh.name=`ycoor-dxf-${b.id}`;
    mesh.userData={buildingId:b.id,building:b,sourceUuid:b.sourceUuid,sourceTriangleCount:triangles.length,renderTriangleCount:rendered.length};group.add(mesh);meshes.push(mesh);
    faces.push(...wallGroups(b,vertices,triangles));
  }
  scene.add(group);group.updateMatrixWorld(true);let disposed=false;
  return {group,meshes,buildings,faces,sourceTriangleCount:buildings.reduce((sum,b)=>sum+b.faces.length,0),renderTriangleCount:meshes.reduce((sum,m)=>sum+m.userData.renderTriangleCount,0),
    setVisible(value){if(!disposed)group.visible=Boolean(value);},
    setOriginHeight(h){if(!Number.isFinite(h))throw new TypeError('originHeight must be finite');if(!disposed)group.position.y=-h;},
    pick(raycaster){
      if(disposed||!group.visible)return null;
      group.updateMatrixWorld(true);
      const intersection=raycaster.intersectObjects(meshes.filter(mesh=>mesh.visible),false)[0];if(!intersection)return null;
      const building=intersection.object.userData.building;
      const hit={...intersection,building,buildingId:building.id,sourceFaceIndices:intersection.object.geometry.userData.sourceFaceIndices[intersection.faceIndex]};if(onSelect)onSelect(building,hit);return hit;
    },
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const m of meshes)m.geometry.dispose();wall.dispose();roof.dispose();group.clear();}
  };
}
