-- Material professions: one EXP per delivered unit, caravan training up to level 5.
-- Existing food trips, caravan entitlement, prices, escorts and delivery stay intact.
create table ludus_worker_private.professions_v227 (
  sku text primary key references ludus_supply_private.resources(sku),
  name text not null,
  sort_order smallint not null unique
);
insert into ludus_worker_private.professions_v227 values
 ('iron_ore','Demir madenciliği',1),('copper_ore','Bakır madenciliği',2),
 ('tin_ore','Kalay madenciliği',3),('lead_ore','Kurşun madenciliği',4),
 ('wood','Odunculuk',5),('flax','Keten yetiştiriciliği',6),
 ('hide','Dericilik',7),('wool','Yüncülük',8),('resin','Reçine toplayıcılığı',9);

create table ludus_worker_private.skills_v227 (
  worker_id uuid not null references public.ludus_workers_v226(id) on delete cascade,
  sku text not null references ludus_worker_private.professions_v227(sku),
  xp integer not null default 0 check(xp between 0 and 600),
  delivered bigint not null default 0 check(delivered >= 0),
  primary key(worker_id,sku)
);
create index worker_skills_sku_v227 on ludus_worker_private.skills_v227(sku);

create table ludus_worker_private.assignments_v227 (
  job_id uuid not null references ludus_supply_private.jobs(id) on delete cascade,
  worker_id uuid not null references public.ludus_workers_v226(id) on delete cascade,
  sku text not null references ludus_worker_private.professions_v227(sku),
  position smallint not null check(position between 1 and 6),
  released_at timestamptz,
  quantity bigint not null default 0 check(quantity >= 0),
  xp_awarded integer not null default 0 check(xp_awarded between 0 and 600),
  primary key(job_id,worker_id),
  unique(job_id,position)
);
create unique index worker_one_trip_v227 on ludus_worker_private.assignments_v227(worker_id) where released_at is null;
create index worker_assignments_history_v227 on ludus_worker_private.assignments_v227(worker_id,released_at desc);
create index worker_assignments_sku_v227 on ludus_worker_private.assignments_v227(sku);

create table ludus_worker_private.receipts_v227 (
  owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  job_id uuid not null references ludus_supply_private.jobs(id),
  primary key(owner_id,request_id)
);
create index worker_receipts_job_v227 on ludus_worker_private.receipts_v227(job_id);
alter table ludus_worker_private.professions_v227 enable row level security;
alter table ludus_worker_private.skills_v227 enable row level security;
alter table ludus_worker_private.assignments_v227 enable row level security;
alter table ludus_worker_private.receipts_v227 enable row level security;
revoke all on ludus_worker_private.professions_v227,ludus_worker_private.skills_v227,
 ludus_worker_private.assignments_v227,ludus_worker_private.receipts_v227 from public,anon,authenticated;

create function ludus_worker_private.level_v227(p_xp integer)
returns integer language sql immutable set search_path='' as $$
 select case when p_xp>=600 then 5 when p_xp>=360 then 4 when p_xp>=180 then 3 when p_xp>=60 then 2 else 1 end;
$$;
revoke all on function ludus_worker_private.level_v227(integer) from public,anon,authenticated;

-- Every delivery path (including scheduled settlement) crosses this transition.
-- The receipt on each assignment and the claimed_at transition prevent double EXP.
create function ludus_worker_private.delivery_v227()
returns trigger language plpgsql set search_path='' as $$
declare a ludus_worker_private.assignments_v227; amount bigint; before_xp integer; earned integer;
begin
 if new.claimed_at is null or old.claimed_at is not null then return new; end if;
 for a in select * from ludus_worker_private.assignments_v227
   where job_id=new.id and released_at is null order by position for update loop
  amount:=coalesce((new.cargo->>a.sku)::bigint,0);
  amount:=amount/new.workers + case when a.position<=amount%new.workers then 1 else 0 end;
  earned:=0;
  if amount>0 then
   insert into ludus_worker_private.skills_v227(worker_id,sku) values(a.worker_id,a.sku) on conflict do nothing;
   select xp into before_xp from ludus_worker_private.skills_v227 where worker_id=a.worker_id and sku=a.sku for update;
   earned:=least(amount,greatest(0,600-before_xp))::integer;
   update ludus_worker_private.skills_v227 set xp=xp+earned,delivered=delivered+amount where worker_id=a.worker_id and sku=a.sku;
  end if;
  update ludus_worker_private.assignments_v227 set quantity=amount,xp_awarded=earned,released_at=new.claimed_at
   where job_id=a.job_id and worker_id=a.worker_id;
 end loop;
 return new;
