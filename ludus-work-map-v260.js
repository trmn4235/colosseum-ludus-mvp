/* Map-based clan expeditions. The existing RPC owns eligibility, reservations and delivery. */
(function(root){
 'use strict';
 const labels={iron_ore:'Demir ocağı',copper_ore:'Bakır ocağı',tin_ore:'Kalay ocağı',lead_ore:'Kurşun ocağı',wood:'Odun sahası',flax:'Keten tarlası',hide:'Deri sahası',wool:'Yün çiftliği',resin:'Reçine ormanı',grain:'Tahıl tarlası',apple:'Elma bahçesi',fish:'Balıkçılık alanı',meat:'Av sahası',egg:'Yumurta çiftliği',beer:'Üzüm bağı',olive_oil:'Zeytinlik'};
 const number=n=>Number(n||0).toLocaleString('tr-TR');
 const element=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=String(text);return e;};
 const button=(text,fn,cls='workmap-button')=>{const b=element('button',cls,text);b.type='button';b.onclick=fn;return b;};
 const date=value=>new Date(value).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'});
 function create(ctx){
  let data=null,owner=null,storageKey=null,restored=false,loading=null,busy=false,problem='',notice='',view='team',sku='iron_ore',picked=[],filter='',page=0,jobId=null,pending=null,offset=0,lastLoad=0,lastTick=0;
  const changed=()=>ctx.onChange?.();
  const minimum=()=>data?.config?.min_level||5;
  const level=w=>Number(w.skills?.[sku]||1);
  const available=w=>!w.busy&&level(w)>=minimum();
  const yieldFor=w=>data?.config?.yield_by_level?.find(y=>y.level===level(w));
  function adopt(next){
   if(!next||next.user_id!==owner)throw Error('Hesap doğrulanamadı. Yeniden giriş yap.');
   data=next;offset=Date.parse(data.server_now)-Date.now();if(!Number.isFinite(offset))offset=0;
   if(!pending)picked=picked.filter(id=>data.workers?.some(w=>w.id===id&&available(w)));
   lastLoad=Date.now();
  }
  async function identify(){
   const account=await ctx.ready;if(!account?.user_id)throw Error('Hesabına giriş yap.');
   if(owner!==account.user_id){owner=account.user_id;storageKey='ludus-work-map-v260:'+owner;restored=false;data=null;picked=[];pending=null;}
   if(!restored){restored=true;try{const p=JSON.parse(localStorage.getItem(storageKey)||'null');if(p?.owner===owner&&labels[p.sku]&&typeof p.request==='string'&&Array.isArray(p.workers)&&p.workers.length===5&&new Set(p.workers).size===5&&p.workers.every(id=>typeof id==='string')){pending=p;sku=p.sku;picked=[...p.workers];view='team';notice='Önceki gönderimin sonucu doğrulanmalı.';}}catch{problem='İşlem kaydı okunamadı. Tarayıcı depolamasını kontrol et.';}}
  }
  function load(){
   if(busy)return Promise.resolve();
   if(loading)return loading;
   lastLoad=Date.now();
   loading=(async()=>{try{await identify();const r=await ctx.client.rpc('ludus_clan_work_v232');if(r.error)throw r.error;adopt(r.data);problem='';}catch(e){problem=e?.message||'Klan işçileri yüklenemedi.';}finally{loading=null;changed();}})();
   changed();return loading;
  }
  function select(value){
   if(!labels[value])return;
   view='team';jobId=null;page=0;filter='';notice='';problem='';
   if(!pending){sku=value;picked=[];}else{sku=pending.sku;notice='Bekleyen gönderimi önce doğrula; aynı ekip ikinci kez yollanmaz.';}
   changed();
  }
  function showJobs(){view='jobs';page=0;jobId=null;changed();}
  function clearPending(){pending=null;try{localStorage.removeItem(storageKey);}catch{}}
  async function send(){
   if(busy||loading||!data?.is_leader)return;
   if(!pending){
    const crew=(data.workers||[]).filter(w=>picked.includes(w.id));
    if(!data.enabled||crew.length!==5||crew.some(w=>!available(w))||!data.config?.yield_by_level)return;
    const request=root.crypto?.randomUUID?.();if(!request){problem='İşlem kimliği oluşturulamadı.';changed();return;}
    const receipt={owner,clan_id:data.clan_id,sku,workers:[...picked],request};
    try{localStorage.setItem(storageKey,JSON.stringify(receipt));pending=receipt;}catch{problem='Gönderim kaydı saklanamadı. Tarayıcı depolamasını kontrol et.';changed();return;}
   }
   busy=true;problem='';notice='Ekip gönderiliyor…';changed();
   try{
    const receipt=pending,r=await ctx.client.rpc('ludus_clan_work_v232',{p_action:'start',p_data:{sku:receipt.sku,workers:receipt.workers},p_request:receipt.request});
    if(r.error){if(['P0001','22003','22P02','23514','42501'].includes(r.error.code))clearPending();throw r.error;}
    adopt(r.data);clearPending();picked=[];view='jobs';page=0;jobId=null;notice='5 kişilik ekip görevi kaydedildi. Ürünler dönüşte işçilerin sahiplerine teslim edilir.';ctx.onStarted?.();
   }catch(e){problem=(e?.message||'Yanıt alınamadı.')+(pending?' Gönderimi aynı işlem kimliğiyle tekrar kontrol et.':'');notice='';}
   finally{busy=false;changed();}
  }
  function pager(parent,total,size){
   const count=Math.max(1,Math.ceil(total/size));page=Math.max(0,Math.min(page,count-1));
   const nav=element('nav','workmap-pages'),previous=button('‹',()=>{page--;changed();}),next=button('›',()=>{page++;changed();});
   previous.setAttribute('aria-label','Önceki işçiler veya görevler');next.setAttribute('aria-label','Sonraki işçiler veya görevler');previous.disabled=busy||page===0;next.disabled=busy||page===count-1;
   nav.append(previous,element('span','',(page+1)+' / '+count),next);parent.append(nav);
  }
  function message(parent,title,detail){const box=element('div','workmap-empty');box.append(element('strong','',title),element('p','',detail));parent.append(box);}
  function timer(job){
   if(job.finished_at)return job.participants?.some(p=>p.pending)?'Depoda yer bekliyor':'Tamamlandı';
   const seconds=Math.max(0,Math.ceil((Date.parse(job.ends_at)-Date.now()-offset)/1000));
   return seconds?[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':'):'Teslimat işleniyor';
  }
  function drawTeam(shell){
   const toolbar=element('div','workmap-toolbar'),title=element('div','workmap-title');
   title.append(element('strong','',labels[sku]),element('small','',data.professions?.find(p=>p.sku===sku)?.name||'Çalışma ekibi'));
   const label=element('label','workmap-filter','Ludus'),select=element('select');select.id='workmapLudus';select.setAttribute('aria-label','Ekip için Ludus filtresi');
   const all=element('option','','Tüm klan');all.value='';select.append(all);
   const owners=new Map((data.workers||[]).map(w=>[w.owner_id,w.ludus_name]));for(const [id,name]of owners){const o=element('option','',name);o.value=id;select.append(o);}
   if(filter&&!owners.has(filter))filter='';select.value=filter;select.disabled=busy||!!pending;select.onchange=()=>{filter=select.value;page=0;changed();};label.append(select);toolbar.append(title,label);shell.append(toolbar);
   const team=element('div','workmap-selected');team.setAttribute('aria-label','Seçilen beş işçi');
   for(let i=0;i<5;i++){const w=data.workers?.find(w=>w.id===picked[i]),b=button(w?w.name:(i+1)+'. işçi',()=>{picked=picked.filter(id=>id!==w.id);changed();},'workmap-slot');b.disabled=busy||!!pending||!w;b.title=w?w.name+' · '+w.ludus_name+' · Seçimden çıkar':'İşçi seç';b.setAttribute('aria-label',b.title);if(w)b.dataset.pickedWorker=w.id;team.append(b);}shell.append(team);
   const main=element('div','workmap-main'),scene=element('aside','workmap-site'),art=ctx.picture?.(sku);if(art){art.classList.add('workmap-art');scene.append(art);}
   scene.append(element('strong','','5 işçi · 6 saat'),element('span','','%20 devlet payı'),element('span','','İşçi başına 8–24 net ürün'),element('small','','Ürünler her işçinin Ludus’una gider.'),element('small','','Gereken meslek seviyesi: '+minimum()));
   const shopping=button('Mesleği geliştir · Alışveriş',()=>ctx.onShop?.(sku),'workmap-training');shopping.disabled=busy||!!pending;scene.append(shopping);
   const roster=element('div','workmap-roster'),workers=(data.workers||[]).filter(w=>!filter||w.owner_id===filter).sort((a,b)=>Number(available(b))-Number(available(a))||a.ludus_name.localeCompare(b.ludus_name,'tr')||a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id));
   const size=6;page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(workers.length/size)-1)));const grid=element('div','workmap-worker-grid');
   for(const w of workers.slice(page*size,(page+1)*size)){
    const active=picked.includes(w.id),eligible=available(w),b=button('',()=>{picked=active?picked.filter(id=>id!==w.id):[...picked,w.id];problem='';changed();},'workmap-worker');
    b.dataset.workWorker=w.id;b.setAttribute('aria-pressed',String(active));b.disabled=busy||!!pending||!data.is_leader||!data.enabled||!eligible||!active&&picked.length>=5;b.title=w.name+' · '+w.ludus_name;
    b.append(element('strong','',(active?'✓ ':'')+w.name),element('span','',w.ludus_name),element('small','',w.busy?'Başka görevde':!eligible?'Sv. '+level(w)+' · Sv. '+minimum()+' gerekli':'Sv. '+level(w)+' · '+number(yieldFor(w)?.net)+' net'));grid.append(b);
   }
   if(!workers.length)message(grid,'İşçi bulunamadı','Klan üyelerinin İşçilerim ekranında oluşturduğu işçiler burada görünür.');
   roster.append(grid);pager(roster,workers.length,size);main.append(scene,roster);shell.append(main);
   const crew=(data.workers||[]).filter(w=>picked.includes(w.id)),yields=crew.map(yieldFor).filter(Boolean),net=yields.reduce((a,y)=>a+Number(y.net),0),tax=yields.reduce((a,y)=>a+Number(y.tax),0);
   const foot=element('div','workmap-send'),estimate=element('span','',picked.length+' / 5 işçi · '+number(net)+' net · '+number(tax)+' devlet');
   const start=button(busy?'Gönderiliyor…':pending?'Gönderimi doğrula':'Ekibi gönder',send,'workmap-primary');start.dataset.workSend='';start.disabled=busy||!!loading||!data.is_leader||(!pending&&(!data.enabled||picked.length!==5||crew.length!==5||crew.some(w=>!available(w))||!data.config?.yield_by_level));
   foot.append(estimate,start);shell.append(foot);
   if(!data.is_leader)shell.append(element('p','workmap-info','Ekibi klan lideri çıkarır. Görevleri tüm klan üyeleri takip edebilir.'));
   else if(!data.enabled)shell.append(element('p','workmap-info','Çalışma lisansları henüz açılmadı.'));
   else if(!data.workers?.some(available))shell.append(element('p','workmap-info','Bu meslekte hazır Sv. '+minimum()+' işçi yok. Alışveriş görevleriyle meslek EXP kazanabilirsin.'));
  }
  function drawJobs(shell){
   const jobs=[...(data.jobs||[])].sort((a,b)=>Number(!!a.finished_at)-Number(!!b.finished_at)||Date.parse(b.started_at)-Date.parse(a.started_at)),job=jobs.find(j=>j.id===jobId);
   if(job){
    const title=element('div','workmap-job-title');title.append(button('‹ Ekipler',()=>{jobId=null;page=0;changed();}),element('strong','',labels[job.sku]||job.sku),element('span','',timer(job)));title.lastChild.dataset.workClock=job.id;shell.append(title);
    const rows=element('div','workmap-participants');for(const p of job.participants||[]){const row=element('div','workmap-person'),who=element('div');who.append(element('strong','',p.worker_name),element('small','',p.ludus_name));row.append(who,element('span','','Sv. '+p.level),element('b','',number(p.quantity)+' net'),element('small','',p.pending?'Depoda yer bekliyor':job.finished_at?(p.delivered===false?'Teslimat bekliyor':'Teslim edildi'):'Dönüşte teslim'));rows.append(row);}shell.append(rows);
    shell.append(element('p','workmap-total','Brüt '+number(job.gross_quantity??job.quantity)+' · Devlet '+number(job.tax_quantity)+' · Luduslara '+number(job.quantity)),element('small','workmap-date','Başlangıç '+date(job.started_at)+' · Dönüş '+date(job.ends_at)+' (İstanbul)'));return;
   }
   if(!jobs.length){message(shell,'Henüz çalışma ekibi yok','Haritadan maden, tarla veya balıkçılık alanı seçerek beş kişilik ekip çıkar.');return;}
   const list=element('div','workmap-job-list'),size=4;page=Math.max(0,Math.min(page,Math.ceil(jobs.length/size)-1));
   for(const job of jobs.slice(page*size,(page+1)*size)){const card=button('',()=>{jobId=job.id;changed();},'workmap-job'),info=element('div'),clock=element('b','',timer(job));clock.dataset.workClock=job.id;info.append(element('strong','',labels[job.sku]||job.sku),element('small','',job.worker_count+' işçi · '+number(job.quantity)+' net ürün'));card.append(info,clock);card.dataset.workJob=job.id;list.append(card);}shell.append(list);pager(shell,jobs.length,size);
  }
  function draw(parent){
   const shell=element('section','workmap-screen');shell.dataset.workSite=sku;shell.dataset.workView=view;shell.setAttribute('aria-label','Haritadan klan çalışma ekibi');parent.append(shell);
   const nav=element('div','workmap-nav'),back=button('‹ Kaynak haritası',()=>ctx.onBack?.()),jobs=button('Çalışma ekipleri',showJobs);back.disabled=jobs.disabled=busy;const refresh=button('Yenile',load);refresh.disabled=busy||!!loading;nav.append(back,jobs,refresh);shell.append(nav);
   if(!data){message(shell,loading?'Klan işçileri yükleniyor…':'İşçiler yüklenemedi',problem||'Bilgileri yenileyerek tekrar dene.');return;}
   if(!data.clan_id){message(shell,'Klan üyesi değilsin','Çalışma ekibi oluşturmak için bir klana katıl.');return;}
   if(view==='jobs')drawJobs(shell);else drawTeam(shell);
   if(problem||notice){const note=element('p','workmap-status',problem||notice);note.setAttribute('role','status');shell.append(note);}
  }
  function tick(visible){
   if(!visible||document.hidden||Date.now()-lastTick<1000)return;lastTick=Date.now();
   for(const e of document.querySelectorAll('[data-work-clock]')){const job=data?.jobs?.find(j=>j.id===e.dataset.workClock);if(job)e.textContent=timer(job);}
   if(!busy&&!loading&&Date.now()-lastLoad>30000)load();
  }
  return {load,select,showJobs,draw,tick,get activeJobs(){return(data?.jobs||[]).filter(j=>!j.finished_at);},get busy(){return busy;}};
 }
 root.LudusWorkMapV260={create,labels};
})(globalThis);
