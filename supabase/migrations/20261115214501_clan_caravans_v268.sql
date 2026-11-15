-- V268: owner-created caravans, self-owned worker contributions and ten seats.
-- Existing V255 deliveries, taxes, weekly awards and reservations remain authoritative.
create table ludus_worker_private.caravan_lobbies_v268 (
 job_id uuid primary key references ludus_worker_private.clan_work_jobs_v232(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 launched_at timestamptz, cancelled_at timestamptz
);
create index caravan_lobbies_waiting_v268 on ludus_worker_private.caravan_lobbies_v268(created_at)
 where launched_at is null and cancelled_at is null;
create table ludus_worker_private.caravan_requests_v268 (
 owner_id uuid not null,request_id uuid not null,action text not null,payload jsonb not null,
 job_id uuid not null references ludus_worker_private.clan_work_jobs_v232(id),primary key(owner_id,request_id)
);
create table ludus_worker_private.roman_names_v268 (
 name text primary key,gender text not null check(gender in ('female','male'))
);
insert into ludus_worker_private.roman_names_v268(name,gender)
 select unnest(array['Marcus','Lucius','Gaius','Publius','Quintus','Titus','Tiberius','Aulus','Sextus','Decimus',
 'Gnaeus','Servius','Manius','Appius','Numerius','Spurius','Kaeso','Mamercus','Vibius','Paullus','Agrippa','Cato','Felix','Rufus','Crispus']),'male'
 union all select unnest(array['Julia','Livia','Claudia','Cornelia','Aurelia','Valeria','Flavia','Octavia','Antonia','Marcia',
 'Tullia','Aemilia','Fabia','Fulvia','Servilia','Calpurnia','Porcia','Sulpicia','Terentia','Licinia','Domitia','Pomponia','Caecilia','Lucretia','Vipsania']),'female';
alter table ludus_worker_private.caravan_lobbies_v268 enable row level security;
alter table ludus_worker_private.caravan_requests_v268 enable row level security;
alter table ludus_worker_private.roman_names_v268 enable row level security;
revoke all on ludus_worker_private.caravan_lobbies_v268,ludus_worker_private.caravan_requests_v268,
 ludus_worker_private.roman_names_v268 from public,anon,authenticated;
alter table ludus_worker_private.clan_work_people_v232 drop constraint clan_work_people_v232_level_check;
alter table ludus_worker_private.clan_work_people_v232 add constraint clan_work_people_v232_level_check check(level between 1 and 10);
alter table ludus_worker_private.clan_work_jobs_v232 drop constraint clan_work_jobs_v232_rules_version_check;
alter table ludus_worker_private.clan_work_jobs_v232 add constraint clan_work_jobs_v232_rules_version_check check(rules_version in (232,255,268));

create function ludus_worker_private.bot_worker_name_v268() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from ludus_bot_private.members_v233 where user_id=new.owner_id) then
  select n.name into new.name from ludus_worker_private.roman_names_v268 n
   where n.gender=case when new.slot%2=0 then 'female' else 'male' end
   order by md5(new.owner_id::text||n.name) offset ((new.slot-1)/2) limit 1;
 end if;
 return new;
end;$$;
revoke all on function ludus_worker_private.bot_worker_name_v268() from public,anon,authenticated;
create trigger bot_worker_name_v268 before insert on public.ludus_workers_v226
 for each row execute function ludus_worker_private.bot_worker_name_v268();
-- The 39 existing bot accounts receive the same eight persistent worker slots as humans.
insert into public.ludus_workers_v226(owner_id,slot,name,portrait)
 select b.user_id,n,'İşçi '||n,n-1 from ludus_bot_private.members_v233 b
 join public.ludus_accounts a on a.user_id=b.user_id cross join generate_series(1,8)n
 on conflict(owner_id,slot) do nothing;
update public.ludus_workers_v226 w set name=(select n.name from ludus_worker_private.roman_names_v268 n
 where n.gender=case when w.slot%2=0 then 'female' else 'male' end
 order by md5(w.owner_id::text||n.name) offset ((w.slot-1)/2) limit 1)
 where exists(select 1 from ludus_bot_private.members_v233 b where b.user_id=w.owner_id);

