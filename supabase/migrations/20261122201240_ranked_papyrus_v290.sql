-- V290: freeze each Ranked participant's learned papyri at server-owned entry.
-- Reuse the existing combat actions, rolls, career assist rule and damage rounding.
begin;
create table ludus_staff_private.deployment_v290(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into ludus_staff_private.deployment_v290 default values;
alter table ludus_staff_private.deployment_v290 enable row level security;
revoke all on ludus_staff_private.deployment_v290 from public,anon,authenticated,service_role;
create function ludus_staff_private.ranked_effect_v290(p jsonb,id text)returns numeric
language sql immutable set search_path='' as $$
 select case when p->'staff_ranked_v290'->>'version'='290' and p->'staff_ranked_v290'->>'owner'=p->>'owner'
 then greatest(0,coalesce((p->'staff_ranked_v290'->'effects'->>id)::numeric,0)) else 0 end
$$;
create function ludus_staff_private.ranked_maximum_v290(p jsonb,base numeric)returns numeric
language sql immutable set search_path='' as $$select base*(1+ludus_staff_private.ranked_effect_v290(p,'chef_001')+ludus_staff_private.ranked_effect_v290(p,'chef_009'))$$;
create function ludus_staff_private.ranked_cost_v290(p jsonb,base numeric,action text,weapon text default null)returns numeric
language plpgsql immutable set search_path='' as $$
declare rate numeric:=0;id text;shield jsonb;
begin
 if action in('normal','double')then rate:=ludus_staff_private.ranked_effect_v290(p,'chef_003')+ludus_staff_private.ranked_effect_v290(p,'chef_011');
 elsif action='block'then rate:=ludus_staff_private.ranked_effect_v290(p,'chef_004')+ludus_staff_private.ranked_effect_v290(p,'chef_010');
 elsif action='roll'then rate:=ludus_staff_private.ranked_effect_v290(p,'chef_005')+ludus_staff_private.ranked_effect_v290(p,'chef_012');
 elsif action in('net','pull','throw','bash','breaker','sweep','disarm')then rate:=ludus_staff_private.ranked_effect_v290(p,'chef_006')+ludus_staff_private.ranked_effect_v290(p,'chef_015');end if;
 if action in('normal','double')and weapon in('gladius','sica','spatha')then id:='doctore_003';
 elsif action='normal'and weapon='halberd'then id:='doctore_020';
 elsif action='normal'and weapon in('trident','trident_gladiator')then id:='doctore_023';
 elsif action='breaker'and weapon in('mace','heavy_mace')then id:='doctore_006';
 elsif action='breaker'and weapon='warhammer'then id:='doctore_021';
 elsif action='net'then id:='doctore_008';elsif action='pull'then id:='doctore_009';elsif action='bash'then id:='doctore_022';
 elsif action='throw'and weapon='spear'then id:='doctore_017';
 elsif action='throw'and weapon in('trident','trident_gladiator')then id:='doctore_018';
 elsif action='block'then
  select i into shield from jsonb_array_elements(coalesce(p->'items','[]'))i where i->>'kind'='shield'and i->>'equipped_slot'='off_hand';
  if shield is not null then id:=case when shield->>'model'in('shield_parma','shield_celtic','shield_azure','parma','round','small')or (shield->>'model'='starter'and p->>'class'in('thraex','hoplomachus'))then 'doctore_011'else 'doctore_010'end;end if;
 end if;
 return greatest(0,base*(1-rate-ludus_staff_private.ranked_effect_v290(p,id)));
end $$;
create function ludus_staff_private.ranked_regen_v290(p jsonb,base numeric)returns numeric
language sql immutable set search_path='' as $$select base*(1+ludus_staff_private.ranked_effect_v290(p,'chef_007')+ludus_staff_private.ranked_effect_v290(p,'chef_014')+case when (p->>'stamina')::numeric<(p->>'maxStamina')::numeric*.25 then ludus_staff_private.ranked_effect_v290(p,'chef_008')else 0 end)$$;
create function ludus_staff_private.ranked_delay_v290(p jsonb,base interval)returns interval
language sql immutable set search_path='' as $$select base*(1-ludus_staff_private.ranked_effect_v290(p,'chef_017'))::double precision$$;

create function ludus_staff_private.ranked_event_v290(p jsonb,kind text,at timestamptz,data jsonb default '{}')returns jsonb
language plpgsql immutable set search_path='' as $$
declare st jsonb:=coalesce(p->'staff_ranked_state_v290','{}');used jsonb:=coalesce(st->'once','[]');ids text[]:='{}';id text;rate numeric:=0;hits int;blocks jsonb;entry jsonb;targets jsonb;special text;cap numeric:=coalesce((p->>'maxStamina')::numeric,100);
begin
 if p->'staff_ranked_v290'->>'version'is distinct from '290'or p->'staff_ranked_v290'->>'owner'is distinct from p->>'owner'or coalesce((p->>'hp')::numeric,0)<=0 then return p;end if;
 if kind='normal'then
  hits:=case when coalesce((data->>'hit')::boolean,false)then coalesce((st->>'normal_hits')::int,0)+1 else 0 end;st:=st||jsonb_build_object('normal_hits',hits);if hits>=3 then ids:=array['chef_021'];end if;
 elsif kind='block'then
  if coalesce((data->>'pre_stamina')::numeric,cap)<cap*.25 then ids:=array['chef_020'];end if;
  select coalesce(jsonb_agg(x order by (x->>'at')::timestamptz),'[]')into blocks from(
   select x from jsonb_array_elements(coalesce(st->'blocks','[]'))x where (x->>'at')::timestamptz between at-interval '5 seconds'and at+interval '5 seconds'
   order by (x->>'at')::timestamptz desc limit 127)recent;
  if data->>'attacker'is not null then
   if exists(select 1 from jsonb_array_elements(blocks)x where x->>'attacker'<>data->>'attacker')then ids:=ids||'chef_023'::text;end if;
   blocks:=blocks||jsonb_build_array(jsonb_build_object('at',at,'attacker',data->>'attacker'));
  end if;st:=st||jsonb_build_object('blocks',blocks);
 elsif kind='special_hit'and data->>'special_id'is not null and data->>'target'is not null then
  special:=data->>'special_id';entry:=coalesce(st->'specials'->special,'{}');targets:=coalesce(entry->'targets','[]');
  if not targets ? (data->>'target')then targets:=targets||jsonb_build_array(data->>'target');end if;
  if jsonb_array_length(targets)>=2 and not coalesce((entry->>'used')::boolean,false)then rate:=ludus_staff_private.ranked_effect_v290(p,'chef_022');entry:=entry||'{"used":true}';end if;
  st:=st||jsonb_build_object('specials',coalesce(st->'specials','{}')||jsonb_build_object(special,entry||jsonb_build_object('targets',targets)));
 elsif kind='kill'then ids:=array['chef_019'];elsif kind='assist'then ids:=array['chef_024'];elsif kind='stand_up'then ids:=array['chef_018'];
 elsif kind='clock'and st->>'started_at'is not null and at>=(st->>'started_at')::timestamptz+interval '60 seconds'then ids:=array['chef_025'];end if;
 foreach id in array ids loop
  if not used ? id then rate:=rate+ludus_staff_private.ranked_effect_v290(p,id);used:=used||jsonb_build_array(id);end if;
 end loop;
 return p||jsonb_build_object('staff_ranked_state_v290',st||jsonb_build_object('once',used),'stamina',least(cap,coalesce((p->>'stamina')::numeric,0)+cap*rate));
end $$;
create function ludus_staff_private.ranked_after_clock_v290(p jsonb,at timestamptz)returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 -- knocked_until is set by an actual enemy shield bash; pull_until is unrelated.
 if p->>'knocked_at'is not null and p->>'knocked_until'is not null and at>=(p->>'knocked_until')::timestamptz then p:=ludus_staff_private.ranked_event_v290(p,'stand_up',at);end if;
 return ludus_staff_private.ranked_event_v290(p,'clock',at);
end $$;
create function ludus_staff_private.ranked_death_v290(players jsonb,victim jsonb,at timestamptz)returns jsonb
language plpgsql immutable set search_path='' as $$
declare p jsonb;arr jsonb:='[]';uid text;killer text:=victim->'career'->>'killer';
begin
 if coalesce((victim->>'hp')::numeric,1)>0 or killer is null then return players;end if;
 for p in select value from jsonb_array_elements(players)loop
  uid:=p->>'owner';
  if p->>'ranked_team'is not null and victim->>'ranked_team'is not null and p->>'ranked_team'<>victim->>'ranked_team'and uid<>victim->>'owner'then
   if uid=killer then p:=ludus_staff_private.ranked_event_v290(p,'kill',at);
   elsif p->'career'->>'assist_version'='200'and coalesce((victim->'career'->'contributors'->>uid)::numeric,0)>=greatest(1,coalesce((victim->>'maxHp')::numeric,100)*.1)then p:=ludus_staff_private.ranked_event_v290(p,'assist',at);end if;
  end if;arr:=arr||jsonb_build_array(p);
 end loop;return arr;
end $$;

create function ludus_staff_private.ranked_snapshot_v290()returns trigger
language plpgsql set search_path='' as $$
declare p jsonb;arr jsonb:='[]';effects jsonb;cap numeric;
begin
 if new.venue<>'ranked'or not exists(select 1 from ludus_staff_private.deployment_v290 where singleton and enabled)then return new;end if;
 for p in select value from jsonb_array_elements(new.players)loop
  select coalesce(jsonb_object_agg(c.content_id,c.effect->'value'),'{}')into effects from ludus_staff_private.knowledge_v288 k join ludus_staff_private.papyrus_catalog_v288 c using(content_id)
  where k.owner_id=(p->>'owner')::uuid and ((c.role_id='trainer'and c.ordinal not in(4,19))or(c.role_id='cook'and c.ordinal not in(2,13,16)));
  p:=(p-'staff_ranked_v290'-'staff_ranked_state_v290')||jsonb_build_object('staff_ranked_v290',jsonb_build_object('version',290,'owner',p->>'owner','effects',effects),
   'staff_ranked_state_v290',jsonb_build_object('once','[]'::jsonb,'normal_hits',0,'blocks','[]'::jsonb,'started_at',case when new.status='playing'then new.starts_at else null end));
  cap:=ludus_staff_private.ranked_maximum_v290(p,coalesce((p->>'maxStamina')::numeric,100));
  p:=p||jsonb_build_object('stamina',least(cap,coalesce((p->>'stamina')::numeric,100)+cap-coalesce((p->>'maxStamina')::numeric,100)),'maxStamina',cap);
  arr:=arr||jsonb_build_array(p);
 end loop;new.players:=arr;return new;
end $$;
create trigger staff_ranked_snapshot_v290 before insert on public.ludus_matches for each row when(new.venue='ranked')execute function ludus_staff_private.ranked_snapshot_v290();
create function ludus_staff_private.ranked_start_v290()returns trigger
language plpgsql set search_path='' as $$
declare p jsonb;arr jsonb:='[]';
begin
 for p in select value from jsonb_array_elements(new.players)loop
  if p->'staff_ranked_v290'->>'version'='290'then p:=jsonb_set(p,'{staff_ranked_state_v290,started_at}',to_jsonb(new.starts_at));end if;
  arr:=arr||jsonb_build_array(p);
 end loop;new.players:=arr;return new;
end $$;
create trigger staff_ranked_start_v290 before update of status on public.ludus_matches for each row when(new.venue='ranked'and new.status='playing'and old.status is distinct from new.status)execute function ludus_staff_private.ranked_start_v290();

-- A tiny migration-only patch utility asserts every expected source fragment.
create function ludus_staff_private.patch_ranked_v290(signature text,needle text,replacement text)returns void
language plpgsql set search_path='' as $$
declare src text:=pg_get_functiondef(signature::regprocedure);
begin
 if length(src)-length(replace(src,needle,''))<>length(needle)then raise exception 'V290 unexpected or repeated source fragment in %: %',signature,needle;end if;
 execute replace(src,needle,replacement);
end $$;

create function ludus_staff_private.ranked_damage_v290(a jsonb,v jsonb,base numeric,weapon text,region text,normal boolean,critical boolean,secondary boolean)returns numeric
language plpgsql immutable set search_path='' as $$
declare up numeric:=0;down numeric:=0;id text;slot text;
begin
 if weapon='spear'then up:=up+ludus_staff_private.ranked_effect_v290(a,'doctore_002');end if;
 if weapon='warhammer'then up:=up+ludus_staff_private.ranked_effect_v290(a,'doctore_007');end if;
 if weapon='halberd'and secondary then up:=up+ludus_staff_private.ranked_effect_v290(a,'doctore_005');end if;
 if normal and weapon='whip'then up:=up+ludus_staff_private.ranked_effect_v290(a,'doctore_024');end if;
 if normal and weapon in('mace','heavy_mace')then up:=up+ludus_staff_private.ranked_effect_v290(a,'doctore_025');end if;
 if critical and weapon in('gladius','sica','spatha')then base:=base*(1+ludus_staff_private.ranked_effect_v290(a,'doctore_016'));end if;
 if region='head'then slot:='helmet';id:='doctore_012';elsif region='chest'then slot:='chest';id:='doctore_013';
 elsif region in('legs','leftLeg','rightLeg')then slot:='legs';id:='doctore_015';
 elsif region='rightArm'then slot:='gloves';id:='doctore_014';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(v->'items','[]'))i where i->>'equipped_slot'=slot and i->>'kind'=slot and (slot<>'gloves'or i->>'model'in('manica_segmented','manica_leather','manica_lion')))then down:=ludus_staff_private.ranked_effect_v290(v,id);end if;
 return base*(1+up)*(1-down);
