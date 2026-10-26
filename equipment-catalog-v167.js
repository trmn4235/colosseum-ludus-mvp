/* Selected equipment, loaded only when requested. Source FBXs are not distributed.
   Credits and material changes: assets/equipment-v167/CREDITS.md. */
(function(root){
 'use strict';
 const records=Object.freeze({
  manica_segmented:Object.freeze({id:'manica_segmented',label:'Plakalı gladyatör kolluğu',kind:'gloves',file:'../equipment-v197/manica_segmented.cme',triangles:2450,height:0.25,armour:true,side:'Right'}),
  manica_lion:Object.freeze({id:'manica_lion',label:'Aslan başlı gladyatör kolluğu',kind:'gloves',file:'../equipment-v197/manica_lion.cme',triangles:2687,height:0.25,armour:true,side:'Right'}),
  trident_gladiator:Object.freeze({id:'trident_gladiator',label:'Gladyatör tridenti',kind:'weapon',file:'../equipment-v197/trident_gladiator.cme',triangles:1368,height:2.16,subcategory:'polearms'}),
  manica_leather:Object.freeze({id:'manica_leather',label:'Tokalı deri kolluk',kind:'gloves',file:'../equipment-v197/manica_leather.cme',triangles:3177,height:0.25,armour:true,side:'Right'}),
  halberd:Object.freeze({id:'halberd',label:'Halberd',kind:'weapon',subcategory:'swords',file:'../equipment-v193/halberd.cme',triangles:2899,height:1.80}),
  pit_axe:Object.freeze({id:'pit_axe',label:'Balta',kind:'weapon',venue:'pit',file:'../pit-v192/pit_axe.cme',triangles:1585,height:.90}),
  pit_stone_mace:Object.freeze({id:'pit_stone_mace',label:'Taş gürz',kind:'weapon',venue:'pit',file:'../pit-v173/pit_stone_mace.cme',triangles:1908,height:.94}),
  pit_wood_mace:Object.freeze({id:'pit_wood_mace',label:'Ahşap gürz',kind:'weapon',venue:'pit',file:'../pit-v173/pit_wood_mace.cme',triangles:3580,height:.84}),
  warhammer:Object.freeze({id:'warhammer',label:'Savaş çekici',kind:'weapon',subcategory:'blunt',file:'warhammer.cme',triangles:5332,height:1.094,paint:'Koyu çelik, eskitilmiş bronz, deri'}),
  heavy_mace:Object.freeze({id:'heavy_mace',label:'Ağır gürz',kind:'weapon',subcategory:'blunt',file:'heavy_mace.cme',triangles:3126,height:1.078,paint:'Dövme çelik, bronz, deri ve ahşap'}),
  viking_helmet:Object.freeze({id:'viking_helmet',label:'Boynuzlu Viking miğferi',kind:'helmet',file:'../equipment-v189/viking_helmet.cme',triangles:4076,height:.33,paint:'sujanmondals605 · hafifletilmiş oyun modeli'}),
  steel_helmet:Object.freeze({id:'steel_helmet',label:'Çelik miğfer',kind:'helmet',file:'../equipment-v189/steel_helmet.cme',triangles:2358,height:.35,paint:'lesrode · özgün dokular, hafifletilmiş model'}),
  sylvain_helmet:Object.freeze({id:'sylvain_helmet',label:'Vizörlü gladyatör miğferi',kind:'helmet',file:'../equipment-v195/sylvain_helmet.cme',triangles:6652,height:.36,paint:'Sylvain Delandre · hafifletilmiş özgün dokular'})
 });
 const cache=new Map(),pending=new Map(),failures=new Map(),waiting=new Map();let revision=0;
 const signature=new Uint8Array([67,77,69,49,54,55,0,1]);
 // Client resource format, not a secret or a promise of DRM security.
 const keyBytes=new Uint8Array([208,72,199,66,217,77,28,174,206,97,233,116,84,211,101,150,96,56,75,205,232,216,123,120,80,21,163,4,179,62,121,210]);
 function entry(id){return records[id]||null;}
 async function decode(buffer){
  const bytes=new Uint8Array(buffer);if(bytes.length<36||!signature.every((v,i)=>bytes[i]===v))throw Error('Ekipman paketi geçersiz');
  if(!root.crypto?.subtle)throw Error('Ekipman için güvenli bağlantı gerekiyor');
  const key=await root.crypto.subtle.importKey('raw',keyBytes,'AES-GCM',false,['decrypt']);
  const raw=await root.crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(8,20),additionalData:signature},key,bytes.slice(20));
  const h=new DataView(raw);if(raw.byteLength<12||h.getUint32(0,true)!==0x46546c67||h.getUint32(4,true)!==2||h.getUint32(8,true)!==raw.byteLength)throw Error('Ekipman modeli geçersiz');return raw;
 }
 async function load(T,id,options={}){
  if(!entry(id))throw Error('Bilinmeyen ekipman: '+id);if(cache.has(id))return cache.get(id);if(pending.has(id))return pending.get(id);
  const task=(async()=>{
   let bytes=options.bytes;
   if(!bytes){const response=await root.fetch('assets/equipment-v167/'+records[id].file);if(!response.ok)throw Error('Ekipman indirilemedi ('+response.status+')');bytes=await response.arrayBuffer();}
   const model=await new T.GLTFLoader().parseAsync(await decode(bytes),'');const group=model.scene;
   // V172: the forged-steel primitive is the head. Bronze shaft, pommel and leather stay byte-for-byte unchanged.
   if(id==='warhammer')group.traverse(o=>{if(o.isMesh&&o.material?.name==='Forged dark steel'){const g=o.geometry.clone();g.computeBoundingBox();const c=g.boundingBox.getCenter(new T.Vector3());g.translate(-c.x,-c.y,-c.z);g.scale(.75,.75,.75);g.translate(c.x,c.y,c.z);g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;o.userData.headScale=.75;}});
   group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(group),size=box.getSize(new T.Vector3());if(!Number.isFinite(size.y)||size.y<=0)throw Error('Ekipman ölçüsü geçersiz');
   if(records[id].kind==='helmet'){const c=box.getCenter(new T.Vector3()),s=records[id].height/size.y;const wrapper=new T.Group();wrapper.add(group);group.scale.multiplyScalar(s);group.position.sub(c.multiplyScalar(s));wrapper.userData.catalogId=id;cache.set(id,wrapper);}else if(id==='halberd'){const wrapper=new T.Group();wrapper.add(group);group.rotation.y=Math.PI/2;cache.set(id,wrapper);}else cache.set(id,group);
   const result=cache.get(id);result.name=records[id].label;result.userData.catalogId=id;result.userData.materialVersion=167;
   result.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{m.envMapIntensity=.8;});}});
   revision++;failures.delete(id);return result;
  })().catch(error=>{failures.set(id,error.message);throw error;}).finally(()=>pending.delete(id));
  pending.set(id,task);return task;
 }
 function request(T,id){
  if(!entry(id))return null;if(cache.has(id))return cache.get(id);
  if(!pending.has(id)&&!failures.has(id))load(T,id).catch(()=>{});
  if(!waiting.has(id)){const g=new T.Group();g.name='Ekipman yükleniyor';g.userData.catalogId=id;waiting.set(id,g);}return waiting.get(id);
 }
 root.LudusEquipmentCatalog=Object.freeze({version:167,records,entry,load,request,decode,get:id=>cache.get(id)||null,error:id=>failures.get(id)||null,retry:id=>failures.delete(id),get revision(){return revision;}});
})(typeof window!=='undefined'?window:globalThis);
