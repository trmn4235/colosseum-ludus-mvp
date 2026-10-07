const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
async function database(){
 const db=new PGlite();await db.waitReady;
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema ludus_private;
 create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table ludus_accounts(user_id uuid primary key,username text,ludus_name text,gold bigint default 1000,diamonds integer default 3,stones_version integer default 0);
 create table ludus_gladiators(id uuid primary key default gen_random_uuid(),owner_id uuid references ludus_accounts(user_id),name text,class text,level integer default 1,overall integer default 50,status text default 'available');
 create table ludus_items(id uuid primary key default gen_random_uuid(),owner_id uuid references ludus_accounts(user_id),kind text,model text,enhancement integer default 0,natural_stats jsonb default '{}');
 create table ludus_shop_catalog(sku text primary key,category text,name text,kind text,model text,price integer);
 insert into ludus_shop_catalog values('gladius','Silah','Kılıç','weapon','gladius',100),('shield','Kalkan','Kalkan','shield','round',100),('helmet','Miğfer','Miğfer','helmet','roman',100);
 create table ludus_stone_catalog(family text,stone_id integer,name text,primary key(family,stone_id));
 insert into ludus_stone_catalog select 'sapphire',generate_series(1,18),'Safir';insert into ludus_stone_catalog select 'emerald',generate_series(1,15),'Zümrüt';insert into ludus_stone_catalog select 'ruby',generate_series(1,4),'Yakut';
 create table ludus_stones(owner_id uuid,family text,stone_id integer,quantity integer default 0,primary key(owner_id,family,stone_id));
 create table ludus_battles(id uuid primary key default gen_random_uuid(),owner_id uuid,gladiator_id uuid,mode text,snapshot jsonb default '{}',started_at timestamptz default clock_timestamp()-interval '1 minute',finished_at timestamptz,won boolean,reward jsonb,stats jsonb);
 create table ludus_battle_receipts(battle_id uuid primary key,owner_id uuid,reward jsonb,finished_at timestamptz);
 create table ludus_daily_runs(owner_id uuid,day date,visited boolean default false,battles integer default 0,wins integer default 0,team_battles integer default 0,solo_battles integer default 0,team_wins integer default 0,solo_wins integer default 0,primary key(owner_id,day));
 create table ludus_daily_claims(owner_id uuid,day date,quest_key text,reward jsonb,claimed_at timestamptz default clock_timestamp(),primary key(owner_id,day,quest_key));
 create table ludus_training_sessions(owner_id uuid,train_until timestamptz);
 create table ludus_imperial_assignments(id uuid primary key default gen_random_uuid(),owner_id uuid,mission jsonb,claimed_at timestamptz,rewards jsonb);
 alter table ludus_accounts enable row level security;alter table ludus_gladiators enable row level security;
 alter table ludus_accounts add wins integer default 0,add losses integer default 0,add sapphires integer default 0;
 alter table ludus_gladiators add wins_4x5 integer default 0,add wins_solo20 integer default 0;
 alter table ludus_battles add rule_version integer default 2,add loot jsonb default '[]';
 alter table ludus_items add locked_battle_id uuid,add equipped_by uuid,add equipped_slot text,add base_stats jsonb default '{}',add sapphires jsonb default '[]',add rubies jsonb default '[]',add stat_version integer default 10,add natural_rule_version integer default 2,add natural_percentages jsonb default '{}',add emeralds jsonb default '[]',add certus_used boolean default false;
 create function ludus_private.win_stone_v10(u uuid)returns jsonb language sql as $$select jsonb_build_object('family','sapphire','id',1,'quantity',1)$$;
 `);
 const sql=fs.readFileSync(root+'/ludus-level-v37.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.query("insert into ludus_accounts(user_id,ludus_name)values($1,'Alpha'),($2,'Beta')",[A,B]);
 for(const u of [A,B])await db.query("insert into ludus_gladiators(owner_id,name,class)values($1,'Cassius','murmillo'),($1,'Titus','retiarius')",[u]);
 return db;
}
async function user(db,u=A){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);}
async function state(db,u=A){await user(db,u);return(await db.query("select ludus_progress()as r")).rows[0].r;}
async function claim(db,l,u=A){await user(db,u);return(await db.query("select ludus_progress('claim',$1)as r",[l])).rows[0].r;}
async function grant(db,x,key='fixture',u=A){await user(db,u);await db.query("select ludus_private.level_grant($1,'imperial',$2,$3,clock_timestamp())",[u,key,x]);}
async function win(db,n,options={}){
 const b=(await db.query("insert into ludus_battles(owner_id,gladiator_id,mode,snapshot)values($1,gen_random_uuid(),$2,$3) returning id",[A,options.mode||'solo20',JSON.stringify(options.snapshot||{})])).rows[0].id;
 await db.query("update ludus_battles set finished_at=clock_timestamp(),won=$2,reward='{}',stats=$3 where id=$1",[b,options.won!==false,JSON.stringify(options.stats||{})]);return b;
}
async function main(){
 const db=await database();await user(db);
 const curves=(await db.query('select ludus_private.level_threshold(2) as l2,ludus_private.level_threshold(10)as l10,ludus_private.level_threshold(50)as l50,ludus_private.level_granted_gladiators(10)as g10,ludus_private.level_granted_gladiators(50)as g50')).rows[0];
 assert.deepEqual(curves,{l2:3000,l10:33660,l50:834960,g10:5,g50:15});
 const totals=(await db.query('select count(*)::integer as levels,sum(diamonds)::integer as diamonds,sum(denarius)::integer as denarius,sum(items)::integer as items,sum(gladiators)::integer as gladiators from ludus_private.level_reward_catalog')).rows[0];
 assert.deepEqual(totals,{levels:49,diamonds:1274,denarius:127400,items:76,gladiators:13});
 let s=await state(db);assert.equal(s.level,1);assert.equal(s.granted_gladiators,2);assert.equal(s.owned_gladiators,2);assert.equal(s.claimable_count,0);
 await assert.rejects(()=>claim(db,2),/henüz açılmadı/);
 await user(db);for(let n=1;n<=50;n++)await win(db,n);s=await state(db);assert.equal(s.experience,2500);assert.equal(s.battle_exp_today,2500);assert.equal(s.battle_wins_today,50);assert.equal(s.level,1);
 const replay=(await db.query("select id from ludus_battles limit 1")).rows[0].id;await db.query("update ludus_battles set finished_at=clock_timestamp()where id=$1",[replay]);assert.equal((await state(db)).experience,2500);
 await win(db,51);assert.equal((await state(db)).experience,2500);await win(db,52,{won:false});await win(db,53,{stats:{abandoned:true}});await win(db,54,{mode:'friendly'});assert.equal((await state(db)).experience,2500);
 await db.query("update ludus_progression set battle_day=current_date-2 where owner_id=$1",[A]);await win(db,55,{snapshot:{ludus_progression:{difficulty:'hard'}}});assert.equal((await state(db)).battle_exp_today,150);
 const realBattle=(await db.query("insert into ludus_battles(owner_id,gladiator_id,mode)values($1,(select id from ludus_gladiators where owner_id=$1 limit 1),'solo20') returning id",[A])).rows[0].id;
 const realResult=(await db.query("select ludus_finish_battle_v2($1,true,'{\"alive\":true,\"exit_slots\":{}}')as r",[realBattle])).rows[0].r;assert.equal(realResult.ludus_exp,100);
 const repeatedResult=(await db.query("select ludus_finish_battle_v2($1,true,'{\"alive\":true,\"exit_slots\":{}}')as r",[realBattle])).rows[0].r;assert.deepEqual(repeatedResult,realResult);
 await grant(db,250,'reach-two');s=await state(db);assert.equal(s.level,2);assert.equal(s.granted_gladiators,3);
 const money=(await db.query('select gold,diamonds from ludus_accounts where user_id=$1',[A])).rows[0];s=await claim(db,2);assert.equal(s.owned_gladiators,3);assert.equal(s.claimable_count,0);
 assert.equal(s.wallet.gold,money.gold+200);assert.equal(s.wallet.diamonds,money.diamonds+2);
 const result=s.rewards.find(r=>r.level===2).result;assert.equal(result.items.length,1);assert.equal(result.stones.length,3);assert.equal(result.stones.filter(x=>x.family==='sapphire').length,2);assert.equal(result.stones.filter(x=>x.family==='ruby').length,1);
 s=await claim(db,2);assert.deepEqual(s.rewards.find(r=>r.level===2).result,result);assert.equal(s.owned_gladiators,3);assert.equal(s.wallet.gold,money.gold+200);
 await grant(db,1000,'dedup');const exp=(await state(db)).experience;await grant(db,1000,'dedup');assert.equal((await state(db)).experience,exp);
 await db.query("update ludus_progression set experience=33660 where owner_id=$1",[A]);s=await state(db);assert.equal(s.level,10);assert.equal(s.granted_gladiators,5);s=await claim(db,null);assert.equal(s.owned_gladiators,5);assert.equal(s.gladiator_slots,5);
 const classes=(await db.query('select class,count(*)::integer as n from ludus_gladiators where owner_id=$1 group by class',[A])).rows;assert.ok(classes.every(c=>c.n===1));
 await db.query("update ludus_progression set experience=834960 where owner_id=$1",[A]);s=await state(db);assert.equal(s.level,50);s=await claim(db,null);assert.equal(s.owned_gladiators,7);assert.equal(s.pending_gladiator_count,8);assert.equal(s.claimable_count,0);const after=JSON.stringify(s.rewards);s=await claim(db,null);assert.equal(JSON.stringify(s.rewards),after);
 await user(db,B);const today=(await db.query("select(clock_timestamp()at time zone'Europe/Istanbul')::date::text as d")).rows[0].d;
 await db.query("insert into ludus_daily_runs(owner_id,day,battles,wins,team_battles,solo_battles)values($1,$2,2,1,1,1)",[B,today]);await db.query("insert into ludus_training_sessions values($1,clock_timestamp()-interval '1 second')",[B]);
 const daily=(await db.query('select ludus_private.daily_view($1) as r',[B])).rows[0].r;assert.equal(daily.missions.reduce((n,q)=>n+q.ludus_exp,0),900);
 for(const q of daily.missions)await db.query('select ludus_daily_claim($1,$2)',[today,q.key]);await db.query("select ludus_daily_claim($1,'bonus')",[today]);assert.equal((await state(db,B)).experience,1200);await db.query("select ludus_daily_claim($1,'bonus')",[today]);assert.equal((await state(db,B)).experience,1200);
 for(let slot=1;slot<=3;slot++){const id=(await db.query("insert into ludus_imperial_assignments(owner_id,mission)values($1,$2) returning id",[B,JSON.stringify({slot})])).rows[0].id;await db.query("update ludus_imperial_assignments set claimed_at=clock_timestamp(),rewards='{}'where id=$1",[id]);await db.query('update ludus_imperial_assignments set claimed_at=clock_timestamp()where id=$1',[id]);}
 assert.equal((await state(db,B)).experience,3450);assert.equal((await state(db,A)).experience,834960);
 const grants=(await db.query("select has_function_privilege('anon','public.ludus_progress(text,integer)','execute') as anonymous,has_function_privilege('authenticated','ludus_private.level_grant(uuid,text,text,integer,timestamptz)','execute')as mint,has_table_privilege('authenticated','public.ludus_progression','update') as edit")).rows[0];assert.deepEqual(grants,{anonymous:false,mint:false,edit:false});
 await user(db,'');await assert.rejects(()=>db.query('select ludus_progress()'),/giriş yap/);
 await db.close();console.log('V37 passed: repeatable migration, exact PDF totals, 2/3/4/5/15 rights, EXP curve, diminishing battle EXP and cap/reset, loss/abandon/friendly exclusion, multi-level rewards, persistent random draws, duplicates, missing-class vouchers, daily and imperial EXP, owner isolation and grants.');
}
module.exports={database,state,claim,grant,user,A,B};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
