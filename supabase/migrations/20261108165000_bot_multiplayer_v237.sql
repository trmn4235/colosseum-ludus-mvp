-- The fleet owner can meet their existing bot accounts in the real multiplayer
-- arena. Bot actions go through the same authoritative combat RPC as a player.
create table ludus_bot_private.online_rooms_v237(
 match_id uuid primary key references public.ludus_matches(id) on delete cascade,
 owner_id uuid not null references public.ludus_accounts(user_id),
 bot_users uuid[] not null default '{}',
 last_tick timestamptz not null default '-infinity',
 last_error text,
 created_at timestamptz not null default clock_timestamp()
);
alter table ludus_bot_private.online_rooms_v237 enable row level security;
revoke all on ludus_bot_private.online_rooms_v237 from public,anon,authenticated;

create function ludus_bot_private.online_assist_v237(p_match uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare cfg ludus_bot_private.settings_v233; room public.ludus_matches; session_row ludus_bot_private.online_rooms_v237;
 b record; fighter public.ludus_gladiators; candidate jsonb; gear jsonb; stats jsonb; player jsonb; enemy jsonb;
 added uuid[]:='{}'; bot_user uuid; needed integer; dx double precision; dz double precision; dist double precision;
 ts timestamptz:=clock_timestamp(); original_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),'');
begin
 select * into cfg from ludus_bot_private.settings_v233 where id;
 if p_user is null or p_user is distinct from auth.uid() or p_user is distinct from cfg.owner_id or not cfg.ready or not cfg.enabled then return; end if;
 select * into room from public.ludus_matches where id=p_match for update;
 if not found or room.status not in('waiting','playing') or room.venue not in('colosseum','pit')
  or not exists(select 1 from jsonb_array_elements(room.players) x where x->>'owner'=p_user::text) then return; end if;

 if room.status='waiting' then
  needed:=greatest(0,4-jsonb_array_length(room.players));
  if needed>0 then
   for b in
    select * from (
     select distinct on(m.slot) m.slot,m.user_id,g.id as gladiator_id
     from ludus_bot_private.members_v233 m join public.ludus_gladiators g on g.owner_id=m.user_id
     where m.enabled and g.status='available' and g.fatigue_value<100 and g.clan_roster_id is null
      and (g.injured_until is null or g.injured_until<=ts)
      and (g.training_ends_at is null or g.training_ends_at<=ts)
      and not exists(select 1 from public.ludus_battles q where q.gladiator_id=g.id and q.finished_at is null)
      and not exists(select 1 from public.ludus_matches q where q.status in('waiting','playing') and q.updated_at>ts-interval '30 seconds'
       and q.players @>jsonb_build_array(jsonb_build_object('owner',m.user_id)))
     order by m.slot,g.overall desc,g.id
    ) candidates order by md5(p_match::text||user_id::text) limit needed
   loop
    select * into fighter from public.ludus_gladiators where id=b.gladiator_id and owner_id=b.user_id;
    if room.venue='pit' then gear:=jsonb_build_array(ludus_pit_private.loan('pit_stone_mace'));
    else
     select coalesce(jsonb_agg(to_jsonb(i) order by i.equipped_slot),'[]'::jsonb) into gear
     from public.ludus_items i where i.owner_id=b.user_id and i.equipped_by=fighter.id
      and i.equipped_slot in('main_hand','off_hand','helmet','chest','gloves','legs')
      and i.locked_battle_id is null and i.clan_vault_id is null and i.clan_roster_id is null and i.market_listing_id is null;
    end if;
    candidate:=jsonb_build_object('owner',b.user_id,'name',fighter.name||' (Bot)','class',fighter.class,
     'gladiator',to_jsonb(fighter)||ludus_food_private.combat_snapshot_v77(b.user_id),'items',gear,
     'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'maxStamina',100,'stamina',100,'stamina_at',ts,
     'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0,
     'bot_v237',true);
    stats:=private.ludus_combat_stats_v73(candidate->'gladiator',gear);
    candidate:=candidate||jsonb_build_object('stats_version',77,'combat_stats',stats,'hp',(stats->>'maxHp')::numeric::int,
     'maxHp',(stats->>'maxHp')::numeric::int,'stamina',(stats->>'maxStamina')::numeric::int,'maxStamina',(stats->>'maxStamina')::numeric::int);
    room.players:=room.players||jsonb_build_array(candidate);added:=array_append(added,b.user_id);
   end loop;
   if cardinality(added)>0 then
    update public.ludus_matches set players=room.players,updated_at=ts where id=room.id;
    insert into ludus_bot_private.online_rooms_v237(match_id,owner_id,bot_users)
     values(room.id,p_user,added) on conflict(match_id) do update
     set bot_users=(select array_agg(distinct x) from unnest(ludus_bot_private.online_rooms_v237.bot_users||excluded.bot_users) x);
   end if;
  end if;
 end if;
 select * into session_row from ludus_bot_private.online_rooms_v237 where match_id=room.id and owner_id=p_user for update;
 if not found or session_row.last_tick>ts-interval '500 milliseconds' then return;end if;
 update ludus_bot_private.online_rooms_v237 set last_tick=ts,last_error=null where match_id=room.id;
 if room.status='waiting' then
  select coalesce(jsonb_agg(case when (p->>'owner')::uuid=any(session_row.bot_users)
   then p||jsonb_build_object('seen',ts) else p end order by ord),'[]'::jsonb)
   into room.players from jsonb_array_elements(room.players) with ordinality x(p,ord);
  update public.ludus_matches set players=room.players,updated_at=ts where id=room.id;
  return;
 end if;

 foreach bot_user in array session_row.bot_users loop
  select * into room from public.ludus_matches where id=p_match;
  exit when room.status<>'playing';
  if not exists(select 1 from ludus_bot_private.members_v233 m where m.user_id=bot_user and m.enabled) then continue;end if;
  select p into player from jsonb_array_elements(room.players) p where p->>'owner'=bot_user::text and coalesce((p->>'hp')::numeric,0)>0;
  if not found then continue;end if;
  select p into enemy from jsonb_array_elements(room.players) p where p->>'owner'<>bot_user::text and coalesce((p->>'hp')::numeric,0)>0
   order by power((p->>'x')::float-(player->>'x')::float,2)+power((p->>'z')::float-(player->>'z')::float,2) limit 1;
  if not found then continue;end if;
  dx:=(enemy->>'x')::float-(player->>'x')::float;dz:=(enemy->>'z')::float-(player->>'z')::float;dist:=sqrt(dx*dx+dz*dz);
  begin
   perform set_config('request.jwt.claim.sub',bot_user::text,true);
   perform public.ludus_match('step',room.id,null,'{}'::jsonb,jsonb_build_object(
    'x',case when dist>1.45 then dx/greatest(dist,.01) else 0 end,
    'z',case when dist>1.45 then dz/greatest(dist,.01) else 0 end,
    'attack',dist<=2.15,'attack_id',gen_random_uuid()::text,'target',enemy->>'owner','region','chest','hand','main_hand'));
   perform set_config('request.jwt.claim.sub',original_sub,true);
  exception when others then
   perform set_config('request.jwt.claim.sub',original_sub,true);
   update ludus_bot_private.online_rooms_v237 set last_error=left(sqlerrm,200) where match_id=p_match;
  end;
 end loop;
