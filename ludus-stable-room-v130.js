/* Roman stable V131 lighting and environment; V130 husbandry models. Repeated architecture is instanced; owned horses share one asset. */
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
  let environment=null,root=null,template=null,horsePromise=null,groomPromise=null,groom=null,active=false,selected=null,herd=[],savedLighting=null;
  const slots=[],animals=new Map(),pool=[],bounds=[],coatMaterials=new Map();let selection=null;
  const ownerHeight=()=>Math.max(1.6,Math.min(2,Number(getOwnerHeight())||1.78));
  function build(){
   environment=LudusStableEnvironment.create(T);root=environment.root;slots.push(...environment.slots);bounds.push(...environment.bounds);
   const ring=new T.Mesh(new T.RingGeometry(.8,.85,40),new T.MeshBasicMaterial({color:0xe7ddbd,transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;selection=ring;root.add(ring);
   bounds.push({kind:'stable-groom',minX:-2.9,maxX:-2.15,minZ:.4,maxZ:1.2});
  }
  function loadHorse(){
   if(template)return Promise.resolve(template);
   return horsePromise||(horsePromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('assets/caravan-field-v125/horse.glb',g=>{template=g;resolve(g);},undefined,reject)).catch(e=>{horsePromise=null;onError?.('At modelleri yüklenemedi. Ahıra yeniden girdiğinde tekrar denenecek.');throw e;}));
  }
  function makeHorse(){
   const animal=cloneRig(template.scene),mixer=new T.AnimationMixer(animal),idle=template.animations.find(a=>a.name==='idle_loop');if(idle){mixer.clipAction(idle).play();mixer.update(0);}
   const model=normalizeModel(T,animal,2.12),group=new T.Group(),shadow=environment.contactShadow(1.8,2.8);shadow.position.y=-.012;group.add(model,shadow);root.add(group);group.userData.kind='owned-horse';
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
    const s=slots[i];e.group.name=h.name||'At';e.group.userData.horseId=h.id;e.group.userData.coat=LudusHorseAppearance.coat(h).id;e.group.position.set(s.x,.02,s.z);e.group.rotation.y=s.side<0?Math.PI/2:-Math.PI/2;e.group.scale.setScalar(h.stage==='foal'?.55:h.stage==='young'?.8:1);e.group.visible=true;applyCoat(e,h.coat);
   });
   const e=animals.get(selected?.id);selection.visible=!!e;if(e)selection.position.set(e.group.position.x,.10,e.group.position.z);
  }
  function loadGroom(){return groomPromise||(groomPromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('assets/caravan-v128/driver.glb',g=>{
   groom=normalizeModel(T,g.scene,ownerHeight());groom.position.set(-2.5,.035,.8);groom.rotation.y=.5;groom.name='Seyis';root.add(groom);resolve(groom);
  },undefined,reject)).catch(e=>{groomPromise=null;onError?.('Seyis modeli yüklenemedi. Ahıra yeniden girdiğinde tekrar denenecek.');throw e;}));}
  function enter(){
   active=true;if(!root)build();props.add(root);colliders.push(...bounds.map(b=>({...b})));
   if(shell)for(const mesh of [shell.floor,shell.back,shell.front,shell.ceiling,...shell.sides])mesh.visible=false;
   if(ambient&&light){savedLighting={color:ambient.color.clone(),ground:ambient.groundColor.clone(),intensity:ambient.intensity,pointIntensity:light.intensity};ambient.color.setHex(0xb4a18a);ambient.groundColor.setHex(0x5c442b);ambient.intensity=.38;light.intensity=0;}
   environment.tick(0,player);loadHorse().then(sync).catch(()=>{});loadGroom().catch(()=>{});sync();
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
   tick(dt){if(!active||dt<=0)return;environment.tick(dt,player);if(groom){const h=ownerHeight();if(Math.abs(h-groom.userData.height)>.001){groom.scale.setScalar(h/groom.userData.nativeHeight);groom.userData.height=h;}}
    for(const [id,e]of animals){e.elapsed+=dt;const near=!player||Math.hypot(player.x-e.group.position.x,player.z-e.group.position.z)<15;if(id===selected?.id||near){if(e.elapsed>=1/30){e.mixer.update(Math.min(e.elapsed,.15));e.elapsed=0;}}else if(e.elapsed>=.25){e.mixer.update(e.elapsed);e.elapsed=0;}}
   },
   get root(){return root;},get horse(){return animals.get(selected?.id)?.group||null;},get horses(){return [...animals.values()].map(e=>e.group);},get groom(){return groom;},get slots(){return slots;}
  };
 }
 return {create,normalizeModel,cloneRig,width:WIDTH,depth:DEPTH};
})();
if(typeof module!=='undefined')module.exports=LudusStableRoom;
