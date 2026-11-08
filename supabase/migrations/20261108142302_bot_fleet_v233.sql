-- V233: service-owned bots use real accounts, locked work and normal game RPCs.
create schema if not exists ludus_bot_private;
revoke all on schema ludus_bot_private from public,anon,authenticated;
grant usage on schema ludus_bot_private to authenticated,service_role;
create table ludus_bot_private.settings_v233 (
 id boolean primary key default true check(id), owner_id uuid references public.ludus_accounts(user_id),
 nonce uuid not null default gen_random_uuid(), scheduler_secret uuid not null default gen_random_uuid(),
 endpoint text, setup_requested boolean not null default false, ready boolean not null default false,
 enabled boolean not null default false, last_error text, updated_at timestamptz not null default clock_timestamp()
);
insert into ludus_bot_private.settings_v233(id) values(true);
create table ludus_bot_private.members_v233 (
 slot smallint primary key check(slot between 1 and 39), user_id uuid unique references public.ludus_accounts(user_id),
 clan_id uuid references public.ludus_clans(id), enabled boolean not null default true,
 next_run_at timestamptz not null default clock_timestamp(), lease uuid, lease_until timestamptz,
 battle_id uuid, state text, steps integer not null default 0 check(steps between 0 and 18000), seed bigint,
 result jsonb, last_result jsonb, last_error text, matches integer not null default 0 check(matches>=0),
 updated_at timestamptz not null default clock_timestamp()
);
insert into ludus_bot_private.members_v233(slot) select n from generate_series(1,39)n;
create index bot_next_v233 on ludus_bot_private.members_v233(next_run_at,slot) where enabled and user_id is not null;
alter table ludus_bot_private.settings_v233 enable row level security;
alter table ludus_bot_private.members_v233 enable row level security;
revoke all on ludus_bot_private.settings_v233,ludus_bot_private.members_v233 from public,anon,authenticated;

create function ludus_bot_private.name_v233(p_slot integer) returns text language sql immutable set search_path='' as $$
 select 'Ludus '||(array['Aquila','Varro','Felix','Drusus','Cassius','Titus','Lucius','Cato','Brutus','Aulus',
  'Flavius','Decimus','Gaius','Quintus','Severus','Nero','Octavius','Rufus','Maximus','Silvanus',
  'Antonius','Marcellus','Tiberius','Valerius','Fabius','Cornelius','Florus','Aurelius','Crispus','Sextus',
  'Scaurus','Paullus','Lentulus','Celsus','Rutilus','Agrippa','Cicero','Sulla','Vespasianus'])[p_slot]||' (Bot)';
$$;
create function ludus_bot_private.group_v233(p_slot integer) returns integer language sql immutable set search_path='' as $$
 select case when p_slot<=9 then 0 else (p_slot-10)/10+1 end;
$$;
create function ludus_bot_private.build_v233(p_slot integer) returns integer[] language sql stable set search_path='' as $$
 select case coalesce((select g.class from ludus_bot_private.members_v233 b
   join public.ludus_gladiators g on g.owner_id=b.user_id where b.slot=p_slot
   order by g.overall desc,g.id limit 1),'')
  when 'murmillo' then array[1,3,10,12] when 'secutor' then array[1,3,10,12]
  when 'provocator' then array[1,3,10,12] when 'thraex' then array[5,6,8,15]
  when 'retiarius' then array[3,4,14,15] when 'hoplomachus' then array[1,3,5,15]
  when 'scissor' then array[1,5,10,15] else case p_slot%4 when 0 then array[1,3,10,12]
   when 1 then array[5,6,8,15] when 2 then array[1,3,5,15] else array[3,4,10,14] end end;
$$;

-- This endpoint is reachable only by the service role, and still checks an
-- independent scheduler secret. No browser can read either secret or state.
create function public.ludus_bot_secret_v233(p_secret uuid) returns boolean language sql security definer set search_path='' as $$
 select coalesce((select scheduler_secret=p_secret from ludus_bot_private.settings_v233 where id),false);
