-- Foreground, three-minute invitations from rotating members of the owner's clan.
-- Only the existing owner-controlled NPC fleet may originate automatic invites.
create table ludus_ranked_party_private.incoming_v254 (
 user_id uuid primary key references public.ludus_accounts(user_id) on delete cascade,
 due_at timestamptz not null default (clock_timestamp()+interval '3 minutes'),
 last_seen timestamptz not null default clock_timestamp(),
 paused boolean not null default false,
 last_sender uuid,
 seen_senders uuid[] not null default '{}'
);
create table ludus_ranked_party_private.hosted_v254 (
 room_id uuid primary key references ludus_ranked_party_private.rooms_v244(id) on delete cascade,
 owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 last_seen timestamptz not null default clock_timestamp()
);
create index ranked_hosted_owner_v254 on ludus_ranked_party_private.hosted_v254(owner_id);
alter table ludus_ranked_party_private.incoming_v254 enable row level security;
alter table ludus_ranked_party_private.hosted_v254 enable row level security;
revoke all on ludus_ranked_party_private.incoming_v254,ludus_ranked_party_private.hosted_v254 from public,anon,authenticated;

create function ludus_ranked_party_private.host_owner_v254(p_room uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select h.owner_id from ludus_ranked_party_private.hosted_v254 h
 join ludus_ranked_party_private.rooms_v244 r on r.id=h.room_id
 join ludus_bot_private.settings_v233 s on s.id and s.enabled and s.ready and s.owner_id=h.owner_id
 join ludus_bot_private.members_v233 b on b.user_id=r.leader_id and b.enabled
 join public.ludus_clan_members hc on hc.user_id=h.owner_id
 join public.ludus_clan_members bc on bc.user_id=r.leader_id and bc.clan_id=hc.clan_id
 where h.room_id=p_room and not exists(
  select 1 from ludus_ranked_party_private.members_v244 m where m.room_id=p_room and m.user_id<>h.owner_id
   and not exists(select 1 from ludus_bot_private.members_v233 mb join public.ludus_clan_members mc on mc.user_id=mb.user_id
    where mb.user_id=m.user_id and mb.enabled and mc.clan_id=hc.clan_id));
$$;
revoke all on function ludus_ranked_party_private.host_owner_v254(uuid) from public,anon,authenticated;

-- Reuse the same NPC readiness, equipment snapshots, 5v5 combat and rewards.
-- A server-created bot-led room is the only additional permitted room type.
do $patch$
declare src text;needle text;replacement text;
begin
 src:=pg_get_functiondef('ludus_ranked_party_private.signature_v246(uuid,uuid)'::regprocedure);
 needle:='s.owner_id=r.leader_id';replacement:='(s.owner_id=r.leader_id or s.owner_id=ludus_ranked_party_private.host_owner_v254(r.id))';
 if position(needle in src)=0 then raise exception 'Unexpected ranked readiness source';end if;
 execute replace(src,needle,replacement);
 src:=pg_get_functiondef('ludus_bot_private.ranked_prepare_v249(uuid)'::regprocedure);
 needle:='where x.leader_id=p_owner';replacement:='where (x.leader_id=p_owner or ludus_ranked_party_private.host_owner_v254(x.id)=p_owner)';
 if position(needle in src)=0 then raise exception 'Unexpected ranked preparation source';end if;
 execute replace(src,needle,replacement);
 src:=pg_get_functiondef('ludus_bot_private.start_ranked_v249(uuid)'::regprocedure);
 if position(needle in src)=0 then raise exception 'Unexpected ranked start source';end if;
 execute replace(src,needle,replacement);
end $patch$;

create function ludus_ranked_party_private.incoming_action_v254(p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();s ludus_ranked_party_private.incoming_v254;
 cfg ludus_bot_private.settings_v233;cid uuid;sender uuid;roster uuid[];uid uuid;gid uuid;room uuid;result jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Önce hesabına giriş yap.';end if;
 if p_action is null or p_action not in ('pulse','pause') then raise exception 'Geçersiz davet işlemi.';end if;
 -- Match the established queue -> user -> room lock order, including acceptance.
 perform pg_advisory_xact_lock(hashtextextended('ranked-queue',248));
 perform pg_advisory_xact_lock(hashtextextended(u::text,244));
 insert into ludus_ranked_party_private.incoming_v254(user_id,due_at,last_seen) values(u,ts+interval '3 minutes',ts) on conflict do nothing;
 select * into s from ludus_ranked_party_private.incoming_v254 where user_id=u for update;
 -- Retire unanswered invitations and abandoned NPC lobbies without touching human rooms or live matches.
 delete from ludus_ranked_party_private.rooms_v244 r using ludus_ranked_party_private.hosted_v254 h
 where r.id=h.room_id and h.owner_id=u
  and not exists(select 1 from ludus_ranked_match_private.queue q where q.room_id=r.id and q.match_id is not null)
  and ((not exists(select 1 from ludus_ranked_party_private.members_v244 m where m.room_id=r.id and m.user_id=u)
   and (s.due_at<=ts or ludus_ranked_party_private.host_owner_v254(r.id) is distinct from u
    or not exists(select 1 from ludus_ranked_party_private.invites_v244 i where i.room_id=r.id and i.state='pending' and i.expires_at>ts)))
   or h.last_seen<ts-interval '5 minutes');
 if p_action='pause' or exists(select 1 from ludus_ranked_party_private.members_v244 where user_id=u)
  or exists(select 1 from public.ludus_matches m where m.status in ('waiting','playing') and m.updated_at>ts-interval '30 seconds'
   and m.players @> jsonb_build_array(jsonb_build_object('owner',u)))
  or exists(select 1 from public.ludus_battles b join public.ludus_gladiators g on g.id=b.gladiator_id where g.owner_id=u and b.finished_at is null)
  or exists(select 1 from public.ludus_duels d join public.ludus_gladiators g on g.id in(d.host_g,d.guest_g)
   where g.owner_id=u and d.status in ('waiting','playing') and d.updated_at>ts-interval '75 seconds') then
  update ludus_ranked_party_private.incoming_v254 set paused=true,due_at=ts+interval '3 minutes',last_seen=ts where user_id=u;
  return jsonb_build_object('invites','[]'::jsonb,'server_now',ts,'next_in_ms',180000,'paused',true);
 end if;
 if s.paused or s.last_seen<ts-interval '60 seconds' then s.due_at:=ts+interval '3 minutes';end if;
 update ludus_ranked_party_private.incoming_v254 set due_at=s.due_at,paused=false,last_seen=ts where user_id=u;
 select * into cfg from ludus_bot_private.settings_v233 where id;
 select clan_id into cid from public.ludus_clan_members where user_id=u;
 if s.due_at<=ts then
  -- The next interval is scheduled even if the fleet is busy: never flood or stack invites.
  s.due_at:=ts+interval '3 minutes';
  update ludus_ranked_party_private.incoming_v254 set due_at=s.due_at where user_id=u;
  if cfg.owner_id=u and cfg.enabled and cfg.ready and cid is not null then
   select array_agg(v.user_id order by v.slot) into roster from (
    select b.user_id,b.slot from ludus_bot_private.members_v233 b
    join public.ludus_clan_members c on c.user_id=b.user_id and c.clan_id=cid
    where b.enabled and b.user_id<>u
     and exists(select 1 from public.ludus_gladiators g where g.owner_id=b.user_id)
     and not exists(select 1 from ludus_ranked_party_private.members_v244 m where m.user_id=b.user_id)
     and not exists(select 1 from public.ludus_matches m where m.status in ('waiting','playing') and m.updated_at>ts-interval '30 seconds'
      and m.players @> jsonb_build_array(jsonb_build_object('owner',b.user_id)))
   )v;
   if coalesce(cardinality(roster),0)>=4 then
    select x into sender from unnest(roster) with ordinality v(x,n)
     where x is distinct from s.last_sender order by (x=any(s.seen_senders)),n limit 1;
    if sender is not null then
     if sender=any(s.seen_senders) then s.seen_senders:='{}';end if;
     insert into ludus_ranked_party_private.rooms_v244(leader_id) values(sender) returning id into room;
     insert into ludus_ranked_party_private.hosted_v254(room_id,owner_id) values(room,u);
     roster:=array[sender]||array(select x from unnest(roster) x where x<>sender limit 3);
     foreach uid in array roster loop
      select g.id into gid from public.ludus_gladiators g where g.owner_id=uid order by (g.status='available') desc,g.overall desc,g.id limit 1;
      insert into ludus_ranked_party_private.members_v244(room_id,user_id,gladiator_id,ready_signature)
       values(room,uid,gid,ludus_bot_private.ranked_signature_v249(uid,gid));
      insert into public.ludus_presence(user_id,last_seen) values(uid,ts) on conflict(user_id) do update set last_seen=excluded.last_seen;
     end loop;
     insert into ludus_ranked_party_private.invites_v244(room_id,target_id,expires_at) values(room,u,s.due_at);
     update ludus_ranked_party_private.incoming_v254 set last_sender=sender,seen_senders=s.seen_senders||sender where user_id=u;
    end if;
   end if;
  end if;
 end if;
 result:=public.ludus_ranked_party_v244('inbox');
 return result||jsonb_build_object('server_now',ts,'next_in_ms',greatest(1000,ceil(extract(epoch from (s.due_at-ts))*1000)),'paused',false);
end $$;
revoke all on function ludus_ranked_party_private.incoming_action_v254(text) from public,anon;
grant execute on function ludus_ranked_party_private.incoming_action_v254(text) to authenticated;
create function public.ludus_ranked_invites_v254(p_action text default 'pulse') returns jsonb
language sql security invoker set search_path='' as $$select ludus_ranked_party_private.incoming_action_v254(p_action)$$;
revoke all on function public.ludus_ranked_invites_v254(text) from public,anon;
grant execute on function public.ludus_ranked_invites_v254(text) to authenticated;

alter function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) rename to handle_before_incoming_v254;
revoke all on function ludus_ranked_party_private.handle_before_incoming_v254(text,uuid,uuid,uuid) from public,anon,authenticated;
create function ludus_ranked_party_private.handle_v244(p_action text,p_peer uuid,p_gladiator uuid,p_invite uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();mine uuid;hosted uuid;result jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Önce hesabına giriş yap.';end if;
 if p_action in ('accept','decline','leave','ready','start','select','unready','remove','invite') then
  perform pg_advisory_xact_lock(hashtextextended('ranked-queue',248));
 end if;
 select room_id into mine from ludus_ranked_party_private.members_v244 where user_id=u;
 if p_action in ('accept','decline') then select room_id into hosted from ludus_ranked_party_private.invites_v244 where id=p_invite and target_id=u;
 else hosted:=mine;end if;
 if exists(select 1 from ludus_ranked_party_private.hosted_v254 where room_id=hosted) then
  perform pg_advisory_xact_lock(hashtextextended('ranked-queue',248));
  perform 1 from ludus_ranked_party_private.rooms_v244 where id=hosted for update;
  if p_action not in ('leave','decline') and ludus_ranked_party_private.host_owner_v254(hosted) is distinct from u then
   raise exception 'Klan üyeliği değişti; bu davete katılamazsın.';
  end if;
  update ludus_ranked_party_private.hosted_v254 set last_seen=clock_timestamp() where room_id=hosted and owner_id=u;
 else hosted:=null;end if;
 result:=ludus_ranked_party_private.handle_before_incoming_v254(p_action,p_peer,p_gladiator,p_invite);
 if hosted is not null then
  if p_action in ('leave','decline') then
   delete from ludus_ranked_party_private.rooms_v244 r using ludus_ranked_party_private.hosted_v254 h
    where r.id=hosted and h.room_id=r.id and h.owner_id=u
     and not exists(select 1 from ludus_ranked_match_private.queue q where q.room_id=r.id and q.match_id is not null);
  elsif p_action='ready' then
   perform ludus_bot_private.start_ranked_v249(u);
   result:=ludus_ranked_party_private.handle_before_incoming_v254('state',null,null,null);
  end if;
  if result->'party'->>'id'=hosted::text then
   result:=jsonb_set(result,'{party,auto_start}','true'::jsonb);
  end if;
 end if;
 return result;
end $$;
revoke all on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) from public,anon;
grant execute on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) to authenticated;

-- Release the four NPCs after the match so the next invitation can use a new host.
alter function ludus_ranked_match_private.cleanup_match(uuid) rename to cleanup_before_incoming_v254;
create function ludus_ranked_match_private.cleanup_match(p_match uuid) returns void
language plpgsql security definer set search_path='' as $$
declare rooms uuid[];
begin
 select array_agg(q.room_id) into rooms from ludus_ranked_match_private.queue q
  join ludus_ranked_party_private.hosted_v254 h on h.room_id=q.room_id where q.match_id=p_match;
 perform ludus_ranked_match_private.cleanup_before_incoming_v254(p_match);
 delete from ludus_ranked_party_private.rooms_v244 where id=any(rooms);
end $$;
revoke all on function ludus_ranked_match_private.cleanup_before_incoming_v254(uuid),ludus_ranked_match_private.cleanup_match(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
