/* Six anatomical targets and mutually exclusive, latched combat modes. */
var ArenaTouchControls = (() => {
 const paths = {
  head:'M5 18V9a7 7 0 0 1 14 0v9l-5 4v-9h-4v9z M12 2v8',
  chest:'M7 3l5 2 5-2 4 5-3 4-1 9H7L6 12 3 8z',
  rightArm:'M14 2l4 4-3 6-2 3-2 7-5-1 2-8 3-3z',
  leftArm:'M10 2L6 6l3 6 2 3 2 7 5-1-2-8-3-3z',
  rightLeg:'M10 2h7l-2 9-3 5-1 5H5l2-7 2-4z',
  leftLeg:'M14 2H7l2 9 3 5 1 5h6l-2-7-2-4z',
  heart:'M12 21S2 14 2 7c0-6 8-6 10-1 2-5 10-5 10 1 0 7-10 14-10 14z',
  energy:'M13 1L4 13h7l-1 10 10-14h-7z',
  slide:'M16 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M12 8l4 3 4-1M14 9l-5 6 7 2-5 4M9 15l-6 5H1M2 9h6M1 12h5'
 };
 const svg = key => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]}"/></svg>`;
 function mount(api) {
  const group=document.querySelector('.actions'),attack=document.getElementById('attack'),block=document.getElementById('block');
  let mode='attack',held=null;
  const targets=[];
  const names={head:'Miğfer',chest:'Göğüs',rightArm:'Sağ kol',leftArm:'Sol kol',rightLeg:'Sağ bacak',leftLeg:'Sol bacak'};
  for(const [region,name] of Object.entries(names)){
   const button=document.createElement('button');button.type='button';button.className='action body-target';button.dataset.region=region;button.setAttribute('aria-label',name);button.innerHTML=svg(region);group.append(button);targets.push(button);
   button.addEventListener('pointerdown',event=>{
    event.preventDefault();if(!api.active()||held!==null)return;
    held=event.pointerId;button.setPointerCapture(event.pointerId);api.select(region);
    targets.forEach(b=>b.classList.toggle('selected',b===button));
    if(mode==='attack')api.attack(region);else api.guard(region);
   });
   const release=event=>{if(held!==event.pointerId)return;held=null;api.release();};
   for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  }
  function setMode(next){mode=next;held=null;api.release();api.cancelAttack();for(const [button,value] of [[attack,'attack'],[block,'defense']]){const selected=mode===value;button.classList.toggle('mode-selected',selected);button.setAttribute('aria-pressed',String(selected));}}
  attack.setAttribute('aria-label','Saldırı modunu seç');block.setAttribute('aria-label','Savunma modunu seç');
  attack.addEventListener('pointerdown',e=>{e.preventDefault();if(api.active())setMode('attack');});
  block.addEventListener('pointerdown',e=>{e.preventDefault();if(api.active())setMode('defense');});
  document.getElementById('dodge').querySelector('svg').outerHTML=svg('slide');
  for(const [id,key] of [['hpFill','heart'],['stFill','energy']]){const badge=document.createElement('i');badge.className='vital-icon';badge.innerHTML=svg(key);document.getElementById(id).parentElement.append(badge);}
  setMode('attack');
  return {reset(){held=null;api.release();targets.forEach(b=>b.classList.remove('selected'));},get mode(){return mode;}};
 }
 return {mount};
})();
