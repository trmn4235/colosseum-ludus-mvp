(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
 const state={data:null,filter:'friend',page:0,busy:false,user:null,stopped:false,channel:null,timer:null,preferredInvite:new URLSearchParams(location.search).get('invite')};
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
   if(!m)slot.append(element('span','empty-mark','+'));root.append(slot);
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
 $('fighterSelect').onchange=()=>{if(state.data?.party)act('select',{p_gladiator:selectedFighter()},'Gladyatörün seçildi.');};
 window.addEventListener('resize',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('pagehide',()=>{state.stopped=true;clearTimeout(state.timer);if(state.channel)client.removeChannel(state.channel);});
 render();
 (async()=>{try{
  const auth=await client.auth.getUser();if(auth.error||!auth.data.user||auth.data.user.is_anonymous){notice('Takım kurmak için oyuna giriş yap.');return;}
  state.user=auth.data.user.id;await refresh();if(!state.data)return;notice('Arkadaşlarını veya klan üyelerini davet edebilirsin.');
  state.channel=client.channel('ranked-party-'+state.user).on('postgres_changes',{event:'*',schema:'ludus_ranked_party_private',table:'invites_v244',filter:'target_id=eq.'+state.user},()=>refresh()).subscribe();schedule();
 }catch(e){notice(e.message||'Takım ekranı açılamadı.');}})();
})();