end $$;
-- Clone the installed damage formula, including released shaft-contact adjustments.
do $clone$
declare src text:=pg_get_functiondef('private.ludus_hit_v73(jsonb,jsonb,text,text,numeric,numeric,numeric,boolean)'::regprocedure);
begin
 src:=replace(src,'private.ludus_hit_v73(','ludus_staff_private.ranked_hit_v290(');
 if position('p_projectile boolean DEFAULT false)'in src)=0 then raise exception 'V290 unexpected hit signature';end if;
 src:=replace(src,'p_projectile boolean DEFAULT false)','p_projectile boolean DEFAULT false, p_region text DEFAULT ''chest'', p_normal boolean DEFAULT true, p_secondary boolean DEFAULT false)');execute src;
end $clone$;
select ludus_staff_private.patch_ranked_v290('ludus_staff_private.ranked_hit_v290(jsonb,jsonb,text,text,numeric,numeric,numeric,boolean,text,boolean,boolean)',
 $n$critical:=p_critical_roll<greatest(0,least(.35,(coalesce((s->>'critical_rate')::numeric,0)-coalesce((t->>'critical_resistance')::numeric,0))/100));$n$,
 $r$critical:=p_critical_roll<least(1,greatest(0,least(.35,(coalesce((s->>'critical_rate')::numeric,0)-coalesce((t->>'critical_resistance')::numeric,0))/100))+case when p_weapon in('trident','trident_gladiator')then ludus_staff_private.ranked_effect_v290(p_attacker,'doctore_001')else 0 end);$r$);
