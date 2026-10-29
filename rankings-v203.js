/* Scores, representatives and ranking are calculated by the server. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const fmt=v=>v==null?'—':Number(v).toLocaleString('tr-TR',{maximumFractionDigits:2});
 const percent=v=>v==null?'—':'%'+fmt(v),ratio=(k,d)=>k==null||d==null?'—':d===0?(k>0?'∞':'0'):fmt(k/d);
 function ratios(m){const partial=m.kills==null||m.deaths==null,partialA=partial||m.assists==null;
  return {kd:ratio(partial?m.kd_kills:m.kills,partial?m.kd_deaths:m.deaths),kda:ratio(partialA?(m.kda_kills==null?null:m.kda_kills+m.kda_assists):m.kills+m.assists,partialA?m.kda_deaths:m.deaths),partial,partialA};}
 const powers=[['all','Genel güç','Genel güç'],['gladiator','Gladyatör statı','Gladyatör istatistikleri'],['attack','İtem atak','İtem atak'],['defense','İtem defans','İtem defans'],['mobility','İtem hız','İtem hız']];
 const achievements=[['colosseum','Colosseum','Colosseum'],['naval','Deniz savaşları','Deniz savaşları'],['caravan','Kervan','Kervan savaşları'],['circus','Circus Maximus','Circus Maximus']];
 const guilds=[['clans','Hanedan sıralaması','Hanedan savaşları'],['fighters','Savaş gladyatörleri','Savaş gladyatörleri']];
 const groups=[['all','Tümü'],['raid','Baskın'],['defense','Savunma']];
 const classes=new Set(['murmillo','thraex','hoplomachus','hoplo','secutor','retiarius','provocator','scissor']);
 const s={scope:'players',section:'power',power:'all',category:'colosseum',guild:'clans',group:'all',sort:'score',clan:'',query:'',page:0,size:6};
 let client,user=null,data=null,seq=0,controller=null,searchTimer,resizeTimer,ready=false,helpPage=0,focusReturn=null;
 const power=()=>s.scope==='players'&&s.section==='power';
 const category=()=>s.scope==='guilds'?'guild':power()?'power':s.category;
 const combat=()=>s.scope==='guilds'?s.guild==='fighters':!power()&&['colosseum','naval','caravan'].includes(s.category);
 const options=()=>s.scope==='guilds'?guilds:power()?powers:achievements;
 const active=()=>s.scope==='guilds'?s.guild:power()?s.power:s.category;
 const title=()=>options().find(r=>r[0]===active())?.[2]||'';
 const sortDefault=()=>{s.sort=['circus','caravan'].includes(category())?'wins':'score';s.page=0;};
 const scoreLabel=()=>power()?'Güç':category()==='circus'?'Şampiyonluk':s.sort==='wins'?'Galibiyet':'Puan';
 const score=row=>power()?percent(row.score):fmt(row.score);
 function crest(row,cls='rank-avatar'){const e=el('span',cls);e.innerHTML=LudusClanEmblems.symbol(row.emblem||1,row.emblem_color,row.background);return e;}
 function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function controls(){
  for(const b of document.querySelectorAll('[data-scope]'))b.setAttribute('aria-pressed',String(s.scope===b.dataset.scope));
  $('rankSections').hidden=s.scope!=='players';for(const b of document.querySelectorAll('[data-section]'))b.setAttribute('aria-pressed',String(s.section===b.dataset.section));
  const nav=$('rankCategories');nav.replaceChildren();nav.style.setProperty('--categories',options().length);
  for(const [id,label]of options()){
   const b=button(label,()=>{if(s.scope==='guilds')s.guild=id;else if(power())s.power=id;else s.category=id;s.group='all';sortDefault();controls();load();});
   b.dataset.category=id;b.setAttribute('aria-pressed',String(id===active()));nav.append(b);
  }
  $('rankTitle').textContent=title();$('rankSearch').placeholder=s.scope==='guilds'?(s.guild==='clans'?'Hanedan ara…':'Gladyatör veya sahibi…'):power()?'Oyuncu veya gladyatör ara…':'Oyuncu ara…';
  $('rankGroups').replaceChildren();if(category()==='caravan')for(const [id,label]of groups){
   const b=button(label,()=>{s.group=id;s.page=0;controls();load();});b.dataset.group=id;b.setAttribute('aria-pressed',String(s.group===id));$('rankGroups').append(b);
  }
  const sortable=!power()&&!['circus','caravan'].includes(category());$('rankSort').closest('label').hidden=!sortable;$('rankSort').disabled=!sortable;
  $('rankSort').value=s.sort;$('rankSort').options[1].textContent='Galibiyete göre';
  $('rankClan').disabled=s.scope==='guilds'&&s.guild==='clans';
  const type=power()?'power':category()==='circus'?'circus':category()==='caravan'?'caravan':combat()?'combat':'clan';
  $('rankTable').dataset.metrics=type;
  const identity=power()||s.guild==='fighters'&&s.scope==='guilds'?'Gladyatör / Sahibi · Hanedan':s.scope==='guilds'?'Hanedan':'Oyuncu · Hanedan';
  const measures=power()?[['all','Genel'],['gladiator','Stat'],['attack','Atak'],['defense','Defans'],['mobility','Hız']]:type==='circus'?[['wins','Şampiyonluk']]:[...(type!=='caravan'?[['score','Puan']]:[]),['wins','Galibiyet'],['losses','Mağlubiyet'],...(combat()?[['kd','K/D'],['kda','K/D/A']]:[])];
  $('rankHead').replaceChildren(el('span','','Sıra'),el('span','',identity),...measures.map(([key,label])=>el('span',key===(power()?s.power:s.sort)?'selected':'',label)));
 }
 function state(heading,message,action){
  $('rankState').hidden=false;$('rankRows').replaceChildren();$('rankState').replaceChildren(crest({emblem:2},'rank-state-crest'),el('strong','',heading),el('p','',message));if(action)$('rankState').append(action);
 }
 function pageSize(){const h=$('rankRows').getBoundingClientRect().height,stack=innerWidth<=600&&innerHeight>innerWidth;return Math.max(1,Math.min(12,Math.floor(h/(stack?(power()||combat()?86:62):innerHeight<400?38:innerHeight<600?43:58))));}
 function identity(row){
  const e=el('div','rank-identity'),g=power()?row.gladiator:null,name=g?.name||(power()?'Gladyatör yok':row.name),kind=g?.class||row.class;let portrait;
  if(s.scope==='guilds'&&s.guild==='clans')portrait=crest(row);
  else{portrait=el('span','rank-avatar');if(kind&&classes.has(kind)){const img=el('img');img.src='imperial-portrait-'+kind+'-v31.webp';img.alt='';img.loading='lazy';img.onerror=()=>portrait.replaceChildren(document.createTextNode(name.slice(0,1)));portrait.append(img);}else portrait.textContent=name.slice(0,1).toLocaleUpperCase('tr-TR');}
  const text=el('div'),sub=power()?row.name:s.scope==='guilds'&&s.guild==='fighters'?row.subtitle:'';
  text.append(el('strong','',name));const meta=el('small');if(sub)meta.append(el('span','rank-owner',sub+' · '));
  if(s.scope!=='guilds'||s.guild!=='clans'){if(row.clan)meta.append(crest(row,'rank-mini-crest'));meta.append(el('span','rank-house',row.clan||'Hanedansız'));}
  else meta.textContent='Birlik · Onur · Zafer';
  meta.title=(sub?sub+' · ':'')+(row.clan||'Hanedansız');text.append(meta);e.append(portrait,text);return e;
 }
 function metric(key,label,value,primary=false){const e=el('div','rank-value rank-value-'+key+(primary?' selected':''));e.dataset.metric=key;e.append(el('small','',label),el('strong','',value));return e;}
 function rowView(row){
  const b=button('',()=>detail(row),'rank-row'+(row.rank!=null&&row.rank<=3?' podium':'')+(row.mine?' is-mine':''));b.dataset.id=row.id;
  b.setAttribute('aria-label',`${row.rank==null?'Sırası yok':row.rank+'. sıra'}, ${power()?(row.gladiator?.name||'Gladyatör yok')+', '+row.name:row.name}, ${row.clan||'Hanedansız'}, ${scoreLabel()} ${score(row)}`);
  b.append(el('span','rank-place',row.rank==null?'—':fmt(row.rank)),identity(row));
  const m=row.metrics||{},st=row.stats||{};
  if(power())for(const [key,label]of [['all','Genel'],['gladiator','Stat'],['attack','Atak'],['defense','Defans'],['mobility','Hız']])b.append(metric(key,label,percent(st[key==='all'?'power':key]),s.power===key));
  else if(category()==='circus')b.append(metric('wins','Şampiyonluk',fmt(m.wins??0),true));
  else{
   if(category()!=='caravan')b.append(metric('score','Puan',fmt(m.rating??m.points??1500),s.sort==='score'));
   b.append(metric('wins','Galibiyet',fmt(m.wins??0),s.sort==='wins'),metric('losses','Mağlubiyet',fmt(m.losses??0)));
   if(combat()){
    const v=ratios(m),kd=metric('kd','K/D',v.kd+(v.partial&&v.kd!=='—'?'*':'')),kda=metric('kda','K/D/A',v.kda+(v.partialA&&v.kda!=='—'?'*':''));
    kd.title='Öldürme / Ölüm'+(v.partial?' · Yalnız kayıtlı istatistikler':'');kda.title='(Öldürme + Asist) / Ölüm'+(v.partialA?' · Yalnız kayıtlı istatistikler':'');b.append(kd,kda);
   }
  }return b;
 }
 function render(){
  $('rankTable').setAttribute('aria-busy','false');$('rankRefresh').disabled=false;$('rankCount').textContent=data.total+' '+(s.scope==='players'?'oyuncu':s.guild==='clans'?'hanedan':'gladyatör');
  $('rankState').hidden=true;$('rankRows').replaceChildren(...data.rows.map(rowView));$('rankRows').style.setProperty('--rows',s.size);
  if(!data.rows.length)state('Kayıt bulunamadı',s.query?'Bu isimle eşleşen kayıt yok. Aramayı değiştirebilirsin.':s.scope==='guilds'&&s.guild==='fighters'?'Hanedan savaşlarına katılan gladyatörler, ilk sonuç kaydedildiğinde burada sıralanacak.':'Seçtiğin filtrede henüz bir kayıt bulunmuyor.');
  const notice=power()?(s.power==='all'?'Dört puan · Her biri %25':'Seçili ölçütte en güçlü gladyatör'):category()==='guild'?(!data.guild_matches?'Hanedan savaşları henüz açılmadı.':'Savaş sonucu ve rakip gücüne göre'):category()==='caravan'?(s.group==='defense'&&!data.defense_matches?'Henüz kaydedilmiş savunma savaşı yok.':'Baskın ve savunma · Galibiyete göre'):category()==='circus'?'Katıldığın yarışlardaki şampiyonluklar':'1500 başlangıç · Galibiyet +20 / Mağlubiyet −5';
  $('rankNotice').textContent=notice;$('rankNotice').title=notice;
  $('rankPage').textContent=(data.page+1)+' / '+Math.max(1,Math.ceil(data.total/s.size));$('rankPrev').disabled=data.page===0;$('rankNext').disabled=(data.page+1)*s.size>=data.total;s.page=data.page;
  const own=$('rankOwn');own.replaceChildren();own.disabled=!data.own;
  if(data.own){own.append(el('strong','','#'+(data.own.rank??'—')),el('span','',(s.scope==='guilds'&&s.guild==='clans'?'Hanedanın':s.scope==='guilds'||power()?'Gladyatörün':'Sen')+' · '+(power()?data.own.gladiator?.name||'Gladyatör yok':data.own.name)),el('strong','',score(data.own)));own.onclick=()=>detail(data.own);}
  else own.textContent=s.scope==='guilds'?'Bu görünümde henüz sıran yok.':'Bu hanedan filtresinde yer almıyorsun.';
  const selected=s.clan,select=$('rankClan');select.replaceChildren(new Option('Tüm hanedanlar',''));
  if(data.my_clan){const mine=data.clans.find(c=>c.id===data.my_clan);if(mine)select.append(new Option('Hanedanım · '+mine.name,mine.id));}
  for(const c of data.clans)if(c.id!==data.my_clan)select.append(new Option(c.name,c.id));select.value=selected;
  $('rankUpdated').textContent=power()?'Güncel statlar · Kuşanılmış eşyalar':'Tüm zamanların başarıları';
 }
 async function load(){
  if(!user)return;clearTimeout(searchTimer);controller?.abort();controller=new AbortController();const current=++seq,who=user;
  s.size=pageSize();$('rankRows').style.setProperty('--rows',s.size);$('rankTable').setAttribute('aria-busy','true');$('rankRefresh').disabled=true;
  $('rankPrev').disabled=$('rankNext').disabled=$('rankOwn').disabled=true;state('Kayıtlar getiriliyor…','');$('rankNotice').textContent='';$('rankCount').textContent='';
  const activeController=controller,timer=setTimeout(()=>activeController.abort(),12000);
  try{
   let request=client.rpc('ludus_rankings_v203',{p_scope:s.scope==='players'?'players':s.guild,p_category:category(),p_group:power()?s.power:category()==='caravan'?s.group:'all',p_sort:s.sort,p_clan:s.scope==='guilds'&&s.guild==='clans'?null:s.clan||null,p_query:s.query,p_page:s.page,p_page_size:s.size,p_target:null});
   if(request.abortSignal)request=request.abortSignal(activeController.signal);
   const result=await request;if(current!==seq||who!==user)return;
   if(result.error)throw result.error;
   if(result.data?.version!==203||!Array.isArray(result.data.rows))throw Error('invalid response');data=result.data;render();
  }catch(e){if(current!==seq||who!==user)return;data=null;$('rankTable').setAttribute('aria-busy','false');$('rankRefresh').disabled=false;$('rankOwn').textContent='Sıran yüklenemedi.';
   state('Sıralama yüklenemedi','Bağlantını kontrol edip tekrar deneyebilirsin.',button('Tekrar dene',load));
  }finally{clearTimeout(timer);}
 }
 function card(label,value,note){const c=el('div','rank-detail-card');c.append(el('small','',label),el('strong','',value));if(note)c.append(el('p','',note));return c;}
 function dialogHead(dialog,title,subtitle,id){const h=el('header','rank-dialog-head'),text=el('div'),t=el('h2','',title);t.id=id;text.append(t,el('p','',subtitle));h.append(text,button('×',()=>dialog.close(),'icon-button'));h.lastChild.setAttribute('aria-label','Kapat');return h;}
 function detail(row){
  const dialog=$('rankDetail');focusReturn=document.activeElement;dialog.replaceChildren(dialogHead(dialog,power()?row.gladiator?.name||'Gladyatör yok':row.name,(power()?row.name:row.subtitle||'')+(row.clan?' · '+row.clan:''),'rankDetailTitle'));
  const grid=el('div','rank-detail-grid'),st=row.stats||{},m=row.metrics||{};let note;
  if(power()){
   grid.append(card('GENEL GÜÇ',percent(st.power),'Dört bileşenin ortalaması'),card('GLADYATÖR İSTATİSTİKLERİ',percent(st.gladiator),'Gladyatörün mevcut stat puanı'),card('İTEM ATAK',percent(st.attack),'Ana el + diğer el'),card('İTEM DEFANS',percent(st.defense),'Miğfer + göğüs'),card('İTEM HIZ',percent(st.mobility),'Kolluk + bacaklık'),card('GENEL DONANIM',percent(st.equipment),'Üç item grubunun ortalaması'));
   note='Tüm yüzdeler bu gladyatöre aittir. Genel güçte her bileşen %25 ağırlıktadır. Boş yuva 0, eksik stat kaydı “—” gösterilir.';
  }else if(category()==='circus'){
   grid.append(card('ŞAMPİYONLUK',fmt(m.wins??0),'Katıldığı yarışlardaki birincilikler'),card('YARIŞ',fmt(m.matches??0),'Tamamlanan katılımlar'),card('DİĞER SONUÇLAR',fmt((m.matches??0)-(m.wins??0)),'Şampiyonluk dışındaki dereceler'));
   note='Bahis kazançları şampiyonluk sayısına dahil edilmez.';
  }else{
   const v=ratios(m);grid.append(card(category()==='caravan'?'KARŞILAŞMA':'SAVAŞ PUANI',fmt(category()==='caravan'?m.matches??0:m.rating??m.points??1500),title()),card('GALİBİYET',fmt(m.wins??0)),card('MAĞLUBİYET',fmt(m.losses??0)));
   if(combat())grid.append(card('K/D',v.kd+(v.partial&&v.kd!=='—'?'*':''),fmt(m.kills)+' öldürme · '+fmt(m.deaths)+' ölüm'),card('K/D/A',v.kda+(v.partialA&&v.kda!=='—'?'*':''),fmt(m.assists)+' asist'),card('KARŞILAŞMA',fmt(m.matches??0),'Kaydedilmiş sonuçlar'));
   note='K/D ve K/D/A sıralamayı etkilemez. “—” eksik kayıt; ∞ sıfır ölüm.'+(m.tracked!=null&&m.tracked<m.participants?' * K/D/A: '+m.tracked+'/'+m.participants+' katılımcı kaydından.':'');
  }
  dialog.append(grid);const foot=el('div','rank-dialog-foot');foot.append(el('span','',note));
  if(row.clan_id)foot.append(button('Hanedanı incele',()=>{dialog.close();s.scope='guilds';s.guild='fighters';s.clan=row.clan_id;s.query='';s.page=0;s.group='all';s.sort='score';$('rankSearch').value='';controls();load();}));
  dialog.append(foot);dialog.showModal();dialog.querySelector('button').focus();
 }
 const help=[
  ['En güçlü gladyatör','Genel güç = (gladyatör statı + item atak + item defans + item hız) / 4. Her bileşenin ağırlığı %25’tir. Tüm değerler aynı gladyatör ve kuşandığı eşyalardan gelir.','Her oyuncu, seçili ölçütte en güçlü gladyatörüyle bir kez sıralanır. Genel güçte en yüksek toplamı; diğer sekmelerde en yüksek stat, atak, defans veya hız puanını taşıyan gladyatör gösterilir.','Tablodaki dört bileşen bu gladyatöre aittir. İsimle arama ve hanedan filtresiyle karşılaştırabilir, satıra dokunarak ayrıntıları görebilirsin.'],
  ['İtem puanları','Atak: ana el ve diğer el. Defans: miğfer ve göğüs. Hız: kolluk ve bacaklık. Her grup iki yuvanın ortalamasıdır; boş yuva 0 sayılır. Yalnız kuşanılmış eşyalar hesaba girer.','Her eşyanın altı doğal statı, + seviyesi, Safir yüzdeleri ve dört Zümrüt özelliği birlikte hesaplanır. Yakutla elde edilen geliştirme, eşyanın mevcut + seviyesine dahildir.','%100 referansı: türün temel statları, +15, altı %100 Safir ve dört %100 Zümrüt. +15 üzeri puanı artırır. Eksik eski stat kaydı “—” olur; tahmin edilmez.'],
  ['Başarılar ve puanlar','Colosseum ve deniz savaşlarının puanları ayrıdır; ikisi de 1500’den başlar. Galibiyet +20, mağlubiyet −5 puandır. Colosseum kayıtlarına 4×5, 20 kişilik ve çevrimiçi arena sonuçları dahildir; küçük arena ve hayatta kalma dahil değildir.','Colosseum ve denizde puana veya galibiyete göre sıralayabilirsin. Kervanda baskın, savunma ve toplam sonuçlar galibiyete göre sıralanır. Bir savaşa kaç gladyatör katılırsa katılsın sonuç bir kez sayılır.','Circus Maximus katıldığın yarışlardaki şampiyonlukları sayar. Hanedan savaşlarında rakip gücüne göre puan değişir; sadece savaşa katılan gladyatörler puan kazanır.'],
  ['K/D, K/D/A ve eşitlik','K/D = öldürme / ölüm. K/D/A = (öldürme + asist) / ölüm. Bu oranlar sıralamayı ve eşit puandaki dereceyi etkilemez. Asgari maç şartı yoktur.','Sıfır ölümle katkı varsa ∞ görünür. Eksik kayıt “—”, yalnız kayıtlı bölümden hesaplanan oran “*” ile belirtilir. Ayrıntıda istatistiklerin kayıt kapsamını görebilirsin.','Eşit puanlar aynı dereceyi paylaşır. İsim araması seçili sıralamadaki gerçek dereceyi korur. Henüz doğrulanmış hanedan savaşı veya kervan savunması yoksa bu durum tabloda belirtilir.']
 ];
 function helpRender(){const d=$('rankHelp'),text=help[helpPage];d.replaceChildren(dialogHead(d,text[0],'SIRALAMA REHBERİ','rankHelpTitle'));const copy=el('div','rank-help-copy');text.slice(1).forEach(t=>copy.append(el('p','',t)));d.append(copy);const footer=el('div','rank-dialog-foot');footer.append(button('‹ Önceki',()=>{helpPage=Math.max(0,helpPage-1);helpRender();}),el('span','',(helpPage+1)+' / '+help.length),button('Sonraki ›',()=>{helpPage=Math.min(help.length-1,helpPage+1);helpRender();}));footer.firstChild.disabled=helpPage===0;footer.lastChild.disabled=helpPage===help.length-1;d.append(footer);}
 function signIn(){user=null;data=null;++seq;controller?.abort();$('rankOwn').disabled=true;$('rankOwn').textContent='Sıranı görmek için giriş yap.';$('rankTable').setAttribute('aria-busy','false');$('rankRefresh').disabled=true;$('rankCount').textContent='';$('rankNotice').textContent='';$('rankPage').textContent='1 / 1';$('rankPrev').disabled=$('rankNext').disabled=true;for(const d of document.querySelectorAll('dialog'))d.close();const a=el('a','','Hesabıma git');a.href='index.html?v=revision203';state('İmparatorluk seni bekliyor','Oyuncuları ve hanedanları karşılaştırmak için hesabına giriş yap.',a);}
 function wire(){
  for(const b of document.querySelectorAll('[data-scope]'))b.onclick=()=>{s.scope=b.dataset.scope;s.group='all';sortDefault();s.query='';s.clan='';$('rankSearch').value='';controls();load();};
  for(const b of document.querySelectorAll('[data-section]'))b.onclick=()=>{s.section=b.dataset.section;s.group='all';sortDefault();controls();load();};
  $('rankSearch').oninput=()=>{s.query=$('rankSearch').value;s.page=0;clearTimeout(searchTimer);searchTimer=setTimeout(load,260);};
  $('rankClan').onchange=()=>{s.clan=$('rankClan').value;s.page=0;load();};$('rankSort').onchange=()=>{s.sort=$('rankSort').value;s.page=0;controls();load();};
  $('rankPrev').onclick=()=>{s.page--;load();};$('rankNext').onclick=()=>{s.page++;load();};$('rankRefresh').onclick=load;
  $('rankRules').onclick=()=>{focusReturn=document.activeElement;helpPage=0;helpRender();$('rankHelp').showModal();};
  for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',()=>focusReturn?.isConnected&&focusReturn.focus({preventScroll:true}));
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(ready&&user&&pageSize()!==s.size){s.page=0;load();}},150);});
  const ref=new URLSearchParams(location.search).get('from');if(['ludus.html','roma.html','klan.html','savas.html'].includes(ref))$('rankBack').href=ref+'?v=revision203';
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
