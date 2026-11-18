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
 await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/battle-settlement-v284.sql'),'utf8'));
 await db.exec('revoke all on function ludus_finish_battle_v2(uuid,boolean,jsonb)from public,anon;grant execute on function ludus_finish_battle_v2(uuid,boolean,jsonb)to authenticated;');
 await db.exec(migration('special_staff_loot_v285'));
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows,A=randomUUID(),B=randomUUID(),BOT=randomUUID(),G=randomUUID();
 for(const [id,name]of [[A,'Ludus Tırman'],[B,'Ludus İkinci'],[BOT,'Ludus Test']])await q('insert into ludus_accounts(user_id,username,ludus_name)values($1,$2,$2)',[id,name]);
 await q('insert into ludus_gladiators(id)values($1)',[G]);await q('insert into ludus_bot_private.members_v233 values($1)',[BOT]);
 const counts=await q('select role_id,count(*)::int n,count(*)filter(where rarity=\'common\')::int common,count(*)filter(where rarity=\'rare\')::int rare,count(*)filter(where rarity=\'very_rare\')::int very_rare from ludus_staff_private.lessons_v284 group by role_id');
 assert.equal(counts.length,6);assert(counts.every(x=>x.n===500&&x.common===400&&x.rare===90&&x.very_rare===10));
 assert.equal((await q('select count(*)::int n from ludus_staff_private.effects_v284'))[0].n,0,'cancelled bonuses stay absent');
 const distribution=await q('select ludus_staff_private.rarity_v285(n) rarity,count(*)::int n from generate_series(0,999999)n group by 1');
 assert.deepEqual(Object.fromEntries(distribution.map(x=>[x.rarity,x.n])),{null:838999,common:120000,rare:40000,very_rare:1000,unique:1});
 assert.equal((await q('select ludus_staff_private.rarity_v285(-1) r'))[0].r,null);
 // Test-only RNG injection. No seed/forced-roll switch is shipped to production.
 await db.exec('create table test_roll(value int not null);insert into test_roll values(41001);create or replace function ludus_staff_private.roll_v285()returns integer language sql volatile set search_path=\'\' as $$select value from public.test_roll$$;');
 const roll=async n=>q('update test_roll set value=$1',[n]);
 const identity=async id=>q("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 const state=async(role='trainer',page=0)=>(await q('select ludus_special_staff($1,$2)s',[role,page]))[0].s;
 const battle=async(owner=A,opts={})=>{const id=randomUUID();await q('insert into ludus_battles(id,owner_id,gladiator_id,mode,started_at)values($1,$2,$3,$4,now()-$5::interval)',[id,owner,G,opts.mode||'solo20',opts.age||'20 seconds']);return id;};
 const finish=async(id,win=true)=>(await q("select ludus_finish_battle_v2($1,$2,'{\"alive\":true,\"exit_slots\":{}}')r",[id,win]))[0].r;
 let id=await battle();await identity(A);await db.exec('set role authenticated');let reward=await finish(id);assert.equal(reward.gold,100);assert.equal(reward.diamonds,1);assert.equal(reward.papyri.length,1);assert.equal(reward.papyri[0].rarity,'common');assert(reward.kind);const original=reward;
 await db.exec('reset role');await roll(0);await db.exec('set role authenticated');assert.deepEqual(await finish(id),original,'replay returns identical reward, no new roll');
 let s=await state(reward.papyri[0].role);assert.equal(s.staff.reduce((n,x)=>n+x.collected,0),1);assert(s.staff.every(x=>x.overall===0));assert.equal(s.papyri[0].effects.length,0);
 await assert.rejects(()=>q('select ludus_special_staff_read($1,$2,$3)',[reward.papyri[0].role,reward.papyri[0].lesson,randomUUID()]),/henüz okumaya açık değil/);
 await assert.rejects(()=>q('select ludus_staff_private.award_v285($1,$2)',[A,'forged']),/permission denied/);
 await assert.rejects(()=>db.exec("insert into ludus_staff_private.unique_discoveries_v285 values('forged',gen_random_uuid(),'fake',now(),'fake')"),/permission denied/);
 await identity(B);await assert.rejects(()=>finish(id),/bulunamadı/);assert.equal((await state()).staff.reduce((n,x)=>n+x.collected,0),0);
 await db.exec('reset role');await identity(A);
 // A no-drop receipt is just as immutable as a winning roll.
 await roll(999999);id=await battle();await db.exec('set role authenticated');reward=await finish(id);assert.deepEqual(reward.papyri,[]);await db.exec('reset role');await roll(0);await db.exec('set role authenticated');assert.deepEqual((await finish(id)).papyri,[]);await db.exec('reset role');
 for(const [value,rarity]of [[1,'very_rare'],[1001,'rare']]){await roll(value);id=await battle();await db.exec('set role authenticated');assert.equal((await finish(id)).papyri[0].rarity,rarity);await db.exec('reset role');}
 const before=(await q('select count(*)::int n from ludus_staff_private.loot_receipts_v285'))[0].n;
 await roll(0);id=await battle();await db.exec('set role authenticated');assert.equal((await finish(id,false)).papyri,undefined);await db.exec('reset role');
 id=await battle(A,{age:'3 hours'});await db.exec('set role authenticated');assert.equal((await finish(id)).papyri,undefined);await db.exec('reset role');
 id=await battle(A,{age:'1 second'});await db.exec('set role authenticated');await assert.rejects(()=>finish(id),/süresi/);await db.exec('reset role');
 id=await battle(BOT);await identity(BOT);await db.exec('set role authenticated');assert.deepEqual((await finish(id)).papyri,[]);await db.exec('reset role');await identity(A);
 assert.equal((await q('select count(*)::int n from ludus_staff_private.loot_receipts_v285'))[0].n,before);
 // Consuming / removing ownership never resets the server-wide discovery.
 const uniqueIds=[];for(let i=0;i<6;i++){id=await battle();await db.exec('set role authenticated');reward=await finish(id);await db.exec('reset role');assert.equal(reward.papyri.length,1);const p=reward.papyri[0];uniqueIds.push(p.unique_id);assert.equal(p.rarity,'unique');assert.equal(p.finder,'Ludus Tırman');assert(p.found_at);await q('update ludus_staff_private.unique_papyri_v285 set read_at=clock_timestamp()where papyrus_id=$1',[p.unique_id]);}
 assert.equal(new Set(uniqueIds).size,6);id=await battle();await db.exec('set role authenticated');assert.deepEqual((await finish(id)).papyri,[]);s=await state('guard');assert.equal(s.staff.find(x=>x.id==='guard').unique_collected,1);assert.equal(s.papyri[0].rarity,'unique');assert(s.staff.every(x=>x.total===500&&x.overall===0));await db.exec('reset role');
 await assert.rejects(()=>q("insert into ludus_staff_private.unique_discoveries_v285(papyrus_id,first_owner_id,finder_ludus,source_key)values($1,$2,'duplicate','duplicate')",[uniqueIds[0],B]),/duplicate key/);
 await q('delete from ludus_staff_private.unique_papyri_v285 where owner_id=$1',[A]);await identity(B);id=await battle(B);await db.exec('set role authenticated');assert.deepEqual((await finish(id)).papyri,[]);await db.exec('reset role');assert.equal((await q('select count(*)::int n from ludus_staff_private.unique_discoveries_v285'))[0].n,6);
 // Complete a rarity collection: no duplicate or upgraded rarity is substituted.
 await q("insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson)select $1,role_id,lesson from ludus_staff_private.lessons_v284 where rarity='very_rare' on conflict do nothing",[B]);await roll(1);id=await battle(B);await db.exec('set role authenticated');assert.deepEqual((await finish(id)).papyri,[]);await db.exec('reset role');
 // Multiplayer: server transition proof, owner-only claim, retry and winning team.
 const users=[A,B,...Array.from({length:8},()=>randomUUID())];for(const u of users.slice(2))await q("insert into ludus_accounts(user_id,username,ludus_name)values($1,'player','Ludus')",[u]);
 const players=users.map((u,i)=>({owner:u,ranked_team:i<5?'a':'b',hp:i<5?100:0,left:false}));players[1].hp=0;players[2].left=true;
 const match=async(opts={})=>{const m=randomUUID();await q('insert into ludus_matches(id,players,venue,starts_at)values($1,$2,$3,now()-$4::interval)',[m,JSON.stringify(opts.players||players),opts.venue||'ranked',opts.age||'20 seconds']);await q("update ludus_matches set status='finished',winner=$2 where id=$1",[m,opts.cancel?null:A]);return m;};
 const claim=async mid=>(await q('select ludus_match_papyri_v285($1)r',[mid]))[0].r;
 await roll(1001);let mid=await match();await identity(A);await db.exec('set role authenticated');let got=await claim(mid);assert.equal(got.papyri[0].rarity,'rare');await db.exec('reset role');await roll(0);await db.exec('set role authenticated');assert.deepEqual(await claim(mid),got);await identity(B);await db.exec('reset role');await roll(1001);await db.exec('set role authenticated');assert.equal((await claim(mid)).papyri.length,1,'fallen winning teammate eligible');await identity(users[2]);assert.deepEqual((await claim(mid)).papyri,[],'leaver ineligible');await identity(users[8]);assert.deepEqual((await claim(mid)).papyri,[],'losing team ineligible');await identity(BOT);await assert.rejects(()=>claim(mid),/erişemezsin/);await db.exec('reset role');
 for(const opts of [{cancel:true},{age:'1 second'},{players:players.map((p,i)=>i>=5?{...p,left:true}:p)},{players:players.slice(0,9)}]){mid=await match(opts);await identity(A);await db.exec('set role authenticated');assert.deepEqual((await claim(mid)).papyri,[]);await db.exec('reset role');}
 // A late poll must not retroactively turn a too-short result into an eligible one.
 await q("update ludus_matches set starts_at=now()-interval '1 minute',status='finished' where id=$1",[mid]);await db.exec('set role authenticated');assert.deepEqual((await claim(mid)).papyri,[]);await db.exec('reset role');
 await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await db.exec('set role authenticated');await assert.rejects(()=>claim(mid),/Giriş/);await db.exec('reset role');await q("select set_config('request.jwt.claims','{}',false)");
 await db.exec('set role anon');await assert.rejects(()=>claim(mid),/permission denied/);await db.exec('reset role');
 await q('delete from ludus_accounts where user_id=$1',[A]);assert.equal((await q('select count(*)::int n from ludus_staff_private.unique_discoveries_v285'))[0].n,6,'account deletion preserves history');
 const rows=require('../arena-results-v83.js').rewardRows({gold:100,papyri:[{rarity:'unique',title:'Eşsiz belge',role_title:'Aşçı',finder:'Ludus',found_at:'2026-11-18T00:00:00Z'}]});assert.equal(rows.length,2);assert.equal(rows[1].icon,'papyrus');assert.match(rows[1].detail,/Eşsiz.*Aşçı.*tek nüsha/);assert.match(rows[1].discovery,/İlk bulan/);
 console.log('PASS V285: exact rarity distribution, 6×500 catalogue, unchanged gold/stone/equipment settlement, server receipt replay/no-drop replay, unconfigured reading blocked, owner isolation, bot/forfeit/time exclusions, ranked winners, global one-copy discovery survives consumption and account deletion.');
 await require('./special-staff-learning-v286.cjs')(db,migration);
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
