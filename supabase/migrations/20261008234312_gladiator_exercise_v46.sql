-- V46: seven character attributes, one daily exercise allowance, and persistent fatigue.
-- All awards and injury rolls are server-owned. Private ledgers prevent retries earning twice.
alter table public.ludus_gladiators alter column overall type numeric(12,6);
alter table public.ludus_gladiators add column fatigue_value numeric(12,6) not null default 0;
alter table public.ludus_gladiators add column fatigue_rest_from timestamptz not null default now();
alter table public.ludus_training_sessions add column exercise_stat text;
alter table public.ludus_training_sessions add column exercise_settled_at timestamptz;

create table ludus_private.exercise_days_v46(
 gladiator_id uuid not null references public.ludus_gladiators(id) on delete cascade,
 day date not null,units integer not null default 0 check(units between 0 and 3),
 weights jsonb not null default '{}',budget numeric not null,awarded_at timestamptz,
 primary key(gladiator_id,day)
);
create table ludus_private.exercise_events_v46(
 source text not null,source_id uuid not null,gladiator_id uuid not null references public.ludus_gladiators(id) on delete cascade,
 owner_id uuid not null,started_at timestamptz not null,finished_at timestamptz,
 fatigue_start numeric not null,injury_risk numeric not null,injured boolean not null default false,
 primary key(source,source_id,gladiator_id)
);
create index exercise_events_gladiator_v46 on ludus_private.exercise_events_v46(gladiator_id,finished_at desc);
create index training_pending_v46 on public.ludus_training_sessions(owner_id,train_until)where exercise_settled_at is null;
alter table ludus_private.exercise_days_v46 enable row level security;
alter table ludus_private.exercise_events_v46 enable row level security;
revoke all on ludus_private.exercise_days_v46,ludus_private.exercise_events_v46 from public,anon,authenticated;

create or replace function ludus_private.exercise_keys_v46()returns text[] language sql immutable set search_path='' as $$
 select array['attack_technique','defense_technique','muscle','speed','reflex','conditioning','tactics']::text[];
$$;
create or replace function ludus_private.exercise_profile_v46(p_class text)returns jsonb language plpgsql immutable set search_path='' as $$
declare a integer[];k text[]:=ludus_private.exercise_keys_v46();r jsonb:='{}';i integer;
begin
 a:=case p_class when 'murmillo' then array[51,53,52,47,48,51,48]
 when 'thraex' then array[53,48,49,52,52,48,48] when 'hoplomachus' then array[51,51,49,48,50,49,52]
 when 'secutor' then array[50,53,52,48,49,51,47] when 'retiarius' then array[49,47,48,53,53,49,51]
 when 'provocator' then array[49,53,51,47,48,53,49] when 'scissor' then array[53,48,53,49,51,48,48]
 else array[50,50,50,50,50,50,50] end;
 for i in 1..7 loop r:=r||jsonb_build_object(k[i],a[i]);end loop;return r;
end;$$;
create or replace function ludus_private.exercise_mean_v46(p_stats jsonb)returns numeric language sql immutable set search_path='' as $$
 select round(sum((p_stats->>k)::numeric)/7,6)from unnest(ludus_private.exercise_keys_v46())k;
$$;
-- Redistribute overflow from capped attributes. Used for both growth and the exact -35 total injury.
create or replace function ludus_private.exercise_adjust_v46(p_stats jsonb,p_delta numeric,p_weights jsonb default '{}')returns jsonb language plpgsql immutable set search_path='' as $$
declare r jsonb:=p_stats;remaining numeric:=p_delta;w jsonb:=p_weights;keys text[]:=ludus_private.exercise_keys_v46();k text;total numeric;v numeric;change numeric;used numeric;pass integer;has_weight boolean;
begin
 for pass in 1..14 loop
  exit when abs(remaining)<0.00000001;
  total:=0;
  foreach k in array keys loop
   v:=(r->>k)::numeric;
   if (remaining>0 and v<100)or(remaining<0 and v>0)then total:=total+greatest(0,coalesce((w->>k)::numeric,0));end if;
  end loop;
  has_weight:=total>0;
  if not has_weight then
   foreach k in array keys loop v:=(r->>k)::numeric;if (remaining>0 and v<100)or(remaining<0 and v>0)then total:=total+1;end if;end loop;
  end if;
  exit when total=0;used:=0;
  foreach k in array keys loop
   v:=(r->>k)::numeric;
   if (remaining>0 and v<100)or(remaining<0 and v>0)then
    change:=remaining*(case when has_weight then greatest(0,coalesce((w->>k)::numeric,0))else 1 end)/total;
    change:=greatest(-v,least(100-v,change));used:=used+change;
    r:=jsonb_set(r,array[k],to_jsonb(v+change));
   end if;
  end loop;remaining:=remaining-used;
 end loop;return r;
end;$$;
create or replace function ludus_private.exercise_budget_v46(p_overall numeric)returns numeric language sql immutable set search_path='' as $$
 select 3.5/case when p_overall<60 then 1 when p_overall<70 then 1.25 when p_overall<80 then 1.5625 when p_overall<90 then 2.34375 else 3.515625 end;
$$;

-- Preserve earned Overall while replacing the old six-stat profile. No retroactive fatigue or injury.
select set_config('ludus.clan_transfer','on',true);
update public.ludus_gladiators set legacy_base_stats=coalesce(legacy_base_stats,base_stats),
 base_stats=ludus_private.exercise_adjust_v46(ludus_private.exercise_profile_v46(class),(greatest(0,least(100,overall))-50)*7),
 stat_version=46,fatigue_value=fatigue,fatigue_rest_from=now(),training_policy_pending=false;
update public.ludus_gladiators set overall=ludus_private.exercise_mean_v46(base_stats);
select set_config('ludus.clan_transfer','off',true);
create or replace function ludus_private.v7_new_gladiator()returns trigger language plpgsql set search_path='' as $$
begin
 new.legacy_base_stats:=new.base_stats;new.base_stats:=ludus_private.exercise_profile_v46(new.class);
 new.stat_version:=46;new.overall:=50;new.fatigue:=0;new.fatigue_value:=0;new.fatigue_rest_from:=now();
 new.training_week_start:=(now()at time zone'Europe/Istanbul')::date;return new;
end;$$;

create or replace function ludus_private.exercise_recover_v46(p_gladiator uuid)returns void language plpgsql set search_path='' as $$
declare g public.ludus_gladiators;v numeric;ts timestamptz:=clock_timestamp();
begin
 select * into g from public.ludus_gladiators where id=p_gladiator for update;
 if not found or g.clan_roster_id is not null then return;end if;
 v:=greatest(0,g.fatigue_value-greatest(0,extract(epoch from ts-g.fatigue_rest_from))/3600*10);
 update public.ludus_gladiators set fatigue_value=v,fatigue=ceil(v),fatigue_rest_from=greatest(ts,g.fatigue_rest_from),
 status=case when status='injured'and injured_until<=ts then 'available'else status end,
 injury_level=case when injured_until<=ts then 0 else injury_level end where id=g.id;
