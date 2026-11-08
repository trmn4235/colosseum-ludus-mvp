(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
 const state={data:null,filter:'friend',page:0,busy:false,user:null,stopped:false,timer:null,preferredInvite:new URLSearchParams(location.search).get('invite'),loadoutBusy:false,supply:null,items:[],gearPage:0,recipePage:0,loadoutTab:'gear',pendingCraft:null};
 function notice(message){$('status').textContent=message||'';}
 function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
 function button(text,cls,click){const b=element('button',cls,text);b.type='button';b.addEventListener('click',click);return b;}
 function selectedFighter(){return $('fighterSelect').value||null;}
 async function rpc(action,extra={}){const args={p_action:action,p_peer:null,p_gladiator:null,p_invite:null,...extra};const r=await client.rpc('ludus_ranked_party_v244',args);if(r.error)throw r.error;return r.data;}
 function memberList(){return state.data?.party?.members||[];}
 function isLeader(){return state.data?.party?.leader===state.user;}
 function candidates(){return(state.data?.candidates||[]).filter(x=>x.type===state.filter);}
 function renderCandidates(){
  const list=$('candidateList');list.replaceChildren();const rows=candidates(),pageSize=innerHeight<350?3:4,pages=Math.max(1,Math.ceil(rows.length/pageSize));
  state.page=Math.max(0,Math.min(state.page,pages-1));$('pageNumber').textContent=(state.page+1)+' / '+pages;$('previous').disabled=state.page===0;$('next').disabled=state.page>=pages-1;
  for(const p of rows.slice(state.page*pageSize,(state.page+1)*pageSize)){
   const row=element('div','candidate'),avatar=element('span','avatar',(p.username||p.ludus||'?').slice(0,1).toLocaleUpperCase('tr'));
   const identity=element('span','identity');identity.append(element('strong','',p.username||p.ludus),element('small','',(p.ludus||'Ludus')+' · çevrimiçi'));
   const send=button(p.invited?'Gönderildi':'Davet Et','primary',()=>act('invite',{p_peer:p.id},'Davet gönderildi.'));
   send.disabled=state.busy||!isLeader()||!!p.invited||memberList().length>=5;row.append(avatar,identity,send);list.append(row);
  }
  if(!rows.length)list.append(element('p','empty',state.filter==='friend'?'Çevrimiçi arkadaş bulunamadı.':'Çevrimiçi klan üyesi bulunamadı.'));
  $('friendsTab').classList.toggle('selected',state.filter==='friend');$('clanTab').classList.toggle('selected',state.filter==='clan');
  $('friendsTab').setAttribute('aria-pressed',String(state.filter==='friend'));$('clanTab').setAttribute('aria-pressed',String(state.filter==='clan'));
 }
 function renderSlots(){
  const root=$('teamSlots'),members=memberList();root.replaceChildren();$('teamCount').textContent=members.length+' / 5';
  for(let n=0;n<5;n++){
   const m=members[n],slot=element('div','slot'+(m?'':' empty-slot')),label=element('div','slot-label');
   label.append(element('strong','',m?.gladiator||'Boş yer'),element('small','',m?.ludus||'Davet bekleniyor'));slot.append(label);
   if(!m)slot.append(element('span','empty-mark','+'));
   else{const own=m.user_id===state.user,badge=button(m.ready?'HAZIR':'READY','slot-ready'+(m.ready?' ready':'')+(own?' own':''),()=>act(m.ready?'unready':'ready',{},m.ready?'Hazır durumu kaldırıldı.':'Hazırsın.'));
    badge.disabled=!own||state.busy;badge.setAttribute('aria-label',own?(m.ready?'Hazır durumunu kaldır':'Hazır olduğunu bildir'):(m.ready?'Oyuncu hazır':'Oyuncu bekliyor'));slot.append(badge);}
   root.append(slot);
  }
 }
 function renderFighters(){
  const select=$('fighterSelect'),old=select.value,own=memberList().find(x=>x.user_id===state.user),list=state.data?.gladiators||[];
  select.replaceChildren();for(const g of list){const o=document.createElement('option');o.value=g.id;o.textContent=g.name;select.append(o);}
  if(!list.length){const o=document.createElement('option');o.textContent='Hazır gladyatör yok';o.value='';select.append(o);}
  const chosen=own?.gladiator_id||old;if(list.some(g=>g.id===chosen))select.value=chosen;select.disabled=state.busy||!list.length;
 }
 function renderInvites(){
  const root=$('incoming'),invites=state.data?.invites||[],i=invites.find(x=>x.id===state.preferredInvite)||invites[0];root.replaceChildren();root.hidden=!i;if(!i)return;
  root.append(element('strong','',i.leader+' takımına davet etti'));
  const accept=button('Kabul et','primary',()=>act('accept',{p_invite:i.id,p_gladiator:selectedFighter()},'Takıma katıldın.'));
  const decline=button('Reddet','secondary',()=>act('decline',{p_invite:i.id},'Davet reddedildi.'));accept.disabled=decline.disabled=state.busy;
  root.append(accept,decline);
 }
 function render(){renderCandidates();renderSlots();renderFighters();renderInvites();const party=state.data?.party;
  $('createTeam').hidden=!!party;$('createTeam').disabled=state.busy||!(state.data?.gladiators||[]).length;
  $('leaveTeam').hidden=!party;$('leaveTeam').disabled=state.busy;$('leaveTeam').textContent=isLeader()?'Takımı kapat':'Takımdan ayrıl';
 }
 function loadoutMessage(message){$('loadoutStatus').textContent=message||'';}
 function pendingKey(){return 'ludus-ranked-craft-v245:'+state.user;}
 function recipeList(){return(state.supply?.recipes||[]).filter(r=>r.output_type==='equipment');}
 function availableItems(){const g=selectedFighter();return(state.items||[]).filter(i=>['weapon','shield','helmet','chest','gloves','legs'].includes(i.kind)&&(!i.equipped_by||i.equipped_by===g)&&!i.locked_battle_id&&!i.clan_vault_id&&!i.clan_roster_id&&!i.market_listing_id);}
 function renderLoadout(){
  const gear=state.loadoutTab==='gear';$('gearPane').hidden=!gear;$('craftPane').hidden=gear;$('gearTab').classList.toggle('selected',gear);$('craftTab').classList.toggle('selected',!gear);
  const list=availableItems(),pages=Math.max(1,Math.ceil(list.length/2));state.gearPage=Math.max(0,Math.min(state.gearPage,pages-1));$('gearPage').textContent=(state.gearPage+1)+' / '+pages;$('gearPrev').disabled=state.gearPage===0;$('gearNext').disabled=state.gearPage>=pages-1;
  const root=$('equipmentList');root.replaceChildren();
  for(const item of list.slice(state.gearPage*2,state.gearPage*2+2)){
   const row=element('div','equipment-row'),name=(globalThis.LudusProduction?.nameForItem(item)||item.model||item.kind)+(item.enhancement>0?' +'+item.enhancement:'');
   row.append(element('span','equipment-name',name+(item.equipped_by?' · Kuşanıldı':'')));
   const slot=document.createElement('select');slot.setAttribute('aria-label',name+' yuvası');
   const slots=item.kind==='weapon'?[['main_hand','Ana el'],['off_hand','Diğer el']]:[[item.kind==='shield'?'off_hand':item.kind,'Yuva']];
   for(const [v,label] of slots){const option=element('option','',label);option.value=v;slot.append(option);}if(item.equipped_slot)slot.value=item.equipped_slot;
   const equip=button('Kuşan','primary',()=>equipItem(item.id,slot.value));equip.disabled=state.loadoutBusy||!selectedFighter();row.append(slot,equip);root.append(row);
  }
  if(!list.length)root.append(element('p','empty','Kullanılabilir eşya bulunamadı.'));
  const recipes=recipeList();state.recipePage=Math.max(0,Math.min(state.recipePage,Math.max(0,recipes.length-1)));const recipe=recipes[state.recipePage];$('recipePage').textContent=(recipes.length?state.recipePage+1:0)+' / '+recipes.length;$('recipePrev').disabled=state.recipePage===0;$('recipeNext').disabled=state.recipePage>=recipes.length-1;
  const details=$('recipeDetails');details.replaceChildren();let enough=!!recipe;
  if(recipe){details.append(element('strong','',recipe.name));const materials=element('div','recipe-materials');
   for(const [sku,need] of Object.entries(recipe.ingredients||{})){const stock=(state.supply?.resources||[]).find(x=>x.sku===sku),have=Number(stock?.quantity||0);if(have<Number(need))enough=false;materials.append(element('span',have<Number(need)?'missing':'',(stock?.name||sku)+' '+have+' / '+need+'  '));}details.append(materials);
  }else details.append(element('span','','Üretim reçeteleri yüklenemedi.'));
  $('craftItem').textContent=state.pendingCraft?'ÖNCEKİ ÜRETİMİ KONTROL ET':'ÜRET';$('craftItem').disabled=state.loadoutBusy||(!state.pendingCraft&&!enough);
 }
 async function loadoutRefresh(){
  if(!state.user||state.loadoutBusy)return;state.loadoutBusy=true;loadoutMessage('Envanter ve reçeteler yükleniyor…');
  try{const [s,i]=await Promise.all([client.rpc('ludus_supply'),client.from('ludus_items').select('*').eq('owner_id',state.user).order('created_at')]);if(s.error)throw s.error;if(i.error)throw i.error;if(s.data?.user_id!==state.user)throw Error('Hesap doğrulanamadı.');state.supply=s.data;state.items=i.data||[];loadoutMessage(state.pendingCraft?'Önceki üretimin sonucunu kontrol et.':'');}
  catch(e){loadoutMessage(e.message||'Hazırlık bilgileri alınamadı.');}finally{state.loadoutBusy=false;renderLoadout();}
 }
 async function equipItem(id,slot){if(state.loadoutBusy||!selectedFighter())return;state.loadoutBusy=true;renderLoadout();
  try{const r=await client.rpc('ludus_equip_item',{p_gladiator:selectedFighter(),p_slot:slot,p_item:id});if(r.error)throw r.error;state.items=r.data?.items||state.items;await refresh();loadoutMessage('Eşya kuşanıldı. Yeniden hazır vermelisin.');}
  catch(e){loadoutMessage(e.message||'Eşya kuşandırılamadı.');}finally{state.loadoutBusy=false;renderLoadout();}
 }
 async function craftItem(){if(state.loadoutBusy||!state.user)return;const recipe=recipeList()[state.recipePage];if(!state.pendingCraft&&!recipe)return;
  if(!state.pendingCraft){const pending={owner:state.user,sku:recipe.sku,request:crypto.randomUUID()};try{localStorage.setItem(pendingKey(),JSON.stringify(pending));state.pendingCraft=pending;}catch(e){loadoutMessage('İşlem kaydı saklanamadı. Tarayıcı depolamasını açıp tekrar dene.');return;}}
  state.loadoutBusy=true;renderLoadout();loadoutMessage('Üretim kaydediliyor…');
  try{const p=state.pendingCraft,r=await client.rpc('ludus_supply',{p_action:'craft',p_key:p.sku,p_workers:1,p_request:p.request});if(r.error){if(['P0001','22003','22P02','23514','42501'].includes(r.error.code)){state.pendingCraft=null;localStorage.removeItem(pendingKey());}throw r.error;}
   if(r.data?.user_id!==state.user)throw Error('Hesap doğrulanamadı.');state.supply=r.data;state.pendingCraft=null;localStorage.removeItem(pendingKey());const i=await client.from('ludus_items').select('*').eq('owner_id',state.user).order('created_at');if(!i.error)state.items=i.data||[];loadoutMessage(r.data.result?.message||'Eşya üretildi.');
  }catch(e){loadoutMessage(e.message||'Yanıt alınamadı; aynı işlemi yeniden kontrol et.');}finally{state.loadoutBusy=false;renderLoadout();}
 }
 async function refresh(){if(state.stopped||state.busy||document.hidden||!state.user)return;state.busy=true;try{state.data=await rpc('state');render();}catch(e){notice(e.message||'Takım bilgileri alınamadı.');}finally{state.busy=false;render();}}
 async function act(action,args={},success=''){
  if(state.busy||!state.user)return;state.busy=true;render();
  try{state.data=await rpc(action,args);if(action==='accept'||action==='decline')state.preferredInvite=null;notice(success);}
  catch(e){notice(e.message||'İşlem tamamlanamadı. Tekrar dene.');}
  finally{state.busy=false;render();}
 }
 function schedule(){clearTimeout(state.timer);state.timer=setTimeout(async()=>{await refresh();if(!state.stopped)schedule();},state.data?.party?1500:5000);}
 $('friendsTab').onclick=()=>{state.filter='friend';state.page=0;renderCandidates();};$('clanTab').onclick=()=>{state.filter='clan';state.page=0;renderCandidates();};
 $('previous').onclick=()=>{state.page--;renderCandidates();};$('next').onclick=()=>{state.page++;renderCandidates();};
 $('createTeam').onclick=()=>act('create',{p_gladiator:selectedFighter()},'Takım kuruldu.');$('leaveTeam').onclick=()=>act('leave',{},'Takımdan ayrıldın.');
 $('fighterSelect').onchange=async()=>{state.gearPage=0;if(state.data?.party)await act('select',{p_gladiator:selectedFighter()},'Gladyatörün seçildi; yeniden hazır verebilirsin.');renderLoadout();};
 $('openLoadout').onclick=()=>{$('loadoutDialog').hidden=false;renderLoadout();loadoutRefresh();};$('closeLoadout').onclick=()=>{$('loadoutDialog').hidden=true;$('openLoadout').focus();};
 $('gearTab').onclick=()=>{state.loadoutTab='gear';renderLoadout();};$('craftTab').onclick=()=>{state.loadoutTab='craft';renderLoadout();};
 $('gearPrev').onclick=()=>{state.gearPage--;renderLoadout();};$('gearNext').onclick=()=>{state.gearPage++;renderLoadout();};$('recipePrev').onclick=()=>{state.recipePage--;renderLoadout();};$('recipeNext').onclick=()=>{state.recipePage++;renderLoadout();};$('craftItem').onclick=craftItem;
 window.addEventListener('resize',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('pagehide',()=>{state.stopped=true;clearTimeout(state.timer);});
 render();
 (async()=>{try{
  const auth=await client.auth.getUser();if(auth.error||!auth.data.user||auth.data.user.is_anonymous){notice('Takım kurmak için oyuna giriş yap.');return;}
  state.user=auth.data.user.id;try{const p=JSON.parse(localStorage.getItem(pendingKey())||'null');if(p?.owner===state.user&&p.sku&&p.request)state.pendingCraft=p;}catch{}await refresh();if(!state.data)return;notice('Arkadaşlarını veya klan üyelerini davet edebilirsin.');
  schedule();
 }catch(e){notice(e.message||'Takım ekranı açılamadı.');}})();
})();
