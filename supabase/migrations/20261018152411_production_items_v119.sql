-- V119: complete ingots and direct equipment recipes. No inventory/currency resets.
alter table ludus_supply_private.resources add column if not exists active boolean not null default true;
update ludus_supply_private.resources set active=false where sku in('wooden_handle','shield_frame_small','shield_frame_large','lead_weight','net_mesh');
-- Retired stock is retained for historical receipts; it is never an active ingredient.
update ludus_supply_private.resources set sort_order=sort_order+10000;
insert into ludus_supply_private.resources(sku,name,food,sort_order,stage,active)values
 ('iron_ore','Demir cevheri',false,1,'raw',true),
 ('copper_ore','Bakır cevheri',false,2,'raw',true),
 ('tin_ore','Kalay cevheri',false,3,'raw',true),
 ('lead_ore','Kurşun cevheri',false,4,'raw',true),
 ('wood','Odun',false,5,'raw',true),
 ('flax','Ham keten',false,6,'raw',true),
 ('hide','Ham deri',false,7,'raw',true),
 ('wool','Yün',false,8,'raw',true),
 ('resin','Reçine',false,9,'raw',true),
 ('charcoal','Odun kömürü',false,10,'processed',true),
 ('iron','Demir külçe',false,11,'processed',true),
 ('copper','Bakır külçe',false,12,'processed',true),
 ('tin','Kalay külçe',false,13,'processed',true),
 ('lead','Kurşun külçe',false,14,'processed',true),
 ('bronze','Bronz külçe',false,15,'processed',true),
 ('steel','Çelik külçe',false,16,'processed',true),
 ('leather','İşlenmiş deri',false,17,'processed',true),
 ('rope','İp',false,18,'processed',true),
 ('linen','Keten kumaş',false,19,'processed',true),
 ('wool_cloth','Yünlü kumaş',false,20,'processed',true),
 ('bow','Yay',false,21,'supply',true),
 ('arrow','Ok',false,22,'supply',true),
 ('grain','Tahıl',true,101,'food',true),
 ('apple','Elma',true,102,'food',true),
 ('meat','Et',true,103,'food',true),
 ('fish','Balık',true,104,'food',true),
 ('egg','Yumurta',true,105,'food',true),
 ('beer','Şarap',true,106,'food',true),
 ('olive_oil','Zeytinyağı',true,107,'food',true)
on conflict(sku)do update set name=excluded.name,food=excluded.food,sort_order=excluded.sort_order,stage=excluded.stage,active=true;
delete from ludus_supply_private.production_recipes_v118 where sku in('wooden_handle','shield_frame_small','shield_frame_large','lead_weight','net_mesh');
update ludus_supply_private.production_recipes_v118 set sort_order=sort_order+1000;
insert into ludus_supply_private.production_recipes_v118 values
 ('charcoal','Odun kömürü','material',null,'{"wood":2}'::jsonb,'resource',1,1),
 ('iron','Demir külçe','material',null,'{"iron_ore":2,"charcoal":1}'::jsonb,'resource',1,2),
 ('copper','Bakır külçe','material',null,'{"copper_ore":2,"charcoal":1}'::jsonb,'resource',1,3),
 ('tin','Kalay külçe','material',null,'{"tin_ore":2,"charcoal":1}'::jsonb,'resource',1,4),
 ('lead','Kurşun külçe','material',null,'{"lead_ore":2,"charcoal":1}'::jsonb,'resource',1,5),
 ('bronze','Bronz külçe','material',null,'{"copper":3,"tin":1,"charcoal":1}'::jsonb,'resource',1,6),
 ('steel','Çelik külçe','material',null,'{"iron":1,"charcoal":1}'::jsonb,'resource',1,7),
 ('leather','İşlenmiş deri','material',null,'{"hide":1}'::jsonb,'resource',1,8),
 ('rope','İp','material',null,'{"flax":2}'::jsonb,'resource',1,9),
 ('linen','Keten kumaş','material',null,'{"flax":3}'::jsonb,'resource',1,10),
 ('wool_cloth','Yünlü kumaş','material',null,'{"wool":3}'::jsonb,'resource',1,11),
 ('gladius','Gladius','weapon','gladius','{"steel":2,"leather":1,"wood":1}'::jsonb,'equipment',1,12),
 ('sica','Sica','weapon','sica','{"iron":2,"leather":1,"wood":1}'::jsonb,'equipment',1,13),
 ('spear','Mızrak','weapon','spear','{"steel":6,"wood":3,"resin":3,"rope":2}'::jsonb,'equipment',1,14),
 ('trident','Trident','weapon','trident','{"steel":8,"wood":3,"resin":3,"rope":3}'::jsonb,'equipment',1,15),
 ('mace','Zincirli gürz','weapon','mace','{"iron":2,"wood":1,"resin":1,"leather":1}'::jsonb,'equipment',1,16),
 ('whip','Kırbaç','weapon','whip','{"leather":3,"wood":1}'::jsonb,'equipment',1,17),
 ('scissor','Kol bıçağı','weapon','scissor','{"iron":2,"leather":1}'::jsonb,'equipment',1,18),
 ('net','Savaş ağı','weapon','net','{"rope":8,"lead":4}'::jsonb,'equipment',1,19),
 ('shield-medium','Küçük kalkan','shield','round','{"wood":3,"resin":1,"leather":2,"bronze":1}'::jsonb,'equipment',1,20),
 ('shield-large','Büyük kalkan','shield','large','{"wood":6,"resin":2,"leather":3,"bronze":2}'::jsonb,'equipment',1,21),
 ('helmet-gold','Gladyatör miğferi','helmet','gold','{"bronze":4,"leather":3,"linen":2,"wool_cloth":1}'::jsonb,'equipment',1,22),
 ('helmet-roman','Roma miğferi','helmet','roman','{"bronze":4,"leather":2,"linen":3,"wool_cloth":1}'::jsonb,'equipment',1,23),
 ('helmet-silver','Secutor miğferi','helmet','silver','{"iron":12,"leather":4,"linen":3,"wool_cloth":1}'::jsonb,'equipment',1,24),
 ('helmet-winged','Thraex miğferi','helmet','winged','{"iron":10,"bronze":1,"leather":4,"linen":3,"wool_cloth":1}'::jsonb,'equipment',1,25),
 ('chest','Gladyatör göğüs zırhı','chest','gladiator_chest','{"iron":14,"leather":7,"linen":4,"wool_cloth":2}'::jsonb,'equipment',1,26),
 ('chest-plate','İşlemeli göğüs zırhı','chest','chest_plate','{"iron":18,"leather":8,"linen":5,"wool_cloth":3}'::jsonb,'equipment',1,27),
 ('gloves','İşlemeli çift omuzluk','gloves','armor_shoulder','{"leather":2,"bronze":1,"wool_cloth":1}'::jsonb,'equipment',1,28),
 ('shoulder-armor','Çift omuz koruma','gloves','shoulder_armor','{"iron":3,"leather":4,"linen":1,"wool_cloth":1}'::jsonb,'equipment',1,29),
 ('manica','Kolluk','gloves','manica','{"bronze":2,"leather":2,"wool_cloth":1}'::jsonb,'equipment',1,30),
 ('legs','Bacaklık','legs','starter','{"bronze":1,"leather":1,"wool_cloth":1}'::jsonb,'equipment',1,31),
 ('bow','Yay','supply',null,'{"wood":3,"rope":2,"resin":1}'::jsonb,'resource',1,32),
 ('arrow','Ok','supply',null,'{"wood":5,"iron":1,"rope":1}'::jsonb,'resource',50,33)
