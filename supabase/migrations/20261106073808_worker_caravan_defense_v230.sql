-- V230: owned caravan ambushes, shuffled two-in-five departures and verified rescue.
create table ludus_worker_private.defense_config_v230 (
 id boolean primary key default true check(id), enabled boolean not null default false
);
insert into ludus_worker_private.defense_config_v230 values(true,false);
create table ludus_worker_private.defense_counter_v230 (
 owner_id uuid primary key references public.ludus_accounts(user_id) on delete cascade,
 departures bigint not null default 0 check(departures>=0), bag boolean[] not null default '{}'
);
create table ludus_worker_private.defenses_v230 (
 id uuid primary key references ludus_supply_private.jobs(id) on delete cascade,
 owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 departure bigint not null, starts_at timestamptz not null, deadline timestamptz not null,
 status text not null default 'ready' check(status in ('ready','fighting','resolved')),
 encounter jsonb not null, team jsonb not null default '[]', workers jsonb not null,
 original_cargo jsonb not null, battle_started_at timestamptz, resolved_at timestamptz,
 success boolean, automatic boolean not null default false, lost_cargo jsonb not null default '{}',
 unique(owner_id,departure),check(deadline>starts_at)
);
create index defense_due_v230 on ludus_worker_private.defenses_v230(owner_id,deadline) where status<>'resolved';
alter table ludus_worker_private.defense_config_v230 enable row level security;
alter table ludus_worker_private.defense_counter_v230 enable row level security;
alter table ludus_worker_private.defenses_v230 enable row level security;
revoke all on ludus_worker_private.defense_config_v230,ludus_worker_private.defense_counter_v230,ludus_worker_private.defenses_v230 from public,anon,authenticated;

create function ludus_worker_private.schedule_defense_v230()
returns trigger language plpgsql set search_path='' as $$
declare c ludus_worker_private.defense_counter_v230; guards integer;
begin
 if not (select enabled from ludus_worker_private.defense_config_v230 where id) or
  jsonb_array_length(new.worker_defense)=0 or jsonb_array_length(old.worker_defense)>0 or new.claimed_at is not null then return new; end if;
 -- The departure transaction already holds the account lock. Failed/replayed
 -- purchases cannot consume another slot and existing trips are never attacked.
 insert into ludus_worker_private.defense_counter_v230(owner_id) values(new.owner_id) on conflict do nothing;
 select * into c from ludus_worker_private.defense_counter_v230 where owner_id=new.owner_id for update;
 if c.departures%5=0 then select array_agg(n<=2 order by random()) into c.bag from generate_series(1,5)n; end if;
 update ludus_worker_private.defense_counter_v230 set departures=c.departures+1,bag=c.bag where owner_id=new.owner_id;
 if c.bag[1+(c.departures%5)::integer] then
  guards:=greatest(2,jsonb_array_length(new.escort_team)+1);
  insert into ludus_worker_private.defenses_v230(id,owner_id,departure,starts_at,deadline,encounter,workers,original_cargo)
  values(new.id,new.owner_id,c.departures+1,new.started_at+least(interval '1 minute',(new.ends_at-new.started_at)/4),new.ends_at,
   jsonb_build_object('version',230,'rules',230,'seed',1+floor(random()*2147483646)::integer,'guards',guards),new.worker_defense,new.cargo);
 end if;
 return new;
end;$$;
revoke all on function ludus_worker_private.schedule_defense_v230() from public,anon,authenticated;
create trigger worker_defense_schedule_v230 after update of worker_defense on ludus_supply_private.jobs
 for each row execute function ludus_worker_private.schedule_defense_v230();

