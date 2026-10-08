create role anon;create role authenticated;create role service_role;create schema auth;create schema ludus_private;create schema private;
create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.ludus_accounts(user_id uuid primary key,gold integer default 0,diamonds integer default 0,wins integer default 0,losses integer default 0,stones_version integer default 0);
create table public.ludus_gladiators(id uuid default gen_random_uuid(),owner_id uuid,name text,class text,level integer default 1,experience bigint default 0,base_stats jsonb default '{"health": 100, "agility": 10, "defense": 10, "stamina": 100, "strength": 10, "technique": 10}'::jsonb,fatigue integer default 0,injury_level integer default 0,injured_until timestamp with time zone,training_type text,training_ends_at timestamp with time zone,status text default 'available'::text,created_at timestamp with time zone default now(),wins_4x5 integer default 0,wins_solo20 integer default 0,overall integer default 50,stat_version integer default 0,legacy_base_stats jsonb,training_week_start date,perfect_weeks integer default 0,training_policy_pending boolean default false,clan_roster_id uuid);
alter table public.ludus_gladiators add primary key(id);
create table public.ludus_training_sessions(id uuid,owner_id uuid,gladiator_id uuid,training_day date,started_at timestamp with time zone default now(),train_until timestamp with time zone,rest_until timestamp with time zone);
alter table public.ludus_training_sessions add primary key(id);
create table public.ludus_battles(id uuid default gen_random_uuid(),owner_id uuid,gladiator_id uuid,mode text,snapshot jsonb,started_at timestamp with time zone default now(),finished_at timestamp with time zone,won boolean,reward jsonb,stats jsonb,rule_version integer default 1,start_request_id uuid,loot jsonb default '[]'::jsonb);
alter table public.ludus_battles add primary key(id);
create table public.ludus_battle_receipts(battle_id uuid,owner_id uuid,reward jsonb,finished_at timestamp with time zone);
alter table public.ludus_battle_receipts add primary key(battle_id);
alter table public.ludus_training_sessions add unique(gladiator_id,training_day);
create unique index battle_request_unique on public.ludus_battles(owner_id,start_request_id);
create table public.ludus_clan_rosters(id uuid primary key,state text);
create table public.ludus_clan_roster_entries(roster_id uuid,gladiator_id uuid);
create table public.ludus_imperial_assignments(id uuid primary key default gen_random_uuid(),owner_id uuid,mission jsonb,gladiators jsonb,started_at timestamptz default now(),ends_at timestamptz,completed_at timestamptz);
create table public.ludus_imperial_members(assignment_id uuid,gladiator_id uuid,active boolean default true);
create table public.ludus_matches(id uuid primary key default gen_random_uuid(),status text default 'waiting',players jsonb default '[]',starts_at timestamptz,winner uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.ludus_duels(id uuid primary key default gen_random_uuid(),host_id uuid,guest_id uuid,host_g uuid,guest_g uuid,status text default 'waiting',a jsonb,b jsonb,winner uuid,created_at timestamptz default now(),updated_at timestamptz default now(),a_at timestamptz,b_at timestamptz,a_hit timestamptz,b_hit timestamptz);
create table public.ludus_items(id uuid primary key default gen_random_uuid(),owner_id uuid,kind text,model text,enhancement integer default 0,base_stats jsonb default '{}',sapphires jsonb default '[]',rubies jsonb default '[]',equipped_by uuid,equipped_slot text,stat_version integer default 10,natural_rule_version integer default 2,natural_stats jsonb default '{}',natural_percentages jsonb default '{}',emeralds jsonb default '[]',certus_used boolean default false,locked_battle_id uuid,clan_vault_id uuid,clan_roster_id uuid);
create function ludus_private.item_v10(text)returns jsonb language sql as $$select '{}'::jsonb$$;
create function ludus_private.win_stone_v10(uuid)returns jsonb language sql as $$select '{"name":"Safir"}'::jsonb$$;
CREATE OR REPLACE FUNCTION ludus_private.imperial_settle(p_owner uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
 if auth.uid() is null or auth.uid()<>p_owner then raise exception 'Giriş gerekiyor.';end if;
 for r in select id from public.ludus_imperial_assignments where owner_id=p_owner and completed_at is null and ends_at<=clock_timestamp()order by ends_at for update loop
  update public.ludus_gladiators set status='available'where owner_id=p_owner and status='locked'and id in(select gladiator_id from public.ludus_imperial_members where assignment_id=r.id and active);
  update public.ludus_imperial_members set active=false where assignment_id=r.id;
  update public.ludus_imperial_assignments set completed_at=ends_at where id=r.id;
 end loop;
end;$function$
;
CREATE OR REPLACE FUNCTION public.ludus_finish_battle_v2(p_battle uuid, p_won boolean, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();b public.ludus_battles;kv record;entry jsonb;it jsonb;tokens text[]:='{}';exits jsonb;keep uuid[]:='{}';iid uuid;newids jsonb:='[]';kind text;model text;prize jsonb:='{}';alive boolean;typed_stone jsonb;
begin
 if uid is null then raise exception 'Giriş gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;
 select reward into prize from public.ludus_battle_receipts where battle_id=p_battle and owner_id=uid;
 if found then return prize;end if;
 prize:='{}';
 select * into b from public.ludus_battles where id=p_battle and owner_id=uid for update;
 if not found or b.rule_version<>2 then raise exception 'Savaş kaydı bulunamadı veya eski sürüm';end if;
 if b.finished_at is not null then return coalesce(b.reward,'{}');end if;
 if coalesce(p_won,false) and now()<b.started_at+interval '10 seconds' then raise exception 'Savaş süresi doğrulanamadı';end if;
 if now()>b.started_at+interval '2 hours' then p_won:=false;end if;
 alive:=coalesce((p_stats->>'alive')::boolean,false);
 exits:=case when p_won and alive then coalesce(p_stats->'exit_slots','{}') else '{}'::jsonb end;
 if jsonb_typeof(exits)<>'object' then raise exception 'Çıkış ekipmanı geçersiz';end if;
 for kv in select * from jsonb_each_text(exits) loop
  if kv.key not in ('main_hand','off_hand','helmet','chest','gloves','legs') then raise exception 'Geçersiz çıkış yuvası';end if;
  if kv.value is null then continue;end if;
  if kv.value=any(tokens) then raise exception 'Aynı eşya iki kez alınamaz';end if;
  select value into entry from jsonb_array_elements(b.loot) where value->>'token'=kv.value;
  if not found then raise exception 'Bu eşya savaşta yok';end if;
  it:=entry->'item';
  if not ((kv.key='main_hand' and it->>'kind'='weapon' and it->>'model' in ('gladius','sica','spear','trident','mace','whip')) or (kv.key='off_hand' and it->>'kind' in ('weapon','shield')) or (kv.key=it->>'kind' and kv.key in ('helmet','chest','gloves','legs'))) then raise exception 'Çıkış ekipmanı yuvaya uymuyor';end if;
  tokens:=array_append(tokens,kv.value);
  if entry->>'inventory_id' is not null then keep:=array_append(keep,(entry->>'inventory_id')::uuid);end if;
 end loop;
 -- The carried-in set is replaced atomically by the living winner's carried-out set.
 delete from public.ludus_items where owner_id=uid and locked_battle_id=b.id and not(id=any(keep));
 update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=uid and locked_battle_id=b.id;
 for kv in select * from jsonb_each_text(exits) loop
  if kv.value is null then continue;end if;
  select value into entry from jsonb_array_elements(b.loot) where value->>'token'=kv.value;it:=entry->'item';
  if entry->>'inventory_id' is not null then
   iid:=(entry->>'inventory_id')::uuid;
   update public.ludus_items set locked_battle_id=null,equipped_by=b.gladiator_id,equipped_slot=kv.key where id=iid and owner_id=uid and locked_battle_id=b.id;
   if not found then raise exception 'Eşya kilidi doğrulanamadı';end if;
  else
   insert into public.ludus_items(owner_id,kind,model,enhancement,base_stats,sapphires,rubies,equipped_by,equipped_slot,stat_version,natural_rule_version,natural_stats,natural_percentages,emeralds,certus_used) values(uid,it->>'kind',it->>'model',(it->>'enhancement')::integer,it->'base_stats',it->'sapphires',it->'rubies',b.gladiator_id,kv.key,coalesce((it->>'stat_version')::integer,0),coalesce((it->>'natural_rule_version')::integer,0),coalesce(it->'natural_stats','{}'),coalesce(it->'natural_percentages','{}'),coalesce(it->'emeralds','[]'),coalesce((it->>'certus_used')::boolean,false)) returning id into iid;
  end if;
  newids:=newids||jsonb_build_array(iid);
 end loop;
 if p_won then
  kind:=(array['weapon','shield','helmet','gloves','legs'])[1+floor(random()*5)::integer];model:=case kind when 'weapon' then (array['gladius','sica','spear','trident'])[1+floor(random()*4)::integer] when 'shield' then 'round' when 'helmet' then 'gold' else 'starter' end;
  insert into public.ludus_items(owner_id,kind,model) values(uid,kind,model) returning id into iid;
  typed_stone:=ludus_private.win_stone_v10(uid);
  prize:=jsonb_build_object('gold',100,'diamonds',1,'stone',typed_stone,'kind',kind,'item_id',iid);
  update public.ludus_accounts set gold=gold+100,diamonds=diamonds+1,wins=wins+1 where user_id=uid;
  update public.ludus_gladiators set wins_4x5=wins_4x5+case when b.mode='4x5' then 1 else 0 end,wins_solo20=wins_solo20+case when b.mode='solo20' then 1 else 0 end where id=b.gladiator_id;
 else update public.ludus_accounts set losses=losses+1 where user_id=uid;end if;
 prize:=prize||jsonb_build_object('extracted',newids,'gear_lost',not(coalesce(p_won,false) and alive));
 update public.ludus_battles set finished_at=now(),won=coalesce(p_won,false),reward=prize,stats=case when pg_column_size(p_stats)<16384 then p_stats else '{}'::jsonb end where id=b.id returning reward into prize;
 insert into public.ludus_battle_receipts(battle_id,owner_id,reward,finished_at) values(b.id,uid,prize,now());
 delete from public.ludus_battles where owner_id=uid and finished_at is not null and id not in(select id from public.ludus_battles where owner_id=uid and finished_at is not null order by finished_at desc limit 5);
 return prize;
end $function$
;
create table public.ludus_imperial_catalog(id uuid primary key,day date,slot integer,difficulty integer,title text,description text,image text,detail_image text);
