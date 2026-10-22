-- Participant careers. Existing immutable match IDs are the source of truth:
-- polling/retries cannot increment a counter, and unknown historic metrics stay NULL.
begin;
create schema if not exists ludus_career_private;
revoke all on schema ludus_career_private from public,anon,authenticated;
grant usage on schema ludus_career_private to authenticated,service_role;

create function ludus_career_private.number(j jsonb) returns numeric
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(j)='number' then greatest(0,least(1000000000,j::text::numeric)) end
$$;
revoke all on function ludus_career_private.number(jsonb) from public,anon,authenticated;

-- The legacy reward functions keep only five detailed battles per account.
-- Archive their compact statistics before that cleanup can delete a battle.
create table ludus_career_private.battles(
 id uuid primary key,gladiator_id uuid not null references public.ludus_gladiators(id) on delete cascade,
 mode text not null,won boolean,stats jsonb,finished_at timestamptz not null
);
alter table ludus_career_private.battles enable row level security;
revoke all on ludus_career_private.battles from public,anon,authenticated;
create index career_battles_gladiator_v162 on ludus_career_private.battles(gladiator_id,mode);
create function ludus_career_private.archive_battle() returns trigger language plpgsql set search_path='' as $$
begin
 if new.finished_at is not null then
  insert into ludus_career_private.battles(id,gladiator_id,mode,won,stats,finished_at)
  values(new.id,new.gladiator_id,new.mode,new.won,new.stats-'exit_slots',new.finished_at) on conflict(id)do nothing;
 end if;
 return new;
end $$;
revoke all on function ludus_career_private.archive_battle() from public,anon,authenticated;
create trigger career_archive_v162 after insert or update of finished_at on public.ludus_battles for each row execute function ludus_career_private.archive_battle();
insert into ludus_career_private.battles(id,gladiator_id,mode,won,stats,finished_at)
select id,gladiator_id,mode,won,stats-'exit_slots',finished_at from public.ludus_battles where finished_at is not null on conflict(id)do nothing;

alter table ludus_supply_private.raids_v124 add column if not exists career_stats jsonb;
create index if not exists battles_career_v162 on public.ludus_battles(gladiator_id,mode) where finished_at is not null;
create index if not exists raids_career_v162 on ludus_supply_private.raids_v124 using gin(gladiators) where resolved_at is not null;
create index if not exists horses_races_career_v162 on ludus_circus_private.heats using gin(horse_ids) where entered and status='settled';
create index if not exists matches_career_v162 on public.ludus_matches using gin(players jsonb_path_ops) where status='finished';

-- New online matches start with complete zero-valued telemetry. Matches already
-- playing at deployment retain unknown telemetry instead of a partial lifetime total.
create function ludus_career_private.init_match() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status='waiting' then
  select coalesce(jsonb_agg(p||jsonb_build_object('career',jsonb_build_object('version',162,'kills',0,'deaths',0,'damage',0,'damageTaken',0))),'[]')
  into new.players from jsonb_array_elements(new.players)p;
 end if;
 return new;
end $$;
revoke all on function ludus_career_private.init_match() from public,anon,authenticated;
create trigger career_init_v162 before insert or update on public.ludus_matches for each row execute function ludus_career_private.init_match();

create function ludus_career_private.hit(a jsonb,v jsonb,amount numeric) returns jsonb
language plpgsql immutable set search_path='' as $$
declare actual numeric:=least(greatest(0,coalesce((v->>'hp')::numeric,0)),greatest(0,amount));dead integer;
begin
 dead:=case when actual>0 and actual>=(v->>'hp')::numeric then 1 else 0 end;
 if a->'career'->>'version'='162' then
  a:=jsonb_set(a,'{career}',a->'career'||jsonb_build_object('damage',coalesce((a->'career'->>'damage')::numeric,0)+actual,'kills',coalesce((a->'career'->>'kills')::int,0)+dead));
 end if;
 if v->'career'->>'version'='162' then
  v:=jsonb_set(v,'{career}',v->'career'||jsonb_build_object('damageTaken',coalesce((v->'career'->>'damageTaken')::numeric,0)+actual,'deaths',coalesce((v->'career'->>'deaths')::int,0)+dead));
 end if;
 return jsonb_build_array(a,v);
