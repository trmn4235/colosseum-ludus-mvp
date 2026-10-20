-- Render authoritative cargo amounts; this never changes inventory or grants loot.
create or replace function ludus_message_private.cargo_text_v128(cargo jsonb)
returns text language sql stable security invoker set search_path='' as $$
 select coalesce(string_agg(v.value||' '||lower(coalesce(r.name,v.key)),', ' order by r.sort_order,v.key),'yük')
 from jsonb_each_text(cargo)v left join ludus_supply_private.resources r on r.sku=v.key
$$;
revoke all on function ludus_message_private.cargo_text_v128(jsonb)from public,anon,authenticated;

create or replace function ludus_message_private.sync_notifications_v108(u uuid)
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
 select u,'supply:'||j.id,'supply','Tedarik teslim edildi','Tedarik seferinden gelen '||ludus_message_private.cargo_text_v128(j.cargo)||' depomuza taşındı.','supply',j.claimed_at
 from ludus_supply_private.jobs j join ludus_supply_private.destinations d on d.id=j.destination
 where j.owner_id=u and j.claimed_at between cutoff and ts
 union all
 select u,'raid:'||r.id,'supply','Kervan ganimeti depoya taşındı',
 'Kervan baskınından elde edilen '||ludus_message_private.cargo_text_v128(r.loot)||' depomuza taşındı.','supply',r.delivered_at
 from ludus_supply_private.raids_v124 r where r.owner_id=u and r.success and r.delivered_at between cutoff and ts
 union all
 select u,'guild:'||c.id,'guild','Yeni guild duyurusu',c.body,'guild',c.created_at
 from ludus_message_private.channels_v108 c join public.ludus_clan_members m on m.clan_id=c.clan_id and m.user_id=u
 where c.announcement and c.sender_id<>u and c.created_at>=greatest(cutoff,m.joined_at) and c.created_at<=ts
 on conflict(owner_id,event_key) do nothing;
end $$;
revoke all on function ludus_message_private.sync_notifications_v108(uuid) from public,anon,authenticated;


-- Refresh existing supply wording, preserving read/dismissed status and timestamps.
update ludus_message_private.notifications_v108 n
set body='Tedarik seferinden gelen '||ludus_message_private.cargo_text_v128(j.cargo)||' depomuza taşındı.'
from ludus_supply_private.jobs j
where n.owner_id=j.owner_id and n.event_key='supply:'||j.id and j.claimed_at is not null;
notify pgrst,'reload schema';
