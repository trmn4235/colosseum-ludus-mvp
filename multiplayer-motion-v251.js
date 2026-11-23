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
 // A throttled rig keeps its authored root transform between full poses.
 // Rolls face their travel direction; deaths keep the captured fall heading.
 function capturePoseRoot(f,m){
  const p=m.poseRootV291||(m.poseRootV291={});
  p.x=m.root.position.x-f.x;p.y=m.root.position.y;p.z=m.root.position.z-f.z;
  p.heading=m.root.rotation.y;p.angle=f.angle;p.action=f.action;p.chain=f.chain;
  p.dead=f.hp<=0;p.timer=f.timer;
  p.moving=f.move>.025;p.blocking=!!f.blocking;p.reacting=f.reaction>0;
  p.guarding=f.guardFlash>0;p.evading=f.passiveEvade>0;
 }
 function poseChanged(f,m){
  const p=m.poseRootV291;
  return !p||p.action!==f.action||p.chain!==f.chain||p.dead!==(f.hp<=0)||
   p.moving!==(f.move>.025)||p.blocking!==!!f.blocking||p.reacting!==(f.reaction>0)||
   p.guarding!==(f.guardFlash>0)||p.evading!==(f.passiveEvade>0)||
   f.action!=='idle'&&Number.isFinite(f.timer)&&f.timer+.001<p.timer;
 }
 // Keep the clock remainder so a late display frame does not lower the pose rate.
 // Stable fighter phases spread routine skeleton work across display frames.
 function shouldPose(f,m,time,interval,forced=false){
  if(!Number.isFinite(interval)){m.rankedPoseHidden=true;return false;}
  const reset=forced||m.rankedPoseHidden||m.rankedPoseInterval!==interval||
   !Number.isFinite(m.nextRankedPose)||poseChanged(f,m);
  m.rankedPoseHidden=false;m.rankedPoseInterval=interval;
  if(interval<=0){m.nextRankedPose=time;return true;}
  if(reset){
   const phase=(((Number(f.id)||0)*.61803398875)%1+1)%1;
   m.nextRankedPose=time+interval*(1-phase);return true;
  }
  const deadline=m.nextRankedPose;
  if(time+.0001<deadline)return false;
  m.nextRankedPose=deadline+interval*Math.max(1,Math.floor((time-deadline)/interval)+1);
  return true;
 }
 function updatePoseRoot(f,m){
  const p=m.poseRootV291;
  if(!p||poseChanged(f,m)){m.root.position.set(f.x,0,f.z);m.root.rotation.y=f.angle;return;}
  m.root.position.set(f.x+p.x,p.y,f.z+p.z);
  m.root.rotation.y=p.dead||p.action==='dodge'?p.heading:p.heading+Math.atan2(Math.sin(f.angle-p.angle),Math.cos(f.angle-p.angle));
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
 return {worldDirection,poseInterval,capturePoseRoot,poseChanged,shouldPose,updatePoseRoot,expandState,predictedPosition};
})();
if(typeof module!=='undefined')module.exports=MultiplayerMotion;
