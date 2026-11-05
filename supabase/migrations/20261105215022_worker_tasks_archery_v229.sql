-- V229: owned task clocks and individual archery training/defense snapshots.
-- Player trade caravans have no playable raid flow yet. These values do not
-- alter existing NPC raid combat or introduce cargo loss.
create table ludus_worker_private.archery_v229 (
 worker_id uuid primary key references public.ludus_workers_v226(id) on delete cascade,
 xp integer not null default 0 check(xp between 0 and 1900),
 training_trips bigint not null default 0 check(training_trips>=0)
);
alter table ludus_worker_private.archery_v229 enable row level security;
revoke all on ludus_worker_private.archery_v229 from public,anon,authenticated;

create function ludus_worker_private.archery_level_v229(p_xp integer)
returns integer language sql immutable set search_path='' as $$
 select least(20,1+greatest(0,coalesce(p_xp,0))/100);
$$;
create function ludus_worker_private.arrow_damage_v229(p_level integer)
returns integer language sql immutable set search_path='' as $$
 select 8+least(20,greatest(1,coalesce(p_level,1)));
$$;
revoke all on function ludus_worker_private.archery_level_v229(integer),
 ludus_worker_private.arrow_damage_v229(integer) from public,anon,authenticated;

alter table ludus_worker_private.assignments_v227
 add column archery_level smallint not null default 1 check(archery_level between 1 and 20),
 add column archery_armed boolean not null default false,
 add column archery_xp_awarded smallint not null default 0 check(archery_xp_awarded between 0 and 10);
alter table ludus_supply_private.jobs
 add column worker_defense jsonb not null default '[]'::jsonb check(jsonb_typeof(worker_defense)='array');

create or replace function ludus_worker_private.delivery_v227()
returns trigger language plpgsql set search_path='' as $$
declare a ludus_worker_private.assignments_v227; amount bigint; before_xp integer; earned integer; archery_earned integer;
begin
 if new.claimed_at is null or old.claimed_at is not null then return new; end if;
 for a in select * from ludus_worker_private.assignments_v227
   where job_id=new.id and released_at is null order by position for update loop
  amount:=coalesce((new.cargo->>a.sku)::bigint,0);
  amount:=amount/new.workers + case when a.position<=amount%new.workers then 1 else 0 end;
  earned:=0;archery_earned:=0;
  if amount>0 then
   insert into ludus_worker_private.skills_v227(worker_id,sku) values(a.worker_id,a.sku) on conflict do nothing;
   select xp into before_xp from ludus_worker_private.skills_v227 where worker_id=a.worker_id and sku=a.sku for update;
   earned:=least(amount,greatest(0,600-before_xp))::integer;
   update ludus_worker_private.skills_v227 set xp=xp+earned,delivered=delivered+amount where worker_id=a.worker_id and sku=a.sku;
  end if;
  if a.archery_armed then
   insert into ludus_worker_private.archery_v229(worker_id) values(a.worker_id) on conflict do nothing;
   select xp into before_xp from ludus_worker_private.archery_v229 where worker_id=a.worker_id for update;
   archery_earned:=least(10,greatest(0,1900-before_xp));
   update ludus_worker_private.archery_v229 set xp=xp+archery_earned,training_trips=training_trips+1 where worker_id=a.worker_id;
  end if;
  update ludus_worker_private.assignments_v227 set quantity=amount,xp_awarded=earned,archery_xp_awarded=archery_earned,released_at=new.claimed_at
   where job_id=a.job_id and worker_id=a.worker_id;
 end loop;
 return new;
end;
$$;

