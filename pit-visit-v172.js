(()=>{
 'use strict';const $=id=>document.getElementById(id),client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1'),names=['Varro','Felix','Marcus','Titus'];
 let state=null,owner=null,busy=false,pending=null,clockOffset=0,scene,renderer,camera,world,view='overview',yaw=.5,last=0,keeper=null,keeperPromise=null,rigs=null,rigPromise=null,rigError=null,dialogue='home',booting=false,polling=false,actionMessage='';
 let cameraSnap=true;let exhibition=null,exhibitionId=null,velocity={x:0,z:0},cameraTarget=null;let galleryRoofs=[],dominus=null,appearance={},walkSpeed=0,fightMode='1x10',fightRequest=null,fightBusy=false;const keys=new Set(),stick={x:0,z:0};
 const pendingKey=()=>`pit-request-v172:${owner}`;
 function notice(text){$('pitStatus').textContent=text;$('pitStatus').hidden=!text;}
 const nearKeeper=()=>view==='overview'&&!!keeper?.root.userData.loaded&&!!dominus?.root.userData.loaded&&dominus.root.position.distanceTo(keeper.root.position)<2.8;
 function choices(text,options){$('circusDialogue').textContent=text;const nav=document.querySelector('.office-choices');nav.replaceChildren();for(const [label,fn]of options){const b=document.createElement('button');b.textContent=label;b.onclick=fn;nav.append(b);}}
 function talk(which='home'){
  clearMove();dialogue=which;$('betDialog').close();$('circusMessage').textContent='';if(!$('circusDialog').open)$('circusDialog').showModal();
  if(which==='duel')choices('Tam vaktinde geldin. Kum birazdan karışacak. Tek bir savaşçına mı güveniyorsun, yoksa sırt sırta verecek iki adamın mı var?',[['1x10 — Tek savaşçımla katılacağım.',()=>talk('1x10')],['2x5 — İki savaşçımı çıkaracağım.',()=>talk('2x5')],['Önce başka bir şey soracağım.',()=>talk()]]);
  else if(which==='1x10'||which==='2x5'){
   fightMode=which;
   choices(which==='1x10'?'Savaş başlıyor. Hangi gladyatörün savaşacaksa savaş aletini seçsin. İlk dört kişi kuma çıkıyor; biri düşünce sıradaki girer. Bakalım on kişinin arasından kim kalacak.':'Savaş başlıyor. İki gladyatörünü seç, silahlarını da ellerine verelim. Beş takım birden kuma çıkacak. Birbirlerini kollasınlar; burada yalnız kalmak iyiye işaret değil.',[
    [which==='1x10'?'Savaşçım hazır ve aşağıda sırasını bekliyor.':'İki savaşçım da hazır. Silahlarını seçelim.',()=>openFight(which)],
    ['Hangi hanedanlıklardan kimler savaşıyor?',()=>rivals(which)],
    ['Diğer müsabakayı da anlat.',()=>talk('duel')]
   ]);
  }else if(which==='farewell')choices('Pekâlâ, önce etrafa bir bak. Kimin eli titriyor, kim fazla konuşuyor… Bazen çok şey anlatır. Karar verirsen buradayım.',[['Görüşürüz, Gaius.',()=>{$('circusDialog').close();showView('overview');}],['Aslında dövüşe katılacağım.',()=>talk('duel')],['Bahisleri de görmek istiyorum.',openBet]]);
  else choices('Hoş geldin. Kalabalığı duydun mu? Bugün herkes kendi adamından emin. Sen de bir savaşçı mı getirdin, yoksa kesendeki denariusa mı güveniyorsun?',[['Bahis yapmaya geldim.',openBet],['Dövüşe katılacağım.',()=>talk('duel')],['Şimdilik sadece bakıyorum.',()=>talk('farewell')]]);
 }
 function rivals(mode,page=0){
  const entries=state?.lineups?.[mode];
  if(!entries?.length){choices('Liste henüz elime ulaşmadı. Bir soluklan; kâtip kayıtları getirsin, sana isimleri tek tek söyleyeyim.',[['Listeyi yeniden sor.',async()=>{try{await rpc();rivals(mode);}catch(e){$('circusMessage').textContent=e.message;}}],['Hazırlığa dönelim.',()=>talk(mode)]]);return;}
  const houses=[...new Set(entries.map(f=>f.house))].map(house=>({house,names:entries.filter(f=>f.house===house).map(f=>f.name)}));
  const favorite=entries.filter(f=>f.favorite),favoriteHouse=favorite[0]?.house||entries[0].house;
  const pages=houses.map(h=>`${h.house} Hanedanı ${h.names.join(' ve ')} ile geliyor.`);
  const opening=mode==='1x10'?`Benim gözüm ${favoriteHouse} Hanedanı'ndan ${favorite[0]?.name||entries[0].name}'da. Acele etmiyor; başkasının açığını bekliyor. Yine de kumun üstünde hiçbir söz garanti değildir.`:`Ben ${favoriteHouse} Hanedanı'nın ${favorite.map(f=>f.name).join(' ve ')} ikilisini tutuyorum. Birinin açığını diğeri kapatıyor. Ama seninkileri de görmeden hüküm vermeyeyim.`;
  const endings=[' Adlarını yazdırırken pek sakindiler. Bakalım kumda da öyle kalacaklar mı.',' Kapıda son hazırlıklarını yapıyorlar. Seninkiler de gözlerini açık tutsun.',' Kalabalık onları da merak ediyor. İşin aslı, herkesin hesabı ilk darbede değişebilir.'];
  const last=page===pages.length;
  choices(page===0?opening:pages[page-1]+endings[(page-1)%endings.length],[
   [last?'İsimleri duydum. Hazırlığa dönelim.':page===0?'Diğer savaşçılar kimler?':'Başka kimler var?',()=>last?talk(mode):rivals(mode,page+1)],
   ['Tamam, savaşçılarımı hazırlayayım.',()=>talk(mode)],
   ['İlk söylediğin favori kimdi?',()=>rivals(mode,0)]
  ]);
 }
 function openBet(){if(!state){$('circusMessage').textContent='Önce hesabın yüklenmeli.';return;}$('circusDialog').close();render();$('betDialog').showModal();}
 function render(){if(!state)return;
  const b=state.bout;const selected=$('betFighter').value;$('betFighter').replaceChildren(...names.slice(0,b.participants||2).map((name,i)=>{const o=document.createElement('option');o.value=i;o.textContent=name+' · '+Number(b.odds).toFixed(2).replace('.',',');return o;}));$('betFighter').value=selected||'0';$('betDescription').textContent=(b.participants===4?'Dört rakip, herkes tek.':'İki rakip.')+' Oyun içi denarius ile bahis yap; müsabaka başladıktan sonra kupon değişmez.';$('betForm').hidden=b.status!=='open'||b.selected!==null;$('startBout').hidden=b.status!=='open';$('nextBout').hidden=b.status!=='settled';$('watchBout').hidden=b.status==='open';$('retryAction').hidden=!pending;
  for(const button of $('betDialog').querySelectorAll('button'))if(button.id!=='betClose')button.disabled=busy||!!pending&&button.id!=='retryAction';
  $('betState').textContent=b.status==='open'?(b.selected===null?'Kupon yapabilir veya bahissiz izleyebilirsin.':`${names[b.selected]} · ${b.stake} denarius kuponun alındı. Müsabakayı başlat.`):b.status==='running'?'Müsabaka sürüyor.':`${names[b.winner]} kazandı. ${b.selected===null?'Bahissiz izledin.':b.payout?b.payout+' denarius toplam ödeme hesabına eklendi.':'Kupon kazanamadı.'}`;
  $('betHistory').replaceChildren();for(const h of state.history){const d=document.createElement('div');d.textContent=`${names[h.selected]} · ${h.stake} denarius · ${h.payout?'Ödeme '+h.payout:'Kazanamadı'}`;$('betHistory').append(d);}
  if(actionMessage)$('betState').textContent=actionMessage;preview();
 }
 function preview(){const amount=Number($('betStake').value);$('betPreview').textContent=Number.isFinite(amount)?`${amount} denarius yatır · Kazanırsa ${Math.floor(amount*(state?.bout.odds||3.8))} denarius toplam ödeme (yatırdığın bedel dahil).`:'';}
 async function rpc(action='state',args={},request=null){let timer;try{const r=await Promise.race([client.rpc('ludus_pit',{p_action:action,p_args:args,p_request:request}),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Bağlantı zaman aşımına uğradı.')),12000))]);if(r.error)throw r.error;state=r.data;clockOffset=Date.parse(state.server_now)-Date.now();render();return state;}finally{clearTimeout(timer);}}
 async function act(action,args={}){if(busy||!state)return;busy=true;actionMessage='';if(!pending){pending={action,args:{...args,bout:state.bout.id},request:crypto.randomUUID()};try{sessionStorage.setItem(pendingKey(),JSON.stringify(pending));}catch{}}render();try{await rpc(pending.action,pending.args,pending.request);pending=null;sessionStorage.removeItem(pendingKey());if(action==='start'){$('betDialog').close();showView('watch');} }catch(e){actionMessage=e.message||'İşlem kaydedilemedi.';if(e.code){pending=null;sessionStorage.removeItem(pendingKey());}}finally{busy=false;render();}}
 $('betStake').oninput=preview;$('betForm').onsubmit=e=>{e.preventDefault();if($('betForm').reportValidity())act('bet',{fighter:Number($('betFighter').value),stake:Number($('betStake').value)});};
 $('startBout').onclick=()=>act('start');$('nextBout').onclick=()=>act('next');$('retryAction').onclick=()=>act(pending?.action);$('circusClose').onclick=()=>{$('circusDialog').close();showView(view);};$('bookmakerLabel').onclick=()=>talk();$('betClose').onclick=()=>$('betDialog').close();$('watchBout').onclick=()=>{$('betDialog').close();showView('watch');};
 async function showView(next){view=next;cameraSnap=true;cameraTarget=null;document.body.dataset.view=next;clearMove();notice(next==='watch'?'Gösteri müsabakası · Herkes tek':'');if(next==='watch')try{await loadRigs();}catch(e){rigError=e.message;notice('Gladyatörler görüntülenemedi. Müsabaka ve kuponun sunucuda devam ediyor.');}}
 const script=file=>file==='equipment-catalog-v167.js'&&typeof LudusEquipmentCatalog!=='undefined'?Promise.resolve():new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=file+'?v='+('revision198');s.onload=resolve;s.onerror=()=>reject(Error('Model bileşeni açılamadı'));document.head.append(s);});
 async function loadKeeper(){if(keeperPromise)return keeperPromise;keeperPromise=(async()=>{await script('owner-avatar.js');dominus=LudusOwner.create(appearance);dominus.root.name='Dominus';scene.add(dominus.root);keeper=LudusOwner.create({version:2,hair:'curls',beard:'full',hairColor:'#34251e',skinTone:.35,height:178});keeper.root.name='Gaius';scene.add(keeper.root);await Promise.all([PitPeople.fit(keeper),PitPeople.fit(dominus)]);dominus.root.position.set(-2,PitArena.galleryY,PitArena.half.z+2.2);dominus.root.rotation.y=-Math.PI/2;keeper.root.position.set(1.5,PitArena.galleryY,PitArena.half.z+2.2);keeper.root.rotation.y=-Math.PI/2;for(const actor of [dominus,keeper])actor.root.traverse(o=>{if(o.isMesh&&o.visible)o.castShadow=true;});keeper.root.traverse(o=>{if(o.name==='OwnerWhiteTunic'&&o.material)o.material.color.setHex(0x807768);});for(const actor of [dominus,keeper])actor.root.userData.contact=PitDetails.actorShadow(THREE,scene);cameraSnap=true;})().catch(e=>{keeperPromise=null;throw e;});return keeperPromise;}
 function fightPage(){
  const pairs=fightMode==='2x5',roster=state?.roster||[],ready=roster.filter(g=>g.ready!==false);
  $('fightTitle').textContent=pairs?'2x5 · İki savaşçını hazırla':'1x10 · Savaşçını hazırla';
  $('fightForm').dataset.pairs=String(pairs);$('fighterLoadout1').hidden=!pairs;
  for(const [i,id] of ['fightGladiator','fightMate'].entries()){
   const select=$(id),saved=select.value;
   select.replaceChildren(...roster.map(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name+' · '+g.fame+' Şan'+(g.ready===false?' · Hazır değil':'');o.disabled=g.ready===false;return o;}));
   select.value=ready.some(g=>g.id===saved)?saved:ready[i]?.id||'';select.required=i===0||pairs;select.disabled=i===1&&!pairs;
  }
  if(pairs&&$('fightMate').value===$('fightGladiator').value)$('fightMate').value=ready.find(g=>g.id!==$('fightGladiator').value)?.id||'';
  $('fightRules').textContent=pairs?'5 takım · 10 gladyatör · İki savaşçının silahını ayrı seç. İlkini sen yönetirsin; takım arkadaşın yanında dövüşür.':'İlk 4 gladyatör kuma çıkar. Her ölümde sıradaki girer; toplam 10 kişi. Son kalan kazanır.';
  $('fightStart').textContent=pairs?'İki gladyatörle katıl':'Silahı al ve katıl';updateFight();
 }
 let previousFighters=[];
 function updateFight(event){
  fightRequest=null;const pairs=fightMode==='2x5',roster=state?.roster||[],selects=[$('fightGladiator'),$('fightMate')],ids=selects.map(el=>el.value);
  if(pairs&&ids[0]&&ids[0]===ids[1]){
   const changed=event?.target===selects[1]?1:0,other=1-changed;
   ids[other]=roster.find(g=>g.ready!==false&&g.id===previousFighters[changed]&&g.id!==ids[changed])?.id||roster.find(g=>g.ready!==false&&g.id!==ids[changed])?.id||'';
   selects[other].value=ids[other];
  }
  previousFighters=ids.slice();
  const ready=id=>roster.some(g=>g.id===id&&g.ready!==false);
  const valid=ready(ids[0])&&(!pairs||ready(ids[1])&&ids[1]!==ids[0]);$('fightStart').disabled=!valid||fightBusy;
  const selections=[...$('fightForm').querySelectorAll('.fighter-loadout')].filter(el=>!el.hidden).map(el=>{const select=el.querySelector('select'),g=roster.find(g=>g.id===select.value),weapon=el.querySelector('input:checked');return g?g.name+' · '+({pit_wood_mace:'Ahşap gürz',pit_stone_mace:'Taş gürz',pit_bow:'Yay',pit_axe:'Balta'}[weapon?.value]||''):'';});
  $('fightMessage').textContent=valid?selections.join('   /   '):pairs?'Hazır iki farklı gladyatör seç.':'Hazır bir gladyatör seç.';
 }
 async function openFight(mode){fightMode=mode==='2x5'?'2x5':'1x10';fightRequest=null;$('circusDialog').close();fightPage();$('fightDialog').showModal();}
 $('fightClose').onclick=()=>{if(!fightBusy){$('fightDialog').close();talk(fightMode);}};
 $('fightDialog').addEventListener('cancel',e=>{if(fightBusy)e.preventDefault();});
 $('fightForm').onsubmit=async e=>{
  e.preventDefault();if(fightBusy||!$('fightForm').reportValidity())return;
  const data=new FormData($('fightForm')),first={gladiator:$('fightGladiator').value,pit_weapon:data.get('weapon')},second={gladiator:$('fightMate').value,pit_weapon:data.get('mate_weapon')},slots={pit_weapon:first.pit_weapon,pit_mode:fightMode,...(fightMode==='2x5'?{teammate:second.gladiator,teammate_weapon:second.pit_weapon}:{})};
  if(fightMode==='2x5'&&(!second.gladiator||second.gladiator===first.gladiator)){$('fightMessage').textContent='İki farklı gladyatör seç.';return;}
  fightBusy=true;for(const control of $('fightDialog').querySelectorAll('button,input,select'))control.disabled=true;
  $('fightMessage').textContent='Gaius isimleri kaydediyor. Kapılar birazdan açılacak…';const key='pit-start-v176:'+owner;
  try{
   if(!fightRequest){try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved?.gladiator===first.gladiator&&JSON.stringify(saved?.slots)===JSON.stringify(slots))fightRequest=saved;}catch{}}
   fightRequest=fightRequest||{gladiator:first.gladiator,slots,id:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(fightRequest));
   let timer;const r=await Promise.race([client.rpc('ludus_start_battle_v2',{p_gladiator:fightRequest.gladiator,p_mode:'pit',p_slots:fightRequest.slots,p_request:fightRequest.id}),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Bağlantı zaman aşımı. Aynı isteği yeniden dene.')),12000))]).finally(()=>clearTimeout(timer));
   if(r.error)throw r.error;sessionStorage.setItem('ludus-active-battle',r.data.id);sessionStorage.removeItem(key);location.assign('arena.html?battle='+encodeURIComponent(r.data.id)+'&v=revision192');
  }catch(e){$('fightMessage').textContent=e.message||'Bağlantı kurulamadı. Aynı isteği yeniden deneyebilirsin.';if(e.code){sessionStorage.removeItem(key);fightRequest=null;}}
  finally{fightBusy=false;for(const control of $('fightDialog').querySelectorAll('button,input,select'))control.disabled=false;$('fightMate').disabled=fightMode!=='2x5';}
 };
 $('fightGladiator').onchange=$('fightMate').onchange=updateFight;$('fightForm').querySelectorAll('input[type=radio]').forEach(el=>el.onchange=updateFight);
 async function loadRigs(){if(rigPromise)return rigPromise;rigPromise=(async()=>{for(const f of ['arena-runtime-v96.js','arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v91.js','arena-locomotion-v91.js','ludus-manica-v119.js','caravan-core-v126.js','caravan-assets-v126.js','combat-curves-v163.js','combat-motion-v163.js','equipment-catalog-v167.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js','caravan-rig-v126.js'])await script(f);await Promise.all([ImportedGladiator.load(()=>{}),PitArena.preload(['pit_stone_mace','pit_wood_mace'])]);exhibition=PitExhibition.create(state.bout);exhibitionId=state.bout.id;const c=exhibition.combat;rigs=Array.from({length:4},(_,i)=>{const f=c.fighters[i],type=i?'thraex':'secutor';if(f){f.name=names[i];f.type=type;}const m=ImportedGladiator.create(i,type);m.root.visible=!!f;scene.add(m.root);return{f,m};});})().catch(e=>{rigPromise=null;throw e;});return rigPromise;}
 async function stage(){renderer=new THREE.WebGLRenderer({canvas:$('pitScene'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;scene=new THREE.Scene();scene.background=new THREE.Color('#c4d3db');scene.fog=new THREE.Fog('#c4d3db',40,90);camera=new THREE.PerspectiveCamera(48,1,.1,100);scene.add(new THREE.HemisphereLight(0xe4efff,0xb2a697,1.55));const sun=new THREE.DirectionalLight(0xffecd2,2.5);sun.position.set(-15,24,12);sun.target.position.set(0,2,0);scene.add(sun.target);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<1100?1024:2048,innerWidth<1100?1024:2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:22,bottom:-22,near:.5,far:75});sun.shadow.bias=-.00012;sun.shadow.normalBias=.018;sun.shadow.radius=2;scene.add(sun);world=await PitArena.load(scene,renderer);world.traverse(o=>{if(o.name==='Bordo keten gölgelik')galleryRoofs.push(o);});requestAnimationFrame(frame);}
 function constrainCamera(position,target){
  const direction=position.clone().sub(target),length=direction.length();if(length<.01)return;direction.normalize();const ray=new THREE.Ray(target,direction),hit=new THREE.Vector3();let limit=length;
  for(const box of world.userData.cameraObstacles||[])if(ray.intersectBox(box,hit)){const d=target.distanceTo(hit);if(d>.18&&d<limit)limit=Math.max(.35,d-.12);}
  if(limit<length)position.copy(target).addScaledVector(direction,limit);
 }
 function frame(t){requestAnimationFrame(frame);if(document.hidden||$('circusDialog').open||$('betDialog').open||$('fightDialog').open||t-last<1000/30){last=($('circusDialog').open||$('betDialog').open||$('fightDialog').open)?t:last;return;}const dt=Math.min(.1,(t-last)/1000||.016);last=t;const w=innerWidth,h=innerHeight;if($('pitScene').width!==Math.round(w*renderer.getPixelRatio())||$('pitScene').height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  if(view==='overview'&&dominus?.root.userData.loaded){
   const p=dominus.root.position,x=stick.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),z=stick.z+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0),len=Math.max(1,Math.hypot(x,z)),blend=1-Math.exp(-dt*12),old=p.clone();
   velocity.x+=((Math.cos(yaw)*x+Math.sin(yaw)*z)/len*1.8-velocity.x)*blend;velocity.z+=((-Math.sin(yaw)*x+Math.cos(yaw)*z)/len*1.8-velocity.z)*blend;
   PitArena.moveGallery(p,velocity.x*dt,velocity.z*dt);
   const obstacles=[...(world.userData.obstacles||[]),{x:keeper.root.position.x,z:keeper.root.position.z,r:.48}];for(const o of obstacles){const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz),r=o.r+.25;if(d<r){const candidate={x:p.x+(dx/(d||1))*(r-d),z:p.z+(dz/(d||1))*(r-d)};if(PitArena.galleryContains(candidate.x,candidate.z)){p.x=candidate.x;p.z=candidate.z;}else p.copy(old);}}
   walkSpeed=p.distanceTo(old)/dt;if(walkSpeed>.03){const angle=Math.atan2(p.x-old.x,p.z-old.z),delta=Math.atan2(Math.sin(angle-dominus.root.rotation.y),Math.cos(angle-dominus.root.rotation.y));dominus.root.rotation.y+=delta*(1-Math.exp(-dt*12));}dominus.animate(dt,walkSpeed);
   for(const roof of galleryRoofs)roof.visible=true;
   const goal=new THREE.Vector3(p.x+Math.sin(yaw)*3.45,p.y+2.28,p.z+Math.cos(yaw)*3.45);
   goal.x=Math.max(-PitArena.half.x-3.4,Math.min(PitArena.half.x+3.4,goal.x));goal.z=Math.max(-PitArena.half.z-3.4,Math.min(PitArena.half.z+3.4,goal.z));
   const target=new THREE.Vector3(p.x,p.y+1.15,p.z);cameraTarget=cameraTarget||target.clone();cameraTarget.lerp(target,1-Math.exp(-dt*10));
   constrainCamera(goal,cameraTarget);if(cameraSnap){camera.position.copy(goal);cameraSnap=false;}else camera.position.lerp(goal,1-Math.exp(-dt*7));constrainCamera(camera.position,cameraTarget);camera.lookAt(cameraTarget);
  }else if(rigs){
   for(const roof of galleryRoofs)roof.visible=true;const living=rigs.filter(r=>r.f?.hp>0),xs=living.map(r=>r.f.x),zs=living.map(r=>r.f.z),cx=xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length),cz=zs.reduce((a,b)=>a+b,0)/Math.max(1,zs.length),span=Math.max(5,Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs)),distance=Math.min(18,Math.max(9,span*1.45))*(w<h?1.45:1);
   const goal=new THREE.Vector3(cx+Math.sin(yaw)*distance,7+distance*.32,cz+Math.cos(yaw)*distance);goal.x=Math.max(-PitArena.half.x-3.4,Math.min(PitArena.half.x+3.4,goal.x));goal.z=Math.max(-PitArena.half.z-3.4,Math.min(PitArena.half.z+3.4,goal.z));if(cameraSnap){camera.position.copy(goal);cameraSnap=false;}else camera.position.lerp(goal,1-Math.exp(-dt*2.2));cameraTarget=cameraTarget||new THREE.Vector3();cameraTarget.lerp(new THREE.Vector3(cx,.8,cz),1-Math.exp(-dt*3));camera.lookAt(cameraTarget);
  }
  if(rigs&&exhibition){
   if(exhibitionId!==state.bout.id){exhibition=PitExhibition.create(state.bout);exhibitionId=state.bout.id;rigs.forEach((r,i)=>r.f=exhibition.combat.fighters[i]);}
   const elapsed=state?.bout.started_at?Math.max(0,(Date.now()+clockOffset-Date.parse(state.bout.started_at))/1000):0;exhibition.update(state.bout,elapsed,dt);
   rigs.forEach(({f,m},i)=>{if(!f){m.root.visible=false;return;}ImportedGladiator.animate(f,m,exhibition.elapsed,dt);if(m.teamMark)m.teamMark.visible=false;m.root.visible=view==='watch'&&i<(state?.bout.participants||4);});
  }
  for(const c of world.userData.cloths||[]){if(!c.mesh.visible)continue;const p=c.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=c.base[i*3],y=c.base[i*3+1],v=(c.mesh.geometry.parameters.height/2-y)/c.mesh.geometry.parameters.height;const u=(x+c.mesh.geometry.parameters.width/2)/c.mesh.geometry.parameters.width,free=c.awning?Math.sin(Math.PI*u)*Math.sin(Math.PI*v):v*Math.sin(Math.PI*u);p.setZ(i,c.base[i*3+2]+Math.sin(t*.0013+x*3.4-y*1.2)*.018*free);}p.needsUpdate=true;if(Math.floor(t/100)%3===0)c.mesh.geometry.computeVertexNormals();}
  PitSurface.update(world,t/1000,camera,view==='watch'?exhibition?.combat.fighters:null);for(const actor of [dominus,keeper])if(actor?.root.userData.contact){const shadow=actor.root.userData.contact;shadow.position.copy(actor.root.position);shadow.visible=view==='overview';}
  if(keeper){keeper.animate(dt,0);const p=keeper.root.position.clone().add(new THREE.Vector3(0,2.05,0)).project(camera);$('bookmakerLabel').hidden=view!=='overview'||!keeper.root.userData.loaded||p.z>1||p.z< -1||Math.abs(p.x)>.95||Math.abs(p.y)>.9||!dominus||dominus.root.position.distanceTo(keeper.root.position)>=2.8;$('bookmakerLabel').style.left=(p.x*.5+.5)*w+'px';$('bookmakerLabel').style.top=(-p.y*.5+.5)*h+'px';}renderer.render(scene,camera);
 }
 let stickPointer=null;const pad=$('walkStick');function stickMove(e){const b=pad.getBoundingClientRect();const x=(e.clientX-b.x-b.width/2)/(b.width*.36),z=(e.clientY-b.y-b.height/2)/(b.height*.36),len=Math.hypot(x,z),scale=len<.12?0:Math.min(1,(len-.12)/.88)/(len||1);stick.x=x*scale;stick.z=z*scale;$('walkThumb').style.transform=`translate(${stick.x*25}px,${stick.z*25}px)`;}pad.onpointerdown=e=>{stickPointer=e.pointerId;pad.setPointerCapture(e.pointerId);stickMove(e);};pad.onpointermove=e=>{if(e.pointerId===stickPointer)stickMove(e);};function clearMove(){keys.clear();velocity.x=velocity.z=0;stick.x=stick.z=0;stickPointer=null;$('walkThumb').style.transform='';}pad.onpointerup=pad.onpointercancel=pad.onlostpointercapture=clearMove;addEventListener('keydown',e=>{if(e.code==='KeyE'&&!e.repeat&&!document.querySelector('dialog[open]')&&nearKeeper()){clearMove();talk();return;}if(/^(Key[WASD]|Arrow)/.test(e.code)&&!document.querySelector('dialog[open]')){e.preventDefault();keys.add(e.code);}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',clearMove);document.addEventListener('visibilitychange',clearMove);document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',clearMove));
 let drag=null;$('pitScene').onpointerdown=e=>{drag=e.clientX;e.target.setPointerCapture(e.pointerId);};$('pitScene').onpointermove=e=>{if(drag!==null){yaw+=(e.clientX-drag)*.008;drag=e.clientX;}};$('pitScene').onpointerup=$('pitScene').onpointercancel=$('pitScene').onlostpointercapture=()=>drag=null;
 async function boot(){if(booting)return;booting=true;$('retry').hidden=true;try{let authTimer;const auth=await Promise.race([client.auth.getUser(),new Promise((_,reject)=>authTimer=setTimeout(()=>reject(Error('Oturum doğrulanamadı. Yeniden dene.')),12000))]).finally(()=>clearTimeout(authTimer));if(auth.error||!auth.data.user||auth.data.user.is_anonymous){location.replace('index.html');return;}owner=auth.data.user.id;appearance=auth.data.user.user_metadata?.ludus_owner||{};LudusNavigation.setOwner(owner);try{pending=JSON.parse(sessionStorage.getItem(pendingKey())||'null');}catch{}await rpc();await stagePromise;let timeout;try{await Promise.race([loadKeeper(),new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('Dominus yüklenemedi. Yeniden dene.')),18000))]);}finally{clearTimeout(timeout);}RomeTravel.pageReady();showView('overview');if(new URLSearchParams(location.search).has('fight'))openFight(new URLSearchParams(location.search).get('fight'));}catch(e){notice(e.message||'Hesap açılamadı');$('retry').hidden=false;RomeTravel.fail('Avlu hesabı açılamadı. Yeniden dene.');}finally{booting=false;}}
 $('retry').onclick=()=>location.reload();const stagePromise=stage();stagePromise.catch(()=>{});boot();
 setInterval(async()=>{if(document.hidden||busy||polling||!state||state.bout.status!=='running')return;polling=true;try{await rpc();}catch{notice('Bağlantı bekleniyor; kuponun kayıtlı.');}finally{polling=false;}},2500);
 setInterval(()=>{if(view==='watch'&&state?.bout){const b=state.bout;notice(b.status==='running'?`Herkes tek · ${Math.max(0,Math.ceil((Date.parse(b.finish_at)-Date.now()-clockOffset)/1000))} sn`:b.status==='settled'&&!exhibition?.complete?'Müsabakanın son vuruşları…':b.status==='settled'?`${names[b.winner]} kazandı${b.selected!==null?' · '+(b.payout?b.payout+' denarius ödeme':'Kupon kazanamadı'):''}`:'Gösteri düellosu');}},1000);
 window.PitVisit={get ready(){return !booting&&!!state&&!!dominus?.root.userData.loaded;},get exhibition(){return exhibition;},get camera(){return camera;},get renderer(){return renderer;},get dominus(){return dominus;},openFight,get state(){return state;},get scene(){return scene;},get rigError(){return rigError;},get rigs(){return rigs;},showView,talk};
})();