exception when others then
 perform set_config('request.jwt.claim.sub',original_sub,true);
 raise;
end;$$;
revoke all on function ludus_bot_private.online_assist_v237(uuid,uuid) from public,anon,authenticated;

-- Preserve the game's original matchmaking and combat body; attach assistance
-- only after a real user's authorized join, state or step has been processed.
do $patch$
declare source text; needle text:='return jsonb_build_object(''id'',r.id,''venue'',r.venue'; pos integer;
 injection text:=$inject$
 if u=(select owner_id from ludus_bot_private.settings_v233 where id) and p_action in('join','state','step') then
  begin
   perform ludus_bot_private.online_assist_v237(r.id,u);
   select * into r from public.ludus_matches where id=r.id;
   ts:=clock_timestamp();
  exception when others then null;
  end;
 end if;
 $inject$;
begin
 select pg_get_functiondef('public.ludus_match(text,uuid,uuid,jsonb,jsonb)'::regprocedure) into source;
 if position('online_assist_v237' in source)>0 then raise exception 'Bot multiplayer is already installed.';end if;
 pos:=position(needle in source);if pos=0 then raise exception 'Unexpected multiplayer function; bot assist was not installed.';end if;
 source:=overlay(source placing injection||needle from pos for length(needle));execute source;
end;$patch$;
notify pgrst,'reload schema';
