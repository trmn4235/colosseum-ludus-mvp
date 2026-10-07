-- V37: account-wide Ludus EXP and the user's exact level 2-50 reward table.
-- Additive. Existing fighters, inventories, clan EXP and gladiator stats survive.
begin;
create schema if not exists ludus_private;
create table if not exists ludus_private.level_reward_catalog(
 level integer primary key check(level between 2 and 50),diamonds integer not null,
 sapphire integer not null,emerald integer not null,ruby integer not null,
 denarius integer not null,items integer not null,gladiators integer not null
);
insert into ludus_private.level_reward_catalog(level,diamonds,sapphire,emerald,ruby,denarius,items,gladiators) values
(2,2,2,0,1,200,1,1),
(3,3,2,1,0,300,1,0),
(4,4,2,0,2,400,1,0),
(5,5,3,2,0,500,2,0),
(6,6,3,0,3,600,1,1),
(7,7,3,3,0,700,1,0),
(8,8,4,0,4,800,1,0),
(9,9,4,4,0,900,1,0),
(10,10,4,0,5,1000,2,1),
(11,11,5,5,0,1100,1,0),
(12,12,5,0,6,1200,1,0),
(13,13,5,6,0,1300,1,0),
(14,14,6,0,7,1400,1,1),
(15,15,6,7,0,1500,3,0),
(16,16,6,0,8,1600,1,0),
(17,17,7,8,0,1700,1,0),
(18,18,7,0,9,1800,1,1),
(19,19,7,9,0,1900,1,0),
(20,20,8,0,10,2000,3,0),
(21,21,8,10,0,2100,1,0),
(22,22,8,0,11,2200,1,1),
(23,23,9,11,0,2300,1,0),
(24,24,9,0,12,2400,1,0),
(25,25,9,12,0,2500,3,0),
(26,26,10,0,13,2600,1,1),
(27,27,10,13,0,2700,1,0),
(28,28,10,0,14,2800,1,0),
(29,29,11,14,0,2900,1,0),
(30,30,11,0,15,3000,4,1),
(31,31,11,15,0,3100,1,0),
(32,32,12,0,16,3200,1,0),
(33,33,12,16,0,3300,1,0),
(34,34,12,0,17,3400,1,1),
(35,35,13,17,0,3500,4,0),
(36,36,13,0,18,3600,1,0),
(37,37,13,18,0,3700,1,0),
(38,38,14,0,19,3800,1,1),
(39,39,14,19,0,3900,1,0),
(40,40,14,0,20,4000,5,0),
(41,41,15,20,0,4100,1,0),
(42,42,15,0,21,4200,1,1),
(43,43,15,21,0,4300,1,0),
(44,44,16,0,22,4400,1,0),
(45,45,16,22,0,4500,5,0),
(46,46,16,0,23,4600,1,1),
(47,47,17,23,0,4700,1,0),
(48,48,17,0,24,4800,1,0),
(49,49,17,24,0,4900,1,0),
(50,50,18,0,25,5000,6,1)
on conflict(level)do update set diamonds=excluded.diamonds,sapphire=excluded.sapphire,emerald=excluded.emerald,ruby=excluded.ruby,denarius=excluded.denarius,items=excluded.items,gladiators=excluded.gladiators;
create table if not exists public.ludus_progression(
 owner_id uuid primary key references public.ludus_accounts(user_id),
 experience bigint not null default 0 check(experience>=0),
 battle_day date,battle_wins integer not null default 0,battle_exp integer not null default 0,
 legacy_slots integer not null default 2 check(legacy_slots>=2),
 created_at timestamptz not null default clock_timestamp()
);
create table if not exists ludus_private.level_exp_events(
 owner_id uuid not null references public.ludus_accounts(user_id),source text not null,
 source_key text not null,experience integer not null check(experience>=0),
 occurred_at timestamptz not null,primary key(owner_id,source,source_key)
);
create table if not exists ludus_private.level_rewards(
 owner_id uuid not null references public.ludus_accounts(user_id),
 level integer not null references ludus_private.level_reward_catalog(level),
 unlocked_at timestamptz not null default clock_timestamp(),
 claimed_at timestamptz,rewards jsonb not null default '{}',gladiator_pending boolean not null default false,
 primary key(owner_id,level)
);
alter table public.ludus_progression enable row level security;
revoke all on public.ludus_progression from public,anon,authenticated;
grant select on public.ludus_progression to authenticated;
drop policy if exists ludus_progression_owner_read on public.ludus_progression;
create policy ludus_progression_owner_read on public.ludus_progression for select to authenticated using(owner_id=(select auth.uid()));
alter table ludus_private.level_reward_catalog enable row level security;
alter table ludus_private.level_exp_events enable row level security;
alter table ludus_private.level_rewards enable row level security;
revoke all on ludus_private.level_reward_catalog,ludus_private.level_exp_events,ludus_private.level_rewards from public,anon,authenticated;
create index if not exists ludus_level_events_recent on ludus_private.level_exp_events(owner_id,occurred_at desc);

