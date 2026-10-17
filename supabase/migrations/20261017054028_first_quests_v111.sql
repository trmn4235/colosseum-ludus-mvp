-- Durable beginner milestones. Transactional goals are credited only from game records.
create table ludus_private.first_quests_v111 (
 owner_id uuid primary key references public.ludus_accounts(user_id) on delete cascade,
 starters uuid[] not null default '{}', auto_open boolean not null default true,
 presented_at timestamptz, dismissed_at timestamptz, completed_at timestamptz
);
create table ludus_private.first_quest_marks_v111 (
 owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 quest text not null, subject text not null default '', earned_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,quest,subject)
);
alter table ludus_private.first_quests_v111 enable row level security;
alter table ludus_private.first_quest_marks_v111 enable row level security;
revoke all on ludus_private.first_quests_v111,ludus_private.first_quest_marks_v111 from public,anon,authenticated;
create policy first_quests_owner_v111 on ludus_private.first_quests_v111 for select to authenticated using(owner_id=(select auth.uid()));
create policy first_quest_marks_owner_v111 on ludus_private.first_quest_marks_v111 for select to authenticated using(owner_id=(select auth.uid()));
create function ludus_private.first_quest_add_v111(u uuid,q text,s text default '') returns void
language sql set search_path='' as $$
 insert into ludus_private.first_quest_marks_v111(owner_id,quest,subject) values(u,q,s) on conflict do nothing;
$$;
revoke all on function ludus_private.first_quest_add_v111(uuid,text,text) from public,anon,authenticated;

create function ludus_private.first_quest_food_v111(u uuid) returns void
language plpgsql set search_path='' as $$
declare crew integer;menu jsonb;
begin
 if exists(select 1 from ludus_private.first_quest_marks_v111 where owner_id=u and quest='food_day') then return;end if;
 select count(*) into crew from public.ludus_gladiators where owner_id=u;
 if crew=0 then return;end if;
 select ludus_food_private.menu_v55(crew,coalesce(jsonb_agg(jsonb_build_object('sku',sku,'quantity',quantity)),'[]')) into menu
 from public.ludus_food_stock where owner_id=u;
 if (menu->>'missing_units')::integer=0 and (menu->>'daily_need')::integer>0 then
  perform ludus_private.first_quest_add_v111(u,'food_day');
 end if;
end $$;
revoke all on function ludus_private.first_quest_food_v111(uuid) from public,anon,authenticated;

-- Naval battles share the 4x5 combat engine. Preserve the result's actual arena
-- separately from daily-task/reward rules, including after old battles are pruned.
alter table public.ludus_daily_events add column game_mode text;
create function ludus_private.first_quest_battle_mode_v111(p_mode text,p_stats jsonb) returns text
language sql immutable set search_path='' as $$
 select case when p_mode='4x5' and p_stats->>'game_mode'='naval4x5' then 'naval4x5' else p_mode end;
$$;
revoke all on function ludus_private.first_quest_battle_mode_v111(text,jsonb) from public,anon,authenticated;
create function ludus_private.first_quest_daily_mode_v111() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 select ludus_private.first_quest_battle_mode_v111(b.mode,b.stats) into new.game_mode
 from public.ludus_battles b where b.id=new.battle_id and b.owner_id=new.owner_id;
 new.game_mode:=coalesce(new.game_mode,new.mode);
 return new;
end $$;
revoke all on function ludus_private.first_quest_daily_mode_v111() from public,anon,authenticated;
create trigger first_quest_daily_mode_v111 before insert on public.ludus_daily_events for each row execute function ludus_private.first_quest_daily_mode_v111();
update public.ludus_daily_events e set game_mode=ludus_private.first_quest_battle_mode_v111(b.mode,b.stats)
 from public.ludus_battles b where b.id=e.battle_id and b.owner_id=e.owner_id;

