-- Forum Pazarı: the server owns listings, escrow, prices and currency transfers.
-- Equipment in escrow has no personal owner, so every existing arena/upgrade
-- path that requires owner_id excludes it, including cached older clients.
create table ludus_private.market_listings_v66(
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.ludus_accounts(user_id),
 asset_type text not null check(asset_type in('item','gladiator')),
 asset_id uuid not null, snapshot jsonb not null,
 kind text not null, model text not null, enhancement integer not null default 0,
 price bigint not null check(price between 1 and 1000000000),
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 status text not null default 'active' check(status in('active','sold','cancelled','expired')),
 buyer_id uuid references public.ludus_accounts(user_id), sold_at timestamptz,
 commission bigint, net_income bigint
);
create unique index market_one_active_asset_v66 on ludus_private.market_listings_v66(asset_type,asset_id)where status='active';
create index market_seller_v66 on ludus_private.market_listings_v66(seller_id,created_at desc);
create index market_browse_v66 on ludus_private.market_listings_v66(kind,model,enhancement,price)where status='active';
create index market_expiry_v66 on ludus_private.market_listings_v66(seller_id,expires_at)where status='active';
create table ludus_private.market_requests_v66(
 owner_id uuid not null references public.ludus_accounts(user_id), request_id uuid not null,
 action text not null, payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(owner_id,request_id)
);
alter table ludus_private.market_listings_v66 enable row level security;
alter table ludus_private.market_requests_v66 enable row level security;
revoke all on ludus_private.market_listings_v66,ludus_private.market_requests_v66 from public,anon,authenticated;
alter table public.ludus_items alter column owner_id drop not null;
alter table public.ludus_items add column market_listing_id uuid references ludus_private.market_listings_v66(id);
alter table public.ludus_gladiators add column market_listing_id uuid references ludus_private.market_listings_v66(id);
create index market_item_hold_v66 on public.ludus_items(market_listing_id)where market_listing_id is not null;
create index market_gladiator_hold_v66 on public.ludus_gladiators(market_listing_id)where market_listing_id is not null;

create function ludus_private.market_asset_guard_v66()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('ludus.market_transfer',true),'')='on' then
  if tg_op='DELETE'then return old;else return new;end if;
 end if;
 if tg_op<>'INSERT' and old.market_listing_id is not null then
  -- Rest and weekly housekeeping remain possible for a reserved gladiator.
  if tg_table_name='ludus_gladiators' and tg_op='UPDATE' and
   (to_jsonb(new)-array['overall','training_week_start','perfect_weeks','training_policy_pending','fatigue','fatigue_value','fatigue_rest_from','recovery_rate_until'])=
   (to_jsonb(old)-array['overall','training_week_start','perfect_weeks','training_policy_pending','fatigue','fatigue_value','fatigue_rest_from','recovery_rate_until'])then return new;end if;
  raise exception 'Satıştaki varlık kullanılamaz. Önce Forum Pazarı ilanını kaldır.';
 end if;
 if tg_op<>'DELETE' and new.market_listing_id is not null then raise exception 'Pazar kilidi yalnızca pazar işlemiyle konur.';end if;
 if tg_table_name='ludus_items' and tg_op<>'DELETE' and new.owner_id is null then raise exception 'Sahipsiz eşya yalnızca pazar emanetinde tutulabilir.';end if;
 if tg_op='DELETE'then return old;else return new;end if;
end;$$;
create trigger ludus_market_item_guard_v66 before insert or update or delete on public.ludus_items for each row execute function ludus_private.market_asset_guard_v66();
create trigger ludus_market_gladiator_guard_v66 before insert or update or delete on public.ludus_gladiators for each row execute function ludus_private.market_asset_guard_v66();

