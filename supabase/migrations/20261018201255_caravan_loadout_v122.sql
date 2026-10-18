-- Kervancı equipment is reserved with a departure and returned atomically with its cargo.
alter table ludus_supply_private.jobs add column if not exists loadout jsonb not null default '{}'::jsonb;
create table if not exists ludus_supply_private.departure_receipts_v122(
 owner_id uuid not null references public.ludus_accounts(user_id),request_id uuid not null,payload jsonb not null,result jsonb not null,primary key(owner_id,request_id)
);
alter table ludus_supply_private.departure_receipts_v122 enable row level security;
revoke all on ludus_supply_private.departure_receipts_v122 from public,anon,authenticated;
create table if not exists ludus_supply_private.hunt_team_v122(
 owner_id uuid primary key references public.ludus_accounts(user_id),gladiators uuid[] not null,
 updated_at timestamptz not null default clock_timestamp(),
 check(cardinality(gladiators)=2 and gladiators[1]is not null and gladiators[2]is not null and gladiators[1]<>gladiators[2])
);
alter table ludus_supply_private.hunt_team_v122 enable row level security;
revoke all on ludus_supply_private.hunt_team_v122 from public,anon,authenticated;

create or replace function ludus_supply_private.settle_owner_v87(p_owner uuid,p_until timestamptz default clock_timestamp())
returns integer language plpgsql security invoker set search_path='' as $$
declare j ludus_supply_private.jobs;entry record;delivered integer:=0;blocked boolean;today date:=(p_until at time zone'Europe/Istanbul')::date;crew integer;
begin
 if not exists(select 1 from ludus_supply_private.jobs where owner_id=p_owner and claimed_at is null and ends_at<=p_until)then return 0;end if;
 -- The same account -> food -> job order is shared with purchases and crafting.
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 if not found then return 0;end if;
 select count(*)::integer into crew from public.ludus_gladiators where owner_id=p_owner;
 insert into public.ludus_food_house(owner_id,crew_count,settled_day)values(p_owner,crew,today-1)on conflict(owner_id)do nothing;
 insert into public.ludus_food_stock(owner_id,sku)select p_owner,sku from public.ludus_food_catalog on conflict do nothing;
 insert into ludus_supply_private.stock(owner_id,sku)select p_owner,sku from ludus_supply_private.resources where not food on conflict do nothing;
 -- New cargo never feeds a day that finished before its delivery.
 perform ludus_food_private.settle_v55(p_owner,today);
 update public.ludus_food_house set crew_count=crew where owner_id=p_owner;
 for j in select * from ludus_supply_private.jobs where owner_id=p_owner and claimed_at is null and ends_at<=p_until order by ends_at,id for update loop
  select exists(
   select 1 from jsonb_each_text(j.cargo||j.loadout)e left join ludus_supply_private.resources r on r.sku=e.key
   left join public.ludus_food_stock f on f.owner_id=p_owner and f.sku=e.key
   left join ludus_supply_private.stock s on s.owner_id=p_owner and s.sku=e.key
   where r.sku is null or (case when r.food then coalesce(f.quantity,0)else coalesce(s.quantity,0)end)+e.value::integer>50000
  )into blocked;
  if blocked then
   -- Retry later without discarding any part of a mixed cargo or starving other owners.
   update ludus_supply_private.jobs set delivery_check_at=p_until+interval'5 minutes'where id=j.id;
   continue;
  end if;
  for entry in select e.key,e.value::integer amount,r.food from jsonb_each_text(j.cargo||j.loadout)e join ludus_supply_private.resources r on r.sku=e.key loop
   if entry.food then update public.ludus_food_stock set quantity=quantity+entry.amount where owner_id=p_owner and sku=entry.key;
   else update ludus_supply_private.stock set quantity=quantity+entry.amount where owner_id=p_owner and sku=entry.key;end if;
  end loop;
  update ludus_supply_private.jobs set claimed_at=p_until,delivery_check_at=null where id=j.id;
  delivered:=delivered+1;
 end loop;
 return delivered;
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
     for entry in select j.key,j.value::integer amount,r.food from jsonb_each_text(job.cargo||job.loadout)j join ludus_supply_private.resources r on r.sku=j.key loop
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
 select coalesce(jsonb_agg(to_jsonb(d)order by d.claimed_at desc),'[]')into delivered from(select j.id,j.destination,j.workers,j.cargo,j.loadout,j.claimed_at from ludus_supply_private.jobs j where j.owner_id=u and j.claimed_at is not null order by j.claimed_at desc limit 10)d;
 select jsonb_agg(to_jsonb(r)||jsonb_build_object('group',case when r.kind='material' then 'processing' else 'equipment' end)order by r.sort_order)
 into crafts from ludus_supply_private.production_recipes_v118 r;
 return jsonb_build_object('user_id',u,'server_now',ts,'level',lv,'workers',total,'busy_workers',occupied,'free_workers',greatest(0,total-occupied),'caravans',total,'busy_caravans',occupied,'free_caravans',greatest(0,total-occupied),'caravan_capacity',15,
 'next_worker_level',case when lv<50 then (lv/10+1)*10 end,'next_caravan_level',case when lv<50 then (lv/10+1)*10 end,'unclaimed_workers',0,
 'resources',items,'destinations',routes,'jobs',open_jobs,'recipes',crafts,'automatic_delivery',true,'deliveries',delivered,'result',answer,'gold',(select gold from public.ludus_accounts where user_id=u),'cities',(select jsonb_agg(to_jsonb(c)order by id)from ludus_supply_private.cities_v116 c));
