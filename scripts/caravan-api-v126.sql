create or replace function ludus_supply_private.depart_v126(p_action text,p_key text,p_workers integer,p_request uuid,p_bows integer,p_arrows integer,p_escort uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();s jsonb;payload jsonb;receipt ludus_supply_private.departure_receipts_v122;answer jsonb;jid uuid;fighters jsonb;team jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('send','buy')or p_request is null then raise exception 'Geçersiz kervan çıkışı.';end if;
 if p_workers is null or p_workers<1 or p_bows is null or p_arrows is null or p_bows<0 or p_bows>p_workers or p_arrows<0 or p_arrows>p_bows*50 then raise exception 'Kervancı başına 1 yay ve yay başına en fazla 50 ok seç.';end if;
 p_escort:=coalesce(p_escort,'{}');
 if cardinality(p_escort)>0 and not ludus_supply_private.valid_team_v126(p_escort)then raise exception 'Savunma için 2–5 farklı gladyatör seç.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;if not found then raise exception 'Ludus bulunamadı.';end if;
 s:=ludus_supply_private.api('state',null,1,null);
 payload:=jsonb_build_object('action',p_action,'key',p_key,'workers',p_workers,'bow',p_bows,'arrow',p_arrows,'escort',p_escort);
 select * into receipt from ludus_supply_private.departure_receipts_v122 where owner_id=u and request_id=p_request;
 if found then
  if receipt.payload<>payload then raise exception 'İşlem kimliği başka bir çıkışta kullanılmış.';end if;
  return s||jsonb_build_object('result',receipt.result||'{"replayed":true}'::jsonb);
 end if;
 if exists(select 1 from ludus_supply_private.receipts where owner_id=u and request_id=p_request)then raise exception 'İşlem kimliği başka bir çıkışta kullanılmış.';end if;
 fighters:=ludus_supply_private.fighters_v126();
 if(select count(*)from jsonb_array_elements(fighters)f where(f->>'id')::uuid=any(p_escort)and(f->>'ready')::boolean)<>cardinality(p_escort)
 then raise exception 'Savunma ekibindeki gladyatörler sana ait ve hazır olmalı.';end if;
 select coalesce(jsonb_agg(f order by array_position(p_escort,(f->>'id')::uuid)),'[]')into team from jsonb_array_elements(fighters)f where(f->>'id')::uuid=any(p_escort);
 update ludus_supply_private.stock set quantity=quantity-p_bows where owner_id=u and sku='bow'and quantity>=p_bows;
 if not found then raise exception 'Kasada yeterli yay yok.';end if;
 update ludus_supply_private.stock set quantity=quantity-p_arrows where owner_id=u and sku='arrow'and quantity>=p_arrows;
 if not found then raise exception 'Kasada yeterli ok yok.';end if;
 s:=ludus_supply_private.api(p_action,p_key,p_workers,p_request);answer:=s->'result';jid:=(answer->>'job_id')::uuid;
 update ludus_supply_private.jobs set loadout=jsonb_build_object('bow',p_bows,'arrow',p_arrows),escort=p_escort,escort_team=team where id=jid and owner_id=u;
 if not found then raise exception 'Kervan çıkışı doğrulanamadı.';end if;
 update public.ludus_gladiators set status='locked'where owner_id=u and id=any(p_escort);
 insert into ludus_supply_private.escort_members_v126(gladiator_id,job_id)select unnest(p_escort),jid;
 answer:=answer||jsonb_build_object('loadout',jsonb_build_object('bow',p_bows,'arrow',p_arrows),'escort',p_escort);
 insert into ludus_supply_private.departure_receipts_v122(owner_id,request_id,payload,result)values(u,p_request,payload,answer);
 return ludus_supply_private.api('state',null,1,null)||jsonb_build_object('result',answer);
end;$$;
create or replace function public.ludus_caravan_depart_v126(p_action text,p_key text,p_workers integer,p_request uuid,p_bows integer default 0,p_arrows integer default 0,p_escort uuid[]default '{}')
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.depart_v126(p_action,p_key,p_workers,p_request,p_bows,p_arrows,p_escort)$$;
revoke all on function ludus_supply_private.depart_v126(text,text,integer,uuid,integer,integer,uuid[]),public.ludus_caravan_depart_v126(text,text,integer,uuid,integer,integer,uuid[])from public,anon,authenticated;
grant execute on function ludus_supply_private.depart_v126(text,text,integer,uuid,integer,integer,uuid[]),public.ludus_caravan_depart_v126(text,text,integer,uuid,integer,integer,uuid[])to authenticated;

create or replace function ludus_supply_private.raid_view_v124(j ludus_supply_private.raids_v124)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',j.id,'request_id',j.request_id,'region',j.region,'team',j.team,'started_at',j.started_at,'ends_at',j.ends_at,
 'status',case when j.resolved_at is not null then 'resolved'else 'ready'end,
 'resolved_at',j.resolved_at,'success',j.success,'loot',j.loot,'delivered_at',j.delivered_at,'injured_until',j.injured_until,
 'encounter',j.encounter,'battle_started_at',j.battle_started_at,'battle_seconds',j.battle_seconds)
