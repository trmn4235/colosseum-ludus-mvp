// Use real pit start/finish functions and the same resumable combat as the bot.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {database,core}=require('./combat-stats-v73.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'supabase/migrations');
const migration=name=>fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>f.endsWith('_'+name+'.sql'))),'utf8');
module.exports=async()=>{const db=await database(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;try{
 await db.exec(migration('survival_v83'));await require('./combat-motion-sql-v163.cjs').install(db);
 await db.exec("create table if not exists public.ludus_shop_catalog(sku text primary key,name text,kind text,model text,price integer,category text);create table ludus_supply_private.production_recipes_v118(sku text primary key,name text,kind text,model text,ingredients jsonb,output_type text,output_quantity int,sort_order int);create table ludus_supply_private.recipes(sku text primary key,ingredients jsonb);");
 for(const name of ['equipment_groups_v168','pit_arena_v172','pit_four_fighters_v173','pit_ten_fighters_v176','pit_bow_v178','pit_axe_v192'])await db.exec(migration(name));
 await db.exec(`create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
 create table public.ludus_imperial_admins(user_id uuid primary key);
 create table public.ludus_clans(id uuid primary key default gen_random_uuid(),name text,emblem integer,background text,emblem_color text,leader_id uuid);
 create table public.ludus_clan_members(user_id uuid primary key,clan_id uuid,vault_access boolean default false);
 create table public.ludus_stones(owner_id uuid,family text,stone_id integer,quantity integer);
 -- The generic combat fixture deliberately stubs this function to {}; pit
 -- loans need the real base weapon values or all fighters do near-zero damage.
 create or replace function ludus_private.item_v10(text) returns jsonb language sql immutable as $$select case when $1='weapon' then '{"physical_power":7,"armor_penetration":3,"critical_damage":5,"critical_rate":3,"block_power":5,"block_rate":3}'::jsonb else '{}'::jsonb end$$;
 alter table public.ludus_accounts add column sapphires integer default 0,add column rubies integer default 0;
 alter table public.ludus_items add column market_listing_id uuid;
 create function public.ludus_buy_basic(text,uuid)returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.ludus_upgrade_item_v10(uuid,text,integer,uuid)returns jsonb language sql as $$select '{}'::jsonb$$;`);
 await db.exec(migration('bot_fleet_v233').split('-- Production scheduling:')[0]);await db.exec(migration('bot_fleet_assign_v233_fix'));await db.exec(migration('bot_aventinus_v234'));
 const bot=randomUUID(),fighter=randomUUID(),weapon=randomUUID();await q("insert into public.ludus_accounts(user_id,username,ludus_name)values($1,'bot_test','Ludus Bot')",[bot]);
 await q("insert into public.ludus_gladiators(id,owner_id,name,class,base_stats,stat_version)values($1,$2,'Cassius','secutor',$3,46)",[fighter,bot,core]);
 await q("insert into public.ludus_items(id,owner_id,kind,model,equipped_by,equipped_slot)values($1,$2,'weapon','gladius',$3,'main_hand')",[weapon,bot,fighter]);
 await q("update ludus_bot_private.members_v233 set user_id=$1 where slot=1",[bot]);await q('update ludus_bot_private.settings_v233 set ready=true,enabled=true where id');
 await q('update ludus_pit_private.rules set gate_enabled=true where id');await q('insert into ludus_pit_private.fame(gladiator_id,points)values($1,29)',[fighter]);
 await db.exec('set role service_role');let task=(await q('select ludus_bot_claim_v233() s'))[0].s;if(task.fault){await db.exec('reset role');throw Error(JSON.stringify((await q('select last_error from ludus_bot_private.members_v233 where slot=1'))[0]));}
 assert.equal(task.slot,1);assert.equal(task.ticket.mode,'pit');assert.equal(task.ticket.snapshot.pit_version,173);
 const engine=globalThis.LudusBotSimulationV233;let seed=1,winning=null;
 for(;seed<=30&&!winning;seed++){let r=engine.create(task.ticket,seed);while(!r.finished&&!r.abandoned)r=engine.advance(r,400);if(r.result==='win')winning=seed;}
 assert.ok(winning,'a genuine Aventinus match can be won');let state=engine.create(task.ticket,winning),outcome=null;
 for(let i=0;i<45;i++){state=engine.advance(state,400);outcome=state.finished?{won:state.result==='win',stats:state.stats}:null;
  await q('select ludus_bot_save_v233($1,$2,$3,$4,$5,$6)',[task.slot,task.lease,task.battle,outcome?null:JSON.stringify(state),state.steps,outcome]);if(outcome)break;
  await db.exec('reset role');await q("update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()-interval '1 day' where slot=1");await db.exec('set role service_role');task=(await q('select ludus_bot_claim_v233() s'))[0].s;state=JSON.parse(task.state);
 }
 assert.equal(outcome?.won,true);assert.equal(outcome.stats.opponents_defeated,3);await db.exec('reset role');await q("update ludus_battles set started_at=clock_timestamp()-interval '30 seconds' where id=$1",[task.battle]);await q("update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()-interval '1 day' where slot=1");await db.exec('set role service_role');
 const finish=(await q('select ludus_bot_claim_v233() s'))[0].s;if(!finish.finished){await db.exec('reset role');throw Error(JSON.stringify((await q('select last_error from ludus_bot_private.members_v233 where slot=1'))[0]));}
 await db.exec('reset role');assert.equal((await q('select points from ludus_pit_private.fame where gladiator_id=$1',[fighter]))[0].points,30);assert.equal((await q('select count(*)::int n from ludus_pit_private.awards where gladiator_id=$1',[fighter]))[0].n,1);
 await q("update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()-interval '1 day' where slot=1");await db.exec('set role service_role');const arena=(await q('select ludus_bot_claim_v233() s'))[0].s;if(arena.fault){await db.exec('reset role');throw Error(JSON.stringify((await q('select last_error from ludus_bot_private.members_v233 where slot=1'))[0]));}assert.equal(arena.ticket.mode,'4x5');
 console.log('V234 bot pit PASS: real four-fighter simulation, normal +1 fame, replay safety and Colosseum unlock at 30.');
}finally{await db.close();}};
