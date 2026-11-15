const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {fixture}=require('./naval-fixture.cjs');
const {rigRuntime}=require('./performance-v84.cjs');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function runtime(){const c=fixture().context;for(const name of ['combat-curves-v163.js','combat-motion-v163.js'])vm.runInContext(fs.readFileSync(name,'utf8'),c);c.ArenaAuthoredCombat.install(c.ArenaCombat,c.ArenaMotion);return c;}
(async()=>{
 const c=runtime(),M=c.ArenaMotion;let trajectories=0,contacts=0;
 for(const left of [false,true])for(const chain of [1,2,3])for(const heavy of [false,true])for(const region of ['head','chest','legs']){
  const p=M.profile('halberd',heavy),f={id:0,hp:100,x:0,z:0,angle:0,weapon:'halberd',offhand:left?'halberd':null,attackWeapon:'halberd',motionVersion:163,attackProfile:p,action:'attack',timer:0,attackLeft:left,chain,attackKind:heavy?'heavy':'light',attackRegion:region};
  assert.equal(c.ArenaAuthoredCombat.clipName(f),heavy||chain===3?'chop':chain===2?'swordB':'swordA');
  assert.equal(p.length,1.7);assert.deepEqual([p.wind,p.active,p.recover],heavy?[.486,.24,.624]:[.36,.24,.52]);
  const start=M.sample(f,0),end=M.sample(f,p.duration);assert.ok(distance(start.grip,end.grip)<1e-9);assert.ok(distance(start.dir,end.dir)<1e-9);
  const sweep=[];for(let n=0;n<=120;n++){const s=M.sample(f,p.wind+p.active*n/120);assert.ok(Math.abs(distance(s.grip,s.tip)-1.7)<1e-9);assert.ok(Object.values(s.dir).every(Number.isFinite));sweep.push(s);}
  if(chain<3&&!heavy){assert.ok(Math.max(...sweep.map(s=>s.tip.x))-Math.min(...sweep.map(s=>s.tip.x))>2,'a broad lateral blade sweep');const direction=left?-1:1;assert.ok((sweep.at(-1).tip.x-sweep[0].tip.x)*direction*(chain===2?-1:1)>2);}
  for(const boundary of [p.wind,p.wind+p.active,p.duration])assert.ok(distance(M.sample(f,boundary-1e-6).tip,M.sample(f,boundary+1e-6).tip)<.001);
  const v={x:0,z:1.65,angle:Math.PI,motionVersion:163,action:'idle'};let hit=false;
  for(let n=1;n<=120;n++)hit ||= M.contact(f,v,p.wind+p.active*(n-1)/120,p.wind+p.active*n/120);
  assert.ok(hit,JSON.stringify({left,chain,heavy,region}));contacts++;trajectories++;
 }
 for(const kind of ['spear','trident','trident_gladiator'])assert.equal(c.ArenaAuthoredCombat.clipName({weapon:kind,chain:1}),'pole');
 for(const path of ['supabase/functions/caravan-combat-v126/','supabase/functions/caravan-defense-v230/','supabase/functions/bot-runner-v233/'])assert.equal(fs.readFileSync(path+'combat-motion-v163.js','utf8'),fs.readFileSync('combat-motion-v163.js','utf8'));
 // Training has its own runtime; it must also swing without shortening the shaft.
 const training=vm.createContext({});vm.runInContext(fs.readFileSync('training-motion-v50.js','utf8'),training);const tm=training.ArenaMotion,tp=tm.profile('halberd');assert.equal(tp.pole,false);assert.equal(tp.length,1.7);
 const tf={weapon:'halberd',attackWeapon:'halberd',attackProfile:tp,attackRegion:'chest',chain:1};assert.ok(tm.sample(tf,tp.wind+tp.active).tip.x-tm.sample(tf,tp.wind).tip.x>2);
 // Real skeleton: both hands, both lateral cuts and the overhead finisher.
 const rig=await rigRuntime(),T=rig.THREE;let samples=0,maxError=0;
 for(const left of [false,true])for(const chain of [1,2,3]){
  const f=new rig.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0],m=rig.ImportedGladiator.create(0,'murmillo');
  Object.assign(f,{hp:100,x:0,z:0,angle:0,weapon:'halberd',offhand:left?'halberd':null,shield:false,move:0,action:'idle',chain});
  for(let n=0;n<10;n++)rig.ImportedGladiator.animate(f,m,n/60,1/60);
  Object.assign(f,{action:'attack',attackWeapon:'halberd',attackLeft:left,attackKind:'light',attackRegion:'chest',attackProfile:rig.ArenaMotion.profile('halberd')});f.duration=f.attackProfile.duration;
  for(let n=0;n<=Math.ceil(f.duration*60);n++){
   f.timer=Math.min(f.duration,n/60);rig.ImportedGladiator.animate(f,m,1+n/60,1/60);const s=rig.ArenaMotion.sample(f),anchor=left?m.offhandAnchor:m.weaponAnchor,tip=m.root.worldToLocal(anchor.localToWorld(new T.Vector3(0,f.attackProfile.length,0)));
   maxError=Math.max(maxError,tip.distanceTo(new T.Vector3(s.tip.x,s.tip.y,s.tip.z)));assert.equal(m.authoredClip,chain===3?'chop':chain===2?'swordB':'swordA');for(const [,b]of m.boneEntries)assert.ok(b.quaternion.toArray().every(Number.isFinite));samples++;
  }
  rig.ImportedGladiator.dispose(m);
 }
 assert.ok(maxError<.045,'weapon mesh follows collision sweep: '+maxError);
 console.log(JSON.stringify({trajectories,contacts,rigSamples:samples,maxTipError:maxError,spearClipsUnchanged:true,serverCopiesMatch:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
