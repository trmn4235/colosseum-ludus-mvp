-- V232: shared imperial work sites, clan material receipts and weekly clan glory.
-- The initial rates are labelled test values and are changeable by an imperial admin.
create table ludus_worker_private.clan_work_config_v232 (
 id boolean primary key default true check(id), enabled boolean not null default false,
 duration_minutes integer not null default 60 check(duration_minutes between 1 and 10080),
 base_quantity integer not null default 1 check(base_quantity between 1 and 1000),
 experience integer not null default 20 check(experience between 0 and 1000),
 team_limit integer not null default 30 check(team_limit between 1 and 30)
);
insert into ludus_worker_private.clan_work_config_v232(id) values(true);

alter table ludus_worker_private.skills_v227 drop constraint skills_v227_xp_check;
alter table ludus_worker_private.skills_v227 add constraint skills_v227_xp_check check(xp between 0 and 2700);
create or replace function ludus_worker_private.level_v227(p_xp integer)
returns integer language sql immutable set search_path='' as $$
 select case when p_xp>=2700 then 10 when p_xp>=2160 then 9 when p_xp>=1680 then 8
  when p_xp>=1260 then 7 when p_xp>=900 then 6 when p_xp>=600 then 5
  when p_xp>=360 then 4 when p_xp>=180 then 3 when p_xp>=60 then 2 else 1 end;
$$;

create table ludus_worker_private.clan_work_jobs_v232 (
 id uuid primary key default gen_random_uuid(), clan_id uuid not null references public.ludus_clans(id) on delete cascade,
 started_by uuid not null, request_id uuid not null, payload jsonb not null,
 sku text not null references ludus_worker_private.professions_v227(sku),
 started_at timestamptz not null default clock_timestamp(), ends_at timestamptz not null,
 finished_at timestamptz, unique(started_by,request_id), check(ends_at>started_at)
);
create index clan_work_jobs_due_v232 on ludus_worker_private.clan_work_jobs_v232(ends_at) where finished_at is null;
create index clan_work_jobs_clan_v232 on ludus_worker_private.clan_work_jobs_v232(clan_id,ends_at desc);
create table ludus_worker_private.clan_work_people_v232 (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references ludus_worker_private.clan_work_jobs_v232(id) on delete cascade,
 worker_id uuid references public.ludus_workers_v226(id) on delete set null, worker_key uuid not null,
 owner_id uuid not null, worker_name text not null, ludus_name text not null,
 level integer not null check(level between 5 and 10), quantity integer not null check(quantity>0),
 experience integer not null check(experience>=0), completed_at timestamptz,
 unique(job_id,worker_key)
);
create unique index clan_one_work_v232 on ludus_worker_private.clan_work_people_v232(worker_id) where completed_at is null and worker_id is not null;
create index clan_work_person_history_v232 on ludus_worker_private.clan_work_people_v232(owner_id,completed_at desc);
create index clan_work_completed_v232 on ludus_worker_private.clan_work_people_v232(completed_at,job_id) where completed_at is not null;
create table ludus_worker_private.clan_material_stock_v232 (
 clan_id uuid not null references public.ludus_clans(id) on delete cascade,
 sku text not null references ludus_worker_private.professions_v227(sku),
 quantity bigint not null default 0 check(quantity>=0), primary key(clan_id,sku)
);
create table ludus_worker_private.clan_work_weeks_v232 (
 clan_id uuid not null references public.ludus_clans(id) on delete cascade,
 week_end timestamptz not null, closed_at timestamptz not null default clock_timestamp(),
 primary key(clan_id,week_end)
);
create table ludus_worker_private.clan_work_rewards_v232 (
 clan_id uuid not null, week_end timestamptz not null, owner_id uuid not null,
 rank integer not null check(rank between 1 and 10), quantity bigint not null check(quantity>0),
 glory_hundredths integer not null check(glory_hundredths>0),
 created_at timestamptz not null default clock_timestamp(),
 primary key(clan_id,week_end,owner_id), unique(clan_id,week_end,rank),
 foreign key(clan_id,week_end) references ludus_worker_private.clan_work_weeks_v232(clan_id,week_end) on delete cascade
);
create index clan_work_rewards_owner_v232 on ludus_worker_private.clan_work_rewards_v232(owner_id,week_end desc);
alter table ludus_worker_private.clan_work_config_v232 enable row level security;
alter table ludus_worker_private.clan_work_jobs_v232 enable row level security;
alter table ludus_worker_private.clan_work_people_v232 enable row level security;
alter table ludus_worker_private.clan_material_stock_v232 enable row level security;
alter table ludus_worker_private.clan_work_weeks_v232 enable row level security;
alter table ludus_worker_private.clan_work_rewards_v232 enable row level security;
revoke all on ludus_worker_private.clan_work_config_v232,ludus_worker_private.clan_work_jobs_v232,
 ludus_worker_private.clan_work_people_v232,ludus_worker_private.clan_material_stock_v232,
 ludus_worker_private.clan_work_weeks_v232,ludus_worker_private.clan_work_rewards_v232 from public,anon,authenticated;

