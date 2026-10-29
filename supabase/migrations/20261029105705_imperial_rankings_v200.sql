-- Imperial rankings. No client score writes; immutable result IDs are counted once.
begin;
create schema if not exists ludus_rank_private;
revoke all on schema ludus_rank_private from public,anon,authenticated;
grant usage on schema ludus_rank_private to authenticated,service_role;

create table ludus_rank_private.events(
 source text not null,event_id uuid not null,participant_id uuid not null,
 owner_id uuid not null,gladiator_id uuid,clan_id uuid,
 category text not null check(category in('multiplayer','naval','circus','caravan','guild')),
 side text not null default 'all' check(side in('all','raid','defense')),
 outcome integer not null check(outcome between -1 and 1),
 kills numeric check(kills>=0),deaths numeric check(deaths>=0),assists numeric check(assists>=0),
 points numeric not null default 0,played_at timestamptz not null,
 primary key(source,event_id,participant_id)
);
alter table ludus_rank_private.events enable row level security;
revoke all on ludus_rank_private.events from public,anon,authenticated;
create index rank_owner_v200 on ludus_rank_private.events(owner_id,category,side);
create index rank_gladiator_v200 on ludus_rank_private.events(gladiator_id) where category='guild';
create index rank_clan_v200 on ludus_rank_private.events(clan_id) where category='guild';
create table ludus_rank_private.ratings(scope text not null,entity_id uuid not null,points numeric not null default 1500,primary key(scope,entity_id));
alter table ludus_rank_private.ratings enable row level security;
revoke all on ludus_rank_private.ratings from public,anon,authenticated;
create table ludus_rank_private.settlements(source text not null,event_id uuid not null,created_at timestamptz not null default now(),primary key(source,event_id));
alter table ludus_rank_private.settlements enable row level security;
revoke all on ludus_rank_private.settlements from public,anon,authenticated;

create function ludus_rank_private.num(j jsonb) returns numeric language sql immutable set search_path='' as $$
 select case when jsonb_typeof(j)='number' then greatest(0,least(1000000000,j::text::numeric)) end
$$;
create function ludus_rank_private.valid_stats(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v numeric;
begin
 if jsonb_typeof(s) is distinct from 'object' then return false;end if;
 foreach k in array array['kills','deaths','assists'] loop
  if jsonb_typeof(s->k) is distinct from 'number' then return false;end if;
  v:=(s->>k)::numeric;if v<0 or v>10000 or v<>trunc(v) then return false;end if;
 end loop;
 return true;
end $$;
-- Each natural attribute is measured against that equipment kind at +15 and
-- 100% Sapphire (base * 2.5 * 2). All four Emerald sockets have equal weight.
-- This is a fixed reference, NOT an enhancement cap: >+15 can exceed 100%.
create function ludus_rank_private.item_score(i jsonb) returns numeric language plpgsql immutable set search_path='' as $$
declare keys text[];bases numeric[];n integer;total numeric:=0;v numeric;e jsonb;
begin
 if coalesce((i->>'stat_version')::integer,0)<>10 then return null;end if;
 case i->>'kind'
 when 'weapon' then bases:=array[7,3,5,3,5,3];
 when 'shield' then bases:=array[2,1,2,8,12,1];
 when 'helmet' then bases:=array[4,2,3,4,4,4];
 when 'chest' then bases:=array[8,4,4,6,6,6];
 when 'gloves' then bases:=array[4,2,2,4,5,2];
 when 'legs' then bases:=array[6,4,3,3,3,5];
 else return null;end case;
 keys:=case when i->>'kind' in('weapon','shield') then array['physical_power','critical_rate','critical_damage','block_rate','block_power','armor_penetration']
 when i->>'kind' in('helmet','chest') then array['physical_defense','damage_reduction','critical_resistance','pierce_resistance','slash_resistance','projectile_resistance']
 else array['acceleration','movement_speed','dodge_rate','recovery_speed','turn_speed','dodge_distance'] end;
 for n in 1..6 loop
  v:=ludus_rank_private.num(i->'natural_stats'->keys[n]);
  if v is null then return null;end if;
  total:=total+100*v*(1+.1*coalesce(ludus_rank_private.num(i->'enhancement'),0))
   *(1+least(100,coalesce(ludus_rank_private.num(i->'natural_percentages'->keys[n]),0))/100)/(bases[n]*5);
 end loop;
 for e in select value from jsonb_array_elements(case when jsonb_typeof(i->'emeralds')='array' then i->'emeralds' else '[]'::jsonb end) limit 4 loop
  total:=total+least(100,coalesce(ludus_rank_private.num(e->'value'),0));
 end loop;
 return total/10;
end $$;

create function ludus_rank_private.archive_battle(b jsonb) returns void language plpgsql set search_path='' as $$
declare u uuid;s jsonb:=b->'stats';mode text:=coalesce(s->>'game_mode',b->>'mode');
begin
 if b->>'finished_at' is null or mode<>'naval4x5' then return;end if;
 select owner_id into u from public.ludus_gladiators where id=(b->>'gladiator_id')::uuid;
 if u is null then return;end if;
 insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,gladiator_id,category,outcome,kills,deaths,assists,points,played_at)
 values('battle',(b->>'id')::uuid,(b->>'gladiator_id')::uuid,u,(b->>'gladiator_id')::uuid,'naval',case when (b->>'won')::boolean then 1 else -1 end,
 ludus_rank_private.num(s->'kills'),case when s->>'abandoned'='true' then null when s->>'alive'='true' then 0 when s->>'alive'='false' then 1 end,
 ludus_rank_private.num(s->'assists'),case when (b->>'won')::boolean then 10 else 0 end,(b->>'finished_at')::timestamptz) on conflict do nothing;
