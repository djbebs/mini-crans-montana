// Preview adapters: stable furniture, photo and character builders retain their
// original model dimensions and relative offsets. Only their ground reference
// is lowered; mapped surface footprints use the preview's exact terrain mesh.
import { triangulateOfficialPolygon } from './ground-surfaces.js';

const groundMaterials=new WeakMap();
function groundMaterial(source) {
  if(Array.isArray(source))return source.map(groundMaterial);
  if(!groundMaterials.has(source)) {
    const material=source.clone();
    material.polygonOffset=true;
    material.polygonOffsetFactor=-.5;
    material.polygonOffsetUnits=-.5;
    groundMaterials.set(source,material);
  }
  return groundMaterials.get(source);
}

export function legacyPhotoHeight(height) {
  // The stable +.27 m model base becomes +.012 m. Character anchors retain
  // their original 2 cm difference from that base and their individual poses.
  return (x,z)=>height(x,z)-.258;
}

export function drawFurnitureGrounded({THREE,painter,data,height,terrainModel,parent,objects,lineGeom}) {
  // Stable point roots add .12 m: .12 - .108 gives the new .012 m anchor.
  const result=painter(THREE,data,(x,z)=>height(x,z)-.108,parent,objects,lineGeom);
  const features=new Map((data?.features??[]).filter(feature=>feature.geometry==='polygon'&&feature.type==='playground').map(feature=>[feature.id,feature]));
  for(const mesh of [...result.group.children]) {
    if(!mesh.isMesh||mesh.userData.source!=='osm')continue;
    const feature=features.get(mesh.userData.osmID);
    if(!feature)continue;
    const geometry=triangulateOfficialPolygon(THREE,feature.rings??[feature.polygon],height,{terrainModel,offset:.006});
    mesh.geometry.dispose();
    if(!geometry) {
      result.group.remove(mesh);
      const index=objects.indexOf(mesh);
      if(index>=0)objects.splice(index,1);
      continue;
    }
    mesh.geometry=geometry;
    mesh.material=groundMaterial(mesh.material);
    mesh.renderOrder=0;
  }
  return result;
}