select ludus_staff_private.patch_ranked_v290('ludus_staff_private.ranked_hit_v290(jsonb,jsonb,text,text,numeric,numeric,numeric,boolean,text,boolean,boolean)',
 $n$ return jsonb_build_object('damage',greatest(1,round(amount)),'critical',critical);$n$,
 $r$ amount:=ludus_staff_private.ranked_damage_v290(p_attacker,p_victim,amount,p_weapon,p_region,p_normal,critical,p_secondary);
 return jsonb_build_object('damage',greatest(1,round(amount)),'critical',critical);$r$);

create function ludus_staff_private.ranked_quote_v290(p jsonb)returns jsonb
language plpgsql immutable set search_path='' as $$
declare attacks jsonb:='{}';specials jsonb:='{}';kinds jsonb:='{}';firsts jsonb:='{}';seconds jsonb:='{}';hand text;item jsonb;weapon text;kind text;
begin
 if p->'staff_ranked_v290'->>'version'is distinct from '290'then return null;end if;
 foreach hand in array array['main_hand','off_hand']loop
  select i into item from jsonb_array_elements(coalesce(p->'items','[]'))i where i->>'equipped_slot'=hand and i->>'kind'in('weapon','shield');
  weapon:=case when item->>'kind'='weapon'then item->>'model'end;
  if weapon is null and hand='off_hand'then select i->>'model'into weapon from jsonb_array_elements(coalesce(p->'items','[]'))i where i->>'equipped_slot'='main_hand'and i->>'kind'='weapon';end if;
  attacks:=attacks||jsonb_build_object(hand,ludus_staff_private.ranked_cost_v290(p,13,'normal',weapon));kind:=private.ludus_special_kind_v261(item);
  specials:=specials||jsonb_build_object(hand,case when kind is not null then ludus_staff_private.ranked_cost_v290(p,case when kind='double'then 19.5 else 26 end,kind,item->>'model')end);
  firsts:=firsts||jsonb_build_object(hand,case when kind is not null then ludus_staff_private.ranked_cost_v290(p,case when kind='double'then 13 else 26 end,kind,item->>'model')end);
  seconds:=seconds||jsonb_build_object(hand,case when kind='double'then ludus_staff_private.ranked_cost_v290(p,6.5,kind,item->>'model')else 0 end);kinds:=kinds||jsonb_build_object(hand,kind);
 end loop;
 return jsonb_build_object('version',290,'owner',p->>'owner','gear_serial',coalesce((p->>'gear_serial')::int,0),'attack',attacks,'dodge',jsonb_build_object('step',18,'duck',18,'jump',22,'roll',ludus_staff_private.ranked_cost_v290(p,25,'roll')),'special',specials,'special_kind',kinds,'special_first',firsts,'special_second',seconds);