create function ludus_private.market_expire_v66()returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r ludus_private.market_listings_v66;marker text:=coalesce(current_setting('ludus.market_transfer',true),'');
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 perform set_config('ludus.market_transfer','on',true);
 for r in select * from ludus_private.market_listings_v66 where seller_id=u and status='active' and expires_at<=clock_timestamp()order by id for update loop
  update ludus_private.market_listings_v66 set status='expired'where id=r.id;
  if r.asset_type='item'then
   update public.ludus_items set owner_id=u,market_listing_id=null where id=r.asset_id and market_listing_id=r.id;
  else
   update public.ludus_gladiators set status='available',market_listing_id=null where id=r.asset_id and owner_id=u and market_listing_id=r.id;
  end if;
 end loop;
 perform set_config('ludus.market_transfer',marker,true);
end;$$;

create function ludus_private.market_state_v66()returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();listings jsonb;mine jsonb;assets jsonb;fighters jsonb;last_sales jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 perform ludus_private.market_expire_v66();
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'asset_type',r.asset_type,'asset',r.snapshot,
  'price',r.price,'created_at',r.created_at,'expires_at',r.expires_at,'own',r.seller_id=u,
  'seller',a.ludus_name,'status',r.status)order by r.created_at desc),'[]')into listings
 from(select * from ludus_private.market_listings_v66 where status='active'and expires_at>clock_timestamp()order by created_at desc limit 500)r
 join public.ludus_accounts a on a.user_id=r.seller_id;
 select coalesce(jsonb_agg(to_jsonb(r)-array['seller_id','buyer_id']order by r.created_at desc),'[]')into mine
 from(select * from ludus_private.market_listings_v66 where seller_id=u order by created_at desc limit 30)r;
 select coalesce(jsonb_agg(to_jsonb(i)-array['owner_id','legacy_v10','legacy_sapphire_percentages']order by i.created_at desc),'[]')into assets
 from public.ludus_items i where owner_id=u and equipped_by is null and locked_battle_id is null and clan_roster_id is null and clan_vault_id is null and market_listing_id is null;
 select coalesce(jsonb_agg(to_jsonb(g)-array['owner_id','legacy_base_stats']order by g.created_at),'[]')into fighters
 from public.ludus_gladiators g where owner_id=u and status='available'and clan_roster_id is null and market_listing_id is null
  and coalesce(training_ends_at,'-infinity')<=clock_timestamp()and coalesce(injured_until,'-infinity')<=clock_timestamp()
  and not exists(select 1 from public.ludus_items where equipped_by=g.id)
  and not exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)
  and not exists(select 1 from public.ludus_imperial_members where gladiator_id=g.id and active)
  and not exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters r on r.id=e.roster_id where e.gladiator_id=g.id and r.state in('draft','locked'))
  and not exists(select 1 from public.ludus_matches m where m.status in('waiting','playing')and m.updated_at>clock_timestamp()-interval '30 seconds'and m.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
  and not exists(select 1 from public.ludus_duels where status in('waiting','playing')and updated_at>clock_timestamp()-interval '75 seconds'and g.id in(host_g,guest_g));
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'model',model,'enhancement',enhancement,'price',price,'sold_at',sold_at)order by sold_at desc),'[]')into last_sales
 from(select * from ludus_private.market_listings_v66 where status='sold'order by sold_at desc limit 100)r;
 return jsonb_build_object('gold',(select gold from public.ludus_accounts where user_id=u),'server_now',clock_timestamp(),
  'listings',listings,'mine',mine,'items',assets,'gladiators',fighters,'sales',last_sales,'commission_percent',5);
end;$$;

