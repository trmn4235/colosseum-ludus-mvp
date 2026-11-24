-- Assign the commander once, in the same transaction as the battle ticket.
-- The private counter survives reloads/devices and is never advanced by retries.
create table if not exists ludus_private.elite_commander_cycle_v296 (
  owner_id uuid primary key references public.ludus_accounts(user_id) on delete cascade,
  matches_started bigint not null default 0 check (matches_started >= 0)
);
alter table ludus_private.elite_commander_cycle_v296 enable row level security;
revoke all on table ludus_private.elite_commander_cycle_v296 from public, anon, authenticated;

create or replace function public.ludus_start_battle_v296(
  p_gladiator uuid,
  p_mode text,
  p_slots jsonb,
  p_request uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing_id uuid;
  result jsonb;
  battle_id uuid;
  battle_snapshot jsonb;
  sequence_number bigint;
  commander text;
begin
  if uid is null or p_request is null then
    raise exception 'Giriş ve işlem kimliği gerekli';
  end if;
  if p_mode is null or p_mode not in ('solo20', '4x5', 'naval4x5', 'survival', 'pit') then
    raise exception 'Geçersiz mod';
  end if;

  -- Use the existing start RPC's account lock before detecting retries, too.
  -- Concurrent tabs cannot both create a ticket or consume a cycle position.
  perform 1 from public.ludus_accounts where user_id = uid for update;
  if not found then
    raise exception 'Ludus bulunamadı';
  end if;
  select id into existing_id
  from public.ludus_battles
  where owner_id = uid and start_request_id = p_request;

  -- Keep equipment validation, item locks, pit rules, loot and rewards in v2.
  -- Naval uses the existing 4x5 combat/reward rules, but has its own venue.
  result := public.ludus_start_battle_v2(
    p_gladiator,
    case when p_mode = 'naval4x5' then '4x5' else p_mode end,
    p_slots,
    p_request
  );
  if existing_id is not null or p_mode not in ('solo20', '4x5', 'naval4x5') then
    -- Legacy tickets deliberately stay unchanged, including their snapshot.
    return result;
  end if;

  battle_id := (result ->> 'id')::uuid;
  battle_snapshot := result -> 'snapshot';
  battle_snapshot := battle_snapshot || jsonb_build_object(
    'game_mode', p_mode,
    'venue', case when p_mode = 'naval4x5' then 'naval' else 'colosseum' end
  );
  if p_mode in ('solo20', '4x5') then
    insert into ludus_private.elite_commander_cycle_v296 as cycle (owner_id, matches_started)
    values (uid, 1)
    on conflict (owner_id) do update
      set matches_started = cycle.matches_started + 1
    returning matches_started into sequence_number;
    commander := case sequence_number % 3
      when 1 then 'legatus'
      when 2 then 'imperator'
      else null
    end;
    battle_snapshot := battle_snapshot || jsonb_build_object(
      'elite_v296', jsonb_build_object(
        'version', 296,
        'sequence', sequence_number,
        'commander', commander
      )
    );
  end if;

  update public.ludus_battles
  set snapshot = battle_snapshot
  where id = battle_id and owner_id = uid and start_request_id = p_request;
  if not found then
    raise exception 'Savaş kaydı bulunamadı';
  end if;
  return result || jsonb_build_object('snapshot', battle_snapshot);
end;
$$;
revoke all on function public.ludus_start_battle_v296(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.ludus_start_battle_v296(uuid, text, jsonb, uuid) to authenticated;

comment on function public.ludus_start_battle_v296(uuid, text, jsonb, uuid) is
  'Starts a v2 battle and snapshots the per-account Legatus/Imperator/none cycle for Colosseum solo20 and 4x5 only. Pass naval4x5 to preserve naval venue without consuming the cycle.';