end;
$$;
revoke all on function ludus_worker_private.delivery_v227() from public,anon,authenticated;
create trigger worker_delivery_v227 after update of claimed_at on ludus_supply_private.jobs
 for each row when(old.claimed_at is null and new.claimed_at is not null)
 execute function ludus_worker_private.delivery_v227();

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
  'skills',(select jsonb_agg(jsonb_build_object('sku',p.sku,'name',p.name,
    'xp',coalesce(s.xp,0),'level',ludus_worker_private.level_v227(coalesce(s.xp,0)),
    'delivered',coalesce(s.delivered,0)) order by p.sort_order)
   from ludus_worker_private.professions_v227 p left join ludus_worker_private.skills_v227 s on s.sku=p.sku and s.worker_id=w.id)
 ) order by w.slot),'[]'::jsonb) into rows_json from public.ludus_workers_v226 w where w.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('name',w.name) order by j.started_at desc,a.position),'[]'::jsonb)
 into assignments_json from ludus_worker_private.assignments_v227 a
 join public.ludus_workers_v226 w on w.id=a.worker_id join ludus_supply_private.jobs j on j.id=a.job_id
 where w.owner_id=u and (a.released_at is null or a.job_id in
  (select id from ludus_supply_private.jobs where owner_id=u and claimed_at is not null order by claimed_at desc limit 10));
 return jsonb_build_object('user_id',u,'workers',rows_json,'assignments',assignments_json,
  'professions',(select jsonb_agg(to_jsonb(p) order by p.sort_order) from ludus_worker_private.professions_v227 p),
  'level_thresholds',jsonb_build_array(0,60,180,360,600),'xp_per_unit',1,'caravan_level_cap',5);
end;
$$;

create function ludus_worker_private.depart_v227(p_action text,p_key text,p_workers integer,p_request uuid,
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
 insert into ludus_worker_private.assignments_v227(job_id,worker_id,sku,position)
 select jid,id,material,n::smallint from unnest(p_worker_ids) with ordinality as picked(id,n);
 insert into ludus_worker_private.receipts_v227(owner_id,request_id,payload,job_id) values(u,p_request,payload,jid);
 return s||jsonb_build_object('worker_roster',ludus_worker_private.roster_v226(),
  'result',answer||jsonb_build_object('message','İşçiler kervanla yola çıktı.','worker_ids',p_worker_ids));
end;
$$;
revoke all on function ludus_worker_private.depart_v227(text,text,integer,uuid,uuid[],integer,integer,uuid[]) from public,anon,authenticated;
grant execute on function ludus_worker_private.depart_v227(text,text,integer,uuid,uuid[],integer,integer,uuid[]) to authenticated;
create function public.ludus_worker_caravan_depart_v227(p_action text,p_key text,p_workers integer,p_request uuid,
 p_worker_ids uuid[],p_bows integer default 0,p_arrows integer default 0,p_escort uuid[] default '{}')
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_worker_private.depart_v227(p_action,p_key,p_workers,p_request,p_worker_ids,p_bows,p_arrows,p_escort);
$$;
revoke all on function public.ludus_worker_caravan_depart_v227(text,text,integer,uuid,uuid[],integer,integer,uuid[]) from public,anon;
grant execute on function public.ludus_worker_caravan_depart_v227(text,text,integer,uuid,uuid[],integer,integer,uuid[]) to authenticated;
