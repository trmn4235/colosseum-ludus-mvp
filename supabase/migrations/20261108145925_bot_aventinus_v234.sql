-- Earn the existing Aventinus fame requirement through actual pit matches.
create or replace function public.ludus_bot_claim_v233() returns jsonb language plpgsql security definer set search_path='' as $$
declare c ludus_bot_private.settings_v233; b ludus_bot_private.members_v233; g public.ludus_gladiators;
 ticket public.ludus_battles; slot_map jsonb; v_result jsonb; token uuid; weapon_id uuid; choice text; gem integer; previous_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),'');
begin
 select * into c from ludus_bot_private.settings_v233 where id;
 if not c.ready or not c.enabled then return jsonb_build_object('idle',true);end if;
 select * into b from ludus_bot_private.members_v233 where enabled and user_id is not null and next_run_at<=clock_timestamp()
  and (lease is null or lease_until<clock_timestamp())
  order by case when battle_id is not null and exists(select 1 from public.ludus_battles q
    where q.id=battle_id and q.started_at<clock_timestamp()-interval '50 minutes') then 0 else 1 end,
   next_run_at,slot for update skip locked limit 1;
 if not found then return jsonb_build_object('idle',true);end if;
 begin
 perform set_config('request.jwt.claim.sub',b.user_id::text,true);
 if b.result is not null then
  select * into ticket from public.ludus_battles where id=b.battle_id and owner_id=b.user_id;
  if not found then raise exception 'Bot savaşı bulunamadı.';end if;
  if ticket.started_at>clock_timestamp()-interval '10 seconds' then
   update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()+interval '15 seconds' where slot=b.slot;
   perform set_config('request.jwt.claim.sub',previous_sub,true);return jsonb_build_object('waiting',true);
  end if;
  v_result:=public.ludus_finish_battle_v2(b.battle_id,coalesce((b.result->>'won')::boolean,false),b.result->'stats');
  update ludus_bot_private.members_v233 set matches=matches+1,last_result=jsonb_build_object('won',(b.result->>'won')::boolean,'reward',v_result,'at',clock_timestamp()),
   battle_id=null,state=null,steps=0,seed=null,result=null,lease=null,lease_until=null,last_error=null,
   next_run_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() where slot=b.slot;
  perform set_config('request.jwt.claim.sub',previous_sub,true);return jsonb_build_object('finished',true,'slot',b.slot);
 end if;
 if b.battle_id is null then
  perform ludus_private.v7_settle(b.user_id);
  select * into g from public.ludus_gladiators x where x.owner_id=b.user_id and x.status='available' and x.fatigue_value<100
   and (x.injured_until is null or x.injured_until<=clock_timestamp()) and (x.training_ends_at is null or x.training_ends_at<=clock_timestamp())
   and x.clan_roster_id is null and not exists(select 1 from public.ludus_battles q where q.owner_id=b.user_id and q.finished_at is null)
   order by x.overall desc,x.id limit 1;
  if not found then
   update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()+interval '10 minutes',last_error='Hazır gladyatör bekleniyor.' where slot=b.slot;
   perform set_config('request.jwt.claim.sub',previous_sub,true);return jsonb_build_object('waiting',true);
  end if;
  select coalesce(jsonb_object_agg(i.equipped_slot,i.id),'{}'::jsonb) into slot_map from public.ludus_items i
   where i.owner_id=b.user_id and i.equipped_by=g.id and i.equipped_slot is not null and i.locked_battle_id is null
    and i.clan_vault_id is null and i.clan_roster_id is null and i.market_listing_id is null
    and (i.equipped_slot<>'main_hand' or i.model in('gladius','sica','spear','trident','whip','heavy_mace','warhammer','halberd','trident_gladiator'));
  if not(slot_map ? 'main_hand') then
   select i.id into weapon_id from public.ludus_items i where i.owner_id=b.user_id and i.equipped_by is null and i.kind='weapon'
    and i.model in('gladius','sica','spear','trident','whip','heavy_mace','warhammer','halberd','trident_gladiator')
    and i.locked_battle_id is null and i.clan_vault_id is null and i.clan_roster_id is null and i.market_listing_id is null
    order by i.enhancement desc,i.created_at,i.id limit 1;
   if weapon_id is null and (select gold>=100 from public.ludus_accounts where user_id=b.user_id) then
    choice:=case g.class when 'thraex' then 'sica' when 'hoplomachus' then 'spear' when 'retiarius' then 'trident' else 'gladius' end;
    v_result:=public.ludus_buy_basic(choice,gen_random_uuid());weapon_id:=(v_result->>'item_id')::uuid;
   end if;
   if weapon_id is not null then slot_map:=slot_map||jsonb_build_object('main_hand',weapon_id);end if;
  else weapon_id:=(slot_map->>'main_hand')::uuid;
  end if;
  if weapon_id is not null then
   -- Spend earned stones only on this bot's chosen four-stone build.
   select s.stone_id into gem from public.ludus_stones s join public.ludus_items i on i.id=weapon_id
    where s.owner_id=b.user_id and s.family='emerald' and s.quantity>0 and s.stone_id=any(ludus_bot_private.build_v233(b.slot))
     and jsonb_array_length(i.emeralds)<4 and not exists(select 1 from jsonb_array_elements(i.emeralds) e where (e->>'id')::integer=s.stone_id)
    order by array_position(ludus_bot_private.build_v233(b.slot),s.stone_id) limit 1;
   if gem is not null then perform public.ludus_upgrade_item_v10(weapon_id,'emerald',gem,gen_random_uuid());end if;
   if exists(select 1 from public.ludus_items i join public.ludus_accounts a on a.user_id=i.owner_id
     where i.id=weapon_id and i.stat_version=10 and i.enhancement<4 and a.diamonds>0) then
    perform public.ludus_upgrade_item_v10(weapon_id,'enhance',null,gen_random_uuid());
   end if;
  end if;
  if exists(select 1 from ludus_pit_private.rules r where r.id and r.gate_enabled and coalesce((select f.points from ludus_pit_private.fame f where f.gladiator_id=g.id),0)<r.entry_fame) then
   v_result:=public.ludus_start_battle_v2(g.id,'pit',jsonb_build_object('pit_weapon','pit_stone_mace'),gen_random_uuid());
  else
   v_result:=public.ludus_start_battle_v2(g.id,'4x5',slot_map,gen_random_uuid());
  end if;
  update ludus_bot_private.members_v233 set battle_id=(v_result->>'id')::uuid,state=null,steps=0,seed=floor(random()*2147483647)::bigint,last_error=null where slot=b.slot returning * into b;
 end if;
 select * into ticket from public.ludus_battles where id=b.battle_id and owner_id=b.user_id and finished_at is null;
 if not found then raise exception 'Bot savaş bileti bulunamadı.';end if;
 token:=gen_random_uuid();
 update ludus_bot_private.members_v233 set lease=token,lease_until=clock_timestamp()+interval '90 seconds',next_run_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() where slot=b.slot;
 perform set_config('request.jwt.claim.sub',previous_sub,true);
 return jsonb_build_object('slot',b.slot,'lease',token,'battle',b.battle_id,'seed',b.seed,'steps',b.steps,'state',b.state,
  'ticket',case when b.state is null then to_jsonb(ticket) else null end);
 exception when others then
  perform set_config('request.jwt.claim.sub',previous_sub,true);
  update ludus_bot_private.members_v233 set lease=null,lease_until=null,last_error=left(sqlerrm,200),
   next_run_at=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where slot=b.slot;
  return jsonb_build_object('fault',true,'slot',b.slot);
 end;
end;$$;
