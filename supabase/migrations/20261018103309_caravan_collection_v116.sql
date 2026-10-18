-- V116: the driver and caravan are one entitlement; no worker hiring or claims.
alter table ludus_private.level_reward_catalog add column if not exists caravans integer not null default 0 check(caravans between 0 and 1);
update ludus_private.level_reward_catalog set workers=0,caravans=case when level%10=0 then 1 else 0 end;
create or replace function ludus_supply_private.worker_count(p_owner uuid)
returns integer language sql stable set search_path='' as $$
 select 1+least(50,ludus_private.level_from_exp(coalesce((select experience from public.ludus_progression where owner_id=p_owner),0)))/10
$$;
revoke all on function ludus_supply_private.worker_count(uuid) from public,anon,authenticated;
-- Existing jobs and cargo remain intact, even if they use more than the new limit.
-- Food routes no longer return manufacturing inputs; one caravan carries 15 portions.
update ludus_supply_private.destinations set yields=jsonb_build_object(case id when 'hunt' then 'meat' when 'wine' then 'beer' else id end,15)
 where id in('grain','apple','hunt','fish','egg','wine','olive_oil');
create table if not exists ludus_supply_private.cities_v116(
 id integer primary key check(id between 1 and 60),name text not null,region text not null,
 longitude numeric not null,latitude numeric not null,x numeric not null,y numeric not null
);
create table if not exists ludus_supply_private.market_goods_v116(
 sku text primary key references ludus_supply_private.resources(sku),base_price numeric not null check(base_price>0),slot integer unique not null
);
insert into ludus_supply_private.market_goods_v116 values
 ('iron',1.5,0),('copper',1.2,1),('wood',.6,2),('leather',2.5,3),('linen',1,4) on conflict(sku)do nothing;
create table if not exists ludus_supply_private.market_sales_v116(
 epoch bigint not null,city integer not null references ludus_supply_private.cities_v116(id),
 sku text not null references ludus_supply_private.market_goods_v116(sku),quantity integer not null check(quantity>=0),primary key(epoch,city,sku)
);
alter table ludus_supply_private.jobs add column if not exists purchase jsonb;

