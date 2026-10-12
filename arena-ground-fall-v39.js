/* Authored backward fall + LayToIdle recovery, Quaternius CC0.
   Only presentation is retargeted; combat positions and incapacitation stay authoritative. */
var GroundFall=(function(){
 const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v);};
 let scratch;function math(){const T=THREE;return scratch||(scratch={q:Array.from({length:10},()=>new T.Quaternion()),v:Array.from({length:10},()=>new T.Vector3())});}
 const groundRadii={Head:.13,Hips:.13,Spine2:.15,LeftForeArm:.06,RightForeArm:.06,LeftHand:.04,RightHand:.04,LeftLeg:.065,RightLeg:.065,LeftFoot:.045,RightFoot:.045,LeftToeBase:.025,RightToeBase:.025};
 const ends={Arm:'ForeArm',ForeArm:'Hand',UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase'};
 function sample(c,phase){const frame=clamp(phase)*(c.frames-1),a=Math.floor(frame);return{c,a,b:Math.min(c.frames-1,a+1),t:frame-a};}
 function vector(s,key){const frames=s.c[key];if(!frames)return [0,0,0];return frames[s.a].map((v,i)=>v+(frames[s.b][i]-v)*s.t);}
 // Capture the last rendered pose BEFORE the renderer resets roots, bones or grips.
 function begin(f,m){const kind=f.hp<=0?'dead':f.action==='knocked'?'knocked':null;
  if(!kind){m.fallTransition=null;return;}const elapsed=Math.max(0,kind==='dead'?f.deadTime||0:f.timer||0),old=m.fallTransition;
  if(old&&old.kind===kind&&elapsed>=old.lastElapsed){old.lastElapsed=elapsed;return;}
  const previous=m.lastFall,continuing=kind==='dead'&&previous&&previous.recovery<.15;
  m.fallTransition={kind,started:elapsed,lastElapsed:elapsed,x:m.root.position.x,z:m.root.position.z,heading:m.root.rotation.y,
   body:m.body.position.clone(),rotation:m.body.quaternion.clone(),bones:Object.fromEntries(Object.entries(m.bones).map(([key,bone])=>[key,bone.quaternion.clone()])),
   anchors:[m.weaponAnchor,m.offhandAnchor].map(a=>a?{position:a.position.clone(),quaternion:a.quaternion.clone()}:null),
   phase:continuing?(previous.down.a+previous.down.t)/(previous.down.c.frames-1)*previous.down.c.duration:0,captured:!!m.hasRendered};
 }
 function pose(f,m){const dead=f.hp<=0,knocked=f.action==='knocked';if(!dead&&!knocked)return null;
  const c=LUDUS_FALL_MOTION.clip,elapsed=Math.max(0,dead?f.deadTime||0:f.timer||0),duration=Math.max(.25,f.duration||1.5);
  const state=m?.fallTransition,age=state?.captured?Math.max(0,elapsed-state.started):elapsed,entry=state?.captured?ease(age/(dead?.28:.18)):1;
  const fallSeconds=dead?.74:Math.min(.62,duration*.40),riseSeconds=Math.min(.60,duration*.38),riseStart=duration-riseSeconds,rising=!dead&&elapsed>riseStart;
  const clipSeconds=dead?Math.min(c.duration,(state?.phase||0)+age/fallSeconds*1.35):clamp(elapsed/fallSeconds)*1.35;
  const down=sample(c,clipSeconds/c.duration),up=rising&&typeof QUATERNIUS_COMBAT!=='undefined'?sample(QUATERNIUS_COMBAT.clips.stand,(elapsed-riseStart)/riseSeconds):null;
  const recovery=up?ease((elapsed-riseStart)/riseSeconds):0,hip=vector(down,'hips'),ratio=(m?.hipRest?.y||1.05)/(c.hipHeight||.95);
  // A death never reuses a previous shield push's origin or facing.
  const origin=dead?(state?.captured?state:null):f.knockOrigin,travel=ease((dead?age:elapsed)/.24),heading=dead?null:f.knockAngle;
  const lift=hip[1]*ratio*(1-recovery),shift=hip[2]*ratio*(1-recovery);
  return{down,up,entry,state,recovery,fall:clamp(clipSeconds/1.35)*(1-recovery),rotation:0,roll:0,
   lift:state?.captured?state.body.y+(lift-state.body.y)*entry:lift,shift:state?.captured?state.body.z+(shift-state.body.z)*entry:shift,poses:{},
   x:origin?origin.x+(f.x-origin.x)*travel:f.x,z:origin?origin.z+(f.z-origin.z)*travel:f.z,
   heading:dead&&state?.captured?state.heading:Number.isFinite(heading)?f.angle+Math.atan2(Math.sin(heading-f.angle),Math.cos(heading-f.angle))*ease(elapsed/.13):f.angle};
 }
 function apply(m,fall){if(!fall)return false;const T=THREE,{q,v}=math(),root=m.root.getWorldQuaternion(q[0]),qa=q[1],qb=q[2];
  const {down,up,entry}=fall,transition=up?ease(up.a/Math.max(1,up.c.frames-1)/.20):0;
  if(entry<1&&fall.state?.captured){for(const [key,q]of Object.entries(fall.state.bones))m.bones[key]?.quaternion.copy(q);m.root.updateMatrixWorld(true);}
  function rotation(key){const d=down.c.rotations[key];if(!d)return null;qa.fromArray(d[down.a]).slerp(qb.fromArray(d[down.b]),down.t);
   if(up?.c.rotations[key]){const u=up.c.rotations[key],uq=q[3].fromArray(u[up.a]).slerp(q[4].fromArray(u[up.b]),up.t);qa.slerp(uq,transition);}return qa;}
  // Preserve desired WORLD orientations: converting each with its animated parent
  // avoids accumulating a 90-degree hip bend again at every spine joint.
  for(const key of Object.keys(down.c.rotations)){const bone=m.bones[key],rest=m.rest.get(key),delta=rotation(key);if(!bone||!rest||!delta)continue;
   const desired=q[5].copy(root).multiply(delta).multiply(rest.p).multiply(rest.q),local=bone.parent.getWorldQuaternion(q[6]).invert().multiply(desired);bone.quaternion.slerp(local,entry);bone.updateWorldMatrix(false,true);
  }
  for(const suffix of ['UpLeg','Leg','Foot','Arm','ForeArm'])for(const side of ['Left','Right']){const key=side+suffix,bone=m.bones[key],end=m.bones[side+ends[suffix]],d=down.c.directions[key];if(!bone||!end||!d)continue;
   const direction=v[0].fromArray(d[down.a]).lerp(v[1].fromArray(d[down.b]),down.t);
   if(up?.c.directions[key]){const u=up.c.directions[key];direction.lerp(v[4].fromArray(u[up.a]).lerp(v[5].fromArray(u[up.b]),up.t),transition);}direction.normalize().applyQuaternion(root);
   const current=end.getWorldPosition(v[2]).sub(bone.getWorldPosition(v[3])).normalize(),world=q[7].setFromUnitVectors(current,direction).multiply(bone.getWorldQuaternion(q[8]));
   bone.quaternion.slerp(bone.parent.getWorldQuaternion(q[6]).invert().multiply(world),entry);bone.updateWorldMatrix(false,true);
  }
  m.authoredFall=up?'LayToIdle':'Death01';m.root.updateMatrixWorld(true);return true;
 }
 function equipment(m,fall){if(!fall)return;const T=THREE,{q,v}=math(),weight=ease((fall.fall-.2)/.4);
  // Long weapons settle horizontally beside the wrist rather than spearing the floor.
  for(const [i,[anchor,side]]of [[m.weaponAnchor,1],[m.offhandAnchor,-1]].entries()){if(!anchor?.children.length)continue;
   if(weight>0){const desired=q[5].setFromUnitVectors(v[7].set(0,1,0),v[8].set(side*.93,0,.37).normalize()),parent=anchor.parent.getWorldQuaternion(q[6]).invert();
    const child=anchor.children[0],correction=q[8].setFromEuler(child.rotation).invert();anchor.quaternion.slerp(parent.multiply(desired).multiply(correction),weight);}
   const captured=fall.state?.captured&&fall.state.anchors[i];if(captured&&fall.entry<1){anchor.position.lerpVectors(captured.position,v[9].copy(anchor.position),fall.entry);anchor.quaternion.copy(q[9].copy(captured.quaternion).slerp(anchor.quaternion,fall.entry));}
  }m.root.updateMatrixWorld(true);
 }
 function ground(m,fall){if(!fall)return;const radii=groundRadii;
  let low=Infinity;const point=math().v[6];for(const [name,r]of Object.entries(radii)){const bone=m.bones[name];if(bone)low=Math.min(low,bone.getWorldPosition(point).y-r);}
  if(!Number.isFinite(low))return;m.body.position.y+=(.018-low)*(fall.state?.phase>=1.2?1:fall.entry);m.root.updateMatrixWorld(true);
 }
 function finish(m,fall){m.hasRendered=true;m.lastFall=fall;}
 return{begin,pose,apply,equipment,ground,finish};
})();
