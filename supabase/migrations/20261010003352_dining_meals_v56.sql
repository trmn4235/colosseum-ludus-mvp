-- Finish past days under the previous rules before switching meal composition.
do $$declare u uuid;begin for u in select owner_id from public.ludus_food_house order by owner_id loop perform ludus_food_private.settle_v55(u,(transaction_timestamp()at time zone'Europe/Istanbul')::date);end loop;end;$$;
update public.ludus_food_catalog set price=case sku when 'grain' then 3 when 'apple' then 6 when 'fish' then 9 when 'meat' then 12 when 'beer' then 6 end;
create or replace function ludus_food_private.menu_v55(p_crew integer,p_items jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare grain integer:=0;fish integer:=0;meat integer:=0;apple integer:=0;beer integer:=0;
 meals integer;available integer;served jsonb;entry jsonb;
begin
 for entry in select value from jsonb_array_elements(p_items)loop
  case entry->>'sku'
   when 'grain' then grain:=(entry->>'quantity')::integer;
   when 'fish' then fish:=(entry->>'quantity')::integer;
   when 'meat' then meat:=(entry->>'quantity')::integer;
   when 'apple' then apple:=(entry->>'quantity')::integer;
   when 'beer' then beer:=(entry->>'quantity')::integer;
   else null;
  end case;
 end loop;
 available:=least(grain,fish+meat);meals:=least(p_crew,available);
 -- Each complete meal needs one grain and one main. Fish is used first,
 -- then meat fills the remaining mains. Supplements are used only with meals.
 fish:=least(fish,meals);meat:=meals-fish;apple:=least(apple,meals);beer:=least(beer,meals);
 served:=jsonb_build_array(jsonb_build_object('sku','grain','quantity',meals),
 jsonb_build_object('sku','apple','quantity',apple),jsonb_build_object('sku','fish','quantity',fish),
 jsonb_build_object('sku','meat','quantity',meat),jsonb_build_object('sku','beer','quantity',beer));
 return jsonb_build_object('crew_count',p_crew,'served',served,'meals',meals,'available_meals',available,
 'meal_days',case when p_crew>0 then available/p_crew end,
 'coverage',case when p_crew>0 then round(100.0*meals/p_crew,1)end,
 'morale',case when p_crew>0 then round((70.0*meals+20.0*apple+10.0*beer)/p_crew,1)end);
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
 select jsonb_agg(jsonb_build_object('sku',c.sku,'name',c.name,'price',c.price,'edible',c.edible,'quantity',s.quantity,'daily',coalesce((select (e.value->>'quantity')::integer from jsonb_array_elements(ludus_food_private.menu_v55(crew,(select jsonb_agg(jsonb_build_object('sku',st.sku,'quantity',st.quantity))from public.ludus_food_stock st where st.owner_id=u))->'served')e(value)where e.value->>'sku'=c.sku),0),'days',case when crew>0 then s.quantity/crew end)order by c.sort_order),
 jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',s.quantity)order by c.sort_order)
 into items,served from public.ludus_food_catalog c join public.ludus_food_stock s using(sku)where s.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(h)order by h.to_day desc),'[]')into history from
 (select from_day,to_day,crew_count,menu from public.ludus_food_history where owner_id=u order by to_day desc limit 12)h;
 return jsonb_build_object('user_id',u,'today',today,'server_now',transaction_timestamp(),'reset_at',(today+1)::timestamp at time zone'Europe/Istanbul',
 'gold',coins,'crew_count',crew,'settled_day',house.settled_day,'last_menu',house.last_menu,'menu',ludus_food_private.menu_v55(crew,served),'items',items,'history',history,'purchase',purchase);
end;$$;

revoke all on function ludus_food_private.menu_v55(integer,jsonb),ludus_food_private.settle_v55(uuid,date)from public,anon,authenticated;