create or replace function ludus_private.level_exp_cost(l integer)returns bigint language sql immutable set search_path='' as $$
 select (3000+100*(greatest(1,l)-1)+15::bigint*(greatest(1,l)-1)^2)::bigint
$$;
create or replace function ludus_private.level_threshold(l integer)returns bigint language sql immutable set search_path='' as $$
 select coalesce(sum(3000+100*(x-1)+15::bigint*(x-1)^2),0)::bigint from generate_series(1,greatest(1,least(50,l))-1)x
$$;
create or replace function ludus_private.level_from_exp(x bigint)returns integer language sql immutable set search_path='' as $$
 select coalesce(max(l),1) from generate_series(1,50)l where ludus_private.level_threshold(l)<=greatest(0,x)
$$;
create or replace function ludus_private.level_granted_gladiators(l integer)returns integer language sql stable set search_path='' as $$
 select 2+coalesce(sum(gladiators),0)::integer from ludus_private.level_reward_catalog where level<=l
$$;
create or replace function ludus_private.level_ensure(u uuid)returns void language plpgsql set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()<>u then raise exception 'Hesabına giriş yap.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 insert into public.ludus_progression(owner_id,legacy_slots)
 select u,greatest(2,count(*)::integer) from public.ludus_gladiators where owner_id=u on conflict(owner_id)do nothing;
end $$;
create or replace function ludus_private.level_grant(u uuid,kind text,key text,base_exp integer,at_time timestamptz)returns integer language plpgsql set search_path='' as $$
declare p public.ludus_progression;amount integer:=base_exp;d date;lv integer;old_amount integer;
begin
 if kind not in('battle','daily','imperial')or base_exp<0 or base_exp>2500 then raise exception 'Geçersiz EXP kaynağı.';end if;
 perform ludus_private.level_ensure(u);
 select experience into old_amount from ludus_private.level_exp_events where owner_id=u and source=kind and source_key=key;
 if found then return old_amount;end if;
 select * into p from public.ludus_progression where owner_id=u for update;
 if kind='battle'then
  d:=(at_time at time zone'Europe/Istanbul')::date;
  if p.battle_day is distinct from d then p.battle_day:=d;p.battle_wins:=0;p.battle_exp:=0;end if;
  p.battle_wins:=p.battle_wins+1;
  amount:=floor(base_exp*case when p.battle_wins<=10 then 1.0 when p.battle_wins<=30 then .5 else .25 end)::integer;
  amount:=greatest(0,least(amount,2500-p.battle_exp));p.battle_exp:=p.battle_exp+amount;
 end if;
 insert into ludus_private.level_exp_events values(u,kind,key,amount,at_time);
 update public.ludus_progression set experience=experience+amount,battle_day=p.battle_day,battle_wins=p.battle_wins,battle_exp=p.battle_exp where owner_id=u;
 lv:=ludus_private.level_from_exp(p.experience+amount);
 insert into ludus_private.level_rewards(owner_id,level)select u,level from ludus_private.level_reward_catalog where level<=lv on conflict do nothing;
 return amount;
end $$;

