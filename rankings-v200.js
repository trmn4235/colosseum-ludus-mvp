/* Public game achievements only. Ordering, paging and score calculation are server-owned. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const fmt=v=>v==null?'—':Number(v).toLocaleString('tr-TR',{maximumFractionDigits:2});
 const percent=v=>v==null?'—':'%'+fmt(v),ratio=(k,d)=>k==null||d==null?'—':d===0?(k>0?'∞':'0'):fmt(k/d);
 function ratios(m){const partial=m.kills==null||m.deaths==null,partialA=partial||m.assists==null;
  return {kd:ratio(partial?m.kd_kills:m.kills,partial?m.kd_deaths:m.deaths),kda:ratio(partialA?(m.kda_kills==null?null:m.kda_kills+m.kda_assists):m.kills+m.assists,partialA?m.kda_deaths:m.deaths),partial,partialA};}
 const paths={gladiator:'M6 20V10a6 6 0 0 1 12 0v10M4 10h16M9 13v7m6-7v7M10 4V1h4v3',equipment:'m12 2 8 4v6c0 6-8 10-8 10S4 18 4 12V6Z M8 9l8 8m0-8-8 8',multiplayer:'m4 3 15 15m-4 2 5-5M20 3 5 18m4 2-5-5',naval:'M3 15h18l-4 5H7Zm9-13v13m1-11 6 8h-6M3 23q3-2 6 0t6 0t6 0',circus:'M4 15h14l3-8H8l-2-4H3m5 4v8M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4m11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4',caravan:'M3 7h17v10H3zM6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 0 4m11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4M7 7V4h9v3',clans:'M4 21V3h16l-4 5 4 5H4',fighters:'M7 21V11a5 5 0 0 1 10 0v10M5 11h14M10 15v6m4-6v6'};
 const categories=[['gladiator','Gladyatör','Gladyatör gücü'],['equipment','Ekipman','Donanım gücü'],['multiplayer','Çok oyunculu','Çok oyunculu arena'],['naval','Deniz','Deniz savaşları'],['circus','Circus Maximus','Circus Maximus'],['caravan','Kervan','Kervan savaşları']];
 const guildCategories=[['clans','Hanedan sıralaması','Hanedan savaşları'],['fighters','Savaş gladyatörleri','Savaş gladyatörleri']];
 const groups={equipment:[['all','Genel'],['attack','Atak'],['defense','Defans'],['mobility','Hız']],caravan:[['all','Tümü'],['raid','Baskın'],['defense','Savunma']]};
 const classes=new Set(['murmillo','thraex','hoplomachus','hoplo','secutor','retiarius','provocator','scissor']);
 const s={scope:'players',category:'gladiator',guild:'clans',group:'all',sort:'score',clan:'',query:'',page:0,size:6};
 let client,user=null,data=null,seq=0,controller=null,searchTimer,resizeTimer,ready=false,helpPage=0,focusReturn=null;
 const category=()=>s.scope==='guilds'?'guild':s.category;
 const combat=()=>s.scope==='guilds'?s.guild==='fighters':['multiplayer','naval','caravan'].includes(s.category);
 const icon=key=>{const e=el('span');e.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';return e.firstElementChild;};
 function crest(row,cls='rank-avatar'){const e=el('span',cls);e.innerHTML=LudusClanEmblems.symbol(row.emblem||1,row.emblem_color,row.background);return e;}
 function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function title(){return(s.scope==='guilds'?guildCategories:categories).find(r=>r[0]===(s.scope==='guilds'?s.guild:s.category))?.[2]||'';}
 function scoreLabel(){return ['gladiator','equipment'].includes(category())?'Güç':s.sort==='wins'||['circus','caravan'].includes(category())?'Zafer':'Puan';}
 function score(row){return ['gladiator','equipment'].includes(category())?percent(row.score):fmt(row.score);}
 function controls(){
  for(const b of document.querySelectorAll('[data-scope]'))b.setAttribute('aria-pressed',String(s.scope===b.dataset.scope));
  const nav=$('rankCategories');nav.replaceChildren();nav.classList.toggle('guild',s.scope==='guilds');
  for(const [id,label]of(s.scope==='guilds'?guildCategories:categories)){
   const b=button('',()=>{if(s.scope==='guilds')s.guild=id;else s.category=id;s.group='all';s.sort=['circus','caravan'].includes(category())?'wins':'score';s.page=0;controls();load();});
   b.dataset.category=id;b.setAttribute('aria-pressed',String(id===(s.scope==='guilds'?s.guild:s.category)));b.append(icon(id),el('span','',label));nav.append(b);
  }
  $('rankTitle').textContent=title();$('rankSearch').placeholder=s.scope==='players'?'Oyuncu ara…':s.guild==='clans'?'Hanedan ara…':'Gladyatör veya sahibi…';
  $('rankGroups').replaceChildren();for(const [id,label]of(s.scope==='players'?groups[s.category]||[]:[])){
   const b=button(label,()=>{s.group=id;s.page=0;controls();load();});b.dataset.group=id;b.setAttribute('aria-pressed',String(s.group===id));$('rankGroups').append(b);
  }
  const forced=['gladiator','equipment','circus','caravan'].includes(category());$('rankSort').disabled=forced;
  $('rankSort').options[0].textContent=['gladiator','equipment'].includes(category())?'Güce göre':'Puana göre';$('rankSort').value=s.sort;
  $('rankClan').disabled=s.scope==='guilds'&&s.guild==='clans';
  $('rankTable').dataset.metrics=combat()?'combat':s.scope==='guilds'&&s.guild==='clans'?'clan':'power';
  const heads=s.scope==='guilds'&&s.guild==='clans'?['Sıra','Hanedan',scoreLabel(),'Zafer','Mağlubiyet']:['Sıra',s.scope==='guilds'?'Gladyatör / Sahibi':'Oyuncu / Ludus','Hanedan',scoreLabel(),...(combat()?['K/D','K/D/A','Maç']:[])];
  $('rankHead').replaceChildren(...heads.map(t=>el('span','',t)));
 }
 function state(heading,message,action){
  $('rankState').hidden=false;$('rankRows').replaceChildren();$('rankState').replaceChildren(crest({emblem:2},'rank-state-crest'),el('strong','',heading),el('p','',message));
  if(action)$('rankState').append(action);
 }
 function pageSize(){const h=$('rankRows').getBoundingClientRect().height;return Math.max(1,Math.min(12,Math.floor(h/(innerHeight<400?36:innerHeight<600?40:54))));}
 function house(row){const e=el('div','rank-house');if(row.clan){e.append(crest(row,''),el('span','',row.clan));e.title=row.clan;}else e.append(el('span','','Hanedansız'));return e;}
 function identity(row){
  const e=el('div','rank-identity');let portrait;
  if(s.scope==='guilds'&&s.guild==='clans')portrait=crest(row);
  else{portrait=el('span','rank-avatar');if(row.class&&classes.has(row.class)){const img=el('img');img.src='imperial-portrait-'+row.class+'-v31.webp';img.alt='';img.loading='lazy';img.onerror=()=>portrait.replaceChildren(document.createTextNode((row.name||'?').slice(0,1)));portrait.append(img);}else portrait.textContent=(row.name||'?').slice(0,1).toLocaleUpperCase('tr-TR');}
  const text=el('div');text.append(el('strong','',row.name),el('small','',s.scope==='guilds'&&s.guild==='clans'?'Birlik · Onur · Zafer':row.subtitle));e.append(portrait,text);return e;
 }
 function metric(row){const e=el('div','rank-metric');e.append(el('strong','',score(row)));if(['gladiator','equipment'].includes(category())){const bar=el('span','rank-power-bar'),fill=el('i');fill.style.width=Math.min(100,Math.max(0,Number(row.score)||0))+'%';bar.append(fill);e.append(bar);}return e;}
 function rowView(row){
  const b=button('',()=>detail(row),'rank-row'+(row.rank<=3?' podium':'')+(row.mine?' is-mine':''));b.dataset.id=row.id;b.setAttribute('aria-label',`${row.rank==null?'Sırası yok':row.rank+'. sıra'}, ${row.name}, ${row.clan||'Hanedansız'}, ${scoreLabel()} ${score(row)}`);
  b.append(el('span','rank-place',row.rank==null?'—':fmt(row.rank)),identity(row));
  const m=row.metrics||{};
  if(s.scope==='guilds'&&s.guild==='clans'){b.append(metric(row),el('span','rank-ratio',fmt(m.wins??0)),el('span','rank-ratio',fmt(m.losses??0)));return b;}
  b.append(house(row),metric(row));
  if(combat()){
   const v=ratios(m),kd=el('span','rank-ratio',v.kd+(v.partial&&v.kd!=='—'?'*':'')),kda=el('span','rank-ratio',v.kda+(v.partialA&&v.kda!=='—'?'*':''));
   kd.title='Öldürme / Ölüm'+(v.partial?' · Yalnız kayıtlı istatistikler':'');kda.title='(Öldürme + Asist) / Ölüm'+(v.partialA?' · Yalnız kayıtlı istatistikler':'');b.append(kd,kda,el('span','rank-matches',fmt(m.matches??0)));
  }return b;
 }
 function render(){
  $('rankTable').setAttribute('aria-busy','false');$('rankRefresh').disabled=false;$('rankCount').textContent=data.total+' '+(s.scope==='players'?'oyuncu':s.guild==='clans'?'hanedan':'gladyatör');
  $('rankState').hidden=true;$('rankRows').replaceChildren(...data.rows.map(rowView));$('rankRows').style.setProperty('--rows',s.size);
  if(!data.rows.length)state('Kayıt bulunamadı',s.query?'Bu isimle eşleşen kayıt yok. Aramayı değiştirebilirsin.':s.scope==='guilds'&&s.guild==='fighters'?'Hanedan savaşlarına katılan gladyatörler, ilk sonuç kaydedildiğinde burada sıralanacak.':'Seçtiğin filtrede henüz bir kayıt bulunmuyor.');
  const notices=category()==='guild'?(!data.guild_matches?'Hanedan savaşları henüz açılmadı.':'Savaş sonucu ve rakip gücüne göre'):category()==='caravan'&&s.group==='defense'&&!data.defense_matches?'Henüz kaydedilmiş savunma savaşı yok.':category()==='equipment'?'Takılı ekipman · Kadro ortalaması':category()==='gladiator'?'Mevcut gladyatör puanlarının ortalaması':category()==='multiplayer'?'1500 başlangıç · Zafer +20 / Yenilgi −5':category()==='naval'?'Her zafer 10 puan':category()==='circus'?'Katıldığın yarışlardaki zaferler':'Baskın ve savunma sonuçları';
  $('rankNotice').textContent=notices;$('rankNotice').title=notices;
  $('rankPage').textContent=(data.page+1)+' / '+Math.max(1,Math.ceil(data.total/s.size));$('rankPrev').disabled=data.page===0;$('rankNext').disabled=(data.page+1)*s.size>=data.total;s.page=data.page;
  const own=$('rankOwn');own.replaceChildren();own.disabled=!data.own;
  if(data.own){own.append(el('strong','','#'+(data.own.rank??'—')),el('span','',(s.scope==='guilds'&&s.guild==='clans'?'Hanedanın':s.scope==='guilds'?'Gladyatörün':'Sen')+' · '+data.own.name),el('strong','',score(data.own)));own.onclick=()=>detail(data.own);}
  else own.textContent=s.scope==='guilds'?'Bu görünümde henüz sıran yok.':'Bu hanedan filtresinde yer almıyorsun.';
  const selected=s.clan,select=$('rankClan');select.replaceChildren(new Option('Tüm hanedanlar',''));
  if(data.my_clan){const mine=data.clans.find(c=>c.id===data.my_clan);if(mine)select.append(new Option('Hanedanım · '+mine.name,mine.id));}
  for(const c of data.clans)if(c.id!==data.my_clan)select.append(new Option(c.name,c.id));select.value=selected;
  $('rankUpdated').textContent='Güncel güç · Tüm zamanların başarıları';
 }
 async function load(){
  if(!user)return;clearTimeout(searchTimer);controller?.abort();controller=new AbortController();const current=++seq,who=user;
  s.size=pageSize();$('rankRows').style.setProperty('--rows',s.size);$('rankTable').setAttribute('aria-busy','true');$('rankRefresh').disabled=true;
  $('rankPrev').disabled=$('rankNext').disabled=$('rankOwn').disabled=true;state('Kayıtlar getiriliyor…','');$('rankNotice').textContent='';$('rankCount').textContent='';
  const activeController=controller,timer=setTimeout(()=>activeController.abort(),12000);
  try{
   let request=client.rpc('ludus_rankings_v200',{p_scope:s.scope==='players'?'players':s.guild,p_category:category(),p_group:s.group,p_sort:s.sort,p_clan:s.scope==='guilds'&&s.guild==='clans'?null:s.clan||null,p_query:s.query,p_page:s.page,p_page_size:s.size,p_target:null});
   if(request.abortSignal)request=request.abortSignal(activeController.signal);
   const result=await request;if(current!==seq||who!==user)return;
   if(result.error)throw result.error;
   if(result.data?.version!==200||!Array.isArray(result.data.rows))throw Error('invalid response');data=result.data;render();
  }catch(e){if(current!==seq||who!==user)return;data=null;$('rankTable').setAttribute('aria-busy','false');$('rankRefresh').disabled=false;$('rankOwn').textContent='Sıran yüklenemedi.';
   state('Sıralama yüklenemedi','Bağlantını kontrol edip tekrar deneyebilirsin.',button('Tekrar dene',load));
  }finally{clearTimeout(timer);}
 }
 function card(label,value,note){const c=el('div','rank-detail-card');c.append(el('small','',label),el('strong','',value));if(note)c.append(el('p','',note));return c;}
 function dialogHead(dialog,title,subtitle,id){const h=el('header','rank-dialog-head'),text=el('div'),t=el('h2','',title);t.id=id;text.append(t,el('p','',subtitle));h.append(text,button('×',()=>dialog.close(),'icon-button'));h.lastChild.setAttribute('aria-label','Kapat');return h;}
 function detail(row){
  const dialog=$('rankDetail');focusReturn=document.activeElement;dialog.replaceChildren(dialogHead(dialog,row.name,(row.subtitle||'')+(row.clan?' · '+row.clan:''),'rankDetailTitle'));const grid=el('div','rank-detail-grid'),st=row.stats||{},m=row.metrics||{};
  if(s.scope==='players'){
   grid.append(card('GLADYATÖR',percent(st.gladiator),(st.roster_count??0)+' gladyatörün ortalaması'),card('GENEL DONANIM',percent(st.equipment),'Atak '+percent(st.attack)+' · Defans '+percent(st.defense)+' · Hız '+percent(st.mobility)),
    card('ÇOK OYUNCULU',fmt(1500+(st.multiplayer?.points||0)),fmt(st.multiplayer?.wins||0)+' zafer · '+fmt(st.multiplayer?.matches||0)+' maç'),
    card('DENİZ SAVAŞLARI',fmt(st.naval?.points||0)+' puan',fmt(st.naval?.wins||0)+' zafer'),card('CIRCUS MAXIMUS',fmt(st.circus?.wins||0)+' zafer',fmt(st.circus?.matches||0)+' yarış'),
    card('KERVAN SAVAŞLARI',fmt(st.caravan?.wins||0)+' zafer','Baskın '+fmt(st.caravan_raid?.wins||0)+' · Savunma '+fmt(st.caravan_defense?.wins||0)));
  }else{const v=ratios(m);grid.append(card('SAVAŞ PUANI',fmt(m.points)),card('ZAFER',fmt(m.wins||0)),card('MAĞLUBİYET',fmt(m.losses||0)),card('SAVAŞ',fmt(m.matches||0)),card('K/D',v.kd),card('K/D/A',v.kda));}
  dialog.append(grid);const foot=el('div','rank-dialog-foot'),notes=el('span');
  notes.textContent=combat()?`Seçili alan · K/D/A: ${fmt(m.kills)} / ${fmt(m.deaths)} / ${fmt(m.assists)}. “—” eksik kayıt; ∞ sıfır ölüm.${m.tracked!=null&&m.tracked<m.participants?' * K/D/A: '+m.tracked+'/'+m.participants+' katılımcı kaydından.':''}`:'Güç yüzdeleri güncel kadroyu, zaferler tüm zamanları gösterir.';foot.append(notes);
  if(row.clan_id)foot.append(button('Hanedanı incele',()=>{dialog.close();s.scope='guilds';s.guild='fighters';s.clan=row.clan_id;s.query='';s.page=0;s.group='all';s.sort='score';$('rankSearch').value='';controls();load();}));
  dialog.append(foot);dialog.showModal();dialog.querySelector('button').focus();
 }
 const help=[
  ['Güç ve donanım','Gladyatör puanı, sahip olduğun gladyatörlerin mevcut puanlarının ortalamasıdır. Donanım, bu kadroya takılı altı ekipman yuvasından hesaplanır. Boş yuva sıfır sayılır.','Her eşyada altı temel özelliğin + seviyesi ve Safir uygulanmış değeri, dört Zümrüt yüzdesiyle birlikte hesaba girer. Atak: iki el; Defans: miğfer ve göğüs; Hız: kolluk ve bacaklık.','Sabit %100 referansı: +15, %100 Safirler ve dört %100 Zümrüt. +15 üzeri geliştirme puanı artırmaya devam eder. Üç grubun ortalaması genel donanım puanıdır.'],
  ['Zafer ve savaş puanı','Çok oyunculu arena 1500 puanla başlar. Kaydedilmiş çevrimiçi arena zaferi +20, mağlubiyet −5 puan verir. Küçük arena bu puana dahil değildir. Deniz savaşında her zafer 10 puandır.','Circus Maximus yalnız katıldığın yarışlardaki zaferleri sayar. Kervanda baskın ve savunma ayrı incelenebilir. Aynı savaşa beş gladyatörle girsen de zafer bir kez sayılır.','Hanedan savaşlarında puan, sonuç ve rakip hanedanın gücüne göre değişir. Sadece katılan gladyatörler puan alır. Hanedan savaşı ve kervan savunması için ilk doğrulanmış sonuç beklendiğinde panel bunu belirtir.'],
  ['K/D, K/D/A ve arama','K/D = öldürme / ölüm. K/D/A = (öldürme + asist) / ölüm. Bu oranlar sıralamayı veya eşit puandaki dereceyi etkilemez. Asgari maç şartı yoktur.','Asist, rakibin canının en az %10’una katkı yapan diğer savaşçıya yazılır; takım savaşında son vuruşu yapanın takımında olmalıdır. Sıfır ölümle katkı varsa ∞ görünür. Eksik kayıt “—”, yalnız kayıtlı bölümden hesaplanan oran “*” ile belirtilir.','İsim araması seçili sıralamadaki gerçek dereceyi korur. Eşit puanlar aynı dereceyi paylaşır. Oyuncuya dokunarak diğer alanlardaki değerlerine ve kayıt kapsamına bakabilirsin.']
 ];
 function helpRender(){const d=$('rankHelp'),text=help[helpPage];d.replaceChildren(dialogHead(d,text[0],'SIRALAMA REHBERİ','rankHelpTitle'));const copy=el('div','rank-help-copy');text.slice(1).forEach(t=>copy.append(el('p','',t)));d.append(copy);const footer=el('div','rank-dialog-foot');footer.append(button('‹ Önceki',()=>{helpPage=Math.max(0,helpPage-1);helpRender();}),el('span','',(helpPage+1)+' / '+help.length),button('Sonraki ›',()=>{helpPage=Math.min(help.length-1,helpPage+1);helpRender();}));footer.firstChild.disabled=helpPage===0;footer.lastChild.disabled=helpPage===help.length-1;d.append(footer);}
 function signIn(){user=null;data=null;++seq;controller?.abort();$('rankOwn').disabled=true;$('rankOwn').textContent='Sıranı görmek için giriş yap.';$('rankTable').setAttribute('aria-busy','false');$('rankRefresh').disabled=true;$('rankCount').textContent='';$('rankNotice').textContent='';$('rankPage').textContent='1 / 1';$('rankPrev').disabled=$('rankNext').disabled=true;for(const d of document.querySelectorAll('dialog'))d.close();const a=el('a','','Hesabıma git');a.href='index.html?v=revision200';state('İmparatorluk seni bekliyor','Oyuncuları ve hanedanları karşılaştırmak için hesabına giriş yap.',a);}
 function wire(){
  for(const b of document.querySelectorAll('[data-scope]'))b.onclick=()=>{s.scope=b.dataset.scope;s.page=0;s.group='all';s.sort=['circus','caravan'].includes(category())?'wins':'score';s.query='';s.clan='';$('rankSearch').value='';controls();load();};
  $('rankSearch').oninput=()=>{s.query=$('rankSearch').value;s.page=0;clearTimeout(searchTimer);searchTimer=setTimeout(load,260);};
  $('rankClan').onchange=()=>{s.clan=$('rankClan').value;s.page=0;load();};$('rankSort').onchange=()=>{s.sort=$('rankSort').value;s.page=0;controls();load();};
  $('rankPrev').onclick=()=>{s.page--;load();};$('rankNext').onclick=()=>{s.page++;load();};$('rankRefresh').onclick=load;
  $('rankRules').onclick=()=>{focusReturn=document.activeElement;helpPage=0;helpRender();$('rankHelp').showModal();};
  for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',()=>focusReturn?.isConnected&&focusReturn.focus({preventScroll:true}));
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(ready&&user&&pageSize()!==s.size){s.page=0;load();}},150);});
  const ref=new URLSearchParams(location.search).get('from');if(['ludus.html','roma.html','klan.html','savas.html'].includes(ref))$('rankBack').href=ref+'?v=revision200';
 }
 async function boot(){
  controls();wire();
  try{
   client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
   client.auth.onAuthStateChange((event,session)=>{if(ready&&(!session?.user?.id||session.user.id!==user)){signIn();if(session?.user?.id){user=session.user.id;queueMicrotask(load);}}});
   const result=await client.auth.getUser();ready=true;if(result.error||!result.data?.user){signIn();return;}user=result.data.user.id;await load();
  }catch{ready=true;state('Hesap bilgisi alınamadı','Bağlantını kontrol edip sayfayı yeniden açabilirsin.',button('Yeniden dene',()=>location.reload()));}
 }
 boot();
})();
