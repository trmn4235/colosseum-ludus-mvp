/* One opaque travel screen spans source navigation and destination readiness. */
var RomeTravel=(()=>{
 'use strict';
 const root=document.documentElement,params=new URLSearchParams(location.search),destination=RomeDestinations.find(params.get('travel'));
 let overlay=null,progress=0,observer=null,checking=0,timeout=0,navigating=false,ready=false;
 function image(p){root.style.setProperty('--rome-travel-photo',`url("${p.photo}")`);}
 function create(p){if(overlay)return overlay;image(p);overlay=document.createElement('section');overlay.id='romeTravelLoading';overlay.setAttribute('role','status');overlay.setAttribute('aria-label',p.name+' yükleniyor');overlay.innerHTML='<div class="rome-travel-copy"><small>COLOSSEUM &amp; MAGNUS</small><h1></h1><p class="rome-travel-subtitle"></p><div class="rome-travel-track" role="progressbar" aria-label="Yolculuk yüklemesi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="rome-travel-meta"><span class="rome-travel-stage">Yola çıkılıyor…</span><span class="rome-travel-percent">0%</span></div><div class="rome-travel-recovery" hidden><button type="button">Yeniden dene</button><a href="roma.html?v=revision148" data-game-back>Roma haritası</a></div></div>';
  overlay.querySelector('h1').textContent=p.name;overlay.querySelector('.rome-travel-subtitle').textContent=p.entry;overlay.querySelector('button').onclick=()=>location.reload();(document.body||root).append(overlay);return overlay;}
 function set(n,stage){progress=Math.max(progress,Math.min(100,n));if(!overlay)return;overlay.querySelector('.rome-travel-track i').style.width=progress+'%';overlay.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(Math.round(progress)));overlay.querySelector('.rome-travel-percent').textContent=Math.round(progress)+'%';if(stage)overlay.querySelector('.rome-travel-stage').textContent=stage;}
 function recover(message){if(!overlay)return;clearTimeout(timeout);set(progress,message);overlay.querySelector('.rome-travel-recovery').hidden=false;}
 async function prepare(p){const urls=[p.photo,...p.preload];let completed=0;await Promise.all(urls.map(async url=>{try{const r=await fetch(url,{cache:'default',signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error(url);await r.arrayBuffer();}catch{}finally{completed++;set(5+completed/urls.length*35,'Yol hazırlanıyor…');}}));}
 async function go(id){const p=RomeDestinations.find(id);if(!p||navigating)return;navigating=true;create(p);set(3,'Yola çıkılıyor…');try{await prepare(p);try{sessionStorage.setItem('rome-travel-v148',JSON.stringify({id:p.id,created:Date.now()}));}catch{}if(window.LudusNavigation)LudusNavigation.go(p.target);else location.href=p.target;}catch{navigating=false;recover('Yolculuk başlatılamadı. Yeniden dene.');}}
 function finish(){if(ready)return;ready=true;clearTimeout(timeout);clearTimeout(checking);observer?.disconnect();set(100,'Hazır');root.classList.remove('rome-arriving');overlay?.classList.add('rome-travel-leave');setTimeout(()=>{overlay?.remove();overlay=null;},180);try{sessionStorage.removeItem('rome-travel-v148');}catch{}}
 async function startArrival(){create(destination);set(40,'Varış noktası hazırlanıyor…');
  let resources=0;try{observer=new PerformanceObserver(list=>{resources+=list.getEntries().filter(e=>e.name.startsWith(location.origin)).length;set(40+Math.min(48,resources*1.35),'Sahne ve görseller yükleniyor…');});observer.observe({type:'resource',buffered:true});}catch{}
  // CSS backgrounds in the existing battle selector are also awaited, preventing a blank first reveal.
  const warmImages=destination.id==='colosseum'?['assets/arena-entrance-v70.webp','assets/arena-modes-v69.webp','assets/survival-poster-v83.jpeg','assets/clan-water-20x2-v81.webp']:[];
  let imagesDone=false;Promise.all(warmImages.map(src=>new Promise(resolve=>{const i=new Image();i.onload=i.onerror=resolve;i.src=src;}))).then(()=>imagesDone=true);
  const started=performance.now();
  function check(){
   if(destination.id==='colosseum'){
    const mode=document.getElementById('modePage'),status=document.getElementById('status');
    if(mode&&!mode.hidden&&imagesDone&&document.readyState==='complete'&&(!status||!/yükleniyor/i.test(status.textContent)))return finish();
   }else if(window.CircusPreview?.visit?.active&&document.getElementById('loading')?.hidden)return finish();
   if(performance.now()-started>90000)recover('Yükleme uzadı. Bekleyebilir veya yeniden deneyebilirsin.');
   checking=setTimeout(check,performance.now()-started>90000?500:100);
  }
  check();
 }
 if(destination){image(destination);root.classList.add('rome-arriving');if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startArrival,{once:true});else startArrival();}
 addEventListener('pageshow',e=>{if(e.persisted&&navigating){overlay?.remove();overlay=null;navigating=false;progress=0;root.classList.remove('rome-arriving');}});
 return {go,get progress(){return progress;},get active(){return !!overlay;},finish};
})();
