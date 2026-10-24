const fs=require('node:fs'),assert=require('node:assert/strict');
module.exports=async page=>{
 const result=await page.evaluate(()=>{
  const T=THREE,a=__pitTest,scene=new T.Scene();scene.background=new T.Color('#c9d8dd');scene.add(new T.HemisphereLight(0xfff6e3,0x625b4a,2));const sun=new T.DirectionalLight(0xffefcf,2.5);sun.position.set(-3,7,4);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0xc9b38d,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);const camera=new T.PerspectiveCamera(36,innerWidth/innerHeight,.1,30);camera.position.set(3.1,2.4,3.7);camera.lookAt(0,1,0);
  const sim=new ArenaCombat(()=>.999).reset('normal','secutor','pit');sim.botStep=()=>{};for(const f of sim.fighters)f.hp=0;
  const f=sim.fighters[0],m=ImportedGladiator.create(30,'secutor');scene.add(m.root);Object.assign(f,{hp:100,x:0,z:0,angle:0,shield:false,cooldown:0,pitAttackRate:1.2});let clock=0,finite=true,maxExitAngle=0;
  const render=()=>{clock+=1/120;ImportedGladiator.animate(f,m,clock,1/120);for(const [,bone]of m.boneEntries)finite=finite&&bone.matrixWorld.elements.every(Number.isFinite);};
  const shots=[];
  for(const weapon of ['pit_stone_mace','pit_wood_mace'])for(const chain of [1,2,3]){
   PitArena.equip(f,{pit_model:weapon});Object.assign(f,{action:'idle',cooldown:0,stamina:100,chain:chain-1,comboUntil:sim.time+10,reaction:0,attackRegion:'chest'});for(let n=0;n<24;n++)render();
   sim.attack(0,chain===3,'chest');f.chain=chain;
   const contact=f.attackProfile.wind+f.attackProfile.active*.48;
   for(let n=0;n<Math.ceil(contact*120);n++){f.timer=Math.min(contact,n/120);render();}
   a.renderer.render(scene,camera);shots.push({name:weapon+'-'+chain,clip:m.authored163Clip,data:a.renderer.domElement.toDataURL('image/png').split(',')[1]});
   for(let n=Math.ceil(contact*120);n<=Math.ceil(f.duration*120);n++){f.timer=Math.min(f.duration,n/120);render();}
   const before=m.bones.RightArm.quaternion.clone();f.action='idle';f.timer=0;render();maxExitAngle=Math.max(maxExitAngle,before.angleTo(m.bones.RightArm.quaternion));
  }
  scene.remove(m.root);ImportedGladiator.dispose(m);floor.geometry.dispose();floor.material.dispose();a.renderer.render(a.scene,a.camera);return{finite,maxExitAngle,shots};
 });
 for(const shot of result.shots)fs.writeFileSync('/tmp/v177-'+shot.name+'.png',Buffer.from(shot.data,'base64'));
 assert.ok(result.finite,'all animated bones stay finite');assert.ok(result.maxExitAngle<.35,'first idle frame must blend out rather than snap: '+result.maxExitAngle);
 for(const weapon of ['pit_stone_mace','pit_wood_mace'])assert.deepEqual(result.shots.filter(s=>s.name.startsWith(weapon)).map(s=>s.clip),['Sword_Regular_A','Sword_Regular_B','Melee_1H_Attack_Chop']);
 console.log({pitAuthoredMotion:{finite:result.finite,maxExitAngle:result.maxExitAngle,clips:result.shots.map(s=>s.clip)}});
};