$$;
create function public.ludus_bot_context_v233() returns jsonb language plpgsql security definer set search_path='' as $$
declare c ludus_bot_private.settings_v233;
begin
 select * into c from ludus_bot_private.settings_v233 where id;
 return jsonb_build_object('owner_id',c.owner_id,'nonce',c.nonce,'setup_requested',c.setup_requested,'ready',c.ready,'enabled',c.enabled,
  'missing',(select coalesce(jsonb_agg(jsonb_build_object('slot',slot,'name',ludus_bot_private.name_v233(slot)) order by slot),'[]'::jsonb) from (select slot from ludus_bot_private.members_v233 where user_id is null order by slot limit 10)s));
end;$$;
create function public.ludus_bot_register_v233(p_slot integer,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare c ludus_bot_private.settings_v233; row_user uuid; meta jsonb; confirmed timestamptz;
begin
 select * into c from ludus_bot_private.settings_v233 where id for update;
 if not c.setup_requested or c.ready or p_slot not between 1 and 39 or p_user is null then raise exception 'Bot kaydı doğrulanamadı.';end if;
 select raw_user_meta_data,email_confirmed_at into meta,confirmed from auth.users where id=p_user;
 if meta->>'ludus_bot_nonce' is distinct from c.nonce::text or meta->>'ludus_bot_slot' is distinct from p_slot::text or confirmed is null
  or not exists(select 1 from public.ludus_accounts where user_id=p_user) then raise exception 'Bot hesabı doğrulanamadı.';end if;
 select user_id into row_user from ludus_bot_private.members_v233 where slot=p_slot for update;
 if row_user is not null and row_user<>p_user then raise exception 'Bot yuvası başka hesaba ait.';end if;
 update ludus_bot_private.members_v233 set user_id=p_user,updated_at=clock_timestamp() where slot=p_slot;
 update ludus_bot_private.settings_v233 set last_error=null,updated_at=clock_timestamp() where id;
end;$$;

-- No existing human member or clan is moved. The three rival clans are created
-- only when every normal starter account has been successfully registered.
create function public.ludus_bot_assign_v233() returns jsonb language plpgsql security definer set search_path='' as $$
declare c ludus_bot_private.settings_v233; owner_clan uuid; clan_ids uuid[]; rival uuid; g integer; v_name text; suffix integer; leader uuid;
begin
 select * into c from ludus_bot_private.settings_v233 where id for update;
 if c.ready then return jsonb_build_object('ready',true,'replayed',true);end if;
 if not c.setup_requested or c.owner_id is null or (select count(*) from ludus_bot_private.members_v233 where user_id is not null)<>39 then raise exception 'Botlar henüz hazır değil.';end if;
 perform 1 from public.ludus_accounts where user_id=c.owner_id or user_id in(select user_id from ludus_bot_private.members_v233) order by user_id for update;
 select m.clan_id into owner_clan from public.ludus_clan_members m join public.ludus_clans k on k.id=m.clan_id where m.user_id=c.owner_id and k.leader_id=c.owner_id;
 if owner_clan is null or (select count(*) from public.ludus_clan_members where clan_id=owner_clan)<>1 then raise exception 'Liderin klanında yalnızca kendi hesabı bulunmalı.';end if;
 if exists(select 1 from public.ludus_clan_members where user_id in(select user_id from ludus_bot_private.members_v233)) then raise exception 'Bir bot başka bir klana katılmış.';end if;
 clan_ids:=array[owner_clan];
 for g in 1..3 loop
  select user_id into leader from ludus_bot_private.members_v233 where slot=10+(g-1)*10;
  v_name:=(array['Legio Aquila','Legio Invicta','Legio Fulmina'])[g];suffix:=2;
  while exists(select 1 from public.ludus_clans k where lower(btrim(k.name))=lower(v_name)) loop
   v_name:=(array['Legio Aquila','Legio Invicta','Legio Fulmina'])[g]||' '||suffix;suffix:=suffix+1;
  end loop;
  insert into public.ludus_clans(name,emblem,background,emblem_color,leader_id)
   values(v_name,(array[13,25,30])[g],(array['#682333','#263D5B','#34543F'])[g],'#E0BF74',leader) returning id into rival;
  clan_ids:=array_append(clan_ids,rival);
 end loop;
 update ludus_bot_private.members_v233 set clan_id=clan_ids[ludus_bot_private.group_v233(slot)+1];
 insert into public.ludus_clan_members(user_id,clan_id,vault_access)
  select user_id,clan_id,slot in(10,20,30) from ludus_bot_private.members_v233 order by slot;
 update ludus_bot_private.settings_v233 set ready=true,setup_requested=false,last_error=null,updated_at=clock_timestamp() where id;
 return jsonb_build_object('ready',true,'clans',4,'bots',39);
end;$$;

create function ludus_bot_private.admin_v233(p_action text default 'state',p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c ludus_bot_private.settings_v233; slot_no integer;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from public.ludus_imperial_admins where user_id=u) then
  raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501';end if;
 select * into c from ludus_bot_private.settings_v233 where id;
 if c.owner_id is not null and c.owner_id<>u then raise exception 'Bu bot grubu başka yöneticiye ait.' using errcode='42501';end if;
 if p_action='fleet' then
  update ludus_bot_private.settings_v233 set enabled=coalesce((p_data->>'enabled')::boolean,false),updated_at=clock_timestamp() where id returning * into c;
 elsif p_action='bot' then
  slot_no:=(p_data->>'slot')::integer;
  update ludus_bot_private.members_v233 set enabled=coalesce((p_data->>'enabled')::boolean,false),updated_at=clock_timestamp() where slot=slot_no;
  if not found then raise exception 'Bot bulunamadı.';end if;
 elsif p_action<>'state' then raise exception 'Bilinmeyen yönetim işlemi.';
 end if;
 return jsonb_build_object('user_id',u,'ready',c.ready,'enabled',c.enabled,'setup_requested',c.setup_requested,'error',c.last_error,
  'created',(select count(*) from ludus_bot_private.members_v233 where user_id is not null),'total',39,
  'bots',(select coalesce(jsonb_agg(jsonb_build_object('slot',b.slot,'name',coalesce(a.ludus_name,ludus_bot_private.name_v233(b.slot)),
    'clan',k.name,'enabled',b.enabled,'matches',b.matches,'last_result',b.last_result,'error',b.last_error,'active_battle',b.battle_id is not null,
    'build',ludus_bot_private.build_v233(b.slot),'gold',a.gold,'diamonds',a.diamonds) order by b.slot),'[]'::jsonb)
   from ludus_bot_private.members_v233 b left join public.ludus_accounts a on a.user_id=b.user_id left join public.ludus_clans k on k.id=b.clan_id));
end;$$;
create function public.ludus_bot_admin_v233(p_action text default 'state',p_data jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select ludus_bot_private.admin_v233(p_action,p_data) $$;
revoke all on function ludus_bot_private.name_v233(integer),ludus_bot_private.group_v233(integer),ludus_bot_private.build_v233(integer),
 ludus_bot_private.admin_v233(text,jsonb) from public,anon,authenticated;
grant execute on function ludus_bot_private.admin_v233(text,jsonb) to authenticated;
revoke all on function public.ludus_bot_secret_v233(uuid),public.ludus_bot_context_v233(),public.ludus_bot_register_v233(integer,uuid),public.ludus_bot_assign_v233() from public,anon,authenticated;
grant execute on function public.ludus_bot_secret_v233(uuid),public.ludus_bot_context_v233(),public.ludus_bot_register_v233(integer,uuid),public.ludus_bot_assign_v233() to service_role;
revoke all on function public.ludus_bot_admin_v233(text,jsonb) from public,anon;
grant execute on function public.ludus_bot_admin_v233(text,jsonb) to authenticated;

-- Claim one bot at a time. Reusing the actual game APIs preserves starter gear,
-- reward receipts, fatigue and all normal economy rules.
create function public.ludus_bot_claim_v233() returns jsonb language plpgsql security definer set search_path='' as $$
declare c ludus_bot_private.settings_v233; b ludus_bot_private.members_v233; g public.ludus_gladiators;
 ticket public.ludus_battles; slot_map jsonb; v_result jsonb; token uuid; weapon_id uuid; choice text; gem integer; previous_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),'');
