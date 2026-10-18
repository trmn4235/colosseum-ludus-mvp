-- Prices are authoritative, shared, and fixed for each 15-minute market period.
-- The versioned deterministic schedule reconstructs only prices effective since activation.
-- No invented historical points or future prices are returned.
create table if not exists ludus_supply_private.market_clock_v121(
 singleton boolean primary key default true check(singleton),started_at timestamptz not null default clock_timestamp()
);
alter table ludus_supply_private.market_clock_v121 enable row level security;
revoke all on ludus_supply_private.market_clock_v121 from public,anon,authenticated;
insert into ludus_supply_private.market_clock_v121(singleton)values(true)on conflict do nothing;

create or replace function ludus_supply_private.market_bar_v121(p_city integer,p_slot integer,p_epoch bigint)
returns integer language sql immutable strict set search_path='' as $$
 select case when r<15 then 10 when r<20 then 9 when r<30 then 8 else 1+mod(r-30,7)end
 from(select mod(p_city-1+mod(p_epoch,60)::integer*17+p_slot*11,60)r)s;
$$;
create or replace function ludus_supply_private.market_price_v121(p_city integer,p_slot integer,p_base numeric,p_epoch bigint)
returns numeric language sql immutable strict set search_path='' as $$
 select round(p_base*(array[15.8,12,9,6.5,4.7,3.4,2.5,1.8,1.35,1]::numeric[])[ludus_supply_private.market_bar_v121(p_city,p_slot,p_epoch)],2);
$$;
create or replace function ludus_supply_private.offer_v116(p_city integer,p_sku text,p_epoch bigint)
returns jsonb language plpgsql stable set search_path='' as $$
declare g ludus_supply_private.market_goods_v116;bar integer;capacity integer;sold integer;
begin
 select * into g from ludus_supply_private.market_goods_v116 where sku=p_sku and active;
 if not found or not exists(select 1 from ludus_supply_private.cities_v116 where id=p_city)then raise exception 'Şehir veya malzeme bulunamadı.';end if;
 bar:=ludus_supply_private.market_bar_v121(p_city,g.slot,p_epoch);capacity:=bar*30;
 select quantity into sold from ludus_supply_private.market_sales_v116 where epoch=p_epoch and city=p_city and sku=p_sku;
 return jsonb_build_object('sku',p_sku,'bar',bar,'base_price',g.base_price,'unit_price',ludus_supply_private.market_price_v121(p_city,g.slot,g.base_price,p_epoch),'stock',greatest(0,capacity-coalesce(sold,0)),'capacity',capacity);
