-- Friend messages are accessible only through a checked, authenticated RPC.
create schema if not exists ludus_message_private;
revoke all on schema ludus_message_private from public, anon, authenticated;
grant usage on schema ludus_message_private to authenticated;

create table ludus_message_private.messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 1000 and body=btrim(body)),
 client_request uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 read_at timestamptz,
 constraint messages_different_users check (sender_id<>recipient_id),
 unique (sender_id,client_request)
);
create index messages_sender_thread on ludus_message_private.messages(sender_id,recipient_id,created_at desc);
create index messages_recipient_thread on ludus_message_private.messages(recipient_id,sender_id,created_at desc);
create index messages_unread on ludus_message_private.messages(recipient_id) where read_at is null;
alter table ludus_message_private.messages enable row level security;
-- No direct access, including anonymous sessions carrying the authenticated role.
create policy messages_rpc_only on ludus_message_private.messages for all to authenticated
 using (false and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true))
 with check (false and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true));
revoke all on ludus_message_private.messages from public,anon,authenticated;

create function ludus_message_private.handle(p_action text,p_peer uuid,p_body text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); v_action text:=coalesce(p_action,'inbox'); msg ludus_message_private.messages; result jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Giriş gerekiyor.'; end if;
 if v_action not in ('inbox','thread','send') then raise exception 'Geçersiz işlem.'; end if;
 if v_action in ('thread','send') and (p_peer is null or p_peer=u) then raise exception 'Bir arkadaşını seç.'; end if;
 if v_action='send' then
  if p_request is null or p_body is null or char_length(btrim(p_body)) not between 1 and 1000 then raise exception 'Mesaj 1–1000 karakter olmalı.'; end if;
  -- Serialize each sender so concurrent retries cannot duplicate a message or evade the limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,41));
  select * into msg from ludus_message_private.messages where sender_id=u and client_request=p_request;
  if found then
   if msg.recipient_id<>p_peer or msg.body<>btrim(p_body) then raise exception 'Mesaj isteği değişmiş.'; end if;
  else
   if not exists(select 1 from public.ludus_friends f where f.state='accepted'
    and ((f.requester=u and f.target=p_peer) or (f.requester=p_peer and f.target=u))) then raise exception 'Yalnızca arkadaşlarına mesaj gönderebilirsin.'; end if;
   if (select count(*) from ludus_message_private.messages where sender_id=u and created_at>clock_timestamp()-interval '30 seconds')>=10 then raise exception 'Biraz bekleyip tekrar dene.'; end if;
   insert into ludus_message_private.messages(sender_id,recipient_id,body,client_request) values(u,p_peer,btrim(p_body),p_request);
  end if;
 end if;
 if v_action in ('thread','send') then
  if not exists(select 1 from public.ludus_friends f where f.state='accepted'
    and ((f.requester=u and f.target=p_peer) or (f.requester=p_peer and f.target=u)))
   and not exists(select 1 from ludus_message_private.messages m where (m.sender_id=u and m.recipient_id=p_peer) or (m.sender_id=p_peer and m.recipient_id=u))
   then raise exception 'Konuşma bulunamadı.'; end if;
  update ludus_message_private.messages set read_at=clock_timestamp() where recipient_id=u and sender_id=p_peer and read_at is null;
 end if;
 select jsonb_build_object(
  'friends',coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'name',a.ludus_name,'username',a.username) order by a.ludus_name)
   from public.ludus_friends f join public.ludus_accounts a on a.user_id=case when f.requester=u then f.target else f.requester end
   where f.state='accepted' and (f.requester=u or f.target=u)),'[]'::jsonb),
  'conversations',coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'name',a.ludus_name,'username',a.username,'last_body',last_msg.body,'last_at',last_msg.created_at,
    'unread',(select count(*) from ludus_message_private.messages t where t.recipient_id=u and t.sender_id=a.user_id and t.read_at is null)) order by last_msg.created_at desc)
   from (select distinct on (case when sender_id=u then recipient_id else sender_id end) body,created_at,case when sender_id=u then recipient_id else sender_id end as peer_id
    from ludus_message_private.messages where sender_id=u or recipient_id=u order by case when sender_id=u then recipient_id else sender_id end,created_at desc,id desc) last_msg
   join public.ludus_accounts a on a.user_id=last_msg.peer_id),'[]'::jsonb),
  'unread',(select count(*) from ludus_message_private.messages where recipient_id=u and read_at is null),
  'peer',case when v_action in ('thread','send') then (select jsonb_build_object('id',user_id,'name',ludus_name,'username',username) from public.ludus_accounts where user_id=p_peer) else null end,
  'messages',case when v_action in ('thread','send') then coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'body',t.body,'mine',t.sender_id=u,'created_at',t.created_at,'read_at',t.read_at) order by t.created_at,t.id)
   from (select * from ludus_message_private.messages where (sender_id=u and recipient_id=p_peer) or (sender_id=p_peer and recipient_id=u) order by created_at desc,id desc limit 100) t),'[]'::jsonb) else '[]'::jsonb end
 ) into result;
 return result;
end $$;
revoke all on function ludus_message_private.handle(text,uuid,text,uuid) from public,anon;
grant execute on function ludus_message_private.handle(text,uuid,text,uuid) to authenticated;

create function public.ludus_messages(p_action text default 'inbox',p_peer uuid default null,p_body text default null,p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_message_private.handle(p_action,p_peer,p_body,p_request);
$$;
revoke all on function public.ludus_messages(text,uuid,text,uuid) from public,anon;
grant execute on function public.ludus_messages(text,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
