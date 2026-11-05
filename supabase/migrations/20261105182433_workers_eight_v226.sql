-- V226: the Ludus has eight persistent worker identities. Caravan trip
-- capacity is a separate existing entitlement and is not changed here.
alter table public.ludus_workers_v226
  drop constraint ludus_workers_v226_slot_check,
  add constraint ludus_workers_v226_slot_check check (slot between 1 and 8),
  drop constraint ludus_workers_v226_portrait_check,
  add constraint ludus_workers_v226_portrait_check check (portrait between 0 and 7);

create or replace function ludus_worker_private.roster_v226()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  rows_json jsonb;
begin
  if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or not exists (select 1 from public.ludus_accounts a where a.user_id = u) then
    raise exception 'Ludus hesabı bulunamadı.' using errcode = '42501';
  end if;
  insert into public.ludus_workers_v226(owner_id, slot, name, portrait)
  select u, n, 'İşçi ' || n, n - 1
  from pg_catalog.generate_series(1, 8) as n
  on conflict (owner_id, slot) do nothing;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id, 'slot', w.slot, 'name', w.name, 'portrait', w.portrait
  ) order by w.slot), '[]'::jsonb) into rows_json
  from public.ludus_workers_v226 w where w.owner_id = u;
  return jsonb_build_object('user_id', u, 'workers', rows_json);
end;
$$;
