-- V168: shared taxonomy, two directly craftable weapons and server-owned shield impacts.
-- No currency/stock grants; damaged shields remain inventory items after the battle.
alter table public.ludus_shop_catalog add column if not exists subcategory text;
update public.ludus_shop_catalog set subcategory=case
 when kind='weapon' and model in('gladius','sica','scissor') then 'swords'
 when kind='weapon' and model in('trident','spear') then 'polearms'
 when kind='weapon' and model in('mace','heavy_mace','warhammer') then 'blunt'
 when kind='weapon' and model in('net','whip') then 'flexible'
 when kind='shield' and model='large' then 'large_shields'
 when kind='shield' and model in('small','round','medium') then 'small_medium_shields'
 else subcategory end where kind in('weapon','shield');
insert into public.ludus_shop_catalog(sku,category,name,kind,model,price,subcategory) values
 ('heavy_mace','Silahlar','Ağır gürz','weapon','heavy_mace',100,'blunt'),
 ('warhammer','Silahlar','Savaş çekici','weapon','warhammer',100,'blunt')
 on conflict(sku)do update set name=excluded.name,kind=excluded.kind,model=excluded.model,subcategory=excluded.subcategory;
insert into ludus_supply_private.production_recipes_v118(sku,name,kind,model,ingredients,output_type,output_quantity,sort_order) values
 ('heavy_mace','Ağır gürz','weapon','heavy_mace','{"steel":3,"bronze":1,"wood":2,"leather":1,"resin":1}','equipment',1,235),
 ('warhammer','Savaş çekici','weapon','warhammer','{"steel":4,"bronze":1,"wood":2,"leather":2,"resin":1}','equipment',1,236)
 on conflict(sku)do update set name=excluded.name,ingredients=excluded.ingredients,output_quantity=1;
insert into ludus_supply_private.recipes(sku,ingredients)
 select sku,ingredients from ludus_supply_private.production_recipes_v118 where sku in('heavy_mace','warhammer')
 on conflict(sku)do update set ingredients=excluded.ingredients;

-- Expand only the existing model allowlists, retaining every ownership and busy-state check.
do $migration$
declare f record;body text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in('ludus_start_battle_v2','ludus_finish_battle_v2','ludus_equip_item'))
 or (n.nspname='ludus_private' and p.proname='values_snapshot_v110') loop
 body:=pg_get_functiondef(f.oid);
 body:=replace(body,'''gladius'',''sica'',''spear'',''trident'',''mace'',''whip''','''gladius'',''sica'',''spear'',''trident'',''mace'',''whip'',''heavy_mace'',''warhammer''');
 execute body;
 end loop;
 -- Timings are authoritative and match ArenaMotion.
 select pg_get_functiondef('public.ludus_match(text,uuid,uuid,jsonb,jsonb)'::regprocedure) into body;
 if position('when ''warhammer'' then .44' in body)=0 then
 body:=replace(body,'when ''mace'' then .40','when ''heavy_mace'' then .40 when ''warhammer'' then .44 when ''mace'' then .40');
 body:=replace(body,'when ''mace'' then .26','when ''heavy_mace'' then .26 when ''warhammer'' then .26 when ''mace'' then .26');
 body:=replace(body,'when ''mace'' then .56','when ''heavy_mace'' then .56 when ''warhammer'' then .60 when ''mace'' then .56');
 end if;
 if position('when ''warhammer'' then .44' in body)=0 then raise exception 'Unexpected combat timing definition';end if;
 execute body;
end;$migration$;

create or replace function private.ludus_shield_impact_v168(v jsonb,weapon text)
returns jsonb language plpgsql set search_path='' as $$
declare shield jsonb;gear jsonb;hits int;stats jsonb;
begin
 if weapon not in('mace','heavy_mace','warhammer') then return v;end if;
 select value into shield from jsonb_array_elements(v->'items') where value->>'kind'='shield' and value->>'equipped_slot'='off_hand' limit 1;
 if shield is null then return v;end if;
 hits:=coalesce((shield->>'breaker_hits_v168')::int,0)+1;
 if hits<2 then
  select jsonb_agg(case when value=shield then value||jsonb_build_object('breaker_hits_v168',hits)else value end)into gear from jsonb_array_elements(v->'items');
  return v||jsonb_build_object('items',gear);
 end if;
 select coalesce(jsonb_agg(value),'[]'::jsonb)into gear from jsonb_array_elements(v->'items')where value<>shield;
 stats:=private.ludus_combat_stats_v73(v->'gladiator',gear);
 return v||jsonb_build_object('items',gear,'broken_items',coalesce(v->'broken_items','[]'::jsonb)||jsonb_build_array(shield),
  'combat_stats',stats,'block',false,'guard_at',null,'gear_serial',coalesce((v->>'gear_serial')::int,0)+1,
  'shield_broken',true,'maxHp',(stats->>'maxHp')::numeric,'maxStamina',(stats->>'maxStamina')::numeric,
  'hp',least((v->>'hp')::numeric,(stats->>'maxHp')::numeric),'stamina',least((v->>'stamina')::numeric,(stats->>'maxStamina')::numeric));
