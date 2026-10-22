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
   reach:=case weapon when 'spear' then 2.50 when 'trident' then 2.50 when 'mace' then 1.95 when 'whip' then 1.90 when 'gladius' then 1.60 when 'sica' then 1.60 else 1.10 end;
   distance:=sqrt(power((a->>'x')::float-(v->>'x')::float,2)+power((a->>'z')::float-(v->>'z')::float,2));
   facing:=atan2((v->>'x')::float-(a->>'x')::float,(v->>'z')::float-(a->>'z')::float)-(a->>'angle')::float;
   facing:=abs(atan2(sin(facing),cos(facing)));
   if distance<=reach and facing<=1.05 and not (coalesce((v->>'dodge_at')::timestamptz,'epoch')<=impact and coalesce((v->>'dodge_at')::timestamptz,'epoch')+interval '370 milliseconds'>impact) then
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
     if perfect then v:=v||jsonb_build_object('guard_at',null,'counter_until',p_now+interval '700 milliseconds','counter_target',a->>'owner'); end if;
    else
     amount:=case when coalesce((a->>'strike_counter')::boolean,false) then 17 else 14 end;
     outcome:=case when amount=17 then 'counter' else 'hit' end;
     if coalesce((a->>'stats_version')::int,0) in (73,74,75,76,77) then
      hit:=private.ludus_hit_v73(a,v,weapon,coalesce(a->>'strike_hand','main_hand'),amount,random()::numeric,random()::numeric);
      amount:=(hit->>'damage')::int;
      if (hit->>'critical')::boolean then outcome:='critical';end if;
     end if;
     v:=v||jsonb_build_object('hp',greatest(0,(v->>'hp')::int-amount),'hit_serial',coalesce((v->>'hit_serial')::int,0)+1,'hit_from',a->>'owner','hit_time',p_now,'hit_impact_at',impact,'hit_region',coalesce(a->>'strike_region','chest'),'block',false,'guard_at',null);
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
end; $function$;


