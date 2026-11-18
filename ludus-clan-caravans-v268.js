/* Shared caravans: each Ludus contributes only its own server-owned workers. */
(function(root){
 'use strict';
 const labels={iron_ore:'Demir cevheri',copper_ore:'Bakır cevheri',tin_ore:'Kalay cevheri',lead_ore:'Kurşun cevheri',wood:'Odun',flax:'Ham keten',hide:'Ham deri',wool:'Yün',resin:'Reçine',grain:'Buğday',apple:'Elma',fish:'Balık',meat:'Et',egg:'Yumurta',beer:'Şarap',olive_oil:'Zeytinyağı'};
 const places={iron_ore:'Demir madeni',copper_ore:'Bakır madeni',tin_ore:'Kalay madeni',lead_ore:'Kurşun madeni',wood:'Odun toplama alanı',flax:'Keten tarlası',hide:'Deri toplama alanı',wool:'Yün toplama alanı',resin:'Reçine ormanı',grain:'Buğday tarlası',apple:'Elma bahçesi',fish:'Balıkçılık alanı',meat:'Et üretim sahası',egg:'Yumurta çiftliği',beer:'Bağ ve şaraphane',olive_oil:'Zeytinlik'};
 const num=n=>new Intl.NumberFormat('tr-TR').format(Number(n)||0);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const time=t=>t?new Date(t).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}):'—';
 function collected(job,p,now){if(job.status==='completed')return p.gross_quantity||0;if(job.status==='forming')return 0;const start=Date.parse(job.started_at),end=Date.parse(job.ends_at);return Math.floor((p.gross_quantity||0)*Math.max(0,Math.min(1,(now-start)/(end-start))));}
 function create(ctx){
  let data=null,view='jobs',jobId=null,siteFilter=null,sku='iron_ore',picked=[],picker=false,page=0,rankKind='workers',period='all',busy=false,polling=false,error='',retry=null,offset=0,lastPoll=0,shell=null;
  const now=()=>Date.now()+offset;
  function setData(d){data=d;ctx.onData?.(d);if(view==='draft'&&!d.is_leader)view='jobs';offset=Date.parse(d.server_now)-Date.now();if(!Number.isFinite(offset))offset=0;lastPoll=Date.now();picked=picked.filter(id=>d.workers?.some(w=>w.id===id&&!w.busy));}
  function changed(){ctx.onChange?.();}
  function button(text,fn,cls='cv-button'){const b=el('button',cls,text);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b;}
  function navigate(v){view=v;siteFilter=null;jobId=null;picker=false;picked=[];page=0;error='';changed();}
  function openJob(id){jobId=id;view='detail';picker=false;picked=[];page=0;changed();}
  async function action(kind,payload,id){
   if(busy)return;busy=true;error='';const request=id||root.crypto?.randomUUID?.();if(!request){busy=false;error='İşlem kimliği oluşturulamadı.';changed();return;}
   retry={kind,payload,id:request};changed();
   try{const r=await ctx.client.rpc('ludus_clan_work_v232',{p_action:kind,p_data:payload,p_request:request});if(r.error)throw r.error;const account=await ctx.ready;if(r.data?.user_id!==account.user_id)throw Error('Hesap doğrulanamadı.');setData(r.data);retry=null;picked=[];picker=false;if(kind==='cancel')navigate('jobs');else if(r.data.result_job_id){view='detail';jobId=r.data.result_job_id;}ctx.onRoster?.();}
   catch(e){error=e?.message||'İşlem doğrulanamadı. Aynı isteği yeniden deneyebilirsin.';}
   finally{busy=false;changed();}
  }
  async function refresh(){if(polling||busy||document.hidden)return;polling=true;lastPoll=Date.now();try{const r=await ctx.client.rpc('ludus_clan_work_v232');if(r.error)throw r.error;if(r.data?.user_id===data?.user_id){setData(r.data);changed();}}catch(e){error='Kervan bilgisi yenilenemedi.';}finally{polling=false;}}
  function remaining(job){if(job.status==='completed')return 'Döndü · '+time(job.finished_at);if(job.status==='forming'){const seconds=Math.max(0,Math.ceil((Date.parse(job.created_at)+10000-now())/1000));return seconds?'Ekip doluyor · '+seconds+' sn':'Müsait işçi bekleniyor';}const seconds=Math.max(0,Math.ceil((Date.parse(job.ends_at)-now())/1000));return seconds?'Dönüşe '+[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(x=>String(x).padStart(2,'0')).join(':'):'Dönüş kaydediliyor';}
  function timer(job){const n=el('span','cv-countdown',remaining(job));n.dataset.cvTimer=job.id;return n;}
  function empty(text){return el('div','cv-empty',text);}
  function pages(total,size){const max=Math.max(1,Math.ceil(total/size));page=Math.min(page,max-1);const n=el('div','cv-pages'),prev=button('‹',()=>{page--;changed();}),next=button('›',()=>{page++;changed();});prev.disabled=busy||page===0;next.disabled=busy||page>=max-1;prev.setAttribute('aria-label','Önceki kervan sayfası');next.setAttribute('aria-label','Sonraki kervan sayfası');n.append(prev,el('span','',(page+1)+' / '+max),next);return n;}
  function heading(parent,title,extra){const row=el('div','cv-heading');row.append(el('h2','',title));if(extra)row.append(extra);parent.append(row);}
  function portrait(w){const p=el('span','workers-portrait cv-portrait'),i=Math.max(0,Math.min(7,Number(w.portrait)||0));if(i<6)p.style.backgroundPosition=([0,50,100][i%3])+'% '+(i<3?'0%':'100%');else p.classList.add('workers-portrait--'+(i+1));p.setAttribute('aria-hidden','true');return p;}
  function workerChooser(parent,job){
   const line=el('div','cv-heading');line.append(el('h3','','Kendi işçilerin'),el('span','',picked.length+' seçildi'));parent.append(line);
   const grid=el('div','cv-own-grid');const own=data.workers||[],free=job?10-job.worker_count:10;
   for(const w of own){const active=picked.includes(w.id),lv=w.skills?.[job?.sku||sku]||1;const b=button('',()=>{picked=active?picked.filter(x=>x!==w.id):[...picked,w.id];changed();},'cv-own');b.dataset.workerId=w.id;b.disabled=busy||w.busy||!active&&picked.length>=free;b.setAttribute('aria-pressed',String(active));b.append(el('strong','',w.name),el('small','',w.busy?'Görevde':'Meslek Sv. '+lv));grid.append(b);}
   parent.append(grid);const controls=el('div','cv-controls');if(job)controls.append(button('Vazgeç',()=>{picker=false;picked=[];changed();}));
   const submit=button(job?'İşçilerimi ekle':'Kervanı oluştur',()=>action(job?'join':'create',job?{job_id:job.id,workers:picked}:{sku,workers:picked}),'cv-primary');submit.disabled=busy||(job&&!picked.length)||!!retry;controls.append(submit);parent.append(controls);
  }
  function drawDraft(parent){heading(parent,'Kervan oluştur',button('Kervanlara dön',()=>navigate('jobs')));const row=el('div','cv-route'),label=el('label','','Gidilecek yer'),select=el('select');select.setAttribute('aria-label','Kervanın gideceği yer');for(const p of data.professions||[]){const o=el('option','',places[p.sku]||labels[p.sku]||p.sku);o.value=p.sku;select.append(o);}select.value=sku;select.disabled=busy||!!retry;select.addEventListener('change',()=>{sku=select.value;picked=[];changed();});label.append(select);row.append(label,el('span','','10 işçi · 6 saat · %20 devlet payı'));parent.append(row);workerChooser(parent);parent.append(el('p','cv-note','Kendi işçilerini ekleyebilirsin. Diğer luduslar kalan yerlere katılır; müsait botlar 10 saniye içinde ekibi tamamlar.'));}
  function drawJobs(parent,reports=false){
   heading(parent,reports?'Kervan raporları':siteFilter?(places[siteFilter]||labels[siteFilter]):'Toplama kervanları',siteFilter?button('Tüm bölgeler',()=>navigate('jobs')):!reports&&data.is_leader?button('Yeni kervan',()=>navigate('draft'),'cv-primary'):null);
   const rows=(data.jobs||[]).filter(j=>(reports?j.status==='completed':j.status!=='completed')&&(!siteFilter||j.sku===siteFilter));if(!rows.length){parent.append(empty(reports?'Tamamlanan kervanların raporları burada görünür.':'Henüz hazırlanmış veya yolda olan kervan yok.'));return;}
   const pager=pages(rows.length,6),grid=el('div','cv-job-grid');for(const j of rows.slice(page*6,page*6+6)){const b=button('',()=>openJob(j.id),'cv-job');b.dataset.jobId=j.id;b.append(el('strong','',places[j.sku]||labels[j.sku]),el('small','','Sahibi: '+(j.owner_name||'Ludus')),el('span','',j.worker_count+' / 10 işçi'),timer(j));if(reports){const net=j.participants.reduce((n,p)=>n+p.quantity,0);b.append(el('b','',num(net)+' net birim'));}grid.append(b);}parent.append(grid,pager);
  }
  function totals(parent,people,liveJob){
   const gross=people.reduce((n,p)=>n+(p.gross_quantity||0),0),tax=people.reduce((n,p)=>n+(p.tax_quantity||0),0),net=people.reduce((n,p)=>n+(p.quantity||0),0),row=el('div','cv-totals');
   for(const [name,val]of [[liveJob?'Toplanan / Hedef':'Toplanan',liveJob?num(people.reduce((n,p)=>n+collected(liveJob,p,now()),0))+' / '+num(gross):num(gross)],['Devlet payı',num(tax)],['Luduslara net',num(net)]]){const s=el('span');s.append(el('small','',name),el('strong','',val));if(liveJob&&name.startsWith('Toplanan'))s.querySelector('strong').dataset.cvTotal=liveJob.id;row.append(s);}parent.append(row);
  }
  function table(parent,rows,report=false){const box=el('div','cv-table');for(let group=0;group<2;group++){const half=el('div','cv-table-half'),head=el('div','cv-table-row cv-table-head');for(const t of [report?'İşçi · Ludus':'Sıra · '+(rankKind==='workers'?'İşçi':'Ludus'),'Toplanan','Vergi','Net'])head.append(el('span','',t));half.append(head);
   for(let i=group*5;i<group*5+5;i++){const r=rows[i],line=el('div','cv-table-row');if(r){const name=el('span','cv-table-name');name.append(el('strong','',(report?'':(page*10+i+1)+'. ')+(r.worker_name||r.name)),el('small','',report||rankKind==='workers'?r.ludus_name:(r.trips||0)+' sefer'));if(r.pending)name.append(el('small','cv-pending','Depoda yer bekliyor'));line.append(name,el('span','',num(r.gross_quantity)),el('span','',num(r.tax_quantity)),el('strong','',num(r.quantity)));}else line.classList.add('cv-table-blank');half.append(line);}box.append(half);}parent.append(box);}
  function drawDetail(parent){
   const j=data.jobs?.find(x=>x.id===jobId);if(!j){parent.append(empty('Kervan bulunamadı.'),button('Kervanlara dön',()=>navigate('jobs')));return;}
   const head=el('div','cv-heading');head.append(button('‹',()=>navigate(j.status==='completed'?'reports':'jobs')),el('h2','',places[j.sku]||labels[j.sku]),timer(j));parent.append(head);
   parent.append(el('p','cv-note','Sahibi: '+(j.owner_name||'Ludus')+' · '+labels[j.sku]+' · '+j.worker_count+' / 10 işçi'+(j.status==='forming'?'':' · Dönüş: '+time(j.ends_at))));
   if(j.status==='completed'){totals(parent,j.participants);table(parent,j.participants,true);parent.append(el('p','cv-note','Ürünler her işçinin kendi ludusuna aktarılır. Toplanan = vergi + net.'));return;}
   if(picker&&j.status==='forming'){workerChooser(parent,j);return;}
   picker=false;const grid=el('div','cv-team');for(let i=0;i<10;i++){const p=j.participants[i];if(!p){const b=button('+ İşçi ekle',()=>{picker=true;picked=[];changed();},'cv-seat cv-seat-empty');b.disabled=busy||j.status!=='forming';grid.append(b);continue;}
    const card=el('div','cv-seat');card.dataset.workerId=p.worker_id;card.append(portrait(p),el('strong','',p.worker_name),el('small','cv-owner',p.ludus_name),el('small','','Meslek Sv. '+p.level));const progress=el('b','cv-collected','Toplanan: '+collected(j,p,now()));progress.dataset.cvCollected=j.id;progress.dataset.cvWorker=p.worker_id;card.append(progress);
    if(j.status==='forming'&&p.owner_id===data.user_id){const remove=button('Çıkar',()=>action('leave',{job_id:j.id,worker_id:p.worker_id}),'cv-remove');card.append(remove);}grid.append(card);
   }parent.append(grid);totals(parent,j.participants,j);
   if(j.status==='forming'){const controls=el('div','cv-controls');controls.append(button('Kendi işçini ekle',()=>{picker=true;picked=[];changed();},'cv-primary'));if(j.owner_id===data.user_id)controls.append(button('Kervanı iptal et',()=>action('cancel',{job_id:j.id})));parent.append(controls);}
   else parent.append(el('p','cv-note','Toplanan miktar sefer ilerledikçe artar. Vergi ve teslimat dönüşte kesinleşir.'));
  }
  function drawRanks(parent){heading(parent,'En çok toplayanlar');const controls=el('div','cv-rank-controls');for(const [id,label]of [['workers','İşçiler'],['ludus','Luduslar']]){const b=button(label,()=>{rankKind=id;page=0;changed();});b.setAttribute('aria-pressed',String(rankKind===id));controls.append(b);}const select=el('select');select.setAttribute('aria-label','Sıralama dönemi');for(const[id,label]of[['all','Tüm zamanlar'],['week','Bu hafta']]){const o=el('option','',label);o.value=id;select.append(o);}select.value=period;select.addEventListener('change',()=>{period=select.value;page=0;changed();});controls.append(select);parent.append(controls);
   const rows=data.rankings?.[(period==='week'?'weekly_':'')+rankKind]||[];if(!rows.length){parent.append(empty('Tamamlanan seferlerle sıralama oluşacak.'));return;}const nav=pages(rows.length,10);totals(parent,rows);table(parent,rows.slice(page*10,page*10+10));parent.append(nav,el('p','cv-note','Net toplama miktarına göre sıralanır. Yoldaki kervanlar henüz dahil değildir.'));
  }
  function drawStock(parent){heading(parent,'Depom');const grid=el('div','clan-work-stock');for(const p of data.professions||[]){const card=el('div','clan-work-stock-card'),img=el('img','clan-work-stock-image');img.src=(['wood','grain','apple','fish','meat','egg','beer','olive_oil'].includes(p.sku)?'assets/resource-icons-v95/':'assets/items-v118/')+p.sku+'.webp';img.alt='';card.append(img,el('span','clan-work-stock-name',labels[p.sku]||p.sku),el('strong','clan-work-stock-quantity',num(data.stock?.[p.sku])));grid.append(card);}parent.append(grid);}
  function draw(parent){shell=el('section','cv-shell');shell.setAttribute('aria-label','Toplama kervanları');parent.append(shell);const tabs=el('nav','cv-tabs');for(const[id,label]of[['jobs','Kervanlar'],['reports','Raporlar'],['ranks','Sıralama'],['stock','Depom']]){const b=button(label,()=>navigate(id),'cv-tab');b.setAttribute('aria-pressed',String(view===id||id==='jobs'&&['draft','detail'].includes(view)));tabs.append(b);}shell.append(tabs);const body=el('div','cv-body');shell.append(body);
   if(view==='draft')drawDraft(body);else if(view==='detail')drawDetail(body);else if(view==='reports')drawJobs(body,true);else if(view==='ranks')drawRanks(body);else if(view==='stock')drawStock(body);else drawJobs(body);
   if(error){const msg=el('div','cv-error');msg.setAttribute('role','alert');msg.append(el('span','',error));if(retry)msg.append(button('Aynı isteği yeniden dene',()=>action(retry.kind,retry.payload,retry.id)));else msg.append(button('Yenile',refresh));shell.append(msg);}
  }
  function tick(){if(!data||!shell?.isConnected)return;for(const n of shell.querySelectorAll('[data-cv-timer]')){const j=data.jobs.find(j=>j.id===n.dataset.cvTimer);if(j)n.textContent=remaining(j);}for(const n of shell.querySelectorAll('[data-cv-collected]')){const j=data.jobs.find(j=>j.id===n.dataset.cvCollected),p=j?.participants.find(p=>p.worker_id===n.dataset.cvWorker);if(p)n.textContent='Toplanan: '+collected(j,p,now());}for(const n of shell.querySelectorAll('[data-cv-total]')){const j=data.jobs.find(j=>j.id===n.dataset.cvTotal);if(j)n.textContent=num(j.participants.reduce((s,p)=>s+collected(j,p,now()),0))+' / '+num(j.participants.reduce((s,p)=>s+p.gross_quantity,0));}
   const waiting=data.jobs?.some(j=>j.status==='forming'),due=data.jobs?.some(j=>j.status==='collecting'&&Date.parse(j.ends_at)<=now());if(Date.now()-lastPoll>=(waiting||due?1000:15000))refresh();
  }
  return {setData,draw,tick,showSite(value){if(!Object.hasOwn(labels,value))return;siteFilter=value;sku=value;view='jobs';jobId=null;picker=false;picked=[];page=0;error='';changed();},showJobs(){navigate('jobs');},selectSKU(value){sku=value;view=data&&!data.is_leader?'jobs':'draft';picked=[];jobId=null;picker=false;page=0;},refresh};
 }
 root.LudusClanCaravansV268={create,collected};
})(globalThis);
