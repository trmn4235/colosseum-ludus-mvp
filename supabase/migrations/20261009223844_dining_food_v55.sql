-- Food is accounted for by Istanbul calendar day, not browser timers.
create schema if not exists ludus_food_private;
revoke all on schema ludus_food_private from public,anon;
grant usage on schema ludus_food_private to authenticated;

create table if not exists public.ludus_food_catalog(
 sku text primary key,name text not null,price integer not null check(price>0),
 edible boolean not null,sort_order integer not null unique
);
insert into public.ludus_food_catalog values
 ('grain','Tahıl',1,true,1),('apple','Elma',2,true,2),('fish','Balık',3,true,3),
 ('meat','Kemikli but',4,true,4),('beer','Bira',2,false,5)
on conflict(sku)do nothing;
create table if not exists public.ludus_food_house(
 owner_id uuid primary key references public.ludus_accounts(user_id)on delete cascade,
 crew_count integer not null check(crew_count>=0),settled_day date not null,
 last_menu jsonb,created_at timestamptz not null default now()
);
create table if not exists public.ludus_food_stock(
 owner_id uuid references public.ludus_food_house(owner_id)on delete cascade,
 sku text references public.ludus_food_catalog(sku),quantity integer not null default 0 check(quantity between 0 and 50000),
 primary key(owner_id,sku)
);
create table if not exists public.ludus_food_orders(
 owner_id uuid references public.ludus_food_house(owner_id)on delete cascade,
 request_id uuid not null,sku text not null references public.ludus_food_catalog(sku),
 quantity integer not null check(quantity between 1 and 5000),unit_price integer not null check(unit_price>0),
 created_at timestamptz not null default now(),primary key(owner_id,request_id)
);
create table if not exists public.ludus_food_history(
 owner_id uuid references public.ludus_food_house(owner_id)on delete cascade,
 from_day date not null,to_day date not null check(to_day>=from_day),crew_count integer not null,
 menu jsonb not null,primary key(owner_id,to_day)
);
alter table public.ludus_food_catalog enable row level security;
alter table public.ludus_food_house enable row level security;
alter table public.ludus_food_stock enable row level security;
alter table public.ludus_food_orders enable row level security;
alter table public.ludus_food_history enable row level security;
revoke all on public.ludus_food_catalog,public.ludus_food_house,public.ludus_food_stock,public.ludus_food_orders,public.ludus_food_history from anon,authenticated;
grant select on public.ludus_food_catalog,public.ludus_food_house,public.ludus_food_stock,public.ludus_food_orders,public.ludus_food_history to authenticated;
drop policy if exists food_catalog_read on public.ludus_food_catalog;
create policy food_catalog_read on public.ludus_food_catalog for select to authenticated using(not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
drop policy if exists food_house_read on public.ludus_food_house;
create policy food_house_read on public.ludus_food_house for select to authenticated using(owner_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
drop policy if exists food_stock_read on public.ludus_food_stock;
create policy food_stock_read on public.ludus_food_stock for select to authenticated using(owner_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
drop policy if exists food_orders_read on public.ludus_food_orders;
create policy food_orders_read on public.ludus_food_orders for select to authenticated using(owner_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
drop policy if exists food_history_read on public.ludus_food_history;
create policy food_history_read on public.ludus_food_history for select to authenticated using(owner_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));

-- Each available type supplies up to one portion per fighter per day.
-- Partial portions contribute proportionally; beer never feeds a hungry crew.
create or replace function ludus_food_private.menu_v55(p_crew integer,p_items jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare food numeric:=0;drink numeric:=0;coverage numeric;entry jsonb;morale numeric;
begin
 for entry in select value from jsonb_array_elements(p_items)loop
  if entry->>'sku'='beer' then drink:=drink+(entry->>'quantity')::numeric;
  else food:=food+(entry->>'quantity')::numeric;end if;
 end loop;
 if p_crew=0 then return jsonb_build_object('crew_count',0,'served',p_items,'coverage',null,'morale',null);end if;
 coverage:=least(1,food/p_crew);
 morale:=least(100,50*coverage+12.5*(food/p_crew-coverage)+12.5*drink/p_crew*coverage);
 return jsonb_build_object('crew_count',p_crew,'served',p_items,'coverage',round(coverage*100,1),'morale',round(morale,1));
end;$$;

create or replace function ludus_food_private.settle_v55(p_owner uuid,p_today date)
returns void language plpgsql security definer set search_path='' as $$
declare house public.ludus_food_house;days integer;span integer;served jsonb;menu jsonb;
begin
 -- All food and shop mutations take the account lock first.
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 select * into house from public.ludus_food_house where owner_id=p_owner for update;
 if not found then return;end if;
 days:=p_today-1-house.settled_day;
 while days>0 loop
  span:=days;
  if house.crew_count>0 then
   select least(days,coalesce(min(greatest(1,quantity/house.crew_count))filter(where quantity>0),days))
   into span from public.ludus_food_stock where owner_id=p_owner;
  end if;
  select jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',least(s.quantity,house.crew_count))order by c.sort_order)
  into served from public.ludus_food_stock s join public.ludus_food_catalog c using(sku)where s.owner_id=p_owner;
  menu:=ludus_food_private.menu_v55(house.crew_count,served);
  update public.ludus_food_stock set quantity=quantity-least(quantity,house.crew_count)*span where owner_id=p_owner;
  insert into public.ludus_food_history(owner_id,from_day,to_day,crew_count,menu)
  values(p_owner,house.settled_day+1,house.settled_day+span,house.crew_count,menu);
  house.settled_day:=house.settled_day+span;days:=days-span;
  update public.ludus_food_house set settled_day=house.settled_day,last_menu=menu where owner_id=p_owner;
 end loop;
end;$$;

create or replace function ludus_food_private.api_v55(p_action text,p_sku text,p_quantity integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();today date:=(transaction_timestamp()at time zone'Europe/Istanbul')::date;
 coins bigint;crew integer;price integer;stock integer;receipt public.ludus_food_orders;
 house public.ludus_food_house;items jsonb;served jsonb;history jsonb;purchase jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Giriş gerekiyor.';end if;
 if p_action not in('state','buy') or p_action is null then raise exception 'İşlem geçersiz.';end if;
 select gold into coins from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 select count(*)into crew from public.ludus_gladiators where owner_id=u;
 insert into public.ludus_food_house(owner_id,crew_count,settled_day)values(u,crew,today-1)on conflict(owner_id)do nothing;
 insert into public.ludus_food_stock(owner_id,sku)select u,sku from public.ludus_food_catalog on conflict(owner_id,sku)do nothing;
 perform ludus_food_private.settle_v55(u,today);
 update public.ludus_food_house set crew_count=crew where owner_id=u;
 if p_action='buy' then
  if p_request is null or p_quantity is null or p_quantity not between 1 and 5000 then raise exception '1–5000 porsiyon ve işlem kimliği gerekiyor.';end if;
  select * into receipt from public.ludus_food_orders where owner_id=u and request_id=p_request;
  if found then
   if receipt.sku<>p_sku or receipt.quantity<>p_quantity or p_sku is null then raise exception 'İşlem kimliği başka bir alımda kullanılmış.';end if;
   purchase:=jsonb_build_object('request_id',p_request,'sku',p_sku,'quantity',receipt.quantity,'cost',receipt.quantity*receipt.unit_price,'replayed',true);
  else
   select c.price,s.quantity into price,stock from public.ludus_food_catalog c join public.ludus_food_stock s using(sku)where s.owner_id=u and c.sku=p_sku;
   if not found then raise exception 'Gıda bulunamadı.';end if;
   if stock+p_quantity>50000 then raise exception 'Bu gıda için stok sınırı 50.000 porsiyon.';end if;
   if coins<price*p_quantity then raise exception 'Denarius yetersiz.';end if;
   update public.ludus_accounts set gold=gold-price*p_quantity where user_id=u returning gold into coins;
   update public.ludus_food_stock set quantity=quantity+p_quantity where owner_id=u and sku=p_sku;
   insert into public.ludus_food_orders(owner_id,request_id,sku,quantity,unit_price)values(u,p_request,p_sku,p_quantity,price);
   purchase:=jsonb_build_object('request_id',p_request,'sku',p_sku,'quantity',p_quantity,'cost',price*p_quantity,'replayed',false);
  end if;
 end if;
 select * into house from public.ludus_food_house where owner_id=u;
 select jsonb_agg(jsonb_build_object('sku',c.sku,'name',c.name,'price',c.price,'edible',c.edible,'quantity',s.quantity,'daily',crew,'days',case when crew>0 then s.quantity/crew end)order by c.sort_order),
 jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',least(s.quantity,crew))order by c.sort_order)
 into items,served from public.ludus_food_catalog c join public.ludus_food_stock s using(sku)where s.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(h)order by h.to_day desc),'[]')into history from
 (select from_day,to_day,crew_count,menu from public.ludus_food_history where owner_id=u order by to_day desc limit 12)h;
 return jsonb_build_object('user_id',u,'today',today,'server_now',transaction_timestamp(),'reset_at',(today+1)::timestamp at time zone'Europe/Istanbul',
 'gold',coins,'crew_count',crew,'settled_day',house.settled_day,'last_menu',house.last_menu,'menu',ludus_food_private.menu_v55(crew,served),'items',items,'history',history,'purchase',purchase);
end;$$;

-- Existing roster operations settle earlier days with the old crew size first.
create or replace function ludus_food_private.roster_v55()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid;owners uuid[]:='{}';today date:=(transaction_timestamp()at time zone'Europe/Istanbul')::date;
begin
 if tg_op<>'INSERT' then owners:=array_append(owners,old.owner_id);end if;
 if tg_op<>'DELETE' then owners:=array_append(owners,new.owner_id);end if;
 for owner in select distinct v from unnest(owners)v order by v loop
  if exists(select 1 from public.ludus_food_house where owner_id=owner)then
   perform ludus_food_private.settle_v55(owner,today);
   update public.ludus_food_house set crew_count=(select count(*)from public.ludus_gladiators where owner_id=owner)where owner_id=owner;
  end if;
 end loop;
 return null;
end;$$;
drop trigger if exists ludus_food_roster_v55 on public.ludus_gladiators;
create trigger ludus_food_roster_v55 after insert or delete or update of owner_id on public.ludus_gladiators for each row execute function ludus_food_private.roster_v55();

revoke all on all functions in schema ludus_food_private from public,anon,authenticated;
grant execute on function ludus_food_private.api_v55(text,text,integer,uuid)to authenticated;
create or replace function public.ludus_food_state()returns jsonb language sql security invoker set search_path='' as $$select ludus_food_private.api_v55('state',null,null,null)$$;
create or replace function public.ludus_food_buy(p_sku text,p_quantity integer,p_request uuid)returns jsonb language sql security invoker set search_path='' as $$select ludus_food_private.api_v55('buy',p_sku,p_quantity,p_request)$$;
revoke all on function public.ludus_food_state(),public.ludus_food_buy(text,integer,uuid)from public,anon;
grant execute on function public.ludus_food_state(),public.ludus_food_buy(text,integer,uuid)to authenticated;
