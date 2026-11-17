-- V284: six stationed specialists; progression is earned only by reading.
-- The earlier bonus proposals were cancelled. No lesson/effect catalogue or
-- loot rates are seeded until the new bonuses have been chosen.
create schema if not exists ludus_staff_private;
revoke all on schema ludus_staff_private from public,anon,authenticated;
grant usage on schema ludus_staff_private to authenticated;
create table ludus_staff_private.roles_v284 (
 id text primary key, name text not null, title text not null,
 sort_order smallint not null unique,
 total_papyri integer not null default 500 check(total_papyri=500)
);
insert into ludus_staff_private.roles_v284(id,name,title,sort_order)values
 ('trainer','Varro','Doctore',1),('cook','Gaius','Aşçı',2),('doctor','Aulus','Doktor',3),
 ('smith','Lucius','Demirci',4),('guard','Marcus','Kapı muhafızı',5),('groom','Titus','Seyis',6);
create table ludus_staff_private.lessons_v284 (
 role_id text references ludus_staff_private.roles_v284(id),
 lesson smallint check(lesson between 1 and 500), title text not null,
 primary key(role_id,lesson)
);
create table ludus_staff_private.effects_v284 (
 role_id text, lesson smallint, effect_key text not null,
 label text not null, target text not null,
 percent numeric(10,5) not null check(percent>0 and percent<=100),
 primary key(role_id,lesson,effect_key),
 foreign key(role_id,lesson)references ludus_staff_private.lessons_v284(role_id,lesson)
);
create table ludus_staff_private.papyri_v284 (
 owner_id uuid references public.ludus_accounts(user_id)on delete cascade,
 role_id text, lesson smallint, received_at timestamptz not null default now(),
 read_at timestamptz,
 primary key(owner_id,role_id,lesson),
 foreign key(role_id,lesson)references ludus_staff_private.lessons_v284(role_id,lesson),
 check(read_at is null or read_at>=received_at)
);
create table ludus_staff_private.read_receipts_v284 (
 owner_id uuid references public.ludus_accounts(user_id)on delete cascade,
 request_id uuid not null, role_id text not null, lesson smallint not null,
 primary key(owner_id,request_id),
 foreign key(owner_id,role_id,lesson)references ludus_staff_private.papyri_v284(owner_id,role_id,lesson)
);
alter table ludus_staff_private.roles_v284 enable row level security;
alter table ludus_staff_private.lessons_v284 enable row level security;
alter table ludus_staff_private.effects_v284 enable row level security;
alter table ludus_staff_private.papyri_v284 enable row level security;
alter table ludus_staff_private.read_receipts_v284 enable row level security;
revoke all on all tables in schema ludus_staff_private from public,anon,authenticated;

-- Internal authoritative summary for future effect consumers. The client cannot
-- write learned effects or submit a claimed overall/percentage.
create function ludus_staff_private.bonuses_v284(p_owner uuid,p_role text default null)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',effect_key,'label',label,'target',target,'percent',percent)order by effect_key),'[]'::jsonb)
 from(select e.effect_key,e.label,e.target,sum(e.percent)percent
 from ludus_staff_private.papyri_v284 p join ludus_staff_private.effects_v284 e using(role_id,lesson)
 where p.owner_id=p_owner and p.read_at is not null and(p_role is null or p.role_id=p_role)
 group by e.effect_key,e.label,e.target)s
$$;
create function ludus_staff_private.state_v284(p_role text default 'trainer',p_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();staff jsonb;papers jsonb;total integer;page integer;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
 if not exists(select 1 from public.ludus_accounts where user_id=u)then raise exception 'Ludus bulunamadı.';end if;
 if not exists(select 1 from ludus_staff_private.roles_v284 where id=p_role)or p_page is null or p_page<0 or p_page>83 then raise exception 'Çalışan veya sayfa geçersiz.';end if;
 select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'title',r.title,'total',r.total_papyri,
 'collected',(select count(*)from ludus_staff_private.papyri_v284 p where p.owner_id=u and p.role_id=r.id),
 'read',(select count(*)from ludus_staff_private.papyri_v284 p where p.owner_id=u and p.role_id=r.id and p.read_at is not null),
 'overall',(select count(*)*0.2 from ludus_staff_private.papyri_v284 p where p.owner_id=u and p.role_id=r.id and p.read_at is not null),
 'bonuses',ludus_staff_private.bonuses_v284(u,r.id))order by r.sort_order)into staff
 from ludus_staff_private.roles_v284 r;
 select count(*)into total from ludus_staff_private.papyri_v284 where owner_id=u and role_id=p_role;
 page:=least(p_page,greatest(0,(total-1)/6));
 select coalesce(jsonb_agg(to_jsonb(s)order by s.read_at nulls first,s.lesson),'[]'::jsonb)into papers
 from(select p.lesson,l.title,p.read_at,
 coalesce((select jsonb_agg(jsonb_build_object('key',e.effect_key,'label',e.label,'target',e.target,'percent',e.percent)order by e.effect_key)
 from ludus_staff_private.effects_v284 e where e.role_id=p.role_id and e.lesson=p.lesson),'[]'::jsonb)effects
 from ludus_staff_private.papyri_v284 p join ludus_staff_private.lessons_v284 l using(role_id,lesson)
 where p.owner_id=u and p.role_id=p_role order by p.read_at nulls first,p.lesson limit 6 offset page*6)s;
 return jsonb_build_object('user_id',u,'staff',staff,'role',p_role,'page',page,'paper_count',total,'papyri',papers,'overall_per_read',0.2,'daily_portions',6);
