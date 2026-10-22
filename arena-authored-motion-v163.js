/* Publisher-authored clips on the existing gladiator. No extra mesh or runtime retargeter. */
var ArenaAuthoredMotion=(()=>{
 const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 let scratch;
 const math=()=>scratch||(scratch={q:Array.from({length:8},()=>new THREE.Quaternion()),v:Array.from({length:5},()=>new THREE.Vector3())});
 const ends={Arm:'ForeArm',ForeArm:'Hand',UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase'};
 function choose(f,time){
  if(f.motionVersion!==163||f.hp<=0||['knocked','stunned','dodge'].includes(f.action))return null;
  const api=ArenaAuthoredCombat,clips=LUDUS_AUTHORED_MOTION.clips;
  if(f.action==='evade'){
   const u=clamp(f.timer/f.duration);
   if(f.evadeKind==='duck')return ['crouch',.4,smooth(u/.23)*(1-smooth((u-.62)/.38))];
   if(f.evadeKind==='jump')return u<.16?['jumpStart',u/.16,1]:u<.79?['jumpAir',(u-.16)/.63,1]:['jumpLand',(u-.79)/.21,1];
   const key={stepLeft:'dodgeLeft',stepRight:'dodgeRight',stepBack:'dodgeBack',stepForward:'dodgeForward'}[f.evadeKind];
   return [key||'dodgeBack',u,Math.min(smooth(u/.12),1-smooth((u-.78)/.22))];
  }
  if(f.action==='attack')return [api.clipName(f),api.phase(f),1];
  if(['recoil','stagger'].includes(f.action)&&f.recoilSample)return [api.clipName(f),f.recoilPhase??.5,1-smooth(f.timer/f.duration)];
  if(f.reaction>0||f.action==='hurt')return [f.lastRegion==='head'?'hitHead':'hitChest',clamp(1-f.reaction/.32),.62];
  if(f.action==='netcast'||f.action==='spearcast'){
   const u=clamp(f.timer/f.duration),release=f.action==='netcast'?.3:.27,p=release/f.duration;
   return ['throw',u<p?u/p*.40:.40+(u-p)/(1-p)*.60,1];
  }
  if(f.action==='bash')return ['shieldBash',clamp(f.timer/f.duration),1];
  if(f.action==='hook')return ['block',.5,1];
  if(f.archer&&f.bowReleaseUntil>time)return ['bowRelease',clamp(1-(f.bowReleaseUntil-time)/.24),1];
  if(f.archer&&f.bowDrawUntil>time)return ['bowDraw',clamp(1-(f.bowDrawUntil-time)/.35),1];
  if(f.guardFlash>0)return ['guardHit',clamp(1-f.guardFlash/.20),.7];
  if(f.blocking||f.absoluteBlockUntil>time)return [f.shield?'guard':'block',f.shield?(time%clips.guard.duration)/clips.guard.duration:.5,.9];
  if(f.action==='idle'&&['spear','trident'].includes(f.weapon)&&f.move<.1)return ['poleIdle',(time%clips.poleIdle.duration)/clips.poleIdle.duration,.65];
  return null;
 }
 function begin(f,m,time,dt){
  if(typeof LUDUS_AUTHORED_MOTION==='undefined')return;
  if(m.headHeight163===undefined){m.root.updateMatrixWorld(true);m.headHeight163=m.root.worldToLocal(m.bones.Head.getWorldPosition(math().v[0])).y;}
  const choice=choose(f,time),key=choice?f.action+':'+choice[0]:null;
  if(m.authored163?.key!==key||f.timer+.001<(m.authored163?.timer||0)&&f.action!=='idle'){
   m.authored163={key,age:0,timer:f.timer,entry:Object.fromEntries(m.boneEntries.map(([n,b])=>[n,b.quaternion.clone()]))};
  }
  if(m.authored163){m.authored163.age+=Math.max(0,dt);m.authored163.timer=f.timer;}
 }
 function apply(f,m,time){
  m.authoredStep=null;
  const choice=typeof LUDUS_AUTHORED_MOTION==='undefined'?null:choose(f,time);
  if(!choice){m.authored163Clip=null;return false;}
  const [name,phase,weight]=choice,c=LUDUS_AUTHORED_MOTION.clips[name];if(!c)return false;
  const at=clamp(phase)*(c.frames-1),a=Math.floor(at),b=Math.min(a+1,c.frames-1),t=at-a,s=math(),q=s.q,v=s.v,entry=smooth((m.authored163?.age||1)/.085),mirror=f.action==='netcast'||!!f.attackLeft&&['attack','recoil','stagger','spearcast','hook'].includes(f.action);
  const sample=(arr,out)=>out.fromArray(arr[a]).lerp(v[4].fromArray(arr[b]),t);
  const hips=sample(c.hips,v[0]),scale=m.hipRest.y;
  if(f.action==='evade'){
   m.body.position.y=f.evadeKind==='duck'||f.evadeKind==='jump'?ArenaAuthoredCombat.evadeOffset(f):hips.y*scale*weight;
   m.body.position.z=0;m.body.rotation.set(0,0,0);
  }else if(['attack','recoil','stagger','netcast','spearcast','bash','hook'].includes(f.action)){
   m.body.position.y=hips.y*scale*weight*entry;m.body.position.z=Math.max(-.16,Math.min(.18,hips.z*scale))*weight*entry;m.body.rotation.set(0,0,0);
  }
  m.root.updateMatrixWorld(true);const rootQ=m.root.getWorldQuaternion(q[0]);
  for(const [source,frames] of Object.entries(c.rotations)){
   const name=mirror?source.replace(/^Left/,'Temp').replace(/^Right/,'Left').replace(/^Temp/,'Right'):source,bone=m.bones[name],rest=m.rest.get(name);if(!bone||!rest)continue;
   q[1].fromArray(frames[a]).slerp(q[2].fromArray(frames[b]),t);if(mirror){q[1].y=-q[1].y;q[1].z=-q[1].z;}
   q[3].copy(rootQ).multiply(q[1]).multiply(rest.p).multiply(rest.q);
   q[4].copy(bone.parent.getWorldQuaternion(q[5])).invert().multiply(q[3]);
   const initial=m.authored163?.entry?.[name];if(entry<1&&initial)q[4].copy(initial).slerp(q[3].copy(bone.parent.getWorldQuaternion(q[5])).invert().multiply(rootQ).multiply(q[1]).multiply(rest.p).multiply(rest.q),entry);
   bone.quaternion.slerp(q[4],weight);bone.updateWorldMatrix(false,true);
  }
  for(const part of ['UpLeg','Leg','Foot','Arm','ForeArm'])for(const side of ['Left','Right']){
   const key=side+part,source=(mirror?(side==='Left'?'Right':'Left'):side)+part,frames=c.directions[source],bone=m.bones[key],end=m.bones[side+ends[part]];if(!frames||!bone||!end)continue;
   sample(frames,v[0]).normalize();if(mirror)v[0].x=-v[0].x;v[0].applyQuaternion(rootQ);
   v[1].copy(end.getWorldPosition(v[2])).sub(bone.getWorldPosition(v[3])).normalize();
   q[1].setFromUnitVectors(v[1],v[0]).multiply(bone.getWorldQuaternion(q[2]));q[3].copy(bone.parent.getWorldQuaternion(q[4])).invert().multiply(q[1]);bone.quaternion.slerp(q[3],weight*entry);bone.updateWorldMatrix(false,true);
  }
  if(f.action==='evade'&&f.evadeKind==='duck'){m.root.updateMatrixWorld(true);const current=m.root.worldToLocal(m.bones.Head.getWorldPosition(v[0])).y;m.body.position.y+=(m.headHeight163||1.76)+ArenaAuthoredCombat.evadeOffset(f)-current;m.root.updateMatrixWorld(true);}
  if(f.action==='attack'&&c.feet){
   const side=f.attackLeft?'Right':'Left',source=mirror?'Right':'Left',pos=sample(c.feet[source],v[0]),first=c.feet[source][0],endWeight=1-smooth((phase-.85)/.15);
   m.authoredStep={side,forward:Math.max(-.07,Math.min(.36,(pos.z-first[2])*scale))*endWeight,lift:Math.max(0,Math.min(.10,(pos.y-first[1])*scale))*endWeight};
  }
  m.authored163Clip=c.original;m.authoredClip=name;m.root.updateMatrixWorld(true);return true;
 }
 function finish(f,m){
  if(f.motionVersion!==163||f.action!=='evade')return;
  const s=math();m.root.updateMatrixWorld(true);
  const min=Math.min(m.bones.LeftFoot.getWorldPosition(s.v[0]).y,m.bones.RightFoot.getWorldPosition(s.v[1]).y),floor=m.root.position.y+.055;
  if(min<floor)m.body.position.y+=floor-min;
  m.root.updateMatrixWorld(true);
 }
 return {choose,begin,apply,finish};
})();