create function ludus_worker_private.caravan_add_v268(p_job uuid,p_owner uuid,p_ids uuid[]) returns void
language plpgsql set search_path='' as $$
declare j ludus_worker_private.clan_work_jobs_v232;wid uuid;w public.ludus_workers_v226;lv integer;y jsonb;
begin
 select * into strict j from ludus_worker_private.clan_work_jobs_v232 where id=p_job for update;
 if not exists(select 1 from ludus_worker_private.caravan_lobbies_v268 where job_id=p_job and launched_at is null and cancelled_at is null) then
  raise exception 'Bu kervan artık işçi kabul etmiyor.';end if;
 if p_ids is null or cardinality(p_ids)<1 or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids)x) then
  raise exception 'Farklı işçiler seç.';end if;
 if (select count(*) from ludus_worker_private.clan_work_people_v232 where job_id=p_job)+cardinality(p_ids)>10 then
  raise exception 'Kervanda en fazla 10 işçi olabilir.';end if;
 perform 1 from public.ludus_clan_members where user_id=p_owner and clan_id=j.clan_id for share;
 if not found then raise exception 'Bu klana üye olmalısın.' using errcode='42501';end if;
 for wid in select x from unnest(p_ids)x order by x loop
  select * into w from public.ludus_workers_v226 where id=wid for update;
  if not found or w.owner_id<>p_owner then raise exception 'Yalnızca kendi işçini ekleyebilirsin.' using errcode='42501';end if;
  if exists(select 1 from ludus_worker_private.clan_work_people_v232 where worker_id=wid and completed_at is null)
   or exists(select 1 from ludus_worker_private.assignments_v227 where worker_id=wid and released_at is null) then
   raise exception 'İşçi başka bir görevde.';end if;
  insert into ludus_worker_private.skills_v227(worker_id,sku,xp) values(wid,j.sku,0) on conflict do nothing;
  select ludus_worker_private.level_v227(xp) into lv from ludus_worker_private.skills_v227 where worker_id=wid and sku=j.sku;
  -- New workers may join; the established minimum yield is eight net units.
  y:=ludus_worker_private.license_yield_v255(greatest(5,lv));
  insert into ludus_worker_private.clan_work_people_v232(job_id,worker_id,worker_key,owner_id,worker_name,ludus_name,level,quantity,experience,gross_quantity,tax_quantity)
   select p_job,wid,wid,p_owner,w.name,a.ludus_name,lv,(y->>'net')::integer,60,(y->>'gross')::integer,(y->>'tax')::integer
   from public.ludus_accounts a where a.user_id=p_owner;
 end loop;
end;$$;
revoke all on function ludus_worker_private.caravan_add_v268(uuid,uuid,uuid[]) from public,anon,authenticated;

create function ludus_worker_private.caravan_launch_v268(p_job uuid,p_now timestamptz) returns void
language plpgsql set search_path='' as $$
begin
 perform 1 from ludus_worker_private.clan_work_jobs_v232 where id=p_job for update;
 if (select count(*) from ludus_worker_private.clan_work_people_v232 where job_id=p_job)<>10 then return;end if;
 update ludus_worker_private.caravan_lobbies_v268 set launched_at=p_now
  where job_id=p_job and launched_at is null and cancelled_at is null;
 if not found then return;end if;
 update ludus_worker_private.clan_work_jobs_v232 set rules_version=255,started_at=p_now,ends_at=p_now+interval '6 hours' where id=p_job;
end;$$;
revoke all on function ludus_worker_private.caravan_launch_v268(uuid,timestamptz) from public,anon,authenticated;

