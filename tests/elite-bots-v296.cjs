const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Elite=require('../arena-elite-bots-v295.js'),exercise=require('../gladiator-exercise-v46.js');
const root=path.resolve(__dirname,'..'),near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function fixture(commander='imperator',enabled=true){
 const html=fs.readFileSync(path.join(root,'arena.html'),'utf8'),c=vm.createContext({console,LudusExercise:exercise});
 for(const file of ['combat-curves-v163.js','combat-motion-v163.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 const start=html.indexOf('var ArenaClasses='),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",end="})(typeof window!=='undefined'?window:globalThis);";
 vm.runInContext(html.slice(start,html.indexOf(end,html.indexOf(marker,start))+end.length),c);
 const load=html.indexOf('var LudusLoadout='),finish=html.indexOf('})();',html.indexOf('P.damageProjectileV10=',load))+5;
 vm.runInContext(html.slice(load,finish).replace(/<\/script>[\s\S]*?<script[^>]*>/g,''),c);
 vm.runInContext(fs.readFileSync(path.join(root,'combat-specials-v261.js'),'utf8'),c);c.HandSpecials.install(c.ArenaCombat);
 const combat=new c.ArenaCombat(()=>.999).reset('normal','secutor','4x5');
 const ticket={mode:'4x5',rule_version:2,loot:[],snapshot:{gladiator:{name:'Player',class:'secutor',stat_version:46,level:1,base_stats:Object.fromEntries(exercise.attributes.map(([k])=>[k,50]))}}};
 c.LudusLoadout.initialize(combat,ticket);
 const options={singlePlayer:true,assetsReady:()=>true,loadout:c.LudusLoadout,commander};
 if(enabled)Elite.attach(combat,ticket,options);
 return {c,combat,ticket,options};
}
function weapon(c,model='gladius'){return {kind:'weapon',model,stat_version:10,natural_rule_version:2,enhancement:0,natural_stats:c.LudusItemSystem.baseStats('weapon'),natural_percentages:{},emeralds:[]};}
function duel(f,id=5,model='gladius'){
 const a=f.combat.fighters[id],v=f.combat.fighters[0];
 for(const other of f.combat.fighters)if(other!==a&&other!==v)other.hp=0;
 Object.assign(a,{x:0,z:0,angle:0,target:0,weapon:model,offhand:null,leftGear:null,shield:false,action:'idle',timer:0,cooldown:0,stamina:100,maxStamina:100,stunUntil:0,attackWeapon:model,skillReady:[0,0]});
 a.equipment.weapon={item:weapon(f.c,model)};
 Object.assign(v,{x:0,z:1,angle:Math.PI,action:'idle',hp:20000,maxHp:20000,stamina:100,cooldown:999,stunUntil:0,shield:false,chest:false,helmet:false,shoulders:false,greaves:false});
 return {a,v};
}
test('commanders and Victor have exact once-only derived stats through refresh, variant change and detach',()=>{
 for(const commander of ['imperator','legatus',null]){
  const f=fixture(commander,false),before=f.combat.fighters.map(x=>({armor:x.defenseBonus,speed:x.speedBonus,tactics:x.tactics,name:x.name}));
  const result=Elite.attach(f.combat,f.ticket,f.options);assert.equal(result.assignments.length,commander?2:1);
  for(const assignment of result.assignments){const a=f.combat.fighters[assignment.fighterId],victor=assignment.key==='hoplomachus',rate=!victor&&commander==='legatus'?1.25:1.15;
   assert.equal(a.name,victor?'Victor':commander==='legatus'?'Legatus legionis':'Imperator');
   assert.equal(a.eliteBotV295.variant,victor?null:commander);
   near(a.defenseBonus,before[a.id].armor*rate);near(a.speedBonus,before[a.id].speed*(victor?1.15:1));
   const armor=a.defenseBonus,speed=a.speedBonus;
   for(let i=0;i<4;i++){f.c.LudusLoadout.refresh(a);near(a.defenseBonus,armor);near(a.speedBonus,speed);}
  }
  Elite.detach(f.combat);
  for(const a of f.combat.fighters){near(a.defenseBonus,before[a.id].armor);near(a.speedBonus,before[a.id].speed);assert.equal(a.tactics,before[a.id].tactics);assert.equal(a.name,before[a.id].name);}
 }
 const f=fixture('legatus');Elite.attach(f.combat,f.ticket,{...f.options,commander:'imperator'});
 assert.equal(f.combat.fighters.filter(x=>x.eliteBotV295).length,2);assert.equal(f.combat.fighters[5].name,'Imperator');
});
test('commander-free asset preparation never requests the Aegis model',async()=>{
 const rows=Elite.definitions.map(d=>({id:d.key,ready:true,rigVerified:true,outputPath:d.file})),requested=[];
 await Elite.prepare({mode:'4x5'},{singlePlayer:true,commander:null},async()=>({version:295,models:rows}),async file=>{requested.push(file);return {traverse(){}};});
 assert.deepEqual(requested,[Elite.definitions[1].file]);
});
test('real armor mitigation and Victor stacked attack bonus affect actual melee and thrown damage',()=>{
 for(const commander of ['imperator','legatus',null])for(const projectile of [false,true]){
  const run=enabled=>{const f=fixture(commander,enabled),{a,v}=duel(f,commander?5:5);f.c.LudusLoadout.refresh(a);
   Object.assign(a,{action:'attack',attackWeapon:'gladius'});Object.assign(v,{action:'attack',defenseBonus:1});
   if(projectile)f.combat.damageProjectileV10(a,v,{kind:'gladius',itemEntry:{item:weapon(f.c)}},5000,'chest',false);else f.combat.damage(a,v,5000,'chest',false);
   const dealt=20000-v.hp;Object.assign(a,{action:'attack',hp:20000,maxHp:20000,chest:false});Object.assign(v,{action:'attack',attackWeapon:'gladius'});f.combat.damage(v,a,5000,'chest',false);return {dealt,taken:20000-a.hp};};
  const ordinary=run(false),elite=run(true),attack=commander?1.1:1.1*1.15,armor=commander==='legatus'?1.25:1.15;
  near(elite.dealt,ordinary.dealt*attack,1);near(elite.taken,ordinary.taken/armor,1);
 }
});
test('attack wind-up, contact, recovery and cooldown accelerate together; normal fighters retain timing',()=>{
 for(const commander of ['imperator','legatus',null]){
  const run=enabled=>{const f=fixture(commander,enabled),{a,v}=duel(f);f.combat.botStep=()=>{};assert.equal(f.combat.attack(a.id),true);
   const profile={...a.attackProfile},phase=f.c.ArenaMotion.authored.phase(a,profile.wind+profile.active*.5);let hitAt=null,endedAt=null;
   for(let i=0;i<1000;i++){f.combat.tick(.002,{});if(v.hp<20000&&hitAt===null)hitAt=f.combat.time;if(a.action==='idle'){endedAt=f.combat.time;break;}}
   return {profile,phase,hitAt,endedAt,cooldown:a.cooldown};};
  const ordinary=run(false),elite=run(true),rate=commander==='legatus'?1.25:1.15;
  for(const key of ['wind','active','recover','duration'])near(elite.profile[key],ordinary.profile[key]/rate);
  near(elite.phase,ordinary.phase);assert.ok(ordinary.hitAt!==null&&elite.hitAt!==null);near(elite.hitAt,ordinary.hitAt/rate,.006);near(elite.endedAt,ordinary.endedAt/rate,.006);near(elite.cooldown,ordinary.cooldown/rate);
 }
 const f=fixture('legatus'),g=fixture('legatus',false),a=f.combat.fighters[6],b=g.combat.fighters[6];
 a.cooldown=b.cooldown=0;f.combat.attack(a.id);g.combat.attack(b.id);assert.deepEqual(JSON.parse(JSON.stringify(a.attackProfile)),JSON.parse(JSON.stringify(b.attackProfile)));
});
test('miss recovery and authored pole recoil obey attack speed',()=>{
 for(const model of ['gladius','spear']){
  const run=enabled=>{const f=fixture('legatus',enabled),{a,v}=duel(f,5,model);f.combat.botStep=()=>{};if(model==='gladius')v.z=10;else v.z=1.5;
   f.combat.attack(a.id);let recoil=null;for(let i=0;i<1000;i++){f.combat.tick(.002,{});if(a.action==='recoil'&&recoil===null)recoil=a.duration;if(a.action==='idle')return {time:f.combat.time,recoil};}assert.fail('attack never finished');};
  const ordinary=run(false),elite=run(true);near(elite.time,ordinary.time/1.25,.008);if(ordinary.recoil!==null)near(elite.recoil,ordinary.recoil/1.25,.002);
 }
});
test('a later hit in the same tick retains its own hurt duration after an elite misses',()=>{
 const f=fixture('legatus'),{a,v}=duel(f);v.z=10;f.combat.attack(a.id);a.timer=a.attackProfile.wind+a.attackProfile.active-.001;
 const later=f.combat.fighters[6];Object.assign(later,{hp:100,maxHp:100,team:2,action:'idle',x:10,z:10,attackWeapon:'gladius'});
 f.combat.botStep=bot=>{if(bot===later)f.combat.damage(later,a,10,'chest',false);};
 f.combat.tick(.01,{});assert.equal(a.action,'hurt');near(a.duration,.25);
});
test('throw and net release clocks accelerate with their animations without accelerating missile flight',()=>{
 for(const kind of ['throw','net']){
  const run=enabled=>{const f=fixture('legatus',enabled),{a,v}=duel(f,5,'spear');f.combat.botStep=()=>{};v.z=6;
   if(kind==='net'){a.leftGear='net';a.shield=false;}
   assert.equal(f.combat.special(a.id,kind==='net'?1:0),true);let released=null,ended=null,speed=null;
   for(let i=0;i<1200;i++){const p=(kind==='net'?f.combat.nets:f.combat.projectiles)[0],before=p&&{x:p.x,z:p.z,launched:kind==='net'?p.age>=.3:p.launched};f.combat.tick(.002,{});
    if(p&&(kind==='net'?p.age>=.3:p.launched)&&released===null)released=f.combat.time;
    if(kind==='throw'&&before?.launched&&p&&speed===null)speed=Math.hypot(p.x-before.x,p.z-before.z)/.002;
    if(a.action==='idle'){ended=f.combat.time;break;}}
   return {released,ended,speed};};
  const ordinary=run(false),elite=run(true);near(elite.released,ordinary.released/1.25,.004);near(elite.ended,ordinary.ended/1.25,.006);if(kind==='throw'){near(ordinary.speed,12);near(elite.speed,12);}
 }
});
test('two-hit hand special keeps both hit windows and the second recovery at the faster rate',()=>{
 const run=enabled=>{const f=fixture('legatus',enabled),{a,v}=duel(f);f.combat.botStep=()=>{};assert.equal(f.combat.special(a.id,0),true);const hits=[];let old=v.hp;
  for(let i=0;i<500;i++){f.combat.tick(.002,{});if(v.hp<old){hits.push(f.combat.time);old=v.hp;}if(hits.length===2&&a.action==='idle')return {hits,time:f.combat.time};}assert.fail('two-hit special never completed');};
 const ordinary=run(false),elite=run(true);assert.equal(elite.hits.length,2);for(let i=0;i<2;i++)near(elite.hits[i],ordinary.hits[i]/1.25,.006);near(elite.time,ordinary.time/1.25,.008);
});
test('faster net preparation preserves the three-second caught duration',()=>{
 for(const enabled of [false,true]){const f=fixture('legatus',enabled),{a,v}=duel(f);f.combat.botStep=()=>{};Object.assign(a,{leftGear:'net',shield:false});v.z=2;
  assert.equal(f.combat.special(a.id,1),true);let caught=false;
  for(let i=0;i<800;i++){f.combat.tick(.002,{});if(v.stunUntil>f.combat.time){near(v.stunUntil-f.combat.time,3);caught=true;break;}}
  assert.equal(caught,true);
 }
});
test('Victor runs 15% faster, evades after observing a threat, and does not dodge without stamina',()=>{
 const distance=enabled=>{const f=fixture(null,enabled),{a,v}=duel(f);v.z=8;f.combat.botStep(a,.05);return Math.hypot(a.x,a.z);};near(distance(true),distance(false)*1.15);
 for(const stamina of [100,20]){const f=fixture(null),{a,v}=duel(f);Object.assign(a,{stamina});Object.assign(v,{x:0,z:1,angle:Math.PI,weapon:'gladius',cooldown:0});assert.equal(f.combat.attack(0,true),true);
  f.combat.botStep(a,.01);assert.equal(a.action,'idle');f.combat.time=.11;f.combat.botStep(a,.01);
  if(stamina===100){assert.equal(a.action,'evade');const x=a.x;f.combat.tick(.05,{});assert.ok(Math.abs(a.x-x)>.01);assert.ok(a.stamina<stamina);}else assert.notEqual(a.action,'evade');
 }
});
test('Victor circles a committed opponent and launches a real attack from behind',()=>{
 const f=fixture(null),{a,v}=duel(f);Object.assign(a,{x:0,z:1.1,angle:Math.PI,target:0});Object.assign(v,{x:0,z:0,angle:0,action:'recoil',duration:3,timer:0});
 let attacked=false;
 for(let i=0;i<180;i++){f.combat.time+=.01;f.combat.botStep(a,.01);assert.ok(Math.hypot(a.x,a.z)>=.72);if(a.action==='attack'){attacked=true;break;}}
 assert.equal(attacked,true);assert.ok((a.x*Math.sin(v.angle)+a.z*Math.cos(v.angle))/Math.hypot(a.x,a.z)<-.45);assert.equal(a.attackKind,'light');
});
test('Victor keeps evasion inside the arena',()=>{
 const f=fixture(null),{a,v}=duel(f);Object.assign(a,{x:16.5,z:0,angle:-Math.PI/2});Object.assign(v,{x:15.5,z:0,angle:Math.PI/2,weapon:'gladius',cooldown:0});f.combat.attack(0,true);
 f.combat.botStep(a,.01);f.combat.time=.11;f.combat.botStep(a,.01);
 for(let i=0;i<12;i++)f.combat.tick(.05,{});
 assert.ok(Math.hypot(a.x,a.z)<=17);assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.z));
});
test('Victor selects the free side when his preferred escape is occupied',()=>{
 const f=fixture(null),{a,v}=duel(f),blocker=f.combat.fighters[6];Object.assign(blocker,{hp:100,maxHp:100,x:1.1,z:-.3,action:'idle'});
 Object.assign(v,{angle:Math.PI,weapon:'gladius',cooldown:0});f.combat.attack(0,true);
 f.combat.botStep(a,.01);f.combat.time=.11;f.combat.botStep(a,.01);
 assert.equal(a.action,'evade');assert.ok(a.dx<0);
});