-- Both reservation paths lock the same worker row before examining the other.
-- This prevents concurrent caravan and clan starts from reserving the same worker.
create function ludus_worker_private.guard_caravan_worker_v232() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.released_at is null then
  perform 1 from public.ludus_workers_v226 where id=new.worker_id for update;
  if exists(select 1 from ludus_worker_private.clan_work_people_v232 where worker_id=new.worker_id and completed_at is null) then
   raise exception 'Seçilen işçilerden biri klan çalışmasında.';
  end if;
 end if;
 return new;
end;$$;
create trigger guard_caravan_worker_v232 before insert or update of worker_id,released_at
 on ludus_worker_private.assignments_v227 for each row execute function ludus_worker_private.guard_caravan_worker_v232();
create function ludus_worker_private.guard_clan_worker_v232() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.worker_id is not null and new.completed_at is null then
  perform 1 from public.ludus_workers_v226 where id=new.worker_id for update;
  if exists(select 1 from ludus_worker_private.assignments_v227 where worker_id=new.worker_id and released_at is null) then
   raise exception 'Seçilen işçilerden biri kervanda.';
  end if;
 end if;
 return new;
end;$$;
create trigger guard_clan_worker_v232 before insert or update of worker_id,completed_at
 on ludus_worker_private.clan_work_people_v232 for each row execute function ludus_worker_private.guard_clan_worker_v232();

-- Weekly period closes on Sunday 23:59, Europe/Istanbul, independent of server TZ.
create function ludus_worker_private.week_end_v232(p_at timestamptz) returns timestamptz
language sql immutable set search_path='' as $$
 select (date_trunc('week',p_at at time zone 'Europe/Istanbul') + interval '6 days 23 hours 59 minutes'
  + case when (p_at at time zone 'Europe/Istanbul') >= date_trunc('week',p_at at time zone 'Europe/Istanbul') + interval '6 days 23 hours 59 minutes'
   then interval '7 days' else interval '0' end) at time zone 'Europe/Istanbul';
$$;

-- A single cron transaction settles due work first, then closes every overdue week.
-- Quantities and XP are frozen on departure; all writes and receipts commit together.
create function ludus_worker_private.clan_tick_v232(p_now timestamptz default clock_timestamp()) returns void
language plpgsql security definer set search_path='' as $$
declare job_row ludus_worker_private.clan_work_jobs_v232; person ludus_worker_private.clan_work_people_v232; wk record; r record;
 rewards integer[]:=array[50,46,42,38,36,32,28,24,22,18];
begin
 if not pg_try_advisory_xact_lock(2322026) then return; end if;
 for job_row in select * from ludus_worker_private.clan_work_jobs_v232 where finished_at is null and ends_at<=p_now order by ends_at,id for update loop
  for person in select * from ludus_worker_private.clan_work_people_v232 where job_id=job_row.id and completed_at is null order by worker_id for update loop
   insert into ludus_worker_private.clan_material_stock_v232(clan_id,sku,quantity) values(job_row.clan_id,job_row.sku,person.quantity)
    on conflict(clan_id,sku) do update set quantity=ludus_worker_private.clan_material_stock_v232.quantity+excluded.quantity;
   if person.worker_id is not null then
    update ludus_worker_private.skills_v227 set xp=least(2700,xp+person.experience) where worker_id=person.worker_id and sku=job_row.sku;
   end if;
   update ludus_worker_private.clan_work_people_v232 set completed_at=job_row.ends_at where id=person.id;
  end loop;
  update ludus_worker_private.clan_work_jobs_v232 set finished_at=job_row.ends_at where id=job_row.id;
 end loop;
 for wk in select distinct j.clan_id,ludus_worker_private.week_end_v232(p.completed_at) as week_end
  from ludus_worker_private.clan_work_people_v232 p join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id
  where p.completed_at is not null and ludus_worker_private.week_end_v232(p.completed_at)<=p_now
   and not exists(select 1 from ludus_worker_private.clan_work_weeks_v232 done
    where done.clan_id=j.clan_id and done.week_end=ludus_worker_private.week_end_v232(p.completed_at))
  order by 2,1 loop
  insert into ludus_worker_private.clan_work_weeks_v232(clan_id,week_end) values(wk.clan_id,wk.week_end) on conflict do nothing;
  if found then
   for r in select owner_id,total,row_number() over(order by total desc,first_done,owner_id)::integer as pos
    from (select p.owner_id,sum(p.quantity)::bigint total,min(p.completed_at) first_done
      from ludus_worker_private.clan_work_people_v232 p join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id
      where j.clan_id=wk.clan_id and p.completed_at>=wk.week_end-interval '7 days' and p.completed_at<wk.week_end
      group by p.owner_id) scored loop
    if r.pos<=10 then
     insert into ludus_worker_private.clan_work_rewards_v232(clan_id,week_end,owner_id,rank,quantity,glory_hundredths)
      values(wk.clan_id,wk.week_end,r.owner_id,r.pos,r.total,rewards[r.pos]);
     insert into ludus_message_private.notifications_v108(owner_id,event_key,kind,title,body,target,created_at)
      select r.owner_id,'clan-work:'||wk.clan_id||':'||extract(epoch from wk.week_end)::bigint,'guild','Haftalık klan çalışması ödülü',
       r.pos||'. sıra · +'||to_char(rewards[r.pos]/100.0,'FM0D00')||' klan şanı.','workers',p_now
      where exists(select 1 from public.ludus_accounts where user_id=r.owner_id) on conflict(owner_id,event_key) do nothing;
    end if;
   end loop;
  end if;
 end loop;