create or replace function ludus_worker_private.roster_v226()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); rows_json jsonb; assignments_json jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Hesabına giriş yap.' using errcode='42501';
 end if;
 -- Keep the existing account -> job -> worker order in all callers.
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus hesabı bulunamadı.' using errcode='42501'; end if;
 perform ludus_supply_private.settle_owner_v87(u,clock_timestamp());
 insert into public.ludus_workers_v226(owner_id,slot,name,portrait)
 select u,n,'İşçi '||n,n-1 from pg_catalog.generate_series(1,8)n on conflict(owner_id,slot) do nothing;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',w.id,'slot',w.slot,'name',w.name,'portrait',w.portrait,
  'job_id',(select a.job_id from ludus_worker_private.assignments_v227 a where a.worker_id=w.id and a.released_at is null),
  'job',(select jsonb_build_object('id',j.id,'destination',j.destination,
    'destination_name',coalesce(c.name,j.destination),'started_at',j.started_at,'ends_at',j.ends_at,
    'cargo',j.cargo,'worker_defense',j.worker_defense)
   from ludus_worker_private.assignments_v227 a join ludus_supply_private.jobs j on j.id=a.job_id
   left join ludus_supply_private.cities_v116 c on j.destination='city-'||c.id
   where a.worker_id=w.id and a.released_at is null),
  'archery',jsonb_build_object('xp',coalesce(ar.xp,0),'level',ludus_worker_private.archery_level_v229(coalesce(ar.xp,0)),
   'base_damage',ludus_worker_private.arrow_damage_v229(ludus_worker_private.archery_level_v229(coalesce(ar.xp,0))),
   'training_trips',coalesce(ar.training_trips,0)),
  'skills',(select jsonb_agg(jsonb_build_object('sku',p.sku,'name',p.name,
    'xp',coalesce(s.xp,0),'level',ludus_worker_private.level_v227(coalesce(s.xp,0)),
    'delivered',coalesce(s.delivered,0)) order by p.sort_order)
   from ludus_worker_private.professions_v227 p left join ludus_worker_private.skills_v227 s on s.sku=p.sku and s.worker_id=w.id)
 ) order by w.slot),'[]'::jsonb) into rows_json from public.ludus_workers_v226 w left join ludus_worker_private.archery_v229 ar on ar.worker_id=w.id where w.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('name',w.name) order by j.started_at desc,a.position),'[]'::jsonb)
 into assignments_json from ludus_worker_private.assignments_v227 a
 join public.ludus_workers_v226 w on w.id=a.worker_id join ludus_supply_private.jobs j on j.id=a.job_id
 where w.owner_id=u and (a.released_at is null or a.job_id in
  (select id from ludus_supply_private.jobs where owner_id=u and claimed_at is not null order by claimed_at desc limit 10));
 return jsonb_build_object('user_id',u,'server_now',clock_timestamp(),'archery_xp_per_trip',10,'archery_xp_per_level',100,'archery_max_level',20,'workers',rows_json,'assignments',assignments_json,
  'professions',(select jsonb_agg(to_jsonb(p) order by p.sort_order) from ludus_worker_private.professions_v227 p),
  'level_thresholds',jsonb_build_array(0,60,180,360,600),'xp_per_unit',1,'caravan_level_cap',5);
end;
$$;