CREATE OR REPLACE FUNCTION private.ludus_projectiles_v76(p_players jsonb, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 players jsonb:=p_players; a jsonb; v jsonb; shot jsonb; candidate jsonb; hit jsonb; s jsonb;
 ai int; vi int; selected int; start_at timestamptz; finish_at timestamptz; impact timestamptz;
 ox float; oz float; dx float; dz float; from_d float; to_d float; along float; side2 float; contact float; best float;
 facing float; guarded boolean; passive text; outcome text; cost numeric;
begin
 -- Earlier releases must resolve first, regardless of player array order.
 for ai in select (ord-1)::int from jsonb_array_elements(p_players) with ordinality e(f,ord)
  order by (f->'projectile'->>'launch_at')::timestamptz nulls last,ord loop
  a:=players->ai;shot:=a->'projectile';
  if shot is null or shot='null'::jsonb or coalesce((shot->>'resolved')::boolean,false) then continue;end if;
  start_at:=(shot->>'launch_at')::timestamptz;
  if p_now<start_at then continue;end if;
  -- A throw interrupted before release drops harmlessly; released weapons remain in flight.
  if not coalesce((shot->>'launched')::boolean,false) and (coalesce((a->>'left')::boolean,false) or ((a->>'hp')::int<=0 and coalesce((a->>'hit_impact_at')::timestamptz,(a->>'hit_time')::timestamptz,p_now)<=start_at) or (a->>'pull_from' is not null and coalesce((a->>'pull_at')::timestamptz,p_now)<=start_at) or (coalesce((a->>'recoil_at')::timestamptz,p_now)<=start_at and coalesce((a->>'stagger_until')::timestamptz,'epoch')>start_at)) then
   shot:=shot||jsonb_build_object('resolved',true,'ended_at',p_now,'outcome','cancelled','x',shot->'origin_x','z',shot->'origin_z');
   players:=jsonb_set(players,array[ai::text],a||jsonb_build_object('projectile',shot));continue;
  end if;
  finish_at:=least(p_now,(shot->>'expires_at')::timestamptz);
  from_d:=greatest(0,extract(epoch from coalesce((shot->>'tick_at')::timestamptz,start_at)-start_at)*12);
  to_d:=greatest(0,extract(epoch from finish_at-start_at)*12);
  if to_d<=from_d then continue;end if;
  ox:=(shot->>'origin_x')::float;oz:=(shot->>'origin_z')::float;dx:=(shot->>'dx')::float;dz:=(shot->>'dz')::float;
  selected:=null;best:=to_d+1;
  for vi in 0..jsonb_array_length(players)-1 loop
   candidate:=players->vi;
   if vi=ai or (candidate->>'hp')::int<=0 then continue;end if;
   along:=((candidate->>'x')::float-ox)*dx+((candidate->>'z')::float-oz)*dz;
   side2:=greatest(0,power((candidate->>'x')::float-ox,2)+power((candidate->>'z')::float-oz,2)-along*along);
   if side2>.55*.55 then continue;end if;
   contact:=greatest(from_d,along-sqrt(.55*.55-side2));
   if along+sqrt(.55*.55-side2)<from_d or contact>to_d or contact>=best then continue;end if;
   impact:=start_at+contact/12*interval '1 second';
   if coalesce((candidate->>'dodge_at')::timestamptz,'epoch')<=impact and coalesce((candidate->>'dodge_at')::timestamptz,'epoch')+interval '370 milliseconds'>impact then continue;end if;
   selected:=vi;best:=contact;
  end loop;
  outcome:='miss';
  if selected is not null then
   v:=players->selected;impact:=start_at+best/12*interval '1 second';s:=v->'combat_stats'->'items';
   facing:=atan2(-dx,-dz)-coalesce((v->>'angle')::float,0);facing:=abs(atan2(sin(facing),cos(facing)));
   guarded:=coalesce((v->>'block')::boolean,false) and facing<1.35 and coalesce((v->>'stamina')::float,0)>=20
    and exists(select 1 from jsonb_array_elements(v->'items') it where it->>'kind'='shield' and it->>'equipped_slot'='off_hand');
   passive:='none';
   if not guarded then passive:=private.ludus_passive_defense_v73(v,impact,facing<1.1,random()::numeric,random()::numeric,random()::numeric);end if;
   if passive='evade' then outcome:='evade';
   elsif guarded or passive in('autoblock','parry') then
    outcome:=case when passive='parry' then 'parry' else 'block' end;
    cost:=case when passive='parry' then 6 else 20*(1-least(.4,greatest(0,coalesce((s->>'block_power')::numeric,0)/100))) end;
    v:=v||jsonb_build_object('stamina',greatest(0,(v->>'stamina')::numeric-cost),'stamina_regen_at',p_now+interval '900 milliseconds');
   else
    hit:=private.ludus_hit_v73(shot->'attacker',v,shot->>'weapon',shot->>'hand',(shot->>'base')::numeric,random()::numeric,random()::numeric,true);
    outcome:=case when (hit->>'critical')::boolean then 'critical' else 'hit' end;
    v:=v||jsonb_build_object('hp',greatest(0,(v->>'hp')::int-(hit->>'damage')::int),'hit_serial',coalesce((v->>'hit_serial')::int,0)+1,'hit_from',a->>'owner','hit_time',p_now,'hit_impact_at',impact,'hit_region','chest','block',false,'guard_at',null);
   end if;
   if outcome in('block','parry','evade') then
    v:=v||jsonb_build_object('defense_serial',coalesce((v->>'defense_serial')::int,0)+1,'last_defense',outcome,'defense_from',a->>'owner','defense_at',p_now);
   end if;
   players:=jsonb_set(players,array[selected::text],v);
   shot:=shot||jsonb_build_object('resolved',true,'ended_at',impact,'outcome',outcome,'victim',v->>'owner','x',ox+dx*best,'z',oz+dz*best);
  elsif finish_at>=(shot->>'expires_at')::timestamptz then
   shot:=shot||jsonb_build_object('resolved',true,'ended_at',finish_at,'outcome','miss','x',ox+dx*to_d,'z',oz+dz*to_d);
  else shot:=shot||jsonb_build_object('x',ox+dx*to_d,'z',oz+dz*to_d);end if;
  shot:=shot||jsonb_build_object('launched',true,'tick_at',finish_at);
  players:=jsonb_set(players,array[ai::text],a||jsonb_build_object('projectile',shot));
 end loop;
 return players;
end;$function$;

CREATE OR REPLACE FUNCTION private.ludus_hit_v73(p_attacker jsonb, p_victim jsonb, p_weapon text, p_hand text, p_base numeric, p_critical_roll numeric, p_damage_roll numeric, p_projectile boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
 a jsonb:=p_attacker->'combat_stats';v jsonb:=p_victim->'combat_stats';s jsonb:=a->'items';t jsonb:=v->'items';held jsonb;
 attack numeric:=coalesce((a->>'attack')::numeric,1);defense numeric:=coalesce((v->>'defense')::numeric,1);power numeric;resistance numeric;amount numeric;critical boolean;
begin
 select value into held from jsonb_array_elements(coalesce(p_attacker->'items','[]')) where value->>'equipped_slot'=p_hand and value->>'kind'='weapon';
 if (held->>'stat_version')::int=10 then
  power:=coalesce((private.ludus_item_stats_v73(held)->>'physical_power')::numeric,0);
  if coalesce((p_attacker->>'stats_version')::int,0)>=75 then
   -- Match naturalValues(): Fortitudo is excluded from the striking weapon multiplier.
   power:=greatest(0,coalesce((held->'natural_stats'->>'physical_power')::numeric,0))*(1+.1*greatest(0,coalesce((held->>'enhancement')::numeric,0)))*(1+greatest(0,coalesce((held->'natural_percentages'->>'physical_power')::numeric,0))/100);
  end if;
  attack:=(coalesce((a->>'native_attack')::numeric,1)+greatest(0,least(50,coalesce((s->>'physical_power')::numeric,0)-power))/50)*greatest(.01,power/7);
 end if;
 defense:=greatest(.1,defense-least(50,greatest(0,coalesce((t->>'physical_defense')::numeric,0)))/50*least(.6,greatest(0,coalesce((s->>'armor_penetration')::numeric,0)/100)));
 resistance:=coalesce((t->>'damage_reduction')::numeric,0)+coalesce((t->>case when p_projectile then 'projectile_resistance' when p_weapon in('spear','trident','scissor') then 'pierce_resistance' else 'slash_resistance' end)::numeric,0);
 -- V114: shaft contact at very short range cannot deal full point damage.
 if not p_projectile and p_weapon in ('spear','trident') and p_attacker ? 'x' and p_attacker ? 'z' and p_victim ? 'x' and p_victim ? 'z' then
  p_base:=p_base*greatest(.28,least(1,(sqrt(power((p_attacker->>'x')::numeric-(p_victim->>'x')::numeric,2)+power((p_attacker->>'z')::numeric-(p_victim->>'z')::numeric,2))-.75)/1.05));
 end if;
 amount:=p_base*attack/defense*(1-least(.55,greatest(0,resistance/100)))*least(1,greatest(.8,.8+p_damage_roll*.2+coalesce((s->>'minimum_damage')::numeric,0)/100));
 critical:=p_critical_roll<greatest(0,least(.35,(coalesce((s->>'critical_rate')::numeric,0)-coalesce((t->>'critical_resistance')::numeric,0))/100));
 if critical then amount:=amount*(1+greatest(.1,least(1.2,.5+(coalesce((s->>'critical_damage')::numeric,0)-coalesce((t->>'critical_damage_reduction')::numeric,0))/100)));end if;
 return jsonb_build_object('damage',greatest(1,round(amount)),'critical',critical);
end; $function$;