end;$$;
create or replace function ludus_private.exercise_prepare_v46(p_source text,p_id uuid,p_gladiator uuid,p_owner uuid,p_load numeric,p_rest_from timestamptz)returns void language plpgsql set search_path='' as $$
declare g public.ludus_gladiators;
begin
 if exists(select 1 from ludus_private.exercise_events_v46 where source=p_source and source_id=p_id and gladiator_id=p_gladiator)then return;end if;
 perform ludus_private.exercise_recover_v46(p_gladiator);
 select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=p_owner for update;
 if not found then raise exception 'Gladyatör bulunamadı.';end if;
 if g.clan_roster_id is not null or g.injured_until>clock_timestamp()then raise exception 'Gladyatör sakat veya klan kadrosunda.';end if;
 if g.fatigue_value>=100 then raise exception 'Gladyatör tükenmiş; önce dinlendir.';end if;
 insert into ludus_private.exercise_events_v46 values(p_source,p_id,g.id,p_owner,clock_timestamp(),null,g.fatigue_value,case when g.fatigue_value>70 then .25 else 0 end,false);
 update public.ludus_gladiators set fatigue_value=least(100,g.fatigue_value+p_load),fatigue=ceil(least(100,g.fatigue_value+p_load)),fatigue_rest_from=p_rest_from where id=g.id;
end;$$;
create or replace function ludus_private.exercise_complete_v46(p_source text,p_id uuid,p_gladiator uuid,p_units integer,p_stat text,p_at timestamptz)returns void language plpgsql set search_path='' as $$
declare e ludus_private.exercise_events_v46;g public.ludus_gladiators;d ludus_private.exercise_days_v46;v_day date:=(p_at at time zone'Europe/Istanbul')::date;k text;w jsonb;stats jsonb;take integer;new_injury boolean;
begin
 select * into e from ludus_private.exercise_events_v46 where source=p_source and source_id=p_id and gladiator_id=p_gladiator for update;
 if not found or e.finished_at is not null then return;end if;
 select * into g from public.ludus_gladiators where id=e.gladiator_id for update;
 if g.clan_roster_id is not null then return;end if;
 stats:=g.base_stats;
 if p_units>0 then
  insert into ludus_private.exercise_days_v46(gladiator_id,day,budget)values(g.id,v_day,ludus_private.exercise_budget_v46(g.overall))on conflict do nothing;
  select * into d from ludus_private.exercise_days_v46 where gladiator_id=g.id and exercise_days_v46.day=v_day for update;
  take:=least(p_units,3-d.units);w:=d.weights;
  if take>0 then
   foreach k in array ludus_private.exercise_keys_v46()loop
    w:=w||jsonb_build_object(k,coalesce((w->>k)::numeric,0)+case when p_stat is null then take::numeric/7 when p_stat=k then take else 0 end);
   end loop;
   if d.units+take=3 then stats:=ludus_private.exercise_adjust_v46(stats,d.budget,w);end if;
   update ludus_private.exercise_days_v46 set units=d.units+take,weights=w,awarded_at=case when d.units+take=3 then p_at else null end where gladiator_id=g.id and exercise_days_v46.day=v_day;
  end if;
 end if;
 new_injury:=e.injury_risk>0 and random()<e.injury_risk;
 if new_injury then stats:=ludus_private.exercise_adjust_v46(stats,-least(35,ludus_private.exercise_mean_v46(stats)*7));end if;
 update public.ludus_gladiators set base_stats=stats,overall=ludus_private.exercise_mean_v46(stats),
 fatigue_rest_from=p_at,injured_until=case when new_injury then p_at+interval '12 hours'else injured_until end,
 injury_level=case when new_injury then 1 else injury_level end,status=case when new_injury then 'injured'else status end where id=g.id;
 update ludus_private.exercise_events_v46 set finished_at=p_at,injured=new_injury where source=p_source and source_id=p_id and gladiator_id=g.id;
end;$$;

-- Replace weekly penalties with settlement of completed one-hour sessions and real rest recovery.
create or replace function ludus_private.v7_settle(uid uuid)returns void language plpgsql security definer set search_path='' as $$
declare t record;g record;
begin
 if auth.uid()is null or auth.uid()<>uid then raise exception 'Giriş gerekli.';end if;
 for t in select * from public.ludus_training_sessions where owner_id=uid and train_until<=clock_timestamp()and exercise_settled_at is null order by train_until for update loop
  if t.exercise_stat is not null then perform ludus_private.exercise_complete_v46('training',t.id,t.gladiator_id,3,t.exercise_stat,t.train_until);end if;
  update public.ludus_training_sessions set exercise_settled_at=clock_timestamp()where id=t.id;
 end loop;
 update public.ludus_gladiators set status='available',training_policy_pending=false where owner_id=uid and clan_roster_id is null and status='training'and training_ends_at<=clock_timestamp();
 for g in select id from public.ludus_gladiators where owner_id=uid and clan_roster_id is null order by id loop perform ludus_private.exercise_recover_v46(g.id);end loop;
end;$$;
create or replace function public.ludus_training_state()returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();result jsonb;today date:=(clock_timestamp()at time zone'Europe/Istanbul')::date;
begin
 if u is null then raise exception 'Giriş gerekli.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 perform ludus_private.imperial_settle(u);perform ludus_private.v7_settle(u);
 select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('session',(select to_jsonb(t)from public.ludus_training_sessions t where t.gladiator_id=g.id order by started_at desc limit 1),
 'exercise_units',coalesce((select units from ludus_private.exercise_days_v46 where gladiator_id=g.id and day=today),0),
 'exercise_completed',coalesce((select awarded_at is not null from ludus_private.exercise_days_v46 where gladiator_id=g.id and day=today),false),
 'trained_today',exists(select 1 from public.ludus_training_sessions where gladiator_id=g.id and training_day=today),
 'exercise_gain',ludus_private.exercise_budget_v46(g.overall),
 'last_injury_at',(select max(finished_at)from ludus_private.exercise_events_v46 where gladiator_id=g.id and injured))order by g.created_at),'[]')into result from public.ludus_gladiators g where owner_id=u;
 return jsonb_build_object('server_now',clock_timestamp(),'exercise_day',today,'gladiators',result);
end;$$;

