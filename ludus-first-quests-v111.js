/* Beginner quest notebook. All completion values come from the account RPC. */
(function(root){
'use strict';
const quests=[
 ['inspect','Gladyatörlerini tanı','Başlangıçtaki iki gladyatörünün sınıfını ve özelliklerini incele.','İki gladyatörün detayını ayrı ayrı aç.','inspect'],
 ['combat','Gerçek gücünü gör','Savaş Değerleri panelini aç ve bir değerin katkı kaynaklarını incele.','Gladyatör detayında ÖZELLİKLER yanındaki kalkan simgesine, ardından bir değere dokun.','inspect'],
 ['controls','Kontrollerini hazırla','Ayarlar’dan bir dövüş kontrol düzeni seç ve kaydet.','Klasik veya Bölgesel düzeni seçip Kontrolleri kaydet düğmesine dokun.','settings'],
 ['buy_equipment','İlk ekipman alışverişi','Basic Pazar’dan bir ekipman satın al.','Gladyatörünün kullanabildiği bir silah veya zırh seç.','market'],
 ['equip','Gladyatörünü donat','Satın aldığın bir ekipmanı gladyatörüne tak.','Gladyatör detayında uygun ekipman yuvasına dokun ve yeni eşyanı seç.','equipment'],
 ['training','İlk antrenmanlar','Başlangıçtaki iki gladyatörünü birer kez antrenmana gönder.','Bir özellik seçip çalıştır. İki farklı gladyatörün antrenmanı ayrı sayılır.','training'],
 ['training_review','Gelişimini takip et','Bir antrenmanı tamamla ve gelişen özelliği incele.','Antrenman bitince gladyatör detayını açıp çalıştırdığın özelliğe dokun.','training'],
 ['buy_food','Erzak alışverişi','Yemekhaneden en az bir besin satın al.','Besinlerin porsiyon değerlerine bakarak alışveriş yap.','food'],
 ['food_day','Kadronu doyur','Tüm gladyatörlerine en az bir gün yetecek erzak hazırla.','Yemekhanede günlük ihtiyacı karşıla. Öğünler otomatik hazırlanır.','food'],
 ['stones','Taşlarını tanı','Elmas, Safir, Zümrüt ve Yakut açıklamalarını incele.','Taş Kesesi’nde dört kategoriyi açıp her birinde bir taşa dokun. Taşa sahip olman gerekmez.','stones'],
 ['enhance','İlk geliştirme','Bir eşyayı kendin en az +2 seviyesine geliştir.','Geliştirmelerde Elmas kullan. Hazır +2 eşya satın almak bu görevi tamamlamaz.','upgrades'],
 ['sapphire','Safirin gücü','Bir ekipmana Safir bas.','Eşyanın doğal özelliğine uygun Safir seçip işlemi tamamla.','upgrades'],
 ['emerald','Zümrüdün gücü','Bir ekipmana Zümrüt bas.','Zümrüt etkisini incele, uygun yuvaya uygula.','upgrades'],
 ['4x5','Takımlı Arena zaferi','Singleplayer Takımlı Arena’da bir zafer kazan.','Arena → Singleplayer → Takımlı Arena (4×5).','arena'],
 ['solo20','Son kalan sen ol','Singleplayer Solo 20’de bir zafer kazan.','Arena → Singleplayer → Solo 20.','arena'],
 ['naval4x5','Denizin galibi','Singleplayer Deniz Savaşı’nda bir zafer kazan.','Arena → Singleplayer → Deniz Savaşı.','arena'],
 ['survival','Hayatta kal','Hayatta Kal modunda 10. dalgayı tamamla.','10. dalgaya ulaşmak yeterli değil; dalgayı bitirip savaş sonucunu kaydet.','arena'],
 ['imperial','İmparatorun emri','Kolay bir İmparator özel görevini tamamla ve ödülünü al.','Görevi başlat, süresi dolunca ödülünü teslim al.','mission'],
 ['daily','Günlük görev ödülü','Bir günlük görevi tamamla ve ödülünü al.','Günlük görevler defterinden tamamlanan görevin ödülünü al.','daily'],
 ['listing','İlk pazar ilanı','Kullanmadığın uygun bir eşya için Forum Pazarı’nda ilan oluştur.','İlanın yayımlanması yeterli. Satılmasını beklemen gerekmez.','market'],
 ['level','Ludus’unu büyüt','Seviye atlayarak kazandığın ilk ödülü al.','Seviye defterinde açılan 2. seviye veya üzeri ödüllerden birini al.','levels'],
 ['notification','Ludus’tan haberler','Mesajlar’da bir sistem bildirimini açıp oku.','Sistem bölümündeki bir bildirime dokun.','messages'],
 ['supply','İlk kervan seferi','Kervan gönder ve dönen seferin kasaya bırakılan yükünü incele.','İlk kervanın 1. seviyede hazır. Sefer bitince toplama kasasını aç.','supply'],
 ['craft','İlk üretim','Topladığın malzemelerle bir Basic ekipman üret.','Demircide bir tarif seç ve malzemeler yeterliyken Üret’e dokun.','forge']
];
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
const book='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15M5 7l4 1M5 11l4 1M15 8l4-1M15 12l4-1"/></svg>';
function create(ctx){
 const modal=el('section');modal.id='beginnerGuide';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','beginnerTitle');document.body.append(modal);
 const trigger=button('',()=>open());trigger.id='beginnerOpen';trigger.hidden=true;trigger.innerHTML=book;const badge=el('span','fq-book-count');trigger.append(badge);ctx.menu.append(trigger);
 let state=null,owner=null,epoch=0,queue=Promise.resolve(),page=0,filter='main',chosen='inspect',error='',loading=false,returnFrom=null,previousFocus=null,autoPending=false,autoTimer,refreshTimer;
 const perPage=()=>innerHeight<=360?3:innerHeight<=600?4:6;
 const roster=()=>ctx.roster().filter(g=>g.record?.id);
 const progress=key=>state?.quests?.[key];
 function updateBook(){trigger.hidden=!owner||state?.count===22;badge.textContent=state?state.count+'/22':'…';trigger.title='Başlangıç rehberi · '+badge.textContent;trigger.setAttribute('aria-label',trigger.title);}
 async function call(action='state',subject=null,detail=null){
  const id=owner,version=epoch;
  const work=queue.catch(()=>{}).then(async()=>{
   if(!id||id!==ctx.getUser()||version!==epoch)return;
   const abort=new AbortController();let timer;
   try{let q=ctx.client.rpc('ludus_first_quests',{p_action:action,p_subject:subject,p_detail:detail});if(q.abortSignal)q=q.abortSignal(abort.signal);
    const {data,error:e}=await Promise.race([q,new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('timeout'));},12000);})]);
    if(e)throw e;if(!data?.quests||data.total!==22)throw Error('invalid state');
    if(id!==ctx.getUser()||version!==epoch)return;state=data;error='';updateBook();render();return data;
   }catch(e){if(version===epoch){error='İlerleme kaydedilemedi. Bağlantını kontrol edip tekrar dene.';render();}throw e;}finally{clearTimeout(timer);}
  });queue=work;return work;
 }
 async function refresh(){if(loading||!owner)return;const version=epoch;loading=true;render();try{await ctx.refresh?.();await call();}catch{if(version===epoch){error='Bilgiler yenilenemedi. Tekrar dene.';}}finally{if(version===epoch){loading=false;render();}}}
 function open(){if(!owner||owner!==ctx.getUser()||!modal.hidden||!ctx.canOpen())return;autoPending=false;clearTimeout(autoTimer);returnFrom=null;previousFocus=document.activeElement;ctx.onOpen();modal.hidden=false;render();modal.querySelector('.fq-close')?.focus();call('present').catch(()=>{});refresh();}
 function close(navigating=false){if(modal.hidden)return;modal.hidden=true;ctx.onClose();if(!navigating){returnFrom=null;autoPending=false;call('dismiss').catch(()=>{});const focus=previousFocus?.isConnected&&!previousFocus.hidden?previousFocus:document.getElementById('accountLink');focus?.focus();}}
 function navigate(q,g){close(true);returnFrom=['inspect','equipment','training'].includes(q[4])?'gladiator':q[4]==='mission'?'mission':null;try{ctx.navigate(q[4],g||roster()[0],null,q[0]);}catch{ returnFrom=null;open();error='Bu bölüm açılamadı. Tekrar dene.';render();}}
 function resume(source){if(returnFrom===source){returnFrom=null;setTimeout(open,0);}else scheduleRefresh();}
 function scheduleRefresh(){clearTimeout(refreshTimer);if(owner)refreshTimer=setTimeout(()=>call().catch(()=>{}),300);}
 function currentList(){return quests.filter((q,i)=>filter==='advanced'?i>=22:i<22&&(filter!=='todo'||!progress(q[0])?.complete));}
 function render(){
  if(modal.hidden)return;const active=document.activeElement?.closest('#beginnerGuide')?document.activeElement.dataset.focus:null;
  const shell=el('div','fq-shell'),top=el('div','fq-top'),heading=el('div');heading.append(el('small','','COLOSSEUM & MAGNUS'));const title=el('h1','','BAŞLANGIÇ REHBERİ');title.id='beginnerTitle';heading.append(title);
  const x=button('×',()=>close(),'fq-close');x.setAttribute('aria-label','Başlangıç rehberini kapat');x.dataset.focus='close';top.append(heading,x);
  const intro=el('div','fq-intro'),count=el('strong','fq-count',state?state.count+' / 22 tamamlandı':'İlerleme yükleniyor…');intro.append(el('span','',state?.count===22?'İlk görevlerin tamamlandı. Ludus’un yolculuğa hazır.':'İlk adımlarını tamamla, Ludus’unun tüm olanaklarını keşfet.'),count);
  const meter=el('div','fq-meter');meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','Başlangıç görevleri');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','22');meter.setAttribute('aria-valuenow',String(state?.count||0));const fill=el('span');fill.style.width=((state?.count||0)/22*100)+'%';meter.append(fill);
  const tabs=el('nav','fq-tabs');tabs.setAttribute('aria-label','Görev bölümleri');for(const [key,label]of [['main','İlk görevler'],['todo','Kalan görevler'],['advanced','Toplama ve üretim']]){const b=button(label,()=>{filter=key;page=0;chosen=currentList()[0]?.[0];render();});b.dataset.focus='filter-'+key;b.setAttribute('aria-pressed',String(filter===key));tabs.append(b);}
  const all=currentList(),pages=Math.max(1,Math.ceil(all.length/perPage()));page=Math.min(page,pages-1);const visible=all.slice(page*perPage(),(page+1)*perPage());if(!visible.some(q=>q[0]===chosen))chosen=visible[0]?.[0];
  const content=el('div','fq-content'),left=el('div','fq-left'),list=el('div','fq-list');list.style.setProperty('--fq-rows',perPage());
  for(const q of visible){const i=quests.indexOf(q),p=progress(q[0]),row=button('',()=>{chosen=q[0];render();},'fq-row');row.dataset.quest=q[0];row.dataset.focus='quest-'+q[0];row.dataset.complete=String(!!p?.complete);row.setAttribute('aria-pressed',String(chosen===q[0]));const num=el('span','fq-number',p?.complete?'✓':i<22?String(i+1):'+');const copy=el('span','fq-row-copy');copy.append(el('strong','',q[1]),el('small','',!state?'Yükleniyor…':!p?.unlocked?'Henüz açılmadı':p.complete?'Tamamlandı':p.progress+' / '+p.target));row.append(num,copy);list.append(row);}
  if(!visible.length)list.append(el('p','fq-empty',loading?'İlerleme yükleniyor…':'Bu bölümde kalan görevin yok.'));
  const pager=el('div','fq-pager'),prev=button('‹',()=>{page--;chosen=null;render();}),next=button('›',()=>{page++;chosen=null;render();});prev.disabled=page===0;next.disabled=page>=pages-1;prev.dataset.focus='prev';next.dataset.focus='next';prev.setAttribute('aria-label','Önceki görev sayfası');next.setAttribute('aria-label','Sonraki görev sayfası');pager.append(prev,el('span','',(page+1)+' / '+pages),next);left.append(list,pager);
  const detail=el('article','fq-detail'),q=quests.find(q=>q[0]===chosen);
  if(q){const p=progress(q[0]),advanced=quests.indexOf(q)>=22;detail.dataset.quest=q[0];detail.append(el('small','fq-kicker',advanced?'İLERİ ADIMLAR · SEVİYE 5':'İLK GÖREVLER · '+(quests.indexOf(q)+1)),el('h2','',q[1]),el('p','fq-description',q[2]),el('p','fq-hint',q[3]));
   const actions=el('div','fq-actions');
   if(advanced&&!p?.unlocked){actions.append(button('Seviye defteri',()=>navigate(['','','','','levels']),'fq-action'));}
   else if(['inspect','training','training_review','equipment','combat','equip'].includes(q[0])){
    let fighters=roster();if(q[0]==='inspect'||q[0]==='training')fighters=fighters.filter(g=>state?.starters?.includes(g.record.id));else fighters=fighters.slice(0,2);
    for(const g of fighters){const done=(q[0]==='inspect'?state?.inspected:q[0]==='training'?state?.trained:[])?.includes(g.record.id);const b=button((done?'✓ ':'')+(g.name||g.record.name)+'  ›',()=>navigate(q,g),'fq-action');b.dataset.fighter=g.record.id;actions.append(b);}
    if(!fighters.length)actions.append(el('p','','Gladyatör bilgileri henüz hazır değil.'));
   }else{const labels={settings:'Ayarları aç',market:q[0]==='listing'?'Forum Pazarı’na git':'Pazara git',food:'Yemekhaneyi aç',stones:'Taş Kesesi’ni aç',upgrades:'Geliştirmelere git',arena:'Arena’ya git',mission:'İmparator görevlerini aç',daily:'Günlük görevleri aç',levels:'Seviye defterini aç',messages:'Sistem bildirimlerini aç',supply:'Toplama haritasını aç',forge:'Demirciyi aç'};actions.append(button(labels[q[4]]||'Bölüme git',()=>navigate(q),'fq-action'));}
   detail.append(actions,el('div','fq-detail-progress',p?.complete?'✓ Tamamlandı':!p?.unlocked?'Kilitli':p.progress+' / '+p.target));
  }else{detail.append(el('h2','','İlk adımlar tamamlandı'),el('p','','Rehbere Ayarlar → Yardım üzerinden tekrar ulaşabilirsin.'));}
  content.append(left,detail);const bottom=el('div','fq-bottom'),status=el('p','fq-status',error||(loading?'Bilgiler yenileniyor…':filter==='advanced'?'Bu iki görev kitap ikonunun kalkmasını etkilemez.':state?.count===22?'Kitap ikonu kaldırıldı. Rehber: Ayarlar → Yardım.':'İlerlemen hesabına kaydedilir. 22 görev bitince kitap ikonu kalkar.'));status.setAttribute('role','status');const retry=button(error?'Tekrar dene':'Yenile',refresh,'fq-refresh');retry.disabled=loading;retry.dataset.focus='refresh';bottom.append(status,retry);shell.append(top,intro,meter,tabs,content,bottom);modal.replaceChildren(shell);
  if(active)modal.querySelector('[data-focus="'+active+'"]')?.focus({preventScroll:true});
 }
 function tryAuto(){if(!autoPending||owner!==ctx.getUser())return;if(!document.hidden&&ctx.canOpen())open();else autoTimer=setTimeout(tryAuto,1000);}
 async function start(){owner=ctx.getUser();if(!owner)return;updateBook();try{const s=await call();if(s?.should_open){autoPending=true;tryAuto();}}catch{updateBook();}}
 function reset(){epoch++;owner=null;state=null;queue=Promise.resolve();loading=false;error='';autoPending=false;returnFrom=null;clearTimeout(autoTimer);clearTimeout(refreshTimer);if(!modal.hidden){modal.hidden=true;ctx.onClose();}updateBook();}
 ctx.client.auth?.onAuthStateChange?.((event,session)=>{if(event==='SIGNED_OUT'||(session?.user?.id&&owner&&session.user.id!==owner))reset();});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled)')].filter(n=>n.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 let resizeTimer;root.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{page=0;render();},70);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRefresh();});
 root.addEventListener('ludus-quest-recorded',scheduleRefresh);
 return{start,open,close,resume,refresh,reset,record:(action,subject,detail)=>call(action,subject,detail),inspected:g=>{if(owner&&g?.record?.id)call('inspect',g.record.id).catch(()=>{});},get visible(){return !modal.hidden;},get state(){return state;}};
}
root.LudusOnboarding={create,quests};
})(typeof window!=='undefined'?window:globalThis);
