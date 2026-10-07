const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',R='00000000-0000-4000-8000-000000000003';
async function createDatabase(){
 const db=new PGlite();await db.waitReady;
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.ludus_accounts(user_id uuid primary key,username text,ludus_name text);
 create table public.ludus_gladiators(id uuid primary key,owner_id uuid,name text,class text,status text,overall integer default 50,level integer default 1);
 create table public.ludus_items(id uuid primary key,owner_id uuid,kind text,model text,locked_battle_id uuid,clan_vault_id uuid,clan_roster_id uuid);
 create table public.ludus_matches(id uuid primary key default gen_random_uuid(),status text default 'waiting',players jsonb default '[]',starts_at timestamptz default clock_timestamp()+interval '10 seconds',winner uuid,created_at timestamptz default clock_timestamp(),updated_at timestamptz default clock_timestamp());`);
 const migration=fs.readFileSync(root+'/ludus-multiplayer-v36.sql','utf8');await db.exec(migration);await db.exec(migration);
 await db.query('insert into ludus_accounts(user_id,username)values($1,\'alpha\'),($2,\'beta\')',[A,B]);
 return db;
}
function players(now=new Date().toISOString()){
 return [
  {owner:A,name:'Hoplomachus',class:'hoplomachus',gladiator:{class:'hoplomachus',overall:50,level:1},x:0,z:0,angle:0,hp:100,maxHp:100,serial:0,stamina:100,maxStamina:100,stamina_at:now,stamina_regen_at:new Date(Date.now()+10000).toISOString(),tick_at:now,seen:now,items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'},{kind:'shield',model:'round',equipped_slot:'off_hand'}],block:false},
  {owner:B,name:'Cassius',class:'murmillo',gladiator:{class:'murmillo',overall:50,level:1},x:0,z:1.25,angle:Math.PI,hp:100,maxHp:100,serial:0,stamina:100,maxStamina:100,stamina_at:now,tick_at:now,seen:now,items:[{kind:'weapon',model:'sica',equipped_slot:'main_hand'},{kind:'shield',model:'round',equipped_slot:'off_hand'}],block:false}
 ];
}
async function setMatch(db,p=players()){
 await db.query("insert into ludus_matches(id,status,players)values($1,'playing',$2::jsonb)on conflict(id)do update set status='playing',players=excluded.players,winner=null",[R,JSON.stringify(p)]);
}
async function call(db,u,action='step',input={}){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);
 return(await db.query('select ludus_match($1,$2,null,\'{}\'::jsonb,$3::jsonb)as r',[action,R,JSON.stringify(input)])).rows[0].r;
}
async function main(){
 const db=await createDatabase();
 const t='2026-10-07T12:00:00.000Z',impact='2026-10-07T12:00:00.370Z';
 const resolve=async(p,now='2026-10-07T12:00:00.400Z')=>(await db.query('select private.ludus_resolve_combat_v36($1::jsonb,$2::timestamptz)as p',[JSON.stringify(p),now])).rows[0].p;
 const striking=()=>{const p=players(t);Object.assign(p[0],{serial:1,swing_at:t,strike_at:impact,strike_target:B,strike_weapon:'gladius',strike_region:'head'});return p;};
 let p=await resolve(striking(),'2026-10-07T12:00:00.200Z');assert.equal(p[1].hp,100);
 p=await resolve(p);assert.equal(p[1].hp,86);assert.equal(p[1].hit_region,'head');assert.equal((await resolve(p))[1].hp,86);
 p=striking();Object.assign(p[1],{block:true,guard_at:'2026-10-07T12:00:00.300Z'});p=await resolve(p);assert.equal(p[1].hp,100);assert.equal(p[1].last_defense,'perfect');assert.equal(p[1].counter_target,A);
 p=striking();Object.assign(p[1],{block:true,guard_at:t});p=await resolve(p);assert.equal(p[1].last_defense,'block');assert.equal(p[1].hp,100);
 p=striking();Object.assign(p[1],{block:true,guard_at:t,angle:0});p=await resolve(p);assert.equal(p[1].hp,86);
 p=striking();Object.assign(p[1],{block:true,guard_at:t,stamina:0});p=await resolve(p);assert.equal(p[1].hp,86,'exhausted guard fails');
 p=striking();Object.assign(p[1],{dodge_at:'2026-10-07T12:00:00.200Z',dodge_until:'2026-10-07T12:00:00.660Z'});p=await resolve(p);assert.equal(p[1].hp,100,'dodge before contact avoids hit');
 p=striking();Object.assign(p[1],{dodge_at:'2026-10-07T12:00:00.400Z',dodge_until:'2026-10-07T12:00:00.860Z'});p=await resolve(p);assert.equal(p[1].hp,86,'late dodge cannot undo contact');
 p=players(t);Object.assign(p[0],{stamina:75,dodge_at:t,dodge_until:'2026-10-07T12:00:00.460Z',dodge_tick_at:t,dodge_dx:0,dodge_dz:-1,stamina_regen_at:'2026-10-07T12:00:01.000Z'});
 const advance=async(p,now)=>(await db.query('select private.ludus_advance_combat_v36($1::jsonb,$2::timestamptz)as p',[JSON.stringify(p),now])).rows[0].p;
 p=await advance(p,'2026-10-07T12:00:00.250Z');assert.ok(Math.abs(p[0].z+1.875)<1e-6);assert.equal(p[0].stamina,75);
 p=await advance(p,'2026-10-07T12:00:00.600Z');assert.ok(Math.abs(p[0].z+3.45)<1e-6);const z=p[0].z;p=await advance(p,'2026-10-07T12:00:01.500Z');assert.equal(p[0].z,z);assert.ok(p[0].stamina>75);
 await setMatch(db);let r=await call(db,A,'step',{attack:true,attack_id:'head-1',region:'head'});assert.equal(r.controls_version,36);assert.equal(r.combat_version,23);assert.equal(r.players[0].strike_region,'head');assert.equal(r.players[0].stamina,87);assert.equal(r.players[1].hp,100);
 await db.query("update ludus_matches set players=jsonb_set(players,'{0,strike_at}',to_jsonb(clock_timestamp()-interval '1 millisecond'))where id=$1",[R]);
 r=await call(db,B,'state');assert.equal(r.players[1].hp,86);assert.equal(r.players[1].hit_region,'head');const hp=r.players[1].hp;r=await call(db,A,'state');assert.equal(r.players[1].hp,hp,'both players observe one authoritative hit');
 await db.query("update ludus_matches set players=jsonb_set(jsonb_set(players,'{0,cooldown_until}',to_jsonb(clock_timestamp()-interval '1 second')),'{0,swing_end}',to_jsonb(clock_timestamp()-interval '1 second'))where id=$1",[R]);
 r=await call(db,A,'step',{attack:true,attack_id:'head-1',region:'head'});assert.equal(r.players[0].serial,1,'retry does not start a second attack');
 await setMatch(db);r=await call(db,A,'step',{dodge:true,dodge_id:'dodge-1',x:1,z:0});assert.equal(r.players[0].stamina,75);assert.equal(r.players[0].dodge_serial,1);r=await call(db,A,'step',{dodge:true,dodge_id:'dodge-1',x:1,z:0});assert.equal(r.players[0].dodge_serial,1);assert.equal(r.players[0].stamina,75);
 p=players();p[0].stamina=0;await setMatch(db,p);r=await call(db,A,'step',{attack:true,attack_id:'empty',dodge:true,dodge_id:'empty-dodge',block:true});assert.equal(r.players[0].serial,0);assert.equal(r.players[0].dodge_serial,undefined);assert.equal(r.players[0].block,false);
 await setMatch(db);r=await call(db,A,'step',{attack:true,attack_id:'shield-hand',hand:'off_hand',region:'legs'});assert.equal(r.players[0].strike_hand,'main_hand','shield cannot masquerade as a weapon');
 p=players();p[0].items[1]={kind:'weapon',model:'trident',equipped_slot:'off_hand'};await setMatch(db,p);r=await call(db,A,'step',{attack:true,attack_id:'off-hand',hand:'off_hand',region:'rightArm'});assert.equal(r.players[0].strike_hand,'off_hand');assert.equal(r.players[0].strike_weapon,'trident');assert.equal(r.players[0].wind,.34);
 p=players();p[0].items[0].model='whip';p[0].pull_serial=0;await setMatch(db,p);r=await call(db,A,'step',{special:true});assert.equal(r.players[1].pull_from,undefined,'whip needs an explicit target lock');r=await call(db,A,'step',{special:true,target:B});assert.equal(r.players[0].stamina,72);assert.equal(r.players[0].pull_serial,1);assert.equal(r.players[1].pull_from,A);
 p=players();p[0].items[0].model='whip';p[0].pull_serial=0;p[1].z=2.1;await setMatch(db,p);r=await call(db,A,'step',{special:true,target:B});assert.equal(r.players[0].stamina,100,'whip beyond two metres spends nothing');assert.equal(r.players[1].pull_from,undefined);
 for(const bad of [{region:'invalid'},{region:[]},{dodge:'true'},{dodge_id:[]},{hand:'invented'}])await assert.rejects(()=>call(db,A,'step',bad),/Geçersiz/);
 await assert.rejects(()=>call(db,'00000000-0000-4000-8000-000000000099','state'),/giriş yap/);
 const grants=(await db.query("select has_function_privilege('authenticated','private.ludus_resolve_combat_v36(jsonb,timestamptz)','execute') as resolver,has_function_privilege('anon','private.ludus_advance_combat_v36(jsonb,timestamptz)','execute') as advance")).rows[0];assert.equal(grants.resolver,false);assert.equal(grants.advance,false);
 await db.close();console.log('V36 PostgreSQL checks passed: repeatable install, timed/held/rear/exhausted guard, region, dodge timing/movement/recovery, shared damage, command retries, stamina, equipment hand, invalid inputs, authorization and private grants.');
}
module.exports={createDatabase,players,setMatch,call,A,B,R};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
