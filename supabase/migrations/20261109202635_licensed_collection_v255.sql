-- V255: six-hour, five-worker collection licenses; personal proceeds after 20% tax.
-- Existing departures keep their frozen V232 terms. New food professions use
-- the same authoritative training, warehouse and purchase paths as materials.
insert into ludus_worker_private.professions_v227(sku,name,sort_order) values
 ('grain','Tahıl yetiştiriciliği',10),('apple','Elma yetiştiriciliği',11),
 ('fish','Balıkçılık',12),('meat','Avcılık',13),('egg','Yumurta üretimi',14),
 ('beer','Bağcılık',15),('olive_oil','Zeytincilik',16);
insert into ludus_supply_private.market_goods_v116(sku,base_price,slot,active)
 select p.sku,c.price,p.sort_order-1,true from ludus_worker_private.professions_v227 p
 join public.ludus_food_catalog c on c.sku=p.sku where p.sort_order>=10;

alter table ludus_worker_private.skills_v227 add column collected bigint not null default 0 check(collected>=0);
alter table ludus_worker_private.clan_work_jobs_v232 add column rules_version integer not null default 232 check(rules_version in(232,255));
alter table ludus_worker_private.clan_work_people_v232
 add column gross_quantity integer not null default 0 check(gross_quantity>=0),
 add column tax_quantity integer not null default 0 check(tax_quantity>=0),
 add column delivered_at timestamptz,
 add constraint licensed_tax_split_v255 check(
  (gross_quantity=0 and tax_quantity=0) or
  (gross_quantity=quantity+tax_quantity and gross_quantity=tax_quantity*5));
create index license_deliveries_owner_v255 on ludus_worker_private.clan_work_people_v232(owner_id,completed_at)
 where completed_at is not null and delivered_at is null and gross_quantity>0;
create table ludus_worker_private.state_collections_v255(
 sku text primary key references ludus_worker_private.professions_v227(sku),
 quantity bigint not null default 0 check(quantity>=0)
);
alter table ludus_worker_private.state_collections_v255 enable row level security;
revoke all on ludus_worker_private.state_collections_v255 from public,anon,authenticated;
update ludus_worker_private.clan_work_config_v232 set duration_minutes=360,base_quantity=50,experience=60,team_limit=5 where id;

create function ludus_worker_private.license_yield_v255(p_level integer) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_level between 5 and 10 then jsonb_build_object(
  'level',p_level,'gross',50+(p_level-5)*10,'tax',10+(p_level-5)*2,'net',40+(p_level-5)*8)
 else null end;
$$;
revoke all on function ludus_worker_private.license_yield_v255(integer) from public,anon,authenticated;

