-- V265: manual daily kitchen. Existing pantry stock is preserved at cutover.
-- No elapsed day is charged automatically, and no unused stock grants a combat bonus.
create table if not exists ludus_food_private.kitchen_days_v265 (
 owner_id uuid not null references public.ludus_food_house(owner_id) on delete cascade,
 day date not null, ingredients jsonb not null default '[]' check(jsonb_typeof(ingredients)='array'),
 revision integer not null default 0 check(revision>=0), served_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,day)
);
create table if not exists ludus_food_private.kitchen_receipts_v265 (
 owner_id uuid not null references public.ludus_food_house(owner_id) on delete cascade,
 request_id uuid not null, day date not null, revision integer not null,
 ingredients jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,request_id)
);
alter table ludus_food_private.kitchen_days_v265 enable row level security;
alter table ludus_food_private.kitchen_receipts_v265 enable row level security;
revoke all on ludus_food_private.kitchen_days_v265,ludus_food_private.kitchen_receipts_v265 from public,anon,authenticated;

create or replace function ludus_food_private.menu_v265(p_crew integer,p_items jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare portions integer:=0;types integer:=0;goal integer:=least(5,greatest(0,p_crew));coverage numeric:=0;
 variety numeric:=0;quality numeric:=0;wine integer:=0;oil integer:=0;bonus numeric:=0;morale numeric:=0;
begin
 select coalesce(sum((value->>'quantity')::integer)filter(where value->>'sku' in('grain','apple','fish','meat','egg','bread','meal')),0),
 count(distinct case when value->>'sku' in('bread','meal')then 'grain' else value->>'sku' end)filter(where (value->>'quantity')::integer>0),
 coalesce(sum((value->>'quantity')::integer)filter(where value->>'sku'='beer'),0),
 coalesce(sum((value->>'quantity')::integer)filter(where value->>'sku'='olive_oil'),0)
 into portions,types,wine,oil from jsonb_array_elements(p_items);
 if p_crew>0 then
  coverage:=least(100,round(100.0*portions/p_crew,1));
  variety:=least(100,round(100.0*types/goal,1));
  quality:=case when coverage=100 then variety else 0 end;
  bonus:=case when coverage<100 then 0 when quality>=100 then 12 when quality>=50 then 8 else 4 end;
  morale:=least(100,round(coverage*(.7+.25*variety/100+.05*least(wine,p_crew)::numeric/p_crew),1));
 end if;
 return jsonb_build_object('crew_count',p_crew,'served',p_items,'portions',portions,'types',types,'variety_goal',goal,'variety',variety,
 'coverage',coverage,'quality',quality,'morale',morale,'stamina_bonus_percent',bonus,'daily_need',p_crew*100,
 'units',portions*100,'available_units',portions*100,'missing_units',greatest(0,p_crew-portions)*100,
 'extra_units',greatest(0,portions-p_crew)*100,'meals',least(p_crew,portions),'olive_oil_used',oil,'olive_oil_needed',0,'balanced_without_oil',false);
end;$$;

create or replace function ludus_food_private.settle_v55(p_owner uuid,p_today date)
returns void language plpgsql security definer set search_path='' as $$
declare crew integer;ingredients jsonb;
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 select count(*) into crew from public.ludus_gladiators where owner_id=p_owner;
 select coalesce((select d.ingredients from ludus_food_private.kitchen_days_v265 d where d.owner_id=p_owner and d.day=p_today),'[]'::jsonb) into ingredients;
 update public.ludus_food_house set settled_day=p_today-1,crew_count=crew,last_menu=ludus_food_private.menu_v265(crew,ingredients) where owner_id=p_owner;
end;$$;

CREATE OR REPLACE FUNCTION ludus_food_private.api_v55(p_action text, p_sku text, p_quantity integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   if exists(select 1 from public.ludus_food_catalog where sku=p_sku and retired)then raise exception 'Bu hazır gıdanın satışı kaldırıldı. Mevcut stok korunuyor.';end if;
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
 select coalesce((select ingredients from ludus_food_private.kitchen_days_v265 where owner_id=u and day=today),'[]'::jsonb) into served;
 forecast:=ludus_food_private.menu_v265(crew,served);
 select * into house from public.ludus_food_house where owner_id=u;
 select jsonb_agg(jsonb_build_object('sku',c.sku,'name',c.name,'price',c.price,'nutrition',c.nutrition,'retired',c.retired,'edible',c.edible,'quantity',s.quantity,'daily',coalesce((select (e.value->>'quantity')::integer from jsonb_array_elements(forecast->'served')e(value)where e.value->>'sku'=c.sku),0),'days',case when crew>0 then s.quantity/crew end)order by c.sort_order),
 jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',s.quantity)order by c.sort_order)
 into items,served from public.ludus_food_catalog c join public.ludus_food_stock s using(sku)where s.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(h)order by h.to_day desc),'[]')into history from
 (select from_day,to_day,crew_count,menu from public.ludus_food_history where owner_id=u order by to_day desc limit 12)h;
 return jsonb_build_object('user_id',u,'today',today,'server_now',transaction_timestamp(),'reset_at',(today+1)::timestamp at time zone'Europe/Istanbul',
 'kitchen',jsonb_build_object('version',265,'day',today,'revision',coalesce((select revision from ludus_food_private.kitchen_days_v265 where owner_id=u and day=today),0),'ingredients',forecast->'served','served_at',(select served_at from ludus_food_private.kitchen_days_v265 where owner_id=u and day=today),'variety_goal',least(5,crew)),
 'gold',coins,'crew_count',crew,'settled_day',house.settled_day,'last_menu',house.last_menu,'menu',forecast,'recovery',jsonb_build_object('active_bonus',0,'forecast_bonus',0,'base_rate',10),'combat',jsonb_build_object('active_bonus',ludus_food_private.combat_bonus_v60(u),'forecast_bonus',forecast->'stamina_bonus_percent','active_until',(today+1)::timestamp at time zone'Europe/Istanbul','base_multiplier',.65),'items',items,'history',history,'purchase',purchase);
