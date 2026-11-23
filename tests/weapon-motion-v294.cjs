/* CPU scene graph: weapon weight must read in the torso without changing a hit.
   Uses the shipped skeleton and equipment geometry; no browser or GPU required. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs');
const root=path.resolve(process.env.LUDUS_PERF_ROOT||path.join(__dirname,'..'));

async function main(){
 const c=await rigRuntime('arena.html'),T=c.THREE;
 c.crypto=webcrypto;vm.runInContext(fs.readFileSync(path.join(root,'equipment-catalog-v167.js'),'utf8'),c);
 for(const id of ['warhammer','halberd','heavy_mace','trident_gladiator']){
  const bytes=fs.readFileSync(path.join(root,'assets/equipment-v167',c.LudusEquipmentCatalog.entry(id).file));
  await c.LudusEquipmentCatalog.load(T,id,{bytes});
 }
 const stats={attacks:0,frames:0,maxGripError:0,maxTipError:0,maxPalmGap:0,knownLowHalberdPalmGap:0,maxExitHead:0,maxExitBody:0,maxExitChest:0,familyDifferences:{},exitAt60:{},chokedOffhandExit:{}};
 const point=v=>new T.Vector3(v.x,v.y,v.z);
 function make(weapon,left=false){
  const f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0],m=c.ImportedGladiator.create(294,'murmillo');
  Object.assign(f,{x:0,z:0,angle:.37,hp:100,weapon:left?'gladius':weapon,offhand:left?weapon:null,leftGear:null,shield:false,helmet:false,chest:false,shoulders:false,move:0,walk:0,motionVersion:163,action:'idle',timer:0,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,absoluteBlockUntil:0,shieldHeldBy:null});
  for(let n=0;n<20;n++)c.ImportedGladiator.animate(f,m,n/60,1/60);
  return {f,m};
 }
 function start(f,weapon,left=false,heavy=false,chain=1,extraRecovery=0){
  const p=c.ArenaMotion.profile(weapon,heavy);p.recover+=extraRecovery;p.duration=p.wind+p.active+p.recover;
  Object.assign(f,{action:'attack',timer:0,attackWeapon:weapon,attackLeft:left,attackKind:heavy?'heavy':'light',chain,attackRegion:'chest',attackProfile:p,duration:p.duration,blocking:false});
  return p;
 }
 function snapshot(m){
  const q=m.root.getWorldQuaternion(new T.Quaternion()).invert();
  return {chest:q.multiply(m.bones.Spine2.getWorldQuaternion(new T.Quaternion())).normalize(),head:m.root.worldToLocal(m.bones.Head.getWorldPosition(new T.Vector3())),body:m.body.position.clone()};
 }
 function pose(f,m,time,dt,palmLimit=.005){
  const state=JSON.stringify(f),sample=f.action==='attack'?c.ArenaMotion.sample(f):null,canonical=sample&&JSON.stringify(sample);
  c.ImportedGladiator.animate(f,m,time,dt);stats.frames++;
  assert.equal(JSON.stringify(f),state,'presentation changed authoritative fighter state');
  for(const name of ['Hips','Spine2','Head','LeftHand','RightHand'])assert.ok(m.bones[name].matrixWorld.elements.every(Number.isFinite),`${name}: non-finite pose`);
  if(!sample)return;
  assert.equal(JSON.stringify(c.ArenaMotion.sample(f)),canonical,'presentation changed the authoritative strike segment');
  const anchor=f.attackLeft?m.offhandAnchor:m.weaponAnchor,group=anchor.children[0],p=f.attackProfile;
  const grip=anchor.getWorldPosition(new T.Vector3()),expectedGrip=m.root.localToWorld(point(sample.grip)),gripError=grip.distanceTo(expectedGrip);
  stats.maxGripError=Math.max(stats.maxGripError,gripError);assert.ok(gripError<1e-5,`${f.attackWeapon} ${f.timer}: grip left the canonical path by ${gripError}m`);
  const direction=new T.Vector3(0,1,0).transformDirection(anchor.matrixWorld),expectedDirection=point(sample.dir).transformDirection(m.root.matrixWorld);
  assert.ok(direction.distanceTo(expectedDirection)<1e-5,`${f.attackWeapon}: rendered shaft changed the canonical attack direction`);
  // Transform the collision tip through the actual equipped anchor, independently
  // of the hand solver. This also covers the shortened reach of choked polearms.
  const localTip=p.pole?new T.Vector3(0,p.length-(sample.choke||0),0):sample.local?.length?point(sample.local.at(-1)):new T.Vector3(0,p.length,0);
  const tipError=anchor.localToWorld(localTip).distanceTo(m.root.localToWorld(point(sample.tip)));
  stats.maxTipError=Math.max(stats.maxTipError,tipError);assert.ok(tipError<1e-5,`${f.attackWeapon}: rendered tip left the canonical segment by ${tipError}m`);
  const side=f.attackLeft?'Left':'Right',hand=m.bones[side+'Hand'],offset=p.pole?-.16:group.userData.asset==='roman_spatha.glb'?-.065:0;
  const palm=hand.localToWorld(new T.Vector3(0,.075,.025).divideScalar(hand.getWorldScale(new T.Vector3()).x));
  const handle=group.localToWorld(new T.Vector3(0,offset+(sample.choke||0),0)),gap=palm.distanceTo(handle);
  const gapKey=palmLimit===.005?'maxPalmGap':'knownLowHalberdPalmGap';stats[gapKey]=Math.max(stats[gapKey],gap);
  assert.ok(gap<palmLimit,`${f.attackWeapon} ${side} ${f.timer}: actual palm/handle separated by ${gap}m (limit ${palmLimit}m)`);
  if(c.LudusEquipmentCatalog.entry(f.attackWeapon))assert.equal(group.userData.catalogId,f.attackWeapon,'physical contact must use the real catalog weapon');
 }
 function timeline(f,m,p,fps,palmLimit=.005){
  const checkpoints=[p.wind*.65,p.wind,p.wind+p.active*.5,p.wind+p.active,p.wind+p.active+p.recover*.3,p.wind+p.active+p.recover*.85,p.duration],samples=[];
  let time=0;f.timer=0;pose(f,m,1,1/fps,palmLimit);
  for(const target of checkpoints){
   while(time<target-1e-9){const dt=Math.min(1/fps,target-time);time+=dt;f.timer=time;pose(f,m,1+time,dt,palmLimit);}
   samples.push(snapshot(m));
  }
  return samples;
 }
 const signatures={},rates={};
 for(const weapon of ['gladius','sica','spear','trident','halberd','warhammer'])for(const left of [false,true])for(const fps of [30,60,120])for(const guard of [false,true]){
  const {f,m}=make(weapon,left),p=start(f,weapon,left),samples=timeline(f,m,p,fps),end=samples.at(-1),label=`${weapon} ${left?'left':'right'} ${fps}Hz ${guard?'guard':'idle'}`;
  if(!guard){rates[`${weapon}/${left}/${fps}`]=samples;if(fps===120)signatures[`${weapon}/${left}`]=samples;}
  Object.assign(f,{action:'idle',timer:0,blocking:guard});pose(f,m,1+p.duration+1/fps,1/fps);const next=snapshot(m);
  const head=end.head.distanceTo(next.head),body=end.body.distanceTo(next.body),chest=end.chest.angleTo(next.chest);
  stats.maxExitHead=Math.max(stats.maxExitHead,head);stats.maxExitBody=Math.max(stats.maxExitBody,body);stats.maxExitChest=Math.max(stats.maxExitChest,chest);
  // Keep a single recovery-to-rest step below a visible pose snap. Smaller
  // intervals require smaller steps, while 30 Hz permits twice the travel.
  assert.ok(head<(fps===30?.045:fps===60?.03:.023),`${label}: recovery exit head step ${head}m`);
  assert.ok(body<(fps===30?.035:fps===60?.025:.02),`${label}: recovery exit body step ${body}m`);
  assert.ok(chest<(fps===30?.18:fps===60?.12:.08),`${label}: recovery exit chest step ${chest}rad`);
  if(fps===60&&!left&&!guard)stats.exitAt60[weapon]={head,body,chest};
  c.ImportedGladiator.dispose(m);stats.attacks++;
 }
 // These pairs share source clips. Their rendered shoulder/torso work must still
 // communicate the difference between a short blade and a heavy cutting weapon.
 for(const [blade,heavy]of [['gladius','warhammer'],['sica','halberd']])for(const index of [0,4]){
  const deltas=[];
  for(const left of [false,true]){
   const a=signatures[`${blade}/${left}`][index].chest,b=signatures[`${heavy}/${left}`][index].chest,difference=a.angleTo(b);
   assert.ok(difference>.04&&difference<.4,`${blade}/${heavy} ${left?'left':'right'} ${index===0?'windup':'recovery'}: weight distinction ${difference}rad`);
   stats.familyDifferences[`${blade}/${heavy}/${left}/${index===0?'windup':'recovery'}`]=difference;
   deltas.push(b.clone().multiply(a.clone().invert()));
  }
  const reflected=deltas[0].clone();reflected.y=-reflected.y;reflected.z=-reflected.z;
  assert.ok(reflected.angleTo(deltas[1])<.002,'offhand weapon weight shift must mirror the dominant hand');
 }
 // Compare the same authored phases, rather than mismatched nearest frames.
 for(const weapon of ['gladius','sica','spear','trident','halberd','warhammer'])for(const left of [false,true])for(const fps of [30,60]){
  const a=rates[`${weapon}/${left}/${fps}`],b=rates[`${weapon}/${left}/120`];
  for(const index of [0,2,4]){
   assert.ok(a[index].head.distanceTo(b[index].head)<.035,`${weapon}: ${fps}Hz changed the head trajectory`);
   assert.ok(a[index].chest.angleTo(b[index].chest)<.07,`${weapon}: ${fps}Hz changed the torso trajectory`);
  }
 }
 // Include overhead/reverse cuts, mixed offhand loadouts and extended whiff
 // recovery; their combat timings and target region remain simulator-owned.
 for(const [weapon,left,heavy,chain,region]of [['gladius',false,false,3,'head'],['sica',true,false,2,'legs'],['warhammer',true,true,3,'head'],['heavy_mace',false,true,1,'chest'],['halberd',true,true,3,'legs'],['trident_gladiator',true,false,1,'head']]){
  for(const fps of weapon==='trident_gladiator'?[30,60,120]:[60]){
  const {f,m}=make(weapon,left),p=start(f,weapon,left,heavy,chain,.14);f.attackRegion=region;if(p.pole){f.poleChoke=.4;f.poleReach=1.9;}
  // The pre-existing heavy offhand halberd low cut exceeds this rig's arm reach
  // (V293: 0.1589m at 60Hz). Keep its canonical sweep exact and prevent worse
  // separation; report it separately from the reachable 5mm contact checks.
  const palmLimit=weapon==='halberd'&&heavy&&left&&region==='legs'?.16:.005;
  const samples=timeline(f,m,p,fps,palmLimit);
  if(weapon==='trident_gladiator'){
   // A shortened offhand shaft needs some crouch until its authoritative return
   // completes. Keep the subsequent rise bounded as well as the palm attached.
   // V293's 60Hz exit moved the head 9.07cm and body 4.78cm in one frame.
   const end=samples.at(-1);Object.assign(f,{action:'idle',timer:0});pose(f,m,1+p.duration+1/fps,1/fps);const next=snapshot(m);
   const head=end.head.distanceTo(next.head),body=end.body.distanceTo(next.body),chest=end.chest.angleTo(next.chest),limit=fps===30?.07:fps===60?.04:.025;
   assert.ok(head<limit&&body<limit,`choked offhand ${fps}Hz: recovery exit head ${head}m, body ${body}m`);
   assert.ok(chest<.03,`choked offhand ${fps}Hz: recovery exit chest ${chest}rad`);
   stats.chokedOffhandExit[fps]={head,body,chest};
  }
  c.ImportedGladiator.dispose(m);stats.attacks++;
  }
 }
 // A stale attackWeapon is common after an attack. It must not put weapon-family
 // lean on the V293 roll, which owns the entire body while dodging.
 const rollA=make('gladius'),rollB=make('gladius');let inverted=0;
 for(let n=0;n<=30;n++){
  const timer=n*.46/30;
  for(const [i,{f,m}]of [rollA,rollB].entries()){
   Object.assign(f,{action:'dodge',timer,duration:.46,dx:.6,dz:.8,attackWeapon:i?'warhammer':'spear',attackLeft:!!i});pose(f,m,2+timer,.46/30);
  }
  for(const name of ['Hips','Head','LeftHand','RightHand','LeftFoot','RightFoot']){
   const a=rollA.m.bones[name].getWorldPosition(new T.Vector3()),b=rollB.m.bones[name].getWorldPosition(new T.Vector3());assert.ok(a.distanceTo(b)<1e-5,`${name}: stale attack family leaked into roll`);
  }
  if(rollA.m.bones.Head.getWorldPosition(new T.Vector3()).y<rollA.m.bones.Hips.getWorldPosition(new T.Vector3()).y-.2)inverted++;
 }
 assert.ok(inverted>=6,'roll must retain a visible inverted interval');
 for(const {m}of [rollA,rollB])c.ImportedGladiator.dispose(m);
 console.log('PASS V294 weapon motion: '+JSON.stringify(stats));
 return stats;
}
module.exports=main;
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
