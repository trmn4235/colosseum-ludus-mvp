/* Human CMU capture, phase-aligned speed blending. Combat remains authoritative.
   V94: update each changed bone only; child world queries and the final root pass propagate it. */
var ArenaLocomotion=(function(){
 let T,v,n,o,end,q,q2,world,target,parent,up;
 const links={UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase',Arm:'ForeArm',ForeArm:'Hand'};
 function initialize(){if(T)return;T=THREE;v=new T.Vector3();n=new T.Vector3();o=new T.Vector3();end=new T.Vector3();up=new T.Vector3(0,1,0);q=new T.Quaternion();q2=new T.Quaternion();world=new T.Quaternion();target=new T.Quaternion();parent=new T.Quaternion();}
 function sample(clip,key,phase,out,rotation=false){const array=(rotation?clip.rotations:clip.directions)[key],f=phase*(clip.frames-1),a=Math.floor(f),b=Math.min(a+1,clip.frames-1),t=f-a;if(rotation)return out.fromArray(array[a]).slerp(q2.fromArray(array[b]),t);return out.fromArray(array[a]).lerp(n.fromArray(array[b]),t).normalize();}
 function scalar(clip,phase){const f=phase*(clip.frames-1),a=Math.floor(f),b=Math.min(a+1,clip.frames-1);return clip.lift[a]+(clip.lift[b]-clip.lift[a])*(f-a);}
 // V213: backward/side travel uses the character's own leg lengths and stance.
 // A rotated forward capture crosses the feet and bends the knees sideways.
 function directionalFeet(m,phase,heading,stride,weight,alignBone){
  const cache=m.directional213||(m.directional213={v:Array.from({length:10},()=>new T.Vector3()),q:Array.from({length:3},()=>new T.Quaternion())});
  const p=cache.v,r=cache.q,rootQ=m.root.getWorldQuaternion(r[0]);
  const center=(m.footRest.Left.position.x+m.footRest.Right.position.x)/2;
  for(const [i,side]of ['Left','Right'].entries()){
   const upper=m.bones[side+'UpLeg'],lower=m.bones[side+'Leg'],foot=m.bones[side+'Foot'],rest=m.footRest[side];
   const cycle=(phase+i*.5)%1,swing=cycle>=.5,u=(cycle-.5)*2;
   const along=swing?(-.5+u*u*(3-2*u)):(.5-cycle*2),lift=swing?Math.sin(Math.PI*u)**2*.075:0;
   const target=p[0].copy(rest.position);target.x+=Math.sin(heading)*along*stride*.5;target.z+=Math.cos(heading)*along*stride*.5;target.y+=lift;
   // Keep a minimum lane for each foot, including diagonal direction changes.
   target.x=side==='Left'?Math.max(center+.055,target.x):Math.min(center-.055,target.x);
   m.root.localToWorld(target);foot.getWorldPosition(p[1]);target.lerp(p[1],1-weight);
   const hip=upper.getWorldPosition(p[2]),knee=lower.getWorldPosition(p[3]),ankle=foot.getWorldPosition(p[4]);
   const a=hip.distanceTo(knee),b=knee.distanceTo(ankle),line=p[5].copy(target).sub(hip),distance=Math.max(Math.abs(a-b)+.001,Math.min(a+b-.001,line.length()));line.normalize();
   const pole=p[6].set(0,0,1).applyQuaternion(rootQ);pole.addScaledVector(line,-pole.dot(line)).normalize();
   const offset=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-offset*offset));
   alignBone(upper,lower,p[7].copy(hip).addScaledVector(line,offset).addScaledVector(pole,height));
   alignBone(lower,foot,p[8].copy(hip).addScaledVector(line,distance));
   r[1].copy(foot.parent.getWorldQuaternion(r[2])).invert().multiply(rootQ).multiply(rest.quaternion);foot.quaternion.slerp(r[1],weight);foot.updateWorldMatrix(false,false);
  }
 }
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
  const capturedStride=first.stride*scale(first)*(1-amount)+second.stride*scale(second)*amount;
  let heading=m.locomotionHeading||0;if(moving){const desired=Math.atan2(dx,dz)-f.angle;heading=m.locomotionHeading===undefined?desired:heading+Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading))*(1-Math.exp(-dt*16));heading=Math.atan2(Math.sin(heading),Math.cos(heading));m.locomotionHeading=heading;}
  const directional=Math.max(0,Math.min(1,(.92-Math.cos(heading))/.22));
  const stride=capturedStride*(1-directional)+m.locomotionLegLength*1.35*directional;
  m.locomotionPhase=((m.locomotionPhase||0)+travel/stride+1)%1;
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
  const sideHeading=Math.max(-.7,Math.min(.7,heading))*(1-directional);
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
  if(directional>0&&m.footRest?.Left&&m.footRest?.Right)directionalFeet(m,phase,heading,stride,weight*directional,alignBone);
  if(f.shield&&f.shieldHeldBy==null&&!f.blocking&&!(f.guardFlash>0)&&!(f.absoluteBlockUntil>time)){
   const hand=m.bones.LeftHand,rest=m.rest.get('LeftHand');if(hand&&rest){target.copy(world).multiply(rest.p).multiply(rest.q);hand.getWorldQuaternion(q);q.slerp(target,weight);hand.quaternion.copy(hand.parent.getWorldQuaternion(parent).invert().multiply(q));hand.updateWorldMatrix(false,false);}
  }
  // Anatomical floor clearance; running keeps a measured airborne phase.
  let lowest=Infinity,restHeight=Infinity;
  for(const side of ['Left','Right']){const foot=m.bones[side+'Foot'];if(foot){lowest=Math.min(lowest,m.root.worldToLocal(foot.getWorldPosition(o)).y);restHeight=Math.min(restHeight,m.footRest?.[side]?.position.y??.08);}}
  const lift=scalar(first,phase)*scale(first)*(1-amount)+scalar(second,phase)*scale(second)*amount;
  const airborne=Math.max(0,lift-.018)*Math.max(0,Math.min(1,(s-2)/1.2))*(1-directional);
  if(Number.isFinite(lowest))m.body.position.y+=Math.max(-.5,Math.min(.35,restHeight+airborne-lowest))*weight;
  m.root.updateMatrixWorld(true);return true;
 }
 return {apply};
})();