end $$;
create function ludus_rank_private.archive_raid(r jsonb) returns void language plpgsql set search_path='' as $$
declare g text;s jsonb;
begin
 if r->>'resolved_at' is null then return;end if;
 for g in select jsonb_array_elements_text(r->'gladiators') loop
  select value into s from jsonb_array_elements(case when jsonb_typeof(r->'career_stats')='array' then r->'career_stats' else '[]'::jsonb end) where value->>'id'=g;
  insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,gladiator_id,category,side,outcome,kills,deaths,assists,played_at)
  values('raid',(r->>'id')::uuid,g::uuid,(r->>'owner_id')::uuid,g::uuid,'caravan','raid',case when (r->>'success')::boolean then 1 else -1 end,
   ludus_rank_private.num(s->'kills'),ludus_rank_private.num(s->'deaths'),ludus_rank_private.num(s->'assists'),(r->>'resolved_at')::timestamptz) on conflict do nothing;
 end loop;
end $$;
create function ludus_rank_private.archive_heat(h jsonb) returns void language plpgsql set search_path='' as $$
begin
 if h->>'status'<>'settled' or not coalesce((h->>'entered')::boolean,false) then return;end if;
 insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,category,outcome,played_at)
 values('circus',(h->>'id')::uuid,(h->>'owner_id')::uuid,(h->>'owner_id')::uuid,'circus',case when (h->>'winner')::int=3 then 1 else -1 end,
 coalesce((h->>'finish_at')::timestamptz,(h->>'paid_at')::timestamptz,(h->>'created_at')::timestamptz)) on conflict do nothing;
end $$;
create function ludus_rank_private.archive_match(m jsonb) returns void language plpgsql set search_path='' as $$
declare p jsonb;s jsonb;a numeric;won integer;
begin
 if m->>'status'<>'finished' or coalesce(m->>'venue','arena')='pit' or m->>'starts_at' is null
  or (m->>'starts_at')::timestamptz>(m->>'updated_at')::timestamptz or jsonb_array_length(m->'players')<2 then return;end if;
 for p in select value from jsonb_array_elements(m->'players') loop
  s:=p->'career';a:=null;
  if s->>'assist_version'='200' then
   select count(*) into a from jsonb_array_elements(m->'players') victim
    where victim->'career'->>'killer' is not null and victim->'career'->>'killer'<>p->>'owner'
    and victim->>'owner'<>p->>'owner'
    and coalesce(ludus_rank_private.num(victim->'career'->'contributors'->(p->>'owner')),0)>=greatest(1,coalesce(ludus_rank_private.num(victim->'maxHp'),100)*.1);
  end if;
  won:=case when m->>'winner' is null then 0 when m->>'winner'=p->>'owner' then 1 else -1 end;
  insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,gladiator_id,category,outcome,kills,deaths,assists,points,played_at)
  values('online',(m->>'id')::uuid,(p->>'owner')::uuid,(p->>'owner')::uuid,(p->'gladiator'->>'id')::uuid,'multiplayer',won,
   ludus_rank_private.num(s->'kills'),ludus_rank_private.num(s->'deaths'),a,case won when 1 then 20 when -1 then -5 else 0 end,(m->>'updated_at')::timestamptz) on conflict do nothing;
 end loop;
