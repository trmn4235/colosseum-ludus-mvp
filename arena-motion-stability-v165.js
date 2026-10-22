/* Display poses between simulation ticks; never change combat or replay state. */
var ArenaMotionStability=(()=>{
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const fields=['x','z','angle','walk','move','timer','deadTime','reaction','guardFlash','passiveEvade','poleChoke','poleReach'];
 function createTimeline(){
  const history=new WeakMap();
  function beforeStep(fighters,time){
   for(const f of fighters){
    let h=history.get(f);if(!h){h={previous:{},view:{}};history.set(f,h);}
    const p=h.previous;for(const key of fields)p[key]=f[key];
    p.action=f.action;p.chain=f.chain;p.hp=f.hp;p.duration=f.duration;h.time=time;
   }
  }
  function read(f,time,alpha,step){
   const h=history.get(f);if(!h||Math.abs(time-step-h.time)>1e-5)return f;
   // Temporary states such as naval jumps are deleted when an action finishes.
   // A reusable display object must not retain those deleted properties.
   for(const key of Object.keys(h.view))if(!Object.prototype.hasOwnProperty.call(f,key))delete h.view[key];
   const p=h.previous,v=Object.assign(h.view,f),a=clamp(alpha,0,1);
   // Teleports and roster replacement are discrete events, not walking strides.
   if(Math.hypot(f.x-p.x,f.z-p.z)>1)return f;
   for(const key of fields){
    if(!Number.isFinite(p[key])||!Number.isFinite(f[key]))continue;
    if(key==='timer'&&(p.action!==f.action||p.chain!==f.chain||p.duration!==f.duration||f.timer<p.timer))continue;
    if(key==='deadTime'&&(p.hp>0||f.hp>0))continue;
    const d=key==='angle'?Math.atan2(Math.sin(f.angle-p.angle),Math.cos(f.angle-p.angle)):f[key]-p[key];
    v[key]=p[key]+d*a;
   }
   return v;
  }
  return {beforeStep,read};
 }
 let scratch;
 function math(){return scratch||(scratch={delta:new THREE.Quaternion(),twist:new THREE.Quaternion(),swing:new THREE.Quaternion(),inverse:new THREE.Quaternion(),identity:new THREE.Quaternion(),axis:new THREE.Vector3()});}
 function wrists(f,m){
  // Limits are relative to the rig's neutral forearm, independent of world heading.
  // Preserve attachment transforms: the weapon sweep and shield coverage stay exact.
  const s=math(),maxSwing=Math.PI/5,maxTwist=Math.PI/3;
  for(const side of ['Left','Right']){
   const hand=m.bones[side+'Hand'],rest=m.rest.get(side+'Hand'),finger=m.bones[side+'HandIndex1'];if(!hand||!rest||!finger)continue;
   const axis=s.axis.copy(finger.position).normalize();if(axis.lengthSq()<.5)continue;
   if(m.bones.RightHand.userData.anatomy166)s.delta.copy(hand.quaternion).normalize();
   else s.delta.copy(rest.q).invert().multiply(hand.quaternion).normalize();
   if(s.delta.w<0)s.delta.set(-s.delta.x,-s.delta.y,-s.delta.z,-s.delta.w);
   const projection=s.delta.x*axis.x+s.delta.y*axis.y+s.delta.z*axis.z;
   s.twist.set(axis.x*projection,axis.y*projection,axis.z*projection,s.delta.w);
   if(s.twist.lengthSq()<1e-8)s.twist.identity();else s.twist.normalize();
   s.swing.copy(s.delta).multiply(s.inverse.copy(s.twist).invert());
   const swingAngle=s.identity.angleTo(s.swing),twistAngle=s.identity.angleTo(s.twist);
   if(swingAngle<=maxSwing&&twistAngle<=maxTwist)continue;
   const anchorList=side==='Right'?[m.weaponAnchor]:[m.offhandAnchor,m.gear.shield?.anchor];
   const cache=m.wristAttachments165||(m.wristAttachments165=new Map());
   for(const anchor of anchorList)if(anchor&&anchor.parent===hand){
    let pose=cache.get(anchor);if(!pose){pose={p:new THREE.Vector3(),q:new THREE.Quaternion()};cache.set(anchor,pose);}
    anchor.getWorldPosition(pose.p);anchor.getWorldQuaternion(pose.q);
   }
   if(swingAngle>maxSwing)s.swing.slerp(s.identity,1-maxSwing/swingAngle);
   if(twistAngle>maxTwist)s.twist.slerp(s.identity,1-maxTwist/twistAngle);
   hand.quaternion.copy(m.bones.RightHand.userData.anatomy166?s.identity:rest.q).multiply(s.swing).multiply(s.twist);hand.updateWorldMatrix(false,true);
   for(const anchor of anchorList)if(anchor&&anchor.parent===hand){
    const pose=cache.get(anchor);anchor.position.copy(hand.worldToLocal(s.axis.copy(pose.p)));
    anchor.quaternion.copy(hand.getWorldQuaternion(s.inverse).invert().multiply(pose.q));anchor.updateWorldMatrix(false,true);
   }
  }
 }
 return {createTimeline,wrists};
})();
