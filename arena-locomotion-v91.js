/* Human CMU capture, phase-aligned speed blending. Combat remains authoritative.
   V94: update each changed bone only; child world queries and the final root pass propagate it. */
var ArenaLocomotion=(function(){
 let T,v,n,o,end,q,q2,world,target,parent,up;
 const links={UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase',Arm:'ForeArm',ForeArm:'Hand'};
 function initialize(){if(T)return;T=THREE;v=new T.Vector3();n=new T.Vector3();o=new T.Vector3();end=new T.Vector3();up=new T.Vector3(0,1,0);q=new T.Quaternion();q2=new T.Quaternion();world=new T.Quaternion();target=new T.Quaternion();parent=new T.Quaternion();}
 function sample(clip,key,phase,out,rotation=false){const array=(rotation?clip.rotations:clip.directions)[key],f=phase*(clip.frames-1),a=Math.floor(f),b=Math.min(a+1,clip.frames-1),t=f-a;if(rotation)return out.fromArray(array[a]).slerp(q2.fromArray(array[b]),t);return out.fromArray(array[a]).lerp(n.fromArray(array[b]),t).normalize();}
 function scalar(clip,phase){const f=phase*(clip.frames-1),a=Math.floor(f),b=Math.min(a+1,clip.frames-1);return clip.lift[a]+(clip.lift[b]-clip.lift[a])*(f-a);}
 function apply(f,m,dt,alignBone,time=0){
  initialize();const dx=m.locomotionX===undefined?0:f.x-m.locomotionX,dz=m.locomotionZ===undefined?0:f.z-m.locomotionZ;m.locomotionX=f.x;m.locomotionZ=f.z;
  const travel=Math.hypot(dx,dz),safe=globalThis.ARENA_LOCOMOTION&&f.hp>0&&f.action==='idle'&&!(f.reaction>0)&&!(f.passiveEvade>0);
  if(!safe||dt<=0||travel>Math.max(.5,dt*12)){m.locomotionClip=null;m.locomotionWeight=0;return false;}
  const speed=Math.min(8,travel/dt),moving=f.move>.025&&speed>.04,fade=1-Math.exp(-dt*16);
  m.locomotionWeight=(m.locomotionWeight||0)+((moving?1:0)-(m.locomotionWeight||0))*fade;
  if(m.locomotionWeight<.005){m.locomotionClip=null;return false;}
  m.locomotionSpeed=(m.locomotionSpeed??speed)+(speed-(m.locomotionSpeed??speed))*(1-Math.exp(-dt*10));
  const clips=ARENA_LOCOMOTION.clips,s=m.locomotionSpeed;
  if(!m.locomotionLegLength){m.root.updateMatrixWorld(true);let length=0;for(const side of ['Left','Right']){m.bones[side+'UpLeg'].getWorldPosition(v);m.bones[side+'Leg'].getWorldPosition(n);m.bones[side+'Foot'].getWorldPosition(o);length+=v.distanceTo(n)+n.distanceTo(o);}m.locomotionLegLength=length/2;}
  const scale=c=>m.locomotionLegLength/c.legLength,clipSpeed=c=>c.speed*scale(c);
  let first=clips.walk,second=clips.jog,amount=Math.max(0,Math.min(1,(s-clipSpeed(first))/(clipSpeed(second)-clipSpeed(first))));
  if(s>clipSpeed(clips.jog)){first=clips.jog;second=clips.run;amount=Math.max(0,Math.min(1,(s-clipSpeed(first))/(clipSpeed(second)-clipSpeed(first))));}
  const stride=first.stride*scale(first)*(1-amount)+second.stride*scale(second)*amount;
  let heading=m.locomotionHeading||0;if(moving){heading=Math.atan2(dx,dz)-f.angle;heading=Math.atan2(Math.sin(heading),Math.cos(heading));m.locomotionHeading=heading;}
  const reverse=Math.cos(heading)<-.35;
  m.locomotionPhase=((m.locomotionPhase||0)+(reverse?-1:1)*travel/stride+1)%1;
  const phase=m.locomotionPhase,weight=m.locomotionWeight;
  m.locomotionClip=s<2?'walk':s<3.5?'jog':'run';
  // Remove the procedural bob/lean before applying measured hip motion.
  m.body.position.y*=1-weight;m.body.rotation.x*=1-weight;m.body.rotation.z*=1-weight;
  m.root.updateMatrixWorld(true);m.root.getWorldQuaternion(world);
  for(const key of ['Hips','Spine','Spine1','Spine2','Neck','Head']){
   const bone=m.bones[key],rest=m.rest.get(key);if(!bone||!rest)continue;
   sample(first,key,phase,q,true);sample(second,key,phase,target,true);q.slerp(target,amount);
   target.copy(world).multiply(q).multiply(rest.p).multiply(rest.q);
   bone.getWorldQuaternion(q);q.slerp(target,weight);bone.quaternion.copy(bone.parent.getWorldQuaternion(parent).invert().multiply(q));bone.updateWorldMatrix(false,false);
  }
  const sideHeading=Math.max(-.7,Math.min(.7,reverse?Math.atan2(Math.sin(heading-Math.PI),Math.cos(heading-Math.PI)):heading));
  for(const suffix of Object.keys(links))for(const side of ['Left','Right']){
   const arm=suffix==='Arm'||suffix==='ForeArm';
   if(arm&&(f.blocking||f.guardFlash>0||f.absoluteBlockUntil>time||f.shieldHeldBy!=null))continue;
   const key=side+suffix,bone=m.bones[key],child=m.bones[side+links[suffix]];if(!bone||!child)continue;
   sample(first,key,phase,v);sample(second,key,phase,end);v.lerp(end,amount).normalize();
   // An unarmed recording must not swing a heavy shield like an empty hand.
   if(arm&&side==='Left'&&f.shield)v.lerp(n.set(suffix==='Arm'?-.10:-.05,suffix==='Arm'?-.96:-.38,suffix==='Arm'?.26:.92).normalize(),.78).normalize();
   if(!arm)v.applyAxisAngle(up,sideHeading);v.applyQuaternion(world);
   bone.getWorldPosition(o);child.getWorldPosition(end).sub(o).normalize();v.lerp(end,1-weight).normalize();alignBone(bone,child,o.add(v));
  }
  if(f.shield&&f.shieldHeldBy==null&&!f.blocking&&!(f.guardFlash>0)&&!(f.absoluteBlockUntil>time)){
   const hand=m.bones.LeftHand,rest=m.rest.get('LeftHand');if(hand&&rest){target.copy(world).multiply(rest.p).multiply(rest.q);hand.getWorldQuaternion(q);q.slerp(target,weight);hand.quaternion.copy(hand.parent.getWorldQuaternion(parent).invert().multiply(q));hand.updateWorldMatrix(false,false);}
  }
  // Anatomical floor clearance; running keeps a measured airborne phase.
  let lowest=Infinity,restHeight=Infinity;
  for(const side of ['Left','Right']){const foot=m.bones[side+'Foot'];if(foot){lowest=Math.min(lowest,m.root.worldToLocal(foot.getWorldPosition(o)).y);restHeight=Math.min(restHeight,m.footRest?.[side]?.position.y??.08);}}
  const lift=scalar(first,phase)*scale(first)*(1-amount)+scalar(second,phase)*scale(second)*amount;
  const airborne=Math.max(0,lift-.018)*Math.max(0,Math.min(1,(s-2)/1.2));
  if(Number.isFinite(lowest))m.body.position.y+=Math.max(-.5,Math.min(.35,restHeight+airborne-lowest))*weight;
  m.root.updateMatrixWorld(true);return true;
 }
 return {apply};
})();
