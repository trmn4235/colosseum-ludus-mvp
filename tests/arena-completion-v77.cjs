const assert=require('node:assert/strict');
const {runtime,fixture,g,core}=require('./combat-stats-v73.cjs');
const {fixtureDatabase,players,call,A}=require('./online-projectiles-v76.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
async function main(){
 for(const page of ['arena.html','savas.html','multiplayer.html']){
  const c=runtime(page);
  const gain=morale=>{const {sim,a}=fixture(c);c.LudusLoadout.apply(a,{...g,combat_morale:morale,combat_stamina_bonus:12},[]);a.stamina=10;a.regenDelay=0;sim.tick(.05);return a.stamina-10;};
  const neutral=gain(50);near(gain(0),neutral*.95);near(gain(100),neutral*1.05);near(gain(-50),gain(0));near(gain(150),gain(100));near(gain(undefined),neutral);
  {const {sim,a,v}=fixture(c,0);v.itemStats={dodge_rate:20};const hp=v.hp,stamina=v.stamina,x=v.x,z=v.z;sim.damage(a,v,20);assert.equal(v.hp,hp);assert.equal(v.stamina,stamina);assert.equal(v.action,'idle');assert.equal(v.x,x);assert.equal(v.z,z);assert.equal(v.passiveEvade,.36);assert.ok(sim.events.some(e=>e.type==='evade'&&e.passive));sim.tick(.05);assert.ok(v.passiveEvade<.36&&v.passiveEvade>0);v.itemStats={};sim.random=()=>.999;sim.damage(a,v,20);assert.ok(v.hp<hp,'visual slip grants no extra immunity');}
  const delays=[];
  for(const tactics of [0,50,100]){const {sim,a,v}=fixture(c,.5);v.tactics=tactics;sim.attack(a.id);sim.botDefend(v,a);delays.push(v.aiThreat.delay);assert.ok(v.aiThreat.delay>=.1);let rolls=0;sim.random=()=>{rolls++;return .5;};sim.botDefend(v,a);assert.equal(rolls,0,'same threat never re-rolls its decision');}
  assert.ok(delays[0]>delays[1]&&delays[1]>delays[2]);
  {const {sim,a,v}=fixture(c,.5);v.body.head=1;a.tactics=100;assert.equal(sim.botAttackRegion(a,v),'head');a.tactics=0;assert.notEqual(sim.botAttackRegion(a,v),'head');}
  const move=tactics=>{const {sim,a,v}=fixture(c,.999);Object.assign(v,{tactics,stamina:30,z:1.5,target:a.id,think:10,aiSpecialAt:999});c.ArenaCombat.prototype.botStep.call(sim,v,.05);return v.z;};
  assert.ok(move(100)>1.5&&move(0)<1.5,'high tactics preserves an action reserve');
  for(const tactics of [0,100]){const {a}=fixture(c);c.LudusLoadout.apply(a,{...g,base_stats:{...core,tactics}},[]);assert.equal(a.tactics,tactics);}
 }
 const db=await fixtureDatabase(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const gains=[];
 for(const morale of [0,50,100]){
  const p=(await players(db))[0];Object.assign(p,{stats_version:77,hp:100,stamina:10,stamina_at:'2026-10-11T12:00:00Z',stamina_regen_at:'2026-10-11T12:00:00Z'});p.gladiator.combat_morale=morale;p.gladiator.combat_stamina_bonus=12;
  const result=(await q("select private.ludus_advance_combat_v36($1,'2026-10-11T12:00:01Z') p",[JSON.stringify([p])]))[0].p[0];gains.push(result.stamina-10);
 }
 near(gains[0],gains[1]*.95);near(gains[2],gains[1]*1.05);
 await q("insert into ludus_food_house(owner_id,crew_count,settled_day,last_menu)values($1,1,(clock_timestamp()at time zone'Europe/Istanbul')::date-1,'{\"morale\":75}')on conflict(owner_id)do update set last_menu=excluded.last_menu,settled_day=excluded.settled_day",[A]);
 assert.equal((await q('select ludus_food_private.combat_snapshot_v77($1) s',[A]))[0].s.combat_morale,75);
 const ga=(await q("insert into ludus_gladiators(owner_id,name,class,base_stats,stat_version)values($1,'Alpha','secutor',$2,46)returning id",[A,JSON.stringify(core)]))[0].id;
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const joined=(await q("select ludus_match('join',null,$1,'{}','{\"combat_morale\":999,\"combat_stats\":{\"morale\":999}}') r",[ga]))[0].r;
 assert.equal(joined.players[0].stats_version,77);assert.equal(joined.players[0].gladiator.combat_morale,75);assert.equal(joined.controls_version,77);
 await q("update ludus_food_house set last_menu='{\"morale\":0}' where owner_id=$1",[A]);
 const frozen=(await q("select ludus_match('state',$1) r",[joined.id]))[0].r;assert.equal(frozen.players[0].gladiator.combat_morale,75,'mid-match food change cannot rewrite morale');
 const request=(await q('select gen_random_uuid() id'))[0].id;
 const ticket=(await q("select ludus_start_battle_v2($1,'4x5','{}',$2) r",[ga,request]))[0].r;
 assert.equal(ticket.snapshot.gladiator.combat_morale,0,'PvE also freezes the consumed menu');
 await q("update ludus_food_house set last_menu='{\"morale\":100}' where owner_id=$1",[A]);
 const retry=(await q("select ludus_start_battle_v2($1,'4x5','{}',$2) r",[ga,request]))[0].r;assert.equal(retry.snapshot.gladiator.combat_morale,0,'retries preserve the battle snapshot');
 const grants=(await q("select has_function_privilege('authenticated','ludus_food_private.combat_snapshot_v77(uuid)','execute') a,has_function_privilege('anon','ludus_food_private.combat_snapshot_v77(uuid)','execute') b"))[0];assert.deepEqual(grants,{a:false,b:false});
 await db.close();console.log(JSON.stringify({engines:3,moraleBounds:true,serverParity:true,serverOwnedSnapshot:true,frozenDuringBattle:true,tacticsReaction:true,tacticsReserve:true,tacticsTarget:true,passiveEvade:true,noExtraImmunity:true,permissions:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
