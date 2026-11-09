-- Owner-operated bot opponents and teammates for the ranked test fleet.
-- Bot equipment is copied into the match; the real inventory is not modified.
create table ludus_bot_private.ranked_sessions_v249 (
 match_id uuid primary key references public.ludus_matches(id) on delete cascade,
 owner_id uuid not null references public.ludus_accounts(user_id),
 bot_users uuid[] not null,
 last_tick timestamptz not null default '-infinity',
 last_error text,
 created_at timestamptz not null default clock_timestamp()
);
alter table ludus_bot_private.ranked_sessions_v249 enable row level security;
revoke all on ludus_bot_private.ranked_sessions_v249 from public,anon,authenticated;

create function ludus_bot_private.ranked_signature_v249(p_user uuid,p_gladiator uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(((to_jsonb(g)-array['status','fatigue_value','injured_until','training_ends_at','updated_at'])||
  jsonb_build_object('equipment',coalesce((select jsonb_agg(to_jsonb(i)-array['updated_at'] order by i.id)
   from public.ludus_items i where i.owner_id=p_user and i.equipped_by=g.id),'[]'::jsonb)))::text)
 from public.ludus_gladiators g join ludus_bot_private.members_v233 b on b.user_id=g.owner_id and b.enabled
 where g.id=p_gladiator and g.owner_id=p_user;
$$;
revoke all on function ludus_bot_private.ranked_signature_v249(uuid,uuid) from public,anon,authenticated;

-- Only fleet bots placed in the fleet owner's own party use the NPC snapshot.
-- Real players still pass the complete availability and equipment checks.
alter function ludus_ranked_party_private.signature_v246(uuid,uuid) rename to signature_human_v249;
create function ludus_ranked_party_private.signature_v246(p_user uuid,p_gladiator uuid)
returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from ludus_ranked_party_private.members_v244 m
  join ludus_ranked_party_private.rooms_v244 r on r.id=m.room_id
  join ludus_bot_private.settings_v233 s on s.id and s.ready and s.enabled and s.owner_id=r.leader_id
  join ludus_bot_private.members_v233 b on b.user_id=m.user_id and b.enabled
  where m.user_id=p_user and m.gladiator_id=p_gladiator)
 then ludus_bot_private.ranked_signature_v249(p_user,p_gladiator)
 else ludus_ranked_party_private.signature_human_v249(p_user,p_gladiator) end;
$$;
revoke all on function ludus_ranked_party_private.signature_human_v249(uuid,uuid),ludus_ranked_party_private.signature_v246(uuid,uuid) from public,anon,authenticated;

alter function ludus_ranked_match_private.signature_in_match(uuid,uuid,uuid) rename to signature_human_in_match_v249;
create function ludus_ranked_match_private.signature_in_match(p_user uuid,p_gladiator uuid,p_ignore uuid)
returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from ludus_bot_private.ranked_sessions_v249 s where s.match_id=p_ignore and p_user=any(s.bot_users))
 then (select f->>'ranked_signature' from public.ludus_matches m cross join lateral jsonb_array_elements(m.players) f
  where m.id=p_ignore and f->>'owner'=p_user::text and f->'gladiator'->>'id'=p_gladiator::text limit 1)
 else ludus_ranked_match_private.signature_human_in_match_v249(p_user,p_gladiator,p_ignore) end;
$$;
revoke all on function ludus_ranked_match_private.signature_human_in_match_v249(uuid,uuid,uuid),ludus_ranked_match_private.signature_in_match(uuid,uuid,uuid) from public,anon,authenticated;

