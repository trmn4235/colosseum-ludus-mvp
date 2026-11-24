const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Elite=require('../arena-elite-bots-v295.js'),exercise=require('../gladiator-exercise-v46.js');
const root=path.resolve(__dirname,'..'),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
// Run the shipped arena simulation and its real V10 loadout/damage wrappers, without a DB.
function fixture(mode='4x5'){
 const html=fs.readFileSync(path.join(root,'arena.html'),'utf8'),c=vm.createContext({console,LudusExercise:exercise});
 const start=html.indexOf('var ArenaClasses='),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",end="})(typeof window!=='undefined'?window:globalThis);";
 vm.runInContext(html.slice(start,html.indexOf(end,html.indexOf(marker,start))+end.length),c);
 const load=html.indexOf('var LudusLoadout='),finish=html.indexOf('})();',html.indexOf('P.damageProjectileV10=',load))+5;
 vm.runInContext(html.slice(load,finish).replace(/<\/script>[\s\S]*?<script[^>]*>/g,''),c);
 const combat=new c.ArenaCombat(()=>.999).reset('normal','secutor',mode);
 const ticket={mode,rule_version:2,loot:[],snapshot:{gladiator:{name:'Player',class:'secutor',stat_version:46,level:1,base_stats:Object.fromEntries(exercise.attributes.map(([k])=>[k,50]))}}};
 c.LudusLoadout.initialize(combat,ticket);
 const options={singlePlayer:true,assetsReady:()=>true,loadout:c.LudusLoadout};
 return {c,combat,ticket,options};
}
function item(c,kind,extra={}){return {kind,model:kind==='weapon'?'gladius':kind,stat_version:10,natural_rule_version:2,enhancement:0,natural_stats:c.LudusItemSystem.baseStats(kind),natural_percentages:{},emeralds:[],...extra};}
function active(f){return f.combat.fighters.filter(x=>x.eliteBotV295);}