-- Personal receipts remain pending when a warehouse is full. Other owners can
-- receive their share, and a retry cannot pay the same worker twice.
create function ludus_worker_private.deliver_licensed_owner_v255(p_owner uuid,p_now timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare person record;held integer;today date:=(p_now at time zone 'Europe/Istanbul')::date;
begin
 -- Cron never waits on an account held by a foreground request. A caller that
 -- already holds its own account lock can safely acquire it again.
 perform 1 from public.ludus_accounts where user_id=p_owner for update skip locked;
 if not found then return;end if;
 for person in select p.id,p.quantity,j.sku,r.food from ludus_worker_private.clan_work_people_v232 p
  join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id
  join ludus_supply_private.resources r on r.sku=j.sku
  where p.owner_id=p_owner and p.completed_at is not null and p.delivered_at is null and j.rules_version=255
  order by p.completed_at,p.id for update of p skip locked loop
  if person.food then
   insert into public.ludus_food_house(owner_id,crew_count,settled_day)
    select p_owner,count(*)::integer,today from public.ludus_gladiators where owner_id=p_owner on conflict do nothing;
   insert into public.ludus_food_stock(owner_id,sku) select p_owner,sku from public.ludus_food_catalog on conflict do nothing;
   perform ludus_food_private.settle_v55(p_owner,today);
   select quantity into held from public.ludus_food_stock where owner_id=p_owner and sku=person.sku for update;
   if held+person.quantity>50000 then continue;end if;
   update public.ludus_food_stock set quantity=quantity+person.quantity where owner_id=p_owner and sku=person.sku;
  else
   insert into ludus_supply_private.stock(owner_id,sku) values(p_owner,person.sku) on conflict do nothing;
   select quantity into held from ludus_supply_private.stock where owner_id=p_owner and sku=person.sku for update;
   if held+person.quantity>50000 then continue;end if;
   update ludus_supply_private.stock set quantity=quantity+person.quantity where owner_id=p_owner and sku=person.sku;
  end if;
  update ludus_worker_private.clan_work_people_v232 set delivered_at=p_now where id=person.id;
 end loop;
end;$$;
revoke all on function ludus_worker_private.deliver_licensed_owner_v255(uuid,timestamptz) from public,anon,authenticated;

alter function ludus_worker_private.clan_tick_v232(timestamptz) rename to clan_tick_before_licenses_v255;
revoke all on function ludus_worker_private.clan_tick_before_licenses_v255(timestamptz) from public,anon,authenticated;
do $patch$
declare src text;needle text:='where finished_at is null and ends_at<=p_now';
begin
 src:=pg_get_functiondef('ludus_worker_private.clan_tick_before_licenses_v255(timestamptz)'::regprocedure);
 if position(needle in src)=0 then raise exception 'Unexpected legacy clan settlement';end if;
 src:=replace(src,needle,'where rules_version=232 and finished_at is null and ends_at<=p_now');
 execute replace(src,'Haftalık klan çalışması ödülü','Haftalık toplanan ödülü');
end $patch$;
create function ludus_worker_private.clan_tick_v232(p_now timestamptz default clock_timestamp()) returns void
language plpgsql security definer set search_path='' as $$
declare job_row ludus_worker_private.clan_work_jobs_v232;person ludus_worker_private.clan_work_people_v232;owner_row record;
begin
 if not pg_try_advisory_xact_lock(2322026) then return;end if;
 for job_row in select * from ludus_worker_private.clan_work_jobs_v232
  where rules_version=255 and finished_at is null and ends_at<=p_now order by ends_at,id for update loop
  for person in select * from ludus_worker_private.clan_work_people_v232
   where job_id=job_row.id and completed_at is null order by worker_id,id for update loop
   insert into ludus_worker_private.state_collections_v255(sku,quantity) values(job_row.sku,person.tax_quantity)
    on conflict(sku) do update set quantity=ludus_worker_private.state_collections_v255.quantity+excluded.quantity;
   if person.worker_id is not null then
    update ludus_worker_private.skills_v227 set xp=least(2700,xp+person.experience),collected=collected+person.quantity
     where worker_id=person.worker_id and sku=job_row.sku;
   end if;
   update ludus_worker_private.clan_work_people_v232 set completed_at=job_row.ends_at where id=person.id;
  end loop;
  update ludus_worker_private.clan_work_jobs_v232 set finished_at=job_row.ends_at where id=job_row.id;
 end loop;
 -- Existing weekly receipts use the net quantity earned at the scheduled end,
 -- even if warehouse delivery is delayed. Purchased cargo never enters them.
 perform ludus_worker_private.clan_tick_before_licenses_v255(p_now);
 for owner_row in select distinct p.owner_id from ludus_worker_private.clan_work_people_v232 p
  join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id
  where j.rules_version=255 and p.completed_at is not null and p.delivered_at is null order by p.owner_id loop
  perform ludus_worker_private.deliver_licensed_owner_v255(owner_row.owner_id,p_now);
 end loop;
end;$$;
revoke all on function ludus_worker_private.clan_tick_v232(timestamptz) from public,anon,authenticated;

-- Preserve the old state serializer and historical records, but remove its
-- start/configure capability from every client-callable path.
alter function ludus_worker_private.clan_work_api_v232(text,jsonb,uuid) rename to clan_work_before_licenses_v255;
revoke all on function ludus_worker_private.clan_work_before_licenses_v255(text,jsonb,uuid) from public,anon,authenticated;
create function ludus_worker_private.clan_work_api_v232(p_action text default 'state',p_data jsonb default '{}'::jsonb,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();cid uuid;leader uuid;ids uuid[];v_sku text;payload jsonb;old_job ludus_worker_private.clan_work_jobs_v232;
 jid uuid;now_at timestamptz:=clock_timestamp();answer jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Hesabına giriş yap.' using errcode='42501';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.' using errcode='42501';end if;
 select m.clan_id,c.leader_id into cid,leader from public.ludus_clan_members m join public.ludus_clans c on c.id=m.clan_id where m.user_id=u;
 if p_action='start' then
  if cid is null or leader is distinct from u then raise exception 'Klan lideri olmalısın.' using errcode='42501';end if;
  if not coalesce((select enabled from ludus_worker_private.clan_work_config_v232 where id),false) then raise exception 'Çalışma lisansları henüz açılmadı.';end if;
  v_sku:=p_data->>'sku';
  if not exists(select 1 from ludus_worker_private.professions_v227 where sku=v_sku) then raise exception 'Lisans ürünü bulunamadı.';end if;
  if p_request is null or jsonb_typeof(p_data->'workers') is distinct from 'array' then raise exception 'Beş farklı işçi seç.';end if;
  if jsonb_array_length(p_data->'workers')<>5 then raise exception 'Bir çalışma ekibi tam 5 işçiden oluşur.';end if;
  select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_data->'workers')x;
  if cardinality(ids)<>5 or (select count(distinct x) from unnest(ids)x)<>5 then raise exception 'Beş farklı işçi seç.';end if;
  payload:=jsonb_build_object('sku',v_sku,'workers',to_jsonb(ids));
  select * into old_job from ludus_worker_private.clan_work_jobs_v232 where started_by=u and request_id=p_request;
  if found then
   if old_job.clan_id<>cid or old_job.payload<>payload then raise exception 'İşlem kimliği farklı bir çalışma için kullanılmış.';end if;
  else
   -- Serialize membership changes and both caravan/collection reservations.
   perform 1 from public.ludus_clan_members where user_id in(select owner_id from public.ludus_workers_v226 where id=any(ids)) order by user_id for share;
   perform 1 from public.ludus_workers_v226 where id=any(ids) order by id for update;
   if (select count(*) from public.ludus_workers_v226 w join public.ludus_clan_members m on m.user_id=w.owner_id where w.id=any(ids) and m.clan_id=cid)<>5 then
    raise exception 'Bütün işçiler bu klanın üyelerine ait olmalı.';end if;
   if exists(select 1 from public.ludus_workers_v226 w left join ludus_worker_private.skills_v227 s on s.worker_id=w.id and s.sku=v_sku
    where w.id=any(ids) and ludus_worker_private.level_v227(coalesce(s.xp,0))<5) then raise exception 'Her işçi bu meslekte en az 5. seviyede olmalı.';end if;
   if exists(select 1 from ludus_worker_private.assignments_v227 where worker_id=any(ids) and released_at is null)
    or exists(select 1 from ludus_worker_private.clan_work_people_v232 where worker_id=any(ids) and completed_at is null) then
    raise exception 'Seçilen işçilerden biri başka bir görevde.';end if;
   insert into ludus_worker_private.clan_work_jobs_v232(clan_id,started_by,request_id,payload,sku,started_at,ends_at,rules_version)
    values(cid,u,p_request,payload,v_sku,now_at,now_at+interval '6 hours',255) returning id into jid;
   insert into ludus_worker_private.clan_work_people_v232(job_id,worker_id,worker_key,owner_id,worker_name,ludus_name,level,quantity,experience,gross_quantity,tax_quantity)
    select jid,w.id,w.id,w.owner_id,w.name,a.ludus_name,ludus_worker_private.level_v227(s.xp),
     (y->>'net')::integer,60,(y->>'gross')::integer,(y->>'tax')::integer
    from public.ludus_workers_v226 w join public.ludus_accounts a on a.user_id=w.owner_id
    join ludus_worker_private.skills_v227 s on s.worker_id=w.id and s.sku=v_sku
    cross join lateral(select ludus_worker_private.license_yield_v255(ludus_worker_private.level_v227(s.xp)) y) rates
    where w.id=any(ids) order by w.id;
  end if;
 elsif p_action is distinct from 'state' then raise exception 'Lisans kuralı sabit: 5 işçi, 6 saat ve yüzde 20 devlet payı.';
 end if;
 perform ludus_worker_private.deliver_licensed_owner_v255(u,now_at);
 answer:=ludus_worker_private.clan_work_before_licenses_v255('state','{}',null);
 return answer||jsonb_build_object('rules_version',255,
  'config',jsonb_build_object('duration_minutes',360,'team_limit',5,'min_level',5,'experience',60,'tax_percent',20,'test_balance',true,
   'yield_by_level',(select jsonb_agg(ludus_worker_private.license_yield_v255(n) order by n) from generate_series(5,10)n)),
  'stock',(select coalesce(jsonb_object_agg(r.sku,case when r.food then coalesce(f.quantity,0) else coalesce(s.quantity,0) end),'{}')
   from ludus_worker_private.professions_v227 p join ludus_supply_private.resources r on r.sku=p.sku
   left join ludus_supply_private.stock s on s.sku=r.sku and s.owner_id=u
   left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u),
  'pending_delivery',(select coalesce(jsonb_object_agg(x.sku,x.quantity),'{}') from
   (select j.sku,sum(p.quantity) quantity from ludus_worker_private.clan_work_people_v232 p join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id
    where p.owner_id=u and j.rules_version=255 and p.completed_at is not null and p.delivered_at is null group by j.sku)x),
  'jobs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.ends_at desc),'[]') from
   (select j.id,j.sku,j.started_at,j.ends_at,j.finished_at,j.rules_version,count(p.id)::integer worker_count,
    sum(p.quantity)::bigint quantity,sum(case when j.rules_version=255 then p.gross_quantity else p.quantity end)::bigint gross_quantity,
    sum(p.tax_quantity)::bigint tax_quantity,
    jsonb_agg(jsonb_build_object('owner_id',p.owner_id,'worker_name',p.worker_name,'ludus_name',p.ludus_name,'quantity',p.quantity,
     'gross_quantity',case when j.rules_version=255 then p.gross_quantity else p.quantity end,'tax_quantity',p.tax_quantity,'level',p.level,
     'delivered',p.delivered_at is not null,'pending',j.rules_version=255 and p.completed_at is not null and p.delivered_at is null) order by p.ludus_name,p.worker_name) participants
    from ludus_worker_private.clan_work_jobs_v232 j join ludus_worker_private.clan_work_people_v232 p on p.job_id=j.id
    where j.clan_id=cid group by j.id order by j.ends_at desc limit 40)x));
