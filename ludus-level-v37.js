/* Ludus progression. Currency and random rewards are issued only by the RPC. */
var LudusLevels = (() => {
 'use strict';
 const number = n => Number(n || 0).toLocaleString('tr-TR');
 const names = {sapphire:'Safir',emerald:'Zümrüt',ruby:'Yakut'};
 function cost(l){return 3000+100*(l-1)+15*(l-1)**2;}
 function deadline(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Yanıt gecikti. Ödül hakkın korunuyor; yeniden deneyebilirsin.')),12000);})]).finally(()=>clearTimeout(timer));}
 function create(client,ready=Promise.resolve(),onState=()=>{}){
  let state=null,running=null;
  async function refresh(){if(running)return running;running=(async()=>{await ready;const r=await deadline(client.rpc('ludus_progress'));if(r.error)throw r.error;state=r.data;onState(state);window.dispatchEvent(new CustomEvent('ludus-level-state',{detail:state}));return state;})().finally(()=>running=null);return running;}
  window.addEventListener('focus',()=>refresh().catch(()=>{}));window.addEventListener('online',()=>refresh().catch(()=>{}));
  return {refresh,get state(){return state;}};
 }
 function badge(state){return 'Sv. '+state.level+' · '+number(state.current_exp)+' / '+number(state.next_exp)+' EXP';}
 async function mount(){
  const $=id=>document.getElementById(id);if(!$('levelPaper'))return;
  const client=supabase.createClient('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
  let owner=null,state=null,busy=false,pending=null,page=0,loaded=false;
  const prefix='ludus-level-pending-v37:';
  const message=text=>{$('levelMessage').textContent=text||'';if(state)render();};
  function remember(){try{localStorage.setItem(prefix+owner,JSON.stringify(pending));}catch{throw Error('Ödül işlemini saklamak için tarayıcı depolaması gerekiyor.');}}
  function adopt(data){state=data;if(!loaded){loaded=true;page=Math.floor(Math.max(0,state.level-2)/pageSize());}render();}
  const progress=create(client,Promise.resolve(),adopt);
  function pageSize(){return Math.max(1,Math.min(10,Math.floor(($('levelTableArea').clientHeight-35)/32)));}
  function cell(text,title){const td=document.createElement('td');td.textContent=text;if(title)td.title=title;return td;}
  function render(){
   if(!state)return;
   $('levelName').textContent=state.wallet.ludus_name;
   $('levelNumber').textContent=String(state.level);$('levelAmount').textContent=state.level<50?number(state.current_exp)+' / '+number(state.next_exp)+' EXP':'Son seviye';
   const percent=state.level<50?Math.min(100,state.current_exp/state.next_exp*100):100;
   $('levelFill').style.width=percent+'%';$('levelMeter').setAttribute('aria-valuenow',String(Math.round(percent)));
   $('levelGranted').textContent=String(state.granted_gladiators);$('levelOwned').textContent=String(state.owned_gladiators);
   $('levelBattle').textContent=number(state.battle_exp_today)+' / 2.500 EXP';
   const next=state.rewards.find(r=>r.level>state.level&&r.gladiators);
   $('levelNext').textContent=next?'Seviye '+next.level+' · +1 gladyatör hakkı':'Bütün gladyatör hakları açıldı';
   $('levelClaimAll').disabled=busy||!!pending||!state.claimable_count;
   $('levelClaimAll').textContent=state.claimable_count?'Ödülleri al · '+state.claimable_count:state.level===1?'Henüz ödül açılmadı':'Ödüller alındı';
   $('levelPending').textContent=state.pending_gladiator_count?state.pending_gladiator_count+' gladyatör hakkı saklı. Uygun gladyatör ve yer olduğunda alabilirsin.':'';
   const size=pageSize(),pages=Math.ceil(state.rewards.length/size);page=Math.max(0,Math.min(page,pages-1));
   $('levelRows').replaceChildren();
   for(const r of state.rewards.slice(page*size,(page+1)*size)){
    const tr=document.createElement('tr');tr.dataset.level=String(r.level);tr.dataset.state=r.claimed?'claimed':r.unlocked?'ready':'locked';
    tr.append(cell(r.level),cell(r.diamonds),cell(r.sapphire||'—'),cell(r.emerald||'—'),cell(r.ruby||'—'),cell(number(r.denarius)),cell(r.items),cell(r.gladiators||'—'));
    const action=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='level-claim';
    button.textContent=r.claimable?'Al':r.gladiator_pending?'Hak saklı':r.claimed?'Alındı':'Kilitli';
    button.disabled=busy||!!pending||!r.claimable;button.setAttribute('aria-label','Seviye '+r.level+' ödüllerini al');button.onclick=()=>claim(r.level);action.append(button);tr.append(action);$('levelRows').append(tr);
   }
   $('levelPage').textContent=(page+1)+' / '+pages;$('levelPrev').disabled=!page;$('levelNextPage').disabled=page>=pages-1;
   $('levelRetry').hidden=!pending;$('levelRetry').disabled=busy;
  }
  async function send(){
   if(!pending||busy)return;busy=true;render();message('Ödüller kaydediliyor…');
   try{const r=await deadline(client.rpc('ludus_progress',{p_action:'claim',p_level:pending.level}));if(r.error)throw r.error;
    localStorage.removeItem(prefix+owner);pending=null;adopt(r.data);message(r.data.pending_gladiator_count?'Eşya ve kaynak ödüllerin alındı. Uygun gladyatör bulunmayan hakların saklanıyor.':'Ödüllerin Ludus’una eklendi.');
   }catch(e){if(e.code==='P0001'){localStorage.removeItem(prefix+owner);pending=null;}message(e.message||'Bağlantı kurulamadı. Ödül hakkın korunuyor.');}
   finally{busy=false;render();}
  }
  function claim(level){if(busy||pending||!state)return;pending={owner,level};try{remember();}catch(e){pending=null;message(e.message);return;}send();}
  async function load(){
   if(busy)return;message('Ludus defteri açılıyor…');
   try{if(!owner){const a=await deadline(client.auth.getUser());if(a.error||!a.data.user||a.data.user.is_anonymous){location.replace('index.html');return;}owner=a.data.user.id;LudusNavigation.setOwner(owner);
     try{const old=JSON.parse(localStorage.getItem(prefix+owner));if(old?.owner===owner&&(old.level===null||Number.isInteger(old.level)&&old.level>=2&&old.level<=50))pending=old;}catch{}}
    await progress.refresh();message('');if(pending)send();
   }catch(e){message(e.message||'Defter yüklenemedi. Yeniden dene.');$('levelRetry').hidden=false;}
  }
  $('levelClaimAll').onclick=()=>claim(null);$('levelRetry').onclick=()=>pending?send():load();$('levelRefresh').onclick=load;
  $('levelPrev').onclick=()=>{page--;render();};$('levelNextPage').onclick=()=>{page++;render();};$('levelBack').onclick=()=>LudusNavigation.back('ludus.html');
  window.addEventListener('resize',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  window.LudusLevelPage={load,claim,progress,get state(){return state;},get pending(){return pending;}};load();
 }
 if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();}
 return {create,cost,badge,number,names};
})();
