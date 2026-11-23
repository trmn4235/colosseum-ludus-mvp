// Real rig comparison: removing a temporary arm swing must preserve the final
// pose, skin, equipment and simulation through irregular rendering intervals.
const assert=require('node:assert/strict');
const {rigRuntime}=require('./performance-v84.cjs');

async function main(){
 const c=await rigRuntime(),T=c.THREE,apply=c.ArenaLocomotion.apply;
 const reference=new WeakSet(),calls=new WeakMap();
 c.ArenaLocomotion.apply=function(f,m,dt,align,time){
  const hand=m.bones.RightHand,anatomy=hand.userData.anatomy166;
  // During locomotion only, the legacy path retains the unarmed arm swing.
  // Restore the flag before the real grip/skin/attachment pipeline runs.
  if(reference.has(m))hand.userData.anatomy166=false;
  try{return apply(f,m,dt,(bone,end,target)=>{
   if(bone===m.bones.RightArm||bone===m.bones.RightForeArm||bone===m.bones.LeftArm||bone===m.bones.LeftForeArm)calls.set(m,(calls.get(m)||0)+1);
   return align(bone,end,target);
  },time);}finally{hand.userData.anatomy166=anatomy;}
 };
 const report={scenarios:0,frames:0,maxMatrixDifference:0,maxSkinDifference:0,removedArmSolves:0};
 const a=new T.Vector3(),b=new T.Vector3(),intervals=[1/120,1/60,1/30,1/60,.05,1/120];
 for(const config of [
  {weapon:'gladius',shield:true},{weapon:'sica',shield:true},
  {weapon:'spear',shield:true},{weapon:'trident',offhand:'gladius'},
  {weapon:'halberd',offhand:'sica'},{weapon:'mace',shield:true},
  {weapon:'gladius',archer:true},{weapon:'spear',navJump:{kind:'jump',airborne:true}},
  {weapon:null,shield:true},{weapon:'gladius',pitWeapon:'gladius'}
 ]){
  const optimized=c.ImportedGladiator.create(292,'murmillo'),legacy=c.ImportedGladiator.create(292,'murmillo');reference.add(legacy);
  const f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
  Object.assign(f,{x:0,z:0,angle:0,hp:100,motionVersion:163,weapon:null,offhand:null,shield:false,chest:true,helmet:true,action:'idle',move:1,blocking:false,reaction:0,guardFlash:0,passiveEvade:0,timer:0,...config});
  let time=0,attackTime=0;
  for(let frame=0;frame<220;frame++){
   const dt=intervals[frame%intervals.length];time+=dt;
   const attacking=frame>=160&&frame<180;
   f.action=attacking?'attack':'idle';f.move=attacking?0:1;f.blocking=frame>=140&&frame<160;
   f.angle=Math.sin(time*.7)*.9;
   if(attacking){f.attackWeapon=config.weapon||'gladius';f.attackProfile=c.ArenaMotion.profile(f.attackWeapon);f.duration=f.attackProfile.duration;f.attackKind='light';f.attackRegion='chest';f.attackLeft=false;f.timer=attackTime;attackTime+=dt;}
   else f.timer=0;
   const speed=attacking?0:frame<40?1.6:frame<100?5:2,heading=f.angle+(frame>=100&&frame<140?Math.PI:0);
   f.x+=Math.sin(heading)*speed*dt;f.z+=Math.cos(heading)*speed*dt;f.walk+=9*f.move*dt;
   const state=JSON.stringify(f);
   c.ImportedGladiator.animate(f,optimized,time,dt);c.ImportedGladiator.animate(f,legacy,time,dt);
   assert.equal(JSON.stringify(f),state,'Rendering does not change combat state');
   for(const [name,bone]of optimized.boneEntries){
    const expected=legacy.bones[name].matrixWorld.elements;
    for(const [i,value]of bone.matrixWorld.elements.entries()){
     assert.ok(Number.isFinite(value));const error=Math.abs(value-expected[i]);
     report.maxMatrixDifference=Math.max(report.maxMatrixDifference,error);
     assert.ok(error<1e-6,JSON.stringify({config,frame,name,error}));
    }
   }
   for(const key of ['weaponAnchor','offhandAnchor'])for(const [i,value]of optimized[key].matrixWorld.elements.entries())assert.ok(Math.abs(value-legacy[key].matrixWorld.elements[i])<1e-6,'Equipment transform stays exact');
   if(frame%20===0){
    const skin=optimized.equipmentFit164.body,other=legacy.equipmentFit164.body;
    for(let i=0;i<skin.geometry.attributes.position.count;i+=503){
     skin.getVertexPosition(i,a).applyMatrix4(skin.matrixWorld);other.getVertexPosition(i,b).applyMatrix4(other.matrixWorld);
     const error=a.distanceTo(b);report.maxSkinDifference=Math.max(report.maxSkinDifference,error);assert.ok(error<1e-6,'Visible skin stays exact');
    }
   }
   report.frames++;
  }
  const removed=(calls.get(legacy)||0)-(calls.get(optimized)||0);
  if(config.weapon&&!config.archer&&!config.navJump)assert.ok(removed>200,'Weapon arm avoids redundant locomotion solves');
  else assert.equal(removed,0,'Free, archer and naval arms retain their original locomotion');
  report.removedArmSolves+=removed;report.scenarios++;
  c.ImportedGladiator.dispose(optimized);c.ImportedGladiator.dispose(legacy);
 }
 assert.ok(report.removedArmSolves>2000);
 console.log('PASS V292 locomotion grip budget: '+JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
