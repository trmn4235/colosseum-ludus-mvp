/* Show the selected artwork for two visible seconds, then reveal the auth panel. */
(()=>{
 'use strict';
 const artwork=document.getElementById('loginArtwork'),panel=document.getElementById('entryPanel');
 if(!artwork||!panel)return;
 const landscape=matchMedia('(orientation: landscape)'),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let remaining=2000,holdTimer=null,holdStarted=0,completionTimer=null;
 function finish(){
  if(document.body.dataset.introState!=='revealing')return;
  clearTimeout(completionTimer);
  document.body.dataset.introState='ready';panel.inert=false;panel.removeAttribute('aria-hidden');
 }
 function reveal(){
  holdTimer=null;remaining=0;
  if(document.hidden||!landscape.matches)return;
  document.body.dataset.introState='revealing';
  if(reducedMotion.matches)finish();else completionTimer=setTimeout(finish,1000);
 }
 function syncHold(){
  if(document.body.dataset.introState!=='artwork')return;
  if(document.hidden||!landscape.matches){
   if(holdTimer!==null){clearTimeout(holdTimer);holdTimer=null;remaining=Math.max(0,remaining-(performance.now()-holdStarted));}
   return;
  }
  if(holdTimer===null){holdStarted=performance.now();holdTimer=setTimeout(reveal,remaining);}
 }
 panel.addEventListener('transitionend',event=>{if(event.target===panel&&event.propertyName==='opacity')finish();});
 document.addEventListener('visibilitychange',syncHold);
 landscape.addEventListener?.('change',syncHold);
 window.addEventListener('pageshow',syncHold);
 async function start(){
  try{
   if(!artwork.complete)await new Promise((resolve,reject)=>{artwork.addEventListener('load',resolve,{once:true});artwork.addEventListener('error',reject,{once:true});});
   if(!artwork.naturalWidth)throw Error('Artwork unavailable');
   await artwork.decode();
  }catch{
   artwork.hidden=true;document.getElementById('artworkFallback').hidden=false;
  }
  // Two animation frames ensure the image has painted before the hold begins.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  document.body.dataset.introState='artwork';syncHold();
 }
 start();
})();