create function ludus_worker_private.caravan_fill_v268(p_now timestamptz default clock_timestamp()) returns void
language plpgsql security definer set search_path='' as $$
declare j record;w record;wanted integer;present integer;
begin
 if not pg_try_advisory_xact_lock(2682026) then return;end if;
 for j in select jobs.id,jobs.clan_id,l.created_at from ludus_worker_private.caravan_lobbies_v268 l
  join ludus_worker_private.clan_work_jobs_v232 jobs on jobs.id=l.job_id
  where l.launched_at is null and l.cancelled_at is null order by l.created_at,jobs.id for update of jobs skip locked loop
  wanted:=least(10,greatest(0,floor(extract(epoch from(p_now-j.created_at))*10/8)::integer));
  select count(*) into present from ludus_worker_private.clan_work_people_v232 where job_id=j.id;
  while present<wanted loop
   select wk.id,wk.owner_id into w from public.ludus_workers_v226 wk
    join ludus_bot_private.members_v233 b on b.user_id=wk.owner_id and b.enabled
    join public.ludus_clan_members m on m.user_id=wk.owner_id and m.clan_id=j.clan_id
    where not exists(select 1 from ludus_worker_private.assignments_v227 a where a.worker_id=wk.id and a.released_at is null)
     and not exists(select 1 from ludus_worker_private.clan_work_people_v232 p where p.worker_id=wk.id and p.completed_at is null)
    order by (select count(*) from ludus_worker_private.clan_work_people_v232 p where p.job_id=j.id and p.owner_id=wk.owner_id),
     md5(j.id::text||wk.owner_id::text),wk.slot for update of wk skip locked limit 1;
   if not found then exit;end if;
   perform ludus_worker_private.caravan_add_v268(j.id,w.owner_id,array[w.id]);
   present:=present+1;
  end loop;
  perform ludus_worker_private.caravan_launch_v268(j.id,p_now);
 end loop;
end;$$;
revoke all on function ludus_worker_private.caravan_fill_v268(timestamptz) from public,anon,authenticated;

-- The existing minute scheduler also catches up pending departures after downtime.
alter function ludus_worker_private.clan_tick_v232(timestamptz) rename to clan_tick_before_caravans_v268;
create function ludus_worker_private.clan_tick_v232(p_now timestamptz default clock_timestamp()) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform ludus_worker_private.caravan_fill_v268(p_now);
 perform ludus_worker_private.clan_tick_before_caravans_v268(p_now);
end;$$;
revoke all on function ludus_worker_private.clan_tick_before_caravans_v268(timestamptz),
 ludus_worker_private.clan_tick_v232(timestamptz) from public,anon,authenticated;

create function ludus_worker_private.caravan_rank_v268(p_clan uuid,p_workers boolean,p_since timestamptz default '-infinity') returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.quantity desc,r.name,r.id),'[]') from (
  select case when p_workers then p.worker_key else p.owner_id end id,
   max(case when p_workers then coalesce(w.name,p.worker_name) else coalesce(a.ludus_name,p.ludus_name) end) name,
   max(coalesce(a.ludus_name,p.ludus_name)) ludus_name,
   sum(p.quantity)::bigint quantity,sum(case when p.gross_quantity>0 then p.gross_quantity else p.quantity end)::bigint gross_quantity,sum(p.tax_quantity)::bigint tax_quantity,
   count(distinct p.job_id)::integer trips
  from ludus_worker_private.clan_work_people_v232 p join ludus_worker_private.clan_work_jobs_v232 j on j.id=p.job_id
  left join public.ludus_workers_v226 w on w.id=p.worker_id left join public.ludus_accounts a on a.user_id=p.owner_id
  where j.clan_id=p_clan and p.completed_at is not null and p.completed_at>=p_since
  group by case when p_workers then p.worker_key else p.owner_id end
 )r;
$$;
revoke all on function ludus_worker_private.caravan_rank_v268(uuid,boolean,timestamptz) from public,anon,authenticated;

