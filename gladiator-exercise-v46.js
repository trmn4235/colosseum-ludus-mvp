/* Character attributes are independent of equipment. Awards and time come from the server. */
(function(root){
 'use strict';
 const attributes=[['attack_technique','Saldırı tekniği'],['defense_technique','Savunma tekniği'],['muscle','Kas gücü'],['speed','Hız'],['reflex','Refleks'],['conditioning','Kondisyon'],['tactics','Taktik']];
 const profiles={murmillo:[51,53,52,47,48,51,48],thraex:[53,48,49,52,52,48,48],hoplomachus:[51,51,49,48,50,49,52],secutor:[50,53,52,48,49,51,47],retiarius:[49,47,48,53,53,49,51],provocator:[49,53,51,47,48,53,49],scissor:[53,48,53,49,51,48,48]};
 const format=n=>Number(n??0).toLocaleString('tr-TR',{maximumFractionDigits:2});
 function profile(type){return Object.fromEntries(attributes.map(([key],i)=>[key,(profiles[type]||Array(7).fill(50))[i]]));}
 function mean(stats){return attributes.reduce((sum,[key])=>sum+Number(stats[key]||0),0)/7;}
 function energy(g,now=Date.now()){
  const value=Number(g.fatigue_value??g.fatigue??0),from=Date.parse(g.fatigue_rest_from);
  return Math.min(100,Math.max(0,100-value+(Number.isFinite(from)?Math.max(0,now-from)/3600000*10:0)));
 }
 function combatStats(g){
  const s=g.base_stats||profile(g.class),v=key=>Number(s[key]??50);
  return {health:v('conditioning'),stamina:v('conditioning'),strength:.6*v('muscle')+.25*v('attack_technique')+.15*v('tactics'),defense:.75*v('defense_technique')+.25*v('tactics'),agility:v('reflex'),speed:v('speed')};
 }
 function create(options){
  const panel=options.panel||document.getElementById('orders');let selected=null,stat=attributes[0][0],busy=false,bulk=false,message='',selectedIDs=new Set(),previewCleanup=null,previewCanvas=null,previewFighter=null,previewReady=false,previousFocus=null,rosterPage=0,bulkPage=0;
  const roster=()=>options.roster(),record=g=>g.record||g,now=()=>options.now?.()||Date.now();
  const phase=g=>options.phase?.(g)||(Date.parse(record(g).injured_until)>now()?'injured':record(g).status==='available'?'available':record(g).status);
  const eligible=g=>{const r=record(g);return phase(g)==='available'&&r.status==='available'&&!r.clan_roster_id&&!r.trained_today&&!r.exercise_completed&&energy(r,now())>0&&Number(r.base_stats?.[stat]??50)<100;};
  function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,fn,disabled=false,cls=''){const n=node('button',cls,text);n.type='button';n.disabled=disabled;n.onclick=fn;return n;}
  function meter(label,value,kind,sub){const wrap=node('div','exercise-meter '+kind),head=node('div','exercise-meter-heading');head.append(node('span','',label),node('strong','',format(value)+'%'));const track=node('div','exercise-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(value));const fill=node('div','exercise-fill');fill.style.width=value+'%';track.append(fill);wrap.append(head,track,node('small','',sub));return wrap;}
  function pageSize(){return Math.max(2,Math.min(6,Math.floor(((panel.clientWidth||innerWidth)-88)/(innerHeight<450?145:210))));}
  function bulkSize(){return Math.max(3,Math.min(10,Math.floor((panel.clientHeight*.69-75)/(innerHeight<450?24:34))));}
  function pager(page,pages,change,label){const nav=node('div','exercise-pagination');const prev=button('‹',()=>change(page-1),page===0),next=button('›',()=>change(page+1),page>=pages-1);prev.setAttribute('aria-label','Önceki '+label);next.setAttribute('aria-label','Sonraki '+label);nav.append(prev,node('span','',(page+1)+' / '+pages),next);return nav;}
  function render(){
   if(!selected||panel.hidden)return;
   const g=selected,r=record(g),p=phase(g),stats=r.stat_version===46?r.base_stats:profile(g.type||r.class),e=energy(r,now()),units=Number(r.exercise_units||0);
   const shell=node('div','exercise-panel');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Gladyatör detay');
   const top=node('div','exercise-top');top.append(node('span','','COLOSSEUM & LUDUS'),node('h1','','GLADYATÖR DETAY'),button('Kapat',close));shell.append(top);
   const layout=node('div','exercise-layout'),stage=node('div','exercise-stage'),portrait=node('div','exercise-character'),summary=node('div','exercise-summary'),details=node('div','exercise-details');
   const slots=[['main_hand','Silah'],['off_hand','Kalkan / İkinci el'],['helmet','Miğfer'],['chest','Göğüs zırhı'],['gloves','Kolluk'],['legs','Bacaklık']];
   for(let side=0;side<2;side++){const column=node('div','exercise-equipment');for(const [key,label]of slots.slice(side*3,side*3+3)){const item=(g.items||[]).find(i=>i.equipped_slot===key),tile=node('div','exercise-item'+(item?' equipped':'')),art=node('div','exercise-item-art');tile.dataset.slot=key;tile.title=item?.name||label+' · Boş';art.innerHTML=root.LudusIcons?.svg(item)||'<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M48 30v36M30 48h36" stroke="#bca16d" stroke-width="2"/></svg>';tile.append(node('span','',label),art,node('small','',item?(item.name||item.model)+(Number(item.enhancement)>0?' +'+item.enhancement:''):'Boş'));column.append(tile);}stage.append(column);if(side===0)stage.append(portrait);}
   const figure=node('img','exercise-portrait');figure.src='imperial-portrait-'+(g.type||r.class)+'-v31.webp';figure.alt=g.name||r.name;portrait.append(figure);
   layout.append(summary,stage,details);shell.append(layout);
   const header=node('div','exercise-header');
   const identity=node('div','exercise-identity'),title=node('h2','',g.name||r.name);title.id='ordersTitle';identity.append(title,node('span','exercise-class',options.className?.(g)||g.type||r.class));
   const overall=node('div','exercise-overall');overall.append(node('small','','OVERALL'),node('strong','',format(r.overall??mean(stats))));
   header.append(identity,overall);summary.append(header);
   const state=node('p','exercise-status');state.id='ordersText';state.setAttribute('role','status');
   const labels={available:'Hazır',training:'Antrenmanda',resting:'Dinleniyor',injured:'Sakat · İyileşiyor',mission:'İmparator görevinde',clanlocked:'Klan kadrosunda'};
   state.textContent=message||(labels[p]||'Kullanımda')+(options.time?.(g)?' · '+options.time(g):'');summary.append(state);
   const bars=node('div','exercise-bars');bars.append(meter('Günlük Egzersiz Barı',units/3*100,'daily',r.exercise_completed?'Bugünkü gelişim tamamlandı':'3 maç · 1 antrenman · 1 kolay görev'));
   bars.append(meter('Yorgunluk Barı',e,'energy'+(e<30?' danger':''),e<30?'%25 sakatlık riski · +10/saat':'Kalan enerji · +10/saat'));summary.append(bars);
   const list=node('div','exercise-attributes');list.setAttribute('aria-label','Gladyatör istatistikleri');
   for(const [key,label]of attributes){const b=button('',()=>{stat=key;message='';render();},busy,'exercise-attribute'+(stat===key?' selected':''));b.setAttribute('aria-pressed',String(stat===key));b.append(node('span','',label),node('strong','',format(stats[key])));list.append(b);}details.append(node('h3','exercise-section-title','ÖZELLİKLER'),list);
   const actions=node('div','exercise-actions');actions.id='orderButtons';
   actions.append(button(busy?'Kaydediliyor…':attributes.find(a=>a[0]===stat)[1]+' çalış',()=>send([record(g).id]),busy||!options.loaded()||!eligible(g),'exercise-primary'));
   actions.append(button(bulk?'Tek gladyatöre dön':'Toplu antrenman',()=>{bulk=!bulk;bulkPage=0;selectedIDs=new Set(roster().filter(eligible).slice(0,30).map(g=>record(g).id));message='';render();},busy||!options.loaded()));summary.append(actions);
   if(bulk){const group=node('div','exercise-bulk'),per=bulkSize(),pages=Math.max(1,Math.ceil(roster().length/per));bulkPage=Math.min(bulkPage,pages-1);for(const fighter of roster().slice(bulkPage*per,(bulkPage+1)*per)){const row=node('label','exercise-bulk-row'),checkbox=node('input');checkbox.type='checkbox';checkbox.value=record(fighter).id;checkbox.disabled=busy||!eligible(fighter)||(!selectedIDs.has(checkbox.value)&&selectedIDs.size>=30);checkbox.checked=eligible(fighter)&&selectedIDs.has(checkbox.value);checkbox.onchange=()=>{checkbox.checked?selectedIDs.add(checkbox.value):selectedIDs.delete(checkbox.value);render();};row.append(checkbox,node('span','',fighter.name||record(fighter).name),node('small','',eligible(fighter)?format(record(fighter).overall):'Meşgul'));group.append(row);}const nav=pager(bulkPage,pages,p=>{bulkPage=p;render();},'antrenman gladyatörleri'),submit=button('Seçilenleri çalıştır · '+selectedIDs.size,()=>send([...selectedIDs]),busy||!selectedIDs.size,'exercise-primary');details.replaceChildren(node('h3','exercise-section-title','TOPLU ANTRENMAN'),node('p','exercise-bulk-stat',attributes.find(a=>a[0]===stat)[1]),group,nav,submit);}
   const note=node('p','exercise-note','1 sa çalışma · 1 sa dinlenme. Sakatlık: −5 Overall · 12 sa.');summary.append(note);
   const footer=node('div','exercise-footer');footer.append(button('Yenile',async()=>{message='';await options.refresh();render();},busy),button('Ekipman',()=>{location.href='savas.html?v=48';}));summary.append(footer);
   const others=node('div','exercise-others'),strip=node('div','exercise-roster'),per=pageSize(),pages=Math.max(1,Math.ceil(roster().length/per));rosterPage=Math.min(rosterPage,pages-1);const rosterHead=node('div','exercise-roster-heading');rosterHead.append(node('h3','','GLADYATÖRLERİN'),pager(rosterPage,pages,p=>{rosterPage=p;render();},'gladyatörler'));others.append(rosterHead);strip.style.setProperty('--roster-columns',String(per));for(const fighter of roster().slice(rosterPage*per,(rosterPage+1)*per)){const rr=record(fighter),card=button('',()=>open(fighter),busy,'exercise-roster-card'+(fighter===g?' active':'')),img=node('img');img.src='imperial-portrait-'+(fighter.type||rr.class)+'-v31.webp';img.alt='';const info=node('div');const meta=node('div','exercise-roster-meta'),score=node('span','',format(rr.overall??50)+' OVR');score.setAttribute('aria-label','Overall '+format(rr.overall??50));meta.append(node('strong','',fighter.name||rr.name),score);info.append(meta,node('small','',(options.className?.(fighter)||fighter.type||rr.class)+' · '+(labels[phase(fighter)]||'Kullanımda')));const track=node('div','exercise-track'),fill=node('div','exercise-fill');fill.style.width=energy(rr,now())+'%';track.append(fill);info.append(track);card.setAttribute('aria-pressed',String(fighter===g));card.append(img,info);strip.append(card);}others.append(strip);shell.append(others);panel.replaceChildren(shell);
   if(options.preview){if(previewFighter!==g){previewCleanup?.();previewReady=false;previewFighter=g;previewCanvas=node('canvas','exercise-preview');previewCanvas.setAttribute('aria-label',(g.name||r.name)+' · Kuşanılmış ekipman');portrait.append(previewCanvas);previewCleanup=options.preview(g,previewCanvas,()=>{previewReady=true;const photo=panel.querySelector('.exercise-character>.exercise-portrait');if(photo)photo.hidden=true;});}else portrait.append(previewCanvas);figure.hidden=previewReady;}

  }
  async function send(ids){
   if(busy)return;busy=true;message='';render();
   const key='ludus-exercise-v46-'+stat+'-'+[...ids].sort().join(',');let request;
   try{request=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,request);}catch(_){request=crypto.randomUUID();}
   try{const result=await options.client.rpc('ludus_train_exercise',{p_gladiators:ids,p_stat:stat,p_request:request});if(result.error)throw result.error;try{localStorage.removeItem(key);}catch(_){}options.apply(result.data);bulk=false;message=ids.length+' gladyatör antrenmana başladı.';}
   catch(error){if(error.code==='P0001')try{localStorage.removeItem(key);}catch(_){}message='Antrenman başlatılamadı: '+error.message;}
   finally{busy=false;render();}
  }
  function open(g){if(panel.hidden){previousFocus=document.activeElement;options.onOpen?.();}selected=g;rosterPage=Math.floor(Math.max(0,roster().indexOf(g))/pageSize());bulk=false;message='';panel.hidden=false;render();if(!options.loaded())options.refresh().then(render);}
  function close(){previewCleanup?.();previewCleanup=null;previewFighter=null;previewCanvas=null;previewReady=false;panel.hidden=true;selected=null;options.onClose?.();previousFocus?.focus?.();}
  function tick(){
   if(!selected||panel.hidden||busy)return;
   const value=energy(record(selected),now()),wrap=panel.querySelector('.exercise-meter.energy');
   if(!wrap)return;wrap.classList.toggle('danger',value<30);wrap.querySelector('strong').textContent=format(value)+'%';wrap.querySelector('.exercise-fill').style.width=value+'%';wrap.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(value));
   wrap.querySelector('small').textContent=value<30?'%25 sakatlık riski · +10/saat':'Kalan enerji · +10/saat';
  }
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(selected&&!panel.hidden){rosterPage=Math.floor(Math.max(0,roster().indexOf(selected))/pageSize());render();}},80);});
  panel.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key==='Tab'){const buttons=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n=>n.getClientRects().length),first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
  return {open,close,render,tick,get selected(){return selected;}};
 }
 root.LudusExercise={attributes,profiles,profile,mean,energy,combatStats,format,create};
 if(typeof module!=='undefined')module.exports=root.LudusExercise;
})(typeof window!=='undefined'?window:globalThis);
