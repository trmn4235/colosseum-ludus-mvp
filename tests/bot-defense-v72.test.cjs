const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {test}=require('node:test'),assert=require('node:assert/strict');
function runtime(page){
 const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8'),start=html.indexOf('var ArenaClasses=');
 const marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);";
 const ctx=vm.createContext({console});vm.runInContext(html.slice(start,html.indexOf(ending,html.indexOf(marker,start))+ending.length),ctx);return ctx;
}
function duel(ctx,random=()=>0,difficulty='normal'){
 const sim=new ctx.ArenaCombat(random).reset(difficulty,'secutor');
 for(const f of sim.fighters){f.hp=0;f.cooldown=99;}
 const a=sim.fighters[0],b=sim.fighters[5];
 Object.assign(a,{hp:100,x:0,z:0,angle:0,cooldown:0,weapon:'gladius',agility:50});
 Object.assign(b,{hp:100,x:0,z:1.25,angle:Math.PI,weapon:'gladius',shield:false,stamina:100,maxStamina:100,target:0,think:10});
 return {sim,a,b};
}
function advance(sim,seconds){for(let i=0;i<Math.ceil(seconds*120);i++)sim.tick(1/120);}
for(const page of ['arena.html','savas.html','multiplayer.html']){
 const ctx=runtime(page);
 test(page+': ordinary attacks can be rolled after a human reaction delay',()=>{
  const {sim,a,b}=duel(ctx);assert.ok(sim.attack(0));advance(sim,.09);assert.notEqual(b.action,'dodge');
  advance(sim,.09);assert.equal(b.action,'dodge');assert.ok(b.stamina<=75);assert.ok(sim.events.find(e=>e.type==='dodge'&&e.id===b.id).time>=.12);
  advance(sim,.5);assert.equal(b.hp,100);assert.ok(Math.hypot(b.x,b.z-1.25)>2);
 });
 test(page+': defense has misses and does not re-roll its chance each frame',()=>{
  let calls=0;const {sim,b}=duel(ctx,()=>{calls++;return .999;});sim.attack(0);b.aiSpecialAt=99;
  advance(sim,.38);assert.notEqual(b.action,'dodge');assert.ok(!sim.events.some(e=>e.type==='dodge'));assert.ok(b.hp<100);
  assert.ok(calls<12,'random decision must be made once per observed swing');
 });
 test(page+': depleted bots cannot roll, and evade cooldown prevents chaining',()=>{
  const {sim,a,b}=duel(ctx);b.stamina=24;sim.attack(0);advance(sim,.22);assert.notEqual(b.action,'dodge');
  const next=duel(ctx);next.b.aiEvadeAt=10;next.sim.attack(0);advance(next.sim,.23);assert.notEqual(next.b.action,'dodge');
 });
 test(page+': a shield bot can choose an actual block',()=>{
  const {sim,b}=duel(ctx,()=>.5);b.shield=true;b.shieldHeldBy=null;
  sim.attack(0);advance(sim,.42);assert.equal(b.hp,100);assert.ok(sim.events.some(e=>e.type==='block'&&e.id===b.id));
 });
 test(page+': threats from other opponents are noticed, teammates and rear attacks are excluded',()=>{
  const {sim,a,b}=duel(ctx);const c=sim.fighters[10];Object.assign(c,{hp:100,x:.3,z:.1,angle:0,cooldown:0,agility:50});
  sim.attack(c.id);c.angle=Math.atan2(b.x-c.x,b.z-c.z);assert.equal(sim.botThreat(b),c);
  c.team=b.team;assert.equal(sim.botThreat(b),null);c.team=2;b.angle=0;assert.equal(sim.botThreat(b),null);
 });
 test(page+': dodge chooses an open direction inside the arena',()=>{
  const {sim,a,b}=duel(ctx);Object.assign(b,{x:16.2,z:0});Object.assign(a,{x:15,z:0});
  assert.ok(sim.botRoll(b,a));const end={x:b.x+b.dx*3.7,z:b.z+b.dz*3.7};assert.ok(Math.hypot(end.x,end.z)<16.7);
 });
 test(page+': player stamina cost, travel and vulnerability window remain unchanged',()=>{
  const {sim,a,b}=duel(ctx,()=>.999);b.z=12;a.stamina=100;
  assert.ok(sim.dodge(0,1,0));assert.equal(a.stamina,75);assert.equal(a.duration,.46);
  advance(sim,.5);assert.ok(a.x>3.6&&a.x<3.85);assert.equal(a.action,'idle');
 });
 test(page+': a sword bot closes to real blade reach instead of swinging from the broad collision range',()=>{
  const {sim,a,b}=duel(ctx,()=>.999);Object.assign(b,{z:1.7,cooldown:0,aiSpecialAt:99});
  sim.tick(1/60);assert.equal(b.action,'idle');assert.ok(b.z<1.7);
  advance(sim,.35);assert.equal(b.action,'attack');assert.ok(b.z<=1.12);
 });
}
test('authored Roll contains a continuous full rotation and returns upright',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'..','arena-roll-motion-v72.js'),'utf8'),c);
 const clip=c.LUDUS_ROLL_MOTION.clip;assert.equal(clip.original,'Roll');assert.ok(clip.frames>=40);
 for(const values of Object.values(clip.rotations))for(let i=0;i<values.length;i++){
  assert.ok(Math.abs(Math.hypot(...values[i])-1)<1e-4);
  if(i)assert.ok(Math.abs(values[i].reduce((n,v,j)=>n+v*values[i-1][j],0))>.8);
 }
 const q=clip.rotations.Hips;assert.ok(q.some(v=>1-2*(v[0]*v[0]+v[2]*v[2])<-.8),'hips must turn upside down');
 assert.ok(1-2*(q.at(-1)[0]**2+q.at(-1)[2]**2)>.8,'hips return upright');
});