end $$;
revoke all on function ludus_career_private.hit(jsonb,jsonb,numeric) from public,anon,authenticated;

-- Add observation immediately before HP changes; do not alter damage, RNG or timing.
do $$
declare src text;needle text;replacement text;
begin
 src:=pg_get_functiondef('private.ludus_resolve_combat_v36(jsonb,timestamptz)'::regprocedure);
 needle:='v:=v||jsonb_build_object(''hp'',greatest(0,(v->>''hp'')::int-amount)';
 replacement:=E'hit:=ludus_career_private.hit(a,v,amount);a:=hit->0;v:=hit->1;\n     '||needle;
 if strpos(src,needle)=0 then raise exception 'Career melee hook does not match current combat';end if;
 execute replace(src,needle,replacement);
 src:=pg_get_functiondef('private.ludus_projectiles_v76(jsonb,timestamptz)'::regprocedure);
 needle:='v:=v||jsonb_build_object(''hp'',greatest(0,(v->>''hp'')::int-(hit->>''damage'')::int)';
 replacement:=E's:=ludus_career_private.hit(a,v,(hit->>''damage'')::numeric);a:=s->0;v:=s->1;\n    '||needle;
 if strpos(src,needle)=0 then raise exception 'Career projectile hook does not match current combat';end if;
 execute replace(src,needle,replacement);
end $$;