end $$;
create function ludus_staff_private.ranked_quote_players_v290(players jsonb,owner_id uuid)returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(case when p->>'owner'=owner_id::text and p->'staff_ranked_v290'->>'version'='290'then p||jsonb_build_object('action_costs_v290',ludus_staff_private.ranked_quote_v290(p))else p-'action_costs_v290'end order by ord),'[]')from jsonb_array_elements(players)with ordinality x(p,ord)
$$;

-- Existing authoritative action and resolution paths.
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamptz)',
 $n$evade_cost int;$n$,
 $r$evade_cost numeric; normal_cost numeric;$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamptz)',
 $n$   select f->>'model' into selected_weapon from jsonb_array_elements(own->'items') f where f->>'equipped_slot'=selected_hand and f->>'kind'='weapon';$n$,
 $r$$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamptz)',
 $n$   strike:=not dodging$n$,
 $r$   select f->>'model' into selected_weapon from jsonb_array_elements(own->'items') f where f->>'equipped_slot'=selected_hand and f->>'kind'='weapon';
   normal_cost:=ludus_staff_private.ranked_cost_v290(own,13,'normal',selected_weapon);
   strike:=not dodging$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamptz)',
 $n$coalesce((own->>'stamina')::float,100)>=13$n$,
 $r$coalesce((own->>'stamina')::float,100)>=normal_cost$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamptz)',
 $n$coalesce((own->>'stamina')::float,100)-13$n$,
 $r$coalesce((own->>'stamina')::float,100)-normal_cost$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamptz)',
 $n$   evade_cost:=case evade_kind when 'roll' then 25 when 'jump' then 22 else 18 end;$n$,
 $r$   evade_cost:=case evade_kind when 'roll' then ludus_staff_private.ranked_cost_v290(own,25,'roll') when 'jump' then 22 else 18 end;$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_begin_special_v261(jsonb,integer,jsonb,timestamptz)',
 $n$<(case when kind='double' then 19.5 else 26 end)$n$,
 $r$<ludus_staff_private.ranked_cost_v290(a,case when kind='double' then 19.5 else 26 end,kind,i->>'model')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_begin_special_v261(jsonb,integer,jsonb,timestamptz)',
 $n$'stamina',(a->>'stamina')::numeric-case when kind='double' then 13 else 26 end$n$,
 $r$'stamina',(a->>'stamina')::numeric-ludus_staff_private.ranked_cost_v290(a,case when kind='double' then 13 else 26 end,kind,i->>'model')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_begin_special_v261(jsonb,integer,jsonb,timestamptz)',
 $n$'stamina_regen_at',ts+interval '1 second'$n$,
 $r$'stamina_regen_at',ts+ludus_staff_private.ranked_delay_v290(a,interval '1 second')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_begin_special_v261(jsonb,integer,jsonb,timestamptz)',
 $n$'attacker',jsonb_build_object('stats_version',a->'stats_version','items',a->'items','combat_stats',a->'combat_stats')$n$,
 $r$'attacker',jsonb_build_object('stats_version',a->'stats_version','items',a->'items','combat_stats',a->'combat_stats')||case when a->'staff_ranked_v290'->>'version'='290'then jsonb_build_object('owner',a->'owner','staff_ranked_v290',a->'staff_ranked_v290')else '{}'::jsonb end$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_begin_special_v261(jsonb,integer,jsonb,timestamptz)',
 $n$  stats:=private.ludus_combat_stats_v73(a->'gladiator',gear);$n$,
 $r$  stats:=private.ludus_combat_stats_v73(a->'gladiator',gear);
  stats:=stats||jsonb_build_object('maxStamina',ludus_staff_private.ranked_maximum_v290(a,(stats->>'maxStamina')::numeric));$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_resolve_special_v261(jsonb,timestamptz)',
 $n$(a->>'stamina')::numeric<6.5$n$,
 $r$(a->>'stamina')::numeric<ludus_staff_private.ranked_cost_v290(a,6.5,'double',s->>'weapon')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_resolve_special_v261(jsonb,timestamptz)',
 $n$(a->>'stamina')::numeric-6.5$n$,
 $r$(a->>'stamina')::numeric-ludus_staff_private.ranked_cost_v290(a,6.5,'double',s->>'weapon')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_resolve_special_v261(jsonb,timestamptz)',
 $n$'stamina_regen_at',ts+interval '1 second'$n$,
 $r$'stamina_regen_at',ts+ludus_staff_private.ranked_delay_v290(a,interval '1 second')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$len float;along float;side float;$n$,
 $r$len float;along float;side float;pre_stamina numeric;$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$  stats:=private.ludus_combat_stats_v73(v->'gladiator',gear);$n$,
 $r$  stats:=private.ludus_combat_stats_v73(v->'gladiator',gear);
  stats:=stats||jsonb_build_object('maxStamina',ludus_staff_private.ranked_maximum_v290(v,(stats->>'maxStamina')::numeric));$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$coalesce((v->>'stamina')::numeric,0)>=20$n$,
 $r$coalesce((v->>'stamina')::numeric,0)>=ludus_staff_private.ranked_cost_v290(v,20,'block')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$  if guarded then$n$,
 $r$  if guarded then
   pre_stamina:=coalesce((v->>'stamina')::numeric,0);$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$(v->>'stamina')::numeric-20$n$,
 $r$(v->>'stamina')::numeric-ludus_staff_private.ranked_cost_v290(v,20,'block')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$'stamina_regen_at',ts+interval '900 milliseconds'$n$,
 $r$'stamina_regen_at',ts+ludus_staff_private.ranked_delay_v290(v,interval '900 milliseconds')$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$   if kind='breaker' then$n$,
 $r$   v:=ludus_staff_private.ranked_event_v290(v,'block',impact,jsonb_build_object('pre_stamina',pre_stamina,'attacker',a->>'owner'));
   if kind='breaker' then$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$hit:=private.ludus_hit_v73(a,v,s->>'weapon',s->>'hand',14,random()::numeric,random()::numeric);$n$,
 $r$hit:=ludus_staff_private.ranked_hit_v290(a,v,s->>'weapon',s->>'hand',14,random()::numeric,random()::numeric,false,'chest',false,kind='sweep'and s->>'target'<>v->>'owner');$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$   hit:=ludus_career_private.hit(a,v,amount);a:=hit->0;v:=hit->1;$n$,
 $r$   hit:=ludus_career_private.hit(a,v,amount);a:=hit->0;v:=hit->1;
   if amount>0 then a:=ludus_staff_private.ranked_event_v290(a,'special_hit',ts,jsonb_build_object('special_id',(s->>'id')||':'||(s->>'start'),'target',v->>'owner'));end if;$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_special_impact_v261(jsonb,integer,integer,jsonb,timestamptz)',
 $n$ return jsonb_set(jsonb_set(players,array[ai::text],a),array[vi::text],v);$n$,
 $r$ players:=jsonb_set(jsonb_set(players,array[ai::text],a),array[vi::text],v);
 if coalesce((v->>'hp')::numeric,1)<=0 then players:=ludus_staff_private.ranked_death_v290(players,v,ts);end if;
 return players;$r$);
