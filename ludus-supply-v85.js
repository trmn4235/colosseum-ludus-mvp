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
 const terrain='<svg viewBox="0 0 700 520" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="supply-grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="#a28a5c" stroke-opacity=".12"/></pattern></defs><rect width="700" height="520" fill="#e6d7b4"/><rect width="700" height="520" fill="url(#supply-grid)"/><path d="M0 120Q100 15 230 28T510 20L700 55V0H0Z" fill="#b0a180"/><path d="m30 112 78-80 63 80m260-35 70-72 68 76m-84 35 65-70 72 85" fill="none" stroke="#867854" stroke-width="7" opacity=".35"/><path d="M40 0C290 110 57 217 184 294S73 415 105 520" fill="none" stroke="#8baba3" stroke-width="34"/><path d="M40 0C290 110 57 217 184 294S73 415 105 520" fill="none" stroke="#bbcdc0" stroke-width="12"/><g fill="#8c9c6b" opacity=".35"><ellipse cx="82" cy="250" rx="86" ry="70"/><ellipse cx="283" cy="162" rx="66" ry="40"/><ellipse cx="605" cy="205" rx="65" ry="105"/><ellipse cx="375" cy="366" rx="86" ry="45"/></g><path d="M130 370 334 256 500 92M334 256 595 345M334 256 254 438M334 256 169 100" fill="none" stroke="#bca277" stroke-width="5" stroke-dasharray="9 6"/><g transform="translate(330 254)" fill="#a36943" stroke="#715038" stroke-width="2"><path d="M-25 9h50v20h-50zM-29 8 0-7 29 8Z"/><path d="M-16 9v20M-5 9v20M6 9v20M17 9v20"/></g><text x="331" y="306" text-anchor="middle" fill="#69492e" font-family="Georgia,serif" font-size="15" letter-spacing="4">LUDUS</text><g transform="translate(630 446)" stroke="#92794f" fill="none"><path d="M0-24V24M-24 0h48M-12-12l24 24M12-12l-24 24"/><circle r="17"/></g><text x="630" y="413" text-anchor="middle" fill="#92794f" font-size="11">K</text></svg>';
 function create(ctx){
  let state=null,owner=null,key=null,pending=null,busy=false,loading=null,opened=false,mode='trade',tab='map',selected='iron',workers=1,filter='all',lastFocus=null,offset=0,lastRefresh=0,lastTick=0;
  const opener=button('',()=>open(),'room-world-action supply-open');opener.hidden=true;opener.id='supplyOpen';document.body.append(opener);
  const modal=el('section','supply-modal');modal.id='supplyModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','supplyTitle');
  const frame=el('div','supply-frame'),head=el('header','supply-head'),heading=el('div');heading.append(el('small','','LUDUS · TEDARİK VE ÜRETİM'));
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
   title.textContent=mode==='forge'?'Demirci':'Roma ve çevresi';modal.setAttribute('aria-busy',String(busy||!!loading));summary.replaceChildren();tabs.replaceChildren();content.replaceChildren();
   if(!state){content.append(el('p','supply-empty',loading?'Tedarik defteri açılıyor…':'Tedarik bilgileri henüz yüklenmedi.'));return;}
   for(const [label,value]of [['Boş işçi',state.free_workers+' / '+state.workers],['Seferde / yük bekliyor',state.busy_workers],['Ludus seviyesi',state.level]]){const box=el('div');box.append(el('small','',label),el('strong','',value));summary.append(box);}
   const refreshButton=button('Yenile',refresh,'supply-secondary');refreshButton.disabled=disabled();summary.append(refreshButton);
   const choices=mode==='forge'?[['craft','Basic üretim'],['stock','Malzemeler']]:[['map','Harita'],['jobs','Seferler · '+state.jobs.length],['stock','Stoklar']];
   for(const [value,label]of choices){const b=button(label,()=>{tab=value;render()});b.setAttribute('aria-pressed',String(tab===value));tabs.append(b);}
   if(tab==='map')renderMap();else if(tab==='jobs')renderJobs();else if(tab==='craft')renderCraft();else renderStock();
  }
  function renderMap(){
   const layout=el('div','supply-layout'),map=el('div','supply-map');map.setAttribute('aria-label','Roma çevresindeki tedarik bölgeleri');const art=el('div','supply-terrain');art.innerHTML=terrain;map.append(art);
   for(const d of state.destinations){const node=button('',()=>{selected=d.id;render();content.querySelector('[data-destination="'+d.id+'"]')?.focus()},'supply-node');node.dataset.destination=d.id;node.style.left=d.x+'%';node.style.top=d.y+'%';node.setAttribute('aria-pressed',String(selected===d.id));const glyph=el('span','supply-node-icon');glyph.innerHTML=icon(routeIcon(d.id));node.append(glyph,el('span','',d.name));map.append(node);}
   map.append(el('small','supply-map-caption','Şematik tedarik haritası'));
   const d=state.destinations.find(d=>d.id===selected)||state.destinations[0],side=el('aside','supply-route');side.append(el('small','supply-kicker','SEÇİLİ BÖLGE'),el('h2','',d.name),el('p','',d.description));
   const amount=el('div','supply-yield');amount.append(el('small','','1 İŞÇİ · '+d.seconds/3600+' SAAT'),el('strong','',names(d.yields)));side.append(amount);
   const label=el('label','supply-worker-label','Gönderilecek işçi'),input=el('input');input.type='number';input.inputMode='numeric';input.min='1';input.max=String(Math.max(1,state.free_workers));input.step='1';input.value=String(workers);input.disabled=disabled()||state.free_workers===0;label.append(input);side.append(label);
   const preview=el('p','supply-preview'),send=button('İşçileri gönder',()=>act('send',d.id,Number(input.value)),'supply-primary');send.dataset.send=d.id;
   function update(){const n=Number(input.value),valid=Number.isInteger(n)&&n>=1&&n<=state.free_workers;if(valid)workers=n;preview.textContent=valid?'Dönüş yükü: '+names(d.yields,n):'Gönderebileceğin boş işçi bulunmuyor.';send.disabled=disabled()||!valid;}input.oninput=update;update();side.append(preview,send,el('p','supply-note','Altın maliyeti yok. Sefer çevrimdışıyken de ilerler. Dönüşte yükü teslim alarak işçilerini yeniden görevlendirebilirsin.'));
   if(state.unclaimed_workers>0){const a=el('a','supply-reward-link',state.unclaimed_workers+' işçi ödülünü al →');a.href='ludus-seviye.html?v=revision85';side.append(a);}
   else if(state.next_worker_level)side.append(el('p','supply-note','Sonraki işçi: Seviye '+state.next_worker_level+'. Her 5 seviyede +1; toplam 10 işçi.'));
   layout.append(map,side);content.append(layout);
  }
  function renderJobs(){
   if(!state.jobs.length){content.append(el('p','supply-empty','Henüz aktif sefer yok. Haritadan bir bölge seçip işçi gönderebilirsin.'));return;}
   const list=el('div','supply-jobs');for(const j of state.jobs){const card=el('article','supply-job'),heading=el('div'),d=state.destinations.find(d=>d.id===j.destination);heading.append(el('h2','',d?.name||j.destination),el('small','',j.workers+' işçi · '+names(j.cargo)));const time=el('p','supply-countdown',remaining(j));time.dataset.job=j.id;
    const claim=button('Yükü teslim al',()=>act('claim',j.id),'supply-primary');claim.dataset.claim=j.id;claim.disabled=disabled()||Date.parse(j.ends_at)>Date.now()+offset;
    card.append(heading,time,claim);list.append(card);}content.append(list,el('p','supply-note','Gıdalar doğrudan yemekhaneye, üretim malzemeleri malzeme deposuna gider. Teslim edilen gıda geçmiş günlere uygulanmaz.'));
  }
  function renderStock(){
   const grid=el('div','supply-stock');for(const r of state.resources.filter(r=>mode!=='forge'||!r.food)){const card=el('article');card.append(el('small','',r.food?'YEMEKHANE':'MALZEME'),el('h2','',r.name),el('strong','',num(r.quantity)));grid.append(card);}content.append(grid,el('p','supply-note','Her ürün için depo sınırı 50.000 adettir. Zeytinyağı yalnızca en yüksek kalite menüde kullanılır.'));
  }
  function renderCraft(){
   content.append(el('p','supply-note','Malzemelerinle basic +0, taşsız ekipman üret. Ürün doğrudan ekipman envanterine eklenir.'));
   const label=el('label','supply-filter','Ekipman türü'),select=el('select');for(const [v,n]of [['all','Tüm ekipmanlar'],...Object.entries(kindNames)]){const option=el('option','',n);option.value=v;select.append(option);}select.value=filter;select.onchange=()=>{filter=select.value;render()};label.append(select);content.append(label);
   const grid=el('div','supply-recipes');for(const r of state.recipes.filter(r=>filter==='all'||r.kind===filter)){const card=el('article','supply-recipe');card.append(el('small','supply-kicker',kindNames[r.kind]+' · BASIC +0'),el('h2','',r.name));const requirements=el('ul');let enough=true;
    for(const [sku,n]of Object.entries(r.ingredients)){const stock=resource(sku),ok=(stock?.quantity||0)>=n;enough&&=ok;const li=el('li',ok?'':'supply-missing',(stock?.name||sku)+' · '+num(stock?.quantity)+' / '+n);requirements.append(li);}
    const craft=button(enough?'Üret':'Malzeme eksik',()=>act('craft',r.sku),'supply-primary');craft.dataset.craft=r.sku;craft.disabled=disabled()||!enough;card.append(requirements,craft);grid.append(card);}content.append(grid);
  }
  async function open(){if(opened||ctx.blocked?.()||!ctx.inRoom?.())return;opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();closeButton.focus();render();await refresh();}
  function close(){if(!opened)return;opened=false;modal.hidden=true;ctx.onClose?.();if(lastFocus?.isConnected&&!lastFocus.hidden)lastFocus.focus();}
  function enter(next='trade'){mode=next;tab=mode==='forge'?'craft':'map';opener.innerHTML=icon(mode==='forge'?'forge':'map');opener.title=mode==='forge'?'Demircide üretim':'Tedarik haritası';opener.setAttribute('aria-label',opener.title);opener.hidden=false;}
  function leave(){opener.hidden=true;close();}
  function tick(){
   if(point&&globalThis.LudusRoomActions)globalThis.LudusRoomActions.place(opener,point,ctx,!!ctx.inRoom?.());
   if(!opened||!state||Date.now()-lastTick<1000)return;lastTick=Date.now();
   for(const j of state.jobs){const time=content.querySelector('[data-job="'+j.id+'"]');if(time)time.textContent=remaining(j);const claim=content.querySelector('[data-claim="'+j.id+'"]');if(claim)claim.disabled=disabled()||Date.parse(j.ends_at)>Date.now()+offset;}
   if(!busy&&!loading&&!pending&&Date.now()-lastRefresh>60000){lastRefresh=Date.now();refresh();}
  }
  modal.addEventListener('pointerdown',e=>e.stopPropagation());
  document.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const all=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select,a[href]')].filter(n=>!n.hidden&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}},true);
  return {enter,leave,tick,open,close,refresh,get state(){return state;},get pending(){return pending;}};
 }
 return {create};
})();
