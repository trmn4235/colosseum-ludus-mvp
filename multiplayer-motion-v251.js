/* Camera-relative controls and a mobile budget for crowded ranked matches. */
var MultiplayerMotion=(()=>{
 'use strict';
 function worldDirection(x,z,forwardX,forwardZ){
  const length=Math.hypot(forwardX,forwardZ);
  if(length<.00001)return {x,z};
  const fx=forwardX/length,fz=forwardZ/length;
  return {x:-fz*x-fx*z,z:fx*x-fz*z};
 }
 function poseInterval(rankedTouch,own,visible,distance){
  if(!rankedTouch||own)return 0;
  if(!visible)return Infinity;
  return distance<5?50:100;
 }
 return {worldDirection,poseInterval};
})();
if(typeof module!=='undefined')module.exports=MultiplayerMotion;