create function ludus_bot_private.ranked_prepare_v249(p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare cfg ludus_bot_private.settings_v233;r ludus_ranked_party_private.rooms_v244;v record;g uuid;ts timestamptz:=clock_timestamp();
begin
 select * into cfg from ludus_bot_private.settings_v233 where id;
 if p_owner is null or p_owner is distinct from auth.uid() or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or p_owner is distinct from cfg.owner_id or not cfg.ready or not cfg.enabled then return;end if;
 -- Make the owner's clan bots discoverable while the owner has the team page open.
 insert into public.ludus_presence(user_id,last_seen)
 select b.user_id,ts from ludus_bot_private.members_v233 b join public.ludus_clan_members bc on bc.user_id=b.user_id
 join public.ludus_clan_members hc on hc.clan_id=bc.clan_id and hc.user_id=p_owner
 where b.enabled and b.user_id is not null
 on conflict(user_id) do update set last_seen=excluded.last_seen where ludus_presence.last_seen<excluded.last_seen-interval '20 seconds';
 select x.* into r from ludus_ranked_party_private.rooms_v244 x where x.leader_id=p_owner
  and exists(select 1 from ludus_ranked_party_private.members_v244 m where m.room_id=x.id and m.user_id=p_owner) order by x.created_at desc limit 1;
 if r.id is null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended('ranked-queue',248));
 perform 1 from ludus_ranked_party_private.rooms_v244 where id=r.id for update;
 if exists(select 1 from ludus_ranked_match_private.queue q where q.room_id=r.id and q.match_id is not null) then return;end if;
 -- Invitations to owned clan bots are accepted after one second.
 for v in select i.id,i.target_id from ludus_ranked_party_private.invites_v244 i
  join ludus_bot_private.members_v233 b on b.user_id=i.target_id and b.enabled
  where i.room_id=r.id and i.state='pending' and i.created_at<=ts-interval '1 second' and i.expires_at>ts
   and not exists(select 1 from ludus_ranked_party_private.members_v244 m where m.user_id=i.target_id)
   and not exists(select 1 from public.ludus_matches mm where mm.status in ('waiting','playing') and mm.updated_at>ts-interval '30 seconds'
    and mm.players @> jsonb_build_array(jsonb_build_object('owner',i.target_id)))
  order by i.created_at,i.id loop
  exit when (select count(*) from ludus_ranked_party_private.members_v244 where room_id=r.id)>=5;
  select gg.id into g from public.ludus_gladiators gg where gg.owner_id=v.target_id
   order by (gg.status='available') desc,gg.overall desc,gg.id limit 1;
  if g is null then continue;end if;
  insert into ludus_ranked_party_private.members_v244(room_id,user_id,gladiator_id) values(r.id,v.target_id,g) on conflict do nothing;
  if found then update ludus_ranked_party_private.invites_v244 set state=case when id=v.id then 'accepted' else 'cancelled' end where target_id=v.target_id and state='pending';end if;
 end loop;
 -- NPCs remain ready; human readiness is never changed here.
 update ludus_ranked_party_private.members_v244 m set ready_signature=ludus_bot_private.ranked_signature_v249(m.user_id,m.gladiator_id)
 where m.room_id=r.id and exists(select 1 from ludus_bot_private.members_v233 b where b.user_id=m.user_id and b.enabled);
end $$;
revoke all on function ludus_bot_private.ranked_prepare_v249(uuid) from public,anon,authenticated;

