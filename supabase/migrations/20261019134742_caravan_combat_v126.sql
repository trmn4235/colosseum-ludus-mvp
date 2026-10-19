-- V126: 2–5 fighters, immediate playable raids, one-hour post-battle cooldown.
create or replace function ludus_supply_private.valid_team_v126(ids uuid[])
returns boolean language sql immutable set search_path='' as $$
 select coalesce(array_ndims(ids)=1 and cardinality(ids)between 2 and 5
 and cardinality(ids)=(select count(distinct id)from unnest(ids)id),false)
$$;
revoke all on function ludus_supply_private.valid_team_v126(uuid[])from public,anon,authenticated;
alter table ludus_supply_private.hunt_team_v122 drop constraint if exists hunt_team_v122_gladiators_check;
alter table ludus_supply_private.hunt_team_v122 add constraint hunt_team_v122_gladiators_check check(ludus_supply_private.valid_team_v126(gladiators));
alter table ludus_supply_private.raids_v124 drop constraint if exists raids_v124_gladiators_check;
alter table ludus_supply_private.raids_v124 add constraint raids_v124_gladiators_check check(ludus_supply_private.valid_team_v126(gladiators));
alter table ludus_supply_private.raids_v124 drop constraint if exists raids_v124_check;
alter table ludus_supply_private.raids_v124 add constraint raids_v124_check check(ends_at>=started_at);
alter table ludus_supply_private.raids_v124 add column if not exists encounter jsonb;
alter table ludus_supply_private.raids_v124 add column if not exists battle_started_at timestamptz;
alter table ludus_supply_private.raids_v124 add column if not exists battle_seconds numeric;
alter table ludus_supply_private.jobs add column if not exists escort uuid[]not null default '{}';
alter table ludus_supply_private.jobs add column if not exists escort_team jsonb not null default '[]';
create table if not exists ludus_supply_private.raid_counter_v126(
 owner_id uuid primary key references public.ludus_accounts(user_id),attempt integer not null default 0,cooldown_until timestamptz
);
create table if not exists ludus_supply_private.escort_members_v126(
 gladiator_id uuid primary key references public.ludus_gladiators(id),job_id uuid not null references ludus_supply_private.jobs(id)
);
create index if not exists escort_job_v126 on ludus_supply_private.escort_members_v126(job_id);
alter table ludus_supply_private.raid_counter_v126 enable row level security;
alter table ludus_supply_private.escort_members_v126 enable row level security;
revoke all on ludus_supply_private.raid_counter_v126,ludus_supply_private.escort_members_v126 from public,anon,authenticated;

create or replace function ludus_supply_private.reserved_v126(gid uuid)
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from ludus_supply_private.raid_members_v124 where gladiator_id=gid)
 or exists(select 1 from ludus_supply_private.escort_members_v126 where gladiator_id=gid)
$$;
revoke all on function ludus_supply_private.reserved_v126(uuid)from public,anon,authenticated;
create or replace function ludus_supply_private.raid_guard_v124()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='ludus_gladiators'then
  if ludus_supply_private.reserved_v126(old.id)then
   if tg_op='DELETE'then raise exception 'Gladyatör kervan görevinde; önce görevi tamamla.';end if;
   if row(new.id,new.owner_id,new.status,new.training_type,new.training_ends_at,new.clan_roster_id,new.market_listing_id)
   is distinct from row(old.id,old.owner_id,old.status,old.training_type,old.training_ends_at,old.clan_roster_id,old.market_listing_id)
   then raise exception 'Gladyatör kervan görevinde; önce görevi tamamla.';end if;
  end if;
 else
  if ludus_supply_private.reserved_v126(old.equipped_by)or(tg_op='UPDATE'and ludus_supply_private.reserved_v126(new.equipped_by))then
   if tg_op='DELETE'then raise exception 'Kervan görevindeki ekipman kilitli.';end if;
   if row(new.owner_id,new.equipped_by,new.equipped_slot,new.kind,new.model,new.enhancement,new.locked_battle_id,new.clan_roster_id,new.clan_vault_id,new.market_listing_id,new.sapphires,new.rubies,new.emeralds)
   is distinct from row(old.owner_id,old.equipped_by,old.equipped_slot,old.kind,old.model,old.enhancement,old.locked_battle_id,old.clan_roster_id,old.clan_vault_id,old.market_listing_id,old.sapphires,old.rubies,old.emeralds)
   then raise exception 'Kervan görevindeki ekipman kilitli.';end if;
  end if;
 end if;
 if tg_op='DELETE'then return old;end if;return new;
