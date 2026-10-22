const fs=require('node:fs');
module.exports=async(page,out)=>{
 const result=await page.evaluate(()=>{
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const T=THREE,a=__arena,scene=new T.Scene();scene.background=new T.Color('#aab9c3');
  scene.add(new T.HemisphereLight(0xfff6e8,0x6b7380,2.2));const sun=new T.DirectionalLight(0xfff4e4,3);sun.position.set(-3,6,5);scene.add(sun);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:20});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;
  const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:0xc2af90,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.05,30);camera.position.set(1.3,2.3,3.8);camera.lookAt(0,1.2,0);
  const sim=new ArenaCombat(()=>.999).reset('normal','murmillo'),fighters=sim.fighters.slice(0,2),models=fighters.map((f,i)=>{
   Object.assign(f,{x:i? .85:-.85,z:0,angle:0,hp:100,chest:true,helmet:true,shoulders:true,shield:false,weapon:'gladius',helmetModel:i?'roman':'gladiator',chestModel:i?'chest_plate':'gladiator_chest',shoulderModel:i?'shoulder_armor':'armor_shoulder',motionVersion:163,action:'idle',move:0});
   const m=ImportedGladiator.create(40+i,'murmillo');scene.add(m.root);return m;
  });let clock=0,frames=0;const shots=[],meshes=[];
  const draw=()=>{clock+=1/60;for(let i=0;i<2;i++)ImportedGladiator.animate(fighters[i],models[i],clock,1/60);a.renderer.render(scene,camera);};
  draw();
  for(const m of models)for(const slot of ['helmet','chest','shoulder','otherShoulder'])m.gear[slot].group.traverse(o=>{if(o.isMesh){meshes.push(o);o.onAfterRender=()=>{o.userData.drawn164=true;};}});
  for(const pose of ['idle','walk','attack','guard','duck','jump','roll']){
   for(const f of fighters){Object.assign(f,{action:'idle',timer:0,blocking:false,move:0,walk:0,reaction:0});
    if(pose==='walk'){f.move=1;f.walk=1.2;}
    if(pose==='attack'){f.action='attack';f.attackWeapon='gladius';f.attackRegion='chest';f.attackKind='light';f.attackLeft=false;f.attackProfile=ArenaMotion.profile('gladius');f.duration=f.attackProfile.duration;f.timer=f.duration*.5;}
    if(pose==='guard')f.blocking=true;
    if(['duck','jump','roll'].includes(pose)){f.action=pose==='roll'?'dodge':'evade';f.evadeKind=pose;f.duration=pose==='duck'?.65:pose==='jump'?.72:.46;f.timer=f.duration*.45;}
   }
   for(let n=0;n<25;n++){
    for(const f of fighters){if(f.action!=='idle')f.timer=(n/24)*f.duration;if(pose==='walk')f.walk=n/9;}
    for(const mesh of meshes)mesh.userData.drawn164=false;
    draw();frames++;
    for(const mesh of meshes){check(mesh.userData.drawn164,'Equipment disappeared during '+pose);check(mesh.material.depthTest&&mesh.material.depthWrite&&!mesh.material.transparent,'Equipment depth changed');}
   }
   for(const f of fighters)if(f.action!=='idle')f.timer=f.duration*.45;
   for(let n=0;n<12;n++)draw();
   shots.push({name:pose,data:a.renderer.domElement.toDataURL('image/png').split(',')[1]});
  }
  for(const f of fighters)Object.assign(f,{action:'idle',timer:0,move:0,blocking:false});
  camera.position.set(1.3,2.3,-3.8);camera.lookAt(0,1.2,0);for(let n=0;n<25;n++)draw();
  shots.push({name:'back',data:a.renderer.domElement.toDataURL('image/png').split(',')[1]});
  models.forEach(m=>ImportedGladiator.dispose(m));floor.geometry.dispose();floor.material.dispose();sun.shadow.dispose();a.renderer.render(a.scene,a.camera);return {shots,frames,meshes:meshes.length};
 });
 for(const shot of result.shots)fs.writeFileSync(out+'/gear164-'+shot.name+'.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({equipmentPoses:result.shots.map(x=>x.name),equipmentFrames:result.frames,drawnEquipment:result.meshes}));
};