-- Preserve evidence even if a battle, an item or a listing is later removed.
create function ludus_private.first_quest_event_v111() returns trigger
language plpgsql security definer set search_path='' as $$
declare d jsonb:=to_jsonb(new);u uuid:=nullif(d->>'owner_id','')::uuid;q text;
begin
 case tg_table_name
 when 'ludus_shop_orders' then perform ludus_private.first_quest_add_v111(u,'buy_equipment');
 when 'ludus_items' then
  if new.equipped_by is not null and new.equipped_by is distinct from old.equipped_by
   and new.owner_id=old.owner_id and exists(select 1 from public.ludus_gladiators where id=new.equipped_by and owner_id=u)
   and exists(select 1 from public.ludus_shop_orders where owner_id=u and item_id=new.id) then
   perform ludus_private.first_quest_add_v111(u,'equip');
  end if;
 when 'ludus_training_sessions' then perform ludus_private.first_quest_add_v111(u,'training',d->>'gladiator_id');
 when 'ludus_food_orders' then
  if exists(select 1 from public.ludus_food_catalog where sku=d->>'sku' and edible and nutrition>0) then
   perform ludus_private.first_quest_add_v111(u,'buy_food');
  end if;
 when 'ludus_food_stock' then perform ludus_private.first_quest_food_v111(u);
 when 'ludus_upgrade_receipts' then
  if d->'result'->>'success'='true' then
   if d->>'action'='enhance' and (d->'result'->>'plus')::integer>=2 then q:='enhance';
   elsif d->>'action' in ('sapphire','emerald') then q:=d->>'action';end if;
   if q is not null then perform ludus_private.first_quest_add_v111(u,q);end if;
  end if;
 when 'ludus_daily_events' then
  if d->>'won'='true' and d->>'mode' in ('4x5','solo20','naval4x5') then
   perform ludus_private.first_quest_add_v111(u,coalesce(d->>'game_mode',d->>'mode'));
  end if;
 when 'ludus_battles' then
  if new.finished_at is not null and new.won and new.mode in ('4x5','solo20','naval4x5') then
   perform ludus_private.first_quest_add_v111(u,ludus_private.first_quest_battle_mode_v111(new.mode,new.stats));
  end if;
 when 'survival_records_v83' then
  if (d->>'completed')::integer>=10 then perform ludus_private.first_quest_add_v111(u,'survival');end if;
 when 'ludus_imperial_assignments' then
  if new.claimed_at is not null and coalesce(new.mission->>'difficulty',new.mission->>'slot')='1' then
   perform ludus_private.first_quest_add_v111(u,'imperial');
  end if;
 when 'ludus_daily_claims' then perform ludus_private.first_quest_add_v111(u,'daily');
 when 'market_listings_v66' then
  if d->>'asset_type'='item' then perform ludus_private.first_quest_add_v111((d->>'seller_id')::uuid,'listing');end if;
 when 'level_rewards' then
  if new.level>=2 and new.claimed_at is not null then perform ludus_private.first_quest_add_v111(u,'level');end if;
 when 'notifications_v108' then
  if new.read_at is not null then perform ludus_private.first_quest_add_v111(u,'notification');end if;
 when 'receipts' then
  if d->'payload'->>'action'='craft' and d->'result'->>'item_id' is not null then
   perform ludus_private.first_quest_add_v111(u,'craft');
  end if;
 else raise exception 'Unknown beginner milestone source';
 end case;
 return new;
end $$;
revoke all on function ludus_private.first_quest_event_v111() from public,anon,authenticated;
create trigger first_quests_v111 after insert on public.ludus_shop_orders for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after update of equipped_by on public.ludus_items for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert on public.ludus_training_sessions for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert on public.ludus_food_orders for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert or update of quantity on public.ludus_food_stock for each row when(new.quantity>0) execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert on public.ludus_upgrade_receipts for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert on public.ludus_daily_events for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert or update of finished_at on public.ludus_battles for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert or update on ludus_private.survival_records_v83 for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert or update of claimed_at on public.ludus_imperial_assignments for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert on public.ludus_daily_claims for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert on ludus_private.market_listings_v66 for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert or update of claimed_at on ludus_private.level_rewards for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after update of read_at on ludus_message_private.notifications_v108 for each row execute function ludus_private.first_quest_event_v111();
create trigger first_quests_v111 after insert on ludus_supply_private.receipts for each row execute function ludus_private.first_quest_event_v111();