begin
 select * into c from ludus_bot_private.settings_v233 where id;
 if not c.ready or not c.enabled then return jsonb_build_object('idle',true);end if;
 select * into b from ludus_bot_private.members_v233 where enabled and user_id is not null and next_run_at<=clock_timestamp()
  and (lease is null or lease_until<clock_timestamp())
  order by case when battle_id is not null and exists(select 1 from public.ludus_battles q
    where q.id=battle_id and q.started_at<clock_timestamp()-interval '50 minutes') then 0 else 1 end,
   next_run_at,slot for update skip locked limit 1;
 if not found then return jsonb_build_object('idle',true);end if;
 begin
 perform set_config('request.jwt.claim.sub',b.user_id::text,true);
 if b.result is not null then
  select * into ticket from public.ludus_battles where id=b.battle_id and owner_id=b.user_id;
  if not found then raise exception 'Bot savaşı bulunamadı.';end if;
  if ticket.started_at>clock_timestamp()-interval '10 seconds' then
   update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()+interval '15 seconds' where slot=b.slot;
   perform set_config('request.jwt.claim.sub',previous_sub,true);return jsonb_build_object('waiting',true);
  end if;
  v_result:=public.ludus_finish_battle_v2(b.battle_id,coalesce((b.result->>'won')::boolean,false),b.result->'stats');
  update ludus_bot_private.members_v233 set matches=matches+1,last_result=jsonb_build_object('won',(b.result->>'won')::boolean,'reward',v_result,'at',clock_timestamp()),
   battle_id=null,state=null,steps=0,seed=null,result=null,lease=null,lease_until=null,last_error=null,
   next_run_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() where slot=b.slot;
  perform set_config('request.jwt.claim.sub',previous_sub,true);return jsonb_build_object('finished',true,'slot',b.slot);
 end if;
 if b.battle_id is null then
  perform ludus_private.v7_settle(b.user_id);
  select * into g from public.ludus_gladiators x where x.owner_id=b.user_id and x.status='available' and x.fatigue_value<100
   and (x.injured_until is null or x.injured_until<=clock_timestamp()) and (x.training_ends_at is null or x.training_ends_at<=clock_timestamp())
   and x.clan_roster_id is null and not exists(select 1 from public.ludus_battles q where q.owner_id=b.user_id and q.finished_at is null)
   order by x.overall desc,x.id limit 1;
  if not found then
   update ludus_bot_private.members_v233 set next_run_at=clock_timestamp()+interval '10 minutes',last_error='Hazır gladyatör bekleniyor.' where slot=b.slot;
   perform set_config('request.jwt.claim.sub',previous_sub,true);return jsonb_build_object('waiting',true);
  end if;
  select coalesce(jsonb_object_agg(i.equipped_slot,i.id),'{}'::jsonb) into slot_map from public.ludus_items i
   where i.owner_id=b.user_id and i.equipped_by=g.id and i.equipped_slot is not null and i.locked_battle_id is null
    and i.clan_vault_id is null and i.clan_roster_id is null and i.market_listing_id is null
    and (i.equipped_slot<>'main_hand' or i.model in('gladius','sica','spear','trident','whip','heavy_mace','warhammer','halberd','trident_gladiator'));
  if not(slot_map ? 'main_hand') then
   select i.id into weapon_id from public.ludus_items i where i.owner_id=b.user_id and i.equipped_by is null and i.kind='weapon'
    and i.model in('gladius','sica','spear','trident','whip','heavy_mace','warhammer','halberd','trident_gladiator')
    and i.locked_battle_id is null and i.clan_vault_id is null and i.clan_roster_id is null and i.market_listing_id is null
    order by i.enhancement desc,i.created_at,i.id limit 1;
   if weapon_id is null and (select gold>=100 from public.ludus_accounts where user_id=b.user_id) then
    choice:=case g.class when 'thraex' then 'sica' when 'hoplomachus' then 'spear' when 'retiarius' then 'trident' else 'gladius' end;
    v_result:=public.ludus_buy_basic(choice,gen_random_uuid());weapon_id:=(v_result->>'item_id')::uuid;
   end if;
   if weapon_id is not null then slot_map:=slot_map||jsonb_build_object('main_hand',weapon_id);end if;
  else weapon_id:=(slot_map->>'main_hand')::uuid;
  end if;
  if weapon_id is not null then
   -- Spend earned stones only on this bot's chosen four-stone build.
   select s.stone_id into gem from public.ludus_stones s join public.ludus_items i on i.id=weapon_id
    where s.owner_id=b.user_id and s.family='emerald' and s.quantity>0 and s.stone_id=any(ludus_bot_private.build_v233(b.slot))
     and jsonb_array_length(i.emeralds)<4 and not exists(select 1 from jsonb_array_elements(i.emeralds) e where (e->>'id')::integer=s.stone_id)
    order by array_position(ludus_bot_private.build_v233(b.slot),s.stone_id) limit 1;
   if gem is not null then perform public.ludus_upgrade_item_v10(weapon_id,'emerald',gem,gen_random_uuid());end if;
   if exists(select 1 from public.ludus_items i join public.ludus_accounts a on a.user_id=i.owner_id
     where i.id=weapon_id and i.stat_version=10 and i.enhancement<4 and a.diamonds>0) then
    perform public.ludus_upgrade_item_v10(weapon_id,'enhance',null,gen_random_uuid());
   end if;
  end if;
  v_result:=public.ludus_start_battle_v2(g.id,'4x5',slot_map,gen_random_uuid());
  update ludus_bot_private.members_v233 set battle_id=(v_result->>'id')::uuid,state=null,steps=0,seed=floor(random()*2147483647)::bigint,last_error=null where slot=b.slot returning * into b;
 end if;
 select * into ticket from public.ludus_battles where id=b.battle_id and owner_id=b.user_id and finished_at is null;
 if not found then raise exception 'Bot savaş bileti bulunamadı.';end if;
 token:=gen_random_uuid();
 update ludus_bot_private.members_v233 set lease=token,lease_until=clock_timestamp()+interval '90 seconds',next_run_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() where slot=b.slot;
 perform set_config('request.jwt.claim.sub',previous_sub,true);
 return jsonb_build_object('slot',b.slot,'lease',token,'battle',b.battle_id,'seed',b.seed,'steps',b.steps,'state',b.state,
  'ticket',case when b.state is null then to_jsonb(ticket) else null end);
 exception when others then
  perform set_config('request.jwt.claim.sub',previous_sub,true);
  update ludus_bot_private.members_v233 set lease=null,lease_until=null,last_error=left(sqlerrm,200),
   next_run_at=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where slot=b.slot;
  return jsonb_build_object('fault',true,'slot',b.slot);
 end;
