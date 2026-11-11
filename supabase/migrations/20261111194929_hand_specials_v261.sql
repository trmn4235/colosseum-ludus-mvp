-- V261: explicit, authoritative per-hand special actions. No mastery/XP system.
create function private.ludus_special_kind_v261(i jsonb) returns text
language sql immutable set search_path='' as $$
 select case when i->>'kind'='shield' then 'bash' else case coalesce(i->>'pit_model',i->>'model')
 when 'net' then 'net' when 'whip' then 'pull' when 'scissor' then 'disarm'
 when 'axe' then 'sweep' when 'pit_axe' then 'sweep' when 'halberd' then 'sweep'
 when 'gladius' then 'double' when 'sica' then 'double' when 'spatha' then 'double'
 when 'spear' then 'throw' when 'trident' then 'throw' when 'trident_gladiator' then 'throw'
 when 'mace' then 'breaker' when 'heavy_mace' then 'breaker' when 'warhammer' then 'breaker'
 when 'pit_stone_mace' then 'breaker' when 'pit_wood_mace' then 'breaker' end end
$$;
create function private.ludus_enemy_v261(a jsonb,v jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(a->>'owner'<>v->>'owner' and (v->>'hp')::numeric>0 and not coalesce((v->>'left')::boolean,false)
 and (a->>'ranked_team' is null or (v->>'ranked_team' is not null and a->>'ranked_team'<>v->>'ranked_team')),false)
$$;
create function private.ludus_begin_special_v261(players jsonb,idx int,cmd jsonb,ts timestamptz) returns jsonb
language plpgsql set search_path='' as $$
declare a jsonb:=players->idx;v jsonb;i jsonb;s jsonb;gear jsonb;stats jsonb;vi int;
 hand text:=cmd->>'hand';kind text;key text:=cmd->>'special_id';dist float;reach float;duration float;angle float;
begin
 if not coalesce((cmd->>'special')::boolean,false) then return players;end if;
 if hand is null or hand not in('main_hand','off_hand') or key is null or length(key)<1 or length(key)>80 then return players;end if;
 if key=coalesce(a->>'last_special_command','') then return players;end if;
 a:=a||jsonb_build_object('last_special_command',key);players:=jsonb_set(players,array[idx::text],a);
 if (a->>'hp')::int<=0 or a->>'pull_from' is not null or coalesce((a->>'left')::boolean,false) then return players;end if;
 if exists(select 1 from unnest(array['swing_end','recoil_until','stagger_until','dodge_until','cooldown_until','net_until']) k where coalesce((a->>k)::timestamptz,'epoch')>ts) then return players;end if;
 if coalesce((a->'special_ready_v261'->>hand)::timestamptz,'epoch')>ts then return players;end if;
 select value into i from jsonb_array_elements(a->'items') where value->>'equipped_slot'=hand and value->>'kind' in('weapon','shield');
 kind:=private.ludus_special_kind_v261(i);if kind is null or coalesce((a->>'stamina')::numeric,0)<(case when kind='double' then 19.5 else 26 end) then return players;end if;
 select (ord-1)::int,f into vi,v from jsonb_array_elements(players) with ordinality e(f,ord) where f->>'owner'=cmd->>'target' and private.ludus_enemy_v261(a,f);
 if v is null then return players;end if;
 reach:=case kind when 'net' then 6.2 when 'throw' then 9 when 'pull' then 2 when 'bash' then 2.2 when 'double' then 1.6 when 'sweep' then case when i->>'model'='halberd' then 2.5 else 1.95 end else 1.95 end;
 dist:=sqrt(power((a->>'x')::float-(v->>'x')::float,2)+power((a->>'z')::float-(v->>'z')::float,2));if dist>reach then return players;end if;
 duration:=case kind when 'double' then .68 when 'net' then .9 else .7 end;
 angle:=atan2((v->>'x')::float-(a->>'x')::float,(v->>'z')::float-(a->>'z')::float);
 s:=jsonb_build_object('id',key,'kind',kind,'hand',hand,'weapon',i->>'model','target',v->>'owner','start',ts,'stage',0,'range',reach,'impact',ts+(case kind when 'double' then .17 when 'net' then .3+dist/7.5 else .35 end)*interval '1 second','origin_x',a->'x','origin_z',a->'z','target_x',v->'x','target_z',v->'z');
 a:=a||jsonb_build_object('stamina',(a->>'stamina')::numeric-case when kind='double' then 13 else 26 end,'stamina_regen_at',ts+interval '1 second','angle',angle,
 'special_v261',s,'special_ready_v261',coalesce(a->'special_ready_v261','{}')||jsonb_build_object(hand,ts+interval '8 seconds'),
 'swing_end',ts+duration*interval '1 second','cooldown_until',ts+duration*interval '1 second','strike_at',null,'block',false,'guard_at',null,'move',0,'seen',ts);
 if kind='throw' then
  select coalesce(jsonb_agg(f),'[]') into gear from jsonb_array_elements(a->'items') f where f->>'equipped_slot'<>hand;
  stats:=private.ludus_combat_stats_v73(a->'gladiator',gear);
  a:=a||jsonb_build_object('projectile',jsonb_build_object('id',key,'weapon',i->>'model','hand',hand,'origin_x',a->'x','origin_z',a->'z','x',a->'x','z',a->'z','dx',sin(angle),'dz',cos(angle),
   'launch_at',ts+interval '270 milliseconds','expires_at',ts+interval '1020 milliseconds','tick_at',ts+interval '270 milliseconds','resolved',false,'launched',false,
   'attacker',jsonb_build_object('stats_version',a->'stats_version','items',a->'items','combat_stats',a->'combat_stats'),'base',30),
   'items',gear,'combat_stats',stats,'maxHp',stats->'maxHp','hp',least((a->>'hp')::int,(stats->>'maxHp')::int),'maxStamina',stats->'maxStamina','stamina',least((a->>'stamina')::numeric,(stats->>'maxStamina')::numeric),
   'gear_serial',coalesce((a->>'gear_serial')::int,0)+1,'throw_at',ts,'throw_until',ts+interval '700 milliseconds','throw_hand',hand,'throw_weapon',i->>'model');
 end if;
 return jsonb_set(players,array[idx::text],a);
end $$;

create function private.ludus_special_impact_v261(players jsonb,ai int,vi int,s jsonb,ts timestamptz) returns jsonb
language plpgsql set search_path='' as $$
declare a jsonb:=players->ai;v jsonb:=players->vi;facing float;guarded boolean;kind text:=s->>'kind';hit jsonb;amount int;gear jsonb;shield jsonb;stats jsonb;impact timestamptz:=(s->>'impact')::timestamptz;dx float;dz float;len float;along float;side float;
begin
 if not private.ludus_enemy_v261(a,v) then return players;end if;
 if sqrt(power((a->>'x')::float-(v->>'x')::float,2)+power((a->>'z')::float-(v->>'z')::float,2))>(s->>'range')::float then return players;end if;
 facing:=atan2((v->>'x')::float-(a->>'x')::float,(v->>'z')::float-(a->>'z')::float)-(a->>'angle')::float;
 if abs(atan2(sin(facing),cos(facing)))>1.05 or private.ludus_evade_avoids_v163(v,impact,'chest') then return players;end if;
 if kind='net' then
  dx:=(s->>'target_x')::float-(s->>'origin_x')::float;dz:=(s->>'target_z')::float-(s->>'origin_z')::float;len:=greatest(.001,sqrt(dx*dx+dz*dz));
  along:=(((v->>'x')::float-(s->>'origin_x')::float)*dx+((v->>'z')::float-(s->>'origin_z')::float)*dz)/len;
  side:=abs(((v->>'x')::float-(s->>'origin_x')::float)*dz-((v->>'z')::float-(s->>'origin_z')::float)*dx)/len;
  if side>.65 or along<0 or along>len+.65 then return players;end if;
  v:=v||jsonb_build_object('net_until',ts+interval '3 seconds','stagger_until',ts+interval '3 seconds','block',false,'guard_at',null,'strike_at',null,'special_v261',null);
 elsif kind='pull' then
  v:=v||jsonb_build_object('pull_from',a->>'owner','pull_until',ts+interval '6 seconds','pull_at',ts,'block',false,'strike_at',null,'special_v261',null);
  a:=a||jsonb_build_object('pull_target',v->>'owner','pull_serial',coalesce((a->>'pull_serial')::int,0)+1);
 elsif kind='bash' then
  dx:=(v->>'x')::float-(a->>'x')::float;dz:=(v->>'z')::float-(a->>'z')::float;len:=greatest(.001,sqrt(dx*dx+dz*dz));
  dx:=(v->>'x')::float+dx/len*.85;dz:=(v->>'z')::float+dz/len*.85;len:=greatest(1,sqrt(dx*dx+dz*dz)/10.5);
  v:=v||jsonb_build_object('x',dx/len,'z',dz/len,'knocked_at',ts,'knocked_until',ts+interval '1500 milliseconds','stagger_until',ts+interval '1500 milliseconds','block',false,'strike_at',null,'special_v261',null);
 elsif kind='disarm' then
  select f into shield from jsonb_array_elements(v->'items') f where f->>'kind'='weapon' order by f->>'equipped_slot' limit 1;
  if shield is null then return players;end if;
  select coalesce(jsonb_agg(f),'[]') into gear from jsonb_array_elements(v->'items') f where f<>shield;
  stats:=private.ludus_combat_stats_v73(v->'gladiator',gear);
  v:=v||jsonb_build_object('items',gear,'combat_stats',stats,'gear_serial',coalesce((v->>'gear_serial')::int,0)+1,'maxHp',stats->'maxHp','hp',least((v->>'hp')::numeric,(stats->>'maxHp')::numeric),'maxStamina',stats->'maxStamina','stamina',least((v->>'stamina')::numeric,(stats->>'maxStamina')::numeric));
 else
  facing:=atan2((a->>'x')::float-(v->>'x')::float,(a->>'z')::float-(v->>'z')::float)-(v->>'angle')::float;
  guarded:=coalesce((v->>'block')::boolean,false) and abs(atan2(sin(facing),cos(facing)))<1.35 and coalesce((v->>'stamina')::numeric,0)>=20 and exists(select 1 from jsonb_array_elements(v->'items') i where i->>'kind'='shield' and i->>'equipped_slot'='off_hand');
  if guarded then
   v:=v||jsonb_build_object('stamina',greatest(0,(v->>'stamina')::numeric-20),'stamina_regen_at',ts+interval '900 milliseconds','defense_serial',coalesce((v->>'defense_serial')::int,0)+1,'last_defense','block','defense_from',a->>'owner','defense_at',ts);
   if kind='breaker' then
    -- Break only the shield actually intercepted by this explicit special.
    select jsonb_agg(case when i->>'kind'='shield' and i->>'equipped_slot'='off_hand' then i||'{"breaker_hits_v168":1}'::jsonb else i end) into gear from jsonb_array_elements(v->'items') i;
    v:=private.ludus_shield_impact_v168(v||jsonb_build_object('items',gear),'mace');
   else
    a:=a||jsonb_build_object('stagger_until',ts+interval '230 milliseconds','special_v261',null);
   end if;
  else
   hit:=private.ludus_hit_v73(a,v,s->>'weapon',s->>'hand',14,random()::numeric,random()::numeric);amount:=(hit->>'damage')::int;
   hit:=ludus_career_private.hit(a,v,amount);a:=hit->0;v:=hit->1;
   v:=v||jsonb_build_object('hp',greatest(0,(v->>'hp')::int-amount),'hit_serial',coalesce((v->>'hit_serial')::int,0)+1,'hit_from',a->>'owner','hit_time',ts,'hit_impact_at',impact,'hit_region','chest','block',false,'guard_at',null);
  end if;
 end if;
 return jsonb_set(jsonb_set(players,array[ai::text],a),array[vi::text],v);
end $$;

create function private.ludus_resolve_special_v261(players jsonb,ts timestamptz) returns jsonb
language plpgsql set search_path='' as $$
declare ai int;vi int;second_idx int;a jsonb;v jsonb;s jsonb;stage int;kind text;phase int;
begin
 for ai in 0..jsonb_array_length(players)-1 loop
  a:=players->ai;s:=a->'special_v261';if s is null or s='null'::jsonb then continue;end if;
  kind:=s->>'kind';
  if (kind='throw' or (s->>'stage')::int>=2) and ts>(s->>'start')::timestamptz+interval '1500 milliseconds' then players:=jsonb_set(players,array[ai::text],a||'{"special_v261":null}'::jsonb);continue;end if;
  if kind='throw' then continue;end if;
  if (a->>'hp')::int<=0 or a->>'pull_from' is not null or coalesce((a->>'stagger_until')::timestamptz,'epoch')>ts then
   players:=jsonb_set(players,array[ai::text],a||'{"special_v261":null}'::jsonb);continue;
  end if;
  for phase in 0..1 loop
   a:=players->ai;s:=a->'special_v261';if s is null or s='null'::jsonb then exit;end if;
   stage:=(s->>'stage')::int;
   if (s->>'impact')::timestamptz>ts then exit;end if;
   if kind='double' and stage=1 then
    if (a->>'stamina')::numeric<6.5 then players:=jsonb_set(players,array[ai::text],a||'{"special_v261":null}'::jsonb);exit;end if;
    a:=a||jsonb_build_object('stamina',(a->>'stamina')::numeric-6.5,'stamina_regen_at',ts+interval '1 second');players:=jsonb_set(players,array[ai::text],a);
   end if;
   select (ord-1)::int,f into vi,v from jsonb_array_elements(players) with ordinality e(f,ord) where f->>'owner'=s->>'target';
   if vi is not null then
    second_idx:=null;
    if kind='sweep' then
     select (ord-1)::int into second_idx from jsonb_array_elements(players) with ordinality e(f,ord)
      where f->>'owner'<>v->>'owner' and private.ludus_enemy_v261(a,f)
       and sqrt(power((f->>'x')::float-(v->>'x')::float,2)+power((f->>'z')::float-(v->>'z')::float,2))<=1.8
       and sqrt(power((f->>'x')::float-(a->>'x')::float,2)+power((f->>'z')::float-(a->>'z')::float,2))<=(s->>'range')::float
      order by power((f->>'x')::float-(v->>'x')::float,2)+power((f->>'z')::float-(v->>'z')::float,2) limit 1;
    end if;
    players:=private.ludus_special_impact_v261(players,ai,vi,s,ts);
    if second_idx is not null then players:=private.ludus_special_impact_v261(players,ai,second_idx,s,ts);end if;
   end if;
   a:=players->ai;
   if kind='double' and stage=0 and a->>'special_v261' is not null then
    s:=s||jsonb_build_object('stage',1,'impact',(s->>'start')::timestamptz+interval '510 milliseconds');
   else s:=s||jsonb_build_object('stage',2,'impact','infinity');end if;
   players:=jsonb_set(players,array[ai::text],a||jsonb_build_object('special_v261',case when a->>'special_v261' is null then null else s end));
  end loop;
 end loop;
 return players;
end $$;

-- Keep the existing authenticated RPCs, collision engine, rewards and room locks.
do $patch$
declare sig text;src text;needle text:=$old$   attack_region:=coalesce(p_input->>'region','chest');$old$;
 replacement text:=$new$   -- Explicit hand specials are validated and paid on the server.
   if coalesce((p_input->>'special')::boolean,false) then
    r.players:=private.ludus_begin_special_v261(r.players,idx,p_input,ts);own:=r.players->idx;
    p_input:=p_input||'{"special":false,"attack":false,"dodge":false,"block":false,"x":0,"z":0}'::jsonb;
   end if;
   attack_region:=coalesce(p_input->>'region','chest');$new$;
begin
 foreach sig in array array['public.ludus_match(text,uuid,uuid,jsonb,jsonb)','ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamp with time zone)'] loop
  src:=pg_get_functiondef(sig::regprocedure);
  if length(src)-length(replace(src,needle,''))<>length(needle) then raise exception 'Unexpected input handler: %',sig;end if;
  execute replace(src,needle,replacement);
 end loop;
 foreach sig in array array['private.ludus_resolve_combat_v36(jsonb,timestamp with time zone)','ludus_ranked_match_private.resolve_combat_v248(jsonb,timestamp with time zone)'] loop
  src:=pg_get_functiondef(sig::regprocedure);
  needle:='if guarded and passive<>''parry'' then v:=private.ludus_shield_impact_v168(v,weapon);end if;';
  if position(needle in src)=0 then raise exception 'Unexpected shield impact handler: %',sig;end if;
  src:=replace(src,needle,'-- V261: shield breaking requires the explicit hand special.');
  if position('return players;' in src)=0 then raise exception 'Unexpected resolver: %',sig;end if;
  execute replace(src,'return players;','return private.ludus_resolve_special_v261(players,p_now);');
 end loop;
 src:=pg_get_functiondef('public.ludus_ranked_match_v252(text,uuid,uuid,jsonb,jsonb)'::regprocedure);
 if position('''tick_at''];' in src)=0 then raise exception 'Unexpected compact snapshot';end if;
 execute replace(src,'''tick_at''];','''tick_at'',''special_v261'',''special_ready_v261'',''net_until'',''knocked_at'',''knocked_until''];');
end $patch$;
revoke all on function private.ludus_special_kind_v261(jsonb),private.ludus_enemy_v261(jsonb,jsonb),private.ludus_begin_special_v261(jsonb,int,jsonb,timestamptz),private.ludus_special_impact_v261(jsonb,int,int,jsonb,timestamptz),private.ludus_resolve_special_v261(jsonb,timestamptz) from public,anon,authenticated;
