// CPU scene-graph regression: the first pose must not count preceding idle time
// toward a newly observed action's blend. This is not a physical-device FPS test.
const assert=require('node:assert/strict');
const {rigRuntime}=require('./performance-v84.cjs');
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} versus ${b}`);

async function main(){
 const c=await rigRuntime('arena.html',{skipEquipment:true}),T=c.THREE;
 function fixture(){
  const f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
  Object.assign(f,{hp:100,x:0,z:0,angle:0,move:0,weapon:'gladius',offhand:null,shield:false});
  const m=c.ImportedGladiator.create(0,'murmillo');
  for(let n=0;n<20;n++)c.ImportedGladiator.animate(f,m,n/60,1/60);
  return {f,m};
 }
 function attack(f,timer=0){
  Object.assign(f,{action:'attack',timer,chain:1,attackWeapon:'gladius',attackKind:'light',attackProfile:c.ArenaMotion.profile('gladius')});
  f.duration=f.attackProfile.duration;
 }
 let scenarios=0,maxEarlyBodyStep=0;
 for(const dt of [1/120,1/60,1/30,.05,.1,.25])for(const elapsed of [0,.005]){
  const {f,m}=fixture(),body=m.body.position.clone();attack(f,elapsed);
  const unchanged=JSON.stringify(f);c.ImportedGladiator.animate(f,m,1,dt);
  assert.equal(JSON.stringify(f),unchanged,'presentation must not change simulation');
  near(m.authored163.age,Math.min(dt,elapsed),'new attack age excludes preceding idle time');
  const step=Math.abs(m.body.position.y-body.y);maxEarlyBodyStep=Math.max(maxEarlyBodyStep,step);
  assert.ok(step<.002,'a 0–5 ms attack must not instantly crouch through its transition');
  const sample=c.ArenaMotion.sample(f),grip=m.root.worldToLocal(m.weaponAnchor.getWorldPosition(new T.Vector3()));
  assert.ok(grip.distanceTo(new T.Vector3(sample.grip.x,sample.grip.y,sample.grip.z))<.005,'contact grip stays on the authoritative sweep');
  f.timer+=1/60;c.ImportedGladiator.animate(f,m,1+1/60,1/60);
  near(m.authored163.age,Math.min(dt,elapsed)+1/60,'following pose advances the blend normally');
  f.timer=0;c.ImportedGladiator.animate(f,m,1.1,.1);
  near(m.authored163.age,0,'a restarted attack captures a new zero-age transition');
  c.ImportedGladiator.dispose(m);scenarios++;
 }
 {
  const {f,m}=fixture();Object.assign(f,{timer:9,blocking:true});
  c.ImportedGladiator.animate(f,m,1,.1);near(m.authored163.age,0,'guard does not inherit stale idle timer');
  f.guardFlash=.195;c.ImportedGladiator.animate(f,m,1.1,.1);
  near(m.authored163.age,.005,'guard impact uses actual reaction age');
  Object.assign(f,{blocking:false,guardFlash:0,reaction:.318});c.ImportedGladiator.animate(f,m,1.2,.1);
  near(m.authored163.age,.002,'idle damage reaction uses its own remaining duration');
  Object.assign(f,{action:'hurt',timer:9,lastRegion:'head',reaction:.318});c.ImportedGladiator.animate(f,m,1.25,.1);
  near(m.authored163.age,.002,'hurt reaction ignores stale action timer');
  Object.assign(f,{action:'idle',reaction:0,weapon:'spear'});c.ImportedGladiator.animate(f,m,1.3,.1);
  near(m.authored163.age,0,'pole idle starts without inferred elapsed time');
  c.ImportedGladiator.dispose(m);scenarios++;
 }
 {
  const {f,m}=fixture();f.pitWeapon=true;attack(f,.2);c.ImportedGladiator.animate(f,m,1,.1);
  Object.assign(f,{action:'idle',timer:9});c.ImportedGladiator.animate(f,m,1.1,.1);
  assert.equal(m.authored163.exit,true);near(m.authored163.age,0,'pit action exit excludes preceding attack time');
  c.ImportedGladiator.dispose(m);scenarios++;
 }
 {
  const {f,m}=fixture();Object.assign(f,{action:'evade',evadeKind:'jump',duration:.72,timer:0});
  c.ImportedGladiator.animate(f,m,1,.1);near(m.authored163.age,0,'jump start at timer zero');
  for(const [fraction,clip]of [[.16,'jumpAir'],[.79,'jumpLand']]){
   f.timer=f.duration*fraction+.005;const unchanged=JSON.stringify(f),offset=c.ArenaAuthoredCombat.evadeOffset(f);
   c.ImportedGladiator.animate(f,m,1+f.timer,.1);
   assert.equal(m.authoredClip,clip);near(m.authored163.age,.005,'new jump phase uses elapsed since its own boundary');
   assert.equal(JSON.stringify(f),unchanged);near(c.ArenaAuthoredCombat.evadeOffset(f),offset,'jump trajectory unchanged');
   near(m.root.position.x,f.x,'jump root X unchanged');near(m.root.position.z,f.z,'jump root Z unchanged');
  }
  c.ImportedGladiator.dispose(m);scenarios++;
 }
 console.log('PASS V292 authored entry continuity: '+JSON.stringify({scenarios,maxEarlyBodyStep,poseIntervalsMs:[8.33,16.67,33.33,50,100,250],checks:'early/restarted attacks, exact grip, zero-time entry, guards, reactions, pit exit, jump phase boundaries'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
