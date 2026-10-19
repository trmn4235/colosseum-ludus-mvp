/* Playable forest encounters. The edge verifier replays controls before granting loot. */
(()=>{
 'use strict';
 const raid=new URLSearchParams(location.search).get('raid');if(!raid)return;
 const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const link=make('link');link.rel='stylesheet';link.href='caravan-battle-v126.css?v=revision126';document.head.append(link);document.body.classList.add('caravan-battle');
 const overlay=make('section','cb-overlay'),card=make('div','cb-card'),title=make('h2','','Av ekibi hazırlanıyor'),copy=make('p','','Orman yolu ve gladyatörler yükleniyor…');card.append(title,copy);overlay.append(card);document.body.append(overlay);
 let client,owner,ticket,state,field,models=[],paused=true,saving=false,saved=false,settlementStarted=false,abandon=false,storeKey,lastSave=0,accumulator=0,cameraYaw=Math.PI,cameraPitch=.52,pointer=null,toastUntil=0;
 const keys=new Set(),stick={x:0,y:0,id:null},held=new Set(),buttons={},bars=[],arrowMeshes=[];
 const keyFlags={KeyJ:1,KeyK:2,KeyL:4,KeyQ:8,KeyE:16};
 function action(text,fn,cls=''){const b=make('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function returnLink(){const a=make('a','','Ludus’a dön');a.href='ludus.html';return a;}
 function message(text){$('cbToast').textContent=text;toastUntil=performance.now()+3500;}
 function clear(){keys.clear();held.clear();stick.x=stick.y=0;stick.id=null;pointer=null;for(const b of Object.values(buttons))b.classList.remove('held');const dot=document.querySelector('.cb-pad span');if(dot)dot.style.transform='';}
 function checkpoint(){
  if(!state||!storeKey||saved)return true;
  try{localStorage.setItem(storeKey,JSON.stringify({owner,raid,seed:ticket.encounter.seed,commands:state.commands,steps:state.steps,abandon}));return true;}
  catch{paused=true;clear();show('Kayıt alanı dolu','Savaş ilerlemesi saklanamadı. Bu sayfayı kapatmadan tarayıcıda yer açıp yeniden dene.',[action('Yeniden dene',()=>{if(checkpoint())resume();},'primary')]);return false;}
 }
 function show(heading,description,actions,art){card.replaceChildren();title.textContent=heading;copy.textContent=description;if(art){const img=make('img');img.src=art;img.alt='';card.append(img);}card.append(title,copy,...actions);overlay.hidden=false;}
 function pause(){if(!state||state.combat.finished||abandon)return;paused=true;clear();if(!checkpoint())return;show('Savaş duraklatıldı','İlerlemen bu cihazda saklandı. Dilersen daha sonra bu baskına devam edebilirsin.',[action('Savaşa dön',resume,'primary'),action('Geri çekil',()=>show('Geri çekilsinler mi?','Bu baskın yenilgi olarak kaydedilir. Ekip revirde dinlenir; yeni baskın için 1 saat beklersin.',[action('Savaşa dön',resume,'primary'),action('Geri çekilmeyi onayla',()=>{abandon=true;checkpoint();finish();})])),returnLink()]);}
 function resume(){if(!state||saved||saving||abandon||state.combat.finished||!checkpoint())return;clear();paused=false;accumulator=0;overlay.hidden=true;}
 async function script(src){await new Promise((resolve,reject)=>{const n=make('script');n.src=src;const timeout=setTimeout(()=>reject(Error('Savaş dosyaları zamanında yüklenemedi.')),60000);n.onload=()=>{clearTimeout(timeout);resolve();};n.onerror=()=>{clearTimeout(timeout);reject(Error('Savaş dosyası yüklenemedi.'));};document.head.append(n);});}
 async function api(action){const r=await client.rpc('ludus_caravan_raid',{p_action:action,p_raid:raid});if(r.error)throw r.error;if(r.data.user_id!==owner||r.data.version!==126)throw Error('Savaş hesabı doğrulanamadı.');return r.data;}
 function controls(){
  const hud=make('div','cb-hud'),status=make('div','cb-status'),count=make('strong'),detail=make('small');count.id='cbCount';detail.textContent=ticket.team.length+' gladyatör · '+ticket.encounter.guards+' muhafız + 1 okçu';status.append(count,detail);hud.append(status);
  const roster=make('div','cb-team');for(const g of ticket.team){const row=make('div','cb-member'),name=make('span','',g.name),hp=make('progress');hp.max=100;hp.value=100;hp.setAttribute('aria-label',g.name+' sağlık');row.append(name,hp);roster.append(row);bars.push({row,hp});}hud.append(roster);
  const vitals=make('div','cb-vitals'),label=make('strong'),hp=make('progress'),stamina=make('progress');label.id='cbPlayer';hp.id='cbHealth';stamina.id='cbStamina';hp.setAttribute('aria-label','Sağlık');stamina.setAttribute('aria-label','Kondisyon');vitals.append(label,hp,stamina);hud.append(vitals);
  const pad=make('div','cb-pad'),dot=make('span');pad.setAttribute('aria-label','Savaş hareket kolu');pad.append(dot);hud.append(pad);
  function move(e){const b=pad.getBoundingClientRect(),r=b.width*.35,x=e.clientX-b.left-b.width/2,y=e.clientY-b.top-b.height/2,d=Math.max(r,Math.hypot(x,y));stick.x=x/d;stick.y=-y/d;dot.style.transform='translate('+stick.x*r+'px,'+-stick.y*r+'px)';}
  pad.onpointerdown=e=>{if(paused||stick.id!==null)return;stick.id=e.pointerId;pad.setPointerCapture(e.pointerId);move(e);};pad.onpointermove=e=>{if(e.pointerId===stick.id)move(e);};for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>{if(e.pointerId===stick.id){stick.id=null;stick.x=stick.y=0;dot.style.transform='';}});
  const actions=make('div','cb-actions');for(const [text,flag]of [['Saldır',1],['Savun',2],['Yuvarlan',4],['Özel',16]]){const b=make('button','',text);b.type='button';b.setAttribute('aria-label',text);b.onpointerdown=e=>{if(paused)return;b.setPointerCapture(e.pointerId);held.add(flag);b.classList.add('held');};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{held.delete(flag);b.classList.remove('held');});buttons[flag]=b;actions.append(b);}hud.append(actions);
  const toast=make('div','cb-toast');toast.id='cbToast';hud.append(toast,make('small','cb-keys','WASD · J saldırı · K savun · L yuvarlan · E / Q özel · Esc duraklat'));document.body.append(hud);
  const canvas=$('field');canvas.addEventListener('pointerdown',e=>{if(paused||pointer)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(pointer?.id!==e.pointerId)return;cameraYaw-=(e.clientX-pointer.x)*.004;cameraPitch=Math.max(.25,Math.min(.9,cameraPitch+(e.clientY-pointer.y)*.003));pointer.x=e.clientX;pointer.y=e.clientY;});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>{if(pointer?.id===e.pointerId)pointer=null;});
  addEventListener('keydown',e=>{if(e.code==='Escape'){paused?resume():pause();return;}if(paused)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',...Object.keys(keyFlags)].includes(e.code)){e.preventDefault();keys.add(e.code);}});addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>{if(!paused)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();checkpoint();paused=true;}else if(state&&!state.combat.finished&&!abandon)pause();});addEventListener('pagehide',()=>{clear();checkpoint();});
 }
 function input(){
  const left=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0),forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0),back=(keys.has('KeyS')||keys.has('ArrowDown')?1:0),x=stick.x+right-left,z=stick.y+forward-back;
  let flags=0;for(const [key,flag]of Object.entries(keyFlags))if(keys.has(key))flags|=flag;for(const flag of held)flags|=flag;
  if(flags&16){const p=state.combat.fighters[0];if(!state.combat.specialKind(p,1))flags=flags&~16|8;}
  return CaravanSimulation.packet({x:-Math.cos(cameraYaw)*x+Math.sin(cameraYaw)*z,z:Math.sin(cameraYaw)*x+Math.cos(cameraYaw)*z,face:Math.atan2(Math.sin(cameraYaw),Math.cos(cameraYaw)),flags});
 }
 function bow(){const T=THREE,g=new T.Group(),pts=[];for(let i=0;i<=18;i++){const y=-.55+i/18*1.1;pts.push(new T.Vector3(.16*(1-Math.pow(y/.55,2)),y,0));}g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),18,.018,5,false),new T.MeshStandardMaterial({color:0x61442e,roughness:.8})));const string=new T.BufferGeometry().setFromPoints([pts[0],pts.at(-1)]);g.add(new T.Line(string,new T.LineBasicMaterial({color:0xc0b69e})));return g;}
 function renderActors(dt){
  const c=state.combat;
  NavalPerformance.beginFrame(c.fighters,c.fighters[0],false,c.lockedTarget);
  for(const f of c.fighters){const m=models[f.id];NavalPerformance.character(m,f,Math.hypot(f.x-c.fighters[0].x,f.z-c.fighters[0].z));ImportedGladiator.animate(f,m,c.time,dt);
   if(f.caravanHood&&m.gear.helmet&&!m.gear.helmet.group.userData.caravanHood){m.gear.helmet.group.clear();m.gear.helmet.group.add(LudusCaravanOutfit.get(THREE).clone(true));m.gear.helmet.group.userData.caravanHood=true;}
   if(f.archer){if(!m.caravanBow){m.caravanBow=bow();m.offhandAnchor.add(m.caravanBow);}m.caravanBow.visible=f.hp>0;m.offhandAnchor.visible=f.hp>0;if(f.bowDrawUntil>c.time){m.bones.LeftArm.rotateZ(-.55);m.bones.RightForeArm.rotateY(-.5);}}
   if(m.teamMark)m.teamMark.visible=f.hp>0;
   if(bars[f.id]){bars[f.id].hp.value=Math.max(0,f.hp/f.maxHp*100);bars[f.id].row.dataset.dead=String(f.hp<=0);}
  }
  c.arrows.forEach((a,i)=>{let m=arrowMeshes[i];if(!m){m=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.65,5),new THREE.MeshStandardMaterial({color:0x9c7545}));m.geometry.rotateX(Math.PI/2);field.scene.add(m);arrowMeshes[i]=m;}m.visible=true;m.position.set(a.x,1.35+field.height(a.x,a.z),a.z);m.rotation.y=Math.atan2(a.dx,a.dz);});for(let i=c.arrows.length;i<arrowMeshes.length;i++)arrowMeshes[i].visible=false;
  const p=c.fighters[0],follow=p.hp>0?p:c.fighters.find(f=>f.team===0&&f.hp>0)||p,portrait=innerHeight>innerWidth,radius=portrait?6.4:5.1,fy=field.height(follow.x,follow.z);
  const pos=new THREE.Vector3(follow.x-Math.sin(cameraYaw)*radius,fy+1.4+Math.sin(cameraPitch)*radius,follow.z-Math.cos(cameraYaw)*radius);field.camera.position.lerp(pos,1-Math.exp(-dt*10));field.camera.lookAt(follow.x+Math.sin(cameraYaw)*1.2,fy+1.35,follow.z+Math.cos(cameraYaw)*1.2);
  $('cbCount').textContent=c.alive(0)+' / '+ticket.team.length+' avcı   ·   '+c.alive(1)+' savunmacı';$('cbPlayer').textContent=p.hp>0?p.name:'Takımın savaşıyor';$('cbHealth').max=p.maxHp;$('cbHealth').value=Math.max(0,p.hp);$('cbStamina').max=p.maxStamina;$('cbStamina').value=p.stamina;
  if(performance.now()>toastUntil)$('cbToast').textContent='';
 }
 function frame(dt){
  if(!state)return;if(!paused&&!state.combat.finished&&!abandon){accumulator+=dt;let runs=0;while(accumulator>=CaravanSimulation.STEP&&runs++<4&&!state.combat.finished){CaravanSimulation.step(state,input());accumulator-=CaravanSimulation.STEP;for(const e of state.combat.drain()){if(e.type==='arrow'&&state.combat.time<4)message('Okçu kervancı ateş açıyor.');if(e.type==='parry'&&e.id===0)message('Zamanında savunma!');}}
   if(state.steps-lastSave>=90){lastSave=state.steps;checkpoint();}if(state.combat.finished)finish();
  }if(state.combat.finished&&!settlementStarted)finish();renderActors(dt);
 }
 async function finish(){
  if(saving||saved)return;settlementStarted=true;paused=true;clear();checkpoint();saving=true;
  const won=!abandon&&state.combat.result==='win',art='assets/caravan-v124/'+(won?'success':'failure')+'.webp';
  show(won?'Kervan ele geçirildi':'Baskın sona erdi','Savaş kaydı doğrulanıyor…',[],art);
  try{
   const response=await client.functions.invoke('caravan-combat-v126',{body:{raid,commands:state.commands,steps:state.steps,abandon}});
   if(response.error){let detail;try{detail=await response.error.context?.json();}catch{}throw Error(detail?.error||response.error.message);}
   if(response.data?.error)throw Error(response.data.error);const result=response.data?.result;if(result?.id!==raid||result.status!=='resolved')throw Error('Sonuç doğrulanamadı.');
   saved=true;localStorage.removeItem(storeKey);
   const names={wood:'odun',flax:'ham keten',hide:'ham deri',wool:'yün',resin:'reçine',iron_ore:'demir cevheri',tin_ore:'kalay cevheri',copper_ore:'bakır cevheri',lead_ore:'kurşun cevheri',apple:'elma',grain:'tahıl',meat:'et',fish:'balık',egg:'yumurta',beer:'şarap',olive_oil:'zeytinyağı'};
   const loot=Object.entries(result.loot||{}).map(([sku,n])=>n+' '+(names[sku]||sku)).join(', ');
   show(result.success?'Kervan baskını başarılı':'Kervan baskını başarısız',result.success?loot+(result.delivered_at?' kasana eklendi.':' güvende; kasada yer açılınca aktarılacak.')+' Yeni baskın 1 saat sonra.':'Gladyatörlerin 12 saat revirde dinlenecek. Yeni baskın 1 saat sonra.',[returnLink()],art);
  }catch(e){show('Sonuç kaydedilemedi','Savaş kaydı cihazında saklandı. '+(e.message||'Bağlantını kontrol et.'),[action('Sonucu yeniden kaydet',finish,'primary'),returnLink()],art);}finally{saving=false;}
 }
 async function init(){
  if(!/^[a-f0-9-]{36}$/i.test(raid))throw Error('Baskın kimliği geçersiz. Kervan avından giriş yap.');
  const files=['assets/runtime/supabase-59d39487c358.js','ludus-client-v84.js','arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v91.js','arena-locomotion-v91.js','ludus-manica-v119.js','caravan-core-v126.js','caravan-simulation-v126.js','caravan-assets-v126.js','caravan-rig-v126.js','ludus-caravan-outfit-v122.js','naval-performance-v106.js'];
  for(const file of files)await script(file+'?v=revision126');
  client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
  const user=await client.auth.getUser();if(user.error||!user.data.user||user.data.user.is_anonymous)throw Error('Kervan avına girmek için hesabına giriş yap.');owner=user.data.user.id;storeKey='caravan-combat-v126:'+owner+':'+raid;
  const status=await api('state');ticket=[status.active,...status.history].find(j=>j?.id===raid);if(!ticket)throw Error('Bu hesaba ait baskın bulunamadı.');if(ticket.status==='resolved'){show('Baskın tamamlandı','Bu savaşın sonucu daha önce kaydedilmiş.',[returnLink()]);return;}
  await Promise.all([ImportedGladiator.load(text=>copy.textContent=text),NavalPerformance.load(),new Promise((resolve,reject)=>{const begin=Date.now(),timer=setInterval(()=>{if(window.CaravanField?.ready){clearInterval(timer);resolve();}else if(Date.now()-begin>70000){clearInterval(timer);reject(Error('Orman sahnesi yüklenemedi.'));}},80);})]);
  const entered=await api('enter');ticket=entered.result;if(ticket.status==='resolved'){show('Baskın tamamlandı','Sonuç baskın bilgilerinde kayıtlı.',[returnLink()]);return;}
  field=window.CaravanField;state=CaravanSimulation.create(ticket);
  const previous=JSON.parse(localStorage.getItem(storeKey)||'null');if(previous?.owner===owner&&previous.raid===raid&&previous.seed===ticket.encounter.seed){state=CaravanSimulation.replay(ticket,previous.commands,previous.steps);abandon=!!previous.abandon;}
  for(const f of state.combat.fighters){const m=ImportedGladiator.create(f.id,f.type);m.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});models.push(m);field.scene.add(m.root);}
  controls();field.attachBattle({frame,pause});window.CaravanBattle={get state(){return state;},get paused(){return paused;},pause,resume};
  renderActors(.05);if(!checkpoint())return;resume();if(state.combat.finished||abandon)finish();else message(ticket.encounter.attempt%4===0?'Takviye kervanı: +1 muhafız!':'Kervanı ele geçir. Okçuya dikkat!');
 }
 init().catch(e=>{console.error('Caravan battle:',e);show('Savaş açılamadı',e.message||'Bağlantını kontrol et.',[action('Yeniden dene',()=>location.reload(),'primary'),returnLink()]);});
})();
