/* Quaternius Roll (CC0), retargeted onto the existing gladiator. See ANIMATION_ASSETS.md.
   Visual pose only: position, stamina and invulnerability belong to combat. */
var ArenaRoll = (() => {
 const clamp = v => Math.max(0, Math.min(1, v));
 const ease = v => { v = clamp(v); return v*v*(3-2*v); };
 const ends = {Arm:'ForeArm', ForeArm:'Hand', UpLeg:'Leg', Leg:'Foot', Foot:'ToeBase'};
 function begin(f,m) {
  if(f.hp<=0 || f.action!=='dodge') { m.rollTransition=null; return; }
  const old=m.rollTransition;
  if(old && f.timer>=old.lastTimer-.001) { old.lastTimer=f.timer; return; }
  let x=Number(f.dx)||0,z=Number(f.dz)||0;
  if(Math.hypot(x,z)<.01) { x=f.x-m.root.position.x; z=f.z-m.root.position.z; }
  const heading=Math.hypot(x,z)>.001?Math.atan2(x,z):f.angle+Math.PI;
  m.rollTransition={lastTimer:f.timer,heading,body:m.body.position.clone(),
   bones:Object.fromEntries(Object.entries(m.bones).map(([key,bone])=>[key,bone.quaternion.clone()]))};
 }
 function apply(f,m) {
  const state=m.rollTransition;
  if(!state || f.hp<=0 || f.action!=='dodge') { m.authoredRoll=null; return false; }
  const T=THREE,c=LUDUS_ROLL_MOTION.clip,u=clamp(f.timer/Math.max(.01,f.duration));
  const entry=ease(u/.16),exit=ease((u-.84)/.16),weight=1-exit;
  const frame=u*(c.frames-1),a=Math.floor(frame),b=Math.min(c.frames-1,a+1),t=frame-a;
  const qa=new T.Quaternion(),qb=new T.Quaternion(),v=new T.Vector3();
  const heading=f.angle+Math.atan2(Math.sin(state.heading-f.angle),Math.cos(state.heading-f.angle))*entry*weight;
  m.root.rotation.y=heading;
  m.body.rotation.set(0,0,0);
  const hip=c.hips[a][1]+(c.hips[b][1]-c.hips[a][1])*t;
  const lift=hip*(m.hipRest.y/c.hipHeight)*weight;
  m.body.position.y=state.body.y+(lift-state.body.y)*entry;
  m.body.position.z=state.body.z*(1-entry);
  m.root.updateMatrixWorld(true);
  const root=m.root.getWorldQuaternion(new T.Quaternion());
  // Convert world rotations through each animated parent; local deltas would
  // compound the full turn at every spine joint and fold the model unnaturally.
  for(const [key,frames] of Object.entries(c.rotations)) {
   const bone=m.bones[key],rest=m.rest.get(key); if(!bone||!rest)continue;
   const base=bone.quaternion.clone();
   qa.fromArray(frames[a]).slerp(qb.fromArray(frames[b]),t);
   const desired=root.clone().multiply(qa).multiply(rest.p).multiply(rest.q);
   const local=bone.parent.getWorldQuaternion(qb).invert().multiply(desired);
   if(entry<1 && state.bones[key]) bone.quaternion.copy(state.bones[key]).slerp(local,entry);
   else bone.quaternion.copy(local);
   if(exit>0)bone.quaternion.slerp(base,exit);
   bone.updateWorldMatrix(false,true);
  }
  for(const suffix of ['UpLeg','Leg','Foot','Arm','ForeArm'])for(const side of ['Left','Right']) {
   const key=side+suffix,frames=c.directions[key],bone=m.bones[key],end=m.bones[side+ends[suffix]];
   if(!frames||!bone||!end)continue;
   const direction=v.fromArray(frames[a]).lerp(new T.Vector3().fromArray(frames[b]),t).normalize().applyQuaternion(root);
   const current=end.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize();
   const world=qa.setFromUnitVectors(current,direction).multiply(bone.getWorldQuaternion(qb));
   const local=bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world);
   bone.quaternion.slerp(local,entry*weight);bone.updateWorldMatrix(false,true);
  }
  // Keep the actual head, torso and limbs clear of the arena floor while tucked.
  const radii={Head:.14,Hips:.14,Spine2:.17,LeftHand:.05,RightHand:.05,LeftLeg:.075,RightLeg:.075,LeftFoot:.045,RightFoot:.045};
  let low=Infinity;
  for(const [key,r]of Object.entries(radii))if(m.bones[key])low=Math.min(low,m.bones[key].getWorldPosition(v).y-r);
  if(Number.isFinite(low)&&low<.015)m.body.position.y+=(.015-low)*entry*weight;
  m.root.updateMatrixWorld(true);m.authoredRoll='Roll';
  return true;
 }
 return {begin,apply};
})();
