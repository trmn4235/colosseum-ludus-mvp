/* Roman stable V130. Repeated architecture is instanced; owned horses share one asset. */
var LudusStableRoom=(()=>{
 'use strict';
 const WIDTH=30,DEPTH=54,ROWS=6;
 function cloneRig(source){
  const copy=source.clone(true),map=new Map();
  const pair=(a,b)=>{map.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));};pair(source,copy);
  source.traverse(o=>{if(o.isSkinnedMesh){const c=map.get(o);c.skeleton=o.skeleton.clone();c.skeleton.bones=o.skeleton.bones.map(b=>map.get(b));c.bindMatrix.copy(o.bindMatrix);c.bindMatrixInverse.copy(o.bindMatrixInverse);c.frustumCulled=false;}});
  return copy;
 }
 function normalizeModel(T,model,height){
  // Skin bounds must be measured after world/bone matrices are current. Scaling a
  // separate parent also preserves every authored root transform in the GLB.
  model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  const b=new T.Box3().setFromObject(model,true),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
  if(!Number.isFinite(size.y)||size.y<.001)throw Error('Model boyu ölçülemedi.');
  const normalized=new T.Group(),offset=new T.Group();offset.add(model);offset.position.set(-c.x,-b.min.y,-c.z);normalized.add(offset);normalized.scale.setScalar(height/size.y);normalized.userData.nativeHeight=size.y;normalized.userData.height=height;
  model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});return normalized;
 }
 function create({T,props,colliders,wood,stone,shell,ambient,light,getOwnerHeight=()=>1.78,player,onError}){
  let root=null,template=null,horsePromise=null,groomPromise=null,groom=null,active=false,selected=null,herd=[],savedLighting=null;
  const slots=[],animals=new Map(),pool=[],bounds=[],coatMaterials=new Map();let selection=null;
  const ownerHeight=()=>Math.max(1.6,Math.min(2,Number(getOwnerHeight())||1.78));
  function build(){
   root=new T.Group();root.name='Ahır · 30 × 54 metre';root.userData={width:WIDTH,depth:DEPTH,stalls:12,features:['stone-paving','plastered-walls','columns','timber-trusses','stall-bars','hay-bedding','mangers','water-troughs','feed-sacks','barrels','rakes','one-groom']};
   const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,12),sphere=new T.SphereGeometry(1,10,6),hoop=new T.TorusGeometry(1,.055,5,18),circle=new T.CircleGeometry(1,20);
   const material=(color,key,scale=.8)=>{const m=new T.MeshStandardMaterial({color,roughness:.94});if(key&&typeof RomanVisualAssets!=='undefined')RomanVisualAssets.material(m,key,scale,.22,true);m.color.setHex(color);return m;};
   const plaster=material(0xd8d4c6,'white_plaster_02'),masonry=material(0xa6a59b,'white_sandstone_blocks_02',.6),timber=wood.clone();if(typeof RomanVisualAssets!=='undefined')RomanVisualAssets.material(timber,'wooden_gate',.65,.28,true);timber.color.setHex(0x86766a);timber.roughness=.95;
   const iron=material(0x373934),hay=material(0xb7a16b),hayDark=material(0x94855a),sack=material(0xc8bb9a,'white_plaster_02',2),grain=material(0xbaa16b),water=new T.MeshStandardMaterial({color:0x6f8a8d,roughness:.24,metalness:.15});
   const floors=[material(0xaaa9a1,'white_plaster_02',1),material(0xb6b3a8,'white_plaster_02',1),material(0xa09f98,'white_plaster_02',1)];
   const batches=new Map(),dummy=new T.Object3D();
   const put=(mat,x,y,z,w,h,d,geo=box,rx=0,ry=0,rz=0)=>{const key=mat.uuid+geo.uuid;if(!batches.has(key))batches.set(key,{mat,geo,matrices:[]});dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(w,h,d);dummy.updateMatrix();batches.get(key).matrices.push(dummy.matrix.clone());};
   const beam=(a,b,w=.13,mat=timber)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);dummy.position.copy(start).add(end).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().normalize());dummy.scale.set(w,dir.length(),w);dummy.updateMatrix();const key=mat.uuid+box.uuid;if(!batches.has(key))batches.set(key,{mat,geo:box,matrices:[]});batches.get(key).matrices.push(dummy.matrix.clone());};
   let seed=130;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   put(floors[0],0,-.12,-22.5,30,.24,54);
   // Individually joined, worn grey paving. A few shared batches cover the whole floor.
   for(let r=0;r<36;r++)for(let c=0;c<20;c++)put(floors[(c+r*3)%3],-14.25+c*1.5,.005,3.75-r*1.5,1.47,.018,1.47);
   put(plaster,0,2.5,-49.5,30,5,.3);put(plaster,0,4.96,-22.5,30,.16,54);
   for(const side of [-1,1]){put(plaster,side*15,2.5,-22.5,.3,5,54);put(masonry,side*14.8,.5,-22.5,.16,1,53.7);}
   // A proper double entrance with the existing courtyard-exit badge at its centre.
   for(const side of [-1,1]){put(plaster,side*8.45,2.5,4.5,13.1,5,.3);put(timber,side*.85,1.5,4.46,1.66,3,.13);for(let i=0;i<6;i++)put(iron,side*(.12+i*.27),1.5,4.36,.014,2.9,.022);put(masonry,side*1.9,1.62,4.2,.26,3.25,.42);}
   put(plaster,0,4.1,4.5,3.9,1.8,.3);put(masonry,0,3.18,4.2,4.1,.22,.42);
   for(const z of [1,-6,-13,-20,-27,-34,-41,-48]){
    put(timber,0,4.65,z,29.7,.3,.3);
    for(const side of [-1,1]){
     const x=side*3.8;put(masonry,x,.17,z,.75,.34,.75);put(masonry,x,2.4,z,.26,4.15,.26,cylinder);put(masonry,x,4.47,z,.7,.22,.7);beam([x,3.7,z],[x+side*1.4,4.64,z],.18);
     put(timber,side*13.8,2.43,z,.26,4.8,.26);beam([side*13.8,3.6,z],[side*12.5,4.64,z],.16);
    }
   }
   for(const x of [-13.8,-7.8,0,7.8,13.8])put(timber,x,4.78,-22.5,.19,.22,53.7);
   function trough(side,z){
    const x=side*4.7;
    put(timber,x,.55,z-2.05,1.1,.9,1.3);put(hay,x,1.01,z-2.05,.96,.07,1.15);
    for(let n=0;n<22;n++)put(n%2?hay:hayDark,x+(rand()-.5)*.92,1.06+rand()*.07,z-2.05+(rand()-.5)*1.05,.018,.018,.28,box,0,rand()*3,0);
    // Hollow stone water basin, with an inset water surface.
    put(masonry,x,.3,z+2.03,1.3,.14,1.35);put(masonry,x-.59,.59,z+2.03,.12,.55,1.35);put(masonry,x+.59,.59,z+2.03,.12,.55,1.35);put(masonry,x,.59,z+1.42,1.16,.55,.12);put(masonry,x,.59,z+2.64,1.16,.55,.12);put(water,x,.78,z+2.03,1.1,.025,1.12);
   }
   for(let row=0;row<ROWS;row++)for(const side of [-1,1]){
    const z=-2.5-row*7,front=side*3.8,outer=side*13.7;
    slots.push({index:slots.length,side,z,x:side*5.05});
    // Half-height board gates and high open bars, leaving a central head opening.
    for(let i=0;i<22;i++)put(timber,front,.69,z-3.12+i*.297,.15,1.35,.278);
    for(const dz of [-3.34,3.34]){
     put(timber,side*8.75,.76,z+dz,9.75,1.5,.14);put(timber,side*8.75,3.45,z+dz,9.75,.18,.16);
     for(let x=4.1;x<13.6;x+=.38)put(iron,side*x,2.48,z+dz,.045,1.77,.045);
     put(timber,front,1.8,z+dz,.23,3.6,.23);
    }
    put(timber,front,3.5,z,.22,.2,6.9);put(timber,front,1.43,z,.2,.13,6.9);
    for(let i=0;i<22;i++){const dz=-3.12+i*.297;if(Math.abs(dz)>.8)put(iron,front,2.45,z+dz,.045,1.96,.045);}
    for(const dz of [-.85,.85])put(timber,front,2.45,z+dz,.19,2,.1);
    for(const dz of [-2.8,2.8])for(const y of [.45,1.1])put(iron,front-side*.10,y,z+dz,.045,.12,.38);
    put(timber,outer,1.1,z,.16,2.2,6.9);put(hay,side*9,.035,z,8,.045,6.3);
    for(let n=0;n<65;n++)put(n%2?hay:hayDark,side*(4.2+rand()*9),.07+rand()*.025,z+(rand()-.5)*6.3,.025,.014,.18+rand()*.32,box,0,rand()*Math.PI,0);
    trough(side,z);
    bounds.push({kind:'stable-stall',minX:side<0?-14:3.62,maxX:side<0?-3.62:14,minZ:z-3.45,maxZ:z+3.45});
    // Clerestory recesses and timber shutters above the horses.
    put(iron,side*14.77,3.35,z,.06,1.55,2.75);put(plaster,side*14.72,3.35,z,.07,1.39,2.58);
    for(const dz of [-1.36,0,1.36])put(timber,side*14.64,3.35,z+dz,.13,1.65,.10);
    for(const y of [2.55,4.15])put(timber,side*14.64,y,z,.13,.12,2.85);
   }
   // Feed preparation and tools at the rear, with clear access down the middle.
   for(const side of [-1,1]){
    for(let i=0;i<5;i++){const x=side*(7+i*1.2),z=-46.5;put(sack,x,.59,z,.48,.6,.44,sphere);put(timber,x,1.15,z,.14,.10,.13,cylinder);}
    for(let i=0;i<6;i++){const x=side*(5.5+(i%3)*1.55),y=.42+Math.floor(i/3)*.8;put(hay,x,y,-48.1,1.35,.75,1.0);for(const dx of [-.42,.42])put(timber,x+dx,y,-47.58,.045,.78,.025);}
    const bx=side*11.8,bz=-43.8;put(timber,bx,.65,bz,.62,1.3,.62,cylinder);for(const y of [.15,.65,1.13])put(iron,bx,y,bz,.64,.64,.64,hoop,Math.PI/2);
    put(grain,bx,1.31,bz,.57,.57,1,circle,-Math.PI/2);
    for(let i=0;i<3;i++){const x=side*(7.5+i*.5);beam([x,.2,-43.6],[x+side*.4,2.6,-44.0],.05);put(iron,x,.2,-43.6,.65,.07,.12);for(let n=0;n<5;n++)put(iron,x-.25+n*.12,.12,-43.6,.026,.21,.028);}
    bounds.push({kind:'stable-store',minX:side<0?-14:4.5,maxX:side<0?-4.5:14,minZ:-49,maxZ:-42.9});
   }
   for(const {mat,geo,matrices} of batches.values()){
    const batch=new T.InstancedMesh(geo,mat,matrices.length);matrices.forEach((m,i)=>batch.setMatrixAt(i,m));batch.name='Ahır · sabit mimari';batch.receiveShadow=true;batch.computeBoundingSphere();root.add(batch);
   }
   root.userData.staticBatches=batches.size;
   const daylight=new T.DirectionalLight(0xfff2de,1.4);daylight.position.set(-8,10,4);daylight.target.position.set(2,0,-25);root.add(daylight,daylight.target);
   const ring=new T.Mesh(new T.RingGeometry(.8,.85,40),new T.MeshBasicMaterial({color:0xe7ddbd,transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;selection=ring;root.add(ring);
   bounds.push({kind:'stable-groom',minX:-2.9,maxX:-2.15,minZ:.4,maxZ:1.2});
   // The stall arrays are reused on re-entry; no new geometry per visit.
  }
  function loadHorse(){
   if(template)return Promise.resolve(template);
   return horsePromise||(horsePromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('assets/caravan-field-v125/horse.glb',g=>{template=g;resolve(g);},undefined,reject)).catch(e=>{horsePromise=null;onError?.('At modelleri yüklenemedi. Ahıra yeniden girdiğinde tekrar denenecek.');throw e;}));
  }
  function makeHorse(){
   const animal=cloneRig(template.scene),mixer=new T.AnimationMixer(animal),idle=template.animations.find(a=>a.name==='idle_loop');if(idle){mixer.clipAction(idle).play();mixer.update(0);}
   const model=normalizeModel(T,animal,2.12),group=new T.Group();group.add(model);root.add(group);group.userData.kind='owned-horse';
   return {group,animal,model,mixer,id:null,coat:null,elapsed:0};
  }
  function applyCoat(entry,id){
   id=LudusHorseAppearance.coat(id).id;if(entry.coat===id)return;
   entry.animal.traverse(m=>{if(!m.isMesh)return;const original=m.userData.stableOriginalMaterial||(m.userData.stableOriginalMaterial=m.material);const recolor=mat=>{const key=mat.uuid+':'+id;if(!coatMaterials.has(key))coatMaterials.set(key,LudusHorseAppearance.material(T,mat,id));return coatMaterials.get(key);};m.material=Array.isArray(original)?original.map(recolor):recolor(original);});entry.coat=id;
  }
  function sync(){
   if(!root||!template)return;
   const wanted=new Set(herd.map(h=>h.id));for(const [id,e]of animals)if(!wanted.has(id)){e.group.visible=false;animals.delete(id);pool.push(e);}
   herd.slice(0,12).forEach((h,i)=>{
    let e=animals.get(h.id);if(!e){e=pool.pop()||makeHorse();e.id=h.id;animals.set(h.id,e);}
    const s=slots[i];e.group.name=h.name||'At';e.group.userData.horseId=h.id;e.group.userData.coat=LudusHorseAppearance.coat(h).id;e.group.position.set(s.x,.065,s.z);e.group.rotation.y=s.side<0?Math.PI/2:-Math.PI/2;e.group.scale.setScalar(h.stage==='foal'?.55:h.stage==='young'?.8:1);e.group.visible=true;applyCoat(e,h.coat);
   });
   const e=animals.get(selected?.id);selection.visible=!!e;if(e)selection.position.set(e.group.position.x,.10,e.group.position.z);
  }
  function loadGroom(){return groomPromise||(groomPromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('assets/caravan-v128/driver.glb',g=>{
   groom=normalizeModel(T,g.scene,ownerHeight());groom.position.set(-2.5,.035,.8);groom.rotation.y=.5;groom.name='Seyis';root.add(groom);resolve(groom);
  },undefined,reject)).catch(e=>{groomPromise=null;onError?.('Seyis modeli yüklenemedi. Ahıra yeniden girdiğinde tekrar denenecek.');throw e;}));}
  function enter(){
   active=true;if(!root)build();props.add(root);colliders.push(...bounds.map(b=>({...b})));
   if(shell)for(const mesh of [shell.floor,shell.back,shell.front,shell.ceiling,...shell.sides])mesh.visible=false;
   if(ambient&&light){savedLighting={color:ambient.color.clone(),ground:ambient.groundColor.clone(),intensity:ambient.intensity,pointIntensity:light.intensity};ambient.color.setHex(0xe5edf5);ambient.groundColor.setHex(0x928a78);ambient.intensity=2.05;light.intensity=15;}
   loadHorse().then(sync).catch(()=>{});loadGroom().catch(()=>{});sync();
  }
  function leave(){
   active=false;root?.removeFromParent();
   if(shell)for(const mesh of [shell.floor,shell.back,shell.front,shell.ceiling,...shell.sides])mesh.visible=true;
   if(savedLighting){ambient.color.copy(savedLighting.color);ambient.groundColor.copy(savedLighting.ground);ambient.intensity=savedLighting.intensity;light.intensity=savedLighting.pointIntensity;savedLighting=null;}
   for(let i=colliders.length-1;i>=0;i--)if(colliders[i].kind?.startsWith('stable-'))colliders.splice(i,1);
  }
  return {
   enter,leave,setHerd(horses){herd=(horses||[]).slice(0,12);sync();},
   select(h){selected=h;if(h&&!herd.some(x=>x.id===h.id))herd=[h];sync();},
   viewFor(id){const i=herd.findIndex(h=>h.id===id),s=slots[i];return s?{x:0,z:s.z+.9,yaw:s.side<0?Math.PI/2:-Math.PI/2,pitch:.08}:null;},
   tick(dt){if(!active||dt<=0)return;if(groom){const h=ownerHeight();if(Math.abs(h-groom.userData.height)>.001){groom.scale.setScalar(h/groom.userData.nativeHeight);groom.userData.height=h;}}
    for(const [id,e]of animals){e.elapsed+=dt;const near=!player||Math.hypot(player.x-e.group.position.x,player.z-e.group.position.z)<15;if(id===selected?.id||near){if(e.elapsed>=1/30){e.mixer.update(Math.min(e.elapsed,.15));e.elapsed=0;}}else if(e.elapsed>=.25){e.mixer.update(e.elapsed);e.elapsed=0;}}
   },
   get root(){return root;},get horse(){return animals.get(selected?.id)?.group||null;},get horses(){return [...animals.values()].map(e=>e.group);},get groom(){return groom;},get slots(){return slots;}
  };
 }
 return {create,normalizeModel,cloneRig,width:WIDTH,depth:DEPTH};
})();
if(typeof module!=='undefined')module.exports=LudusStableRoom;
