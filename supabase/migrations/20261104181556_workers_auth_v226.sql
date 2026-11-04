-- Match the application requirement for a non-anonymous account.
alter policy workers_owner_read_v226 on public.ludus_workers_v226 using ((select auth.uid()) = owner_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
alter policy workers_owner_rename_v226 on public.ludus_workers_v226 using ((select auth.uid()) = owner_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)) with check ((select auth.uid()) = owner_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create or replace function ludus_worker_private.roster_v226()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  max_slots integer;
  rows_json jsonb;
begin
  if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or not exists (select 1 from public.ludus_accounts a where a.user_id = u) then
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