select ludus_staff_private.patch_ranked_v290('private.ludus_shield_impact_v168(jsonb,text)',
 $n$ stats:=private.ludus_combat_stats_v73(v->'gladiator',gear);$n$,
 $r$ stats:=private.ludus_combat_stats_v73(v->'gladiator',gear);
 stats:=stats||jsonb_build_object('maxStamina',ludus_staff_private.ranked_maximum_v290(v,(stats->>'maxStamina')::numeric));$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$hit jsonb; modern boolean;$n$,
 $r$hit jsonb; modern boolean;pre_stamina numeric;$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$cost:=case when perfect then 6 else 20 end; passive:='none';$n$,
 $r$cost:=ludus_staff_private.ranked_cost_v290(v,case when perfect then 6 else 20 end,'block'); passive:='none';$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$guarded:=true;perfect:=false;cost:=20;$n$,
 $r$guarded:=true;perfect:=false;cost:=ludus_staff_private.ranked_cost_v290(v,20,'block');$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$     if modern then
      cost:=$n$,
 $r$     pre_stamina:=coalesce((v->>'stamina')::numeric,100);
     if modern then
      cost:=$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$'stamina_regen_at',p_now+interval '900 milliseconds'$n$,
 $r$'stamina_regen_at',p_now+ludus_staff_private.ranked_delay_v290(v,interval '900 milliseconds')$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$     recoil:=case when perfect then$n$,
 $r$     if guarded and passive<>'parry'then v:=ludus_staff_private.ranked_event_v290(v,'block',impact,jsonb_build_object('pre_stamina',pre_stamina,'attacker',a->>'owner'));end if;
     recoil:=case when perfect then$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$hit:=private.ludus_hit_v73(a,v,weapon,coalesce(a->>'strike_hand','main_hand'),amount,random()::numeric,random()::numeric);$n$,
 $r$hit:=ludus_staff_private.ranked_hit_v290(a,v,weapon,coalesce(a->>'strike_hand','main_hand'),amount,random()::numeric,random()::numeric,false,coalesce(a->>'strike_region','chest'),true,false);$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$  a:=a||jsonb_build_object('attack_result',outcome);players:=jsonb_set(players,array[ai::text],a);$n$,
 $r$  a:=ludus_staff_private.ranked_event_v290(a,'normal',p_now,jsonb_build_object('hit',outcome in('hit','counter','critical')));
  a:=a||jsonb_build_object('attack_result',outcome);players:=jsonb_set(players,array[ai::text],a);
  if outcome in('hit','counter','critical')and coalesce((v->>'hp')::numeric,1)<=0 then players:=ludus_staff_private.ranked_death_v290(players,v,p_now);end if;$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamptz)',
 $n$   players:=jsonb_set(players,array[ai::text],a); continue;$n$,
 $r$   a:=ludus_staff_private.ranked_event_v290(a,'normal',p_now,'{"hit":false}');
   players:=jsonb_set(players,array[ai::text],a); continue;$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.projectiles_v248(jsonb,timestamptz)',
 $n$outcome text; cost numeric;$n$,
 $r$outcome text; cost numeric;pre_stamina numeric;$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.projectiles_v248(jsonb,timestamptz)',
 $n$coalesce((v->>'stamina')::float,0)>=20$n$,
 $r$coalesce((v->>'stamina')::float,0)>=ludus_staff_private.ranked_cost_v290(v,20,'block')$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.projectiles_v248(jsonb,timestamptz)',
 $n$    cost:=case when passive='parry' then 6 else 20*$n$,
 $r$    pre_stamina:=coalesce((v->>'stamina')::numeric,0);
    cost:=case when passive='parry' then 6 else ludus_staff_private.ranked_cost_v290(v,20,'block')*$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.projectiles_v248(jsonb,timestamptz)',
 $n$'stamina_regen_at',p_now+interval '900 milliseconds'$n$,
 $r$'stamina_regen_at',p_now+ludus_staff_private.ranked_delay_v290(v,interval '900 milliseconds')$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.projectiles_v248(jsonb,timestamptz)',
 $n$   else
    hit:=private.ludus_hit_v73$n$,
 $r$    if passive<>'parry'then v:=ludus_staff_private.ranked_event_v290(v,'block',impact,jsonb_build_object('pre_stamina',pre_stamina,'attacker',a->>'owner'));end if;
   else
    hit:=ludus_staff_private.ranked_hit_v290$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.projectiles_v248(jsonb,timestamptz)',
 $n$random()::numeric,random()::numeric,true);$n$,
 $r$random()::numeric,random()::numeric,true,'chest',false,false);$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.projectiles_v248(jsonb,timestamptz)',
 $n$  players:=jsonb_set(players,array[ai::text],a||jsonb_build_object('projectile',shot));
 end loop;$n$,
 $r$  players:=jsonb_set(players,array[ai::text],a||jsonb_build_object('projectile',shot));
  if outcome in('hit','critical')and coalesce((v->>'hp')::numeric,1)<=0 then players:=ludus_staff_private.ranked_death_v290(players,v,p_now);end if;
 end loop;$r$);

