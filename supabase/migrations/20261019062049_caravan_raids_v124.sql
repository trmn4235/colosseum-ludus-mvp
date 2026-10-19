-- NPC caravan ambushes. Account locks serialize rewards, equipment and roster changes.
create table if not exists ludus_supply_private.raid_regions_v124(
 id text primary key,name text not null,sku text not null unique,x integer not null,y integer not null,
 choices text[] not null check(cardinality(choices)=3 and choices[1]=sku and choices[1]<>choices[2] and choices[1]<>choices[3] and choices[2]<>choices[3])
);
create table if not exists ludus_supply_private.raids_v124(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.ludus_accounts(user_id),
 request_id uuid not null,region text not null references ludus_supply_private.raid_regions_v124(id),
 gladiators uuid[] not null check(cardinality(gladiators)=2 and gladiators[1]<>gladiators[2]),team jsonb not null,
 started_at timestamptz not null default clock_timestamp(),ends_at timestamptz not null,
 resolved_at timestamptz,success boolean,loot jsonb not null default '{}',delivered_at timestamptz,injured_until timestamptz,
 unique(owner_id,request_id),check(ends_at>=started_at+interval'2 hours'),
 check((resolved_at is null)=(success is null))
);
create unique index if not exists raid_one_active_v124 on ludus_supply_private.raids_v124(owner_id)where resolved_at is null;
create index if not exists raid_history_v124 on ludus_supply_private.raids_v124(owner_id,resolved_at desc);
create table if not exists ludus_supply_private.raid_members_v124(
 gladiator_id uuid primary key references public.ludus_gladiators(id),raid_id uuid not null references ludus_supply_private.raids_v124(id)
);
create index if not exists raid_members_mission_v124 on ludus_supply_private.raid_members_v124(raid_id);
alter table ludus_supply_private.raid_regions_v124 enable row level security;
alter table ludus_supply_private.raids_v124 enable row level security;
alter table ludus_supply_private.raid_members_v124 enable row level security;
revoke all on ludus_supply_private.raid_regions_v124,ludus_supply_private.raids_v124,ludus_supply_private.raid_members_v124 from public,anon,authenticated;

insert into ludus_supply_private.raid_regions_v124(id,name,sku,x,y,choices)values
('wood','Odun','wood',10,13,ARRAY['wood','flax','meat']),
('hunt','Av sahası','meat',30,13,ARRAY['meat','hide','wood']),
('lead_ore','Kurşun cevheri','lead_ore',52,13,ARRAY['lead_ore','wool','tin_ore']),
('tin_ore','Kalay cevheri','tin_ore',73,13,ARRAY['tin_ore','copper_ore','lead_ore']),
('copper_ore','Bakır cevheri','copper_ore',91,13,ARRAY['copper_ore','grain','tin_ore']),
('flax','Ham keten','flax',10,39,ARRAY['flax','resin','wood']),
('hide','Ham deri','hide',33,39,ARRAY['hide','fish','meat']),
('wool','Yün','wool',65,39,ARRAY['wool','olive_oil','lead_ore']),
('grain','Tahıl','grain',90,39,ARRAY['grain','iron_ore','copper_ore']),
('resin','Reçine','resin',10,63,ARRAY['resin','flax','beer']),
('fish','Balık','fish',30,64,ARRAY['fish','hide','beer']),
('olive_oil','Zeytinlik','olive_oil',61,65,ARRAY['olive_oil','wool','egg']),
('iron_ore','Demir cevheri','iron_ore',90,64,ARRAY['iron_ore','grain','apple']),
('wine','Bağ','beer',10,88,ARRAY['beer','resin','fish']),
('egg','Çiftlik','egg',48,88,ARRAY['egg','olive_oil','apple']),
('apple','Elma','apple',82,88,ARRAY['apple','iron_ore','egg'])
on conflict(id)do update set name=excluded.name,sku=excluded.sku,x=excluded.x,y=excluded.y,choices=excluded.choices;