end $$;
create function ludus_rank_private.capture() returns trigger language plpgsql set search_path='' as $$
begin
 case tg_argv[0]
 when 'battle' then perform ludus_rank_private.archive_battle(to_jsonb(new));
 when 'raid' then perform ludus_rank_private.archive_raid(to_jsonb(new));
 when 'circus' then perform ludus_rank_private.archive_heat(to_jsonb(new));
 when 'online' then perform ludus_rank_private.archive_match(to_jsonb(new));
 end case;
 return new;
end $$;
create trigger rank_battle_v200 after insert on ludus_career_private.battles for each row execute function ludus_rank_private.capture('battle');
create trigger rank_raid_v200 after insert or update of resolved_at on ludus_supply_private.raids_v124 for each row when(new.resolved_at is not null) execute function ludus_rank_private.capture('raid');
create trigger rank_circus_v200 after insert or update of status on ludus_circus_private.heats for each row when(new.status='settled') execute function ludus_rank_private.capture('circus');
create trigger rank_online_v200 after insert or update of status on public.ludus_matches for each row when(new.status='finished') execute function ludus_rank_private.capture('online');
do $$declare r record;begin
 for r in select * from ludus_career_private.battles order by finished_at,id loop perform ludus_rank_private.archive_battle(to_jsonb(r));end loop;
 for r in select * from ludus_supply_private.raids_v124 where resolved_at is not null order by resolved_at,id loop perform ludus_rank_private.archive_raid(to_jsonb(r));end loop;
 for r in select * from ludus_circus_private.heats where status='settled' and entered order by created_at,id loop perform ludus_rank_private.archive_heat(to_jsonb(r));end loop;
 for r in select * from public.ludus_matches where status='finished' order by updated_at,id loop perform ludus_rank_private.archive_match(to_jsonb(r));end loop;
end $$;

-- Online damage observation: preserve the existing telemetry and combat rules.
create or replace function ludus_career_private.init_match() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='waiting' then
  select coalesce(jsonb_agg(p||jsonb_build_object('career',jsonb_build_object('version',162,'assist_version',200,'kills',0,'deaths',0,'damage',0,'damageTaken',0,'contributors','{}'::jsonb))),'[]') into new.players from jsonb_array_elements(new.players)p;
 end if;return new;
end $$;
create or replace function ludus_career_private.hit(a jsonb,v jsonb,amount numeric) returns jsonb language plpgsql immutable set search_path='' as $$
declare actual numeric:=least(greatest(0,coalesce((v->>'hp')::numeric,0)),greatest(0,amount));dead integer;c jsonb;who text:=a->>'owner';
begin
 dead:=case when actual>0 and actual>=(v->>'hp')::numeric then 1 else 0 end;
 if a->'career'->>'version'='162' then a:=jsonb_set(a,'{career}',a->'career'||jsonb_build_object('damage',coalesce((a->'career'->>'damage')::numeric,0)+actual,'kills',coalesce((a->'career'->>'kills')::int,0)+dead));end if;
 if v->'career'->>'version'='162' then
  c:=v->'career'||jsonb_build_object('damageTaken',coalesce((v->'career'->>'damageTaken')::numeric,0)+actual,'deaths',coalesce((v->'career'->>'deaths')::int,0)+dead);
  if c->>'assist_version'='200' and actual>0 and who is not null then
   c:=c||jsonb_build_object('contributors',coalesce(c->'contributors','{}')||jsonb_build_object(who,coalesce((c->'contributors'->>who)::numeric,0)+actual));
   if dead=1 then c:=c||jsonb_build_object('killer',who);end if;
  end if;
  v:=jsonb_set(v,'{career}',c);
 end if;
 return jsonb_build_array(a,v);
end $$;