create function ludus_bot_private.start_ranked_v249(p_owner uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare cfg ludus_bot_private.settings_v233;r ludus_ranked_party_private.rooms_v244;v record;g public.ludus_gladiators;
 member ludus_ranked_party_private.members_v244;team_a uuid[];team_b uuid[];bot_users uuid[];uid uuid;g_id uuid;items jsonb;
 fighter jsonb;stats jsonb;players jsonb:='[]'::jsonb;mid uuid;ts timestamptz:=clock_timestamp();team text;is_bot boolean;bot_slot int;sig text;
begin
 select * into cfg from ludus_bot_private.settings_v233 where id;
 if p_owner is null or p_owner is distinct from auth.uid() or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or p_owner is distinct from cfg.owner_id or not cfg.ready or not cfg.enabled then raise exception 'Bot takımı kullanılamıyor.';end if;
 perform pg_advisory_xact_lock(hashtextextended('ranked-queue',248));
 select x.* into r from ludus_ranked_party_private.rooms_v244 x join ludus_ranked_party_private.members_v244 m on m.room_id=x.id and m.user_id=p_owner
  where x.leader_id=p_owner for update of x;
 if r.id is null then raise exception 'Önce takım kur.';end if;
 select q.match_id into mid from ludus_ranked_match_private.queue q where q.room_id=r.id;
 if mid is not null then return mid;end if;
 if exists(select 1 from ludus_ranked_party_private.members_v244 m left join public.ludus_presence p on p.user_id=m.user_id
  where m.room_id=r.id and (m.ready_signature is null or m.ready_signature is distinct from ludus_ranked_party_private.signature_v246(m.user_id,m.gladiator_id)
   or p.last_seen is null or p.last_seen<ts-interval '75 seconds')) then raise exception 'Önce tüm oyuncular READY olmalı.';end if;
 -- Complete the leader's team from their own clan, preferring explicitly invited bots.
 for v in select b.user_id,b.slot from ludus_bot_private.members_v233 b
  join public.ludus_clan_members bc on bc.user_id=b.user_id
  join public.ludus_clan_members hc on hc.user_id=p_owner and hc.clan_id=bc.clan_id
  where b.enabled and b.user_id is not null and not exists(select 1 from ludus_ranked_party_private.members_v244 m where m.user_id=b.user_id)
   and exists(select 1 from public.ludus_gladiators gg where gg.owner_id=b.user_id)
   and not exists(select 1 from public.ludus_matches mm where mm.status in('waiting','playing') and mm.updated_at>ts-interval '30 seconds'
     and mm.players @> jsonb_build_array(jsonb_build_object('owner',b.user_id)))
  order by exists(select 1 from ludus_ranked_party_private.invites_v244 i where i.room_id=r.id and i.target_id=b.user_id and i.state='pending') desc,b.slot loop
  exit when (select count(*) from ludus_ranked_party_private.members_v244 where room_id=r.id)>=5;
  select gg.id into g_id from public.ludus_gladiators gg where gg.owner_id=v.user_id order by (gg.status='available') desc,gg.overall desc,gg.id limit 1;
  insert into ludus_ranked_party_private.members_v244(room_id,user_id,gladiator_id) values(r.id,v.user_id,g_id) on conflict do nothing;
  if found then
   update ludus_ranked_party_private.members_v244 set ready_signature=ludus_bot_private.ranked_signature_v249(v.user_id,g_id) where room_id=r.id and user_id=v.user_id;
   update ludus_ranked_party_private.invites_v244 set state=case when room_id=r.id then 'accepted' else 'cancelled' end where target_id=v.user_id and state='pending';
  end if;
 end loop;
 select array_agg(m.user_id order by (m.user_id=p_owner) desc,m.joined_at,m.user_id) into team_a from ludus_ranked_party_private.members_v244 m where m.room_id=r.id;
 if cardinality(team_a)<>5 then raise exception 'Klanında dört uygun bot bulunamadı.';end if;
 select array_agg(z.user_id order by z.slot) into team_b from (
  select b.user_id,b.slot from ludus_bot_private.members_v233 b where b.enabled and b.user_id<>all(team_a)
   and not exists(select 1 from ludus_ranked_party_private.members_v244 m where m.user_id=b.user_id)
   and exists(select 1 from public.ludus_gladiators gg where gg.owner_id=b.user_id)
   and not exists(select 1 from public.ludus_matches mm where mm.status in('waiting','playing') and mm.updated_at>ts-interval '30 seconds'
     and mm.players @> jsonb_build_array(jsonb_build_object('owner',b.user_id)))
  order by md5(p_owner::text||b.user_id::text||date_trunc('minute',ts)::text),b.slot limit 5
 ) z;
 if cardinality(team_b)<>5 then raise exception 'Beş rakip bot bulunamadı.';end if;
 select array_agg(b.user_id order by b.slot) into bot_users from ludus_bot_private.members_v233 b where b.enabled and b.user_id<>p_owner and b.user_id=any(team_a||team_b);
 perform 1 from public.ludus_accounts a where a.user_id=any(team_a||team_b) order by a.user_id for update;
 foreach uid in array team_a||team_b loop
  is_bot:=uid=any(bot_users);select b.slot into bot_slot from ludus_bot_private.members_v233 b where b.user_id=uid and b.enabled;
  if uid=any(team_a) then
   select * into member from ludus_ranked_party_private.members_v244 where room_id=r.id and user_id=uid;
   if not found then raise exception 'Takım üyesi bulunamadı.';end if;
   g_id:=member.gladiator_id;
   if not is_bot and (member.ready_signature is null or member.ready_signature is distinct from ludus_ranked_party_private.signature_v246(uid,g_id)) then raise exception 'Oyuncu artık hazır değil.';end if;
  else
   select gg.id into g_id from public.ludus_gladiators gg where gg.owner_id=uid order by (gg.status='available') desc,gg.overall desc,gg.id limit 1;
  end if;
  select * into g from public.ludus_gladiators where id=g_id and owner_id=uid;
  if g.id is null then raise exception 'Gladyatör bulunamadı.';end if;
  select coalesce(jsonb_agg(to_jsonb(i)||case when is_bot and i.kind='weapon' then jsonb_build_object('enhancement',4+mod(bot_slot,3)) else '{}'::jsonb end order by i.equipped_slot,i.id),'[]'::jsonb)
   into items from public.ludus_items i where i.owner_id=uid and i.equipped_by=g.id;
  if exists(select 1 from jsonb_array_elements(items) i where i->>'equipped_slot' not in ('main_hand','off_hand','helmet','chest','gloves','legs')
   or not ((i->>'equipped_slot'='main_hand' and i->>'kind'='weapon') or (i->>'equipped_slot'='off_hand' and i->>'kind' in ('weapon','shield')) or (i->>'equipped_slot' in ('helmet','chest','gloves','legs') and i->>'equipped_slot'=i->>'kind')))
   or jsonb_array_length(items)<>(select count(distinct i->>'equipped_slot') from jsonb_array_elements(items) i) then raise exception 'Ekipman yuvaları doğrulanamadı.';end if;
  sig:=case when is_bot then ludus_bot_private.ranked_signature_v249(uid,g.id) else member.ready_signature end;
  if sig is null then raise exception 'Gladyatör hazırlığı doğrulanamadı.';end if;
  team:=case when uid=any(team_a) then 'a' else 'b' end;
  fighter:=jsonb_build_object('owner',uid,'ranked_team',team,'ranked_joined',is_bot,'ranked_signature',sig,'bot_v249',is_bot,'name',g.name,'class',g.class,
   'gladiator',to_jsonb(g)||ludus_food_private.combat_snapshot_v77(uid),'items',items,'career',jsonb_build_object('version',162,'assist_version',200,'kills',0,'deaths',0,'damage',0,'damageTaken',0,'contributors','{}'::jsonb),
   'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'maxStamina',100,'stamina',100,'stamina_at',ts,'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0);
  stats:=private.ludus_combat_stats_v73(fighter->'gladiator',items);
  fighter:=fighter||jsonb_build_object('stats_version',77,'combat_stats',stats,'hp',(stats->>'maxHp')::numeric::int,'maxHp',(stats->>'maxHp')::numeric::int,'stamina',(stats->>'maxStamina')::numeric::int,'maxStamina',(stats->>'maxStamina')::numeric::int);
  players:=players||jsonb_build_array(fighter);
 end loop;
 insert into public.ludus_matches(venue,pit_version,players,starts_at,updated_at) values('ranked',0,players,ts+interval '120 seconds',ts) returning id into mid;
 insert into ludus_bot_private.ranked_sessions_v249(match_id,owner_id,bot_users) values(mid,p_owner,bot_users);
 insert into ludus_ranked_match_private.matches(id,team_a,team_b) values(mid,team_a,team_b);
 insert into ludus_ranked_match_private.queue(room_id,match_id) values(r.id,mid) on conflict(room_id) do update set match_id=excluded.match_id;
 update ludus_ranked_party_private.invites_v244 set state='cancelled' where room_id=r.id and state='pending';
 return mid;
end $$;
revoke all on function ludus_bot_private.start_ranked_v249(uuid) from public,anon,authenticated;

alter function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) rename to handle_before_bots_v249;
create function ludus_ranked_party_private.handle_v244(p_action text,p_peer uuid,p_gladiator uuid,p_invite uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();cfg ludus_bot_private.settings_v233;result jsonb;
begin
 select * into cfg from ludus_bot_private.settings_v233 where id;
 if u is not null and u=cfg.owner_id and cfg.ready and cfg.enabled then
  perform ludus_bot_private.ranked_prepare_v249(u);
  if p_action='start' then
   perform ludus_bot_private.start_ranked_v249(u);
   return ludus_ranked_party_private.handle_before_bots_v249('state',null,null,null);
  end if;
 end if;
 return ludus_ranked_party_private.handle_before_bots_v249(p_action,p_peer,p_gladiator,p_invite);
end $$;
revoke all on function ludus_ranked_party_private.handle_before_bots_v249(text,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) from public,anon;
grant execute on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) to authenticated;

