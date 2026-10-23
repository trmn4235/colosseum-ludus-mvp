/* V171: readiness belongs to the destination, never to unrelated downloads. */
var RomeTravel=(()=>{
 'use strict';
 const root=document.documentElement,params=new URLSearchParams(location.search),destination=RomeDestinations.find(params.get('travel'));
 let overlay=null,progress=0,checking=0,timeout=0,navigating=false,ready=false,failed=false,arrivalStarted=false,pageIsReady=false,scriptFailed=false;
 function image(p){root.style.setProperty('--rome-travel-photo',`url("${p.photo}")`);}
 function create(p){if(overlay)return overlay;image(p);overlay=document.createElement('section');overlay.id='romeTravelLoading';overlay.setAttribute('role','status');overlay.setAttribute('aria-label',p.name+' yükleniyor');overlay.innerHTML='<div class="rome-travel-copy"><small>COLOSSEUM &amp; MAGNUS</small><h1></h1><p class="rome-travel-subtitle"></p><div class="rome-travel-track" role="progressbar" aria-label="Yolculuk hazırlığı" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="rome-travel-meta"><span class="rome-travel-stage">Yola çıkılıyor…</span><span class="rome-travel-percent">Hazırlanıyor</span></div><div class="rome-travel-recovery" hidden><button type="button">Yeniden dene</button><a href="roma.html?v=revision171" data-game-back>Roma haritası</a></div></div>';
  overlay.querySelector('h1').textContent=p.name;overlay.querySelector('.rome-travel-subtitle').textContent=p.entry;overlay.querySelector('button').onclick=()=>location.reload();(document.body||root).append(overlay);return overlay;}
 function set(n,stage){progress=Math.max(progress,Math.min(100,n));if(!overlay)return;overlay.querySelector('.rome-travel-track i').style.width=progress+'%';overlay.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(Math.round(progress)));overlay.querySelector('.rome-travel-percent').textContent=progress===100?'Hazır':'Hazırlanıyor';if(stage){overlay.querySelector('.rome-travel-stage').textContent=stage;overlay.querySelector('[role=progressbar]').setAttribute('aria-valuetext',stage);}}
 function recover(message){if(ready)return;failed=true;if(!overlay&&destination)create(destination);if(!overlay)return;clearTimeout(timeout);set(progress,message);overlay.querySelector('.rome-travel-recovery').hidden=false;}
 function stage(message,n=60){if(!destination||ready||failed)return;create(destination);set(n,message);}
 async function go(id){const p=RomeDestinations.find(id);if(!p||navigating)return;navigating=true;failed=false;create(p);set(10,'Yola çıkılıyor…');try{try{sessionStorage.setItem('rome-travel-v148',JSON.stringify({id:p.id,created:Date.now()}));}catch{}
  // Paint the destination art; do not download the next HTML and heavy models twice.
  await new Promise(resolve=>setTimeout(resolve,120));if(window.LudusNavigation)LudusNavigation.go(p.target);else location.href=p.target;
 }catch{navigating=false;recover('Yolculuk başlatılamadı. Yeniden dene.');}}
 function finish(){if(ready)return;ready=true;clearTimeout(timeout);clearTimeout(checking);set(100,'Hazır');root.classList.remove('rome-arriving');overlay?.classList.add('rome-travel-leave');setTimeout(()=>{overlay?.remove();overlay=null;},180);try{sessionStorage.removeItem('rome-travel-v148');}catch{}}
 function pageReady(){pageIsReady=true;}
 function warm(src){return new Promise(resolve=>{const i=new Image();let done=false;const end=()=>{if(done)return;done=true;clearTimeout(timer);i.onload=i.onerror=null;resolve();};const timer=setTimeout(end,6000);i.onload=i.onerror=end;i.src=src;if(i.complete)end();});}
 function startArrival(){if(arrivalStarted||ready)return;arrivalStarted=true;create(destination);if(!failed)set(40,'Varış noktası hazırlanıyor…');
  // Optional artwork has a bounded wait; its CSS fallback remains usable.
  const urls=destination.id==='colosseum'?['assets/arena-entrance-v70.webp','assets/arena-modes-v69.webp','assets/survival-poster-v83.jpeg','assets/clan-water-20x2-v81.webp']:[];
  let imagesDone=urls.length===0;Promise.all(urls.map(warm)).then(()=>imagesDone=true);
  function check(){if(ready)return;
   if(destination.id==='colosseum'){
    const mode=document.getElementById('modePage'),setup=document.getElementById('setupPage'),status=document.getElementById('status'),retry=document.getElementById('retry');
    if(retry&&!retry.hidden){recover(status?.textContent||'Hesap yüklenemedi. Yeniden dene.');}
    else if(imagesDone&&(pageIsReady||(!scriptFailed&&(mode&&!mode.hidden||setup&&!setup.hidden)&&status&&!/yükleniyor/i.test(status.textContent))))return finish();
   }else{
    const retry=document.getElementById('retry');
    if(retry&&!retry.hidden)recover(document.getElementById('loadText')?.textContent||'Sahne açılamadı. Yeniden dene.');
    else if(window.CircusPreview?.visit?.active&&document.getElementById('loading')?.hidden)return finish();
   }
   checking=setTimeout(check,failed?500:100);
  }
  check();
 }
 if(destination){image(destination);root.classList.add('rome-arriving');
  // Runs even when a parser-blocking dependency prevents DOMContentLoaded.
  timeout=setTimeout(()=>recover('Yükleme uzadı. Bağlantını kontrol edip yeniden deneyebilir veya Roma haritasına dönebilirsin.'),25000);
  addEventListener('error',e=>{if(!ready&&(e.target?.tagName==='SCRIPT'||e.target===window)){scriptFailed=true;recover('Sayfa yüklenemedi. Yeniden dene veya Roma haritasına dön.');}},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startArrival,{once:true});else startArrival();
 }
 addEventListener('pageshow',e=>{if(e.persisted&&navigating){clearTimeout(timeout);clearTimeout(checking);overlay?.remove();overlay=null;navigating=false;progress=0;failed=false;root.classList.remove('rome-arriving');}});
 return {go,get progress(){return progress;},get active(){return !!overlay;},finish,pageReady,stage,fail:recover};
})();