create or replace function ludus_supply_private.raid_guard_v124()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='ludus_gladiators' then
  if exists(select 1 from ludus_supply_private.raid_members_v124 where gladiator_id=old.id)then
   if tg_op='DELETE' then raise exception 'Gladyatör kervan pususunda; önce baskını tamamla.';end if;
   if row(new.id,new.owner_id,new.status,new.training_type,new.training_ends_at,new.clan_roster_id,new.market_listing_id)
    is distinct from row(old.id,old.owner_id,old.status,old.training_type,old.training_ends_at,old.clan_roster_id,old.market_listing_id)
   then raise exception 'Gladyatör kervan pususunda; önce baskını tamamla.';end if;
  end if;
 else
  if exists(select 1 from ludus_supply_private.raid_members_v124 where gladiator_id=old.equipped_by or (tg_op='UPDATE'and gladiator_id=new.equipped_by))then
   if tg_op='DELETE' then raise exception 'Pusudaki gladyatörün ekipmanı kilitli.';end if;
   if row(new.owner_id,new.equipped_by,new.equipped_slot,new.kind,new.model,new.enhancement,new.locked_battle_id,new.clan_roster_id,new.clan_vault_id,new.market_listing_id,new.sapphires,new.rubies,new.emeralds)
    is distinct from row(old.owner_id,old.equipped_by,old.equipped_slot,old.kind,old.model,old.enhancement,old.locked_battle_id,old.clan_roster_id,old.clan_vault_id,old.market_listing_id,old.sapphires,old.rubies,old.emeralds)
   then raise exception 'Pusudaki gladyatörün ekipmanı kilitli.';end if;
  end if;
 end if;
 if tg_op='DELETE'then return old;end if;return new;
end;$$;
revoke all on function ludus_supply_private.raid_guard_v124()from public,anon,authenticated;
drop trigger if exists caravan_raid_guard_v124 on public.ludus_gladiators;
create trigger caravan_raid_guard_v124 before update or delete on public.ludus_gladiators for each row execute function ludus_supply_private.raid_guard_v124();
drop trigger if exists caravan_raid_item_guard_v124 on public.ludus_items;
create trigger caravan_raid_item_guard_v124 before update or delete on public.ludus_items for each row execute function ludus_supply_private.raid_guard_v124();

create or replace function ludus_supply_private.raid_available_v124(p_gladiator uuid)
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.ludus_gladiators g where g.id=p_gladiator and g.owner_id=auth.uid()
 and g.status='available'and g.clan_roster_id is null and g.market_listing_id is null
 and coalesce(g.injured_until,'-infinity')<=statement_timestamp()and coalesce(g.training_ends_at,'-infinity')<=statement_timestamp()
 and not exists(select 1 from ludus_supply_private.raid_members_v124 where gladiator_id=g.id)
 and not exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)
 and not exists(select 1 from public.ludus_imperial_members where gladiator_id=g.id and active)
 and not exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters r on r.id=e.roster_id where e.gladiator_id=g.id and r.state in('draft','locked'))
 and not exists(select 1 from public.ludus_matches m where m.status in('waiting','playing')and m.updated_at>statement_timestamp()-interval'30 seconds'and m.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
 and not exists(select 1 from public.ludus_duels where status in('waiting','playing')and updated_at>statement_timestamp()-interval'75 seconds'and g.id in(host_g,guest_g))
 and not exists(select 1 from public.ludus_items i where equipped_by=g.id and (locked_battle_id is not null or clan_roster_id is not null or clan_vault_id is not null or market_listing_id is not null)))
$$;
revoke all on function ludus_supply_private.raid_available_v124(uuid)from public,anon,authenticated;

create or replace function ludus_supply_private.raid_view_v124(j ludus_supply_private.raids_v124)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',j.id,'request_id',j.request_id,'region',j.region,'team',j.team,'started_at',j.started_at,'ends_at',j.ends_at,
 'status',case when j.resolved_at is not null then 'resolved'when j.ends_at<=statement_timestamp()then 'ready'else 'waiting'end,
 'resolved_at',j.resolved_at,'success',j.success,'loot',j.loot,'delivered_at',j.delivered_at,'injured_until',j.injured_until)
$$;
revoke all on function ludus_supply_private.raid_view_v124(ludus_supply_private.raids_v124)from public,anon,authenticated;

