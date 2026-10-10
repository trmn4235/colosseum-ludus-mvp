-- Keep historical daily accounting and original purchase receipts intact.
do $$declare u uuid;begin for u in select owner_id from public.ludus_food_house order by owner_id loop perform ludus_food_private.settle_v55(u,(transaction_timestamp()at time zone'Europe/Istanbul')::date);end loop;end;$$;
alter table public.ludus_food_catalog add column if not exists nutrition integer not null default 0 check(nutrition between 0 and 100);
-- Preserve beer's internal SKU so pending requests and existing stock still work.
update public.ludus_food_catalog set name='Şarap' where sku='beer';
insert into public.ludus_food_catalog(sku,name,price,edible,sort_order,nutrition)
 values('egg','Yumurta',6,true,6,20),('bread','Ekmek',3,true,7,15),('meal','Hazır öğün',30,true,8,100)
on conflict(sku)do update set name=excluded.name,price=excluded.price,nutrition=excluded.nutrition;
update public.ludus_food_catalog set nutrition=case sku when 'grain' then 20 when 'apple' then 15 when 'fish' then 25 when 'meat' then 30 when 'egg' then 20 when 'bread' then 15 when 'beer' then 5 when 'meal' then 100 else 0 end;
insert into public.ludus_food_stock(owner_id,sku)select h.owner_id,c.sku from public.ludus_food_house h cross join public.ludus_food_catalog c on conflict(owner_id,sku)do nothing;
create or replace function ludus_food_private.menu_v55(p_crew integer,p_items jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare target integer:=greatest(0,p_crew)*20;goal integer:=case when p_crew>0 then p_crew*20+19 else 0 end;paths jsonb[];scores integer[];
 entry jsonb;sku text;weight integer;remaining integer;chunk integer;take integer;j integer;
 candidate jsonb;score integer;types integer;groups integer;count_items integer;
 used integer:=0;wine integer:=0;served jsonb:='[]';available bigint:=0;group_coverage numeric:=0;coverage numeric:=0;
begin
 -- Integer portions, five-unit steps, bounded knapsack: maximize nutrition
 -- with the smallest excess for indivisible portions. Prefer groups and variety at equal totals.
 paths:=array_fill(null::jsonb,array[goal+1]);scores:=array_fill(-1000000,array[goal+1]);
 paths[1]:='{}';scores[1]:=0;
 for entry in select value from jsonb_array_elements(p_items)loop
  sku:=entry->>'sku';weight:=case sku when 'meat' then 6 when 'fish' then 5
   when 'meal' then 20 when 'egg' then 4 when 'bread' then 3 when 'grain' then 4 when 'apple' then 3 when 'beer' then 1 else 0 end;
  available:=available+weight*5*(entry->>'quantity')::bigint;
  if weight=0 then continue;end if;
  remaining:=least((entry->>'quantity')::integer,goal/weight);if sku='beer' then remaining:=least(remaining,p_crew);end if;chunk:=1;
  while remaining>0 loop
   take:=least(chunk,remaining);
   for j in reverse goal..weight*take loop
    if paths[j-weight*take+1]is not null then
     candidate:=jsonb_set(paths[j-weight*take+1],array[sku],to_jsonb(coalesce((paths[j-weight*take+1]->>sku)::integer,0)+take));
     select count(*),count(distinct case key when 'beer' then null when 'grain' then 'staple' when 'bread' then 'staple'
      when 'apple' then 'fruit' else 'protein' end),sum(value::integer)
     into types,groups,count_items from jsonb_each_text(candidate);
     if candidate?'meal' then groups:=3;end if;
     score:=groups*10000+types*100-count_items;
     if scores[j+1]<score then paths[j+1]:=candidate;scores[j+1]:=score;end if;
    end if;
   end loop;
   remaining:=remaining-take;chunk:=chunk*2;
  end loop;
 end loop;
 candidate:=null;
 for j in target..goal loop if paths[j+1]is not null then used:=j*5;candidate:=paths[j+1];exit;end if;end loop;
 if candidate is null then for j in reverse target..0 loop if paths[j+1]is not null then used:=j*5;candidate:=paths[j+1];exit;end if;end loop;end if;
 for entry in select value from jsonb_array_elements(p_items)loop
  sku:=entry->>'sku';
  if sku='beer' then wine:=coalesce((candidate->>sku)::integer,0);take:=wine;
  else take:=coalesce((candidate->>sku)::integer,0);end if;
  served:=served||jsonb_build_array(jsonb_build_object('sku',sku,'quantity',take));
 end loop;
 if p_crew>0 then
  select least(3,coalesce(sum(least(1.0,n/p_crew)*case when g='complete' then 3 else 1 end),0))into group_coverage from
  (select case key when 'meal' then 'complete' when 'grain' then 'staple' when 'bread' then 'staple' when 'apple' then 'fruit' when 'beer' then null else 'protein' end g,
   sum(value::numeric)n from jsonb_each_text(candidate)where key<>'beer' group by 1)x;
  coverage:=least(1,used::numeric/(p_crew*100));
 end if;
 return jsonb_build_object('crew_count',p_crew,'daily_need',p_crew*100,'meal_size',50,'meals_per_day',2,
 'units',used,'available_units',available,'missing_units',greatest(0,p_crew*100-used),'extra_units',greatest(0,used-p_crew*100),'served',served,
 'meals',least(p_crew*2,used/50),'available_meals',available/50,'meal_days',case when p_crew>0 then available/(p_crew*100)end,
 'coverage',case when p_crew>0 then round(coverage*100,1)end,
 'morale',case when p_crew>0 then round(least(100,70.0*coverage+20.0/3*group_coverage*coverage+10.0*wine/p_crew*coverage),1)end);
end;$$;
create or replace function ludus_food_private.settle_v55(p_owner uuid,p_today date)
returns void language plpgsql security definer set search_path='' as $$
declare house public.ludus_food_house;days integer;span integer;stocks jsonb;menu jsonb;
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 select * into house from public.ludus_food_house where owner_id=p_owner for update;
 if not found then return;end if;
 days:=p_today-1-house.settled_day;
 while days>0 loop
  select jsonb_agg(jsonb_build_object('sku',sku,'quantity',quantity))into stocks
  from public.ludus_food_stock where owner_id=p_owner;
  menu:=ludus_food_private.menu_v55(house.crew_count,stocks);
  -- Consumption stays identical until a used ingredient is depleted.
  select least(days,coalesce(min(s.quantity/nullif((e.value->>'quantity')::integer,0))
   filter(where (e.value->>'quantity')::integer>0),days))into span
  from public.ludus_food_stock s join jsonb_array_elements(menu->'served')e(value)
   on s.sku=e.value->>'sku' where s.owner_id=p_owner;
  update public.ludus_food_stock s set quantity=s.quantity-(e.value->>'quantity')::integer*span
  from jsonb_array_elements(menu->'served')e(value)where s.owner_id=p_owner and s.sku=e.value->>'sku';
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
 house public.ludus_food_house;items jsonb;served jsonb;history jsonb;purchase jsonb;forecast jsonb;
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
 select jsonb_agg(jsonb_build_object('sku',sku,'quantity',quantity))into served from public.ludus_food_stock where owner_id=u;
 forecast:=ludus_food_private.menu_v55(crew,served);
 select * into house from public.ludus_food_house where owner_id=u;
 select jsonb_agg(jsonb_build_object('sku',c.sku,'name',c.name,'price',c.price,'nutrition',c.nutrition,'edible',c.edible,'quantity',s.quantity,'daily',coalesce((select (e.value->>'quantity')::integer from jsonb_array_elements(forecast->'served')e(value)where e.value->>'sku'=c.sku),0),'days',case when crew>0 then s.quantity/crew end)order by c.sort_order),
 jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',s.quantity)order by c.sort_order)
 into items,served from public.ludus_food_catalog c join public.ludus_food_stock s using(sku)where s.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(h)order by h.to_day desc),'[]')into history from
 (select from_day,to_day,crew_count,menu from public.ludus_food_history where owner_id=u order by to_day desc limit 12)h;
 return jsonb_build_object('user_id',u,'today',today,'server_now',transaction_timestamp(),'reset_at',(today+1)::timestamp at time zone'Europe/Istanbul',
 'gold',coins,'crew_count',crew,'settled_day',house.settled_day,'last_menu',house.last_menu,'menu',forecast,'items',items,'history',history,'purchase',purchase);
end;$$;

revoke all on function ludus_food_private.menu_v55(integer,jsonb),ludus_food_private.settle_v55(uuid,date)from public,anon,authenticated;