end;$function$;


create or replace function ludus_food_private.serve_v265(p_items jsonb,p_day date,p_request uuid,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();today date:=(clock_timestamp()at time zone'Europe/Istanbul')::date;crew integer;
 canonical jsonb;combined jsonb;current_items jsonb;current_revision integer;entry jsonb;held integer;
 receipt ludus_food_private.kitchen_receipts_v265;state jsonb;day_menu jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Giriş gerekiyor.';end if;
 if p_request is null or p_day is null or p_revision is null or p_revision<0 then raise exception 'Gün ve işlem bilgisi gerekiyor.';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Malzeme seçimi geçersiz.';end if;
 if jsonb_array_length(p_items)not between 1 and 9 then raise exception '1–9 farklı malzeme seç.';end if;
 for entry in select value from jsonb_array_elements(p_items)loop
  if jsonb_typeof(entry)<>'object' or jsonb_typeof(entry->'sku')is distinct from 'string'
   or jsonb_typeof(entry->'quantity')is distinct from 'number'
   or coalesce(entry->>'quantity','')!~'^[0-9]{1,4}$' then raise exception 'Malzeme miktarı pozitif tam sayı olmalı.';end if;
  if (entry->>'quantity')::integer not between 1 and 5000 then raise exception 'Malzeme miktarı 1–5000 arasında olmalı.';end if;
  if not exists(select 1 from public.ludus_food_catalog where sku=entry->>'sku')then raise exception 'Gıda bulunamadı.';end if;
 end loop;
 if (select count(distinct value->>'sku')from jsonb_array_elements(p_items))<>jsonb_array_length(p_items)then raise exception 'Aynı malzeme birden fazla satırda olamaz.';end if;
 select jsonb_agg(jsonb_build_object('sku',value->>'sku','quantity',(value->>'quantity')::integer)order by value->>'sku')into canonical from jsonb_array_elements(p_items);
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 select * into receipt from ludus_food_private.kitchen_receipts_v265 where owner_id=u and request_id=p_request;
 if found then
  if receipt.day<>p_day or receipt.revision<>p_revision or receipt.ingredients<>canonical then raise exception 'İşlem kimliği farklı bir yemek için kullanılmış.';end if;
  return ludus_food_private.api_v55('state',null,null,null)||jsonb_build_object('delivery',jsonb_build_object('day',receipt.day,'replayed',true));
 end if;
 if p_day<>today then raise exception 'Gün değişti. Bugünün menüsünü yeniden seç.';end if;
 state:=ludus_food_private.api_v55('state',null,null,null);crew:=(state->>'crew_count')::integer;
 if crew=0 then raise exception 'Yemek verilecek gladyatör yok.';end if;
 current_items:=state->'kitchen'->'ingredients';current_revision:=(state->'kitchen'->>'revision')::integer;
 if p_revision<>current_revision then raise exception 'Menü başka bir oturumda değişti. Yenileyip tekrar seç.';end if;
 select jsonb_agg(jsonb_build_object('sku',sku,'quantity',q)order by sku)into combined from
 (select value->>'sku' sku,sum((value->>'quantity')::integer)::integer q from jsonb_array_elements(current_items||canonical)group by value->>'sku')s;
 day_menu:=ludus_food_private.menu_v265(crew,combined);
 if (day_menu->>'portions')::integer>crew then raise exception 'Bugün en fazla gladyatör sayısı kadar porsiyon verebilirsin.';end if;
 if exists(select 1 from jsonb_array_elements(combined)where value->>'sku' in('beer','olive_oil')and(value->>'quantity')::integer>crew)then raise exception 'Ek malzemeler kişi başına en fazla bir adet olabilir.';end if;
 for entry in select value from jsonb_array_elements(canonical)loop
  select quantity into held from public.ludus_food_stock where owner_id=u and sku=entry->>'sku' for update;
  if held is null or held<(entry->>'quantity')::integer then raise exception 'Seçtiğin malzeme envanterde yeterli değil.';end if;
 end loop;
 for entry in select value from jsonb_array_elements(canonical)loop
  update public.ludus_food_stock set quantity=quantity-(entry->>'quantity')::integer where owner_id=u and sku=entry->>'sku';
 end loop;
 insert into ludus_food_private.kitchen_days_v265(owner_id,day,ingredients,revision)values(u,today,combined,current_revision+1)
 on conflict(owner_id,day)do update set ingredients=excluded.ingredients,revision=excluded.revision,served_at=clock_timestamp();
 insert into ludus_food_private.kitchen_receipts_v265(owner_id,request_id,day,revision,ingredients)values(u,p_request,today,p_revision,canonical);
 insert into public.ludus_food_history(owner_id,from_day,to_day,crew_count,menu)values(u,today,today,crew,day_menu)
 on conflict(owner_id,to_day)do update set crew_count=excluded.crew_count,menu=excluded.menu;
 perform ludus_private.first_quest_food_v111(u);
 return ludus_food_private.api_v55('state',null,null,null)||jsonb_build_object('delivery',jsonb_build_object('day',today,'replayed',false));
end;$$;

create or replace function ludus_private.first_quest_food_v111(u uuid)returns void
language plpgsql set search_path='' as $$
declare crew integer;ingredients jsonb;
begin
 if exists(select 1 from ludus_private.first_quest_marks_v111 where owner_id=u and quest='food_day')then return;end if;
 select count(*)into crew from public.ludus_gladiators where owner_id=u;
 select d.ingredients into ingredients from ludus_food_private.kitchen_days_v265 d where owner_id=u and day=(clock_timestamp()at time zone'Europe/Istanbul')::date;
 if crew>0 and ingredients is not null and (ludus_food_private.menu_v265(crew,ingredients)->>'coverage')::numeric=100 then
  perform ludus_private.first_quest_add_v111(u,'food_day');
 end if;
end;$$;

revoke all on function ludus_food_private.menu_v265(integer,jsonb),ludus_food_private.serve_v265(jsonb,date,uuid,integer),ludus_food_private.settle_v55(uuid,date),ludus_private.first_quest_food_v111(uuid) from public,anon,authenticated;
grant execute on function ludus_food_private.serve_v265(jsonb,date,uuid,integer)to authenticated;
create or replace function public.ludus_food_serve(p_items jsonb,p_day date,p_request uuid,p_revision integer)
returns jsonb language sql security invoker set search_path='' as $$select ludus_food_private.serve_v265(p_items,p_day,p_request,p_revision)$$;
revoke all on function public.ludus_food_serve(jsonb,date,uuid,integer)from public,anon;
grant execute on function public.ludus_food_serve(jsonb,date,uuid,integer)to authenticated;
