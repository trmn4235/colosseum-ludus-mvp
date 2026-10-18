-- V118: integer-only production, one steel Gladius and a complete item catalog.
-- Existing stock IDs, equipment instances, receipts and caravan cargo are preserved.
alter table ludus_supply_private.resources add column if not exists stage text not null default 'processed';
update ludus_supply_private.resources set sort_order=sort_order+10000;
insert into ludus_supply_private.resources(sku,name,food,sort_order,stage)values
 ('iron_ore','Demir cevheri',false,1,'raw'),
 ('copper_ore','Bakır cevheri',false,2,'raw'),
 ('tin_ore','Kalay cevheri',false,3,'raw'),
 ('lead_ore','Kurşun cevheri',false,4,'raw'),
 ('wood','Odun',false,5,'raw'),
 ('flax','Ham keten',false,6,'raw'),
 ('hide','Ham deri',false,7,'raw'),
 ('wool','Yün',false,8,'raw'),
 ('resin','Reçine',false,9,'raw'),
 ('charcoal','Odun kömürü',false,10,'processed'),
 ('iron','Demir külçe',false,11,'processed'),
 ('copper','Bakır külçe',false,12,'processed'),
 ('bronze','Bronz külçe',false,13,'processed'),
 ('steel','Çelik külçe',false,14,'processed'),
 ('leather','İşlenmiş deri',false,15,'processed'),
 ('rope','İp',false,16,'processed'),
 ('linen','Keten kumaş',false,17,'processed'),
 ('wool_cloth','Yünlü kumaş',false,18,'processed'),
 ('wooden_handle','Ahşap sap',false,19,'processed'),
 ('shield_frame_small','Küçük kalkan gövdesi',false,20,'processed'),
 ('shield_frame_large','Büyük kalkan gövdesi',false,21,'processed'),
 ('lead_weight','Kurşun ağırlık',false,22,'processed'),
 ('net_mesh','Ağ gövdesi',false,23,'processed'),
 ('bow','Yay',false,24,'supply'),
 ('arrow','Ok',false,25,'supply'),
 ('grain','Tahıl',true,101,'food'),
 ('apple','Elma',true,102,'food'),
 ('meat','Et',true,103,'food'),
 ('fish','Balık',true,104,'food'),
 ('egg','Yumurta',true,105,'food'),
 ('beer','Şarap',true,106,'food'),
 ('olive_oil','Zeytinyağı',true,107,'food')
on conflict(sku)do update set name=excluded.name,food=excluded.food,sort_order=excluded.sort_order,stage=excluded.stage;

create or replace function ludus_supply_private.valid_ingredients_v118(p jsonb)
returns boolean language sql immutable strict set search_path='' as $$
 select case when jsonb_typeof(p)<>'object' then false else
  p<>'{}'::jsonb and not exists(select 1 from jsonb_each(p)e where jsonb_typeof(e.value)<>'number' or e.value::text!~'^[1-9][0-9]*$') end
