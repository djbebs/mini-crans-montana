import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { footprintContained } from '../../crans-montana-p06/photo-playground.js';
import { triangulateOfficialPolygon } from './ground-surfaces.js';

// Site-local artistic estimates, not surveyed equipment coordinates. The older
// tourist-inspired five-item composition remains in the P0.6.6 module.
export const PLAYGROUND_ITEMS = [
  {key:'combo',name:'Structure en bois, pont de cordes et toboggan métallique ouvert',x:1.5,z:-8,w:11,d:7.5,rotation:Math.PI/2,evidenceIds:['YCOOR-P002','YCOOR-P007','TOURISM-2025-13','TOURISM-2025-15']},
  {key:'space-net',name:'Filet conique double à anneau central',x:-4.5,z:9.3,w:5.8,d:5.8,rotation:0,evidenceIds:['YCOOR-P005','TOURISM-2025-11']},
  {key:'balance',name:'Parcours d’équilibre en rondins',x:-9,z:-1.5,w:6.4,d:6.4,rotation:0,evidenceIds:['TOURISM-2025-15']},
  {key:'swing-south',name:'Portique jaune et balançoire simple',x:-9,z:-13,w:7.5,d:6.5,rotation:Math.PI/2,evidenceIds:['YCOOR-P003','YCOOR-P006','TOURISM-2025-22'],limits:'Forme du siège simplifiée : le détail du siège actuel du second portique reste peu lisible.'},
  {key:'basket-north',name:'Balançoire à nacelle bleue sur portique jaune',x:2.5,z:-21.5,w:7.5,d:6.5,rotation:Math.PI/2,evidenceIds:['TOURISM-2025-17','YCOOR-P003']},
  {key:'spring-double',name:'Jeu jaune à deux sièges sur ressort rouge',x:6,z:-16,w:4,d:3,rotation:Math.PI/2,evidenceIds:['TOURISM-2025-22']},
  {key:'spring-horse',name:'Petit jeu sombre à bascule sur ressort',x:9,z:-12,w:2.4,d:2.4,rotation:0,evidenceIds:['TOURISM-2025-22']},
];
export const PLAYGROUND_SITE={osmId:'way/245072857',groundId:362488,origin:{e:2603036,n:1128849},
  positionStatus:'PHOTO_REGISTERED_APPROXIMATE',currentStateVerified:false};

export function planObservedPlayground(features=[]) {
  const site=features.find(f=>f.id===PLAYGROUND_SITE.osmId&&f.type==='playground'&&f.geometry==='polygon');
  if(!site?.polygon?.length)return {planned:[],reason:'missing-playground-polygon',polygonId:null};
  const planned=PLAYGROUND_ITEMS.filter(p=>footprintContained(p,p.w,p.d,site.polygon,.08))
    .map(p=>({...p,scale:1,polygonId:site.id,positionQuality:PLAYGROUND_SITE.positionStatus}));
  return {planned,polygonId:site.id,reason:planned.length?'placed':'site-boundary-mismatch'};
}

const palette={wood:'#9b7950',end:'#b69b73',red:'#9b302c',steel:'#adb7bc',steelLight:'#d2d8d7',
  rope:'#565b50',net:'#a69b6c',yellow:'#d5a025',blue:'#247d9e',dark:'#303c3d',stone:'#93978d',turf:'#8eaa60'};