-- New EXP is issued only when existing, authenticated settlement commits.
create or replace function ludus_private.level_battle_event()returns trigger language plpgsql security definer set search_path='' as $$
declare xp integer;d text;
begin
 if new.finished_at is null or old.finished_at is not null then return new;end if;
 xp:=0;
 if new.won and new.mode in('4x5','solo20')and new.finished_at>=new.started_at+interval '10 seconds'and coalesce(new.stats->>'abandoned','false')<>'true'then
  -- V37's current 4x5 and Solo 20 matches have standard difficulty. The trusted
  -- snapshot permits future easy/hard modes; clients cannot choose EXP at finish.
  d:=coalesce(new.snapshot->'ludus_progression'->>'difficulty','standard');
  xp:=ludus_private.level_grant(new.owner_id,'battle',new.id::text,case d when 'easy'then 80 when 'hard'then 150 else 100 end,new.finished_at);
 end if;
 new.reward:=coalesce(new.reward,'{}')||jsonb_build_object('ludus_exp',xp);
 return new;
end $$;
drop trigger if exists ludus_level_battle_v37 on public.ludus_battles;
create trigger ludus_level_battle_v37 before update of finished_at on public.ludus_battles for each row execute function ludus_private.level_battle_event();
create or replace function ludus_private.level_receipt_event()returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.reward:=new.reward||jsonb_build_object('ludus_exp',coalesce((select experience from ludus_private.level_exp_events where owner_id=new.owner_id and source='battle'and source_key=new.battle_id::text),0));return new;
end $$;
drop trigger if exists ludus_level_receipt_v37 on public.ludus_battle_receipts;
create trigger ludus_level_receipt_v37 before insert on public.ludus_battle_receipts for each row execute function ludus_private.level_receipt_event();
create or replace function ludus_private.level_daily_event()returns trigger language plpgsql security definer set search_path='' as $$
declare xp integer;
begin
 xp:=case new.quest_key when 'visit'then 150 when 'battles'then 150 when 'training'then 350 when 'bonus'then 300 when 'team'then 250 when 'solo'then 250 when 'victory'then 250 else 0 end;
 if xp>0 then xp:=ludus_private.level_grant(new.owner_id,'daily',new.day::text||':'||new.quest_key,xp,new.claimed_at);end if;
 new.reward:=coalesce(new.reward,'{}')||jsonb_build_object('ludus_exp',xp);return new;
end $$;
drop trigger if exists ludus_level_daily_v37 on public.ludus_daily_claims;
create trigger ludus_level_daily_v37 before insert on public.ludus_daily_claims for each row execute function ludus_private.level_daily_event();
create or replace function ludus_private.level_imperial_event()returns trigger language plpgsql security definer set search_path='' as $$
declare xp integer;
begin
 if tg_op='INSERT'then
  new.mission:=new.mission||jsonb_build_object('ludus_exp',case (new.mission->>'slot')::integer when 1 then 500 when 2 then 750 else 1000 end);return new;
 end if;
 if old.claimed_at is null and new.claimed_at is not null then
  xp:=coalesce((new.mission->>'ludus_exp')::integer,case(new.mission->>'slot')::integer when 1 then 500 when 2 then 750 else 1000 end);
  xp:=ludus_private.level_grant(new.owner_id,'imperial',new.id::text,xp,new.claimed_at);
  new.rewards:=coalesce(new.rewards,'{}')||jsonb_build_object('ludus_exp',xp);
 end if;return new;
end $$;
drop trigger if exists ludus_level_imperial_v37 on public.ludus_imperial_assignments;
create trigger ludus_level_imperial_v37 before insert or update of claimed_at on public.ludus_imperial_assignments for each row execute function ludus_private.level_imperial_event();

create or replace function ludus_private.level_deliver_gladiator(u uuid,lv integer)returns jsonb language plpgsql set search_path='' as $$
declare cls text;gid uuid;count_owned integer;slots integer;
begin
 select count(*)::integer into count_owned from public.ludus_gladiators where owner_id=u;
 select greatest(legacy_slots,ludus_private.level_granted_gladiators(ludus_private.level_from_exp(experience)))into slots from public.ludus_progression where owner_id=u;
 if count_owned>=slots then return null;end if;
 -- The current game's catalog is seven classes. Keep the entitlement pending
 -- if every class is owned; never disguise a duplicate using a different name.
 select c into cls from unnest(array['murmillo','thraex','hoplomachus','secutor','retiarius','provocator','scissor'])c
 where not exists(select 1 from public.ludus_gladiators where owner_id=u and class=c)order by random()limit 1;
 if cls is null then return null;end if;
 insert into public.ludus_gladiators(owner_id,name,class)
 values(u,case cls when 'murmillo'then 'Marcus'when 'thraex'then 'Varro'when 'hoplomachus'then 'Lucius'when 'secutor'then 'Drusus'when 'retiarius'then 'Titus'when 'provocator'then 'Aulus'else 'Severus'end,cls) returning id into gid;
 return jsonb_build_object('id',gid,'class',cls);
