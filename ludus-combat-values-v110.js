/* Owner-scoped inspection. All totals and source deltas come from the live combat functions. */
(function(root){
 'use strict';
 const icon='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 4 20 21m0-21L6 25M4 3l4 1-3 3-1-4Zm24 0-4 1 3 3 1-4ZM3 22l6 6m14 0 6-6"/><path d="m16 7 8 3v7c0 5-8 10-8 10S8 22 8 17v-7l8-3Z" fill="#651d1a"/><path d="M16 12v10m-4-6h8"/></svg>';
 const n=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const fmt=(v,digits=2)=>Number(v||0).toLocaleString('tr-TR',{maximumFractionDigits:digits});
 const capKeys={max_hp:120,max_stamina:100,physical_defense:50,critical_rate:35,armor_penetration:60,block_rate:30,block_power:40,parry_rate:20,hp_regeneration:2,stamina_regeneration:8,attack_speed:25,movement_speed:30,recovery_speed:30};
 const emeraldNames=['','Vita','Sanatio','Stamina','Recuperatio','Fortitudo','Critical','Ferocia','Penetratio','Strike','Defensio','Parry','Block','Aegis','Agilitas','Celeritas'];
 const models={gladius:'Gladius',sica:'Sica',spear:'Mızrak',trident:'Üç dişli mızrak',mace:'Zincirli gürz',whip:'Kırbaç',net:'Ağ',scissor:'Kol bıçağı',large:'Büyük kalkan',round:'Yuvarlak kalkan',small:'Küçük kalkan',gold:'Miğfer',silver:'Miğfer',helmet:'Miğfer',chest:'Göğüs zırhı',gloves:'Kolluk',legs:'Bacaklık',starter:'Başlangıç ekipmanı'};
 const statNames={physical_power:'Fiziksel güç',physical_defense:'Savunma',max_hp:'Can',max_stamina:'Kondisyon',attack_speed:'Saldırı hızı',movement_speed:'Hareket hızı',block_rate:'Blok şansı',block_power:'Blok gücü',critical_rate:'Kritik şansı',critical_damage:'Kritik hasarı',hp_regeneration:'Can yenilenmesi',stamina_regeneration:'Kondisyon yenilenmesi',armor_penetration:'Zırh delme',damage_reduction:'Hasar azaltma',slash_resistance:'Kesme direnci',pierce_resistance:'Delme direnci',projectile_resistance:'Fırlatılan silah direnci',critical_resistance:'Kritik direnci',recovery_speed:'Toparlanma'};
 function metrics(mode){
  const damage='Savunması 50, göğsü zırhsız rakibe normal vuruş. Kritik, karşı vuruş ve yaralı bölge etkisi hariç.';
  return [
   {id:'main',tab:0,label:'Ana el hasarı',keys:['main_'+mode+'_min','main_'+mode+'_max'],raw:['physical_power','minimum_damage'],note:damage},
   {id:'off',tab:0,label:'İkinci el hasarı',keys:['off_'+mode+'_min','off_'+mode+'_max'],raw:['physical_power','minimum_damage'],note:damage+' Vuruş silahı yoksa —.'},
   {id:'critical_rate',tab:0,label:'Kritik şansı',unit:'%',note:'Rakibin kritik direnci öncesi. Savaşta rakibin direnci bu şansı azaltır.'},
   {id:'critical_multiplier',tab:0,label:'Kritik hasar çarpanı',unit:'×',raw:['critical_damage'],note:'Kritik vuruşun hasar çarpanı. Rakibin kritik hasar azaltması sonucu değiştirir.'},
   {id:'armor_penetration',tab:0,label:'Zırh delme',unit:'%',note:'Rakibin ekipmandan gelen fiziksel savunmasının bu oranını yok sayar.'},
   {id:'attack_speed',tab:0,label:'Saldırı hızı',unit:'×',note:'Refleks ve ekipman çarpanı. Değer arttıkça saldırı süresi kısalır.'},
   {id:'physical_defense',tab:1,label:'Fiziksel savunma',note:'Savunma tekniği × 0,75 + taktik × 0,25 + ekipman. Hasar hesabındaki savunma puanı.'},
   {id:'slash_resistance',tab:1,label:'Kesme hasarı azaltma',unit:'%',raw:['damage_reduction','slash_resistance'],note:'Genel hasar azaltma ve kesme direnci birlikte en fazla %55.'},
   {id:'pierce_resistance',tab:1,label:'Delme hasarı azaltma',unit:'%',raw:['damage_reduction','pierce_resistance'],note:'Genel hasar azaltma ve delme direnci birlikte en fazla %55.'},
   {id:'projectile_resistance',tab:1,label:'Fırlatılan silah direnci',unit:'%',raw:['damage_reduction','projectile_resistance'],note:'Genel azaltma ile fırlatılan silah direnci birlikte en fazla %55.'},
   {id:'block_rate',tab:1,label:'Otomatik blok şansı',unit:'%',note:'Takılı kalkan, yeterli kondisyon ve uygun savunma duruşu gerektirir.'},
   {id:'block_power',tab:1,label:'Blok gücü',unit:'%',note:'Başarılı blokta kondisyon maliyetini azaltır. Takılı kalkan gerektirir.'},
   {id:'parry_rate',tab:1,label:'Savuşturma şansı',unit:'%',note:'Elde uygun silah, yeterli kondisyon ve uygun savunma duruşu gerektirir.'},
   {id:'critical_resistance',tab:1,label:'Kritik direnci',unit:'%',note:'Rakibin kritik vuruş şansından çıkarılan yüzde puanı.'},
   {id:'critical_damage_reduction',tab:1,label:'Kritik hasarı azaltma',unit:'%',note:'Aegis katkısı dahil. Rakibin kritik hasar bonusundan çıkarılır; sonuç rakibin çarpanına bağlıdır.'},
   {id:'max_hp',tab:2,label:'Toplam can',note:'Kondisyon × 2, seviye çarpanı ve ekipman canı. Savaşa girişteki azami can.'},
   {id:'max_stamina',tab:2,label:'Toplam kondisyon',note:'Kondisyon × 2, seviye çarpanı ve ekipman. Savaş enerjisidir; Ludus yorgunluk barından ayrıdır.'},
   {id:'hp_regeneration',tab:2,label:'Can yenilenmesi',unit:'/sn',note:'Bekleme süresi bitince saniyelik can yenilenmesi. Tek oyunculuda eylemsiz olmayı gerektirir; azami canı aşmaz.'},
   {id:'stamina_regeneration',tab:2,label:'Kondisyon yenilenmesi',keys:['stamina_regeneration_'+mode],unit:'/sn',raw:['stamina_regeneration'],note:'Hareketsizken, saldırı ve yenilenme bekleme süresi bittikten sonra. Tüketilmiş menü ve moral dahildir.'},
   {id:'movement_speed',tab:2,label:'Hareket hızı',unit:'×',note:'Temel hız ve ekipman çarpanı. Hareket türü gerçek mesafeyi değiştirir.'},
   {id:'recovery_speed',tab:2,label:'Toparlanma hızı',unit:'×',note:'Sendeleme ve geri tepme süresini kısaltan ekipman çarpanı.'}
  ].map(m=>({...m,keys:m.keys||[m.id],raw:m.raw||[m.id]}));
 }
 function create(options){
  let modal=null,report=null,error='',pending=false,tab=0,mode='pve',selected='main',statPage=0,sourcePage=0,seq=0,abort=null,expiry=null,previousFocus=null,owner=null,gladiator=null,signature='',hostAria=null;
  const record=()=>{const g=options.getSelected();return g?.record||g;};
  const currentUser=()=>options.getUser?options.getUser():record()?.owner_id;
  const fingerprint=()=>{const g=options.getSelected();return JSON.stringify([g?.record||g,g?.items]);};
  const button=(label,fn,cls='',disabled=false)=>{const b=n('button',cls,label);b.type='button';b.disabled=disabled;b.onclick=fn;if(label==='Yenile')b.dataset.focus='refresh';return b;};
  const pages=(page,total,change,label)=>{const p=n('nav','combat-values-pages');p.setAttribute('aria-label',label);const prev=button('‹',()=>change(page-1),'',page===0),next=button('›',()=>change(page+1),'',page>=total-1);prev.setAttribute('aria-label','Önceki '+label);next.setAttribute('aria-label','Sonraki '+label);prev.dataset.focus=label.startsWith('katkı')?'source-prev':'stat-prev';next.dataset.focus=label.startsWith('katkı')?'source-next':'stat-next';p.append(prev,n('span','',(page+1)+' / '+total),next);return p;};
  function value(m,values,sign=false){
   const vals=m.keys.map(k=>Number(values?.[k]||0));
   if(!sign&&m.id==='off'&&vals.every(v=>v===0))return '—';
   const signed=v=>(sign&&v>0?'+':'')+fmt(v);
   return (vals.length===2?vals.map(signed).join(' – '):signed(vals[0]))+(m.unit?' '+m.unit:'');
  }
  function sourceName(s){
   const item=s.name||models[s.model]||s.model||'Ekipman';
   switch(s.kind){
    case 'base':return ['Temel özellikler','Gladyatörün kendi değerleri'];
    case 'level':return ['Seviye '+s.level,'Seviye çarpanı'];
    case 'equipment':return [item,'Ekipmanın doğal özelliği'];
    case 'enhancement':return [item+' +'+s.enhancement,'Geliştirme katkısı'];
    case 'sapphire':return ['Safir · '+(statNames[s.stat]||s.stat),item+' · %'+fmt(s.percent)];
    case 'emerald':return ['Zümrüt · '+(emeraldNames[s.stone]||'Taş'),item+' · %'+fmt(s.percent)];
    case 'legacy_stones':return [item,'Basılı taşlar'];
    case 'food':return ['Beslenme',s.percent>0?'Tüketilmiş menü · %'+fmt(s.percent):'Etkin menü bonusu yok'];
    case 'morale':return ['Moral',fmt(s.morale??50)+' / 100'];
    default:return [item,'Katkı'];
   }
  }
  function sourceRows(m){return(report.sources||[]).filter(s=>m.keys.some(k=>Math.abs(s.delta?.[k]||0)>1e-9)||m.raw.some(k=>Math.abs(s.raw?.[k]||0)>1e-9)||(m.id==='stamina_regeneration'&&['food','morale'].includes(s.kind)));}
  function render(){
   if(!modal)return;
   const focus=document.activeElement?.dataset?.focus;
   const shell=n('div','combat-values-shell');
   const head=n('div','combat-values-head'),heading=n('div','combat-values-title');heading.innerHTML=icon;const title=n('h2','','SAVAŞ DEĞERLERİ');title.id='combat-values-title';heading.append(title);
   const closeButton=button('×',()=>close(),'combat-values-close');closeButton.setAttribute('aria-label','Savaş değerlerini kapat');closeButton.dataset.focus='close';head.append(heading,closeButton);
   const sub=n('div','combat-values-sub'),identity=n('div','combat-values-identity');identity.append(n('strong','',record()?.name||report?.gladiator?.name||'Gladyatör'),n('span','','Kuşanılmış ekipman · Savaşa giriş değerleri'));
   const modes=n('div','combat-values-modes');modes.setAttribute('aria-label','Savaş türü');for(const[id,label]of[['pve','Tek oyunculu'],['pvp','Çok oyunculu']]){const b=button(label,()=>{mode=id;sourcePage=0;render();});b.setAttribute('aria-pressed',String(mode===id));b.dataset.focus=id;modes.append(b);}sub.append(identity,modes);
   const tabs=n('div','combat-values-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Savaş özellikleri');['Saldırı','Savunma','Dayanıklılık'].forEach((label,i)=>{const b=button(label,()=>{tab=i;statPage=sourcePage=0;selected=metrics(mode).find(m=>m.tab===i).id;render();});b.id='combat-values-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===tab));b.setAttribute('aria-controls','combat-values-content');b.tabIndex=i===tab?0:-1;b.dataset.focus='tab-'+i;b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;tab=next;statPage=sourcePage=0;selected=metrics(mode).find(m=>m.tab===next).id;render();modal.querySelector('#combat-values-tab-'+next)?.focus();}};tabs.append(b);});
   const content=n('div','combat-values-content');content.id='combat-values-content';content.setAttribute('role','tabpanel');content.setAttribute('aria-labelledby','combat-values-tab-'+tab);content.setAttribute('aria-busy',String(pending));
   if(pending||error||!report){const state=n('div','combat-values-state');state.setAttribute('role',error?'alert':'status');state.append(n('strong','',pending?'Savaş değerleri hesaplanıyor…':error||'Değerler hazırlanıyor…'));if(error)state.append(button('Tekrar dene',refresh));content.append(state);}
   else{
    const all=metrics(mode).filter(m=>m.tab===tab),per=innerHeight<360?4:6,total=Math.ceil(all.length/per);statPage=Math.min(statPage,total-1);const visible=all.slice(statPage*per,(statPage+1)*per);if(!visible.some(m=>m.id===selected))selected=visible[0].id;const m=all.find(m=>m.id===selected);
    const list=n('div','combat-values-list'),rows=n('div','combat-values-stats');rows.style.setProperty('--combat-rows',visible.length);rows.setAttribute('aria-label','Toplam savaş değerleri');
    for(const metric of visible){const b=button('',()=>{selected=metric.id;sourcePage=0;render();root.LudusQuestEvents?.record(options.client,'combat',gladiator).catch(()=>{});},'combat-values-stat');b.dataset.stat=metric.id;b.dataset.focus='stat-'+metric.id;b.setAttribute('aria-pressed',String(metric.id===selected));b.append(n('span','',metric.label),n('strong','',value(metric,report.totals)));rows.append(b);}list.append(rows,pages(statPage,total,p=>{statPage=p;sourcePage=0;selected=all[p*per].id;render();},'özellik sayfası'));
    const detail=n('section','combat-values-detail');detail.setAttribute('aria-label','Katkıların kaynağı');
    const summary=n('div','combat-values-total');summary.append(n('h3','',m.label),n('strong','',value(m,report.totals)));detail.append(summary,n('p','combat-values-context',m.note));
    const sources=sourceRows(m),count=innerHeight<360?1:innerHeight<390?2:innerHeight<500?3:6,pagesCount=Math.max(1,Math.ceil(sources.length/count));sourcePage=Math.min(sourcePage,pagesCount-1);
    const contributions=n('div','combat-values-sources');contributions.style.setProperty('--combat-sources',Math.min(count,Math.max(1,sources.length-sourcePage*count)));
    for(const s of sources.slice(sourcePage*count,(sourcePage+1)*count)){const row=n('div','combat-values-source '+s.kind),text=n('div'),[name,description]=sourceName(s);text.append(n('strong','',name),n('small','',description));const amount=n('div','combat-values-contribution'),zero=m.keys.every(k=>!s.delta?.[k]);amount.append(n('strong','',value(m,s.delta,true)));if(zero&&m.raw.some(k=>s.raw?.[k]))amount.append(n('small','','Sınır / koşul etkisi'));row.append(text,amount);contributions.append(row);}
    if(!sources.length)contributions.append(n('p','combat-values-empty',m.id==='off'?'İkinci elde vuruş silahı yok.':'Bu değere etkin katkı yok.'));
    const cap=n('p','combat-values-cap');const raw=m.raw.reduce((sum,key)=>sum+Number(report.raw?.[key]||0),0),limit=capKeys[m.id]??(['slash_resistance','pierce_resistance','projectile_resistance'].includes(m.id)?55:null);
    cap.textContent=limit!==null&&limit!==undefined?'Ekipman: '+fmt(raw)+' · Etkin üst sınır: '+fmt(limit)+(raw>limit?' · Sınırı aşan: '+fmt(raw-limit):''):(m.id==='critical_multiplier'?'Kritik çarpanı en fazla 2,2×.':'Katkılar toplam değerdeki değişimi gösterir.');
    detail.append(contributions,pages(sourcePage,pagesCount,p=>{sourcePage=p;render();},'katkı sayfası'),cap);content.append(list,detail);
   }
   const foot=n('footer','combat-values-foot');foot.append(n('span','','Katkı sırası: temel → ekipman → taşlar → beslenme. Çarpanlar ve sınırlar dahil.'),button('Yenile',refresh,'',pending));
   shell.append(head,sub,tabs,content,foot);modal.replaceChildren(shell);
   if(focus)modal.querySelector('[data-focus="'+focus+'"]')?.focus({preventScroll:true});
  }
  async function refresh(){
   if(!modal)return;
   clearTimeout(expiry);abort?.abort();const request=++seq;const controller=new AbortController();abort=controller;pending=true;report=null;error='';signature=fingerprint();render();
   const requestedOwner=currentUser(),requestedId=record()?.id;
   let timeout;
   try{
    if(!requestedOwner||!requestedId||!options.client?.rpc)throw new Error('Savaş değerleri için hesabına giriş yap.');
    let rpc=options.client.rpc('ludus_combat_values',{p_gladiator:requestedId});if(rpc.abortSignal)rpc=rpc.abortSignal(controller.signal);
    const result=await Promise.race([rpc,new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error('Bağlantı zaman aşımına uğradı. Tekrar deneyebilirsin.'));},12000);})]);
    if(!modal||request!==seq)return;if(requestedOwner!==currentUser()||requestedId!==record()?.id){close(false);return;}
    if(result.error)throw new Error('Savaş değerleri yüklenemedi. Tekrar deneyebilirsin.');
    const data=result.data;if(data?.owner_id!==requestedOwner||data?.gladiator?.id!==requestedId||!data.totals||!Array.isArray(data.sources))throw new Error('Savaş değerleri güncellenemedi. Tekrar deneyebilirsin.');
    report=data;const ttl=Date.parse(data.valid_until)-Date.parse(data.server_now);if(Number.isFinite(ttl))expiry=setTimeout(()=>{if(modal)refresh();},Math.max(1000,Math.min(86400000,ttl)));
   }catch(e){if(modal&&request===seq)error=e.message||'Değerler yüklenemedi.';}
   finally{clearTimeout(timeout);if(modal&&request===seq){pending=false;render();}}
  }
  function open(){
   if(modal)return;
   previousFocus=document.activeElement;owner=currentUser();gladiator=record()?.id;signature=fingerprint();tab=0;selected='main';statPage=sourcePage=0;
   modal=n('section','combat-values');modal.id='combat-values';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','combat-values-title');
   hostAria=options.host.getAttribute('aria-hidden');options.host.setAttribute('aria-hidden','true');options.host.inert=true;document.body.append(modal);refresh();modal.querySelector('.combat-values-close')?.focus();
  }
  function close(restore=true){if(!modal)return;seq++;abort?.abort();clearTimeout(expiry);modal?.remove();modal=null;report=null;error='';options.host.inert=false;if(hostAria===null)options.host.removeAttribute('aria-hidden');else options.host.setAttribute('aria-hidden',hostAria);if(restore){const target=previousFocus?.isConnected?previousFocus:options.host.querySelector('.exercise-combat-values');target?.focus({preventScroll:true});}}
  function sync(){if(!modal)return;if(owner!==currentUser()||gladiator!==record()?.id){close(false);return;}if(signature!==fingerprint())refresh();}
  document.addEventListener('keydown',e=>{if(!modal)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const buttons=[...modal.querySelectorAll('button:not(:disabled):not([tabindex="-1"])')],first=buttons[0],last=buttons.at(-1);if(!modal.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first)?.focus();}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},true);
  let resize;root.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>{if(modal){sourcePage=0;render();}},90);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&modal){if(owner!==currentUser())close(false);else refresh();}});
  options.client?.auth?.onAuthStateChange((event,session)=>{if(modal&&(!session?.user?.id||session.user.id!==owner))close(false);});
  return {open,close,sync,get isOpen(){return !!modal;}};
 }
 root.LudusCombatValues={create,icon};
})(typeof window!=='undefined'?window:globalThis);
