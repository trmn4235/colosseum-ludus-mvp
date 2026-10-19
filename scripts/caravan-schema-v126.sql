-- V126: 2–5 fighters, immediate playable raids, one-hour post-battle cooldown.
create or replace function ludus_supply_private.valid_team_v126(ids uuid[])
returns boolean language sql immutable set search_path='' as $$
 select coalesce(array_ndims(ids)=1 and cardinality(ids)between 2 and 5
 and cardinality(ids)=(select count(distinct id)from unnest(ids)id),false)
$$;
revoke all on function ludus_supply_private.valid_team_v126(uuid[])from public,anon,authenticated;
alter table ludus_supply_private.hunt_team_v122 drop constraint if exists hunt_team_v122_gladiators_check;
alter table ludus_supply_private.hunt_team_v122 add constraint hunt_team_v122_gladiators_check check(ludus_supply_private.valid_team_v126(gladiators));
alter table ludus_supply_private.raids_v124 drop constraint if exists raids_v124_gladiators_check;
alter table ludus_supply_private.raids_v124 add constraint raids_v124_gladiators_check check(ludus_supply_private.valid_team_v126(gladiators));
alter table ludus_supply_private.raids_v124 drop constraint if exists raids_v124_check;
alter table ludus_supply_private.raids_v124 add constraint raids_v124_check check(ends_at>=started_at);
alter table ludus_supply_private.raids_v124 add column if not exists encounter jsonb;
alter table ludus_supply_private.raids_v124 add column if not exists battle_started_at timestamptz;
alter table ludus_supply_private.raids_v124 add column if not exists battle_seconds numeric;
alter table ludus_supply_private.jobs add column if not exists escort uuid[]not null default '{}';
alter table ludus_supply_private.jobs add column if not exists escort_team jsonb not null default '[]';
create table if not exists ludus_supply_private.raid_counter_v126(
 owner_id uuid primary key references public.ludus_accounts(user_id),attempt integer not null default 0,cooldown_until timestamptz
);
create table if not exists ludus_supply_private.escort_members_v126(
 gladiator_id uuid primary key references public.ludus_gladiators(id),job_id uuid not null references ludus_supply_private.jobs(id)
);
create index if not exists escort_job_v126 on ludus_supply_private.escort_members_v126(job_id);
alter table ludus_supply_private.raid_counter_v126 enable row level security;
alter table ludus_supply_private.escort_members_v126 enable row level security;
revoke all on ludus_supply_private.raid_counter_v126,ludus_supply_private.escort_members_v126 from public,anon,authenticated;

create or replace function ludus_supply_private.reserved_v126(gid uuid)
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from ludus_supply_private.raid_members_v124 where gladiator_id=gid)
 or exists(select 1 from ludus_supply_private.escort_members_v126 where gladiator_id=gid)
$$;
revoke all on function ludus_supply_private.reserved_v126(uuid)from public,anon,authenticated;
create or replace function ludus_supply_private.raid_guard_v124()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='ludus_gladiators'then
  if ludus_supply_private.reserved_v126(old.id)then
   if tg_op='DELETE'then raise exception 'Gladyatör kervan görevinde; önce görevi tamamla.';end if;
   if row(new.id,new.owner_id,new.status,new.training_type,new.training_ends_at,new.clan_roster_id,new.market_listing_id)
   is distinct from row(old.id,old.owner_id,old.status,old.training_type,old.training_ends_at,old.clan_roster_id,old.market_listing_id)
   then raise exception 'Gladyatör kervan görevinde; önce görevi tamamla.';end if;
  end if;
 else
  if ludus_supply_private.reserved_v126(old.equipped_by)or(tg_op='UPDATE'and ludus_supply_private.reserved_v126(new.equipped_by))then
   if tg_op='DELETE'then raise exception 'Kervan görevindeki ekipman kilitli.';end if;
   if row(new.owner_id,new.equipped_by,new.equipped_slot,new.kind,new.model,new.enhancement,new.locked_battle_id,new.clan_roster_id,new.clan_vault_id,new.market_listing_id,new.sapphires,new.rubies,new.emeralds)
   is distinct from row(old.owner_id,old.equipped_by,old.equipped_slot,old.kind,old.model,old.enhancement,old.locked_battle_id,old.clan_roster_id,old.clan_vault_id,old.market_listing_id,old.sapphires,old.rubies,old.emeralds)
   then raise exception 'Kervan görevindeki ekipman kilitli.';end if;
  end if;
 end if;
 if tg_op='DELETE'then return old;end if;return new;
end;$$;
create or replace function ludus_supply_private.escort_release_v126(jid uuid)
returns void language plpgsql set search_path='' as $$
declare ids uuid[];
begin
 select array_agg(gladiator_id)into ids from ludus_supply_private.escort_members_v126 where job_id=jid;
 delete from ludus_supply_private.escort_members_v126 where job_id=jid;
 update public.ludus_gladiators set status='available'where id=any(ids)and status='locked';
end;$$;
revoke all on function ludus_supply_private.escort_release_v126(uuid)from public,anon,authenticated;

create or replace function ludus_supply_private.fighters_v126()
returns jsonb language plpgsql set search_path='' as $$
declare training jsonb;answer jsonb;
begin
 training:=ludus_supply_private.hunt_v122('state',null);
 select coalesce(jsonb_agg((to_jsonb(g)-'owner_id')||jsonb_build_object(
 'ready',coalesce((f->>'ready')::boolean,false)and ludus_supply_private.raid_available_v124(g.id)and not ludus_supply_private.reserved_v126(g.id),
 'items',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.owner_id=auth.uid()and i.equipped_by=g.id),'[]'::jsonb),
 'weapons',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.owner_id=auth.uid()and i.equipped_by=g.id and i.kind='weapon'),'[]'::jsonb))order by g.name),'[]'::jsonb)
 into answer from jsonb_array_elements(training->'gladiators')f join public.ludus_gladiators g on g.id=(f->>'id')::uuid and g.owner_id=auth.uid();
 return answer;
end;$$;
revoke all on function ludus_supply_private.fighters_v126()from public,anon,authenticated;

-- A one-time multiplier; already-departed cargo, prices and stock are preserved.
create table if not exists ludus_supply_private.balance_versions_v126(version integer primary key);
alter table ludus_supply_private.balance_versions_v126 enable row level security;
revoke all on ludus_supply_private.balance_versions_v126 from public,anon,authenticated;
do $$begin
 if not exists(select 1 from ludus_supply_private.balance_versions_v126 where version=126)then
  update ludus_supply_private.destinations d set yields=coalesce((select jsonb_object_agg(key,value::integer*4)from jsonb_each_text(d.yields)),'{}'::jsonb);
  insert into ludus_supply_private.balance_versions_v126 values(126);
 end if;
end;$$;
