/* One held pointer per movement pad, with document-level and native-touch release. */
var CombatPointer=(()=>{
 function stick(element,{active,change,radius=.32}){
  let pointer=null,touch=null,kind=null;
  function reset(){const id=pointer;pointer=touch=kind=null;change(0,0);if(id!==null)try{if(element.hasPointerCapture(id))element.releasePointerCapture(id);}catch{}}
  function move(e){if(e.pointerId!==pointer)return;if(!active()||(kind!=='touch'&&e.buttons===0)){reset();return;}const b=element.getBoundingClientRect(),r=b.width*radius,x=(e.clientX-b.left-b.width/2)/r,y=(e.clientY-b.top-b.height/2)/r,l=Math.max(1,Math.hypot(x,y));change(x/l,y/l);}
  element.addEventListener('pointerdown',e=>{if(!active()||pointer!==null||e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();pointer=e.pointerId;touch=null;kind=e.pointerType;try{element.setPointerCapture(pointer);}catch{}move(e);});
  window.addEventListener('pointermove',move,{passive:true});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(type,e=>{if(e.pointerId===pointer)reset();},true);
  // Safari may deliver touchend after a capture target is removed, without pointerup.
  element.addEventListener('touchstart',e=>{if(touch===null&&e.changedTouches.length)touch=e.changedTouches[0].identifier;},{passive:true});
  for(const type of ['touchend','touchcancel'])window.addEventListener(type,e=>{if(kind==='touch'&&(!e.touches.length||touch!==null&&![...e.touches].some(t=>t.identifier===touch)))reset();},{capture:true,passive:true});
  for(const type of ['blur','pagehide','orientationchange'])window.addEventListener(type,reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  return {reset,get held(){return pointer!==null;}};
 }
 return {stick};
})();
