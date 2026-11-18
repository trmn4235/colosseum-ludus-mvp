/* Papyrus-owned progress is authoritative on the server. Receiving is separate
   from reading; neither time, battles nor a client-written EXP value level staff. */
(function(root){
 'use strict';
 const rarities={common:'Yaygın',rare:'Nadir',very_rare:'Çok nadir',unique:'Eşsiz'};
 const fmt=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:3}).format(Number(n)||0);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function create(ctx){
  const defs=root.LudusSpecialPeople.roles;
  let opened=false,owner=null,data=null,role='trainer',page=0,loading=false,busy=false,serial=0,pending=null,lastFocus=null;
  let inDirectory=false,fromDirectory=false,archive=null,archiveKind=null;
  const modal=el('section','special-staff');modal.hidden=true;modal.id='specialStaffModal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','specialStaffTitle');
  const header=el('header','staff-header'),back=button('‹',goBack,'staff-back');back.setAttribute('aria-label','Özel çalışanları kapat');const title=el('h1','','Özel çalışanlar');title.id='specialStaffTitle';
  const nav=el('nav','staff-nav');nav.setAttribute('aria-label','Özel çalışan seç');header.append(back,title,nav);
  const body=el('div','staff-body'),identity=el('aside','staff-identity'),portrait=el('div','staff-portrait'),artStatus=el('span','staff-art-status','Karakter hazırlanıyor…'),info=el('div','staff-info'),content=el('main','staff-content');let canvas=el('canvas');
  canvas.setAttribute('aria-label','Çalışanın üç boyutlu görünümü');portrait.append(canvas,artStatus);identity.append(portrait,info);body.append(identity,content);
  const footer=el('footer','staff-footer'),status=el('span'),retry=button('Yeniden dene',()=>pending?submit():refresh(),'staff-retry');status.setAttribute('role','status');status.setAttribute('aria-live','polite');retry.hidden=true;footer.append(status,retry);modal.append(header,body,footer);document.body.append(modal);
  const directory=el('section','staff-directory');directory.setAttribute('aria-label','Çalışan profilleri');
  for(const person of defs){
   const card=button('',()=>open(person.id),'staff-directory-person');card.dataset.role=person.id;
   card.style.setProperty('--staff-cloth',person.cloth);
   card.setAttribute('aria-label',person.title+' '+person.name+' profilini aç');
   card.append(el('strong','',person.title),el('span','',person.name),el('small','',person.place),el('span','staff-directory-count','Papirüsler yükleniyor…'));directory.append(card);
  }
  modal.insertBefore(directory,footer);
  let viewRenderer=null,viewScene=null,viewCamera=null,viewModel=null,viewId=null,viewSerial=0,viewFailed=false,viewTarget=null;
  const sharedRenderer=!!ctx.renderer;
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function resize(){if(!viewRenderer||!opened)return;const r=portrait.getBoundingClientRect();if(!r.width||!r.height)return;viewCamera.aspect=r.width/r.height;viewCamera.position.set(.05,1.08,Math.max(3.1,1.9/viewCamera.aspect));viewCamera.lookAt(0,1.02,0);viewCamera.updateProjectionMatrix();
   if(!sharedRenderer){viewRenderer.setSize(r.width,r.height,false);viewRenderer.render(viewScene,viewCamera);const source=viewRenderer.domElement;canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);return;}
   // Use the world's context while the full-screen profile pauses the world.
   // A small render target avoids a second WebGL context and compositor layer.
   const T=ctx.T||root.THREE,renderer=viewRenderer,ratio=Math.min(root.devicePixelRatio||1,1.5),width=Math.max(1,Math.round(r.width*ratio)),height=Math.max(1,Math.round(r.height*ratio));
   if(!viewTarget){viewTarget=new T.WebGLRenderTarget(width,height);viewTarget.texture.colorSpace=T.SRGBColorSpace;}else viewTarget.setSize(width,height);
   const previous={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace?.()||0,mip:renderer.getActiveMipmapLevel?.()||0,viewport:renderer.getViewport(new T.Vector4()),scissor:renderer.getScissor(new T.Vector4()),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(new T.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,shadowEnabled:renderer.shadowMap.enabled};
   const buffer=new Uint8Array(width*height*4);
   try{renderer.setRenderTarget(viewTarget);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.autoClear=true;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=false;renderer.render(viewScene,viewCamera);renderer.readRenderTargetPixels(viewTarget,0,0,width,height,buffer);}
   finally{renderer.setRenderTarget(previous.target,previous.face,previous.mip);renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);renderer.setClearColor(previous.clear,previous.alpha);renderer.autoClear=previous.autoClear;renderer.toneMapping=previous.toneMapping;renderer.toneMappingExposure=previous.exposure;renderer.shadowMap.enabled=previous.shadowEnabled;}
   canvas.width=width;canvas.height=height;const context=canvas.getContext('2d'),pixels=context.createImageData(width,height),stride=width*4;
   for(let y=0;y<height;y++)pixels.data.set(buffer.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
   context.putImageData(pixels,0,0);
  }
  async function showPerson(){
   if(viewId===role&&(viewModel||viewFailed)){resize();return;}const id=role,request=++viewSerial;viewId=id;viewFailed=false;artStatus.hidden=false;artStatus.textContent='Karakter hazırlanıyor…';
   try{
    const T=ctx.T||root.THREE;if(!T)throw Error('3D görünüm açılamadı.');
    if(!viewRenderer){viewRenderer=ctx.renderer||new T.WebGLRenderer({alpha:true,antialias:false});if(!sharedRenderer){viewRenderer.setPixelRatio(Math.min(root.devicePixelRatio||1,1.5));viewRenderer.outputColorSpace=T.SRGBColorSpace;viewRenderer.toneMapping=T.ACESFilmicToneMapping;}viewScene=new T.Scene();viewScene.add(new T.HemisphereLight(0xfff5e8,0x4a545d,2.3));const sun=new T.DirectionalLight(0xfff3dc,2.7);sun.position.set(-3,5,4);viewScene.add(sun);viewCamera=new T.PerspectiveCamera(36,1,.03,30);}
    if(viewModel){viewModel.removeFromParent();viewModel=null;if(!sharedRenderer)viewRenderer.renderLists.dispose();}resize();
    const person=await root.LudusSpecialPeople.model(id);if(request!==viewSerial||!opened)return;
    viewModel=person;person.rotation.y=.15;viewScene.add(person);resize();
    // Pixels have already been copied synchronously. Do not wait for a display
    // tick: WebKit can suspend animation callbacks behind a full-screen panel.
    if(request===viewSerial&&opened){canvas.dataset.staffRole=id;artStatus.hidden=true;}
   }catch(e){if(request===viewSerial){viewFailed=true;artStatus.textContent='3D görünüm açılamadı.';}}
  }
  const observer=new ResizeObserver(resize);observer.observe(portrait);
  function releaseView(){
   viewSerial++;viewId=null;viewModel?.removeFromParent();viewModel=null;
   viewTarget?.dispose();viewTarget=null;
   if(!sharedRenderer)viewRenderer?.renderLists.dispose();delete canvas.dataset.staffRole;
  }
  function meter(label,value,max){const track=el('div','staff-track'),fill=el('span');track.setAttribute('role','meter');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(max));track.setAttribute('aria-valuenow',String(value));fill.style.width=Math.min(100,value/max*100)+'%';track.append(fill);return track;}
  const detail=el('dialog','staff-detail');
  detail.setAttribute('aria-labelledby','staffDetailTitle');
  document.body.append(detail);
  const rarityOf=p=>rarities[p.rarity]||'Yaygın';
  const effectOf=p=>p.effects.map(e=>e.label+' +%'+fmt(e.percent)).join(' · ');
  function discoveryOf(p){
   return p.finder?'İlk bulan: '+p.finder+' · '+new Date(p.found_at).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'}):'';
  }
  function previewOf(p,compact=false){
   if(p.read_at)return compact?p.effects.map(e=>'+%'+fmt(e.percent)).join(' · '):effectOf(p);
   const learned=data?.staff?.find(s=>s.id===role)?.bonuses||[];
   return p.effects.map(effect=>{
    const before=Number(learned.find(b=>b.key===effect.key)?.percent)||0;
    return (compact?'':effect.label+' ')+'+%'+fmt(before)+' → +%'+fmt(before+Number(effect.percent));
   }).join(' · ');
  }
  function updateDirectory(){
   for(const card of directory.children){
    const person=data?.staff?.find(s=>s.id===card.dataset.role),count=card.querySelector('.staff-directory-count');
    const unread=Number(person?.readable)||0;
    count.textContent=person?(unread?fmt(unread)+' papirüs okunabilir':fmt(person.read)+' / '+fmt(person.total)+' okundu'):'Papirüsler yükleniyor…';
    card.dataset.readable=String(unread>0);
   }
  }
  function showDetail(p){
   const name=el('h2','',p.title);name.id='staffDetailTitle';
   const rarity=el('p','staff-detail-type',rarityOf(p)+(p.unique_id?' · Sunucuda tek nüsha':' · '+p.lesson+' / 500'));
   const effect=el('p','staff-bonus-preview',previewOf(p)||'Bu papirüsün pasif bonusu henüz belirlenmedi.');
   detail.replaceChildren(name,rarity,effect);
   if(p.finder)detail.append(el('p','',discoveryOf(p)));
   if(p.read_at)detail.append(el('p','','Öğrenildi: '+new Date(p.read_at).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'})));
   const actions=el('div','staff-detail-actions');
   actions.append(button('Kapat',()=>detail.close(),'staff-detail-back'));
   detail.append(actions);detail.showModal();actions.firstElementChild.focus();
  }
  function paperCard(p){
   const card=el('article','staff-paper'),heading=el('h4');
   card.dataset.lesson=String(p.lesson||p.unique_id);card.dataset.rarity=p.rarity||'common';
   const name=button(p.title,()=>showDetail(p),'staff-paper-title');
   name.setAttribute('aria-label',p.title+' ayrıntıları');heading.append(name);
   const small=el('small','',rarityOf(p)+(p.unique_id?' · Tek nüsha':' · '+p.lesson));
   card.title=[rarityOf(p),previewOf(p),discoveryOf(p)].filter(Boolean).join(' · ');
   const effect=el('p','staff-paper-effect',rarityOf(p)+' · '+(previewOf(p,true)||'Öğrenildi'));
   const learned=el('span','staff-learned','Öğrenildi');
   card.append(small,heading,effect,learned);return card;
  }
  function render(){
   if(!opened)return;
   modal.dataset.directory=String(inDirectory);
   back.setAttribute('aria-label',fromDirectory&&!inDirectory?'Çalışan listesine dön':'Özel çalışanları kapat');
   if(inDirectory){updateDirectory();modal.setAttribute('aria-busy',String(loading));return;}
   const d=defs.find(x=>x.id===role),s=data?.staff?.find(x=>x.id===role);nav.replaceChildren();info.replaceChildren();content.replaceChildren();modal.setAttribute('aria-busy',String(loading||busy));
   for(const r of defs){const b=button(r.title,()=>{if(busy||loading||role===r.id)return;role=r.id;page=0;data=null;archive=null;archiveKind=null;message('');render();refresh();},'staff-tab');b.setAttribute('aria-pressed',String(role===r.id));b.disabled=busy;nav.append(b);}
   info.append(el('small','staff-profession',d.profession),el('h2','',s?.name||d.name),el('span','staff-place',d.place));
   const overall=el('div','staff-overall');overall.append(el('span','','Overall'),el('strong','',s?fmt(s.overall):'—'));info.append(overall);
   const collection=button('',()=>openArchive(false),'staff-collection');collection.setAttribute('aria-label','Okunan papirüsleri göster');collection.disabled=loading;
   collection.append(el('span','','Okunan papirüsler'),el('strong','',s?fmt(s.read)+' / '+fmt(s.total):'— / 500'));info.append(collection,meter('Okunan papirüs',s?.read||0,s?.total||500));
   const counts=el('div','staff-counts'),unique=button('Eşsiz '+fmt(s?.unique_read||0),()=>openArchive(true),'staff-unique-count');unique.setAttribute('aria-label','Okunan eşsiz papirüsleri göster');unique.disabled=loading;
   counts.append(el('span','',s?fmt((s.collected-s.read)+(s.unique_collected||0)-(s.unique_read||0))+' kasada':'— kasada'),unique);info.append(counts);
   const benefits=el('section','staff-benefits');benefits.append(el('h3','','Öğrenilen pasif bonuslar'));
   if(s?.bonuses?.length){const list=el('div','staff-bonus-list');for(const b of s.bonuses){const row=el('div','staff-bonus');row.append(el('span','',b.label),el('strong','','+%'+fmt(b.percent)));list.append(row);}benefits.append(list);}
   else benefits.append(el('p','staff-empty',loading?'Bilgiler yükleniyor…':'Henüz öğrenilen bir pasif bonus yok.'));
   content.append(benefits);
   const papers=el('section','staff-papers'),papersHead=el('div','staff-section-head');papersHead.append(el('h3','',archiveKind===null?'Papirüs eğitimi':archiveKind?'Öğrenilen eşsiz papirüsler':'Öğrenilen papirüsler'));
   if(archiveKind!==null)papersHead.append(el('span','',fmt(archive?.paper_count||0)+' okundu'));papers.append(papersHead);
   if(archiveKind===null){
    const overview=el('div','staff-archive-intro');overview.append(el('p','','Öğrendiği papirüsleri görmek için '+(s?fmt(s.read):'—')+' / 500 sayısına dokun.'),button('Okunanları göster',()=>openArchive(false),'staff-read'),button('Kasadaki papirüsler',()=>{const id=role;close();ctx.openVault?.('papyrus',id);},'staff-vault-link'));papers.append(overview);
   }else if(archive?.role===role&&archive.papyri?.length){
    const grid=el('div','staff-paper-grid');grid.append(...archive.papyri.map(paperCard));papers.append(grid);
   }
   else papers.append(el('div','staff-papers-empty',loading?'Papirüsler yükleniyor…':'Henüz öğrenilen papirüs yok.'));
   const total=archive?.role===role?archive.paper_count||0:0;if(total>6){const pages=Math.ceil(total/6),pager=el('div','staff-pager'),prev=button('‹',()=>{page--;refresh();}),next=button('›',()=>{page++;refresh();});prev.setAttribute('aria-label','Önceki papirüsler');next.setAttribute('aria-label','Sonraki papirüsler');prev.disabled=busy||loading||page===0;next.disabled=busy||loading||page>=pages-1;pager.append(prev,el('span','',(page+1)+' / '+pages),next);papers.append(pager);}
   content.append(papers);showPerson();
  }
  async function identify(){
   if(owner)return;
   const account=await ctx.ready;owner=account.user_id;if(!owner)throw Error('Giriş gerekiyor.');
   try{
    const p=JSON.parse(localStorage.getItem('ludus-staff-read-v284:'+owner)||'null');
    if(p?.owner===owner&&defs.some(d=>d.id===p.role)&&p.request&&
       (Number.isInteger(p.lesson)||typeof p.unique_id==='string'))pending=p;
   }catch{}
  }
  function adopt(result){if(result?.user_id!==owner)throw Error('Çalışan hesabı doğrulanamadı.');data=result;role=result.role;ctx.onState?.(data.staff);root.dispatchEvent(new CustomEvent('ludus-staff-change',{detail:{staff:data.staff}}));}
  function openArchive(unique=false){if(busy||loading)return;archiveKind=unique;archive=null;page=0;refresh();}
  async function refresh(){if(busy||loading)return;const request=++serial;loading=true;retry.hidden=true;render();try{await identify();const results=await Promise.all([ctx.client.rpc('ludus_special_staff',{p_role:role,p_page:0}),archiveKind===null?Promise.resolve(null):ctx.client.rpc('ludus_special_staff_archive',{p_role:role,p_page:page,p_unique:archiveKind})]);if(request!==serial)return;const [r,a]=results;if(r.error)throw r.error;adopt(r.data);if(a){if(a.error)throw a.error;if(a.data.user_id!==owner||a.data.role!==role)throw Error('Papirüs arşivi doğrulanamadı.');archive=a.data;page=archive.page;}if(pending){message('Önceki okumanın sonucu bekliyor. Yeniden dene ile kontrol et.');retry.hidden=false;}}
   catch(e){if(request===serial){message(e.message||'Çalışan bilgileri alınamadı.',true);retry.hidden=false;}}
   finally{if(request===serial){loading=false;render();}}
  }
  function clearPending(){pending=null;try{localStorage.removeItem('ludus-staff-read-v284:'+owner);}catch{}}
  async function readPaper(paper){
   await identify();if(busy)throw Error('Önceki okuma sürüyor.');serial++;loading=false;
   if(pending&&(pending.role!==paper.role||pending.lesson!==(paper.lesson??null)||pending.unique_id!==(paper.unique_id??null)))throw Error('Önceki okumanın sonucunu yeniden dene ile kontrol et.');
   if(!pending){const p={owner,role:paper.role,lesson:paper.lesson??null,unique_id:paper.unique_id??null,request:crypto.randomUUID()};localStorage.setItem('ludus-staff-read-v284:'+owner,JSON.stringify(p));pending=p;}
   return submit(true);
  }
  async function submit(propagate=false){
   if(busy||!pending)return;
   busy=true;retry.hidden=true;render();message('Papirüs okunuyor…');
   try{
    const unique=pending.unique_id,args={p_role:pending.role,p_request:pending.request};
    if(unique)args.p_unique_id=unique;else args.p_lesson=pending.lesson;
    const r=await ctx.client.rpc(unique?'ludus_special_staff_read_unique':'ludus_special_staff_read',args);
    if(r.error){if(['P0001','22023','22P02','23514'].includes(r.error.code))clearPending();throw r.error;}
    adopt(r.data);clearPending();
    message(unique?'Eşsiz papirüs öğrenildi. Pasif bonus güncellendi.':'Papirüs öğrenildi. Overall güncellendi.');
    return r.data;
   }catch(e){message(e.message||'Sonuç alınamadı. Yeniden deneyebilirsin.',true);retry.hidden=false;if(propagate)throw e;}
   finally{busy=false;render();}
  }
  function enterModal(){
   if(opened)return;
   opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();
  }
  function openDirectory(){
   if(busy)return;
   const previous=role,returning=opened;
   enterModal();fromDirectory=true;inDirectory=true;archive=null;archiveKind=null;serial++;loading=false;viewSerial++;viewId=null;
   message('');render();refresh();
   (returning?directory.querySelector('[data-role="'+previous+'"]'):directory.firstElementChild)?.focus({preventScroll:true});
  }
  function open(id='trainer'){
   if(!defs.some(d=>d.id===id)||busy)return;
   serial++;loading=false;
   if(!opened)fromDirectory=false;
   enterModal();inDirectory=false;role=id;page=0;data=null;archive=null;archiveKind=null;message('');render();back.focus({preventScroll:true});refresh();
  }
  function openFromLink(){
   const url=new URL(root.location.href),id=url.searchParams.get('staff');
   if(!defs.some(d=>d.id===id))return false;
   open(id);fromDirectory=true;
   url.searchParams.delete('staff');root.history.replaceState(null,'',url);
   return true;
  }
  function goBack(){if(fromDirectory&&!inDirectory)openDirectory();else close();}
  function close(){if(!opened||busy)return;if(detail.open)detail.close();opened=false;serial++;loading=false;releaseView();modal.hidden=true;inDirectory=false;fromDirectory=false;ctx.onClose?.();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  modal.addEventListener('pointerdown',e=>e.stopPropagation());modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();goBack();}if(e.key==='Tab'){const list=[...modal.querySelectorAll('button:not(:disabled)')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus();}}});
  return {open,openDirectory,openFromLink,close,refresh,readPaper,retryRead:async()=>{await identify();if(!pending)throw Error('Bekleyen okuma yok.');return submit(true);},get pendingRead(){return pending;},get archive(){return archive;},get state(){return data;},get visible(){return opened;}};
 }
 function stations(ctx){
  const T=ctx.T,entries=[];let lastRoom=undefined,loaded=false;
  for(const d of root.LudusSpecialPeople.roles.filter(d=>d.id!=='groom')){
   const group=new T.Group();group.position.set(d.x,d.y||0,d.z);group.rotation.y=d.yaw;group.name=d.title+' · '+d.name;
   const b=button(d.title,()=>ctx.open(d.id),'staff-world-action room-world-action');b.hidden=true;b.setAttribute('aria-label',d.title+' profilini aç');document.body.append(b);
   const e={d,group,button:b,point:new T.Vector3(d.x,(d.y||0)+d.appearance.height/100+.2,d.z),ready:false,pending:false,lastAttempt:0};entries.push(e);
   if(!d.room){ctx.scene.add(group);ctx.colliders.push({kind:'special-staff-'+d.id,x:d.x,z:d.z,half:.38});}
  }
  function load(e){if(e.ready||e.pending||Date.now()-e.lastAttempt<15000)return;e.pending=true;e.lastAttempt=Date.now();root.LudusSpecialPeople.model(e.d.id).then(model=>{e.group.add(model);e.ready=true;ctx.invalidate?.();}).catch(()=>{e.button.title='Karakter yüklenemedi; yeniden denenecek.';}).finally(()=>{e.pending=false;});}
  function tick(){
   const room=ctx.room();if(room!==lastRoom){for(const e of entries.filter(e=>e.d.room)){e.group.removeFromParent();if(e.d.room===room){ctx.roomScene.add(e.group);ctx.roomColliders.push({kind:'special-staff-'+e.d.id,minX:e.d.x-.38,maxX:e.d.x+.38,minZ:e.d.z-.38,maxZ:e.d.z+.38});}}lastRoom=room;}
   if(!loaded)Promise.resolve(ctx.ready).then(()=>{loaded=true;}).catch(()=>{});
   for(const e of entries){if(e.d.room&&e.d.room===room&&!ctx.roomColliders.some(c=>c.kind==='special-staff-'+e.d.id))ctx.roomColliders.push({kind:'special-staff-'+e.d.id,minX:e.d.x-.38,maxX:e.d.x+.38,minZ:e.d.z-.38,maxZ:e.d.z+.38});const visible=loaded&&ctx.exploring()&&e.d.room===room;e.group.visible=visible;if(visible)load(e);root.LudusRoomActions.place(e.button,e.point,ctx,visible&&e.ready,5);}
  }
  return {tick,entries};
 }
 root.LudusSpecialStaff={create,stations,formatPercent:value=>'+%'+fmt(value)};
})(globalThis);