const materialCaches=new WeakMap();
function material(T,key){
  if(!materialCaches.has(T))materialCaches.set(T,new Map());
  const cache=materialCaches.get(T);
  if(!cache.has(key))cache.set(key,new T.MeshLambertMaterial({color:palette[key],flatShading:true,side:T.DoubleSide}));
  return cache.get(key);
}
function tools(T,g){
  const mesh=(geometry,color,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,material(T,color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
  const cube=(w,h,d,color,x,y,z)=>mesh(new T.BoxGeometry(w,h,d),color,x,y,z);
  const cyl=(r,h,color,x,y,z)=>{
    const bottom=y-h/2,ground=g.userData.groundAtLocal?.(x,z)??0;
    if(bottom<=.04&&h>.4&&r<.3&&ground<bottom){const top=y+h/2;h=top-ground;y=(top+ground)/2;}
    return mesh(new T.CylinderGeometry(r,r,h,8),color,x,y,z);
  };
  const link=(a,b,r,color)=>{
    a=[...a];b=[...b];
    for(const p of [a,b])if(p[1]<=.04)p[1]=Math.min(p[1],g.userData.groundAtLocal?.(p[0],p[2])??p[1]);
    const v=new T.Vector3(...b).sub(new T.Vector3(...a)),length=v.length();if(length<.001)return;
    const m=mesh(new T.CylinderGeometry(r,r,length,6),color);
    m.position.set(...a).add(new T.Vector3(...b)).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;
  };
  return {mesh,cube,cyl,link};
}
const rotate=(p,angle)=>({...p,x:p.x*Math.cos(angle)+p.z*Math.sin(angle),y:p.y,z:-p.x*Math.sin(angle)+p.z*Math.cos(angle)});
const point=(x,y,z)=>({x,y,z});
const box=(x,y,z,rx,ry,rz)=>({minX:x-rx,maxX:x+rx,minY:y-ry,maxY:y+ry,minZ:z-rz,maxZ:z+rz});

// Static pieces share one draw call per palette colour. Dynamic seats remain
// separate groups, so a larger village can reuse these same prefab recipes.
function mergeStatic(group){
  for(const child of group.children.filter(c=>c.isGroup))mergeStatic(child);
  const buckets=new Map();
  for(const child of group.children.filter(c=>c.isMesh)){
    child.updateMatrix();let geometry=child.geometry.clone();
    if(geometry.index){const plain=geometry.toNonIndexed();geometry.dispose();geometry=plain;}
    geometry.deleteAttribute('uv');geometry.applyMatrix4(child.matrix);
    if(!buckets.has(child.material))buckets.set(child.material,[]);
    buckets.get(child.material).push({child,geometry});
  }
  for(const [mat,parts] of buckets){
    const geometry=mergeGeometries(parts.map(p=>p.geometry));
    for(const p of parts){p.geometry.dispose();p.child.geometry.dispose();group.remove(p.child);}
    // A Mesh must use the same Three instance as its parent recipes.
    const sample=parts[0].child;const output=new sample.constructor(geometry,mat);
    // Thin ropes and steel sheets alias against their own sector shadow map.
    // Lambert shading keeps their volume; their silhouette still shades the turf.
    output.castShadow=true;output.receiveShadow=false;group.add(output);
  }
}

function buildCombo(T,g){
  const {cube,cyl,link,mesh}=tools(T,g),solids=[];
  for(const x of [-2.7,-.7,.4,2.2])for(const z of [-.85,.85]){
    cyl(.10,2.8,'wood',x,1.4,z);cyl(.115,.06,'dark',x,2.82,z);
    solids.push(box(x,1.4,z,.11,1.4,.11));
  }
  cube(1.9,.13,1.7,'wood',-1.7,1.615,0);cube(1.8,.13,1.7,'wood',1.3,1.615,0);
  for(const x of [-1.7,1.3]){
    cube(1.1,.75,.05,'red',x,2.24,-.86);
    for(const z of [-.85,.85])link([x-.8,2.48,z],[x+.8,2.48,z],.045,'red');
  }
  // A suspended rope bridge connects the two decks, with a visibly sagging floor.
  for(let i=0;i<=8;i++){
    const x=-.7+1.1*i/8,y=1.68-.22*Math.sin(Math.PI*i/8);
    link([x,y,-.48],[x,y,.48],.026,'rope');
    for(const z of [-.48,.48])link([x,y,z],[x,y+.78,z],.025,'rope');
  }
  for(const z of [-.48,.48])for(let i=0;i<8;i++){
    const a=-.7+1.1*i/8,b=-.7+1.1*(i+1)/8;
    const ay=1.68-.22*Math.sin(Math.PI*i/8),by=1.68-.22*Math.sin(Math.PI*(i+1)/8);
    link([a,ay,z],[b,by,z],.025,'rope');link([a,ay+.78,z],[b,by+.78,z],.035,'red');
  }
  // The stair treads and foot anchors use the same five measured-in-model tops.
  const stairs=Array.from({length:5},(_,i)=>point(-1.7,.28*(i+1),-2.75+.36*i));
  for(const p of stairs)cube(.75,.10,.31,'steel',p.x,p.y-.05,p.z);
  for(const x of [-2.2,-1.2])link([x,.4,-2.95],[x,2.25,-.9],.045,'red');
  // An open, concave steel chute: no opaque pipe and no invented tube entrance.
  const chute=[point(1.3,1.71,.85),point(1.3,1.62,1.45),point(1.3,1.18,2.35),point(1.3,.52,3.45),point(1.3,.22,4.15),point(1.3,.20,4.7)];
  const profile=[[-.59,.27],[-.48,.07],[-.3,0],[.3,0],[.48,.07],[.59,.27]],vertices=[];
  for(let i=1;i<chute.length;i++)for(let j=1;j<profile.length;j++){
    const at=(p,k)=>[p.x+profile[k][0],p.y+profile[k][1],p.z];
    const a=at(chute[i-1],j-1),b=at(chute[i-1],j),c=at(chute[i],j),d=at(chute[i],j-1);
    vertices.push(...a,...b,...c,...a,...c,...d);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();mesh(geo,'steelLight');
  for(const z of [1.6,3.5])cyl(.045,.6,'steel',1.3,.3,z);
  // Rope climbing panel and grips seen on the outside of the timber complex.
  for(let i=0;i<5;i++)link([-2.7,.25+i*.35,.9],[-.7,.25+i*.35,.9],.022,'rope');
  for(let i=0;i<6;i++)link([-2.7+i*.4,.25,.9],[-2.7+i*.4,1.65,.9],.022,'rope');
  const track=[point(-1.7,.04,-3.15),...stairs,point(-1.7,1.68,-.7),point(-1.7,1.68,0),point(-.7,1.68,0),point(-.15,1.46,0),point(.4,1.68,0),point(1.3,1.68,0),...chute,
    point(1.3,.04,5.05),point(2.9,.04,5.05),point(2.9,.04,-3.15),point(-1.7,.04,-3.15)];
  for(const i of [0,18,19,20,21])track[i].ground=true;
  const prefix=[['waitBottom',0,0,1]];
  for(let i=0;i<6;i++)prefix.push(['stairs',i,i+1,.62]);
  for(let i=6;i<12;i++)prefix.push(['platformWalk',i,i+1,.7]);
  prefix.push(['waitTop',12,12,1.5]);
  const variants=['sit','back','front'].flatMap(style=>[false,true].map(celebrate=>{
    const sequence=[...prefix,['board-'+style,12,12,1.1]];
    for(let i=12;i<17;i++)sequence.push(['slide-'+style,i,i+1,.45]);
    sequence.push(['recover-'+style,17,18,1.1],['rest',18,18,.6]);
    if(celebrate)sequence.push(['joyJump',18,18,.9],['rest',18,18,.5]);
    sequence.push(['return',18,19,1.4],['return',19,20,6.9],['return',20,21,4]);
    return {name:style+(celebrate?'-joy':'-calm'),track,sequence};
  }));
  const slope=(a,b)=>Math.atan2(a.y-b.y,Math.hypot(b.x-a.x,b.z-a.z));
  return {solids,interactions:[{role:'play-slide',track,sequence:variants[0].sequence,variants,variantOrder:'shuffle',
    riderMotion:{entrySlope:slope(chute[0],chute[1]),exitSlope:slope(chute.at(-2),chute.at(-1))},
    groundedPhases:['waitBottom','rest','return']}]};
}

function buildSpaceNet(T,g){
  const {cyl,link}=tools(T,g),radius=2.45,ringY=1.65,top=4;
  cyl(.105,top,'steel',0,top/2,0);cyl(.19,.13,'steelLight',0,top,0);
  const levels=[.12,.45,.9,1.4,ringY,2.1,2.6,3.1,3.55,top];
  const r=y=>y<=ringY?radius*(y-.12)/(ringY-.12):radius*(top-y)/(top-ringY);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
    link([radius*Math.sin(a),ringY,radius*Math.cos(a)],[radius*Math.sin(b),ringY,radius*Math.cos(b)],.07,'steelLight');
    for(let j=1;j<levels.length;j++){
      const y0=levels[j-1],y1=levels[j];
      link([r(y0)*Math.sin(a),y0,r(y0)*Math.cos(a)],[r(y1)*Math.sin(a),y1,r(y1)*Math.cos(a)],.022,'net');
      if(j<levels.length-1)link([r(y1)*Math.sin(a),y1,r(y1)*Math.cos(a)],[r(y1)*Math.sin(b),y1,r(y1)*Math.cos(b)],.022,'net');
    }
  }
  const climb=[point(0,.04,-2.78),...levels.slice(1,7).map(y=>point(0,y,-r(y)))];
  const track=[...climb,...climb.slice(0,-1).reverse()],sequence=[['waitBottom',0,0,1.5]];
  track[0].ground=true;track.at(-1).ground=true;
  for(let i=1;i<climb.length;i++)sequence.push(['net-up',i-1,i,1]);
  sequence.push(['holdNet',climb.length-1,climb.length-1,2]);
  for(let i=climb.length;i<track.length;i++)sequence.push(['net-down',i-1,i,1.1]);
  return {solids:[box(0,2,0,.11,2,.11)],interactions:[{role:'climb-ropes',facing:0,track,sequence,groundedPhases:['waitBottom']}]};
}

function buildBalance(T,g){
  const {cyl,link}=tools(T,g),walk=[point(-2,.52,-2),point(0,.67,-2),point(2,.58,-1),point(1.8,.6,1.3),point(.2,.53,2.1),point(-1.7,.52,1.3),point(-2,.52,-2)];
  for(let i=1;i<walk.length;i++){
    const a=walk[i-1],b=walk[i];link([a.x,a.y-.14,a.z],[b.x,b.y-.14,b.z],.14,'wood');
  }
  for(const p of walk.slice(0,-1))cyl(.12,1.55,'end',p.x+.4,.775,p.z+.3);
  cyl(.22,.18,'wood',-2,.09,-2.55);
  const track=[point(-2,.04,-2.9),point(-2,.18,-2.55),...walk,point(-2,.18,-2.55),point(-2,.04,-2.9)];
  track[0].ground=true;track.at(-1).ground=true;
  const sequence=[['stairs',0,1,.8],['stairs',1,2,.9]];
  for(let i=2;i<8;i++)sequence.push(['balance',i,i+1,2.3]);
  sequence.push(['stairs-down',8,9,.9],['stairs-down',9,10,.8],['rest',10,10,1.5]);
  return {solids:[],interactions:[{role:'play-balance',track,sequence,groundedPhases:['rest']}]};
}

function cyclicInteraction({role,period,position,onPose,contactName}){
  const track=Array.from({length:65},(_,i)=>position(i/64*period));
  const sequence=Array.from({length:64},(_,i)=>[role==='play-swing'?'swing':'rocker',i,i+1,period/64]);
  return {role,track,sequence,onPose,contactName};
}

function buildSwing(T,g,key,basket){
  const {link,cyl}=tools(T,g),height=3.05,length=basket?2.2:2.4,amplitude=.24,period=4.6;
  for(const x of [-1.8,1.8])for(const z of [-1.15,1.15])link([x,0,z],[x,height,0],.065,'yellow');
  link([-1.9,height,0],[1.9,height,0],.085,'yellow');
  for(const x of [-1.8,1.8])cyl(.13,.1,'steel',x,height,0);
  const pivot=new T.Group();pivot.name=key+'-pendulum';pivot.position.y=height;g.add(pivot);
  const b=tools(T,pivot);
  const hangerWidth=basket ? .65 : .28;
  for(const [side,x] of [['left',-hangerWidth],['right',hangerWidth]]){
    b.link([x,0,0],[x,-length,0],.023,'dark');
    const attachment=new T.Group();attachment.name=key+'-suspension-'+side;
    attachment.position.set(x,-length,0);pivot.add(attachment);
  }
  if(basket){
    const rim=b.mesh(new T.TorusGeometry(.8,.075,5,16),'blue',0,-length,0);rim.rotation.x=Math.PI/2;
    b.cyl(.72,.055,'rope',0,-length-.05,0);
    for(let i=0;i<7;i++){
      const x=-.6+i*.2,z=Math.sqrt(.72**2-x*x);
      b.link([x,-length,-z],[x,-length,z],.02,'net');
      b.link([-z,-length,x],[z,-length,x],.02,'net');
    }
  }else b.cube(.65,.11,.36,'dark',0,-length-.05,0);
  const contact=new T.Group();contact.name=key+'-seat';contact.position.set(0,-length,basket ? .42 : 0);pivot.add(contact);
  const angle=t=>amplitude*Math.sin(t/period*Math.PI*2);
  const interaction=cyclicInteraction({role:'play-swing',period,contactName:contact.name,
    position:t=>point(0,height-length*Math.cos(angle(t))-(basket ? .42 : 0)*Math.sin(angle(t))-.42,
      -length*Math.sin(angle(t))+(basket ? .42 : 0)*Math.cos(angle(t))),
    onPose:pose=>{pivot.rotation.x=angle(pose.motionTime||0);}});
  const interactions=[interaction];
  if(!basket){
    const track=[point(2.6,.04,-2.1),point(0,.04,-2.1),point(0,.04,-1.1),
      point(0,.04,-2.1),point(1.15,.04,-2.1),point(1.15,.04,-.35)];
    for(const p of track)p.ground=true;
    interactions.push({role:'swing-helper',kind:'adulte',loop:false,facing:0,track,
      sequence:[['waitBottom',0,0,2],['return',0,1,3],['return',1,2,1.3],['pushSwing',2,2,13.8],
        ['return',2,3,1.2],['return',3,4,1.2],['return',4,5,1.8],['watchSwing',5,5,1]],
      watchMotion:{track:interaction.track,sequence:interaction.sequence,period},
      groundedPhases:['waitBottom','return','pushSwing','watchSwing']});
  }
  return {solids:[...[-1.8,1.8].flatMap(x=>[-1.15,1.15].map(z=>box(x,.55,z,.09,.55,.09)))],interactions};
}

function spring(T,g){
  const {cyl,mesh}=tools(T,g);
  cyl(.38,.13,'stone',0,.065,0);
  const points=Array.from({length:65},(_,i)=>new T.Vector3(.24*Math.cos(i/64*Math.PI*8),.15+.6*i/64,.24*Math.sin(i/64*Math.PI*8)));
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),64,.045,5,false),'red');
}
function buildSpring(T,g,key,double){
  spring(T,g);const pivot=new T.Group();pivot.position.y=.85;pivot.name=key+'-rocking-body';g.add(pivot);
  const b=tools(T,pivot),seats=double?[-.85,.85]:[0],period=3.8;
  if(double){
    b.cube(.7,.20,2.6,'yellow',0,.08,0);b.cube(.73,.07,.65,'steelLight',0,.22,0);
    for(const z of [-1.25,1.25]){const head=b.mesh(new T.SphereGeometry(.29,7,5),'yellow',0,.13,z);head.scale.set(1,.8,1);}
  }else{
    b.cube(.3,.6,1.25,'dark',0,.1,0);b.cube(.34,.58,.24,'dark',0,.56,.48);
    b.cube(.34,.25,.38,'dark',0,.75,.65);b.cube(.4,.10,.48,'wood',0,.26,-.05);
  }
  const angle=t=>.10*Math.sin(t/period*Math.PI*2),interactions=[];
  for(const [i,z] of seats.entries()){
    b.cube(.62,.09,.40,'dark',0,.25,z);
    b.cube(.6,.34,.08,'dark',0,.47,z+(z<0?-.25:.25));
    b.link([-.45,.5,z+(z<0?.3:-.3)],[.45,.5,z+(z<0?.3:-.3)],.035,'red');
    b.link([-.50,-.25,z],[.50,-.25,z],.035,'steel');
    const contact=new T.Group();contact.name=key+'-seat-'+i;contact.position.set(0,.295,z);pivot.add(contact);
    const position=t=>{const a=angle(t);return point(0,.85+.295*Math.cos(a)-z*Math.sin(a)-.42,.295*Math.sin(a)+z*Math.cos(a));};
    interactions.push({...cyclicInteraction({role:'play-rocker',period,position,contactName:contact.name,
      onPose:pose=>{pivot.rotation.x=angle(pose.motionTime||0);}}),facing:z<0?0:Math.PI});
  }
  return {solids:[],interactions};
}