end;$$;
create or replace function ludus_supply_private.escort_release_v126(jid uuid)
returns void language plpgsql set search_path='' as $$
declare ids uuid[];
begin
 select array_agg(gladiator_id)into ids from ludus_supply_private.escort_members_v126 where job_id=jid;
 delete from ludus_supply_private.escort_members_v126 where job_id=jid;
 update public.ludus_gladiators set status='available'where id=any(ids)and status='locked';
end;$$;
revoke all on function ludus_supply_private.escort_release_v126(uuid)from public,anon,authenticated;

create or replace function ludus_supply_private.fighters_v126()
returns jsonb language plpgsql set search_path='' as $$
declare training jsonb;answer jsonb;
begin
 training:=ludus_supply_private.hunt_v122('state',null);
 select coalesce(jsonb_agg((to_jsonb(g)-'owner_id')||jsonb_build_object(
 'ready',coalesce((f->>'ready')::boolean,false)and ludus_supply_private.raid_available_v124(g.id)and not ludus_supply_private.reserved_v126(g.id),
 'items',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.owner_id=auth.uid()and i.equipped_by=g.id),'[]'::jsonb),
 'weapons',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.owner_id=auth.uid()and i.equipped_by=g.id and i.kind='weapon'),'[]'::jsonb))order by g.name),'[]'::jsonb)
 into answer from jsonb_array_elements(training->'gladiators')f join public.ludus_gladiators g on g.id=(f->>'id')::uuid and g.owner_id=auth.uid();
 return answer;
end;$$;
revoke all on function ludus_supply_private.fighters_v126()from public,anon,authenticated;

-- A one-time multiplier; already-departed cargo, prices and stock are preserved.
create table if not exists ludus_supply_private.balance_versions_v126(version integer primary key);
alter table ludus_supply_private.balance_versions_v126 enable row level security;
revoke all on ludus_supply_private.balance_versions_v126 from public,anon,authenticated;
do $$begin
 if not exists(select 1 from ludus_supply_private.balance_versions_v126 where version=126)then
  update ludus_supply_private.destinations d set yields=coalesce((select jsonb_object_agg(key,value::integer*4)from jsonb_each_text(d.yields)),'{}'::jsonb);
  insert into ludus_supply_private.balance_versions_v126 values(126);
 end if;
end;$$;

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
  perform ludus_supply_private.escort_release_v126(j.id);
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
     perform ludus_supply_private.escort_release_v126(job.id);
     update ludus_supply_private.jobs set claimed_at=ts where id=job.id;
    end if;
    answer:=jsonb_build_object('message','Sefer yükü kasaya teslim edildi.','cargo',job.cargo);
   elsif p_action='buy'then
    if p_workers is null or p_workers<1 or p_workers>greatest(0,total-occupied)then raise exception 'Yeterli boş kervan yok.';end if;
    parts:=string_to_array(p_key,':');
    if array_length(parts,1)<>4 then raise exception 'Alım bilgisi geçersiz.';end if;
    city_id:=parts[1]::integer;goods_sku:=parts[2];market_epoch:=parts[3]::bigint;qty:=parts[4]::integer;
    if market_epoch<>floor(extract(epoch from ts)/900)::bigint then raise exception 'Fiyatın süresi doldu. Güncel fiyatı yeniden al.';end if;
    if qty is null or qty<1 or qty>p_workers*60 then raise exception 'Her kervan en fazla 60 birim taşır.';end if;
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
 select coalesce(jsonb_agg(to_jsonb(d)order by d.claimed_at desc),'[]')into delivered from(select j.id,j.destination,j.workers,j.cargo,j.loadout,j.escort,j.escort_team,j.claimed_at from ludus_supply_private.jobs j where j.owner_id=u and j.claimed_at is not null order by j.claimed_at desc limit 10)d;
 select jsonb_agg(to_jsonb(r)||jsonb_build_object('group',case when r.kind='material' then 'processing' else 'equipment' end)order by r.sort_order)
 into crafts from ludus_supply_private.production_recipes_v118 r;
 return jsonb_build_object('user_id',u,'server_now',ts,'level',lv,'workers',total,'busy_workers',occupied,'free_workers',greatest(0,total-occupied),'caravans',total,'busy_caravans',occupied,'free_caravans',greatest(0,total-occupied),'caravan_capacity',60,
 'next_worker_level',case when lv<50 then (lv/10+1)*10 end,'next_caravan_level',case when lv<50 then (lv/10+1)*10 end,'unclaimed_workers',0,
 'escort_gladiators',ludus_supply_private.fighters_v126(),'resources',items,'destinations',routes,'jobs',open_jobs,'recipes',crafts,'automatic_delivery',true,'deliveries',delivered,'result',answer,'gold',(select gold from public.ludus_accounts where user_id=u),'cities',(select jsonb_agg(to_jsonb(c)order by id)from ludus_supply_private.cities_v116 c));
