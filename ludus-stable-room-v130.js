/* V159 stone stable facing a sand courtyard; V130 husbandry models. Repeated architecture is instanced; owned horses share one asset. */
var LudusStableRoom=(()=>{
 'use strict';
 const WIDTH=LudusStableEnvironment.width,DEPTH=LudusStableEnvironment.depth;
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
 function relaxGroom(T,model){
  const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  function align(name,end,direction){
   const bone=bones[name],child=bones[end];if(!bone||!child)return;
   model.updateMatrixWorld(true);
   const current=child.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize();
   const target=new T.Vector3(...direction).normalize();
   const rotation=new T.Quaternion().setFromUnitVectors(current,target).multiply(bone.getWorldQuaternion(new T.Quaternion()));
   bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
  }
  for(const side of ['Left','Right']){const sign=side==='Left'?1:-1;align(side+'Arm',side+'ForeArm',[sign*.12,-1,.02]);align(side+'ForeArm',side+'Hand',[sign*.02,-1,.16]);}
  model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  return bones;
 }
 function create({T,props,colliders,wood,stone,ludusWall,shell,ambient,light,scene,outdoor,outdoorSun,getOwnerHeight=()=>1.78,player,onError,invalidateShadows=()=>{}}){
  let environment=null,root=null,template=null,horsePromise=null,groomPromise=null,groom=null,active=false,selected=null,herd=[],savedLighting=null;
  const slots=[],animals=new Map(),pool=[],bounds=[],coatMaterials=new Map();let selection=null,daylight=null,savedScene=null,shadowElapsed=0;
  const ownerHeight=()=>Math.max(1.6,Math.min(2,Number(getOwnerHeight())||1.78));
  function build(){
   environment=LudusStableEnvironment.create(T,{ludusWall,onError});root=environment.root;slots.push(...environment.slots);bounds.push(...environment.bounds);
   environment.ready.then(()=>{if(active)invalidateShadows();});
   const ring=new T.Mesh(new T.RingGeometry(.8,.85,40),new T.MeshBasicMaterial({color:0xe7ddbd,transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;selection=ring;root.add(ring);
   const g=environment.groomPosition;bounds.push({kind:'stable-groom',minX:g.x-.4,maxX:g.x+.4,minZ:g.z-.35,maxZ:g.z+.35});
   daylight=new T.DirectionalLight(0xfff0d7,2.1);daylight.name='Ahır · gün ışığı';daylight.castShadow=true;
   daylight.shadow.mapSize.set(1024,1024);Object.assign(daylight.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:1,far:100});daylight.shadow.normalBias=.035;daylight.shadow.bias=-.00015;
   daylight.target.position.set(0,0,-12.5);root.add(daylight,daylight.target);
  }
  function loadHorse(){
   if(template)return Promise.resolve(template);
   return horsePromise||(horsePromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('assets/caravan-field-v125/horse.glb',g=>{template=g;resolve(g);},undefined,reject)).catch(e=>{horsePromise=null;onError?.('At modelleri yüklenemedi. Ahıra yeniden girdiğinde tekrar denenecek.');throw e;}));
  }
  function makeHorse(){
   const animal=cloneRig(template.scene),mixer=new T.AnimationMixer(animal),idle=template.animations.find(a=>a.name==='idle_loop');if(idle){const action=mixer.clipAction(idle);action.play();action.time=((animals.size+pool.length)*.61803398875%1)*idle.duration;mixer.update(0);}
   const model=normalizeModel(T,animal,2.12),group=new T.Group(),shadow=environment.contactShadow(1.8,2.8);shadow.position.y=-.012;group.add(model,shadow);root.add(group);group.userData.kind='owned-horse';
   animal.traverse(o=>{if(o.isMesh)o.castShadow=true;});
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
    const s=slots[i];e.group.name=h.name||'At';e.group.userData.horseId=h.id;e.group.userData.coat=LudusHorseAppearance.coat(h).id;e.group.position.set(s.x,.02,s.z);e.group.rotation.y=s.yaw??(s.side<0?Math.PI/2:-Math.PI/2);e.group.scale.setScalar(h.stage==='foal'?.55:h.stage==='young'?.8:1);e.group.visible=true;applyCoat(e,h.coat);
   });
   const e=animals.get(selected?.id);selection.visible=!!e;if(e)selection.position.set(e.group.position.x,.10,e.group.position.z);
   if(active)invalidateShadows();
  }
  function loadGroom(){return groomPromise||(groomPromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('assets/caravan-v128/driver.glb',g=>{
   relaxGroom(T,g.scene);groom=normalizeModel(T,g.scene,ownerHeight());groom.position.set(environment.groomPosition.x,environment.groomPosition.y,environment.groomPosition.z);groom.rotation.y=.5;groom.name='Seyis';groom.userData.pose='relaxed-standing';root.add(groom);
   const shadow=environment.contactShadow(.8,.8);shadow.position.set(environment.groomPosition.x,.01,environment.groomPosition.z);root.add(shadow);resolve(groom);
  },undefined,reject)).catch(e=>{groomPromise=null;onError?.('Seyis modeli yüklenemedi. Ahıra yeniden girdiğinde tekrar denenecek.');throw e;}));}
  function enter(){
   active=true;if(!root)build();props.add(root);colliders.push(...bounds.map(b=>({...b})));
   if(shell)for(const mesh of [shell.floor,shell.back,shell.front,shell.ceiling,...shell.sides])mesh.visible=false;
   if(ambient&&light)savedLighting={color:ambient.color.clone(),ground:ambient.groundColor.clone(),intensity:ambient.intensity,pointIntensity:light.intensity};
   if(scene)savedScene={background:scene.background,environment:scene.environment,fog:scene.fog,backgroundIntensity:scene.backgroundIntensity};
   syncDaylight();
   environment.tick(0,player);loadHorse().then(sync).catch(()=>{});loadGroom().catch(()=>{});sync();
  }
  function leave(){
   active=false;root?.removeFromParent();
   if(shell)for(const mesh of [shell.floor,shell.back,shell.front,shell.ceiling,...shell.sides])mesh.visible=true;
   if(savedLighting){ambient.color.copy(savedLighting.color);ambient.groundColor.copy(savedLighting.ground);ambient.intensity=savedLighting.intensity;light.intensity=savedLighting.pointIntensity;savedLighting=null;}
   if(savedScene){Object.assign(scene,savedScene);savedScene=null;}
   for(let i=colliders.length-1;i>=0;i--)if(colliders[i].kind?.startsWith('stable-'))colliders.splice(i,1);
  }
  function syncDaylight(){
   if(ambient){const sky=outdoor?.children.find(o=>o.isHemisphereLight);ambient.color.copy(sky?.color||new T.Color(0xe4efff));ambient.groundColor.copy(sky?.groundColor||new T.Color(0x897654));ambient.intensity=sky?.intensity??1.35;}
   if(light)light.intensity=0;
   if(scene){scene.background=outdoor?.background||new T.Color(0xa6bdc8);scene.environment=outdoor?.environment||null;scene.fog=outdoor?.fog||null;scene.backgroundIntensity=outdoor?.backgroundIntensity??1;}
   daylight.color.copy(outdoorSun?.color||new T.Color(0xfff0d7));daylight.intensity=outdoorSun?.intensity??2.1;
   if(outdoorSun)daylight.position.copy(outdoorSun.position).sub(outdoorSun.target.position);else daylight.position.set(-13,24,-16);
   daylight.position.add(daylight.target.position);
  }
  return {
   enter,leave,setHerd(horses){herd=(horses||[]).slice(0,12);sync();},
   select(h){selected=h;if(h&&!herd.some(x=>x.id===h.id))herd=[h];sync();},
   viewFor(id){const i=herd.findIndex(h=>h.id===id),s=slots[i];return s?{...s.view}:null;},
   tick(dt){if(!active||dt<=0)return;syncDaylight();environment.tick(dt,player);shadowElapsed+=dt;if(shadowElapsed>=.25){invalidateShadows();shadowElapsed=0;}if(groom){const h=ownerHeight();if(Math.abs(h-groom.userData.height)>.001){groom.scale.setScalar(h/groom.userData.nativeHeight);groom.userData.height=h;}}
    for(const [id,e]of animals){e.elapsed+=dt;const near=!player||Math.hypot(player.x-e.group.position.x,player.z-e.group.position.z)<15;if(id===selected?.id||near){if(e.elapsed>=1/30){e.mixer.update(Math.min(e.elapsed,.15));e.elapsed=0;}}else if(e.elapsed>=.25){e.mixer.update(e.elapsed);e.elapsed=0;}}
   },
   get root(){return root;},get ready(){return environment?.ready||Promise.resolve();},get horse(){return animals.get(selected?.id)?.group||null;},get horses(){return [...animals.values()].map(e=>e.group);},get groom(){return groom;},get slots(){return slots;}
  };
 }
 return {create,normalizeModel,cloneRig,relaxGroom,width:WIDTH,depth:DEPTH,spawn:LudusStableEnvironment.spawn,version:161};
})();
if(typeof module!=='undefined')module.exports=LudusStableRoom;