-- Only an authoritative server can settle a guild war. Roster membership is
-- checked against locked rosters; browser clients have no EXECUTE permission.
create function ludus_rank_private.guild_result(p_match uuid,p_roster_a uuid,p_roster_b uuid,p_winner uuid,p_stats jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.ludus_clan_rosters;b public.ludus_clan_rosters;r record;s jsonb;ra numeric;rb numeric;delta numeric;n integer;
begin
 perform pg_advisory_xact_lock(200,1);
 if exists(select 1 from ludus_rank_private.settlements where source='guild' and event_id=p_match) then return jsonb_build_object('recorded',true,'replayed',true);end if;
 if jsonb_typeof(p_stats) is distinct from 'array' then raise exception 'Savaş istatistikleri eksik.';end if;
 perform 1 from public.ludus_clan_rosters where id in(p_roster_a,p_roster_b) order by id for update;
 select * into a from public.ludus_clan_rosters where id=p_roster_a and state='locked';
 select * into b from public.ludus_clan_rosters where id=p_roster_b and state='locked';
 if a.id is null or b.id is null or a.clan_id=b.clan_id or p_match is null or (p_winner is not null and p_winner not in(a.clan_id,b.clan_id)) then raise exception 'Kilitli savaş kadroları doğrulanamadı.';end if;
 select count(*) into n from public.ludus_clan_roster_entries where roster_id in(a.id,b.id);
 if n<2 or n>40 or jsonb_typeof(p_stats)<>'array' or jsonb_array_length(p_stats)<>n
  or (select count(distinct value->>'id') from jsonb_array_elements(p_stats))<>n then raise exception 'Savaşa katılan gladyatörler eksik.';end if;
 for s in select value from jsonb_array_elements(p_stats) loop
  if not exists(select 1 from public.ludus_clan_roster_entries where roster_id in(a.id,b.id) and gladiator_id::text=s->>'id')
   or not ludus_rank_private.valid_stats(s) then raise exception 'Savaş istatistikleri doğrulanamadı.';end if;
 end loop;
 insert into ludus_rank_private.ratings(scope,entity_id) values('clan',a.clan_id),('clan',b.clan_id) on conflict do nothing;
 select points into ra from ludus_rank_private.ratings where scope='clan' and entity_id=a.clan_id;
 select points into rb from ludus_rank_private.ratings where scope='clan' and entity_id=b.clan_id;
 delta:=round(32*((case when p_winner is null then .5 when p_winner=a.clan_id then 1 else 0 end)-1/(1+power(10::numeric,least(10,greatest(-10,(rb-ra)/400))))));
 update ludus_rank_private.ratings set points=points+case when entity_id=a.clan_id then delta else -delta end where scope='clan' and entity_id in(a.clan_id,b.clan_id);
 for r in select e.*,z.clan_id from public.ludus_clan_roster_entries e join public.ludus_clan_rosters z on z.id=e.roster_id where e.roster_id in(a.id,b.id) order by e.gladiator_id loop
  select value into s from jsonb_array_elements(p_stats) where value->>'id'=r.gladiator_id::text;
  insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,gladiator_id,clan_id,category,outcome,kills,deaths,assists,points,played_at)
  values('guild',p_match,r.gladiator_id,r.user_id,r.gladiator_id,r.clan_id,'guild',case when p_winner is null then 0 when p_winner=r.clan_id then 1 else -1 end,
   ludus_rank_private.num(s->'kills'),ludus_rank_private.num(s->'deaths'),ludus_rank_private.num(s->'assists'),case when r.clan_id=a.clan_id then delta else -delta end,now());
  insert into ludus_rank_private.ratings(scope,entity_id,points) values('fighter',r.gladiator_id,1500+case when r.clan_id=a.clan_id then delta else -delta end)
   on conflict(scope,entity_id) do update set points=ludus_rank_private.ratings.points+excluded.points-1500;
 end loop;
 insert into ludus_rank_private.settlements values('guild',p_match,now());
 return jsonb_build_object('recorded',true,'delta_a',delta,'delta_b',-delta);
end $$;
create function public.ludus_guild_result_v200(p_match uuid,p_roster_a uuid,p_roster_b uuid,p_winner uuid,p_stats jsonb) returns jsonb
language sql security invoker set search_path='' as $$select ludus_rank_private.guild_result(p_match,p_roster_a,p_roster_b,p_winner,p_stats)$$;

