-- Defense in depth for future table grants; RPCs already reject anonymous users.
alter policy notifications_owner_v108 on ludus_message_private.notifications_v108 using (
 owner_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true)
);
alter policy channels_member_v108 on ludus_message_private.channels_v108 using (
 (select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true)
 and (channel='global' or exists(select 1 from public.ludus_clan_members m where m.user_id=(select auth.uid()) and m.clan_id=channels_v108.clan_id))
);
-- Covers the clan FK independently of the channel-scoped history index.
create index channels_clan_v108 on ludus_message_private.channels_v108(clan_id);