create function ludus_worker_private.resolve_defense_v230(p_owner uuid,p_id uuid,p_won boolean,p_automatic boolean default false,p_seconds numeric default 0,p_arrows_used integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d ludus_worker_private.defenses_v230;j ludus_supply_private.jobs;lost jsonb;available_arrows integer;used_arrows integer;
begin
 if p_won is null then raise exception 'Savunma sonucu gerekli.';end if;
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 select * into j from ludus_supply_private.jobs where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Kervan bulunamadı.';end if;
 select * into d from ludus_worker_private.defenses_v230 where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Savunma bulunamadı.';end if;
 if d.status='resolved' then return to_jsonb(d);end if;
 if not p_automatic and d.battle_started_at is null then raise exception 'Önce savunmaya katıl.';end if;
 if j.claimed_at is not null then raise exception 'Kervan zaten teslim edildi.';end if;
 if not p_automatic and (p_seconds is null or p_seconds<0 or p_seconds>300 or p_seconds>extract(epoch from clock_timestamp()-d.battle_started_at)+3) then raise exception 'Savaş süresi doğrulanamadı.';end if;
 select coalesce(sum((w->>'arrows')::integer),0),coalesce(sum(least(6,(w->>'arrows')::integer)),0) into available_arrows,used_arrows from jsonb_array_elements(d.workers)w;
 if not p_automatic then used_arrows:=p_arrows_used;end if;
 if used_arrows is null or used_arrows<0 or used_arrows>available_arrows then raise exception 'Ok sayısı doğrulanamadı.';end if;
 update ludus_supply_private.jobs set loadout=jsonb_set(loadout,'{arrow}',to_jsonb(greatest(0,coalesce((loadout->>'arrow')::integer,0)-used_arrows))) where id=p_id;
 select coalesce(jsonb_object_agg(key,case when p_won then 0 else (value::bigint/2) end),'{}') into lost from jsonb_each_text(d.original_cargo);
 if not p_won then
  update ludus_supply_private.jobs set cargo=(select jsonb_object_agg(key,value::bigint-coalesce((lost->>key)::bigint,0)) from jsonb_each_text(d.original_cargo)) where id=p_id;
 end if;
 -- Workers survive. Only the verified cargo outcome changes; ordinary delivery
 -- grants profession/archery EXP once, based on the actual returned cargo.
 update ludus_worker_private.defenses_v230 set status='resolved',success=p_won,automatic=p_automatic,resolved_at=clock_timestamp(),lost_cargo=lost where id=p_id returning * into d;
 return to_jsonb(d);
end;$$;
revoke all on function ludus_worker_private.resolve_defense_v230(uuid,uuid,boolean,boolean,numeric,integer) from public,anon,authenticated;

create function ludus_worker_private.settle_defenses_v230(p_owner uuid,p_until timestamptz)
returns void language plpgsql set search_path='' as $$
declare d ludus_worker_private.defenses_v230; power bigint;
begin
 for d in select * from ludus_worker_private.defenses_v230 where owner_id=p_owner and status<>'resolved' and deadline<=p_until order by deadline,id loop
  select coalesce(sum(case when (w->>'armed')::boolean then (w->>'base_damage')::integer*least(6,(w->>'arrows')::integer) else 0 end),0)
   into power from jsonb_array_elements(d.workers)w;
  power:=power+80*(select jsonb_array_length(escort_team) from ludus_supply_private.jobs where id=d.id);
  perform ludus_worker_private.resolve_defense_v230(p_owner,d.id,d.status='ready' and power>=120*(d.encounter->>'guards')::integer,true);
 end loop;
end;$$;
revoke all on function ludus_worker_private.settle_defenses_v230(uuid,timestamptz) from public,anon,authenticated;

create function ludus_worker_private.defense_api_v230(p_action text default 'state',p_id uuid default null,p_gladiator uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();d ludus_worker_private.defenses_v230;j ludus_supply_private.jobs;f jsonb;team_json jsonb;answer jsonb;rows_json jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Hesabına giriş yap.' using errcode='42501';end if;
 if p_action is null or p_action not in ('state','enter') then raise exception 'Geçersiz savunma işlemi.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.' using errcode='42501';end if;
 perform ludus_supply_private.settle_owner_v87(u,clock_timestamp());
 if p_action='enter' then
  select * into j from ludus_supply_private.jobs where id=p_id and owner_id=u for update;
  if not found then raise exception 'Bu hesaba ait kervan bulunamadı.' using errcode='42501';end if;
  select * into d from ludus_worker_private.defenses_v230 where id=p_id and owner_id=u for update;
  if not found or d.starts_at>clock_timestamp() then raise exception 'Aktif kervan saldırısı bulunamadı.';end if;
  if d.status='ready' then
   if jsonb_array_length(j.escort_team)>0 then
    select value into f from jsonb_array_elements(j.escort_team) where (value->>'id')::uuid=coalesce(p_gladiator,(j.escort_team->0->>'id')::uuid);
    if f is null then raise exception 'Kervandaki savunmacılardan birini seç.';end if;
    select jsonb_agg(value order by (value->>'id'=f->>'id') desc,ordinality) into team_json from jsonb_array_elements(j.escort_team) with ordinality;
   else
    select value into f from jsonb_array_elements(ludus_supply_private.fighters_v126()) where (value->>'ready')::boolean and (p_gladiator is null or (value->>'id')::uuid=p_gladiator) limit 1;
    if f is null then raise exception 'Savunma için hazır bir gladyatör gerekli.';end if;
    team_json:=jsonb_build_array(f);
    update public.ludus_gladiators set status='locked' where id=(f->>'id')::uuid and owner_id=u;
    insert into ludus_supply_private.escort_members_v126(gladiator_id,job_id) values((f->>'id')::uuid,j.id);
    update ludus_supply_private.jobs set escort=array[(f->>'id')::uuid],escort_team=team_json where id=j.id;
   end if;
   update ludus_worker_private.defenses_v230 set status='fighting',team=team_json,battle_started_at=clock_timestamp(),deadline=greatest(deadline,clock_timestamp()+interval '10 minutes') where id=d.id returning * into d;
  end if;
  answer:=to_jsonb(d);
 end if;
 select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('cargo',job_row.cargo,'destination',job_row.destination,'escort_team',job_row.escort_team) order by x.starts_at desc),'[]') into rows_json
 from (select * from ludus_worker_private.defenses_v230 where owner_id=u and starts_at<=clock_timestamp() order by starts_at desc limit 20)x join ludus_supply_private.jobs job_row on job_row.id=x.id;
 return jsonb_build_object('user_id',u,'version',230,'enabled',(select enabled from ludus_worker_private.defense_config_v230 where id),'server_now',clock_timestamp(),
  'encounters',rows_json,'gladiators',ludus_supply_private.fighters_v126(),'result',answer);
