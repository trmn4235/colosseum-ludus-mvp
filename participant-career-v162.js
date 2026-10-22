/* Shared selection-time career UI. No writable/client-supplied career totals. */
((root)=>{
 'use strict';
 const labels={all:'Tüm modlar','4x5':'Arena · 4×5',solo20:'Arena · Solo 20',naval4x5:'Deniz savaşı',survival:'Survival',multiplayer:'Multiplayer Beta',caravan_raid:'Kervan baskını'};
 const sumKeys=['matches','wins','losses','draws','kills','deaths','damage','damage_taken','kill_matches','death_matches','damage_matches','taken_matches','kd_matches','kd_kills','kd_deaths'];
 const fmt=n=>n==null?'—':Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2});
 const average=(n,count)=>count>0&&n!=null?n/count:null;
 function totals(rows=[]){const out={};for(const key of sumKeys){const values=rows.map(r=>r[key]).filter(n=>n!=null);out[key]=values.length?values.reduce((a,b)=>a+Number(b),0):null;}for(const key of ['matches','wins','losses','draws','kill_matches','death_matches','damage_matches','taken_matches','kd_matches'])out[key]??=0;out.best_stage=Math.max(0,...rows.map(r=>Number(r.best_stage)||0));return out;}
 function metrics(rows,mode){return totals(mode==='all'?rows:rows.filter(r=>r.mode===mode));}
 function kd(s){return s.kd_matches>0&&s.kd_deaths>0?s.kd_kills/s.kd_deaths:null;}
 const stores=new WeakMap();
 function create(client){
  if(stores.has(client))return stores.get(client);
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
  const button=(label,fn)=>{const b=node('button','career-button',label);b.type='button';b.onclick=fn;return b;};
  let data=null,inflight=null,loadedAt=0,epoch=0,dialog=null,current=null,previousFocus=null;
  client.auth?.onAuthStateChange?.((event)=>{if(['SIGNED_OUT','SIGNED_IN'].includes(event)){epoch++;data=null;loadedAt=0;inflight=null;dialog?.close();}});
  function load(force=false){
   if(inflight)return inflight;if(data&&!force&&Date.now()-loadedAt<30000)return Promise.resolve(data);
   const seq=epoch;let timer;
   const promise=Promise.race([client.rpc('ludus_careers'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Kariyer kayıtları alınamadı.')),15000);})])
    .then(r=>{if(r.error)throw r.error;if(seq!==epoch)throw Error('Hesap değişti. Yeniden aç.');if(r.data?.version!==162)throw Error('Kariyer kaydı doğrulanamadı.');data=r.data;loadedAt=Date.now();return data;})
    .finally(()=>{clearTimeout(timer);if(inflight===promise)inflight=null;});inflight=promise;return promise;
  }
  function rows(id){return data?.gladiators?.[id]||[];}
  function mount(kind,record,mode='all',compact=false){
   const host=node(compact==='text'?'span':'div','career-summary'+(compact?' compact':''));host.dataset.careerId=record.id;host.setAttribute('aria-live','polite');
   function draw(){
    host.replaceChildren();
    if(kind==='horse'){
     const s=data?.horses?.[record.id];
     if(!s){host.append(node('span','career-unavailable','Yarış kaydı bulunamadı'));return;}
     host.append(node('span','',fmt(s.races)+' yarış'),node('strong','',fmt(s.wins)+' galibiyet'),node('span','',s.races?'%'+fmt(100*s.wins/s.races)+' kazanma':'Henüz yarışmadı'));
    }else{
     const s=metrics(rows(record.id),mode),brief=mode==='survival'?fmt(s.matches)+' koşu · Rekor '+fmt(s.best_stage):fmt(s.matches)+' maç · '+fmt(s.wins)+' G / '+fmt(s.losses)+' M';
     host.append(node('span','',brief));
     if(!compact)host.append(node('span','','K/D '+fmt(kd(s))+' · Ort. hasar '+fmt(average(s.damage,s.damage_matches))));
    }
    if(compact!=='text'){const b=button('Kariyer',()=>open(kind,record,mode));b.setAttribute('aria-label',record.name+' · Kariyer');b.setAttribute('aria-haspopup','dialog');host.append(b);}
   }
   host.append(node('span','career-unavailable','Kariyer yükleniyor…'));
   load().then(draw).catch(()=>{host.replaceChildren(node('span','career-unavailable','Kariyer alınamadı'));if(compact!=='text')host.append(button('Yeniden dene',()=>{load(true).then(draw).catch(()=>{});}));});return host;
  }
  function ensureDialog(){
   if(dialog)return;dialog=node('dialog','career-dialog');dialog.setAttribute('aria-labelledby','careerTitle');document.body.append(dialog);
   dialog.addEventListener('keydown',e=>{e.stopPropagation();});
   dialog.addEventListener('close',()=>{current=null;previousFocus?.isConnected&&previousFocus.focus();});
  }
  function cell(grid,label,value){const item=node('div','career-stat');item.append(node('dt','',label),node('dd','',value));grid.append(item);return item;}
  function render(){
   if(!current)return;const {kind,record}=current,mode=current.mode;
   dialog.replaceChildren();const head=node('header','career-head'),identity=node('div');identity.append(node('small','','KARİYER'),node('h2','',record.name));identity.querySelector('h2').id='careerTitle';
   const close=button('Kapat',()=>dialog.close());head.append(identity,close);dialog.append(head);
   if(!data){dialog.append(node('p','career-note','Kariyer kayıtları yükleniyor…'));return;}
   const grid=node('dl','career-grid');
   if(kind==='horse'){
    const s=data.horses?.[record.id];if(!s){dialog.append(node('p','career-note','Bu atın kariyer kaydı bulunamadı.'));return;}
    dialog.classList.add('horse-career');dialog.append(node('p','career-mode-name','At arabası yarışları'));
    cell(grid,'Katıldığı yarış',fmt(s.races));cell(grid,'Galibiyet',fmt(s.wins));cell(grid,'Mağlubiyet',fmt(s.losses));cell(grid,'Kazanma oranı',s.races?'%'+fmt(100*s.wins/s.races):'—');
    dialog.append(grid,node('p','career-note','Düello: '+fmt(s.duels)+' karşılaşma · '+fmt(s.duel_wins)+' galibiyet. Yarışlardan ayrı tutulur.'),node('p','career-note','Sonuç, yarışa gerçekten katılan iki atın kariyerine ayrı ayrı yazılır. Bahis yapmak yarışa katılım sayılmaz.'));
   }else{
    dialog.classList.remove('horse-career');const field=node('label','career-filter','Oyun modu'),select=node('select');select.setAttribute('aria-label','Kariyer oyun modu');
    for(const [key,label]of Object.entries(labels)){const option=node('option','',label);option.value=key;select.append(option);}select.value=mode;select.onchange=()=>{current.mode=select.value;render();dialog.querySelector('select').focus();};field.append(select);dialog.append(field);
    const s=metrics(rows(record.id),mode),survival=mode==='survival',raid=mode==='caravan_raid',results=s.wins+s.losses+s.draws;
    cell(grid,survival?'Koşu sayısı':raid?'Baskın sayısı':'Kayıtlı maç',fmt(s.matches));
    cell(grid,survival?'Tamamlanan en yüksek etap':raid?'Başarılı':'Galibiyet',fmt(survival?s.best_stage:s.wins));
    cell(grid,raid?'Başarısız':'Mağlubiyet',survival?'—':fmt(s.losses));
    cell(grid,'Kazanma oranı',!survival&&results?'%'+fmt(100*s.wins/results):'—');
    cell(grid,'Öldürme / Ölüm',fmt(s.kills)+' / '+fmt(s.deaths));
    const ratio=cell(grid,'K/D',fmt(kd(s)));ratio.title=s.kd_matches>0&&s.kd_deaths===0?'Kayıtlı ölümlerin sayısı sıfır; oran henüz hesaplanmaz.':'Aynı karşılaşmalardaki toplam öldürme / toplam ölüm';
    cell(grid,raid?'Öldürme / baskın':'Öldürme / maç',fmt(average(s.kills,s.kill_matches)));
    cell(grid,raid?'Verilen hasar / baskın':'Verilen hasar / maç',fmt(average(s.damage,s.damage_matches)));
    cell(grid,raid?'Alınan hasar / baskın':'Alınan hasar / maç',fmt(average(s.damage_taken,s.taken_matches)));
    cell(grid,'Toplam verilen hasar',fmt(s.damage));
    const coverage=node('p','career-note','Ayrıntı kaydı: öldürme '+s.kill_matches+'/'+s.matches+' · ölüm '+s.death_matches+'/'+s.matches+' · verilen hasar '+s.damage_matches+'/'+s.matches+' · alınan hasar '+s.taken_matches+'/'+s.matches+'. Ortalamalar yalnızca verisi bulunan maçlardan hesaplanır.');
    if(current.info){
     dialog.append(coverage,node('p','career-note','K/D = toplam öldürme ÷ toplam ölüm. Ölüm yoksa “—” görünür. Maç başına öldürme ayrı hesaplanır.'));
     dialog.append(node('p','career-note','Eski sistem arena maçlarının yalnızca son beşinin ayrıntısını tutuyordu. Silinen ayrıntılar geri getirilemez; yeni kayıtlar kalıcıdır. Kervanın eski bireysel hasar ve öldürme bilgileri kayıtlı değildir.'));
     if(mode==='all'&&(record.wins_4x5||record.wins_solo20))dialog.append(node('p','career-note','Eski zafer sayaçları: 4×5 / deniz '+fmt(record.wins_4x5||0)+' · Solo 20 '+fmt(record.wins_solo20||0)+'. Ayrıntı kaydı silinmiş zaferleri de içerebilir.'));
     dialog.append(button('‹ Verilere dön',()=>{current.info=false;render();}));
    }else{
     const foot=node('div','career-foot');foot.append(node('p','career-note',s.matches?'Ayrıntı kaydı · Hasar '+s.damage_matches+'/'+s.matches+' · Öldürme '+s.kill_matches+'/'+s.matches:'Bu modda henüz kayıtlı karşılaşma yok.'),button('Kayıt bilgisi',()=>{current.info=true;render();}));dialog.append(grid,foot);
    }
   }
  }
  async function open(kind,record,mode='all'){
   ensureDialog();previousFocus=document.activeElement;current={kind,record,mode:labels[mode]?mode:'all'};render();if(!dialog.open)dialog.showModal();
   try{await load(true);if(current?.record.id===record.id)render();}catch{if(current?.record.id===record.id){dialog.append(node('p','career-note','Kariyer alınamadı.'),button('Yeniden dene',()=>open(kind,record,mode)));}}
  }
  const api={mount,open,load,get isOpen(){return !!dialog?.open;}};stores.set(client,api);return api;
 }
 root.LudusCareer={create,totals,metrics,kd,average,labels};
 if(typeof module!=='undefined')module.exports=root.LudusCareer;
})(globalThis);
