-- Message center: private history stays in its existing table. All new data is
-- private and accessed through one authenticated, owner/membership checked RPC.
create table ludus_message_private.notifications_v108 (
 owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 event_key text not null,
 kind text not null,
 title text not null,
 body text not null,
 target text not null check (target in ('missions','training','market','upgrades','levels','supply','guild')),
 created_at timestamptz not null,
 read_at timestamptz,
 deleted_at timestamptz,
 primary key(owner_id,event_key)
);
create index notifications_owner_recent_v108 on ludus_message_private.notifications_v108(owner_id,created_at desc,event_key) where deleted_at is null;
create index notifications_owner_unread_v108 on ludus_message_private.notifications_v108(owner_id) where read_at is null and deleted_at is null;

create table ludus_message_private.channels_v108 (
 id uuid primary key default gen_random_uuid(),
 channel text not null check(channel in ('guild','global')),
 clan_id uuid references public.ludus_clans(id) on delete cascade,
 sender_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 body text not null check(char_length(body) between 1 and 1000 and body=btrim(body)),
 client_request uuid not null,
 announcement boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 check ((channel='guild' and clan_id is not null) or (channel='global' and clan_id is null and not announcement)),
 unique(sender_id,client_request)
);
create index channels_history_v108 on ludus_message_private.channels_v108(channel,clan_id,created_at desc,id desc);
create index channels_sender_recent_v108 on ludus_message_private.channels_v108(sender_id,created_at desc);
create index channels_announcements_v108 on ludus_message_private.channels_v108(clan_id,created_at desc) where announcement;
alter table ludus_message_private.notifications_v108 enable row level security;
alter table ludus_message_private.channels_v108 enable row level security;
revoke all on ludus_message_private.notifications_v108,ludus_message_private.channels_v108 from public,anon,authenticated;
-- Defense in depth; direct table privileges are deliberately absent.
create policy notifications_owner_v108 on ludus_message_private.notifications_v108 for select to authenticated using(owner_id=(select auth.uid()));
create policy channels_member_v108 on ludus_message_private.channels_v108 for select to authenticated using(
 (select auth.uid()) is not null and (channel='global' or exists(select 1 from public.ludus_clan_members m where m.user_id=(select auth.uid()) and m.clan_id=channels_v108.clan_id))
);
create index if not exists training_owner_recent_v108 on public.ludus_training_sessions(owner_id,rest_until desc);
create index if not exists upgrades_owner_recent_v108 on public.ludus_upgrade_receipts(owner_id,created_at desc);
create index if not exists market_seller_sold_v108 on ludus_private.market_listings_v66(seller_id,sold_at desc) where status='sold';

