/* Visitor flow. Account races, ticket prices and payment are owned by ludus_circus RPC. */
var CircusVisit=(()=>{
 'use strict';
 const traits=[['speed','Hız'],['stamina','Dayanıklılık'],['acceleration','Hızlanma'],['agility','Çeviklik'],['power','Güç'],['balance','Denge'],['courage','Cesaret'],['burst','Patlama'],['recovery','Toparlanma']];
 const $=id=>document.getElementById(id),num=n=>Number(n||0).toLocaleString('tr-TR'),odd=n=>Number(n).toFixed(1).replace('.',','),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
 const button=(text,fn)=>{const b=el('button','',text);b.type='button';b.onclick=fn;return b;};
 const deadline=p=>{let timer;return Promise.race([p,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Bağlantı gecikti. Yeniden dene; kupon iki kez kesilmez.')),18000))]).finally(()=>clearTimeout(timer));};
 async function create(T,ctx){
  const gallery=ctx.gallery,client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
  let user=null,state=null,pending=null,busy=false,offset=0,active=false,mode='walk',selected=0,dialogType='office',message='',lastPoll=0,polling=false;
  let heat={id:'guest',teams:structuredClone(CircusRoster),status:'open',entered:false,selected:null,stake:0,payout:0,started_at:null,durations:null,winner:null};
  const race=await ctx.getRace();const player={...gallery.spawn,y:gallery.floor},keys=new Set(),stick={x:0,y:0,id:null},look={yaw:Math.PI/2,pitch:.36};let near=null,drag=null,avatar,settleFrames=0,historyPage=0,entryIds=[],betStake='100',steering=0,driveFlash='',flashUntil=0,resultDismissed=null,resultShown=null,lastNeedleTime=0;
  try{const r=await deadline(client.auth.getUser());user=r.data?.user||null;if(r.error&&r.error.name!=='AuthSessionMissingError')message='Hesap bağlantısı kurulamadı. Gişeden yeniden deneyebilirsin.';}catch(e){message=e.message;}
  window.LudusNavigation?.setOwner(user?.id||null);
  if(user){try{pending=JSON.parse(localStorage.getItem('circus-pending-v147:'+user.id)||'null');}catch{}await refresh();}
  avatar=LudusOwner.create(user?.user_metadata?.ludus_owner);ctx.scene.add(avatar.root);await avatar.ready;avatar.root.rotation.y=-Math.PI/2;avatar.root.visible=false;
  const response=await fetch('assets/caravan-v128/driver.glb');if(!response.ok)throw Error('Gişe görevlileri yüklenemedi.');const template=(await new T.GLTFLoader().parseAsync(await response.arrayBuffer(),'')).scene;
  const npcs=new T.Group();ctx.scene.add(npcs);
  for(const {x,z,color,yaw}of gallery.npcs){const model=CircusRace.cloneRig(template),holder=new T.Group();holder.add(model);model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model);model.position.y-=box.min.y;holder.scale.setScalar(1.78/(box.max.y-box.min.y));holder.position.set(x,gallery.floor,z);holder.rotation.y=yaw;model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.name==='OwnerWhiteTunic')o.material.color.setHex(color);o.receiveShadow=true;o.castShadow=true;}});const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});for(const side of ['Left','Right']){const bone=bones[side+'Arm'],end=bones[side+'ForeArm'];model.updateMatrixWorld(true);const direction=end.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize(),target=new T.Vector3(side==='Left'?.12:-.12,-1,0).normalize(),rotation=new T.Quaternion().setFromUnitVectors(direction,target).multiply(bone.getWorldQuaternion(new T.Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));}npcs.add(holder);}
  function notice(text){message=text;$('visitNotice').textContent=text;}
  function adopt(data,sentAt=Date.now()){if(data.user_id!==user.id)throw Error('Hesap değişti. Sayfayı yenile.');state=data;heat=data.heat;historyPage=data.history?.page||0;offset=Date.parse(data.server_now)-(sentAt+Date.now())/2;race.configure(heat.teams,heat.durations,heat.drive,heat.id);race.active=active;if(active)race.sync(elapsed(),0);wallet();ctx.invalidate();}
  function wallet(){$('visitWallet').textContent=user&&state?num(state.gold)+' denarius':'Misafir';}
  async function refresh(page=historyPage){if(polling)return;polling=true;const sentAt=Date.now();try{const {data,error}=await deadline(client.rpc('ludus_circus',{p_args:{history_page:page}}));if(error)throw error;adopt(data,sentAt);lastPoll=Date.now();if($('circusDialog').open)renderDialog();}catch(e){notice(e.message||'Gişeye bağlanılamadı.');}finally{polling=false;if($('circusDialog').open)historyPanel();}}
  async function act(action,args={}){
   if(busy)return false;if(!user){notice('Kupon ve katılım için ludus hesabına giriş yap.');return false;}
   if(pending){notice('Bekleyen işlemi önce Yeniden dene ile tamamla.');renderDialog();return false;}
   pending={action,args:{...args,heat:heat.id},request:crypto.randomUUID()};try{localStorage.setItem('circus-pending-v147:'+user.id,JSON.stringify(pending));}catch{}return sendPending();
  }
  async function sendPending(){if(!pending||busy)return false;busy=true;renderDialog();let ok=false;try{const sentAt=Date.now(),p=pending,{data,error}=await deadline(client.rpc('ludus_circus',{p_action:p.action,p_args:p.args,p_request:p.request}));if(error){if(['P0001','22P02','22003','23514','23505'].includes(error.code)){pending=null;localStorage.removeItem('circus-pending-v147:'+user.id);}throw error;}adopt(data,sentAt);pending=null;try{localStorage.removeItem('circus-pending-v147:'+user.id);}catch{}notice('');ok=true;}catch(e){notice(e.message||'İşlem tamamlanamadı. Yeniden dene.');}finally{busy=false;renderDialog();if(active)updateDriving();ctx.invalidate();}return ok;}
  function elapsed(){return heat.started_at?Math.max(0,(Date.now()+offset-Date.parse(heat.started_at))/1000):0;}
  function open(type='office'){if(!pending)notice('');dialogType=type;keys.clear();stick.x=stick.y=0;renderDialog();$('circusDialog').showModal();if(user&&!busy)refresh();ctx.invalidate();}
  function close(){$('circusDialog').close();ctx.canvas.focus({preventScroll:true});ctx.invalidate();}
  function horseCard(h){const card=el('article','circus-horse'),head=el('div','horse-heading'),img=el('img');img.src=LudusHorseAppearance.photo(h);img.alt=h.name;const text=el('div');text.append(el('strong','',h.name),el('small','',LudusHorseAppearance.coat(h).name+' · Genel '+num(h.quality)));head.append(img,text);card.append(head);const grid=el('dl','horse-stats');for(const [key,label]of traits){const cell=el('div');cell.append(el('dt','',label),el('dd','',num(h.stats[key])));grid.append(cell);}card.append(grid);return card;}
  function historyPanel(){
   const panel=$('circusHistory');panel.hidden=dialogType!=='ticket';panel.replaceChildren();if(panel.hidden)return;
   panel.append(el('h3','','Bahis geçmişi'));
   const history=state?.history,items=history?.items||[];
   if(!user)panel.append(el('p','history-empty','Geçmiş kuponlarını görmek için giriş yap.'));
   else if(!items.length)panel.append(el('p','history-empty','Henüz kuponun yok. İlk bahsin burada görünecek.'));
   for(const h of items){const row=el('article','history-row '+(h.status==='settled'?(h.won?'win':'loss'):'waiting')),won=h.status==='settled'&&h.won;
    row.append(el('strong','',h.team_name),el('small','',new Date(h.created_at).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})));
    row.append(el('b','history-amount',h.status!=='settled'?'Bekliyor · '+num(h.stake)+' D':won?'Kazanç +'+num(h.payout-h.stake)+' D':'Kayıp −'+num(h.stake)+' D'));
    row.append(el('span','',h.status==='settled'&&won?'Toplam ödeme '+num(h.payout)+' D · Kupon '+num(h.stake)+' D':'Kupon '+num(h.stake)+' D · Oran '+odd(h.odds)));panel.append(row);
   }
   if(history?.pages>1){const nav=el('div','history-pages'),prev=button('‹',()=>refresh(historyPage-1)),next=button('›',()=>refresh(historyPage+1));prev.setAttribute('aria-label','Önceki bahisler');next.setAttribute('aria-label','Sonraki bahisler');prev.disabled=historyPage<=0||polling;next.disabled=historyPage>=history.pages-1||polling;nav.append(prev,el('span','',(historyPage+1)+' / '+history.pages),next);panel.append(nav);}
  }
  function goSeat(){close();mode='seat';avatar.root.visible=false;notice(heat.status==='open'?'Hazır olduğunda yarışı başlat.':'');ctx.invalidate();}
  function entryPanel(content,actions){
   if(!state||!user)return;
   if(heat.status==='settled'){content.append(el('p','entry-help','Önceki yarış bitti. Yeni bir yarış açıp kendi takımını kaydedebilirsin.'));actions.append(button('Yeni yarış aç ve katıl',async()=>{if(await act('next')){entryIds=[];renderDialog();}}));return;}
   if(heat.status==='running'){content.append(el('p','entry-help',heat.entered?'Takımın şu anda yarışıyor. Kaldığın yerden izleyebilirsin.':'Yarış başladı; bu yarışa katılım kapandı.'));actions.append(button(heat.entered?'Takımımı izle':'Tribünden izle',()=>{close();mode=heat.entered?'driver':'seat';ctx.invalidate();}));return;}
   if(heat.selected!==null){content.append(el('p','entry-help','Bu yarışa kupon yaptın. Kendi takımınla sonraki yarışa katılabilirsin.'));actions.append(button('Kuponlu yarışı tribünden izle',goSeat));return;}
   if(heat.entered){const pair=el('div','horse-pair');heat.teams[3].horses.forEach(h=>pair.append(horseCard(h)));content.append(el('p','entry-help','Takımın kaydedildi · '+heat.teams[3].name),pair);const start=button('Takımla piste çık',async()=>{await beginRace(true);if(heat.status==='running')close();});start.id='enterTrack';actions.append(button('Katılımı iptal et',()=>act('cancel_entry')),start);return;}
   const horses=state.horses||[],eligible=horses.filter(h=>h.eligible);
   if(!horses.length){content.append(el('p','entry-help','Ahırında at bulunmuyor. Yarışa katılmak için iki yetişkin at edinmelisin.'));}
   else {
    entryIds=entryIds.filter(id=>eligible.some(h=>h.id===id));for(const h of eligible){if(entryIds.length>=2)break;if(!entryIds.includes(h.id))entryIds.push(h.id);}
    const fields=el('div','entry-fields');for(let i=0;i<2;i++){const label=el('label','','At '+(i+1)),select=el('select');select.id='entryHorse'+i;select.add(new Option('At seç',''));for(const h of horses){const reasons=h.ineligible_reasons||(!h.eligible?['Yarışa uygun değil']:[]),o=new Option(h.name+' · '+num(h.quality)+(h.eligible?' · Hazır':' · '+reasons.join(', ')),h.id);o.disabled=!h.eligible;select.add(o);}select.value=entryIds[i]||'';select.onchange=()=>{entryIds[i]=select.value;renderDialog();};label.append(select);fields.append(label);}content.append(fields);
    const pair=el('div','horse-pair');entryIds.slice(0,2).forEach(id=>{const h=horses.find(h=>h.id===id);if(h)pair.append(horseCard(h));});if(pair.children.length)content.append(pair);
    const unavailable=horses.filter(h=>!h.eligible);if(eligible.length<2){const note=el('p','entry-help','Hazır at: '+eligible.length+' / 2. '+unavailable.slice(0,2).map(h=>h.name+': '+(h.ineligible_reasons||['Yarışa uygun değil']).join(', ')).join(' · '));content.append(note);}
   }
   const stable=el('a','circus-login','Ahıra git');stable.href='ludus.html?room=stable&v=revision149';stable.onclick=e=>{if(window.LudusNavigation){e.preventDefault();LudusNavigation.go(stable.href);}};actions.append(stable);
   if(eligible.length>=2){const save=button('Takımı kaydet',async()=>{if(!entryIds[0]||!entryIds[1]||entryIds[0]===entryIds[1]){notice('İki farklı at seç.');renderDialog();return;}if(await act('enter',{horse1:entryIds[0],horse2:entryIds[1]})){selected=3;notice('Takımın hazır. Takımla piste çık düğmesine bas.');renderDialog();}});save.id='saveEntry';actions.append(save);}
  }
  function renderDialog(){
   const content=$('circusContent'),tabs=$('circusTeams'),actions=$('circusActions'),office=dialogType==='office',entry=dialogType==='entry';content.replaceChildren();tabs.replaceChildren();actions.replaceChildren();$('circusDialog').dataset.service=dialogType;$('circusServiceBack').hidden=office;tabs.hidden=office||entry;
   $('circusDialogTitle').textContent=office?'Hipodrom gişesi':entry?'Yarışmaya katıl':'Bahis yap';
   $('circusDialogue').textContent=office?'Salve! Bahis kuponu hazırlayabilir veya kendi iki atınla yarışa katılabilirsin.':entry?'İki farklı, yetişkin ve yarışa hazır atını seç. Katılım ücretsiz; sağ-sol kontrolü ve zamanlamalı hızlanma senin elinde.':'Dört araba, sekiz at. Kazanacağını düşündüğün takımı seç.';
   if(office){const choices=el('div','office-choices');for(const [label,sub,type]of [['Bahis yap','Takımları incele · Kupon oluştur','ticket'],['Yarışmaya katıl','Kendi iki atınla piste çık','entry']]){const b=button(label,()=>{dialogType=type;renderDialog();});b.append(el('small','',sub));choices.append(b);}content.append(choices);}
   else if(entry)entryPanel(content,actions);
   else{for(let i=0;i<4;i++){const t=heat.teams[i],b=button(t.name+' · '+odd(t.odds),()=>{selected=i;renderDialog();});b.className='team-tab team-'+i;b.setAttribute('aria-pressed',String(selected===i));tabs.append(b);}const pair=el('div','horse-pair');heat.teams[selected].horses.forEach(h=>pair.append(horseCard(h)));content.append(pair);}
   if(!office){
    if(!user){const link=el('a','circus-login','Hesabına giriş yap');link.href='arena.html';actions.replaceChildren(el('span','','Oyun içi denarius hesabınla giriş yap.'),link);}
    else if(!state){actions.replaceChildren(button('Hesabı yeniden yükle',()=>refresh()));}
    else if(pending){const b=button(busy?'Kaydediliyor…':'Bekleyen işlemi yeniden dene',sendPending);b.disabled=busy;actions.replaceChildren(b);}
    else if(!entry){
     if(heat.status==='settled'){actions.append(el('span','',heat.teams[heat.winner].name+' kazandı.'),button('Yeni yarış aç',()=>act('next')));}
     else if(heat.status==='running'){actions.append(el('span','','Yarış başladı; kuponlar kapandı.'),button('Tribünden izle',goSeat));}
     else if(heat.entered){actions.append(el('span','','Bu yarışta kendi takımın var; kupon kapalı.'),button('Katılımımı aç',()=>{dialogType='entry';renderDialog();}));}
     else if(heat.selected!==null){actions.append(el('span','coupon-receipt',heat.teams[heat.selected].name+' · '+num(heat.stake)+' × '+odd(heat.odds)+' = '+num(Math.floor(heat.stake*heat.odds))+' denarius toplam ödeme. Kupon kaydedildi.'),button('Tribüne geç',goSeat));}
     else{const label=el('label','','Kupon bedeli'),input=el('input');input.id='betStake';input.type='number';input.inputMode='numeric';input.min='10';input.max='10000';input.step='10';input.value=betStake;label.append(input);const summary=el('span','coupon-total');const update=()=>{betStake=input.value;summary.textContent='Oran '+odd(heat.teams[selected].odds)+' · Toplam ödeme '+num(Math.floor(Math.max(0,Number(input.value)||0)*heat.teams[selected].odds))+' D (kupon dahil)';};input.oninput=update;update();const b=button('Kuponu onayla',async()=>{const stake=Number(input.value);if(!Number.isInteger(stake)||stake<10||stake>10000||stake%10){notice('10–10.000 arasında, 10 katı denarius gir.');renderDialog();return;}if(await act('bet',{team:selected,stake})){notice('Kuponun kaydedildi. Tribüne geçebilirsin.');renderDialog();}});b.id='placeBet';actions.append(label,summary,b);}
    }
   }
   for(const b of actions.querySelectorAll('button,input,select'))b.disabled=busy;for(const select of content.querySelectorAll('select'))select.disabled=busy;
   $('circusMessage').textContent=message;$('circusDialogBalance').textContent=user&&state?num(state.gold)+' denarius':'Misafir';historyPanel();
  }
  $('circusServiceBack').onclick=()=>{dialogType='office';renderDialog();};
  async function beginRace(own=false){if(busy)return;if(user){if(!await act('start',{driving:own?150:null}))return;}else{heat.status='running';heat.started_at=new Date().toISOString();const order=[0,1,2,3].map(i=>({i,k:-Math.log(Math.max(.0001,Math.random()))/Math.pow(heat.teams[i].quality,4)})).sort((a,b)=>a.k-b.k);heat.durations={};order.forEach((x,i)=>heat.durations[x.i]=120+i*3+.5);race.configure(heat.teams,heat.durations,heat.drive,heat.id);}if(!active){race.active=false;return;}mode=own?'driver':'seat';notice('');race.active=true;ctx.invalidate();}
  function stand(){mode='walk';ctx.camera.fov=58;ctx.camera.updateProjectionMatrix();player.x=gallery.stand.x;player.z=gallery.stand.z;avatar.root.visible=true;notice('');ctx.invalidate();}
  function interact(){if($('circusDialog').open||!near)return;if(near.id==='seat'){mode='seat';avatar.root.visible=false;notice(heat.status==='open'?'Hazır olduğunda yarışı başlat.':'');}else open('office');ctx.invalidate();}
  $('circusClose').onclick=close;$('visitAction').onclick=interact;$('visitStand').onclick=stand;$('visitStart').onclick=()=>beginRace(mode==='driver');$('visitZoom').onclick=()=>{ctx.camera.fov=ctx.camera.fov<40?58:30;ctx.camera.updateProjectionMatrix();$('visitZoom').textContent=ctx.camera.fov<40?'Geniş açı':'Yakın izle';ctx.invalidate();};$('visitCamera').onclick=()=>{race.nextCamera();ctx.invalidate();};
  $('visitNext').onclick=async()=>{if(user){if(!await act('next'))return;}else{heat={...heat,status:'open',started_at:null,winner:null,durations:null};race.reset();}stand();notice('Yeni yarış hazır. Gişeden takımları inceleyebilirsin.');};
  $('visitExit').onclick=()=>{active=false;avatar.root.visible=false;npcs.visible=false;race.active=false;$('visitHUD').hidden=true;document.body.classList.remove('visiting');keys.clear();stick.x=stick.y=0;if(window.LudusNavigation)LudusNavigation.back('roma.html');else location.href='roma.html?v=revision148';};
  const pad=$('visitStick'),knob=$('visitKnob');function resetInput(){keys.clear();stick.x=stick.y=0;stick.id=null;drag=null;steering=0;knob.style.transform='translate(-50%,-50%)';}
  pad.onpointerdown=e=>{if(mode!=='walk'||$('circusDialog').open)return;stick.id=e.pointerId;pad.setPointerCapture(e.pointerId);moveStick(e);};
  function moveStick(e){if(e.pointerId!==stick.id)return;const b=pad.getBoundingClientRect(),x=(e.clientX-b.x-b.width/2)/(b.width*.36),y=(e.clientY-b.y-b.height/2)/(b.height*.36),len=Math.max(1,Math.hypot(x,y));stick.x=x/len;stick.y=y/len;knob.style.transform=`translate(calc(-50% + ${stick.x*28}px),calc(-50% + ${stick.y*28}px))`;ctx.invalidate();}
  pad.onpointermove=moveStick;for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,resetInput);
  window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{resetInput();if(!document.hidden&&active&&user)refresh();});
  window.addEventListener('keydown',e=>{if(!active||$('circusDialog').open||/INPUT|SELECT/.test(e.target.tagName))return;const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){keys.add(key);e.preventDefault();ctx.invalidate();}if(key==='e')interact();if(key===' '&&mode==='driver'){e.preventDefault();boost();}if(key==='escape'&&mode==='seat')stand();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  ctx.canvas.addEventListener('pointerdown',e=>{if(active&&mode==='walk'&&!$('circusDialog').open){drag={id:e.pointerId,x:e.clientX,y:e.clientY};ctx.canvas.setPointerCapture(e.pointerId);}});
  ctx.canvas.addEventListener('pointermove',e=>{if(!active||!drag||drag.id!==e.pointerId)return;look.yaw-=(e.clientX-drag.x)*.004;look.pitch=T.MathUtils.clamp(look.pitch+(e.clientY-drag.y)*.003,.15,.65);drag.x=e.clientX;drag.y=e.clientY;ctx.invalidate();});for(const event of ['pointerup','pointercancel','lostpointercapture'])ctx.canvas.addEventListener(event,()=>drag=null);
  function allowed(x,z){const b=gallery.bounds;return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&!gallery.colliders.some(c=>Math.abs(x-c.x)<c.w/2+.3&&Math.abs(z-c.z)<c.d/2+.3);}
  function update(dt){if(!active)return;dt=Math.min(.05,Math.max(0,dt));const moving=mode==='walk'&&!$('circusDialog').open;
   let speed=0;if(moving){let x=stick.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),z=stick.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0),length=Math.hypot(x,z);if(length>.1){x/=Math.max(1,length);z/=Math.max(1,length);const forward=new T.Vector3(-Math.sin(look.yaw),0,-Math.cos(look.yaw)),right=new T.Vector3(-forward.z,0,forward.x),direction=right.multiplyScalar(x).addScaledVector(forward,-z);speed=Math.min(1,length)*2.6;const dx=direction.x*2.6*dt,dz=direction.z*2.6*dt;let moved=false;if(allowed(player.x+dx,player.z)){player.x+=dx;moved=true;}if(allowed(player.x,player.z+dz)){player.z+=dz;moved=true;}if(!moved)speed=0;avatar.root.rotation.y=Math.atan2(direction.x,direction.z);}}
   avatar.root.position.set(player.x,player.y,player.z);avatar.root.visible=mode==='walk';avatar.animate(dt,speed);settleFrames=speed>0?18:Math.max(0,settleFrames-1);near=mode==='walk'?gallery.points.find(p=>Math.hypot(player.x-p.x,player.z-p.z)<2.4):null;
   $('visitAction').hidden=!near;$('visitAction').textContent=near?.label||'';
   $('visitStick').hidden=mode!=='walk';$('visitZoom').hidden=mode!=='seat';document.querySelector('.visit-guide').hidden=mode!=='walk';$('visitStand').hidden=mode==='walk'||mode==='driver';$('visitStand').textContent=mode==='driver'?'Tribüne dön':'Kalk ve yürü';$('visitStart').hidden=mode==='walk'||heat.status!=='open';$('visitCamera').hidden=true;$('visitNext').hidden=heat.status!=='settled';
   const running=heat.status!=='open';if(mode==='driver'&&heat.status==='running'){const direction=steering+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);race.steer(direction,dt);}if(!race.active)race.active=true;if(running)race.sync(elapsed(),dt);else race.sync(0,0);
   if(!user&&running&&race.done){heat.status='settled';heat.winner=race.winner;}
   if(user&&running&&!polling&&!busy&&Date.now()-lastPoll>5000){lastPoll=Date.now();refresh();}
   updateStandings();const progress=race.teams.map((t,i)=>`${heat.teams[i].name} ${t.rank}.`).join(' · ');$('visitRaceState').textContent=running?(race.countdown>0?'Başlangıç '+Math.ceil(race.countdown):race.winner!==null?heat.teams[race.winner].name+' kazandı':progress):'4 araba · 8 at · 2 tur';
   if(heat.status==='settled')$('visitResult').textContent=heat.selected!==null?`${heat.teams[heat.winner].name} kazandı · Kupon ödemesi ${num(heat.payout)} denarius`:heat.teams[heat.winner].name+' kazandı';else $('visitResult').textContent='';
   updateDriving();updateResult();
   if(mode==='walk'){const distance=5.5,c=ctx.camera;const eye=new T.Vector3(player.x+Math.sin(look.yaw)*distance,player.y+1.8+look.pitch*1.4,player.z+Math.cos(look.yaw)*distance);const b=gallery.cameraBounds;eye.x=T.MathUtils.clamp(eye.x,b.minX,b.maxX);eye.z=T.MathUtils.clamp(eye.z,b.minZ,b.maxZ);c.position.copy(eye);c.lookAt(player.x,player.y+1.3,player.z);}
   else if(mode==='driver'){race.follow(ctx.camera,3);}
   else{ctx.camera.position.set(-52.6,15.7,-75.5);const target=running?race.teams.find(t=>t.rank===1).group.position:new T.Vector3(20,0,-85);ctx.camera.lookAt(target.x,1.1,target.z);}
  }
  function updateStandings(){
   const list=$('visitStandings'),colors=['#8b2943','#245b94','#34734c','#9d7420'];
   list.hidden=mode==='driver';
   const order=race.teams.map((t,i)=>({rank:t.rank,i,name:heat.teams[i].name})).sort((a,b)=>a.rank-b.rank);
   if(!list.children.length)for(let i=0;i<4;i++)list.append(el('li'));
   order.forEach((t,i)=>{const row=list.children[i];row.textContent=t.rank+'. '+t.name;row.style.color=colors[t.i];row.dataset.team=t.i;});
  }
  function updateDriving(){
   document.body.classList.toggle('race-running',heat.status==='running'&&mode!=='walk');const driving=mode==='driver'&&heat.status!=='open';document.body.classList.toggle('driving-race',driving);$('driveHUD').hidden=!driving||heat.status==='settled';
   if(!driving)return;
   const t=Math.max(0,elapsed()-3),d=heat.drive,metrics=CircusDriving.metrics(d,t,Number(heat.durations?.[3]||129)),finished=race.teams[3].finished;
   $('driveRank').textContent=race.teams[3].rank+' / '+race.teams.length;
   $('driveStaminaFill').style.width=metrics.stamina+'%';$('driveStaminaValue').textContent=Math.floor(metrics.stamina);$('driveStamina').setAttribute('aria-valuenow',String(Math.floor(metrics.stamina)));
   lastNeedleTime=t;$('driveNeedle').style.left=(CircusDriving.needle(t)*100)+'%';
   $('driveBoost').disabled=busy||!!pending||!metrics.canBoost||t<Number(d?.last_attempt??-100)+.8||race.countdown>0||finished||d?.version!==150;
   $('driveBoost').textContent='Hamle yap';$('driveHUD').classList.toggle('boosting',metrics.boosting);
   $('driveFeedback').textContent=busy?'Hamle doğrulanıyor…':flashUntil>performance.now()?driveFlash:race.countdown>0?'Başlangıç '+Math.ceil(race.countdown):finished?'Bitişe ulaştın · Yarış sonucu bekleniyor':d?.version!==150?'Yeni yarışta hızlanma açılacak':metrics.boosting?'':metrics.stamina<25?'Kondisyon yenileniyor · En az 25 gerekli':metrics.cooldown>0?'Yeni hamle · '+Math.ceil(metrics.cooldown)+' sn':'Altın bölgeyi yakala';
   $('driveRetry').hidden=!pending||busy;$('driveRetry').textContent='Hamleyi yeniden dene';
   $('driveLeft').disabled=$('driveRight').disabled=finished||race.countdown>0;
  }
  async function boost(at=lastNeedleTime){
   if(mode!=='driver'||heat.status!=='running'||busy||pending||$('driveBoost').disabled)return;
   at=Number(at);if(!Number.isFinite(at)||at<0)return;
   if(await act('boost',{at})){driveFlash=heat.drive?.last_hit?'İsabet':'Kaçırdın · Tekrar dene';}
   else driveFlash=message||'Hamle kaydedilemedi.';
   flashUntil=performance.now()+1300;ctx.invalidate();
  }
  $('driveBoost').onpointerdown=e=>{e.preventDefault();boost(lastNeedleTime);};$('driveBoost').onclick=e=>{if(e.detail===0)boost(lastNeedleTime);};$('driveRetry').onclick=async()=>{await sendPending();ctx.invalidate();};
  for(const [id,value]of [['driveLeft',-1],['driveRight',1]]){const b=$(id);b.onpointerdown=e=>{if(b.disabled)return;e.preventDefault();b.setPointerCapture(e.pointerId);steering=value;ctx.invalidate();};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>steering=0);b.oncontextmenu=e=>e.preventDefault();}
  function updateResult(){
   if(heat.status!=='settled'||(!heat.entered&&heat.selected===null)||resultDismissed===heat.id){$('driveResult').hidden=true;return;}
   if(resultShown!==heat.id){resultShown=heat.id;const won=heat.entered?heat.winner===3:heat.payout>0,img=$('driveResultImage');img.src='assets/circus-v150/'+(won?'victory':'defeat')+'.webp';$('driveResult').style.setProperty('--result-photo','url("'+img.src+'")');img.alt=won?'Circus Maximus yarışında zafer':'Circus Maximus yarışının ardından';
    $('driveResultTitle').textContent=heat.entered?(won?'Yarışı kazandın':'Bu yarışı kazanamadın'):(won?'Kuponun kazandı':'Kuponun kaybetti');
    const rank=race.teams[3].rank;$('driveResultDetail').textContent=heat.entered?'Sıralaman '+rank+' / '+race.teams.length+' · '+heat.teams[heat.winner].name+' kazandı':won?'Toplam ödeme '+num(heat.payout)+' denarius · Net kazanç '+num(heat.payout-heat.stake)+' denarius':'Kaybedilen kupon bedeli '+num(heat.stake)+' denarius';
   }
   $('driveResult').hidden=false;$('driveHUD').hidden=true;steering=0;
  }
  $('driveResultBack').onclick=()=>{resultDismissed=heat.id;$('driveResult').hidden=true;stand();};
  $('driveResultNext').onclick=async()=>{if(user){if(!await act('next')){$('driveResultDetail').textContent=message;return;}}else return;resultShown=null;resultDismissed=null;$('driveResult').hidden=true;stand();notice('Yeni yarış hazır. Gişeden katılabilir veya bahis yapabilirsin.');};
  function enter(){active=true;mode=heat.entered&&heat.status==='running'?'driver':'walk';npcs.visible=true;race.active=true;race.configure(heat.teams,heat.durations,heat.drive,heat.id);$('visitHUD').hidden=false;document.body.classList.add('visiting');ctx.camera.fov=58;ctx.camera.near=.1;ctx.camera.updateProjectionMatrix();wallet();notice(mode==='driver'?'':message||'Karşıdaki tek gişeden bahis yapabilir veya yarışmaya katılabilirsin. Pist tarafında tribün oturağı var.');ctx.invalidate();}
  npcs.visible=false;return {enter,update,get active(){return active;},get mode(){return mode;},get needsFrame(){return active&&!$('circusDialog').open&&(heat.status==='running'||keys.size>0||Math.hypot(stick.x,stick.y)>.1||!!drag||settleFrames>0);},get heat(){return heat;},get state(){return state;},get busy(){return busy;},get near(){return near;},player,gallery,race,refresh,allowed,boost};
 }
 return {create,traits};
})();