end $$;
create or replace function ludus_private.level_claim(u uuid,lv integer)returns void language plpgsql set search_path='' as $$
declare r ludus_private.level_rewards;c ludus_private.level_reward_catalog;it public.ludus_items;pick public.ludus_shop_catalog;outcome jsonb;g jsonb;stones jsonb:='[]';items jsonb:='[]';f text;quantity integer;sid integer;j integer;
begin
 select * into r from ludus_private.level_rewards where owner_id=u and level=lv for update;
 if not found then raise exception 'Bu seviye henüz açılmadı.';end if;
 select * into c from ludus_private.level_reward_catalog where level=lv;
 if r.claimed_at is null then
  update public.ludus_accounts set gold=gold+c.denarius,diamonds=diamonds+c.diamonds,stones_version=stones_version+1 where user_id=u;
  foreach f in array array['sapphire','emerald','ruby']loop
   quantity:=case f when 'sapphire'then c.sapphire when 'emerald'then c.emerald else c.ruby end;
   for j in 1..quantity loop
    select stone_id into sid from public.ludus_stone_catalog where family=f order by random()limit 1;
    if sid is null then raise exception 'Taş kataloğu bulunamadı.';end if;
    insert into public.ludus_stones(owner_id,family,stone_id,quantity)values(u,f,sid,1)on conflict(owner_id,family,stone_id)do update set quantity=public.ludus_stones.quantity+1;
    stones:=stones||jsonb_build_array(jsonb_build_object('family',f,'id',sid,'quantity',1));
   end loop;
  end loop;
  for j in 1..c.items loop
   select * into pick from public.ludus_shop_catalog where kind in('weapon','shield','helmet','chest','gloves','legs')order by random()limit 1;
   if not found then raise exception 'Eşya kataloğu bulunamadı.';end if;
   insert into public.ludus_items(owner_id,kind,model)values(u,pick.kind,pick.model)returning * into it;
   items:=items||jsonb_build_array(to_jsonb(it));
  end loop;
  if c.gladiators>0 then g:=ludus_private.level_deliver_gladiator(u,lv);end if;
  outcome:=jsonb_build_object('gold',c.denarius,'diamonds',c.diamonds,'stones',stones,'items',items,'gladiator',g);
  update ludus_private.level_rewards set claimed_at=clock_timestamp(),rewards=outcome,gladiator_pending=c.gladiators>0 and g is null where owner_id=u and level=lv;
 elsif r.gladiator_pending then
  g:=ludus_private.level_deliver_gladiator(u,lv);
  if g is not null then update ludus_private.level_rewards set rewards=rewards||jsonb_build_object('gladiator',g),gladiator_pending=false where owner_id=u and level=lv;end if;
 end if;
