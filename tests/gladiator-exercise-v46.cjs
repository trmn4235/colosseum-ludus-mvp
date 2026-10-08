// Real PostgreSQL functions and triggers, isolated from production accounts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const ui=require('../gladiator-exercise-v46.js'),root=path.resolve(__dirname,'..');
const migration=fs.readdirSync(root+'/supabase/migrations').find(f=>f.endsWith('_gladiator_exercise_v46.sql'));
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const near=(a,b,t=.00001)=>assert.ok(Math.abs(Number(a)-Number(b))<t,`${a} ≈ ${b}`);
(async()=>{
 const db=new PGlite();await db.exec(fs.readFileSync(root+'/tests/fixtures/gladiator-v46.sql','utf8'));
 await db.query('insert into public.ludus_accounts(user_id)values($1),($2)',[owner,other]);
 await db.query("insert into public.ludus_gladiators(owner_id,name,class,overall)values($1,'Önceki eğitim','murmillo',63)",[owner]);
 await db.exec(fs.readFileSync(root+'/supabase/migrations/'+migration,'utf8'));
 near((await db.query("select overall from public.ludus_gladiators where name='Önceki eğitim'")).rows[0].overall,63);
 await db.exec('create trigger test_new_gladiator before insert on public.ludus_gladiators for each row execute function ludus_private.v7_new_gladiator()');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const glads=[];
 for(const cls of Object.keys(ui.profiles)){
  const g=(await db.query('insert into public.ludus_gladiators(owner_id,name,class)values($1,$2,$2)returning *',[owner,cls])).rows[0];glads.push(g);
  near(g.overall,50);assert.deepEqual(g.base_stats,ui.profile(cls));assert.equal(Object.keys(g.base_stats).length,7);
  for(const value of Object.values(g.base_stats))assert.ok(value>=47&&value<=53);
 }
 const g=glads[0],h=glads[1],get=async id=>(await db.query('select * from public.ludus_gladiators where id=$1',[id])).rows[0];
 const state=async()=>(await db.query('select public.ludus_training_state()as value')).rows[0].value;
 const request=()=>require('node:crypto').randomUUID();
 const train=async(ids,stat='muscle',req=request())=>(await db.query('select public.ludus_train_exercise($1,$2,$3)as value',[ids,stat,req])).rows[0].value;
 const batchRequest=request();await train([g.id,h.id],'muscle',batchRequest);await train([g.id,h.id],'muscle',batchRequest);
 assert.equal((await db.query('select count(*)::int as n from public.ludus_training_sessions')).rows[0].n,2);
 near((await get(g.id)).fatigue_value,30);assert.equal((await get(g.id)).status,'training');
 await assert.rejects(()=>train([g.id]),/antrenmana uygun|hakkını/);
 await db.exec("update public.ludus_training_sessions set train_until=now()-interval '1 second',rest_until=now()+interval '1 hour'");
 await state();let current=await get(g.id);near(current.base_stats.muscle,g.base_stats.muscle+3.5);near(current.overall,50.5);
 const again=await state();near(again.gladiators.find(x=>x.id===g.id).overall,50.5);assert.equal(again.gladiators.find(x=>x.id===g.id).exercise_units,3);
 await assert.rejects(()=>train([g.id]),/antrenmana uygun|hakkını/);
 const bglad=glads[2];
 const battle=async(id,abandoned=false)=>{
  const ticket=(await db.query('select public.ludus_start_battle_v2($1,$2,$3,$4)as value',[id,'solo20',{},request()])).rows[0].value;
  await db.query("update public.ludus_battles set started_at=now()-interval '20 seconds'where id=$1",[ticket.id]);
  const finish=()=>db.query('select public.ludus_finish_battle_v2($1,false,$2)as value',[ticket.id,{alive:false,exit_slots:{},abandoned}]);
  const result=(await finish()).rows[0].value;await finish();return result;
 };
 await battle(bglad.id);assert.equal((await state()).gladiators.find(x=>x.id===bglad.id).exercise_units,1);
 await battle(bglad.id);near((await get(bglad.id)).overall,50);await battle(bglad.id);
 current=await get(bglad.id);near(current.overall,50.5);for(const [key,value]of Object.entries(bglad.base_stats))near(current.base_stats[key],value+.5);
 await battle(bglad.id,true);near((await get(bglad.id)).overall,50.5);
 assert.equal((await state()).gladiators.find(x=>x.id===bglad.id).exercise_units,3);
 // Exact boundary: 30% remaining energy has zero risk; below it has 25% risk.
 const testID=request();await db.query("update public.ludus_gladiators set fatigue_value=70,fatigue=70,fatigue_rest_from=now()+interval '1 hour'where id=$1",[glads[3].id]);
 await db.query("select ludus_private.exercise_prepare_v46('test',$1,$2,$3,20,now())",[testID,glads[3].id,owner]);
 assert.equal(Number((await db.query('select injury_risk from ludus_private.exercise_events_v46 where source_id=$1',[testID])).rows[0].injury_risk),0);
 const injuryID=request(),ig=glads[4];await db.query("update public.ludus_gladiators set fatigue_value=71,fatigue=71,fatigue_rest_from=now()+interval '1 hour'where id=$1",[ig.id]);
 await db.query("select ludus_private.exercise_prepare_v46('test',$1,$2,$3,20,now())",[injuryID,ig.id,owner]);
 near((await db.query('select injury_risk from ludus_private.exercise_events_v46 where source_id=$1',[injuryID])).rows[0].injury_risk,.25);
 let seed;for(const s of Array.from({length:100},(_,i)=>-.99+i*.02)){await db.query('select setseed($1)',[s]);if(Number((await db.query('select random()as r')).rows[0].r)<.25){seed=s;break;}}assert.notEqual(seed,undefined);await db.query('select setseed($1)',[seed]);
 await db.query("select ludus_private.exercise_complete_v46('test',$1,$2,0,null,now())",[injuryID,ig.id]);
 current=await get(ig.id);near(current.overall,45);assert.equal(current.status,'injured');for(const [key,value]of Object.entries(ig.base_stats))near(current.base_stats[key],value-5);
 await db.query("select ludus_private.exercise_complete_v46('test',$1,$2,0,null,now())",[injuryID,ig.id]);near((await get(ig.id)).overall,45);
 await assert.rejects(()=>train([ig.id]),/antrenmana uygun/);
 await db.query("update public.ludus_gladiators set injured_until=now()-interval '1 second',fatigue_rest_from=now()-interval '2 hours',fatigue_value=60,fatigue=60 where id=$1",[ig.id]);
 await state();current=await get(ig.id);near(current.fatigue_value,40,.01);assert.equal(current.status,'available');near(current.overall,45);
 // Easy mission credits all seven stats on completion, not on reward collection.
 const mg=glads[5],mission=request();await db.query("insert into public.ludus_imperial_assignments(id,owner_id,mission,gladiators,ends_at)values($1,$2,'{\"difficulty\":1}',$3,now()+interval '12 hours')",[mission,owner,JSON.stringify([{id:mg.id}])]);
 near((await get(mg.id)).fatigue_value,20);await db.query("update public.ludus_imperial_assignments set ends_at=now()-interval '1 second',completed_at=now()where id=$1",[mission]);near((await get(mg.id)).overall,50.5);
 await db.query('update public.ludus_imperial_assignments set completed_at=now()where id=$1',[mission]);near((await get(mg.id)).overall,50.5);
 // PvP only charges actual combat; waiting does not consume energy.
 const pvpID=request(),pg=glads[6];
 // The trigger derives ownership from server snapshots.
 const pvpPlayers=JSON.stringify([{owner,gladiator:{id:pg.id},hp:100}]);
 await db.query("insert into public.ludus_matches(id,status,players)values($1,'waiting',$2)",[pvpID,pvpPlayers]);near((await get(pg.id)).fatigue_value,0);
 await db.query("update public.ludus_matches set status='playing'where id=$1",[pvpID]);near((await get(pg.id)).fatigue_value,20);
 await db.query("update ludus_private.exercise_events_v46 set started_at=now()-interval '20 seconds'where source_id=$1",[pvpID]);
 await db.query("update public.ludus_matches set status='finished'where id=$1",[pvpID]);assert.equal((await state()).gladiators.find(x=>x.id===pg.id).exercise_units,1);
 await db.query("update public.ludus_matches set status='finished'where id=$1",[pvpID]);assert.equal((await state()).gladiators.find(x=>x.id===pg.id).exercise_units,1);
 // Caps redistribute growth; no lost gains, no value above 100.
 const capped=await db.query("select ludus_private.exercise_adjust_v46($1,3.5,'{\"muscle\":1}')as stats",[{...ui.profile('murmillo'),muscle:99}]);
 near(capped.rows[0].stats.muscle,100);near(ui.mean(capped.rows[0].stats),ui.mean({...ui.profile('murmillo'),muscle:99})+.5);
 for(const [overall,budget]of [[50,3.5],[60,2.8],[70,2.24],[80,3.5/2.34375],[90,3.5/3.515625]])near((await db.query('select ludus_private.exercise_budget_v46($1)as n',[overall])).rows[0].n,budget);
 // Foreign ownership and all-or-nothing batches.
 const foreign=(await db.query("insert into public.ludus_gladiators(owner_id,name,class)values($1,'Yabancı','secutor')returning id",[other])).rows[0].id;
 const sessionsBefore=(await db.query('select count(*)::int as n from public.ludus_training_sessions')).rows[0].n;
 await assert.rejects(()=>train([glads[6].id,foreign]),/kendi gladyatör/);assert.equal((await db.query('select count(*)::int as n from public.ludus_training_sessions')).rows[0].n,sessionsBefore);
 await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(state,/Giriş/);
 await db.exec('set role anon');await assert.rejects(state,/permission denied/);await db.exec('reset role;set role authenticated');
 await assert.rejects(()=>db.query('select * from ludus_private.exercise_days_v46'),/permission denied/);
 await assert.rejects(()=>db.query("select ludus_private.exercise_prepare_v46('test',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),20,now())"),/permission denied/);await db.exec('reset role');
 await db.close();console.log(JSON.stringify({classes:7,initialOverall:50,preservedProgress:true,threeBattleDailyCap:true,targetedAndBulkTraining:true,easyMissionCredit:true,injuryChance:.25,injuryOverallDrop:5,restPerHour:10,idempotency:true,ownership:true}));
})().catch(e=>{console.error(e.message,e.where||e.stack);process.exit(1);});