create or replace function ludus_supply_private.raid_deliver_v124(p_owner uuid)
returns void language plpgsql set search_path='' as $$
declare j ludus_supply_private.raids_v124;e record;
begin
 if not exists(select 1 from ludus_supply_private.raids_v124 where owner_id=p_owner and success and delivered_at is null)then return;end if;
 -- Settle the old menu before newly won food enters the shared pantry.
 perform public.ludus_food_state();
 insert into ludus_supply_private.stock(owner_id,sku)select p_owner,sku from ludus_supply_private.resources where not food on conflict do nothing;
 for j in select * from ludus_supply_private.raids_v124 where owner_id=p_owner and success and delivered_at is null order by resolved_at,id for update loop
  if exists(select 1 from jsonb_each_text(j.loot)amount_entry join ludus_supply_private.resources r on r.sku=amount_entry.key
   left join public.ludus_food_stock f on f.owner_id=p_owner and f.sku=amount_entry.key
   left join ludus_supply_private.stock s on s.owner_id=p_owner and s.sku=amount_entry.key
   where(case when r.food then coalesce(f.quantity,0)else coalesce(s.quantity,0)end)+amount_entry.value::integer>50000)then continue;end if;
  for e in select v.key,v.value::integer amount,r.food from jsonb_each_text(j.loot)v join ludus_supply_private.resources r on r.sku=v.key loop
   if e.food then update public.ludus_food_stock set quantity=quantity+e.amount where owner_id=p_owner and sku=e.key;
   else update ludus_supply_private.stock set quantity=quantity+e.amount where owner_id=p_owner and sku=e.key;end if;
  end loop;
  update ludus_supply_private.raids_v124 set delivered_at=clock_timestamp()where id=j.id;
 end loop;
end;$$;
revoke all on function ludus_supply_private.raid_deliver_v124(uuid)from public,anon,authenticated;

