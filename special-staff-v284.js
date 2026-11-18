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
  let inDirectory=false,fromDirectory=false;
  const modal=el('section','special-staff');modal.hidden=true;modal.id='specialStaffModal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','specialStaffTitle');
  const header=el('header','staff-header'),back=button('‹',goBack,'staff-back');back.setAttribute('aria-label','Özel çalışanları kapat');const title=el('h1','','Özel çalışanlar');title.id='specialStaffTitle';
  const nav=el('nav','staff-nav');nav.setAttribute('aria-label','Özel çalışan seç');header.append(back,title,nav);
  const body=el('div','staff-body'),identity=el('aside','staff-identity'),portrait=el('div','staff-portrait'),canvas=el('canvas'),artStatus=el('span','staff-art-status','Karakter hazırlanıyor…'),info=el('div','staff-info'),content=el('main','staff-content');
  canvas.setAttribute('aria-label','Çalışanın üç boyutlu görünümü');portrait.append(canvas,artStatus);identity.append(portrait,info);body.append(identity,content);
  const footer=el('footer','staff-footer'),status=el('span'),retry=button('Yeniden dene',()=>pending?submit():refresh(),'staff-retry');status.setAttribute('role','status');status.setAttribute('aria-live','polite');retry.hidden=true;footer.append(status,retry);modal.append(header,body,footer);document.body.append(modal);
  const directory=el('section','staff-directory');directory.setAttribute('aria-label','Çalışan profilleri');
  for(const person of defs){
   const card=button('',()=>open(person.id),'staff-directory-person');card.dataset.role=person.id;
   card.style.setProperty('--staff-cloth',person.cloth);
   card.setAttribute('aria-label',person.title+' '+person.name+' profilini aç');
   card.append(el('strong','',person.title),el('span','',person.name),el('small','',person.place));directory.append(card);
  }
  modal.insertBefore(directory,footer);
  let viewRenderer=null,viewScene=null,viewCamera=null,viewModel=null,viewId=null,viewSerial=0,viewFailed=false;
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function resize(){if(!viewRenderer||!opened)return;const r=portrait.getBoundingClientRect();if(!r.width||!r.height)return;viewRenderer.setSize(r.width,r.height,false);viewCamera.aspect=r.width/r.height;viewCamera.position.set(.05,1.08,Math.max(3.1,1.9/viewCamera.aspect));viewCamera.lookAt(0,1.02,0);viewCamera.updateProjectionMatrix();viewRenderer.render(viewScene,viewCamera);}
  async function showPerson(){
   if(viewId===role&&(viewModel||viewFailed)){resize();return;}const id=role,request=++viewSerial;viewId=id;viewFailed=false;artStatus.hidden=false;artStatus.textContent='Karakter hazırlanıyor…';
   try{
    const T=ctx.T||root.THREE;if(!T)throw Error('3D görünüm açılamadı.');
    if(!viewRenderer){viewRenderer=new T.WebGLRenderer({canvas,alpha:true,antialias:false});viewRenderer.setPixelRatio(Math.min(root.devicePixelRatio||1,1.5));viewRenderer.outputColorSpace=T.SRGBColorSpace;viewRenderer.toneMapping=T.ACESFilmicToneMapping;viewScene=new T.Scene();viewScene.add(new T.HemisphereLight(0xfff5e8,0x4a545d,2.3));const sun=new T.DirectionalLight(0xfff3dc,2.7);sun.position.set(-3,5,4);viewScene.add(sun);viewCamera=new T.PerspectiveCamera(36,1,.03,30);}
    if(viewModel){viewModel.removeFromParent();viewModel=null;viewRenderer.renderLists.dispose();}resize();
    const person=await root.LudusSpecialPeople.model(id);if(request!==viewSerial||!opened)return;
    viewModel=person;person.rotation.y=.15;viewScene.add(person);artStatus.hidden=true;resize();
   }catch(e){if(request===viewSerial){viewFailed=true;artStatus.textContent='3D görünüm açılamadı.';}}
  }
  const observer=new ResizeObserver(resize);observer.observe(portrait);
  function meter(label,value,max){const track=el('div','staff-track'),fill=el('span');track.setAttribute('role','meter');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(max));track.setAttribute('aria-valuenow',String(value));fill.style.width=Math.min(100,value/max*100)+'%';track.append(fill);return track;}
  const detail=el('dialog','staff-detail');
  detail.setAttribute('aria-labelledby','staffDetailTitle');
  document.body.append(detail);
  const rarityOf=p=>rarities[p.rarity]||'Yaygın';
  const effectOf=p=>p.effects.map(e=>e.label+' +%'+fmt(e.percent)).join(' · ');
  function discoveryOf(p){
   return p.finder?'İlk bulan: '+p.finder+' · '+new Date(p.found_at).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'}):'';
  }
  function readButton(p){
   const label=p.read_at?'Öğrenildi':p.effects.length?'Papirüsü okut':'Henüz okunamaz';
   const b=button(label,()=>{if(detail.open)detail.close();prepare(p);},'staff-read');
   b.disabled=busy||loading||!!pending||!!p.read_at||!p.effects.length;
   return b;
  }
  function showDetail(p){
   const name=el('h2','',p.title);name.id='staffDetailTitle';
   const rarity=el('p','staff-detail-type',rarityOf(p)+(p.unique_id?' · Sunucuda tek nüsha':' · '+p.lesson+' / 500'));
   const effect=el('p','',effectOf(p)||'Bu papirüsün pasif bonusu henüz belirlenmedi.');
   detail.replaceChildren(name,rarity,effect);
   if(p.finder)detail.append(el('p','',discoveryOf(p)));
   if(p.effects.length)detail.append(el('p','',p.unique_id?'Okunduğunda yalnızca pasif bonus kazandırır.':'Okunduğunda +0,2 overall kazandırır.'));
   const actions=el('div','staff-detail-actions');
   actions.append(button('Kapat',()=>detail.close(),'staff-detail-back'),readButton(p));
   detail.append(actions);detail.showModal();actions.firstElementChild.focus();
  }
  function paperCard(p){
   const card=el('article','staff-paper'),heading=el('h4');
   card.dataset.lesson=String(p.lesson||p.unique_id);card.dataset.rarity=p.rarity||'common';
   const name=button(p.title,()=>showDetail(p),'staff-paper-title');
   name.setAttribute('aria-label',p.title+' ayrıntıları');heading.append(name);
   const small=el('small','',rarityOf(p)+(p.unique_id?' · Tek nüsha':' · '+p.lesson));
   card.title=[rarityOf(p),effectOf(p),discoveryOf(p)].filter(Boolean).join(' · ');
   const effect=el('p','staff-paper-effect',rarityOf(p)+' · '+(effectOf(p)||discoveryOf(p)||'Bonus içeriği hazırlanıyor.'));
   card.append(small,heading,effect,readButton(p));return card;
  }
  function render(){
   if(!opened)return;
   modal.dataset.directory=String(inDirectory);
   back.setAttribute('aria-label',fromDirectory&&!inDirectory?'Çalışan listesine dön':'Özel çalışanları kapat');
   if(inDirectory){modal.setAttribute('aria-busy','false');return;}
   const d=defs.find(x=>x.id===role),s=data?.staff?.find(x=>x.id===role);nav.replaceChildren();info.replaceChildren();content.replaceChildren();modal.setAttribute('aria-busy',String(loading||busy));
   for(const r of defs){const b=button(r.title,()=>{if(busy||loading||role===r.id)return;role=r.id;page=0;data=null;message('');render();refresh();},'staff-tab');b.setAttribute('aria-pressed',String(role===r.id));b.disabled=busy;nav.append(b);}
   info.append(el('small','staff-profession',d.profession),el('h2','',s?.name||d.name),el('span','staff-place',d.place));
   const overall=el('div','staff-overall');overall.append(el('span','','Overall'),el('strong','',s?fmt(s.overall):'—'));info.append(overall);
   const collection=el('div','staff-collection');collection.append(el('span','','Koleksiyon'),el('strong','',s?fmt(s.collected)+' / '+fmt(s.total):'— / 500'));info.append(collection,meter('Toplanan papirüs',s?.collected||0,s?.total||500));
   const counts=el('div','staff-counts');counts.append(el('span','',s?fmt(s.read)+' okundu':'— okundu'),el('span','',s?fmt(s.collected-s.read)+' bekliyor':'— bekliyor'),el('span','staff-unique-count','Eşsiz '+fmt(s?.unique_collected||0)+(s?.unique_read?' · okundu':'')));info.append(counts);
   const benefits=el('section','staff-benefits');benefits.append(el('h3','','Öğrenilen pasif bonuslar'));
   if(s?.bonuses?.length){const list=el('div','staff-bonus-list');for(const b of s.bonuses){const row=el('div','staff-bonus');row.append(el('span','',b.label),el('strong','','+%'+fmt(b.percent)));list.append(row);}benefits.append(list);}
   else benefits.append(el('p','staff-empty',loading?'Bilgiler yükleniyor…':'Henüz öğrenilen bir pasif bonus yok.'));
   content.append(benefits);
   const papers=el('section','staff-papers'),papersHead=el('div','staff-section-head');papersHead.append(el('h3','','Papirüsler'),el('span','','Standart okuma +0,2 overall'));papers.append(papersHead);
   if(data?.role===role&&data.papyri?.length){
    const grid=el('div','staff-paper-grid');grid.append(...data.papyri.map(paperCard));papers.append(grid);
   }
   else papers.append(el('div','staff-papers-empty',loading?'Papirüsler yükleniyor…':'Bu çalışan için henüz papirüsün yok.'));
   const total=data?.role===role?data.paper_count||0:0;if(total>6){const pages=Math.ceil(total/6),pager=el('div','staff-pager'),prev=button('‹',()=>{page--;refresh();}),next=button('›',()=>{page++;refresh();});prev.setAttribute('aria-label','Önceki papirüsler');next.setAttribute('aria-label','Sonraki papirüsler');prev.disabled=busy||loading||page===0;next.disabled=busy||loading||page>=pages-1;pager.append(prev,el('span','',(page+1)+' / '+pages),next);papers.append(pager);}
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
  function adopt(result){if(result?.user_id!==owner)throw Error('Çalışan hesabı doğrulanamadı.');data=result;role=result.role;page=result.page;root.dispatchEvent(new CustomEvent('ludus-staff-change',{detail:{staff:data.staff}}));}
  async function refresh(){if(busy||loading)return;const request=++serial;loading=true;retry.hidden=true;render();try{await identify();const r=await ctx.client.rpc('ludus_special_staff',{p_role:role,p_page:page});if(request!==serial)return;if(r.error)throw r.error;adopt(r.data);if(pending){message('Önceki okumanın sonucu bekliyor. Yeniden dene ile kontrol et.');retry.hidden=false;}}
   catch(e){if(request===serial){message(e.message||'Çalışan bilgileri alınamadı.',true);retry.hidden=false;}}
   finally{if(request===serial){loading=false;render();}}
  }
  async function prepare(paper){if(busy||loading||pending||!owner)return;const p={owner,role,lesson:paper.lesson??null,unique_id:paper.unique_id??null,request:crypto.randomUUID()};try{localStorage.setItem('ludus-staff-read-v284:'+owner,JSON.stringify(p));pending=p;}catch{message('Okuma işlemi kaydedilemedi. Tarayıcı depolamasını kontrol et.',true);return;}await submit();}
  function clearPending(){pending=null;try{localStorage.removeItem('ludus-staff-read-v284:'+owner);}catch{}}
  async function submit(){
   if(busy||!pending)return;
   busy=true;retry.hidden=true;render();message('Papirüs okunuyor…');
   try{
    const unique=pending.unique_id,args={p_role:pending.role,p_request:pending.request};
    if(unique)args.p_unique_id=unique;else args.p_lesson=pending.lesson;
    const r=await ctx.client.rpc(unique?'ludus_special_staff_read_unique':'ludus_special_staff_read',args);
    if(r.error){if(['P0001','22023','22P02','23514'].includes(r.error.code))clearPending();throw r.error;}
    adopt(r.data);clearPending();
    message(unique?'Eşsiz papirüs öğrenildi. Pasif bonus güncellendi.':'Papirüs öğrenildi. Overall güncellendi.');
   }catch(e){message(e.message||'Sonuç alınamadı. Yeniden deneyebilirsin.',true);retry.hidden=false;}
   finally{busy=false;render();}
  }
  function enterModal(){
   if(opened)return;
   opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();
  }
  function openDirectory(){
   if(busy)return;
   const previous=role,returning=opened;
   enterModal();fromDirectory=true;inDirectory=true;serial++;loading=false;viewSerial++;viewId=null;
   message('');render();
   (returning?directory.querySelector('[data-role="'+previous+'"]'):directory.firstElementChild)?.focus({preventScroll:true});
  }
  function open(id='trainer'){
   if(!defs.some(d=>d.id===id)||busy||loading)return;
   if(!opened)fromDirectory=false;
   enterModal();inDirectory=false;role=id;page=0;data=null;message('');render();back.focus({preventScroll:true});refresh();
  }
  function goBack(){if(fromDirectory&&!inDirectory)openDirectory();else close();}
  function close(){if(!opened||busy)return;if(detail.open)detail.close();opened=false;serial++;loading=false;viewSerial++;viewId=null;viewModel?.removeFromParent();viewModel=null;viewRenderer?.renderLists.dispose();modal.hidden=true;inDirectory=false;fromDirectory=false;ctx.onClose?.();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  modal.addEventListener('pointerdown',e=>e.stopPropagation());modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();goBack();}if(e.key==='Tab'){const list=[...modal.querySelectorAll('button:not(:disabled)')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus();}}});
  return {open,openDirectory,close,refresh,get state(){return data;},get visible(){return opened;}};
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
