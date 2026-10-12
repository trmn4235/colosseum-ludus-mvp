-- V87: authoritative automatic delivery into the shared supply chest.
-- Food remains the same food stock used by the dining room, not a duplicate inventory.
alter table ludus_supply_private.jobs add column if not exists delivery_check_at timestamptz;
create index if not exists supply_jobs_delivery_due_v87 on ludus_supply_private.jobs((coalesce(delivery_check_at,ends_at)),owner_id)where claimed_at is null;

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
   select 1 from jsonb_each_text(j.cargo)e left join ludus_supply_private.resources r on r.sku=e.key
   left join public.ludus_food_stock f on f.owner_id=p_owner and f.sku=e.key
   left join ludus_supply_private.stock s on s.owner_id=p_owner and s.sku=e.key
   where r.sku is null or (case when r.food then coalesce(f.quantity,0)else coalesce(s.quantity,0)end)+e.value::integer>50000
  )into blocked;
  if blocked then
   -- Retry later without discarding any part of a mixed cargo or starving other owners.
   update ludus_supply_private.jobs set delivery_check_at=p_until+interval'5 minutes'where id=j.id;
   continue;
  end if;
  for entry in select e.key,e.value::integer amount,r.food from jsonb_each_text(j.cargo)e join ludus_supply_private.resources r on r.sku=e.key loop
   if entry.food then update public.ludus_food_stock set quantity=quantity+entry.amount where owner_id=p_owner and sku=entry.key;
   else update ludus_supply_private.stock set quantity=quantity+entry.amount where owner_id=p_owner and sku=entry.key;end if;
  end loop;
  update ludus_supply_private.jobs set claimed_at=p_until,delivery_check_at=null where id=j.id;
  delivered:=delivered+1;
 end loop;
 return delivered;
end;$$;
revoke all on function ludus_supply_private.settle_owner_v87(uuid,timestamptz)from public,anon,authenticated;

create or replace function ludus_supply_private.deliver_due_v87(p_limit integer default 100)
returns integer language plpgsql security invoker set search_path='' as $$
declare u uuid;total integer:=0;ts timestamptz:=clock_timestamp();
begin
 for u in
  select a.user_id from public.ludus_accounts a join(
   select owner_id,min(coalesce(delivery_check_at,ends_at))due from ludus_supply_private.jobs
   where claimed_at is null and ends_at<=ts and coalesce(delivery_check_at,ends_at)<=ts
   group by owner_id order by due,owner_id limit greatest(1,least(coalesce(p_limit,100),250))
  )d on d.owner_id=a.user_id order by d.due,a.user_id for update of a skip locked
 loop total:=total+ludus_supply_private.settle_owner_v87(u,ts);end loop;
 return total;
end;$$;
revoke all on function ludus_supply_private.deliver_due_v87(integer)from public,anon,authenticated;

create or replace function ludus_supply_private.api(p_action text,p_key text,p_workers integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();food jsonb;answer jsonb;payload jsonb;
 receipt ludus_supply_private.receipts;dest ludus_supply_private.destinations;job ludus_supply_private.jobs;
 recipe ludus_supply_private.recipes;product public.ludus_shop_catalog;entry record;iid uuid;lv integer;
 total integer;occupied integer;qty integer;held integer;cargo jsonb;items jsonb;routes jsonb;open_jobs jsonb;crafts jsonb;delivered jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','send','claim','craft')then raise exception 'Geçersiz işlem.';end if;
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
    if p_workers is null or p_workers<1 or p_workers>total-occupied then raise exception 'Yeterli boş işçi yok. İlk işçi 5. seviye ödülündedir.';end if;
    select * into dest from ludus_supply_private.destinations where id=p_key;
    if not found then raise exception 'Bölge bulunamadı.';end if;
    select jsonb_object_agg(key,value::integer*p_workers)into cargo from jsonb_each_text(dest.yields);
    insert into ludus_supply_private.jobs(owner_id,destination,workers,started_at,ends_at,cargo)
    values(u,dest.id,p_workers,ts,ts+make_interval(secs=>dest.seconds),cargo)returning * into job;
    answer:=jsonb_build_object('message','İşçiler yola çıktı.','job_id',job.id);
   elsif p_action='claim'then
    select * into job from ludus_supply_private.jobs where owner_id=u and id::text=p_key for update;
    if not found then raise exception 'Sefer bulunamadı.';end if;
    if job.ends_at>ts then raise exception 'İşçiler henüz dönmedi.';end if;
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
 return jsonb_build_object('user_id',u,'server_now',ts,'level',lv,'workers',total,'busy_workers',occupied,'free_workers',total-occupied,
 'next_worker_level',case when lv<50 then (lv/5+1)*5 end,'unclaimed_workers',lv/5-total,
 'resources',items,'destinations',routes,'jobs',open_jobs,'recipes',crafts,'automatic_delivery',true,'deliveries',delivered,'result',answer,'gold',food->'gold');
end;$$;

-- Production scheduling: one bounded database pass each minute, even with no player online.
create extension if not exists pg_cron;
select cron.schedule('ludus-supply-delivery-v87','* * * * *','select ludus_supply_private.deliver_due_v87(100)');