alter function ludus_worker_private.clan_work_api_v232(text,jsonb,uuid) rename to clan_work_before_caravans_v268;
revoke all on function ludus_worker_private.clan_work_before_caravans_v268(text,jsonb,uuid) from public,anon,authenticated;
create function ludus_worker_private.clan_work_api_v232(p_action text default 'state',p_data jsonb default '{}',p_request uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();cid uuid;leader uuid;jid uuid;wid uuid;v_sku text;ids uuid[];payload jsonb;
 prior ludus_worker_private.caravan_requests_v268;job_row ludus_worker_private.clan_work_jobs_v232;
 now_at timestamptz:=clock_timestamp();answer jsonb;week_start timestamptz;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Hesabına giriş yap.' using errcode='42501';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 select m.clan_id,c.leader_id into cid,leader from public.ludus_clan_members m join public.ludus_clans c on c.id=m.clan_id where m.user_id=u;
 if p_action not in ('state','create','join','leave','cancel') then raise exception 'Kervan oluştur veya kendi işçinle katıl.';end if;
 if p_action<>'state' then
  if cid is null then raise exception 'Klana üye olmalısın.' using errcode='42501';end if;
  if p_request is null then raise exception 'İşlem kimliği gerekli.';end if;
  if not coalesce((select enabled from ludus_worker_private.clan_work_config_v232 where id),false) then raise exception 'Toplama henüz açılmadı.';end if;
  payload:=coalesce(p_data,'{}');
  select * into prior from ludus_worker_private.caravan_requests_v268 where owner_id=u and request_id=p_request;
  if found then
   if prior.action<>p_action or prior.payload<>payload then raise exception 'İşlem kimliği farklı bir istek için kullanılmış.';end if;
   jid:=prior.job_id;
  else
   if p_action='create' then
    if leader is distinct from u then raise exception 'Kervanı klan lideri açabilir.' using errcode='42501';end if;
    v_sku:=p_data->>'sku';
    if not exists(select 1 from ludus_worker_private.professions_v227 where sku=v_sku) then raise exception 'Toplama yeri bulunamadı.';end if;
    insert into ludus_worker_private.clan_work_jobs_v232(clan_id,started_by,request_id,payload,sku,started_at,ends_at,rules_version)
     values(cid,u,p_request,payload,v_sku,now_at,now_at+interval '6 hours',268) returning id into jid;
    insert into ludus_worker_private.caravan_lobbies_v268(job_id,created_at) values(jid,now_at);
   else
    jid:=(p_data->>'job_id')::uuid;
    select * into job_row from ludus_worker_private.clan_work_jobs_v232 where id=jid for update;
    if not found or job_row.clan_id<>cid then raise exception 'Kervan bu klana ait değil.' using errcode='42501';end if;
    if not exists(select 1 from ludus_worker_private.caravan_lobbies_v268 where job_id=jid and launched_at is null and cancelled_at is null) then
     raise exception 'Kervan yola çıktı; ekip değiştirilemez.';end if;
   end if;
   if p_action in ('create','join') and (p_action='join' or p_data ? 'workers') then
    if jsonb_typeof(p_data->'workers') is distinct from 'array' then raise exception 'İşçilerini seç.';end if;
    select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_data->'workers')x;
    if p_action='join' or cardinality(ids)>0 then perform ludus_worker_private.caravan_add_v268(jid,u,ids);end if;
    perform ludus_worker_private.caravan_launch_v268(jid,now_at);
   elsif p_action='leave' then
    wid:=(p_data->>'worker_id')::uuid;
    if exists(select 1 from ludus_worker_private.clan_work_people_v232 where job_id=jid and worker_key=wid and owner_id<>u) then
     raise exception 'Yalnızca kendi işçini çıkarabilirsin.' using errcode='42501';end if;
    delete from ludus_worker_private.clan_work_people_v232 where job_id=jid and worker_key=wid and owner_id=u;
   elsif p_action='cancel' then
    if job_row.started_by<>u then raise exception 'Kervanı yalnız sahibi iptal edebilir.' using errcode='42501';end if;
    delete from ludus_worker_private.clan_work_people_v232 where job_id=jid;
    update ludus_worker_private.caravan_lobbies_v268 set cancelled_at=now_at where job_id=jid;
    update ludus_worker_private.clan_work_jobs_v232 set finished_at=now_at where id=jid;
   end if;
   insert into ludus_worker_private.caravan_requests_v268(owner_id,request_id,action,payload,job_id) values(u,p_request,p_action,payload,jid);
  end if;
 end if;
 -- Read/settlement reuses the existing ownership, pantry and warehouse guarantees.
 perform ludus_worker_private.caravan_fill_v268(now_at);
 answer:=ludus_worker_private.clan_work_before_caravans_v268('state','{}',null);
 week_start:=ludus_worker_private.week_end_v232(now_at)-interval '7 days';
 return answer||jsonb_build_object('rules_version',268,'server_now',now_at,'result_job_id',jid,
  'config',(answer->'config')||jsonb_build_object('team_limit',10,'min_level',1,'bot_fill_seconds',10),
  'workers',(select coalesce(jsonb_agg(w),'[]') from jsonb_array_elements(coalesce(answer->'workers','[]'))w where w->>'owner_id'=u::text),
  'jobs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (
   select j.id,j.sku,j.started_by owner_id,a.ludus_name owner_name,coalesce(l.created_at,j.started_at) created_at,
    j.started_at,j.ends_at,j.finished_at,l.launched_at,
    case when j.finished_at is not null then 'completed' when l.job_id is not null and l.launched_at is null then 'forming' else 'collecting' end status,
    (select count(*) from ludus_worker_private.clan_work_people_v232 p where p.job_id=j.id)::integer worker_count,
    (select coalesce(jsonb_agg(jsonb_build_object('worker_id',p.worker_key,'owner_id',p.owner_id,'worker_name',p.worker_name,'ludus_name',p.ludus_name,
      'level',p.level,'portrait',coalesce(w.portrait,0),'quantity',p.quantity,'gross_quantity',p.gross_quantity,'tax_quantity',p.tax_quantity,
      'collected',case when j.finished_at is not null then p.gross_quantity when l.job_id is not null and l.launched_at is null then 0
       else floor(p.gross_quantity*greatest(0,least(1,extract(epoch from(now_at-j.started_at))/extract(epoch from(j.ends_at-j.started_at)))))::integer end,
      'delivered',p.delivered_at is not null,'pending',p.completed_at is not null and p.delivered_at is null)
      order by p.ludus_name,p.worker_name),'[]') from ludus_worker_private.clan_work_people_v232 p
      left join public.ludus_workers_v226 w on w.id=p.worker_id where p.job_id=j.id) participants
   from ludus_worker_private.clan_work_jobs_v232 j left join ludus_worker_private.caravan_lobbies_v268 l on l.job_id=j.id
   left join public.ludus_accounts a on a.user_id=j.started_by where j.clan_id=cid and l.cancelled_at is null
   order by (j.finished_at is null) desc,coalesce(l.created_at,j.started_at) desc limit 100)x),
  'rankings',jsonb_build_object('workers',ludus_worker_private.caravan_rank_v268(cid,true),
   'ludus',ludus_worker_private.caravan_rank_v268(cid,false),'weekly_workers',ludus_worker_private.caravan_rank_v268(cid,true,week_start),
   'weekly_ludus',ludus_worker_private.caravan_rank_v268(cid,false,week_start)));
end;$$;
revoke all on function ludus_worker_private.clan_work_api_v232(text,jsonb,uuid) from public,anon;
grant execute on function ludus_worker_private.clan_work_api_v232(text,jsonb,uuid) to authenticated;

-- Background filling continues when the preparing page is closed. Target 8s
-- leaves one scheduler interval within the requested ten-second fill window.
do $$begin
 if exists(select 1 from pg_namespace where nspname='cron') then
  perform cron.schedule('ludus-caravan-fill-v268','2 seconds','select ludus_worker_private.caravan_fill_v268(clock_timestamp())');
  perform cron.schedule('ludus-caravan-log-cleanup-v268','17 3 * * *',
   $cron$delete from cron.job_run_details where jobid in(select jobid from cron.job where jobname='ludus-caravan-fill-v268') and end_time<clock_timestamp()-interval '2 days'$cron$);
 end if;
end$$;
notify pgrst,'reload schema';
