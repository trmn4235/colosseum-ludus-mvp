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
 // A compact packet is a complete dynamic snapshot, not a merge of old effects.
 // Only immutable roster/equipment data survives between snapshots.
 function expandState(data,previous){
  if(data?.delta_version!==252)return data;
  if(!previous||previous.id!==data.id)throw Error('Maç verisi yeniden yüklenmeli.');
  const byOwner=new Map(previous.players.map(p=>[p.owner,p]));
  return {...data,players:data.players.map(p=>{
   const old=byOwner.get(p.owner);if(!old)throw Error('Takım verisi yeniden yüklenmeli.');
   const fixed={};for(const key of ['name','class','gladiator','combat_stats','ranked_team','bot_v249'])fixed[key]=old[key];
   const items=p.items?p.items.map(item=>({...old.items?.find(previous=>previous.equipped_slot===item.equipped_slot&&previous.model===item.model),...item})):old.items;
   return {...fixed,...p,items};
  })};
 }
 // Bounded visual prediction only; the server still owns position and all hits.
 function predictedPosition(p,direction,now,receivedAt,serverNow,blocking=false){
  let x=p.x,z=p.z;
  const held=Math.hypot(direction.x,direction.z),locked=['swing_end','dodge_until','stagger_until','recoil_until','throw_until'].some(k=>Date.parse(p[k])>serverNow);
  if(p.hp>0&&held>.001&&!locked&&!p.pull_from){
   const ahead=Math.max(0,Math.min(.12,(now-receivedAt)/1000));
   const speed=(p.movement_speed??3.5*(p.combat_stats?.speed??1))*(blocking?1.8/3.5:1),length=Math.max(1,held);
   x+=direction.x/length*speed*ahead;z+=direction.z/length*speed*ahead;
   const bound=Math.max(1,Math.hypot(x,z)/10.5);x/=bound;z/=bound;
  }
  return {x,z};
 }
 return {worldDirection,poseInterval,expandState,predictedPosition};
})();
if(typeof module!=='undefined')module.exports=MultiplayerMotion;
