const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const root=require('node:path').join(__dirname,'..');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',R='00000000-0000-4000-8000-000000000003';
async function main(){
 const db=new PGlite();await db.waitReady;
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.ludus_accounts(user_id uuid primary key,username text,ludus_name text);
 create table public.ludus_gladiators(id uuid primary key,owner_id uuid,name text,class text,status text);
 create table public.ludus_items(id uuid primary key,owner_id uuid,kind text,model text,locked_battle_id uuid,clan_vault_id uuid,clan_roster_id uuid);
 create table public.ludus_matches(id uuid primary key default gen_random_uuid(),status text default 'waiting',players jsonb default '[]',starts_at timestamptz default clock_timestamp()+interval '10 seconds',winner uuid,created_at timestamptz default clock_timestamp(),updated_at timestamptz default clock_timestamp());`);
 const migration=fs.readFileSync(root+'/ludus-v23.sql','utf8');await db.exec(migration);await db.exec(migration);
 const t='2026-10-06T18:00:00.000Z',impact='2026-10-06T18:00:00.370Z';
 function players(){return [
  {owner:A,x:0,z:0,angle:0,hp:100,serial:1,swing_at:t,strike_at:impact,strike_target:B,strike_weapon:'gladius',items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'}],block:false},
  {owner:B,x:0,z:1.25,angle:Math.PI,hp:100,serial:0,items:[{kind:'shield',equipped_slot:'off_hand'}],block:false}
 ];}
 async function resolve(p,now='2026-10-06T18:00:00.400Z'){
  const q=await db.query('select public.ludus_resolve_combat_v23($1::jsonb,$2::timestamptz) as p',[JSON.stringify(p),now]);return q.rows[0].p;
 }
 let p=await resolve(players(),'2026-10-06T18:00:00.200Z');assert.equal(p[1].hp,100,'no immediate button damage');
 p=await resolve(p);assert.equal(p[1].hp,86);assert.equal((await resolve(p))[1].hp,86,'one strike only');
 p=players();Object.assign(p[1],{block:true,guard_at:'2026-10-06T18:00:00.300Z'});p=await resolve(p);
 assert.equal(p[1].hp,100);assert.equal(p[1].last_defense,'perfect');assert.equal(p[1].counter_target,A);assert.ok(p[0].stagger_until);assert.equal(p[1].guard_at,null);
 p=players();Object.assign(p[1],{block:true,guard_at:t});p=await resolve(p);assert.equal(p[1].last_defense,'block');assert.equal(p[1].counter_target,undefined);
 p=players();Object.assign(p[1],{block:true,guard_at:t,angle:0});p=await resolve(p);assert.equal(p[1].hp,86,'back attacks bypass guard');
 p=players();Object.assign(p[1],{block:true,guard_at:t,items:[]});p=await resolve(p);assert.equal(p[1].hp,86,'no phantom shield');
 p=players();p[1].z=5;p=await resolve(p);assert.equal(p[1].hp,100,'reach respected');
 p=players();p[0].strike_counter=true;p=await resolve(p);assert.equal(p[1].hp,83,'counter damage is temporary');
 const now=(await db.query('select clock_timestamp() as t')).rows[0].t;
 p=players();for(const x of p){delete x.strike_at;delete x.swing_at;x.serial=0;x.seen=now;x.tick_at=now;}
 await db.query('insert into public.ludus_accounts(user_id)values($1),($2)',[A,B]);
 await db.query("insert into public.ludus_matches(id,status,players)values($1,'playing',$2::jsonb)",[R,JSON.stringify(p)]);
 const as=async u=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);
 const call=async (action,input={})=>(await db.query("select public.ludus_match($1,$2,null,'{}'::jsonb,$3::jsonb) as r",[action,R,JSON.stringify(input)])).rows[0].r;
 await as(A);let result=await call('step',{attack:true,attack_id:'first-attack',target:B,x:0,z:0});assert.equal(result.combat_version,23);assert.equal(result.players[0].serial,1);assert.equal(result.players[1].hp,100);
 await db.query("update public.ludus_matches set players=jsonb_set(players,'{0,strike_at}',to_jsonb(clock_timestamp()-interval '1 millisecond'))where id=$1",[R]);
 result=await call('state');assert.equal(result.players[1].hp,86);
 await db.query("update public.ludus_matches set players=jsonb_set(jsonb_set(players,'{0,cooldown_until}',to_jsonb(clock_timestamp()-interval '1 second')),'{0,swing_end}',to_jsonb(clock_timestamp()-interval '1 second'))where id=$1",[R]);
 result=await call('step',{attack:true,attack_id:'first-attack',target:B});assert.equal(result.players[0].serial,1,'lost-response duplicate does not start again');
 result=await call('step',{attack:true,attack_id:'second-attack',target:B});assert.equal(result.players[0].serial,2);
 await db.query("update public.ludus_matches set players=jsonb_set(players,'{0,strike_at}',to_jsonb(clock_timestamp()-interval '1 millisecond'))where id=$1",[R]);
 await as(B);result=await call('step',{block:true});assert.equal(result.players[1].hp,72,'late block cannot undo a past hit');
 await as(A);await assert.rejects(()=>call('step',{attack:true,attack_id:[]}),/Geçersiz saldırı/);
 await as('00000000-0000-4000-8000-000000000099');await assert.rejects(()=>call('state'),/giriş yap/);
 console.log('V23 PostgreSQL checks passed: repeatable migration, delayed contact, one hit, timed/held/rear/no-shield defense, reach, counter, full RPC, retry deduplication, late input and authorization.');
 await db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1});
