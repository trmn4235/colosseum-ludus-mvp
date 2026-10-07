-- V35: the room chest reuses the existing clan transaction/permission system.
-- Personal wallet -> clan wallet only. There is deliberately no coin withdrawal.
create table if not exists public.ludus_clan_vault_stones (
 clan_id uuid not null references public.ludus_clans(id),
 family text not null,
 stone_id integer not null,
 quantity integer not null check (quantity > 0),
 primary key (clan_id, family, stone_id),
 check ((family = 'diamond' and stone_id = 1)
     or (family = 'sapphire' and stone_id between 1 and 18)
     or (family = 'emerald' and stone_id between 1 and 15)
     or (family = 'ruby' and stone_id between 1 and 4))
);
alter table public.ludus_clan_vault_stones enable row level security;
revoke all on public.ludus_clan_vault_stones from public, anon, authenticated;
comment on table public.ludus_clan_vault_stones is
 'Shared gem stacks. No direct client access: authenticated, membership-checked chest RPC only.';
create index if not exists ludus_items_clan_vault_v35_idx on public.ludus_items(clan_vault_id, vaulted_at desc, id);
create index if not exists ludus_clan_ledger_v35_idx on public.ludus_clan_ledger(clan_id, created_at desc);

create or replace function ludus_private.clan_vault_state(u uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j jsonb; cid uuid;
begin
 j := ludus_private.clan_state(u);
 select clan_id into cid from public.ludus_clan_members where user_id = u;
 -- Nonmembers see only their own inventory; NULL clan matches no shared rows.
 -- Every member may inspect the chest. Taking/putting items still requires vault_access.
 return j || jsonb_build_object(
  'vault', coalesce((select jsonb_agg(to_jsonb(i) order by i.vaulted_at desc, i.id)
    from public.ludus_items i where i.clan_vault_id = cid), '[]'::jsonb),
  'inventory', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc, i.id)
    from public.ludus_items i where i.owner_id = u and i.clan_vault_id is null
     and i.clan_roster_id is null and i.locked_battle_id is null and i.equipped_by is null), '[]'::jsonb),
  'vault_stones', coalesce((select jsonb_agg(to_jsonb(s) order by s.family, s.stone_id)
    from public.ludus_clan_vault_stones s where s.clan_id = cid), '[]'::jsonb),
  'inventory_stones', coalesce((select jsonb_agg(to_jsonb(s) order by s.family, s.stone_id)
    from (select family, stone_id, quantity from public.ludus_stones where owner_id = u and quantity > 0
     union all select 'diamond', 1, diamonds from public.ludus_accounts where user_id = u and diamonds > 0) s), '[]'::jsonb),
  'vault_capacity', 60);
end $$;
revoke all on function ludus_private.clan_vault_state(uuid) from public, anon, authenticated;

-- Count stone stacks as slots in the original equipment RPC as well, so the older
-- clan management screen cannot bypass the shared 60-slot limit.
do $$
declare src text; old_clause text := '(select count(*)from public.ludus_items where clan_vault_id=c.id)>=60';
 new_clause text := '((select count(*)from public.ludus_items where clan_vault_id=c.id)+(select count(*)from public.ludus_clan_vault_stones where clan_id=c.id))>=60';
begin
 src := pg_get_functiondef('public.ludus_clan(text,jsonb,uuid)'::regprocedure);
 if position(new_clause in src) = 0 then
  if position(old_clause in src) = 0 then raise exception 'V35: equipment capacity guard not found'; end if;
  execute replace(src, old_clause, new_clause);
 end if;
end $$;