$$;
revoke all on function ludus_supply_private.valid_ingredients_v118(jsonb)from public,anon,authenticated;
create table if not exists ludus_supply_private.production_recipes_v118(
 sku text primary key,name text not null,kind text not null,model text,
 ingredients jsonb not null check(ludus_supply_private.valid_ingredients_v118(ingredients)),
 output_type text not null check(output_type in('equipment','resource')),
 output_quantity integer not null check((sku='arrow' and output_quantity=50)or(sku<>'arrow' and output_quantity=1)),
 sort_order integer not null unique
);
alter table ludus_supply_private.production_recipes_v118 enable row level security;
revoke all on ludus_supply_private.production_recipes_v118 from public,anon,authenticated;
insert into ludus_supply_private.production_recipes_v118 values
 ('charcoal','Odun kömürü','material',null,'{"wood":2}'::jsonb,'resource',1,1),
 ('iron','Demir külçe','material',null,'{"iron_ore":2,"charcoal":1}'::jsonb,'resource',1,2),
 ('copper','Bakır külçe','material',null,'{"copper_ore":2,"charcoal":1}'::jsonb,'resource',1,3),
 ('bronze','Bronz külçe','material',null,'{"copper":3,"tin_ore":1,"charcoal":1}'::jsonb,'resource',1,4),
 ('steel','Çelik külçe','material',null,'{"iron":1,"charcoal":1}'::jsonb,'resource',1,5),
 ('leather','İşlenmiş deri','material',null,'{"hide":1}'::jsonb,'resource',1,6),
 ('rope','İp','material',null,'{"flax":2}'::jsonb,'resource',1,7),
 ('linen','Keten kumaş','material',null,'{"flax":3}'::jsonb,'resource',1,8),
 ('wool_cloth','Yünlü kumaş','material',null,'{"wool":3}'::jsonb,'resource',1,9),
 ('wooden_handle','Ahşap sap','material',null,'{"wood":1,"resin":1}'::jsonb,'resource',1,10),
 ('shield_frame_small','Küçük kalkan gövdesi','material',null,'{"wood":3,"resin":1}'::jsonb,'resource',1,11),
 ('shield_frame_large','Büyük kalkan gövdesi','material',null,'{"wood":6,"resin":2}'::jsonb,'resource',1,12),
 ('lead_weight','Kurşun ağırlık','material',null,'{"lead_ore":2,"charcoal":1}'::jsonb,'resource',1,13),
 ('net_mesh','Ağ gövdesi','material',null,'{"rope":3}'::jsonb,'resource',1,14),
 ('gladius','Gladius','weapon','gladius','{"steel":2,"leather":1,"wood":1}'::jsonb,'equipment',1,15),
 ('sica','Sica','weapon','sica','{"iron":2,"leather":1,"wood":1}'::jsonb,'equipment',1,16),
 ('spear','Mızrak','weapon','spear','{"steel":6,"wooden_handle":3,"rope":2}'::jsonb,'equipment',1,17),
 ('trident','Trident','weapon','trident','{"steel":8,"wooden_handle":3,"rope":3}'::jsonb,'equipment',1,18),
 ('mace','Zincirli gürz','weapon','mace','{"iron":2,"wooden_handle":1,"leather":1}'::jsonb,'equipment',1,19),
 ('whip','Kırbaç','weapon','whip','{"leather":3,"wood":1}'::jsonb,'equipment',1,20),
 ('scissor','Kol bıçağı','weapon','scissor','{"iron":2,"leather":1}'::jsonb,'equipment',1,21),
 ('net','Savaş ağı','weapon','net','{"net_mesh":2,"rope":2,"lead_weight":4}'::jsonb,'equipment',1,22),
 ('shield-medium','Küçük kalkan','shield','round','{"shield_frame_small":1,"leather":2,"bronze":1}'::jsonb,'equipment',1,23),
 ('shield-large','Büyük kalkan','shield','large','{"shield_frame_large":1,"leather":3,"bronze":2}'::jsonb,'equipment',1,24),
 ('helmet-gold','Gladyatör miğferi','helmet','gold','{"bronze":4,"leather":3,"linen":2,"wool_cloth":1}'::jsonb,'equipment',1,25),
 ('helmet-roman','Roma miğferi','helmet','roman','{"bronze":4,"leather":2,"linen":3,"wool_cloth":1}'::jsonb,'equipment',1,26),
 ('helmet-silver','Şövalye miğferi','helmet','silver','{"iron":12,"leather":4,"linen":3,"wool_cloth":1}'::jsonb,'equipment',1,27),
 ('helmet-winged','Kanatlı miğfer','helmet','winged','{"iron":10,"bronze":1,"leather":4,"linen":3,"wool_cloth":1}'::jsonb,'equipment',1,28),
 ('chest','Gladyatör göğüs zırhı','chest','gladiator_chest','{"iron":14,"leather":7,"linen":4,"wool_cloth":2}'::jsonb,'equipment',1,29),
 ('chest-plate','İşlemeli göğüs zırhı','chest','chest_plate','{"iron":18,"leather":8,"linen":5,"wool_cloth":3}'::jsonb,'equipment',1,30),
 ('gloves','İşlemeli çift omuzluk','gloves','armor_shoulder','{"leather":2,"bronze":1,"wool_cloth":1}'::jsonb,'equipment',1,31),
 ('shoulder-armor','Çift omuz koruma','gloves','shoulder_armor','{"iron":3,"leather":4,"linen":1,"wool_cloth":1}'::jsonb,'equipment',1,32),
 ('legs','Bacaklık','legs','starter','{"bronze":1,"leather":1,"wool_cloth":1}'::jsonb,'equipment',1,33),
 ('bow','Yay','supply',null,'{"wood":3,"rope":2,"resin":1}'::jsonb,'resource',1,34),
 ('arrow','Ok','supply',null,'{"wood":5,"iron":1,"rope":1}'::jsonb,'resource',50,35)