-- Both online modes use the same bounded combat controls as human players.
-- Bots consider weapon reach, stamina and a visible enemy attack before acting.
create function ludus_bot_private.tactics_v249(p jsonb,e jsonb,t timestamptz) returns jsonb
language plpgsql volatile set search_path='' as $$
declare dx float;dz float;dist float;nx float;nz float;side float;mx float:=0;mz float:=0;spacing float;stamina float;
 weapon text;shield boolean;threat boolean;guarding boolean:=false;dodging boolean:=false;attacking boolean:=false;region text;roll int;cmd text;
begin
 dx:=coalesce((e->>'x')::float,0)-coalesce((p->>'x')::float,0);dz:=coalesce((e->>'z')::float,0)-coalesce((p->>'z')::float,0);
 dist:=sqrt(dx*dx+dz*dz);nx:=dx/greatest(dist,.01);nz:=dz/greatest(dist,.01);stamina:=coalesce((p->>'stamina')::float,100);
 select i->>'model' into weapon from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) i where i->>'kind'='weapon' and i->>'equipped_slot'='main_hand' limit 1;
 shield:=exists(select 1 from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) i where i->>'kind'='shield' and i->>'equipped_slot'='off_hand');
 spacing:=case when weapon in('spear','trident','trident_gladiator','halberd') then 1.85 when weapon='whip' then 1.35 when weapon is null then .9 else 1.15 end;
 side:=case when mod(abs(hashtext(coalesce(p->>'owner',''))::bigint),2)=0 then 1 else -1 end;
 roll:=mod(abs(hashtext(coalesce(p->>'owner','')||':'||coalesce(e->>'serial','0'))::bigint),100);
 threat:=e->>'strike_target'=p->>'owner' and coalesce((e->>'swing_at')::timestamptz,'epoch')<=t-interval '120 milliseconds'
  and coalesce((e->>'strike_at')::timestamptz,'epoch')>=t-interval '80 milliseconds' and dist<3.0;
 if threat and stamina>=25 then
  if shield and roll<83 then guarding:=true;
  elsif stamina>=33 and roll<90 then dodging:=true;end if;
 end if;
 if stamina<28 and dist<3 then mx:=-nx*.8+nz*side*.35;mz:=-nz*.8-nx*side*.35;
 elsif dist>spacing then mx:=nx;mz:=nz;
 elsif dist<spacing*.65 then mx:=-nx*.6;mz:=-nz*.6;
 else mx:=nz*side*.22;mz:=-nx*side*.22;end if;
 if guarding then mx:=0;mz:=0;end if;
 if dodging then mx:=nz*side;mz:=-nx*side;end if;
 attacking:=not guarding and not dodging and stamina>=26 and dist<=spacing+.3 and coalesce((p->>'cooldown_until')::timestamptz,'epoch')<=t;
 if not exists(select 1 from jsonb_array_elements(coalesce(e->'items','[]'::jsonb)) i where i->>'equipped_slot'='helmet') then region:='head';
 elsif not exists(select 1 from jsonb_array_elements(coalesce(e->'items','[]'::jsonb)) i where i->>'equipped_slot'='chest') then region:='chest';
 else region:=case mod(roll,3) when 0 then 'legs' when 1 then 'leftArm' else 'rightArm' end;end if;
 cmd:=coalesce(e->>'owner','target')||':'||coalesce(e->>'serial','0');
 return jsonb_build_object('x',greatest(-1,least(1,mx)),'z',greatest(-1,least(1,mz)),'target',e->>'owner',
  'attack',attacking,'attack_id',gen_random_uuid()::text,'region',region,'hand','main_hand','block',guarding,
  'dodge',dodging,'dodge_id',cmd,'dodge_kind','roll');
