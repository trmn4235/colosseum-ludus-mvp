const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {rigRuntime}=require('./performance-v84.cjs');
test('selected clips have finite seamless curves and ordered speed thresholds',()=>{
 const c={};for(const p of ['arena-locomotion-data-v91.js','arena-locomotion-data-v170.js'])vm.runInNewContext(fs.readFileSync(p,'utf8'),c);
 const {walk,run,idle}=c.ARENA_LOCOMOTION.clips;assert.ok(run.speed>walk.speed*1.5);assert.equal(idle.speed,0);
 for(const clip of [walk,run,idle])for(const [kind,tracks]of Object.entries({directions:clip.directions,rotations:clip.rotations}))for(const samples of Object.values(tracks)){
  assert.deepEqual(samples[0],samples.at(-1));assert.equal(samples.length,49);
  for(let i=0;i<samples.length;i++){assert.ok(samples[i].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...samples[i])-1)<.00001);if(i&&kind==='rotations'){const dot=Math.abs(samples[i].reduce((sum,x,j)=>sum+x*samples[i-1][j],0));assert.ok(2*Math.acos(Math.min(1,dot))<.25,'bounded torso step');}}
 }
});
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+' selected movement, protected combat and stable equipment',async()=>{
 const c=await rigRuntime(page.endsWith('.js')?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;
 for(const type of ['murmillo','retiarius']){
  const m=c.ImportedGladiator.create(170,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];
  Object.assign(f,{x:0,z:0,angle:0,action:'idle',hp:100,reaction:0,passiveEvade:0,move:0});let clock=0,maxFootStep=0,previous=null;
  for(const speed of [0,1.4,4.2,1.4,0]){
   for(let i=0;i<90;i++){
    f.z+=speed/60;f.move=speed?1:0;f.walk+=speed/60;clock+=1/60;c.ImportedGladiator.animate(f,m,clock,1/60);m.root.updateMatrixWorld(true);
    const foot=m.root.worldToLocal(m.bones.LeftFoot.getWorldPosition(new T.Vector3()));if(previous)maxFootStep=Math.max(maxFootStep,foot.distanceTo(previous));previous=foot.clone();
    for(const [name,bone]of m.boneEntries)assert.ok(bone.matrixWorld.elements.every(Number.isFinite),name+' finite');
    assert.ok(foot.y>-.15&&foot.y<1.2,'feet remain near the floor');
   }
   assert.equal(m.locomotionClip,speed===0?'idle':speed<2?'walk':'run');
  }
  assert.ok(maxFootStep<.5,'bounded transition foot displacement: '+maxFootStep);
  for(const action of ['attack','hurt','dodge','down']){Object.assign(f,{action,hp:action==='down'?0:100,attackWeapon:'gladius',attackProfile:c.ArenaMotion.profile('gladius'),duration:.6,timer:.1,reaction:action==='hurt'?.2:0});c.ImportedGladiator.animate(f,m,clock+=1/60,1/60);assert.equal(m.locomotionClip,null,'combat takes priority');}
  c.ImportedGladiator.dispose(m);
 }
});