end;$$;
revoke all on function ludus_worker_private.defense_api_v230(text,uuid,uuid) from public,anon;
grant execute on function ludus_worker_private.defense_api_v230(text,uuid,uuid) to authenticated;
create function public.ludus_caravan_defense_v230(p_action text default 'state',p_id uuid default null,p_gladiator uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select ludus_worker_private.defense_api_v230(p_action,p_id,p_gladiator);$$;
revoke all on function public.ludus_caravan_defense_v230(text,uuid,uuid) from public,anon;
grant execute on function public.ludus_caravan_defense_v230(text,uuid,uuid) to authenticated;
create function public.ludus_caravan_defense_verified_v230(p_owner uuid,p_id uuid,p_won boolean,p_seconds numeric default 0,p_arrows_used integer default 0)
returns jsonb language sql security invoker set search_path='' as $$select ludus_worker_private.resolve_defense_v230(p_owner,p_id,p_won,false,p_seconds,p_arrows_used);$$;
revoke all on function public.ludus_caravan_defense_verified_v230(uuid,uuid,boolean,numeric,integer) from public,anon,authenticated;
grant usage on schema ludus_worker_private to service_role;
grant execute on function ludus_worker_private.resolve_defense_v230(uuid,uuid,boolean,boolean,numeric,integer),public.ludus_caravan_defense_verified_v230(uuid,uuid,boolean,numeric,integer) to service_role;

create or replace function ludus_supply_private.settle_owner_v87(p_owner uuid,p_until timestamptz default clock_timestamp())
returns integer language plpgsql security invoker set search_path='' as $$
declare j ludus_supply_private.jobs;entry record;delivered integer:=0;blocked boolean;today date:=(p_until at time zone'Europe/Istanbul')::date;crew integer;
begin
 if not exists(select 1 from ludus_supply_private.jobs where owner_id=p_owner and claimed_at is null and ends_at<=p_until)then return 0;end if;
 -- The same account -> food -> job order is shared with purchases and crafting.
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 if not found then return 0;end if;
 perform ludus_worker_private.settle_defenses_v230(p_owner,p_until);
 select count(*)::integer into crew from public.ludus_gladiators where owner_id=p_owner;
 insert into public.ludus_food_house(owner_id,crew_count,settled_day)values(p_owner,crew,today-1)on conflict(owner_id)do nothing;
 insert into public.ludus_food_stock(owner_id,sku)select p_owner,sku from public.ludus_food_catalog on conflict do nothing;
 insert into ludus_supply_private.stock(owner_id,sku)select p_owner,sku from ludus_supply_private.resources where not food on conflict do nothing;
 -- New cargo never feeds a day that finished before its delivery.
 perform ludus_food_private.settle_v55(p_owner,today);
 update public.ludus_food_house set crew_count=crew where owner_id=p_owner;
 for j in select * from ludus_supply_private.jobs where owner_id=p_owner and claimed_at is null and ends_at<=p_until and not exists(select 1 from ludus_worker_private.defenses_v230 d where d.id=jobs.id and d.status<>'resolved') order by ends_at,id for update loop
  perform ludus_supply_private.escort_release_v126(j.id);
  select exists(
   select 1 from jsonb_each_text(j.cargo||j.loadout)e left join ludus_supply_private.resources r on r.sku=e.key
   left join public.ludus_food_stock f on f.owner_id=p_owner and f.sku=e.key
   left join ludus_supply_private.stock s on s.owner_id=p_owner and s.sku=e.key
   where r.sku is null or (case when r.food then coalesce(f.quantity,0)else coalesce(s.quantity,0)end)+e.value::integer>50000
  )into blocked;
  if blocked then
   -- Retry later without discarding any part of a mixed cargo or starving other owners.
   update ludus_supply_private.jobs set delivery_check_at=p_until+interval'5 minutes'where id=j.id;
   continue;
  end if;
  for entry in select e.key,e.value::integer amount,r.food from jsonb_each_text(j.cargo||j.loadout)e join ludus_supply_private.resources r on r.sku=e.key loop
   if entry.food then update public.ludus_food_stock set quantity=quantity+entry.amount where owner_id=p_owner and sku=entry.key;
   else update ludus_supply_private.stock set quantity=quantity+entry.amount where owner_id=p_owner and sku=entry.key;end if;
  end loop;
  update ludus_supply_private.jobs set claimed_at=p_until,delivery_check_at=null where id=j.id;
  delivered:=delivered+1;
 end loop;
 return delivered;
end;$$;
-- Legacy explicit claims cannot skip a running defense or credit cargo early.
create function ludus_worker_private.guard_defense_delivery_v230()
returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from ludus_worker_private.defenses_v230 where id=new.id and status<>'resolved') then
  raise exception 'Kervan saldırı altında. Önce savunmayı tamamla.';
 end if;
 return new;
end;$$;
revoke all on function ludus_worker_private.guard_defense_delivery_v230() from public,anon,authenticated;
create trigger worker_defense_delivery_v230 before update of claimed_at on ludus_supply_private.jobs
 for each row when(old.claimed_at is null and new.claimed_at is not null)
 execute function ludus_worker_private.guard_defense_delivery_v230();
