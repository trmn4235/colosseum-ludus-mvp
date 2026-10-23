var ColosseumEnvironment=(function(){
'use strict';
function prepare(source,renderer){
 source.scale.setScalar(.01);source.updateMatrixWorld(true);
 const groups=new Map(),result=new THREE.Group();result.name='Neberkenezer_Colosseum';
 source.traverse(o=>{
  if(!o.isMesh)return;
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
  // This static asset uses one material per primitive. Normalize attributes for batching.
  for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
  if(!g.attributes.normal)g.computeVertexNormals();
  const material=o.material,key=material.uuid+':'+Object.keys(g.attributes).sort().join(',')+':'+!!g.index;
  if(!groups.has(key))groups.set(key,{material,geometries:[]});
  groups.get(key).geometries.push(g);
 });
 for(const {material,geometries} of groups.values()){
  // Diffuse concept textures already contain painted shading. Avoid glossy stone.
  material.metalness=0;material.roughness=1;material.envMapIntensity=.15;
  material.side=THREE.DoubleSide;
  if(material.map){material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());material.map.needsUpdate=true;}
  const merged=ArenaGeometryUtils.mergeGeometries(geometries,false);
  if(!merged)throw new Error('Kolezyum geometrisi birleştirilemedi.');
  const m=new THREE.Mesh(merged,material);m.name=material.name;m.receiveShadow=true;m.castShadow=false;result.add(m);
  geometries.forEach(g=>g.dispose());
 }
 // Original geometries are no longer needed; shared textures remain owned by result.
 const old=new Set();source.traverse(o=>{if(o.geometry)old.add(o.geometry);});old.forEach(g=>g.dispose());
 result.userData={sourceMeshes:old.size,drawGroups:result.children.length};
 return result;
}
async function load(scene,renderer,status){
 const loader=new THREE.GLTFLoader();
 const names=['Colosseum.glb','colosseum.glb','previz-lowpoly_colosseum_with_concept_textures..glb'];
 let data;
 if(typeof ArenaAssetLoad==='function')data=await ArenaAssetLoad('Colosseum.glb',status,'Kolezyum');
 else for(const name of names){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  try{
   status('Kolezyum yükleniyor…');
   const response=await fetch(new URL(name,typeof ARENA_ASSET_BASE==='string'?ARENA_ASSET_BASE:document.baseURI),{signal:controller.signal});
   if(response.status===404)continue;
   if(!response.ok)throw new Error('HTTP '+response.status);
   if(!response.body){data=await response.arrayBuffer();break;}
   const reader=response.body.getReader(),chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;status('Kolezyum: '+(size/1e6).toFixed(1)+' MB / 15,8 MB');}
   const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}data=bytes.buffer;break;
  }catch(e){throw new Error('Kolezyum yüklenemedi. Bağlantını kontrol edip tekrar dene.');}
  finally{clearTimeout(timer);}
 }
 if(!data)throw new Error('Colosseum.glb bulunamadı. R2 dosya adını kontrol et; büyük C harfini koru.');
 status('Kolezyum hazırlanıyor…');
 let gltf;try{gltf=await loader.parseAsync(data,'');}catch(e){throw new Error('Kolezyum modeli veya dokuları açılamadı. Colosseum.glb dosyasını yeniden yükle.');}
 const model=prepare(gltf.scene,renderer);scene.add(model);return model;
}
return {load,prepare};
})();