create or replace function ludus_worker_private.depart_v227(p_action text,p_key text,p_workers integer,p_request uuid,
 p_worker_ids uuid[],p_bows integer,p_arrows integer,p_escort uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); payload jsonb; receipt ludus_worker_private.receipts_v227;
 s jsonb; roster jsonb; answer jsonb; jid uuid; material text;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Hesabına giriş yap.' using errcode='42501';
 end if;
 material:=split_part(p_key,':',2);
 if p_action is distinct from 'buy' or p_request is null or material is null or
  not exists(select 1 from ludus_worker_private.professions_v227 where sku=material) then
  raise exception 'Meslek gelişimi yalnızca ekipman hammaddesi seferlerinde geçerlidir.';
 end if;
 if p_worker_ids is null or array_ndims(p_worker_ids) is distinct from 1 or p_workers is null or
  p_workers not between 1 and 6 or cardinality(p_worker_ids)<>p_workers or
  (select count(distinct id) from unnest(p_worker_ids)id)<>p_workers then
  raise exception 'Her kervan için farklı bir işçi seç.';
 end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.' using errcode='42501'; end if;
 s:=ludus_supply_private.api('state',null,1,null);
 payload:=jsonb_build_object('action',p_action,'key',p_key,'workers',p_workers,'worker_ids',p_worker_ids,
  'bow',p_bows,'arrow',p_arrows,'escort',coalesce(p_escort,'{}'::uuid[]));
 select * into receipt from ludus_worker_private.receipts_v227 where owner_id=u and request_id=p_request;
 if found then
  if receipt.payload<>payload then raise exception 'İşlem kimliği başka bir işçi seferinde kullanılmış.'; end if;
  return s||jsonb_build_object('result',jsonb_build_object('job_id',receipt.job_id,'replayed',true,
   'message','İşçi seferi kaydedildi.'),'worker_roster',ludus_worker_private.roster_v226());
 end if;
 -- Do not attach a worker to an older, possibly already delivered receipt.
 if exists(select 1 from ludus_supply_private.receipts where owner_id=u and request_id=p_request) then
  raise exception 'İşlem kimliği başka bir çıkışta kullanılmış.';
 end if;
 roster:=ludus_worker_private.roster_v226();
 if (select count(*) from public.ludus_workers_v226 where owner_id=u and id=any(p_worker_ids))<>p_workers then
  raise exception 'Seçilen işçiler senin Ludusuna ait olmalı.' using errcode='42501';
 end if;
 if exists(select 1 from ludus_worker_private.assignments_v227 where worker_id=any(p_worker_ids) and released_at is null) then
  raise exception 'Seçilen işçilerden biri zaten seferde. Başka bir işçi seç.';
 end if;
 s:=ludus_supply_private.depart_v126(p_action,p_key,p_workers,p_request,p_bows,p_arrows,p_escort);
 answer:=s->'result';jid:=(answer->>'job_id')::uuid;
 if jid is null or not exists(select 1 from ludus_supply_private.jobs where id=jid and owner_id=u and claimed_at is null and cargo ? material) then
  raise exception 'İşçi seferi doğrulanamadı.';
 end if;
 insert into ludus_worker_private.assignments_v227(job_id,worker_id,sku,position,archery_level,archery_armed)
 select jid,picked.id,material,n::smallint,ludus_worker_private.archery_level_v229(coalesce(ar.xp,0)),
  n<=least(p_bows,p_arrows)
 from unnest(p_worker_ids) with ordinality as picked(id,n)
 left join ludus_worker_private.archery_v229 ar on ar.worker_id=picked.id;
 -- Freeze the owned worker's level at departure; later training never changes
 -- an in-flight caravan's defense. Bows and arrows follow selection order.
 update ludus_supply_private.jobs set worker_defense=(
  select jsonb_agg(jsonb_build_object('worker_id',a.worker_id,'name',w.name,'archery_level',a.archery_level,
   'base_damage',ludus_worker_private.arrow_damage_v229(a.archery_level),'armed',a.archery_armed,
   'arrows',case when a.position<=p_bows and p_bows>0 then p_arrows/p_bows+case when a.position<=p_arrows%p_bows then 1 else 0 end else 0 end)
   order by a.position)
  from ludus_worker_private.assignments_v227 a join public.ludus_workers_v226 w on w.id=a.worker_id
  where a.job_id=jid
 ) where id=jid;
 insert into ludus_worker_private.receipts_v227(owner_id,request_id,payload,job_id) values(u,p_request,payload,jid);
 s:=ludus_supply_private.api('state',null,1,null);
 return s||jsonb_build_object('worker_roster',ludus_worker_private.roster_v226(),
  'result',answer||jsonb_build_object('message','İşçiler kervanla yola çıktı.','worker_ids',p_worker_ids));
end;
$$;
