/* Arena-only presentation. Simulation positions, hit windows and weapon sweeps
   remain owned by ArenaCombat/ArenaMotion. No assets or account requests. */
(function(root){
 'use strict';
 const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
 const decay=(value,target,rate,dt)=>mix(value,target,1-Math.exp(-rate*dt));
 const idleAction=f=>f.hp>0&&f.action==='idle';
 function state(m,f){
  return m.presentationState||(m.presentationState={x:f.x,z:f.z,angle:f.angle,speed:0,weight:0,run:0,forward:1,side:0,turn:0,acceleration:0,phase:((f.id||0)*.137)%1,guard:0,guardKind:f.shield?'guard':'block',dt:0,action:f.action,hand:{},weaponEntry:null,weaponRelease:null,shieldMode:false,shieldElapsed:.15,shieldStart:null});
 }
 // Periodic Catmull-Rom replaces the eight straight-line gait segments. The
 // duplicated endpoint is excluded, so both value and velocity match at wrap.
 function sampleTrack(values,phase,axis){
  const n=values.length-1,u=((phase%1)+1)%1*n,i=Math.floor(u),t=u-i;
  const a=values[(i+n-1)%n][axis],b=values[i%n][axis],c=values[(i+1)%n][axis],d=values[(i+2)%n][axis];
  return b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
 }
 function sample(pack,name,phase,out){
  const tracks=pack.clips[name].tracks;
  for(const key in tracks){const p=out[key]||(out[key]=[0,0,0]);for(let axis=0;axis<3;axis++)p[axis]=sampleTrack(tracks[key],phase,axis);}
  return out;
 }
 function pose(f,m,time,dt,fallback){
  const s=state(m,f),rawDt=Number.isFinite(dt)&&dt>0?dt:0;
  dt=Math.min(.1,rawDt);s.dt=dt;
  const dx=f.x-s.x,dz=f.z-s.z,distance=Math.hypot(dx,dz),angle=Math.atan2(Math.sin(f.angle-s.angle),Math.cos(f.angle-s.angle));
  const moving=idleAction(f)&&f.move>.02,teleport=distance>Math.max(.8,rawDt*7),speed=moving&&!teleport&&rawDt>0?Math.min(6,distance/rawDt):0;
  const oldSpeed=s.speed;s.x=f.x;s.z=f.z;s.angle=f.angle;
  s.speed=decay(s.speed,speed,12,dt);s.weight=decay(s.weight,moving?clamp(s.speed/.65):0,moving?15:20,dt);
  s.run=decay(s.run,smooth((s.speed-1.9)/1.9),9,dt);
  if(moving&&distance>.00001&&!teleport){
   s.forward=decay(s.forward,(dx*Math.sin(f.angle)+dz*Math.cos(f.angle))/distance,14,dt);
   s.side=decay(s.side,(dx*Math.cos(f.angle)-dz*Math.sin(f.angle))/distance,14,dt);
  }
  s.turn=decay(s.turn,rawDt&&!teleport?clamp(angle/rawDt,-5,5):0,10,dt);
  s.acceleration=decay(s.acceleration,dt?clamp((s.speed-oldSpeed)/dt,-7,7):0,8,dt);
  if(f.hp<=0||f.action==='knocked'){s.weaponEntry=null;s.weaponRelease=null;s.lastStrike=null;s.shieldPoint=null;s.shieldMode=false;s.shieldElapsed=.15;s.guard=0;s.blockPoint=null;s.blockMode=false;s.blockElapsed=.15;}
  const guard=f.hp>0&&!['knocked','dodge','stunned','attack','recoil','stagger','spearcast','bash','hook','netcast'].includes(f.action)&&!(f.reaction>0)&&(f.blocking||f.absoluteBlockUntil>time);
  s.guard=decay(s.guard,guard?1:0,guard?24:18,dt);if(guard)s.guardKind=f.shield?'guard':'block';
  const stride=mix(1.45,2.4,s.run);s.phase=(s.phase+s.speed*dt/stride)%1;
  const pack=root.ARENA_ANIMATION_FALLBACK;
  if(!pack)return fallback?.pose(f,m,time,dt)||null;
  // Leave authored strike/special curves intact. This path has no simulation
  // side effects, including when callers pass frozen or network snapshots.
  if(!idleAction(f))return fallback?.pose(f,m,time,dt)||{poses:{},bob:0,lean:0};
  const poses=s.poses||(s.poses={}),walk=s.walk||(s.walk={}),run=s.running||(s.running={}),back=s.backward||(s.backward={}),idle=s.idle||(s.idle={});
  sample(pack,'walk',s.phase,walk);sample(pack,'run',s.phase,run);sample(pack,'walk',-s.phase,back);sample(pack,'idle',(time+(f.id||0)*.3)/pack.clips.idle.duration,idle);
  // Clear reused output keys because the renderer adds action/guard poses.
  for(const key in poses)delete poses[key];
  for(const key in idle)poses[key]=idle[key].slice();
  const backward=clamp(-s.forward),lateral=clamp(Math.abs(s.side)),forwardAmount=Math.max(.12,Math.abs(s.forward));
  for(const key in walk){
   const p=poses[key]||(poses[key]=[0,0,0]);
   for(let axis=0;axis<3;axis++)p[axis]=mix(p[axis],mix(mix(walk[key][axis],run[key]?.[axis]||0,s.run*(1-backward)),back[key][axis],backward),s.weight);
   if(/UpLeg$/.test(key)){
    p[0]*=forwardAmount;
    p[2]=-s.side*Math.cos(s.phase*TAU+(key==='RightUpLeg'?Math.PI:0))*.31*s.weight;
   }else if(/^(Left|Right)(Leg|Foot)$/.test(key))p[0]*=1-.42*lateral;
  }
  const step=Math.sin(s.phase*TAU),breath=Math.sin(time*2.1+(f.id||0)*.73),brace=s.guard*(1-s.weight*.65);
  const add=(key,x,y,z)=>{const p=poses[key]||(poses[key]=[0,0,0]);p[0]+=x;p[1]+=y;p[2]+=z;};
  add('Hips',-.025*brace,0,-step*.018*s.weight);
  add('Spine',.018*breath-s.acceleration*.002,s.turn*.008,-s.side*.028*s.weight);
  add('Spine1',.025+s.guard*.025,-s.turn*.018,step*.009*s.weight);
  add('Spine2',0,-s.turn*.025,s.side*.02*s.weight);
  add('Head',-.018*breath,-s.turn*.012,0);
  add('LeftUpLeg',-.06*brace,0,0);add('RightUpLeg',.035*brace,0,0);
  add('LeftLeg',.10*brace,0,0);add('RightLeg',.08*brace,0,0);
  // A carried weapon has weight: elbows stay softly bent and the shoulders
  // counter-rotate instead of swinging like an unarmed runner.
  for(const side of ['Left','Right']){
   const loaded=side==='Left'?f.shield||f.offhand||f.leftGear:f.weapon;if(!loaded)continue;
   const arm=poses[side+'Arm']||(poses[side+'Arm']=[0,0,0]);arm[0]=arm[0]*.55-.14;arm[2]+=(side==='Left'?-1:1)*.035;
   add(side+'ForeArm',-.24-s.run*.10,0,0);
  }
  return {poses,sword:false,bob:(1-Math.cos(s.phase*TAU*2))*mix(.018,.034,s.run)*s.weight,lean:mix(.035,.11,s.run)*s.weight*s.forward+s.acceleration*.0025,roll:-s.side*.035*s.weight-s.turn*.006};
 }
 function scratch(m){
  if(m.presentationScratch)return m.presentationScratch;
  const T=root.THREE;return m.presentationScratch={a:new T.Quaternion(),b:new T.Quaternion(),q:new T.Quaternion(),v:new T.Vector3(),w:new T.Vector3(),o:new T.Vector3(),d:new T.Vector3()};
 }
 function applyAuthored(f,m,time,dt,alignBone,fallback){
  const s=state(m,f),clips=root.QUATERNIUS_COMBAT?.clips;
  if(!clips||!idleAction(f)||f.reaction>0)return fallback?.apply(f,m,time,alignBone)||false;
  if(s.guard<.0001){m.authoredClip=null;return false;}
  const clip=clips[s.guardKind],phase=s.guardKind==='guard'?((time%clip.duration)+clip.duration)%clip.duration/clip.duration:.52;
  const frame=phase*(clip.frames-1),a=Math.floor(frame),b=Math.min(clip.frames-1,a+1),t=frame-a,w=s.guard,c=scratch(m);
  m.authoredClip=s.guardKind;
  // Guard is an upper-body layer. Keeping the gait/brace legs avoids the old
  // full-body override, which made defending fighters slide with frozen feet.
  for(const name of ['Spine','Spine1','Spine2','Neck','Head','LeftShoulder','RightShoulder']){
   const frames=clip.rotations[name],bone=m.bones[name],rest=m.rest.get(name);if(!frames||!bone||!rest)continue;
   c.a.fromArray(frames[a]);c.b.fromArray(frames[b]);c.a.slerp(c.b,t);
   c.b.copy(rest.p).invert().multiply(c.a).multiply(rest.p).multiply(rest.q);bone.quaternion.slerp(c.b,w);
  }
  m.root.updateMatrixWorld(true);m.root.getWorldQuaternion(c.q);
  for(const side of ['Left','Right'])for(const pair of [['Arm','ForeArm'],['ForeArm','Hand']]){
   const name=side+pair[0],frames=clip.directions[name],bone=m.bones[name],end=m.bones[side+pair[1]];if(!frames||!bone||!end)continue;
   c.v.fromArray(frames[a]);c.w.fromArray(frames[b]);c.v.lerp(c.w,t).normalize().applyQuaternion(c.q);
   bone.getWorldPosition(c.o);end.getWorldPosition(c.w).sub(c.o).normalize();c.v.lerp(c.w,1-w).normalize();
   alignBone(bone,end,c.o.add(c.v));
  }
  return true;
 }
 function copyPoint(p){return {x:p.x,y:p.y,z:p.z};}
 function interpolateSample(a,b,w){
  const grip={x:mix(a.grip.x,b.grip.x,w),y:mix(a.grip.y,b.grip.y,w),z:mix(a.grip.z,b.grip.z,w)},dir={x:mix(a.dir.x,b.dir.x,w),y:mix(a.dir.y,b.dir.y,w),z:mix(a.dir.z,b.dir.z,w)};
  const length=Math.hypot(dir.x,dir.y,dir.z);if(length<.00001)Object.assign(dir,b.dir);else{dir.x/=length;dir.y/=length;dir.z/=length;}
  return {...b,grip,dir};
 }
 function readHand(m,left){
  const c=scratch(m),hand=m.bones[(left?'Left':'Right')+'Hand'],anchor=left?m.offhandAnchor:m.weaponAnchor,weapon=anchor?.children[0];
  if(!hand||!weapon)return null;
  m.root.worldToLocal(hand.getWorldPosition(c.v));m.root.getWorldQuaternion(c.a).invert();weapon.getWorldQuaternion(c.b);c.b.premultiply(c.a);c.d.set(0,1,0).applyQuaternion(c.b).normalize();
  return {grip:copyPoint(c.v),dir:copyPoint(c.d),left};
 }
 function strike(f,m,sample){
  const s=state(m,f),left=!!f.attackLeft,side=left?'left':'right';
  if(sample){
   const newAttack=f.action==='attack'&&(s.action!=='attack'||left!==s.attackLeft||f.timer<s.attackTimer-.00001);
   if(newAttack)s.weaponEntry=s.hand[side]||null;
   s.weaponRelease=null;s.attackLeft=left;s.attackTimer=f.timer;
   const profile=f.attackProfile||root.ArenaMotion?.profile(f.attackWeapon||f.weapon,f.attackKind==='heavy',f.id!==0);
   const duration=Math.min(.11,(profile?.wind||.26)*.48);
   // Never lag the active collision window, including an early sampled frame.
   const result=newAttack||s.weaponEntry?(!sample.active&&f.action==='attack'&&f.timer<duration&&s.weaponEntry?interpolateSample(s.weaponEntry,sample,smooth(f.timer/duration)):sample):sample;
   if(sample.active||f.timer>=duration)s.weaponEntry=null;
   s.lastStrike={grip:copyPoint(result.grip),dir:copyPoint(result.dir),left};s.action=f.action;return result;
  }
  if(s.lastStrike&&idleAction(f)){
   if(!s.weaponRelease)s.weaponRelease={sample:s.lastStrike,elapsed:0};
   const release=s.weaponRelease;release.elapsed+=s.dt;
   const target=readHand(m,release.sample.left);
   if(target&&release.elapsed<.14){s.action=f.action;return {...interpolateSample(release.sample,target,smooth(release.elapsed/.14)),active:false,presentationOnly:true};}
  }
  s.weaponEntry=null;s.weaponRelease=null;s.lastStrike=null;s.action=f.action;return null;
 }
 function shield(f,m,time,dt,reach){
  if(!f.shield||!m.gear.shield)return;
  const s=state(m,f),c=scratch(m),anchor=m.gear.shield.anchor;
  const guarding=f.hp>0&&(f.blocking||f.guardFlash>0||f.absoluteBlockUntil>time||f.action==='bash'||f.action==='attack'&&!f.attackLeft);
  m.root.updateMatrixWorld(true);
  const natural=m.root.worldToLocal(m.bones.LeftHand.getWorldPosition(c.v));
  // Root-relative orientation keeps interrupted raises/releases continuous,
  // even though the shoulder pose is rebuilt before this layer each frame.
  m.root.getWorldQuaternion(c.a);anchor.parent.getWorldQuaternion(c.b);c.q.copy(c.a).invert().multiply(c.b);
  const handRest=m.rest.get('LeftHand');c.b.copy(handRest.p).multiply(handRest.q).invert();c.q.multiply(c.b);
  if(guarding!==s.shieldMode||guarding&&s.shieldRegion!==f.guardRegion){
   s.shieldRegion=f.guardRegion;
   s.shieldRotationStart=(s.shieldRotation||c.q).clone();
   s.shieldMode=guarding;s.shieldElapsed=0;s.shieldStart=s.shieldPoint?copyPoint(s.shieldPoint):s.hand.shield?.grip||copyPoint(natural);
  }
  s.shieldElapsed+=s.dt;
  const blend=smooth(s.shieldElapsed/(guarding?.09:.15));
  if(!guarding&&blend>=1){
   anchor.position.set(0,0,0);anchor.quaternion.copy(handRest.p).multiply(handRest.q).invert();s.shieldPoint=null;s.shieldStart=null;return;
  }
  const gp=root.ArenaMotion?.guardPoint?.(f)||{x:.26,y:1.42,z:.29};
  const push=f.action==='bash'?Math.sin(Math.PI*Math.min(1,f.timer/Math.max(.01,f.duration)))*.14:-.075*(f.guardImpact||.65)*Math.sin(Math.PI*Math.max(0,f.guardFlash||0)/.20);
  const target=guarding?{x:gp.x,y:gp.y,z:gp.z+push}:natural,start=s.shieldStart||target,w=f.guardFlash>0?1:blend;
  const point={x:mix(start.x,target.x,w),y:mix(start.y,target.y,w),z:mix(start.z,target.z,w)};s.shieldPoint=point;
  reach(m,true,point);c.v.set(point.x,point.y,point.z);m.root.localToWorld(c.v);anchor.position.copy(anchor.parent.worldToLocal(c.v));
  if(guarding)c.b.identity();else c.b.copy(c.q);
  c.q.copy(s.shieldRotationStart||c.b).slerp(c.b,w);
  m.root.getWorldQuaternion(c.a).multiply(c.q);anchor.parent.getWorldQuaternion(c.b).invert();anchor.quaternion.copy(c.b).multiply(c.a);
 }
 function block(f,m,time,dt,reach){
  if(f.shield)return;
  const s=state(m,f),guarding=idleAction(f)&&!!f.blocking&&!!f.guardRegion,left=!f.weapon;
  // Do not let a releasing defensive arm override a new authoritative strike.
  if(!idleAction(f)){s.blockPoint=null;s.blockMode=false;s.blockElapsed=.15;return;}
  const c=scratch(m),bone=m.bones[(left?'Left':'Right')+'Hand'];if(!bone)return;
  const natural=m.root.worldToLocal(bone.getWorldPosition(c.v));
  if(guarding!==!!s.blockMode||guarding&&s.blockRegion!==f.guardRegion){s.blockRegion=f.guardRegion;s.blockMode=guarding;s.blockElapsed=0;s.blockStart=s.blockPoint||s.hand[left?'left':'right']?.grip||copyPoint(natural);}
  s.blockElapsed=(s.blockElapsed??.15)+s.dt;
  const blend=smooth(s.blockElapsed/(guarding?.09:.15));
  if(!guarding&&blend>=1){s.blockPoint=null;return;}
  const target=guarding?(root.ArenaMotion?.guardPoint?.(f)||{x:.26,y:1.42,z:.29}):natural,start=s.blockStart||target,w=f.guardFlash>0?1:blend;
  const point={x:mix(start.x,target.x,w),y:mix(start.y,target.y,w),z:mix(start.z,target.z,w)};s.blockPoint=point;reach(m,left,point);
 }
 function finish(f,m){
  // Caller has just updated the rendered rig; avoid another full tree walk.
  const s=state(m,f);
  for(const left of [false,true]){const hand=readHand(m,left);if(hand)s.hand[left?'left':'right']=hand;}
  if(f.shield&&m.bones.LeftHand){const c=scratch(m);m.root.worldToLocal(m.bones.LeftHand.getWorldPosition(c.v));s.hand.shield={grip:copyPoint(c.v)};m.root.getWorldQuaternion(c.a).invert();m.gear.shield.anchor.getWorldQuaternion(c.b);if(!s.shieldRotation)s.shieldRotation=new root.THREE.Quaternion();s.shieldRotation.copy(c.a).multiply(c.b);}
 }
 root.ArenaPresentation={pose,applyAuthored,strike,shield,block,finish,sampleTrack};
 if(typeof module!=='undefined')module.exports=root.ArenaPresentation;
})(typeof window!=='undefined'?window:globalThis);