$$;
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
 'version',126,'attempt',n,'seed',1+floor(random()*2147483646)::integer,'guards',cardinality(j.gladiators)+case when n%4=0 then 1 else 0 end,
 'archers',1,'cargo',choices[1+floor(random()*3)::integer],'quantity',60)where id=jid;
end;$$;
revoke all on function ludus_supply_private.encounter_v126(uuid)from public,anon,authenticated;

create or replace function ludus_supply_private.raid_api_v124(p_action text,p_gladiators uuid[],p_region text,p_request uuid,p_raid uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();fighters jsonb;regions jsonb;history jsonb;active jsonb;result jsonb;team jsonb;
 j ludus_supply_private.raids_v124;cool timestamptz;aid uuid;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Kervan avı için hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','start','enter')then raise exception 'Baskın sonucu ormandaki savaş tamamlanınca kaydedilir.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;if not found then raise exception 'Ludus bulunamadı.';end if;
 perform ludus_supply_private.settle_owner_v87(u,ts);
 fighters:=ludus_supply_private.fighters_v126();
 select cooldown_until into cool from ludus_supply_private.raid_counter_v126 where owner_id=u;
 if p_action='start'then
  if p_request is null then raise exception 'İşlem kimliği gerekli.';end if;
  select * into j from ludus_supply_private.raids_v124 where owner_id=u and request_id=p_request;
  if found then
   if j.region is distinct from p_region or j.gladiators is distinct from p_gladiators then raise exception 'İşlem kimliği başka bir baskına ait.';end if;
  else
   if not ludus_supply_private.valid_team_v126(p_gladiators)then raise exception '2–5 farklı gladyatör seç.';end if;
   if exists(select 1 from ludus_supply_private.raids_v124 where owner_id=u and resolved_at is null)then raise exception 'Önce mevcut baskını tamamla.';end if;
   if cool>ts then raise exception 'Yeni baskın için bir saatlik dinlenme süresini bekle.';end if;
   if not exists(select 1 from ludus_supply_private.raid_regions_v124 where id=p_region)then raise exception 'Geçerli bir baskın bölgesi seç.';end if;
   perform 1 from public.ludus_gladiators where owner_id=u and id=any(p_gladiators)order by id for update;
   perform 1 from public.ludus_items where owner_id=u and equipped_by=any(p_gladiators)order by id for update;
   if(select count(*)from jsonb_array_elements(fighters)g where(g->>'id')::uuid=any(p_gladiators)and(g->>'ready')::boolean)<>cardinality(p_gladiators)
   then raise exception 'Seçilen gladyatörler sana ait ve hazır olmalı.';end if;
   select jsonb_agg(g order by array_position(p_gladiators,(g->>'id')::uuid))into team from jsonb_array_elements(fighters)g where(g->>'id')::uuid=any(p_gladiators);
   insert into ludus_supply_private.raids_v124(owner_id,request_id,region,gladiators,team,started_at,ends_at)
   values(u,p_request,p_region,p_gladiators,team,ts,ts)returning * into j;
   update public.ludus_gladiators set status='locked'where owner_id=u and id=any(p_gladiators);
   insert into ludus_supply_private.raid_members_v124(gladiator_id,raid_id)select unnest(p_gladiators),j.id;
   insert into ludus_supply_private.hunt_team_v122(owner_id,gladiators)values(u,p_gladiators)on conflict(owner_id)do update set gladiators=excluded.gladiators,updated_at=ts;
  end if;
 elsif p_action='enter'then
  select * into j from ludus_supply_private.raids_v124 where owner_id=u and id=p_raid for update;
  if not found then raise exception 'Baskın bulunamadı.';end if;
  if j.resolved_at is null then update ludus_supply_private.raids_v124 set battle_started_at=coalesce(battle_started_at,clock_timestamp())where id=j.id;end if;
 end if;
 for aid in select id from ludus_supply_private.raids_v124 where owner_id=u and resolved_at is null and encounter is null loop perform ludus_supply_private.encounter_v126(aid);end loop;
 perform ludus_supply_private.raid_deliver_v124(u);
 if j.id is not null then select ludus_supply_private.raid_view_v124(t)into result from ludus_supply_private.raids_v124 t where id=j.id;end if;
 select coalesce(jsonb_agg(to_jsonb(r)order by r.y,r.x),'[]')into regions from ludus_supply_private.raid_regions_v124 r;
 select ludus_supply_private.raid_view_v124(t)into active from ludus_supply_private.raids_v124 t where owner_id=u and resolved_at is null;
 select coalesce(jsonb_agg(ludus_supply_private.raid_view_v124(t)order by t.resolved_at desc,t.id),'[]')into history from(select * from ludus_supply_private.raids_v124 where owner_id=u and resolved_at is not null order by resolved_at desc,id limit 5)t;
 return jsonb_build_object('user_id',u,'server_now',clock_timestamp(),'gladiators',fighters,'team',coalesce((select to_jsonb(gladiators)from ludus_supply_private.hunt_team_v122 where owner_id=u),'[]'::jsonb),
 'regions',regions,'active',active,'history',history,'result',result,'duration_seconds',0,'cooldown_until',cool,'cooldown_seconds',3600,'recovery_seconds',43200,'reward_quantity',60,'version',126);
end;$$;

-- Only the authenticated edge verifier may submit a replayed result. There is
-- deliberately no client-callable "won" argument, amount, cargo or seed setter.
create or replace function ludus_supply_private.verified_v126(p_owner uuid,p_raid uuid,p_won boolean,p_seconds numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j ludus_supply_private.raids_v124;ts timestamptz:=clock_timestamp();
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 select * into j from ludus_supply_private.raids_v124 where id=p_raid and owner_id=p_owner for update;
 if not found then raise exception 'Baskın bulunamadı.';end if;
 if j.resolved_at is not null then return ludus_supply_private.raid_view_v124(j);end if;
 if j.encounter is null or j.battle_started_at is null or p_won is null or p_seconds is null or p_seconds<0 or p_seconds>300
 or p_seconds>extract(epoch from ts-j.battle_started_at)+3 then raise exception 'Savaş süresi doğrulanamadı.';end if;
 delete from ludus_supply_private.raid_members_v124 where raid_id=j.id;
 update public.ludus_gladiators set status=case when p_won then 'available'else 'injured'end,
 injury_level=case when p_won then injury_level else greatest(injury_level,1)end,
 injured_until=case when p_won then injured_until else ts+interval'12 hours'end where owner_id=p_owner and id=any(j.gladiators);
 update ludus_supply_private.raids_v124 set resolved_at=ts,success=p_won,battle_seconds=p_seconds,
 loot=case when p_won then jsonb_build_object(j.encounter->>'cargo',60)else '{}'::jsonb end,
 injured_until=case when not p_won then ts+interval'12 hours'end where id=j.id returning * into j;
 update ludus_supply_private.raid_counter_v126 set cooldown_until=ts+interval'1 hour'where owner_id=p_owner;
 -- Existing delivery function settles the owner's pantry; keep the verified JWT
 -- identity for its internal auth-bound food call (service role cannot choose loot).
 perform set_config('request.jwt.claim.sub',p_owner::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_owner)::text,true);
 perform ludus_supply_private.raid_deliver_v124(p_owner);
 select * into j from ludus_supply_private.raids_v124 where id=j.id;
 return ludus_supply_private.raid_view_v124(j);
end;$$;
create or replace function public.ludus_caravan_verified_v126(p_owner uuid,p_raid uuid,p_won boolean,p_seconds numeric)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.verified_v126(p_owner,p_raid,p_won,p_seconds)$$;
revoke all on function ludus_supply_private.verified_v126(uuid,uuid,boolean,numeric)from public,anon,authenticated;
grant usage on schema ludus_supply_private to service_role;
grant execute on function ludus_supply_private.verified_v126(uuid,uuid,boolean,numeric)to service_role;
revoke all on function public.ludus_caravan_verified_v126(uuid,uuid,boolean,numeric)from public,anon,authenticated;
grant execute on function public.ludus_caravan_verified_v126(uuid,uuid,boolean,numeric)to service_role;
notify pgrst,'reload schema';
