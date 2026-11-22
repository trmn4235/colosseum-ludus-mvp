const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),migration=name=>fs.readFileSync(path.join(root,'supabase/migrations',fs.readdirSync(root+'/supabase/migrations').find(n=>n.endsWith('_'+name+'.sql'))),'utf8');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema ludus_private;create schema ludus_bot_private;
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;
 create table ludus_accounts(user_id uuid primary key,username text,ludus_name text,gold bigint default 0,diamonds int default 0,wins int default 0,losses int default 0);
 create table ludus_gladiators(id uuid primary key,wins_4x5 int default 0,wins_solo20 int default 0);
 create table ludus_items(id uuid primary key default gen_random_uuid(),owner_id uuid,locked_battle_id uuid,equipped_by uuid,equipped_slot text,kind text,model text,enhancement int,base_stats jsonb,sapphires jsonb,rubies jsonb,stat_version int,natural_rule_version int,natural_stats jsonb,natural_percentages jsonb,emeralds jsonb,certus_used boolean);
 create table ludus_battles(id uuid primary key default gen_random_uuid(),owner_id uuid,gladiator_id uuid,mode text default 'solo20',rule_version int default 2,started_at timestamptz default now()-interval '20 seconds',finished_at timestamptz,won boolean,reward jsonb,stats jsonb,loot jsonb default '[]');
 create table ludus_battle_receipts(battle_id uuid primary key,owner_id uuid,reward jsonb,finished_at timestamptz);
 create table ludus_matches(id uuid primary key default gen_random_uuid(),players jsonb,status text default 'playing',winner uuid,starts_at timestamptz default now()-interval '20 seconds',venue text default 'colosseum');
 create table ludus_bot_private.members_v233(user_id uuid primary key);
 create function ludus_private.win_stone_v10(uuid)returns jsonb language sql as $$select '{"name":"Test safiri","quantity":1}'::jsonb$$;`);
 await db.exec(migration('special_staff_v284').split('-- Every account owns')[0]);
 await db.exec(fs.readFileSync(path.join(root,'tests/fixtures/battle-settlement-v284.sql'),'utf8'));
 await db.exec('revoke all on function ludus_finish_battle_v2(uuid,boolean,jsonb)from public,anon;grant execute on function ludus_finish_battle_v2(uuid,boolean,jsonb)to authenticated;');
 await db.exec(migration('special_staff_loot_v285'));
  await db.exec(`create schema ludus_worker_private; create schema ludus_supply_private;
    create table ludus_supply_private.jobs(id uuid primary key,escort_team jsonb);
    create table ludus_worker_private.defenses_v230(id uuid primary key,owner_id uuid,status text default 'ready',
      deadline timestamptz default now(),encounter jsonb,workers jsonb,success boolean);
    create function ludus_worker_private.resolve_defense_v230(uuid,uuid,boolean,boolean) returns void language sql as
      $$update ludus_worker_private.defenses_v230 set success=$3,status='resolved' where id=$2 and owner_id=$1$$;`);
  await db.exec(migration('special_staff_learning_v286'));
  await db.exec(migration('special_staff_notices_v286'));
 await db.exec(`alter table ludus_items add column clan_vault_id uuid,add column clan_roster_id uuid,add column market_listing_id uuid;
  alter table ludus_gladiators add column owner_id uuid,add column name text;
  create table ludus_stones(owner_id uuid,family text,stone_id int,quantity int);
  create table ludus_supply_private.resources(sku text primary key,name text,stage text,active boolean);
  create table ludus_supply_private.stock(owner_id uuid,sku text,quantity int);
  create table ludus_food_catalog(sku text primary key,name text,retired boolean);
  create table ludus_food_stock(owner_id uuid,sku text,quantity int);`);
 await db.exec(migration('personal_vault_v286'));
 await db.exec(migration('personal_vault_api_v286'));
 await db.exec(migration('papyrus_catalog_v288'));
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const A=randomUUID(),B=randomUUID(),BOT=randomUUID(),REQ=randomUUID();
 await q("insert into ludus_accounts(user_id,username,ludus_name)values($1,'fixture_owner','Fixture Ludus'),($2,'other','Other'),($3,'bot','Bot')",[A,B,BOT]);
 await q('insert into ludus_bot_private.members_v233 values($1)',[BOT]);
 // Reproducible synthetic plan, independent of any real player/account grant artifact.
 await q(`insert into ludus_staff_private.grant_requests_v288(request_id,owner_id,expected_username,expected_ludus_name,planned_ids)
 select $1,$2,'fixture_owner','Fixture Ludus',jsonb_agg(content_id order by role_id,ordinal)from(
 select content_id,role_id,ordinal from ludus_staff_private.papyrus_catalog_v288 order by role_id,ordinal limit 90)s`,[REQ,A]);
 let rows=await q('select role_id,rarity,count(*)::int n from ludus_staff_private.papyrus_catalog_v288 group by 1,2');assert.equal(rows.length,24);assert(rows.every(r=>r.n==={common:12,rare:8,very_rare:4,unique:1}[r.rarity]));
 assert.equal((await q('select count(*)::int n from ludus_staff_private.lessons_v284'))[0].n,3000);
 for (const [roll,want]of [[-1,null],[0,'unique'],[24,'unique'],[25,'very_rare'],[2524,'very_rare'],[2525,'rare'],[27524,'rare'],[27525,'common'],[152524,'common'],[152525,null],[9999999,null],[10000000,null]])assert.equal((await q('select ludus_staff_private.rarity_v288($1) r',[roll]))[0].r,want);
 const grant=(await q('select ludus_staff_private.apply_grant_v288($1) s',[REQ]))[0].s;assert.equal(grant.items.length,90);assert.equal(new Set(grant.items.map(p=>p.content_id)).size,90);assert.equal(grant.learned_after,0);assert.deepEqual((await q('select ludus_staff_private.apply_grant_v288($1) s',[REQ]))[0].s,grant);
 assert.equal((await q('select sum(quantity)::int n from ludus_staff_private.holdings_v288 where owner_id=$1',[A]))[0].n,90);
 const identity=async u=>q("select set_config('request.jwt.claim.sub',$1,false)",[u]);await identity(A);await db.exec('set role authenticated');
 const state=async r=>(await q('select ludus_papyrus_state_v288($1)s',[r]))[0].s;
 let s=await state('guard');assert.equal(s.papyri.length,25);assert.equal(s.staff.reduce((n,r)=>n+r.collected,0),90);assert(s.staff.every(r=>r.overall===r.collected*4));
 const p=grant.items.find(p=>p.rarity!=='unique'),ticket=randomUUID();const read=async(id,req)=>(await q('select ludus_papyrus_read_v288($1,$2)s',[id,req]))[0].s;
 s=await read(p.content_id,ticket);assert.equal(s.staff.reduce((n,r)=>n+r.collected,0),90);assert.equal(s.staff.reduce((n,r)=>n+r.read,0),1);assert.equal(s.papyri.find(x=>x.content_id===p.content_id).owned_quantity,0);assert.equal((await read(p.content_id,ticket)).reading.replayed,true);
 await assert.rejects(()=>read(p.content_id,randomUUID()),/zaten öğrenildi/);await assert.rejects(()=>read(grant.items.find(x=>x.content_id!==p.content_id).content_id,ticket),/farklı/);
 await assert.rejects(()=>q('select ludus_staff_private.apply_grant_v288($1)',[REQ]),/permission denied/);await assert.rejects(()=>q('select * from ludus_staff_private.knowledge_v288'),/permission denied/);
 let chest=(await q("select ludus_personal_vault('papyrus',0,null)s"))[0].s;assert.equal(chest.total,89);
 await identity(B);assert.equal((await state('guard')).staff.reduce((n,r)=>n+r.collected,0),0);await assert.rejects(()=>read(p.content_id,randomUUID()),/kasanda yok/);
 await db.exec('reset role');
 await q('select ludus_staff_private.mint_v288($1,$2,$3)',[A,p.content_id,'test:duplicate']);await identity(A);await db.exec('set role authenticated');s=await state(p.role);assert.equal(s.papyri.find(x=>x.content_id===p.content_id).owned_quantity,1);assert.equal(s.staff.reduce((n,r)=>n+r.collected,0),90);await db.exec('reset role');
 // Existing guard bonuses and archive remain separate from the new25.
 await q("insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson,read_at)values($1,'guard',401,clock_timestamp())",[A]);
 s=await state('guard');assert.equal(s.staff.find(r=>r.id==='guard').legacy_read,1);assert.equal(s.staff.find(r=>r.id==='guard').legacy_bonuses[0].percent,.03);
 // Deterministic injected RNG is confined to this test process.
 await db.exec("create table test_roll(value int);insert into test_roll values(27525);create or replace function ludus_staff_private.roll_v288()returns integer language sql as $$select value from public.test_roll$$;");
 const award=async(u,src)=>(await q('select ludus_staff_private.award_v285($1,$2)s',[u,src]))[0].s;
 let reward=await award(B,'test:reward');assert.equal(reward[0].rarity,'common');assert.deepEqual(await award(B,'test:reward'),reward);assert.deepEqual(await award(BOT,'test:bot'),[]);
 await db.exec('update test_roll set value=0');let uniqueBefore=(await q('select count(*)::int n from ludus_staff_private.unique_mints_v288'))[0].n;
 for(let i=0;i<6-uniqueBefore;i++)assert.equal((await award(B,'test:unique:'+i))[0].rarity,'unique');assert.deepEqual(await award(B,'test:unique:exhausted'),[]);
 await q('delete from ludus_accounts where user_id=$1',[B]);assert.equal((await q('select count(*)::int n from ludus_staff_private.unique_mints_v288'))[0].n,6);assert.deepEqual(await award(A,'test:deleted-unique'),[]);
 // All validated completed battle types, including losses; source receipt retains no-reroll behavior.
 await db.exec('update test_roll set value=27525');let battle=randomUUID();await q("insert into ludus_battles(id,owner_id,mode)values($1,$2,'new-mode')",[battle,A]);await q('update ludus_battles set finished_at=clock_timestamp(),won=false where id=$1',[battle]);assert.equal((await q('select reward from ludus_battles where id=$1',[battle]))[0].reward.papyri.length,1);
 let C=randomUUID();await q("insert into ludus_accounts(user_id)values($1)",[C]);let mid=randomUUID();await q('insert into ludus_matches(id,players,venue)values($1,$2,$3)',[mid,JSON.stringify([{owner:A,hp:100,left:false},{owner:C,hp:0,left:false}]),'future-mode']);await q("update ludus_matches set status='finished',winner=$2 where id=$1",[mid,A]);await identity(C);await db.exec('set role authenticated');assert.equal((await q('select ludus_match_papyri_v285($1)s',[mid]))[0].s.papyri.length,1);await db.exec('reset role');
 await identity(A);await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await assert.rejects(()=>state('guard'),/Giriş/);await q("select set_config('request.jwt.claims','{}',false)");await db.exec('set role anon');await assert.rejects(()=>state('guard'),/permission denied/);await db.exec('reset role');
 // A prepared90plan with all unique candidates already minted replaces only unavailable IDs, atomically.
 const D=randomUUID(),R2=randomUUID();await q("insert into ludus_accounts(user_id,username,ludus_name)values($1,'replacement','Replacement')",[D]);
 await q("insert into ludus_staff_private.grant_requests_v288(request_id,owner_id,expected_username,expected_ludus_name,planned_ids)select $1,$2,'replacement','Replacement',planned_ids from ludus_staff_private.grant_requests_v288 where request_id=$3",[R2,D,REQ]);
 const replacement=(await q('select ludus_staff_private.apply_grant_v288($1)s',[R2]))[0].s;assert.equal(replacement.quantity,90);assert.equal(new Set(replacement.items.map(x=>x.content_id)).size,90);assert(replacement.replacements.length>0);assert(replacement.items.every(x=>x.rarity!=='unique'));assert.equal(replacement.learned_after,0);
 // Learning a pending feature records knowledge without advertising a runtime effect.
 await identity(A);s=await state(p.role);assert.equal(s.staff.find(x=>x.id===p.role).bonuses.length,0);
 await q("update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active',runtime_reason=null where content_id=$1",[p.content_id]);s=await state(p.role);assert.equal(s.staff.find(x=>x.id===p.role).bonuses.length,1);
 console.log('PASS V288: 150exact rows,25/role,4rarity boundaries,90grant idempotency,owner isolation,read consumption+replay,union overall,duplicate copies,legacy retention,vault,globalunique expiry/accountdelete,both match outcomes and all modes.');
}finally{await db.close();}})().catch(e=>{console.error(e.message,e.detail,e.where);process.exit(1)});
