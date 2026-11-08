const {PGlite}=require('@electric-sql/pglite');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'../supabase/migrations');
const migration=suffix=>fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(x=>x.endsWith(suffix))),'utf8');

(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
  create schema auth;grant usage on schema auth to authenticated;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create table public.ludus_accounts(user_id uuid primary key,username text,ludus_name text);
  create table public.ludus_gladiators(id uuid primary key,owner_id uuid,name text,class text,status text default 'available',fatigue_value numeric default 0,clan_roster_id uuid,market_listing_id uuid,injured_until timestamptz,training_ends_at timestamptz,overall numeric default 50);
  create table public.ludus_items(id uuid primary key,owner_id uuid,equipped_by uuid,equipped_slot text,locked_battle_id uuid,clan_vault_id uuid,clan_roster_id uuid,market_listing_id uuid);
  create table public.ludus_battles(gladiator_id uuid,finished_at timestamptz);create table public.ludus_imperial_members(gladiator_id uuid,active boolean);
  create table public.ludus_clans(id uuid primary key,name text,emblem integer,emblem_color text,background text);create table public.ludus_clan_rosters(id uuid,state text);create table public.ludus_clan_roster_entries(gladiator_id uuid,roster_id uuid);
  create table public.ludus_matches(id uuid primary key default gen_random_uuid(),status text default 'waiting',updated_at timestamptz default now(),players jsonb,venue text default 'colosseum' constraint ludus_matches_venue_check check(venue in('colosseum','pit')),pit_version int default 0,starts_at timestamptz,winner uuid,created_at timestamptz default now());
  create table public.ludus_duels(status text,updated_at timestamptz,host_g uuid,guest_g uuid);
  create table public.ludus_friends(requester uuid,target uuid,state text);create table public.ludus_clan_members(user_id uuid primary key,clan_id uuid);create table public.ludus_presence(user_id uuid primary key,last_seen timestamptz);
  create schema private;create schema ludus_food_private;create schema ludus_rank_private;create schema ludus_career_private;
  create function ludus_food_private.combat_snapshot_v77(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
  create function private.ludus_combat_stats_v73(jsonb,jsonb) returns jsonb language sql as $$select '{"maxHp":100,"maxStamina":100}'::jsonb$$;
  create function private.ludus_advance_combat_v36(p jsonb,timestamptz) returns jsonb language sql as $$select p$$;
  create function private.ludus_evade_avoids_v163(jsonb,timestamptz,text) returns boolean language sql as $$select false$$;
  create function private.ludus_passive_defense_v73(jsonb,timestamptz,boolean,numeric,numeric,numeric) returns text language sql as $$select 'none'::text$$;
  create function private.ludus_shield_impact_v168(v jsonb,text) returns jsonb language sql as $$select v$$;
  create function private.ludus_hit_v73(jsonb,jsonb,text,text,numeric,numeric,numeric,boolean default false) returns jsonb language sql as $$select '{"damage":20,"critical":false}'::jsonb$$;
  create function ludus_career_private.hit(a jsonb,v jsonb,numeric) returns jsonb language sql as $$select jsonb_build_array(a,v)$$;
  create function ludus_rank_private.archive_match(m jsonb) returns void language plpgsql as $$begin if coalesce(m->>'venue','arena')='pit' then return;end if;end$$;
  create function public.ludus_match(p_action text,p_room uuid default null,p_gladiator uuid default null,p_slots jsonb default '{}',p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
  declare r public.ludus_matches;v_venue text:='colosseum';begin select * into r from public.ludus_matches where id=p_room;
 if p_action='join' and r.venue<>v_venue then raise exception 'Önce diğer arenadaki maçından ayrıl.';end if;
  return '{}'::jsonb;end$$;
  revoke all on function public.ludus_match(text,uuid,uuid,jsonb,jsonb) from public,anon;grant execute on function public.ludus_match(text,uuid,uuid,jsonb,jsonb) to authenticated;`);
  await db.exec(migration('_ranked_party_v244.sql'));await db.exec(migration('_ranked_ready_v246.sql'));await db.exec(migration('_ranked_match_v248.sql'));
  const q=async(s,p=[])=>(await db.query(s,p)).rows,users=Array.from({length:11},()=>randomUUID()),gs=users.map(()=>randomUUID()),clan=randomUUID();
  for(let i=0;i<11;i++){
   await q('insert into ludus_accounts values($1,$2,$3)',[users[i],'user'+i,'Ludus '+i]);
   await q('insert into ludus_gladiators(id,owner_id,name,class) values($1,$2,$3,$4)',[gs[i],users[i],'G'+i,'murmillo']);
   await q('insert into ludus_clan_members values($1,$2)',[users[i],clan]);await q('insert into ludus_presence values($1,now())',[users[i]]);
  }
  await q("insert into public.ludus_clans values($1,'Kartallar',1,'#ffffff','#660000')",[clan]);
  await db.exec('set role authenticated');
  const user=async i=>q("select set_config('request.jwt.claim.sub',$1,false)",[users[i]]);
  const party=async(a,peer=null,g=null,inv=null)=>(await q('select public.ludus_ranked_party_v244($1,$2,$3,$4) r',[a,peer,g,inv]))[0].r;
  const match=async(a,room,input={})=>(await q("select public.ludus_ranked_match_v248($1,$2,null,'{}'::jsonb,$3::jsonb) r",[a,room,input]))[0].r;
  for(const start of [0,5]){
   await user(start);await party('create',null,gs[start]);
   for(let i=start+1;i<start+5;i++)await party('invite',users[i]);
   for(let i=start+1;i<start+5;i++){await user(i);const inbox=await party('inbox');await party('accept',null,gs[i],inbox.invites[0].id);}
  }
  await user(1);await assert.rejects(()=>party('start'),/grup lideri/);
  await user(0);await assert.rejects(()=>party('start'),/READY/);
  for(let i=0;i<10;i++){await user(i);await party('ready');}
  await user(0);let state=await party('start');assert.equal(state.party.queue.status,'waiting');assert.equal(state.ranked_rating,1500);
  await user(1);await party('unready');await user(0);assert.equal((await party('state')).party.queue.status,'idle');
  await user(1);await party('ready');await user(0);await party('start');
  await user(5);state=await party('start');assert.equal(state.party.queue.status,'matched');const mid=state.party.queue.match_id;
  await assert.rejects(()=>party('leave'),/Maç sırasında/);
  await user(10);await assert.rejects(()=>match('state',mid),/erişemezsin/);
  await user(0);await assert.rejects(()=>q("select public.ludus_match('state',$1,null,'{}'::jsonb,'{}'::jsonb)",[mid]),/Ranked Arena/);
  for(let i=0;i<10;i++){await user(i);const m=await match('state',mid);assert.equal(m.status,'waiting');}
  await db.exec('reset role');await q("update public.ludus_matches set starts_at=now()-interval '1 second' where id=$1",[mid]);await db.exec('set role authenticated');
  await user(0);let battle=await match('state',mid);assert.equal(battle.status,'playing');assert.equal(battle.players.length,10);
  const ownTeam=battle.players.find(p=>p.owner===users[0]).ranked_team;
  const ally=battle.players.find(p=>p.owner!==users[0]&&p.ranked_team===ownTeam),enemy=battle.players.find(p=>p.ranked_team!==ownTeam);
  await db.exec('reset role');const pose=battle.players.map(p=>({...p,x:0,z:p.owner===users[0]?0:p.owner===ally.owner?.5:1.1,angle:0,seen:new Date().toISOString(),tick_at:new Date().toISOString(),items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'}]}));
  await q('update public.ludus_matches set players=$2::jsonb where id=$1',[mid,JSON.stringify(pose)]);await db.exec('set role authenticated');
  battle=await match('step',mid,{attack:true,attack_id:'attack-1',target:ally.owner,region:'chest',hand:'main_hand'});
  assert.notEqual(battle.players.find(p=>p.owner===users[0]).strike_target,ally.owner,'teammates cannot be targeted');
  assert.ok(battle.players.find(p=>p.owner===users[0]).strike_target===enemy.owner||battle.players.some(p=>p.owner===battle.players.find(x=>x.owner===users[0]).strike_target&&p.ranked_team!==ownTeam));
  await db.exec('reset role');const defeated=battle.players.map(p=>p.ranked_team===ownTeam?p:{...p,hp:0});
  await q('update public.ludus_matches set players=$2::jsonb where id=$1',[mid,JSON.stringify(defeated)]);await db.exec('set role authenticated');
  battle=await match('state',mid);assert.equal(battle.status,'finished');await match('state',mid);
  state=await party('state');assert.equal(state.party.queue.status,'idle');assert.equal(state.ranked_rating,1510);
  const board=(await q("select public.ludus_ranked_board_v248('',null,0,12) r"))[0].r;assert.equal(board.own.score,1510);assert.equal(board.own.metrics.wins,1);assert.equal(board.rows.find(p=>p.id===users[10]).score,1500);
  await db.exec('reset role');const scores=await q('select user_id,points from ludus_ranked_match_private.live_ratings');
  assert.equal(scores.length,10);assert.ok(scores.filter(x=>defeated.find(p=>p.owner===x.user_id).ranked_team===ownTeam).every(x=>x.points===1510));
  assert.ok(scores.filter(x=>defeated.find(p=>p.owner===x.user_id).ranked_team!==ownTeam).every(x=>x.points===1495));
  assert.equal((await q('select count(*)::int n from ludus_ranked_match_private.live_results'))[0].n,10);
  const a={owner:users[0],ranked_team:'a',hp:100,maxHp:100,stamina:100,x:0,z:0,angle:0,items:[],block:false,stats_version:77,combat_stats:{items:{}}};
  const friend={...a,owner:users[1],z:1},opponent={...a,owner:users[5],ranked_team:'b',z:2};
  const now='2026-11-09T00:00:00Z',later='2026-11-09T00:00:01Z';
  const shot={id:'shot',weapon:'spear',hand:'main_hand',origin_x:0,origin_z:0,x:0,z:0,dx:0,dz:1,launch_at:now,expires_at:'2026-11-09T00:00:02Z',tick_at:now,resolved:false,launched:false,attacker:a,base:20};
  const projectile=(await q('select ludus_ranked_match_private.projectiles_v248($1::jsonb,$2::timestamptz) r',[JSON.stringify([{...a,projectile:shot},friend,opponent]),later]))[0].r;
  assert.equal(projectile[1].hp,100,'projectiles pass through allies');assert.equal(projectile[2].hp,80,'projectiles still hit opponents');
  const stale=randomUUID();await q("insert into public.ludus_matches(id,status,players,starts_at,updated_at,venue) values($1,'playing',$2::jsonb,now()-interval '1 minute',now()-interval '31 seconds','ranked')",[stale,JSON.stringify(pose)]);
  await db.exec('set role authenticated');const cancelled=await match('state',stale);assert.equal(cancelled.status,'finished');assert.equal(cancelled.winner,null,'all disconnected players do not generate a ranked win');
  await db.exec('reset role');assert.equal((await q('select count(*)::int n from ludus_ranked_match_private.live_results'))[0].n,10);
  const grants=(await q("select has_function_privilege('anon','public.ludus_ranked_match_v248(text,uuid,uuid,jsonb,jsonb)','execute') anon,has_function_privilege('authenticated','ludus_ranked_match_private.settle_match(uuid)','execute') settle"))[0];
  assert.equal(grants.anon,false);assert.equal(grants.settle,false);
  console.log('PASS V248: ready and leader authorization, intact 5v5, secure entry, friendly-fire targeting and exactly-once +10/-5 ratings.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
