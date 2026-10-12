const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {runtime,database,core}=require('./combat-stats-v73.cjs');
const survival=require('../survival-v83.js');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
async function main(){
 const c=runtime();survival.install(c.ArenaCombat);
 const s=new c.ArenaCombat(()=>.6).reset('normal','secutor','survival');s.botStep=()=>{};
 assert.equal(s.fighters.length,1);assert.equal(s.allowDrops,false);
 for(let i=0;i<299;i++)s.tick(1/60);assert.equal(s.survival.stage,0);assert.equal(s.finished,false);
 s.tick(1/60);assert.equal(s.survival.stage,1);assert.equal(s.fighters.length,2);
 const p=s.fighters[0];p.hp=83;p.stamina=45;p.regenDelay=1000;
 for(let stage=1;stage<=310;stage++){
  assert.equal(s.survival.stage,stage);
  const expected=stage%10===0?stage/10:1;
  assert.equal(s.fighters.length,expected+1,'stage '+stage);
  for(const f of s.fighters.slice(1)){assert.equal(s.nearest(f).id,0);assert.equal(s.enemy(f,p),true);for(const rival of s.fighters.slice(1))assert.equal(s.enemy(f,rival),false);}
  // Partial milestone clears must not advance the wave.
  if(expected>1){s.fighters[1].hp=0;s.tick(1/60);assert.equal(s.survival.stage,stage);}
  for(const f of s.fighters.slice(1))f.hp=0;
  s.tick(1/60);assert.equal(s.survival.stage,stage+1);assert.equal(s.finished,false);assert.equal(s.fighters[0],p);assert.equal(p.hp,83);assert.equal(p.stamina,45);
 }
 assert.equal(s.survival.completed,310);assert.equal(s.survival.stage,311);
 p.hp=0;s.tick(1/60);assert.equal(s.result,'loss');assert.equal(s.survival.stage,311);assert.equal(s.drain().filter(e=>e.type==='finish').length,1);
 // Both original modes still finish normally.
 for(const mode of ['4x5','solo20']){const sim=new c.ArenaCombat().reset('normal','secutor',mode);sim.botStep=()=>{};for(const f of sim.fighters.slice(1))f.hp=0;sim.tick(.01);assert.equal(sim.result,'win');assert.equal(sim.survival,null);}
 for(const page of ['arena.html','savas.html','index.html','ludus.html'])for(const m of fs.readFileSync(page,'utf8').matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type=["'](?:application\/json|importmap)/.test(m[1]))new vm.Script(m[2]);
 const db=await database(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const migration=fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_survival_v83.sql')),'utf8');
 await db.exec(migration);await db.exec(migration);
 await q("insert into ludus_accounts(user_id,username,ludus_name)values($1,'alpha','Ludus Alpha'),($2,'beta','Ludus Beta')",[A,B]);
 const g=(await q("insert into ludus_gladiators(owner_id,name,class,stat_version,base_stats)values($1,'Cassius','secutor',46,$2)returning id",[A,JSON.stringify(core)]))[0].id;
 const item=(await q("insert into ludus_items(owner_id,kind,model,equipped_by,equipped_slot,enhancement)values($1,'weapon','gladius',$2,'main_hand',7)returning id",[A,g]))[0].id;
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 assert.equal((await q('select ludus_survival_record_v83() r'))[0].r,null);
 const request=(await q('select gen_random_uuid() id'))[0].id;
 const start=async()=> (await q("select ludus_start_battle_v2($1,'survival',$2,$3) r",[g,JSON.stringify({main_hand:item}),request]))[0].r;
 const ticket=await start();assert.equal(ticket.mode,'survival');assert.equal((await start()).id,ticket.id);
 assert.equal((await q('select locked_battle_id from ludus_items where id=$1',[item]))[0].locked_battle_id,ticket.id);
 await q("update ludus_battles set started_at=now()-interval '1000 seconds' where id=$1",[ticket.id]);
 const result={survival_stage:61,survival_completed:60,kills:75,seconds:500,alive:false,gladiator_name:'FORGED'};
 const finish=async(stats=result)=>(await q('select ludus_finish_battle_v2($1,false,$2) r',[ticket.id,JSON.stringify(stats)]))[0].r;
 await assert.rejects(()=>finish({...result,kills:2}),/ilerlemesi/);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await assert.rejects(finish,/bulunamadı/);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const receipt=await finish();assert.equal(receipt.stage,61);assert.equal(receipt.completed,60);assert.equal(receipt.gear_lost,false);assert.equal(receipt.new_record,true);assert.equal(receipt.gold,0);
 assert.deepEqual(await finish({survival_stage:1000}),receipt,'lost response cannot settle twice');
 const gear=(await q('select enhancement,locked_battle_id,equipped_by from ludus_items where id=$1',[item]))[0];assert.equal(gear.enhancement,7);assert.equal(gear.locked_battle_id,null);assert.equal(gear.equipped_by,g);
 const record=(await q('select ludus_survival_record_v83() r'))[0].r;assert.equal(record.stage,61);assert.equal(record.ludus_name,'Ludus Alpha');assert.equal(record.gladiator_name,'Cassius');assert.equal(record.gladiator_class,'secutor');
 assert.deepEqual((await q('select gold,wins,losses from ludus_accounts where user_id=$1',[A]))[0],{gold:0,wins:0,losses:0});
 const grants=(await q("select has_function_privilege('anon','public.ludus_survival_record_v83()','execute') anon,has_function_privilege('authenticated','ludus_private.finish_survival_v83(uuid,jsonb)','execute') private,has_table_privilege('authenticated','ludus_private.survival_records_v83','insert') write"))[0];assert.deepEqual(grants,{anon:false,private:false,write:false});
 // Start snapshot carries current global record; abandon unlocks equipment and retains best.
 const second=(await q("select ludus_start_battle_v2($1,'survival',$2,gen_random_uuid()) r",[g,JSON.stringify({main_hand:item})]))[0].r;assert.equal(second.snapshot.survival_record.stage,61);
 const abandoned=(await q("select ludus_finish_battle_v2($1,false,'{\"abandoned\":true}') r",[second.id]))[0].r;assert.equal(abandoned.gear_lost,false);assert.equal(abandoned.stage,0);
 assert.equal((await q('select ludus_survival_record_v83() r'))[0].r.stage,61);
 await db.close();console.log(JSON.stringify({stagesChecked:310,firstSpawnSeconds:5,allEnemiesTargetPlayer:true,noStageHealing:true,partialWaveWaits:true,oneDeathSettlement:true,standardModes:true,scriptSyntax:true,migrationRepeatable:true,ownership:true,receiptRetries:true,equipmentPreserved:true,recordSnapshot:true,abandon:true,permissions:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
