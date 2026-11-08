const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture,id}=require('./rankings-v200.cjs');
const dir=path.join(__dirname,'../supabase/migrations');
const read=suffix=>fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>f.endsWith(suffix))),'utf8');

(async()=>{
 const db=await fixture();
 try{
  const A=id(1),B=id(2),C=id(3),G=id(11),H=id(12);
  for(const [u,n] of [[A,'Aquila'],[B,'Roma'],[C,'Nova']])await db.query('insert into ludus_accounts values($1,$2,$3)',[u,n,'Ludus '+n]);
  await db.query("insert into ludus_gladiators values($1,$2,'Gladyatör A','murmillo',50),($3,$4,'Gladyatör B','thraex',50)",[G,A,H,B]);
  await db.exec(read('_imperial_rankings_v203.sql'));
  await db.query("insert into ludus_career_private.battles values($1,$2,'solo20',true,$3,now())",[id(91),G,{game_mode:'solo20',kills:1,alive:true}]);
  const players=[{owner:A,gladiator:{id:G},career:{kills:1,deaths:0}},{owner:B,gladiator:{id:H},career:{kills:0,deaths:1}}];
  await db.query("insert into ludus_matches values($1,'finished',$2,now()-interval '1 minute',$3,now(),'arena')",[id(100),players,A]);
  await db.query("insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,category,outcome,points,played_at) values('battle',$1,$2,$2,'naval',1,10,now())",[id(300),A]);
  const board=async(category,version=203)=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);return(await db.query(`select public.ludus_rankings_v${version}('players',$1) data`,[category])).rows[0].data;};
  assert.equal((await board('colosseum')).own.score,1540,'legacy board initially assigns 20 to each win');
  await db.exec(read('_ranked_points_v247.sql'));
  assert.equal((await board('multiplayer',200)).own.score,1510,'existing online win is corrected to +10');
  assert.equal((await board('colosseum')).own.score,1530,'combined board uses +20 solo and +10 online');
  assert.equal((await board('naval')).own.score,1520,'naval formula is unchanged');
  assert.equal((await board('multiplayer',200)).rows.find(r=>r.id===B).score,1495,'existing loss stays -5');
  await db.query("insert into ludus_matches values($1,'finished',$2,now()-interval '1 minute',$3,now(),'arena')",[id(101),players,B]);
  let b=await board('multiplayer',200);assert.equal(b.own.score,1505);assert.equal(b.rows.find(r=>r.id===B).score,1505);
  assert.equal(b.rows.find(r=>r.id===C).score,1500,'players with no matches start at 1500');
  await db.exec("select ludus_rank_private.archive_match(to_jsonb(m)) from public.ludus_matches m");
  await db.exec(read('_ranked_points_v247.sql'));
  b=await board('multiplayer',200);assert.equal(b.own.score,1505,'replays and migration retries are idempotent');
  const grant=(await db.query("select has_function_privilege('anon','ludus_rank_private.board_v203(text,text,text,text,uuid,text,integer,integer,uuid)','execute') anon,has_function_privilege('authenticated','ludus_rank_private.board_v203(text,text,text,text,uuid,text,integer,integer,uuid)','execute') auth")).rows[0];
  assert.equal(grant.anon,false);assert.equal(grant.auth,true);
  console.log('PASS V247: +10/-5 multiplayer scoring, 1500 start, historic correction, unchanged solo/naval, idempotence and grants.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
