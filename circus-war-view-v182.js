/* Existing CC0 gladiator rig and CC-BY panko10 cart, adapted for a two-person crew. */
var CircusWarView=(()=>{
 const colors=[0x762638,0x254b72,0x3b634b,0xb28a35];
 function trackCamera(x,z){
  // Project the camera onto the actual track corridor instead of shortening its
  // orbit into the crew. The two end walls have different radii and offsets.
  const turn=Math.PI*35;let d,lane;
  if(z>198){d=396+Math.atan2(z-198,x)*35;lane=Math.hypot(x,z-198)-35;}
  else if(z< -198){d=792+turn+Math.atan2(-z-198,-x)*35;lane=Math.hypot(x,z+198)-35;}
  else{d=x>=0?z+198:396+turn+198-z;lane=Math.abs(x)-35;}
  const limits=CircusPhysics.bounds(d);
  return CircusWarCore.course(d,Math.max(limits[0]+1.2,Math.min(limits[1]-1.2,lane)));
 }
 async function create(T,race,scene){
  const res=await fetch('gladiator-mobile.glb',{signal:AbortSignal.timeout(45000)});if(!res.ok)throw Error('Gladyatör görseli yüklenemedi. Tekrar dene.');const gltf=await new T.GLTFLoader().parseAsync(await res.arrayBuffer(),'');
  gltf.scene.traverse(o=>{if(o.isMesh){const a=gltf.parser.associations.get(o),name=a?.meshes!==undefined?gltf.parser.json.meshes[a.meshes]?.name:'';if(/^(weapon|shield|helmet)_geo/.test(name||''))o.visible=false;}});
  const extras=new T.Group();extras.name='Savaş arabası okları';scene.add(extras);extras.visible=false;
  const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0xe6c766,transparent:true,opacity:.4,depthWrite:false}));line.frustumCulled=false;extras.add(line);
  const shafts=new Map(),shaftGeo=new T.CylinderGeometry(.012,.012,.8,6),tipGeo=new T.ConeGeometry(.035,.14,4),wood=new T.MeshStandardMaterial({color:0x9c7040,roughness:.85}),iron=new T.MeshStandardMaterial({color:0x9d9c91,metalness:.65,roughness:.4});shaftGeo.rotateX(Math.PI/2);tipGeo.rotateX(Math.PI/2);tipGeo.translate(0,0,.46);
  const crews=[],quaternion=new T.Quaternion();
  function align(model,boneName,endName,target){const b=model.bones[boneName],e=model.bones[endName];if(!b||!e)return;model.root.updateMatrixWorld(true);const origin=b.getWorldPosition(new T.Vector3()),a=e.getWorldPosition(new T.Vector3()).sub(origin).normalize(),v=model.root.localToWorld(new T.Vector3(...target)).sub(origin).normalize();const rot=new T.Quaternion().setFromUnitVectors(a,v).multiply(b.getWorldQuaternion(new T.Quaternion()));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rot));}
  function reach(m,side,target){const upper=m.bones[side+'Arm'],lower=m.bones[side+'ForeArm'],hand=m.bones[side+'Hand'];m.root.updateMatrixWorld(true);const p=upper.getWorldPosition(new T.Vector3()),e=lower.getWorldPosition(new T.Vector3()),h=hand.getWorldPosition(new T.Vector3()),goal=m.root.localToWorld(new T.Vector3(...target)),a=p.distanceTo(e),b=e.distanceTo(h),dir=goal.sub(p),d=Math.max(Math.abs(a-b)+.003,Math.min(a+b-.003,dir.length()));dir.normalize();const pole=new T.Vector3(side==='Left'?.7:-.7,-.6,-.2).applyQuaternion(m.root.getWorldQuaternion(new T.Quaternion()));pole.addScaledVector(dir,-pole.dot(dir)).normalize();const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),elbow=p.clone().addScaledVector(dir,along).addScaledVector(pole,height),wrist=p.clone().addScaledVector(dir,d);align(m,side+'Arm',side+'ForeArm',m.root.worldToLocal(elbow).toArray());align(m,side+'ForeArm',side+'Hand',m.root.worldToLocal(wrist).toArray());}
  function bow(){const root=new T.Group(),points=[];for(let k=0;k<=24;k++){const y=-.58+k/24*1.16;points.push(new T.Vector3(0,y,-.15*(y/.58)**2));}const limb=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.023,6,false),wood);limb.castShadow=true;root.add(limb);const string=new T.Line(new T.BufferGeometry().setFromPoints([points[0],new T.Vector3(),points.at(-1)]),new T.LineBasicMaterial({color:0xede0ba}));root.add(string);root.userData.string=string;return root;}
  for(let i=0;i<4;i++){
   const pair=[];for(let j=0;j<2;j++){
    const visual=CircusRace.cloneRig(gltf.scene),root=new T.Group(),facing=new T.Group();root.add(facing);facing.add(visual);const bones={},rest={};visual.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'').replace(/_\d+$/,'')]=o;});root.updateMatrixWorld(true);const forward=new T.Vector3(0,0,1).applyQuaternion(bones.Hips.getWorldQuaternion(new T.Quaternion()));facing.rotation.y=-Math.atan2(forward.x,forward.z);root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(visual),scale=1.74/(box.max.y-box.min.y);facing.scale.setScalar(scale);facing.position.y=-box.min.y*scale;
    for(const [name,b]of Object.entries(bones))rest[name]=b.quaternion.clone();visual.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    const weapon=bow();root.add(weapon);weapon.position.set(.24,1.34,.48);const actor={root,visual,facing,bones,rest,bow:weapon};root.visible=false;race.teams[i].group.add(root);pair.push(actor);
   }crews.push(pair);
  }
  function show(value){extras.visible=value;race.teams.forEach((t,i)=>{t.rider.visible=!value;t.cart.scale.set(value?1.18:1,1,value?1.6:1);t.wheels.forEach(w=>{w.userData.warRest=w.userData.warRest||w.position.clone();const parent=value?t.group:t.cart;if(w.parent!==parent){parent.add(w);w.position.copy(w.userData.warRest);w.position.x*=value?1.18:1;w.scale.setScalar(1);}});crews[i].forEach(m=>m.root.visible=value);if(!value)t.horses.forEach((h,k)=>h.hand=t.bones[(k?'Right':'Left')+'Hand']);});if(!value)race.setExternal(null);}
  function update(s,dt,camera){show(true);race.setExternal(s);race.sync(s.time,dt);
   for(let i=0;i<4;i++){const t=s.teams[i],rt=race.teams[i];for(let j=0;j<2;j++){const m=crews[i][j],g=t.crew[j];const fall=g.hp<=0?Math.min(1,(s.time-(g.downAt??s.time))/.8):0;m.root.visible=(g.hp>0||fall<1)&&!t.eliminated;m.root.userData.gladiatorId=g.id;m.root.name=g.name;if(!m.root.visible)continue;for(const [name,q]of Object.entries(m.rest))m.bones[name].quaternion.copy(q);const shooting=j===t.archer,moving=t.speed>1;const draw=t.drawUntil?Math.max(0,Math.min(1,1-(t.drawUntil-s.time)/.55)):0;
     m.root.position.set(0,.73+(moving?Math.sin(s.time*17+i)*.009:0),shooting?-.72:.30);m.root.rotation.set(0,shooting?(i===3&&s.role===t.archer?s.aimYaw:t.shotYaw-rt.group.rotation.y):0,0);m.bow.visible=shooting;
     if(shooting){reach(m,'Left',[.25,1.34,.52]);reach(m,'Right',[.06,1.33,.43-.34*draw]);m.root.updateMatrixWorld(true);m.bow.position.copy(m.root.worldToLocal(m.bones.LeftHand.getWorldPosition(new T.Vector3())));const a=m.bow.userData.string.geometry.attributes.position;a.setXYZ(1,0,0,-.34*draw);a.needsUpdate=true;}
     else{reach(m,'Left',[.23,.98,.50]);reach(m,'Right',[-.23,.98,.50]);}
     if(g.hp<=0){m.bow.visible=false;m.root.rotation.z=fall*1.35;m.root.position.y-=fall*.85;}
     rt.horses.forEach((h,k)=>{if(!shooting&&g.hp>0)h.hand=m.bones[(k?'Right':'Left')+'Hand'];});
    }
   }
   const live=new Set(s.arrows.map(a=>a.id));for(const [id,o]of shafts)if(!live.has(id)){o.removeFromParent();shafts.delete(id);}for(const a of s.arrows){let o=shafts.get(a.id);if(!o){o=new T.Group();o.add(new T.Mesh(shaftGeo,wood),new T.Mesh(tipGeo,iron));extras.add(o);shafts.set(a.id,o);}o.position.set(a.x,a.y,a.z);o.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(a.vx,a.vy,a.vz).normalize());}
   const own=s.teams[3],q=CircusWarCore.aim(s);line.visible=!s.done&&s.role===own.archer&&own.archer>=0;const a=line.geometry.attributes.position;a.setXYZ(0,q.start.x,q.start.y,q.start.z);a.setXYZ(1,q.end.x,q.end.y,q.end.z);a.needsUpdate=true;line.material.color.setHex(q.hit?.team!==undefined?0x6ed791:0xe6c766);
   const p=CircusWarCore.course(100+own.distance,own.lane),archer=s.role===own.archer,yaw=p.yaw+own.heading+(archer?s.aimYaw:0),dir=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));const center=new T.Vector3(p.x,archer?2.45:2.9,p.z),back=(archer?4.4:7.8)*Math.max(1,Math.min(1.5,1/camera.aspect)),goal=center.clone().addScaledVector(dir,-back),safe=trackCamera(goal.x,goal.z);
   goal.set(safe.x,archer?3.1:4.2,safe.z);const clearance=Math.hypot(goal.x-p.x,goal.z-p.z);goal.y+=Math.max(0,3.2-clearance);camera.position.copy(goal);const look=center.clone().addScaledVector(dir,archer?18:12);if(archer)look.y+=Math.tan(s.aimPitch)*18;camera.lookAt(look);return q;
  }
  return{show,update,crews,extras};
 }
 return{create};
})();