end;$$;
create or replace function ludus_supply_private.city_v116(p_city integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();epoch bigint;city ludus_supply_private.cities_v116;goods jsonb;started timestamptz;day_start timestamptz;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 select * into city from ludus_supply_private.cities_v116 where id=p_city;
 if not found then raise exception 'Şehir bulunamadı.';end if;
 epoch:=floor(extract(epoch from ts)/900)::bigint;
 select started_at into started from ludus_supply_private.market_clock_v121 where singleton;
 day_start:=ts-interval'24 hours';
 select jsonb_agg(ludus_supply_private.offer_v116(p_city,g.sku,epoch)||jsonb_build_object('name',r.name,'history',jsonb_build_object(
  'started_at',started,'day_start',day_start,'day_end',ts,'interval_seconds',900,
  'points',(select coalesce(jsonb_agg(jsonb_build_object('at',greatest(to_timestamp(e*900),started),'price',ludus_supply_private.market_price_v121(p_city,g.slot,g.base_price,e))order by e),'[]'::jsonb)
   from generate_series(greatest(epoch-95,floor(extract(epoch from started)/900)::bigint),epoch)e)
 ))order by g.slot)
 into goods from ludus_supply_private.market_goods_v116 g join ludus_supply_private.resources r using(sku) where g.active;
 return jsonb_build_object('city',to_jsonb(city),'epoch',epoch,'expires_at',to_timestamp((epoch+1)*900),'server_now',ts,'interval_seconds',900,'goods',goods);
end;$$;

create or replace function ludus_supply_private.api(p_action text,p_key text,p_workers integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();food jsonb;answer jsonb;payload jsonb;
 receipt ludus_supply_private.receipts;dest ludus_supply_private.destinations;job ludus_supply_private.jobs;
 recipe ludus_supply_private.production_recipes_v118;product public.ludus_shop_catalog;entry record;iid uuid;lv integer;
 total integer;occupied integer;qty integer;held integer;cargo jsonb;items jsonb;routes jsonb;open_jobs jsonb;crafts jsonb;delivered jsonb;parts text[];city_id integer;market_epoch bigint;offer jsonb;cost bigint;balance bigint;goods_sku text;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','send','claim','craft','buy')then raise exception 'Geçersiz işlem.';end if;
 -- One account lock orders progression, food, inventory and worker mutations.
 perform ludus_private.level_ensure(u);
 food:=ludus_food_private.api_v55('state',null,null,null);
 insert into ludus_supply_private.stock(owner_id,sku)select u,r.sku from ludus_supply_private.resources r where not r.food and r.active on conflict do nothing;
 perform ludus_supply_private.settle_owner_v87(u,clock_timestamp());
 ts:=clock_timestamp();
 lv:=ludus_private.level_from_exp((select experience from public.ludus_progression where owner_id=u));
 total:=ludus_supply_private.worker_count(u);
 select coalesce(sum(workers),0)::integer into occupied from ludus_supply_private.jobs where owner_id=u and claimed_at is null;
 if p_action<>'state'then
  if p_request is null or p_key is null then raise exception 'İşlem kimliği ve hedef gerekiyor.';end if;
  payload:=jsonb_build_object('action',p_action,'key',p_key,'workers',p_workers);
  select * into receipt from ludus_supply_private.receipts where owner_id=u and request_id=p_request;
  if found then
   if receipt.payload<>payload then raise exception 'İşlem kimliği başka bir işlemde kullanılmış.';end if;
   answer:=receipt.result||'{"replayed":true}'::jsonb;
  else
   if p_action='send'then
    if p_workers is null or p_workers<1 or p_workers>total-occupied then raise exception 'Yeterli boş kervan yok. Yeni kervan her 10 seviyede otomatik açılır.';end if;
    select * into dest from ludus_supply_private.destinations where id=p_key;
    if not found or dest.id not in('grain','apple','hunt','fish','egg','wine','olive_oil')then raise exception 'Bu malzeme Roma haritasındaki hammadde kaynaklarından alınır.';end if;
    select jsonb_object_agg(key,value::integer*p_workers)into cargo from jsonb_each_text(dest.yields);
    insert into ludus_supply_private.jobs(owner_id,destination,workers,started_at,ends_at,cargo)
    values(u,dest.id,p_workers,ts,ts+make_interval(secs=>dest.seconds),cargo)returning * into job;
    answer:=jsonb_build_object('message','Kervan yola çıktı.','job_id',job.id);
   elsif p_action='claim'then
    select * into job from ludus_supply_private.jobs where owner_id=u and id::text=p_key for update;
    if not found then raise exception 'Sefer bulunamadı.';end if;
    if job.ends_at>ts then raise exception 'Kervan henüz dönmedi.';end if;
    if job.claimed_at is null then
     -- Food was settled above; a newly delivered load cannot retroactively feed past days.
     for entry in select j.key,j.value::integer amount,r.food from jsonb_each_text(job.cargo)j join ludus_supply_private.resources r on r.sku=j.key loop
      if entry.food then
       select quantity into held from public.ludus_food_stock where owner_id=u and sku=entry.key;
       if held+entry.amount>50000 then raise exception 'Erzak deposu dolu; seferdeki yük korunuyor.';end if;
       update public.ludus_food_stock set quantity=quantity+entry.amount where owner_id=u and sku=entry.key;
      else
       select quantity into held from ludus_supply_private.stock where owner_id=u and sku=entry.key;
       if held+entry.amount>50000 then raise exception 'Malzeme deposu dolu; seferdeki yük korunuyor.';end if;
       update ludus_supply_private.stock set quantity=quantity+entry.amount where owner_id=u and sku=entry.key;
      end if;
     end loop;
     update ludus_supply_private.jobs set claimed_at=ts where id=job.id;
    end if;
    answer:=jsonb_build_object('message','Sefer yükü kasaya teslim edildi.','cargo',job.cargo);
   elsif p_action='buy'then
    if p_workers is null or p_workers<1 or p_workers>greatest(0,total-occupied)then raise exception 'Yeterli boş kervan yok.';end if;
    parts:=string_to_array(p_key,':');
    if array_length(parts,1)<>4 then raise exception 'Alım bilgisi geçersiz.';end if;
    city_id:=parts[1]::integer;goods_sku:=parts[2];market_epoch:=parts[3]::bigint;qty:=parts[4]::integer;
    if market_epoch<>floor(extract(epoch from ts)/900)::bigint then raise exception 'Fiyatın süresi doldu. Güncel fiyatı yeniden al.';end if;
    if qty is null or qty<1 or qty>p_workers*15 then raise exception 'Her kervan en fazla 15 birim taşır.';end if;
    offer:=ludus_supply_private.offer_v116(city_id,goods_sku,market_epoch);
    cost:=ceil((offer->>'unit_price')::numeric*qty);
    select gold into balance from public.ludus_accounts where user_id=u;
    if balance<cost then raise exception 'Denarius yetersiz.';end if;
    -- Atomic global stock reservation; concurrent buyers cannot oversell a quote.
    insert into ludus_supply_private.market_sales_v116(epoch,city,sku,quantity)values(market_epoch,city_id,goods_sku,qty)
    on conflict(epoch,city,sku)do update set quantity=ludus_supply_private.market_sales_v116.quantity+excluded.quantity
    where ludus_supply_private.market_sales_v116.quantity+excluded.quantity<=(offer->>'capacity')::integer;
    if not found then raise exception 'Şehirde bu kadar stok kalmadı. Şehri yeniden incele.';end if;
    if qty>(offer->>'capacity')::integer then raise exception 'Şehirde bu kadar stok yok.';end if;
    update public.ludus_accounts set gold=gold-cost where user_id=u;
    insert into ludus_supply_private.jobs(owner_id,destination,workers,started_at,ends_at,cargo,purchase)
    values(u,'city-'||city_id,p_workers,ts,ts+interval'1 hour',jsonb_build_object(goods_sku,qty),
     jsonb_build_object('city',city_id,'epoch',market_epoch,'unit_price',offer->'unit_price','cost',cost))returning * into job;
    answer:=jsonb_build_object('message','Malzeme alındı. Kervan yükü kasaya getirecek.','job_id',job.id,'cost',cost);
   else
    select * into recipe from ludus_supply_private.production_recipes_v118 where sku=p_key;
    if not found then raise exception 'Üretim tarifi bulunamadı.';end if;
    for entry in select key,value::integer amount from jsonb_each_text(recipe.ingredients)loop
     select quantity into held from ludus_supply_private.stock where owner_id=u and sku=entry.key;
     if coalesce(held,0)<entry.amount then raise exception 'Üretim için malzemelerin eksik.';end if;
     update ludus_supply_private.stock set quantity=quantity-entry.amount where owner_id=u and sku=entry.key;
    end loop;
    if recipe.output_type='resource' then
     update ludus_supply_private.stock set quantity=quantity+recipe.output_quantity
      where owner_id=u and sku=recipe.sku and quantity+recipe.output_quantity<=50000;
     if not found then raise exception 'Ürün deposu dolu; malzemeler harcanmadı.';end if;
     answer:=jsonb_build_object('message',recipe.output_quantity||' '||recipe.name||' kasaya eklendi.','sku',recipe.sku,'quantity',recipe.output_quantity);
    else
     select * into product from public.ludus_shop_catalog where sku=p_key;
     if not found then raise exception 'Ekipman tanımı bulunamadı.';end if;
     insert into public.ludus_items(owner_id,kind,model)values(u,product.kind,product.model)returning id into iid;
     answer:=jsonb_build_object('message','1 '||recipe.name||' +0 olarak envantere eklendi.','item_id',iid,'sku',recipe.sku,'quantity',1);
    end if;
   end if;
   insert into ludus_supply_private.receipts(owner_id,request_id,payload,result)values(u,p_request,payload,answer);
  end if;
 end if;
 select jsonb_agg(to_jsonb(r)||jsonb_build_object('quantity',case when r.food then coalesce(f.quantity,0)else coalesce(s.quantity,0)end)order by r.sort_order)
 into items from ludus_supply_private.resources r left join ludus_supply_private.stock s on s.sku=r.sku and s.owner_id=u
 left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u where r.active;
 select jsonb_agg(to_jsonb(d)order by d.sort_order)into routes from ludus_supply_private.destinations d;
 select coalesce(jsonb_agg(to_jsonb(j)||jsonb_build_object('ready',j.ends_at<=ts)order by j.ends_at),'[]')into open_jobs
 from ludus_supply_private.jobs j where j.owner_id=u and j.claimed_at is null;
 select coalesce(sum(workers),0)::integer into occupied from ludus_supply_private.jobs where owner_id=u and claimed_at is null;
 select coalesce(jsonb_agg(to_jsonb(d)order by d.claimed_at desc),'[]')into delivered from(select j.id,j.destination,j.workers,j.cargo,j.claimed_at from ludus_supply_private.jobs j where j.owner_id=u and j.claimed_at is not null order by j.claimed_at desc limit 10)d;
 select jsonb_agg(to_jsonb(r)||jsonb_build_object('group',case when r.kind='material' then 'processing' else 'equipment' end)order by r.sort_order)
 into crafts from ludus_supply_private.production_recipes_v118 r;
 return jsonb_build_object('user_id',u,'server_now',ts,'level',lv,'workers',total,'busy_workers',occupied,'free_workers',greatest(0,total-occupied),'caravans',total,'busy_caravans',occupied,'free_caravans',greatest(0,total-occupied),'caravan_capacity',15,
 'next_worker_level',case when lv<50 then (lv/10+1)*10 end,'next_caravan_level',case when lv<50 then (lv/10+1)*10 end,'unclaimed_workers',0,
 'resources',items,'destinations',routes,'jobs',open_jobs,'recipes',crafts,'automatic_delivery',true,'deliveries',delivered,'result',answer,'gold',(select gold from public.ludus_accounts where user_id=u),'cities',(select jsonb_agg(to_jsonb(c)order by id)from ludus_supply_private.cities_v116 c));
end;$$;

revoke all on function ludus_supply_private.market_bar_v121(integer,integer,bigint),ludus_supply_private.market_price_v121(integer,integer,numeric,bigint) from public,anon,authenticated;
notify pgrst, 'reload schema';
