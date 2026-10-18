const fs=require('node:fs'),assert=require('node:assert/strict');
module.exports=async function(page,out){
 const result=await page.evaluate(()=>{
  const T=THREE,a=__arena,scene=new T.Scene();scene.background=new T.Color('#c9d8dd');
  scene.add(new T.HemisphereLight(0xfff6e3,0x625b4a,2));const sun=new T.DirectionalLight(0xffefcf,2.5);sun.position.set(-3,7,4);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0xc9b38d,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.1,30);camera.position.set(3.3,2.4,3.2);camera.lookAt(0,1.1,.5);
  const sim=new ArenaCombat(()=>.999).reset('normal','murmillo'),p=sim.fighters[0],v=sim.fighters[5];for(const f of sim.fighters)f.hp=0;
  Object.assign(p,{hp:100,x:0,z:0,angle:0,weapon:'gladius',shield:true,shieldHeldBy:null,cooldown:0,agility:50,itemStats:{}});
  Object.assign(v,{hp:100,x:0,z:1.25,angle:Math.PI,weapon:'gladius',shield:true,shieldHeldBy:null,cooldown:999,agility:50,itemStats:{}});
  const models=[ImportedGladiator.create(200,'murmillo'),ImportedGladiator.create(201,'secutor')];models.forEach(m=>scene.add(m.root));
  let clock=0;const shots=[],render=()=>{clock+=1/60;ImportedGladiator.animate(p,models[0],clock,1/60);ImportedGladiator.animate(v,models[1],clock,1/60);a.renderer.render(scene,camera);};
  for(let n=0;n<25;n++)render();sim.attack(0);const profile=p.attackProfile;
  for(const [name,time]of [['prepare',profile.wind*.8],['contact',profile.wind+profile.active*.48],['recover',profile.wind+profile.active+profile.recover*.5]]){
   while(p.timer<time){p.timer=Math.min(time,p.timer+1/60);render();}
   shots.push({name:'gladius-'+name,data:a.renderer.domElement.toDataURL('image/png').split(',')[1]});
  }
  p.timer=profile.wind+profile.active*.4;sim.prepareGuard(v,true);sim.guard(p,v,false,ArenaMotion.world(v,{x:.50,y:1.58,z:.29}));v.guardFlash=.1;
  for(let n=0;n<8;n++)render();shots.push({name:'gladius-shield',data:a.renderer.domElement.toDataURL('image/png').split(',')[1]});
  const response=ArenaMotion.shieldResponse(v),blocked=p.action,shieldQ=models[1].gear.shield.anchor.getWorldQuaternion(new T.Quaternion()),expected=models[1].root.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler(response.pitch,response.yaw,response.roll)));
  const shieldAngle=shieldQ.angleTo(expected),shieldBounds=new T.Box3().setFromObject(models[1].gear.shield.group).getSize(new T.Vector3()).toArray();
  v.blocking=false;v.guardFlash=0;sim.damage(p,v,20,'chest');v.reaction=.25;
  for(let n=0;n<8;n++)render();shots.push({name:'gladius-reaction',data:a.renderer.domElement.toDataURL('image/png').split(',')[1]});
  for(const m of models){scene.remove(m.root);ImportedGladiator.dispose(m);}floor.geometry.dispose();floor.material.dispose();a.renderer.render(a.scene,a.camera);
  return{shots,blocked,response,shieldAngle,shieldBounds};
 });
 assert.equal(result.blocked,'recoil');assert.ok(result.response.z<0&&result.response.yaw>0);assert.ok(result.shieldAngle<.02,JSON.stringify({shieldAngle:result.shieldAngle,shieldBounds:result.shieldBounds}));
 for(const shot of result.shots)fs.writeFileSync(out+'/'+shot.name+'.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({combatVisuals:result.shots.map(s=>s.name),blocked:result.blocked,shieldAngle:result.shieldAngle,shieldBounds:result.shieldBounds}));
};