-- Defense is a distinct verified outcome, never inferred from a cargo delivery.
create function ludus_rank_private.defense_result(p_job uuid,p_won boolean,p_stats jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j ludus_supply_private.jobs;s jsonb;
begin
 select * into j from ludus_supply_private.jobs where id=p_job for update;
 if not found or coalesce(cardinality(j.escort),0)=0 then raise exception 'Savunma kadrosu bulunamadı.';end if;
 if exists(select 1 from ludus_rank_private.settlements where source='defense' and event_id=p_job) then return jsonb_build_object('recorded',true,'replayed',true);end if;
 if jsonb_typeof(p_stats) is distinct from 'array' then raise exception 'Savunma istatistikleri eksik.';end if;
 if p_won is null or jsonb_typeof(p_stats)<>'array' or jsonb_array_length(p_stats)<>cardinality(j.escort)
 or (select count(distinct value->>'id') from jsonb_array_elements(p_stats))<>cardinality(j.escort) then raise exception 'Savunma istatistikleri eksik.';end if;
 for s in select value from jsonb_array_elements(p_stats) loop
  if not coalesce((s->>'id')::uuid=any(j.escort),false) or not ludus_rank_private.valid_stats(s) then raise exception 'Savunma katılımcısı doğrulanamadı.';end if;
  insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,gladiator_id,category,side,outcome,kills,deaths,assists,played_at)
  values('defense',p_job,(s->>'id')::uuid,j.owner_id,(s->>'id')::uuid,'caravan','defense',case when p_won then 1 else -1 end,
   ludus_rank_private.num(s->'kills'),ludus_rank_private.num(s->'deaths'),ludus_rank_private.num(s->'assists'),now());
 end loop;
 insert into ludus_rank_private.settlements values('defense',p_job,now());return jsonb_build_object('recorded',true);
end $$;
create function public.ludus_caravan_defense_result_v200(p_job uuid,p_won boolean,p_stats jsonb) returns jsonb
language sql security invoker set search_path='' as $$select ludus_rank_private.defense_result(p_job,p_won,p_stats)$$;

