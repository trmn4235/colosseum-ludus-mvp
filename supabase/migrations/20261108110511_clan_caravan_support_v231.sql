-- V231: one clan member may take control of a caravan defense. Roll out last.
alter table ludus_worker_private.defense_config_v230 add column clan_support boolean not null default false;
alter table ludus_worker_private.defenses_v230
 add column clan_id uuid references public.ludus_clans(id) on delete set null,
 add column defender_id uuid references public.ludus_accounts(user_id) on delete set null,
 add column defender_gladiator uuid references public.ludus_gladiators(id) on delete set null,
 add column owner_ludus text,
 add column defender_ludus text,
 add column battle_completed boolean not null default false,
 add column glory_units smallint not null default 0 check(glory_units in (0,1));
update ludus_worker_private.defenses_v230 d set owner_ludus=a.ludus_name,
 defender_id=case when d.battle_started_at is not null then d.owner_id end,
 defender_ludus=case when d.battle_started_at is not null then a.ludus_name end
 from public.ludus_accounts a where a.user_id=d.owner_id;
-- Existing trips retain their original owner-only scope.
create index defense_clan_active_v231 on ludus_worker_private.defenses_v230(clan_id,starts_at) where status<>'resolved';
create index defense_helper_history_v231 on ludus_worker_private.defenses_v230(defender_id,starts_at desc) where defender_id is not null;
create table ludus_worker_private.clan_glory_v231 (
 defense_id uuid primary key,
 clan_id uuid not null references public.ludus_clans(id) on delete cascade,
 owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,
 units smallint not null default 1 check(units=1),
 created_at timestamptz not null default clock_timestamp()
);
create index clan_glory_member_v231 on ludus_worker_private.clan_glory_v231(clan_id,owner_id);
alter table ludus_worker_private.clan_glory_v231 enable row level security;
revoke all on ludus_worker_private.clan_glory_v231 from public,anon,authenticated;

create function ludus_worker_private.defense_identity_v231()
returns trigger language plpgsql set search_path='' as $$
begin
 select ludus_name into new.owner_ludus from public.ludus_accounts where user_id=new.owner_id;
 if (select clan_support from ludus_worker_private.defense_config_v230 where id) then
  select clan_id into new.clan_id from public.ludus_clan_members where user_id=new.owner_id;
 end if;
 return new;
end;$$;
revoke all on function ludus_worker_private.defense_identity_v231() from public,anon,authenticated;
create trigger defense_identity_v231 before insert on ludus_worker_private.defenses_v230
 for each row execute function ludus_worker_private.defense_identity_v231();

create function ludus_worker_private.clan_help_allowed_v231(p_actor uuid,p_owner uuid,p_clan uuid)
returns boolean language sql stable set search_path='' as $$
 select p_actor<>p_owner and p_clan is not null and exists(
  select 1 from public.ludus_clan_members a join public.ludus_clan_members o on o.clan_id=a.clan_id
  where a.user_id=p_actor and o.user_id=p_owner and a.clan_id=p_clan
 ) and (select clan_support from ludus_worker_private.defense_config_v230 where id);
$$;
revoke all on function ludus_worker_private.clan_help_allowed_v231(uuid,uuid,uuid) from public,anon,authenticated;

create function ludus_worker_private.finish_clan_help_v231()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='resolved' and old.status<>'resolved' and new.defender_id is not null and new.defender_id<>new.owner_id then
  -- Existing escort reservations also protect equipment and all other game modes.
  delete from ludus_supply_private.escort_members_v126 where job_id=new.id and gladiator_id=new.defender_gladiator;
  update public.ludus_gladiators set status='available' where id=new.defender_gladiator and owner_id=new.defender_id and status='locked';
  if new.battle_completed and not new.automatic and new.clan_id is not null then
   insert into ludus_worker_private.clan_glory_v231(defense_id,clan_id,owner_id) values(new.id,new.clan_id,new.defender_id) on conflict do nothing;
   if found then new.glory_units:=1;end if;
  end if;
 end if;
 return new;
end;$$;
revoke all on function ludus_worker_private.finish_clan_help_v231() from public,anon,authenticated;
create trigger finish_clan_help_v231 before update of status on ludus_worker_private.defenses_v230
 for each row execute function ludus_worker_private.finish_clan_help_v231();

alter table ludus_message_private.notifications_v108 drop constraint notifications_v108_target_check;
alter table ludus_message_private.notifications_v108 add constraint notifications_v108_target_check
 check(target in ('missions','training','market','upgrades','levels','supply','guild','workers'));