end;$$;
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
  if not ludus_supply_private.valid_team_v126(p_gladiators)then raise exception '2–5 farklı gladyatör seç.';end if;
  select count(*)into n from jsonb_array_elements(fighters)g where(g->>'id')::uuid=any(p_gladiators)and(g->>'ready')::boolean;
  if n<>cardinality(p_gladiators) then raise exception 'Seçilen gladyatörler sana ait ve göreve hazır olmalı.';end if;
  insert into ludus_supply_private.hunt_team_v122(owner_id,gladiators)values(u,p_gladiators)on conflict(owner_id)do update set gladiators=excluded.gladiators,updated_at=clock_timestamp();
 end if;
 select gladiators into team from ludus_supply_private.hunt_team_v122 where owner_id=u;
 team:=array(select t.id from unnest(team)with ordinality t(id,slot)where exists(select 1 from jsonb_array_elements(fighters)g where(g->>'id')::uuid=t.id)order by t.slot);
 return jsonb_build_object('user_id',u,'server_now',clock_timestamp(),'gladiators',fighters,'team',coalesce(to_jsonb(team),'[]'::jsonb),'outfit','black_veil');
end;$$;
create or replace function ludus_supply_private.depart_v126(p_action text,p_key text,p_workers integer,p_request uuid,p_bows integer,p_arrows integer,p_escort uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();s jsonb;payload jsonb;receipt ludus_supply_private.departure_receipts_v122;answer jsonb;jid uuid;fighters jsonb;team jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('send','buy')or p_request is null then raise exception 'Geçersiz kervan çıkışı.';end if;
 if p_workers is null or p_workers<1 or p_bows is null or p_arrows is null or p_bows<0 or p_bows>p_workers or p_arrows<0 or p_arrows>p_bows*50 then raise exception 'Kervancı başına 1 yay ve yay başına en fazla 50 ok seç.';end if;
 p_escort:=coalesce(p_escort,'{}');
 if cardinality(p_escort)>0 and not ludus_supply_private.valid_team_v126(p_escort)then raise exception 'Savunma için 2–5 farklı gladyatör seç.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;if not found then raise exception 'Ludus bulunamadı.';end if;
 s:=ludus_supply_private.api('state',null,1,null);
 payload:=jsonb_build_object('action',p_action,'key',p_key,'workers',p_workers,'bow',p_bows,'arrow',p_arrows,'escort',p_escort);
 select * into receipt from ludus_supply_private.departure_receipts_v122 where owner_id=u and request_id=p_request;
 if found then
  if receipt.payload<>payload then raise exception 'İşlem kimliği başka bir çıkışta kullanılmış.';end if;
  return s||jsonb_build_object('result',receipt.result||'{"replayed":true}'::jsonb);
 end if;
 if exists(select 1 from ludus_supply_private.receipts where owner_id=u and request_id=p_request)then raise exception 'İşlem kimliği başka bir çıkışta kullanılmış.';end if;
 fighters:=ludus_supply_private.fighters_v126();
 if(select count(*)from jsonb_array_elements(fighters)f where(f->>'id')::uuid=any(p_escort)and(f->>'ready')::boolean)<>cardinality(p_escort)
 then raise exception 'Savunma ekibindeki gladyatörler sana ait ve hazır olmalı.';end if;
 select coalesce(jsonb_agg(f order by array_position(p_escort,(f->>'id')::uuid)),'[]')into team from jsonb_array_elements(fighters)f where(f->>'id')::uuid=any(p_escort);
 update ludus_supply_private.stock set quantity=quantity-p_bows where owner_id=u and sku='bow'and quantity>=p_bows;
 if not found then raise exception 'Kasada yeterli yay yok.';end if;
 update ludus_supply_private.stock set quantity=quantity-p_arrows where owner_id=u and sku='arrow'and quantity>=p_arrows;
 if not found then raise exception 'Kasada yeterli ok yok.';end if;
 s:=ludus_supply_private.api(p_action,p_key,p_workers,p_request);answer:=s->'result';jid:=(answer->>'job_id')::uuid;
 update ludus_supply_private.jobs set loadout=jsonb_build_object('bow',p_bows,'arrow',p_arrows),escort=p_escort,escort_team=team where id=jid and owner_id=u;
 if not found then raise exception 'Kervan çıkışı doğrulanamadı.';end if;
 update public.ludus_gladiators set status='locked'where owner_id=u and id=any(p_escort);
 insert into ludus_supply_private.escort_members_v126(gladiator_id,job_id)select unnest(p_escort),jid;
 answer:=answer||jsonb_build_object('loadout',jsonb_build_object('bow',p_bows,'arrow',p_arrows),'escort',p_escort);
 insert into ludus_supply_private.departure_receipts_v122(owner_id,request_id,payload,result)values(u,p_request,payload,answer);
 return ludus_supply_private.api('state',null,1,null)||jsonb_build_object('result',answer);
end;$$;
create or replace function public.ludus_caravan_depart_v126(p_action text,p_key text,p_workers integer,p_request uuid,p_bows integer default 0,p_arrows integer default 0,p_escort uuid[]default '{}')
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.depart_v126(p_action,p_key,p_workers,p_request,p_bows,p_arrows,p_escort)$$;
revoke all on function ludus_supply_private.depart_v126(text,text,integer,uuid,integer,integer,uuid[]),public.ludus_caravan_depart_v126(text,text,integer,uuid,integer,integer,uuid[])from public,anon,authenticated;
grant execute on function ludus_supply_private.depart_v126(text,text,integer,uuid,integer,integer,uuid[]),public.ludus_caravan_depart_v126(text,text,integer,uuid,integer,integer,uuid[])to authenticated;

create or replace function ludus_supply_private.raid_view_v124(j ludus_supply_private.raids_v124)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',j.id,'request_id',j.request_id,'region',j.region,'team',j.team,'started_at',j.started_at,'ends_at',j.ends_at,
 'status',case when j.resolved_at is not null then 'resolved'else 'ready'end,
 'resolved_at',j.resolved_at,'success',j.success,'loot',j.loot,'delivered_at',j.delivered_at,'injured_until',j.injured_until,
 'encounter',j.encounter,'battle_started_at',j.battle_started_at,'battle_seconds',j.battle_seconds)