-- The read endpoint exposes only public game identity and aggregate achievements.
create function ludus_rank_private.board(p_scope text,p_category text,p_group text,p_sort text,p_clan uuid,p_query text,p_page integer,p_page_size integer,p_target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();mine uuid;answer jsonb;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Sıralamalar için hesabına giriş yap.';end if;
 if p_scope is null or p_scope not in('players','clans','fighters') or p_category is null or p_category not in('gladiator','equipment','multiplayer','naval','circus','caravan','guild')
 or p_group is null or p_group not in('all','attack','defense','mobility','raid') or p_sort is null or p_sort not in('score','wins') then raise exception 'Geçersiz sıralama ölçütü.';end if;
 if p_scope<>'players' then p_category:='guild';p_group:='all';end if;
 if p_category in('gladiator','equipment') then p_sort:='score';end if;
 if p_category in('circus','caravan') then p_sort:='wins';end if;
 if p_category='equipment' and p_group not in('all','attack','defense','mobility') then raise exception 'Geçersiz ekipman grubu.';end if;
 if p_category='caravan' and p_group not in('all','raid','defense') then raise exception 'Geçersiz kervan grubu.';end if;
 p_page:=greatest(0,least(100000,coalesce(p_page,0)));p_page_size:=greatest(1,least(20,coalesce(p_page_size,8)));p_query:=left(trim(coalesce(p_query,'')),60);
 select clan_id into mine from public.ludus_clan_members where user_id=u;
 with gear as materialized(
  select g.id,g.owner_id,g.overall,g.class,
   count(i.id)filter(where i.stat_version<>10 or ludus_rank_private.item_score(to_jsonb(i)) is null) as unknown,
   coalesce(sum(ludus_rank_private.item_score(to_jsonb(i)))filter(where i.equipped_slot in('main_hand','off_hand')),0)/2 as attack,
   coalesce(sum(ludus_rank_private.item_score(to_jsonb(i)))filter(where i.equipped_slot in('helmet','chest')),0)/2 as defense,
   coalesce(sum(ludus_rank_private.item_score(to_jsonb(i)))filter(where i.equipped_slot in('gloves','legs')),0)/2 as mobility
  from public.ludus_gladiators g left join public.ludus_items i on i.equipped_by=g.id and i.owner_id=g.owner_id and i.clan_vault_id is null and i.market_listing_id is null
  where p_scope='players'
  group by g.id,g.owner_id,g.overall,g.class
 ), power as(
  select owner_id,count(*) roster_count,round(avg(overall),2) gladiator,
   case when sum(unknown)=0 then round(avg(attack),2) end attack,
   case when sum(unknown)=0 then round(avg(defense),2) end defense,
   case when sum(unknown)=0 then round(avg(mobility),2) end mobility,
   case when sum(unknown)=0 then round(avg((attack+defense+mobility)/3),2) end equipment
  from gear group by owner_id
 ), event_rows as(
  select e.*,e.category||case when e.category='caravan' then '_'||e.side else '' end metric from ludus_rank_private.events e
  union all select e.*,'caravan' from ludus_rank_private.events e where category='caravan'
 ), grouped as(
  select owner_id,metric,count(distinct (source,event_id)) matches,
   count(distinct (source,event_id))filter(where outcome=1) wins,count(distinct (source,event_id))filter(where outcome=-1) losses,
   case when count(kills)=count(*) then sum(kills) end kills,case when count(deaths)=count(*) then sum(deaths) end deaths,
   case when count(assists)=count(*) then sum(assists) end assists,
   sum(kills)filter(where kills is not null and deaths is not null) kd_kills,sum(deaths)filter(where kills is not null and deaths is not null) kd_deaths,
   sum(kills)filter(where kills is not null and deaths is not null and assists is not null) kda_kills,
   sum(deaths)filter(where kills is not null and deaths is not null and assists is not null) kda_deaths,
   sum(assists)filter(where kills is not null and deaths is not null and assists is not null) kda_assists,
   count(*)filter(where kills is not null and deaths is not null) kd_tracked,
   sum(points) points,count(*)filter(where kills is not null and deaths is not null and assists is not null) tracked,count(*) participants
  from event_rows where category<>'guild' group by owner_id,metric
 ), summaries as(
  select owner_id,jsonb_object_agg(metric,to_jsonb(g)-'owner_id'-'metric') stats from grouped g group by owner_id
 ), clan_stats as(
  select clan_id,count(distinct event_id) matches,count(distinct event_id)filter(where outcome=1) wins,count(distinct event_id)filter(where outcome=-1) losses
  from ludus_rank_private.events where category='guild' group by clan_id
 ), fighter_stats as(
  select gladiator_id,count(*) matches,count(*)filter(where outcome=1) wins,count(*)filter(where outcome=-1) losses,
   sum(kills) kills,sum(deaths) deaths,sum(assists) assists from ludus_rank_private.events where category='guild' group by gladiator_id
 ), candidates as(
  select a.user_id id,a.user_id owner_id,a.username name,a.ludus_name subtitle,c.id clan_id,c.name clan,c.emblem,c.emblem_color,c.background,
   jsonb_build_object('gladiator',p.gladiator,'equipment',p.equipment,'attack',p.attack,'defense',p.defense,'mobility',p.mobility,'roster_count',coalesce(p.roster_count,0))||coalesce(s.stats,'{}') stats,
   null::text class,a.user_id=u mine
  from public.ludus_accounts a left join power p on p.owner_id=a.user_id left join summaries s on s.owner_id=a.user_id
  left join public.ludus_clan_members cm on cm.user_id=a.user_id left join public.ludus_clans c on c.id=cm.clan_id where p_scope='players'
  union all
  select c.id,null,c.name,'Hanedan',c.id,c.name,c.emblem,c.emblem_color,c.background,
   jsonb_build_object('guild',jsonb_build_object('matches',coalesce(s.matches,0),'wins',coalesce(s.wins,0),'losses',coalesce(s.losses,0),'points',coalesce(r.points,1500))),null,c.id=mine
  from public.ludus_clans c left join clan_stats s on s.clan_id=c.id left join ludus_rank_private.ratings r on r.scope='clan' and r.entity_id=c.id where p_scope='clans'
  union all
  select g.id,g.owner_id,g.name,a.username,c.id,c.name,c.emblem,c.emblem_color,c.background,
   jsonb_build_object('gladiator',g.overall,'guild',to_jsonb(s)-'gladiator_id'||jsonb_build_object('points',coalesce(r.points,1500))),g.class,g.owner_id=u
  from fighter_stats s join public.ludus_gladiators g on g.id=s.gladiator_id join public.ludus_accounts a on a.user_id=g.owner_id
  left join public.ludus_clan_members cm on cm.user_id=g.owner_id left join public.ludus_clans c on c.id=cm.clan_id
  left join ludus_rank_private.ratings r on r.scope='fighter' and r.entity_id=g.id where p_scope='fighters'
 ), measured as(
  select *,case when p_category='equipment' then (stats->>case p_group when 'all' then 'equipment' else p_group end)::numeric
   when p_category='gladiator' then (stats->>'gladiator')::numeric
   when p_sort='wins' then coalesce((stats->(p_category||case when p_category='caravan' and p_group<>'all' then '_'||p_group else '' end)->>'wins')::numeric,0)
   when p_category='multiplayer' then 1500+coalesce((stats->'multiplayer'->>'points')::numeric,0)
   when p_category='guild' then coalesce((stats->'guild'->>'points')::numeric,1500)
   else coalesce((stats->p_category->>'points')::numeric,0) end score,
   coalesce(stats->(p_category||case when p_category='caravan' and p_group<>'all' then '_'||p_group else '' end),'{}') metrics
  from candidates where p_clan is null or clan_id=p_clan
 ), ranked as materialized(
  select *,case when score is not null then rank()over(order by score desc nulls last) end rank from measured
 ), filtered as materialized(
  select * from ranked where p_query='' or strpos(lower(name),lower(p_query))>0 or strpos(lower(subtitle),lower(p_query))>0
 ), total as(select count(*) n from filtered), paging as(
  select least(p_page,greatest(0,ceil(n::numeric/p_page_size)::int-1)) page from total
 ), visible as(select * from filtered order by score desc nulls last,lower(name),id limit p_page_size offset(select page*p_page_size from paging))
 select jsonb_build_object('version',200,'scope',p_scope,'category',p_category,'group',p_group,'sort',p_sort,'page',(select page from paging),'page_size',p_page_size,'total',(select n from total),
  'rows',coalesce((select jsonb_agg(to_jsonb(v)order by score desc nulls last,lower(name),id)from visible v),'[]'),
  'own',(select to_jsonb(r)from ranked r where r.mine order by score desc nulls last,id limit 1),
  'profile',(select to_jsonb(r)from ranked r where id=p_target),
  'clans',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)order by c.name)from public.ludus_clans c),'[]'),
  'my_clan',mine,'server_now',now(),'guild_matches',(select count(*)from ludus_rank_private.settlements where source='guild'),
  'defense_matches',(select count(*)from ludus_rank_private.settlements where source='defense')) into answer;
 return answer;