-- Derive events from authoritative game receipts, never from client assertions.
-- The first visit imports the last 30 days plus unclaimed level rewards. Once
-- inserted, history and dismissal survive reloads and the 30-day import window.
-- No game settlement, rewards or balances are changed by checking messages.
create function ludus_message_private.sync_notifications_v108(u uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare ts timestamptz:=clock_timestamp(); cutoff timestamptz:=ts-interval '30 days';
begin
 if auth.uid() is null or auth.uid()<>u then raise exception 'Giriş gerekiyor.';end if;
 insert into ludus_message_private.notifications_v108(owner_id,event_key,kind,title,body,target,created_at)
 select u,'mission:'||a.id,'mission','Görev tamamlandı',coalesce(a.mission->>'title','İmparator görevi'),'missions',a.ends_at
 from public.ludus_imperial_assignments a where a.owner_id=u and a.ends_at between cutoff and ts
 union all
 select u,'training:'||t.id,'training','Antrenman tamamlandı',coalesce(g.name,'Gladyatör')||' çalışmasını tamamladı.','training',t.train_until
 from public.ludus_training_sessions t left join public.ludus_gladiators g on g.id=t.gladiator_id
 where t.owner_id=u and t.train_until<=ts and t.rest_until>=cutoff
 union all
 select u,'rest:'||t.id,'gladiator','Dinlenme tamamlandı',coalesce(g.name,'Gladyatör')||' antrenman sonrası dinlenmesini tamamladı.','training',t.rest_until
 from public.ludus_training_sessions t left join public.ludus_gladiators g on g.id=t.gladiator_id
 where t.owner_id=u and t.rest_until between cutoff and ts
 union all
 select u,'sale:'||m.id,'market',case when m.asset_type='gladiator' then 'Gladyatör satıldı' else 'İtem satıldı' end,
 coalesce(m.snapshot->>'name',(select c.name from public.ludus_shop_catalog c where c.model=m.model and c.kind=m.kind limit 1),'Eşya')
 ||case when m.asset_type='item' then ' +'||m.enhancement else '' end||' · '||coalesce(m.net_income,0)||' denarius','market',m.sold_at
 from ludus_private.market_listings_v66 m where m.seller_id=u and m.status='sold' and m.sold_at between cutoff and ts
 union all
 select u,'upgrade:'||r.request_id,'upgrade',case when coalesce((r.result->>'success')::boolean,false) then 'Geliştirme başarılı' else 'Geliştirme sonucu' end,
 case when coalesce((r.result->>'destroyed')::boolean,false) then 'Geliştirme sırasında eşya yok oldu.'
 when coalesce((r.result->>'success')::boolean,false) then 'Ekipmanın +'||coalesce(r.result->>'plus','0')||' seviyesine ulaştı.' else 'Geliştirme başarılı olmadı.' end,'upgrades',r.created_at
 from public.ludus_upgrade_receipts r where r.owner_id=u and r.action='enhance' and r.created_at between cutoff and ts
 union all
 select u,'level:'||r.level,'reward','Seviye ödülü açıldı','Ludus seviye '||r.level||' ödülü.','levels',r.unlocked_at
 from ludus_private.level_rewards r where r.owner_id=u and (r.unlocked_at>=cutoff or r.claimed_at is null)
 union all
 select u,'supply:'||j.id,'supply','Tedarik teslim edildi',coalesce(d.name,'Tedarik seferi')||' yükü depoya ulaştı.','supply',j.claimed_at
 from ludus_supply_private.jobs j join ludus_supply_private.destinations d on d.id=j.destination
 where j.owner_id=u and j.claimed_at between cutoff and ts
 union all
 select u,'guild:'||c.id,'guild','Yeni guild duyurusu',c.body,'guild',c.created_at
 from ludus_message_private.channels_v108 c join public.ludus_clan_members m on m.clan_id=c.clan_id and m.user_id=u
 where c.announcement and c.sender_id<>u and c.created_at>=greatest(cutoff,m.joined_at) and c.created_at<=ts
 on conflict(owner_id,event_key) do nothing;
end $$;
revoke all on function ludus_message_private.sync_notifications_v108(uuid) from public,anon,authenticated;

create function ludus_message_private.center_v108(p_action text,p_data jsonb,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); ch text:=coalesce(p_data->>'channel','private'); peer uuid:=nullif(p_data->>'peer','')::uuid;
 body text:=btrim(p_data->>'body'); announce boolean:=coalesce((p_data->>'announcement')::boolean,false);
 clan uuid; clan_name text; leader boolean:=false; allowed boolean:=false;
 page_size integer:=greatest(1,least(20,coalesce((p_data->>'limit')::integer,10)));
 page_offset integer:=greatest(0,least(100000,coalesce((p_data->>'offset')::integer,0)));
 notification_limit integer:=greatest(1,least(20,coalesce((p_data->>'notification_limit')::integer,5)));
 notification_offset integer:=greatest(0,least(100000,coalesce((p_data->>'notification_offset')::integer,0)));
 rows jsonb:='[]'; total integer:=0; inbox jsonb; notes jsonb; note_count integer; unread integer;
 old_private ludus_message_private.messages; old_channel ludus_message_private.channels_v108;
 thread_until timestamptz:=least(coalesce((p_data->>'thread_until')::timestamptz,clock_timestamp()),clock_timestamp());
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Giriş gerekiyor.';end if;
 if p_action is null or p_action not in ('state','thread','send','read','clear') or ch not in ('private','guild','global','system') then raise exception 'Geçersiz işlem.';end if;
 select m.clan_id,c.name,c.leader_id=u into clan,clan_name,leader from public.ludus_clan_members m join public.ludus_clans c on c.id=m.clan_id where m.user_id=u;
 if ch='private' then
  allowed:=peer is not null and peer<>u and exists(select 1 from public.ludus_friends f where f.state='accepted' and ((f.requester=u and f.target=peer) or(f.requester=peer and f.target=u)));
 elsif ch='guild' then allowed:=clan is not null;
 elsif ch='global' then allowed:=true;
 end if;
 if p_action='send' then
  if not allowed then raise exception 'Bu konuşmaya mesaj gönderemezsin.';end if;
  if p_request is null or body is null or char_length(body) not between 1 and 1000 then raise exception 'Mesaj 1–1000 karakter olmalı.';end if;
  if announce and (ch<>'guild' or not coalesce(leader,false)) then raise exception 'Duyuruyu yalnızca klan lideri yayımlayabilir.';end if;
  -- The same sender lock as V41 also protects users running an older client.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,41));
  select * into old_private from ludus_message_private.messages where sender_id=u and client_request=p_request;
  select * into old_channel from ludus_message_private.channels_v108 where sender_id=u and client_request=p_request;
  if old_private.id is not null then
   if ch<>'private' or old_private.recipient_id is distinct from peer or old_private.body<>body then raise exception 'Mesaj isteği değişmiş.';end if;
  elsif old_channel.id is not null then
   if old_channel.channel<>ch or old_channel.clan_id is distinct from(case when ch='guild' then clan end) or old_channel.body<>body or old_channel.announcement<>announce then raise exception 'Mesaj isteği değişmiş.';end if;
  else
   if (select count(*) from ludus_message_private.messages where sender_id=u and created_at>clock_timestamp()-interval '30 seconds')
    +(select count(*) from ludus_message_private.channels_v108 where sender_id=u and created_at>clock_timestamp()-interval '30 seconds')>=10 then raise exception 'Biraz bekleyip tekrar dene.';end if;
   if ch='private' then
    insert into ludus_message_private.messages(sender_id,recipient_id,body,client_request) values(u,peer,body,p_request);
   else
    insert into ludus_message_private.channels_v108(channel,clan_id,sender_id,body,client_request,announcement)
    values(ch,case when ch='guild' then clan end,u,body,p_request,announce);
   end if;
  end if;
  page_offset:=0;thread_until:=clock_timestamp();
 end if;
 if p_action in ('thread','send') and ch='private' and peer is not null then
  if not allowed and not exists(select 1 from ludus_message_private.messages m where m.created_at<=thread_until and ((m.sender_id=u and m.recipient_id=peer)or(m.sender_id=peer and m.recipient_id=u))) then raise exception 'Konuşma bulunamadı.';end if;
  select count(*) into total from ludus_message_private.messages m where m.created_at<=thread_until and ((m.sender_id=u and m.recipient_id=peer)or(m.sender_id=peer and m.recipient_id=u));
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]') into rows from (
   select m.id,m.body,m.sender_id=u as mine,m.created_at,m.read_at from ludus_message_private.messages m
   where m.created_at<=thread_until and ((m.sender_id=u and m.recipient_id=peer)or(m.sender_id=peer and m.recipient_id=u))
   order by m.created_at desc,m.id desc limit page_size offset page_offset
  ) t;
  -- Opening the inbox does not mark private messages or notifications as read.
  update ludus_message_private.messages m set read_at=clock_timestamp() where m.recipient_id=u and m.read_at is null and m.id in(select (x->>'id')::uuid from jsonb_array_elements(rows)x);
 elsif p_action in ('thread','send') and ch in('guild','global') and allowed then
  select count(*) into total from ludus_message_private.channels_v108 m where m.created_at<=thread_until and m.channel=ch and m.clan_id is not distinct from(case when ch='guild' then clan end);
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]') into rows from (
   select m.id,m.body,m.sender_id=u as mine,m.created_at,m.announcement,a.ludus_name as name
   from ludus_message_private.channels_v108 m join public.ludus_accounts a on a.user_id=m.sender_id
   where m.created_at<=thread_until and m.channel=ch and m.clan_id is not distinct from(case when ch='guild' then clan end)
   order by m.created_at desc,m.id desc limit page_size offset page_offset
  )t;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,108));
 perform ludus_message_private.sync_notifications_v108(u);
 if p_action='read' then
  update ludus_message_private.notifications_v108 set read_at=coalesce(read_at,clock_timestamp()) where owner_id=u and event_key=p_data->>'event_key' and deleted_at is null;
  if not found then raise exception 'Bildirim bulunamadı.';end if;
 elsif p_action='clear' then
  -- Bound deletion to the newest event the user actually saw, so a concurrent
  -- completion or announcement cannot disappear without ever being shown.
  if nullif(p_data->>'through','') is null then raise exception 'Silinecek bildirimleri yenile.';end if;
  update ludus_message_private.notifications_v108 set deleted_at=clock_timestamp() where owner_id=u and deleted_at is null and created_at<=least((p_data->>'through')::timestamptz,clock_timestamp());
  notification_offset:=0;
 end if;
 select count(*),count(*) filter(where read_at is null) into note_count,unread from ludus_message_private.notifications_v108 where owner_id=u and deleted_at is null;
 notification_offset:=least(notification_offset,greatest(0,((note_count-1)/notification_limit)*notification_limit));
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.event_key),'[]') into notes from (
  select n.event_key,n.kind,n.title,n.body,n.target,n.created_at,n.read_at from ludus_message_private.notifications_v108 n where n.owner_id=u and n.deleted_at is null
  order by n.created_at desc,n.event_key limit notification_limit offset notification_offset
 )t;
 inbox:=ludus_message_private.handle('inbox',null,null,null);
 return inbox||jsonb_build_object('channel',ch,'can_send',allowed,'clan',case when clan is not null then jsonb_build_object('id',clan,'name',clan_name,'leader',leader)end,
  'peer',case when peer is not null and (allowed or total>0)then(select jsonb_build_object('id',a.user_id,'name',a.ludus_name)from public.ludus_accounts a where a.user_id=peer)end,
  'messages',rows,'thread_until',thread_until,'message_total',total,'message_offset',page_offset,'notifications',notes,'notification_total',note_count,'notification_unread',unread,
  'notification_offset',notification_offset,'notification_latest',(select max(created_at)from ludus_message_private.notifications_v108 where owner_id=u and deleted_at is null));
end $$;
revoke all on function ludus_message_private.center_v108(text,jsonb,uuid) from public,anon;
grant execute on function ludus_message_private.center_v108(text,jsonb,uuid) to authenticated;
create function public.ludus_message_center(p_action text default 'state',p_data jsonb default '{}',p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_message_private.center_v108(p_action,coalesce(p_data,'{}'),p_request);
$$;
revoke all on function public.ludus_message_center(text,jsonb,uuid) from public,anon;
grant execute on function public.ludus_message_center(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
