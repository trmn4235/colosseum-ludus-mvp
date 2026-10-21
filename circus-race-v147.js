/* Four Panko10 bigae. Presentation follows server race durations; financial state lives in the RPC. */
var CircusRace = (() => {
 'use strict';
 const STRAIGHT=396,RADIUS=35,LENGTH=2*STRAIGHT+2*Math.PI*RADIUS,LAPS=2;
 function course(distance,lane=0){
  let s=((distance%LENGTH)+LENGTH)%LENGTH,r=RADIUS+lane,x,z,tx,tz;
  if(s<STRAIGHT){x=r;z=-198+s;tx=0;tz=1;}
  else if((s-=STRAIGHT)<Math.PI*RADIUS){const a=s/RADIUS;x=r*Math.cos(a);z=198+r*Math.sin(a);tx=-Math.sin(a);tz=Math.cos(a);}
  else if((s-=Math.PI*RADIUS)<STRAIGHT){x=-r;z=198-s;tx=0;tz=-1;}
  else{const a=(s-STRAIGHT)/RADIUS;x=-r*Math.cos(a);z=-198-r*Math.sin(a);tx=Math.sin(a);tz=-Math.cos(a);}
  return {x,z,yaw:Math.atan2(tx,tz)};
 }
 function cloneRig(source){const copy=source.clone(true),map=new Map();const pair=(a,b)=>{map.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));};pair(source,copy);source.traverse(o=>{if(o.isSkinnedMesh){const c=map.get(o);c.skeleton=o.skeleton.clone();c.skeleton.bones=o.skeleton.bones.map(b=>map.get(b));c.bindMatrix.copy(o.bindMatrix);c.bindMatrixInverse.copy(o.bindMatrixInverse);c.frustumCulled=false;}});return copy;}
 async function create(T,scene){
  const paths=['assets/circus-v146/chariot.glb','assets/caravan-field-v125/horse.glb','assets/caravan-v128/driver.glb'];
  const models=await Promise.all(paths.map(async p=>{const r=await fetch(p,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Yarış modeli yüklenemedi.');return new T.GLTFLoader().parseAsync(await r.arrayBuffer(),'');}));
  const root=new T.Group();root.name='Biga race · panko10';scene.add(root);root.visible=false;
  const light=new T.DirectionalLight(0xffebd2,1);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-19,right:19,top:19,bottom:-19,near:1,far:100});light.shadow.camera.updateProjectionMatrix();light.shadow.bias=-.0002;light.shadow.normalBias=.025;light.visible=false;scene.add(light,light.target);
  const colors=[0x762638,0x254b72,0x3b634b,0xb28a35],teams=[],mats=new Map();
  function surface(original,team){
   const key=original.name+team;if(mats.has(key))return mats.get(key);
   const m=original.clone();if(m.name==='TeamLeather')m.color.setHex(colors[team]);m.envMapIntensity=.65;
   m.onBeforeCompile=s=>{s.vertexShader='varying vec3 raceSurface;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nraceSurface=position;');s.fragmentShader='varying vec3 raceSurface;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float grain=sin(raceSurface.y*${m.name==='Wood'?'410.0':'160.0'}+sin(raceSurface.z*21.0)*3.0+sin(raceSurface.x*17.0));
    float mottling=sin(raceSurface.x*19.0+sin(raceSurface.z*13.0))*sin(raceSurface.y*27.0);
    diffuseColor.rgb*=.91+.06*grain+.055*mottling;`);};m.customProgramCacheKey=()=> 'biga146-'+key;mats.set(key,m);return m;
  }
  function cylinder(a,b,r,material,parent){const d=new T.Vector3(...b).sub(new T.Vector3(...a));const mesh=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),8),material);mesh.position.copy(new T.Vector3(...a).addScaledVector(d,.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());parent.add(mesh);return mesh;}
  const leather=new T.MeshStandardMaterial({color:0x39251a,roughness:.91});
  function normalize(model,height){model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const box=new T.Box3().setFromObject(model,true),c=box.getCenter(new T.Vector3()),scale=height/(box.max.y-box.min.y);const group=new T.Group();group.add(model);model.position.add(new T.Vector3(-c.x,-box.min.y,-c.z));group.scale.setScalar(scale);return group;}
  function pose(model){const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
   function align(name,end,dir){const b=bones[name],e=bones[end];if(!b||!e)return;model.updateMatrixWorld(true);const a=e.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize();const rot=new T.Quaternion().setFromUnitVectors(a,new T.Vector3(...dir).normalize()).multiply(b.getWorldQuaternion(new T.Quaternion()));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rot));}
   for(const side of ['Left','Right']){const sign=side==='Left'?1:-1;align(side+'Arm',side+'ForeArm',[sign*.18,-.75,.5]);align(side+'ForeArm',side+'Hand',[-sign*.1,.1,1]);}return bones;
  }
  for(let i=0;i<4;i++){
   const group=new T.Group();group.name=CircusRoster[i].name;root.add(group);const cart=new T.Group();group.add(cart);const wheels=[];
   const source=models[0].scene;source.updateMatrixWorld(true);
   source.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),m=surface(o.material,i);const mesh=new T.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;
    if(o.name.startsWith('Wheel')){g.computeBoundingBox();const b=g.boundingBox,c=b.getCenter(new T.Vector3());c.y=.559919;c.z=0;g.translate(-c.x,-c.y,-c.z);let pivot=wheels.find(w=>Math.sign(w.position.x)===Math.sign(c.x));if(!pivot){pivot=new T.Group();pivot.position.copy(c);pivot.userData.radius=.56;wheels.push(pivot);cart.add(pivot);}mesh.position.x=c.x-pivot.position.x;pivot.add(mesh);}else cart.add(mesh);
   });
   const driver=cloneRig(models[2].scene),bones=pose(driver);driver.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.castShadow=true;o.receiveShadow=true;if(o.name==='OwnerWhiteTunic')o.material.color.setHex(colors[i]);}});
   const rider=normalize(driver,1.72);rider.position.set(0,.73,-.15);cart.add(rider);
   const horses=[];
   for(let h=0;h<2;h++){
    const animal=cloneRig(models[1].scene),mixer=new T.AnimationMixer(animal),clip=models[1].animations.find(a=>a.name==='canter_loop');if(!clip)throw Error('At koşu animasyonu bulunamadı.');
    const action=mixer.clipAction(clip);action.play();mixer.update(0);
    const horse=normalize(animal,2.12);horse.position.set((h?1:-1)*.75,0,2.05);group.add(horse);action.time=h*.23+i*.17;mixer.update(0);
    animal.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.sourceMaterial=o.material;}});
    // Light harness straps. Reins follow mouth sockets and the driver's hands.
    const hitchX=(h?1:-1)*.75;cylinder([hitchX,.85,1.85],[hitchX,1.06,2.65],.025,leather,group);
    const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0x39251a}));line.frustumCulled=false;group.add(line);
    horses.push({animal,horse,mixer,action,line,mouth:animal.getObjectByName('mouth_socket'),hand:bones[(h?'Right':'Left')+'Hand'],h});
   }
   const team={group,cart,wheels,rider,driver,bones,horses,distance:100,speed:0,travel:0,finished:false,lane:[-10.2,-3.4,3.4,10.2][i],coat:CircusRoster[i].horses[0].coat,rank:i+1};teams.push(team);
  }
  const coatCache=new Map();
  function setCoat(index,id,horseIndex=null){const t=teams[index];if(horseIndex===null)t.coat=LudusHorseAppearance.coat(id).id;t.horses.forEach((h,j)=>{if(horseIndex!==null&&j!==horseIndex)return;h.coat=LudusHorseAppearance.coat(id).id;h.animal.traverse(o=>{if(!o.isMesh)return;const original=o.userData.sourceMaterial,key=original.uuid+h.coat;if(!coatCache.has(key)){const material=LudusHorseAppearance.material(T,original,h.coat);material.metalness=0;material.roughness=.95;coatCache.set(key,material);}o.material=coatCache.get(key);});});}
  let roster=CircusRoster,plans={0:123,1:126,2:129,3:132};
  function configure(cards,durations){roster=cards;plans=durations||plans;teams.forEach((t,i)=>{t.name=cards[i].name;cards[i].horses.forEach((h,j)=>setCoat(i,h.coat,j));});}
  configure(roster);
  // Contact shadows remain tightly bound to each moving vehicle, independent of stadium shadow resolution.
  const cv=document.createElement('canvas');cv.width=cv.height=64;const ctx=cv.getContext('2d'),grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(29,20,13,.34)');grad.addColorStop(1,'rgba(29,20,13,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);const shadowTex=new T.CanvasTexture(cv);
  teams.forEach(t=>{const shadow=new T.Mesh(new T.PlaneGeometry(3.5,6.4),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.045,1.3);t.group.add(shadow);});
  let active=false,paused=false,time=0,countdown=3,winner=null,cameraMode=0;
  function travelled(s,lane){const length=LENGTH,r=RADIUS+lane,rounds=Math.floor(s/length);let d=s-rounds*length,total=rounds*(2*STRAIGHT+2*Math.PI*r);for(const [segment,factor]of [[STRAIGHT,1],[Math.PI*RADIUS,r/RADIUS],[STRAIGHT,1],[Math.PI*RADIUS,r/RADIUS]]){const part=Math.min(d,segment);total+=part*factor;d-=part;if(d<=0)break;}return total;}
  function reset(){time=0;countdown=3;winner=null;paused=false;sync(0,0);}
  function sync(elapsed,dt=0){
   if(!active)return;time=Math.max(0,elapsed);countdown=Math.max(0,3-time);dt=Math.min(.05,Math.max(0,dt));
   for(let i=0;i<teams.length;i++){
    const t=teams[i],duration=Number(plans[i]),fraction=Math.max(0,Math.min(1,(time-3)/duration));
    const progress=fraction-.04*Math.sin(fraction*2*Math.PI)+.002*Math.sin(fraction*Math.PI)*Math.sin((time-3)*.12+i);
    t.distance=100+LENGTH*LAPS*progress;t.finished=fraction>=1;t.speed=fraction>0&&fraction<1?LENGTH*LAPS/duration*(1-.08*Math.PI*Math.cos(fraction*2*Math.PI)):0;
    const p=course(t.distance,t.lane);t.travel=travelled(t.distance,t.lane)-travelled(100,t.lane);t.group.position.set(p.x,.07,p.z);t.group.rotation.y=p.yaw;t.wheels.forEach(w=>w.rotation.x=t.travel/.56);
    t.cart.position.y=Math.sin(time*17+i)*.012*Math.min(1,t.speed/6);t.rider.rotation.x=-.075*Math.min(1,t.speed/8)+Math.sin(time*8+i)*.012;t.group.updateMatrixWorld(true);
    for(const h of t.horses){h.action.timeScale=t.speed/10;h.mixer.update(dt);h.animal.updateMatrixWorld(true);h.animal.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
     const mouth=h.mouth.getWorldPosition(new T.Vector3()),hand=h.hand.getWorldPosition(new T.Vector3());t.group.worldToLocal(mouth);t.group.worldToLocal(hand);const mid=hand.clone().lerp(mouth,.5);mid.y-=.12;const a=h.line.geometry.attributes.position;a.setXYZ(0,hand.x,hand.y,hand.z);a.setXYZ(1,mid.x,mid.y,mid.z);a.setXYZ(2,mouth.x,mouth.y,mouth.z);a.needsUpdate=true;
    }
   }
   const order=teams.map((t,i)=>({t,i})).sort((a,b)=>a.t.finished&&b.t.finished?plans[a.i]-plans[b.i]:b.t.distance-a.t.distance);order.forEach((x,i)=>x.t.rank=i+1);winner=order[0].t.finished?order[0].i:null;
   const center=teams.reduce((v,t)=>v.add(t.group.position),new T.Vector3()).multiplyScalar(.25);light.position.copy(center).add(new T.Vector3(-26,24,18));light.target.position.copy(center);light.shadow.needsUpdate=true;
  }
  function update(dt){if(!paused)sync(time+dt,dt);}
  function follow(camera,own=null){const selected=own===null?teams.find(t=>t.rank===1):teams[own],p=course(selected.distance,selected.lane),origin=new T.Vector3(p.x,0,p.z),rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.yaw);const offsets=[[0,3.2,-6],[-7,4,6],[0,15,-22]],offset=new T.Vector3(...offsets[cameraMode]);camera.position.copy(offset.applyQuaternion(rotation).add(origin));camera.lookAt(new T.Vector3(0,1.2,3).applyQuaternion(rotation).add(origin));}
  return {root,teams,setCoat,configure,sync,update,follow,reset,length:LENGTH,laps:LAPS,get active(){return active;},set active(v){active=v;root.visible=v;light.visible=v;if(v)reset();},get paused(){return paused;},set paused(v){paused=v;},get countdown(){return countdown;},get winner(){return winner;},get done(){return teams.every(t=>t.finished);},get cameraMode(){return cameraMode;},nextCamera(){cameraMode=(cameraMode+1)%3;},get time(){return time;}};
 }
 return {create,course,LENGTH,LAPS,cloneRig};
})();
if(typeof module!=='undefined')module.exports=CircusRace;