end;$$;
revoke all on function ludus_worker_private.clan_work_api_v232(text,jsonb,uuid) from public,anon;
grant execute on function ludus_worker_private.clan_work_api_v232(text,jsonb,uuid) to authenticated;

do $patch$
declare src text;needle text;
begin
 src:=pg_get_functiondef('ludus_supply_private.api(text,text,integer,uuid)'::regprocedure);
 if position('qty>p_workers*60' in src)=0 or position('ts+interval''1 hour''' in src)=0 or position('''caravan_capacity'',60,' in src)=0 then raise exception 'Unexpected caravan capacity source';end if;
 src:=replace(replace(replace(src,'qty>p_workers*60','qty>p_workers*120'),'Her kervan en fazla 60 birim taşır.','Her kervan en fazla 120 birim taşır.'),'ts+interval''1 hour''','ts+interval''3 hours''');
 src:=replace(src,'''caravan_capacity'',60,','''caravan_capacity'',120,''shopping_seconds'',10800,''licensed_work_version'',255,');
 needle:='if p_action=''send''then';
 if position(needle in src)=0 then raise exception 'Unexpected free-food departure source';end if;
 src:=replace(src,needle,needle||E'\n    raise exception ''Bu ücretsiz sefer kaldırıldı. Gıda kaynağından alışveriş yap veya 6 saatlik çalışma lisansı al.'';');
 execute src;
 src:=pg_get_functiondef('ludus_worker_private.depart_v227(text,text,integer,uuid,uuid[],integer,integer,uuid[])'::regprocedure);
 execute replace(src,'Meslek gelişimi yalnızca ekipman hammaddesi seferlerinde geçerlidir.','Bu ürün için bir toplama veya üretim mesleği bulunamadı.');
 src:=pg_get_functiondef('ludus_worker_private.roster_v226()'::regprocedure);
 needle:='perform ludus_supply_private.settle_owner_v87(u,clock_timestamp());';
 if position(needle in src)=0 or position('''delivered'',coalesce(s.delivered,0)' in src)=0 then raise exception 'Unexpected worker roster source';end if;
 src:=replace(src,needle,needle||E'\n perform ludus_worker_private.deliver_licensed_owner_v255(u,clock_timestamp());');
 execute replace(src,'''delivered'',coalesce(s.delivered,0)','''collected'',coalesce(s.collected,0),''delivered'',coalesce(s.delivered,0)');
end $patch$;
notify pgrst,'reload schema';