-- Delay and legacy throw branch retain the same validated input path.
do $input$
declare src text:=pg_get_functiondef('ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamptz)'::regprocedure);needle text:=$n$'stamina_regen_at',ts+interval '1 second'$n$;
begin
 if (length(src)-length(replace(src,needle,'')))/length(needle)<>4 then raise exception 'V290 input regeneration source changed';end if;
 src:=replace(src,needle,$r$'stamina_regen_at',ts+ludus_staff_private.ranked_delay_v290(own,interval '1 second')$r$);
 src:=replace(src,$n$'items',own->'items','combat_stats',own->'combat_stats');$n$,$r$'items',own->'items','combat_stats',own->'combat_stats')||case when own->'staff_ranked_v290'->>'version'='290'then jsonb_build_object('owner',own->'owner','staff_ranked_v290',own->'staff_ranked_v290')else '{}'::jsonb end;$r$);
 execute src;
end $input$;
-- Ranked gets its own copy of the released advance function; other venues keep theirs.
do $advance$
declare src text:=pg_get_functiondef('private.ludus_advance_combat_v36(jsonb,timestamptz)'::regprocedure);
begin
 src:=replace(src,'private.ludus_advance_combat_v36(','ludus_staff_private.ranked_advance_v290(');
 src:=replace(src,'energy float;','energy float;staff_before float;');
 src:=replace(src,'energy double precision;','energy double precision;staff_before double precision;');
 if position('staff_before'in src)=0 then raise exception 'V290 advance declaration changed';end if;
 execute src;
