create table ludus_private.onboarding_v109 (
 owner_id uuid primary key references public.ludus_accounts(user_id) on delete cascade,
 auto_open boolean not null default true,
 presented_at timestamptz, dismissed_at timestamptz, inspected_at timestamptz,
 equipped_at timestamptz, mission_at timestamptz, training_at timestamptz, completed_at timestamptz
);
alter table ludus_private.onboarding_v109 enable row level security;
revoke all on ludus_private.onboarding_v109 from public,anon,authenticated;
create policy onboarding_owner_v109 on ludus_private.onboarding_v109 for select to authenticated
 using(owner_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true));
insert into ludus_private.onboarding_v109(owner_id,auto_open)
 select user_id,false from public.ludus_accounts on conflict do nothing;
create function ludus_private.onboarding_state_v109(p_action text,p_gladiator uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); ts timestamptz:=clock_timestamp(); r ludus_private.onboarding_v109;
 equipment_time timestamptz; mission_time timestamptz; training_time timestamptz;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true)
 or not exists(select 1 from public.ludus_accounts where user_id=u) then
  raise exception 'Giriş gerekiyor.' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('state','present','dismiss','inspect') then
  raise exception 'Geçersiz rehber işlemi.';
 end if;
 if p_action='inspect' and not exists(select 1 from public.ludus_gladiators where id=p_gladiator and owner_id=u) then
  raise exception 'Gladyatör sana ait değil.' using errcode='42501';
 end if;
 insert into ludus_private.onboarding_v109(owner_id) values(u) on conflict do nothing;
 select * into r from ludus_private.onboarding_v109 where owner_id=u for update;
 if r.equipped_at is null then
  select min(i.created_at) into equipment_time from public.ludus_items i
   join public.ludus_gladiators g on g.id=i.equipped_by and g.owner_id=u
   where i.owner_id=u and i.equipped_slot is not null;
 end if;
 if r.mission_at is null then
  select min(started_at) into mission_time from public.ludus_imperial_assignments where owner_id=u;
 end if;
 if r.training_at is null then
  select min(started_at) into training_time from public.ludus_training_sessions where owner_id=u;
 end if;
 update ludus_private.onboarding_v109 set
  presented_at=case when p_action in ('present','dismiss') then coalesce(presented_at,ts) else presented_at end,
  dismissed_at=case when p_action='dismiss' then coalesce(dismissed_at,ts) else dismissed_at end,
  inspected_at=case when p_action='inspect' then coalesce(inspected_at,ts) else inspected_at end,
  equipped_at=coalesce(equipped_at,equipment_time),
  mission_at=coalesce(mission_at,mission_time),training_at=coalesce(training_at,training_time)
 where owner_id=u returning * into r;
 if r.completed_at is null and r.inspected_at is not null and r.equipped_at is not null
 and r.mission_at is not null and r.training_at is not null then
  update ludus_private.onboarding_v109 set completed_at=ts where owner_id=u returning * into r;
 end if;
 return jsonb_build_object('should_open',r.auto_open and r.presented_at is null and r.dismissed_at is null and r.completed_at is null,
  'steps',jsonb_build_object('inspect',r.inspected_at is not null,'equipment',r.equipped_at is not null,
  'mission',r.mission_at is not null,'training',r.training_at is not null),'completed_at',r.completed_at);
end $$;
revoke all on function ludus_private.onboarding_state_v109(text,uuid) from public,anon,authenticated;
grant usage on schema ludus_private to authenticated;
grant execute on function ludus_private.onboarding_state_v109(text,uuid) to authenticated;
create function public.ludus_onboarding(p_action text default 'state',p_gladiator uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_private.onboarding_state_v109(p_action,p_gladiator);
$$;
revoke all on function public.ludus_onboarding(text,uuid) from public,anon;
grant execute on function public.ludus_onboarding(text,uuid) to authenticated;