$$;
create or replace function ludus_supply_private.encounter_v126(jid uuid)
returns void language plpgsql set search_path='' as $$
declare j ludus_supply_private.raids_v124;choices text[];n integer;frozen_team jsonb;
begin
 select * into j from ludus_supply_private.raids_v124 where id=jid for update;
 if j.encounter is not null or j.resolved_at is not null then return;end if;
 insert into ludus_supply_private.raid_counter_v126(owner_id,attempt)values(j.owner_id,1)
 on conflict(owner_id)do update set attempt=ludus_supply_private.raid_counter_v126.attempt+1 returning attempt into n;
 select r.choices into choices from ludus_supply_private.raid_regions_v124 r where r.id=j.region;
 select jsonb_agg((to_jsonb(g)-'owner_id')||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.equipped_by=g.id and i.owner_id=j.owner_id),'[]'::jsonb),
 'weapons',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.equipped_by=g.id and i.owner_id=j.owner_id and i.kind='weapon'),'[]'::jsonb))order by array_position(j.gladiators,g.id))into frozen_team
 from public.ludus_gladiators g where g.owner_id=j.owner_id and g.id=any(j.gladiators);
 update ludus_supply_private.raids_v124 set team=frozen_team,ends_at=greatest(started_at,clock_timestamp()),encounter=jsonb_build_object(
 'version',126,'attempt',n,'seed',1+floor(random()*2147483646)::integer,'guards',cardinality(j.gladiators)+case when n%4=0 then 1 else 0 end,
 'archers',1,'cargo',choices[1+floor(random()*3)::integer],'quantity',60)where id=jid;
