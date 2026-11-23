/* Quaternius Roll (CC0), retargeted onto the existing gladiator. See ANIMATION_ASSETS.md.
   Visual pose only: position, stamina and invulnerability belong to combat. */
var ArenaRoll = (() => {
 const clamp = v => Math.max(0, Math.min(1, v));
 const ease = v => { v = clamp(v); return v*v*(3-2*v); };
 let scratch;function math(){const T=THREE;return scratch||(scratch={q:Array.from({length:7},()=>new T.Quaternion()),v:Array.from({length:5},()=>new T.Vector3())});}
 const ends = {Arm:'ForeArm', ForeArm:'Hand', UpLeg:'Leg', Leg:'Foot', Foot:'ToeBase'};
 let carryScratch;
 function carryMath(){const T=THREE;return carryScratch||(carryScratch={v:Array.from({length:20},()=>new T.Vector3()),q:Array.from({length:12},()=>new T.Quaternion()),matrix:new T.Matrix4(),inverse:new T.Matrix4()});}
 function reachCarry(m,left,target,pole){
  const s=carryMath(),v=s.v,q=s.q,side=left?'Left':'Right',upper=m.bones[side+'Arm'],lower=m.bones[side+'ForeArm'],hand=m.bones[side+'Hand'];
  const origin=upper.getWorldPosition(v[10]),oldElbow=lower.getWorldPosition(v[11]),oldHand=hand.getWorldPosition(v[12]),a=origin.distanceTo(oldElbow),b=oldElbow.distanceTo(oldHand);
  const goal=m.root.localToWorld(v[13].set(target.x,target.y,target.z)),line=v[14].copy(goal).sub(origin),distance=Math.max(Math.abs(a-b)+.002,Math.min(a+b-.002,line.length()));line.normalize();
  const bend=v[15].copy(pole).addScaledVector(line,-pole.dot(line)).normalize(),along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
  const elbow=v[16].copy(origin).addScaledVector(line,along).addScaledVector(bend,height),wrist=v[17].copy(origin).addScaledVector(line,distance);
  function align(bone,end,point){
   const start=bone.getWorldPosition(v[18]),from=end.getWorldPosition(v[19]).sub(start).normalize(),to=v[12].copy(point).sub(start).normalize();
   q[6].setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(q[7]));bone.quaternion.copy(bone.parent.getWorldQuaternion(q[8]).invert().multiply(q[6]));bone.updateWorldMatrix(false,true);
  }
  align(upper,lower,elbow);align(lower,hand,wrist);return hand.getWorldPosition(v[18]);
 }
 function carryBounds(anchor,group,handle){
  let cache=anchor.userData.rollBounds293;if(cache?.group===group)return cache;
  const T=THREE,s=carryMath(),box=new T.Box3();anchor.updateWorldMatrix(true,true);s.inverse.copy(anchor.matrixWorld).invert();
  group.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;s.matrix.multiplyMatrices(s.inverse,mesh.matrixWorld);const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(s.v[0].fromBufferAttribute(p,i).applyMatrix4(s.matrix));});
  if(box.isEmpty())return null;
  const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).sub(handle));
  return anchor.userData.rollBounds293={group,points};
 }
 function tuckCarry(f,m,u){
  if(!m.bones.RightHand.userData.anatomy166||typeof ArenaAnatomy==='undefined')return;
  const w=ease(u/.18)*(1-ease((u-.82)/.18));if(w<.001)return;
  const s=carryMath(),v=s.v,q=s.q,rootQ=m.root.getWorldQuaternion(q[0]),floor=m.root.getWorldPosition(v[0]).y+.035;
  const sideAxis=m.bones.LeftArm.getWorldPosition(v[1]).sub(m.bones.RightArm.getWorldPosition(v[2])).normalize(),up=m.bones.Spine2.getWorldPosition(v[2]).sub(m.bones.Hips.getWorldPosition(v[3])).normalize(),front=v[3].crossVectors(sideAxis,up).normalize(),chest=m.bones.Spine1.getWorldPosition(v[4]);
  for(const left of [false,true]){
   const shield=left&&f.shield&&m.gear.shield,kind=left?f.offhand:f.weapon,slot=shield?m.gear.shield:null,anchor=slot?slot.anchor:left?m.offhandAnchor:m.weaponAnchor,group=slot?slot.group:anchor?.children[0];
   if(!group||!shield&&!kind)continue;
   const hand=m.bones[(left?'Left':'Right')+'Hand'],pole=['spear','trident','trident_gladiator','halberd'].includes(kind),offset=pole?-.16:group.userData.asset==='roman_spatha.glb'?-.065:0;
   const handle=v[5].set(0,slot?0:offset,slot?-.075:0);if(slot)handle.applyMatrix4(group.matrix);
   const bounds=carryBounds(anchor,group,handle);if(!bounds)continue;
   const wanted=q[1].copy(rootQ).multiply(q[2].setFromAxisAngle(v[6].set(1,0,0),slot?-Math.PI/2:Math.PI/2));
   q[3].copy(anchor.getWorldQuaternion(q[4])).slerp(wanted,w);
   const palm=hand.localToWorld(v[6].set(0,.075,.025).divideScalar(hand.getWorldScale(v[7]).x)),target=v[7].copy(chest).addScaledVector(sideAxis,left?.32:-.32).addScaledVector(front,.13);
   target.lerp(palm,1-w);let bottom=Infinity;for(const point of bounds.points)bottom=Math.min(bottom,v[8].copy(point).applyQuaternion(q[3]).y);target.y=Math.max(target.y,floor-bottom);
   const local=m.root.worldToLocal(v[8].copy(target)),direction=v[9].set(0,1,0).applyQuaternion(q[3]).applyQuaternion(q[5].copy(rootQ).invert());
   const upper=m.bones[(left?'Left':'Right')+'Arm'],lower=m.bones[(left?'Left':'Right')+'ForeArm'],prior=m.grip166?.[left?'Left':'Right'];
   q[9].copy(upper.quaternion);q[10].copy(lower.quaternion);q[11].copy(hand.quaternion);if(prior)v[0].copy(prior.x);
   ArenaAnatomy.grip(m,left,{grip:{x:local.x,y:local.y,z:local.z},dir:{x:direction.x,y:direction.y,z:direction.z},pole},reachCarry,0);
   if(prior)prior.x.copy(v[0]);
   upper.quaternion.slerp(q[9],1-w);lower.quaternion.slerp(q[10],1-w);hand.quaternion.slerp(q[11],1-w);upper.updateWorldMatrix(false,true);
   hand.localToWorld(v[6].set(0,.075,.025).divideScalar(hand.getWorldScale(v[7]).x));
   anchor.quaternion.copy(hand.getWorldQuaternion(q[4]).invert().multiply(q[3]));
   anchor.position.copy(hand.worldToLocal(v[8].copy(v[6]).sub(v[9].copy(handle).applyQuaternion(q[3]))));anchor.updateWorldMatrix(false,true);
   const state=m.grip166[left?'Left':'Right'];state.target.copy(v[6]);state.followsHand=true;
  }
 }
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
  // The source ends with a long settle. Give the tucked rotation more of the
  // existing action window, then return to guard without extending combat time.
  const phase=.7*u+.3*u*u*u*u*u;
  const frame=phase*(c.frames-1),a=Math.floor(frame),b=Math.min(c.frames-1,a+1),t=frame-a;
  const scratchV84=math(),qa=scratchV84.q[1],qb=scratchV84.q[2],v=scratchV84.v[0];
  const heading=f.angle+Math.atan2(Math.sin(state.heading-f.angle),Math.cos(state.heading-f.angle))*entry*weight;
  m.root.rotation.y=heading;
  m.body.rotation.set(0,0,0);
  const hip=c.hips[a][1]+(c.hips[b][1]-c.hips[a][1])*t;
  const lift=hip*(m.hipRest.y/c.hipHeight)*weight;
  m.body.position.y=state.body.y+(lift-state.body.y)*entry;
  m.body.position.z=state.body.z*(1-entry);
  m.root.updateMatrixWorld(true);
  const root=m.root.getWorldQuaternion(scratchV84.q[0]);
  // Convert world rotations through each animated parent; local deltas would
  // compound the full turn at every spine joint and fold the model unnaturally.
  for(const [key,frames] of Object.entries(c.rotations)) {
   const bone=m.bones[key],rest=m.rest.get(key); if(!bone||!rest)continue;
   const base=scratchV84.q[3].copy(bone.quaternion);
   qa.fromArray(frames[a]).slerp(qb.fromArray(frames[b]),t);
   const desired=scratchV84.q[4].copy(root).multiply(qa).multiply(rest.p).multiply(rest.q);
   const local=bone.parent.getWorldQuaternion(qb).invert().multiply(desired);
   if(entry<1 && state.bones[key]) bone.quaternion.copy(state.bones[key]).slerp(local,entry);
   else bone.quaternion.copy(local);
   if(exit>0)bone.quaternion.slerp(base,exit);
   bone.updateWorldMatrix(false,true);
  }
  for(const suffix of ['UpLeg','Leg','Foot','Arm','ForeArm'])for(const side of ['Left','Right']) {
   const key=side+suffix,frames=c.directions[key],bone=m.bones[key],end=m.bones[side+ends[suffix]];
   if(!frames||!bone||!end)continue;
   const direction=v.fromArray(frames[a]).lerp(scratchV84.v[1].fromArray(frames[b]),t).normalize().applyQuaternion(root);
   const current=end.getWorldPosition(scratchV84.v[2]).sub(bone.getWorldPosition(scratchV84.v[3])).normalize();
   const world=qa.setFromUnitVectors(current,direction).multiply(bone.getWorldQuaternion(qb));
   const local=bone.parent.getWorldQuaternion(scratchV84.q[5]).invert().multiply(world);
   bone.quaternion.slerp(local,entry*weight);bone.updateWorldMatrix(false,true);
  }
  // Keep the roll on its supporting hand, shoulder/back or foot. The source is
  // a diving roll; retaining its airborne hips made the short combat action
  // read as a floating somersault. Settle down as well as correcting penetration.
  const radii={Head:.14,Hips:.14,Spine2:.17,LeftHand:.05,RightHand:.05,LeftHandIndex2:.035,RightHandIndex2:.035,LeftHandIndex3:.035,RightHandIndex3:.035,LeftLeg:.075,RightLeg:.075,LeftFoot:.125,RightFoot:.125,LeftToeBase:.015,RightToeBase:.015};
  const floor=m.root.getWorldPosition(v).y+.015;
  let low=Infinity;
  for(const [key,r]of Object.entries(radii))if(m.bones[key])low=Math.min(low,m.bones[key].getWorldPosition(v).y-r);
  if(Number.isFinite(low))m.body.position.y+=(floor-low)*entry*weight;
  m.root.updateMatrixWorld(true);tuckCarry(f,m,u);m.authoredRoll='Roll';
  return true;
 }
 return {begin,apply};
})();