end $$;
revoke all on function ludus_bot_private.tactics_v249(jsonb,jsonb,timestamptz) from public,anon,authenticated;

create function ludus_bot_private.ranked_tick_v249(p_match uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare session_row ludus_bot_private.ranked_sessions_v249;room public.ludus_matches;bot_user uuid;player jsonb;enemy jsonb;
 ts timestamptz:=clock_timestamp();original_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),'');
begin
 if p_user is null or p_user is distinct from auth.uid() then return;end if;
 select s.* into session_row from ludus_bot_private.ranked_sessions_v249 s join public.ludus_matches m on m.id=s.match_id
  where s.match_id=p_match and not p_user=any(s.bot_users)
   and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=p_user::text) for update of s;
 if not found or session_row.last_tick>ts-interval '250 milliseconds' then return;end if;
 update ludus_bot_private.ranked_sessions_v249 set last_tick=ts,last_error=null where match_id=p_match;
 select * into room from public.ludus_matches where id=p_match for update;
 if not found or room.venue<>'ranked' or room.status not in('waiting','playing') then return;end if;
 if room.status='waiting' then
  select coalesce(jsonb_agg(case when (p->>'owner')::uuid=any(session_row.bot_users)
   then p||jsonb_build_object('seen',ts,'ranked_joined',true) else p end order by ord),'[]'::jsonb)
   into room.players from jsonb_array_elements(room.players) with ordinality x(p,ord);
  update public.ludus_matches set players=room.players,updated_at=ts where id=room.id;return;
 end if;
 foreach bot_user in array session_row.bot_users loop
  select * into room from public.ludus_matches where id=p_match;
  exit when room.status<>'playing';
  select p into player from jsonb_array_elements(room.players) p where p->>'owner'=bot_user::text and coalesce((p->>'hp')::numeric,0)>0;
  if not found then continue;end if;
  select p into enemy from jsonb_array_elements(room.players) p where p->>'ranked_team'<>player->>'ranked_team' and coalesce((p->>'hp')::numeric,0)>0
   order by power((p->>'x')::float-(player->>'x')::float,2)+power((p->>'z')::float-(player->>'z')::float,2)
    -case when p->>'strike_target'=bot_user::text then 1.5 else 0 end,p->>'owner' limit 1;
  if not found then continue;end if;
  begin
   perform set_config('request.jwt.claim.sub',bot_user::text,true);
   perform public.ludus_ranked_match_v248('step',room.id,null,'{}'::jsonb,ludus_bot_private.tactics_v249(player,enemy,ts));
   perform set_config('request.jwt.claim.sub',original_sub,true);
  exception when others then
   perform set_config('request.jwt.claim.sub',original_sub,true);
   update ludus_bot_private.ranked_sessions_v249 set last_error=left(sqlerrm,200) where match_id=p_match;
  end;
 end loop;
