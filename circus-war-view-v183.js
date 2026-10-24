/* Existing CC0 gladiator rig and CC-BY panko10 cart, adapted for a two-person crew. */
var CircusWarView=(()=>{
 const colors=[0x762638,0x254b72,0x3b634b,0xb28a35];
 const trackCamera=CircusRace.trackCamera;
 async function create(T,race,scene){
  const res=await fetch('gladiator-mobile.glb',{signal:AbortSignal.timeout(45000)});if(!res.ok)throw Error('Gladyatör görseli yüklenemedi. Tekrar dene.');const gltf=await new T.GLTFLoader().parseAsync(await res.arrayBuffer(),'');
  gltf.scene.traverse(o=>{if(o.isMesh){const a=gltf.parser.associations.get(o),name=a?.meshes!==undefined?gltf.parser.json.meshes[a.meshes]?.name:'';if(/^(weapon|shield|helmet)_geo/.test(name||''))o.visible=false;}});
  const extras=new T.Group();extras.name='Ciritler ve kırbaçlar';scene.add(extras);extras.visible=false;
  const line=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:73},()=>new T.Vector3())),new T.LineBasicMaterial({color:0xe6c766,transparent:true,opacity:.4,depthWrite:false}));line.frustumCulled=false;extras.add(line);
  const shafts=new Map(),shaftGeo=new T.CylinderGeometry(.026,.031,1.85,8),tipGeo=new T.ConeGeometry(.075,.30,4),wood=new T.MeshStandardMaterial({color:0x9c7040,roughness:.85}),iron=new T.MeshStandardMaterial({color:0x9d9c91,metalness:.65,roughness:.4});shaftGeo.rotateX(Math.PI/2);tipGeo.rotateX(Math.PI/2);tipGeo.translate(0,0,1.06);
  const crews=[],quaternion=new T.Quaternion();
  function align(model,boneName,endName,target){const b=model.bones[boneName],e=model.bones[endName];if(!b||!e)return;model.root.updateMatrixWorld(true);const origin=b.getWorldPosition(new T.Vector3()),a=e.getWorldPosition(new T.Vector3()).sub(origin).normalize(),v=model.root.localToWorld(new T.Vector3(...target)).sub(origin).normalize();const rot=new T.Quaternion().setFromUnitVectors(a,v).multiply(b.getWorldQuaternion(new T.Quaternion()));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rot));}
  function reach(m,side,target){const upper=m.bones[side+'Arm'],lower=m.bones[side+'ForeArm'],hand=m.bones[side+'Hand'];m.root.updateMatrixWorld(true);const p=upper.getWorldPosition(new T.Vector3()),e=lower.getWorldPosition(new T.Vector3()),h=hand.getWorldPosition(new T.Vector3()),goal=m.root.localToWorld(new T.Vector3(...target)),a=p.distanceTo(e),b=e.distanceTo(h),dir=goal.sub(p),d=Math.max(Math.abs(a-b)+.003,Math.min(a+b-.003,dir.length()));dir.normalize();const pole=new T.Vector3(side==='Left'?.7:-.7,-.6,-.2).applyQuaternion(m.root.getWorldQuaternion(new T.Quaternion()));pole.addScaledVector(dir,-pole.dot(dir)).normalize();const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),elbow=p.clone().addScaledVector(dir,along).addScaledVector(pole,height),wrist=p.clone().addScaledVector(dir,d);align(m,side+'Arm',side+'ForeArm',m.root.worldToLocal(elbow).toArray());align(m,side+'ForeArm',side+'Hand',m.root.worldToLocal(wrist).toArray());}
  function javelin(){const root=new T.Group();root.name='Cirit · 2.15 metre';root.add(new T.Mesh(shaftGeo,wood),new T.Mesh(tipGeo,iron));return root;}
  const darkLeather=new T.MeshStandardMaterial({color:0x171c1b,roughness:.96}),rimMat=new T.MeshStandardMaterial({color:0x363c36,roughness:.91});
  function quiver(){const root=new T.Group();root.name='Uzun siyah deri cirit sepeti';const body=new T.Mesh(new T.CylinderGeometry(.22,.15,1.02,16,1,true),darkLeather);body.position.y=.51;root.add(body);const bottom=new T.Mesh(new T.CylinderGeometry(.15,.15,.035,16),darkLeather);root.add(bottom);
   for(const y of[.04,.81,1.02]){const rim=new T.Mesh(new T.TorusGeometry(y===.04?.15:.22,.017,5,20),rimMat);rim.rotation.x=Math.PI/2;rim.position.y=y;root.add(rim);}
   for(let k=0;k<13;k++){const stitch=new T.Mesh(new T.BoxGeometry(.04,.009,.012),rimMat);stitch.position.set(.03,.1+k*.067,.158+k*.004);root.add(stitch);}
   const stored=[];for(let k=0;k<5;k++){const j=javelin();j.rotation.x=-Math.PI/2+(k-2)*.018;j.position.set(Math.cos(k*2.4)*.11,1.06,Math.sin(k*2.4)*.1);root.add(j);stored.push(j);}root.userData.stored=stored;return root;
  }
  function whipModel(){const root=new T.Group(),handle=new T.Mesh(new T.CylinderGeometry(.035,.045,.36,8),wood);root.name='Kırbaç';handle.rotation.x=Math.PI/2;root.add(handle);const pts=Array.from({length:23},(_,k)=>{const a=k/22*Math.PI*3;return new T.Vector3(Math.cos(a)*.095,-.12-k*.008,.18+Math.sin(a)*.095);});root.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.012,5,false),darkLeather));return root;}
  const baskets=[],lashes=[];
  for(let i=0;i<4;i++){
   const pair=[];for(let j=0;j<2;j++){
    const visual=CircusRace.cloneRig(gltf.scene),root=new T.Group(),facing=new T.Group();root.add(facing);facing.add(visual);const bones={},rest={};visual.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'').replace(/_\d+$/,'')]=o;});root.updateMatrixWorld(true);const forward=new T.Vector3(0,0,1).applyQuaternion(bones.Hips.getWorldQuaternion(new T.Quaternion()));facing.rotation.y=-Math.atan2(forward.x,forward.z);root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(visual),scale=1.74/(box.max.y-box.min.y);facing.scale.setScalar(scale);facing.position.y=-box.min.y*scale;
    for(const [name,b]of Object.entries(bones))rest[name]=b.quaternion.clone();visual.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    const weapon=javelin(),whip=whipModel();root.add(weapon,whip);weapon.visible=false;const actor={root,visual,facing,bones,rest,javelin:weapon,whip};root.visible=false;race.teams[i].group.add(root);pair.push(actor);
   }crews.push(pair);
   const basket=quiver();basket.position.set(.78,.73,-.92);race.teams[i].group.add(basket);baskets.push(basket);
   const lash=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:20},()=>new T.Vector3())),new T.LineBasicMaterial({color:0xc2a36a,transparent:true,opacity:.95}));lash.frustumCulled=false;extras.add(lash);lashes.push(lash);

  }
  function show(value){extras.visible=value;race.teams.forEach((t,i)=>{t.rider.visible=!value;t.cart.scale.set(value?1.18:1,1,value?1.6:1);t.wheels.forEach(w=>{w.userData.warRest=w.userData.warRest||w.position.clone();const parent=value?t.group:t.cart;if(w.parent!==parent){parent.add(w);w.position.copy(w.userData.warRest);w.position.x*=value?1.18:1;w.scale.setScalar(1);w.rotation.z=0;}});baskets[i].visible=value;crews[i].forEach(m=>m.root.visible=value);if(!value)t.horses.forEach((h,k)=>h.hand=t.bones[(k?'Right':'Left')+'Hand']);});if(!value)race.setExternal(null);}
  function update(s,dt,camera){show(true);race.setExternal(s);race.sync(s.time,dt);
   for(let i=0;i<4;i++){const t=s.teams[i],rt=race.teams[i];baskets[i].visible=!t.eliminated;baskets[i].rotation.z=rt.cart.rotation.z;baskets[i].position.y=.73+(t.broken?-.18:rt.cart.position.y);
    for(let j=0;j<2;j++){const m=crews[i][j],g=t.crew[j],fall=g.hp<=0?Math.min(1,(s.time-(g.downAt??s.time))/.9):0;m.root.visible=g.hp>0||fall<1;m.root.userData.gladiatorId=g.id;m.root.name=g.name;if(!m.root.visible)continue;
     for(const[name,q]of Object.entries(m.rest))m.bones[name].quaternion.copy(q);
     const shooting=g.hp<=0?g.downSlot==='archer':j===t.archer,moving=t.speed>1,duck=g.duck||0,draw=t.drawUntil?Math.max(0,Math.min(1,1-(t.drawUntil-s.time)/.85)):0,releasing=shooting&&s.time-t.lastShot<.3;
     const aim=i===3&&s.role===j?s.aimYaw:t.shotYaw-rt.group.rotation.y;
     m.root.position.set(0,.73+(t.broken?-.18:rt.cart.position.y)-duck*.48+(moving?Math.sin(rt.travel*2+i)*.009:0),shooting?-.72:.30);m.root.rotation.set(duck*.28,shooting||t.whipStart!==null?aim:0,rt.cart.rotation.z*.6);
     // Counterlean keeps the rider's weight over the cart; knees visibly bend under cover.
     if(m.bones.Spine)m.bones.Spine.rotation.x+=duck*.35;
     for(const side of['Left','Right']){if(m.bones[side+'UpLeg'])m.bones[side+'UpLeg'].rotation.x-=duck*.9;if(m.bones[side+'Leg'])m.bones[side+'Leg'].rotation.x+=duck*1.7;}
     m.javelin.visible=shooting&&draw>.18&&duck<.2;m.whip.visible=!m.javelin.visible&&duck<.2;
     if(shooting){let hand=[-.30,1.03,.17];
      if(draw>0&&draw<.3){const pos=baskets[i].getWorldPosition(new T.Vector3());pos.y+=.85;hand=m.root.worldToLocal(pos).toArray();}
      else if(draw>=.3){const f=Math.min(1,(draw-.3)/.7);hand=[-.32,1.58+.06*f,-.32-.23*f];}
      else if(releasing){hand=[-.25,1.43,.72];}
      reach(m,'Right',hand);reach(m,'Left',[.30,1.04,.30]);
     }else{reach(m,'Left',[.23,1-duck*.12,.50]);reach(m,'Right',[-.23,t.whipStart!==null?1.55:1.02,t.whipStart!==null?-.32:.5]);}
     m.root.updateMatrixWorld(true);const hand=m.root.worldToLocal(m.bones.RightHand.getWorldPosition(new T.Vector3()));m.javelin.position.copy(hand);m.javelin.rotation.set(draw<.3?-Math.PI/2:-(t.shotPitch||0),0,0);m.whip.position.copy(hand);
     if(g.hp<=0){m.javelin.visible=m.whip.visible=false;m.root.rotation.z=fall*1.5;if(g.pullFrom){const from=rt.group.worldToLocal(new T.Vector3(g.pullFrom.x,.73,g.pullFrom.z)).sub(m.root.position);from.y=0;from.normalize();m.root.position.addScaledVector(from,fall*1.8);m.root.rotation.x=from.z*fall*1.4;m.root.rotation.z=-from.x*fall*1.4;}else m.root.position.x-=fall*1.8;m.root.position.y-=fall*.8;}
     rt.horses.forEach((h,k)=>{if(!shooting&&g.hp>0)h.hand=m.bones[(k?'Right':'Left')+'Hand'];});
    }
    baskets[i].userData.stored[0].visible=!t.drawUntil||s.time<t.drawUntil-.68;
    const lash=lashes[i],effect=t.whip;lash.visible=!!effect&&s.time<effect.until;
    if(lash.visible){const a=lash.geometry.attributes.position,decay=(effect.until-s.time)/.45;for(let k=0;k<20;k++){const f=k/19;a.setXYZ(k,effect.start.x+(effect.end.x-effect.start.x)*f,effect.start.y+(effect.end.y-effect.start.y)*f-Math.sin(f*Math.PI)*.2*(1-decay),effect.start.z+(effect.end.z-effect.start.z)*f);}a.needsUpdate=true;}
    rt.wheels.forEach((w,k)=>{const damaged=t.wheels[k]>0;w.rotation.z=damaged?(t.broken?.38:Math.sin(s.time*12)*.07):0;});if(t.broken){rt.cart.rotation.z=.16;rt.cart.position.y=-.18;}
   }
   const live=new Set(s.arrows.map(a=>a.id));for(const [id,o]of shafts)if(!live.has(id)){o.removeFromParent();shafts.delete(id);}for(const a of s.arrows){let o=shafts.get(a.id);if(!o){o=new T.Group();o.add(new T.Mesh(shaftGeo,wood),new T.Mesh(tipGeo,iron));extras.add(o);shafts.set(a.id,o);}o.position.set(a.x,a.y,a.z);o.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(a.vx,a.vy,a.vz).normalize());}
   const own=s.teams[3],q=CircusWarCore.aim(s);line.visible=!s.done&&s.role===own.archer&&own.archer>=0&&own.crew[s.role].duck<.2;const a=line.geometry.attributes.position;for(let k=0;k<73;k++){const p=q.points[Math.min(k,q.points.length-1)];a.setXYZ(k,p.x,p.y,p.z);}a.needsUpdate=true;line.geometry.setDrawRange(0,q.points.length);line.material.color.setHex(q.hit?.team!==undefined?0x6ed791:0xe6c766);
   const p=race.teams[3].group.position,cp=CircusWarCore.course(100+own.distance,own.lane),archer=s.role===own.archer,aiming=archer||s.lock||own.whipStart!==null,yaw=cp.yaw+own.heading+(aiming?s.aimYaw:0),dir=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));const center=new T.Vector3(p.x,archer?2.35:2.7,p.z),back=(aiming?5.5:7.8)*Math.max(1,Math.min(1.4,1/camera.aspect)),goal=center.clone().addScaledVector(dir,-back),safe=trackCamera(goal.x,goal.z);
   goal.set(safe.x,aiming?3.5:3.65+own.speed*.018,safe.z);goal.y+=Math.max(0,3.2-Math.hypot(goal.x-p.x,goal.z-p.z));
   if(!camera.userData.warReady||dt===0)camera.position.copy(goal);else camera.position.lerp(goal,1-Math.exp(-14*dt));camera.userData.warReady=true;
   const look=center.clone().addScaledVector(dir,aiming?18:12);if(aiming)look.y+=Math.tan(s.aimPitch)*18;camera.lookAt(look);camera.rotateZ(-own.turn*.013*Math.min(1,own.speed/18));const fov=58+Math.min(5,Math.max(0,own.speed-18)*.5);if(Math.abs(camera.fov-fov)>.02){camera.fov+=(fov-camera.fov)*.15;camera.updateProjectionMatrix();}return q;
  }
  return{show,update,crews,extras,baskets,lashes};
 }
 return{create};
})();
