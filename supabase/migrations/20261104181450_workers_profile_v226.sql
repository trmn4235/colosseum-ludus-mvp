-- Worker identities are owned by the Ludus. Existing caravan jobs contain only
-- aggregate counts, so no individual is retroactively assigned to a job.
create table public.ludus_workers_v226 (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
  slot smallint not null check (slot between 1 and 6),
  name text not null check (char_length(name) between 2 and 24 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  portrait smallint not null check (portrait between 0 and 5),
  created_at timestamptz not null default now(),
  unique (owner_id, slot)
);
alter table public.ludus_workers_v226 enable row level security;
revoke all on public.ludus_workers_v226 from public, anon, authenticated;
grant select on public.ludus_workers_v226 to authenticated;
grant update (name) on public.ludus_workers_v226 to authenticated;
create policy workers_owner_read_v226 on public.ludus_workers_v226
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy workers_owner_rename_v226 on public.ludus_workers_v226
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Authenticated users can initialize only their own slots, up to the existing
-- caravan entitlement. No caller can create or edit skills, cargo or rewards.
create schema if not exists ludus_worker_private;
revoke all on schema ludus_worker_private from public, anon, authenticated;
grant usage on schema ludus_worker_private to authenticated;
create function ludus_worker_private.roster_v226()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  max_slots integer;
  rows_json jsonb;
begin
  if u is null or not exists (select 1 from public.ludus_accounts a where a.user_id = u) then
    raise exception 'Ludus hesabı bulunamadı.' using errcode = '42501';
  end if;
  max_slots := least(6, greatest(0, ludus_supply_private.worker_count(u)));
  insert into public.ludus_workers_v226(owner_id, slot, name, portrait)
  select u, n, 'İşçi ' || n, (n - 1) % 6
  from pg_catalog.generate_series(1, max_slots) as n
  on conflict (owner_id, slot) do nothing;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id, 'slot', w.slot, 'name', w.name, 'portrait', w.portrait
  ) order by w.slot), '[]'::jsonb) into rows_json
  from public.ludus_workers_v226 w where w.owner_id = u and w.slot <= max_slots;
  return jsonb_build_object('user_id', u, 'workers', rows_json);
end;
$$;
revoke all on function ludus_worker_private.roster_v226() from public, anon, authenticated;
grant execute on function ludus_worker_private.roster_v226() to authenticated;
create function public.ludus_workers_roster_v226()
returns jsonb language sql security invoker set search_path = ''
as $$ select ludus_worker_private.roster_v226() $$;
revoke all on function public.ludus_workers_roster_v226() from public, anon;
grant execute on function public.ludus_workers_roster_v226() to authenticated;