create function ludus_private.first_quests_state_v111(p_action text,p_subject text,p_detail text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r ludus_private.first_quests_v111;ids uuid[];quest_data jsonb;done integer;lv integer;gid uuid;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true)
 or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
 if p_action is null or p_action not in ('state','present','dismiss','inspect','combat','controls','stones','training_review','supply_review') then
  raise exception 'Geçersiz rehber işlemi.';
 end if;
 -- The account lock shares ordering with existing game transactions.
 perform 1 from public.ludus_accounts where user_id=u for update;
 insert into ludus_private.first_quests_v111(owner_id,auto_open,presented_at,dismissed_at)
 select u,coalesce(o.auto_open,true),o.presented_at,o.dismissed_at from (select 1)x
 left join ludus_private.onboarding_v109 o on o.owner_id=u on conflict do nothing;
 select * into r from ludus_private.first_quests_v111 where owner_id=u for update;
 -- Keep the starting pair stable. A sold/departed fighter can be replaced if still unfinished.
 select coalesce(array_agg(id),'{}') into ids from unnest(r.starters) id
 where exists(select 1 from public.ludus_gladiators g where g.id=id and g.owner_id=u)
 or (exists(select 1 from ludus_private.first_quest_marks_v111 where owner_id=u and quest='inspect' and subject=id::text)
 and exists(select 1 from ludus_private.first_quest_marks_v111 where owner_id=u and quest='training' and subject=id::text));
 select ids||coalesce(array_agg(id),'{}') into ids from
 (select id from public.ludus_gladiators where owner_id=u and not(id=any(ids)) order by created_at,id limit greatest(0,2-cardinality(ids))) g;
 update ludus_private.first_quests_v111 set starters=ids,
 presented_at=case when p_action in ('present','dismiss') then coalesce(presented_at,clock_timestamp()) else presented_at end,
 dismissed_at=case when p_action='dismiss' then coalesce(dismissed_at,clock_timestamp()) else dismissed_at end where owner_id=u returning * into r;
 if p_action in ('inspect','combat','training_review') then
  gid:=p_subject::uuid;
  if not exists(select 1 from public.ludus_gladiators where id=gid and owner_id=u) then raise exception 'Gladyatör sana ait değil.' using errcode='42501';end if;
  if p_action='training_review' then
   if exists(select 1 from public.ludus_training_sessions where owner_id=u and gladiator_id=gid and exercise_settled_at is not null and exercise_stat=p_detail) then
    perform ludus_private.first_quest_add_v111(u,'training_review');
   end if;
  else perform ludus_private.first_quest_add_v111(u,p_action,case when p_action='inspect' then gid::text else '' end);end if;
 elsif p_action='controls' then
  if p_subject not in ('classic','regions') or p_subject is null then raise exception 'Kontrol düzeni geçersiz.';end if;
  perform ludus_private.first_quest_add_v111(u,'controls');
 elsif p_action='stones' then
  if p_subject not in ('diamond','sapphire','emerald','ruby') or p_subject is null then raise exception 'Taş türü geçersiz.';end if;
  perform ludus_private.first_quest_add_v111(u,'stones',p_subject);
 elsif p_action='supply_review' then
  if exists(select 1 from ludus_supply_private.jobs where owner_id=u and claimed_at is not null) then
   perform ludus_private.first_quest_add_v111(u,'supply');
  end if;
 end if;
 -- Backfill only provable historical events. No inference from a purchased item's enhancement.
 insert into ludus_private.first_quest_marks_v111(owner_id,quest,subject)
 select u,quest,subject from (
 select 'training' quest,gladiator_id::text subject from public.ludus_training_sessions where owner_id=u
 union select 'buy_equipment','' from public.ludus_shop_orders where owner_id=u
 union select 'equip','' from public.ludus_shop_orders o join public.ludus_items i on i.id=o.item_id and i.owner_id=u
  join public.ludus_gladiators g on g.id=i.equipped_by and g.owner_id=u where o.owner_id=u
 union select 'buy_food','' from public.ludus_food_orders o join public.ludus_food_catalog c using(sku) where o.owner_id=u and c.edible and c.nutrition>0
 union select 'food_day','' from public.ludus_food_history where owner_id=u and crew_count>0 and (menu->>'missing_units')::integer=0
 union select 'enhance','' from public.ludus_upgrade_receipts where owner_id=u and action='enhance' and result->>'success'='true' and (result->>'plus')::integer>=2
 union select action,'' from public.ludus_upgrade_receipts where owner_id=u and action in ('sapphire','emerald') and result->>'success'='true'
 union select ludus_private.first_quest_battle_mode_v111(mode,stats),'' from public.ludus_battles where owner_id=u and finished_at is not null and won and mode in ('4x5','solo20','naval4x5')
 union select coalesce(game_mode,mode),'' from public.ludus_daily_events where owner_id=u and won and mode in ('4x5','solo20','naval4x5')
 union select 'survival','' from ludus_private.survival_records_v83 where owner_id=u and completed>=10
 union select 'imperial','' from public.ludus_imperial_assignments where owner_id=u and claimed_at is not null and coalesce(mission->>'difficulty',mission->>'slot')='1'
 union select 'daily','' from public.ludus_daily_claims where owner_id=u
 union select 'listing','' from ludus_private.market_listings_v66 where seller_id=u and asset_type='item'
 union select 'level','' from ludus_private.level_rewards where owner_id=u and level>=2 and claimed_at is not null
 union select 'notification','' from ludus_message_private.notifications_v108 where owner_id=u and read_at is not null
 union select 'craft','' from ludus_supply_private.receipts where owner_id=u and payload->>'action'='craft' and result->>'item_id' is not null
 ) evidence on conflict do nothing;
 perform ludus_private.first_quest_food_v111(u);
 lv:=ludus_private.level_from_exp(coalesce((select experience from public.ludus_progression where owner_id=u),0));
 with catalog(key,target,advanced) as (values
 ('inspect',2,false),('combat',1,false),('controls',1,false),('buy_equipment',1,false),('equip',1,false),
 ('training',2,false),('training_review',1,false),('buy_food',1,false),('food_day',1,false),('stones',4,false),
 ('enhance',1,false),('sapphire',1,false),('emerald',1,false),('4x5',1,false),('solo20',1,false),('naval4x5',1,false),
 ('survival',1,false),('imperial',1,false),('daily',1,false),('listing',1,false),('level',1,false),('notification',1,false),
 ('supply',1,true),('craft',1,true)), counts as (
 select c.*,least(c.target,(select count(*)::integer from ludus_private.first_quest_marks_v111 m where m.owner_id=u and m.quest=c.key
 and (c.key not in ('inspect','training') or m.subject=any(select x::text from unnest(ids)x)))) progress from catalog c)
 select jsonb_object_agg(key,jsonb_build_object('progress',progress,'target',target,'complete',progress=target,'unlocked',not advanced or lv>=5)),
 count(*) filter(where not advanced and progress=target) into quest_data,done from counts;
 if done=22 and r.completed_at is null then update ludus_private.first_quests_v111 set completed_at=clock_timestamp() where owner_id=u returning * into r;end if;
 return jsonb_build_object('quests',quest_data,'count',done,'total',22,'level',lv,'completed_at',r.completed_at,
 'should_open',r.auto_open and r.presented_at is null and r.dismissed_at is null and r.completed_at is null,
 'starters',ids,'inspected',coalesce((select jsonb_agg(subject) from ludus_private.first_quest_marks_v111 where owner_id=u and quest='inspect'),'[]'),
 'trained',coalesce((select jsonb_agg(subject) from ludus_private.first_quest_marks_v111 where owner_id=u and quest='training'),'[]'));
end $$;
revoke all on function ludus_private.first_quests_state_v111(text,text,text) from public,anon,authenticated;
grant execute on function ludus_private.first_quests_state_v111(text,text,text) to authenticated;
create function public.ludus_first_quests(p_action text default 'state',p_subject text default null,p_detail text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_private.first_quests_state_v111(p_action,p_subject,p_detail);
$$;
revoke all on function public.ludus_first_quests(text,text,text) from public,anon;
grant execute on function public.ludus_first_quests(text,text,text) to authenticated;