end;$$;

create or replace function ludus_supply_private.depart_v122(p_action text,p_key text,p_workers integer,p_request uuid,p_bows integer,p_arrows integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();payload jsonb;receipt ludus_supply_private.departure_receipts_v122;s jsonb;answer jsonb;jid uuid;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('send','buy')or p_request is null or p_key is null then raise exception 'Geçersiz kervan çıkışı.';end if;
 if p_workers is null or p_workers<1 or p_bows is null or p_arrows is null or p_bows<0 or p_bows>p_workers or p_arrows<0 or p_arrows>p_bows*50 then raise exception 'Kervancı başına 1 yay ve yay başına en fazla 50 ok seç.';end if;
 s:=ludus_supply_private.api('state',null,1,null);
 payload:=jsonb_build_object('action',p_action,'key',p_key,'workers',p_workers,'bow',p_bows,'arrow',p_arrows);
 select * into receipt from ludus_supply_private.departure_receipts_v122 where owner_id=u and request_id=p_request;
 if found then
  if receipt.payload<>payload then raise exception 'İşlem kimliği başka bir çıkışta kullanılmış.';end if;
  return s||jsonb_build_object('result',receipt.result||'{"replayed":true}'::jsonb);
 end if;
 if exists(select 1 from ludus_supply_private.receipts where owner_id=u and request_id=p_request)then raise exception 'İşlem kimliği başka bir çıkışta kullanılmış.';end if;
 update ludus_supply_private.stock set quantity=quantity-p_bows where owner_id=u and sku='bow'and quantity>=p_bows;
 if not found then raise exception 'Kasada yeterli yay yok.';end if;
 update ludus_supply_private.stock set quantity=quantity-p_arrows where owner_id=u and sku='arrow'and quantity>=p_arrows;
 if not found then raise exception 'Kasada yeterli ok yok.';end if;
 s:=ludus_supply_private.api(p_action,p_key,p_workers,p_request);answer:=s->'result';jid:=(answer->>'job_id')::uuid;
 update ludus_supply_private.jobs set loadout=jsonb_build_object('bow',p_bows,'arrow',p_arrows)where id=jid and owner_id=u;
 if not found then raise exception 'Kervan çıkışı doğrulanamadı.';end if;
 answer:=answer||jsonb_build_object('loadout',jsonb_build_object('bow',p_bows,'arrow',p_arrows));
 insert into ludus_supply_private.departure_receipts_v122(owner_id,request_id,payload,result)values(u,p_request,payload,answer);
 return ludus_supply_private.api('state',null,1,null)||jsonb_build_object('result',answer);
end;$$;
create or replace function public.ludus_caravan_depart(p_action text,p_key text,p_workers integer,p_request uuid,p_bows integer default 0,p_arrows integer default 0)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.depart_v122(p_action,p_key,p_workers,p_request,p_bows,p_arrows)$$;
revoke all on function ludus_supply_private.depart_v122(text,text,integer,uuid,integer,integer),public.ludus_caravan_depart(text,text,integer,uuid,integer,integer)from public,anon,authenticated;
grant execute on function ludus_supply_private.depart_v122(text,text,integer,uuid,integer,integer),public.ludus_caravan_depart(text,text,integer,uuid,integer,integer)to authenticated;

-- This stores a two-gladiator preparation team; it does not invent a battle or reserve idle fighters.
create or replace function ludus_supply_private.hunt_v122(p_action text,p_gladiators uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();training jsonb;fighters jsonb;team uuid[];n integer;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','save')then raise exception 'Geçersiz ekip işlemi.';end if;
 training:=public.ludus_training_state();
 select coalesce(jsonb_agg(jsonb_build_object('id',g->'id','name',g->'name','class',g->'class','overall',g->'overall',
 'ready',coalesce(g->>'status','available')='available'and(g->>'clan_roster_id')is null and(g->>'market_listing_id')is null and coalesce((g->>'injured_until')::timestamptz<=clock_timestamp(),true)and coalesce((g->>'training_ends_at')::timestamptz<=clock_timestamp(),true)and coalesce((g->'session'->>'rest_until')::timestamptz<=clock_timestamp(),true)
 )order by g->>'name'),'[]'::jsonb)into fighters from jsonb_array_elements(training->'gladiators')g;
 if p_action='save'then
  if p_gladiators is null or cardinality(p_gladiators)<>2 or p_gladiators[1]is null or p_gladiators[2]is null or p_gladiators[1]=p_gladiators[2]then raise exception 'İki farklı gladyatör seç.';end if;
  select count(*)into n from jsonb_array_elements(fighters)g where(g->>'id')::uuid=any(p_gladiators)and(g->>'ready')::boolean;
  if n<>2 then raise exception 'Seçilen iki gladyatör sana ait ve göreve hazır olmalı.';end if;
  insert into ludus_supply_private.hunt_team_v122(owner_id,gladiators)values(u,p_gladiators)on conflict(owner_id)do update set gladiators=excluded.gladiators,updated_at=clock_timestamp();
 end if;
 select gladiators into team from ludus_supply_private.hunt_team_v122 where owner_id=u;
 team:=array(select t.id from unnest(team)with ordinality t(id,slot)where exists(select 1 from jsonb_array_elements(fighters)g where(g->>'id')::uuid=t.id)order by t.slot);
 return jsonb_build_object('user_id',u,'server_now',clock_timestamp(),'gladiators',fighters,'team',coalesce(to_jsonb(team),'[]'::jsonb),'outfit','black_veil');
end;$$;
create or replace function public.ludus_caravan_hunt(p_action text default 'state',p_gladiators uuid[]default null)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.hunt_v122(p_action,p_gladiators)$$;
revoke all on function ludus_supply_private.hunt_v122(text,uuid[]),public.ludus_caravan_hunt(text,uuid[])from public,anon,authenticated;
grant execute on function ludus_supply_private.hunt_v122(text,uuid[]),public.ludus_caravan_hunt(text,uuid[])to authenticated;
notify pgrst,'reload schema';