create function ludus_worker_private.sync_defense_notifications_v231(p_actor uuid)
returns void language plpgsql set search_path='' as $$
begin
 if p_actor is null or p_actor is distinct from auth.uid() then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
 insert into ludus_message_private.notifications_v108(owner_id,event_key,kind,title,body,target,created_at)
 select p_actor,'clan-defense:'||d.id,'guild','Klan kervanı saldırı altında',
  coalesce(d.owner_ludus,'Klan arkadaşın')||' yardım bekliyor. İşçiler → Seferler bölümünden savunmaya katıl.',
  'workers',d.starts_at
 from ludus_worker_private.defenses_v230 d
 where d.status='ready' and d.starts_at<=clock_timestamp() and d.deadline>clock_timestamp()
  and ludus_worker_private.clan_help_allowed_v231(p_actor,d.owner_id,d.clan_id)
 on conflict(owner_id,event_key) do nothing;
end;$$;
revoke all on function ludus_worker_private.sync_defense_notifications_v231(uuid) from public,anon,authenticated;

create or replace function ludus_worker_private.defense_api_v230(p_action text default 'state',p_id uuid default null,p_gladiator uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); target_owner uuid; my_clan uuid; d ludus_worker_private.defenses_v230;
 j ludus_supply_private.jobs;f jsonb;team_json jsonb;answer jsonb;rows_json jsonb;clan_json jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Hesabına giriş yap.' using errcode='42501';end if;
 if p_action is null or p_action not in ('state','enter') then raise exception 'Geçersiz savunma işlemi.';end if;
 if not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Ludus bulunamadı.' using errcode='42501';end if;
 if p_action='enter' then
  select owner_id into target_owner from ludus_worker_private.defenses_v230 where id=p_id;
  if target_owner is null then raise exception 'Aktif kervan saldırısı bulunamadı.';end if;
  -- Fail fast instead of waiting on a reciprocal A-helps-B / B-helps-A lock.
  perform 1 from public.ludus_accounts where user_id in (u,target_owner) order by user_id for update nowait;
  perform 1 from public.ludus_clan_members where user_id in (u,target_owner) order by user_id for share nowait;
  select * into d from ludus_worker_private.defenses_v230 where id=p_id;
  if u<>target_owner and u is distinct from d.defender_id and not ludus_worker_private.clan_help_allowed_v231(u,target_owner,d.clan_id) then
   raise exception 'Yalnız kendi kervanını veya aynı klandaki arkadaşını savunabilirsin.' using errcode='42501';
  end if;
  perform ludus_supply_private.settle_owner_v87(target_owner,clock_timestamp());
  select * into j from ludus_supply_private.jobs where id=p_id for update;
  select * into d from ludus_worker_private.defenses_v230 where id=p_id for update;
  if d.starts_at>clock_timestamp() then raise exception 'Aktif kervan saldırısı bulunamadı.';end if;
  if d.status='fighting' and u is distinct from coalesce(d.defender_id,d.owner_id) then
   raise exception 'Bu savunmayı başka bir ludus üstlendi.';
  end if;
  if d.status='ready' then
   if d.deadline<=clock_timestamp() or j.claimed_at is not null then raise exception 'Kurtarma süresi sona erdi.';end if;
   if u=target_owner and jsonb_array_length(j.escort_team)>0 then
    select value into f from jsonb_array_elements(j.escort_team) where (value->>'id')::uuid=coalesce(p_gladiator,(j.escort_team->0->>'id')::uuid);
    if f is null then raise exception 'Kervandaki savunmacılardan birini seç.';end if;
    select jsonb_agg(value order by (value->>'id'=f->>'id') desc,ordinality) into team_json from jsonb_array_elements(j.escort_team) with ordinality;
   else
    -- Lock before taking the authoritative readiness/equipment snapshot.
    perform 1 from public.ludus_gladiators where owner_id=u order by id for update nowait;
    select value into f from jsonb_array_elements(ludus_supply_private.fighters_v126()) where (value->>'ready')::boolean and (p_gladiator is null or (value->>'id')::uuid=p_gladiator) limit 1;
    if f is null then raise exception 'Savunma için hazır bir gladyatör gerekli.';end if;
    update public.ludus_gladiators set status='locked' where id=(f->>'id')::uuid and owner_id=u;
    insert into ludus_supply_private.escort_members_v126(gladiator_id,job_id) values((f->>'id')::uuid,j.id);
    team_json:=jsonb_build_array(f)||j.escort_team;
    if u=target_owner then update ludus_supply_private.jobs set escort=array[(f->>'id')::uuid],escort_team=team_json where id=j.id;end if;
   end if;
   update ludus_worker_private.defenses_v230 set status='fighting',team=team_json,
    defender_id=u,defender_gladiator=(f->>'id')::uuid,defender_ludus=(select ludus_name from public.ludus_accounts where user_id=u),
    battle_started_at=clock_timestamp(),deadline=greatest(deadline,clock_timestamp()+interval '10 minutes') where id=d.id returning * into d;
  end if;
  answer:=to_jsonb(d);
 else
  perform ludus_supply_private.settle_owner_v87(u,clock_timestamp());
 end if;
 perform ludus_worker_private.sync_defense_notifications_v231(u);
 select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('cargo',job_row.cargo,'destination',job_row.destination,'escort_team',job_row.escort_team,
   'can_enter',x.status='ready' and (x.owner_id=u or ludus_worker_private.clan_help_allowed_v231(u,x.owner_id,x.clan_id)),
   'can_resume',x.status='fighting' and coalesce(x.defender_id,x.owner_id)=u) order by x.starts_at desc),'[]') into rows_json
 from (select * from ludus_worker_private.defenses_v230 where starts_at<=clock_timestamp() and
  (owner_id=u or defender_id=u or (status<>'resolved' and deadline>clock_timestamp() and ludus_worker_private.clan_help_allowed_v231(u,owner_id,clan_id)))
  order by (status<>'resolved') desc,starts_at desc limit 40)x join ludus_supply_private.jobs job_row on job_row.id=x.id;
 select clan_id into my_clan from public.ludus_clan_members where user_id=u;
 if my_clan is not null then
  select jsonb_build_object('name',c.name,'defense_glory',coalesce((select sum(units)::numeric/10 from ludus_worker_private.clan_glory_v231 where clan_id=my_clan),0),
   'my_defense_glory',coalesce((select sum(units)::numeric/10 from ludus_worker_private.clan_glory_v231 where clan_id=my_clan and owner_id=u),0)) into clan_json from public.ludus_clans c where c.id=my_clan;
 end if;
 return jsonb_build_object('user_id',u,'version',230,'clan_support_version',231,'enabled',(select enabled from ludus_worker_private.defense_config_v230 where id),
  'server_now',clock_timestamp(),'encounters',rows_json,'gladiators',ludus_supply_private.fighters_v126(),'result',answer,'clan',clan_json);
