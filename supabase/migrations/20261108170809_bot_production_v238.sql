-- Bot production uses the player's actual market, caravan, recipes and upgrades.
create table ludus_bot_private.gear_goals_v238(
 slot smallint not null references ludus_bot_private.members_v233(slot) on delete cascade,
 gladiator_id uuid not null references public.ludus_gladiators(id) on delete cascade,
 equipment_slot text not null check(equipment_slot in('main_hand','off_hand','helmet','chest','gloves','legs')),
 sku text not null references ludus_supply_private.production_recipes_v118(sku),
 item_id uuid references public.ludus_items(id) on delete set null,
 state text not null default 'pending' check(state in('pending','crafted','equipped')),
 primary key(gladiator_id,equipment_slot)
);
create table ludus_bot_private.production_log_v238(
 slot smallint primary key references ludus_bot_private.members_v233(slot) on delete cascade,
 last_action text, last_error text, updated_at timestamptz not null default clock_timestamp()
);
alter table ludus_bot_private.gear_goals_v238 enable row level security;
alter table ludus_bot_private.production_log_v238 enable row level security;
revoke all on ludus_bot_private.gear_goals_v238,ludus_bot_private.production_log_v238 from public,anon,authenticated;

-- Return the next missing ingredient or one craftable recipe. The next tick
-- recomputes the plan from the actual inventory after every completed action.
create function ludus_bot_private.production_need_v238(p_owner uuid,p_sku text,p_qty integer,p_depth integer default 0)
returns jsonb language plpgsql stable set search_path='' as $$
declare have integer; missing integer; r ludus_supply_private.production_recipes_v118; ingredient record; next_step jsonb;
begin
 if p_depth>10 or p_qty<1 or p_qty>50000 then raise exception 'Üretim planı geçersiz.';end if;
 select coalesce(quantity,0) into have from ludus_supply_private.stock where owner_id=p_owner and sku=p_sku;
 missing:=greatest(0,p_qty-coalesce(have,0));
 if missing=0 then return null;end if;
 if exists(select 1 from ludus_supply_private.market_goods_v116 where sku=p_sku and active) then
  return jsonb_build_object('action','buy','sku',p_sku,'quantity',least(60,missing));
 end if;
 select * into r from ludus_supply_private.production_recipes_v118 where sku=p_sku;
 if not found then raise exception 'Üretim girdisi bulunamadı: %',p_sku;end if;
 for ingredient in select key,value::integer amount from jsonb_each_text(r.ingredients) order by key loop
  next_step:=ludus_bot_private.production_need_v238(p_owner,ingredient.key,ingredient.amount,p_depth+1);
  if next_step is not null then return next_step;end if;
 end loop;
 return jsonb_build_object('action','craft','sku',p_sku);
end;$$;
revoke all on function ludus_bot_private.production_need_v238(uuid,text,integer,integer) from public,anon,authenticated;

create function ludus_bot_private.production_tick_v238(p_slot integer) returns void
language plpgsql security definer set search_path='' as $$
declare b ludus_bot_private.members_v233;cfg ludus_bot_private.settings_v233;goal ludus_bot_private.gear_goals_v238;
 supply_state jsonb;step jsonb;receipt jsonb;item uuid;stone integer;city integer;qty integer;epoch bigint;offer jsonb;price numeric;budget bigint;
 original_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),''); action_text text;
