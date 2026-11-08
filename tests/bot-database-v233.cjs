const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {database,core}=require('./combat-stats-v73.cjs');
module.exports=async()=>{const db=await database(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
try{
 await db.exec(`create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
 create table public.ludus_imperial_admins(user_id uuid primary key);
 create table public.ludus_clans(id uuid primary key default gen_random_uuid(),name text,emblem integer,background text,emblem_color text,leader_id uuid);
 create table public.ludus_clan_members(user_id uuid primary key,clan_id uuid,vault_access boolean default false);
 create table public.ludus_stones(owner_id uuid,family text,stone_id integer,quantity integer);
 alter table public.ludus_accounts add column sapphires integer default 0,add column rubies integer default 0;
 alter table public.ludus_items add column market_listing_id uuid;
 create function public.ludus_buy_basic(text,uuid)returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.ludus_upgrade_item_v10(uuid,text,integer,uuid)returns jsonb language sql as $$select '{}'::jsonb$$;`);
 const owner=randomUUID(),clan=randomUUID();await q("insert into public.ludus_accounts(user_id,username,ludus_name) values($1,'owner','Dominus')",[owner]);await q('insert into public.ludus_imperial_admins values($1)',[owner]);await q("insert into public.ludus_clans(id,name,leader_id) values($1,'Roma',$2)",[clan,owner]);await q('insert into public.ludus_clan_members(user_id,clan_id) values($1,$2)',[owner,clan]);
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'supabase/migrations'),parts=fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(x=>x.endsWith('_bot_fleet_v233.sql'))),'utf8').split('-- Production scheduling:');await db.exec(parts[0]);
 await db.exec(`create schema net;create schema cron;create table net.v233_posts(url text);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin insert into net.v233_posts values(url);return 1;end$$;
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 await db.exec(parts[1].slice(parts[1].indexOf('\n')+1).replace('create extension if not exists pg_net;',''));
 await db.exec('set role authenticated');await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);let state=(await q('select ludus_bot_admin_v233() s'))[0].s;assert.equal(state.created,0);assert.equal(state.total,39);
 await assert.rejects(()=>q('select ludus_bot_context_v233()'),/permission denied/);await assert.rejects(()=>q('select * from ludus_bot_private.settings_v233'),/permission denied/);
 await db.exec('reset role;set role service_role');await q("select ludus_bot_install_v233($1,'https://test.supabase.co/functions/v1/bot-runner-v233',false)",[owner]);
 assert.equal((await q('select ludus_bot_context_v233() s'))[0].s.setup_requested,false,'configuration never starts accounts');
 await db.exec('reset role');await q('select ludus_bot_private.schedule_v233()');assert.equal((await q('select count(*)::int n from net.v233_posts'))[0].n,0);
 await db.exec('set role service_role');
 await q("select ludus_bot_install_v233($1,'https://test.supabase.co/functions/v1/bot-runner-v233',true)",[owner]);
 const context=(await q('select ludus_bot_context_v233() s'))[0].s;assert.equal(context.missing.length,10);assert.equal(context.setup_requested,true);
 await db.exec('reset role');await q('select ludus_bot_private.schedule_v233()');assert.equal((await q('select count(*)::int n from net.v233_posts'))[0].n,1);
 await db.exec('reset role');const bots=[];for(let slot=1;slot<=39;slot++){const id=randomUUID();bots.push(id);await q('insert into auth.users values($1,$2,clock_timestamp())',[id,{ludus_bot_nonce:context.nonce,ludus_bot_slot:String(slot)}]);await q('insert into public.ludus_accounts(user_id,username,ludus_name) values($1,$2,$3)',[id,'bot_'+slot,'Ludus '+slot]);await db.exec('set role service_role');await q('select ludus_bot_register_v233($1,$2)',[slot,id]);await db.exec('reset role');}
 await db.exec('set role service_role');const assigned=(await q('select ludus_bot_assign_v233() s'))[0].s;assert.equal(assigned.bots,39);assert.equal((await q('select ludus_bot_assign_v233() s'))[0].s.replayed,true);
 await db.exec('reset role');const groups=await q('select clan_id,count(*)::int n from public.ludus_clan_members group by clan_id order by n');assert.deepEqual(groups.map(x=>x.n),[10,10,10,10]);
 await q('select ludus_bot_private.schedule_v233()');assert.equal((await q('select count(*)::int n from net.v233_posts'))[0].n,3,'two independent bounded matches per minute after setup');
 const fighter=randomUUID(),weapon=randomUUID();await q("insert into public.ludus_gladiators(id,owner_id,name,class,base_stats,stat_version)values($1,$2,'Bot','secutor',$3,46)",[fighter,bots[0],core]);await q("insert into public.ludus_items(id,owner_id,kind,model,equipped_by,equipped_slot) values($1,$2,'weapon','gladius',$3,'main_hand')",[weapon,bots[0],fighter]);
 await db.exec('set role service_role');const claim=(await q('select ludus_bot_claim_v233() s'))[0].s;if(claim.fault){await db.exec('reset role');throw Error(JSON.stringify((await q('select last_error from ludus_bot_private.members_v233 where slot=1'))[0]));}assert.equal(claim.slot,1);assert.ok(claim.ticket.loot.length>0);
 await q('select ludus_bot_save_v233($1,$2,$3,$4,$5,null)',[claim.slot,claim.lease,claim.battle,'compressed-state',400]);await assert.rejects(()=>q('select ludus_bot_save_v233($1,$2,$3,$4,$5,null)',[claim.slot,claim.lease,claim.battle,'compressed-state',400]),/geçersiz/);
 await db.exec('reset role');await q("update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()-interval '1 minute' where slot=1");await db.exec('set role service_role');const next=(await q('select ludus_bot_claim_v233() s'))[0].s;assert.equal(next.state,'compressed-state');assert.equal(next.steps,400);assert.equal(next.ticket,null);
 await q('select ludus_bot_save_v233($1,$2,$3,null,$4,$5)',[next.slot,next.lease,next.battle,800,{won:true,stats:{alive:false,exit_slots:{},game_mode:'4x5',seconds:30}}]);
 await db.exec('reset role');await q("update public.ludus_battles set started_at=clock_timestamp()-interval '1 minute' where id=$1",[next.battle]);await q("update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()-interval '1 minute' where slot=1");await db.exec('set role service_role');assert.equal((await q('select ludus_bot_claim_v233() s'))[0].s.finished,true);
 await db.exec('reset role');const account=(await q('select gold,diamonds,wins from public.ludus_accounts where user_id=$1',[bots[0]]))[0];assert.equal(account.gold,100);assert.equal(account.diamonds,1);assert.equal(account.wins,1);assert.equal((await q('select count(*)::int n from public.ludus_battle_receipts where owner_id=$1',[bots[0]]))[0].n,1);
 await db.exec('set role authenticated');await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);state=(await q("select ludus_bot_admin_v233('bot',$1) s",[{slot:1,enabled:false}]))[0].s;assert.equal(state.bots[0].enabled,false);assert.equal(state.bots[0].matches,1);assert.equal(state.bots[0].build.length,4);
 // Complete a second match through the real arena simulation and then submit
 // precisely its outcome to the game's normal server settlement function.
 await db.exec('reset role');const fighter2=randomUUID(),weapon2=randomUUID();
 await q("insert into public.ludus_gladiators(id,owner_id,name,class,base_stats,stat_version)values($1,$2,'Bot 2','secutor',$3,46)",[fighter2,bots[1],core]);
 await q("insert into public.ludus_items(id,owner_id,kind,model,equipped_by,equipped_slot) values($1,$2,'weapon','gladius',$3,'main_hand')",[weapon2,bots[1],fighter2]);
 await q("update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()-interval '1 day' where slot=2");await db.exec('set role service_role');
 let task=(await q('select ludus_bot_claim_v233() s'))[0].s;assert.equal(task.slot,2);const engine=globalThis.LudusBotSimulationV233;let replay=engine.create(task.ticket,Number(task.seed)),outcome;
 for(let chunk=0;chunk<45;chunk++){
  replay=engine.advance(replay,400);outcome=replay.finished?{won:replay.result==='win',stats:replay.stats}:replay.abandoned?{won:false,stats:{game_mode:'4x5',seconds:600,alive:false,exit_slots:{},abandoned:true}}:null;
  await q('select ludus_bot_save_v233($1,$2,$3,$4,$5,$6)',[task.slot,task.lease,task.battle,outcome?null:JSON.stringify(replay),replay.steps,outcome]);
  if(outcome)break;
  await db.exec('reset role');await q("update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()-interval '1 day' where slot=2");await db.exec('set role service_role');
  task=(await q('select ludus_bot_claim_v233() s'))[0].s;assert.equal(task.slot,2);replay=JSON.parse(task.state);
 }
 assert.ok(outcome,'actual battle finishes in bounded chunks');
 await db.exec('reset role');await q("update public.ludus_battles set started_at=clock_timestamp()-interval '1 minute' where id=$1",[task.battle]);await q("update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()-interval '1 day' where slot=2");await db.exec('set role service_role');
 const settled=(await q('select ludus_bot_claim_v233() s'))[0].s;assert.equal(settled.finished,true);
 await db.exec('reset role');const real=(await q('select gold,diamonds,wins,losses from public.ludus_accounts where user_id=$1',[bots[1]]))[0];
 assert.equal(real.wins,outcome.won?1:0);assert.equal(real.losses,outcome.won?0:1);assert.equal(real.gold,outcome.won?100:0);assert.equal(real.diamonds,outcome.won?1:0);
 assert.equal((await q('select count(*)::int n from public.ludus_battle_receipts where owner_id=$1',[bots[1]]))[0].n,1);
 console.log('V233 bot SQL PASS: admin isolation, 39 identities, four ten-member clans, actual battle API, normal rewards, resumable lease and replay protection.');
}finally{await db.close();}};