create or replace function public.ludus_clan_vault(
 p_action text default 'state', p_data jsonb default '{}'::jsonb, p_request uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid(); m public.ludus_clan_members; c public.ludus_clans;
 op public.ludus_clan_operations; result jsonb;
 family_name text; stone integer; amount integer; source_count integer; target_count integer;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id = u) then
  raise exception 'Hesabına giriş yap.';
 end if;
 if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 32768 then
  raise exception 'Geçersiz sandık işlemi.';
 end if;
 if p_action = 'state' then return ludus_private.clan_vault_state(u); end if;
 if p_action is null or p_action not in ('deposit', 'vault_deposit', 'vault_withdraw', 'stone_deposit', 'stone_withdraw') then
  raise exception 'Bu sandık işlemi desteklenmiyor. Klandan denarius alınamaz.';
 end if;
 if p_request is null then raise exception 'İşlem kimliği gerekli.'; end if;

 -- Same wallet -> advisory clan lock -> clan row order as the original clan RPC.
 -- This also serializes old/new clients and permission changes in a single order.
 perform 1 from public.ludus_accounts where user_id = u for update;
 perform pg_advisory_xact_lock(202622);
 select * into op from public.ludus_clan_operations where user_id = u and request_id = p_request;
 if found then
  if op.action <> p_action or op.data <> p_data then raise exception 'İşlem kimliği başka bir istekte kullanılmış.'; end if;
  return jsonb_build_object('state', ludus_private.clan_vault_state(u), 'repeated', true);
 end if;
 select * into m from public.ludus_clan_members where user_id = u;
 select * into c from public.ludus_clans where id = m.clan_id for update;
 if c.id is null then raise exception 'Önce bir klana katıl.'; end if;
 -- A delayed/retried operation must never donate to a newly joined, different clan.
 if coalesce(p_data->>'clan_id', '') <> c.id::text then raise exception 'Klanın değişmiş. Sandığı yeniden aç.'; end if;

 if p_action in ('deposit', 'vault_deposit', 'vault_withdraw') then
  result := public.ludus_clan(p_action, p_data, p_request);
  return result || jsonb_build_object('state', ludus_private.clan_vault_state(u));
 end if;
 if not (c.leader_id = u or m.vault_access) then raise exception 'Eşya taşımak için klan liderinden kasa yetkisi almalısın.'; end if;
 family_name := p_data->>'family';
 if family_name is null or family_name not in ('diamond', 'sapphire', 'emerald', 'ruby')
   or coalesce(p_data->>'stone_id', '') !~ '^[0-9]{1,2}$'
   or coalesce(p_data->>'quantity', '') !~ '^[0-9]{1,8}$' then
  raise exception 'Geçerli bir taş ve adet seç.';
 end if;
 stone := (p_data->>'stone_id')::integer; amount := (p_data->>'quantity')::integer;
 if amount < 1 or amount > 10000000 then raise exception 'Adet 1–10.000.000 arasında olmalı.'; end if;
 if family_name = 'diamond' then
  if stone <> 1 then raise exception 'Geçersiz elmas.'; end if;
 elsif not exists(select 1 from public.ludus_stone_catalog where family = family_name and stone_id = stone) then
  raise exception 'Geçersiz taş.';
 end if;
 if p_action = 'stone_deposit' then
  if family_name = 'diamond' then
   select diamonds into source_count from public.ludus_accounts where user_id = u;
  else
   select quantity into source_count from public.ludus_stones
    where owner_id = u and family = family_name and stone_id = stone for update;
  end if;
  if coalesce(source_count, 0) < amount then raise exception 'Kişisel envanterindeki adet yetersiz.'; end if;
  select quantity into target_count from public.ludus_clan_vault_stones
   where clan_id = c.id and family = family_name and stone_id = stone for update;
  if coalesce(target_count, 0)::bigint + amount > 2147483647 then raise exception 'Taş yığını üst sınırda.'; end if;
  if target_count is null and
    ((select count(*) from public.ludus_items where clan_vault_id = c.id) +
     (select count(*) from public.ludus_clan_vault_stones where clan_id = c.id)) >= 60 then
   raise exception 'Klan kasasının 60 eşya yuvası dolu.';
  end if;
  if family_name = 'diamond' then
   update public.ludus_accounts set diamonds = diamonds - amount where user_id = u;
  else
   update public.ludus_stones set quantity = quantity - amount
    where owner_id = u and family = family_name and stone_id = stone;
  end if;
  insert into public.ludus_clan_vault_stones(clan_id, family, stone_id, quantity)
   values(c.id, family_name, stone, amount)
   on conflict(clan_id, family, stone_id) do update
    set quantity = public.ludus_clan_vault_stones.quantity + excluded.quantity;
 else
  select quantity into source_count from public.ludus_clan_vault_stones
   where clan_id = c.id and family = family_name and stone_id = stone for update;
  if coalesce(source_count, 0) < amount then raise exception 'Klan kasasındaki adet yetersiz.'; end if;
  if family_name = 'diamond' then
   select diamonds into target_count from public.ludus_accounts where user_id = u;
  else
   select quantity into target_count from public.ludus_stones
    where owner_id = u and family = family_name and stone_id = stone for update;
  end if;
  if coalesce(target_count, 0)::bigint + amount > 2147483647 then raise exception 'Kişisel taş yığını üst sınırda.'; end if;
  if source_count = amount then
   delete from public.ludus_clan_vault_stones where clan_id = c.id and family = family_name and stone_id = stone;
  else
   update public.ludus_clan_vault_stones set quantity = quantity - amount
    where clan_id = c.id and family = family_name and stone_id = stone;
  end if;
  if family_name = 'diamond' then
   update public.ludus_accounts set diamonds = diamonds + amount where user_id = u;
  else
   insert into public.ludus_stones(owner_id, family, stone_id, quantity) values(u, family_name, stone, amount)
    on conflict(owner_id, family, stone_id) do update set quantity = public.ludus_stones.quantity + excluded.quantity;
  end if;
 end if;
 insert into public.ludus_clan_ledger(clan_id, user_id, kind, detail)
  values(c.id, u, case when p_action = 'stone_deposit' then 'item_deposit' else 'item_withdraw' end,
   jsonb_build_object('family', family_name, 'stone_id', stone, 'quantity', amount));
 insert into public.ludus_clan_operations(user_id, request_id, action, data, clan_id)
  values(u, p_request, p_action, p_data, c.id);
 return jsonb_build_object('state', ludus_private.clan_vault_state(u), 'repeated', false);
end $$;
revoke all on function public.ludus_clan_vault(text,jsonb,uuid) from public, anon;
grant execute on function public.ludus_clan_vault(text,jsonb,uuid) to authenticated;
