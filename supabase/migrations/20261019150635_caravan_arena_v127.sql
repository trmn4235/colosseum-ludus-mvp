-- Freeze the arena rule version on each server-owned encounter.
-- Started V126 battles retain their original deterministic replay.
create or replace function ludus_supply_private.encounter_v126(jid uuid)
returns void language plpgsql set search_path='' as $$
declare j ludus_supply_private.raids_v124;choices text[];n integer;frozen_team jsonb;
begin
 select * into j from ludus_supply_private.raids_v124 where id=jid for update;
 if j.encounter is not null or j.resolved_at is not null then return;end if;
 insert into ludus_supply_private.raid_counter_v126(owner_id,attempt)values(j.owner_id,1)
 on conflict(owner_id)do update set attempt=ludus_supply_private.raid_counter_v126.attempt+1 returning attempt into n;
 select r.choices into choices from ludus_supply_private.raid_regions_v124 r where r.id=j.region;
 select jsonb_agg((to_jsonb(g)-'owner_id')||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.equipped_by=g.id and i.owner_id=j.owner_id),'[]'::jsonb),
 'weapons',coalesce((select jsonb_agg(to_jsonb(i)-'owner_id')from public.ludus_items i where i.equipped_by=g.id and i.owner_id=j.owner_id and i.kind='weapon'),'[]'::jsonb))order by array_position(j.gladiators,g.id))into frozen_team
 from public.ludus_gladiators g where g.owner_id=j.owner_id and g.id=any(j.gladiators);
 update ludus_supply_private.raids_v124 set team=frozen_team,ends_at=greatest(started_at,clock_timestamp()),encounter=jsonb_build_object(
 'version',126,'rules',127,'attempt',n,'seed',1+floor(random()*2147483646)::integer,'guards',cardinality(j.gladiators)+case when n%4=0 then 1 else 0 end,
 'archers',1,'cargo',choices[1+floor(random()*3)::integer],'quantity',60)where id=jid;
end;$$;
revoke all on function ludus_supply_private.encounter_v126(uuid)from public,anon,authenticated;


update ludus_supply_private.raids_v124 set encounter=encounter||'{"rules":127}'::jsonb
where resolved_at is null and battle_started_at is null and encounter is not null
  and (encounter->>'version')::integer=126;
notify pgrst,'reload schema';
