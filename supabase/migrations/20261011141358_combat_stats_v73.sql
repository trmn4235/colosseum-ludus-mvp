-- V73: gladiator, enhancement, sapphire and emerald effects in authoritative matches.
-- Existing matches retain their V36 rules. New queues only combine V73 snapshots.
-- Based on the live V60 food / V46 eligibility definitions, not the older V36 file.
begin;
-- V73: server-owned snapshots. No client-submitted stats are read.
create or replace function private.ludus_item_stats_v73(p_item jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
 result jsonb:='{}'; allowed text[]; kv record; socket jsonb; idx int; value numeric;
 emerald_keys text[]:=array['max_hp','hp_regeneration','max_stamina','stamina_regeneration','physical_power','critical_rate','critical_damage','armor_penetration','minimum_damage','physical_defense','parry_rate','block_rate','critical_damage_reduction','movement_speed','attack_speed'];
 emerald_power numeric[]:=array[20,.5,20,3,7,3,8,5,10,5,4,4,8,4,4];
begin
 if coalesce((p_item->>'stat_version')::int,0)<>10 then return result;end if;
 allowed:=case when p_item->>'kind' in('weapon','shield') then array['physical_power','critical_rate','critical_damage','block_rate','block_power','armor_penetration']
 when p_item->>'kind' in('helmet','chest') then array['physical_defense','damage_reduction','critical_resistance','pierce_resistance','slash_resistance','projectile_resistance']
 when p_item->>'kind' in('gloves','legs') then array['acceleration','movement_speed','dodge_rate','recovery_speed','turn_speed','dodge_distance'] else array[]::text[] end;
 for kv in select * from jsonb_each_text(coalesce(p_item->'natural_stats','{}')) loop
  if kv.key=any(allowed) then
   value:=greatest(0,kv.value::numeric)*(1+.1*greatest(0,coalesce((p_item->>'enhancement')::numeric,0)))
    *(1+greatest(0,coalesce((p_item->'natural_percentages'->>kv.key)::numeric,0))/100);
   result:=result||jsonb_build_object(kv.key,value);
  end if;
 end loop;
 for socket in select e.value from jsonb_array_elements(coalesce(p_item->'emeralds','[]')) e loop
  idx:=(socket->>'id')::int;
  if idx between 1 and 15 then
   value:=emerald_power[idx]*coalesce((socket->>'value')::numeric,0)/100;
   result:=result||jsonb_build_object(emerald_keys[idx],coalesce((result->>emerald_keys[idx])::numeric,0)+value);
  end if;
 end loop;
 return result;
end; $$;

create or replace function private.ludus_combat_stats_v73(p_gladiator jsonb,p_items jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
 g jsonb:=p_gladiator; attr jsonb; native jsonb; total jsonb:='{}'; it jsonb; stone jsonb; kv record;
 old_profiles jsonb:='{"murmillo":[60,55,50,60,35,40],"thraex":[45,50,60,35,60,50],"hoplomachus":[50,55,50,45,45,55],"secutor":[55,55,50,55,40,45],"retiarius":[40,55,45,30,65,65],"provocator":[65,60,45,65,30,35],"scissor":[50,50,60,40,55,45]}';
 old_keys text[]:=array['health','stamina','strength','defense','agility','speed']; a jsonb; i int;
 scale numeric:=1+.01*greatest(0,coalesce((p_gladiator->>'level')::numeric,1)-1); value numeric;
begin
 if (g->>'stat_version')::int=46 then
  attr:=coalesce(g->'base_stats',ludus_private.exercise_profile_v46(g->>'class'));
  native:=jsonb_build_object('health',coalesce((attr->>'conditioning')::numeric,50),'stamina',coalesce((attr->>'conditioning')::numeric,50),
   'strength',.6*coalesce((attr->>'muscle')::numeric,50)+.25*coalesce((attr->>'attack_technique')::numeric,50)+.15*coalesce((attr->>'tactics')::numeric,50),
   'defense',.75*coalesce((attr->>'defense_technique')::numeric,50)+.25*coalesce((attr->>'tactics')::numeric,50),
   'agility',coalesce((attr->>'reflex')::numeric,50),'speed',coalesce((attr->>'speed')::numeric,50));
 else
  native:='{}';a:=coalesce(old_profiles->(g->>'class'),old_profiles->'secutor');
  for i in 1..6 loop
   value:=case when (g->>'stat_version')::int=7 then coalesce((g->'base_stats'->>old_keys[i])::numeric,50) else (a->>(i-1))::numeric end;
   native:=native||jsonb_build_object(old_keys[i],value*coalesce((g->>'overall')::numeric,50)/50);
  end loop;
 end if;
 for it in select e.value from jsonb_array_elements(coalesce(p_items,'[]')) e loop
  if coalesce((it->>'stat_version')::int,0)=10 then
   for kv in select * from jsonb_each_text(private.ludus_item_stats_v73(it)) loop
    total:=total||jsonb_build_object(kv.key,coalesce((total->>kv.key)::numeric,0)+kv.value::numeric);
   end loop;
  else
   for kv in select * from jsonb_each_text(coalesce(it->'base_stats','{}')) loop
    if kv.key=any(old_keys) then native:=native||jsonb_build_object(kv.key,coalesce((native->>kv.key)::numeric,0)+kv.value::numeric*(1+.05*coalesce((it->>'enhancement')::numeric,0)));end if;
   end loop;
   for stone in select e.value from jsonb_array_elements(coalesce(it->'sapphires','[]')||coalesce(it->'rubies','[]')) e loop
    if jsonb_typeof(stone)='object' and stone->>'stat'=any(old_keys) then
     value:=coalesce((native->>(stone->>'stat'))::numeric,0);
     native:=native||jsonb_build_object(stone->>'stat',value+case when coalesce((stone->>'percent')::boolean,false) then value*(stone->>'value')::numeric/100 else (stone->>'value')::numeric end);
    end if;
   end loop;
  end if;
 end loop;
 return jsonb_build_object(
  'items',total,'native_attack',(native->>'strength')::numeric/50*scale,
  'attack',(native->>'strength')::numeric/50*scale+least(50,greatest(0,coalesce((total->>'physical_power')::numeric,0)))/50,
  'defense',greatest(.1,(native->>'defense')::numeric/50)+least(50,greatest(0,coalesce((total->>'physical_defense')::numeric,0)))/50,
  'speed',greatest(.1,(native->>'speed')::numeric/50)*(1+least(.3,greatest(0,coalesce((total->>'movement_speed')::numeric,0)/100))),
  'agility',(native->>'agility')::numeric,
  'attack_speed',greatest(.7,least(1.3,(native->>'agility')::numeric/50))*(1+least(.25,greatest(0,coalesce((total->>'attack_speed')::numeric,0)/100))),
  'maxHp',greatest(1,round((native->>'health')::numeric*2*scale))+least(120,greatest(0,coalesce((total->>'max_hp')::numeric,0))),
  'maxStamina',greatest(1,round((native->>'stamina')::numeric*2*scale))+least(100,greatest(0,coalesce((total->>'max_stamina')::numeric,0))));
end; $$;

create or replace function private.ludus_hit_v73(p_attacker jsonb,p_victim jsonb,p_weapon text,p_hand text,p_base numeric,p_critical_roll numeric,p_damage_roll numeric,p_projectile boolean default false)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
 a jsonb:=p_attacker->'combat_stats';v jsonb:=p_victim->'combat_stats';s jsonb:=a->'items';t jsonb:=v->'items';held jsonb;
 attack numeric:=coalesce((a->>'attack')::numeric,1);defense numeric:=coalesce((v->>'defense')::numeric,1);power numeric;resistance numeric;amount numeric;critical boolean;
begin
 select value into held from jsonb_array_elements(coalesce(p_attacker->'items','[]')) where value->>'equipped_slot'=p_hand and value->>'kind'='weapon';
 if (held->>'stat_version')::int=10 then
  power:=coalesce((private.ludus_item_stats_v73(held)->>'physical_power')::numeric,0);
  attack:=(coalesce((a->>'native_attack')::numeric,1)+greatest(0,least(50,coalesce((s->>'physical_power')::numeric,0)-power))/50)*greatest(.01,power/7);
 end if;
 defense:=greatest(.1,defense-least(50,greatest(0,coalesce((t->>'physical_defense')::numeric,0)))/50*least(.6,greatest(0,coalesce((s->>'armor_penetration')::numeric,0)/100)));
 resistance:=coalesce((t->>'damage_reduction')::numeric,0)+coalesce((t->>case when p_projectile then 'projectile_resistance' when p_weapon in('spear','trident','scissor') then 'pierce_resistance' else 'slash_resistance' end)::numeric,0);
 amount:=p_base*attack/defense*(1-least(.55,greatest(0,resistance/100)))*least(1,greatest(.8,.8+p_damage_roll*.2+coalesce((s->>'minimum_damage')::numeric,0)/100));
 critical:=p_critical_roll<greatest(0,least(.35,(coalesce((s->>'critical_rate')::numeric,0)-coalesce((t->>'critical_resistance')::numeric,0))/100));
 if critical then amount:=amount*(1+greatest(.1,least(1.2,.5+(coalesce((s->>'critical_damage')::numeric,0)-coalesce((t->>'critical_damage_reduction')::numeric,0))/100)));end if;
 return jsonb_build_object('damage',greatest(1,round(amount)),'critical',critical);
end; $$;

create or replace function private.ludus_passive_defense_v73(p_victim jsonb,p_impact timestamptz,p_front boolean,p_parry_roll numeric,p_block_roll numeric,p_dodge_roll numeric)
returns text language plpgsql immutable set search_path='' as $$
declare s jsonb:=p_victim->'combat_stats'->'items';energy numeric:=coalesce((p_victim->>'stamina')::numeric,100);
begin
 if coalesce((p_victim->>'block')::boolean,false) or p_victim->>'pull_from' is not null
  or coalesce((p_victim->>'swing_end')::timestamptz,'epoch')>p_impact
  or coalesce((p_victim->>'recoil_until')::timestamptz,'epoch')>p_impact
  or coalesce((p_victim->>'stagger_until')::timestamptz,'epoch')>p_impact
  or coalesce((p_victim->>'dodge_until')::timestamptz,'epoch')>p_impact then return 'none';end if;
 if p_front then
  if energy>=6 and p_parry_roll<greatest(0,least(.2,coalesce((s->>'parry_rate')::numeric,0)/100))
   and exists(select 1 from jsonb_array_elements(coalesce(p_victim->'items','[]')) it where it->>'kind'='weapon' and it->>'equipped_slot' in('main_hand','off_hand') and it->>'model'<>'net') then return 'parry';end if;
  if energy>=20 and p_block_roll<greatest(0,least(.3,coalesce((s->>'block_rate')::numeric,0)/100))
   and exists(select 1 from jsonb_array_elements(coalesce(p_victim->'items','[]')) it where it->>'kind'='shield' and it->>'equipped_slot'='off_hand') then return 'autoblock';end if;
 end if;
 if p_dodge_roll<greatest(0,least(.2,coalesce((s->>'dodge_rate')::numeric,0)/100)) then return 'evade';end if;
 return 'none';
end; $$;

revoke all on function private.ludus_item_stats_v73(jsonb),private.ludus_combat_stats_v73(jsonb,jsonb),
 private.ludus_hit_v73(jsonb,jsonb,text,text,numeric,numeric,numeric,boolean),
 private.ludus_passive_defense_v73(jsonb,timestamptz,boolean,numeric,numeric,numeric) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION private.ludus_advance_combat_v36(p_players jsonb, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 arr jsonb:='[]'; p jsonb; energy float; dt float; tick timestamptz; finish timestamptz; px float; pz float; len float; cap float; health_cap int; fraction float; healed int; extra jsonb; modern boolean;
begin
 for p in select value from jsonb_array_elements(p_players) loop
  if coalesce((p->>'hp')::int,0)>0 then
   modern:=coalesce((p->>'stats_version')::int,0)=73;
   extra:=case when modern then p->'combat_stats'->'items' else '{}'::jsonb end;
   cap:=case when modern then greatest(1,coalesce((p->>'maxStamina')::float,100)) else 100 end;
   health_cap:=greatest(1,coalesce((p->>'maxHp')::int,100));
   tick:=coalesce((p->>'stamina_at')::timestamptz,p_now);
   dt:=greatest(0,least(2,extract(epoch from p_now-tick)));
   energy:=least(cap,greatest(0,coalesce((p->>'stamina')::float,cap)));
   if coalesce((p->>'block')::boolean,false) then energy:=greatest(0,energy-dt*2);
   elsif coalesce((p->>'swing_end')::timestamptz,'epoch')<=p_now and coalesce((p->>'dodge_until')::timestamptz,'epoch')<=p_now
    and (not modern or (p->>'pull_from' is null and coalesce((p->>'stagger_until')::timestamptz,'epoch')<=p_now and coalesce((p->>'recoil_until')::timestamptz,'epoch')<=p_now)) then
    dt:=greatest(0,least(dt,extract(epoch from p_now-greatest(tick,coalesce((p->>'stamina_regen_at')::timestamptz,tick)))));
    energy:=least(cap,energy+dt*(16+greatest(0,least(8,coalesce((extra->>'stamina_regeneration')::float,0))))*.65*(1+least(12,greatest(0,coalesce((p->'gladiator'->>'combat_stamina_bonus')::numeric,0)))/100));
    if modern then
     -- Keep fractional healing between ticks; hp remains an integer for existing clients.
     fraction:=coalesce((p->>'hp_regen_fraction')::float,0)+dt*greatest(0,least(2,coalesce((extra->>'hp_regeneration')::float,0)));
     healed:=least(health_cap,(p->>'hp')::int+floor(fraction)::int);
     p:=p||jsonb_build_object('hp',healed,'hp_regen_fraction',case when healed>=health_cap then 0 else fraction-floor(fraction) end);
    end if;
   end if;
   p:=p||jsonb_build_object('stamina',energy,'maxStamina',cap,'stamina_at',p_now);
   if energy<=0 then p:=p||jsonb_build_object('block',false,'guard_at',null); end if;
   if p->>'dodge_until' is not null and p->>'dodge_tick_at' is not null then
    finish:=least(p_now,(p->>'dodge_until')::timestamptz);
    dt:=greatest(0,least(.46,extract(epoch from finish-(p->>'dodge_tick_at')::timestamptz)));
    if dt>0 and p->>'pull_from' is null then
     px:=(p->>'x')::float+coalesce((p->>'dodge_dx')::float,0)*7.5*dt*(1+greatest(0,least(.25,coalesce((extra->>'dodge_distance')::float,0)/100)));pz:=(p->>'z')::float+coalesce((p->>'dodge_dz')::float,0)*7.5*dt*(1+greatest(0,least(.25,coalesce((extra->>'dodge_distance')::float,0)/100)));
     len:=greatest(1,sqrt(px*px+pz*pz)/10.5);
     p:=p||jsonb_build_object('x',px/len,'z',pz/len,'move',0,'block',false,'dodge_tick_at',finish);
    end if;
   end if;
  end if;
  arr:=arr||jsonb_build_array(p);
 end loop;
 return arr;
end; $function$;
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
   reach:=case weapon when 'spear' then 2.65 when 'trident' then 2.55 when 'mace' then 1.95 when 'whip' then 1.90 when 'gladius' then 1.85 when 'sica' then 1.85 else 1.10 end;
   distance:=sqrt(power((a->>'x')::float-(v->>'x')::float,2)+power((a->>'z')::float-(v->>'z')::float,2));
   facing:=atan2((v->>'x')::float-(a->>'x')::float,(v->>'z')::float-(a->>'z')::float)-(a->>'angle')::float;
   facing:=abs(atan2(sin(facing),cos(facing)));
   if distance<=reach and facing<=1.05 and not (coalesce((v->>'dodge_at')::timestamptz,'epoch')<=impact and coalesce((v->>'dodge_at')::timestamptz,'epoch')+interval '370 milliseconds'>impact) then
    guard_facing:=atan2((a->>'x')::float-(v->>'x')::float,(a->>'z')::float-(v->>'z')::float)-(v->>'angle')::float;
    guarded:=coalesce((v->>'stamina')::float,100)>0 and coalesce((v->>'block')::boolean,false) and abs(atan2(sin(guard_facing),cos(guard_facing)))<1.35
     and exists(select 1 from jsonb_array_elements(v->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='shield');
    perfect:=guarded and v->>'guard_at' is not null and extract(epoch from impact-(v->>'guard_at')::timestamptz) between 0 and .24;
    modern:=coalesce((v->>'stats_version')::int,0)=73;
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
     a:=a||jsonb_build_object('recoil_at',p_now,'recoil_elapsed',greatest(0,extract(epoch from impact-(a->>'swing_at')::timestamptz)),
      'recoil_until',p_now+recoil*interval '1 second',
      'cooldown_until',p_now+recoil*interval '1 second',
      'stagger_until',case when perfect then p_now+recoil*interval '1 second' else null end,'swing_end',p_now);
     v:=v||jsonb_build_object('defense_serial',coalesce((v->>'defense_serial')::int,0)+1,'last_defense',outcome,'defense_from',a->>'owner','defense_at',p_now);
     if perfect then v:=v||jsonb_build_object('guard_at',null,'counter_until',p_now+interval '700 milliseconds','counter_target',a->>'owner'); end if;
    else
     amount:=case when coalesce((a->>'strike_counter')::boolean,false) then 17 else 14 end;
     outcome:=case when amount=17 then 'counter' else 'hit' end;
     if coalesce((a->>'stats_version')::int,0)=73 then
      hit:=private.ludus_hit_v73(a,v,weapon,coalesce(a->>'strike_hand','main_hand'),amount,random()::numeric,random()::numeric);
      amount:=(hit->>'damage')::int;
      if (hit->>'critical')::boolean then outcome:='critical';end if;
     end if;
     v:=v||jsonb_build_object('hp',greatest(0,(v->>'hp')::int-amount),'hit_serial',coalesce((v->>'hit_serial')::int,0)+1,'hit_from',a->>'owner','hit_time',p_now,'hit_region',coalesce(a->>'strike_region','chest'),'block',false,'guard_at',null);
    end if;
    players:=jsonb_set(players,array[vi::text],v);
   end if;
  end if;
  a:=a||jsonb_build_object('attack_result',outcome);players:=jsonb_set(players,array[ai::text],a);
 end loop;
 return players;
end; $function$;
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
 wind double precision; active double precision; recover double precision; command_id text; wants_guard boolean; guard_eligible boolean; counter boolean; strike boolean; whip boolean; hp integer; last_hit timestamptz; win uuid; selected_weapon text; wanted text; dodge_command text; dodging boolean; dodge_eligible boolean; attack_region text; selected_hand text; stats jsonb; speed_factor float; turn float; wanted_angle float;
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
   own:=jsonb_build_object('owner',u,'name',g.name,'class',g.class,'gladiator',to_jsonb(g)||jsonb_build_object('combat_stamina_bonus',ludus_food_private.combat_bonus_v60(u)),'items',gear,'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'maxStamina',100,'stamina',100,'stamina_at',ts,'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0);
   stats:=private.ludus_combat_stats_v73(own->'gladiator',gear);
   own:=own||jsonb_build_object('stats_version',73,'combat_stats',stats,'hp',(stats->>'maxHp')::numeric::int,'maxHp',(stats->>'maxHp')::numeric::int,'stamina',(stats->>'maxStamina')::numeric::int,'maxStamina',(stats->>'maxStamina')::numeric::int);
   select m.* into r from public.ludus_matches m where m.status='waiting' and not exists(select 1 from jsonb_array_elements(m.players) f where coalesce((f->>'stats_version')::int,0)<>73) and m.starts_at>ts and m.updated_at>ts-interval '30 seconds' order by m.created_at limit 1 for update;
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
   if coalesce((own->>'stats_version')::int,0)=73 then
    stats:=own->'combat_stats';
    speed_factor:=case when sqrt(mx*mx+mz*mz)>.001 and radius>0 and own->>'pull_from' is null and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
     then least(1,coalesce((own->>'acceleration_progress')::float,0)+dt*(3+least(30,greatest(0,coalesce((stats->'items'->>'acceleration')::float,0)))/5)) else 0 end;
    own:=own||jsonb_build_object('acceleration_progress',speed_factor);
    radius:=radius*coalesce((stats->>'speed')::float,1)*(.85+.15*speed_factor);
   end if;
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
   if enemy is not null and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts then
    wanted_angle:=atan2((enemy->>'x')::float-px,(enemy->>'z')::float-pz);
    if coalesce((own->>'stats_version')::int,0)=73 then
     turn:=atan2(sin(wanted_angle-angle),cos(wanted_angle-angle));
     angle:=angle+turn*least(1,(1-exp(-18*dt))*(1+least(.3,greatest(0,coalesce((own->'combat_stats'->'items'->>'turn_speed')::float,0)/100))));
    else angle:=wanted_angle;end if;
   end if;
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
    if coalesce((own->>'stats_version')::int,0)=73 then
     speed_factor:=greatest(.01,coalesce((own->'combat_stats'->>'attack_speed')::float,1));
     wind:=wind/speed_factor;active:=active/speed_factor;recover:=recover/speed_factor;
    end if;
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
 return jsonb_build_object('id',r.id,'status',r.status,'starts_at',r.starts_at,'server_now',ts,'players',r.players,'winner',r.winner,'combat_version',23,'controls_version',36,'stats_version',coalesce((r.players->0->>'stats_version')::int,0));
end; $function$;

revoke all on function private.ludus_advance_combat_v36(jsonb,timestamptz),private.ludus_resolve_combat_v36(jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.ludus_match(text,uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.ludus_match(text,uuid,uuid,jsonb,jsonb) to authenticated;
commit;
