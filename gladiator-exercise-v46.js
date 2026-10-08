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
  const panel=options.panel||document.getElementById('orders');let selected=null,stat=attributes[0][0],busy=false,bulk=false,message='',selectedIDs=new Set();
  const roster=()=>options.roster(),record=g=>g.record||g,now=()=>options.now?.()||Date.now();
  const phase=g=>options.phase?.(g)||(Date.parse(record(g).injured_until)>now()?'injured':record(g).status==='available'?'available':record(g).status);
  const eligible=g=>{const r=record(g);return phase(g)==='available'&&r.status==='available'&&!r.clan_roster_id&&!r.trained_today&&!r.exercise_completed&&energy(r,now())>0&&Number(r.base_stats?.[stat]??50)<100;};
  function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,fn,disabled=false,cls=''){const n=node('button',cls,text);n.type='button';n.disabled=disabled;n.onclick=fn;return n;}
  function meter(label,value,kind,sub){const wrap=node('div','exercise-meter '+kind),head=node('div','exercise-meter-heading');head.append(node('span','',label),node('strong','',format(value)+'%'));const track=node('div','exercise-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(value));const fill=node('div','exercise-fill');fill.style.width=value+'%';track.append(fill);wrap.append(head,track,node('small','',sub));return wrap;}
  function render(){
   if(!selected||panel.hidden)return;
   const g=selected,r=record(g),p=phase(g),stats=r.stat_version===46?r.base_stats:profile(g.type||r.class),e=energy(r,now()),units=Number(r.exercise_units||0);
   const shell=node('div','exercise-panel');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Gladyatör gelişimi');
   const header=node('header','exercise-header'),photo=node('img','exercise-portrait');photo.src='imperial-portrait-'+(g.type||r.class)+'-v31.webp';photo.alt=g.name||r.name;
   const identity=node('div','exercise-identity'),title=node('h2','',g.name||r.name);title.id='ordersTitle';identity.append(title,node('span','exercise-class',options.className?.(g)||g.type||r.class));
   const overall=node('div','exercise-overall');overall.append(node('small','','OVERALL'),node('strong','',format(r.overall??mean(stats))));
   header.append(photo,identity,overall);shell.append(header);
   const state=node('p','exercise-status');state.id='ordersText';state.setAttribute('role','status');
   const labels={available:'Hazır',training:'Antrenmanda',resting:'Dinleniyor',injured:'Sakat · İyileşiyor',mission:'İmparator görevinde',clanlocked:'Klan kadrosunda'};
   state.textContent=message||(labels[p]||'Kullanımda')+(options.time?.(g)?' · '+options.time(g):'');shell.append(state);
   const bars=node('div','exercise-bars');bars.append(meter('Günlük Egzersiz Barı',units/3*100,'daily',r.exercise_completed?'Bugünkü gelişim tamamlandı':'3 maç / 1 antrenman / 1 kolay görev'));
   bars.append(meter('Yorgunluk Barı',e,'energy'+(e<30?' danger':''),'Kalan enerji · Dinlenme: +10/saat'+(e<30?' · Kullanımda %25 sakatlık riski':'')));shell.append(bars);
   const list=node('div','exercise-attributes');list.setAttribute('aria-label','Gladyatör istatistikleri');
   for(const [key,label]of attributes){const b=button('',()=>{stat=key;message='';render();},busy,'exercise-attribute'+(stat===key?' selected':''));b.setAttribute('aria-pressed',String(stat===key));b.append(node('span','',label),node('strong','',format(stats[key])));list.append(b);}shell.append(list);
   const actions=node('div','exercise-actions');actions.id='orderButtons';
   actions.append(button(busy?'Kaydediliyor…':attributes.find(a=>a[0]===stat)[1]+' çalış',()=>send([record(g).id]),busy||!options.loaded()||!eligible(g),'exercise-primary'));
   actions.append(button(bulk?'Tek gladyatöre dön':'Toplu antrenman',()=>{bulk=!bulk;selectedIDs=new Set(roster().filter(eligible).map(g=>record(g).id));message='';render();},busy||!options.loaded()));shell.append(actions);
   if(bulk){const group=node('div','exercise-bulk');for(const fighter of roster()){const row=node('label','exercise-bulk-row'),checkbox=node('input');checkbox.type='checkbox';checkbox.value=record(fighter).id;checkbox.disabled=busy||!eligible(fighter);checkbox.checked=eligible(fighter)&&selectedIDs.has(checkbox.value);checkbox.onchange=()=>{checkbox.checked?selectedIDs.add(checkbox.value):selectedIDs.delete(checkbox.value);render();};row.append(checkbox,node('span','',fighter.name||record(fighter).name),node('small','',eligible(fighter)?format(record(fighter).overall)+' Overall':'Uygun değil'));group.append(row);}group.append(button('Seçilenleri çalıştır · '+selectedIDs.size,()=>send([...selectedIDs]),busy||!selectedIDs.size,'exercise-primary'));shell.append(group);}
   const note=node('p','exercise-note','1 saat antrenman + 1 saat dinlenme. Sakatlık: −5 Overall, 12 saat iyileşme.');shell.append(note);
   const footer=node('footer','exercise-footer');footer.append(button('Yenile',async()=>{message='';await options.refresh();render();},busy),button('Kapat',close));shell.append(footer);panel.replaceChildren(shell);
  }
  async function send(ids){
   if(busy)return;busy=true;message='';render();
   const key='ludus-exercise-v46-'+stat+'-'+[...ids].sort().join(',');let request;
   try{request=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,request);}catch(_){request=crypto.randomUUID();}
   try{const result=await options.client.rpc('ludus_train_exercise',{p_gladiators:ids,p_stat:stat,p_request:request});if(result.error)throw result.error;try{localStorage.removeItem(key);}catch(_){}options.apply(result.data);bulk=false;message=ids.length+' gladyatör antrenmana başladı.';}
   catch(error){if(error.code==='P0001')try{localStorage.removeItem(key);}catch(_){}message='Antrenman başlatılamadı: '+error.message;}
   finally{busy=false;render();}
  }
  function open(g){selected=g;bulk=false;message='';options.onOpen?.();panel.hidden=false;render();if(!options.loaded())options.refresh().then(render);}
  function close(){panel.hidden=true;selected=null;options.onClose?.();}
  function tick(){
   if(!selected||panel.hidden||busy)return;
   const value=energy(record(selected),now()),wrap=panel.querySelector('.exercise-meter.energy');
   if(!wrap)return;wrap.classList.toggle('danger',value<30);wrap.querySelector('strong').textContent=format(value)+'%';wrap.querySelector('.exercise-fill').style.width=value+'%';wrap.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(value));
   wrap.querySelector('small').textContent='Kalan enerji · Dinlenme: +10/saat'+(value<30?' · Kullanımda %25 sakatlık riski':'');
  }
  panel.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  return {open,close,render,tick,get selected(){return selected;}};
 }
 root.LudusExercise={attributes,profiles,profile,mean,energy,combatStats,format,create};
 if(typeof module!=='undefined')module.exports=root.LudusExercise;
})(typeof window!=='undefined'?window:globalThis);