end $advance$;
select ludus_staff_private.patch_ranked_v290('ludus_staff_private.ranked_advance_v290(jsonb,timestamptz)',
 $n$    energy:=least(cap,energy+dt*$n$,
 $r$    staff_before:=energy;
    energy:=least(cap,energy+dt*$r$);
select ludus_staff_private.patch_ranked_v290('ludus_staff_private.ranked_advance_v290(jsonb,timestamptz)',
 $n$    if modern then
     -- Keep fractional healing$n$,
 $r$    if ludus_staff_private.ranked_effect_v290(p,'chef_007')+ludus_staff_private.ranked_effect_v290(p,'chef_014')+ludus_staff_private.ranked_effect_v290(p,'chef_008')>0 then
     energy:=least(cap,staff_before+ludus_staff_private.ranked_regen_v290(p,(energy-staff_before)::numeric));
    end if;
    if modern then
     -- Keep fractional healing$r$);
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.match_step(text,uuid,uuid,jsonb,jsonb)',
 $n$private.ludus_advance_combat_v36(r.players,ts)$n$,
 $r$ludus_staff_private.ranked_advance_v290(r.players,ts)$r$);
-- Resolve due damage before timed payouts: a pre-minute lethal impact cannot
-- receive the minute reward or fund a block before that impact is settled.
create function ludus_staff_private.ranked_clock_players_v290(players jsonb,at timestamptz)returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(ludus_staff_private.ranked_after_clock_v290(p,at)order by ord),'[]')from jsonb_array_elements(players)with ordinality x(p,ord)
$$;
select ludus_staff_private.patch_ranked_v290('ludus_ranked_match_private.match_step(text,uuid,uuid,jsonb,jsonb)',
 $n$r.players:=ludus_ranked_match_private.projectiles_v248(r.players,ts);$n$,
 $r$r.players:=ludus_ranked_match_private.projectiles_v248(r.players,ts);
  r.players:=ludus_staff_private.ranked_clock_players_v290(r.players,ts);$r$);