test('verified UI modes are in the single-player panel; naval has a distinct route',()=>{
 const html=fs.readFileSync(path.join(root,'savas.html'),'utf8'),panel=html.slice(html.indexOf('id="panel-single"'),html.indexOf('id="panel-multi"'));
 assert.match(panel,/data-mode="4x5"[^>]*aria-label="Takımlı Arena/);
 assert.match(panel,/data-mode="solo20"[^>]*aria-label="Solo 20/);
 assert.match(panel,/data-mode="naval4x5"/);
 assert.ok(html.includes("p_mode:mode==='naval4x5'?'4x5':mode"));
});
test('default and failed asset readiness leave the actual roster unchanged',()=>{
 for(const assetsReady of [undefined,()=>false,()=>{throw Error('not loaded');}]){
  const f=fixture(),before=JSON.stringify(f.combat.fighters),damage=f.combat.damage;
  const result=Elite.attach(f.combat,f.ticket,{...f.options,assetsReady});
  assert.equal(result.reason,'assets-not-ready');assert.equal(JSON.stringify(f.combat.fighters),before);assert.equal(f.combat.damage,damage);
 }
});
for(const key of ['aegis','hoplomachus'])test('independent readiness for '+key+' leaves all other enemies unchanged',()=>{
 const f=fixture(),before=f.combat.fighters.map(x=>[x.name,x.maxHp,x.hp]);
 const options={...f.options,assetsReady:k=>k===key};
 const result=Elite.attach(f.combat,f.ticket,options);
 assert.equal(result.active,true);assert.deepEqual(result.assignments,[{key,fighterId:5}]);
 for(const x of f.combat.fighters)if(x.id!==5)assert.deepEqual([x.name,x.maxHp,x.hp],before[x.id]);
 assert.equal(f.combat.fighters[5].maxHp,Math.round(before[5][1]*1.15));
 assert.deepEqual(Elite.attach(f.combat,f.ticket,options),result);
});
test('unverified, ineligible or failed models never become special opponents',async()=>{
 const rows=Elite.definitions.map(d=>({id:d.key,ready:true,rigVerified:false,outputPath:d.file}));
 const options={singlePlayer:true},ticket={mode:'4x5'};let read=0,parsed=0;
 const loadManifest=async()=>{read++;return {version:295,models:rows};};
 const loadModel=async()=>{parsed++;return {traverse(){}};};
 assert.equal((await Elite.prepare(ticket,{...options,naval:true},loadManifest,loadModel)).size,0);
 assert.equal(read,0);
 assert.equal((await Elite.prepare(ticket,options,loadManifest,loadModel)).size,0);
 assert.equal(parsed,0);
 rows[0].rigVerified=true;rows[1].rigVerified=true;rows[1].outputPath='unrelated.glb';
 assert.equal((await Elite.prepare(ticket,options,loadManifest,loadModel)).size,0);
 assert.equal(parsed,1);
 assert.equal((await Elite.prepare(ticket,options,async()=>{throw Error('404');},loadModel)).size,0);
});
for(const mode of ['4x5','solo20'])test(mode+': replace exactly two enemy slots, one of each, preserving roster, allies and loot',()=>{
 const f=fixture(mode),refs=[...f.combat.fighters],before=f.combat.fighters.map(x=>({id:x.id,team:x.team,type:x.type,hp:x.hp,maxHp:x.maxHp,name:x.name,equipment:x.equipment,gearBase:x.gearBase}));
 const first=Elite.attach(f.combat,f.ticket,f.options),second=Elite.attach(f.combat,f.ticket,f.options);
 assert.equal(first.active,true);assert.deepEqual(second,first);assert.equal(f.combat.fighters.length,20);
 assert.deepEqual(Array.from(active(f),x=>x.eliteBotV295.key),['aegis','hoplomachus']);
 for(const [i,x] of f.combat.fighters.entries()){
  assert.equal(x,refs[i]);assert.equal(x.id,before[i].id);assert.equal(x.team,before[i].team);assert.equal(x.type,before[i].type);
  assert.equal(x.equipment,before[i].equipment);assert.equal(x.gearBase,before[i].gearBase);
  if(x.eliteBotV295){assert.notEqual(x.id,0);assert.notEqual(x.team,f.combat.fighters[0].team);assert.equal(x.maxHp,Math.round(before[i].maxHp*1.15));near(x.hp,x.maxHp);}
  else {assert.equal(x.hp,before[i].hp);assert.equal(x.maxHp,before[i].maxHp);assert.equal(x.name,before[i].name);}
 }
 assert.deepEqual(f.ticket.loot,[]);
});
test('naval, pit, survival, multiplayer, ranked and absent single-player intent never activate',()=>{
 const cases=[...['naval4x5','pit','survival','multiplayer','ranked'].map(mode=>({mode})),
  {options:{singlePlayer:false}},{options:{singlePlayer:undefined}},{options:{naval:true}},{options:{pit:true}},{options:{ranked:true}},
  {combat:{naval:{}}},{combat:{pitRound:{}}},{combat:{survival:{}}},{mode:'solo20',combat:{mode:'4x5'}}];
 for(const row of cases){const f=fixture(row.mode||'4x5');Object.assign(f.combat,row.combat);const before=JSON.stringify(f.combat.fighters);
  assert.equal(Elite.attach(f.combat,f.ticket,{...f.options,...row.options}).active,false);assert.equal(JSON.stringify(f.combat.fighters),before);
 }
});
test('owned fighters, player and allies cannot be chosen; incomplete rosters do not get one elite',()=>{
 const f=fixture();for(const x of f.combat.fighters)if(x.team!==0)x.owner_id='human';
 const before=JSON.stringify(f.combat.fighters);assert.equal(Elite.attach(f.combat,f.ticket,f.options).reason,'insufficient-enemies');assert.equal(JSON.stringify(f.combat.fighters),before);
 delete f.combat.fighters[5].owner_id;assert.equal(Elite.attach(f.combat,f.ticket,f.options).active,false);assert.equal(active(f).length,0);
 delete f.combat.fighters[10].owner_id;f.combat.fighters[10].id=5;assert.equal(Elite.attach(f.combat,f.ticket,f.options).reason,'invalid-roster');
});
test('HP bonus remains once through repeated real apply/refresh, gear changes and death, preserving HP percentage',()=>{
 const f=fixture(),bot=f.combat.fighters[5];bot.hp=bot.maxHp*.4;
 Elite.attach(f.combat,f.ticket,f.options);near(bot.hp/bot.maxHp,.4);
 const originalMax=bot.maxHp;
 for(let i=0;i<4;i++){f.c.LudusLoadout.refresh(bot);near(bot.hp/bot.maxHp,.4);assert.equal(bot.maxHp,originalMax);assert.equal(bot.name,'Aegis Sentinel');}
 bot.equipment.chest={token:'unchanged-token',item:item(f.c,'chest',{emeralds:[{id:1,value:100}]})};
 f.c.LudusLoadout.refresh(bot);assert.equal(bot.maxHp,Math.round((originalMax/1.15+20)*1.15));near(bot.hp/bot.maxHp,.4);
 f.c.LudusLoadout.apply(bot,bot.gearBase,[]);assert.equal(bot.maxHp,originalMax);near(bot.hp/bot.maxHp,.4);
 bot.hp=0;f.c.LudusLoadout.refresh(bot);assert.equal(bot.hp,0);assert.equal(bot.name,'Aegis Sentinel');
 const assignments=Elite.attach(f.combat,f.ticket,f.options).assignments;assert.equal(assignments[0].fighterId,bot.id);assert.equal(bot.hp,0);assert.equal(active(f).length,2);
});
for(const kind of ['legacy-melee','v10-melee','v10-projectile'])test(kind+': actual damage receives one 10% multiplier, including after refresh',()=>{
 const run=enabled=>{
  const f=fixture(),a=f.combat.fighters[5],v=f.combat.fighters[0],w=item(f.c,'weapon');
  a.equipment.weapon={token:'weapon-token',item:w};f.c.LudusLoadout.refresh(a,true);
  if(kind==='legacy-melee')a.equipment.weapon={token:'weapon-token',item:{kind:'weapon',model:'gladius',base_stats:{}}};
  if(enabled){Elite.attach(f.combat,f.ticket,f.options);Elite.attach(f.combat,f.ticket,f.options);}
  f.c.LudusLoadout.refresh(a);Object.assign(a,{action:'attack',attackWeapon:'gladius',weapon:'gladius'});
  Object.assign(v,{hp:20000,maxHp:20000,action:'attack',chest:false,defenseBonus:1});v.body.chest=100;
  if(kind==='v10-projectile')f.combat.damageProjectileV10(a,v,{kind:'gladius',itemEntry:{item:w}},5000,'chest',false);
  else f.combat.damage(a,v,5000,'chest',false);
  return 20000-v.hp;
 };
 const ordinary=run(false),elite=run(true);assert.ok(ordinary>0);assert.ok(Math.abs(elite-ordinary*1.1)<=1,`${kind}: ${ordinary} => ${elite}`);
});
test('readiness loss removes bonuses, and a combat reset cannot retain old elites or stack damage wrappers',()=>{
 const f=fixture(),bot=f.combat.fighters[5],name=bot.name,max=bot.maxHp;
 const dealt=a=>{const v=f.combat.fighters[0];Object.assign(a,{action:'attack'});Object.assign(v,{hp:20000,maxHp:20000,action:'attack',chest:false,defenseBonus:1});v.body.chest=100;f.combat.damage(a,v,5000,'chest',false);return 20000-v.hp;};
 const baseline=dealt(bot);
 Elite.attach(f.combat,f.ticket,f.options);bot.hp=bot.maxHp*.3;
 Elite.attach(f.combat,f.ticket,{...f.options,assetsReady:()=>false});assert.equal(bot.name,name);assert.equal(bot.maxHp,max);near(bot.hp/max,.3);assert.equal(active(f).length,0);
 assert.equal(dealt(bot),baseline);
 Elite.attach(f.combat,f.ticket,f.options);const old=f.combat.fighters[5];
 f.combat.reset('normal','secutor','4x5');f.c.LudusLoadout.initialize(f.combat,f.ticket);
 Elite.attach(f.combat,f.ticket,f.options);assert.equal(old.eliteBotV295,undefined);assert.equal(active(f).length,2);assert.equal(f.combat.fighters[5].maxHp,Math.round(max*1.15));
 assert.ok(Math.abs(dealt(f.combat.fighters[5])-baseline*1.1)<=1);
});
