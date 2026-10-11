/* Authored walk/jog/sprint retargeted using joint directions across different bind poses. */
var ArenaLocomotion=(function(){
 let T,dir,next,origin,current,q;
 function apply(f,m,dt,alignBone,time=0){
  const prior=m.locomotionPosition; m.locomotionPosition={x:f.x,z:f.z};
  if(!globalThis.ARENA_LOCOMOTION||f.hp<=0||f.action!=='idle'||f.reaction>0||f.passiveEvade>0){m.locomotionClip=null;return false;}
  T=THREE;if(!dir){dir=new T.Vector3();next=new T.Vector3();origin=new T.Vector3();current=new T.Vector3();q=new T.Quaternion();}
  const travel=prior?Math.hypot(f.x-prior.x,f.z-prior.z):0;
  const speed=Math.min(8,travel/Math.max(.001,dt));
  if(f.move<.025||speed<.04){m.locomotionClip=null;return false;}
  m.locomotionSpeed=(m.locomotionSpeed??speed)+(speed-(m.locomotionSpeed??speed))*(1-Math.exp(-dt*12));
  const name=m.locomotionSpeed<2?'walk':m.locomotionSpeed<4.5?'jog':'run',clip=ARENA_LOCOMOTION.clips[name];
  m.locomotionPhase=((m.locomotionPhase||0)+travel/(name==='walk'?1.35:name==='jog'?2.4:3.6))%1;
  m.locomotionClip=name;const frame=m.locomotionPhase*(clip.frames-1),a=Math.floor(frame),b=Math.min(a+1,clip.frames-1),t=frame-a,weight=Math.min(1,f.move*2);
  m.root.updateMatrixWorld(true);m.root.getWorldQuaternion(q);
  const ends={UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase',Arm:'ForeArm',ForeArm:'Hand'};
  for(const suffix of ['UpLeg','Leg','Foot','Arm','ForeArm'])for(const side of ['Left','Right']){
   if((suffix==='Arm'||suffix==='ForeArm')&&(f.blocking||f.guardFlash>0||f.absoluteBlockUntil>time))continue;
   const key=side+suffix,bone=m.bones[key],end=m.bones[side+ends[suffix]],frames=clip.directions[key];if(!bone||!end)continue;
   dir.fromArray(frames[a]).lerp(next.fromArray(frames[b]),t).normalize();
   m.locomotionDirections=m.locomotionDirections||{};const cached=m.locomotionDirections[key]||(m.locomotionDirections[key]=dir.clone());cached.lerp(dir,1-Math.exp(-dt*18)).normalize();dir.copy(cached).applyQuaternion(q);
   bone.getWorldPosition(origin);end.getWorldPosition(current).sub(origin).normalize();dir.lerp(current,1-weight).normalize();alignBone(bone,end,origin.add(dir));
  }
  // Keep the stance foot on sand despite different source/target limb lengths.
  let lowest=Infinity,restHeight=Infinity;
  for(const side of ['Left','Right']){const foot=m.bones[side+'Foot'];if(foot){lowest=Math.min(lowest,m.root.worldToLocal(foot.getWorldPosition(origin)).y);restHeight=Math.min(restHeight,m.footRest?.[side]?.position.y??.08);}}
  if(Number.isFinite(lowest))m.body.position.y+=Math.max(-.6,Math.min(.3,restHeight-lowest));
  m.root.updateMatrixWorld(true);return true;
 }
 return {apply};
})();
