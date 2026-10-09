const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite'),ui=require('../gladiator-exercise-v46.js'),root=path.resolve(__dirname,'..');
const owner='00000000-0000-4000-8000-000000000001',near=(a,b)=>assert.ok(Math.abs(Number(a)-Number(b))<.00001,`${a} != ${b}`);
(async()=>{
 const db=new PGlite();await db.exec(fs.readFileSync(root+'/tests/fixtures/gladiator-v46.sql','utf8'));await db.query('insert into ludus_accounts(user_id)values($1)',[owner]);
 for(const name of ['gladiator_exercise_v46','targeted_training_v51']){const file=fs.readdirSync(root+'/supabase/migrations').find(f=>f.endsWith('_'+name+'.sql'));await db.exec(fs.readFileSync(root+'/supabase/migrations/'+file,'utf8'));if(name.endsWith('v51'))await db.exec(fs.readFileSync(root+'/supabase/migrations/'+file,'utf8'));}
 await db.exec('create trigger test_new_gladiator before insert on public.ludus_gladiators for each row execute function ludus_private.v7_new_gladiator()');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 for(const [stat]of ui.attributes)for(const cap of [false,true]){
  const g=(await db.query("insert into ludus_gladiators(owner_id,name,class)values($1,$2,'murmillo')returning *",[owner,stat])).rows[0];
  if(cap){g.base_stats[stat]=99.4;await db.query('update ludus_gladiators set base_stats=$2,overall=ludus_private.exercise_mean_v46($2)where id=$1',[g.id,g.base_stats]);}
  // One prior real completed match must not dilute the selected training target.
  const ticket=(await db.query("select ludus_start_battle_v2($1,'solo20','{}',$2)as value",[g.id,randomUUID()])).rows[0].value;
  await db.query("update ludus_battles set started_at=now()-interval '20 seconds'where id=$1",[ticket.id]);await db.query("select ludus_finish_battle_v2($1,false,'{\"alive\":false,\"abandoned\":false}')",[ticket.id]);
  const req=randomUUID();await db.query('select ludus_train_exercise($1,$2,$3)',[[g.id],stat,req]);await db.query('select ludus_train_exercise($1,$2,$3)',[[g.id],stat,req]);
  await db.query("update ludus_training_sessions set train_until=now()-interval '1 second'where gladiator_id=$1",[g.id]);await db.query('select ludus_training_state()');
  const result=(await db.query('select * from ludus_gladiators where id=$1',[g.id])).rows[0];for(const [key,value]of Object.entries(g.base_stats))near(result.base_stats[key],key===stat?Math.min(100,value+3.5):value);
  const before=result.base_stats;await db.query('select ludus_training_state()');assert.deepEqual((await db.query('select base_stats from ludus_gladiators where id=$1',[g.id])).rows[0].base_stats,before);
 }
 // All-stat activities still redistribute at the cap; training alone clamps.
 const stats={...ui.profile('murmillo'),muscle:99.4};const result=(await db.query("select ludus_private.exercise_adjust_v46($1,3.5,'{}')as value",[stats])).rows[0].value;near(ui.mean(result),ui.mean(stats)+.5);
 await db.exec('set role authenticated');await assert.rejects(()=>db.query("select ludus_private.exercise_complete_v46('training',gen_random_uuid(),gen_random_uuid(),3,'muscle',now())"),/permission denied/);await db.exec('reset role');
 await db.close();console.log(JSON.stringify({selectedStatOnly:7,capIsolation:7,mixedBattleTraining:true,retrySafe:true,repeatableMigration:true,privateFunction:true}));
})().catch(e=>{console.error(e);process.exit(1);});
