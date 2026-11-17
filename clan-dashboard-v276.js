(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>Number(n||0).toLocaleString('tr-TR');
 const paths={home:'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',caravans:'M3 6h13v10H3zM16 10h3l3 6h-6M3 16H1M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4',roster:'m4 3 14 14M3 3l1 5 4-4-5-1m10 14 4-4m-1 5 3 3M20 3 6 17m15-14-1 5-4-4 5-1M7 13l4 4m-5 1-3 3',members:'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a5 5 0 0 1 5-4h4a5 5 0 0 1 5 4v3M17 5a4 4 0 0 1 0 7m2 3a5 5 0 0 1 3 4v2',vault:'M3 8h18v13H3zM3 8l3-5h12l3 5M3 13h18M10 11h4v5h-4z',power:'M12 3 3 6v6c0 5 9 10 9 10s9-5 9-10V6zM8 12l3 3 5-6',progress:'M3 20h18M5 16v-4h3v4m3 0V8h3v8m3 0V3h3v13',trophies:'M8 3h8v7a4 4 0 0 1-8 0zM8 5H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5M12 14v5m-5 2h10',manage:'M4 8h16l-2 12H6zM4 8 2 3l6 4 4-5 4 5 6-4-2 5',bots:'M7 8h10v12H7zM10 8V4h4v4M4 11v6m16-6v6M10 12h0m4 0h0M10 16h4',arrow:'M4 12h16m-6-6 6 6-6 6'};
 function icon(id){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[id]||paths.home)+'"/></svg>';}
 function summarize(state,work,owner){
  const c=state.clan,r=state.roster,entries=r?.entries||[],notes=[];
  const active=work?.status==='loaded'&&work.data?.clan_id===c.id&&Array.isArray(work.data.jobs)?work.data.jobs.filter(j=>j.status==='collecting').length:null;
  const applications=state.leader?(state.applications||[]).filter(q=>q.kind==='application').length:0;
  if(r?.invited&&!entries.some(e=>e.user_id===owner))notes.push({title:'Savaş kadrosuna davet edildin',detail:'Gladyatörünü seçerek birliğe katıl.',view:'roster'});
  if(applications)notes.push({title:num(applications)+' üyelik başvurusu bekliyor',detail:'Başvuruları klan yönetiminden değerlendir.',view:'manage'});
  if(c.level<20){const ready=c.experience>=c.exp_cost&&c.gold>=c.coin_cost;notes.push({title:ready?'Klan seviyesi yükseltilebilir':'Sonraki hedef: Seviye '+(c.level+1),detail:ready?'Gerekli EXP ve ortak denarius hazır.':num(c.exp_cost)+' EXP · '+num(c.coin_cost)+' ortak denarius',view:'progress'});}
  if(!notes.length)notes.push({title:'Bekleyen işlem bulunmuyor',detail:'Birliğinin gücünü ve savaş hazırlığını incele.',view:'power'});
  return {active,online:(state.members||[]).filter(m=>m.online).length,rosterCount:entries.length,rosterState:r?(r.state==='locked'?'Kadro kilitli':'Hazırlık sürüyor'):'Henüz kadro kurulmadı',notes:notes.slice(0,work?.status==='error'?2:3)};
 }
 // Coordinates and resource identities match the existing Roma supply map.
 const locations=[
  ['wood','Odun sahası',10,13],['meat','Av sahası',30,13],['lead_ore','Kurşun ocağı',52,13],['tin_ore','Kalay ocağı',73,13],['copper_ore','Bakır ocağı',91,13],
  ['flax','Keten tarlası',10,39],['hide','Deri sahası',33,39],['wool','Yün çiftliği',65,39],['grain','Tahıl tarlası',90,39],
  ['resin','Reçine ormanı',10,63],['fish','Balıkçılık',30,64],['olive_oil','Zeytinlik',61,65],['iron_ore','Demir ocağı',90,64],
  ['beer','Üzüm bağı',10,88],['egg','Yumurta çiftliği',48,88],['apple','Elma bahçesi',82,88]
 ].map(([sku,name,x,y])=>Object.freeze({sku,name,x,y}));
 function workCounts(state,work){
  if(work?.status!=='loaded'||work.data?.clan_id!==state.clan?.id||!Array.isArray(work.data.jobs))return null;
  const counts=Object.fromEntries(locations.map(l=>[l.sku,0]));
  for(const job of work.data.jobs)if(job.status==='collecting'&&Object.hasOwn(counts,job.sku))counts[job.sku]++;
  return counts;
 }
 function progress(clan){
  const level=Math.max(1,Number(clan.level)||1),experience=Math.max(0,Number(clan.experience)||0),target=Math.max(0,Number(clan.exp_cost)||0),max=level>=20;
  return {level,experience,target,max,percent:max?100:target?Math.min(100,experience/target*100):0};
 }
 // The current clan RPC has no war schedule. Optional future server data must
 // identify this clan and a real start instant; never synthesize a war time.
 function nextWar(state,now=Date.now()){
  const w=state.next_war,valid=w&&w.clan_id===state.clan?.id&&['scheduled','active'].includes(w.status),size=valid&&Number.isInteger(w.team_size)&&w.team_size>0&&w.team_size<=20?w.team_size:10;
  const start=valid&&typeof w.starts_at==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(w.starts_at)?Date.parse(w.starts_at):NaN;
  if(!valid||!Number.isFinite(start))return {format:'10vs10',countdown:'— : — : —',label:'Savaş saati bekleniyor',scheduled:false};
  if(w.status==='active')return {format:size+'vs'+size,countdown:'Savaş sürüyor',label:'Sıradaki klan savaşı',scheduled:true};
  const seconds=Math.max(0,Math.ceil((start-now)/1000)),days=Math.floor(seconds/86400),clock=[Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
  return {format:size+'vs'+size,countdown:seconds?(days?days+'g ':'')+clock:'00:00:00',label:seconds?'Savaşın başlamasına':'Başlangıç saati geldi',scheduled:true};
 }
 // Two chronologically ordered scheduled wars. Missing server data stays empty.
 function upcomingWars(state,now=Date.now()){
  const source=Array.isArray(state.upcoming_wars)?state.upcoming_wars:[state.next_war],seen=new Set();
  const wars=source.filter(w=>w?.status==='scheduled'&&nextWar({...state,next_war:w},now).scheduled).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)).filter(w=>{const key=typeof w.id==='string'&&w.id?w.id:w.starts_at;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,2);
  return [0,1].map(i=>{const w=wars[i],info=nextWar({...state,next_war:w},now);return {...info,key:w?(typeof w.id==='string'&&w.id?w.id:w.starts_at):'pending-'+(i+1),position:i+1,rosterId:typeof w?.roster_id==='string'?w.roster_id:null};});
 }
 function rosterForWar(state,key){
  const war=upcomingWars(state).find(w=>w.key===key);if(!war)return null;
  const candidates=[...(state.roster?[state.roster]:[]),...(Array.isArray(state.rosters)?state.rosters.filter(r=>r.clan_id===state.clan?.id):[])];
  const roster=war.scheduled&&war.rosterId?candidates.find(r=>r.id===war.rosterId&&(!r.clan_id||r.clan_id===state.clan?.id)&&['draft','locked'].includes(r.state)):null;
  return {war,roster:roster||null};
 }
 function warCards(state){return '<div class="clan-war-pair-v280" aria-label="Önümüzdeki iki klan savaşı">'+upcomingWars(state).map(w=>'<section class="clan-war-v277" data-war-key="'+esc(w.key)+'"><div class="clan-war-heading"><h2>'+w.position+'. Klan Savaşı</h2></div><div class="clan-war-details-v281"><strong class="clan-war-format">'+w.format+'</strong><span class="clan-war-label" data-war-label>'+w.label+'</span><time class="clan-war-countdown" data-war-countdown'+(w.countdown.length>8?' data-long':'')+'>'+w.countdown+'</time></div><button class="clan-war-enter" data-action="war_roster" data-war-key="'+esc(w.key)+'" aria-label="'+w.position+'. klan savaşının kadrosuna gir">Savaş kadrosuna gir</button></section>').join('')+'</div>';}
 function map(state,work){
  const counts=workCounts(state,work),active=counts?Object.values(counts).reduce((n,v)=>n+v,0):null;
  const nodes=locations.map(l=>{const count=counts?.[l.sku],photo=(['wood','grain','apple','fish','meat','egg','beer','olive_oil'].includes(l.sku)?'assets/resource-icons-v95/':'assets/items-v118/')+l.sku+'.webp';return '<button class="clan-map-node'+(count?' has-teams':'')+'" data-action="site" data-sku="'+l.sku+'" style="left:'+l.x+'%;top:'+l.y+'%" aria-label="'+esc(l.name)+(count==null?' · Ekip bilgisi yüklenmedi':' · '+num(count)+' çalışan ekip')+'"><span class="clan-map-resource"><img src="'+photo+'" alt="" draggable="false">'+(count?'<b>'+num(count)+'</b>':'')+'</span><span class="clan-map-label">'+esc(l.name)+'</span></button>';}).join('');
  return '<section class="clan-map-v277"><div class="clan-map-heading"><div><h2>Çalışan ekipler</h2><span>Roma · Madenler ve bahçeler</span></div><button class="clan-map-all" data-action="view" data-view="caravans">Tüm kervanlar '+icon('arrow')+'</button></div><div class="clan-map-stage"><div class="clan-map-canvas"><img class="clan-map-background" src="assets/supply-v91/rome-panorama.webp" alt="Roma ve çevresindeki maden, tarla ve bahçeler" draggable="false">'+nodes+'</div></div><div class="clan-map-legend"><span><i></i> Rakamlar bölgedeki ekip sayısıdır.</span><strong id="clanActiveCaravans" aria-live="polite">'+(active==null?'Ekip bilgisi bekleniyor':num(active)+' ekip çalışıyor')+'</strong></div></section>';
 }
 function render(state,work,owner,banner){
  const c=state.clan,m=summarize(state,work,owner),p=progress(c);
  return '<section class="clan-identity-v276"><div class="clan-identity-art">'+banner+'</div><div class="clan-identity-copy"><span class="clan-eyebrow">KLAN SEVİYESİ</span><strong>Seviye '+num(p.level)+'</strong><div class="clan-exp-copy"><span>'+num(p.experience)+' EXP</span><span>'+(p.max?'En yüksek seviye':'/ '+num(p.target))+'</span></div><div class="clan-exp-track" role="progressbar" aria-label="Klan deneyimi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(p.percent)+'" aria-valuetext="'+(p.max?'En yüksek seviye':num(p.experience)+' / '+num(p.target)+' EXP')+'"><i style="width:'+p.percent+'%"></i></div><button class="clan-progress-link" data-action="view" data-view="progress">Seviye ayrıntıları '+icon('arrow')+'</button><div class="clan-member-summary"><span><b>'+num(c.member_count)+'</b> / '+num(c.capacity)+' üye</span><span class="clan-online"><i></i>'+num(m.online)+' çevrimiçi</span></div><button class="clan-link" data-action="view" data-view="members">Üyeleri gör '+icon('arrow')+'</button></div></section>'+map(state,work)+
   '<aside class="clan-command-rail">'+warCards(state)+
   '<section class="clan-briefing-v276"><div class="clan-briefing-main"><h2>Önemli bilgiler</h2><div class="clan-notices">'+m.notes.map(n=>'<button class="clan-notice" data-action="view" data-view="'+n.view+'"><span><strong>'+esc(n.title)+'</strong><small>'+esc(n.detail)+'</small></span>'+icon('arrow')+'</button>').join('')+(work?.status==='error'?'<button class="clan-notice clan-work-error" data-action="retry_caravans"><span><strong>Ekip bilgisi alınamadı</strong><small>Yeniden dene</small></span>'+icon('arrow')+'</button>':'')+'</div></div><button class="clan-treasury-summary" data-action="view" data-view="vault">'+icon('vault')+'<span>ORTAK KASA</span><strong>'+num(c.gold)+'</strong><small>Denarius</small>'+icon('arrow')+'</button></section></aside>';
 }
 function tick(host,state,now=Date.now()){
  if(!host)return;const wars=upcomingWars(state,now);
  for(const card of host.querySelectorAll('.clan-war-v277[data-war-key]')){
   const war=wars.find(w=>w.key===card.dataset.warKey);if(!war)continue;
   const clock=card.querySelector('[data-war-countdown]'),label=card.querySelector('[data-war-label]');
   if(clock){clock.textContent=war.countdown;clock.toggleAttribute?.('data-long',war.countdown.length>8);}if(label)label.textContent=war.label;
  }
 }
 const api={icon,summarize,render,workCounts,locations,progress,nextWar,upcomingWars,rosterForWar,tick};root.LudusClanDashboardV276=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