end;$$;
create function ludus_staff_private.read_v284(p_role text,p_lesson integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();receipt ludus_staff_private.read_receipts_v284;paper ludus_staff_private.papyri_v284;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
 if p_request is null or p_lesson is null or p_lesson not between 1 and 500 or p_role is null then raise exception 'Papirüs ve işlem bilgisi gerekiyor.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 select *into receipt from ludus_staff_private.read_receipts_v284 where owner_id=u and request_id=p_request;
 if found then
  if receipt.role_id<>p_role or receipt.lesson<>p_lesson then raise exception 'İşlem kimliği farklı bir papirüs için kullanılmış.';end if;
  return ludus_staff_private.state_v284(p_role,0)||jsonb_build_object('reading',jsonb_build_object('replayed',true,'lesson',p_lesson));
 end if;
 select *into paper from ludus_staff_private.papyri_v284 where owner_id=u and role_id=p_role and lesson=p_lesson for update;
 if not found then raise exception 'Bu papirüs çantanda yok.';end if;
 if paper.read_at is not null then raise exception 'Bu papirüs zaten okundu.';end if;
 if not exists(select 1 from ludus_staff_private.effects_v284 where role_id=p_role and lesson=p_lesson)then raise exception 'Bu papirüs henüz okumaya açık değil.';end if;
 update ludus_staff_private.papyri_v284 set read_at=clock_timestamp() where owner_id=u and role_id=p_role and lesson=p_lesson;
 insert into ludus_staff_private.read_receipts_v284(owner_id,request_id,role_id,lesson)values(u,p_request,p_role,p_lesson);
 return ludus_staff_private.state_v284(p_role,0)||jsonb_build_object('reading',jsonb_build_object('replayed',false,'lesson',p_lesson));
end;$$;
revoke all on all functions in schema ludus_staff_private from public,anon,authenticated;
grant execute on function ludus_staff_private.state_v284(text,integer),ludus_staff_private.read_v284(text,integer,uuid)to authenticated;
create function public.ludus_special_staff(p_role text default 'trainer',p_page integer default 0)
returns jsonb language sql security invoker set search_path='' as $$select ludus_staff_private.state_v284(p_role,p_page)$$;
create function public.ludus_special_staff_read(p_role text,p_lesson integer,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$select ludus_staff_private.read_v284(p_role,p_lesson,p_request)$$;
revoke all on function public.ludus_special_staff(text,integer),public.ludus_special_staff_read(text,integer,uuid)from public,anon;
grant execute on function public.ludus_special_staff(text,integer),public.ludus_special_staff_read(text,integer,uuid)to authenticated;

-- Every account owns eight caravan workers (the existing roster initializes
-- those records lazily). Workers on a trip are still counted once, by owner.
create function ludus_food_private.people_v284(p_owner uuid)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('gladiators',g,'workers',w,'specialists',s,'total',g+w+s)
 from(select(select count(*)::integer from public.ludus_gladiators where owner_id=p_owner)g,
 greatest(8,(select count(*)::integer from public.ludus_workers_v226 where owner_id=p_owner))w,
 (select count(*)::integer from ludus_staff_private.roles_v284)s)p
$$;
revoke all on function ludus_food_private.people_v284(uuid)from public,anon,authenticated;

create or replace function ludus_food_private.settle_v55(p_owner uuid,p_today date)
returns void language plpgsql security definer set search_path='' as $$
declare crew integer;ingredients jsonb;
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 crew:=(ludus_food_private.people_v284(p_owner)->>'total')::integer;
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
 crew:=(ludus_food_private.people_v284(u)->>'total')::integer;
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
 'kitchen',jsonb_build_object('version',284,'day',today,'revision',coalesce((select revision from ludus_food_private.kitchen_days_v265 where owner_id=u and day=today),0),'ingredients',forecast->'served','served_at',(select served_at from ludus_food_private.kitchen_days_v265 where owner_id=u and day=today),'variety_goal',least(5,crew)),
 'gold',coins,'crew_count',crew,'people',ludus_food_private.people_v284(u),'settled_day',house.settled_day,'last_menu',house.last_menu,'menu',forecast,'recovery',jsonb_build_object('active_bonus',0,'forecast_bonus',0,'base_rate',10),'combat',jsonb_build_object('active_bonus',ludus_food_private.combat_bonus_v60(u),'forecast_bonus',forecast->'stamina_bonus_percent','active_until',(today+1)::timestamp at time zone'Europe/Istanbul','base_multiplier',.65),'items',items,'history',history,'purchase',purchase);
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
 if crew=0 then raise exception 'Yemek verilecek kişi yok.';end if;
 current_items:=state->'kitchen'->'ingredients';current_revision:=(state->'kitchen'->>'revision')::integer;
 if p_revision<>current_revision then raise exception 'Menü başka bir oturumda değişti. Yenileyip tekrar seç.';end if;
 select jsonb_agg(jsonb_build_object('sku',sku,'quantity',q)order by sku)into combined from
 (select value->>'sku' sku,sum((value->>'quantity')::integer)::integer q from jsonb_array_elements(current_items||canonical)group by value->>'sku')s;
 day_menu:=ludus_food_private.menu_v265(crew,combined);
 if (day_menu->>'portions')::integer>crew then raise exception 'Bugün en fazla toplam kişi sayısı kadar porsiyon verebilirsin.';end if;
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
 crew:=(ludus_food_private.people_v284(u)->>'total')::integer;
 select d.ingredients into ingredients from ludus_food_private.kitchen_days_v265 d where owner_id=u and day=(clock_timestamp()at time zone'Europe/Istanbul')::date;
 if crew>0 and ingredients is not null and (ludus_food_private.menu_v265(crew,ingredients)->>'coverage')::numeric=100 then
  perform ludus_private.first_quest_add_v111(u,'food_day');
 end if;
end;$$;

