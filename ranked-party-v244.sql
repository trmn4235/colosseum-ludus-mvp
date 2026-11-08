-- Five-person ranked preparation: authenticated party and invitation state.
-- Ranked battles and rating settlement are intentionally not enabled here.
create schema if not exists ludus_ranked_party_private;
revoke all on schema ludus_ranked_party_private from public,anon;
grant usage on schema ludus_ranked_party_private to authenticated,service_role;

create table ludus_ranked_party_private.rooms_v244 (
 id uuid primary key default gen_random_uuid(),
 leader_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 created_at timestamptz not null default clock_timestamp()
);
create table ludus_ranked_party_private.members_v244 (
 room_id uuid not null references ludus_ranked_party_private.rooms_v244(id) on delete cascade,
 user_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 gladiator_id uuid not null references public.ludus_gladiators(id),
 joined_at timestamptz not null default clock_timestamp(),
 primary key(room_id,user_id), unique(user_id)
);
create table ludus_ranked_party_private.invites_v244 (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references ludus_ranked_party_private.rooms_v244(id) on delete cascade,
 target_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '5 minutes'),
 unique(room_id,target_id)
);
create index ranked_party_invites_target_v244 on ludus_ranked_party_private.invites_v244(target_id,expires_at) where state='pending';
alter table ludus_ranked_party_private.rooms_v244 enable row level security;
alter table ludus_ranked_party_private.members_v244 enable row level security;
alter table ludus_ranked_party_private.invites_v244 enable row level security;
revoke all on ludus_ranked_party_private.rooms_v244,ludus_ranked_party_private.members_v244,ludus_ranked_party_private.invites_v244 from public,anon,authenticated;