exception when others then
 perform set_config('request.jwt.claim.sub',original_sub,true);raise;
end $$;
revoke all on function ludus_bot_private.ranked_tick_v249(uuid,uuid) from public,anon,authenticated;

-- Any real participant can advance the bots; bot requests do not recurse.
do $patch$
declare src text:=pg_get_functiondef('ludus_ranked_match_private.match_step(text,uuid,uuid,jsonb,jsonb)'::regprocedure);
 needle text:=$old$ return jsonb_build_object('id',r.id,'venue',r.venue,'status',r.status,'starts_at',r.starts_at,'server_now',ts,'players',r.players,'winner',r.winner,'combat_version',23$old$;
 injection text:=$new$ if p_action in ('state','step') and exists(select 1 from ludus_bot_private.ranked_sessions_v249 s where s.match_id=r.id and not u=any(s.bot_users)) then
  perform ludus_bot_private.ranked_tick_v249(r.id,u);
  select * into r from public.ludus_matches where id=r.id;
  ts:=clock_timestamp();
 end if;
$new$;
begin
 if position(needle in src)=0 then raise exception 'Unexpected ranked match handler';end if;
 if position('ranked_tick_v249' in src)>0 then raise exception 'Ranked bot tick already installed';end if;
 execute replace(src,needle,injection||needle);
end $patch$;

-- Existing owner-operated multiplayer and Aventinus bots use the same tactical
-- decisions. Equipment upgrades are match-local and do not alter inventory.
do $patch$
declare src text:=pg_get_functiondef('ludus_bot_private.online_assist_v237(uuid,uuid)'::regprocedure);
 old_gear text:=$old$jsonb_agg(to_jsonb(i) order by i.equipped_slot)$old$;
 new_gear text:=$new$jsonb_agg(to_jsonb(i)||case when i.kind='weapon' then jsonb_build_object('enhancement',4+mod(b.slot,3)) else '{}'::jsonb end order by i.equipped_slot)$new$;
 old_loan text:=$old$gear:=jsonb_build_array(ludus_pit_private.loan('pit_stone_mace'));$old$;
 new_loan text:=$new$gear:=jsonb_build_array(ludus_pit_private.loan('pit_stone_mace')||jsonb_build_object('enhancement',4+mod(b.slot,3)));$new$;
 old_available text:=$old$where m.enabled and g.status='available' and g.fatigue_value<100 and g.clan_roster_id is null
      and (g.injured_until is null or g.injured_until<=ts)
      and (g.training_ends_at is null or g.training_ends_at<=ts)
      and not exists(select 1 from public.ludus_battles q where q.gladiator_id=g.id and q.finished_at is null)$old$;
 new_available text:=$new$where m.enabled and not exists(select 1 from ludus_ranked_party_private.members_v244 party_bot where party_bot.user_id=m.user_id)$new$;
 old_order text:=$old$order by m.slot,g.overall desc,g.id$old$;
 new_order text:=$new$order by m.slot,(g.status='available') desc,g.overall desc,g.id$new$;
 old_input text:=$old$jsonb_build_object(
    'x',case when dist>1.45 then dx/greatest(dist,.01) else 0 end,
    'z',case when dist>1.45 then dz/greatest(dist,.01) else 0 end,
    'attack',dist<=2.15,'attack_id',gen_random_uuid()::text,'target',enemy->>'owner','region','chest','hand','main_hand')$old$;
 new_input text:=$new$ludus_bot_private.tactics_v249(player,enemy,ts)$new$;
begin
 if position(old_gear in src)=0 or position(old_loan in src)=0 or position(old_available in src)=0 or position(old_order in src)=0 or position(old_input in src)=0 then raise exception 'Unexpected legacy multiplayer bot handler';end if;
 src:=replace(src,old_gear,new_gear);src:=replace(src,old_loan,new_loan);src:=replace(src,old_available,new_available);
 src:=replace(src,old_order,new_order);src:=replace(src,old_input,new_input);
 src:=replace(src,$old$session_row.last_tick>ts-interval '500 milliseconds'$old$,$new$session_row.last_tick>ts-interval '250 milliseconds'$new$);
 execute src;
end $patch$;
notify pgrst,'reload schema';