create function ludus_private.market_call_v66(p_action text,p_payload jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r ludus_private.market_listings_v66;old_request ludus_private.market_requests_v66;
 it public.ludus_items;g public.ludus_gladiators;price bigint;hours integer;kind text;asset uuid;result jsonb;
 marker text:=coalesce(current_setting('ludus.market_transfer',true),'');seller uuid;fee bigint;slots integer;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action='state'then return ludus_private.market_state_v66();end if;
 if p_action is null or p_action not in('create','buy','cancel')or p_request is null or p_payload is null or jsonb_typeof(p_payload)<>'object'then raise exception 'Geçerli pazar işlemi gerekli.';end if;
 -- One request per authenticated buyer/seller; lock wallet rows in UUID order
 -- before the listing and asset to serialize two buyers without deadlocks.
 perform pg_advisory_xact_lock(hashtextextended(u::text,66));
 if p_action='buy'then select seller_id into seller from ludus_private.market_listings_v66 where id=(p_payload->>'listing_id')::uuid;end if;
 perform 1 from public.ludus_accounts where user_id in(u,seller)order by user_id for update;
 select * into old_request from ludus_private.market_requests_v66 where owner_id=u and request_id=p_request;
 if found then
  if old_request.action<>p_action or old_request.payload<>p_payload then raise exception 'İşlem kimliği başka bir işlemde kullanıldı.';end if;
  return ludus_private.market_state_v66()||jsonb_build_object('result',old_request.result);
 end if;
 perform ludus_private.market_expire_v66();
 perform set_config('ludus.market_transfer','on',true);
 if p_action='create'then
  price:=(p_payload->>'price')::bigint;hours:=(p_payload->>'hours')::integer;kind:=p_payload->>'asset_type';asset:=(p_payload->>'asset_id')::uuid;
  if price is null or price not between 1 and 1000000000 or hours is null or hours not in(6,12,24)or kind is null or kind not in('item','gladiator')or asset is null then raise exception 'Fiyat, süre ve satılacak varlığı seç.';end if;
  if(select count(*)from ludus_private.market_listings_v66 where seller_id=u and status='active')>=10 then raise exception 'Aynı anda en fazla 10 aktif ilan açabilirsin.';end if;
  if kind='item'then
   select * into it from public.ludus_items where id=asset and owner_id=u for update;
   if not found or it.equipped_by is not null or it.locked_battle_id is not null or it.clan_vault_id is not null or it.clan_roster_id is not null or it.market_listing_id is not null then raise exception 'Yalnızca envanterindeki boşta olan eşya satılabilir.';end if;
   insert into ludus_private.market_listings_v66(seller_id,asset_type,asset_id,snapshot,kind,model,enhancement,price,expires_at)
   values(u,kind,asset,to_jsonb(it)-array['owner_id','legacy_v10','legacy_sapphire_percentages'],it.kind,it.model,it.enhancement,price,clock_timestamp()+make_interval(hours=>hours))returning * into r;
   update public.ludus_items set owner_id=null,market_listing_id=r.id where id=asset;
  else
   select * into g from public.ludus_gladiators where id=asset and owner_id=u for update;
   if not found or g.status<>'available'or g.market_listing_id is not null or g.clan_roster_id is not null or g.training_ends_at>clock_timestamp()or g.injured_until>clock_timestamp()
    or exists(select 1 from public.ludus_items where equipped_by=g.id)
    or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)
    or exists(select 1 from public.ludus_imperial_members where gladiator_id=g.id and active)
    or exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters rr on rr.id=e.roster_id where e.gladiator_id=g.id and rr.state in('draft','locked'))
    or exists(select 1 from public.ludus_matches m where m.status in('waiting','playing')and m.updated_at>clock_timestamp()-interval '30 seconds'and m.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
    or exists(select 1 from public.ludus_duels where status in('waiting','playing')and updated_at>clock_timestamp()-interval '75 seconds'and g.id in(host_g,guest_g))
   then raise exception 'Gladyatör hazır ve ekipmansız olmalı.';end if;
   if(select count(*)from public.ludus_gladiators where owner_id=u and market_listing_id is null)<=1 then raise exception 'Ludus’unda en az bir gladyatör kalmalı.';end if;
   insert into ludus_private.market_listings_v66(seller_id,asset_type,asset_id,snapshot,kind,model,enhancement,price,expires_at)
   values(u,kind,asset,to_jsonb(g)-array['owner_id','legacy_base_stats'],'gladiator',g.class,0,price,clock_timestamp()+make_interval(hours=>hours))returning * into r;
   update public.ludus_gladiators set status='locked',market_listing_id=r.id where id=asset;
  end if;
  result:=jsonb_build_object('action','create','listing_id',r.id);
 else
  select * into r from ludus_private.market_listings_v66 where id=(p_payload->>'listing_id')::uuid for update;
  if not found or r.status<>'active'then raise exception 'Bu ilan artık aktif değil.';end if;
  if p_action='cancel'then
   if r.seller_id<>u then raise exception 'Yalnızca kendi ilanını kaldırabilirsin.';end if;
   update ludus_private.market_listings_v66 set status='cancelled'where id=r.id;
   if r.asset_type='item'then update public.ludus_items set owner_id=u,market_listing_id=null where id=r.asset_id and market_listing_id=r.id;
   else update public.ludus_gladiators set status='available',market_listing_id=null where id=r.asset_id and owner_id=u and market_listing_id=r.id;end if;
   if not found then raise exception 'Pazar emaneti bulunamadı.';end if;
   result:=jsonb_build_object('action','cancel','listing_id',r.id);
  else
   if r.seller_id=u then raise exception 'Kendi ilanını satın alamazsın.';end if;
   if r.expires_at<=clock_timestamp()then raise exception 'İlanın süresi doldu.';end if;
   if(p_payload->>'expected_price')::bigint is distinct from r.price then raise exception 'İlan fiyatını yeniden kontrol et.';end if;
   if(select gold from public.ludus_accounts where user_id=u)<r.price then raise exception 'Yeterli denarius yok.';end if;
   if r.asset_type='gladiator'then
    perform ludus_private.level_ensure(u);
    select greatest(legacy_slots,ludus_private.level_granted_gladiators(ludus_private.level_from_exp(experience)))into slots from public.ludus_progression where owner_id=u;
    if(select count(*)from public.ludus_gladiators where owner_id=u)>=slots then raise exception 'Gladyatör yuvaların dolu. Ludus seviyeni yükselt.';end if;
   end if;
   fee:=greatest(1,ceil(r.price*.05)::bigint);
   update ludus_private.market_listings_v66 set status='sold',buyer_id=u,sold_at=clock_timestamp(),commission=fee,net_income=r.price-fee where id=r.id;
   if r.asset_type='item'then update public.ludus_items set owner_id=u,market_listing_id=null where id=r.asset_id and market_listing_id=r.id and owner_id is null;
   else update public.ludus_gladiators set owner_id=u,status='available',market_listing_id=null where id=r.asset_id and market_listing_id=r.id and owner_id=r.seller_id;end if;
   if not found then raise exception 'Pazar emaneti bulunamadı.';end if;
   update public.ludus_accounts set gold=gold-r.price where user_id=u;
   update public.ludus_accounts set gold=gold+r.price-fee where user_id=r.seller_id;
   result:=jsonb_build_object('action','buy','listing_id',r.id,'price',r.price,'commission',fee,'net_income',r.price-fee);
  end if;
 end if;
 perform set_config('ludus.market_transfer',marker,true);
 insert into ludus_private.market_requests_v66(owner_id,request_id,action,payload,result)values(u,p_request,p_action,p_payload,result);
 return ludus_private.market_state_v66()||jsonb_build_object('result',result);
end;$$;

-- Public RPC is an invoker wrapper. Privileged transaction logic is private.
create function public.ludus_market(p_action text default 'state',p_payload jsonb default '{}',p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_private.market_call_v66(p_action,p_payload,p_request)
$$;
revoke all on function ludus_private.market_asset_guard_v66(),ludus_private.market_state_v66()from public,anon,authenticated;
revoke all on function ludus_private.market_expire_v66(),ludus_private.market_call_v66(text,jsonb,uuid),public.ludus_market(text,jsonb,uuid)from public,anon;
grant usage on schema ludus_private to authenticated;
grant execute on function ludus_private.market_expire_v66(),ludus_private.market_call_v66(text,jsonb,uuid),public.ludus_market(text,jsonb,uuid)to authenticated;

-- Expired escrow returns on the ordinary game-state load as well as the market.
alter function public.ludus_training_state()rename to ludus_training_state_pre_market_v66;
create function public.ludus_training_state()returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform ludus_private.market_expire_v66();
 return public.ludus_training_state_pre_market_v66();
end;$$;
revoke all on function public.ludus_training_state(),public.ludus_training_state_pre_market_v66()from public,anon;
grant execute on function public.ludus_training_state(),public.ludus_training_state_pre_market_v66()to authenticated;
notify pgrst,'reload schema';
