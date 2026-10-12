/* All yields, clocks, worker entitlements and crafting are authoritative RPC data. */
var LudusSupply=(()=>{
 'use strict';
 const num=n=>Number(n||0).toLocaleString('tr-TR');
 const kindNames={weapon:'Silah',shield:'Kalkan',helmet:'Miğfer',chest:'Göğüs zırhı',gloves:'Kol koruyucu',legs:'Bacak koruyucu'};
 const paths={mine:'M3 18 10 5l4 7 3-4 5 10ZM8 15l3-5m3 5 3-3',tree:'m12 3-7 7h3l-5 6h7v5h4v-5h7l-5-6h3Z',leaf:'M5 20C3 7 10 3 20 4c1 12-5 17-12 12m-3 4L16 8',fish:'M4 12c6-9 12-7 16 0-4 7-10 9-16 0Zm0 0-3-5v10Zm11-2h.01',jar:'M9 3h6v4c0 3 5 3 5 9 0 4-3 5-8 5s-8-1-8-5c0-6 5-6 5-9ZM8 3h8M6 13h12',hunt:'M5 4 20 19M5 20 20 4M5 4l1 5 4-4M15 4h5v5',map:'m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2Zm6-2v15m6-12v15',chest:'M3 10V7l3-3h12l3 3v13H3ZM3 10h18M10 10v5h4v-5',expand:'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',forge:'M3 9h18l-5 5h-2v5h4v2H6v-2h4v-5H7ZM7 3l4 3-2 3-5-3Z'};
 function icon(kind){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[kind]||paths.leaf)+'"/></svg>';}
 function routeIcon(id){return ['iron','copper'].includes(id)?'mine':id==='wood'?'tree':id==='fish'?'fish':id==='hunt'?'hunt':['wine','olive_oil'].includes(id)?'jar':'leaf';}
 function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function button(text,fn,cls=''){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 const artRoot='assets/supply-v86/';
 const artURL=id=>id==='rome-map'?'assets/supply-v91/rome-panorama.webp':artRoot+id+'.webp';
 // Game destinations around the illustrated city, not real mineral deposits.
 const positions={iron:[88,64],copper:[89,14],wood:[10,16],hunt:[35,13],linen:[62,14],olive_oil:[60,73],grain:[89,40],apple:[82,85],fish:[27,65],egg:[49,88],wine:[12,84]};
 const shortNames={iron:'Demir',copper:'Bakır',wood:'Orman',hunt:'Av sahası',linen:'Keten',grain:'Tahıl',apple:'Elma',fish:'Balık',egg:'Çiftlik',wine:'Bağ',olive_oil:'Zeytinlik'};
 const uses={iron:'Silah ve zırh üretimi için demir.',copper:'Basic ekipman üretimi için bakır.',wood:'Silah, kalkan ve ekipman için odun.',hunt:'Yemekhaneye et, demirciye deri sağlar.',linen:'Ekipman üretimi için keten.',grain:'Yemekhanenin tahıl stoğunu tamamlar.',apple:'Yemekhanenin meyve stoğunu tamamlar.',fish:'Yemekhaneye balık sağlar.',egg:'Yemekhaneye yumurta sağlar.',wine:'Yemekhane için şarap getirir.',olive_oil:'Yalnızca en yüksek kalite menüde kullanılır.'};
 function picture(id,alt,cls=''){const img=el('img',cls);img.src=artURL(id);img.alt=alt;img.width=id==='rome-map'?1774:1200;img.height=id==='rome-map'?887:800;img.decoding='async';img.draggable=false;return img;}
 function create(ctx){
  let state=null,owner=null,key=null,pending=null,busy=false,loading=null,opened=false,mode='trade',tab='map',selected=null,workers=1,filter='all',craftSelection=null,page=0,lastFocus=null,offset=0,lastRefresh=0,lastTick=0,artOpen=false,artFocus=null,artReturn='.supply-art-expand',seenDeliveries=new Set();
  const opener=button('',()=>open(),'room-world-action supply-open');opener.hidden=true;opener.id='supplyOpen';document.body.append(opener);
  const chestOpener=button('',()=>open('stock'),'room-world-action supply-open');chestOpener.id='supplyChestOpen';chestOpener.hidden=true;chestOpener.innerHTML=icon('chest');chestOpener.title='Tedarik kasasını aç';chestOpener.setAttribute('aria-label',chestOpener.title);document.body.append(chestOpener);const chestCount=el('span','supply-chest-count');chestCount.hidden=true;chestCount.setAttribute('aria-hidden','true');chestOpener.append(chestCount);
  const modal=el('section','supply-modal');modal.id='supplyModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','supplyTitle');
  const frame=el('div','supply-frame'),head=el('header','supply-head'),heading=el('div');heading.append(el('small','','COLOSSEUM & LUDUS'));
  const title=el('h1','','Roma ve çevresi');title.id='supplyTitle';heading.append(title);
  const closeButton=button('×',close,'supply-close');closeButton.setAttribute('aria-label','Pencereyi kapat');head.append(heading,closeButton);
  const summary=el('div','supply-summary'),tabs=el('nav','supply-tabs'),content=el('div','supply-content'),footer=el('footer','supply-footer'),status=el('p','supply-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  tabs.setAttribute('aria-label','Tedarik bölümleri');head.insertBefore(tabs,closeButton);
  const retry=button('Yeniden dene',()=>pending?submit():refresh(),'supply-secondary');retry.hidden=true;footer.append(status,retry);frame.append(head,summary,content,footer);modal.append(frame);document.body.append(modal);
  const gallery=el('section','supply-gallery');gallery.hidden=true;gallery.setAttribute('role','dialog');gallery.setAttribute('aria-modal','true');gallery.setAttribute('aria-label','Bölge görseli');
  const galleryBar=el('div','supply-gallery-bar'),galleryName=el('span'),galleryClose=button('×',closeArt,'supply-gallery-close');galleryClose.setAttribute('aria-label','Görseli kapat');galleryBar.append(galleryName,galleryClose);
  const galleryStage=el('div','supply-gallery-stage'),galleryImage=el('img','supply-gallery-image');galleryImage.alt='';galleryImage.draggable=false;galleryStage.append(galleryImage);
  const galleryControls=el('div','supply-gallery-controls'),zoomOut=button('−',()=>zoomAt(view.zoom-.25),'supply-gallery-control'),zoomLevel=el('output','supply-gallery-level','100%'),zoomIn=button('+',()=>zoomAt(view.zoom+.25),'supply-gallery-control'),zoomFit=button('Sığdır',fitArt,'supply-gallery-fit'),galleryHint=el('small','supply-gallery-hint','Yakınlaştır · Sürükle');
  zoomOut.setAttribute('aria-label','Görseli uzaklaştır');zoomIn.setAttribute('aria-label','Görseli yakınlaştır');zoomFit.setAttribute('aria-label','Görselin tamamını göster');zoomLevel.setAttribute('aria-label','Yakınlaştırma oranı');galleryControls.append(zoomOut,zoomLevel,zoomIn,zoomFit,galleryHint);gallery.append(galleryBar,galleryStage,galleryControls);document.body.append(gallery);
  const view={zoom:1,x:0,y:0},pointers=new Map();let gesture=null,lastTap=null,lastTouchAt=0;
  function stageSize(){const r=galleryStage.getBoundingClientRect();return {r,w:r.width||galleryStage.clientWidth,h:r.height||galleryStage.clientHeight};}
  function paintArt(){
   const {w,h}=stageSize(),ratio=(galleryImage.naturalWidth||1200)/(galleryImage.naturalHeight||800),fitW=Math.min(w,h*ratio),fitH=Math.min(h,w/ratio);
   const maxX=Math.max(0,(fitW*view.zoom-w)/2),maxY=Math.max(0,(fitH*view.zoom-h)/2);view.x=Math.max(-maxX,Math.min(maxX,view.x));view.y=Math.max(-maxY,Math.min(maxY,view.y));
   galleryImage.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.zoom+')';galleryStage.dataset.zoomed=String(view.zoom>1);zoomLevel.value=Math.round(view.zoom*100)+'%';zoomOut.disabled=view.zoom<=1;zoomIn.disabled=view.zoom>=4;
  }
  function zoomAt(value,clientX,clientY){const {r,w,h}=stageSize(),x=clientX===undefined?0:clientX-r.left-w/2,y=clientY===undefined?0:clientY-r.top-h/2,z=Math.max(1,Math.min(4,value)),ratio=z/view.zoom;view.x=x-(x-view.x)*ratio;view.y=y-(y-view.y)*ratio;view.zoom=z;paintArt();}
  function fitArt(){Object.assign(view,{zoom:1,x:0,y:0});pointers.clear();gesture=null;paintArt();}
  function showArt(id,name){artFocus=document.activeElement;artReturn=id==='rome-map'?'.supply-map-expand':'.supply-art-expand';artOpen=true;galleryName.textContent=name;galleryImage.src=artURL(id);galleryImage.alt=name;galleryHint.textContent='Yakınlaştır · Sürükle';gallery.hidden=false;modal.inert=true;modal.setAttribute('aria-hidden','true');lastTap=null;fitArt();galleryClose.focus();}
  function closeArt(){if(!artOpen)return;artOpen=false;pointers.clear();gesture=null;gallery.hidden=true;modal.inert=false;modal.removeAttribute('aria-hidden');(artFocus?.isConnected?artFocus:content.querySelector(artReturn)||closeButton).focus({preventScroll:true});}
  function beginGesture(){const ps=[...pointers.values()],{r,w,h}=stageSize();gesture=ps.length>1?{zoom:view.zoom,x:view.x,y:view.y,distance:Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)),cx:(ps[0].x+ps[1].x)/2-r.left-w/2,cy:(ps[0].y+ps[1].y)/2-r.top-h/2}:null;if(ps.length>1){lastTap=null;for(const p of ps)p.dragged=true;}}
  galleryImage.onload=()=>{if(artOpen)paintArt();};galleryImage.onerror=()=>{galleryHint.textContent='Görsel yüklenemedi. Kapatıp yeniden dene.';};
  galleryStage.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragged:false});galleryStage.setPointerCapture?.(e.pointerId);beginGesture();});
  galleryStage.addEventListener('pointermove',e=>{
   const p=pointers.get(e.pointerId);if(!p)return;e.preventDefault();const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(Math.hypot(p.x-p.startX,p.y-p.startY)>6)p.dragged=true;
   if(pointers.size>1&&gesture){const ps=[...pointers.values()],{r,w,h}=stageSize(),z=Math.max(1,Math.min(4,gesture.zoom*Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)/gesture.distance)),ratio=z/gesture.zoom;view.x=(ps[0].x+ps[1].x)/2-r.left-w/2-(gesture.cx-gesture.x)*ratio;view.y=(ps[0].y+ps[1].y)/2-r.top-h/2-(gesture.cy-gesture.y)*ratio;view.zoom=z;}
   else if(view.zoom>1){view.x+=dx;view.y+=dy;}paintArt();
  });
  function endPointer(e){const p=pointers.get(e.pointerId);if(!p)return;const tap=e.type==='pointerup'&&e.pointerType==='touch'&&pointers.size===1&&!p.dragged;pointers.delete(e.pointerId);if(tap){const now=Date.now();lastTouchAt=now;if(lastTap&&now-lastTap.at<320&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<24){zoomAt(view.zoom>1?1:2,p.x,p.y);lastTap=null;}else lastTap={at:now,x:p.x,y:p.y};}else lastTap=null;beginGesture();}
  for(const event of ['pointerup','pointercancel','lostpointercapture'])galleryStage.addEventListener(event,endPointer);
  galleryStage.addEventListener('dblclick',e=>{e.preventDefault();if(e.pointerType!=='touch'&&Date.now()-lastTouchAt>500)zoomAt(view.zoom>1?1:2,e.clientX,e.clientY);});
  galleryStage.addEventListener('wheel',e=>{e.preventDefault();zoomAt(view.zoom*Math.exp(-e.deltaY*.0015),e.clientX,e.clientY);},{passive:false});
  function artKey(e){
   e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();closeArt();return;}
   if(e.key==='Tab'){e.preventDefault();const buttons=[galleryClose,zoomOut,zoomIn,zoomFit].filter(b=>!b.disabled),i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();return;}
   if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='=')zoomAt(view.zoom+.25);else if(e.key==='-')zoomAt(view.zoom-.25);else if(e.key==='0')fitArt();else{view.x+=e.key==='ArrowLeft'?48:e.key==='ArrowRight'?-48:0;view.y+=e.key==='ArrowUp'?48:e.key==='ArrowDown'?-48:0;paintArt();}}
  }
  const point=ctx.T?new ctx.T.Vector3(0,1.65,0):null,chestPoint=ctx.T?new ctx.T.Vector3(-3.6,1.45,1.02):null;
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);footer.hidden=!text&&retry.hidden;}
  function resource(sku){return state?.resources.find(r=>r.sku===sku);}
  function names(cargo,mult=1){return Object.entries(cargo).map(([sku,n])=>num(n*mult)+' '+(resource(sku)?.name||sku)).join(' · ');}
  function remaining(job){const seconds=Math.max(0,Math.ceil((Date.parse(job.ends_at)-Date.now()-offset)/1000));return seconds?Math.floor(seconds/3600)+' sa '+Math.floor(seconds%3600/60)+' dk '+seconds%60+' sn':job.delivery_check_at?'Kasa dolu · Yük güvende':'Kasaya aktarılıyor…';}
  function unseen(){return (state?.deliveries||[]).filter(j=>!seenDeliveries.has(j.id));}
  function updateChest(){const n=unseen().length;chestOpener.dataset.state=n?'ready':'idle';chestCount.hidden=!n;chestCount.textContent=String(n);chestOpener.title='Tedarik kasasını aç'+(n?' · '+n+' yeni teslimat':'');chestOpener.setAttribute('aria-label',chestOpener.title);}
  function acknowledge(){const rows=state?.deliveries||[];if(!rows.some(j=>!seenDeliveries.has(j.id)))return;seenDeliveries=new Set([...seenDeliveries,...rows.map(j=>j.id)].slice(-50));try{localStorage.setItem('ludus-supply-seen-v88:'+owner,JSON.stringify([...seenDeliveries]));}catch{}updateChest();}
  async function identify(){if(owner)return;const account=await ctx.ready;owner=account.user_id;key='ludus-supply-pending-v85:'+owner;try{const seen=JSON.parse(localStorage.getItem('ludus-supply-seen-v88:'+owner)||'[]');if(Array.isArray(seen))seenDeliveries=new Set(seen.filter(id=>typeof id==='string').slice(-50));}catch{}try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old?.owner===owner&&['send','claim','craft'].includes(old.action)&&old.request&&typeof old.key==='string')pending=old;}catch{message('Önceki işlem kaydı okunamadı.',true);}}
  function adopt(data){if(!data||data.user_id!==owner)throw Error('Hesap doğrulanamadı. Sayfayı yenile.');const oldDeliveries=state?.deliveries?.map(j=>j.id)||[];const received=!!state&&(data.deliveries||[]).some(j=>!oldDeliveries.includes(j.id));state=data;updateChest();if(received)ctx.onChange?.('delivery');offset=Date.parse(data.server_now)-Date.now();lastRefresh=Date.now();workers=Math.max(1,Math.min(workers,state.free_workers||1));render();}
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
   title.textContent=mode==='forge'?'Demirci':tab==='stock'?'Tedarik kasası':'Tedarik';ctx.onChestOpen?.(opened&&mode==='trade'&&tab==='stock');modal.setAttribute('aria-busy',String(busy||!!loading));modal.dataset.view=tab==='map'&&selected?'destination':tab;modal.dataset.mode=mode;summary.replaceChildren();tabs.replaceChildren();content.replaceChildren();frame.insertBefore(summary,content);footer.hidden=!status.textContent&&retry.hidden;
   if(opened&&mode==='trade'&&tab==='stock')acknowledge();
   if(!state){content.append(el('p','supply-empty',loading?'Tedarik defteri açılıyor…':'Tedarik bilgileri henüz yüklenmedi.'));return;}
   for(const [label,value]of [['Boş işçi',state.free_workers+' / '+state.workers],['Seferde',state.busy_workers],['Ludus seviyesi',state.level]]){const box=el('div');box.append(el('small','',label),el('strong','',value));summary.append(box);}
   const refreshButton=button('Yenile',refresh,'supply-secondary');refreshButton.disabled=disabled();summary.append(refreshButton);
   const choices=mode==='forge'?[['craft','Basic üretim'],['stock','Malzemeler']]:[['map','Roma haritası'],['jobs','Seferler · '+state.jobs.length],['stock','Kasa']];
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
   const overview=el('div','supply-overview'),side=el('aside','supply-map-sidebar'),intro=el('div','supply-map-intro');intro.append(el('small','supply-kicker','TEDARİK BÖLGELERİ'),el('h2','','Roma ve çevresi'),el('p','','Bir simgeye dokun, bölgeyi keşfet.'));
   const artButton=button('Haritayı incele',()=>showArt('rome-map','Roma ve çevresi'),'supply-secondary supply-map-expand');
   const area=el('div','supply-map-area'),map=el('div','supply-map');map.setAttribute('aria-label','Roma çevresindeki tedarik bölgeleri');map.append(picture('rome-map','Kolezyum, Forum ve Tiber çevresinde Roma','supply-map-art'));
   for(const d of state.destinations){const node=button('',()=>choose(d.id),'supply-node'),p=positions[d.id]||[d.x,d.y];node.dataset.destination=d.id;node.style.left=p[0]+'%';node.style.top=p[1]+'%';node.title=d.name;node.setAttribute('aria-label',d.name+' · Bölgeyi aç');const glyph=el('span','supply-node-icon');glyph.innerHTML=icon(routeIcon(d.id));node.append(glyph,el('span','supply-node-name',shortNames[d.id]||d.name));map.append(node);}
   area.append(map);
   const controls=el('div','supply-map-controls'),label=el('label','supply-region-picker','Bölge seçimi'),select=el('select');select.setAttribute('aria-label','Tedarik bölgesi seç');select.id='supplyRegion';const empty=el('option','','Bölge seç…');empty.value='';select.append(empty);for(const d of state.destinations){const o=el('option','',d.name);o.value=d.id;select.append(o);}select.onchange=()=>{if(select.value)choose(select.value)};label.append(select);controls.append(label,artButton,reward());side.append(intro,summary,controls);overview.append(area,side);content.append(overview);
  }
  function renderDestination(){
   const d=state.destinations.find(d=>d.id===selected);if(!d){selected=null;renderMap();return;}
   const bar=el('div','supply-location-bar'),back=button('‹ Harita',backToMap,'supply-secondary supply-back');bar.append(back,el('h2','',d.name),el('small','',d.seconds/3600+' saat · Ücretsiz'));content.append(bar);
   const layout=el('div','supply-location'),scene=el('figure','supply-scene');scene.append(picture(d.id,d.name+' — Roma çevresindeki tedarik bölgesi','supply-location-art'));const expand=button('Görseli büyüt',()=>showArt(d.id,d.name),'supply-art-expand');expand.setAttribute('aria-label',d.name+' görselini tam aç');scene.append(expand);scene.querySelector('img').onclick=()=>showArt(d.id,d.name);
   const side=el('aside','supply-route');side.append(el('p','supply-description',uses[d.id]||d.description));
   const amount=el('div','supply-yield');amount.append(el('small','','1 İŞÇİ · '+d.seconds/3600+' SAAT'),el('strong','',names(d.yields)));side.append(amount);
   const label=el('label','supply-worker-label','Gönderilecek işçi'),stepper=el('span','supply-stepper'),input=el('input');input.id='supplyWorkerCount';input.type='number';input.inputMode='numeric';input.min='1';input.max=String(Math.max(1,state.free_workers));input.step='1';input.value=String(workers);input.disabled=disabled()||state.free_workers===0;
   const less=button('−',()=>step(-1),'supply-secondary'),more=button('+',()=>step(1),'supply-secondary');less.setAttribute('aria-label','Bir işçi azalt');more.setAttribute('aria-label','Bir işçi ekle');label.htmlFor=input.id;stepper.append(less,input,more);label.append(stepper);side.append(label);
   const preview=el('p','supply-preview'),send=button('İşçileri gönder',()=>act('send',d.id,Number(input.value)),'supply-primary');send.dataset.send=d.id;
   function step(delta){input.value=String(Math.max(1,Math.min(state.free_workers,Number(input.value)+delta)));update();}
   function update(){const n=Number(input.value),valid=Number.isInteger(n)&&n>=1&&n<=state.free_workers;if(valid)workers=n;preview.textContent=valid?'Dönüş yükü: '+names(d.yields,n):state.free_workers?'1–'+state.free_workers+' arasında işçi seç.':'Boş işçi bulunmuyor.';send.disabled=disabled()||!valid;less.disabled=input.disabled||n<=1;more.disabled=input.disabled||n>=state.free_workers;}input.oninput=update;update();side.append(preview,send,el('small','supply-trip-note','Dönüşte ürünler kasaya otomatik eklenir.'),reward());layout.append(scene,side);content.append(layout);
  }
  function pageSlice(items){
   const height=content.clientHeight||Math.min(innerHeight-168,510),rows=Math.max(1,Math.min(3,Math.floor((height-64)/112))),pages=Math.max(1,Math.ceil(items.length/rows));page=Math.max(0,Math.min(page,pages-1));return {items:items.slice(page*rows,(page+1)*rows),pages,rows};
  }
  function pager(pages){
   const nav=el('nav','supply-pagination');nav.setAttribute('aria-label','Liste sayfaları');
   const prev=button('‹',()=>{page--;render();content.querySelector('[data-page=prev]')?.focus()},'supply-secondary'),next=button('›',()=>{page++;render();content.querySelector('[data-page=next]')?.focus()},'supply-secondary');prev.dataset.page='prev';next.dataset.page='next';prev.setAttribute('aria-label','Önceki sayfa');next.setAttribute('aria-label','Sonraki sayfa');prev.disabled=page===0;next.disabled=page>=pages-1;nav.append(prev,el('span','',(page+1)+' / '+pages),next);return nav;
  }
  function listFooter(text,pages){const foot=el('div','supply-list-footer');foot.append(el('p','supply-note',text),pager(pages));content.append(foot);}
  function renderJobs(){
   const rows=[...state.jobs.map(j=>({...j,delivered:false})),...(state.deliveries||[]).map(j=>({...j,delivered:true}))];
   if(!rows.length){const empty=el('div','supply-empty');empty.append(el('h2','','İlk seferini başlat'),el('p','','Dönen işçiler ürünleri kasaya otomatik bırakır.'),button('Roma haritasını aç',()=>{tab='map';selected=null;render()},'supply-primary'));content.append(empty);return;}
   const data=pageSlice(rows),list=el('div','supply-jobs');list.style.setProperty('--supply-rows',data.rows);
   for(const j of data.items){const card=el('article','supply-job'),heading=el('div','supply-job-info'),d=state.destinations.find(d=>d.id===j.destination);heading.append(el('h2','',d?.name||j.destination),el('small','',j.workers+' işçi · '+names(j.cargo)));const time=el('p','supply-countdown',j.delivered?'Kasaya eklendi':remaining(j));if(!j.delivered)time.dataset.job=j.id;else card.dataset.delivered=j.id;heading.append(time);
    const action=button(j.delivered?'Kasayı aç':'Kasaya otomatik',()=>{tab='stock';page=0;render()},j.delivered?'supply-secondary':'supply-auto-label');action.disabled=!j.delivered;
    card.append(picture(j.destination,'','supply-job-art'),heading,action);list.append(card);}content.append(list);listFooter('Dönen yükler otomatik aktarılır. Son 10 teslimat burada görünür.',data.pages);
  }
  function renderStock(){
   const items=state.resources.filter(r=>mode!=='forge'||!r.food),layout=el('div','supply-vault'),side=el('aside','supply-vault-side'),emblem=el('img','supply-vault-emblem');emblem.src='assets/supply-v89/vault.svg';emblem.alt='';side.append(el('small','supply-kicker','LUDUS HAZİNESİ'),emblem,el('h2','',mode==='forge'?'Üretim stoğu':'Tedarik kasası'),el('p','','Seferlerden dönen ürünler burada saklanır.'));
   const totals=el('div','supply-vault-totals');for(const [label,list]of [['Malzeme',items.filter(r=>!r.food)],['Gıda',items.filter(r=>r.food)]])if(list.length){const row=el('div');row.append(el('span','',label),el('strong','',num(list.reduce((n,r)=>n+Number(r.quantity||0),0))));totals.append(row);}side.append(totals,el('small','supply-vault-limit','Her ürün için 50.000 kapasite'));
   const grid=el('div','supply-stock');grid.dataset.count=items.length;
   for(const r of items){const card=el('article','supply-stock-card');card.dataset.resource=r.sku;card.dataset.empty=String(!r.quantity);const details=el('div','supply-stock-label');details.append(el('small','',r.food?'GIDA':'MALZEME'),el('h2','',r.name));card.append(resourceArt(r.sku,'supply-stock-icon'),details,el('strong','',num(r.quantity)));grid.append(card);}layout.append(side,grid);content.append(layout);
   if(mode==='trade'&&state.deliveries?.length){const latest=state.deliveries[0],line=el('div','supply-arrival'),text=el('span');text.append(el('small','','SON TESLİMAT'),el('strong','',names(latest.cargo)));const all=button('Teslimatlar',()=>{tab='jobs';page=0;render()},'supply-secondary');line.append(text,all);content.append(line);}
  }
  function resourceArt(sku,cls){const img=el('img',cls);img.src='assets/resource-icons-v95/'+sku+'.webp';img.alt='';img.width=96;img.height=96;img.decoding='async';img.draggable=false;return img;}
  function equipmentArt(recipe,cls){const art=el('span',cls);art.setAttribute('aria-hidden','true');art.innerHTML=globalThis.LudusSupplyIcons?.svg(recipe)||icon('forge');return art;}
  function canCraft(recipe){return Object.entries(recipe.ingredients).every(([sku,n])=>(resource(sku)?.quantity||0)>=n);}
  function renderCraft(){
   const recipes=state.recipes.filter(r=>filter==='all'||r.kind===filter),layout=el('div','supply-workshop'),catalog=el('div','supply-catalog'),bar=el('div','supply-catalog-bar'),label=el('label','supply-filter','Ekipman'),select=el('select');select.id='supplyCraftFilter';for(const [v,n]of [['all','Tüm ekipmanlar'],...Object.entries(kindNames)]){const option=el('option','',n);option.value=v;select.append(option);}select.value=filter;select.onchange=()=>{filter=select.value;render()};label.append(select);bar.append(label,el('small','',recipes.length+' tasarım · Basic +0'));catalog.append(bar);
   if(!recipes.some(r=>r.sku===craftSelection))craftSelection=recipes[0]?.sku||null;
   const grid=el('div','supply-recipes');grid.style.setProperty('--supply-rows',Math.max(1,Math.ceil(recipes.length/5)));
   for(const r of recipes){const card=button('',()=>{craftSelection=r.sku;render();document.getElementById('supplyRecipe-'+r.sku)?.focus({preventScroll:true});},'supply-recipe');card.id='supplyRecipe-'+r.sku;card.dataset.recipe=r.sku;card.setAttribute('aria-pressed',String(craftSelection===r.sku));card.setAttribute('aria-label',r.name+' · Malzemeleri incele');card.append(equipmentArt(r,'supply-equipment-art'),el('span','supply-recipe-name',r.name));if(canCraft(r)){const ready=el('span','supply-craft-ready','✓');ready.title='Malzemeler hazır';card.append(ready);}grid.append(card);}catalog.append(grid);
   const selectedRecipe=recipes.find(r=>r.sku===craftSelection),detail=el('aside','supply-craft-detail');detail.setAttribute('aria-label','Seçili ekipmanın üretim bilgileri');
   if(selectedRecipe){const r=selectedRecipe,top=el('div','supply-craft-heading'),name=el('div');name.append(el('small','supply-kicker',kindNames[r.kind]+' · BASIC +0'),el('h2','',r.name));top.append(equipmentArt(r,'supply-detail-art'),name);detail.append(top,el('p','supply-ingredients-title','GEREKLİ MALZEMELER'));
    const requirements=el('ul','supply-ingredients');for(const [sku,n]of Object.entries(r.ingredients)){const stock=resource(sku),ok=(stock?.quantity||0)>=n,li=el('li',ok?'':'supply-missing'),quantity=el('span','supply-ingredient-count');quantity.append(el('b','',num(stock?.quantity)),document.createTextNode(' / '+n));li.append(resourceArt(sku,''),el('span','',stock?.name||sku),quantity);requirements.append(li);}
    const enough=canCraft(r),craft=button(enough?'Üret':'Malzeme eksik',()=>act('craft',r.sku),'supply-primary');craft.dataset.craft=r.sku;craft.disabled=disabled()||!enough;detail.append(requirements,el('small','supply-craft-hint','Stok / Gereken · Üretilen eşya envantere eklenir.'),craft);
   }else detail.append(el('p','supply-note','Bu türde üretim seçeneği bulunmuyor.'));
   layout.append(catalog,detail);content.append(layout);
  }
  async function open(view){if(opened||ctx.blocked?.()||!ctx.inRoom?.())return;if(view==='stock'){tab='stock';page=0;}opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();closeButton.focus();render();await refresh();}
  function close(){if(!opened)return;closeArt();opened=false;ctx.onChestOpen?.(false);modal.hidden=true;ctx.onClose?.();if(lastFocus?.isConnected&&!lastFocus.hidden)lastFocus.focus();}
  function enter(next='trade'){mode=next;point?.set(mode==='forge'?-2.8:0,1.65,mode==='forge'?-.65:0);chestOpener.hidden=mode!=='trade';selected=null;page=0;tab=mode==='forge'?'craft':'map';opener.innerHTML=icon(mode==='forge'?'forge':'map');opener.title=mode==='forge'?'Demircide üretim':'Tedarik haritası';opener.setAttribute('aria-label',opener.title);opener.hidden=false;}
  function leave(){opener.hidden=chestOpener.hidden=true;close();}
  function tick(){
   if(point&&globalThis.LudusRoomActions){globalThis.LudusRoomActions.place(opener,point,ctx,!!ctx.inRoom?.());globalThis.LudusRoomActions.place(chestOpener,chestPoint,ctx,mode==='trade'&&!!ctx.inRoom?.());}
   if(!state||Date.now()-lastTick<1000||document.hidden)return;lastTick=Date.now();
   for(const j of state.jobs){const time=content.querySelector('[data-job="'+j.id+'"]');if(time)time.textContent=remaining(j);}
   const due=state.jobs.some(j=>Date.parse(j.delivery_check_at||j.ends_at)<=Date.now()+offset);
   if(!busy&&!loading&&!pending&&((due&&Date.now()-lastRefresh>5000)||(opened&&Date.now()-lastRefresh>60000))){lastRefresh=Date.now();refresh();}
  }
  modal.addEventListener('pointerdown',e=>e.stopPropagation());
  document.addEventListener('keydown',e=>{if(!opened)return;if(artOpen){artKey(e);return;}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(tab==='map'&&selected)backToMap();else close();}if(e.key==='Tab'){const all=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select,a[href]')].filter(n=>!n.hidden&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}},true);
  if(ctx.T&&ctx.canvas){let down=null;const ray=new ctx.T.Raycaster(),pointer=new ctx.T.Vector2();ctx.canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});ctx.canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>7||mode!=='trade'||!ctx.inRoom?.()||ctx.blocked?.())return;const root=ctx.chestRoot?.();if(!root||Math.hypot(ctx.player.x-chestPoint.x,ctx.player.z-chestPoint.z)>3.5)return;const r=ctx.canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,ctx.camera);if(ray.intersectObject(root,true).length)open('stock');});}
  ctx.ready.then(()=>refresh()).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state?.jobs.length)refresh();});
  window.addEventListener('resize',()=>{if(opened)render();if(artOpen){paintArt();beginGesture();}});
  window.addEventListener('storage',e=>{if(e.key!=='ludus-supply-seen-v88:'+owner)return;try{const ids=JSON.parse(e.newValue||'[]');if(Array.isArray(ids)){for(const id of ids)if(typeof id==='string')seenDeliveries.add(id);updateChest();}}catch{}});
  return {enter,leave,tick,open,close,refresh,get state(){return state;},get pending(){return pending;},get attention(){return unseen().length>0;}};
 }
 return {create};
})();
