/* Authored backward fall + LayToIdle recovery, Quaternius CC0.
   Only presentation is retargeted; combat positions and incapacitation stay authoritative. */
var GroundFall=(function(){
 const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v);};
 const ends={Arm:'ForeArm',ForeArm:'Hand',UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase'};
 function sample(c,phase){const frame=clamp(phase)*(c.frames-1),a=Math.floor(frame);return{c,a,b:Math.min(c.frames-1,a+1),t:frame-a};}
 function vector(s,key){const frames=s.c[key];if(!frames)return [0,0,0];return frames[s.a].map((v,i)=>v+(frames[s.b][i]-v)*s.t);}
 function pose(f,m){const dead=f.hp<=0,knocked=f.action==='knocked';if(!dead&&!knocked)return null;
  const c=LUDUS_FALL_MOTION.clip,elapsed=Math.max(0,dead?f.deadTime||0:f.timer||0),duration=Math.max(.25,f.duration||1.5);
  const fallSeconds=dead?.74:Math.min(.62,duration*.40),riseSeconds=Math.min(.60,duration*.38),riseStart=duration-riseSeconds,rising=!dead&&elapsed>riseStart;
  const fallPhase=clamp(elapsed/fallSeconds)*1.35/c.duration,down=sample(c,fallPhase),up=rising&&typeof QUATERNIUS_COMBAT!=='undefined'?sample(QUATERNIUS_COMBAT.clips.stand,(elapsed-riseStart)/riseSeconds):null;
  const recovery=up?ease((elapsed-riseStart)/riseSeconds):0,hip=vector(down,'hips'),ratio=(m?.hipRest?.y||1.05)/(c.hipHeight||.95);
  const origin=f.knockOrigin,travel=ease(elapsed/.24),heading=f.knockAngle;
  return{down,up,entry:ease(elapsed/.08),recovery,fall:clamp(elapsed/fallSeconds)*(1-recovery),rotation:0,roll:0,
   lift:hip[1]*ratio*(1-recovery),shift:hip[2]*ratio*(1-recovery),poses:{},
   x:origin?origin.x+(f.x-origin.x)*travel:f.x,z:origin?origin.z+(f.z-origin.z)*travel:f.z,
   heading:Number.isFinite(heading)?f.angle+Math.atan2(Math.sin(heading-f.angle),Math.cos(heading-f.angle))*ease(elapsed/.13):f.angle};
 }
 function apply(m,fall){if(!fall)return false;const T=THREE,root=m.root.getWorldQuaternion(new T.Quaternion()),qa=new T.Quaternion(),qb=new T.Quaternion();
  const {down,up,entry}=fall,transition=up?ease(up.a/Math.max(1,up.c.frames-1)/.20):0;
  function rotation(key){const d=down.c.rotations[key];if(!d)return null;qa.fromArray(d[down.a]).slerp(qb.fromArray(d[down.b]),down.t);
   if(up?.c.rotations[key]){const u=up.c.rotations[key],uq=new T.Quaternion().fromArray(u[up.a]).slerp(new T.Quaternion().fromArray(u[up.b]),up.t);qa.slerp(uq,transition);}return qa.clone();}
  // Preserve desired WORLD orientations: converting each with its animated parent
  // avoids accumulating a 90-degree hip bend again at every spine joint.
  for(const key of Object.keys(down.c.rotations)){const bone=m.bones[key],rest=m.rest.get(key),delta=rotation(key);if(!bone||!rest||!delta)continue;
   const desired=root.clone().multiply(delta).multiply(rest.p).multiply(rest.q),local=bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(desired);bone.quaternion.slerp(local,entry);bone.updateWorldMatrix(false,true);
  }
  for(const suffix of ['UpLeg','Leg','Foot','Arm','ForeArm'])for(const side of ['Left','Right']){const key=side+suffix,bone=m.bones[key],end=m.bones[side+ends[suffix]],d=down.c.directions[key];if(!bone||!end||!d)continue;
   const direction=new T.Vector3().fromArray(d[down.a]).lerp(new T.Vector3().fromArray(d[down.b]),down.t);
   if(up?.c.directions[key]){const u=up.c.directions[key];direction.lerp(new T.Vector3().fromArray(u[up.a]).lerp(new T.Vector3().fromArray(u[up.b]),up.t),transition);}direction.normalize().applyQuaternion(root);
   const current=end.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize(),world=new T.Quaternion().setFromUnitVectors(current,direction).multiply(bone.getWorldQuaternion(new T.Quaternion()));
   bone.quaternion.slerp(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world),entry);bone.updateWorldMatrix(false,true);
  }
  m.authoredFall=up?'LayToIdle':'Death01';m.root.updateMatrixWorld(true);return true;
 }
 function equipment(m,fall){if(!fall)return;const T=THREE,weight=ease((fall.fall-.2)/.4);
  // Long weapons settle horizontally beside the wrist rather than spearing the floor.
  for(const [anchor,side]of [[m.weaponAnchor,1],[m.offhandAnchor,-1]]){if(!anchor?.children.length||weight<=0)continue;
   const desired=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(side*.93,0,.37).normalize()),parent=anchor.parent.getWorldQuaternion(new T.Quaternion()).invert();
   const child=anchor.children[0],correction=new T.Quaternion().setFromEuler(child.rotation).invert();anchor.quaternion.slerp(parent.multiply(desired).multiply(correction),weight);
  }m.root.updateMatrixWorld(true);
 }
 function ground(m,fall){if(!fall)return;const radii={Head:.13,Hips:.13,Spine2:.15,LeftForeArm:.06,RightForeArm:.06,LeftHand:.04,RightHand:.04,LeftLeg:.065,RightLeg:.065,LeftFoot:.045,RightFoot:.045,LeftToeBase:.025,RightToeBase:.025};
  let low=Infinity;const point=new THREE.Vector3();for(const [name,r]of Object.entries(radii)){const bone=m.bones[name];if(bone)low=Math.min(low,bone.getWorldPosition(point).y-r);}
  if(!Number.isFinite(low))return;m.body.position.y+=(.018-low)*fall.entry;m.root.updateMatrixWorld(true);
 }
 return{pose,apply,equipment,ground};
})();