end;$$;
create function public.ludus_bot_save_v233(p_slot integer,p_lease uuid,p_battle uuid,p_state text,p_steps integer,p_result jsonb default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare b ludus_bot_private.members_v233;
begin
 select * into b from ludus_bot_private.members_v233 where slot=p_slot for update;
 if not found or b.lease is distinct from p_lease or b.battle_id is distinct from p_battle or b.lease_until<clock_timestamp() then raise exception 'Bot görevi geçersiz veya sona ermiş.';end if;
 if p_steps is null or p_steps<b.steps or p_steps>b.steps+500 or p_steps>18000 or length(coalesce(p_state,''))>300000 then raise exception 'Bot savaş ilerleyişi geçersiz.';end if;
 if p_result is not null and (jsonb_typeof(p_result)<>'object' or jsonb_typeof(p_result->'won')<>'boolean' or jsonb_typeof(p_result->'stats')<>'object') then raise exception 'Bot savaş sonucu geçersiz.';end if;
 if p_result is null and (p_state is null or length(p_state)=0) then raise exception 'Bot savaş durumu eksik.';end if;
 update ludus_bot_private.members_v233 set state=case when p_result is null then p_state else null end,steps=p_steps,result=p_result,
  lease=null,lease_until=null,last_error=null,updated_at=clock_timestamp() where slot=p_slot;
 return true;
end;$$;
create function public.ludus_bot_fault_v233(p_slot integer,p_lease uuid,p_error text) returns void
language plpgsql security definer set search_path='' as $$
begin
 update ludus_bot_private.members_v233 set lease=null,lease_until=null,last_error=left(coalesce(p_error,'Bot işlemi başarısız.'),200),
  next_run_at=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where slot=p_slot and lease=p_lease;
end;$$;
revoke all on function public.ludus_bot_claim_v233(),public.ludus_bot_save_v233(integer,uuid,uuid,text,integer,jsonb),public.ludus_bot_fault_v233(integer,uuid,text) from public,anon,authenticated;
grant execute on function public.ludus_bot_claim_v233(),public.ludus_bot_save_v233(integer,uuid,uuid,text,integer,jsonb),public.ludus_bot_fault_v233(integer,uuid,text) to service_role;

create function public.ludus_bot_install_v233(p_owner uuid,p_endpoint text,p_start boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare c ludus_bot_private.settings_v233;
begin
 if not exists(select 1 from public.ludus_imperial_admins where user_id=p_owner) or not exists(
  select 1 from public.ludus_clan_members m join public.ludus_clans k on k.id=m.clan_id where m.user_id=p_owner and k.leader_id=p_owner) then
  raise exception 'Klan lideri yönetici hesabı gerekli.';end if;
 if p_endpoint !~ '^https://[a-z0-9-]+[.]supabase[.]co/functions/v1/bot-runner-v233$' then raise exception 'Bot sunucusu doğrulanamadı.';end if;
 select * into c from ludus_bot_private.settings_v233 where id for update;
 if c.owner_id is not null and c.owner_id<>p_owner then raise exception 'Bot grubu başka yöneticiye bağlı.';end if;
 update ludus_bot_private.settings_v233 set owner_id=p_owner,endpoint=p_endpoint,setup_requested=coalesce(p_start,false) and not ready,
  enabled=coalesce(p_start,false),last_error=null,updated_at=clock_timestamp() where id;
 return true;
end;$$;
revoke all on function public.ludus_bot_install_v233(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.ludus_bot_install_v233(uuid,text,boolean) to service_role;

create function public.ludus_bot_setup_error_v233(p_error text) returns void language sql security definer set search_path='' as $$
 update ludus_bot_private.settings_v233 set last_error=left(coalesce(p_error,'Bot kurulumu başarısız.'),200),updated_at=clock_timestamp() where id;
$$;
revoke all on function public.ludus_bot_setup_error_v233(text) from public,anon,authenticated;
grant execute on function public.ludus_bot_setup_error_v233(text) to service_role;

-- Production scheduling: test runners without pg_net omit this section.
create extension if not exists pg_net;
create function ludus_bot_private.schedule_v233() returns void language plpgsql security definer set search_path='' as $$
declare c ludus_bot_private.settings_v233; i integer;
begin
 select * into c from ludus_bot_private.settings_v233 where id;
 if c.endpoint is null or not(c.setup_requested or (c.ready and c.enabled)) then return;end if;
 -- Setup uses one request; after setup two independent bounded tasks a minute
 -- keep resumable battles inside the normal two-hour settlement window.
 for i in 1..case when c.ready then 2 else 1 end loop
  perform net.http_post(url:=c.endpoint,headers:=jsonb_build_object('Content-Type','application/json','X-Bot-Scheduler',c.scheduler_secret::text),
   body:='{}'::jsonb,timeout_milliseconds:=25000);
 end loop;
end;$$;
revoke all on function ludus_bot_private.schedule_v233() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_namespace where nspname='cron') then
  perform cron.schedule('ludus-bots-v233','* * * * *','select ludus_bot_private.schedule_v233()');
 end if;
end $$;