-- The edge verifier supplies per-fighter data obtained from the replay, never
-- client totals. Settlement and telemetry commit together under the existing locks.
create function ludus_supply_private.verified_career_v162(p_owner uuid,p_raid uuid,p_won boolean,p_seconds numeric,p_stats jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j ludus_supply_private.raids_v124;s jsonb;k text;
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 select * into j from ludus_supply_private.raids_v124 where id=p_raid and owner_id=p_owner for update;
 if not found then raise exception 'Baskın bulunamadı.';end if;
 if j.resolved_at is not null then return ludus_supply_private.raid_view_v124(j);end if;
 if jsonb_typeof(p_stats) is distinct from 'array' or jsonb_array_length(p_stats)<>cardinality(j.gladiators) then raise exception 'Eksik savaş istatistiği.';end if;
 if (select count(distinct entry.value->>'id') from jsonb_array_elements(p_stats)entry)<>cardinality(j.gladiators) then raise exception 'Tekrarlanan gladyatör.';end if;
 for s in select value from jsonb_array_elements(p_stats)loop
  if not coalesce((s->>'id')::uuid=any(j.gladiators),false) then raise exception 'Gladyatör bu baskına katılmadı.';end if;
  foreach k in array array['kills','deaths','damage','damageTaken'] loop
   if jsonb_typeof(s->k) is distinct from 'number' or (s->>k)::numeric<0 or (s->>k)::numeric>10000000 then raise exception 'Geçersiz savaş istatistiği.';end if;
  end loop;
  if (s->>'deaths')::numeric not in(0,1) or (s->>'kills')::numeric<>trunc((s->>'kills')::numeric) then raise exception 'Geçersiz öldürme/ölüm sayısı.';end if;
 end loop;
 update ludus_supply_private.raids_v124 set career_stats=p_stats where id=j.id;
 return ludus_supply_private.verified_v126(p_owner,p_raid,p_won,p_seconds);
end $$;
revoke all on function ludus_supply_private.verified_career_v162(uuid,uuid,boolean,numeric,jsonb) from public,anon,authenticated;
grant execute on function ludus_supply_private.verified_career_v162(uuid,uuid,boolean,numeric,jsonb) to service_role;
create function public.ludus_caravan_verified_v162(p_owner uuid,p_raid uuid,p_won boolean,p_seconds numeric,p_stats jsonb)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.verified_career_v162(p_owner,p_raid,p_won,p_seconds,p_stats)$$;
revoke all on function public.ludus_caravan_verified_v162(uuid,uuid,boolean,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.ludus_caravan_verified_v162(uuid,uuid,boolean,numeric,jsonb) to service_role;

create function ludus_career_private.read() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();gs jsonb;hs jsonb;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Hesabına giriş yap.';end if;
 with owned as materialized(select id from public.ludus_gladiators where owner_id=u),
 events as (
  select b.gladiator_id as id,case when b.stats->>'game_mode'='naval4x5' then 'naval4x5' else b.mode end as mode,
   case when b.mode='survival' then null else b.won end as won,b.stats,
   case when b.stats->>'abandoned'='true' then null when b.stats->>'alive'='true' then 0 when b.stats->>'alive'='false' then 1 end::numeric as deaths,
   b.finished_at as finished
  from ludus_career_private.battles b join owned g on g.id=b.gladiator_id
  union all
  select g.id,'caravan_raid',r.success,s.value,ludus_career_private.number(s.value->'deaths'),r.resolved_at
  from owned g join ludus_supply_private.raids_v124 r on r.gladiators@>array[g.id] and r.resolved_at is not null
  left join lateral(select value from jsonb_array_elements(coalesce(r.career_stats,'[]')) where value->>'id'=g.id::text)s on true
  union all
  select g.id,'multiplayer',case when m.winner is null then null else m.winner::text=p->>'owner' end,p->'career',ludus_career_private.number(p->'career'->'deaths'),m.updated_at
  from owned g join public.ludus_matches m on m.players@>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id)))
  cross join lateral jsonb_array_elements(m.players)p
  where (p->'gladiator'->>'id')=g.id::text and m.status='finished' and m.starts_at is not null and m.starts_at<=m.updated_at and jsonb_array_length(m.players)>=2
 ), metrics as (
  select *,ludus_career_private.number(stats->'kills') as kills,ludus_career_private.number(stats->'damage') as damage,ludus_career_private.number(stats->'damageTaken') as taken from events
 ), grouped as (
  select id,mode,jsonb_build_object('mode',mode,'matches',count(*),'wins',count(*)filter(where won),'losses',count(*)filter(where not won),
   'draws',count(*)filter(where won is null and mode<>'survival'),'kills',sum(kills),'deaths',sum(deaths),
   'kill_matches',count(kills),'death_matches',count(deaths),'damage_matches',count(damage),'taken_matches',count(taken),
   'kd_matches',count(*)filter(where kills is not null and deaths is not null),
   'kd_kills',sum(kills)filter(where deaths is not null),'kd_deaths',sum(deaths)filter(where kills is not null),
   'damage',sum(damage),'damage_taken',sum(taken),'best_stage',max(ludus_career_private.number(stats->'survival_completed')),'last_played',max(finished)) as summary
  from metrics group by id,mode
 ), per_gladiator as(select id,jsonb_agg(summary order by mode) as modes from grouped group by id)
 select coalesce(jsonb_object_agg(g.id,coalesce(p.modes,'[]')),'{}') into gs from owned g left join per_gladiator p using(id);

 select coalesce(jsonb_object_agg(h.id,jsonb_build_object('races',r.races,'wins',r.wins,'losses',r.races-r.wins,'duels',h.matches,'duel_wins',h.wins)),'{}') into hs
 from ludus_stable_private.horses h left join lateral(
  select count(*) as races,count(*)filter(where winner=3) as wins from ludus_circus_private.heats t
  where t.horse_ids@>array[h.id] and t.entered and t.status='settled'
 )r on true where h.owner_id=u;
 return jsonb_build_object('version',162,'user_id',u,'gladiators',gs,'horses',hs);
end $$;
revoke all on function ludus_career_private.read() from public,anon;
grant execute on function ludus_career_private.read() to authenticated;
create function public.ludus_careers() returns jsonb language sql security invoker set search_path='' as $$select ludus_career_private.read()$$;
revoke all on function public.ludus_careers() from public,anon;
grant execute on function public.ludus_careers() to authenticated;
commit;