end;$$;
revoke all on function private.ludus_shield_impact_v168(jsonb,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.ludus_resolve_combat_v36(p_players jsonb, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 players jsonb:=p_players; a jsonb; v jsonb; ai integer; vi integer; impact timestamptz;
 distance double precision; facing double precision; guard_facing double precision; reach double precision;
 perfect boolean; guarded boolean; amount integer; outcome text; weapon text; passive text; cost numeric; recoil float; hit jsonb; modern boolean;
begin
 -- Old, already due strikes resolve before accepting the next input. Defense cannot be backdated.
 for ai in select (ord-1)::int from jsonb_array_elements(p_players) with ordinality e(f,ord)
  where f->>'strike_at' is not null and (f->>'strike_at')::timestamptz<=p_now
  order by (f->>'strike_at')::timestamptz,ord loop
  a:=players->ai; impact:=(a->>'strike_at')::timestamptz;
  if impact is null or (a->>'hp')::int<=0 then continue; end if;
  a:=a||jsonb_build_object('strike_at',null,'strike_resolved',true); outcome:='miss';
  if coalesce((a->>'stagger_until')::timestamptz,'epoch')>impact or a->>'pull_from' is not null then
   players:=jsonb_set(players,array[ai::text],a); continue;
  end if;
  select (ord-1)::int into vi from jsonb_array_elements(players) with ordinality e(f,ord)
   where f->>'owner'=a->>'strike_target' and (f->>'hp')::int>0;
  if found then
   v:=players->vi; weapon:=a->>'strike_weapon';
   reach:=case weapon when 'spear' then 2.50 when 'trident' then 2.50 when 'heavy_mace' then 1.95 when 'warhammer' then 1.95 when 'mace' then 1.95 when 'whip' then 1.90 when 'gladius' then 1.60 when 'sica' then 1.60 else 1.10 end;
   distance:=sqrt(power((a->>'x')::float-(v->>'x')::float,2)+power((a->>'z')::float-(v->>'z')::float,2));
   facing:=atan2((v->>'x')::float-(a->>'x')::float,(v->>'z')::float-(a->>'z')::float)-(a->>'angle')::float;
   facing:=abs(atan2(sin(facing),cos(facing)));
   if distance<=reach and facing<=1.05 and not private.ludus_evade_avoids_v163(v,impact,coalesce(a->>'strike_region','chest')) then
    guard_facing:=atan2((a->>'x')::float-(v->>'x')::float,(a->>'z')::float-(v->>'z')::float)-(v->>'angle')::float;
    guarded:=coalesce((v->>'stamina')::float,100)>0 and coalesce((v->>'block')::boolean,false) and abs(atan2(sin(guard_facing),cos(guard_facing)))<1.35
     and exists(select 1 from jsonb_array_elements(v->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='shield');
    perfect:=guarded and v->>'guard_at' is not null and extract(epoch from impact-(v->>'guard_at')::timestamptz) between 0 and .24;
    modern:=coalesce((v->>'stats_version')::int,0) in (73,74,75,76,77);
    cost:=case when perfect then 6 else 20 end; passive:='none';
    if modern and guarded and coalesce((v->>'stamina')::numeric,100)<cost then
     guarded:=false;perfect:=false;v:=v||jsonb_build_object('stamina',0,'block',false,'guard_at',null);
    end if;
    if modern and not guarded then
     passive:=private.ludus_passive_defense_v73(v,impact,abs(atan2(sin(guard_facing),cos(guard_facing)))<1.1,random()::numeric,random()::numeric,random()::numeric);
     if passive='autoblock' then guarded:=true;perfect:=false;cost:=20;end if;
    end if;
    if passive='evade' then
     outcome:='evade';
     v:=v||jsonb_build_object('defense_serial',coalesce((v->>'defense_serial')::int,0)+1,'last_defense','evade','defense_from',a->>'owner','defense_at',p_now);
    elsif guarded or passive='parry' then
     outcome:=case when perfect then 'perfect' when passive='parry' then 'parry' else 'block' end;
     if modern then
      cost:=case when passive='parry' then 6 else cost*(1-least(.4,greatest(0,coalesce((v->'combat_stats'->'items'->>'block_power')::numeric,0)/100))) end;
      v:=v||jsonb_build_object('stamina',greatest(0,coalesce((v->>'stamina')::numeric,100)-cost),'stamina_regen_at',p_now+interval '900 milliseconds');
     end if;
     recoil:=case when perfect then .62/(1+greatest(0,least(.3,coalesce((a->'combat_stats'->'items'->>'recovery_speed')::float,0)/100))) else .23 end;
     if not perfect and coalesce((a->>'stats_version')::int,0)>=75 then recoil:=recoil/(1+greatest(0,least(.3,coalesce((a->'combat_stats'->'items'->>'recovery_speed')::float,0)/100)));end if;
     a:=a||jsonb_build_object('recoil_at',p_now,'recoil_elapsed',greatest(0,extract(epoch from impact-(a->>'swing_at')::timestamptz)),
      'recoil_until',p_now+recoil*interval '1 second',
      'cooldown_until',p_now+recoil*interval '1 second',
      'stagger_until',case when perfect then p_now+recoil*interval '1 second' else null end,'swing_end',p_now);
     v:=v||jsonb_build_object('defense_serial',coalesce((v->>'defense_serial')::int,0)+1,'last_defense',outcome,'defense_from',a->>'owner','defense_at',p_now);
     if guarded and passive<>'parry' then v:=private.ludus_shield_impact_v168(v,weapon);end if;
     if perfect then v:=v||jsonb_build_object('guard_at',null,'counter_until',p_now+interval '700 milliseconds','counter_target',a->>'owner'); end if;
    else
     amount:=case when coalesce((a->>'strike_counter')::boolean,false) then 17 else 14 end;
     outcome:=case when amount=17 then 'counter' else 'hit' end;
     if coalesce((a->>'stats_version')::int,0) in (73,74,75,76,77) then
      hit:=private.ludus_hit_v73(a,v,weapon,coalesce(a->>'strike_hand','main_hand'),amount,random()::numeric,random()::numeric);
      amount:=(hit->>'damage')::int;
      if (hit->>'critical')::boolean then outcome:='critical';end if;
     end if;
     hit:=ludus_career_private.hit(a,v,amount);a:=hit->0;v:=hit->1;
     v:=v||jsonb_build_object('hp',greatest(0,(v->>'hp')::int-amount),'hit_serial',coalesce((v->>'hit_serial')::int,0)+1,'hit_from',a->>'owner','hit_time',p_now,'hit_impact_at',impact,'hit_region',coalesce(a->>'strike_region','chest'),'block',false,'guard_at',null);
     if weapon in('spear','trident') then
      recoil:=greatest(.28,coalesce((a->>'recover')::float,.48));
      a:=a||jsonb_build_object('recoil_at',p_now,'recoil_elapsed',greatest(0,extract(epoch from impact-(a->>'swing_at')::timestamptz)),'recoil_until',p_now+recoil*interval '1 second','swing_end',p_now,'cooldown_until',p_now+recoil*interval '1 second');
     end if;
    end if;
    players:=jsonb_set(players,array[vi::text],v);
   end if;
  end if;
  -- V114: a missed strike has to return to guard before another strike starts.
  if outcome in ('miss','evade') then
   a:=a||jsonb_build_object('recover',coalesce((a->>'recover')::numeric,0)+.14,
    'swing_end',coalesce((a->>'swing_end')::timestamptz,impact)+interval '140 milliseconds',
    'cooldown_until',coalesce((a->>'cooldown_until')::timestamptz,impact)+interval '140 milliseconds');
  end if;
  a:=a||jsonb_build_object('attack_result',outcome);players:=jsonb_set(players,array[ai::text],a);
 end loop;
 return players;
end; $function$
;


-- Newly created caravan battles opt in; existing encounter JSON is unchanged.
CREATE OR REPLACE FUNCTION ludus_supply_private.encounter_v126(jid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare j ludus_supply_private.raids_v124;choices text[];n integer;frozen_team jsonb;
begin
 select * into j from ludus_supply_private.raids_v124 where id=jid for update;
 if j.encounter is not null or j.resolved_at is not null then return;end if;
 insert into ludus_supply_private.raid_counter_v126(owner_id,attempt)values(j.owner_id,1)
 on conflict(owner_id)do update set attempt=ludus_supply_private.raid_counter_v126.attempt+1 returning attempt into n;
 select r.choices into choices from ludus_supply_private.raid_regions_v124 r where r.id=j.region;
 select jsonb_agg((to_jsonb(g)-'owner_id')||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.equipped_by=g.id and i.owner_id=j.owner_id),'[]'::jsonb),
 'weapons',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.equipped_by=g.id and i.owner_id=j.owner_id and i.kind='weapon'),'[]'::jsonb))order by array_position(j.gladiators,g.id))into frozen_team
 from public.ludus_gladiators g where g.owner_id=j.owner_id and g.id=any(j.gladiators);
 update ludus_supply_private.raids_v124 set team=frozen_team,ends_at=greatest(started_at,clock_timestamp()),encounter=jsonb_build_object(
 'version',126,'rules',168,'attempt',n,'seed',1+floor(random()*2147483646)::integer,'guards',cardinality(j.gladiators)+case when n%4=0 then 1 else 0 end,
 'archers',1,'cargo',choices[1+floor(random()*3)::integer],'quantity',60)where id=jid;
end;$function$

;