create or replace function ludus_supply_private.raid_api_v124(p_action text,p_gladiators uuid[],p_region text,p_request uuid,p_raid uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();training jsonb;fighters jsonb;regions jsonb;history jsonb;active jsonb;result jsonb;
 j ludus_supply_private.raids_v124;r ludus_supply_private.raid_regions_v124;gid uuid;chosen text;won boolean;team jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Kervan avı için hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','start','resolve')then raise exception 'Geçersiz baskın işlemi.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 training:=ludus_supply_private.hunt_v122('state',null);
 select coalesce(jsonb_agg(g||jsonb_build_object('ready',coalesce((g->>'ready')::boolean,false)and ludus_supply_private.raid_available_v124((g->>'id')::uuid),
  'weapons',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'model',i.model,'enhancement',i.enhancement,'slot',i.equipped_slot)order by i.equipped_slot,i.id)
   from public.ludus_items i where i.owner_id=u and i.equipped_by=(g->>'id')::uuid and i.kind='weapon'),'[]'::jsonb))),'[]'::jsonb)
 into fighters from jsonb_array_elements(training->'gladiators')g;
 if p_action='start'then
  if p_request is null then raise exception 'İşlem kimliği gerekli.';end if;
  select * into j from ludus_supply_private.raids_v124 where owner_id=u and request_id=p_request;
  if found then
   if j.region is distinct from p_region or j.gladiators is distinct from p_gladiators then raise exception 'İşlem kimliği başka bir pusuya ait.';end if;
  else
   if cardinality(p_gladiators)is distinct from 2 or p_gladiators[1]is null or p_gladiators[2]is null or p_gladiators[1]=p_gladiators[2]then raise exception 'İki farklı gladyatör seç.';end if;
   if exists(select 1 from ludus_supply_private.raids_v124 where owner_id=u and resolved_at is null)then raise exception 'Önce mevcut pusuyu tamamla.';end if;
   select * into r from ludus_supply_private.raid_regions_v124 where id=p_region;
   if not found then raise exception 'Geçerli bir pusu bölgesi seç.';end if;
   perform 1 from public.ludus_gladiators where owner_id=u and id=any(p_gladiators)order by id for update;
   perform 1 from public.ludus_items where owner_id=u and equipped_by=any(p_gladiators)order by id for update;
   foreach gid in array p_gladiators loop
    if not exists(select 1 from jsonb_array_elements(fighters)g where(g->>'id')::uuid=gid and (g->>'ready')::boolean)then raise exception 'İki gladyatör de sana ait ve hazır olmalı.';end if;
   end loop;
   select jsonb_agg(g order by array_position(p_gladiators,(g->>'id')::uuid))into team from jsonb_array_elements(fighters)g where(g->>'id')::uuid=any(p_gladiators);
   insert into ludus_supply_private.raids_v124(owner_id,request_id,region,gladiators,team,started_at,ends_at)
    values(u,p_request,p_region,p_gladiators,team,ts,ts+interval'2 hours')returning * into j;
   update public.ludus_gladiators set status='locked'where owner_id=u and id=any(p_gladiators);
   insert into ludus_supply_private.raid_members_v124(gladiator_id,raid_id)select unnest(p_gladiators),j.id;
   insert into ludus_supply_private.hunt_team_v122(owner_id,gladiators)values(u,p_gladiators)on conflict(owner_id)do update set gladiators=excluded.gladiators,updated_at=ts;
  end if;
  result:=ludus_supply_private.raid_view_v124(j);
 elsif p_action='resolve'then
  select * into j from ludus_supply_private.raids_v124 where id=p_raid and owner_id=u for update;
  if not found then raise exception 'Baskın bulunamadı.';end if;
  if j.resolved_at is null then
   if clock_timestamp()<j.ends_at then raise exception 'Pusu henüz hazır değil; iki saat tamamlanmalı.';end if;
   select * into r from ludus_supply_private.raid_regions_v124 where id=j.region;
   -- Uniform integer sample: all three cargoes have exactly 1/3 probability.
   chosen:=r.choices[1+floor(random()*3)::integer];won:=random()<0.70;
   delete from ludus_supply_private.raid_members_v124 where raid_id=j.id;
   update public.ludus_gladiators set status=case when won then 'available'else 'injured'end,
    injury_level=case when won then injury_level else greatest(injury_level,1)end,
    injured_until=case when won then injured_until else clock_timestamp()+interval'12 hours'end
    where owner_id=u and id=any(j.gladiators);
   update ludus_supply_private.raids_v124 set resolved_at=clock_timestamp(),success=won,
    loot=case when won then jsonb_build_object(chosen,15)else '{}'::jsonb end,
    injured_until=case when not won then clock_timestamp()+interval'12 hours'end where id=j.id returning * into j;
  end if;
  result:=ludus_supply_private.raid_view_v124(j);
 end if;
 perform ludus_supply_private.raid_deliver_v124(u);
 if j.id is not null then select ludus_supply_private.raid_view_v124(t)into result from ludus_supply_private.raids_v124 t where id=j.id;end if;
 select coalesce(jsonb_agg(to_jsonb(region_row)order by region_row.y,region_row.x),'[]')into regions from ludus_supply_private.raid_regions_v124 region_row;
 select ludus_supply_private.raid_view_v124(t)into active from ludus_supply_private.raids_v124 t where owner_id=u and resolved_at is null;
 select coalesce(jsonb_agg(ludus_supply_private.raid_view_v124(t)order by t.resolved_at desc,t.id),'[]')into history
 from(select * from ludus_supply_private.raids_v124 where owner_id=u and resolved_at is not null order by resolved_at desc,id limit 5)t;
 return jsonb_build_object('user_id',u,'server_now',clock_timestamp(),'gladiators',fighters,'team',coalesce((select to_jsonb(gladiators)from ludus_supply_private.hunt_team_v122 where owner_id=u),'[]'::jsonb),
  'regions',regions,'active',active,'history',history,'result',result,'duration_seconds',7200,'recovery_seconds',43200,'success_chance',0.70,'reward_quantity',15,'version',124);
end;$$;
revoke all on function ludus_supply_private.raid_api_v124(text,uuid[],text,uuid,uuid)from public,anon,authenticated;
grant execute on function ludus_supply_private.raid_api_v124(text,uuid[],text,uuid,uuid)to authenticated;
create or replace function public.ludus_caravan_raid(p_action text default 'state',p_gladiators uuid[] default null,p_region text default null,p_request uuid default null,p_raid uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.raid_api_v124(p_action,p_gladiators,p_region,p_request,p_raid)$$;
revoke all on function public.ludus_caravan_raid(text,uuid[],text,uuid,uuid)from public,anon;
grant execute on function public.ludus_caravan_raid(text,uuid[],text,uuid,uuid)to authenticated;
notify pgrst,'reload schema';
