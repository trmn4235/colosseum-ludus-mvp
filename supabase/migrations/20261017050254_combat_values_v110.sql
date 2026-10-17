-- Inspection calls the same stat and hit functions used by live matches.
-- It never starts combat, equips an item, spends currency or grants a reward.
create function ludus_private.values_snapshot_v110(g jsonb, gear jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
 s jsonb:=private.ludus_combat_stats_v73(g,gear); raw jsonb:=s->'items';
 a jsonb:=jsonb_build_object('stats_version',77,'combat_stats',s,'items',gear);
 v jsonb:='{"combat_stats":{"defense":1,"items":{}}}';
 result jsonb; weapon text; hand text; prefix text; base numeric;
 food numeric:=1+least(12,greatest(0,coalesce((g->>'combat_stamina_bonus')::numeric,0)))/100;
 morale numeric:=1+(least(100,greatest(0,coalesce((g->>'combat_morale')::numeric,50)))-50)/1000;
 shield boolean; parry boolean;
begin
 select exists(select 1 from jsonb_array_elements(gear) i where i->>'equipped_slot'='off_hand' and i->>'kind'='shield'),
  exists(select 1 from jsonb_array_elements(gear) i where i->>'kind'='weapon' and i->>'equipped_slot' in ('main_hand','off_hand') and i->>'model'<>'net') into shield,parry;
 result:=jsonb_build_object(
  'max_hp',round((s->>'maxHp')::numeric),'max_stamina',round((s->>'maxStamina')::numeric),
  'physical_defense',(s->>'defense')::numeric*50,'attack_speed',(s->>'attack_speed')::numeric,
  'movement_speed',(s->>'speed')::numeric,
  'critical_rate',least(35,greatest(0,coalesce((raw->>'critical_rate')::numeric,0))),
  'critical_multiplier',1+least(1.2,greatest(.1,.5+coalesce((raw->>'critical_damage')::numeric,0)/100)),
  'armor_penetration',least(60,greatest(0,coalesce((raw->>'armor_penetration')::numeric,0))),
  'critical_resistance',coalesce((raw->>'critical_resistance')::numeric,0),
  'critical_damage_reduction',greatest(0,coalesce((raw->>'critical_damage_reduction')::numeric,0)),
  'slash_resistance',least(55,greatest(0,coalesce((raw->>'damage_reduction')::numeric,0)+coalesce((raw->>'slash_resistance')::numeric,0))),
  'pierce_resistance',least(55,greatest(0,coalesce((raw->>'damage_reduction')::numeric,0)+coalesce((raw->>'pierce_resistance')::numeric,0))),
  'projectile_resistance',least(55,greatest(0,coalesce((raw->>'damage_reduction')::numeric,0)+coalesce((raw->>'projectile_resistance')::numeric,0))),
  'block_rate',case when shield then least(30,greatest(0,coalesce((raw->>'block_rate')::numeric,0))) else 0 end,
  'block_power',case when shield then least(40,greatest(0,coalesce((raw->>'block_power')::numeric,0))) else 0 end,
  'parry_rate',case when parry then least(20,greatest(0,coalesce((raw->>'parry_rate')::numeric,0))) else 0 end,
  'hp_regeneration',least(2,greatest(0,coalesce((raw->>'hp_regeneration')::numeric,0))),
  'stamina_regeneration_pve',(15.75+least(8,greatest(0,coalesce((raw->>'stamina_regeneration')::numeric,0))))*.65*food*morale,
  'stamina_regeneration_pvp',(16+least(8,greatest(0,coalesce((raw->>'stamina_regeneration')::numeric,0))))*.65*food*morale,
  'recovery_speed',1+least(.3,greatest(0,coalesce((raw->>'recovery_speed')::numeric,0)/100)));
 foreach hand in array array['main_hand','off_hand'] loop
  select i->>'model' into weapon from jsonb_array_elements(gear) i where i->>'equipped_slot'=hand and i->>'kind'='weapon' and i->>'model' in ('gladius','sica','spear','trident','mace','whip') limit 1;
  prefix:=case when hand='main_hand' then 'main' else 'off' end;
  -- PvE: normal first hit, intact arm, unarmoured chest (20 x .5 x 1.12).
  -- PvP: the live resolver uses 14 for a normal strike. Neither includes a crit.
  for mode in 0..1 loop
   base:=case when mode=0 then 11.2*case when weapon is null then .35 else 1 end else 14 end;
   result:=result||jsonb_build_object(
    prefix||case when mode=0 then '_pve_min' else '_pvp_min' end,case when hand='off_hand' and weapon is null then 0 else (private.ludus_hit_v73(a,v,coalesce(weapon,'fist'),hand,base,1,0)->>'damage')::numeric end,
    prefix||case when mode=0 then '_pve_max' else '_pvp_max' end,case when hand='off_hand' and weapon is null then 0 else (private.ludus_hit_v73(a,v,coalesce(weapon,'fist'),hand,base,1,1)->>'damage')::numeric end);
  end loop;
 end loop;
 return jsonb_build_object('values',result,'raw',raw);
end $$;

create function ludus_private.values_report_v110(g jsonb, all_gear jsonb, food jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
 neutral jsonb:=g||'{"combat_stamina_bonus":0,"combat_morale":50}';
 gear jsonb:='[]'; stages jsonb:='[]'; sources jsonb:='[]'; stage jsonb; it jsonb; stone jsonb; spec record;
 i int; phase int; j int; snapshot jsonb; previous jsonb:='{"values":{},"raw":{}}'; delta jsonb; raw_delta jsonb;
 source jsonb; final jsonb;
begin
 stages:=jsonb_build_array(jsonb_build_object('source',jsonb_build_object('kind','base'),'g',neutral||'{"level":1}','items',gear));
 if coalesce((g->>'level')::numeric,1)>1 then stages:=stages||jsonb_build_array(jsonb_build_object('source',jsonb_build_object('kind','level','level',g->'level'),'g',neutral,'items',gear));end if;
 -- Fixed ordering makes nonlinear multipliers, rounding and caps auditable.
 for phase in 1..5 loop
  for it,i in select value,(ordinality-1)::int from jsonb_array_elements(all_gear) with ordinality loop
   source:=jsonb_build_object('item_id',it->'id','slot',it->'equipped_slot','model',it->'model','name',it->'name','enhancement',it->'enhancement');
   if phase=1 then
    gear:=gear||jsonb_build_array(it||'{"enhancement":0,"natural_percentages":{},"emeralds":[],"sapphires":[],"rubies":[]}');source:=source||'{"kind":"equipment"}';
   elsif phase=2 then
    gear:=jsonb_set(gear,array[i::text,'enhancement'],coalesce(it->'enhancement','0'));source:=source||'{"kind":"enhancement"}';
   elsif phase=3 then
    for spec in select * from jsonb_each(coalesce(it->'natural_percentages','{}')) order by key loop
     gear:=jsonb_set(gear,array[i::text,'natural_percentages',spec.key],spec.value);
     stages:=stages||jsonb_build_array(jsonb_build_object('source',source||jsonb_build_object('kind','sapphire','stat',spec.key,'percent',spec.value),'g',neutral,'items',gear));
    end loop;continue;
   elsif phase=4 then
    for stone in select value from jsonb_array_elements(coalesce(it->'emeralds','[]')) loop
     gear:=jsonb_set(gear,array[i::text,'emeralds'],gear->i->'emeralds'||jsonb_build_array(stone));
     stages:=stages||jsonb_build_array(jsonb_build_object('source',source||jsonb_build_object('kind','emerald','stone',stone->'id','percent',stone->'value'),'g',neutral,'items',gear));
    end loop;continue;
   else
    if coalesce((it->>'stat_version')::int,0)=10 then continue;end if;
    gear:=jsonb_set(jsonb_set(gear,array[i::text,'sapphires'],coalesce(it->'sapphires','[]')),array[i::text,'rubies'],coalesce(it->'rubies','[]'));source:=source||'{"kind":"legacy_stones"}';
   end if;
   stages:=stages||jsonb_build_array(jsonb_build_object('source',source,'g',neutral,'items',gear));
  end loop;
 end loop;
 stages:=stages||jsonb_build_array(
  jsonb_build_object('source',jsonb_build_object('kind','food','percent',food->'combat_stamina_bonus'),'g',neutral||jsonb_build_object('combat_stamina_bonus',food->'combat_stamina_bonus'),'items',gear),
  jsonb_build_object('source',jsonb_build_object('kind','morale','morale',food->'combat_morale'),'g',g||food,'items',gear));
 for stage in select value from jsonb_array_elements(stages) loop
  snapshot:=ludus_private.values_snapshot_v110(stage->'g',stage->'items');
  select coalesce(jsonb_object_agg(key,value::numeric-coalesce((previous->'values'->>key)::numeric,0)),'{}') into delta
   from jsonb_each_text(snapshot->'values') where abs(value::numeric-coalesce((previous->'values'->>key)::numeric,0))>.000000001;
  select coalesce(jsonb_object_agg(key,value::numeric-coalesce((previous->'raw'->>key)::numeric,0)),'{}') into raw_delta
   from jsonb_each_text(snapshot->'raw') where abs(value::numeric-coalesce((previous->'raw'->>key)::numeric,0))>.000000001;
  if delta<>'{}' or raw_delta<>'{}' or stage->'source'->>'kind' in ('food','morale') then
   sources:=sources||jsonb_build_array(stage->'source'||jsonb_build_object('delta',delta,'raw',raw_delta));
  end if;
  previous:=snapshot;
 end loop;
 final:=ludus_private.values_snapshot_v110(g||food,all_gear);
 return jsonb_build_object('totals',final->'values','raw',final->'raw','sources',sources,'food',food);
end $$;

create function ludus_private.combat_values_v110(p_gladiator uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();g jsonb;gear jsonb;food jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
 select to_jsonb(x) into g from public.ludus_gladiators x where id=p_gladiator and owner_id=u;
 if g is null then raise exception 'Gladyatör bulunamadı.' using errcode='42501';end if;
 -- Uses the same completed menu snapshot as arena entry, including midnight settlement.
 food:=ludus_food_private.combat_snapshot_v77(u);
 -- The food snapshot holds the owner's account lock, also used by gear/training writes.
 select to_jsonb(x) into g from public.ludus_gladiators x where id=p_gladiator and owner_id=u;
 if g is null then raise exception 'Gladyatör bulunamadı.' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(i) order by case equipped_slot when 'main_hand' then 1 when 'off_hand' then 2 when 'helmet' then 3 when 'chest' then 4 when 'gloves' then 5 else 6 end,id),'[]') into gear
  from public.ludus_items i where owner_id=u and equipped_by=p_gladiator;
 return ludus_private.values_report_v110(g,gear,food)||jsonb_build_object(
  'owner_id',u,'gladiator',jsonb_build_object('id',g->'id','name',g->'name','class',g->'class','level',g->'level','overall',g->'overall','base_stats',g->'base_stats'),
  'items',gear,'server_now',clock_timestamp(),'valid_until',((clock_timestamp() at time zone 'Europe/Istanbul')::date+1)::timestamp at time zone 'Europe/Istanbul');
end $$;

revoke all on function ludus_private.values_snapshot_v110(jsonb,jsonb),ludus_private.values_report_v110(jsonb,jsonb,jsonb),ludus_private.combat_values_v110(uuid) from public,anon,authenticated;
grant usage on schema ludus_private to authenticated;
grant execute on function ludus_private.combat_values_v110(uuid) to authenticated;
create function public.ludus_combat_values(p_gladiator uuid)
returns jsonb language sql security invoker set search_path='' as $$select ludus_private.combat_values_v110(p_gladiator)$$;
revoke all on function public.ludus_combat_values(uuid) from public,anon;
grant execute on function public.ludus_combat_values(uuid) to authenticated;
