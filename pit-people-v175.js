/* Scene-local fitting of the downloaded MakeHuman rig; other rooms are untouched. */
var PitPeople=(()=>{
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 let linenPromise;
 async function fit(actor){
  await actor.ready;const T=THREE,bones={},locks={},clock={time:0},owned=[];
  linenPromise=linenPromise||new T.TextureLoader().loadAsync('assets/pit-v174/linen-normal.webp');const linen=await linenPromise;
  actor.root.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:]?/,'')]=o;});
  actor.root.traverse(o=>{
   if(!o.isMesh)return;
   // The body underneath an opaque tunic must not poke through during a stride.
   // Keep neck, arms and exposed lower legs; only remove fully covered torso faces.
   if(o.name==='OwnerSkin'){
    const g=o.geometry.clone(),p=g.attributes.position,ix=g.index,indices=[],covered=i=>p.getY(i)>.61&&p.getY(i)<1.35&&Math.abs(p.getX(i))<.19;
    for(let i=0;i<(ix?ix.count:p.count);i+=3){const a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;if(!(covered(a)&&covered(b)&&covered(c)))indices.push(a,b,c);}
    g.setIndex(indices);o.geometry=g;owned.push(g);o.userData.pitCoveredBody=true;
   }
   if(o.name==='OwnerWhiteTunic'){
    const g=o.geometry.clone(),p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
    const hip=o.skeleton?.bones.findIndex(b=>/Hips$/.test(b.name)),left=o.skeleton?.bones.findIndex(b=>/LeftUpLeg$/.test(b.name)),right=o.skeleton?.bones.findIndex(b=>/RightUpLeg$/.test(b.name));
    for(let i=0;i<p.count;i++){
     const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
     // Keep the authored folds/UVs; shorten the ankle-length skirt to a level knee hem.
     if(y<.94){const scale=.39/.89;p.setY(i,.55+(y-.05)*scale);for(const a of g.morphAttributes.position||[])a.setY(i,a.getY(i)*scale);
      p.setX(i,x*1.035);p.setZ(i,z*1.075+Math.sign(z)*.008);
      // Lower cloth follows pelvis/thighs, never an ankle or knee that pulls out a spike.
      if(si&&sw&&hip>=0&&left>=0&&right>=0){const leg=x>0?left:right;si.setXYZW(i,hip,leg,hip,hip);sw.setXYZW(i,.86,.14,0,0);}
     }
     // Ease the excessive upper sleeve volume without moving the torso surface inward.
     if(y>1.22&&Math.abs(x)>.2){const blend=clamp((Math.abs(x)-.2)/.15,0,1);p.setX(i,x*(1-.055*blend));p.setZ(i,z*(1-.035*blend));}
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;owned.push(g);o.userData.pitFitted=true;
    o.material=o.material.clone();o.material.color.setHex(0xe7e0d0);o.material.roughness=1;o.material.metalness=0;
    // Fine linen relief comes from the existing downloaded cloth normal map.
    const tex=linen.clone();tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(4,4);tex.colorSpace=T.NoColorSpace;tex.needsUpdate=true;o.material.normalMap=tex;o.material.normalScale=new T.Vector2(.12,.12);owned.push(o.material,tex);
   }
   if(/^(Hair_|Beard_)/.test(o.name)){o.material=o.material.clone();owned.push(o.material);for(const k of ['r','g','b'])o.material.color[k]=Math.max(.025,o.material.color[k]);o.material.roughness=.88;}
  });
  actor.root.updateMatrixWorld(true);
  const feet=['Left','Right'].map(s=>bones[s+'Foot']).filter(Boolean),groundOffset=Math.min(...feet.map(b=>b.getWorldPosition(new T.Vector3()).y))-actor.root.position.y;
  const original=actor.animate.bind(actor),q=new T.Quaternion();let lastYaw=actor.root.rotation.y,turnBlend=0;
  function rotateTo(bone,child,target){actor.root.updateMatrixWorld(true);const origin=bone.getWorldPosition(new T.Vector3()),from=child.getWorldPosition(new T.Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();const world=new T.Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new T.Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));actor.root.updateMatrixWorld(true);}
  function plant(side,target){const upper=bones[side+'UpLeg'],lower=bones[side+'Leg'],foot=bones[side+'Foot'];if(!upper||!lower||!foot)return;
   actor.root.updateMatrixWorld(true);const a=upper.getWorldPosition(new T.Vector3()),b=lower.getWorldPosition(new T.Vector3()),c=foot.getWorldPosition(new T.Vector3()),footQ=foot.getWorldQuaternion(new T.Quaternion()),l1=a.distanceTo(b),l2=b.distanceTo(c),delta=target.clone().sub(a),distance=delta.length();
   if(distance>=l1+l2-.002||distance<=Math.abs(l1-l2)+.002)return false;
   const direction=delta.normalize(),pole=b.clone().sub(a);pole.addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<1e-6)return false;pole.normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along)),knee=a.clone().addScaledVector(direction,along).addScaledVector(pole,height);
   rotateTo(upper,lower,knee);rotateTo(lower,foot,target);foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(footQ));return true;
  }
  actor.animate=(dt,speed)=>{
   const turn=Math.abs(Math.atan2(Math.sin(actor.root.rotation.y-lastYaw),Math.cos(actor.root.rotation.y-lastYaw)))/Math.max(.001,dt);lastYaw=actor.root.rotation.y;
   turnBlend+=(Math.min(turn,4)-turnBlend)*(1-Math.exp(-dt*9));
   original(dt,Math.max(Number(speed)||0,Math.min(.65,turnBlend*.2)));clock.time+=dt;actor.root.updateMatrixWorld(true);
   // A small natural hand curl, with no backwards wrist bend.
   for(const side of ['Left','Right']){
    const hand=bones[side+'Hand'];if(hand)hand.quaternion.multiply(q.setFromEuler(new T.Euler(.035,0,side==='Left'?-.035:.035)));
    for(const finger of ['Index','Middle','Ring','Pinky'])for(const n of [1,2]){const b=bones[side+'Hand'+finger+n];if(b)b.quaternion.multiply(q.setFromEuler(new T.Euler(0,0,(side==='Left'?1:-1)*.09)));}
    const foot=bones[side+'Foot'];if(!foot)continue;const current=foot.getWorldPosition(new T.Vector3()),floor=actor.root.position.y+groundOffset,old=locks[side];
    if(speed>.12&&speed<2.2&&turnBlend<1.1){
     if(old&&(current.y>floor+.075||clock.time-old.time>.42||current.distanceTo(old.target)>.15))delete locks[side];
     if(!locks[side]&&current.y<floor+.025)locks[side]={target:current.clone(),time:clock.time};
     if(locks[side]&&!plant(side,locks[side].target))delete locks[side];
    }else delete locks[side];
   }
   actor.root.updateMatrixWorld(true);
  };
  const dispose=actor.dispose.bind(actor);actor.dispose=()=>{owned.forEach(o=>o.dispose());dispose();};
  actor.root.userData.pitPeople=true;actor.root.userData.pitFootLocks=locks;return actor;
 }
 return {fit};
})();