end;$$;

create function ludus_worker_private.clan_work_api_v232(p_action text default 'state',p_data jsonb default '{}'::jsonb,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; leader uuid; is_admin boolean; cfg ludus_worker_private.clan_work_config_v232;
 ids uuid[]; v_sku text; payload jsonb; old_job ludus_worker_private.clan_work_jobs_v232; jid uuid; now_at timestamptz:=clock_timestamp();
 current_end timestamptz; state jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Hesabına giriş yap.' using errcode='42501';end if;
 if not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Ludus bulunamadı.' using errcode='42501';end if;
 select m.clan_id,c.leader_id into cid,leader from public.ludus_clan_members m join public.ludus_clans c on c.id=m.clan_id where m.user_id=u;
 select exists(select 1 from public.ludus_imperial_admins where user_id=u) into is_admin;
 select * into cfg from ludus_worker_private.clan_work_config_v232 where id;
 if p_action='configure' then
  if not is_admin then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;
  update ludus_worker_private.clan_work_config_v232 set
   duration_minutes=coalesce((p_data->>'duration_minutes')::integer,duration_minutes),
   base_quantity=coalesce((p_data->>'base_quantity')::integer,base_quantity),
   experience=coalesce((p_data->>'experience')::integer,experience),
   team_limit=coalesce((p_data->>'team_limit')::integer,team_limit)
   where id returning * into cfg;
 elsif p_action='start' then
  perform 1 from public.ludus_accounts where user_id=u for update;
  select m.clan_id,c.leader_id into cid,leader from public.ludus_clan_members m join public.ludus_clans c on c.id=m.clan_id where m.user_id=u;
  now_at:=clock_timestamp();
  if cid is null or leader<>u then raise exception 'Klan lideri olmalısın.' using errcode='42501';end if;
  if not cfg.enabled then raise exception 'Klan çalışmaları henüz açılmadı.';end if;
  v_sku:=p_data->>'sku';
  if not exists(select 1 from ludus_worker_private.professions_v227 where professions_v227.sku=v_sku) then raise exception 'Çalışma malzemesi bulunamadı.';end if;
  if p_request is null or jsonb_typeof(p_data->'workers') is distinct from 'array' then raise exception 'İşçi seçimi bulunamadı.';end if;
  if jsonb_array_length(p_data->'workers') not between 1 and cfg.team_limit then raise exception 'Geçerli sayıda işçi seç.';end if;
  select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_data->'workers') x;
  if ids is null or cardinality(ids)>cfg.team_limit or cardinality(ids)<>(select count(distinct x) from unnest(ids)x) then raise exception 'Geçerli ve farklı işçiler seç.';end if;
  payload:=jsonb_build_object('sku',v_sku,'workers',to_jsonb(ids));
  select * into old_job from ludus_worker_private.clan_work_jobs_v232 where started_by=u and request_id=p_request;
  if found then
   if old_job.clan_id<>cid or old_job.payload<>payload then raise exception 'İşlem kimliği farklı bir çalışma için kullanılmış.';end if;
  else
   -- Lock in UUID order so two team selections cannot deadlock each other.
   perform 1 from public.ludus_workers_v226 w where w.id=any(ids) order by w.id for update;
   if (select count(*) from public.ludus_workers_v226 w join public.ludus_clan_members m on m.user_id=w.owner_id
       where w.id=any(ids) and m.clan_id=cid)<>cardinality(ids) then raise exception 'Bütün işçiler bu klanın üyelerine ait olmalı.';end if;
   if exists(select 1 from public.ludus_workers_v226 w left join ludus_worker_private.skills_v227 s on s.worker_id=w.id and s.sku=v_sku
       where w.id=any(ids) and ludus_worker_private.level_v227(coalesce(s.xp,0))<5) then raise exception 'Her işçi bu meslekte en az 5. seviyede olmalı.';end if;
   if exists(select 1 from ludus_worker_private.assignments_v227 a where a.worker_id=any(ids) and a.released_at is null)
     or exists(select 1 from ludus_worker_private.clan_work_people_v232 p where p.worker_id=any(ids) and p.completed_at is null) then
    raise exception 'Seçilen işçilerden biri başka bir görevde.';
   end if;
   insert into ludus_worker_private.clan_work_jobs_v232(clan_id,started_by,request_id,payload,sku,started_at,ends_at)
    values(cid,u,p_request,payload,v_sku,now_at,now_at+make_interval(mins=>cfg.duration_minutes)) returning id into jid;
   insert into ludus_worker_private.clan_work_people_v232(job_id,worker_id,worker_key,owner_id,worker_name,ludus_name,level,quantity,experience)
    select jid,w.id,w.id,w.owner_id,w.name,a.ludus_name,ludus_worker_private.level_v227(s.xp),
     cfg.base_quantity+(ludus_worker_private.level_v227(s.xp)-5)/2,cfg.experience
    from public.ludus_workers_v226 w join public.ludus_accounts a on a.user_id=w.owner_id
    join ludus_worker_private.skills_v227 s on s.worker_id=w.id and s.sku=v_sku
    where w.id=any(ids) order by w.id;
  end if;
 elsif p_action<>'state' then raise exception 'Bilinmeyen çalışma işlemi.';
 end if;
 current_end:=ludus_worker_private.week_end_v232(now_at);
 state:=jsonb_build_object('user_id',u,'clan_id',cid,'is_leader',leader=u,'is_admin',is_admin,'enabled',cfg.enabled,
  'server_now',now_at,'week_end',current_end,'config',jsonb_build_object('duration_minutes',cfg.duration_minutes,'base_quantity',cfg.base_quantity,'experience',cfg.experience,'team_limit',cfg.team_limit,'test_balance',true),
  'professions',(select jsonb_agg(to_jsonb(p) order by sort_order) from ludus_worker_private.professions_v227 p));
 if cid is null then return state||jsonb_build_object('message','Klan çalışmalarına katılmak için bir klana üye ol.');end if;
 return state||jsonb_build_object(
  'workers',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'owner_id',w.owner_id,'name',w.name,'ludus_name',a.ludus_name,
    'busy',exists(select 1 from ludus_worker_private.assignments_v227 t where t.worker_id=w.id and t.released_at is null) or exists(select 1 from ludus_worker_private.clan_work_people_v232 p where p.worker_id=w.id and p.completed_at is null),
    'skills',(select jsonb_object_agg(p.sku,ludus_worker_private.level_v227(coalesce(s.xp,0))) from ludus_worker_private.professions_v227 p left join ludus_worker_private.skills_v227 s on s.worker_id=w.id and s.sku=p.sku)) order by a.ludus_name,w.slot),'[]'::jsonb)
   from public.ludus_workers_v226 w join public.ludus_clan_members m on m.user_id=w.owner_id join public.ludus_accounts a on a.user_id=w.owner_id where m.clan_id=cid),
  'stock',(select coalesce(jsonb_object_agg(s.sku,s.quantity),'{}'::jsonb) from ludus_worker_private.clan_material_stock_v232 s where s.clan_id=cid),
  'jobs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.ends_at desc),'[]'::jsonb) from
   (select j.id,j.sku,j.started_at,j.ends_at,j.finished_at,count(p.id)::integer worker_count,sum(p.quantity)::bigint quantity,
     jsonb_agg(jsonb_build_object('worker_name',p.worker_name,'ludus_name',p.ludus_name,'quantity',p.quantity,'level',p.level) order by p.ludus_name,p.worker_name) participants
    from ludus_worker_private.clan_work_jobs_v232 j join ludus_worker_private.clan_work_people_v232 p on p.job_id=j.id
    where j.clan_id=cid group by j.id order by j.ends_at desc limit 30)x),
  'ranking',(select coalesce(jsonb_agg(to_jsonb(x) order by x.quantity desc,x.first_done,x.owner_id),'[]'::jsonb) from
   (select p.owner_id,max(p.ludus_name) ludus_name,sum(p.quantity)::bigint quantity,min(p.completed_at) first_done
    from ludus_worker_private.clan_work_people_v232 p join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id
    where j.clan_id=cid and p.completed_at>=current_end-interval '7 days' and p.completed_at<current_end group by p.owner_id)x),
  'worker_ranking',(select coalesce(jsonb_agg(to_jsonb(x) order by x.quantity desc,x.ludus_name,x.worker_name),'[]'::jsonb) from
   (select p.worker_key worker_id,p.owner_id,max(p.worker_name) worker_name,max(p.ludus_name) ludus_name,j.sku,sum(p.quantity)::bigint quantity
    from ludus_worker_private.clan_work_people_v232 p join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id
    where j.clan_id=cid and p.completed_at>=current_end-interval '7 days' and p.completed_at<current_end
    group by p.worker_key,p.owner_id,j.sku)x),
  'rewards',(select coalesce(jsonb_agg(to_jsonb(x) order by x.week_end desc,x.rank),'[]'::jsonb) from
   (select r.week_end,r.rank,r.owner_id,coalesce(a.ludus_name,'Ludus') ludus_name,r.quantity,r.glory_hundredths
    from ludus_worker_private.clan_work_rewards_v232 r left join public.ludus_accounts a on a.user_id=r.owner_id
    where r.clan_id=cid order by r.week_end desc,r.rank limit 30)x),
  'clan_glory',((select coalesce(sum(units),0)*10 from ludus_worker_private.clan_glory_v231 where clan_id=cid)+(select coalesce(sum(glory_hundredths),0) from ludus_worker_private.clan_work_rewards_v232 where clan_id=cid))/100.0,
  'my_glory',((select coalesce(sum(units),0)*10 from ludus_worker_private.clan_glory_v231 where clan_id=cid and owner_id=u)+(select coalesce(sum(glory_hundredths),0) from ludus_worker_private.clan_work_rewards_v232 where clan_id=cid and owner_id=u))/100.0
 );