end $$;
create or replace function ludus_private.level_state(u uuid)returns jsonb language plpgsql set search_path='' as $$
declare p public.ludus_progression;lv integer;lower_exp bigint;cost bigint;owned integer;eligible boolean;rows jsonb;d date:=(clock_timestamp()at time zone'Europe/Istanbul')::date;
begin
 select * into p from public.ludus_progression where owner_id=u;lv:=ludus_private.level_from_exp(p.experience);
 lower_exp:=ludus_private.level_threshold(lv);cost:=case when lv<50 then ludus_private.level_exp_cost(lv)else 0 end;
 select count(*)::integer into owned from public.ludus_gladiators where owner_id=u;
 eligible:=owned<greatest(p.legacy_slots,ludus_private.level_granted_gladiators(lv))and exists(
  select 1 from unnest(array['murmillo','thraex','hoplomachus','secutor','retiarius','provocator','scissor'])c where not exists(select 1 from public.ludus_gladiators where owner_id=u and class=c));
 select jsonb_agg(to_jsonb(c)||jsonb_build_object('unlocked',c.level<=lv,'claimed',r.claimed_at is not null,'gladiator_pending',coalesce(r.gladiator_pending,false),'claimable',c.level<=lv and(r.claimed_at is null or(r.gladiator_pending and eligible)),'result',coalesce(r.rewards,'{}'))order by c.level)into rows
 from ludus_private.level_reward_catalog c left join ludus_private.level_rewards r on r.owner_id=u and r.level=c.level;
 return jsonb_build_object('server_now',clock_timestamp(),'level',lv,'experience',p.experience,'current_exp',case when lv<50 then p.experience-lower_exp else 0 end,'next_exp',cost,'starting_gladiators',2,'granted_gladiators',ludus_private.level_granted_gladiators(lv),'owned_gladiators',owned,'gladiator_slots',greatest(p.legacy_slots,ludus_private.level_granted_gladiators(lv)),
  'battle_exp_today',case when p.battle_day=d then p.battle_exp else 0 end,'battle_wins_today',case when p.battle_day=d then p.battle_wins else 0 end,'battle_exp_limit',2500,'rewards',rows,
  'claimable_count',(select count(*)from jsonb_array_elements(rows)q where(q->>'claimable')::boolean),'pending_gladiator_count',(select count(*)from ludus_private.level_rewards where owner_id=u and gladiator_pending),
  'wallet',(select jsonb_build_object('gold',gold,'diamonds',diamonds,'ludus_name',ludus_name)from public.ludus_accounts where user_id=u),
  'last_exp',(select jsonb_build_object('source',source,'key',source_key,'experience',experience)from ludus_private.level_exp_events where owner_id=u order by occurred_at desc limit 1));
end $$;
create or replace function public.ludus_progress(p_action text default 'state',p_level integer default null)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r record;lv integer;
begin
 if u is null then raise exception 'Hesabına giriş yap.';end if;
 if p_action not in('state','claim')then raise exception 'Geçersiz işlem.';end if;
 perform ludus_private.level_ensure(u);
 lv:=ludus_private.level_from_exp((select experience from public.ludus_progression where owner_id=u));
 insert into ludus_private.level_rewards(owner_id,level)select u,level from ludus_private.level_reward_catalog where level<=lv on conflict do nothing;
 if p_action='claim'then
  if p_level is not null then perform ludus_private.level_claim(u,p_level);
  else for r in select level from ludus_private.level_rewards where owner_id=u and(claimed_at is null or gladiator_pending)order by level loop perform ludus_private.level_claim(u,r.level);end loop;end if;
 end if;return ludus_private.level_state(u);
