/* Caravan raid presentation. Timers, availability, rolls and rewards come only from the RPC. */
var LudusCaravanRaids=(()=>{
 'use strict';
 const art='assets/caravan-v124/',el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
 const name=sku=>({grain:'Tahıl',apple:'Elma',meat:'Et',fish:'Balık',egg:'Yumurta',beer:'Şarap',olive_oil:'Zeytinyağı'}[sku])||globalThis.LudusProduction?.resources.find(r=>r.sku===sku)?.name||globalThis.LudusProduction?.recipes.find(r=>r.sku===sku)?.name||sku;
 const photo=(src,alt,cls='')=>{const i=el('img',cls);i.src=src;i.alt=alt;i.draggable=false;i.decoding='async';return i;};
 const date=t=>new Date(t).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
 function create(ctx){
  let data=null,owner=null,busy=false,inflight=null,error='',view='team',selection=[],page=0,region=null,report=null,pending=null,offset=0,last=0,notified=new Set(),mount=null;
  const key=()=> 'ludus-raid-request-v124:'+owner;
  const now=()=>Date.now()+offset;
  const ready=()=>data?.active?.status==='ready';
  const active=()=>data?.active;
  const selectedTeam=()=>selection.map(id=>data?.gladiators.find(g=>g.id===id)).filter(Boolean);
  function clearPending(){pending=null;try{localStorage.removeItem(key());}catch{}}
  function redraw(){if(mount?.isConnected&&(ctx.isVisible?.()??true))render(mount);}
  async function identify(){if(owner)return;owner=(await ctx.ready).user_id;try{const p=JSON.parse(localStorage.getItem(key())||'null');if(p?.owner===owner&&p.request&&p.region&&Array.isArray(p.team))pending=p;}catch{}}
  function adopt(d){
   if(d?.user_id!==owner||d.version!==124||!Array.isArray(d.regions))throw Error('Baskın bilgileri doğrulanamadı.');
   const initial=!data;data=d;offset=Date.parse(d.server_now)-Date.now();last=Date.now();
   if(initial){selection=(pending?.team||d.team||[]).filter(id=>d.gladiators.some(g=>g.id===id));if(pending){region=pending.region;view='map';}}
   if(active()&&(initial||view!=='info'))view='mission';
   if(pending&&(active()||d.result?.request_id===pending.request||d.history.some(j=>j.request_id===pending.request)))clearPending();
  }
  async function refresh(){
   if(inflight||busy)return inflight;
   inflight=(async()=>{try{await identify();const r=await ctx.client.rpc('ludus_caravan_raid');if(r.error)throw r.error;adopt(r.data);error='';}catch(e){error=e.message||'Baskın bilgileri alınamadı.';last=Date.now();}finally{inflight=null;redraw();}})();return inflight;
  }
  async function act(action){
   if(busy||inflight)return;busy=true;error='';redraw();
   try{
    await identify();let args={p_action:action};
    if(action==='start'){
     if(!pending){pending={owner,request:crypto.randomUUID(),team:[...selection],region};try{localStorage.setItem(key(),JSON.stringify(pending));}catch{pending=null;throw Error('İşlem kaydı saklanamadı. Tarayıcı depolamasını açıp yeniden dene.');}}
     Object.assign(args,{p_gladiators:pending.team,p_region:pending.region,p_request:pending.request});
    }else args.p_raid=active()?.id;
    const r=await ctx.client.rpc('ludus_caravan_raid',args);
    if(r.error){if(['P0001','22003','22P02','23514'].includes(r.error.code))clearPending();throw r.error;}
    adopt(r.data);if(action==='start'){clearPending();view='mission';}else{report=r.data.result?.id;view='info';}
    ctx.onChange?.();window.dispatchEvent(new CustomEvent('ludus-supply-change',{detail:{action:'raid'}}));
   }catch(e){error=e.message||'Yanıt alınamadı. Aynı işlemi güvenle yeniden deneyebilirsin.';}
   finally{busy=false;redraw();}
  }
  function go(next){view=next;error='';redraw();if(next==='team')refresh();}
  function weapons(g){
   const box=el('div','raid-weapons');box.setAttribute('aria-label',(g?.name||'Gladyatör')+' · Takılı silahlar');
   const list=(g?.weapons||[]).filter(w=>w.kind==='weapon');
   if(!list.length)box.append(el('small','','Takılı silah yok'));
   for(const w of list){const sku=globalThis.LudusProduction?.skuForItem(w),item=el('span','raid-weapon'),label=name(sku)+(w.enhancement?' +'+w.enhancement:'');item.title=label;const src=globalThis.LudusProduction?.photo(sku);if(src)item.append(photo(src,label));item.append(el('small','',label||w.model));item.dataset.weapon=w.model;box.append(item);}
   return box;
  }
  function teamStrip(team){const strip=el('div','raid-team-strip');for(let i=0;i<2;i++){const g=team[i],slot=el('div','raid-team-slot');slot.append(el('strong','',g?.name||'Gladyatör '+(i+1)),weapons(g));strip.append(slot);}return strip;}
  function poster(src,alt){const figure=el('figure','raid-poster'),media=el('div','raid-media');media.append(photo(src,alt));figure.append(media);return figure;}
  function heading(title,sub){const h=el('div','raid-heading');h.append(el('h2','',title));if(sub)h.append(el('p','',sub));return h;}
  function renderTeam(body){
   const layout=el('div','raid-layout raid-team-layout'),figure=poster('assets/caravan-v123/hunt-art.webp','Siyah peçeli iki gladyatör');figure.append(teamStrip(selectedTeam()));
   const panel=el('div','raid-panel');panel.append(heading('Av ekibini seç','Siyah peçe · Yalnızca gözleri açık'),el('span','raid-count',selection.length+' / 2'));
   const fighters=data.gladiators,pages=Math.max(1,Math.ceil(fighters.length/4));page=Math.min(page,pages-1);const list=el('div','raid-roster');
   for(const g of fighters.slice(page*4,page*4+4)){
    const picked=selection.includes(g.id),b=button('',()=>{selection=picked?selection.filter(id=>id!==g.id):[...selection,g.id];redraw();},'raid-fighter');b.dataset.huntGladiator=g.id;b.setAttribute('aria-pressed',String(picked));b.disabled=busy||!!pending||!g.ready&&!picked||selection.length===2&&!picked;
    const face=el('span','raid-face');face.append(photo('imperial-portrait-'+g.class+'-v31.webp',''));const info=el('span','raid-fighter-info');info.append(el('strong','',g.name),el('small','',g.class),el('small','',g.ready?'Hazır':'Meşgul / Revirde'));b.append(face,info,el('i','',picked?'✓':'+'));list.append(b);
   }
   panel.append(list);
   if(pages>1){const nav=el('div','raid-pagination'),prev=button('‹',()=>{page--;redraw();}),next=button('›',()=>{page++;redraw();});prev.disabled=page===0;next.disabled=page===pages-1;prev.setAttribute('aria-label','Önceki gladyatörler');next.setAttribute('aria-label','Sonraki gladyatörler');nav.append(prev,el('small','',(page+1)+' / '+pages),next);panel.append(nav);}
   const next=button('Saldırı bölgesini belirle',()=>go('map'),'supply-primary raid-primary');next.disabled=busy||selection.length!==2||selectedTeam().some(g=>!g.ready);panel.append(el('p','raid-note','Solda yalnızca gladyatörlerinin takılı silahları gösterilir.'),next);layout.append(figure,panel);body.append(layout);
  }
  function cargoList(choices){const list=el('div','raid-cargo-list');for(const sku of choices){const row=el('div','raid-cargo');row.append(photo(globalThis.LudusProduction.photo(sku),name(sku)),el('strong','',name(sku)),el('span','','%33,33'));list.append(row);}return list;}
  function renderMap(body){
   const layout=el('div','raid-layout raid-map-layout'),mapBox=el('div','raid-map-box'),map=el('div','raid-map');map.append(photo('assets/supply-v91/rome-panorama.webp','Roma ve çevresi pusu bölgeleri','raid-map-art'));
   const chosen=data.regions.find(r=>r.id===region),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 200 100');svg.setAttribute('aria-hidden','true');svg.classList.add('raid-map-lines');
   if(chosen){for(const r of data.regions.filter(r=>chosen.choices.includes(r.sku)&&r.id!==chosen.id)){const line=document.createElementNS(svg.namespaceURI,'line');for(const [k,v]of Object.entries({x1:chosen.x*2,y1:chosen.y,x2:r.x*2,y2:r.y}))line.setAttribute(k,v);svg.append(line);}}
   map.append(svg);
   for(const r of data.regions){const node=button('',()=>{region=r.id;redraw();},'raid-map-node');node.dataset.region=r.id;node.dataset.near=String(!!chosen?.choices.includes(r.sku));node.style.left=r.x+'%';node.style.top=r.y+'%';node.title=r.name;node.setAttribute('aria-label',r.name+' pusu bölgesi');node.setAttribute('aria-pressed',String(region===r.id));node.append(photo(globalThis.LudusProduction.photo(r.sku),''));node.disabled=busy||!!pending;map.append(node);}mapBox.append(map);
   const panel=el('div','raid-panel');panel.append(heading(chosen?chosen.name+' pususu':'Saldırı bölgesini belirle','Haritada bir bölgeye dokun.'));
   if(chosen)panel.append(cargoList(chosen.choices));else panel.append(el('p','raid-map-hint','Seçtiğin bölge ile iki komşu rotadan birinin kervanı gelecek.'));
   panel.append(el('p','raid-note','Her malzeme 3 bölgede · Her rotada tam 1/3 şans'),el('div','raid-rules','2 saat pusu · Başarı %70 · 15 birim yük'),el('small','raid-note','Başarısızlıkta iki gladyatör 12 saat revirde dinlenir.'));
   const start=button(pending?'Pusuyu yeniden kontrol et':'Pusuya gönder',()=>act('start'),'supply-primary raid-primary');start.disabled=busy||!chosen||selection.length!==2;panel.append(start);layout.append(mapBox,panel);body.append(layout);
  }
  function remaining(j){const sec=Math.max(0,Math.ceil((Date.parse(j.ends_at)-now())/1000));return sec?[Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(x=>String(x).padStart(2,'0')).join(':'):'Kervan kontrol ediliyor…';}
  function renderMission(body){
   const j=active();if(!j){view='team';renderTeam(body);return;}
   const isReady=j.status==='ready',layout=el('div','raid-layout raid-mission-layout'),figure=poster(art+'ambush.webp','Orman yolunda yaklaşan kervanı bekleyen av ekibi');figure.append(teamStrip(j.team));
   const panel=el('div','raid-panel');panel.append(el('span','raid-eyebrow',isReady?'KERVAN GÖRÜNDÜ':'PUSU DEVAM EDİYOR'),heading(isReady?'Vakit geldi.':'Av ekibin pusuda.',data.regions.find(r=>r.id===j.region)?.name+' · Roma ticaret yolu'));
   if(!isReady){const clock=el('output','raid-clock',remaining(j));clock.dataset.raidClock='';panel.append(clock,el('p','raid-note','Oyunu kapatabilirsin. İki saat tamamlanınca kervan baskını burada hazır olacak.'));}
   else panel.append(el('p','raid-mission-copy','Kervan saldırı bölgesine ulaştı. İki gladyatörün işaretini bekliyor.'));
   panel.append(el('div','raid-rules','2 gladyatör · Başarı %70'));
   const attack=button(isReady?'Kervanı Bas':'Pusuda…',()=>act('resolve'),'supply-primary raid-primary');attack.disabled=busy||!isReady;panel.append(attack);layout.append(figure,panel);body.append(layout);
  }
  function renderInfo(body){
   const layout=el('div','raid-report-layout'),reports=data.history||[],j=reports.find(j=>j.id===report)||reports[0];
   const main=el('div','raid-report-main');
   if(j){report=j.id;const figure=poster(art+(j.success?'success':'failure')+'.webp',j.success?'Ele geçirilen kervan yükü':'Revirde dinlenen iki gladyatör'),caption=el('figcaption','raid-result-copy');caption.append(el('h2','',j.success?'Kervan baskını başarılı':'Kervan baskını başarısız'));
    if(j.success){const loot=el('div','raid-loot');for(const [sku,amount]of Object.entries(j.loot)){const item=el('div');item.append(photo(globalThis.LudusProduction.photo(sku),name(sku)),el('strong','',amount+' '+name(sku)));loot.append(item);}caption.append(loot,el('p','',j.delivered_at?'Ele geçirilen eşyalar kasana eklendi.':'Kasa dolu. Yükün güvende; yer açılınca aktarılacak.'));}
    else caption.append(el('p','',now()<Date.parse(j.injured_until)?'Gladyatörler revirde dinleniyor.':'Gladyatörlerin revirdeki dinlenme süresi tamamlandı.'),el('small','', 'Dinlenme bitişi · '+date(j.injured_until)));
    caption.append(el('small','',date(j.resolved_at)+' · '+(data.regions.find(r=>r.id===j.region)?.name||j.region)+' · '+j.team.map(g=>g.name).join(' & ')));figure.append(caption);main.append(figure);
   }else main.append(heading('Henüz bir baskın yok.','İki gladyatör seçip ilk pusunu kur.'));
   const side=el('aside','raid-history');side.append(heading('Baskın bilgileri','Son 5 baskın'));const list=el('div','raid-history-list');
   for(const past of reports){const b=button('',()=>{report=past.id;redraw();},'raid-history-entry');b.dataset.report=past.id;b.setAttribute('aria-pressed',String(past.id===j?.id));const txt=el('span');txt.append(el('strong','',past.success?'Başarılı':'Başarısız'),el('small','',date(past.resolved_at)));b.append(photo(art+(past.success?'success':'failure')+'.webp',''),txt,el('i','',past.success?'✓':'×'));list.append(b);}
   side.append(list);const next=button(active()?'Pusuya dön':'Yeni av ekibi',()=>go(active()?'mission':'team'),'supply-primary raid-primary');side.append(next);layout.append(main,side);body.append(layout);
  }
  function render(target){
   mount=target;target.replaceChildren();const shell=el('div','raid-shell');shell.dataset.raidView=view;const toolbar=el('div','raid-toolbar');
   const back=view==='map'?button('‹ Av ekibi',()=>go('team')):view==='info'?button(active()?'‹ Pusuya dön':'‹ Av ekibi',()=>go(active()?'mission':'team')):el('span','raid-eyebrow','GÖLGELERİN İZİNDE');toolbar.append(back);
   if(view!=='info')toolbar.append(button('Baskın bilgileri',()=>go('info'),'raid-info-open'));shell.append(toolbar);const body=el('div','raid-body');shell.append(body);target.append(shell);
   if(!data){body.append(heading(error?'Baskın bilgileri alınamadı':'Av ekibi hazırlanıyor…'));if(error)body.append(button('Yeniden dene',refresh,'supply-primary'));}
   else if(view==='map')renderMap(body);else if(view==='mission')renderMission(body);else if(view==='info')renderInfo(body);else renderTeam(body);
   if(error){const note=el('div','raid-error',error);note.setAttribute('role','alert');shell.append(note);}
   shell.setAttribute('aria-busy',String(busy||!!inflight));
  }
  function tick(){
   if(document.hidden)return;const clock=mount?.querySelector('[data-raid-clock]');if(clock&&active())clock.textContent=remaining(active());
   if(!busy&&!inflight&&Date.now()-last>(active()&&Date.parse(active().ends_at)<=now()?5000:60000))refresh();
   if(ready()&&!notified.has(active().id)&&ctx.canPrompt?.()){
    view='mission';if(ctx.prompt?.()!==false){notified.add(active().id);redraw();}
   }
  }
  function open(){if(active())view='mission';return refresh();}
  ctx.ready.then(()=>refresh()).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  return {render,refresh,tick,open,get data(){return data;},get ready(){return ready();}};
 }
 return {create};
})();