const builders={combo:buildCombo,'space-net':buildSpaceNet,balance:buildBalance,
  'swing-south':(T,g,key)=>buildSwing(T,g,key,false),'basket-north':(T,g,key)=>buildSwing(T,g,key,true),
  'spring-double':(T,g,key)=>buildSpring(T,g,key,true),'spring-horse':(T,g,key)=>buildSpring(T,g,key,false)};

export function drawObservedPlayground(T,features,height,parent,pickable,visible=true,options={}){
  const group=new T.Group();group.name='Ycoor · jeux interprétés d’après les vues 2022–2025';group.visible=visible;parent.add(group);
  const plan=planObservedPlayground(features),drawn=[];
  if(plan.planned.length){
    const feature=options.groundFeatures?.find(f=>f.layer===270&&f.objectID===PLAYGROUND_SITE.groundId);
    if(feature){
      const geometry=triangulateOfficialPolygon(T,feature.geometry.rings,options.groundHeight??((x,z)=>height(x,z)+.258),{terrainModel:options.terrainModel,offset:.018});
      if(geometry){
        const mat=material(T,'turf'),surface=new T.Mesh(geometry,mat);
        mat.polygonOffset=true;mat.polygonOffsetFactor=-2;mat.polygonOffsetUnits=-2;
        surface.renderOrder=1.1;
        surface.name='photo-turf-MO-362488';surface.receiveShadow=true;
        surface.userData={geometrySource:'MO/270/362488',appearanceStatus:'PHOTO_INTERPRETATION',title:'Sol vert de l’aire de jeux',desc:'Emprise officielle conservée ; aspect vert interprété des vues 2022–2025. Type de revêtement et état actuel non mesurés.'};
        group.add(surface);pickable.push(surface);
      }
    }
  }
  for(const p of plan.planned){
    const part=new T.Group();part.name=p.key;part.position.set(p.x,height(p.x,p.z)+.27,p.z);part.rotation.y=p.rotation;group.add(part);
    part.userData.groundAtLocal=(x,z)=>{const q=rotate({x,z},p.rotation);return height(p.x+q.x,p.z+q.z)-height(p.x,p.z);};
    const built=builders[p.key](T,part,p.key);mergeStatic(part);
    const mapTrack=track=>track.map(q=>{
      const r=rotate(q,p.rotation);
      if(q.ground)r.y+=height(p.x+r.x,p.z+r.z)-height(p.x,p.z);
      return r;
    });
    const interactions=built.interactions.map(item=>({...item,track:mapTrack(item.track),
      variants:item.variants?.map(v=>({...v,track:mapTrack(v.track)})),
      watchMotion:item.watchMotion?{...item.watchMotion,track:mapTrack(item.watchMotion.track)}:null,
      facing:(item.facing||0)+p.rotation}));
    const solidVolumes=built.solids.map(s=>{
      const corners=[s.minX,s.maxX].flatMap(x=>[s.minZ,s.maxZ].map(z=>rotate({x,z},p.rotation)));
      return {...s,minX:Math.min(...corners.map(c=>c.x)),maxX:Math.max(...corners.map(c=>c.x)),minZ:Math.min(...corners.map(c=>c.z)),maxZ:Math.max(...corners.map(c=>c.z))};
    });
    const meta={title:p.name,source:'photo',id:p.key,positionQuality:p.positionQuality,evidenceIds:p.evidenceIds,
      desc:'Reconstitution pixel d’après Street View, la photosphère et les photographies touristiques libellées 2025. Position, orientation et dimensions estimées dans le périmètre OSM ; état en 2026 non vérifié. '+(p.limits||'')};
    part.traverse(mesh=>{if(mesh.isMesh){mesh.userData={...meta};pickable.push(mesh);}});
    drawn.push({key:p.key,name:p.name,center:{x:p.x,z:p.z},w:p.w,d:p.d,scale:1,polygonId:plan.polygonId,interactions,solidVolumes,evidenceIds:p.evidenceIds,positionQuality:p.positionQuality});
  }
  return {group,drawn,reason:plan.reason,polygonId:plan.polygonId};
}
