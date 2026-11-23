/* Publisher-authored clips on the existing gladiator. No extra mesh or runtime retargeter. */
var ArenaAuthoredMotion=(()=>{
 const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 let scratch;
 const math=()=>scratch||(scratch={q:Array.from({length:8},()=>new THREE.Quaternion()),v:Array.from({length:5},()=>new THREE.Vector3()),e:new THREE.Euler()});
 const ends={Arm:'ForeArm',ForeArm:'Hand',UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase'};
 // Renderer-only weight transfer. The shared attack profile still owns every
 // hand/weapon sample, contact window and action duration; final IK seats it.
 const attackStyles={blade:{load:-.10,follow:.08,pitch:[-.02,.03],returnAt:.20,returnedAt:.82},thrust:{load:-.035,follow:.025,pitch:[-.025,.075],returnAt:.18,returnedAt:.84},heavy:{load:-.22,follow:.17,pitch:[-.075,.10],returnAt:.42,returnedAt:.90}};
 function attackStyle(f,name){
  if(f.action!=='attack')return null;
  const kind=f.attackWeapon??f.weapon;
  if(['spear','trident','trident_gladiator'].includes(kind)||name==='stab')return attackStyles.thrust;
  if(['heavy_mace','warhammer','mace','halberd'].includes(kind))return attackStyles.heavy;
  if(['gladius','sica','sword','spatha'].includes(kind))return attackStyles.blade;
  return null;
 }
 function weightTransfer(f,m,style,p,entry,rootQ){
  const s=math(),q=s.q,wind=smooth(f.timer/Math.max(.001,p.wind)),sweep=smooth((f.timer-p.wind)/Math.max(.001,p.active)),recovery=clamp((f.timer-p.wind-p.active)/Math.max(.001,p.recover));
  const strength=wind*(1-smooth(recovery))*entry,side=(f.attackLeft?-1:1)*(f.chain===2?-1:1),overhead=ArenaAuthoredCombat.clipName(f)==='chop';
  const yaw=(style.load+(style.follow-style.load)*sweep)*side*strength*(overhead?.45:1),pitch=(style.pitch[0]+(style.pitch[1]-style.pitch[0])*sweep)*strength*(overhead?1.4:1);
  const turn=(name,x,y,z)=>{
   const bone=m.bones[name];if(!bone)return;
   // Character-space axes keep handedness and the movement independent of
   // imported bone axes or arena heading. Only the body chain is adjusted.
   q[6].setFromEuler(s.e.set(x,y,z)).premultiply(rootQ).multiply(q[7].copy(rootQ).invert());
   q[7].copy(bone.getWorldQuaternion(q[5])).premultiply(q[6]);
   bone.quaternion.copy(bone.parent.getWorldQuaternion(q[5])).invert().multiply(q[7]);bone.updateWorldMatrix(false,false);
  };
  turn('Hips',pitch*.10,yaw*.28,0);turn('Spine',pitch*.25,yaw*.22,0);turn('Spine1',pitch*.25,yaw*.22,0);turn('Spine2',pitch*.40,yaw*.28,0);turn('Head',-pitch*.35,-yaw*.55,0);
 }
 function recoverySupport(f,m,authoredY){
  // A choked shaft can still be low at the end of its canonical return. Do
  // not stand the shoulder beyond arm reach while that hand is still fixed.
  // Retain only the crouch needed for contact, bounded by the source pose;
  // feet and hand IK run afterwards, with unchanged segment/joint lengths.
  if(m.body.position.y<=authoredY)return;
  const v=math().v,left=!!f.attackLeft,side=left?'Left':'Right',upper=m.bones[side+'Arm'],lower=m.bones[side+'ForeArm'],hand=m.bones[side+'Hand'];
  if(!upper||!lower||!hand)return;
  const strike=ArenaMotion.sample(f),anchor=left?m.offhandAnchor:m.weaponAnchor,offset=strike.pole?-.16:anchor.children[0]?.userData.asset==='roman_spatha.glb'?-.065:0;
  const target=m.root.localToWorld(v[0].set(strike.grip.x+strike.dir.x*offset,strike.grip.y+strike.dir.y*offset,strike.grip.z+strike.dir.z*offset)),shoulder=upper.getWorldPosition(v[1]),elbow=lower.getWorldPosition(v[2]),wrist=hand.getWorldPosition(v[3]);
  const reach=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist)+.075,vertical=shoulder.y-target.y,horizontal=(shoulder.x-target.x)**2+(shoulder.z-target.z)**2;
  const drop=Math.min(m.body.position.y-authoredY,Math.max(0,vertical-Math.sqrt(Math.max(0,reach*reach-horizontal))));
  if(drop>0){m.body.position.y-=drop;m.root.updateMatrixWorld(true);}
 }
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
  if(f.action==='idle'&&['spear','trident','trident_gladiator','halberd'].includes(f.weapon)&&f.move<.1)return ['poleIdle',(time%clips.poleIdle.duration)/clips.poleIdle.duration,.65];
  return null;
 }
 // A pose interval can include time before a newly observed action began.
 // Only that action/clip's elapsed time belongs to its first transition frame.
 function entryElapsed(f,choice,dt){
  let elapsed=0;
  if(choice){
   if(choice[0]==='guardHit')elapsed=.20-f.guardFlash;
   else if(choice[0]==='hitHead'||choice[0]==='hitChest')elapsed=.32-f.reaction;
   else if(['attack','recoil','stagger','netcast','spearcast','bash','hook','evade'].includes(f.action)){
    elapsed=Number.isFinite(f.timer)?f.timer:0;
    if(f.action==='evade'&&f.evadeKind==='jump'){
     if(choice[0]==='jumpAir')elapsed-=f.duration*.16;
     else if(choice[0]==='jumpLand')elapsed-=f.duration*.79;
    }
   }
  }
  return Math.min(Math.max(0,dt),Number.isFinite(elapsed)?Math.max(0,elapsed):0);
 }
 function begin(f,m,time,dt){
  if(typeof LUDUS_AUTHORED_MOTION==='undefined')return;
  if(m.headHeight163===undefined){m.root.updateMatrixWorld(true);m.headHeight163=m.root.worldToLocal(m.bones.Head.getWorldPosition(math().v[0])).y;}
  const choice=choose(f,time),key=choice?f.action+':'+choice[0]:null;
  const changed=m.authored163?.key!==key||f.timer+.001<(m.authored163?.timer||0)&&f.action!=='idle';
  if(changed){
   m.authored163={key,exit:!!f.pitWeapon&&!choice&&!!m.authored163?.key,age:0,timer:f.timer,body:m.body.position.clone(),...(f.pitWeapon?{anchors:[m.weaponAnchor,m.offhandAnchor].map(a=>({position:a.position.clone(),quaternion:a.quaternion.clone()}))}:{}),entry:Object.fromEntries(m.boneEntries.map(([n,b])=>[n,b.quaternion.clone()]))};
  }
  if(m.authored163){m.authored163.age+=changed?entryElapsed(f,choice,dt):Math.max(0,dt);m.authored163.timer=f.timer;}
 }
 function apply(f,m,time){
  m.authoredStep=null;
  const choice=typeof LUDUS_AUTHORED_MOTION==='undefined'?null:choose(f,time);
  if(!choice){m.authored163Clip=null;return false;}
  const [name,phase,clipWeight]=choice,c=LUDUS_AUTHORED_MOTION.clips[name];if(!c)return false;
  const style=attackStyle(f,name),profile=style&&(f.attackProfile||ArenaMotion.profile(f.attackWeapon??f.weapon,f.attackKind==='heavy',f.id!==0));
  // Finish before the action ends, leaving time for the base pose's existing
  // smoothing to settle instead of inheriting the final attack-frame twist.
  const recovery=profile?clamp((f.timer-profile.wind-profile.active)/Math.max(.001,profile.recover)):0,settle=style?1-smooth((recovery-style.returnAt)/(style.returnedAt-style.returnAt)):1,weight=clipWeight*settle;
  const at=clamp(phase)*(c.frames-1),a=Math.floor(at),b=Math.min(a+1,c.frames-1),t=at-a,s=math(),q=s.q,v=s.v,entry=smooth((m.authored163?.age??1)/.085),mirror=f.action==='netcast'||!!f.attackLeft&&['attack','recoil','stagger','spearcast','hook'].includes(f.action);
  const sample=(arr,out)=>out.fromArray(arr[a]).lerp(v[4].fromArray(arr[b]),t);
  // Moving guards own the upper body; locomotion keeps the hips and foot contacts.
  const movingGuard=f.action==='idle'&&['guard','block','guardHit'].includes(name)&&m.locomotionWeight>.005;
  const hips=sample(c.hips,v[0]),scale=m.hipRest.y;let authoredY=m.body.position.y;
  if(f.action==='evade'){
   m.body.position.y=f.evadeKind==='duck'||f.evadeKind==='jump'?ArenaAuthoredCombat.evadeOffset(f):hips.y*scale*weight;
   m.body.position.z=0;m.body.rotation.set(0,0,0);
  }else if(['attack','recoil','stagger','netcast','spearcast','bash','hook'].includes(f.action)){
   // Preserve contact-height calibration; blend from the preceding moving pose.
   const height=f.pitWeapon?Math.max(-.10,Math.min(.10,(hips.y-c.hips[0][1])*scale*.35)):hips.y*scale;
   const previous=m.authored163?.body;
   // Let the existing live base pose reclaim the body during recovery, so
   // finishing an attack does not discard a crouch/turn in a single frame.
   const y=(previous?.y||0)*(1-entry)+height*clipWeight*entry,z=(previous?.z||0)*(1-entry)+Math.max(-.16,Math.min(.18,hips.z*scale))*clipWeight*entry;
   authoredY=y;
   m.body.position.y+=(y-m.body.position.y)*settle;m.body.position.z+=(z-m.body.position.z)*settle;m.body.rotation.x*=1-settle;m.body.rotation.y*=1-settle;m.body.rotation.z*=1-settle;
  }
  m.root.updateMatrixWorld(true);const rootQ=m.root.getWorldQuaternion(q[0]);
  for(const [source,frames] of Object.entries(c.rotations)){
   if(movingGuard&&(source==='Hips'||/^(Left|Right)(UpLeg|Leg|Foot|ToeBase)/.test(source)))continue;
   const name=mirror?source.replace(/^Left/,'Temp').replace(/^Right/,'Left').replace(/^Temp/,'Right'):source,bone=m.bones[name],rest=m.rest.get(name);if(!bone||!rest)continue;
   q[1].fromArray(frames[a]).slerp(q[2].fromArray(frames[b]),t);if(mirror){q[1].y=-q[1].y;q[1].z=-q[1].z;}
   q[3].copy(rootQ).multiply(q[1]).multiply(rest.p).multiply(rest.q);
   q[4].copy(bone.parent.getWorldQuaternion(q[5])).invert().multiply(q[3]);
   const initial=m.authored163?.entry?.[name];if(entry<1&&initial)q[4].copy(initial).slerp(q[3].copy(bone.parent.getWorldQuaternion(q[5])).invert().multiply(rootQ).multiply(q[1]).multiply(rest.p).multiply(rest.q),entry);
   bone.quaternion.slerp(q[4],weight);bone.updateWorldMatrix(false,true);
  }
  for(const part of ['UpLeg','Leg','Foot','Arm','ForeArm'])for(const side of ['Left','Right']){
   if(movingGuard&&['UpLeg','Leg','Foot'].includes(part))continue;
   const key=side+part,source=(mirror?(side==='Left'?'Right':'Left'):side)+part,frames=c.directions[source],bone=m.bones[key],end=m.bones[side+ends[part]];if(!frames||!bone||!end)continue;
   sample(frames,v[0]).normalize();if(mirror)v[0].x=-v[0].x;v[0].applyQuaternion(rootQ);
   v[1].copy(end.getWorldPosition(v[2])).sub(bone.getWorldPosition(v[3])).normalize();
   q[1].setFromUnitVectors(v[1],v[0]).multiply(bone.getWorldQuaternion(q[2]));q[3].copy(bone.parent.getWorldQuaternion(q[4])).invert().multiply(q[1]);bone.quaternion.slerp(q[3],weight*entry);bone.updateWorldMatrix(false,true);
  }
  if(style)weightTransfer(f,m,style,profile,entry,rootQ);
  if(style&&settle<1)recoverySupport(f,m,authoredY);
  if(f.action==='evade'&&f.evadeKind==='duck'){m.root.updateMatrixWorld(true);const current=m.root.worldToLocal(m.bones.Head.getWorldPosition(v[0])).y;m.body.position.y+=(m.headHeight163||1.76)+ArenaAuthoredCombat.evadeOffset(f)-current;m.root.updateMatrixWorld(true);}
  if(f.action==='attack'&&c.feet){
   const side=f.attackLeft?'Right':'Left',source=mirror?'Right':'Left',pos=sample(c.feet[source],v[0]),first=c.feet[source][0],endWeight=(1-smooth((phase-.85)/.15))*settle;
   m.authoredStep={side,forward:Math.max(-.07,Math.min(.36,(pos.z-first[2])*scale))*endWeight,lift:Math.max(0,Math.min(.10,(pos.y-first[1])*scale))*endWeight};
  }
  m.authored163Clip=c.original;m.authoredClip=name;m.root.updateMatrixWorld(true);return true;
 }
 function finish(f,m){
  if(f.pitWeapon&&f.hp>0&&f.action==='idle'&&m.authored163?.exit&&m.authored163.age<.12){
   const w=smooth(m.authored163.age/.12),q=math().q[6],v=math().v[3];
   for(const [name,bone]of m.boneEntries){const previous=m.authored163.entry[name];if(previous){q.copy(bone.quaternion);bone.quaternion.copy(previous).slerp(q,w);}}
   v.copy(m.body.position);m.body.position.copy(m.authored163.body).lerp(v,w);
   for(const [i,anchor]of [m.weaponAnchor,m.offhandAnchor].entries()){const previous=m.authored163.anchors[i];q.copy(anchor.quaternion);anchor.quaternion.copy(previous.quaternion).slerp(q,w);v.copy(anchor.position);anchor.position.copy(previous.position).lerp(v,w);}
   m.root.updateMatrixWorld(true);
  }
  if(f.motionVersion!==163||f.action!=='evade')return;
  const s=math();m.root.updateMatrixWorld(true);
  const min=Math.min(m.bones.LeftFoot.getWorldPosition(s.v[0]).y,m.bones.RightFoot.getWorldPosition(s.v[1]).y),floor=m.root.position.y+.055;
  if(min<floor)m.body.position.y+=floor-min;
  m.root.updateMatrixWorld(true);
 }
 return {choose,begin,apply,finish};
})();
