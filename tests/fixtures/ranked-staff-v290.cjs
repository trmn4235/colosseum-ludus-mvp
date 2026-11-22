// Genuine Ranked entry/input/resolution stack. Only unrelated wallet/food/exercise services are fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=path.join(__dirname,'../../supabase/migrations');
const migration=suffix=>{const file=fs.readdirSync(directory).find(name=>name.endsWith(suffix));if(!file)throw Error('Missing migration '+suffix);return fs.readFileSync(path.join(directory,file),'utf8');};
function functionSQL(source,name){
 const start=source.search(new RegExp('create(?:\\s+or\\s+replace)?\\s+function\\s+'+name.replaceAll('.','\\.')+'\\s*\\(','i'));
 assert(start>=0,'SQL function '+name);const tail=source.slice(start),tag=tail.match(/\bas\s+(\$[a-zA-Z0-9_]*\$)/i);assert(tag,'body tag '+name);
 const first=tail.indexOf(tag[1],tag.index),last=tail.indexOf(tag[1],first+tag[1].length);assert(last>first,'function end '+name);
 return tail.slice(0,tail.indexOf(';',last+tag[1].length)+1).replace(/^create\s+function/i,'create or replace function');
}
async function setup(db){
  await db.exec(`create role anon;create role authenticated;create role service_role;
  create schema auth;grant usage on schema auth to authenticated;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create table public.ludus_accounts(user_id uuid primary key,username text,ludus_name text);
  create table public.ludus_gladiators(id uuid primary key,owner_id uuid,name text,class text,status text default 'available',fatigue_value numeric default 0,clan_roster_id uuid,market_listing_id uuid,injured_until timestamptz,training_ends_at timestamptz,overall numeric default 50);
  create table public.ludus_items(id uuid primary key,owner_id uuid,equipped_by uuid,equipped_slot text,locked_battle_id uuid,clan_vault_id uuid,clan_roster_id uuid,market_listing_id uuid,kind text,model text,enhancement integer default 0);
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
  await db.exec(`create schema ludus_bot_private;create schema ludus_pit_private;
   create table ludus_bot_private.settings_v233(id boolean primary key,owner_id uuid,ready boolean,enabled boolean);
   create table ludus_bot_private.members_v233(slot integer primary key,user_id uuid,enabled boolean default true);
   create table ludus_bot_private.online_rooms_v237(match_id uuid primary key,owner_id uuid,bot_users uuid[] default '{}',last_tick timestamptz default '-infinity',last_error text);
   create function ludus_pit_private.loan(text) returns jsonb language sql as $$select '{"kind":"weapon","model":"heavy_mace","equipped_slot":"main_hand","enhancement":0}'::jsonb$$;`);
  const legacy=migration('_bot_multiplayer_v237.sql');const from=legacy.indexOf('create function ludus_bot_private.online_assist_v237('),to=legacy.indexOf('end;$$;',from);
  assert.ok(from>=0&&to>from,'legacy bot source');await db.exec(legacy.slice(from,to+7));
  await db.exec(migration('_ranked_bot_allies_v249.sql'));
  await db.exec(`create schema ludus_private;
   create table ludus_private.exercise_events_v46(source text,source_id uuid,gladiator_id uuid,started_at timestamptz);
   create function ludus_private.exercise_prepare_v46(s text,mid uuid,gid uuid,u uuid,n numeric,ends timestamptz) returns void language plpgsql as $$begin if exists(select 1 from public.ludus_gladiators where id=gid and status='injured') then raise exception 'Gladyatör tükenmiş; önce dinlendir.';end if;insert into ludus_private.exercise_events_v46 values(s,mid,gid,now());end$$;
   create function ludus_private.exercise_complete_v46(text,uuid,uuid,integer,text,timestamptz) returns void language plpgsql as $$begin return;end$$;`);
  const exercise=migration('_gladiator_exercise_v46.sql'),exStart=exercise.indexOf('create or replace function ludus_private.exercise_pvp_v46()'),exEnd=exercise.indexOf('end;$$;',exStart);
  assert.ok(exStart>=0&&exEnd>exStart);await db.exec(exercise.slice(exStart,exEnd+7));
  await db.exec('create trigger exercise_match_v46 after insert or update of status on public.ludus_matches for each row execute function ludus_private.exercise_pvp_v46();');
  await db.exec(migration('_ranked_bot_exercise_v250.sql'));
  await db.exec(migration('_ranked_performance_v251.sql'));
  await db.exec(migration('_ranked_latency_v252.sql'));
  await db.exec(migration('_ranked_lineup_v253.sql'));
  await db.exec(migration('_ranked_incoming_v254.sql'));

 // Replace the old smoke-test placeholders with real combat implementations.
 const real=[
  ['_combat_stats_v73.sql','private.ludus_item_stats_v73'],
  ['_combat_stats_v74.sql','private.ludus_combat_stats_v73'],
  ['_combat_stats_v75.sql','private.ludus_hit_v73'],
  ['_combat_stats_v73.sql','private.ludus_passive_defense_v73'],
  ['_combat_motion_v163.sql','private.ludus_evade_offset_v163'],
  ['_combat_motion_v163.sql','private.ludus_evade_avoids_v163'],
  ['_equipment_groups_v168.sql','private.ludus_shield_impact_v168'],
  ['_equipment_groups_v168.sql','private.ludus_resolve_combat_v36'],
  ['_combat_motion_v163.sql','public.ludus_match'],
  ['_imperial_rankings_v200.sql','ludus_career_private.hit']
 ];
 for(const [file,name]of real)await db.exec(functionSQL(migration(file),name));
 await db.exec('drop function private.ludus_advance_combat_v36(jsonb,timestamptz)');
 await db.exec(functionSQL(migration('_combat_motion_v163.sql'),'private.ludus_advance_combat_v36'));
 // This released patch changes shaft contact before the same final damage rounding.
 const realism=migration('_arena_combat_realism_v114.sql'),hitPosition=realism.indexOf("pg_get_functiondef('private.ludus_hit_v73"),patchStart=realism.lastIndexOf('do $v114$',hitPosition),patchEnd=realism.indexOf('end $v114$;',hitPosition)+12;
 await db.exec(realism.slice(patchStart,patchEnd));
 await db.exec(migration('_hand_specials_v261.sql'));
 await db.exec(`create schema ludus_staff_private;create table ludus_staff_private.roles_v284(id text primary key);insert into ludus_staff_private.roles_v284 values('trainer'),('cook'),('doctor'),('smith'),('groom'),('guard');`);
 const catalogue=migration('_papyrus_catalog_v288.sql');
 await db.exec(catalogue.slice(0,catalogue.indexOf('create function ludus_staff_private.catalog_rows_v288')));
 // Reproduce existing active scope; V290 itself must activate its new supported records.
 await db.exec(`update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active' where role_id='trainer' and ordinal not in(4,19) or role_id='cook' and ordinal not in(2,13,16,22,24);`);
 return {catalog:JSON.parse(catalogue.match(/\$catalog\$([\s\S]*?)\$catalog\$/)[1])};
}
module.exports={setup,migration,functionSQL};