begin
 if not pg_try_advisory_xact_lock(238000,p_slot) then return;end if;
 select * into cfg from ludus_bot_private.settings_v233 where id;
 select * into b from ludus_bot_private.members_v233 where slot=p_slot;
 if not found or b.user_id is null or not b.enabled or not cfg.ready or not cfg.enabled then return;end if;
 perform set_config('request.jwt.claim.sub',b.user_id::text,true);
 -- Initializes stock and settles normally completed caravans, without minting.
 supply_state:=public.ludus_supply('state',null,null,null);
 if exists(select 1 from ludus_private.level_rewards where owner_id=b.user_id and claimed_at is null) then
  perform public.ludus_progress('claim',null);
 end if;
 insert into ludus_bot_private.gear_goals_v238(slot,gladiator_id,equipment_slot,sku)
 select b.slot,g.id,v.equipment_slot,v.sku from public.ludus_gladiators g
 cross join lateral (values
  ('legs','legs'),('gloves','manica'),('chest','chest'),('helmet','helmet-roman'),
  ('off_hand',case when g.class in('murmillo','secutor','provocator') then 'shield-large'
    when g.class in('thraex','hoplomachus') then 'shield-medium' else null end),
  ('main_hand',case g.class when 'thraex' then 'sica' when 'hoplomachus' then 'spear'
    when 'retiarius' then 'trident' else 'gladius' end)
 ) v(equipment_slot,sku) where g.owner_id=b.user_id and v.sku is not null
 on conflict(gladiator_id,equipment_slot) do nothing;
 update ludus_bot_private.gear_goals_v238 set state='pending' where slot=b.slot and item_id is null and state<>'pending';

 -- Equip completed items only when the fighter and gear are actually available.
 select goal_row.* into goal from ludus_bot_private.gear_goals_v238 goal_row join public.ludus_gladiators g on g.id=goal_row.gladiator_id
 join public.ludus_items i on i.id=goal_row.item_id and i.owner_id=b.user_id
 where goal_row.slot=b.slot and goal_row.state='crafted' and g.status='available' and g.clan_roster_id is null
  and (g.injured_until is null or g.injured_until<=clock_timestamp()) and (g.training_ends_at is null or g.training_ends_at<=clock_timestamp())
  and not exists(select 1 from public.ludus_battles q where q.gladiator_id=g.id and q.finished_at is null)
  and not exists(select 1 from public.ludus_matches q where q.status in('waiting','playing') and q.updated_at>clock_timestamp()-interval '30 seconds'
   and q.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
 order by goal_row.gladiator_id,goal_row.equipment_slot limit 1;
 if found then
  perform public.ludus_equip_item(goal.gladiator_id,goal.equipment_slot,goal.item_id);
  update ludus_bot_private.gear_goals_v238 set state='equipped' where gladiator_id=goal.gladiator_id and equipment_slot=goal.equipment_slot;
  action_text:='Kuşanıldı: '||goal.sku;
 end if;

 -- Spread diamonds across equipped gear; +6 avoids the destructive +6 attempt.
 if (select diamonds>0 from public.ludus_accounts where user_id=b.user_id) then
  select i.id into item from public.ludus_items i join public.ludus_gladiators g on g.id=i.equipped_by and g.owner_id=b.user_id
  where i.owner_id=b.user_id and i.stat_version=10 and i.enhancement<6 and i.locked_battle_id is null
   and i.clan_vault_id is null and i.clan_roster_id is null and i.market_listing_id is null
   and not exists(select 1 from public.ludus_battles q where q.gladiator_id=g.id and q.finished_at is null)
   and not exists(select 1 from public.ludus_matches q where q.status in('waiting','playing') and q.updated_at>clock_timestamp()-interval '30 seconds'
    and q.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
  order by i.enhancement,i.created_at,i.id limit 1;
  if item is not null then perform public.ludus_upgrade_item_v10(item,'enhance',null,gen_random_uuid());action_text:='Eşya geliştirildi';end if;
 end if;
 -- Use an owned build emerald only if it is not yet socketed in that item.
 select i.id,s.stone_id into item,stone from public.ludus_items i
 join public.ludus_gladiators g on g.id=i.equipped_by and g.owner_id=b.user_id
 join public.ludus_stones s on s.owner_id=b.user_id and s.family='emerald' and s.quantity>0
 where i.owner_id=b.user_id and i.stat_version=10 and i.locked_battle_id is null and i.clan_vault_id is null
  and i.clan_roster_id is null and i.market_listing_id is null and jsonb_array_length(i.emeralds)<4
  and s.stone_id=any(ludus_bot_private.build_v233(b.slot))
  and not exists(select 1 from jsonb_array_elements(i.emeralds) x where (x->>'id')::integer=s.stone_id)
  and not exists(select 1 from public.ludus_battles q where q.gladiator_id=g.id and q.finished_at is null)
  and not exists(select 1 from public.ludus_matches q where q.status in('waiting','playing') and q.updated_at>clock_timestamp()-interval '30 seconds'
   and q.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
 order by jsonb_array_length(i.emeralds),i.created_at,array_position(ludus_bot_private.build_v233(b.slot),s.stone_id) limit 1;
 if item is not null then perform public.ludus_upgrade_item_v10(item,'emerald',stone,gen_random_uuid());action_text:='Zümrüt takıldı';end if;

 -- Safirs use the game's own item-group compatibility and at most two slots.
 select i.id,s.stone_id into item,stone from public.ludus_items i
 join public.ludus_gladiators g on g.id=i.equipped_by and g.owner_id=b.user_id
 join public.ludus_stones s on s.owner_id=b.user_id and s.family='sapphire' and s.quantity>0
 join public.ludus_stone_catalog c on c.family='sapphire' and c.stone_id=s.stone_id
 where i.owner_id=b.user_id and i.stat_version=10 and i.locked_battle_id is null and i.clan_vault_id is null
  and i.clan_roster_id is null and i.market_listing_id is null and i.natural_stats?c.effect_key
  and not(i.natural_percentages?c.effect_key)
  and (select count(*) from jsonb_object_keys(i.natural_percentages))<2
  and not exists(select 1 from public.ludus_battles q where q.gladiator_id=g.id and q.finished_at is null)
  and not exists(select 1 from public.ludus_matches q where q.status in('waiting','playing') and q.updated_at>clock_timestamp()-interval '30 seconds'
   and q.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
 order by i.created_at,s.stone_id limit 1;
 if item is not null then perform public.ludus_upgrade_item_v10(item,'sapphire',stone,gen_random_uuid());action_text:='Safir takıldı';end if;

 select * into goal from ludus_bot_private.gear_goals_v238 where slot=b.slot and state='pending'
 order by case equipment_slot when 'legs' then 1 when 'gloves' then 2 when 'chest' then 3 when 'helmet' then 4 when 'off_hand' then 5 else 6 end,gladiator_id limit 1;
 if found then
  step:=ludus_bot_private.production_need_v238(b.user_id,goal.sku,1,0);
  if step->>'action'='craft' then
   receipt:=public.ludus_supply('craft',step->>'sku',1,gen_random_uuid());
   if step->>'sku'=goal.sku then
    update ludus_bot_private.gear_goals_v238 set item_id=(receipt->'result'->>'item_id')::uuid,state='crafted'
     where gladiator_id=goal.gladiator_id and equipment_slot=goal.equipment_slot;
   end if;
   action_text:='Üretildi: '||(step->>'sku');
  elsif step->>'action'='buy' and (supply_state->>'free_caravans')::integer>0 then
   epoch:=floor(extract(epoch from clock_timestamp())/900)::bigint;
   select c.id,o.quote into city,offer from ludus_supply_private.cities_v116 c
    cross join lateral(select ludus_supply_private.offer_v116(c.id,step->>'sku',epoch) quote)o
    where (o.quote->>'stock')::integer>0 order by (o.quote->>'unit_price')::numeric,c.id limit 1;
   price:=(offer->>'unit_price')::numeric;select greatest(0,gold-100) into budget from public.ludus_accounts where user_id=b.user_id;
   qty:=least((step->>'quantity')::integer,(offer->>'stock')::integer,60,least(60,floor(budget/nullif(price,0)))::integer);
   if qty>0 then
    receipt:=public.ludus_supply('buy',city||':'||(step->>'sku')||':'||epoch||':'||qty,1,gen_random_uuid());
    action_text:='Kervan malzeme aldı: '||(step->>'sku');
   end if;
  end if;
 end if;
 insert into ludus_bot_private.production_log_v238(slot,last_action,last_error) values(b.slot,action_text,null)
 on conflict(slot) do update set last_action=coalesce(excluded.last_action,ludus_bot_private.production_log_v238.last_action),last_error=null,updated_at=clock_timestamp();
 perform set_config('request.jwt.claim.sub',original_sub,true);
exception when others then
 perform set_config('request.jwt.claim.sub',original_sub,true);
 insert into ludus_bot_private.production_log_v238(slot,last_error) values(p_slot,left(sqlerrm,200))
 on conflict(slot) do update set last_error=excluded.last_error,updated_at=clock_timestamp();
end;$$;
revoke all on function ludus_bot_private.production_tick_v238(integer) from public,anon,authenticated;

create function ludus_bot_private.production_schedule_v238() returns void
language plpgsql security definer set search_path='' as $$
declare i integer;start_slot integer;
begin
 start_slot:=mod(floor(extract(epoch from clock_timestamp())/60)::bigint*3,39)::integer;
 for i in 0..2 loop perform ludus_bot_private.production_tick_v238(mod(start_slot+i,39)+1);end loop;
end;$$;
revoke all on function ludus_bot_private.production_schedule_v238() from public,anon,authenticated;
do $$begin
 if exists(select 1 from pg_namespace where nspname='cron') then
  perform cron.schedule('ludus-bot-production-v238','* * * * *','select ludus_bot_private.production_schedule_v238()');
 end if;
end$$;
