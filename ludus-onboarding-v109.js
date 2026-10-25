/* First steps navigate existing screens. The server owns milestone completion. */
(function(root){
'use strict';
const steps=[['inspect','Gladyatörlerini tanı','Sınıfını ve özelliklerini incele.'],['equipment','Ekipmanını hazırla','Takılı eşyalarını kontrol et.'],['mission','İlk görevine çık','Hazır bir gladyatörü göreve gönder.'],['training','Antrenmana başla','Diğer gladyatörünle çalış.']];
const classes={murmillo:'Murmillo',thraex:'Thraex',hoplomachus:'Hoplomachus',secutor:'Secutor',retiarius:'Retiarius',provocator:'Provocator',scissor:'Scissor'};
const slots={main_hand:'Silah',off_hand:'İkinci el',helmet:'Miğfer',chest:'Zırh',gloves:'Kolluk',legs:'Bacaklık'};
const names={gladius:'Gladius',sica:'Sica',spear:'Mızrak',trident:'Üç dişli mızrak',net:'Ağ',scissor:'Kol bıçağı',large:'Büyük kalkan',round:'Yuvarlak kalkan',small:'Küçük kalkan',heavy_mace:'Ağır gürz',halberd:'Halberd',warhammer:'Savaş çekici',mace:'Zincirli gürz',whip:'Kırbaç'};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn,cls='')=>{const n=el('button',cls,text);n.type='button';n.onclick=fn;if(text)n.setAttribute('aria-label',text);return n;};
const number=n=>Number(n||0).toLocaleString('tr-TR',{maximumFractionDigits:1});
function create(ctx){
 const modal=el('section','beginner-guide');modal.id='beginnerGuide';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','beginnerTitle');document.body.append(modal);
 const trigger=button('',()=>open(),'beginner-open');trigger.id='beginnerOpen';trigger.hidden=true;trigger.title='Başlangıç rehberi';trigger.setAttribute('aria-label','Başlangıç rehberi');
 trigger.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15M5 7l4 1M5 11l4 1M15 8l4-1M15 12l4-1"/></svg>';
 ctx.menu.append(trigger);
 let state=null,owner=null,epoch=0,queue=Promise.resolve(),pending=0,error='',missionError='',loading=false;
 let page=0,gearPage=0,selectedId=null,tab='inspect',returnFrom=null,previousFocus=null,autoTimer=0,autoPending=false;
 const roster=()=>ctx.roster().filter(g=>g.record?.id);
 const selected=()=>roster().find(g=>g.record.id===selectedId)||roster()[0];
 const count=()=>steps.filter(([key])=>state?.steps?.[key]).length;
 function call(action='state',id=null){
  const expected=owner,version=epoch;pending++;
  const task=queue.catch(()=>{}).then(async()=>{
   if(version!==epoch||expected!==ctx.getUser())return null;
   const controller=new AbortController();let timer;
   try{
    let request=ctx.client.rpc('ludus_onboarding',{p_action:action,p_gladiator:id});
    if(request.abortSignal)request=request.abortSignal(controller.signal);
    const result=await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'));},12000);})]);
    if(result.error)throw result.error;
    if(version!==epoch||expected!==ctx.getUser())return null;
    if(!result.data?.steps)throw Error('invalid response');
    state=result.data;error='';trigger.dataset.complete=String(count()===4);trigger.title='Başlangıç rehberi · '+count()+'/4';return state;
   }finally{clearTimeout(timer);}
  });
  queue=task;
  return task.catch(e=>{if(version===epoch)error='Rehber ilerlemesi kaydedilemedi. Bağlantını kontrol edip tekrar dene.';throw e;})
   .finally(()=>{pending--;if(version===epoch&&!modal.hidden)render();});
 }
 async function refresh(){
  if(loading)return;loading=true;render();
  await Promise.allSettled([call(),ctx.refresh().then(()=>{missionError='';}).catch(()=>{missionError='Görev bilgisi alınamadı.';})]);
  loading=false;if(!modal.hidden)render();
 }
 async function open(){
  if(!owner||owner!==ctx.getUser()||!modal.hidden||!ctx.canOpen())return;
  autoPending=false;clearTimeout(autoTimer);returnFrom=null;previousFocus=document.activeElement;ctx.onOpen();modal.hidden=false;render();
  modal.querySelector('.bg-close')?.focus();call('present').catch(()=>{});await refresh();
 }
 function close(navigating=false){
  if(modal.hidden)return;modal.hidden=true;ctx.onClose();
  if(!navigating){returnFrom=null;autoPending=false;call('dismiss').catch(()=>{});previousFocus?.focus?.();}
 }
 function chooseTab(key){tab=key==='training'?'inspect':key;render();}
 function navigate(target,g=selected(),item=null){
  if(['inspect','equipment','training'].includes(target)&&!g)return;
  returnFrom=target==='mission'?'mission':'gladiator';close(true);
  try{ctx.navigate(target,g,item);}catch(e){returnFrom=null;open();error='Bu bölüm açılamadı. Tekrar dene.';render();}
 }
 function resume(source){if(returnFrom!==source)return;returnFrom=null;setTimeout(()=>{if(ctx.canOpen()&&owner===ctx.getUser())open();},0);}
 function training(){const free=roster().find(g=>ctx.phase(g)==='available'&&!g.record.trained_today&&!g.record.exercise_completed);navigate('training',free||selected());}
 function stepAction(key){if(key==='mission')navigate('mission');else if(key==='training')training();else navigate(key);}
 function heading(title,eyebrow){const h=el('div','bg-panel-head');h.append(el('span','bg-eyebrow',eyebrow),el('h2','',title));return h;}
 function pagination(current,pages,onChange,label){const n=el('div','bg-pagination'),a=button('‹',()=>onChange(current-1)),b=button('›',()=>onChange(current+1));a.disabled=current===0;b.disabled=current>=pages-1;a.setAttribute('aria-label','Önceki '+label);b.setAttribute('aria-label','Sonraki '+label);n.append(a,el('span','',(current+1)+' / '+pages),b);return n;}
 function gladiators(){
  const panel=el('section','bg-panel bg-gladiators');panel.dataset.panel='inspect';panel.append(heading('Gladyatörlerin','I · LUDUS KADROSU'));
  const list=el('div','bg-fighters'),all=roster(),pages=Math.max(1,Math.ceil(all.length/2));page=Math.min(page,pages-1);
  for(const g of all.slice(page*2,page*2+2)){
   const r=g.record,card=el('article','bg-fighter'),portrait=el('img','bg-portrait');
   portrait.src='imperial-portrait-'+(classes[g.type]?g.type:'murmillo')+'-v31.webp';portrait.alt=classes[g.type]||'Gladyatör';
   const identity=button('',()=>{selectedId=r.id;gearPage=0;render();},'bg-select-fighter');identity.setAttribute('aria-label',g.name+' · Ekipmanını göster');identity.setAttribute('aria-pressed',String(selected()?.record.id===r.id));identity.append(portrait);
   const copy=el('div','bg-fighter-copy');copy.append(el('h3','',g.name),el('p','bg-class',classes[g.type]||g.type),el('p','bg-overall','Overall '+number(r.overall??50)));
   const phase=ctx.phase(g),status=el('span','bg-ready',({available:'Hazır',training:'Antrenmanda',resting:'Dinleniyor',injured:'İyileşiyor',mission:'Görevde',clanlocked:'Klan kadrosunda'})[phase]||'Meşgul');status.dataset.ready=String(phase==='available');copy.append(status);
   const inspect=button('İncele  ›',()=>navigate('inspect',g),'bg-action');inspect.setAttribute('aria-label',g.name+' · İncele');card.append(identity,copy,inspect);list.append(card);
  }
  if(!all.length){const empty=el('div','bg-empty');empty.append(el('p','','Henüz gladyatörün yok.'),button('Pazara git',()=>navigate('market'),'bg-action'));list.append(empty);}
  panel.append(list);if(pages>1)panel.append(pagination(page,pages,p=>{page=p;render();},'gladyatörler'));
  panel.append(el('p','bg-panel-note','Birini göreve gönderirken diğerini antrenmana ayırabilirsin.'));return panel;
 }
 function equipment(){
  const panel=el('section','bg-panel bg-equipment');panel.dataset.panel='equipment';panel.append(heading('Başlangıç ekipmanı','II · DONANIM'));
  const g=selected(),items=ctx.items().filter(i=>!i.clan_vault_id&&!i.market_listing_id&&(!i.equipped_by||i.equipped_by===g?.record.id));
  items.sort((a,b)=>Number(!!b.equipped_by)-Number(!!a.equipped_by)||Object.keys(slots).indexOf(a.equipped_slot)-Object.keys(slots).indexOf(b.equipped_slot));
  panel.append(el('p','bg-equipment-owner',g?g.name+' · '+(items.some(i=>i.equipped_by)?'Donanımın takılı':'Eşyalarını kuşan'):'Envanterin'));
  const perPage=innerHeight<=600&&innerWidth>700?2:4,grid=el('div','bg-items'),pages=Math.max(1,Math.ceil(items.length/perPage));gearPage=Math.min(gearPage,pages-1);
  for(const item of items.slice(gearPage*perPage,gearPage*perPage+perPage)){
   const name=item.name||names[item.model]||slots[item.equipped_slot]||({helmet:'Miğfer',chest:'Zırh',gloves:'Kolluk',legs:'Bacaklık'})[item.kind]||'Ekipman';
   const tile=button('',()=>navigate('equipment',g,item),'bg-item'),art=el('span','bg-item-art');art.innerHTML=root.LudusIcons?.svg(item)||'';
   tile.setAttribute('aria-label',name+' +'+Number(item.enhancement||0)+' · '+(item.equipped_by?'Takılı':'Envanterde'));
   tile.append(el('span','bg-item-name',name),art,el('span','bg-plus','+'+Number(item.enhancement||0)),el('small','bg-equipped',item.equipped_by?'Takılı':'Envanterde'));grid.append(tile);
  }
  if(!items.length)grid.append(el('p','bg-empty','Ekipmanın yok. Pazardan eşya alıp gladyatör detayında takabilirsin.'));
  panel.append(grid);if(pages>1)panel.append(pagination(gearPage,pages,p=>{gearPage=p;render();},'ekipmanlar'));
  const action=button(items.length?'Ekipmanı incele  ›':'Pazara git  ›',()=>navigate(items.length?'equipment':'market',g),'bg-action');action.disabled=!g&&items.length>0;panel.append(action);return panel;
 }
 function mission(){
  const panel=el('section','bg-panel bg-mission');panel.dataset.panel='mission';panel.append(heading('İlk görev','III · İMPARATORUN EMRİ'));
  const data=ctx.missions(),m=(data?.missions||[]).find(m=>Number(m.difficulty||m.slot)===1);
  if(m){
   const t=root.LudusImperial.tier(m),image=el('img','bg-mission-art');image.src=root.LudusImperial.missionImage(m);image.alt='';
   const assigned=(data.assignments||[]).find(a=>a.mission_id===m.id),copy=el('div','bg-mission-copy');
   copy.append(el('h3','',m.title),el('p','bg-facts',t.hours+' saat · '+t.required+' Overall'),el('p','bg-rewards',number(t.exp)+' Ludus EXP · '+t.diamonds+' Elmas · '+t.stones.map(([s,n])=>n+' '+s).join(' · ')),el('p','bg-mission-hint',assigned?'Bu görev için ekibin zaten yola çıktı.':'Göreve çıkan gladyatör, görev bitene kadar kullanılamaz.'));
   panel.append(image,copy,button(assigned?'Görevi görüntüle  ›':'Görevi seç  ›',()=>navigate('mission'),'bg-action'));
  }else{
   const empty=el('div','bg-empty');empty.append(el('p','',missionError||'Bugünün kolay görevi henüz yayımlanmadı.'),el('p','','Gladyatörlerini inceleyip antrenman adımıyla devam edebilirsin.'));
   panel.append(empty,button(missionError?'Yeniden dene':'Görevleri aç  ›',()=>missionError?refresh():navigate('mission'),'bg-action'));
  }return panel;
 }
 function render(){
  if(modal.hidden)return;
  const focusKey=document.activeElement?.closest('#beginnerGuide')?document.activeElement.getAttribute('aria-label'):null;
  const shell=el('div','bg-shell'),top=el('div','bg-top'),title=el('div','bg-title');title.append(el('span','bg-brand','COLOSSEUM & MAGNUS'));
  const h=el('h1','','BAŞLANGIÇ REHBERİ');h.id='beginnerTitle';title.append(h);const x=button('×',()=>close(),'bg-close');x.setAttribute('aria-label','Başlangıç rehberini kapat');top.append(title,x);
  const intro=el('div','bg-intro');intro.append(el('p','',count()===4?'İlk adımlar tamamlandı. Ludus’un artık yolculuğa hazır.':'Ludus’un kuruldu. Gladyatörlerini tanı, donat ve ilk adımını at.'),el('span','bg-count',state?count()+' / 4 tamamlandı':'İlerleme yükleniyor…'));
  const tabs=el('nav','bg-tabs');tabs.setAttribute('aria-label','Rehber bölümleri');for(const [key,text]of [['inspect','Gladyatörler'],['equipment','Ekipman'],['mission','İlk görev']]){const b=button(text,()=>chooseTab(key));b.setAttribute('aria-pressed',String(tab===key));tabs.append(b);}
  const panels=el('div','bg-panels');panels.dataset.tab=tab;panels.append(gladiators(),equipment(),mission());
  const goals=el('div','bg-goals'),gh=el('div','bg-goals-heading');gh.append(el('strong','','İLK HEDEFLER'),el('span','','İlerlemen hesabında saklanır'));goals.append(gh);
  const track=el('div','bg-goal-list');
  for(const [i,[key,name,description]]of steps.entries()){const done=!!state?.steps?.[key],b=button('',()=>stepAction(key),'bg-goal');b.dataset.complete=String(done);b.setAttribute('aria-label',name+(done?' · Tamamlandı':''));b.append(el('span','bg-step-number',done?'✓':String(i+1)));const copy=el('span','bg-step-copy');copy.append(el('strong','',name),el('small','',description));b.append(copy);track.append(b);}goals.append(track);
  const bottom=el('div','bg-bottom'),status=el('p','bg-status',error||missionError||(loading?'Bilgiler yenileniyor…':count()===4?'Tebrikler! Rehbere menüdeki kitap simgesinden her zaman dönebilirsin.':'İstediğin zaman ara ver; menüdeki kitap simgesinden devam edebilirsin.'));status.setAttribute('role','status');bottom.append(status);
  if(error||missionError){const retry=button('Tekrar dene',refresh,'bg-retry');retry.disabled=loading||pending>0;bottom.append(retry);}
  bottom.append(button(count()===4?'Ludus’a dön':'Daha sonra',()=>close(),'bg-later'));
  shell.append(top,intro,tabs,panels,goals,bottom);modal.replaceChildren(shell);
  if(focusKey)[...modal.querySelectorAll('button')].find(n=>n.getAttribute('aria-label')===focusKey)?.focus({preventScroll:true});
 }
 function tryAuto(){if(!autoPending||owner!==ctx.getUser())return;if(!document.hidden&&ctx.canOpen()){open();return;}autoTimer=setTimeout(tryAuto,1000);}
 async function start(){owner=ctx.getUser();if(!owner)return;trigger.hidden=false;try{const s=await call();if(s?.should_open){autoPending=true;tryAuto();}}catch{trigger.title='Başlangıç rehberi · Tekrar dene';}}
 function reset(){epoch++;owner=null;state=null;autoPending=false;clearTimeout(autoTimer);returnFrom=null;trigger.hidden=true;if(!modal.hidden){modal.hidden=true;ctx.onClose();}queue=Promise.resolve();}
 ctx.client.auth?.onAuthStateChange?.((event,session)=>{if(event==='SIGNED_OUT'||(session?.user?.id&&owner&&session.user.id!==owner))reset();});
 modal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
  if(event.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled)')].filter(n=>n.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 });
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{gearPage=0;if(!modal.hidden)render();},70);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!modal.hidden)refresh();});
 return{start,open,close,resume,refresh,reset,inspected:g=>{if(owner&&g?.record?.id)call('inspect',g.record.id).catch(()=>{});},get visible(){return !modal.hidden;},get state(){return state;}};
}
root.LudusOnboarding={create};
})(typeof window!=='undefined'?window:globalThis);
