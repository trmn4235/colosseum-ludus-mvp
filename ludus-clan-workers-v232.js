/* Shared imperial work sites. Rates are server-owned and explicitly marked as test balance. */
(function(root){
 'use strict';
 const labels={iron_ore:'Demir cevheri',copper_ore:'Bakır cevheri',tin_ore:'Kalay cevheri',lead_ore:'Kurşun cevheri',wood:'Odun',flax:'Ham keten',hide:'Ham deri',wool:'Yün',resin:'Reçine',grain:'Tahıl',apple:'Elma',fish:'Balık',meat:'Et',egg:'Yumurta',beer:'Şarap',olive_oil:'Zeytinyağı'};
 const awards=[.50,.46,.42,.38,.36,.32,.28,.24,.22,.18];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
 const num=n=>new Intl.NumberFormat('tr-TR').format(Number(n)||0);
 const fame=n=>(Number(n)||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
 const time=t=>t?new Date(t).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}):'—';
 function create(ctx){
  let data=null,problem='',busy=false,view='weekly',page=0,sku='iron_ore',picked=[],request=null,serial=0,selectedJob=null;
  function button(label,fn,cls='clan-work-button'){const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
  function changed(refreshRoster=false){ctx.onChange?.(refreshRoster);}
  function setView(next){view=next;page=0;selectedJob=null;problem='';changed();}
  function setSelection(next){picked=next;request=null;changed();}
  function empty(title,detail){const box=el('div','clan-work-empty');box.append(el('strong','',title),el('span','',detail));return box;}
  function pager(total,size){const max=Math.max(1,Math.ceil(total/size));page=Math.max(0,Math.min(page,max-1));const bar=el('div','clan-work-pages');const prev=button('‹',()=>{page--;changed();}),next=button('›',()=>{page++;changed();});prev.disabled=page===0;next.disabled=page>=max-1;prev.setAttribute('aria-label','Önceki sayfa');next.setAttribute('aria-label','Sonraki sayfa');bar.append(prev,el('span','',(page+1)+' / '+max),next);return bar;}
  async function load(){const n=++serial;try{const account=await ctx.ready;const r=await ctx.client.rpc('ludus_clan_work_v232');if(n!==serial)return;if(r.error||r.data?.user_id!==account.user_id)throw r.error||Error('Hesap doğrulanamadı');data=r.data;if(problem==='Klan çalışma bilgileri alınamadı.')problem='';picked=picked.filter(id=>data.workers?.some(w=>w.id===id&&!w.busy&&(w.skills?.[sku]||1)>=5));}catch(e){if(n===serial){data=null;problem='Klan çalışma bilgileri alınamadı.';}}}
  async function action(kind,payload,id){if(busy)return;busy=true;problem='';changed();try{const r=await ctx.client.rpc('ludus_clan_work_v232',{p_action:kind,p_data:payload,p_request:id||null});if(r.error)throw r.error;const account=await ctx.ready;if(r.data?.user_id!==account.user_id)throw Error('Hesap doğrulanamadı');data=r.data;if(kind==='start'){picked=[];request=null;problem='5 işçi için 6 saatlik lisans başladı.';}else problem='Deneme ayarları kaydedildi.';ctx.onAction?.();}catch(e){problem=e?.message||'İşlem tamamlanamadı.';}finally{busy=false;changed(kind==='start');}}
  function top(){const box=el('div','clan-work-top');const modes=[['weekly','Haftalık toplanan'],['workers','İşçi üretimi'],['jobs','Lisanslar'],['stock','Depom'],['rewards','Ödüller']];if(data?.is_leader)modes.unshift(['team','Ekip kur']);for(const [key,label]of modes){const b=button(label,()=>setView(key),'clan-work-tab');b.setAttribute('aria-pressed',String(view===key));box.append(b);}return box;}
  function row(left,right,sub,click){const r=click?button('',click,'clan-work-row'):el('div','clan-work-row'),a=el('div','clan-work-row-main');a.append(el('strong','',left));if(sub)a.append(el('small','',sub));r.append(a,el('b','',right));return r;}
  function listRows(items,render,size=4){const shell=el('div','clan-work-list');for(const [index,item]of items.slice(page*size,page*size+size).entries())shell.append(render(item,page*size+index));return shell;}
  function drawWeekly(content){const head=el('div','clan-work-heading');head.append(el('strong','','Haftalık toplanan'),el('span','','Pazar 23.59 · İstanbul'));content.append(head,el('p','clan-work-note','Devlet payından sonra kazanılan net ürünler. Alışveriş dahil değil.'));
   const rows=data.ranking||[];if(!rows.length){content.append(empty('Bu hafta toplama yok','Tamamlanan lisanslı çalışmalar burada sıralanır.'));return;}
   content.append(listRows(rows,(x,i)=>row((i+1)+'. '+x.ludus_name,num(x.quantity)+' birim',i<10?'Haftalık şan: +'+fame(awards[i]):'Haftalık şan ödülü yok')),pager(rows.length,4));
  }
  function drawWorkers(content){const head=el('div','clan-work-heading');head.append(el('strong','','Haftalık işçi üretimi'),el('span','','Devlet payı sonrası net'));content.append(head);const rows=data.worker_ranking||[];if(!rows.length){content.append(empty('Henüz toplama yok','Tamamlanan çalışmalar burada görünür.'));return;}content.append(listRows(rows,x=>row(x.worker_name+' · '+x.ludus_name,num(x.quantity)+' birim',labels[x.sku]||x.sku)),pager(rows.length,4));}
  function drawJobs(content){
   const rows=data.jobs||[],job=rows.find(x=>x.id===selectedJob),head=el('div','clan-work-heading');
   if(job){head.append(button('‹ Lisanslar',()=>{selectedJob=null;page=0;changed();}),el('strong','',labels[job.sku]||job.sku),el('span','','Brüt / Devlet / Net'));content.append(head);
    const parts=job.participants||[];content.append(listRows(parts,p=>row(p.worker_name+' · '+p.ludus_name,[p.gross_quantity??p.quantity,p.tax_quantity||0,p.quantity].map(num).join(' / '),'Sv. '+p.level+' · '+(p.pending?'Depoda yer bekliyor':job.finished_at?'Tamamlandı':'Dönüş '+time(job.ends_at)))),pager(parts.length,4));return;
   }
   head.append(el('strong','','Çalışma lisansları'),el('span','','Ürünler işçinin sahibine gider'));content.append(head);
   if(!rows.length){content.append(empty('Lisanslı çalışma yok','Klan lideri 5 işçiyle ekip kurabilir.'));return;}
   content.append(listRows(rows,x=>row((labels[x.sku]||x.sku)+' · '+x.worker_count+' işçi',num(x.quantity)+' net',
    (x.finished_at?'Tamamlandı':'Dönüş '+time(x.ends_at))+' · Brüt '+num(x.gross_quantity??x.quantity)+' · Devlet '+num(x.tax_quantity),()=>{selectedJob=x.id;page=0;changed();})),pager(rows.length,4));
  }
  function drawStock(content){
   const head=el('div','clan-work-heading');head.append(el('strong','','Kendi depom'),el('span','','Malzeme ve yemekhanedeki stok'));content.append(head);
   const rows=data.professions||[],size=16,grid=el('div','clan-work-stock');
   page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1)));
   for(const p of rows.slice(page*size,(page+1)*size)){
    const card=el('div','clan-work-stock-card'),pending=Number(data.pending_delivery?.[p.sku]||0),label=labels[p.sku]||p.sku;
    const picture=el('img','clan-work-stock-image');picture.src=(['wood','grain','apple','fish','meat','egg','beer','olive_oil'].includes(p.sku)?'assets/resource-icons-v95/':'assets/items-v118/')+p.sku+'.webp';picture.alt='';picture.width=40;picture.height=40;picture.decoding='async';
    const name=el('span','clan-work-stock-name',label);name.title=label;
    card.append(picture,name,el('strong','clan-work-stock-quantity',num(data.stock?.[p.sku])+' birim'));
    if(pending){card.classList.add('clan-work-pending');card.append(el('small','',num(pending)+' birim teslimat bekliyor'));}
    grid.append(card);
   }
   content.append(grid);if(rows.length>size)content.append(pager(rows.length,size));
  }
  function drawRewards(content){const head=el('div','clan-work-heading');head.append(el('strong','','Haftalık şan ödülleri'),el('span','','Klan: '+fame(data.clan_glory)+' · Şanım: '+fame(data.my_glory)));content.append(head);const rows=data.rewards||[];if(!rows.length){content.append(empty('Henüz dağıtılmış ödül yok','Ödüller pazar 23.59’da hesaplanır.'));return;}content.append(listRows(rows,x=>row(x.rank+'. '+x.ludus_name,'+'+fame(x.glory_hundredths/100),time(x.week_end)+' · '+num(x.quantity)+' net birim')),pager(rows.length,4));}
  function yieldFor(level){return data?.config?.yield_by_level?.find(x=>x.level===level);}
  function drawTeam(content){if(!data.is_leader){content.append(empty('Ekip kurma yetkisi','Lisanslı çalışma ekibini klan lideri oluşturur.'));return;}const config=data.config||{},bar=el('div','clan-work-select'),label=el('label','','Lisans ürünü'),select=el('select');select.setAttribute('aria-label','Lisans ürünü');for(const p of data.professions||[]){const o=el('option','',labels[p.sku]||p.sku);o.value=p.sku;select.append(o);}select.value=sku;select.addEventListener('change',()=>{sku=select.value;page=0;setSelection([]);});label.append(select);
   const chosen=el('span','',picked.length+' / 5 işçi'),start=button('Lisansı başlat',()=>{request=request||(root.crypto?.randomUUID?.());if(!request){problem='İşlem kimliği oluşturulamadı.';changed();return;}action('start',{sku,workers:picked},request);},'clan-work-primary');start.disabled=busy||!data.enabled||picked.length!==5||!config.yield_by_level;bar.append(label,chosen,start);content.append(bar,el('p','clan-work-note','6 saat · %20 devlet payı · En az Sv. 5 · +'+num(config.experience)+' meslek EXP'));
   const workers=data.workers||[],totals=workers.filter(w=>picked.includes(w.id)).map(w=>yieldFor(w.skills?.[sku]||1)).filter(Boolean);
   content.append(el('p','clan-work-note clan-work-estimate','Seçilen ekip: '+num(totals.reduce((n,x)=>n+x.gross,0))+' brüt · '+num(totals.reduce((n,x)=>n+x.tax,0))+' devlet · '+num(totals.reduce((n,x)=>n+x.net,0))+' Luduslara'));
   if(!data.enabled)content.append(el('p','clan-work-note','Çalışma lisansları henüz açılmadı.'));
   if(!workers.length){content.append(empty('İşçi kaydı yok','Klan üyeleri İşçilerim ekranını açtığında işçileri listelenir.'));return;}
   content.append(listRows(workers,(w)=>{const level=w.skills?.[sku]||1,active=picked.includes(w.id),y=yieldFor(level),b=button('',()=>setSelection(active?picked.filter(x=>x!==w.id):[...picked,w.id]),'clan-work-choice');b.dataset.workerId=w.id;b.disabled=busy||w.busy||level<5||!active&&picked.length>=5;b.setAttribute('aria-pressed',String(active));b.append(el('strong','',(active?'✓  ':'')+w.name+' · '+w.ludus_name),el('span','',w.busy?'Görevde':level<5?'Sv. '+level+' · Uygun değil':'Sv. '+level+' · '+num(y?.net)+' net'));return b;}),pager(workers.length,4));
  }
  function draw(body){const shell=el('section','clan-work-shell');shell.setAttribute('aria-label','Klan çalışmaları');body.append(shell);if(!data){shell.append(empty(problem||'Klan çalışmaları yükleniyor','Bilgileri yenileyerek tekrar deneyebilirsin.'));return;}if(!data.clan_id){shell.append(empty('Klan üyesi değilsin',data.message||'Klan çalışmalarına katılmak için bir klana üye ol.'));return;}shell.append(top());const content=el('div','clan-work-content');shell.append(content);if(view==='team')drawTeam(content);else if(view==='workers')drawWorkers(content);else if(view==='jobs')drawJobs(content);else if(view==='stock')drawStock(content);else if(view==='rewards')drawRewards(content);else drawWeekly(content);if(problem){const message=el('p','clan-work-message',problem);message.setAttribute('role','status');shell.append(message);}}
  return {selectLicense(value){if(!Object.hasOwn(labels,value))return;sku=value;view='team';page=0;picked=[];request=null;selectedJob=null;changed();},load,draw};
 }
 root.LudusClanWorkersV232={create};
})(globalThis);
