/* Revir commands, stock and treatment time are authoritative on the server. */
(function(root){
 'use strict';
 const severityNames={light:'Hafif',medium:'Orta',heavy:'Kötü'};
 const number=value=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(Number(value)||0);
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 const button=(text,action,cls)=>{const node=el('button',cls,text);node.type='button';node.onclick=action;return node;};
 const duration=seconds=>number(Number(seconds)/3600)+' saat';
 const time=milliseconds=>{const total=Math.max(0,Math.ceil(milliseconds/1000)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;return [hours,minutes,seconds].map(value=>String(value).padStart(2,'0')).join(':');};
 function create(ctx){
  let owner=null,data=null,opened=false,loading=false,busy=false,previewLoading=false,selected=null,preview=null,filter='all',page=0,effectPage=0,materialPage=0;
  let sequence=0,previewSequence=0,pending=null,lastFocus=null,serverAt=0,clockAt=0,timer=null;
  const monotonic=()=>root.performance?.now?.()??Date.now();
  const now=()=>serverAt+Math.max(0,monotonic()-clockAt);
  const modal=el('section','infirmary-v289');modal.id='infirmaryModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','infirmaryTitle');
  const header=el('header','inf289-header');const title=el('h1','','Revir');title.id='infirmaryTitle';
  const closeButton=button('←',close,'inf289-back');closeButton.setAttribute('aria-label','Reviri kapat');
  const production=button('Malzeme üretimi',()=>{if(busy)return;close();ctx.openProduction?.();},'inf289-production');production.disabled=!ctx.openProduction;
  header.append(closeButton,title,el('span','inf289-brand','COLOSSEUM & MAGNUS'),production);
  const filters=el('nav','inf289-filters');filters.setAttribute('aria-label','Revir kayıtları');
  const body=el('main','inf289-body');
  const footer=el('footer','inf289-footer'),status=el('span');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const retry=button('Yeniden dene',()=>pending?submit().catch(()=>{}):refresh(),'inf289-retry');retry.hidden=true;footer.append(status,retry);
  modal.append(header,filters,body,footer);document.body.append(modal);
  const marker=button('Reviri aç',()=>open(),'inf289-world-action room-world-action');marker.id='infirmaryAction';marker.hidden=true;document.body.append(marker);
  const point=ctx.T?new ctx.T.Vector3(-2.54,1.25,-.48):null;
  const current=()=>data?.injuries?.find(injury=>injury.id===selected);
  const treatmentFor=injury=>(data?.treatments||[]).find(treatment=>treatment.id===injury?.treatment_id||treatment.injury_id===injury?.id&&treatment.status==='active');
  const liveInjuries=()=>data?.injuries?.filter(injury=>injury.status!=='healed')||[];
  const records=()=>filter==='legacy'?data?.legacy_injuries||[]:filter==='healed'?data?.injuries?.filter(injury=>injury.status==='healed')||[]:liveInjuries().filter(injury=>filter==='all'||filter==='untreated'&&injury.status==='untreated'||filter==='treating'&&injury.status==='treating');
  const pageSize=()=>root.innerHeight>root.innerWidth?4:Math.max(3,Math.min(8,Math.floor((root.innerHeight-150)/48)));
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function savePending(){if(pending)localStorage.setItem('ludus-infirmary-v289:'+owner,JSON.stringify(pending));else localStorage.removeItem('ludus-infirmary-v289:'+owner);}
  async function identify(){
   if(owner)return;owner=(await ctx.ready)?.user_id;if(!owner)throw Error('Reviri açmak için giriş yapmalısın.');
   try{const stored=JSON.parse(localStorage.getItem('ludus-infirmary-v289:'+owner)||'null');if(stored?.owner===owner&&['start','finish'].includes(stored.action)&&stored.request&&stored.args)pending=stored;}catch{}
  }
  function adopt(result){
   if(result?.user_id!==owner)throw Error('Revir hesabı doğrulanamadı.');
   if(!Array.isArray(result.injuries)||!Array.isArray(result.treatments))throw Error('Revir kayıtları alınamadı.');
   const timestamp=Date.parse(result.server_now);if(!Number.isFinite(timestamp))throw Error('Revir saati alınamadı.');
   data=result;serverAt=timestamp;clockAt=monotonic();ctx.onState?.(result);
   root.dispatchEvent(new CustomEvent('ludus-infirmary-change',{detail:{state:result}}));
  }
  async function rpc(action,args={},request=null){const result=await ctx.client.rpc('ludus_infirmary_v289',{p_action:action,p_args:args,p_request:request});if(result.error)throw result.error;return result.data;}
  function chooseVisible(preferred){
   const all=records();page=Math.min(page,Math.max(0,Math.ceil(all.length/pageSize())-1));
   if(filter==='legacy'){selected=null;return;}
   const visible=all.slice(page*pageSize(),(page+1)*pageSize());
   if(preferred&&all.some(injury=>injury.id===preferred)){selected=preferred;page=Math.floor(all.findIndex(injury=>injury.id===preferred)/pageSize());}
   else if(!visible.some(injury=>injury.id===selected))selected=visible[0]?.id||null;
  }
  async function refresh(){
   if(busy||loading)return;const request=++sequence;loading=true;retry.hidden=true;render();
   try{await identify();const result=await rpc('state');if(request!==sequence)return;adopt(result);chooseVisible(selected);preview=null;
    if(pending){message('Önceki işlemin sonucu bekleniyor. Yeniden dene ile kontrol et.');retry.hidden=false;}
    else message('');
   }catch(error){if(request===sequence){message(error.message||'Revir bilgileri alınamadı.',true);retry.hidden=false;}}
   finally{if(request===sequence){loading=false;render();if(selected)loadPreview();}}
  }
  async function loadPreview(){
   const injury=current(),request=++previewSequence;preview=null;effectPage=0;materialPage=0;
   if(!injury||injury.status!=='untreated'){previewLoading=false;render();return;}
   previewLoading=true;render();
   try{const result=await rpc('preview',{injury_id:injury.id});if(request!==previewSequence||selected!==injury.id)return;
    if(result.user_id!==owner)throw Error('Revir hesabı doğrulanamadı.');
    if(result.injuries)adopt(result);
    const next=result.preview;if(!next||next.injury_id!==injury.id)throw Error('Tedavi önizlemesi doğrulanamadı.');preview=next;
   }catch(error){if(request===previewSequence){message(error.message||'Tedavi hesabı alınamadı.',true);retry.hidden=false;}}
   finally{if(request===previewSequence){previewLoading=false;render();}}
  }
  function setSelection(id){if(busy||loading)return;selected=id;effectPage=0;message('');loadPreview();}
  function setFilter(value){if(busy)return;filter=value;page=0;chooseVisible();preview=null;render();loadPreview();}
  function pager(index,total,onPage,cls='inf289-pager'){
   const row=el('div',cls),previous=button('‹',()=>onPage(index-1)),next=button('›',()=>onPage(index+1));
   previous.setAttribute('aria-label','Önceki sayfa');next.setAttribute('aria-label','Sonraki sayfa');previous.disabled=busy||loading||index===0;next.disabled=busy||loading||index>=total-1;
   row.append(previous,el('span','','Sayfa '+(index+1)+' / '+Math.max(1,total)),next);return row;
  }
  function renderFilters(){
   filters.replaceChildren();const live=liveInjuries();
   for(const [value,label,count]of [['all','Tümü',live.length],['untreated','Tedavi bekleyen',live.filter(row=>row.status==='untreated').length],['treating','Tedavide',live.filter(row=>row.status==='treating').length]]){
    const tab=button(label+' · '+count,()=>setFilter(value));tab.setAttribute('aria-pressed',String(filter===value));tab.disabled=busy;filters.append(tab);
   }
   const healed=data?.injuries?.filter(row=>row.status==='healed').length||0;if(healed){const tab=button('Tamamlanan · '+healed,()=>setFilter('healed'));tab.setAttribute('aria-pressed',String(filter==='healed'));tab.disabled=busy;filters.append(tab);}
   if(data?.legacy_injuries?.length){const tab=button('Önceki kayıtlar · '+data.legacy_injuries.length,()=>setFilter('legacy'));tab.setAttribute('aria-pressed',String(filter==='legacy'));tab.disabled=busy;filters.append(tab);}
   filters.append(el('span','inf289-duration-key','Hafif 3 saat · Orta 12 saat · Kötü 24 saat'));
  }
  function renderList(){
   const list=el('aside','inf289-list');list.append(el('h2','','Gladyatörler'));
   const rows=el('div','inf289-patients'),all=records(),visible=all.slice(page*pageSize(),(page+1)*pageSize());rows.style.setProperty('--patient-rows',String(pageSize()));
   for(const injury of visible){
    const row=button('',()=>setSelection(injury.id),'inf289-patient');row.dataset.injuryId=injury.id;row.setAttribute('aria-pressed',String(injury.id===selected));row.disabled=busy||filter==='legacy';
    const name=el('strong','',injury.gladiator_name||injury.name||'Gladyatör');const description=el('span','inf289-injury-name',injury.injury_name||'Önceki sakatlık');description.title=description.textContent;
    const line=el('small','inf289-patient-state');line.dataset.severity=injury.severity||'';line.textContent=filter==='legacy'?'İyileşme · '+new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(injury.injured_until)):(severityNames[injury.severity]||'Önceki kayıt')+' · '+(injury.status==='treating'?'Tedavide':injury.status==='healed'?'Tamamlandı':'Tedavi bekliyor');
    row.append(name,description,line);rows.append(row);
   }
   if(!visible.length)rows.append(el('p','inf289-empty',loading?'Revir yükleniyor…':filter==='treating'?'Tedavide gladyatör yok.':'Bu listede yaralı gladyatör yok.'));
   list.append(rows,pager(page,Math.ceil(all.length/pageSize()),next=>{page=next;chooseVisible();render();loadPreview();}));return list;
  }
  function renderMaterials(){
   const section=el('section','inf289-materials');section.append(el('h3','','Gereken malzemeler'));
   const table=el('div','inf289-material-table');table.setAttribute('role','table');table.setAttribute('aria-label','Tedavi malzemeleri');
   const head=el('div','inf289-material-row inf289-material-head');head.setAttribute('role','row');for(const text of ['Malzeme','Gereken','Kasada']){const cell=el('span','',text);cell.setAttribute('role','columnheader');head.append(cell);}table.append(head);
   const required=preview?.required||[],size=root.innerHeight<=360?3:root.innerHeight<=600||root.innerHeight>root.innerWidth?4:6,pages=Math.max(1,Math.ceil(required.length/size));materialPage=Math.min(materialPage,pages-1);
   for(const material of required.slice(materialPage*size,(materialPage+1)*size)){
    const row=el('div','inf289-material-row');row.setAttribute('role','row');row.dataset.sku=material.sku;row.dataset.missing=String(Number(material.owned)<Number(material.required));
    for(const value of [material.name||material.sku,number(material.required),number(material.owned)]){const cell=el('span','',value);cell.setAttribute('role','cell');row.append(cell);}table.append(row);
   }
   section.append(table);
   if(pages>1)section.append(pager(materialPage,pages,next=>{materialPage=next;render();},'inf289-pager inf289-material-pager'));
   if(!preview?.required?.length)section.append(el('p','inf289-note',previewLoading?'Malzemeler hesaplanıyor…':'Tedavi gereksinimleri yükleniyor…'));
   section.append(el('p','inf289-material-note','Malzemeler tedavi başlangıcında kullanılır. Koruma ihtimali, gereken stok miktarını düşürmez.'));
   return section;
  }
  function renderEffects(effects=preview?.doctor_effects||[]){
   const section=el('section','inf289-effects');section.append(el('h3','','Doktorun bilgileri'));
   const size=root.innerHeight>root.innerWidth?1:root.innerHeight<=600?2:3,total=Math.max(1,Math.ceil(effects.length/size));effectPage=Math.min(effectPage,total-1);
   const rows=el('div','inf289-effect-rows');
   for(const effect of effects.slice(effectPage*size,(effectPage+1)*size)){
    const row=el('div','inf289-effect');row.dataset.contentId=effect.content_id||'';
    row.append(el('strong','',effect.label||effect.content_id),el('span','',effect.effect_text||''));rows.append(row);
   }
   if(!effects.length)rows.append(el('p','inf289-note',previewLoading?'Bilgiler hesaplanıyor…':'Bu tedaviye uygulanan öğrenilmiş doktor bilgisi yok.'));
   section.append(rows);
   if(total>1)section.append(pager(effectPage,total,next=>{effectPage=next;render();},'inf289-pager inf289-effect-pager'));
   return section;
  }
  function renderTreatment(injury,treatment){
   const panel=el('section','inf289-treatment');panel.append(el('h3','','Revirde tedavi'));
   const clock=el('strong','inf289-countdown');clock.dataset.endsAt=treatment.ends_at;clock.dataset.startedAt=treatment.started_at;
   const bar=el('progress','inf289-progress');bar.max=1;bar.setAttribute('aria-label','Tedavi ilerlemesi');
   const info=el('p','inf289-treatment-dates');const formatter=new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
   info.textContent='Başlangıç '+formatter.format(new Date(treatment.started_at))+' · Bitiş '+formatter.format(new Date(treatment.ends_at));
   info.title=info.textContent;panel.append(clock,bar,info);
   const materialSummary=(map={})=>Object.entries(map).map(([sku,quantity])=>(data.inventory?.find(item=>item.sku===sku)?.name||sku)+' × '+number(quantity)).join(' · ');
   if(Object.keys(treatment.consumed||{}).length)panel.append(el('p','inf289-used','Kullanılan · '+materialSummary(treatment.consumed)));
   if(Object.keys(treatment.saved||{}).length)panel.append(el('p','inf289-saved','Korunan · '+materialSummary(treatment.saved)));
   return panel;
  }
  function renderDetail(){
   const detail=el('section','inf289-detail'),injury=current();
   if(!injury){detail.append(el('div','inf289-empty-detail',filter==='legacy'?'Önceki süreli sakatlıklar mevcut iyileşme düzenini korur.':loading?'Revir kayıtları yükleniyor…':'Tedavisini görmek için bir yaralı seç.'));return detail;}
   detail.dataset.injuryId=injury.id;const top=el('div','inf289-patient-heading'),copy=el('div');
   copy.append(el('h2','',injury.gladiator_name),el('p','',injury.injury_name+(Number.isFinite(Number(injury.fatigue_value))?' · Yorgunluk '+number(injury.fatigue_value)+'/100':'')));
   const treatment=treatmentFor(injury),recovery=injury.status==='treating'?{per_hour:treatment?.bonuses?.recovery_per_hour,honey_total:treatment?.bonuses?.honey_extra,fig_discharge:treatment?.bonuses?.fig_discharge}:preview?.recovery;
   if(recovery){const parts=[];if(recovery.per_hour!=null)parts.push('Dinlenme '+number(recovery.per_hour)+' puan/saat');if(Number(recovery.honey_total)>0)parts.push('Ballı Sirke toplam '+number(recovery.honey_total)+' puan');if(Number(recovery.fig_discharge)>0)parts.push('İncir taburculukta '+number(recovery.fig_discharge)+' puan');if(parts.length)copy.append(el('small','inf289-recovery',parts.join(' · ')));}
   const badge=el('span','inf289-severity',(severityNames[injury.severity]||injury.severity)+' · '+duration(injury.duration_seconds));badge.dataset.severity=injury.severity;top.append(copy,badge);detail.append(top);
   if(injury.status==='healed'){const done=el('div','inf289-complete');done.append(el('h3','','Tedavi tamamlandı'),el('p','inf289-note','Gladyatörün revir tedavisi sona erdi.'));detail.append(done);return detail;}
   if(injury.status==='treating'&&treatment){const columns=el('div','inf289-preview-columns inf289-active-columns');columns.append(renderTreatment(injury,treatment),renderEffects(treatment.doctor_effects||[]));detail.append(columns);}
   else{const columns=el('div','inf289-preview-columns');columns.append(renderMaterials(),renderEffects());detail.append(columns);}
   const actions=el('div','inf289-actions');
   if(injury.status==='treating'&&treatment){
    const finish=button('Tedavi sürüyor',()=>finishTreatment(treatment.id).catch(()=>{}),'inf289-finish');finish.dataset.endsAt=treatment.ends_at;finish.disabled=true;actions.append(el('span','inf289-action-note','Süre dolmadan tedavi tamamlanamaz.'),finish);
   }else{
    const start=button(busy?'İşleniyor…':'Tedaviyi başlat',()=>startTreatment(injury.id).catch(()=>{}),'inf289-start');start.disabled=loading||busy||previewLoading||!!pending||!preview?.can_start;
    const note=previewLoading?'Tedavi hesabı yükleniyor…':preview?.can_start?'Hazır · '+duration(preview.duration_seconds||injury.duration_seconds)+' revir tedavisi':preview?.reason||'Tedavi hesabı hazırlanıyor.';
    actions.append(el('span','inf289-action-note',note),start);
   }
   detail.append(actions);return detail;
  }
  function updateClock(){
   if(!opened)return;const injury=current(),treatment=treatmentFor(injury);if(!treatment)return;
   const ends=Date.parse(treatment.ends_at),starts=Date.parse(treatment.started_at),remaining=ends-now();
   const clock=modal.querySelector('.inf289-countdown'),bar=modal.querySelector('.inf289-progress'),finish=modal.querySelector('.inf289-finish');
   if(clock)clock.textContent=remaining>0?time(remaining):'Süre doldu';
   if(bar)bar.value=Math.max(0,Math.min(1,(now()-starts)/Math.max(1,ends-starts)));
   if(finish){finish.textContent=remaining>0?'Tedavi sürüyor':'Tedavi sonucunu kontrol et';finish.disabled=remaining>0||busy||loading||!!pending;}
  }
  function render(){if(!opened)return;modal.setAttribute('aria-busy',String(loading||busy));renderFilters();body.replaceChildren(renderList(),renderDetail());closeButton.disabled=busy;production.disabled=busy||!ctx.openProduction;updateClock();}
  async function command(action,args){
   await identify();if(busy)throw Error('Önceki işlem sürüyor.');
   if(pending&&(pending.action!==action||JSON.stringify(pending.args)!==JSON.stringify(args)))throw Error('Önceki işlemin sonucunu önce doğrula.');
   if(!pending){pending={owner,action,args,request:crypto.randomUUID()};try{savePending();}catch(error){pending=null;throw error;}}
   return submit();
  }
  async function submit(){
   if(busy||!pending)return;busy=true;sequence++;previewSequence++;loading=false;previewLoading=false;retry.hidden=true;message('Revir işlemi sürüyor…');render();
   try{const action=pending.action,result=await rpc(action,pending.args,pending.request);adopt(result);pending=null;savePending();preview=null;chooseVisible(selected);
    message(action==='start'?'Tedavi başladı. Gladyatör revirde dinleniyor.':'Tedavi sonucu güncellendi.');return result;
   }catch(error){if(['P0001','22023','22P02','23514'].includes(error.code)){pending=null;savePending();}message(error.message||'İşlemin sonucu alınamadı. Yeniden deneyebilirsin.',true);retry.hidden=false;throw error;}
   finally{busy=false;render();if(!pending&&current()?.status==='untreated')loadPreview();}
  }
  const startTreatment=id=>command('start',{injury_id:id||selected});
  const finishTreatment=id=>command('finish',{treatment_id:id||treatmentFor(current())?.id});
  function open(options={}){
   if(busy)return;if(!opened){opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();timer=root.setInterval(updateClock,1000);}
   filter='all';page=0;selected=options.injuryId||null;message('');render();closeButton.focus({preventScroll:true});refresh();
  }
  function close(){if(!opened||busy)return;opened=false;sequence++;previewSequence++;loading=false;previewLoading=false;modal.hidden=true;root.clearInterval(timer);timer=null;ctx.onClose?.();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  function tick(){if(point&&root.LudusRoomActions)root.LudusRoomActions.place(marker,point,ctx,!opened&&!!ctx.inRoom?.(),5);}
  modal.addEventListener('pointerdown',event=>event.stopPropagation());
  modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}if(event.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled)')].filter(node=>node.getClientRects().length);if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}}});
  root.addEventListener('resize',()=>{if(opened){chooseVisible(selected);render();}});
  return {open,close,refresh,tick,start:startTreatment,finish:finishTreatment,retry:async()=>{await identify();if(!pending)throw Error('Bekleyen revir işlemi yok.');return submit();},get visible(){return opened;},get state(){return data;},get preview(){return preview;},get pending(){return pending;}};
 }
 root.LudusInfirmaryV289={create};
})(globalThis);