end;$$;
revoke all on function ludus_worker_private.guard_caravan_worker_v232(),ludus_worker_private.guard_clan_worker_v232(),
 ludus_worker_private.week_end_v232(timestamptz),ludus_worker_private.clan_tick_v232(timestamptz),
 ludus_worker_private.clan_work_api_v232(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function ludus_worker_private.clan_work_api_v232(text,jsonb,uuid) to authenticated;
create function public.ludus_clan_work_v232(p_action text default 'state',p_data jsonb default '{}'::jsonb,p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select ludus_worker_private.clan_work_api_v232(p_action,p_data,p_request) $$;
revoke all on function public.ludus_clan_work_v232(text,jsonb,uuid) from public,anon;
grant execute on function public.ludus_clan_work_v232(text,jsonb,uuid) to authenticated;

-- Preserve the existing roster RPC while exposing active clan work as busy.
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
  'job_id',coalesce((select a.job_id from ludus_worker_private.assignments_v227 a where a.worker_id=w.id and a.released_at is null),
   (select p.job_id from ludus_worker_private.clan_work_people_v232 p where p.worker_id=w.id and p.completed_at is null)),
  'job',coalesce((select jsonb_build_object('id',j.id,'destination',j.destination,
    'destination_name',coalesce(c.name,j.destination),'started_at',j.started_at,'ends_at',j.ends_at,
    'cargo',j.cargo,'worker_defense',j.worker_defense)
   from ludus_worker_private.assignments_v227 a join ludus_supply_private.jobs j on j.id=a.job_id
   left join ludus_supply_private.cities_v116 c on j.destination='city-'||c.id
   where a.worker_id=w.id and a.released_at is null),
   (select jsonb_build_object('id',j.id,'kind','clan','started_at',j.started_at,'ends_at',j.ends_at,
     'cargo',jsonb_build_object(j.sku,p.quantity)) from ludus_worker_private.clan_work_people_v232 p
    join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id where p.worker_id=w.id and p.completed_at is null)),
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
  'level_thresholds',jsonb_build_array(0,60,180,360,600,900,1260,1680,2160,2700),'xp_per_unit',1,'caravan_level_cap',5);
end;
$$;

-- PGlite tests omit pg_cron; production schedules the same private function.
do $$ begin
 if exists(select 1 from pg_namespace where nspname='cron') then
  perform cron.schedule('ludus-clan-work-v232','* * * * *','select ludus_worker_private.clan_tick_v232(clock_timestamp())');
 end if;
end $$;