(()=>{
 'use strict';
 const $=id=>document.getElementById(id),client=(globalThis.LudusClient?.create||supabase.createClient)(ARENA_SUPABASE_CONFIG.url,ARENA_SUPABASE_CONFIG.publishableKey);
 const icons={
 target:'<circle cx="12" cy="12" r="6"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/>',
 hand:'<path d="M4 9a8 8 0 0 1 14-3l2 3M20 3v6h-6M20 15a8 8 0 0 1-14 3l-2-3M4 21v-6h6"/>',
 block:'<path d="M4 4l8-2 8 2v8c0 5-8 10-8 10S4 17 4 12zM12 4v15"/>',
 attack:'<path d="M7 17L20 3l1 5L10 19M5 13l7 7M4 21l4-5"/>',
 special:'<path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
 dodge:'<path d="M19 7a8 8 0 1 0 1 9M19 3v5h-5 M10 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M9 12l-3 3 4 3 5-2-2-4z M15 16l2 3"/>'};
 const control=(id,icon,label,aria)=>'<button id="'+id+'" class="mp-action" type="button" aria-label="'+aria+'" title="'+aria+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+icons[icon]+'</svg>'+(label?'<small>'+label+'</small>':'')+'</button>';
 $('duelControls').innerHTML='<div id="duelStick" role="group" aria-label="Hareket çubuğu"><div id="duelKnob"></div><span>HAREKET</span></div><div id="duelActions">'+
 control('duelTarget','target','','Hedef kilidini aç veya kapat')+
 control('duelHand','hand','','Saldırı için ekipman değiştir')+
 control('duelSpecial','special','ÇEK','Kırbaçla çek')+
 control('duelBlock','block','BLOK','Kalkanı tut')+
 control('duelAttack','attack','SALDIR','Saldır; kaydırarak vuruş bölgesi seç')+
 control('duelDodge','dodge','YUVARLAN','Yuvarlanarak kaçın')+'</div><div id="duelRegionHint" hidden role="status"></div>';
 $('mpBack').textContent='‹';$('mpBack').setAttribute('aria-label','Savaş hazırlığına dön');
 for(const id of ['self','rival']){const meter=document.createElement('progress');meter.id=id+'Stamina';meter.className='mp-stamina';meter.max=meter.value=100;meter.setAttribute('aria-label',id==='self'?'Kondisyonun':'Rakibin kondisyonu');$(id+'Hp').after(meter);$(id+'Hp').setAttribute('aria-label',id==='self'?'Canın':'Rakibin canı');}
 const foodBonusLabel=document.createElement('small');foodBonusLabel.id='selfFoodBonus';foodBonusLabel.className='mp-food-bonus';foodBonusLabel.hidden=true;$('selfStamina').after(foodBonusLabel);
 let selectedRegion='chest',attackRegion='chest',hand='main_hand',attackHand='main_hand',attackGesture=null,dodgeId=null,dodge=false,preparePromise=null;
 const blockPointers=new Set();
 let owner=null,room=null,pending=false,stopped=false,scene,renderer,camera,ready=false,last=performance.now(),keys=new Set(),joy={x:0,z:0},attacks=0,special=false,specialId=null,specialHand=null,specialTarget=null,block=false,failure=0,locked=null,clockOffset=0,attackId=null,inputDirty=false,nextStep=null;
 const models=new Map(),states=new Map(),whipLines=new Map(),projectileViews=new Map();
 const selection=(()=>{try{return JSON.parse(sessionStorage.getItem('ludus-duel-selection')||'null');}catch{return null;}})();
 const pitRequested=new URLSearchParams(location.search).get('venue')==='pit';const roomKey=pitRequested?'ludus-pit-room':'ludus-match-room';
 if(pitRequested){document.querySelector('.queue-sky').style.background="url('assets/pit-v173/map.webp') center/cover";document.querySelector('.queue-colosseum').style.display='none';document.querySelector('.queue-beta').textContent='4 KİŞİ · ZIRHSIZ';document.querySelector('.queue-title h1').textContent='ŞAN AVLUSU';document.querySelector('.mp-top strong').textContent='ŞAN AVLUSU · HERKES TEK';document.querySelector('.queue-title>span').textContent='4 KİŞİ · HERKES TEK';document.querySelector('.mp-rule').textContent='Galibiyet +1 Şan · Avlu silahları · Zırhsız';document.querySelector('#duelResult p').textContent='Şan sonucu hesabına kaydedildi · Ekipmanın korundu';}
 function fitViewport(){const h=Math.round(Math.min(innerHeight,window.visualViewport?.height||innerHeight));for(const el of [document.documentElement,document.body]){el.style.setProperty('height',h+'px','important');el.style.setProperty('min-height','0','important');}document.documentElement.style.setProperty('--game-height',h+'px');}
 window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);fitViewport();
 function message(t){$('mpStatus').textContent=t;}
 function makeStage(){
  renderer=ArenaCreateRenderer({canvas:$('duelCanvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.3));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  scene=new THREE.Scene();scene.background=new THREE.Color('#a9c9de');scene.fog=new THREE.Fog('#cbbfa6',80,180);RomanVisualAssets.environment(scene);camera=new THREE.PerspectiveCamera(48,1,.1,250);
  scene.add(new THREE.HemisphereLight(0xfff4db,0x655340,1.6));const sun=new THREE.DirectionalLight(0xffe8bf,2);sun.position.set(25,55,30);scene.add(sun);
  const material=new THREE.MeshStandardMaterial({color:0xe0c79e,roughness:1});RomanVisualAssets.material(material,'sand_01',1/1.5,.32,true);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(56,96),material);floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);if(pitRequested)floor.visible=false;
 }
 function prepare(){if(ready)return Promise.resolve();if(preparePromise)return preparePromise;
  if(!renderer)makeStage();
  preparePromise=Promise.all([ImportedGladiator.load(t=>{$('queueMessage').textContent=t;}),(pitRequested?Promise.all([PitArena.load(scene,renderer),PitArena.preload()]):ColosseumEnvironment.load(scene,renderer,t=>{$('queueCaption').textContent=t;}))]).then(()=>{ready=true;syncModels();}).catch(e=>{preparePromise=null;throw e;});
  return preparePromise;
 }
 function active(){return ready&&!stopped&&room?.status==='playing'&&(me()?.hp||0)>0;}
 function enhanced(){return (room?.controls_version||0)>=36;}
 function weapons(){return(me()?.items||[]).filter(i=>i.kind==='weapon'&&['main_hand','off_hand'].includes(i.equipped_slot));}
 function selectedWeapon(){return weapons().find(i=>i.equipped_slot===hand)||weapons()[0];}
 function throwable(){return(room?.controls_version||0)>=76&&['gladius','sica','spear','trident'].includes(selectedWeapon()?.model);}
 function canAct(cost){if(!active())return false;if(enhanced()&&(me().stamina??100)<cost){message('Kondisyonun dolmasını bekle.');return false;}return true;}
 function me(){return room?.players.find(p=>p.owner===owner);}
 function rivals(){return (room?.players||[]).filter(p=>p.owner!==owner&&p.hp>0);}
 function target(){const p=me(),alive=rivals();if(!p||!alive.length)return null;if(locked)return alive.find(x=>x.owner===locked)||null;return alive.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];}
 function syncModels(){if(!ready||!room||room.status==='waiting')return;for(const p of room.players){if(models.has(p.owner))continue;const i=models.size,m=ImportedGladiator.create(i,p.class);models.set(p.owner,m);scene.add(m.root);const f=new ArenaCombat().reset('normal',p.class).fighters[0];LudusLoadout.apply(f,p.gladiator,p.items);if(pitRequested&&room.pit_version===173)PitArena.equip(f,p.items?.find(i=>i.equipped_slot==='main_hand'));Object.assign(f,{id:i,team:i,name:p.name,x:p.x,z:p.z,angle:p.angle,action:'idle',hp:p.hp,maxHp:p.maxHp??100,maxStamina:p.maxStamina??100,stamina:p.stamina??100,timer:0,deadTime:0,_serial:p.serial,_defenseSerial:p.defense_serial||0,_hp:p.hp,_gearSerial:p.gear_serial||0});states.set(p.owner,f);m.teamMark.visible=false;}}
 function updateLobby(){if(!room||room.status!=='waiting')return;const ms=Math.max(0,Date.parse(room.starts_at)-(Date.now()+clockOffset)),sec=Math.ceil(ms/1000);$('queueSeconds').textContent=String(sec).padStart(2,'0');$('queueRing').style.setProperty('--queue-progress',Math.max(0,Math.min(1,ms/10000)));$('queueProgress').style.width=(100-ms/100)+'%';$('queueCaption').textContent=sec?'ARENA KAPILARI AÇILIYOR':'SON KONTROLLER';}
 function showState(data){room=data;syncModels();const p=me(),t=target();if(locked&&!rivals().some(r=>r.owner===locked))locked=null;
  $('selfName').textContent=p?.name||'Sen';$('rivalName').textContent=t?.name||'Hedef seç';$('selfHp').max=p?.maxHp??100;$('rivalHp').max=t?.maxHp??100;$('selfHp').value=p?.hp??100;$('rivalHp').value=t?.hp??100;$('aliveCount').textContent=String(room.players.filter(x=>x.hp>0).length);
  const waiting=room.status==='waiting';$('matchLobby').hidden=!waiting;$('mpBattleHud').hidden=waiting;$('duelControls').hidden=waiting||p?.hp<=0;
  $('queueCount').textContent=String(room.players.length);$('queueMessage').textContent=pitRequested?`${room.players.length} / 4 gladyatör · Dört kişi tamamlanınca kapılar açılır.`:room.players.length<2?'İlk gladyatör sensin. En az iki oyuncuyla kapılar açılır.':'Bu geri sayım bitmeden katılan herkes aynı arenaya girer.';
  if(!weapons().some(i=>i.equipped_slot===hand))hand=weapons()[0]?.equipped_slot||'main_hand';
  $('duelSpecial').hidden=!throwable()&&selectedWeapon()?.model!=='whip';$('duelSpecial').querySelector('small').textContent=throwable()?'FIRLAT':'ÇEK';$('duelSpecial').setAttribute('aria-label',throwable()?'Seçili silahı fırlat · 26 kondisyon':'Kırbaçla çek');$('duelSpecial').title=throwable()?'Silah bu maçta elden çıkar; envanterinde kalır. 26 kondisyon.':'Kırbaçla çek';$('duelHand').hidden=!enhanced()||weapons().length<2;$('duelHand').classList.toggle('off-hand',hand==='off_hand');$('duelDodge').hidden=!enhanced();
  $('duelBlock').disabled=!(p?.items||[]).some(i=>i.kind==='shield'&&i.equipped_slot==='off_hand');$('duelBlock').setAttribute('aria-pressed',String(block));
  for(const [id,f] of [['self',p],['rival',t]]){$(id+'Hp').max=f?.maxHp||100;$(id+'Stamina').max=f?.maxStamina||100;$(id+'Stamina').value=f?.stamina??100;$(id+'Stamina').hidden=!enhanced();}
  const foodBonus=Math.min(12,Math.max(0,Number(p?.gladiator?.combat_stamina_bonus)||0));const morale=Math.min(100,Math.max(0,Number(p?.gladiator?.combat_morale??50)));foodBonusLabel.hidden=!enhanced()||(!foodBonus&&morale===50)||p?.hp<=0||room.status!=='playing';foodBonusLabel.textContent='Beslenme +%'+foodBonus+' · Moral '+morale;foodBonusLabel.title='Kondisyon yenilenmesi: beslenme ×'+(1+foodBonus/100).toFixed(2)+' · moral ×'+(1+(morale-50)/1000).toFixed(3);
  $('duelDodge').disabled=enhanced()&&(p?.stamina??100)<18;
  document.querySelector('.mp-rule').textContent=pitRequested?'Galibiyet +1 Şan · Avlu silahları · Zırhsız':throwable()?'Fırlat: 26 kondisyon · Silah maç sonuna kadar elden çıkar.':'Multiplayer Beta · Ödül ve kalıcı eşya kaybı yok';
  $('duelTarget').classList.toggle('locked',!!locked);$('duelTarget').setAttribute('aria-pressed',String(!!locked));
  $('queueNames').textContent=room.players.slice(0,6).map(x=>x.name).join(' · ')+(room.players.length>6?' · +'+(room.players.length-6):'');
  updateLobby();message(waiting?(pitRequested?'Dört kişi bekleniyor · Herkes tek':'Ortak maç kuyruğu'):p?.hp<=0?'Elendin · Maçı izliyorsun':room.combat_version===23&&Date.parse(p?.counter_until)>Date.now()+clockOffset?'Karşı vuruş hazır · Saldırı tuşunu kullan.':'Multiplayer · Son kalan kazanır');
  if(room.status==='finished'){stopped=true;$('duelControls').hidden=true;$('matchLobby').hidden=true;$('duelResult').hidden=false;$('resultTitle').textContent=room.winner===owner?'Zafer!':room.winner?'Savaş tamamlandı':'Maç iptal edildi';sessionStorage.removeItem(roomKey);}
 }
 async function rpc(args){let timer;const started=performance.now();try{const result=await Promise.race([client.rpc('ludus_match',args),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bağlantı zaman aşımı')),10000);})]);if(result.data?.server_now)clockOffset=Date.parse(result.data.server_now)+(performance.now()-started)/2-Date.now();return result;}finally{clearTimeout(timer);}}
 function queueStep(){inputDirty=true;if(!pending&&!stopped&&room){clearTimeout(nextStep);step();}}
 function queueAttack(region=selectedRegion){if(!canAct(13)||attacks)return;attackRegion=region;attackHand=hand;attackId=crypto.randomUUID();attacks=1;queueStep();}
 let dodgeKind='step';
 function queueDodge(kind='step'){if(!enhanced()||!canAct(kind==='roll'?25:kind==='jump'?22:18)||dodge)return;dodgeKind=kind;dodgeId=crypto.randomUUID();dodge=true;queueStep();}
 function castSpecial(){
  const throwing=throwable(),p=me(),t=target();if(special||(!throwing&&selectedWeapon()?.model!=='whip')||!canAct(throwing?26:28))return;
  if(!locked||!t){message('Özel hareket için önce hedefe kilitlen.');return;}
  const range=throwing?(['gladius','sica'].includes(selectedWeapon().model)?4.5:9):2;
  if(Math.hypot(t.x-p.x,t.z-p.z)>range){message('Hedef menzil dışında. Biraz yaklaş.');return;}
  if(Date.parse(p.cooldown_until)>Date.now()+clockOffset||Date.parse(p.special_at)+(throwing?8000:6000)>Date.now()+clockOffset){message('Özel hareketin yeniden hazır olmasını bekle.');return;}
  special=true;specialId=crypto.randomUUID();specialHand=hand;specialTarget=locked;queueStep();
 }
 function changeHand(){if(!active())return;const w=weapons();if(w.length<2)return;hand=w.find(i=>i.equipped_slot!==hand).equipped_slot;showState(room);message(hand==='off_hand'?'Sol el silahı seçili.':'Sağ el silahı seçili.');}
 function setBlock(value){if(block===value)return;block=value;$('duelBlock').classList.toggle('pressed',value);queueStep();}
 async function step(){if(pending||stopped||!room)return;inputDirty=false;if(document.hidden){setTimeout(step,500);return;}pending=true;const sent=attacks,sentId=attackId,cast=special,castId=specialId,evade=dodge,sentDodge=dodgeId,p=me(),t=target(),x=joy.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),z=joy.z+(keys.has('KeyW')||keys.has('ArrowUp')?-1:0)+(keys.has('KeyS')||keys.has('ArrowDown')?1:0),dx=(t?.x??0)-(p?.x??0),dz=(t?.z??-1)-(p?.z??0),len=Math.max(.01,Math.hypot(dx,dz));
  try{const r=await rpc({p_action:'step',p_room:room.id,p_input:{x:x*dz/len-z*dx/len,z:-x*dx/len-z*dz/len,attack:sent>0,attack_id:sentId||null,region:attackRegion,hand:cast?specialHand:sent?attackHand:hand,dodge:evade,dodge_id:sentDodge||null,dodge_kind:dodgeKind,block,special:cast,special_id:castId,target:cast?specialTarget:locked||''}});if(r.error)throw r.error;if(sent&&sentId===attackId){attacks=0;attackId=null;}if(cast&&castId===specialId){special=false;specialId=null;specialHand=null;specialTarget=null;}if(evade&&sentDodge===dodgeId){dodge=false;dodgeId=null;}showState(r.data);failure=0;}
  catch(e){failure++;message('Bağlantı bekleniyor…');if(failure>20){stopped=true;message('Bağlantı koptu. Tekrar bağlan.');$('duelControls').hidden=true;$('mpRetry').hidden=false;}}
  finally{pending=false;if(!stopped)nextStep=setTimeout(step,inputDirty?0:room?.status==='waiting'?300:120);}
 }
 async function join(){if(pending||!ready||stopped)return;pending=true;stopped=false;message('Maç aranıyor…');try{const a=await client.auth.getUser();if(a.error||!a.data.user||a.data.user.is_anonymous)throw Error('Hesabına giriş yap.');owner=a.data.user.id;const saved=sessionStorage.getItem(roomKey);let r=saved?await rpc({p_action:'state',p_room:saved}):null;if(r?.error||r?.data?.status==='finished')r=null;
  if(!r){if(!selection?.gladiator)throw Error('Önce gladyatörünü seç.');r=await rpc({p_action:'join',p_gladiator:selection.gladiator,p_slots:pitRequested?{}:selection.slots||{},p_input:{venue:pitRequested?'pit':'colosseum',pit_weapon:selection.pit_weapon}});}if(r.error)throw r.error;sessionStorage.setItem(roomKey,r.data.id);showState(r.data);pending=false;step();}
  catch(e){message(e.message||'Maç başlatılamadı.');$('queueMessage').textContent=e.message||'Bağlantı kurulamadı.';$('mpRetry').hidden=false;}finally{pending=false;}
 }
 function travelBack(){if(pitRequested){location.href='san-avlusu.html?v=revision172';return;}if(globalThis.LudusNavigation)LudusNavigation.back();else location.href='savas.html?v=revision84';}
 async function leave(){if($('mpBack').disabled)return;stopped=true;$('mpBack').disabled=$('queueCancel').disabled=true;try{while(pending)await new Promise(r=>setTimeout(r,20));if(room&&room.status!=='finished'){const r=await rpc({p_action:'leave',p_room:room.id});if(r.error)throw r.error;}sessionStorage.removeItem(roomKey);travelBack();}catch(e){message('Çıkış kaydedilemedi. Tekrar dene.');$('mpBack').disabled=$('queueCancel').disabled=false;stopped=false;step();}}
 $('mpBack').onclick=$('queueCancel').onclick=leave;$('mpRetry').onclick=()=>{$('mpRetry').hidden=true;join();};$('resultBack').onclick=travelBack;
 const stick=$('duelStick');let pointer=null;
 function resetStick(){pointer=null;joy={x:0,z:0};$('duelKnob').style.transform='';}
 function move(e){if(e.pointerId!==pointer)return;const b=stick.getBoundingClientRect(),rad=b.width*.32,dx=(e.clientX-b.left-b.width/2)/rad,dz=(e.clientY-b.top-b.height/2)/rad,len=Math.max(1,Math.hypot(dx,dz));joy={x:dx/len,z:dz/len};$('duelKnob').style.transform='translate('+joy.x*rad+'px,'+joy.z*rad+'px)';}
 stick.onpointerdown=e=>{if(!active()||pointer!==null)return;e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(pointer);move(e);queueStep();};
 stick.onpointermove=e=>{if(e.pointerId===pointer){e.preventDefault();move(e);}};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,e=>{if(e.pointerId===pointer){resetStick();queueStep();}});
 function gestureRegion(e){const dx=e.clientX-attackGesture.x,dy=e.clientY-attackGesture.y;if(Math.hypot(dx,dy)<16)return 'chest';return Math.abs(dy)>Math.abs(dx)?dy<0?'head':'legs':dx<0?'leftArm':'rightArm';}
 $('duelAttack').onpointerdown=e=>{if(!active()||attackGesture)return;e.preventDefault();attackGesture={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);$('duelRegionHint').hidden=false;$('duelRegionHint').textContent='↑ Baş · ↓ Bacak · ← / → Kol';};
 $('duelAttack').onpointermove=e=>{if(attackGesture?.id!==e.pointerId)return;selectedRegion=gestureRegion(e);$('duelRegionHint').textContent=ArenaMotion.regions[selectedRegion].name;};
 $('duelAttack').onpointerup=e=>{if(attackGesture?.id!==e.pointerId)return;e.preventDefault();const region=gestureRegion(e);attackGesture=null;selectedRegion=region;$('duelRegionHint').hidden=true;queueAttack(region);};
 for(const type of ['pointercancel','lostpointercapture'])$('duelAttack').addEventListener(type,e=>{if(attackGesture?.id===e.pointerId){attackGesture=null;$('duelRegionHint').hidden=true;}});
 $('duelAttack').onclick=e=>{if(e.detail===0)queueAttack();};
 CombatEvasionControls.mount({parent:$('duelControls'),active,perform:queueDodge});
 $('duelDodge').setAttribute('aria-label','Kaçın · L');if($('duelDodge').querySelector('small'))$('duelDodge').querySelector('small').textContent='KAÇIN';
 $('duelDodge').onpointerdown=e=>{e.preventDefault();queueDodge();};$('duelDodge').onclick=e=>{if(e.detail===0)queueDodge();};
 $('duelSpecial').onclick=castSpecial;$('duelHand').onclick=changeHand;
 $('duelBlock').onpointerdown=e=>{if(!active()||e.currentTarget.disabled)return;e.preventDefault();blockPointers.add(e.pointerId);e.currentTarget.setPointerCapture(e.pointerId);setBlock(true);};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])$('duelBlock').addEventListener(type,e=>{blockPointers.delete(e.pointerId);if(!blockPointers.size&&!keys.has('KeyK')&&!keys.has('ShiftLeft'))setBlock(false);});
 function cycle(){const r=rivals(),i=r.findIndex(x=>x.owner===locked);locked=i===r.length-1?null:r[i+1]?.owner||null;if(room)showState(room);queueStep();}
 $('duelTarget').onclick=()=>{locked=locked?null:target()?.owner||null;if(room)showState(room);queueStep();};
 const ray=new THREE.Raycaster();$('duelCanvas').onpointerup=e=>{if(!active())return;const b=e.currentTarget.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);for(const id of rivals().map(p=>p.owner)){if(models.has(id)&&ray.intersectObject(models.get(id).root,true).length){locked=id;showState(room);queueStep();return;}}};
 window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||!active())return;
  if(!/^(Key[WASDJKLQERHCVB]|Digit[1-5]|Arrow.*|Space|ShiftLeft|Tab)$/.test(e.code))return;e.preventDefault();keys.add(e.code);
  if(!e.repeat){if(e.code==='KeyJ'||e.code==='Space')queueAttack();if(e.code==='KeyL')queueDodge();if(e.code==='KeyC')queueDodge('duck');if(e.code==='KeyV')queueDodge('jump');if(e.code==='KeyB')queueDodge('roll');if(e.code==='KeyK'||e.code==='ShiftLeft')setBlock(true);if(e.code==='Tab')cycle();if(e.code==='KeyE')$('duelTarget').click();if(e.code==='KeyQ')castSpecial();if(e.code==='KeyR'||e.code==='KeyH')changeHand();if(e.code.startsWith('Digit')){selectedRegion=Object.keys(ArenaMotion.regions)[Number(e.code.slice(-1))-1];message(ArenaMotion.regions[selectedRegion].name);}}queueStep();
 });
 window.addEventListener('keyup',e=>{keys.delete(e.code);if((e.code==='KeyK'||e.code==='ShiftLeft')&&!blockPointers.size&&!keys.has('KeyK')&&!keys.has('ShiftLeft'))setBlock(false);});
 function clear(){keys.clear();blockPointers.clear();resetStick();attackGesture=null;$('duelRegionHint').hidden=true;attacks=0;attackId=null;dodge=false;dodgeId=null;special=false;specialId=null;specialHand=null;specialTarget=null;setBlock(false);}
 window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 $('duelControls').addEventListener('contextmenu',e=>e.preventDefault());
 function frame(t){requestAnimationFrame(frame);const dt=Math.min(.05,(t-last)/1000);last=t;if(document.hidden)return;updateLobby();if(!renderer)return;const c=$('duelCanvas'),w=c.clientWidth,h=c.clientHeight;if(c.width!==Math.round(w*renderer.getPixelRatio())||c.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  if(room?.status!=='waiting'&&states.size){for(const p of room.players){const f=states.get(p.owner),m=models.get(p.owner);if(!f||!m)continue;if((p.gear_serial||0)!==f._gearSerial){LudusLoadout.apply(f,p.gladiator,p.items);if(pitRequested&&room.pit_version===173)PitArena.equip(f,p.items?.find(i=>i.equipped_slot==='main_hand'));f._gearSerial=p.gear_serial||0;}f.x+=(p.x-f.x)*(1-Math.exp(-dt*16));f.z+=(p.z-f.z)*(1-Math.exp(-dt*16));f.angle+=Math.atan2(Math.sin(p.angle-f.angle),Math.cos(p.angle-f.angle))*(1-Math.exp(-dt*16));f.hp=p.hp;f.maxHp=p.maxHp??100;f.maxStamina=p.maxStamina??100;f.stamina=p.stamina??100;f.move=p.move||0;f.walk=(f.walk||0)+dt*f.move*7;f.blocking=p.block;f.reaction=Math.max(0,(f.reaction||0)-dt);f.passiveEvade=Math.max(0,(f.passiveEvade||0)-dt);f.guardFlash=Math.max(0,(f.guardFlash||0)-dt);if(f.hp<f._hp){f.reaction=.32;f.lastRegion=p.hit_region||'chest';const source=room.players.find(a=>a.owner===p.hit_from);f.impactDirection=source?Math.atan2(source.x-p.x,source.z-p.z)-p.angle:0;f.impactStrength=.65*(source?ArenaMotion.impactQuality({...source,attackWeapon:source.strike_weapon},p):1);}f._hp=f.hp;
   const serverTime=Date.now()+clockOffset;
   if(p.serial!==f._serial){f._serial=p.serial;f.action='attack';f.timer=0;f.attackRegion=p.strike_region||'chest';f.attackWeapon=p.strike_weapon||f.weapon;f.attackLeft=p.strike_hand==='off_hand';f.chain=1+(Math.max(1,p.serial)-1)%3;f.recoilSample=null;
    f.attackProfile=room.combat_version===23?{wind:p.wind,active:p.active,recover:p.recover,duration:p.wind+p.active+p.recover,pole:['spear','trident'].includes(f.attackWeapon),length:ArenaMotion.profile(f.attackWeapon).length}:ArenaMotion.profile(f.attackWeapon);f.duration=f.attackProfile.duration;}
   if(room.combat_version===23){
    if(Date.parse(p.recoil_until)>serverTime){
     if(!['recoil','stagger'].includes(f.action)){const contact={...f,action:'attack',timer:Number(p.recoil_elapsed)||0};f.recoilBody=ArenaMotion.body(contact);f.recoilSample=ArenaMotion.sample(contact);f.recoilPhase=ArenaAuthoredCombat.phase(contact);}
     f.action=Date.parse(p.stagger_until)>serverTime?'stagger':'recoil';f.timer=Math.max(0,(serverTime-Date.parse(p.recoil_at))/1000);f.duration=(Date.parse(p.recoil_until)-Date.parse(p.recoil_at))/1000;
    }else if(Date.parse(p.throw_until)>serverTime){
     f.action='spearcast';f.timer=Math.max(0,(serverTime-Date.parse(p.throw_at))/1000);f.duration=.7;f.attackLeft=p.throw_hand==='off_hand';f.blocking=false;
    }else if(Date.parse(p.swing_end)>serverTime){
     f.action='attack';f.attackRegion=p.strike_region||'chest';f.attackWeapon=p.strike_weapon||f.weapon;f.attackLeft=p.strike_hand==='off_hand';f.chain=1+(Math.max(1,p.serial)-1)%3;
     f.attackProfile={wind:p.wind,active:p.active,recover:p.recover,duration:p.wind+p.active+p.recover,pole:['spear','trident'].includes(f.attackWeapon),length:ArenaMotion.profile(f.attackWeapon).length};f.duration=f.attackProfile.duration;f.timer=Math.max(0,(serverTime-Date.parse(p.swing_at))/1000);
    }else if(['attack','recoil','stagger','spearcast'].includes(f.action)){f.action='idle';f.timer=0;f.recoilSample=null;}
    const defenseSerial=Number(p.defense_serial)||0;if(defenseSerial!==f._defenseSerial){if(f._defenseSerial!==undefined&&defenseSerial){if(p.last_defense==='evade'){f.passiveEvade=.36;if(p.owner===owner)message('Sıyrıldın.');}else{f.guardFlash=.20;f.guardImpact=p.last_defense==='perfect'?1:.65;const source=room.players.find(a=>a.owner===p.defense_from);f.guardImpactX=source?Math.sin(Math.atan2(source.x-p.x,source.z-p.z)-p.angle):0;f.guardImpactY=source?.strike_region==='head'?.8:source?.strike_region==='legs'?-.8:0;if(p.owner===owner&&p.last_defense==='perfect')message('Mükemmel blok · Karşı vuruş için saldır.');}}f._defenseSerial=defenseSerial;}
   }else if(f.action==='attack'){f.timer+=dt;if(f.timer>f.duration)f.action='idle';}if(Date.parse(p.dodge_until)>serverTime){const kind=p.dodge_kind||'roll';f.action=kind==='roll'?'dodge':'evade';const lateral=(p.dodge_dx||0)*Math.cos(f.angle)-(p.dodge_dz||0)*Math.sin(f.angle),forward=(p.dodge_dx||0)*Math.sin(f.angle)+(p.dodge_dz||0)*Math.cos(f.angle);f.evadeKind=kind==='step'?(Math.abs(lateral)>Math.abs(forward)?lateral>0?'stepLeft':'stepRight':forward>0?'stepForward':'stepBack'):kind;f.dx=p.dodge_dx;f.dz=p.dodge_dz;f.timer=Math.max(0,(serverTime-Date.parse(p.dodge_at))/1000);f.duration=(Date.parse(p.dodge_until)-Date.parse(p.dodge_at))/1000;f.blocking=false;}else if(['dodge','evade'].includes(f.action))f.action='idle';
   if(p.pull_from){f.action='knocked';f.timer=.35;f.duration=.7;}else if(f.action==='knocked')f.action='idle';if(f.hp<=0){f.deadTime+=dt;f.action='dead';}let visual=f;if(f.action==='spearcast'&&f.timer<.27){visual={...f,[p.throw_hand==='off_hand'?'offhand':'weapon']:p.throw_weapon};}ArenaMotion.authored.reach(f,[...states.values()]);ImportedGladiator.animate(visual,m,t/1000,dt);m.teamMark.visible=p.owner===locked;}
   const liveShots=new Set();
   for(const player of room.players){const shot=player.projectile;if(!shot)continue;const key=player.owner+':'+shot.id;liveShots.add(key);let mesh=projectileViews.get(key);
    if(!mesh){mesh=ClassEquipment.weapon(shot.weapon).clone(true);mesh.name='online-projectile';scene.add(mesh);projectileViews.set(key,mesh);}
    const clock=Date.now()+clockOffset,age=(clock-Date.parse(shot.launch_at))/1000,end=Date.parse(shot.resolved?shot.ended_at:shot.expires_at),distance=Math.max(0,(Math.min(clock,end)-Date.parse(shot.launch_at))/1000)*12;
    mesh.visible=age>=0&&clock<end+200&&shot.outcome!=='cancelled';mesh.position.set(shot.origin_x+shot.dx*distance,1.35,shot.origin_z+shot.dz*distance);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(shot.dx,0,shot.dz));
   }
   for(const[key,mesh]of projectileViews)if(!liveShots.has(key)){scene.remove(mesh);projectileViews.delete(key);}
   const p=me(),f=states.get(owner),r=target();$('duelAttack').classList.toggle('counter-ready',room.combat_version===23&&Date.parse(p?.counter_until)>Date.now()+clockOffset&&p?.counter_target===r?.owner);if(f){const dx=(r?.x??0)-f.x,dz=(r?.z??-1)-f.z,len=Math.max(.01,Math.hypot(dx,dz)),goal=new THREE.Vector3(f.x-dx/len*4.2,3.1,f.z-dz/len*4.2);if(pitRequested){goal.x=Math.max(-(PitArena.bounds.x+.1),Math.min((PitArena.bounds.x+.1),goal.x));goal.z=Math.max(-(PitArena.bounds.z+.1),Math.min((PitArena.bounds.z+.1),goal.z));}camera.position.lerp(goal,1-Math.exp(-dt*7));if(pitRequested){camera.position.x=Math.max(-(PitArena.bounds.x+.1),Math.min((PitArena.bounds.x+.1),camera.position.x));camera.position.z=Math.max(-(PitArena.bounds.z+.1),Math.min((PitArena.bounds.z+.1),camera.position.z));}camera.lookAt(f.x+dx*.2,1.1,f.z+dz*.2);}
   for(const p of room.players){let line=whipLines.get(p.owner);const victim=room.players.find(x=>x.owner===p.pull_target&&x.pull_from===p.owner);if(!victim){if(line)line.visible=false;continue;}if(!line){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x503521}));line.frustumCulled=false;whipLines.set(p.owner,line);scene.add(line);}line.visible=true;const a=states.get(p.owner),b=states.get(victim.owner);if(a&&b){line.geometry.attributes.position.array.set([a.x,1.15,a.z,b.x,.35,b.z]);line.geometry.attributes.position.needsUpdate=true;}}
  }else{camera.position.set(0,4.5,9);camera.lookAt(0,0,0);}if(typeof GamePerformance!=='undefined'){GamePerformance.beginVisibility(camera);for(const [who,m]of models)GamePerformance.characterVisibility(m,who===owner);}renderer.render(scene,camera);
 }
 async function boot(){try{await prepare();if(!stopped)await join();}catch(e){message('Arena yüklenemedi. '+e.message);$('queueMessage').textContent='Arena yüklenemedi. Bağlantını kontrol edip tekrar dene.';$('mpRetry').hidden=false;}}
 $('mpRetry').onclick=()=>{$('mpRetry').hidden=true;stopped=false;boot();};
 requestAnimationFrame(frame);boot();
})();