end $$;
revoke all on function public.ludus_progress(text,integer)from public,anon;
grant execute on function public.ludus_progress(text,integer)to authenticated;
-- All implementation helpers are private. Clients cannot mint EXP or reroll rewards.
revoke all on function ludus_private.level_exp_cost(integer),ludus_private.level_threshold(integer),ludus_private.level_from_exp(bigint),ludus_private.level_granted_gladiators(integer),ludus_private.level_ensure(uuid),ludus_private.level_grant(uuid,text,text,integer,timestamptz),ludus_private.level_battle_event(),ludus_private.level_receipt_event(),ludus_private.level_daily_event(),ludus_private.level_imperial_event(),ludus_private.level_deliver_gladiator(uuid,integer),ludus_private.level_claim(uuid,integer),ludus_private.level_state(uuid)from public,anon,authenticated;
CREATE OR REPLACE FUNCTION ludus_private.daily_view(uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date:=(now() at time zone 'Europe/Istanbul')::date;r public.ludus_daily_runs;
 cycle integer;mode_title text;mode_key text;mode_progress integer;trained integer;missions jsonb;completed integer;
begin
 if uid is null then raise exception 'Giriş gerekli';end if;
 insert into public.ludus_daily_runs(owner_id,day,visited) values(uid,d,true)
  on conflict(owner_id,day) do update set visited=true;
 select * into r from public.ludus_daily_runs where owner_id=uid and day=d;
 cycle:=((d-date '2026-01-01')%4+4)%4;
 mode_key:=case cycle when 0 then 'team' when 1 then 'solo' else 'victory' end;
 mode_title:=case cycle when 0 then 'Birlikte mücadele' when 1 then 'Tek başına arenada' else 'Zaferin sesi' end;
 mode_progress:=case cycle when 0 then r.team_battles when 1 then r.solo_battles else r.wins end;
 select count(*)::integer into trained from public.ludus_training_sessions
  where owner_id=uid and train_until<=now() and (train_until at time zone 'Europe/Istanbul')::date=d;
 select jsonb_agg(jsonb_build_object('key',v.key,'title',v.title,'description',v.description,
  'progress',least(v.progress,v.target),'target',v.target,'gold',v.gold,'destination',v.destination,
  'ludus_exp',case v.key when 'visit'then 150 when 'battles'then 150 when 'training'then 350 else 250 end,
  'claimed',exists(select 1 from public.ludus_daily_claims c where c.owner_id=uid and c.day=d and c.quest_key=v.key)) order by v.ordinal)
 into missions from (values
  (1,'visit','Ludus seni bekliyor','Bugün Ludus’una giriş yap.',case when r.visited then 1 else 0 end,1,25,'ludus.html'),
  (2,'battles','Arena tecrübesi','İki arena savaşını tamamla. Çekilme sayılmaz.',r.battles,2,75,'savas.html'),
  (3,mode_key,mode_title,case cycle when 0 then '4x5 modunda bir savaşı tamamla.' when 1 then 'Solo 20 modunda bir savaşı tamamla.' else 'Herhangi bir arena modunda bir zafer kazan.' end,mode_progress,1,60,'savas.html'),
  (4,'training','Doctore’nin disiplini','Bir gladyatörün antrenmanını tamamla.',coalesce(trained,0),1,40,'ludus.html')
 ) as v(ordinal,key,title,description,progress,target,gold,destination);
 select count(*)::integer into completed from jsonb_array_elements(missions) m where (m->>'claimed')::boolean;
 return jsonb_build_object('day',d,'server_now',now(),'reset_at',(d+1)::timestamp at time zone 'Europe/Istanbul',
  'bonus_exp',300,'missions',missions,'claimed_count',completed,'bonus_claimed',exists(select 1 from public.ludus_daily_claims where owner_id=uid and day=d and quest_key='bonus'),
  'wallet',(select jsonb_build_object('ludus_name',ludus_name,'gold',gold,'diamonds',diamonds) from public.ludus_accounts where user_id=uid));
end $function$


;
CREATE OR REPLACE FUNCTION public.ludus_daily_claim(p_day date, p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();state jsonb;mission jsonb;reward jsonb;coins integer;dia integer:=0;sid integer;
begin
 if uid is null then raise exception 'Giriş gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;if not found then raise exception 'Ludus bulunamadı';end if;
 select c.reward into reward from public.ludus_daily_claims c where owner_id=uid and day=p_day and quest_key=p_key;
 if found then return jsonb_build_object('reward',reward,'repeated',true,'state',ludus_private.daily_view(uid));end if;
 if p_day is null or p_day<>(now() at time zone 'Europe/Istanbul')::date then raise exception 'Bu görevin süresi doldu. Günlük görevleri yenile.';end if;
 state:=ludus_private.daily_view(uid);
 if p_key='bonus' then
  if (state->>'claimed_count')::integer<4 then raise exception 'Önce dört görev ödülünü al';end if;
  coins:=100;dia:=1;sid:=1+floor(random()*18)::integer;
 else
  select m into mission from jsonb_array_elements(state->'missions') m where m->>'key'=p_key;
  if mission is null then raise exception 'Görev bulunamadı';end if;
  if (mission->>'progress')::integer<(mission->>'target')::integer then raise exception 'Görev henüz tamamlanmadı';end if;
  coins:=(mission->>'gold')::integer;
 end if;
 reward:=jsonb_build_object('gold',coins,'diamonds',dia,'sapphire_id',sid);
 insert into public.ludus_daily_claims(owner_id,day,quest_key,reward) values(uid,p_day,p_key,reward) returning ludus_daily_claims.reward into reward;
 update public.ludus_accounts set gold=gold+coins,diamonds=diamonds+dia where user_id=uid;
 if sid is not null then
  insert into public.ludus_stones(owner_id,family,stone_id,quantity) values(uid,'sapphire',sid,1)
   on conflict(owner_id,family,stone_id) do update set quantity=public.ludus_stones.quantity+1;
 end if;
 return jsonb_build_object('reward',reward,'repeated',false,'state',ludus_private.daily_view(uid));
end $function$


;
CREATE OR REPLACE FUNCTION public.ludus_finish_battle(p_battle uuid, p_won boolean, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); b public.ludus_battles; kind text; model text; itemid uuid; prize jsonb:='{}';
begin
 if uid is null then raise exception 'Giriş gerekli'; end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;
 select * into b from public.ludus_battles where id=p_battle and owner_id=uid for update;
 if not found then raise exception 'Savaş kaydı bulunamadı'; end if;
 if b.rule_version=2 then raise exception 'Yeni savaş sonucunu v2 sayfasından kaydedin';end if;
 if b.finished_at is not null then return coalesce(b.reward,'{}'); end if;
 if now()<b.started_at+interval '10 seconds' then raise exception 'Savaş süresi doğrulanamadı'; end if;
 if now()>b.started_at+interval '2 hours' then p_won:=false; end if;
 if p_won then
  kind:=(array['weapon','shield','helmet','gloves','legs'])[1+floor(random()*5)::integer];
  model:=case kind when 'weapon' then (array['gladius','sica','spear','trident'])[1+floor(random()*4)::integer] when 'shield' then (array['large','round','small'])[1+floor(random()*3)::integer] when 'helmet' then 'secutor' else 'starter' end;
  insert into public.ludus_items(owner_id,kind,model) values(uid,kind,model) returning id into itemid;
  prize:=jsonb_build_object('gold',100,'diamonds',1,'sapphires',1,'item_id',itemid,'kind',kind,'model',model);
  update public.ludus_accounts set gold=gold+100,diamonds=diamonds+1,sapphires=sapphires+1,wins=wins+1 where user_id=uid;
 else update public.ludus_accounts set losses=losses+1 where user_id=uid; end if;
 update public.ludus_battles set finished_at=now(),won=coalesce(p_won,false),reward=prize,stats=case when pg_column_size(p_stats)<8192 then p_stats else '{}'::jsonb end where id=b.id returning reward into prize;
 delete from public.ludus_battles where owner_id=uid and finished_at is not null and id not in (select id from public.ludus_battles where owner_id=uid and finished_at is not null order by finished_at desc limit 5);
 return prize;
end $function$


;
CREATE OR REPLACE FUNCTION public.ludus_finish_battle_v2(p_battle uuid, p_won boolean, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();b public.ludus_battles;kv record;entry jsonb;it jsonb;tokens text[]:='{}';exits jsonb;keep uuid[]:='{}';iid uuid;newids jsonb:='[]';kind text;model text;prize jsonb:='{}';alive boolean;typed_stone jsonb;
begin
 if uid is null then raise exception 'Giriş gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;
 select reward into prize from public.ludus_battle_receipts where battle_id=p_battle and owner_id=uid;
 if found then return prize;end if;
 prize:='{}';
 select * into b from public.ludus_battles where id=p_battle and owner_id=uid for update;
 if not found or b.rule_version<>2 then raise exception 'Savaş kaydı bulunamadı veya eski sürüm';end if;
 if b.finished_at is not null then return coalesce(b.reward,'{}');end if;
 if coalesce(p_won,false) and now()<b.started_at+interval '10 seconds' then raise exception 'Savaş süresi doğrulanamadı';end if;
 if now()>b.started_at+interval '2 hours' then p_won:=false;end if;
 alive:=coalesce((p_stats->>'alive')::boolean,false);
 exits:=case when p_won and alive then coalesce(p_stats->'exit_slots','{}') else '{}'::jsonb end;
 if jsonb_typeof(exits)<>'object' then raise exception 'Çıkış ekipmanı geçersiz';end if;
 for kv in select * from jsonb_each_text(exits) loop
  if kv.key not in ('main_hand','off_hand','helmet','chest','gloves','legs') then raise exception 'Geçersiz çıkış yuvası';end if;
  if kv.value is null then continue;end if;
  if kv.value=any(tokens) then raise exception 'Aynı eşya iki kez alınamaz';end if;
  select value into entry from jsonb_array_elements(b.loot) where value->>'token'=kv.value;
  if not found then raise exception 'Bu eşya savaşta yok';end if;
  it:=entry->'item';
  if not ((kv.key='main_hand' and it->>'kind'='weapon' and it->>'model' in ('gladius','sica','spear','trident','mace','whip')) or (kv.key='off_hand' and it->>'kind' in ('weapon','shield')) or (kv.key=it->>'kind' and kv.key in ('helmet','chest','gloves','legs'))) then raise exception 'Çıkış ekipmanı yuvaya uymuyor';end if;
  tokens:=array_append(tokens,kv.value);
  if entry->>'inventory_id' is not null then keep:=array_append(keep,(entry->>'inventory_id')::uuid);end if;
 end loop;
 -- The carried-in set is replaced atomically by the living winner's carried-out set.
 delete from public.ludus_items where owner_id=uid and locked_battle_id=b.id and not(id=any(keep));
 update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=uid and locked_battle_id=b.id;
 for kv in select * from jsonb_each_text(exits) loop
  if kv.value is null then continue;end if;
  select value into entry from jsonb_array_elements(b.loot) where value->>'token'=kv.value;it:=entry->'item';
  if entry->>'inventory_id' is not null then
   iid:=(entry->>'inventory_id')::uuid;
   update public.ludus_items set locked_battle_id=null,equipped_by=b.gladiator_id,equipped_slot=kv.key where id=iid and owner_id=uid and locked_battle_id=b.id;
   if not found then raise exception 'Eşya kilidi doğrulanamadı';end if;
  else
   insert into public.ludus_items(owner_id,kind,model,enhancement,base_stats,sapphires,rubies,equipped_by,equipped_slot,stat_version,natural_rule_version,natural_stats,natural_percentages,emeralds,certus_used) values(uid,it->>'kind',it->>'model',(it->>'enhancement')::integer,it->'base_stats',it->'sapphires',it->'rubies',b.gladiator_id,kv.key,coalesce((it->>'stat_version')::integer,0),coalesce((it->>'natural_rule_version')::integer,0),coalesce(it->'natural_stats','{}'),coalesce(it->'natural_percentages','{}'),coalesce(it->'emeralds','[]'),coalesce((it->>'certus_used')::boolean,false)) returning id into iid;
  end if;
  newids:=newids||jsonb_build_array(iid);
 end loop;
 if p_won then
  kind:=(array['weapon','shield','helmet','gloves','legs'])[1+floor(random()*5)::integer];model:=case kind when 'weapon' then (array['gladius','sica','spear','trident'])[1+floor(random()*4)::integer] when 'shield' then 'round' when 'helmet' then 'gold' else 'starter' end;
  insert into public.ludus_items(owner_id,kind,model) values(uid,kind,model) returning id into iid;
  typed_stone:=ludus_private.win_stone_v10(uid);
  prize:=jsonb_build_object('gold',100,'diamonds',1,'stone',typed_stone,'kind',kind,'item_id',iid);
  update public.ludus_accounts set gold=gold+100,diamonds=diamonds+1,wins=wins+1 where user_id=uid;
  update public.ludus_gladiators set wins_4x5=wins_4x5+case when b.mode='4x5' then 1 else 0 end,wins_solo20=wins_solo20+case when b.mode='solo20' then 1 else 0 end where id=b.gladiator_id;
 else update public.ludus_accounts set losses=losses+1 where user_id=uid;end if;
 prize:=prize||jsonb_build_object('extracted',newids,'gear_lost',not(coalesce(p_won,false) and alive));
 update public.ludus_battles set finished_at=now(),won=coalesce(p_won,false),reward=prize,stats=case when pg_column_size(p_stats)<16384 then p_stats else '{}'::jsonb end where id=b.id returning reward into prize;
 insert into public.ludus_battle_receipts(battle_id,owner_id,reward,finished_at) values(b.id,uid,prize,now());
 delete from public.ludus_battles where owner_id=uid and finished_at is not null and id not in(select id from public.ludus_battles where owner_id=uid and finished_at is not null order by finished_at desc limit 5);
 return prize;
end $function$


;
commit;
select 'Ludus seviye V37 hazır' as result;