create or replace function public.ludus_train_exercise(p_gladiators uuid[],p_stat text,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();g public.ludus_gladiators;ids uuid[];gid uuid;sid uuid;today date:=(clock_timestamp()at time zone'Europe/Istanbul')::date;ts timestamptz:=clock_timestamp();t public.ludus_training_sessions;
begin
 if u is null or p_request is null then raise exception 'Giriş ve işlem kimliği gerekli.';end if;
 if p_stat is null or not(p_stat=any(ludus_private.exercise_keys_v46()))then raise exception 'Geçerli bir özellik seç.';end if;
 if p_gladiators is null or cardinality(p_gladiators)not between 1 and 30 or cardinality(p_gladiators)<>(select count(distinct x)from unnest(p_gladiators)x)then raise exception '1–30 farklı gladyatör seç.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 perform ludus_private.imperial_settle(u);perform ludus_private.v7_settle(u);
 ids:=array(select x from unnest(p_gladiators)x order by x);
 foreach gid in array ids loop
  sid:=md5(p_request::text||gid::text)::uuid;
  select * into t from public.ludus_training_sessions where id=sid;
  if found then
   if t.owner_id<>u or t.gladiator_id<>gid or t.exercise_stat<>p_stat then raise exception 'İşlem kimliği başka bir antrenmanda kullanıldı.';end if;
   continue;
  end if;
  select * into g from public.ludus_gladiators where id=gid and owner_id=u for update;
  if not found then raise exception 'Yalnızca kendi gladyatörlerini çalıştırabilirsin.';end if;
  if g.status<>'available'or g.clan_roster_id is not null or g.training_ends_at>ts or g.injured_until>ts or exists(select 1 from public.ludus_battles where gladiator_id=gid and finished_at is null)
   or exists(select 1 from public.ludus_matches m where status in('waiting','playing')and updated_at>ts-interval '30 seconds'and players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',gid))))
   or exists(select 1 from public.ludus_duels where status in('waiting','playing')and updated_at>ts-interval '75 seconds'and gid in(host_g,guest_g))then raise exception '% şu anda antrenmana uygun değil.',g.name;end if;
  if (g.base_stats->>p_stat)::numeric>=100 then raise exception '% bu özellikte zaten 100 puan.',g.name;end if;
  if exists(select 1 from public.ludus_training_sessions where gladiator_id=gid and training_day=today)or exists(select 1 from ludus_private.exercise_days_v46 where gladiator_id=gid and day=today and units=3)then raise exception '% bugünkü egzersiz hakkını tamamladı.',g.name;end if;
  perform ludus_private.exercise_prepare_v46('training',sid,gid,u,30,ts+interval '1 hour');
  insert into public.ludus_training_sessions(id,owner_id,gladiator_id,training_day,started_at,train_until,rest_until,exercise_stat)values(sid,u,gid,today,ts,ts+interval '1 hour',ts+interval '2 hours',p_stat);
  update public.ludus_gladiators set status='training',training_type='exercise_v46',training_ends_at=ts+interval '2 hours'where id=gid;
 end loop;return public.ludus_training_state();
end;$$;
-- Compatibility for old clients; the new panel always sends a selected attribute.
create or replace function public.ludus_train_overall(p_gladiator uuid,p_request uuid)returns jsonb language sql security definer set search_path='' as $$
 select public.ludus_train_exercise(array[p_gladiator],'attack_technique',p_request);
$$;

create or replace function ludus_private.exercise_battle_v46()returns trigger language plpgsql security definer set search_path='' as $$
declare g public.ludus_gladiators;e ludus_private.exercise_events_v46;
begin
 if tg_op='INSERT'then
  perform ludus_private.exercise_prepare_v46('battle',new.id,new.gladiator_id,new.owner_id,20,new.started_at+interval '2 hours');
 elsif new.finished_at is not null and old.finished_at is null then
  perform ludus_private.exercise_complete_v46('battle',new.id,new.gladiator_id,case when new.finished_at>=new.started_at+interval '10 seconds'and new.finished_at<=new.started_at+interval '2 hours'and coalesce(new.stats->>'abandoned','false')<>'true'then 1 else 0 end,null,new.finished_at);
  select * into g from public.ludus_gladiators where id=new.gladiator_id;
  select * into e from ludus_private.exercise_events_v46 where source='battle'and source_id=new.id and gladiator_id=new.gladiator_id;
  new.reward:=coalesce(new.reward,'{}')||jsonb_build_object('gladiator_overall',g.overall,'gladiator_injured',coalesce(e.injured,false),'energy',100-g.fatigue_value);
 end if;return new;
end;$$;
create trigger exercise_battle_start_v46 after insert on public.ludus_battles for each row execute function ludus_private.exercise_battle_v46();
create trigger exercise_battle_finish_v46 before update of finished_at on public.ludus_battles for each row execute function ludus_private.exercise_battle_v46();

create or replace function ludus_private.exercise_mission_v46()returns trigger language plpgsql security definer set search_path='' as $$
declare x jsonb;gid uuid;difficulty integer:=coalesce((new.mission->>'difficulty')::integer,(new.mission->>'slot')::integer);
begin
 for x in select value from jsonb_array_elements(new.gladiators)loop
  gid:=(x->>'id')::uuid;
  if tg_op='INSERT'then perform ludus_private.exercise_prepare_v46('mission',new.id,gid,new.owner_id,case difficulty when 1 then 20 when 2 then 35 else 50 end,new.ends_at);
  elsif new.completed_at is not null and old.completed_at is null then perform ludus_private.exercise_complete_v46('mission',new.id,gid,case difficulty when 1 then 3 else 0 end,null,new.ends_at);end if;
 end loop;return new;
end;$$;
create trigger exercise_mission_start_v46 after insert on public.ludus_imperial_assignments for each row execute function ludus_private.exercise_mission_v46();
create trigger exercise_mission_finish_v46 after update of completed_at on public.ludus_imperial_assignments for each row execute function ludus_private.exercise_mission_v46();

-- PvP fatigue is charged when combat actually starts, not while matchmaking.
create or replace function ludus_private.exercise_pvp_v46()returns trigger language plpgsql security definer set search_path='' as $$
declare x jsonb;players jsonb;gid uuid;owner uuid;v_source text;started boolean;completed boolean;valid boolean;
begin
 v_source:=case when tg_table_name='ludus_matches'then 'match'else 'duel'end;
 started:=new.status='playing'and (tg_op='INSERT'or old.status<>'playing');
 completed:=new.status='finished'and tg_op='UPDATE'and old.status='playing';
 if not started and not completed then return new;end if;
 if v_source='match'then players:=new.players;else players:=jsonb_build_array(new.a,new.b);end if;
 for x in select value from jsonb_array_elements(players)loop
  if x is null or x->'gladiator'->>'id' is null then continue;end if;
  gid:=(x->'gladiator'->>'id')::uuid;owner:=(x->>'owner')::uuid;
  if started then perform ludus_private.exercise_prepare_v46(v_source,new.id,gid,owner,20,clock_timestamp()+interval '2 hours');
  elsif completed then
   valid:=coalesce(x->>'left','false')<>'true'and exists(select 1 from ludus_private.exercise_events_v46 where exercise_events_v46.source=v_source and source_id=new.id and gladiator_id=gid and started_at<=clock_timestamp()-interval '10 seconds');
   perform ludus_private.exercise_complete_v46(v_source,new.id,gid,case when valid then 1 else 0 end,null,clock_timestamp());
  end if;
 end loop;return new;
end;$$;
create trigger exercise_match_v46 after insert or update of status on public.ludus_matches for each row execute function ludus_private.exercise_pvp_v46();
create trigger exercise_duel_v46 after insert or update of status on public.ludus_duels for each row execute function ludus_private.exercise_pvp_v46();

-- No client may call the internal award, recovery, injury or compatibility-state helpers.
revoke all on function ludus_private.exercise_keys_v46(),ludus_private.exercise_profile_v46(text),ludus_private.exercise_mean_v46(jsonb),ludus_private.exercise_adjust_v46(jsonb,numeric,jsonb),ludus_private.exercise_budget_v46(numeric),ludus_private.exercise_recover_v46(uuid),ludus_private.exercise_prepare_v46(text,uuid,uuid,uuid,numeric,timestamptz),ludus_private.exercise_complete_v46(text,uuid,uuid,integer,text,timestamptz),ludus_private.exercise_battle_v46(),ludus_private.exercise_mission_v46(),ludus_private.exercise_pvp_v46()from public,anon,authenticated;
revoke all on function public.ludus_training_state(),public.ludus_train_exercise(uuid[],text,uuid),public.ludus_train_overall(uuid,uuid)from public,anon;
grant execute on function public.ludus_training_state(),public.ludus_train_exercise(uuid[],text,uuid),public.ludus_train_overall(uuid,uuid)to authenticated;

CREATE OR REPLACE FUNCTION public.ludus_start_battle_v2(p_gladiator uuid, p_mode text, p_slots jsonb, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();g public.ludus_gladiators;it public.ludus_items;kv record;bid uuid;snap jsonb;pool jsonb:='[]';used uuid[]:='{}';entry jsonb;cls text;weapon text;shield text;actor integer;slot text;kind text;model text;b public.ludus_battles;
begin
 if uid is null or p_request is null then raise exception 'Giriş ve işlem kimliği gerekli'; end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;if not found then raise exception 'Ludus bulunamadı';end if;
 select * into b from public.ludus_battles where owner_id=uid and start_request_id=p_request;
 if found then return jsonb_build_object('id',b.id,'mode',b.mode,'snapshot',b.snapshot);end if;
 if exists(select 1 from public.ludus_battles where owner_id=uid and finished_at is null) then raise exception 'Devam eden savaşın var. Önce devam et veya savaştan çekil.';end if;
 if p_mode is null or p_mode not in ('4x5','solo20') then raise exception 'Geçersiz mod';end if;
 perform ludus_private.v7_settle(uid);
 select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=uid for update;
 if not found then raise exception 'Gladyatör bulunamadı';end if;
 if g.status<>'available' or g.fatigue_value>=100 or g.training_ends_at>now() or g.injured_until>now() then raise exception 'Gladyatör savaşa hazır değil';end if;
 if p_slots is null or jsonb_typeof(p_slots)<>'object' then raise exception 'Ekipman seçimi gerekli';end if;
 for kv in select * from jsonb_each_text(p_slots) loop
  if kv.key not in ('main_hand','off_hand','helmet','chest','gloves','legs') then raise exception 'Geçersiz yuva';end if;
  if kv.value is null then continue;end if;
  select * into it from public.ludus_items where id=kv.value::uuid and owner_id=uid for update;
  if not found or it.locked_battle_id is not null or (it.equipped_by is not null and it.equipped_by<>g.id) then raise exception 'Eşya sana ait değil, başka gladyatörde veya savaşta';end if;
  if it.id=any(used) then raise exception 'Bir eşya iki yuvaya takılamaz';end if;
  if not ((kv.key='main_hand' and it.kind='weapon' and it.model in ('gladius','sica','spear','trident','mace','whip')) or (kv.key='off_hand' and it.kind in ('weapon','shield')) or (kv.key=it.kind and kv.key in ('helmet','chest','gloves','legs'))) then raise exception 'Eşya bu yuvaya uygun değil';end if;
  used:=array_append(used,it.id);
 end loop;
 update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=uid and equipped_by=g.id;
 for kv in select * from jsonb_each_text(p_slots) loop
  if kv.value is not null then
   update public.ludus_items set equipped_by=g.id,equipped_slot=kv.key where id=kv.value::uuid returning * into it;
   pool:=pool||jsonb_build_array(jsonb_build_object('token',gen_random_uuid(),'actor',0,'slot',kv.key,'inventory_id',it.id,'item',to_jsonb(it)));
  end if;
 end loop;
 -- Bot equipment is generated here; extraction can only use tokens in this server-owned pool.
 for actor in 1..19 loop
  cls:=(array['murmillo','thraex','hoplomachus','secutor','retiarius','provocator','scissor'])[actor%7+1];
  weapon:=case cls when 'thraex' then 'sica' when 'hoplomachus' then 'spear' when 'retiarius' then 'trident' else 'gladius' end;
  shield:=case cls when 'thraex' then 'small' when 'hoplomachus' then 'round' when 'retiarius' then 'net' when 'scissor' then 'scissor' else 'large' end;
  foreach slot in array array['main_hand','off_hand','helmet','chest','gloves','legs'] loop
   if slot='chest' and cls not in ('murmillo','scissor') then continue;end if;
   kind:=case slot when 'main_hand' then 'weapon' when 'off_hand' then case when shield in ('net','scissor') then 'weapon' else 'shield' end else slot end;
   model:=case slot when 'main_hand' then weapon when 'off_hand' then shield when 'helmet' then case when p_mode='4x5' and actor<5 then 'gold' else 'silver' end else 'starter' end;
   pool:=pool||jsonb_build_array(jsonb_build_object('token',gen_random_uuid(),'actor',actor,'slot',slot,'inventory_id',null,'item',jsonb_build_object('kind',kind,'model',model,'enhancement',0,'base_stats','{}'::jsonb,'sapphires','[]'::jsonb,'rubies','[]'::jsonb,'stat_version',10,'natural_rule_version',2,'natural_stats',ludus_private.item_v10(kind),'natural_percentages',(select jsonb_object_agg(key,0) from jsonb_each(ludus_private.item_v10(kind))),'emeralds','[]'::jsonb,'certus_used',false)));
  end loop;
 end loop;
 snap:=jsonb_build_object('gladiator',to_jsonb(g),'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.ludus_items i where i.equipped_by=g.id),'[]'::jsonb));
 insert into public.ludus_battles(owner_id,gladiator_id,mode,snapshot,rule_version,start_request_id,loot) values(uid,g.id,p_mode,snap,2,p_request,pool) returning id into bid;
 update public.ludus_items set locked_battle_id=bid where id=any(used);
 return jsonb_build_object('id',bid,'mode',p_mode,'snapshot',snap);
end $function$
;

CREATE OR REPLACE FUNCTION public.ludus_duel(p_action text, p_room uuid DEFAULT NULL::uuid, p_gladiator uuid DEFAULT NULL::uuid, p_slots jsonb DEFAULT '{}'::jsonb, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid();r public.ludus_duels;g public.ludus_gladiators;s jsonb;own jsonb;enemy jsonb;is_a boolean;ts timestamptz:=clock_timestamp();dt numeric;mx numeric;mz numeric;len numeric;px numeric;pz numeric;dist numeric;hit_at timestamptz;strike boolean;hp numeric;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u)then raise exception 'Hesabına giriş yap.';end if;
 if p_action='join'then
  perform ludus_private.v7_settle(u);
  perform pg_advisory_xact_lock(202620);
  select * into r from public.ludus_duels where (host_id=u or guest_id=u)and status in('waiting','playing')and updated_at>ts-interval '75 seconds' order by created_at desc limit 1 for update;
  if not found then
   select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u;
   if not found or g.status<>'available'or g.fatigue_value>=100 or g.injured_until>clock_timestamp()or g.training_ends_at>clock_timestamp()or g.clan_roster_id is not null or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null) then raise exception 'Hazır bir gladyatör seç.';end if;
   if jsonb_typeof(p_slots)<>'object'or (select count(*)from jsonb_object_keys(p_slots))>6 then raise exception 'Geçersiz ekipman seçimi.';end if;
   select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('equipped_slot',e.key)),'[]'::jsonb)into s from jsonb_each_text(p_slots)e join public.ludus_items i on i.id::text=e.value and i.owner_id=u and i.locked_battle_id is null where e.key in('main_hand','off_hand','helmet','chest','gloves','legs') and ((e.key='main_hand'and i.kind='weapon')or(e.key='off_hand'and i.kind in('weapon','shield'))or e.key=i.kind);
   own:=jsonb_build_object('owner',u,'name',g.name,'class',g.class,'gladiator',to_jsonb(g),'items',s,'x',0,'z',-3,'angle',0,'hp',100,'maxHp',100,'block',false,'action','idle','serial',0);
   select * into r from public.ludus_duels where status='waiting'and host_id<>u and updated_at>ts-interval '30 seconds'order by created_at limit 1 for update skip locked;
   if found then
    own:=own||jsonb_build_object('z',3,'angle',pi());update public.ludus_duels set guest_id=u,guest_g=g.id,b=own,status='playing',updated_at=ts,a_at=ts,b_at=ts where id=r.id returning * into r;
   else insert into public.ludus_duels(host_id,host_g,a,updated_at,a_at)values(u,g.id,own,ts,ts)returning * into r;end if;
  end if;
 else
  select * into r from public.ludus_duels where id=p_room and(host_id=u or guest_id=u)for update;
  if not found then raise exception 'Bu düelloya erişemezsin.';end if;
  is_a:=r.host_id=u;own:=case when is_a then r.a else r.b end;enemy:=case when is_a then r.b else r.a end;
  if p_action='leave'and r.status<>'finished'then update public.ludus_duels set a=case when is_a then a||'{"left":true}'::jsonb else a end,b=case when not is_a then b||'{"left":true}'::jsonb else b end,status='finished',winner=case when is_a then r.guest_id else r.host_id end,updated_at=ts where id=r.id returning * into r;
  elsif p_action='step'then
   if r.status='playing'and ts-(case when is_a then r.b_at else r.a_at end)>interval '20 seconds'then update public.ludus_duels set status='finished',winner=u,updated_at=ts where id=r.id returning * into r;
   elsif r.status='playing'then
    if jsonb_typeof(p_input)<>'object' or coalesce(jsonb_typeof(p_input->'x'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'z'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'attack'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'block'),'boolean')<>'boolean' then raise exception 'Geçersiz kontrol.';end if;
    dt:=greatest(0,least(.25,extract(epoch from ts-(case when is_a then r.a_at else r.b_at end))));
    mx:=greatest(-1,least(1,coalesce((p_input->>'x')::numeric,0)));mz:=greatest(-1,least(1,coalesce((p_input->>'z')::numeric,0)));len:=greatest(1,sqrt(mx*mx+mz*mz));
    px:=greatest(-7,least(7,(own->>'x')::numeric+mx/len*dt*3.5));pz:=greatest(-7,least(7,(own->>'z')::numeric+mz/len*dt*3.5));dist:=sqrt(power(px-(enemy->>'x')::numeric,2)+power(pz-(enemy->>'z')::numeric,2));
    hit_at:=case when is_a then r.a_hit else r.b_hit end;
    strike:=coalesce((p_input->>'attack')::boolean,false)and(hit_at is null or ts-hit_at>=interval '750 milliseconds');
    own:=own||jsonb_build_object('x',px,'z',pz,'angle',atan2((enemy->>'x')::double precision-px::double precision,(enemy->>'z')::double precision-pz::double precision),'block',coalesce((p_input->>'block')::boolean,false),'action',case when strike then 'attack'when coalesce((p_input->>'block')::boolean,false)then 'block'else 'idle'end,'serial',coalesce((own->>'serial')::integer,0)+case when strike then 1 else 0 end,'move',sqrt(mx*mx+mz*mz));
    if strike then hit_at:=ts;if dist<=1.85 then hp:=greatest(0,(enemy->>'hp')::numeric-case when coalesce((enemy->>'block')::boolean,false)then 3 else 14 end);enemy:=enemy||jsonb_build_object('hp',hp);if hp=0 then r.status:='finished';r.winner:=u;end if;end if;end if;
    if is_a then r.a:=own;r.b:=enemy;r.a_at:=ts;r.a_hit:=hit_at;else r.b:=own;r.a:=enemy;r.b_at:=ts;r.b_hit:=hit_at;end if;
    update public.ludus_duels set a=r.a,b=r.b,a_at=r.a_at,b_at=r.b_at,a_hit=r.a_hit,b_hit=r.b_hit,status=r.status,winner=r.winner,updated_at=ts where id=r.id returning * into r;
   elsif r.status='waiting'then update public.ludus_duels set updated_at=ts,a_at=ts where id=r.id returning * into r;end if;
  elsif p_action<>'state'then raise exception 'Geçersiz işlem.';end if;
 end if;
 return jsonb_build_object('id',r.id,'status',r.status,'host',r.host_id,'winner',r.winner,'a',r.a,'b',r.b,'server_now',ts);
end;$function$
;

CREATE OR REPLACE FUNCTION public.ludus_match(p_action text, p_room uuid DEFAULT NULL::uuid, p_gladiator uuid DEFAULT NULL::uuid, p_slots jsonb DEFAULT '{}'::jsonb, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid:=auth.uid(); ts timestamptz:=clock_timestamp(); r public.ludus_matches; g public.ludus_gladiators;
 own jsonb; enemy jsonb; p jsonb; gear jsonb; arr jsonb; idx integer; target_idx integer; k integer; count_alive integer;
 mx double precision; mz double precision; dt double precision; len double precision; px double precision; pz double precision;
 dist double precision; best double precision; angle double precision; spawn double precision; radius double precision;
 wind double precision; active double precision; recover double precision; command_id text; wants_guard boolean; guard_eligible boolean; counter boolean; strike boolean; whip boolean; hp integer; last_hit timestamptz; win uuid; selected_weapon text; wanted text; dodge_command text; dodging boolean; dodge_eligible boolean; attack_region text; selected_hand text;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Hesabına giriş yap.'; end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if p_action='join' then
  perform ludus_private.v7_settle(u);
  perform pg_advisory_xact_lock(202621);
  select m.* into r from public.ludus_matches m where m.status in('waiting','playing') and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text and coalesce((f->>'hp')::int,0)>0 and (f->>'seen')::timestamptz>ts-interval '30 seconds') order by m.created_at desc limit 1 for update;
  if not found then
   select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u for update;
   if not found or g.status<>'available'or g.fatigue_value>=100 or g.injured_until>clock_timestamp()or g.training_ends_at>clock_timestamp()or g.clan_roster_id is not null or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null) then raise exception 'Hazır bir gladyatör seç.'; end if;
   if jsonb_typeof(p_slots)<>'object' or (select count(*) from jsonb_object_keys(p_slots))>6 then raise exception 'Geçersiz ekipman seçimi.'; end if;
   select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('equipped_slot',e.key)),'[]') into gear from jsonb_each_text(p_slots)e join public.ludus_items i on i.id::text=e.value and i.owner_id=u and i.locked_battle_id is null and i.clan_vault_id is null and i.clan_roster_id is null where e.key in('main_hand','off_hand','helmet','chest','gloves','legs') and ((e.key='main_hand' and i.kind='weapon')or(e.key='off_hand' and i.kind in('weapon','shield'))or e.key=i.kind);
   if jsonb_array_length(gear)<>(select count(*) from jsonb_object_keys(p_slots)) or (select count(distinct f->>'id') from jsonb_array_elements(gear) f)<>jsonb_array_length(gear) then raise exception 'Ekipman seçimini yenile.'; end if;
   own:=jsonb_build_object('owner',u,'name',g.name,'class',g.class,'gladiator',to_jsonb(g),'items',gear,'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'maxStamina',100,'stamina',100,'stamina_at',ts,'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0);
   select m.* into r from public.ludus_matches m where m.status='waiting' and m.starts_at>ts and m.updated_at>ts-interval '30 seconds' order by m.created_at limit 1 for update;
   if found then update public.ludus_matches set players=r.players||jsonb_build_array(own),updated_at=ts where id=r.id returning * into r;
   else insert into public.ludus_matches(players,starts_at,updated_at) values(jsonb_build_array(own),ts+interval '10 seconds',ts) returning * into r; end if;
  end if;
 else
  select m.* into r from public.ludus_matches m where m.id=p_room and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text) for update;
  if not found then raise exception 'Bu maça erişemezsin.'; end if;
 end if;
 ts:=clock_timestamp();
 if r.status='playing' then r.players:=private.ludus_advance_combat_v36(r.players,ts);r.players:=private.ludus_resolve_combat_v36(r.players,ts); end if;
 select (ord-1)::int into idx from jsonb_array_elements(r.players) with ordinality as e(f,ord) where f->>'owner'=u::text;
 if p_action='leave' then
  if r.status='waiting' then select coalesce(jsonb_agg(f),'[]') into r.players from jsonb_array_elements(r.players) f where f->>'owner'<>u::text;
  elsif r.status='playing' then r.players:=jsonb_set(r.players,array[idx::text],(r.players->idx)||jsonb_build_object('hp',0,'move',0,'block',false,'left',true)); end if;
 elsif p_action in('join','state','step') then
  own:=r.players->idx;
  -- An eliminated player may watch the result, but cannot revive by polling.
  own:=own||jsonb_build_object('seen',ts); r.players:=jsonb_set(r.players,array[idx::text],own);
  if r.status='waiting' then
   select coalesce(jsonb_agg(f),'[]') into r.players from jsonb_array_elements(r.players) f where (f->>'seen')::timestamptz>ts-interval '8 seconds';
   if r.starts_at<=ts then
    if jsonb_array_length(r.players)>=2 then
     r.status:='playing'; arr:='[]'; radius:=least(10,greatest(3,jsonb_array_length(r.players)*.5)); k:=0;
     for p in select value from jsonb_array_elements(r.players) loop
      spawn:=k*2*pi()/jsonb_array_length(r.players);
      arr:=arr||jsonb_build_array(p||jsonb_build_object('x',sin(spawn)*radius,'z',cos(spawn)*radius,'angle',spawn+pi(),'seen',ts)); k:=k+1;
     end loop; r.players:=arr;
    else r.starts_at:=ts+interval '10 seconds'; end if;
   end if;
  elsif r.status='playing' and p_action='step' and (own->>'hp')::int>0 then
   if jsonb_typeof(p_input)<>'object' or coalesce(jsonb_typeof(p_input->'x'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'z'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'attack'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'block'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'special'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'target'),'string')<>'string' then raise exception 'Geçersiz kontrol.'; end if;
   if coalesce(jsonb_typeof(p_input->'dodge'),'boolean')<>'boolean'
    or coalesce(jsonb_typeof(p_input->'dodge_id'),'null') not in('string','null')
    or length(coalesce(p_input->>'dodge_id',''))>80
    or coalesce(jsonb_typeof(p_input->'region'),'string')<>'string'
    or coalesce(p_input->>'region','chest') not in('chest','head','legs','leftArm','rightArm')
    or coalesce(jsonb_typeof(p_input->'hand'),'string')<>'string'
    or coalesce(p_input->>'hand','main_hand') not in('main_hand','off_hand') then raise exception 'Geçersiz kontrol.'; end if;
   attack_region:=coalesce(p_input->>'region','chest');
   selected_hand:=coalesce(p_input->>'hand','main_hand');
   if selected_hand='off_hand' and not exists(select 1 from jsonb_array_elements(own->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='weapon') then selected_hand:='main_hand'; end if;
   -- Delta comes from the previously persisted server timestamp, never from the client.
   dt:=greatest(0,least(.25,extract(epoch from ts-(r.players->idx->>'tick_at')::timestamptz)));
   if dt is null then dt:=0; end if;
   mx:=greatest(-1,least(1,coalesce((p_input->>'x')::double precision,0))); mz:=greatest(-1,least(1,coalesce((p_input->>'z')::double precision,0))); len:=greatest(1,sqrt(mx*mx+mz*mz));
   radius:=case when coalesce((own->>'swing_end')::timestamptz,'epoch')>ts or coalesce((own->>'dodge_until')::timestamptz,'epoch')>ts then 0 when coalesce((p_input->>'block')::boolean,false) then 1.8 else 3.5 end;
   px:=(own->>'x')::double precision+mx/len*dt*radius; pz:=(own->>'z')::double precision+mz/len*dt*radius;
   if own->>'pull_from' is not null or coalesce((own->>'stagger_until')::timestamptz,'epoch')>ts or coalesce((own->>'recoil_until')::timestamptz,'epoch')>ts then px:=(own->>'x')::float; pz:=(own->>'z')::float; mx:=0; mz:=0; end if;
   len:=greatest(1,sqrt(px*px+pz*pz)/10.5); px:=px/len; pz:=pz/len;
   target_idx:=null; best:=1e9; wanted:=p_input->>'target'; k:=0;
   for p in select value from jsonb_array_elements(r.players) loop
    if p->>'owner'<>u::text and (p->>'hp')::int>0 then
     dist:=sqrt(power(px-(p->>'x')::float,2)+power(pz-(p->>'z')::float,2));
     if p->>'owner'=wanted then target_idx:=k; exit; elsif dist<best then best:=dist; target_idx:=k; end if;
    end if; k:=k+1;
   end loop;
   enemy:=r.players->target_idx; angle:=coalesce((own->>'angle')::float,0);
   if enemy is not null and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts then angle:=atan2((enemy->>'x')::float-px,(enemy->>'z')::float-pz); end if;
   dodge_command:=coalesce(p_input->>'dodge_id','');
   dodge_eligible:=own->>'pull_from' is null and coalesce((own->>'stamina')::float,100)>=25
    and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts;
   dodging:=coalesce((p_input->>'dodge')::boolean,false) and dodge_command<>'' and dodge_command is distinct from own->>'last_dodge_command' and dodge_eligible;
   if coalesce((p_input->>'dodge')::boolean,false) and dodge_command<>'' then own:=own||jsonb_build_object('last_dodge_command',dodge_command); end if;
   if dodging then
    len:=sqrt(mx*mx+mz*mz);
    own:=own||jsonb_build_object('dodge_at',ts,'dodge_until',ts+interval '460 milliseconds','dodge_tick_at',ts,'dodge_serial',coalesce((own->>'dodge_serial')::int,0)+1,
     'dodge_dx',case when len>.01 then mx/len else -sin(angle) end,'dodge_dz',case when len>.01 then mz/len else -cos(angle) end,
     'stamina',greatest(0,coalesce((own->>'stamina')::float,100)-25),'stamina_regen_at',ts+interval '1 second');
   end if;
   last_hit:=(own->>'hit_at')::timestamptz;
   command_id:=coalesce(p_input->>'attack_id','');
   if jsonb_typeof(p_input->'attack_id') not in('string','null') or length(command_id)>80 then raise exception 'Geçersiz saldırı işlemi.'; end if;
   strike:=not dodging and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>=13 and enemy is not null and own->>'pull_from' is null and coalesce((p_input->>'attack')::boolean,false)
    and coalesce((own->>'cooldown_until')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and (command_id='' or command_id is distinct from own->>'last_attack_command')
    and (own->>'swing_at' is not null or last_hit is null or ts-last_hit>=interval '750 milliseconds');
   if coalesce((p_input->>'attack')::boolean,false) and command_id<>'' then own:=own||jsonb_build_object('last_attack_command',command_id); end if;
   select f->>'model' into selected_weapon from jsonb_array_elements(own->'items') f where f->>'equipped_slot'=selected_hand and f->>'kind'='weapon';
   whip:=coalesce(not dodging and own->>'pull_from' is null and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>=28 and sqrt(power(px-(enemy->>'x')::float,2)+power(pz-(enemy->>'z')::float,2))<=2 and coalesce((own->>'cooldown_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and selected_weapon='whip' and wanted=enemy->>'owner' and coalesce((p_input->>'special')::boolean,false) and ((own->>'special_at') is null or ts-(own->>'special_at')::timestamptz>=interval '6 seconds'),false);
   if whip then strike:=false; end if;
   if radius=0 then mx:=0;mz:=0; end if;
   wants_guard:=coalesce((p_input->>'block')::boolean,false);
   guard_eligible:=not dodging and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>0 and own->>'pull_from' is null and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and exists(select 1 from jsonb_array_elements(own->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='shield');
   if wants_guard and not coalesce((own->>'guard_requested')::boolean,false) then
    own:=own||jsonb_build_object('guard_at',case when guard_eligible and coalesce((own->>'guard_rearm')::timestamptz,'epoch')<=ts then ts else null end,'guard_rearm',greatest(ts+interval '420 milliseconds',coalesce((own->>'guard_rearm')::timestamptz,'epoch')));
   end if;
   own:=own||jsonb_build_object('guard_requested',wants_guard);
   own:=own||jsonb_build_object('x',px,'z',pz,'angle',angle,'tick_at',ts,'seen',ts,'move',sqrt(mx*mx+mz*mz),'block',wants_guard and guard_eligible and not strike and not whip,'serial',(own->>'serial')::int+case when strike then 1 else 0 end);
   if strike then
    wind:=case selected_weapon when 'gladius' then .26 when 'sica' then .22 when 'spear' then .30 when 'trident' then .34 when 'mace' then .40 when 'whip' then .32 else .24 end;
    active:=case selected_weapon when 'sica' then .20 when 'trident' then .23 when 'mace' then .26 when 'whip' then .24 else .22 end;
    recover:=case selected_weapon when 'gladius' then .32 when 'sica' then .28 when 'spear' then .34 when 'trident' then .37 when 'mace' then .43 when 'whip' then .36 else .28 end;
    counter:=coalesce((own->>'counter_until')::timestamptz,'epoch')>ts and own->>'counter_target'=enemy->>'owner';
    if counter then wind:=wind*.55;recover:=recover*.85; end if;
    own:=own||jsonb_build_object('stamina',greatest(0,coalesce((own->>'stamina')::float,100)-13),'stamina_regen_at',ts+interval '1 second','hit_at',ts,'swing_at',ts,'wind',wind,'active',active,'recover',recover,'strike_at',ts+(wind+active*.5)*interval '1 second',
     'strike_target',enemy->>'owner','strike_weapon',selected_weapon,'strike_region',attack_region,'strike_hand',selected_hand,'strike_counter',counter,'strike_resolved',false,'swing_end',ts+(wind+active+recover)*interval '1 second',
     'cooldown_until',ts+(wind+active+recover)*interval '1 second','recoil_at',null,'recoil_until',null,'stagger_until',null,'attack_result',null);
    if counter then own:=own||jsonb_build_object('counter_until',null,'counter_target',null); end if;
   end if;
   if enemy is not null then
    dist:=sqrt(power(px-(enemy->>'x')::float,2)+power(pz-(enemy->>'z')::float,2));
    if whip then own:=own||jsonb_build_object('stamina',greatest(0,coalesce((own->>'stamina')::float,100)-28),'stamina_regen_at',ts+interval '1 second','special_at',ts,'pull_serial',(own->>'pull_serial')::int+1,'pull_target',enemy->>'owner'); enemy:=enemy||jsonb_build_object('pull_from',u,'pull_until',ts+interval '6 seconds','pull_at',ts,'block',false);
    end if;
    r.players:=jsonb_set(r.players,array[target_idx::text],enemy);
   end if;
   r.players:=jsonb_set(r.players,array[idx::text],own);
  end if;
 else raise exception 'Geçersiz işlem.';
 end if;
 if r.status='playing' then
  -- Simulate tethered victims on every room update, even when their own tab is suspended.
  arr:='[]';
  for p in select value from jsonb_array_elements(r.players) loop
   if p->>'pull_from' is not null and (p->>'hp')::int>0 then
    select value into enemy from jsonb_array_elements(r.players) where value->>'owner'=p->>'pull_from' and (value->>'hp')::int>0;
    if not found or (p->>'pull_until')::timestamptz<ts then p:=p||jsonb_build_object('pull_from',null,'pull_until',null);
    else
     dt:=greatest(0,least(.25,extract(epoch from ts-(p->>'pull_at')::timestamptz)));
     px:=(p->>'x')::float; pz:=(p->>'z')::float; dist:=sqrt(power((enemy->>'x')::float-px,2)+power((enemy->>'z')::float-pz,2));
     len:=least(greatest(0,dist-.9),dt*greatest(6,dist*2));
     if dist>.91 then p:=p||jsonb_build_object('x',px+((enemy->>'x')::float-px)/dist*len,'z',pz+((enemy->>'z')::float-pz)/dist*len,'pull_at',ts,'move',0,'block',false);
     else p:=p||jsonb_build_object('pull_from',null,'pull_until',null); end if;
    end if;
   end if;
   arr:=arr||jsonb_build_array(p);
  end loop; r.players:=arr;
  arr:='[]';
  for p in select value from jsonb_array_elements(r.players) loop
   if (p->>'hp')::int>0 and (p->>'seen')::timestamptz<ts-interval '30 seconds' then p:=p||jsonb_build_object('hp',0,'left',true); end if;
   arr:=arr||jsonb_build_array(p);
  end loop; r.players:=arr;
  select count(*),min((f->>'owner'))::uuid into count_alive,win from jsonb_array_elements(r.players) f where (f->>'hp')::int>0;
  if count_alive<=1 then r.status:='finished'; r.winner:=win; end if;
 elsif r.status='waiting' and jsonb_array_length(r.players)=0 then r.status:='finished'; end if;
 update public.ludus_matches set players=r.players,status=r.status,starts_at=r.starts_at,winner=r.winner,updated_at=ts where id=r.id;
 return jsonb_build_object('id',r.id,'status',r.status,'starts_at',r.starts_at,'server_now',ts,'players',r.players,'winner',r.winner,'combat_version',23,'controls_version',36);
end; $function$
;

CREATE OR REPLACE FUNCTION ludus_private.imperial(p_action text DEFAULT 'state'::text, p_mission uuid DEFAULT NULL::uuid, p_gladiators uuid[] DEFAULT '{}'::uuid[], p_assignment uuid DEFAULT NULL::uuid, p_week date DEFAULT NULL::date, p_entries jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();today date:=(clock_timestamp()at time zone'Europe/Istanbul')::date; c public.ludus_imperial_catalog;a public.ludus_imperial_assignments;g record;ids uuid[];crew jsonb:='[]';total numeric:=0;required integer;hours integer;v_diamonds integer;counts integer[];v_family text;stone integer;reward jsonb:='[]';entry jsonb;i integer;j integer;day_index integer;slot_index integer;is_admin boolean;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u)then raise exception 'Hesabına giriş yap.';end if;
 perform ludus_private.imperial_ensure_day(today);
 perform pg_advisory_xact_lock(hashtextextended(u::text,31));
 perform 1 from public.ludus_accounts where user_id=u for update;
 perform ludus_private.v7_settle(u);
 perform ludus_private.imperial_settle(u);
 is_admin:=exists(select 1 from public.ludus_imperial_admins where user_id=u);
 if p_action='join'then
  select * into c from public.ludus_imperial_catalog where id=p_mission and day=today;
  if not found then raise exception 'Bu görev bugün katılıma açık değil.';end if;
  if not exists(select 1 from public.ludus_imperial_assignments where owner_id=u and mission_id=c.id)then
   if p_gladiators is null or cardinality(p_gladiators)not between 1 and 30 or cardinality(p_gladiators)<>(select count(distinct x)from unnest(p_gladiators)x)then raise exception 'Geçerli ve farklı gladyatörler seç.';end if;
   ids:=array(select x from unnest(p_gladiators)x order by x);
   for g in select * from public.ludus_gladiators where id=any(ids)and owner_id=u order by id for update loop
    if exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters r on r.id=e.roster_id where e.gladiator_id=g.id and r.state in('draft','locked'))or g.clan_roster_id is not null or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)or exists(select 1 from public.ludus_matches m where m.status in('waiting','playing')and m.updated_at>clock_timestamp()-interval '30 seconds'and m.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))or exists(select 1 from public.ludus_duels where status in('waiting','playing')and updated_at>clock_timestamp()-interval '75 seconds'and g.id in(host_g,guest_g))or g.status<>'available'or coalesce(g.training_ends_at>clock_timestamp(),false)or coalesce(g.injured_until>clock_timestamp(),false)or exists(select 1 from public.ludus_imperial_members where gladiator_id=g.id and active)then raise exception 'Gladyatör başka bir işte veya hazır değil.';end if;
    total:=total+coalesce(g.overall,50);crew:=crew||jsonb_build_array(jsonb_build_object('id',g.id,'name',g.name,'class',g.class,'overall',coalesce(g.overall,50)));
   end loop;
   if jsonb_array_length(crew)<>cardinality(ids)then raise exception 'Yalnızca kendi gladyatörlerini görevlendirebilirsin.';end if;
   required:=case c.difficulty when 1 then 50 when 2 then 150 else 250 end;hours:=case c.difficulty when 1 then 12 when 2 then 18 else 24 end;
   if total<required then raise exception 'Toplam Overall yetersiz: % / %.',total,required;end if;
   insert into public.ludus_imperial_assignments(owner_id,mission_id,mission,gladiators,ends_at)values(u,c.id,to_jsonb(c)||jsonb_build_object('required',required,'hours',hours),crew,clock_timestamp()+make_interval(hours=>hours))returning * into a;
   insert into public.ludus_imperial_members(assignment_id,gladiator_id)select a.id,x from unnest(ids)x;
   update public.ludus_gladiators set status='locked'where id=any(ids)and owner_id=u;
  end if;
 elsif p_action='claim'then
  select * into a from public.ludus_imperial_assignments where id=p_assignment and owner_id=u for update;
  if not found then raise exception 'Görev kaydı bulunamadı.';end if;
  if a.ends_at>clock_timestamp()then raise exception 'Görev henüz bitmedi.';end if;
  if a.claimed_at is null then
   slot_index:=coalesce((a.mission->>'difficulty')::integer,(a.mission->>'slot')::integer);v_diamonds:=case slot_index when 1 then 2 when 2 then 3 else 5 end;counts:=case slot_index when 1 then array[1,0,0]when 2 then array[0,2,0]else array[1,1,2]end;
   for i in 1..3 loop
    v_family:=case i when 1 then 'sapphire'when 2 then 'emerald'else 'ruby'end;
    for j in 1..counts[i]loop
     stone:=1+floor(random()*case i when 1 then 18 when 2 then 15 else 4 end)::integer;
     insert into public.ludus_stones(owner_id,family,stone_id,quantity)values(u,v_family,stone,1)on conflict(owner_id,family,stone_id)do update set quantity=public.ludus_stones.quantity+1;
     reward:=reward||jsonb_build_array(jsonb_build_object('family',v_family,'id',stone,'quantity',1));
    end loop;
   end loop;
   update public.ludus_accounts set stones_version=stones_version+1,diamonds=coalesce(public.ludus_accounts.diamonds,0)+v_diamonds where user_id=u;
   update public.ludus_imperial_assignments set claimed_at=clock_timestamp(),rewards=jsonb_build_object('diamonds',v_diamonds,'stones',reward)where id=a.id;
  end if;
 elsif p_action in('admin_state','save_draft','publish_cycle','publish_week')then
  if not is_admin then raise exception 'Yönetici yetkisi gerekiyor.';end if;
  if p_action<>'admin_state'then
   if p_week is null or p_week<today-3650 or p_week>today+365 then raise exception 'Geçerli bir döngü başlangıç tarihi seç.';end if;
   if jsonb_typeof(p_entries)is distinct from 'array' or jsonb_array_length(p_entries)<>12 then raise exception '4 günlük döngü tam 12 görevden oluşmalı.';end if;
   for i in 0..11 loop
    entry:=p_entries->i;
    if jsonb_typeof(entry)is distinct from 'object' or length(coalesce(entry->>'title',''))>120 or length(coalesce(entry->>'description',''))>1800 or length(coalesce(entry->>'image',''))>500 or length(coalesce(entry->>'detail_image',''))>500 or coalesce(entry->>'difficulty',(i%3+1)::text)!~'^[123]$' then raise exception 'Görev metni, zorluğu veya görseli geçersiz.';end if;
    if p_action in('publish_cycle','publish_week')then
     if length(trim(coalesce(entry->>'title','')))<4 or length(trim(coalesce(entry->>'description','')))<20 or coalesce(entry->>'image','')!~'^(imperial-[a-z0-9-]+\.webp|imperial-missions/[a-z0-9-]+\.webp|https://[^[:space:]]+)$' or coalesce(entry->>'detail_image','')!~'^(imperial-[a-z0-9-]+\.webp|imperial-missions/[a-z0-9-]+\.webp|https://[^[:space:]]+)$' or entry->>'image'=entry->>'detail_image' then raise exception '% numaralı görevin başlık, açıklama ve iki ayrı görselini tamamla.',i+1;end if;
    end if;
   end loop;
   if p_action='save_draft'then
    insert into public.ludus_imperial_cycle(id,start_date,entries,draft_start_date,draft)values(true,p_week,'[]',p_week,p_entries)
    on conflict(id)do update set draft_start_date=excluded.draft_start_date,draft=excluded.draft,updated_at=clock_timestamp();
   else
    insert into public.ludus_imperial_cycle(id,start_date,entries,draft_start_date,draft)values(true,p_week,p_entries,p_week,p_entries)
    on conflict(id)do update set start_date=excluded.start_date,entries=excluded.entries,draft_start_date=excluded.draft_start_date,draft=excluded.draft,revision=public.ludus_imperial_cycle.revision+1,updated_at=clock_timestamp();
    perform ludus_private.imperial_ensure_day(today);
   end if;
  end if;
  return jsonb_build_object('is_admin',true,'days',4,'week',(select draft_start_date from public.ludus_imperial_cycle where id),'entries',coalesce((select draft from public.ludus_imperial_cycle where id),'[]'::jsonb));
 elsif p_action<>'state'then raise exception 'Geçersiz işlem.';end if;
 return jsonb_build_object('today',today,'server_now',clock_timestamp(),'is_admin',is_admin,'cycle_day',(select case when today>=start_date then (today-start_date)%4+1 end from public.ludus_imperial_cycle where id),'missions',coalesce((select jsonb_agg(to_jsonb(x)order by slot)from public.ludus_imperial_catalog x where day=today),'[]'::jsonb),'assignments',coalesce((select jsonb_agg(to_jsonb(x)order by started_at desc)from public.ludus_imperial_assignments x where owner_id=u and((mission->>'day')::date=today or claimed_at is null)),'[]'::jsonb),'gladiators',coalesce((select jsonb_agg(to_jsonb(x)order by name)from public.ludus_gladiators x where owner_id=u),'[]'::jsonb));
end;$function$
;