insert into ludus_supply_private.cities_v116 values(1,'Roma','Italia',12.485,41.891,45.343,47.216)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(2,'Ostia / Portus','Italia',12.287,41.754,44.976,47.644)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(3,'Capua','Italia',14.242,41.085,48.596,49.734)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(4,'Neapolis','Italia',14.233,40.84,48.58,50.5)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(5,'Puteoli','Italia',14.106,40.83,48.344,50.531)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(6,'Ravenna','Italia',12.212,44.423,44.837,39.303)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(7,'Aquileia','Italia',13.364,45.767,46.97,35.103)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(8,'Mediolanum','Italia',9.187,45.463,39.235,36.053)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(9,'Verona','Italia',10.994,45.439,42.581,36.128)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(10,'Brundisium','Italia',17.938,40.635,55.441,51.141)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(11,'Tarentum','Italia',17.239,40.468,54.146,51.662)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(12,'Syracusae','Italia',15.295,37.072,50.546,62.275)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(13,'Tarraco','Hispania',1.23,41.115,24.5,49.641)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(14,'Carthago Nova','Hispania',-0.992,37.605,20.385,60.609)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(15,'Corduba','Hispania',-4.78,37.884,13.37,59.737)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(16,'Hispalis','Hispania',-5.997,37.382,11.117,61.306)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(17,'Gades','Hispania',-6.293,36.529,10.569,63.972)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(18,'Emerita Augusta','Hispania',-6.347,38.915,10.469,56.516)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(19,'Caesaraugusta','Hispania',-0.872,41.646,20.607,47.981)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(20,'Barcino','Hispania',2.159,41.361,26.22,48.872)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(21,'Bracara Augusta','Hispania',-8.424,41.551,6.622,48.278)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(22,'Lugdunum','Gallia ve Ren',4.818,45.758,31.144,35.131)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(23,'Massilia','Gallia ve Ren',5.363,43.305,32.154,42.797)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(24,'Narbo','Gallia ve Ren',3.0,43.197,27.778,43.134)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(25,'Arelate','Gallia ve Ren',4.627,43.687,30.791,41.603)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(26,'Burdigala','Gallia ve Ren',-0.586,44.856,21.137,37.95)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(27,'Augusta Treverorum','Gallia ve Ren',6.681,49.761,34.594,22.622)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(28,'Colonia Agrippinensis','Gallia ve Ren',6.943,50.944,35.08,18.925)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(29,'Mogontiacum','Gallia ve Ren',8.256,50.007,37.511,21.853)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(30,'Londinium','Britannia',-0.083,51.52,22.069,17.125)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(31,'Camulodunum','Britannia',0.897,51.891,23.883,15.966)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(32,'Eburacum','Britannia',-1.113,53.954,20.161,9.519)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(33,'Athenae','Balkanlar ve Yunanistan',23.721,37.974,66.15,59.456)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(34,'Corinthus','Balkanlar ve Yunanistan',22.886,37.912,64.604,59.65)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(35,'Thessalonica','Balkanlar ve Yunanistan',22.966,40.635,64.752,51.141)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(36,'Dyrrhachium','Balkanlar ve Yunanistan',19.454,41.324,58.248,48.988)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(37,'Salona','Balkanlar ve Yunanistan',16.5,43.531,52.778,42.091)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(38,'Sirmium','Balkanlar ve Yunanistan',19.609,44.965,58.535,37.609)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(39,'Philippopolis','Balkanlar ve Yunanistan',24.735,42.146,68.028,46.419)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(40,'Byzantion','Balkanlar ve Yunanistan',28.985,41.018,75.898,49.944)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(41,'Ephesus','Anadolu',27.348,37.939,72.867,59.566)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(42,'Smyrna','Anadolu',27.141,38.427,72.483,58.041)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(43,'Pergamum','Anadolu',27.181,39.14,72.557,55.812)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(44,'Nicaea','Anadolu',29.723,40.436,77.265,51.763)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(45,'Nicomedia','Anadolu',29.924,40.77,77.637,50.719)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(46,'Ancyra','Anadolu',32.873,39.947,83.098,53.291)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(47,'Tarsus','Anadolu',34.901,36.915,86.854,62.766)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(48,'Caesarea (Cappadocia)','Anadolu',35.502,38.721,87.967,57.122)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(49,'Antiochia','Doğu Akdeniz',36.169,36.208,89.202,64.975)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(50,'Berytus','Doğu Akdeniz',35.521,33.898,88.002,72.194)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(51,'Tyrus','Doğu Akdeniz',35.198,33.277,87.404,74.134)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(52,'Caesarea Maritima','Doğu Akdeniz',34.898,32.508,86.848,76.537)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(53,'Damascus','Doğu Akdeniz',36.309,33.511,89.461,73.403)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(54,'Alexandria','Africa ve Aegyptus',29.91,31.2,77.611,80.625)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(55,'Carthago','Africa ve Aegyptus',10.312,36.846,41.319,62.981)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(56,'Lepcis Magna','Africa ve Aegyptus',14.292,32.637,48.689,76.134)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(57,'Cyrene','Africa ve Aegyptus',21.867,32.824,62.717,75.55)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(58,'Hippo Regius','Africa ve Aegyptus',7.754,36.888,36.581,62.85)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(59,'Hadrumetum','Africa ve Aegyptus',10.644,35.837,41.933,66.134)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.cities_v116 values(60,'Memphis','Africa ve Aegyptus',31.276,30.003,80.141,84.366)on conflict(id)do update set name=excluded.name,region=excluded.region;

insert into ludus_supply_private.destinations(id,name,description,seconds,yields,x,y,sort_order)
 select 'city-'||id,name,'Şehirden malzeme alımı',3600,'{}'::jsonb,x,y,100+id from ludus_supply_private.cities_v116 on conflict(id)do nothing;
create or replace function ludus_supply_private.offer_v116(p_city integer,p_sku text,p_epoch bigint)
returns jsonb language plpgsql stable set search_path='' as $$
declare g ludus_supply_private.market_goods_v116;rank integer;bar integer;coefficient numeric;capacity integer;sold integer;
begin
 select * into g from ludus_supply_private.market_goods_v116 where sku=p_sku;
 if not found or not exists(select 1 from ludus_supply_private.cities_v116 where id=p_city)then raise exception 'Şehir veya malzeme bulunamadı.';end if;
 rank:=mod(p_city-1+mod(p_epoch,60)::integer*17+g.slot*11,60);
 bar:=case when rank<15 then 10 when rank<20 then 9 when rank<30 then 8 else 1+mod(rank-30,7)end;
 coefficient:=(array[15.8,12,9,6.5,4.7,3.4,2.5,1.8,1.35,1]::numeric[])[bar];
 capacity:=bar*30;
 select quantity into sold from ludus_supply_private.market_sales_v116 where epoch=p_epoch and city=p_city and sku=p_sku;
 return jsonb_build_object('sku',p_sku,'bar',bar,'unit_price',round(g.base_price*coefficient,2),'stock',greatest(0,capacity-coalesce(sold,0)),'capacity',capacity);
