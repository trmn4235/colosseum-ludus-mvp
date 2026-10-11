/* Forum Pazarı. Real listings only; all transfers and rolls stay on the server. */
(()=>{
 'use strict';
 const kinds={weapon:'Silah',shield:'Kalkan',helmet:'Başlık',chest:'Zırh',gloves:'Kolluk',legs:'Bacaklık',gladiator:'Gladyatör'};
 const models={gladius:'Gladius',sica:'Sica',spear:'Mızrak',trident:'Trident',net:'Ağ',mace:'Zincirli Gürz',whip:'Kırbaç',scissor:'Kol Bıçağı',large:'Büyük Kalkan',round:'Yuvarlak Kalkan',small:'Küçük Kalkan',gladiator:'Gladyatör Başlığı',gold:'Gladyatör Başlığı',knights:'Şövalye Başlığı',silver:'Şövalye Başlığı',winged:'Kanatlı Başlık',roman:'Roma Başlığı',gladiator_chest:'Gladyatör Zırhı',chest_plate:'İşlemeli Zırh',armor_shoulder:'Çift Omuzluk',shoulder_armor:'Omuz Koruma',legs:'Bacaklık',murmillo:'Murmillo',thraex:'Thraex',hoplomachus:'Hoplomachus',secutor:'Secutor',retiarius:'Retiarius',provocator:'Provocator'};
 const number=value=>Number(value).toLocaleString('tr-TR',{maximumFractionDigits:2});
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const model=a=>a.class||a.model||a.kind;
 const kind=a=>a.class?'gladiator':a.kind;
 const modelName=a=>a.class?(a.class==='scissor'?'Scissor':models[a.class]||a.class):models[model(a)]||globalThis.LudusArmourName?.(a)||kinds[a.kind]||'Eşya';
 const name=a=>a.name||globalThis.LudusArmourName?.(a)||modelName(a);
 const title=a=>name(a)+(a.class?' · Sv. '+(a.level||1):' +'+(a.enhancement||0));
 const asset=r=>r.asset||r.snapshot;
 function gems(a){
  const system=globalThis.LudusItemSystem;
  const sapphire=Object.entries(a.natural_percentages||{}).filter(([,v])=>Number(v)>0).map(([key,value])=>({key,value:Number(value),id:system?.natural.find(s=>s.key===key)?.id||0,label:system?.natural.find(s=>s.key===key)?.label||key,effect:'+%'+number(value)}));
  const emerald=(a.emeralds||[]).map(s=>{const stone=system?.stone('emerald',s.id);return {key:String(s.id),id:Number(s.id),value:Number(s.value),label:stone?.title||stone?.label||'Zümrüt '+s.id,effect:'+'+number((system?.emeraldPower?.[Number(s.id)-1]||0)*Number(s.value)/100)};});
  const ruby=(a.rubies||[]).map(s=>{const stone=system?.stone('ruby',s.id);return {key:String(s.id||s.stat||s.title),id:Number(s.id)||0,value:Number(s.value)||0,label:s.title||stone?.title||s.stat||'Yakut',effect:s.value?'+%'+number(s.value):stone?.label||'Basılı etki'};});
  return {sapphire,emerald,ruby};
 }
 function gemVector(a){return Object.entries(gems(a)).flatMap(([family,rows])=>rows.map(r=>[family+':'+r.key,r.value])).sort(([a],[b])=>a.localeCompare(b));}
 function gemMatch(a,b,mode='close'){
  if(mode==='any')return true;
  const x=gemVector(a),y=gemVector(b);
  if(x.length!==y.length||x.some((v,i)=>v[0]!==y[i][0]))return false;
  return x.every((v,i)=>Math.abs(v[1]-y[i][1])<=(mode==='exact'?0:20));
 }
 function priceInfo(value){const p=Number(value);if(!Number.isSafeInteger(p)||p<1||p>1000000000)return null;const fee=Math.floor((p+19)/20);return {price:p,commission:fee,net:p-fee};}
 const fold=value=>String(value??'').toLocaleLowerCase('tr-TR');
 function filterListings(rows,f={}){
  return rows.filter(r=>{
   const a=asset(r);if(!a)return false;
   if(f.kind&&kind(a)!==f.kind)return false;
   if(f.model&&model(a)!==f.model)return false;
   if(f.plus!==''&&f.plus!=null&&Number(a.enhancement||0)<Number(f.plus))return false;
   if(f.max&&Number.isFinite(Number(f.max))&&Number(r.price)>Number(f.max))return false;
   if(f.stone&&!gems(a)[f.stone]?.length)return false;
   if(f.query&&!fold([title(a),modelName(a),r.seller,kinds[kind(a)]].join(' ')).includes(fold(f.query.trim())))return false;
   return true;
  }).sort((a,b)=>f.sort==='newest'?Date.parse(b.created_at)-Date.parse(a.created_at):f.sort==='expensive'?Number(b.price)-Number(a.price):f.sort==='enhancement'?Number(asset(b).enhancement||0)-Number(asset(a).enhancement||0)||Number(a.price)-Number(b.price):Number(a.price)-Number(b.price));
 }
 function comparables(rows,a,f={}){return rows.filter(r=>{const b=asset(r);return b&&kind(b)===kind(a)&&model(b)===(f.model||model(a))&&(f.plus===''||f.plus==null||Number(b.enhancement||0)===Number(f.plus))&&gemMatch(a,b,f.stone||'any');}).sort((a,b)=>Number(a.price)-Number(b.price));}
 const rules=Object.freeze({kinds,models,number,escape,model,kind,modelName,name,title,asset,gems,gemMatch,priceInfo,filterListings,comparables});
 globalThis.LudusForumRules=rules;
 if(typeof module!=='undefined'&&module.exports)module.exports=rules;
 if(!globalThis.document)return;

 const $=id=>document.getElementById(id),basic=globalThis.LudusBasicMarket;
 if(!basic||!$('forumMarket'))return;
 let owner=null,data=null,section='basic',view='browse',selected=null,sellKey='',hours=24,busy=false,loading=false,pending=null,loadSerial=0,noticeTimer=null,serverOffset=0;
 const filters={kind:'weapon',query:'',model:'',plus:'',stone:'',max:'',sort:'price'};
 const compare={model:'',plus:'',stone:'close'};
 const storageKey=()=> 'ludus-forum-pending-v66:'+owner;
 const coin='<i class="forum-coin" aria-hidden="true">◉</i>';
 const iconPaths={weapon:'M9 38 36 11l4-6-6 3L7 36m-2-3 10 10m-7-5-5 6',shield:'M24 5 8 10v14c0 10 16 19 16 19s16-9 16-19V10L24 5Zm0 0v37',helmet:'M10 31V20a14 14 0 0 1 28 0v11l-9 9V27H19v13l-9-9Zm9-7h10',chest:'m15 5-9 7 4 9 5-4v25h18V17l5 4 4-9-9-7-9 6-9-6Z',gloves:'m17 5 15 4 9 28-17 7L9 15l8-10Zm-2 17 18-6',legs:'M16 5h16v26l7 7v6H12v-7l4-6V5Zm0 8h16',gladiator:'M12 39V21a12 12 0 0 1 24 0v18l-9-5V23h-6v11l-9 5Zm3-24 9-10 9 10'};
 const symbol=k=>'<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="'+(iconPaths[k]||iconPaths.gladiator)+'" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>';
 const gemSVG=(family,id=0)=>globalThis.LudusGems?.svg(family,id)||'';
 function art(a){const html=globalThis.LudusIcons?.svg(a.class?{kind:'helmet',model:'gladiator',name:a.name}:a)||symbol(kind(a));return html.replace(/<rect width="96" height="96" fill="#fff"\s*\/>/g,'');}
 const icon=a=>'<span class="forum-icon">'+art(a)+'</span>';
 const priced=p=>'<span class="forum-price">'+coin+' '+number(p)+'</span>';
 const activeListings=()=>data?.listings||[];
 const picked=()=>activeListings().find(r=>r.id===selected)||null;
 function sellAssets(){return [...(data?.items||[]).map(a=>({type:'item',a})),...(data?.gladiators||[]).map(a=>({type:'gladiator',a}))];}
 function selling(){return sellAssets().find(r=>r.type+':'+r.a.id===sellKey)||null;}
 function snippets(a){
  if(a.class)return '<span class="forum-effect-none">'+escape(modelName(a))+' · Genel '+number(a.overall||0)+'</span>';
  const g=gems(a),families=['sapphire','emerald','ruby'].filter(f=>g[f].length).slice(0,2);
  if(!families.length)return '<span class="forum-effect-none">Taşsız</span>';
  return families.map(f=>'<span class="forum-effect-snippet">'+gemSVG(f)+'<span>'+g[f].slice(0,2).map(r=>'<b>'+escape(r.label)+' '+escape(r.effect)+'</b>').join('')+'</span></span>').join('');
 }
 function gemPanels(a){return Object.entries(gems(a)).filter(([,r])=>r.length).map(([f,rows])=>'<section class="forum-gems '+f+'"><h3>'+({sapphire:'Basılı Safir Etkileri',emerald:'Basılı Zümrüt Etkileri',ruby:'Yakut Etkileri'}[f])+'</h3>'+rows.map(r=>'<div class="forum-gem-row">'+gemSVG(f,r.id)+'<span>'+escape(r.label)+' '+escape(r.effect)+'</span><b>'+(r.value?'%'+number(r.value):'')+'</b></div>').join('')+'</section>').join('');}
 function stats(a){
  if(a.class){const labels={attack_technique:'Saldırı Tekniği',defense_technique:'Savunma Tekniği',tactics:'Taktik',conditioning:'Kondisyon',reflex:'Refleks',speed:'Hız',muscle_strength:'Kas Gücü',strength:'Kas Gücü',stamina:'Kondisyon',attack:'Saldırı',defense:'Savunma',hp:'HP'};return '<dl class="forum-stats">'+Object.entries(a.base_stats||{}).map(([k,v])=>'<div><dt>'+escape(labels[k]||k)+'</dt><dd>'+number(v)+'</dd></div>').join('')+'<div><dt>Genel Seviye</dt><dd>'+number(a.overall||0)+'</dd></div></dl>';}
  let values={};try{values=globalThis.LudusItemSystem.effectiveStats(a);}catch{}
  return '<dl class="forum-stats">'+(globalThis.LudusItemSystem?.statsFor(a.kind)||[]).map(s=>'<div><dt>'+escape(s.label)+'</dt><dd>'+(Number.isFinite(values[s.key])?number(values[s.key]):'—')+'</dd></div>').join('')+'</dl>';
 }
 function detailHTML(a,price=null,seller=''){
  return '<div class="forum-detail-item">'+icon(a)+'<div><strong>'+escape(title(a))+'</strong><small>'+escape(modelName(a))+'</small>'+(seller?'<small>'+escape(seller)+'</small>':'')+(price!=null?priced(price):'')+'</div></div><h3 class="forum-stat-heading">Temel Özellikler</h3>'+stats(a)+gemPanels(a);
 }
 function emptyHTML(heading,copy,k='weapon'){return '<div class="forum-empty">'+symbol(k)+'<strong>'+escape(heading)+'</strong><p>'+escape(copy)+'</p></div>';}
 function notice(message,retry=false,keep=false){
  clearTimeout(noticeTimer);$('forumNotice').replaceChildren();if(!message)return;
  const span=document.createElement('span');span.textContent=message;$('forumNotice').append(span);
  if(retry){const button=document.createElement('button');button.textContent='Yeniden dene';button.onclick=()=>pending?submitPending():loadMarket();$('forumNotice').append(button);}
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Bildirimi kapat');close.onclick=()=>{if(pending)notice('Tamamlanmayı bekleyen pazar işlemin var.',true,true);else notice('');};$('forumNotice').append(close);
  if(!retry&&!keep)noticeTimer=setTimeout(()=>notice(''),7000);
 }
 function showSection(next){
  section=next==='forum'?'forum':'basic';$('basicMarket').hidden=section!=='basic';$('forumMarket').hidden=section!=='forum';
  for(const b of document.querySelectorAll('[data-market-section]')){b.classList.toggle('active',b.dataset.marketSection===section);b.setAttribute('aria-pressed',String(b.dataset.marketSection===section));}
  if(section==='forum'){renderBrowse();if(owner&&!busy)loadMarket();}
 }
 function showView(next){view=next==='create'?'create':'browse';$('forumBrowse').hidden=view!=='browse';$('forumCreate').hidden=view!=='create';$('forumBackList').hidden=view!=='create';$('forumNewListing').hidden=view==='create';$('forumViewTitle').textContent=view==='create'?'Yeni İlan Oluştur':'Forum Pazarı';$('forumViewCaption').textContent=view==='create'?'Satış fiyatını belirle, benzer ilanlarla karşılaştır.':'Ludus’tan Ludus’a · Geliştirilmiş ekipman ve gladyatör ticareti';if(view==='create')renderCreate();else renderBrowse();}
 function setCategory(k){filters.kind=k;filters.model='';filters.plus='';selected=null;renderCategories();populateModels();renderBrowse();}
 function renderCategories(){
  $('forumCategories').replaceChildren();for(const [k,label]of Object.entries(kinds)){const b=document.createElement('button');b.type='button';b.innerHTML=symbol(k)+'<span>'+escape(label)+'</span>';b.classList.toggle('active',filters.kind===k);b.setAttribute('aria-pressed',String(filters.kind===k));b.onclick=()=>setCategory(k);$('forumCategories').append(b);}
 }
 function options(select,rows,value,blank){
  select.replaceChildren();if(blank!=null){const o=document.createElement('option');o.value='';o.textContent=blank;select.append(o);}
  for(const [val,label]of rows){const o=document.createElement('option');o.value=val;o.textContent=label;select.append(o);}select.value=value;
 }
 function modelOptions(k){const all=[...activeListings().map(r=>asset(r)),...sellAssets().map(r=>r.a)];return [...new Map(all.filter(a=>kind(a)===k).map(a=>[model(a),modelName(a)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'tr'));}
 function populateModels(){options($('forumModel'),modelOptions(filters.kind),filters.model,'Tüm modeller');}
 function renderBrowse(){
  const rows=filterListings(activeListings(),filters);if(!rows.some(r=>r.id===selected))selected=rows[0]?.id||null;
  $('forumListings').replaceChildren();
  if(!data){$('forumListings').innerHTML=emptyHTML(loading?'İlanlar hazırlanıyor…':'Forum Pazarı',loading?'Ludus ilanları yükleniyor.':'İlanlarını görmek için pazarın yüklenmesini bekle.');}
  else if(!rows.length){$('forumListings').innerHTML=emptyHTML(activeListings().length?'İlan bulunamadı':'Henüz ilan yok',activeListings().length?'Aramayı veya filtreleri değiştir.':'Geliştirdiğin eşyanı satışa koyarak ilk ilanı açabilirsin.',filters.kind);}
  for(const r of rows){const a=asset(r),button=document.createElement('button');button.type='button';button.className='forum-row'+(r.id===selected?' selected':'');button.dataset.listingId=r.id;button.setAttribute('aria-pressed',String(r.id===selected));button.setAttribute('aria-label',title(a)+' · '+number(r.price)+' denarius'+(r.own?' · Kendi ilanın':''));button.innerHTML='<span class="forum-item-cell">'+icon(a)+'<span><strong>'+escape(title(a))+'</strong><small>'+escape(r.own?'Kendi ilanın':r.seller)+'</small></span></span><span class="forum-model">'+escape(modelName(a))+'</span><span class="forum-row-effects">'+snippets(a)+'</span>'+priced(r.price);button.onclick=()=>{selected=r.id;for(const row of $('forumListings').children){row.classList.toggle('selected',row.dataset.listingId===selected);row.setAttribute('aria-pressed',String(row.dataset.listingId===selected));}renderSelection();};$('forumListings').append(button);}
  $('forumCount').textContent=data?rows.length+' ilan'+(activeListings().length>=500?' · Son 500 aktif ilan':''):'İlanlar hazırlanıyor…';
  $('forumChips').replaceChildren();for(const [key,label]of [['query',filters.query],['model',filters.model?models[filters.model]||filters.model:''],['plus',filters.plus!==''?'En az +'+filters.plus:''],['stone',filters.stone?({sapphire:'Safir',emerald:'Zümrüt',ruby:'Yakut'}[filters.stone]):''],['max',filters.max?'≤ '+number(filters.max):'']]){if(!label)continue;const b=document.createElement('button');b.type='button';b.className='forum-filter-chip';b.textContent=label+' ×';b.setAttribute('aria-label',label+' filtresini kaldır');b.onclick=()=>{filters[key]='';syncFilters();renderBrowse();};$('forumChips').append(b);}
  renderSelection();renderMine();$('forumNewListing').disabled=busy||!data;$('forumReload').disabled=busy||loading;
 }
 function renderSelection(){
  const r=picked();if(!r){$('forumDetail').innerHTML=emptyHTML('Bir ilan seç','Eşyanın özellikleri ve taş etkileri burada görünür.');$('forumBuy').disabled=true;$('forumHistory').disabled=true;$('forumSimilar').disabled=true;$('forumBuyHint').textContent='Ayrıntılarını görmek için bir ilan seç.';return;}
  const a=asset(r);$('forumDetail').innerHTML=detailHTML(a,r.price,r.seller);$('forumBuy').disabled=busy||!!pending||r.own||Number(data.gold)<Number(r.price)||Date.parse(r.expires_at)<=Date.now()+serverOffset;$('forumBuy').textContent=r.own?'Kendi İlanın':'Satın Al';$('forumBuyHint').textContent=r.own?'İlanını “Benim İlanlarım” alanından kaldırabilirsin.':Number(data.gold)<Number(r.price)?'Bu ilan için yeterli denarius yok.':a.class?'Gladyatör ekipmansız olarak Ludus’una katılır.':'+ seviyesi ve basılı taşlar korunur.';$('forumHistory').disabled=busy;$('forumSimilar').disabled=busy;
 }
 function renderMine(){
  $('forumMine').replaceChildren();const mine=(data?.mine||[]).filter(r=>r.status==='active'||r.status==='sold').slice(0,10);
  if(!mine.length){const p=document.createElement('p');p.className='forum-compare-help';p.textContent='İlanların burada görünür. Satışa koyacağın eşyayı envanterinden seç.';$('forumMine').append(p);return;}
  for(const r of mine){const a=asset(r),row=document.createElement('div');row.className='forum-mine-row';row.innerHTML=icon(a)+'<span class="forum-mine-name">'+escape(title(a))+'</span>'+priced(r.price)+'<span class="forum-mine-status '+(r.status==='sold'?'sold':'')+'">'+(r.status==='sold'?'Satıldı':'Aktif')+'</span>';if(r.status==='active'){const b=document.createElement('button');b.type='button';b.textContent='Kaldır';b.disabled=busy||!!pending;b.setAttribute('aria-label',title(a)+' ilanını kaldır');b.onclick=()=>confirmCancel(r);row.append(b);}else row.title='Net gelir: '+number(r.net_income||0)+' denarius';$('forumMine').append(row);}
 }
 function syncFilters(){for(const [key,id]of [['query','forumQuery'],['model','forumModel'],['plus','forumPlus'],['stone','forumStone'],['max','forumMaxPrice'],['sort','forumSort']])$(id).value=filters[key];}
 function clearFilters(){Object.assign(filters,{query:'',model:'',plus:'',stone:'',max:'',sort:'price'});syncFilters();renderBrowse();}
 function renderCreate(){
  const assets=sellAssets();$('forumAssetPicker').replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent=assets.length?'Satılacak varlığı seç…':'Satılabilir eşya veya gladyatör yok';$('forumAssetPicker').append(blank);
  for(const [type,label]of [['item','Envanterimdeki Eşyalar'],['gladiator','Hazır ve Ekipmansız Gladyatörler']]){const group=document.createElement('optgroup');group.label=label;for(const r of assets.filter(r=>r.type===type)){const o=document.createElement('option');o.value=type+':'+r.a.id;o.textContent=title(r.a);group.append(o);}if(group.children.length)$('forumAssetPicker').append(group);}
  if(!assets.some(r=>r.type+':'+r.a.id===sellKey))sellKey=assets[0]?assets[0].type+':'+assets[0].a.id:'';$('forumAssetPicker').value=sellKey;$('forumAssetPicker').disabled=busy||!!pending;
  renderSellDetail();renderCompare();updatePrice();
 }
 function renderSellDetail(){
  const r=selling();$('forumSellDetail').innerHTML=r?'<div class="forum-create-art">'+art(r.a)+'</div><h3 class="forum-create-name">'+escape(title(r.a))+'</h3><dl class="forum-stats"><div><dt>Tür</dt><dd>'+escape(kinds[kind(r.a)])+'</dd></div><div><dt>Durum</dt><dd>Envanterde</dd></div></dl><h3 class="forum-stat-heading">Temel Özellikler</h3>'+stats(r.a)+gemPanels(r.a):emptyHTML('Satılabilir varlık yok','Ekipmanı gladyatöründen çıkarıp envantere al. Kilitli varlıklar satışa konulamaz.');$('forumLockNote').textContent=r?.a.class?'Satıştaki gladyatör kullanılamaz.':'Satıştaki eşya kullanılamaz.';
 }
 function marketMetrics(a){
  const entry=data?.comparisons?.find(r=>r.kind===kind(a)&&r.model===model(a)&&Number(r.enhancement)===Number(a.enhancement||0));if(entry)return entry;
  const rows=comparables(activeListings(),a,{plus:Number(a.enhancement||0),stone:'any'}),sale=(data?.sales||[]).find(s=>s.kind===kind(a)&&s.model===model(a)&&Number(s.enhancement)===Number(a.enhancement||0));
  return {count:rows.length,low:rows.length?Math.min(...rows.map(r=>Number(r.price))):null,average:rows.length?Math.round(rows.reduce((n,r)=>n+Number(r.price),0)/rows.length):null,last:sale?.price??null};
 }
 function resetCompare(){const r=selling();compare.model=r?model(r.a):'';compare.plus=r?String(r.a.enhancement||0):'';compare.stone='close';}
 function renderCompare(){
  const r=selling(),a=r?.a;
  options($('forumCompareModel'),a?modelOptions(kind(a)):[],compare.model,null);options($('forumComparePlus'),Array.from({length:16},(_,i)=>[String(i),'+'+i]),compare.plus,'Tümü');$('forumCompareStone').value=compare.stone;
  if(a&&!compare.model){compare.model=model(a);$('forumCompareModel').value=compare.model;}
  const m=a?marketMetrics(a):{count:0,low:null,average:null,last:null};
  $('forumCompareMetrics').innerHTML='<dl><div><dt>Model:</dt><dd>'+escape(a?modelName(a):'—')+'</dd></div><div><dt>+ Seviyesi:</dt><dd>'+(a&&!a.class?'+'+(a.enhancement||0):'—')+'</dd></div><div><dt>Pazardaki Adet:</dt><dd>'+number(m.count)+'</dd></div></dl><dl><div><dt>En Düşük:</dt><dd>'+(m.low!=null?priced(m.low):'—')+'</dd></div><div><dt>Ortalama:</dt><dd>'+(m.average!=null?priced(m.average):'—')+'</dd></div><div><dt>Son Satış:</dt><dd>'+(m.last!=null?priced(m.last):'—')+'</dd></div></dl>';
  $('forumComparables').replaceChildren();const rows=a?comparables(activeListings(),a,compare):[];
  if(!rows.length)$('forumComparables').innerHTML=emptyHTML('Benzer ilan yok',a?'Fiyatı kendin belirleyebilir veya taş benzerliğini değiştirebilirsin.':'Karşılaştırmak için varlık seç.');
  for(const item of rows){const b=document.createElement('button');b.type='button';b.className='forum-comparable';const aa=asset(item);b.innerHTML='<span class="forum-item-cell">'+icon(aa)+'<span>'+escape(name(aa))+'</span></span><span>'+(aa.class?'Sv. '+aa.level:'+'+(aa.enhancement||0))+'</span>'+priced(item.price);b.onclick=()=>dialog('İlan Ayrıntısı',detailHTML(aa,item.price,item.seller));$('forumComparables').append(b);}
  for(const id of ['forumPriceUnder','forumPriceSame','forumPriceSuggested'])$(id).disabled=busy||!!pending||!a||m.low==null;
 }
 function updatePrice(){
  const p=priceInfo($('forumPrice').value);$('forumNet').textContent=p?number(p.net):'—';$('forumPublish').disabled=busy||!!pending||!selling()||!p;
  $('forumPrice').disabled=busy||!!pending;
  for(const b of $('forumDuration').children){b.classList.toggle('active',Number(b.dataset.hours)===hours);b.setAttribute('aria-pressed',String(Number(b.dataset.hours)===hours));b.disabled=busy||!!pending;}
 }
 function openCreate(){if(!data||busy||pending)return;notice('');sellKey='';$('forumPrice').value='';hours=24;renderCreate();resetCompare();showView('create');$('forumAssetPicker').focus();}
 function dialog(heading,html){$('forumDialogTitle').textContent=heading;$('forumDialogBody').innerHTML=html;if(!$('forumDialogs').open)$('forumDialogs').showModal();$('forumDialogClose').focus();}
 function closeDialog(){if($('forumDialogs').open)$('forumDialogs').close();}
 function confirmBuy(){const r=picked();if(!r||$('forumBuy').disabled)return;dialog('Satın Almayı Onayla',detailHTML(asset(r),r.price,r.seller)+'<p>Bu satın alımda '+number(r.price)+' denarius ödeyeceksin.</p><div class="forum-confirm-actions"><button id="forumConfirmNo" type="button">Vazgeç</button><button id="forumConfirmYes" class="forum-gold" type="button">Satın Al</button></div>');$('forumConfirmNo').onclick=closeDialog;$('forumConfirmYes').onclick=()=>{closeDialog();act('buy',{listing_id:r.id,expected_price:Number(r.price)});};}
 function confirmCancel(r){dialog('İlanı Kaldır','<p><strong>'+escape(title(asset(r)))+'</strong> ilanını kaldırınca varlık yeniden kullanılabilir. Komisyon yalnızca satış gerçekleştiğinde kesilir.</p><div class="forum-confirm-actions"><button id="forumConfirmNo" type="button">Vazgeç</button><button id="forumConfirmYes" class="forum-gold" type="button">İlanı Kaldır</button></div>');$('forumConfirmNo').onclick=closeDialog;$('forumConfirmYes').onclick=()=>{closeDialog();act('cancel',{listing_id:r.id});};}
 function history(){const r=picked();if(!r)return;const a=asset(r),sales=(data?.sales||[]).filter(s=>s.kind===kind(a)&&s.model===model(a)&&Number(s.enhancement)===Number(a.enhancement||0));dialog('Fiyat Geçmişi',sales.length?'<p>'+escape(modelName(a))+' +'+(a.enhancement||0)+' · Gerçekleşen son satışlar</p>'+sales.map(s=>'<div class="forum-history-row"><span>'+new Date(s.sold_at).toLocaleString('tr-TR')+'</span>'+priced(s.price)+'</div>').join(''):'<p>Bu model ve artı seviyesi için henüz gerçekleşmiş bir satış yok.</p>');}
 function adopt(value){data=value;serverOffset=Date.parse(value.server_now)-Date.now();if(!Number.isFinite(serverOffset))serverOffset=0;basic.setGold(value.gold);populateModels();renderBrowse();if(view==='create')renderCreate();}
 async function loadMarket(){
  if(!owner||busy||loading)return;loading=true;renderBrowse();const seq=++loadSerial,authOwner=owner;
  try{const r=await basic.client.rpc('ludus_market',{p_action:'state'});if(r.error)throw r.error;if(seq!==loadSerial||owner!==authOwner)return;adopt(r.data);}
  catch(e){if(seq===loadSerial)notice('Forum Pazarı yüklenemedi: '+(e.message||'Bağlantıyı kontrol et.'),true,true);}
  finally{if(seq===loadSerial){loading=false;renderBrowse();}}
 }
 function validPending(p){const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;if(!p||p.owner!==owner||!uuid.test(p.request)||!['create','buy','cancel'].includes(p.action)||!p.payload)return false;return p.action==='create'?uuid.test(p.payload.asset_id)&&['item','gladiator'].includes(p.payload.asset_type)&&!!priceInfo(p.payload.price)&&[6,12,24].includes(p.payload.hours):uuid.test(p.payload.listing_id)&&(p.action!=='buy'||!!priceInfo(p.payload.expected_price));}
 function act(action,payload){
  if(busy||pending||!owner)return;const request={owner,action,payload,request:crypto.randomUUID()};
  try{localStorage.setItem(storageKey(),JSON.stringify(request));}catch{notice('Güvenli işlem kaydı oluşturulamadı. Tarayıcı depolamasını açıp tekrar dene.',false,true);return;}
  pending=request;submitPending();
 }
 async function submitPending(){
  if(!pending||busy||!validPending(pending))return;const request=pending,authOwner=owner;let refresh=false;busy=true;loadSerial++;loading=false;renderBrowse();if(view==='create')renderCreate();notice('Pazar işlemi kaydediliyor…',false,true);
  try{
   const r=await basic.client.rpc('ludus_market',{p_action:request.action,p_payload:request.payload,p_request:request.request});if(r.error)throw r.error;if(owner!==authOwner)return;
   try{localStorage.removeItem(storageKey());}catch{}pending=null;adopt(r.data);if(request.action==='create')showView('browse');
   notice(request.action==='create'?'İlanın Forum Pazarı’nda yayınlandı.':request.action==='cancel'?'İlan kaldırıldı. Varlık yeniden kullanılabilir.':'Satın alma tamamlandı. Varlık Ludus’una eklendi.');
  }catch(e){if(owner!==authOwner)return;if(['P0001','22P02','22003','23503','23514','42501','PGRST301'].includes(e.code)){try{localStorage.removeItem(storageKey());}catch{}pending=null;refresh=true;notice(e.message||'İşlem tamamlanamadı.',false,true);}else notice('İşlem sonucu doğrulanamadı. Aynı işlem kimliğiyle yeniden dene.',true,true);}
  finally{if(owner===authOwner){busy=false;renderBrowse();if(view==='create')renderCreate();if(refresh)loadMarket();}}
 }
 function connect(){
  const current=basic.getOwner();if(!current)return;
  if(owner===current){if(section==='forum'&&!data)loadMarket();return;}
  owner=current;data=null;selected=null;loadSerial++;pending=null;
  try{const saved=JSON.parse(localStorage.getItem(storageKey()));if(validPending(saved))pending=saved;}catch{}
  const restored=globalThis.LudusNavigation?.restore();
  if(restored?.forumFilters&&kinds[restored.forumFilters.kind]){for(const k of Object.keys(filters))if(typeof restored.forumFilters[k]==='string')filters[k]=restored.forumFilters[k];selected=restored.forumSelected||null;syncFilters();renderCategories();}
  if(pending){showSection('forum');submitPending();}else if(restored?.marketSection==='forum'||new URL(location.href).searchParams.get('market')==='forum')showSection('forum');else if(section==='forum')loadMarket();
 }
 for(const b of document.querySelectorAll('[data-market-section]'))b.onclick=()=>showSection(b.dataset.marketSection);
 $('forumFiltersToggle').onclick=()=>{const open=$('forumFilters').hidden;$('forumFilters').hidden=!open;$('forumFiltersToggle').setAttribute('aria-expanded',String(open));};
 for(const [key,id]of [['query','forumQuery'],['model','forumModel'],['plus','forumPlus'],['stone','forumStone'],['max','forumMaxPrice'],['sort','forumSort']])$(id).addEventListener(key==='query'||key==='max'?'input':'change',()=>{filters[key]=$(id).value;renderBrowse();});
 options($('forumPlus'),Array.from({length:16},(_,i)=>[String(i),'+'+i]),'','Tümü');renderCategories();
 $('forumClearFilters').onclick=clearFilters;$('forumReload').onclick=()=>pending?submitPending():loadMarket();$('forumNewListing').onclick=openCreate;$('forumCancelCreate').onclick=()=>showView('browse');$('forumBackList').onclick=()=>showView('browse');
 $('forumAssetPicker').onchange=()=>{sellKey=$('forumAssetPicker').value;resetCompare();renderSellDetail();renderCompare();updatePrice();};
 $('forumPrice').oninput=updatePrice;for(const b of $('forumDuration').children)b.onclick=()=>{hours=Number(b.dataset.hours);updatePrice();};
 for(const [id,which]of [['forumPriceUnder','under'],['forumPriceSame','same'],['forumPriceSuggested','suggested']])$(id).onclick=()=>{const r=selling();if(!r)return;const m=marketMetrics(r.a);if(m.low==null)return;$('forumPrice').value=String(which==='under'?Math.max(1,Number(m.low)-1):which==='same'?m.low:Math.round(Number(m.average)));updatePrice();};
 for(const [key,id]of [['model','forumCompareModel'],['plus','forumComparePlus'],['stone','forumCompareStone']])$(id).onchange=()=>{compare[key]=$(id).value;renderCompare();};
 $('forumCreate').onsubmit=e=>{e.preventDefault();const r=selling(),p=priceInfo($('forumPrice').value);if(!r||!p||$('forumPublish').disabled)return;act('create',{asset_type:r.type,asset_id:r.a.id,price:p.price,hours});};
 $('forumBuy').onclick=confirmBuy;$('forumHistory').onclick=history;$('forumSimilar').onclick=()=>{const r=picked();if(!r)return;const a=asset(r);filters.kind=kind(a);filters.model=model(a);filters.plus=String(a.enhancement||0);filters.query='';renderCategories();populateModels();syncFilters();renderBrowse();};
 $('forumDialogClose').onclick=closeDialog;$('forumDialogs').onclick=e=>{if(e.target===$('forumDialogs')){const r=$('forumDialogs').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}};
 globalThis.LudusNavigation?.register(()=>({...basic.getNavigationState(),marketSection:section,forumFilters:{...filters},forumSelected:selected}));
 globalThis.addEventListener('ludus-basic-market-ready',connect);
 globalThis.addEventListener('ludus-basic-market-gold',e=>{if(data){data.gold=e.detail.gold;renderSelection();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&section==='forum'&&owner)loadMarket();});
 if(new URL(location.href).searchParams.get('market')==='forum')showSection('forum');else renderBrowse();connect();
})();