on conflict(sku)do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('gladius','Gladius','weapon','gladius',100,'Silahlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('gladius','{"steel":2,"leather":1,"wood":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('sica','Sica','weapon','sica',100,'Silahlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('sica','{"iron":2,"leather":1,"wood":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('spear','Mızrak','weapon','spear',100,'Silahlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('spear','{"steel":6,"wood":3,"resin":3,"rope":2}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('trident','Trident','weapon','trident',100,'Silahlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('trident','{"steel":8,"wood":3,"resin":3,"rope":3}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('mace','Zincirli gürz','weapon','mace',100,'Silahlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('mace','{"iron":2,"wood":1,"resin":1,"leather":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('whip','Kırbaç','weapon','whip',100,'Silahlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('whip','{"leather":3,"wood":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('scissor','Kol bıçağı','weapon','scissor',100,'Silahlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('scissor','{"iron":2,"leather":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('net','Savaş ağı','weapon','net',100,'Silahlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('net','{"rope":8,"lead":4}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('shield-medium','Küçük kalkan','shield','round',100,'Kalkanlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('shield-medium','{"wood":3,"resin":1,"leather":2,"bronze":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('shield-large','Büyük kalkan','shield','large',100,'Kalkanlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('shield-large','{"wood":6,"resin":2,"leather":3,"bronze":2}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('helmet-gold','Gladyatör miğferi','helmet','gold',100,'Miğferler')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('helmet-gold','{"bronze":4,"leather":3,"linen":2,"wool_cloth":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('helmet-roman','Roma miğferi','helmet','roman',100,'Miğferler')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('helmet-roman','{"bronze":4,"leather":2,"linen":3,"wool_cloth":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('helmet-silver','Secutor miğferi','helmet','silver',100,'Miğferler')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('helmet-silver','{"iron":12,"leather":4,"linen":3,"wool_cloth":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('helmet-winged','Thraex miğferi','helmet','winged',100,'Miğferler')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('helmet-winged','{"iron":10,"bronze":1,"leather":4,"linen":3,"wool_cloth":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('chest','Gladyatör göğüs zırhı','chest','gladiator_chest',100,'Zırhlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('chest','{"iron":14,"leather":7,"linen":4,"wool_cloth":2}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('chest-plate','İşlemeli göğüs zırhı','chest','chest_plate',100,'Zırhlar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('chest-plate','{"iron":18,"leather":8,"linen":5,"wool_cloth":3}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('gloves','İşlemeli çift omuzluk','gloves','armor_shoulder',100,'Kolluk / omuzluk')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('gloves','{"leather":2,"bronze":1,"wool_cloth":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('shoulder-armor','Çift omuz koruma','gloves','shoulder_armor',100,'Kolluk / omuzluk')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('shoulder-armor','{"iron":3,"leather":4,"linen":1,"wool_cloth":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('manica','Kolluk','gloves','manica',100,'Kolluk / omuzluk')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('manica','{"bronze":2,"leather":2,"wool_cloth":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values('legs','Bacaklık','legs','starter',100,'Bacaklıklar')on conflict(sku)do update set name=excluded.name;
insert into ludus_supply_private.recipes(sku,ingredients)values('legs','{"bronze":1,"leather":1,"wool_cloth":1}'::jsonb)on conflict(sku)do update set ingredients=excluded.ingredients;
update public.ludus_food_catalog set name='Tahıl' where sku='grain';
update public.ludus_food_catalog set name='Elma' where sku='apple';
update public.ludus_food_catalog set name='Et' where sku='meat';
update public.ludus_food_catalog set name='Balık' where sku='fish';
update public.ludus_food_catalog set name='Yumurta' where sku='egg';
update public.ludus_food_catalog set name='Şarap' where sku='beer';
update public.ludus_food_catalog set name='Zeytinyağı' where sku='olive_oil';
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


notify pgrst, 'reload schema';