end;$$;
create or replace function ludus_supply_private.city_v116(p_city integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();epoch bigint;city ludus_supply_private.cities_v116;goods jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 select * into city from ludus_supply_private.cities_v116 where id=p_city;
 if not found then raise exception 'Şehir bulunamadı.';end if;
 epoch:=floor(extract(epoch from ts)/60)::bigint;
 select jsonb_agg(ludus_supply_private.offer_v116(p_city,g.sku,epoch)||jsonb_build_object('name',r.name)order by g.slot)
 into goods from ludus_supply_private.market_goods_v116 g join ludus_supply_private.resources r using(sku);
 return jsonb_build_object('city',to_jsonb(city),'epoch',epoch,'expires_at',to_timestamp((epoch+1)*60),'server_now',ts,'goods',goods);
end;$$;
create or replace function public.ludus_caravan_city(p_city integer)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.city_v116(p_city)$$;

create or replace function ludus_supply_private.api(p_action text,p_key text,p_workers integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();food jsonb;answer jsonb;payload jsonb;
 receipt ludus_supply_private.receipts;dest ludus_supply_private.destinations;job ludus_supply_private.jobs;
 recipe ludus_supply_private.recipes;product public.ludus_shop_catalog;entry record;iid uuid;lv integer;
 total integer;occupied integer;qty integer;held integer;cargo jsonb;items jsonb;routes jsonb;open_jobs jsonb;crafts jsonb;delivered jsonb;parts text[];city_id integer;market_epoch bigint;offer jsonb;cost bigint;balance bigint;goods_sku text;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','send','claim','craft','buy')then raise exception 'Geçersiz işlem.';end if;
 -- One account lock orders progression, food, inventory and worker mutations.
 perform ludus_private.level_ensure(u);
 food:=ludus_food_private.api_v55('state',null,null,null);
 insert into ludus_supply_private.stock(owner_id,sku)select u,r.sku from ludus_supply_private.resources r where not r.food on conflict do nothing;
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
    if not found or dest.id not in('grain','apple','hunt','fish','egg','wine','olive_oil')then raise exception 'Bu malzeme sağ duvardaki şehir haritasından alınır.';end if;
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
    if market_epoch<>floor(extract(epoch from ts)/60)::bigint then raise exception 'Fiyatın süresi doldu. Şehirleri yeniden incele.';end if;
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
    select * into recipe from ludus_supply_private.recipes where sku=p_key;
    if not found then raise exception 'Üretim tarifi bulunamadı.';end if;
    for entry in select key,value::integer amount from jsonb_each_text(recipe.ingredients)loop
     select quantity into held from ludus_supply_private.stock where owner_id=u and sku=entry.key;
     if coalesce(held,0)<entry.amount then raise exception 'Üretim için malzemelerin eksik.';end if;
     update ludus_supply_private.stock set quantity=quantity-entry.amount where owner_id=u and sku=entry.key;
    end loop;
    select * into product from public.ludus_shop_catalog where sku=p_key;
    insert into public.ludus_items(owner_id,kind,model)values(u,product.kind,product.model)returning id into iid;
    answer:=jsonb_build_object('message','Basic +0 ekipman envanterine eklendi.','item_id',iid);
   end if;
   insert into ludus_supply_private.receipts(owner_id,request_id,payload,result)values(u,p_request,payload,answer);
  end if;
 end if;
 select jsonb_agg(to_jsonb(r)||jsonb_build_object('quantity',case when r.food then coalesce(f.quantity,0)else coalesce(s.quantity,0)end)order by r.sort_order)
 into items from ludus_supply_private.resources r left join ludus_supply_private.stock s on s.sku=r.sku and s.owner_id=u
 left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u;
 select jsonb_agg(to_jsonb(d)order by d.sort_order)into routes from ludus_supply_private.destinations d;
 select coalesce(jsonb_agg(to_jsonb(j)||jsonb_build_object('ready',j.ends_at<=ts)order by j.ends_at),'[]')into open_jobs
 from ludus_supply_private.jobs j where j.owner_id=u and j.claimed_at is null;
 select coalesce(sum(workers),0)::integer into occupied from ludus_supply_private.jobs where owner_id=u and claimed_at is null;
 select coalesce(jsonb_agg(to_jsonb(d)order by d.claimed_at desc),'[]')into delivered from(select j.id,j.destination,j.workers,j.cargo,j.claimed_at from ludus_supply_private.jobs j where j.owner_id=u and j.claimed_at is not null order by j.claimed_at desc limit 10)d;
 select jsonb_agg(jsonb_build_object('sku',r.sku,'ingredients',r.ingredients,'name',c.name,'kind',c.kind,'model',c.model)order by c.kind,r.sku)
 into crafts from ludus_supply_private.recipes r join public.ludus_shop_catalog c using(sku);
 return jsonb_build_object('user_id',u,'server_now',ts,'level',lv,'workers',total,'busy_workers',occupied,'free_workers',greatest(0,total-occupied),'caravans',total,'busy_caravans',occupied,'free_caravans',greatest(0,total-occupied),'caravan_capacity',15,
 'next_worker_level',case when lv<50 then (lv/10+1)*10 end,'next_caravan_level',case when lv<50 then (lv/10+1)*10 end,'unclaimed_workers',0,
 'resources',items,'destinations',routes,'jobs',open_jobs,'recipes',crafts,'automatic_delivery',true,'deliveries',delivered,'result',answer,'gold',(select gold from public.ludus_accounts where user_id=u),'cities',(select jsonb_agg(to_jsonb(c)order by id)from ludus_supply_private.cities_v116 c));
end;$$;
create or replace function ludus_private.level_claim(u uuid,lv integer)returns void language plpgsql set search_path='' as $$
declare r ludus_private.level_rewards;c ludus_private.level_reward_catalog;it public.ludus_items;pick public.ludus_shop_catalog;outcome jsonb;g jsonb;stones jsonb:='[]';items jsonb:='[]';f text;quantity integer;sid integer;j integer;
begin
 select * into r from ludus_private.level_rewards where owner_id=u and level=lv for update;
 if not found then raise exception 'Bu seviye henüz açılmadı.';end if;
 select * into c from ludus_private.level_reward_catalog where level=lv;
 if r.claimed_at is null then
  update public.ludus_accounts set gold=gold+c.denarius,diamonds=diamonds+c.diamonds,stones_version=stones_version+1 where user_id=u;
  foreach f in array array['sapphire','emerald','ruby']loop
   quantity:=case f when 'sapphire'then c.sapphire when 'emerald'then c.emerald else c.ruby end;
   for j in 1..quantity loop
    select stone_id into sid from public.ludus_stone_catalog where family=f order by random()limit 1;
    if sid is null then raise exception 'Taş kataloğu bulunamadı.';end if;
    insert into public.ludus_stones(owner_id,family,stone_id,quantity)values(u,f,sid,1)on conflict(owner_id,family,stone_id)do update set quantity=public.ludus_stones.quantity+1;
    stones:=stones||jsonb_build_array(jsonb_build_object('family',f,'id',sid,'quantity',1));
   end loop;
  end loop;
  for j in 1..c.items loop
   select * into pick from public.ludus_shop_catalog where kind in('weapon','shield','helmet','chest','gloves','legs')order by random()limit 1;
   if not found then raise exception 'Eşya kataloğu bulunamadı.';end if;
   insert into public.ludus_items(owner_id,kind,model)values(u,pick.kind,pick.model)returning * into it;
   items:=items||jsonb_build_array(to_jsonb(it));
  end loop;
  if c.gladiators>0 then g:=ludus_private.level_deliver_gladiator(u,lv);end if;
  outcome:=jsonb_build_object('gold',c.denarius,'diamonds',c.diamonds,'stones',stones,'items',items,'gladiator',g,'workers',0,'caravans',c.caravans,'caravans_automatic',true);
  update ludus_private.level_rewards set claimed_at=clock_timestamp(),rewards=outcome,gladiator_pending=c.gladiators>0 and g is null where owner_id=u and level=lv;
 elsif r.gladiator_pending then
  g:=ludus_private.level_deliver_gladiator(u,lv);
  if g is not null then update ludus_private.level_rewards set rewards=rewards||jsonb_build_object('gladiator',g),gladiator_pending=false where owner_id=u and level=lv;end if;
 end if;
end $$;
create or replace function ludus_private.level_state(u uuid)returns jsonb language plpgsql set search_path='' as $$
declare p public.ludus_progression;lv integer;lower_exp bigint;cost bigint;owned integer;eligible boolean;rows jsonb;d date:=(clock_timestamp()at time zone'Europe/Istanbul')::date;
begin
 select * into p from public.ludus_progression where owner_id=u;lv:=ludus_private.level_from_exp(p.experience);
 lower_exp:=ludus_private.level_threshold(lv);cost:=case when lv<50 then ludus_private.level_exp_cost(lv)else 0 end;
 select count(*)::integer into owned from public.ludus_gladiators where owner_id=u;
 eligible:=owned<greatest(p.legacy_slots,ludus_private.level_granted_gladiators(lv))and exists(
  select 1 from unnest(array['murmillo','thraex','hoplomachus','secutor','retiarius','provocator','scissor'])c where not exists(select 1 from public.ludus_gladiators where owner_id=u and class=c));
 select jsonb_agg(to_jsonb(c)||jsonb_build_object('unlocked',c.level<=lv,'claimed',r.claimed_at is not null,'gladiator_pending',coalesce(r.gladiator_pending,false),'claimable',c.level<=lv and(r.claimed_at is null or(r.gladiator_pending and eligible)),'result',coalesce(r.rewards,'{}'))order by c.level)into rows
 from ludus_private.level_reward_catalog c left join ludus_private.level_rewards r on r.owner_id=u and r.level=c.level;
 return jsonb_build_object('server_now',clock_timestamp(),'level',lv,'experience',p.experience,'current_exp',case when lv<50 then p.experience-lower_exp else 0 end,'next_exp',cost,'starting_gladiators',2,'granted_gladiators',ludus_private.level_granted_gladiators(lv),'owned_gladiators',owned,'gladiator_slots',greatest(p.legacy_slots,ludus_private.level_granted_gladiators(lv)),
  'battle_exp_today',case when p.battle_day=d then p.battle_exp else 0 end,'battle_wins_today',case when p.battle_day=d then p.battle_wins else 0 end,'battle_exp_limit',2500,'rewards',rows,
  'claimable_count',(select count(*)from jsonb_array_elements(rows)q where(q->>'claimable')::boolean),'pending_gladiator_count',(select count(*)from ludus_private.level_rewards where owner_id=u and gladiator_pending),
  'workers',ludus_supply_private.worker_count(u),'caravans',ludus_supply_private.worker_count(u),'caravan_limit',6,'starting_caravans',1,'next_worker_level',case when lv<50 then (lv/10+1)*10 end,'next_caravan_level',case when lv<50 then (lv/10+1)*10 end,'wallet',(select jsonb_build_object('gold',gold,'diamonds',diamonds,'ludus_name',ludus_name)from public.ludus_accounts where user_id=u),
  'last_exp',(select jsonb_build_object('source',source,'key',source_key,'experience',experience)from ludus_private.level_exp_events where owner_id=u order by occurred_at desc limit 1));
end $$;
alter table ludus_supply_private.cities_v116 enable row level security;
alter table ludus_supply_private.market_goods_v116 enable row level security;
alter table ludus_supply_private.market_sales_v116 enable row level security;
revoke all on ludus_supply_private.cities_v116,ludus_supply_private.market_goods_v116,ludus_supply_private.market_sales_v116 from public,anon,authenticated;
revoke all on function ludus_supply_private.offer_v116(integer,text,bigint),ludus_supply_private.city_v116(integer)from public,anon,authenticated;
grant execute on function ludus_supply_private.city_v116(integer)to authenticated;
revoke all on function public.ludus_caravan_city(integer)from public,anon;
grant execute on function public.ludus_caravan_city(integer)to authenticated;
notify pgrst,'reload schema';

-- The optional introduction guide follows the new level-one availability.
do $guide$ declare definition text;begin
 if to_regprocedure('ludus_private.first_quests_state_v111(text,text,text)')is not null then
  select pg_get_functiondef('ludus_private.first_quests_state_v111(text,text,text)'::regprocedure)into definition;
  if position('not advanced or lv>=5' in definition)>0 then
   execute replace(definition,'not advanced or lv>=5','true');
  end if;
 end if;
end;$guide$;