end $$;
create function public.ludus_rankings_v200(p_scope text default 'players',p_category text default 'gladiator',p_group text default 'all',p_sort text default 'score',p_clan uuid default null,p_query text default '',p_page integer default 0,p_page_size integer default 8,p_target uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select ludus_rank_private.board(p_scope,p_category,p_group,p_sort,p_clan,p_query,p_page,p_page_size,p_target)$$;

revoke all on all functions in schema ludus_rank_private from public,anon,authenticated;
grant execute on function ludus_rank_private.board(text,text,text,text,uuid,text,integer,integer,uuid) to authenticated;
grant execute on function ludus_rank_private.guild_result(uuid,uuid,uuid,uuid,jsonb),ludus_rank_private.defense_result(uuid,boolean,jsonb) to service_role;
revoke all on function public.ludus_rankings_v200(text,text,text,text,uuid,text,integer,integer,uuid) from public,anon;
grant execute on function public.ludus_rankings_v200(text,text,text,text,uuid,text,integer,integer,uuid) to authenticated;
revoke all on function public.ludus_guild_result_v200(uuid,uuid,uuid,uuid,jsonb),public.ludus_caravan_defense_result_v200(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.ludus_guild_result_v200(uuid,uuid,uuid,uuid,jsonb),public.ludus_caravan_defense_result_v200(uuid,boolean,jsonb) to service_role;
commit;