create function ludus_ranked_party_private.handle_v244(p_action text,p_peer uuid,p_gladiator uuid,p_invite uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); r ludus_ranked_party_private.rooms_v244; i ludus_ranked_party_private.invites_v244;
 fighter public.ludus_gladiators; mine uuid; allowed boolean; now_at timestamptz:=clock_timestamp();
 party jsonb; inbox jsonb; choices jsonb; roster jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Giriş yapmalısın.';end if;
 if p_action is null or p_action not in ('state','inbox','create','invite','accept','decline','leave','select','remove') then raise exception 'Geçersiz işlem.';end if;
 if p_action in ('create','accept','leave') then perform pg_advisory_xact_lock(hashtextextended(u::text,244));end if;
 select room_id into mine from ludus_ranked_party_private.members_v244 where user_id=u;

 if p_action='create' and mine is null then
  select * into fighter from public.ludus_gladiators where owner_id=u and (p_gladiator is null or id=p_gladiator)
   and status='available' and fatigue_value<100 and clan_roster_id is null and (injured_until is null or injured_until<=now_at)
   and (training_ends_at is null or training_ends_at<=now_at) order by overall desc,id limit 1;
  if not found then raise exception 'Hazır bir gladyatör seç.';end if;
  insert into ludus_ranked_party_private.rooms_v244(leader_id) values(u) returning * into r;
  insert into ludus_ranked_party_private.members_v244(room_id,user_id,gladiator_id) values(r.id,u,fighter.id);
  update ludus_ranked_party_private.invites_v244 set state='cancelled' where target_id=u and state='pending';
  mine:=r.id;
 elsif p_action='invite' then
  select * into r from ludus_ranked_party_private.rooms_v244 where id=mine and leader_id=u for update;
  if not found then raise exception 'Davetleri takım lideri gönderebilir.';end if;
  if p_peer is null or p_peer=u then raise exception 'Bir oyuncu seç.';end if;
  select exists(select 1 from public.ludus_friends f where f.state='accepted' and ((f.requester=u and f.target=p_peer) or (f.target=u and f.requester=p_peer)))
   or exists(select 1 from public.ludus_clan_members a join public.ludus_clan_members b on a.clan_id=b.clan_id where a.user_id=u and b.user_id=p_peer) into allowed;
  if not allowed then raise exception 'Yalnızca arkadaşını veya klan üyesini davet edebilirsin.';end if;
  if not exists(select 1 from public.ludus_presence p where p.user_id=p_peer and p.last_seen>now_at-interval '75 seconds') then raise exception 'Oyuncu çevrimiçi değil.';end if;
  if exists(select 1 from ludus_ranked_party_private.members_v244 where user_id=p_peer) then raise exception 'Oyuncu zaten bir takımda.';end if;
  if not exists(select 1 from ludus_ranked_party_private.invites_v244 where room_id=r.id and target_id=p_peer and state='pending' and expires_at>now_at)
   and (select count(*) from ludus_ranked_party_private.members_v244 where room_id=r.id)
    +(select count(*) from ludus_ranked_party_private.invites_v244 where room_id=r.id and state='pending' and expires_at>now_at)>=5
   then raise exception 'Takımda boş davet yeri yok.';end if;
  insert into ludus_ranked_party_private.invites_v244(room_id,target_id) values(r.id,p_peer)
   on conflict(room_id,target_id) do update set state='pending',created_at=now_at,expires_at=now_at+interval '5 minutes';
 elsif p_action in ('accept','decline') then
  select * into i from ludus_ranked_party_private.invites_v244 where id=p_invite and target_id=u and state='pending' and expires_at>now_at;
  if not found then raise exception 'Davet bulunamadı veya süresi doldu.';end if;
  select * into r from ludus_ranked_party_private.rooms_v244 where id=i.room_id for update;
  if not found then raise exception 'Takım kapandı.';end if;
  select * into i from ludus_ranked_party_private.invites_v244 where id=p_invite and target_id=u and state='pending' and expires_at>now_at for update;
  if not found then raise exception 'Davet bulunamadı veya süresi doldu.';end if;
  if p_action='decline' then update ludus_ranked_party_private.invites_v244 set state='declined' where id=i.id;
  else
   if mine is not null then raise exception 'Önce mevcut takımından ayrıl.';end if;
   if (select count(*) from ludus_ranked_party_private.members_v244 where room_id=i.room_id)>=5 then raise exception 'Takım doldu veya kapandı.';end if;
   select * into fighter from public.ludus_gladiators where owner_id=u and (p_gladiator is null or id=p_gladiator)
    and status='available' and fatigue_value<100 and clan_roster_id is null and (injured_until is null or injured_until<=now_at)
    and (training_ends_at is null or training_ends_at<=now_at) order by overall desc,id limit 1;
   if not found then raise exception 'Hazır bir gladyatör seç.';end if;
   insert into ludus_ranked_party_private.members_v244(room_id,user_id,gladiator_id) values(i.room_id,u,fighter.id);
   update ludus_ranked_party_private.invites_v244 set state=case when id=i.id then 'accepted' else 'cancelled' end where target_id=u and state='pending';
   mine:=i.room_id;
  end if;
 elsif p_action='leave' then
  if mine is not null then
   select * into r from ludus_ranked_party_private.rooms_v244 where id=mine for update;
   if r.leader_id=u then delete from ludus_ranked_party_private.rooms_v244 where id=mine;
   else delete from ludus_ranked_party_private.members_v244 where room_id=mine and user_id=u;end if;
   mine:=null;
  end if;
 elsif p_action='remove' then
  select * into r from ludus_ranked_party_private.rooms_v244 where id=mine and leader_id=u for update;
  if not found or p_peer is null or p_peer=u then raise exception 'Oyuncu çıkarılamadı.';end if;
  delete from ludus_ranked_party_private.members_v244 where room_id=mine and user_id=p_peer;
  update ludus_ranked_party_private.invites_v244 set state='cancelled' where room_id=mine and target_id=p_peer and state='pending';
 elsif p_action='select' then
  if mine is null then raise exception 'Önce bir takıma katıl.';end if;
  select * into fighter from public.ludus_gladiators where id=p_gladiator and owner_id=u and status='available' and fatigue_value<100
   and clan_roster_id is null and (injured_until is null or injured_until<=now_at)
   and (training_ends_at is null or training_ends_at<=now_at);
  if not found then raise exception 'Hazır bir gladyatör seç.';end if;
  update ludus_ranked_party_private.members_v244 set gladiator_id=fighter.id where room_id=mine and user_id=u;
 end if;

 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'leader',a.ludus_name,'expires_at',v.expires_at) order by v.created_at),'[]'::jsonb) into inbox
 from ludus_ranked_party_private.invites_v244 v join ludus_ranked_party_private.rooms_v244 x on x.id=v.room_id
 join public.ludus_accounts a on a.user_id=x.leader_id where v.target_id=u and v.state='pending' and v.expires_at>now_at;
 if p_action='inbox' then return jsonb_build_object('invites',inbox);end if;
 select jsonb_build_object('id',x.id,'leader',x.leader_id,'members',coalesce((
  select jsonb_agg(jsonb_build_object('user_id',m.user_id,'ludus',a.ludus_name,'gladiator',g.name,'class',g.class,
   'leader',m.user_id=x.leader_id) order by (m.user_id=x.leader_id) desc,m.joined_at,m.user_id)
  from ludus_ranked_party_private.members_v244 m join public.ludus_accounts a on a.user_id=m.user_id
  join public.ludus_gladiators g on g.id=m.gladiator_id where m.room_id=x.id),'[]'::jsonb)) into party
 from ludus_ranked_party_private.rooms_v244 x where x.id=mine;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.user_id,'username',c.username,'ludus',c.ludus_name,'type',c.kind,
  'invited',exists(select 1 from ludus_ranked_party_private.invites_v244 v where v.room_id=mine and v.target_id=c.user_id and v.state='pending' and v.expires_at>now_at))
  order by c.priority,lower(c.ludus_name),c.user_id),'[]'::jsonb) into choices from (
  select distinct on(a.user_id) a.user_id,a.username,a.ludus_name,
   case when f.requester is not null then 'friend' else 'clan' end kind,
   case when f.requester is not null then 0 else 1 end priority
  from public.ludus_accounts a join public.ludus_presence pr on pr.user_id=a.user_id and pr.last_seen>now_at-interval '75 seconds'
  left join public.ludus_friends f on f.state='accepted' and ((f.requester=u and f.target=a.user_id) or (f.target=u and f.requester=a.user_id))
  left join public.ludus_clan_members cm on cm.user_id=a.user_id and cm.clan_id=(select clan_id from public.ludus_clan_members where user_id=u)
  where a.user_id<>u and (f.requester is not null or cm.user_id is not null)
  and not exists(select 1 from ludus_ranked_party_private.members_v244 m where m.user_id=a.user_id)
  order by a.user_id,case when f.requester is not null then 0 else 1 end
 ) c;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'class',g.class) order by g.overall desc,g.id),'[]'::jsonb) into roster
 from public.ludus_gladiators g where g.owner_id=u and g.status='available' and g.fatigue_value<100 and g.clan_roster_id is null
 and (g.injured_until is null or g.injured_until<=now_at) and (g.training_ends_at is null or g.training_ends_at<=now_at);
 return jsonb_build_object('party',party,'invites',inbox,'candidates',choices,'gladiators',roster,'user_id',u,'server_now',now_at);
end;$$;
revoke all on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) from public,anon;
grant execute on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) to authenticated;
create function public.ludus_ranked_party_v244(p_action text default 'state',p_peer uuid default null,p_gladiator uuid default null,p_invite uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select ludus_ranked_party_private.handle_v244(p_action,p_peer,p_gladiator,p_invite)$$;
revoke all on function public.ludus_ranked_party_v244(text,uuid,uuid,uuid) from public,anon;
grant execute on function public.ludus_ranked_party_v244(text,uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
