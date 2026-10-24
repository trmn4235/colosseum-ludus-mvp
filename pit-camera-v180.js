/* The combat camera must stay on the sand side of the inner courtyard walls. */
var PitCombatCamera=(()=>{
 function constrain(position,focus,bounds){
  const x=bounds.x-.22,z=bounds.z-.22;
  position.x=Math.max(-x,Math.min(x,position.x));
  position.z=Math.max(-z,Math.min(z,position.z));
  const distance=Math.hypot(position.x-focus.x,position.z-focus.z);
  // When the wall leaves little room behind the fighter, look down from above
  // instead of placing the lens inside the masonry or the fighter's torso.
  const close=Math.max(0,1-distance/2.4);
  position.y=Math.max(position.y,focus.y+2.4+close*1.1);
  return position;
 }
 return{constrain};
})();
if(typeof module!=='undefined')module.exports=PitCombatCamera;
