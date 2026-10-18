const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {runtime,fixture}=require('./combat-stats-v73.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const advance=(sim,seconds)=>{for(let n=0;n<Math.ceil(seconds*120);n++)sim.tick(1/120,{});};
for(const page of ['arena.html','savas.html','multiplayer.html']){
 const c=runtime(page),M=c.ArenaMotion;
 test(page+': a normal gladius strike has visible preparation, contact and return to guard',()=>{
  const {sim,a,v}=fixture(c);Object.assign(a,{agility:50,itemStats:{}});v.z=8;
  assert.ok(sim.attack(0));near(a.attackProfile.wind,.25);near(a.attackProfile.active,.20);near(a.attackProfile.recover,.45);near(a.duration,.90);
  const stamina=a.stamina;advance(sim,.15);const timer=a.timer;
  for(let n=0;n<100;n++)assert.equal(sim.attack(0),false);
  near(a.timer,timer);near(a.stamina,stamina);assert.equal(sim.events.filter(e=>e.type==='swing').length,1);
 });
 test(page+': combined reflex and equipment haste is capped and applied once',()=>{
  for(const agility of [0,50,100])for(const speed of [0,10,25,1000]){
   const {sim,a}=fixture(c);Object.assign(a,{agility,itemStats:{attack_speed:speed}});assert.ok(sim.attack(0));
   const p=M.profile('gladius'),factor=M.speedFactor(a);assert.ok(factor>=.9&&factor<=1.18);
   near(a.duration,p.duration/factor);near(a.duration,a.attackProfile.wind+a.attackProfile.active+a.attackProfile.recover);
   assert.ok(a.attackProfile.wind>=.21&&a.attackProfile.recover>=.38);
  }
 });
 test(page+': a miss adds recovery once, while a connected strike keeps its cadence',()=>{
  const miss=fixture(c);miss.v.z=8;miss.sim.attack(0);const initial=miss.a.duration;
  advance(miss.sim,.55);near(miss.a.duration,initial+.14);advance(miss.sim,.10);near(miss.a.duration,initial+.14);
  assert.equal(miss.a.strikeConnected,false);
  const hit=fixture(c);hit.v.shield=false;hit.sim.attack(0);const connected=hit.a.duration;advance(hit.sim,.65);
  near(hit.a.duration,connected);assert.equal(hit.a.strikeConnected,true);
  assert.equal(hit.sim.events.filter(e=>e.type==='hit'&&e.source===0).length,1);
 });
 test(page+': even an evaded strike must complete its miss recovery',()=>{
  const {sim,a,v}=fixture(c);v.action='dodge';v.timer=0;v.duration=2;v.dx=v.dz=0;
  sim.attack(0);const duration=a.duration;sim.hit(a,v,true);assert.equal(a.strikeConnected,false);
  advance(sim,.6);near(a.duration,duration+.14);
 });
 test(page+': the third light gladius strike is a continuous thrust and the heavy stays overhead',()=>{
  const {a}=fixture(c);Object.assign(a,{action:'attack',attackWeapon:'gladius',attackProfile:M.profile('gladius'),attackKind:'light',attackRegion:'chest',chain:3});
  const p=a.attackProfile,chamber=M.sample(a,p.wind),point=M.sample(a,p.wind+p.active);
  assert.ok(chamber.grip.y<1.6);assert.ok(point.grip.z-chamber.grip.z>.5);assert.ok(Math.abs(point.tip.x)<1e-8);
  for(const t of [p.wind,p.wind+p.active,p.duration]){
   const left=M.sample(a,t-1e-7),right=M.sample(a,t+1e-7);assert.ok(Math.hypot(left.tip.x-right.tip.x,left.tip.y-right.tip.y,left.tip.z-right.tip.z)<1e-4);
  }
  assert.ok(M.sample({...a,attackKind:'heavy'},p.wind).grip.y>1.85);
 });
 test(page+': shield displacement and rotation follow the actual impact side',()=>{
  for(const sign of [-1,1]){
   const {sim,a,v}=fixture(c);Object.assign(v,{shield:true,shieldHeldBy:null});sim.attack(0);sim.prepareGuard(v,true);const gp=M.guardPoint(v),point=M.world(v,{x:gp.x+sign*.25,y:gp.y+.1,z:gp.z});
   assert.ok(sim.guard(a,v,false,point));v.guardFlash=.1;const r=M.shieldResponse(v);
   assert.equal(Math.sign(r.yaw),sign);assert.equal(Math.sign(r.x),sign);assert.ok(r.z<-.05);assert.ok(M.guardPoint(v).z<.24);
   assert.equal(a.action,'recoil');assert.equal(M.sample(a).active,false);
  }
 });
 test(page+': body reactions follow the source and remain restrained',()=>{
  for(const sign of [-1,1]){
   const {sim,a,v}=fixture(c);Object.assign(v,{angle:0});Object.assign(a,{x:sign,z:v.z+1});
   sim.damage(a,v,20,'chest');v.reaction=.26;const r=M.reaction(v);
   assert.equal(Math.sign(r.poses.Spine2[2]),sign);assert.ok(Math.abs(r.poses.Spine2[2])<.2);
   v.reaction=0;assert.equal(Object.keys(M.reaction(v).poses).length,0);
  }
 });
 test(page+': polearm shaft contact at close range is weaker than a point at proper distance',()=>{
  const damage=d=>{const {sim,a,v}=fixture(c);Object.assign(a,{weapon:'spear',attackWeapon:'spear',attackKind:'light'});Object.assign(v,{z:d,shield:false,chest:false});const hp=v.hp;assert.ok(sim.hit(a,v,true));return hp-v.hp;};
  assert.ok(damage(.9)<damage(1.9)*.5);near(M.impactQuality({x:0,z:0,weapon:'spear'},{x:0,z:1.9}),1);
 });
 test(page+': the lead foot steps into an attack and returns to its starting position',()=>{
  const {a}=fixture(c);Object.assign(a,{action:'attack',attackWeapon:'gladius',attackProfile:M.profile('gladius'),attackKind:'light',attackRegion:'chest',timer:.25,chain:1});
  const step=M.body(a).step;assert.equal(step.side,'Left');assert.ok(step.forward>=.13&&step.forward<=.15);
  a.timer=a.attackProfile.duration;near(M.body(a).step.forward,0);near(M.body(a).step.lift,0);
 });
}
test('early input cannot reset a strike, and the late input buffer stores only one command',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../arena.html'),'utf8'),start=html.indexOf('function strike('),end=html.indexOf('\nfunction useSpecial',start);
 const f={action:'attack',stamina:100,timer:.1,duration:.9},context=vm.createContext({active:()=>true,naval:null,selectedRegion:'chest',performance:{now:()=>1000},worldInput:()=>({block:false}),toast(){},combat:{fighters:[f],attack:()=>false}});
 vm.runInContext('let queuedAttack=null;'+html.slice(start,end),context);context.strike();assert.equal(vm.runInContext('queuedAttack',context),null);
 f.timer=.7;context.strike(false,'head');const queued=vm.runInContext('queuedAttack',context);context.strike(true,'chest');assert.equal(vm.runInContext('queuedAttack',context),queued);assert.equal(queued.region,'head');
});