end;$$;
revoke all on function ludus_supply_private.encounter_v126(uuid)from public,anon,authenticated;

create or replace function ludus_supply_private.raid_api_v124(p_action text,p_gladiators uuid[],p_region text,p_request uuid,p_raid uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();fighters jsonb;regions jsonb;history jsonb;active jsonb;result jsonb;team jsonb;
 j ludus_supply_private.raids_v124;cool timestamptz;aid uuid;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Kervan avı için hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','start','enter')then raise exception 'Baskın sonucu ormandaki savaş tamamlanınca kaydedilir.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;if not found then raise exception 'Ludus bulunamadı.';end if;
 perform ludus_supply_private.settle_owner_v87(u,ts);
 fighters:=ludus_supply_private.fighters_v126();
 select cooldown_until into cool from ludus_supply_private.raid_counter_v126 where owner_id=u;
 if p_action='start'then
  if p_request is null then raise exception 'İşlem kimliği gerekli.';end if;
  select * into j from ludus_supply_private.raids_v124 where owner_id=u and request_id=p_request;
  if found then
   if j.region is distinct from p_region or j.gladiators is distinct from p_gladiators then raise exception 'İşlem kimliği başka bir baskına ait.';end if;
  else
   if not ludus_supply_private.valid_team_v126(p_gladiators)then raise exception '2–5 farklı gladyatör seç.';end if;
   if exists(select 1 from ludus_supply_private.raids_v124 where owner_id=u and resolved_at is null)then raise exception 'Önce mevcut baskını tamamla.';end if;
   if cool>ts then raise exception 'Yeni baskın için bir saatlik dinlenme süresini bekle.';end if;
   if not exists(select 1 from ludus_supply_private.raid_regions_v124 where id=p_region)then raise exception 'Geçerli bir baskın bölgesi seç.';end if;
   perform 1 from public.ludus_gladiators where owner_id=u and id=any(p_gladiators)order by id for update;
   perform 1 from public.ludus_items where owner_id=u and equipped_by=any(p_gladiators)order by id for update;
   if(select count(*)from jsonb_array_elements(fighters)g where(g->>'id')::uuid=any(p_gladiators)and(g->>'ready')::boolean)<>cardinality(p_gladiators)
   then raise exception 'Seçilen gladyatörler sana ait ve hazır olmalı.';end if;
   select jsonb_agg(g order by array_position(p_gladiators,(g->>'id')::uuid))into team from jsonb_array_elements(fighters)g where(g->>'id')::uuid=any(p_gladiators);
   insert into ludus_supply_private.raids_v124(owner_id,request_id,region,gladiators,team,started_at,ends_at)
   values(u,p_request,p_region,p_gladiators,team,ts,ts)returning * into j;
   update public.ludus_gladiators set status='locked'where owner_id=u and id=any(p_gladiators);
   insert into ludus_supply_private.raid_members_v124(gladiator_id,raid_id)select unnest(p_gladiators),j.id;
   insert into ludus_supply_private.hunt_team_v122(owner_id,gladiators)values(u,p_gladiators)on conflict(owner_id)do update set gladiators=excluded.gladiators,updated_at=ts;
  end if;
 elsif p_action='enter'then
  select * into j from ludus_supply_private.raids_v124 where owner_id=u and id=p_raid for update;
  if not found then raise exception 'Baskın bulunamadı.';end if;
  if j.resolved_at is null then update ludus_supply_private.raids_v124 set battle_started_at=coalesce(battle_started_at,clock_timestamp())where id=j.id;end if;
 end if;
 for aid in select id from ludus_supply_private.raids_v124 where owner_id=u and resolved_at is null and encounter is null loop perform ludus_supply_private.encounter_v126(aid);end loop;
 perform ludus_supply_private.raid_deliver_v124(u);
 if j.id is not null then select ludus_supply_private.raid_view_v124(t)into result from ludus_supply_private.raids_v124 t where id=j.id;end if;
 select coalesce(jsonb_agg(to_jsonb(r)order by r.y,r.x),'[]')into regions from ludus_supply_private.raid_regions_v124 r;
 select ludus_supply_private.raid_view_v124(t)into active from ludus_supply_private.raids_v124 t where owner_id=u and resolved_at is null;
 select coalesce(jsonb_agg(ludus_supply_private.raid_view_v124(t)order by t.resolved_at desc,t.id),'[]')into history from(select * from ludus_supply_private.raids_v124 where owner_id=u and resolved_at is not null order by resolved_at desc,id limit 5)t;
 return jsonb_build_object('user_id',u,'server_now',clock_timestamp(),'gladiators',fighters,'team',coalesce((select to_jsonb(gladiators)from ludus_supply_private.hunt_team_v122 where owner_id=u),'[]'::jsonb),
 'regions',regions,'active',active,'history',history,'result',result,'duration_seconds',0,'cooldown_until',cool,'cooldown_seconds',3600,'recovery_seconds',43200,'reward_quantity',60,'version',126);
end;$$;

-- Only the authenticated edge verifier may submit a replayed result. There is
-- deliberately no client-callable "won" argument, amount, cargo or seed setter.
create or replace function ludus_supply_private.verified_v126(p_owner uuid,p_raid uuid,p_won boolean,p_seconds numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j ludus_supply_private.raids_v124;ts timestamptz:=clock_timestamp();
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 select * into j from ludus_supply_private.raids_v124 where id=p_raid and owner_id=p_owner for update;
 if not found then raise exception 'Baskın bulunamadı.';end if;
 if j.resolved_at is not null then return ludus_supply_private.raid_view_v124(j);end if;
 if j.encounter is null or j.battle_started_at is null or p_won is null or p_seconds is null or p_seconds<0 or p_seconds>300
 or p_seconds>extract(epoch from ts-j.battle_started_at)+3 then raise exception 'Savaş süresi doğrulanamadı.';end if;
 delete from ludus_supply_private.raid_members_v124 where raid_id=j.id;
 update public.ludus_gladiators set status=case when p_won then 'available'else 'injured'end,
 injury_level=case when p_won then injury_level else greatest(injury_level,1)end,
 injured_until=case when p_won then injured_until else ts+interval'12 hours'end where owner_id=p_owner and id=any(j.gladiators);
 update ludus_supply_private.raids_v124 set resolved_at=ts,success=p_won,battle_seconds=p_seconds,
 loot=case when p_won then jsonb_build_object(j.encounter->>'cargo',60)else '{}'::jsonb end,
 injured_until=case when not p_won then ts+interval'12 hours'end where id=j.id returning * into j;
 update ludus_supply_private.raid_counter_v126 set cooldown_until=ts+interval'1 hour'where owner_id=p_owner;
 -- Existing delivery function settles the owner's pantry; keep the verified JWT
 -- identity for its internal auth-bound food call (service role cannot choose loot).
 perform set_config('request.jwt.claim.sub',p_owner::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_owner)::text,true);
 perform ludus_supply_private.raid_deliver_v124(p_owner);
 select * into j from ludus_supply_private.raids_v124 where id=j.id;
 return ludus_supply_private.raid_view_v124(j);
end;$$;
create or replace function public.ludus_caravan_verified_v126(p_owner uuid,p_raid uuid,p_won boolean,p_seconds numeric)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.verified_v126(p_owner,p_raid,p_won,p_seconds)$$;
revoke all on function ludus_supply_private.verified_v126(uuid,uuid,boolean,numeric)from public,anon,authenticated;
grant usage on schema ludus_supply_private to service_role;
grant execute on function ludus_supply_private.verified_v126(uuid,uuid,boolean,numeric)to service_role;
revoke all on function public.ludus_caravan_verified_v126(uuid,uuid,boolean,numeric)from public,anon,authenticated;
grant execute on function public.ludus_caravan_verified_v126(uuid,uuid,boolean,numeric)to service_role;
notify pgrst,'reload schema';