on conflict(sku)do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;
update public.ludus_shop_catalog set name='Gladius' where sku='gladius';
update ludus_supply_private.recipes set ingredients='{"steel":2,"leather":1,"wood":1}'::jsonb where sku='gladius';
update public.ludus_shop_catalog set name='Sica' where sku='sica';
update ludus_supply_private.recipes set ingredients='{"iron":2,"leather":1,"wood":1}'::jsonb where sku='sica';
update public.ludus_shop_catalog set name='Mızrak' where sku='spear';
update ludus_supply_private.recipes set ingredients='{"steel":6,"wooden_handle":3,"rope":2}'::jsonb where sku='spear';
update public.ludus_shop_catalog set name='Trident' where sku='trident';
update ludus_supply_private.recipes set ingredients='{"steel":8,"wooden_handle":3,"rope":3}'::jsonb where sku='trident';
update public.ludus_shop_catalog set name='Zincirli gürz' where sku='mace';
update ludus_supply_private.recipes set ingredients='{"iron":2,"wooden_handle":1,"leather":1}'::jsonb where sku='mace';
update public.ludus_shop_catalog set name='Kırbaç' where sku='whip';
update ludus_supply_private.recipes set ingredients='{"leather":3,"wood":1}'::jsonb where sku='whip';
update public.ludus_shop_catalog set name='Kol bıçağı' where sku='scissor';
update ludus_supply_private.recipes set ingredients='{"iron":2,"leather":1}'::jsonb where sku='scissor';
update public.ludus_shop_catalog set name='Savaş ağı' where sku='net';
update ludus_supply_private.recipes set ingredients='{"net_mesh":2,"rope":2,"lead_weight":4}'::jsonb where sku='net';
update public.ludus_shop_catalog set name='Küçük kalkan' where sku='shield-medium';
update ludus_supply_private.recipes set ingredients='{"shield_frame_small":1,"leather":2,"bronze":1}'::jsonb where sku='shield-medium';
update public.ludus_shop_catalog set name='Büyük kalkan' where sku='shield-large';
update ludus_supply_private.recipes set ingredients='{"shield_frame_large":1,"leather":3,"bronze":2}'::jsonb where sku='shield-large';
update public.ludus_shop_catalog set name='Gladyatör miğferi' where sku='helmet-gold';
update ludus_supply_private.recipes set ingredients='{"bronze":4,"leather":3,"linen":2,"wool_cloth":1}'::jsonb where sku='helmet-gold';
update public.ludus_shop_catalog set name='Roma miğferi' where sku='helmet-roman';
update ludus_supply_private.recipes set ingredients='{"bronze":4,"leather":2,"linen":3,"wool_cloth":1}'::jsonb where sku='helmet-roman';
update public.ludus_shop_catalog set name='Şövalye miğferi' where sku='helmet-silver';
update ludus_supply_private.recipes set ingredients='{"iron":12,"leather":4,"linen":3,"wool_cloth":1}'::jsonb where sku='helmet-silver';
update public.ludus_shop_catalog set name='Kanatlı miğfer' where sku='helmet-winged';
update ludus_supply_private.recipes set ingredients='{"iron":10,"bronze":1,"leather":4,"linen":3,"wool_cloth":1}'::jsonb where sku='helmet-winged';
update public.ludus_shop_catalog set name='Gladyatör göğüs zırhı' where sku='chest';
update ludus_supply_private.recipes set ingredients='{"iron":14,"leather":7,"linen":4,"wool_cloth":2}'::jsonb where sku='chest';
update public.ludus_shop_catalog set name='İşlemeli göğüs zırhı' where sku='chest-plate';
update ludus_supply_private.recipes set ingredients='{"iron":18,"leather":8,"linen":5,"wool_cloth":3}'::jsonb where sku='chest-plate';
update public.ludus_shop_catalog set name='İşlemeli çift omuzluk' where sku='gloves';
update ludus_supply_private.recipes set ingredients='{"leather":2,"bronze":1,"wool_cloth":1}'::jsonb where sku='gloves';
update public.ludus_shop_catalog set name='Çift omuz koruma' where sku='shoulder-armor';
update ludus_supply_private.recipes set ingredients='{"iron":3,"leather":4,"linen":1,"wool_cloth":1}'::jsonb where sku='shoulder-armor';
update public.ludus_shop_catalog set name='Bacaklık' where sku='legs';
update ludus_supply_private.recipes set ingredients='{"bronze":1,"leather":1,"wool_cloth":1}'::jsonb where sku='legs';

-- Keep historical sale references, but sell only the nine unprocessed materials.
alter table ludus_supply_private.market_goods_v116 add column if not exists active boolean not null default true;
update ludus_supply_private.market_goods_v116 set active=false,slot=case sku when 'iron' then 100 when 'copper' then 101 when 'leather' then 103 when 'linen' then 104 end where sku in('iron','copper','leather','linen');
update ludus_supply_private.market_goods_v116 set slot=4 where sku='wood';
insert into ludus_supply_private.market_goods_v116(sku,base_price,slot,active)values
 ('iron_ore',1.5,0,true),
 ('copper_ore',1.2,1,true),
 ('tin_ore',2,2,true),
 ('lead_ore',1,3,true),
 ('wood',0.6,4,true),
 ('flax',1,5,true),
 ('hide',2.5,6,true),
 ('wool',1.2,7,true),
 ('resin',0.8,8,true)
on conflict(sku)do update set base_price=excluded.base_price,slot=excluded.slot,active=true;

create or replace function ludus_supply_private.offer_v116(p_city integer,p_sku text,p_epoch bigint)
returns jsonb language plpgsql stable set search_path='' as $$
declare g ludus_supply_private.market_goods_v116;rank integer;bar integer;coefficient numeric;capacity integer;sold integer;
begin
 select * into g from ludus_supply_private.market_goods_v116 where sku=p_sku and active;
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
 into goods from ludus_supply_private.market_goods_v116 g join ludus_supply_private.resources r using(sku) where g.active;
 return jsonb_build_object('city',to_jsonb(city),'epoch',epoch,'expires_at',to_timestamp((epoch+1)*60),'server_now',ts,'goods',goods);
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
 left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u;
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

notify pgrst, 'reload schema';