-- Build quotes only while returning the authenticated owner's server state.
do $quote$
declare src text:=pg_get_functiondef('ludus_ranked_match_private.match_step(text,uuid,uuid,jsonb,jsonb)'::regprocedure);needle text:=$n$'players',r.players$n$;
begin
 if (length(src)-length(replace(src,needle,'')))/length(needle)<>2 then raise exception 'V290 ranked response source changed';end if;
 execute replace(src,needle,$r$'players',ludus_staff_private.ranked_quote_players_v290(r.players,u)$r$);
end $quote$;
select ludus_staff_private.patch_ranked_v290('public.ludus_ranked_match_v252(text,uuid,uuid,jsonb,jsonb)',
 $n$'knocked_until'];$n$,$r$'knocked_until','action_costs_v290'];$r$);

update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active',runtime_reason=null,
 runtime_note='4×5, Solo20 ve Ranked maçlarında mevcut hareketlerde etkindir. Ranked öğrenimi maç girişinde sabitlenir.'
where role_id='trainer'and ordinal not in(4,19);
update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active',runtime_reason=null,
 runtime_note=case when ordinal in(22,24)then 'Ranked maçlarında sunucunun doğruladığı özel hareket isabeti veya ilk asist koşulunda etkindir.'else '4×5, Solo20 ve Ranked maçlarında mevcut hareketlerde etkindir. Ranked öğrenimi maç girişinde sabitlenir.'end
where role_id='cook'and ordinal not in(2,13,16);

drop function ludus_staff_private.patch_ranked_v290(text,text,text);
-- No new browser RPC. Existing match authentication and match-row locks remain authoritative.
do $acl$
declare f regprocedure;
begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ludus_staff_private'and p.proname like 'ranked_%_v290'loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
end $acl$;
commit;
