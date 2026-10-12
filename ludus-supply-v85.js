/* All yields, clocks, worker entitlements and crafting are authoritative RPC data. */
var LudusSupply=(()=>{
 'use strict';
 const num=n=>Number(n||0).toLocaleString('tr-TR');
 const kindNames={weapon:'Silah',shield:'Kalkan',helmet:'Miğfer',chest:'Göğüs zırhı',gloves:'Kol koruyucu',legs:'Bacak koruyucu'};
 const paths={mine:'M3 18 10 5l4 7 3-4 5 10ZM8 15l3-5m3 5 3-3',tree:'m12 3-7 7h3l-5 6h7v5h4v-5h7l-5-6h3Z',leaf:'M5 20C3 7 10 3 20 4c1 12-5 17-12 12m-3 4L16 8',fish:'M4 12c6-9 12-7 16 0-4 7-10 9-16 0Zm0 0-3-5v10Zm11-2h.01',jar:'M9 3h6v4c0 3 5 3 5 9 0 4-3 5-8 5s-8-1-8-5c0-6 5-6 5-9ZM8 3h8M6 13h12',hunt:'M5 4 20 19M5 20 20 4M5 4l1 5 4-4M15 4h5v5',map:'m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2Zm6-2v15m6-12v15',forge:'M3 9h18l-5 5h-2v5h4v2H6v-2h4v-5H7ZM7 3l4 3-2 3-5-3Z'};
 function icon(kind){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[kind]||paths.leaf)+'"/></svg>';}
 function routeIcon(id){return ['iron','copper'].includes(id)?'mine':id==='wood'?'tree':id==='fish'?'fish':id==='hunt'?'hunt':['wine','olive_oil'].includes(id)?'jar':'leaf';}
 function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function button(text,fn,cls=''){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 const artRoot='assets/supply-v86/';
 // Game destinations around the illustrated city, not real mineral deposits.
 const positions={iron:[88,64],copper:[89,14],wood:[10,16],hunt:[35,13],linen:[62,14],olive_oil:[60,73],grain:[89,40],apple:[82,85],fish:[27,65],egg:[49,88],wine:[12,84]};
 const shortNames={iron:'Demir',copper:'Bakır',wood:'Orman',hunt:'Av sahası',linen:'Keten',grain:'Tahıl',apple:'Elma',fish:'Balık',egg:'Çiftlik',wine:'Bağ',olive_oil:'Zeytinlik'};
 const uses={iron:'Silah ve zırh üretimi için demir.',copper:'Basic ekipman üretimi için bakır.',wood:'Silah, kalkan ve ekipman için odun.',hunt:'Yemekhaneye et, demirciye deri sağlar.',linen:'Ekipman üretimi için keten.',grain:'Yemekhanenin tahıl stoğunu tamamlar.',apple:'Yemekhanenin meyve stoğunu tamamlar.',fish:'Yemekhaneye balık sağlar.',egg:'Yemekhaneye yumurta sağlar.',wine:'Yemekhane için şarap getirir.',olive_oil:'Yalnızca en yüksek kalite menüde kullanılır.'};
 function picture(id,alt,cls=''){const img=el('img',cls);img.src=artRoot+id+'.webp';img.alt=alt;img.width=1536;img.height=1024;img.decoding='async';img.draggable=false;return img;}
 function create(ctx){
  let state=null,owner=null,key=null,pending=null,busy=false,loading=null,opened=false,mode='trade',tab='map',selected=null,workers=1,filter='all',page=0,lastFocus=null,offset=0,lastRefresh=0,lastTick=0;
  const opener=button('',()=>open(),'room-world-action supply-open');opener.hidden=true;opener.id='supplyOpen';document.body.append(opener);
  const modal=el('section','supply-modal');modal.id='supplyModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','supplyTitle');
  const frame=el('div','supply-frame'),head=el('header','supply-head'),heading=el('div');heading.append(el('small','','COLOSSEUM & LUDUS'));
  const title=el('h1','','Roma ve çevresi');title.id='supplyTitle';heading.append(title);
  const closeButton=button('×',close,'supply-close');closeButton.setAttribute('aria-label','Pencereyi kapat');head.append(heading,closeButton);
  const summary=el('div','supply-summary'),tabs=el('nav','supply-tabs'),content=el('div','supply-content'),footer=el('footer','supply-footer'),status=el('p','supply-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const retry=button('Yeniden dene',()=>pending?submit():refresh(),'supply-secondary');retry.hidden=true;footer.append(status,retry);frame.append(head,summary,tabs,content,footer);modal.append(frame);document.body.append(modal);
  const point=ctx.T?new ctx.T.Vector3(0,1.65,0):null;
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function resource(sku){return state?.resources.find(r=>r.sku===sku);}
  function names(cargo,mult=1){return Object.entries(cargo).map(([sku,n])=>num(n*mult)+' '+(resource(sku)?.name||sku)).join(' · ');}
  function remaining(job){const seconds=Math.max(0,Math.ceil((Date.parse(job.ends_at)-Date.now()-offset)/1000));return seconds?Math.floor(seconds/3600)+' sa '+Math.floor(seconds%3600/60)+' dk '+seconds%60+' sn':'Döndü · Teslim alınabilir';}
  async function identify(){if(owner)return;const account=await ctx.ready;owner=account.user_id;key='ludus-supply-pending-v85:'+owner;try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old?.owner===owner&&['send','claim','craft'].includes(old.action)&&old.request&&typeof old.key==='string')pending=old;}catch{message('Önceki işlem kaydı okunamadı.',true);}}
  function adopt(data){if(!data||data.user_id!==owner)throw Error('Hesap doğrulanamadı. Sayfayı yenile.');state=data;offset=Date.parse(data.server_now)-Date.now();lastRefresh=Date.now();workers=Math.max(1,Math.min(workers,state.free_workers||1));render();}
  async function refresh(){if(loading||busy)return loading;loading=(async()=>{await identify();const r=await ctx.client.rpc('ludus_supply');if(r.error)throw r.error;adopt(r.data);message(pending?'Önceki işlemin sonucu bekliyor. Yeniden dene ile kontrol et.':'');retry.hidden=!pending;})().catch(e=>{message(e.message||'Tedarik bilgileri yüklenemedi.',true);retry.hidden=false;}).finally(()=>{loading=null;render();});render();return loading;}
  async function act(action,target,count=1){if(busy||loading||pending||!state)return;pending={owner,action,key:target,workers:count,request:crypto.randomUUID()};try{localStorage.setItem(key,JSON.stringify(pending));}catch{pending=null;message('İşlem kaydı saklanamadı. Tarayıcı depolamasını açıp yeniden dene.',true);return;}return submit();}
  async function submit(){if(busy||!pending)return;busy=true;retry.hidden=true;message('İşlem kaydediliyor…');render();
   try{const p=pending,r=await ctx.client.rpc('ludus_supply',{p_action:p.action,p_key:p.key,p_workers:p.workers,p_request:p.request});if(r.error){if(['P0001','22003','22P02','23514'].includes(r.error.code)){pending=null;try{localStorage.removeItem(key);}catch{}}throw r.error;}
    pending=null;try{localStorage.removeItem(key);}catch{}adopt(r.data);message(r.data.result?.message||'İşlem tamamlandı.');ctx.onChange?.(p.action);window.dispatchEvent(new CustomEvent('ludus-supply-change',{detail:{action:p.action}}));
   }catch(e){message(e.message||'Yanıt alınamadı. Aynı işlemi yeniden deneyebilirsin.',true);retry.hidden=!pending;}finally{busy=false;render();}
  }
  function disabled(){return busy||!!pending||!!loading;}
  function render(){
   const active=document.activeElement,focusId=content.contains(active)?active.id:null;
   title.textContent=mode==='forge'?'Demirci':'Tedarik';modal.setAttribute('aria-busy',String(busy||!!loading));summary.replaceChildren();tabs.replaceChildren();content.replaceChildren();
   if(!state){content.append(el('p','supply-empty',loading?'Tedarik defteri açılıyor…':'Tedarik bilgileri henüz yüklenmedi.'));return;}
   for(const [label,value]of [['Boş işçi',state.free_workers+' / '+state.workers],['Görevde',state.busy_workers],['Seviye',state.level]]){const box=el('div');box.append(el('small','',label),el('strong','',value));summary.append(box);}
   const refreshButton=button('Yenile',refresh,'supply-secondary');refreshButton.disabled=disabled();summary.append(refreshButton);
   const choices=mode==='forge'?[['craft','Basic üretim'],['stock','Malzemeler']]:[['map','Roma haritası'],['jobs','Seferler · '+state.jobs.length],['stock','Stoklar']];
   for(const [value,label]of choices){const b=button(label,()=>{tab=value;page=0;selected=null;render();tabs.querySelector('[aria-pressed=true]')?.focus()});b.setAttribute('aria-pressed',String(tab===value));tabs.append(b);}
   if(tab==='map')selected?renderDestination():renderMap();else if(tab==='jobs')renderJobs();else if(tab==='craft')renderCraft();else renderStock();
   if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  }
  function reward(){
   if(state.unclaimed_workers>0){const a=el('a','supply-reward-link',state.unclaimed_workers+' işçi ödülünü al →');a.href='ludus-seviye.html?v=revision85';return a;}
   return el('small','supply-reward-note',state.next_worker_level?'Sonraki işçi: Seviye '+state.next_worker_level:'10 / 10 işçi açıldı');
  }
  function choose(id){selected=id;render();content.querySelector('.supply-back')?.focus({preventScroll:true});}
  function backToMap(){const old=selected;selected=null;render();content.querySelector('[data-destination="'+old+'"]')?.focus({preventScroll:true});}
  function renderMap(){
   const overview=el('div','supply-overview'),intro=el('div','supply-map-intro');intro.append(el('h2','','Roma ve çevresi'),el('span','','Bir bölgeye dokun'));
   const area=el('div','supply-map-area'),map=el('div','supply-map');map.setAttribute('aria-label','Roma çevresindeki tedarik bölgeleri');map.append(picture('rome-map','Kolezyum, Forum ve Tiber çevresinde Roma','supply-map-art'));
   for(const d of state.destinations){const node=button('',()=>choose(d.id),'supply-node'),p=positions[d.id]||[d.x,d.y];node.dataset.destination=d.id;node.style.left=p[0]+'%';node.style.top=p[1]+'%';node.title=d.name;node.setAttribute('aria-label',d.name+' · Bölgeyi aç');const glyph=el('span','supply-node-icon');glyph.innerHTML=icon(routeIcon(d.id));node.append(glyph,el('span','supply-node-name',shortNames[d.id]||d.name));map.append(node);}
   area.append(map);
   const controls=el('div','supply-map-controls'),label=el('label','supply-region-picker','Bölge'),select=el('select');select.setAttribute('aria-label','Tedarik bölgesi seç');select.id='supplyRegion';const empty=el('option','','Bölge seç…');empty.value='';select.append(empty);for(const d of state.destinations){const o=el('option','',d.name);o.value=d.id;select.append(o);}select.onchange=()=>{if(select.value)choose(select.value)};label.append(select);controls.append(label,reward());overview.append(intro,area,controls);content.append(overview);
  }
  function renderDestination(){
   const d=state.destinations.find(d=>d.id===selected);if(!d){selected=null;renderMap();return;}
   const bar=el('div','supply-location-bar'),back=button('‹ Harita',backToMap,'supply-secondary supply-back');bar.append(back,el('h2','',d.name),el('small','',d.seconds/3600+' saat · Ücretsiz'));content.append(bar);
   const layout=el('div','supply-location'),scene=el('figure','supply-scene');scene.append(picture(d.id,d.name+' — Roma çevresindeki tedarik bölgesi','supply-location-art'));const caption=el('figcaption');caption.append(el('small','','ROMA VE ÇEVRESİ'),el('strong','',d.name));scene.append(caption);
   const side=el('aside','supply-route');side.append(el('p','supply-description',uses[d.id]||d.description));
   const amount=el('div','supply-yield');amount.append(el('small','','1 İŞÇİ · '+d.seconds/3600+' SAAT'),el('strong','',names(d.yields)));side.append(amount);
   const label=el('label','supply-worker-label','Gönderilecek işçi'),stepper=el('span','supply-stepper'),input=el('input');input.id='supplyWorkerCount';input.type='number';input.inputMode='numeric';input.min='1';input.max=String(Math.max(1,state.free_workers));input.step='1';input.value=String(workers);input.disabled=disabled()||state.free_workers===0;
   const less=button('−',()=>step(-1),'supply-secondary'),more=button('+',()=>step(1),'supply-secondary');less.setAttribute('aria-label','Bir işçi azalt');more.setAttribute('aria-label','Bir işçi ekle');label.htmlFor=input.id;stepper.append(less,input,more);label.append(stepper);side.append(label);
   const preview=el('p','supply-preview'),send=button('İşçileri gönder',()=>act('send',d.id,Number(input.value)),'supply-primary');send.dataset.send=d.id;
   function step(delta){input.value=String(Math.max(1,Math.min(state.free_workers,Number(input.value)+delta)));update();}
   function update(){const n=Number(input.value),valid=Number.isInteger(n)&&n>=1&&n<=state.free_workers;if(valid)workers=n;preview.textContent=valid?'Dönüş yükü: '+names(d.yields,n):state.free_workers?'1–'+state.free_workers+' arasında işçi seç.':'Boş işçi bulunmuyor.';send.disabled=disabled()||!valid;less.disabled=input.disabled||n<=1;more.disabled=input.disabled||n>=state.free_workers;}input.oninput=update;update();side.append(preview,send,el('small','supply-trip-note','Çevrimdışıyken ilerler. Yükü Seferler’den teslim al.'),reward());layout.append(scene,side);content.append(layout);
  }
  function pageSlice(items,type){
   const width=content.clientWidth||Math.min(innerWidth-32,1000),height=content.clientHeight||Math.min(innerHeight-168,510);
   let cols=1,rows=1;if(type==='stock'){cols=width<560?2:4;rows=Math.max(1,Math.min(3,Math.floor((height-72)/100)));}else if(type==='craft'){cols=width<460?1:width<780?2:3;}else rows=Math.max(1,Math.min(3,Math.floor((height-64)/112)));
   const size=cols*rows,pages=Math.max(1,Math.ceil(items.length/size));page=Math.max(0,Math.min(page,pages-1));return {items:items.slice(page*size,(page+1)*size),pages,cols,rows};
  }
  function pager(pages){
   const nav=el('nav','supply-pagination');nav.setAttribute('aria-label','Liste sayfaları');
   const prev=button('‹',()=>{page--;render();content.querySelector('[data-page=prev]')?.focus()},'supply-secondary'),next=button('›',()=>{page++;render();content.querySelector('[data-page=next]')?.focus()},'supply-secondary');prev.dataset.page='prev';next.dataset.page='next';prev.setAttribute('aria-label','Önceki sayfa');next.setAttribute('aria-label','Sonraki sayfa');prev.disabled=page===0;next.disabled=page>=pages-1;nav.append(prev,el('span','',(page+1)+' / '+pages),next);return nav;
  }
  function listFooter(text,pages){const foot=el('div','supply-list-footer');foot.append(el('p','supply-note',text),pager(pages));content.append(foot);}
  function renderJobs(){
   if(!state.jobs.length){const empty=el('div','supply-empty');empty.append(el('h2','','İlk seferini başlat'),el('p','','Haritadan bir bölge seç ve boş işçilerini gönder.'),button('Roma haritasını aç',()=>{tab='map';selected=null;render()},'supply-primary'));content.append(empty);return;}
   const data=pageSlice(state.jobs,'jobs'),list=el('div','supply-jobs');list.style.setProperty('--supply-rows',data.rows);
   for(const j of data.items){const card=el('article','supply-job'),heading=el('div','supply-job-info'),d=state.destinations.find(d=>d.id===j.destination);heading.append(el('h2','',d?.name||j.destination),el('small','',j.workers+' işçi · '+names(j.cargo)));const time=el('p','supply-countdown',remaining(j));time.dataset.job=j.id;heading.append(time);
    const claim=button('Teslim al',()=>act('claim',j.id),'supply-primary');claim.dataset.claim=j.id;claim.disabled=disabled()||Date.parse(j.ends_at)>Date.now()+offset;
    card.append(picture(j.destination,'','supply-job-art'),heading,claim);list.append(card);}content.append(list);listFooter('Gıdalar yemekhaneye, malzemeler demirciye gider.',data.pages);
  }
  function renderStock(){
   const data=pageSlice(state.resources.filter(r=>mode!=='forge'||!r.food),'stock'),grid=el('div','supply-stock');grid.style.setProperty('--supply-cols',data.cols);grid.style.setProperty('--supply-rows',data.rows);
   for(const r of data.items){const card=el('article','supply-stock-card'),glyph=el('span','supply-stock-icon');glyph.innerHTML=icon(routeIcon(r.sku==='leather'||r.sku==='meat'?'hunt':r.sku==='beer'?'wine':r.sku));card.append(glyph,el('small','',r.food?'YEMEKHANE':'MALZEME'),el('h2','',r.name),el('strong','',num(r.quantity)));grid.append(card);}content.append(grid);listFooter('Ürün başına sınır: 50.000. Zeytinyağı: en yüksek kalite menü.',data.pages);
  }
  function renderCraft(){
   const label=el('label','supply-filter','Ekipman türü'),select=el('select');select.id='supplyCraftFilter';for(const [v,n]of [['all','Tüm ekipmanlar'],...Object.entries(kindNames)]){const option=el('option','',n);option.value=v;select.append(option);}select.value=filter;select.onchange=()=>{filter=select.value;page=0;render()};label.append(select);
   const data=pageSlice(state.recipes.filter(r=>filter==='all'||r.kind===filter),'craft'),grid=el('div','supply-recipes');grid.style.setProperty('--supply-cols',data.cols);
   for(const r of data.items){const card=el('article','supply-recipe');card.append(el('small','supply-kicker',kindNames[r.kind]+' · BASIC +0'),el('h2','',r.name));const requirements=el('ul');let enough=true;
    for(const [sku,n]of Object.entries(r.ingredients)){const stock=resource(sku),ok=(stock?.quantity||0)>=n;enough&&=ok;const li=el('li',ok?'':'supply-missing',(stock?.name||sku)+' · '+num(stock?.quantity)+' / '+n);requirements.append(li);}
    const craft=button(enough?'Üret':'Malzeme eksik',()=>act('craft',r.sku),'supply-primary');craft.dataset.craft=r.sku;craft.disabled=disabled()||!enough;card.append(requirements,craft);grid.append(card);}content.append(grid);const foot=el('div','supply-list-footer supply-craft-footer');foot.append(label,pager(data.pages));content.append(foot);
  }
  async function open(){if(opened||ctx.blocked?.()||!ctx.inRoom?.())return;opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();closeButton.focus();render();await refresh();}
  function close(){if(!opened)return;opened=false;modal.hidden=true;ctx.onClose?.();if(lastFocus?.isConnected&&!lastFocus.hidden)lastFocus.focus();}
  function enter(next='trade'){mode=next;selected=null;page=0;tab=mode==='forge'?'craft':'map';opener.innerHTML=icon(mode==='forge'?'forge':'map');opener.title=mode==='forge'?'Demircide üretim':'Tedarik haritası';opener.setAttribute('aria-label',opener.title);opener.hidden=false;}
  function leave(){opener.hidden=true;close();}
  function tick(){
   if(point&&globalThis.LudusRoomActions)globalThis.LudusRoomActions.place(opener,point,ctx,!!ctx.inRoom?.());
   if(!opened||!state||Date.now()-lastTick<1000)return;lastTick=Date.now();
   for(const j of state.jobs){const time=content.querySelector('[data-job="'+j.id+'"]');if(time)time.textContent=remaining(j);const claim=content.querySelector('[data-claim="'+j.id+'"]');if(claim)claim.disabled=disabled()||Date.parse(j.ends_at)>Date.now()+offset;}
   if(!busy&&!loading&&!pending&&Date.now()-lastRefresh>60000){lastRefresh=Date.now();refresh();}
  }
  modal.addEventListener('pointerdown',e=>e.stopPropagation());
  document.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(tab==='map'&&selected)backToMap();else close();}if(e.key==='Tab'){const all=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select,a[href]')].filter(n=>!n.hidden&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}},true);
  window.addEventListener('resize',()=>{if(opened)render();});
  return {enter,leave,tick,open,close,refresh,get state(){return state;},get pending(){return pending;}};
 }
 return {create};
})();
