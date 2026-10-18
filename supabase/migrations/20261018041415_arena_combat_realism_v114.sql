-- V114: deliberate attack cadence, bounded combined haste and distance-sensitive polearms.
-- Replace only verified combat fragments; retain function signatures, ownership, grants and search paths.
-- No account, inventory, reward or in-flight strike records are rewritten.

do $v114$
declare body text; old_part text; new_part text;
begin
 body:=pg_get_functiondef('private.ludus_combat_stats_v73(jsonb,jsonb)'::regprocedure);
 old_part:=$before$'attack_speed',(.7+.006*greatest(0,least(100,(native->>'agility')::numeric)))*(1+least(.25,greatest(0,coalesce((total->>'attack_speed')::numeric,0)/100)))$before$;
 new_part:=$after$'attack_speed',least(1.18,(.9+.002*greatest(0,least(100,(native->>'agility')::numeric)))*(1+least(.25,greatest(0,coalesce((total->>'attack_speed')::numeric,0)/100))))$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of private.ludus_combat_stats_v73(jsonb,jsonb)'; end if;
 execute body;
end $v114$;

do $v114$
declare body text; old_part text; new_part text;
begin
 body:=pg_get_functiondef('public.ludus_match(text,uuid,uuid,jsonb,jsonb)'::regprocedure);
 old_part:=$before$wind:=case selected_weapon when 'gladius' then .26 when 'sica' then .22 when 'spear' then .30 when 'trident' then .34 when 'mace' then .40 when 'whip' then .32 else .24 end;$before$;
 new_part:=$after$wind:=case selected_weapon when 'gladius' then .25 when 'sica' then .23 when 'spear' then .32 when 'trident' then .36 when 'mace' then .40 when 'whip' then .32 else .22 end;$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of public.ludus_match(text,uuid,uuid,jsonb,jsonb)'; end if;
 old_part:=$before$active:=case selected_weapon when 'sica' then .20 when 'trident' then .23 when 'mace' then .26 when 'whip' then .24 else .22 end;$before$;
 new_part:=$after$active:=case selected_weapon when 'gladius' then .20 when 'sica' then .19 when 'spear' then .22 when 'trident' then .24 when 'mace' then .26 when 'whip' then .24 else .18 end;$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of public.ludus_match(text,uuid,uuid,jsonb,jsonb)'; end if;
 old_part:=$before$recover:=case selected_weapon when 'gladius' then .32 when 'sica' then .28 when 'spear' then .34 when 'trident' then .37 when 'mace' then .43 when 'whip' then .36 else .28 end;$before$;
 new_part:=$after$recover:=case selected_weapon when 'gladius' then .45 when 'sica' then .40 when 'spear' then .48 when 'trident' then .52 when 'mace' then .56 when 'whip' then .48 else .35 end;$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of public.ludus_match(text,uuid,uuid,jsonb,jsonb)'; end if;
 old_part:=$before$speed_factor:=greatest(.01,coalesce((own->'combat_stats'->>'attack_speed')::float,1));$before$;
 new_part:=$after$speed_factor:=least(1.18,(.9+.002*greatest(0,least(100,coalesce((own->'combat_stats'->>'agility')::float,50))))*(1+least(.25,greatest(0,coalesce((own->'combat_stats'->'items'->>'attack_speed')::float,0)/100))));$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of public.ludus_match(text,uuid,uuid,jsonb,jsonb)'; end if;
 old_part:=$before$'combat_version',23,'controls_version'$before$;
 new_part:=$after$'combat_version',23,'combat_feel_version',114,'controls_version'$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of public.ludus_match(text,uuid,uuid,jsonb,jsonb)'; end if;
 execute body;
end $v114$;

do $v114$
declare body text; old_part text; new_part text;
begin
 body:=pg_get_functiondef('private.ludus_hit_v73(jsonb,jsonb,text,text,numeric,numeric,numeric,boolean)'::regprocedure);
 old_part:=$before$ amount:=p_base*attack/defense*$before$;
 new_part:=$after$ -- V114: shaft contact at very short range cannot deal full point damage.
 if not p_projectile and p_weapon in ('spear','trident') and p_attacker ? 'x' and p_attacker ? 'z' and p_victim ? 'x' and p_victim ? 'z' then
  p_base:=p_base*greatest(.28,least(1,(sqrt(power((p_attacker->>'x')::numeric-(p_victim->>'x')::numeric,2)+power((p_attacker->>'z')::numeric-(p_victim->>'z')::numeric,2))-.75)/1.05));
 end if;
 amount:=p_base*attack/defense*$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of private.ludus_hit_v73(jsonb,jsonb,text,text,numeric,numeric,numeric,boolean)'; end if;
 execute body;
end $v114$;

do $v114$
declare body text; old_part text; new_part text;
begin
 body:=pg_get_functiondef('private.ludus_resolve_combat_v36(jsonb,timestamptz)'::regprocedure);
 old_part:=$before$reach:=case weapon when 'spear' then 2.65 when 'trident' then 2.55 when 'mace' then 1.95 when 'whip' then 1.90 when 'gladius' then 1.85 when 'sica' then 1.85 else 1.10 end;$before$;
 new_part:=$after$reach:=case weapon when 'spear' then 2.50 when 'trident' then 2.50 when 'mace' then 1.95 when 'whip' then 1.90 when 'gladius' then 1.60 when 'sica' then 1.60 else 1.10 end;$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of private.ludus_resolve_combat_v36(jsonb,timestamptz)'; end if;
 old_part:=$before$  a:=a||jsonb_build_object('attack_result',outcome);players:=jsonb_set(players,array[ai::text],a);$before$;
 new_part:=$after$  -- V114: a missed strike has to return to guard before another strike starts.
  if outcome in ('miss','evade') then
   a:=a||jsonb_build_object('recover',coalesce((a->>'recover')::numeric,0)+.14,
    'swing_end',coalesce((a->>'swing_end')::timestamptz,impact)+interval '140 milliseconds',
    'cooldown_until',coalesce((a->>'cooldown_until')::timestamptz,impact)+interval '140 milliseconds');
  end if;
  a:=a||jsonb_build_object('attack_result',outcome);players:=jsonb_set(players,array[ai::text],a);$after$;
 if strpos(body,new_part)>0 then null;
 elsif strpos(body,old_part)>0 then body:=replace(body,old_part,new_part);
 else raise exception 'V114: unexpected definition of private.ludus_resolve_combat_v36(jsonb,timestamptz)'; end if;
 execute body;
end $v114$;
