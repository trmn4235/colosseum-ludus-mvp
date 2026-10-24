/* V180: classic attack and hold-to-block; regional layout retired. */
var ArenaTouchControls = (() => {
 const paths = {
  heart:'M12 21S2 14 2 7c0-6 8-6 10-1 2-5 10-5 10 1 0 7-10 14-10 14z',
  energy:'M13 1L4 13h7l-1 10 10-14h-7z',
  roll:'M19 7a8 8 0 1 0 1 9M19 3v5h-5 M10 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M9 12l-3 3 4 3 5-2-2-4z M15 16l2 3'
 };
 const svg = key => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]}"/></svg>`;
 function mount(api) {
  const group=document.querySelector('.actions'),attack=document.getElementById('attack'),block=document.getElementById('block');
  let mode='attack',held=null,gesture=null,layout=CombatControlSettings.load();
  document.body.dataset.controlLayout=layout;
  function release(){api.release();api.guardClassic?.(false);}
  const gestureRegion=e=>{const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)<16)return'chest';return Math.abs(dy)>Math.abs(dx)?dy<0?'head':'legs':dx<0?'leftArm':'rightArm';};
  attack.addEventListener('pointerdown',e=>{e.preventDefault();if(!api.active())return;if(gesture)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY};attack.setPointerCapture(e.pointerId);});
  attack.addEventListener('pointerup',e=>{if(gesture?.id!==e.pointerId)return;const region=gestureRegion(e);gesture=null;api.select(region);api.attack(region);});
  for(const event of ['pointercancel','lostpointercapture'])attack.addEventListener(event,e=>{if(gesture?.id===e.pointerId)gesture=null;});
  block.addEventListener('pointerdown',e=>{e.preventDefault();if(!api.active())return;if(held!==null)return;held=e.pointerId;block.setPointerCapture(e.pointerId);block.classList.add('pressed');api.guardClassic?.(true);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])block.addEventListener(event,e=>{if(layout!=='classic'||held!==e.pointerId)return;held=null;block.classList.remove('pressed');release();});
  document.getElementById('dodge').querySelector('svg').outerHTML=svg('roll');
  document.getElementById('dodge').setAttribute('aria-label','Yuvarlanarak kaçın');
  document.getElementById('dodge').querySelector('small').textContent='YUVARLAN';
  for(const [id,key] of [['hpFill','heart'],['stFill','energy']]){const badge=document.createElement('i');badge.className='vital-icon';badge.innerHTML=svg(key);document.getElementById(id).parentElement.append(badge);}
  function reset(){held=gesture=null;release();block.classList.remove('pressed');}
  function applyLayout(){layout='classic';document.body.dataset.controlLayout='classic';reset();attack.setAttribute('aria-label','Saldır; kaydırarak bölge seç');block.setAttribute('aria-label','Savunmak için basılı tut');}
  addEventListener('combat-control-layout',applyLayout);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(type,e=>{if(held===e.pointerId){held=null;release();block.classList.remove('pressed');}if(gesture?.id===e.pointerId)gesture=null;});
  for(const type of ['touchend','touchcancel'])window.addEventListener(type,e=>{if(!e.touches.length)reset();},{passive:true});
  window.addEventListener('pagehide',reset);
  applyLayout(layout);
  return {reset,get mode(){return mode;},get layout(){return layout;}};
 }
 return {mount};
})();