exception when lock_not_available then raise exception 'Bu ekipte başka bir işlem sürüyor. Birkaç saniye sonra tekrar dene.' using errcode='P0001';
end;$$;

create function ludus_worker_private.verified_clan_defense_v231(p_owner uuid,p_actor uuid,p_id uuid,p_won boolean,p_seconds numeric,p_arrows_used integer,p_completed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d ludus_worker_private.defenses_v230;
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 perform 1 from ludus_supply_private.jobs where id=p_id and owner_id=p_owner for update;
 select * into d from ludus_worker_private.defenses_v230 where id=p_id and owner_id=p_owner for update;
 if not found or p_actor is null or p_actor is distinct from coalesce(d.defender_id,d.owner_id) then raise exception 'Savunmayı üstlenen ludus doğrulanamadı.' using errcode='42501';end if;
 if d.status='resolved' then return to_jsonb(d);end if;
 if p_completed is null or (p_completed and (p_seconds is null or p_seconds<=0)) or (p_won and not p_completed) then raise exception 'Tamamlanan savaş doğrulanamadı.';end if;
 update ludus_worker_private.defenses_v230 set battle_completed=p_completed where id=p_id;
 return ludus_worker_private.resolve_defense_v230(p_owner,p_id,p_won,false,p_seconds,p_arrows_used);
end;$$;
create function public.ludus_caravan_defense_verified_v231(p_owner uuid,p_actor uuid,p_id uuid,p_won boolean,p_seconds numeric,p_arrows_used integer,p_completed boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_worker_private.verified_clan_defense_v231(p_owner,p_actor,p_id,p_won,p_seconds,p_arrows_used,p_completed);
$$;
revoke all on function ludus_worker_private.verified_clan_defense_v231(uuid,uuid,uuid,boolean,numeric,integer,boolean),
 public.ludus_caravan_defense_verified_v231(uuid,uuid,uuid,boolean,numeric,integer,boolean) from public,anon,authenticated;
grant execute on function ludus_worker_private.verified_clan_defense_v231(uuid,uuid,uuid,boolean,numeric,integer,boolean),
 public.ludus_caravan_defense_verified_v231(uuid,uuid,uuid,boolean,numeric,integer,boolean) to service_role;

CREATE OR REPLACE FUNCTION ludus_message_private.sync_notifications_v108(u uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare ts timestamptz:=clock_timestamp(); cutoff timestamptz:=ts-interval '30 days';
begin
 if auth.uid() is null or auth.uid()<>u then raise exception 'Giriş gerekiyor.';end if;
 insert into ludus_message_private.notifications_v108(owner_id,event_key,kind,title,body,target,created_at)
 select u,'mission:'||a.id,'mission','Görev tamamlandı',coalesce(a.mission->>'title','İmparator görevi'),'missions',a.ends_at
 from public.ludus_imperial_assignments a where a.owner_id=u and a.ends_at between cutoff and ts
 union all
 select u,'training:'||t.id,'training','Antrenman tamamlandı',coalesce(g.name,'Gladyatör')||' çalışmasını tamamladı.','training',t.train_until
 from public.ludus_training_sessions t left join public.ludus_gladiators g on g.id=t.gladiator_id
 where t.owner_id=u and t.train_until<=ts and t.rest_until>=cutoff
 union all
 select u,'rest:'||t.id,'gladiator','Dinlenme tamamlandı',coalesce(g.name,'Gladyatör')||' antrenman sonrası dinlenmesini tamamladı.','training',t.rest_until
 from public.ludus_training_sessions t left join public.ludus_gladiators g on g.id=t.gladiator_id
 where t.owner_id=u and t.rest_until between cutoff and ts
 union all
 select u,'sale:'||m.id,'market',case when m.asset_type='gladiator' then 'Gladyatör satıldı' else 'İtem satıldı' end,
 coalesce(m.snapshot->>'name',(select c.name from public.ludus_shop_catalog c where c.model=m.model and c.kind=m.kind limit 1),'Eşya')
 ||case when m.asset_type='item' then ' +'||m.enhancement else '' end||' · '||coalesce(m.net_income,0)||' denarius','market',m.sold_at
 from ludus_private.market_listings_v66 m where m.seller_id=u and m.status='sold' and m.sold_at between cutoff and ts
 union all
 select u,'upgrade:'||r.request_id,'upgrade',case when coalesce((r.result->>'success')::boolean,false) then 'Geliştirme başarılı' else 'Geliştirme sonucu' end,
 case when coalesce((r.result->>'destroyed')::boolean,false) then 'Geliştirme sırasında eşya yok oldu.'
 when coalesce((r.result->>'success')::boolean,false) then 'Ekipmanın +'||coalesce(r.result->>'plus','0')||' seviyesine ulaştı.' else 'Geliştirme başarılı olmadı.' end,'upgrades',r.created_at
 from public.ludus_upgrade_receipts r where r.owner_id=u and r.action='enhance' and r.created_at between cutoff and ts
 union all
 select u,'level:'||r.level,'reward','Seviye ödülü açıldı','Ludus seviye '||r.level||' ödülü.','levels',r.unlocked_at
 from ludus_private.level_rewards r where r.owner_id=u and (r.unlocked_at>=cutoff or r.claimed_at is null)
 union all
 select u,'supply:'||j.id,'supply','Tedarik teslim edildi','Tedarik seferinden gelen '||ludus_message_private.cargo_text_v128(j.cargo)||' depomuza taşındı.','supply',j.claimed_at
 from ludus_supply_private.jobs j join ludus_supply_private.destinations d on d.id=j.destination
 where j.owner_id=u and j.claimed_at between cutoff and ts
 union all
 select u,'raid:'||r.id,'supply','Kervan ganimeti depoya taşındı',
 'Kervan baskınından elde edilen '||ludus_message_private.cargo_text_v128(r.loot)||' depomuza taşındı.','supply',r.delivered_at
 from ludus_supply_private.raids_v124 r where r.owner_id=u and r.success and r.delivered_at between cutoff and ts
 union all
 select u,'guild:'||c.id,'guild','Yeni guild duyurusu',c.body,'guild',c.created_at
 from ludus_message_private.channels_v108 c join public.ludus_clan_members m on m.clan_id=c.clan_id and m.user_id=u
 where c.announcement and c.sender_id<>u and c.created_at>=greatest(cutoff,m.joined_at) and c.created_at<=ts
 on conflict(owner_id,event_key) do nothing;
 perform ludus_worker_private.sync_defense_notifications_v231(u);
end $function$
;
notify pgrst,'reload schema';
