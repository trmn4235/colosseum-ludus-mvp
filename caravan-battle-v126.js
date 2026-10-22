/* Playable forest encounters. The edge verifier replays controls before granting loot. */
(()=>{
 'use strict';
 const raid=new URLSearchParams(location.search).get('raid');if(!raid)return;
 const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const link=make('link');link.rel='stylesheet';link.href='caravan-battle-v127.css?v=revision128';document.head.append(link);document.body.classList.add('caravan-battle');
 const overlay=make('section','cb-overlay'),card=make('div','cb-card'),title=make('h2','','Av ekibi hazırlanıyor'),copy=make('p','','Orman yolu ve gladyatörler yükleniyor…');card.append(title,copy);overlay.append(card);overlay.hidden=true;document.body.append(overlay);
 let client,owner,ticket,state,field,sim,touchControls,controlSettings,dropBatch,models=[],paused=true,saving=false,saved=false,settlementStarted=false,abandon=false,storeKey,lastSave=0,accumulator=0,cameraYaw=Math.PI,cameraPitch=.52,pointer=null,toastUntil=0,presentation=null,firstDeathSeen=false;
 const keys=new Set(),stick={x:0,y:0,id:null},held=new Set(),buttons={},bars=[],arrowMeshes=[];
 const keyFlags={KeyJ:1,KeyK:2,ShiftLeft:2};let queued=0,selectedRegion='chest',guardRegion=null;
 function action(text,fn,cls=''){const b=make('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function returnLink(){const a=make('a','','Ludus’a dön');a.href='ludus.html';return a;}
 function message(text){$('cbToast').textContent=text;toastUntil=performance.now()+3500;}
 function clear(){touchControls?.reset();queued=0;guardRegion=null;keys.clear();held.clear();stick.x=stick.y=0;stick.id=null;pointer=null;for(const b of Object.values(buttons))b.classList.remove('held');const dot=document.querySelector('.cb-pad span');if(dot)dot.style.transform='';}
 function checkpoint(){
  if(!state||!storeKey||saved)return true;
  try{localStorage.setItem(storeKey,JSON.stringify({owner,raid,seed:ticket.encounter.seed,commands:state.commands,steps:state.steps,abandon}));return true;}
  catch{paused=true;clear();show('Kayıt alanı dolu','Savaş ilerlemesi saklanamadı. Bu sayfayı kapatmadan tarayıcıda yer açıp yeniden dene.',[action('Yeniden dene',()=>{if(checkpoint())resume();},'primary')]);return false;}
 }
 function show(heading,description,actions,art){window.CaravanVictory?.close();CaravanLoading.hide();card.replaceChildren();title.textContent=heading;copy.textContent=description;if(art){const img=make('img');img.src=art;img.alt='';card.append(img);}card.append(title,copy,...actions);overlay.hidden=false;}
 function pause(){if(!state||state.combat.finished||abandon)return;paused=true;clear();if(!checkpoint())return;show('Savaş duraklatıldı','İlerlemen bu cihazda saklandı. Dilersen daha sonra bu baskına devam edebilirsin.',[controlSettings,action('Savaşa dön',resume,'primary'),action('Geri çekil',()=>show('Geri çekilsinler mi?','Bu baskın yenilgi olarak kaydedilir. Ekip revirde dinlenir; yeni baskın için 1 saat beklersin.',[action('Savaşa dön',resume,'primary'),action('Geri çekilmeyi onayla',()=>{abandon=true;checkpoint();finish();})])),returnLink()]);}
 function resume(){if(!state||saved||saving||abandon||state.combat.finished||!checkpoint())return;clear();paused=false;accumulator=0;overlay.hidden=true;}
 async function script(src){await new Promise((resolve,reject)=>{const n=make('script');n.src=src;const timeout=setTimeout(()=>reject(Error('Savaş dosyaları zamanında yüklenemedi.')),60000);n.onload=()=>{clearTimeout(timeout);resolve();};n.onerror=()=>{clearTimeout(timeout);reject(Error('Savaş dosyası yüklenemedi.'));};document.head.append(n);});}
 async function api(action){const r=await client.rpc('ludus_caravan_raid',{p_action:action,p_raid:raid});if(r.error)throw r.error;if(r.data.user_id!==owner||r.data.version!==126)throw Error('Savaş hesabı doğrulanamadı.');return r.data;}
 function controls(){
  const hud=make('div','cb-hud'),status=make('div','cb-status'),count=make('strong'),detail=make('small');count.id='cbCount';detail.textContent=ticket.team.length+' gladyatör · '+ticket.encounter.guards+' muhafız + 1 okçu';status.append(count,detail);hud.append(status);
  const roster=make('div','cb-team');for(const g of ticket.team){const row=make('div','cb-member'),name=make('span','',g.name),hp=make('progress');hp.max=100;hp.value=100;hp.setAttribute('aria-label',g.name+' sağlık');row.append(name,hp);roster.append(row);bars.push({row,hp});}hud.append(roster);
  const vitals=make('div','cb-vitals vitals');vitals.innerHTML='<strong id="cbPlayer"></strong><div class="meter"><span id="hpFill"></span><label id="hpText"></label><small>CAN</small></div><div class="meter energy"><span id="stFill"></span><label id="stText"></label><small>KONDİSYON</small></div>';hud.append(vitals);
  for(const [id,label]of [['hpFill','Can'],['stFill','Kondisyon']]){$(id)?.setAttribute('aria-label',label);const bar=vitals.querySelector('#'+id);bar.setAttribute('role','progressbar');bar.setAttribute('aria-label',label);bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');}
  const pad=make('div','cb-pad'),dot=make('span');pad.setAttribute('aria-label','Savaş hareket kolu');pad.append(dot);hud.append(pad);
  function move(e){const b=pad.getBoundingClientRect(),r=b.width*.35,x=e.clientX-b.left-b.width/2,y=e.clientY-b.top-b.height/2,d=Math.max(r,Math.hypot(x,y));stick.x=x/d;stick.y=-y/d;dot.style.transform='translate('+stick.x*r+'px,'+-stick.y*r+'px)';}
  pad.onpointerdown=e=>{if(paused||stick.id!==null)return;stick.id=e.pointerId;pad.setPointerCapture(e.pointerId);move(e);};pad.onpointermove=e=>{if(e.pointerId===stick.id)move(e);};for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>{if(e.pointerId===stick.id){stick.id=null;stick.x=stick.y=0;dot.style.transform='';}});
  const actions=make('div','cb-actions actions'),paths={target:'M12 2v6m0 8v6M2 12h6m8 0h6 M18 12a6 6 0 1 0-12 0 6 6 0 0 0 12 0',hand:'M4 9a8 8 0 0 1 14-3l2 3M20 3v6h-6M20 15a8 8 0 0 1-14 3l-2-3M4 21v-6h6',block:'M4 4l8-2 8 2v8c0 5-8 10-8 10S4 17 4 12zM12 4v15',attack:'M7 17L20 3l1 5L10 19M5 13l7 7M4 21l4-5',special:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',dodge:'M3 12h17m-6-6l6 6-6 6'};
  for(const [id,label]of [['target','Hedef kilidi'],['hand','Ekipman değiştir'],['block','BLOK'],['attack','SALDIR'],['special','ÖZEL'],['dodge',sim===CaravanSimulationV163?'KAÇIN':'YUVARLAN']]){const b=make('button','action');b.type='button';b.id=id;b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[id]+'"/></svg><small'+(id==='special'?' id="specialLabel"':'')+'>'+label+'</small>';actions.append(b);}
  hud.append(actions);const pickup=action('Silahı al',()=>queue(32),'cb-pickup');pickup.id='pickup';pickup.hidden=true;pickup.setAttribute('aria-label','Yerdeki silahı al');hud.append(pickup);
  const toast=make('div','cb-toast');toast.id='cbToast';hud.append(toast,make('small','cb-keys','WASD · J saldırı · K blok · L yuvarlan · E hedef · F silah al · Q özel · R el değiştir'));document.body.append(hud);
  const active=()=>!paused&&!state.combat.finished&&!abandon;
  touchControls=ArenaTouchControls.mount({active,select:r=>selectedRegion=r,attack:r=>{selectedRegion=r;queue(1);},guardClassic:value=>{value?held.add(2):held.delete(2);},guard:r=>{guardRegion=r;held.add(2);queued&=~1;},release:()=>{guardRegion=null;held.delete(2);},cancelAttack:()=>{queued&=~1;}});
  for(const [id,flag]of [['target',128],['hand',64],['special',8],['dodge',4]])$(id).addEventListener(['special','dodge'].includes(id)?'pointerdown':'click',e=>{e.preventDefault();queue(flag);});
  if(sim===CaravanSimulation){$('target').disabled=$('hand').disabled=true;$('target').title='Bu devam eden savaş eski kurallarla tamamlanacak.';}
  if(sim===CaravanSimulationV163)CombatEvasionControls.mount({parent:hud,active,perform:kind=>queue({duck:256,jump:512,roll:1024}[kind])});
  controlSettings=make('label','cb-control-settings','Kontrol düzeni');const select=make('select');select.id='controlLayout';controlSettings.append(select);CombatControlSettings.bind(select);
  const canvas=$('field');canvas.addEventListener('pointerdown',e=>{if(paused||pointer)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(pointer?.id!==e.pointerId)return;cameraYaw-=(e.clientX-pointer.x)*.004;cameraPitch=Math.max(.25,Math.min(.9,cameraPitch+(e.clientY-pointer.y)*.003));pointer.x=e.clientX;pointer.y=e.clientY;});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>{if(pointer?.id===e.pointerId)pointer=null;});
  addEventListener('keydown',e=>{if(e.code==='Escape'){if(!e.repeat)paused?resume():pause();return;}if(paused||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(/^(Key[WASDJKLEQFRHCVB]|Digit[1-6]|Arrow.*|Space|ShiftLeft)$/.test(e.code)){e.preventDefault();keys.add(e.code);if(!e.repeat){const flags={KeyJ:1,Space:1,KeyL:4,KeyC:256,KeyV:512,KeyB:1024,KeyQ:8,KeyF:32,KeyR:64,KeyH:64,KeyE:128};if(flags[e.code])queue(flags[e.code]);if(e.code.startsWith('Digit'))selectedRegion=['head','chest','rightArm','leftArm','rightLeg','leftLeg'][Number(e.code.slice(-1))-1];}}});addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>{if(!paused)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();checkpoint();paused=true;}else if(state&&!state.combat.finished&&!abandon)pause();});addEventListener('pagehide',()=>{clear();checkpoint();});
 }
 function queue(flag){if(!paused&&!state.combat.finished)queued|=flag;}
 function input(){
  const left=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0),forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0),back=(keys.has('KeyS')||keys.has('ArrowDown')?1:0),x=stick.x+right-left,z=stick.y+forward-back;
  let flags=queued;queued=0;for(const [key,flag]of Object.entries(keyFlags))if(keys.has(key))flags|=flag;for(const flag of held)flags|=flag;
  if(sim===CaravanSimulation&&flags&8&&state.combat.fighters[0].pickupHand==='offhand')flags=flags&~8|16;
  return sim.packet({x:-Math.cos(cameraYaw)*x+Math.sin(cameraYaw)*z,z:Math.sin(cameraYaw)*x+Math.cos(cameraYaw)*z,face:Math.atan2(Math.sin(cameraYaw),Math.cos(cameraYaw)),flags,region:selectedRegion,guardRegion});
 }
 function bow(){const T=THREE,g=new T.Group(),pts=[];for(let i=0;i<=18;i++){const y=-.55+i/18*1.1;pts.push(new T.Vector3(.16*(1-Math.pow(y/.55,2)),y,0));}g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),18,.018,5,false),new T.MeshStandardMaterial({color:0x61442e,roughness:.8})));const string=new T.BufferGeometry().setFromPoints([pts[0],pts.at(-1)]);g.add(new T.Line(string,new T.LineBasicMaterial({color:0xc0b69e})));return g;}
 const projectileViews=new Map();let dropIds='';
 const itemName=d=>ArenaWeapons[d.kind]?.name||({shield:'Kalkan',helmet:'Miğfer',chest:'Göğüs zırhı',greaves:'Bacaklık',shoulders:'Kolluk',net:'Ağ',scissor:'Kol bıçağı'})[d.kind]||'Ekipman';
 function renderEquipment(){
  const c=state.combat,p=c.fighters[0];dropBatch.update(c.drops,d=>ClassEquipment.item(d),true);
  const ids=c.drops.map(d=>d.id).join(',');if(ids!==dropIds){dropIds=ids;const matrix=new THREE.Matrix4(),v=new THREE.Vector3();for(const mesh of dropBatch.meshes){for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);v.setFromMatrixPosition(matrix);matrix.elements[13]+=field.height(v.x,v.z);mesh.setMatrixAt(i,matrix);}mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}}
  const live=new Set(c.projectiles.map(n=>n.id));for(const [id,o]of projectileViews)if(!live.has(id)){o.removeFromParent();projectileViews.delete(id);}for(const n of c.projectiles){let o=projectileViews.get(n.id);if(!o){o=ClassEquipment.weapon(n.kind).clone(true);field.scene.add(o);projectileViews.set(n.id,o);}o.position.set(n.x,1.35+field.height(n.x,n.z),n.z);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(n.dx,0,n.dz));o.visible=n.launched;}
  const d=c.nearestDrop(0);$('pickup').hidden=!d||c.finished;$('pickup').disabled=paused||p.action!=='idle';if(d)$('pickup').textContent=(ArenaWeapons[d.kind]?(p.pickupHand==='offhand'?'Sol ele al · ':'Sağ ele al · '):'Kuşan · ')+itemName(d)+' · F';
  const index=p.pickupHand==='offhand'?1:0,label=c.skillNames(p)[index],wait=Math.max(0,(p.skillReady?.[index]||0)-c.time);$('specialLabel').textContent=label+(wait>.1?' '+Math.ceil(wait):'');$('special').setAttribute('aria-label',label);$('hand').setAttribute('aria-label','Ekipman değiştir · '+(index?'Sol el':'Sağ el'));const locked=c.enemy(p,c.fighters[c.lockedTarget]);$('target').classList.toggle('pressed',locked);$('target').setAttribute('aria-pressed',String(locked));$('hand').setAttribute('aria-pressed',String(index===1));presentation?.update(c);
 }
 function renderActors(dt){
  const c=state.combat;
  NavalPerformance.beginFrame(c.fighters,c.fighters[0],false,c.lockedTarget);
  for(const f of c.fighters){const m=models[f.id];NavalPerformance.character(m,f,Math.hypot(f.x-c.fighters[0].x,f.z-c.fighters[0].z));ImportedGladiator.animate(f,m,c.time,dt);m.root.traverse(o=>{if(o.isMesh){o.castShadow=f.hp>0&&NavalPerformance.shadow(f.id);}});
   if(f.caravanHood&&m.gear.helmet){if(!m.caravanHood){m.caravanHood=m.gear.helmet.group.clone(false);m.caravanHood.add(LudusCaravanOutfit.get(THREE).clone(true));m.gear.helmet.group.parent.add(m.caravanHood);}m.caravanHood.position.copy(m.gear.helmet.group.position);m.caravanHood.quaternion.copy(m.gear.helmet.group.quaternion);m.caravanHood.scale.copy(m.gear.helmet.group.scale);m.caravanHood.visible=true;m.gear.helmet.group.visible=false;}
   if(f.archer){if(!m.caravanBow){m.caravanBow=bow();m.offhandAnchor.add(m.caravanBow);}m.caravanBow.visible=f.hp>0;m.offhandAnchor.visible=f.hp>0;if(f.motionVersion!==163&&f.bowDrawUntil>c.time){m.bones.LeftArm.rotateZ(-.55);m.bones.RightForeArm.rotateY(-.5);}}
   if(m.teamMark)m.teamMark.visible=f.hp>0;if(f.hp>0&&f.move>.2&&c.time>(m.nextDust||0)){field.footDust?.(f.x,f.z,f.action==='dodge'?1.5:1);m.nextDust=c.time+.32;}
   if(bars[f.id]){bars[f.id].hp.value=Math.max(0,f.hp/f.maxHp*100);bars[f.id].row.dataset.dead=String(f.hp<=0);}
  }
  c.arrows.forEach((a,i)=>{let m=arrowMeshes[i];if(!m){m=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.65,5),new THREE.MeshStandardMaterial({color:0x9c7545}));m.geometry.rotateX(Math.PI/2);field.scene.add(m);arrowMeshes[i]=m;}m.visible=true;m.position.set(a.x,1.35+field.height(a.x,a.z),a.z);m.rotation.y=Math.atan2(a.dx,a.dz);});for(let i=c.arrows.length;i<arrowMeshes.length;i++)arrowMeshes[i].visible=false;
  const p=c.fighters[0],follow=p.hp>0?p:c.fighters.find(f=>f.team===0&&f.hp>0)||p,portrait=innerHeight>innerWidth,radius=portrait?6.4:5.1,fy=field.height(follow.x,follow.z);
  const locked=c.fighters[c.lockedTarget];if(c.enemy(p,locked)&&p.hp>0){const desired=Math.atan2(locked.x-p.x,locked.z-p.z),delta=Math.atan2(Math.sin(desired-cameraYaw),Math.cos(desired-cameraYaw));cameraYaw+=delta*(1-Math.exp(-dt*7));}
  const pos=new THREE.Vector3(follow.x-Math.sin(cameraYaw)*radius,fy+1.4+Math.sin(cameraPitch)*radius,follow.z-Math.cos(cameraYaw)*radius);field.camera.position.lerp(pos,1-Math.exp(-dt*10));field.camera.lookAt(follow.x+Math.sin(cameraYaw)*1.2,fy+1.35,follow.z+Math.cos(cameraYaw)*1.2);
  $('cbCount').textContent=c.alive(0)+' / '+ticket.team.length+' avcı   ·   '+c.alive(1)+' savunmacı';$('cbPlayer').textContent=p.hp>0?p.name:'Takımın savaşıyor';for(const [id,value,max,label]of [['hp',p.hp,p.maxHp,'Can'],['st',p.stamina,p.maxStamina,'Kondisyon']]){const percent=Math.max(0,Math.min(100,value/max*100));$(id+'Fill').style.width=percent+'%';$(id+'Fill').setAttribute('aria-valuenow',String(Math.round(percent)));$(id+'Text').textContent=Math.ceil(Math.max(0,value))+' / '+max;}renderEquipment();
  if(!firstDeathSeen&&c.fighters.some(f=>f.hp<=0)){firstDeathSeen=true;field.startleHorses();}
  if(performance.now()>toastUntil)$('cbToast').textContent='';
 }
 function frame(dt){
  if(!state)return;if(!paused&&!state.combat.finished&&!abandon){accumulator+=dt;let runs=0;while(accumulator>=sim.STEP&&runs++<4&&!state.combat.finished){sim.step(state,state.steps%3===0?input():state.packet);accumulator-=sim.STEP;for(const e of state.combat.drain()){if(e.type==='arrow'&&state.combat.time<4)message('Okçu kervancı ateş açıyor.');if(e.type==='parry'&&e.id===0)message('Zamanında savunma!');if(e.type==='netthrow'&&e.id===0)message('Ağ atıldı.');if(e.type==='netcatch'&&e.source===0)message('Hedef ağa yakalandı!');if(e.type==='pickup'&&e.id===0)message(itemName({kind:e.kind})+' alındı.');if(e.type==='equipmentdrop'&&e.id===0)message(itemName({kind:e.kind})+' yere düştü. Yaklaşınca F ile al.');}}
   if(state.steps-lastSave>=90){lastSave=state.steps;checkpoint();}if(state.combat.finished)finish();
  }if(state.combat.finished&&!settlementStarted)finish();renderActors(dt);
 }
 async function finish(){
  if(saving||saved)return;settlementStarted=true;paused=true;clear();checkpoint();saving=true;
  const won=!abandon&&state.combat.result==='win',art='assets/caravan-v124/'+(won?'success':'failure')+'.webp';
  if(won&&window.CaravanVictory?.pending()){CaravanLoading.hide();overlay.hidden=true;}
  else show('Baskın sona erdi','Savaş kaydı doğrulanıyor…',[],art);
  try{
   const response=await client.functions.invoke('caravan-combat-v126',{body:{raid,commands:state.commands,steps:state.steps,abandon}});
   if(response.error){let detail;try{detail=await response.error.context?.json();}catch{}throw Error(detail?.error||response.error.message);}
   if(response.data?.error)throw Error(response.data.error);const result=response.data?.result;if(result?.id!==raid||result.status!=='resolved')throw Error('Sonuç doğrulanamadı.');
   saved=true;localStorage.removeItem(storeKey);
   if(result.success===true){
    if(window.CaravanVictory?.show(result))overlay.hidden=true;
    else show('Kervan baskını başarılı','Ganimetin '+(result.delivered_at?'depomuza taşındı.':'güvende; depoda yer açılınca taşınacak.')+' Yeni baskın 1 saat sonra.',[returnLink()],'assets/caravan-v124/success.webp');
   }
   else show('Kervan baskını başarısız','Gladyatörlerin 12 saat revirde dinlenecek. Yeni baskın 1 saat sonra.',[returnLink()],'assets/caravan-v124/failure.webp');
  }catch(e){show('Sonuç kaydedilemedi','Savaş kaydı cihazında saklandı. '+(e.message||'Bağlantını kontrol et.'),[action('Sonucu yeniden kaydet',finish,'primary'),returnLink()],art);}finally{saving=false;}
 }
 async function init(){
  if(!/^[a-f0-9-]{36}$/i.test(raid))throw Error('Baskın kimliği geçersiz. Kervan avından giriş yap.');
  const files=['assets/runtime/supabase-59d39487c358.js','ludus-client-v84.js','arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v91.js','arena-locomotion-v91.js','ludus-manica-v119.js','caravan-core-v126.js','caravan-simulation-v126.js','caravan-simulation-v127.js','combat-curves-v163.js','combat-motion-v163.js','caravan-simulation-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','combat-control-settings-v44.js','arena-controls-v43.js','combat-evasion-controls-v163.js','caravan-assets-v126.js','arena-equipment-fit-v164.js','caravan-rig-v126.js','ludus-caravan-outfit-v122.js','naval-performance-v106.js'];
  for(const [i,file]of files.entries()){await script(file+'?v=revision164');CaravanLoading.set('scripts',(i+1)/files.length,'Savaş kontrolleri hazırlanıyor…');}
  client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
  const user=await client.auth.getUser();if(user.error||!user.data.user||user.data.user.is_anonymous)throw Error('Kervan avına girmek için hesabına giriş yap.');owner=user.data.user.id;storeKey='caravan-combat-v126:'+owner+':'+raid;
  const status=await api('state');CaravanLoading.set('account',1,'Av ekibi doğrulandı');ticket=[status.active,...status.history].find(j=>j?.id===raid);if(!ticket)throw Error('Bu hesaba ait baskın bulunamadı.');if(ticket.status==='resolved'){show('Baskın tamamlandı','Bu savaşın sonucu daha önce kaydedilmiş.',[returnLink()]);return;}
  await Promise.all([ImportedGladiator.load(text=>CaravanLoading.set('actors',text==='Gladyatör hazır'?1:.1,text)),NavalPerformance.load(),CaravanPresentation.loadDriver(),new Promise((resolve,reject)=>{const begin=Date.now(),timer=setInterval(()=>{if(window.CaravanField?.ready){clearInterval(timer);resolve();}else if(Date.now()-begin>70000){clearInterval(timer);reject(Error('Orman sahnesi yüklenemedi.'));}},80);})]);
  const entered=await api('enter');ticket=entered.result;if(ticket.status==='resolved'){show('Baskın tamamlandı','Sonuç baskın bilgilerinde kayıtlı.',[returnLink()]);return;}
  field=window.CaravanField;sim=ticket.encounter.rules===163?CaravanSimulationV163:ticket.encounter.rules===127?CaravanSimulationV127:CaravanSimulation;state=sim.create(ticket);
  const previous=JSON.parse(localStorage.getItem(storeKey)||'null');if(previous?.owner===owner&&previous.raid===raid&&previous.seed===ticket.encounter.seed){state=sim.replay(ticket,previous.commands,previous.steps);abandon=!!previous.abandon;}
  for(const f of state.combat.fighters){const m=ImportedGladiator.create(f.id,f.type,f.archer?CaravanPresentation.driver:undefined);m.root.traverse(o=>{if(o.isMesh){o.castShadow=true;}});models.push(m);field.scene.add(m.root);}
  dropBatch=new ArenaRuntime.DropBatch(THREE,field.scene);presentation=CaravanPresentation.create(field,models);firstDeathSeen=state.combat.fighters.some(f=>f.hp<=0);controls();field.attachBattle({frame,pause});window.CaravanBattle={get state(){return state;},get paused(){return paused;},get presentation(){return presentation;},pause,resume};
  renderActors(.05);field.renderer.render(field.scene,field.camera);CaravanLoading.finish();if(!checkpoint())return;resume();if(state.combat.finished||abandon)finish();else message(ticket.encounter.attempt%4===0?'Takviye kervanı: +1 muhafız!':'Kervanı ele geçir. Okçuya dikkat!');
 }
 init().catch(e=>{console.error('Caravan battle:',e);show('Savaş açılamadı',e.message||'Bağlantını kontrol et.',[action('Yeniden dene',()=>location.reload(),'primary'),returnLink()]);});
})();
