// Exercise the shipped combat engines and the actual PostgreSQL migration.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const ui=require('../gladiator-exercise-v46.js'),root=path.resolve(__dirname,'..');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(Number(actual)-expected)<tolerance,`${actual} ≈ ${expected}`);
function runtime(page){
 const html=fs.readFileSync(root+'/'+page,'utf8'),ctx=vm.createContext({console});
 const start=html.indexOf('var ArenaClasses='),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);";
 vm.runInContext(html.slice(start,html.indexOf(ending,html.indexOf(marker,start))+ending.length),ctx);
 const load=html.indexOf('var LudusLoadout='),finish=html.indexOf('})();',html.indexOf('P.damageProjectileV10=',load))+5;
 vm.runInContext(html.slice(load,finish).replace(/<\/script>[\s\S]*?<script[^>]*>/g,''),ctx);
 return ctx;
}
function idle(ctx,bonus,regen=0){
 const sim=new ctx.ArenaCombat(()=>.999).reset('normal','secutor'),f=sim.fighters[0];
 for(const p of sim.fighters){p.hp=0;p.cooldown=999;}
 Object.assign(sim.fighters[5],{hp:100,x:10,z:10,cooldown:999});
 ctx.LudusLoadout.apply(f,{class:'secutor',overall:50,level:1,combat_stamina_bonus:bonus},[]);
 Object.assign(f,{hp:100,maxHp:100,maxStamina:100,stamina:50,x:0,z:0,angle:0,action:'idle',regenDelay:0,cooldown:999});
 f.itemStats.stamina_regeneration=regen;
 return {sim,f};
}
function advance(sim,seconds,block=false){for(let i=0;i<Math.round(seconds*120);i++)sim.tick(1/120,{block});}
for(const page of ['arena.html','savas.html','multiplayer.html']){
 const ctx=runtime(page);
 for(const bonus of [0,4,8,12]){
  let {sim,f}=idle(ctx,bonus);advance(sim,1);near(f.stamina,50+15.75*.65*(1+bonus/100));
  ({sim,f}=idle(ctx,bonus,3));advance(sim,1);near(f.stamina,50+(15.75+3)*.65*(1+bonus/100));
  ({sim,f}=idle(ctx,bonus));f.stamina=99;advance(sim,1);near(f.stamina,100);
  ({sim,f}=idle(ctx,bonus));f.regenDelay=2;advance(sim,1);near(f.stamina,50);
 }
 let {sim,f}=idle(ctx,12);f.shield=true;f.shieldStyle='secutor';advance(sim,1,true);near(f.stamina,50+4*.75*.65*1.12-3);
 ({sim,f}=idle(ctx,12));f.cooldown=0;assert.equal(sim.attack(0),true);const spent=f.stamina;advance(sim,.2);near(f.stamina,spent);
 ({sim,f}=idle(ctx,12));assert.equal(sim.dodge(0,1,0),true);near(f.stamina,25);advance(sim,.2);near(f.stamina,25);
 ({sim,f}=idle(ctx,12));assert.equal(f.combatStaminaBonus,12);ctx.LudusLoadout.apply(f,{class:'secutor',combat_stamina_bonus:12},[]);assert.equal(f.combatStaminaBonus,12);
 ({f}=idle(ctx,999));assert.equal(f.combatStaminaBonus,12);({f}=idle(ctx,-4));assert.equal(f.combatStaminaBonus,0);
}
async function main(){
 const db=new PGlite(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const migrate=async name=>db.exec(fs.readFileSync(root+'/supabase/migrations/'+fs.readdirSync(root+'/supabase/migrations').find(f=>f.endsWith('_'+name+'.sql')),'utf8'));
 await db.exec(fs.readFileSync(root+'/tests/fixtures/gladiator-v46.sql','utf8'));
 await db.exec(`create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt()to authenticated;alter table ludus_accounts add column username text,add column ludus_name text;`);
 await db.exec(fs.readFileSync(root+'/ludus-multiplayer-v36.sql','utf8'));
 for(const name of ['gladiator_exercise_v46','targeted_training_v51','dining_food_v55','dining_meals_v56','dining_nutrition_v57','dining_recovery_v58','dining_recovery_balance_v59'])await migrate(name);
 await q('insert into ludus_accounts(user_id,gold)values($1,10000),($2,10000)',[A,B]);
 const ga=(await q("insert into ludus_gladiators(owner_id,name,class)values($1,'Alpha','secutor')returning id",[A]))[0].id;
 const gb=(await q("insert into ludus_gladiators(owner_id,name,class)values($1,'Beta','murmillo')returning id",[B]))[0].id;
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);await q('select ludus_food_state()');
 await q("update ludus_food_private.recovery_policy_v59 set starts_at=clock_timestamp()-interval'1 day'");
 await q("update ludus_gladiators set fatigue_value=60,fatigue_rest_from=clock_timestamp()-interval'2 hours'where id=$1",[ga]);
 await migrate('combat_food_stamina_v60');let g=(await q('select * from ludus_gladiators where id=$1',[ga]))[0];near(g.fatigue_value,47,.03);assert.equal(Number(g.recovery_rate),10);assert.equal(g.recovery_rate_until,null);
 const cut=(await q('select starts_at from ludus_food_private.combat_policy_v60'))[0].starts_at;
 await migrate('combat_food_stamina_v60');assert.equal((await q('select starts_at from ludus_food_private.combat_policy_v60'))[0].starts_at.toISOString(),cut.toISOString());near((await q('select fatigue_value from ludus_gladiators where id=$1',[ga]))[0].fatigue_value,47,.03);
 for(const [stock,bonus,tier]of [[{grain:5},4,'basic'],[{egg:5},8,'supported'],[{egg:2,apple:4},12,'balanced'],[{meal:1},12,'balanced'],[{egg:1,apple:1},0,'insufficient']]){
  const m=(await q('select ludus_food_private.menu_v55(1,$1)as m',[JSON.stringify(Object.entries(stock).map(([sku,quantity])=>({sku,quantity})))]))[0].m;
  assert.equal(m.stamina_bonus_percent,bonus);assert.equal(m.recovery_bonus_percent,0);assert.equal(m.menu_tier,tier);
 }
 // The prior menu determines today's buff. Buying food only changes tomorrow's forecast.
 await db.exec('set role authenticated');let s=(await q("select ludus_food_buy('meal',1,gen_random_uuid())as s"))[0].s;
 assert.equal(s.combat.active_bonus,0);assert.equal(s.combat.forecast_bonus,12);assert.equal(s.recovery.active_bonus,0);assert.equal(s.recovery.base_rate,10);
 await db.exec('reset role');await q('update ludus_food_house set settled_day=settled_day-1 where owner_id=$1',[A]);await db.exec('set role authenticated');s=(await q('select ludus_food_state()as s'))[0].s;
 assert.equal(s.combat.active_bonus,12);assert.equal(s.items.find(i=>i.sku==='meal').quantity,0);assert.equal(s.menu.stamina_bonus_percent,0);assert.equal(s.gold,9970);
 s=(await q("select ludus_food_buy('grain',5,gen_random_uuid())as s"))[0].s;assert.equal(s.combat.active_bonus,12);assert.equal(s.combat.forecast_bonus,4);
 // Actual owner-validated PvE and PvP entry points freeze food buffs in server snapshots.
 const request=(await q('select gen_random_uuid()as id'))[0].id;
 let ticket=(await q("select ludus_start_battle_v2($1,'4x5','{}',$2)as s",[ga,request]))[0].s;assert.equal(ticket.snapshot.gladiator.combat_stamina_bonus,12);
 const retry=(await q("select ludus_start_battle_v2($1,'4x5','{}',$2)as s",[ga,request]))[0].s;assert.deepEqual(retry,ticket);
 await assert.rejects(()=>q("select ludus_start_battle_v2($1,'4x5','{}',gen_random_uuid())",[gb]),/savaşın var|bulunamadı/);
 await db.exec('reset role');await q('update ludus_battles set finished_at=clock_timestamp()where id=$1',[ticket.id]);await db.exec('set role authenticated');
 let match=(await q("select ludus_match('join',null,$1,'{}','{\"combat_stamina_bonus\":999}')as s",[ga]))[0].s;
 assert.equal(match.players.find(p=>p.owner===A).gladiator.combat_stamina_bonus,12);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);s=(await q('select ludus_food_state()as s'))[0].s;assert.equal(s.combat.active_bonus,0);
 match=(await q("select ludus_match('join',null,$1,'{}','{\"combat_stamina_bonus\":999}')as s",[gb]))[0].s;
 assert.equal(match.players.find(p=>p.owner===B).gladiator.combat_stamina_bonus,0);assert.equal(match.players.find(p=>p.owner===A).gladiator.combat_stamina_bonus,12);
 await assert.rejects(()=>q('select ludus_food_private.combat_bonus_v60($1)',[A]),/permission denied/);await assert.rejects(()=>q('select * from ludus_food_private.combat_policy_v60'),/permission denied/);
 await db.exec('reset role');
 await q("update ludus_matches set status='playing',players=jsonb_set(players,'{1,stamina}','50')where id=$1",[match.id]);
 await db.exec('set role authenticated');
 match=(await q("select ludus_match('step',$1,null,'{}','{\"combat_stamina_bonus\":999,\"stamina\":100,\"gladiator\":{\"combat_stamina_bonus\":999}}')as s",[match.id]))[0].s;
 const own=match.players.find(p=>p.owner===B);assert.equal(own.gladiator.combat_stamina_bonus,0);assert.ok(own.stamina<75);assert.equal(match.players.find(p=>p.owner===A).gladiator.combat_stamina_bonus,12);
 await db.exec('reset role');
 // Use the real multiplayer integrator with exact timestamps, no wall-clock approximation.
 const at='2026-10-10T12:00:00Z',later='2026-10-10T12:00:01Z';
 const fighter=bonus=>({owner:A,hp:100,stamina:50,stamina_at:at,gladiator:{combat_stamina_bonus:bonus},x:0,z:0});
 const step=async p=>(await q('select private.ludus_advance_combat_v36($1,$2)as p',[JSON.stringify([p]),later]))[0].p[0];
 for(const bonus of [0,4,8,12]){const p=await step(fighter(bonus));near(p.stamina,50+16*.65*(1+bonus/100));}
 near((await step({...fighter(12),stamina:99})).stamina,100);
 near((await step({...fighter(12),block:true})).stamina,48);
 for(const key of ['swing_end','dodge_until','stamina_regen_at'])near((await step({...fighter(12),[key]:'2026-10-10T12:00:02Z'})).stamina,50);
 near((await step(fighter(999))).stamina,50+16*.65*1.12);near((await step(fighter(-4))).stamina,50+16*.65);
 // An interval crossing the correction preserves V59's already-earned food bonus.
 await q("update ludus_food_private.combat_policy_v60 set starts_at=clock_timestamp()-interval'1 hour'");
 await q("update ludus_food_private.recovery_policy_v59 set starts_at=clock_timestamp()-interval'1 day'");
 await q('delete from ludus_food_history where owner_id=$1',[A]);
 await q(`insert into ludus_food_history(owner_id,from_day,to_day,crew_count,menu)values($1,(now()at time zone'Europe/Istanbul')::date-3,(now()at time zone'Europe/Istanbul')::date-1,1,'{"coverage":100,"quality":100,"recovery_bonus_percent":12}')`,[A]);
 await q("update ludus_gladiators set fatigue_value=60,fatigue_rest_from=clock_timestamp()-interval'2 hours'where id=$1",[ga]);
 await q('select ludus_private.exercise_recover_v46($1)',[ga]);near((await q('select fatigue_value from ludus_gladiators where id=$1',[ga]))[0].fatigue_value,60-7.28-10,.03);
 // Idle recovery is restored, independent of consumed menu, with the historical cutover preserved.
 await q("update ludus_food_private.combat_policy_v60 set starts_at=clock_timestamp()-interval'1 day'");
 await q("update ludus_gladiators set fatigue_value=60,fatigue_rest_from=clock_timestamp()-interval'2 hours',status='injured',injured_until=clock_timestamp()+interval'12 hours'where id=$1",[ga]);
 await q('select ludus_private.exercise_recover_v46($1)',[ga]);g=(await q('select * from ludus_gladiators where id=$1',[ga]))[0];near(g.fatigue_value,40,.03);assert.equal(g.status,'injured');assert.equal(Number(g.recovery_rate),10);
 await q('select ludus_private.exercise_recover_v46($1)',[ga]);near((await q('select fatigue_value from ludus_gladiators where id=$1',[ga]))[0].fatigue_value,40,.03);
 await q("update ludus_gladiators set fatigue_value=60,fatigue_rest_from=clock_timestamp()+interval'2 hours'where id=$1",[ga]);await q('select ludus_private.exercise_recover_v46($1)',[ga]);near((await q('select fatigue_value from ludus_gladiators where id=$1',[ga]))[0].fatigue_value,60);
 await q("update ludus_gladiators set fatigue_value=5,fatigue_rest_from=clock_timestamp()-interval'2 hours'where id=$1",[ga]);await q('select ludus_private.exercise_recover_v46($1)',[ga]);near((await q('select fatigue_value from ludus_gladiators where id=$1',[ga]))[0].fatigue_value,0);
 const now=Date.now();near(ui.energy({fatigue_value:60,fatigue_rest_from:new Date(now-7200000).toISOString(),recovery_rate:7.28},now),60);near(ui.recoveryRate({recovery_rate:7.28},now),10);
 await db.close();console.log(JSON.stringify({combatBaseReduction:35,menuBonuses:[4,8,12],clientPages:3,equipmentRegenScaled:true,combatCostsAndDelaysPreserved:true,multiplayerAuthoritative:true,serverSnapshots:true,purchaseForecastOnly:true,consumedFoodActivates:true,ownerIsolation:true,privatePermissions:true,idleRecovery:10,pastEnergyPreserved:true,idempotentMigration:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
