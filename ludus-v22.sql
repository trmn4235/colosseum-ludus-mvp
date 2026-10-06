-- V22: clans, consent-based war lineups and an atomic shared treasury.
-- Additive migration; existing accounts, inventories and matches survive.
begin;
create table if not exists public.ludus_clans(
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(btrim(name)) between 3 and 32),
 emblem integer not null check(emblem between 1 and 30),
 background text not null check(background ~ '^#[0-9a-fA-F]{6}$'),
 emblem_color text not null check(emblem_color ~ '^#[0-9a-fA-F]{6}$'),
 leader_id uuid not null references public.ludus_accounts(user_id),
 level integer not null default 1 check(level between 1 and 20),
 experience bigint not null default 0 check(experience>=0),
 lifetime_experience bigint not null default 0 check(lifetime_experience>=0),
 gold bigint not null default 0 check(gold>=0),created_at timestamptz not null default now()
);
create unique index if not exists ludus_clan_name_unique on public.ludus_clans(lower(btrim(name)));
create table if not exists public.ludus_clan_members(
 user_id uuid primary key references public.ludus_accounts(user_id),
 clan_id uuid not null references public.ludus_clans(id),
 vault_access boolean not null default false,joined_at timestamptz not null default now()
);
create index if not exists ludus_clan_member_clan on public.ludus_clan_members(clan_id);
create table if not exists public.ludus_clan_requests(
 id uuid primary key default gen_random_uuid(),clan_id uuid not null references public.ludus_clans(id),
 user_id uuid not null references public.ludus_accounts(user_id),
 kind text not null check(kind in('application','invite')),
 state text not null default 'pending' check(state in('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists ludus_clan_request_pending on public.ludus_clan_requests(clan_id,user_id,kind) where state='pending';
create table if not exists public.ludus_clan_rosters(
 id uuid primary key default gen_random_uuid(),clan_id uuid not null references public.ludus_clans(id),
 name text not null check(char_length(btrim(name)) between 3 and 40),
 kind text not null check(kind in('league','cup')),
 state text not null default 'draft' check(state in('draft','locked','finished','cancelled')),
 created_at timestamptz not null default now(),locked_at timestamptz,finished_at timestamptz
);
create unique index if not exists ludus_clan_one_active_roster on public.ludus_clan_rosters(clan_id) where state in('draft','locked');
create table if not exists public.ludus_clan_roster_invites(
 roster_id uuid not null references public.ludus_clan_rosters(id),
 user_id uuid not null references public.ludus_accounts(user_id),
 state text not null default 'pending' check(state in('pending','accepted','declined')),
 primary key(roster_id,user_id)
);
create table if not exists public.ludus_clan_roster_entries(
 id uuid primary key default gen_random_uuid(),roster_id uuid not null references public.ludus_clan_rosters(id),
 user_id uuid not null references public.ludus_accounts(user_id),gladiator_id uuid not null references public.ludus_gladiators(id),
 position integer not null check(position between 1 and 20),
 unique(roster_id,gladiator_id),unique(roster_id,position)
);
create table if not exists public.ludus_clan_operations(
 user_id uuid not null references public.ludus_accounts(user_id),request_id uuid not null,
 action text not null,data jsonb not null,clan_id uuid references public.ludus_clans(id),
 created_at timestamptz not null default now(),primary key(user_id,request_id)
);
create table if not exists public.ludus_clan_ledger(
 id uuid primary key default gen_random_uuid(),clan_id uuid not null references public.ludus_clans(id),
 user_id uuid not null references public.ludus_accounts(user_id),
 kind text not null check(kind in('deposit','level','item_deposit','item_withdraw')),
 amount bigint not null default 0,detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create table if not exists public.ludus_clan_championships(
 source_id uuid not null,kind text not null check(kind in('solo20','4x5','league','cup')),
 clan_id uuid not null references public.ludus_clans(id),user_id uuid references public.ludus_accounts(user_id),
 experience integer not null check(experience>0),created_at timestamptz not null default now(),
 primary key(source_id,kind)
);
alter table public.ludus_gladiators add column if not exists clan_roster_id uuid references public.ludus_clan_rosters(id);
alter table public.ludus_items add column if not exists clan_roster_id uuid references public.ludus_clan_rosters(id);
alter table public.ludus_items add column if not exists clan_vault_id uuid references public.ludus_clans(id);
alter table public.ludus_items add column if not exists vault_depositor uuid references public.ludus_accounts(user_id);
alter table public.ludus_items add column if not exists vaulted_at timestamptz;
do $$declare t text;begin
 foreach t in array array['ludus_clans','ludus_clan_members','ludus_clan_requests','ludus_clan_rosters','ludus_clan_roster_invites','ludus_clan_roster_entries','ludus_clan_operations','ludus_clan_ledger','ludus_clan_championships'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
-- A vaulted item disappears from personal inventory, including cached old clients.
drop policy if exists item_owner_read on public.ludus_items;
create policy item_owner_read on public.ludus_items for select to authenticated using(owner_id=(select auth.uid()) and clan_vault_id is null);

create or replace function ludus_private.clan_capacity(l integer) returns integer language sql immutable set search_path='' as $$
 select least(30,10+round(20.0*(greatest(1,least(20,l))-1)/19)::integer)
$$;
create or replace function ludus_private.clan_exp_cost(l integer) returns bigint language sql immutable set search_path='' as $$select (100+50*(l-1))::bigint$$;
create or replace function ludus_private.clan_coin_cost(l integer) returns bigint language sql immutable set search_path='' as $$select (500*l)::bigint$$;
create or replace function ludus_private.clan_equipment_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce(current_setting('ludus.clan_transfer',true),'')='on' then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op<>'INSERT' and (old.clan_vault_id is not null or old.clan_roster_id is not null) then raise exception 'Bu eşya klan kasasında veya kilitli savaş kadrosunda.';end if;
 if tg_op<>'DELETE' and (new.clan_vault_id is not null or new.clan_roster_id is not null) then raise exception 'Klan eşyası yalnızca klan işlemleriyle taşınabilir.';end if;
 if tg_op<>'DELETE' and new.equipped_by is not null and exists(select 1 from public.ludus_gladiators where id=new.equipped_by and clan_roster_id is not null) then raise exception 'Klan savaşına kilitlenen gladyatörün ekipmanı değiştirilemez.';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
drop trigger if exists ludus_clan_equipment_guard on public.ludus_items;
create trigger ludus_clan_equipment_guard before insert or update or delete on public.ludus_items for each row execute function ludus_private.clan_equipment_guard();
create or replace function ludus_private.clan_gladiator_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce(current_setting('ludus.clan_transfer',true),'')<>'on' then
  if tg_op<>'INSERT' and old.clan_roster_id is not null then
   -- Weekly housekeeping may run when the Ludus loads; it cannot unlock or
   -- retrain the fighter or mutate the reserved identity/loadout.
   if tg_op='UPDATE' and (to_jsonb(new)-array['overall','training_week_start','perfect_weeks','training_policy_pending'])=(to_jsonb(old)-array['overall','training_week_start','perfect_weeks','training_policy_pending'])then return new;end if;
   raise exception 'Gladyatör klan savaşı kadrosuna kilitli.';
  end if;
  if tg_op<>'DELETE' and new.clan_roster_id is not null then raise exception 'Savaş kadrosu kilidi klan lideri tarafından konur.';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
drop trigger if exists ludus_clan_gladiator_guard on public.ludus_gladiators;
create trigger ludus_clan_gladiator_guard before insert or update or delete on public.ludus_gladiators for each row execute function ludus_private.clan_gladiator_guard();

create or replace function ludus_private.clan_state(u uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.ludus_clans;m public.ludus_clan_members;r public.ludus_clan_rosters;j jsonb;outbox jsonb;inbox jsonb;is_leader boolean:=false;access boolean:=false;
begin
 select * into m from public.ludus_clan_members where user_id=u;
 select * into c from public.ludus_clans where id=m.clan_id;
 is_leader:=coalesce(c.leader_id=u,false);access:=is_leader or coalesce(m.vault_access,false);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'clan_id',q.clan_id,'name',k.name,'emblem',k.emblem,'background',k.background,'emblem_color',k.emblem_color,'kind',q.kind,'state',q.state)order by q.created_at desc),'[]') into inbox
 from public.ludus_clan_requests q join public.ludus_clans k on k.id=q.clan_id where q.user_id=u and q.state='pending';
 j:=jsonb_build_object('server_now',now(),'user_id',u,'wallet',(select jsonb_build_object('gold',gold,'ludus_name',ludus_name)from public.ludus_accounts where user_id=u),'clan',null,'requests',inbox,'gladiators',coalesce((select jsonb_agg(to_jsonb(g)order by g.created_at)from public.ludus_gladiators g where owner_id=u),'[]'));
 if c.id is null then return j;end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',a.ludus_name,'username',a.username,'leader',a.user_id=c.leader_id,'vault_access',cm.vault_access or a.user_id=c.leader_id,'online',coalesce(p.last_seen>clock_timestamp()-interval '75 seconds',false),'joined_at',cm.joined_at)order by (a.user_id=c.leader_id)desc,cm.joined_at),'[]')into outbox
 from public.ludus_clan_members cm join public.ludus_accounts a on a.user_id=cm.user_id left join public.ludus_presence p on p.user_id=a.user_id where cm.clan_id=c.id;
 j:=j||jsonb_build_object('clan',to_jsonb(c)||jsonb_build_object('capacity',ludus_private.clan_capacity(c.level),'member_count',jsonb_array_length(outbox),'exp_cost',case when c.level<20 then ludus_private.clan_exp_cost(c.level)end,'coin_cost',case when c.level<20 then ludus_private.clan_coin_cost(c.level)end),'leader',is_leader,'vault_access',access,'members',outbox,
  'trophies',jsonb_build_object('solo20',(select count(*)from public.ludus_clan_championships where clan_id=c.id and kind='solo20'),'4x5',(select count(*)from public.ludus_clan_championships where clan_id=c.id and kind='4x5'),'league',(select count(*)from public.ludus_clan_championships where clan_id=c.id and kind='league'),'cup',(select count(*)from public.ludus_clan_championships where clan_id=c.id and kind='cup')),
  'championship_exp',jsonb_build_object('solo20',5,'4x5',3,'league',100,'cup',150));
 if is_leader then
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'user_id',q.user_id,'name',a.ludus_name,'username',a.username,'kind',q.kind,'state',q.state)order by q.created_at),'[]') into outbox from public.ludus_clan_requests q join public.ludus_accounts a on a.user_id=q.user_id where q.clan_id=c.id and q.state='pending';
  j:=j||jsonb_build_object('applications',outbox);
 end if;
 select * into r from public.ludus_clan_rosters where clan_id=c.id and state in('draft','locked') order by created_at desc limit 1;
 if r.id is not null then
  j:=j||jsonb_build_object('roster',to_jsonb(r)||jsonb_build_object('capacity',20,'invited',is_leader or exists(select 1 from public.ludus_clan_roster_invites where roster_id=r.id and user_id=u and state in('pending','accepted')),
   'invites',coalesce((select jsonb_agg(jsonb_build_object('user_id',i.user_id,'name',a.ludus_name,'state',i.state))from public.ludus_clan_roster_invites i join public.ludus_accounts a on a.user_id=i.user_id where roster_id=r.id),'[]'),
   'entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'name',a.ludus_name,'gladiator_id',g.id,'gladiator_name',g.name,'class',g.class,'level',g.level,'position',e.position)order by e.position)from public.ludus_clan_roster_entries e join public.ludus_gladiators g on g.id=e.gladiator_id join public.ludus_accounts a on a.user_id=e.user_id where roster_id=r.id),'[]')));
 end if;
 if access then
  j:=j||jsonb_build_object('vault',coalesce((select jsonb_agg(to_jsonb(i)order by vaulted_at desc)from public.ludus_items i where clan_vault_id=c.id),'[]'),
   'inventory',coalesce((select jsonb_agg(to_jsonb(i)order by created_at desc)from public.ludus_items i where owner_id=u and clan_vault_id is null and clan_roster_id is null and locked_battle_id is null and equipped_by is null),'[]'));
 end if;
 j:=j||jsonb_build_object('ledger',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('name',a.ludus_name)order by l.created_at desc)from (select * from public.ludus_clan_ledger where clan_id=c.id order by created_at desc limit 40)l join public.ludus_accounts a on a.user_id=l.user_id),'[]'));
 return j;
end $$;

create or replace function public.ludus_clan(p_action text default 'state',p_data jsonb default '{}',p_request uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c public.ludus_clans;m public.ludus_clan_members;q public.ludus_clan_requests;r public.ludus_clan_rosters;
 op public.ludus_clan_operations;g public.ludus_gladiators;it public.ludus_items;v uuid;cid uuid;rid uuid;eid uuid;n integer;pos integer;amount bigint;cost bigint;exp_cost bigint;is_leader boolean;access boolean;old_marker text:=coalesce(current_setting('ludus.clan_transfer',true),'');
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Hesabına giriş yap.';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or pg_column_size(p_data)>32768 then raise exception 'Geçersiz klan işlemi.';end if;
 if p_action='state' then return ludus_private.clan_state(u);end if;
 if p_action='search' then
  if char_length(trim(coalesce(p_data->>'name','')))<2 then return jsonb_build_object('clans','[]'::jsonb);end if;
  return jsonb_build_object('clans',coalesce((select jsonb_agg(to_jsonb(s))from(select k.id,k.name,k.emblem,k.background,k.emblem_color,k.level,ludus_private.clan_capacity(k.level) as capacity,(select count(*)from public.ludus_clan_members where clan_id=k.id)as members from public.ludus_clans k where position(lower(trim(p_data->>'name')) in lower(k.name))>0 order by lower(k.name) limit 30)s),'[]'));
 end if;
 if p_action='find_ludus' then
  if char_length(trim(coalesce(p_data->>'name','')))<2 then return jsonb_build_object('ludus','[]'::jsonb);end if;
  return jsonb_build_object('ludus',coalesce((select jsonb_agg(to_jsonb(s))from(select a.user_id,a.ludus_name as name,a.username,exists(select 1 from public.ludus_clan_members where user_id=a.user_id)as in_clan from public.ludus_accounts a where a.user_id<>u and position(lower(trim(p_data->>'name')) in lower(a.ludus_name))>0 order by a.ludus_name,a.username limit 20)s),'[]'));
 end if;
 if p_request is null then raise exception 'İşlem kimliği gerekli.';end if;
 -- All currency operations take the personal wallet first; roster changes take every
 -- affected wallet before the clan. This matches battle/training lock ordering.
 perform 1 from public.ludus_accounts where user_id=u for update;
 select * into m from public.ludus_clan_members where user_id=u;cid:=m.clan_id;
 if p_action in('roster_lock','roster_unlock','roster_cancel')and cid is not null then
  perform 1 from public.ludus_accounts where user_id in(select user_id from public.ludus_clan_members where clan_id=cid)order by user_id for update;
 end if;
 perform pg_advisory_xact_lock(202622);
 select * into op from public.ludus_clan_operations where user_id=u and request_id=p_request;
 if found then
  if op.action<>p_action or op.data<>p_data then raise exception 'Bu işlem kimliği farklı bir istekte kullanılmış.';end if;
  return jsonb_build_object('state',ludus_private.clan_state(u),'repeated',true);
 end if;
 select * into m from public.ludus_clan_members where user_id=u;
 select * into c from public.ludus_clans where id=m.clan_id for update;
 is_leader:=coalesce(c.leader_id=u,false);access:=is_leader or coalesce(m.vault_access,false);cid:=c.id;
 if p_action='create' then
  if c.id is not null then raise exception 'Zaten bir klana üyesin.';end if;
  if char_length(trim(coalesce(p_data->>'name','')) )not between 3 and 32 or trim(p_data->>'name') !~ '^[A-Za-z0-9À-ž _.-]+$' then raise exception 'Klan adı 3–32 harf, rakam veya boşluktan oluşmalı.';end if;
  if coalesce((p_data->>'emblem')::integer,0) not between 1 and 30 or coalesce(p_data->>'background','') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_data->>'emblem_color','') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Arma ve iki renk seç.';end if;
  if exists(select 1 from public.ludus_clans where lower(name)=lower(trim(p_data->>'name')))then raise exception 'Bu klan adı kullanılıyor.';end if;
  insert into public.ludus_clans(name,emblem,background,emblem_color,leader_id)values(trim(p_data->>'name'),(p_data->>'emblem')::integer,p_data->>'background',p_data->>'emblem_color',u)returning id into cid;
  insert into public.ludus_clan_members(user_id,clan_id,vault_access)values(u,cid,true);
  update public.ludus_clan_requests set state='cancelled',updated_at=now()where user_id=u and state='pending';
 elsif p_action='apply' then
  if c.id is not null then raise exception 'Zaten bir klana üyesin.';end if;
  select * into c from public.ludus_clans where id=(p_data->>'clan_id')::uuid for update;if not found then raise exception 'Klan bulunamadı.';end if;cid:=c.id;
  if(select count(*)from public.ludus_clan_members where clan_id=c.id)>=ludus_private.clan_capacity(c.level)then raise exception 'Klanın üye kapasitesi dolu.';end if;
  if(select count(*)from public.ludus_clan_requests where user_id=u and state='pending'and kind='application')>=10 then raise exception 'En fazla 10 bekleyen başvuru olabilir.';end if;
  insert into public.ludus_clan_requests(clan_id,user_id,kind)values(c.id,u,'application')on conflict do nothing;
 elsif p_action='invite' then
  if not is_leader then raise exception 'Davetleri klan lideri gönderir.';end if;v:=(p_data->>'user_id')::uuid;
  if v=u or not exists(select 1 from public.ludus_accounts where user_id=v)then raise exception 'Davet edilecek Ludus bulunamadı.';end if;
  if exists(select 1 from public.ludus_clan_members where user_id=v)then raise exception 'Bu Ludus zaten bir klana üye.';end if;
  if(select count(*)from public.ludus_clan_members where clan_id=c.id)>=ludus_private.clan_capacity(c.level)then raise exception 'Klanın üye kapasitesi dolu.';end if;
  if(select count(*)from public.ludus_clan_requests where clan_id=c.id and kind='invite'and state='pending')>=30 then raise exception 'Önce bekleyen davetleri tamamla.';end if;
  insert into public.ludus_clan_requests(clan_id,user_id,kind)values(c.id,v,'invite')on conflict do nothing;
 elsif p_action in('request_accept','request_decline','request_cancel')then
  select * into q from public.ludus_clan_requests where id=(p_data->>'id')::uuid for update;
  if not found or q.state<>'pending' then raise exception 'Bu istek artık beklemiyor.';end if;
  select * into c from public.ludus_clans where id=q.clan_id for update;cid:=c.id;
  if p_action='request_cancel' then
   if not((q.kind='application'and q.user_id=u)or(q.kind='invite'and c.leader_id=u))then raise exception 'Bu isteği iptal edemezsin.';end if;
   update public.ludus_clan_requests set state='cancelled',updated_at=now()where id=q.id;
  else
   if not((q.kind='invite'and q.user_id=u)or(q.kind='application'and c.leader_id=u))then raise exception 'Bu isteği yanıtlayamazsın.';end if;
   if p_action='request_accept' then
    if exists(select 1 from public.ludus_clan_members where user_id=q.user_id)then raise exception 'Bu Ludus zaten bir klana üye.';end if;
    if(select count(*)from public.ludus_clan_members where clan_id=c.id)>=ludus_private.clan_capacity(c.level)then raise exception 'Klanın üye kapasitesi dolu.';end if;
    insert into public.ludus_clan_members(user_id,clan_id)values(q.user_id,c.id);
    update public.ludus_clan_requests set state='cancelled',updated_at=now()where user_id=q.user_id and state='pending'and id<>q.id;
   end if;
   update public.ludus_clan_requests set state=case when p_action='request_accept'then 'accepted'else 'declined'end,updated_at=now()where id=q.id;
  end if;
 else
  if c.id is null then raise exception 'Önce bir klana katıl.';end if;
  if p_action='deposit' then
   if coalesce(p_data->>'amount','') !~ '^[0-9]{1,8}$' then raise exception 'Geçerli bir denarius miktarı gir.';end if;amount:=(p_data->>'amount')::bigint;
   if amount<1 or amount>10000000 then raise exception '1–10.000.000 denarius ekleyebilirsin.';end if;
   update public.ludus_accounts set gold=gold-amount where user_id=u and gold>=amount;if not found then raise exception 'Denarius yetersiz.';end if;
   update public.ludus_clans set gold=gold+amount where id=c.id;
   insert into public.ludus_clan_ledger(clan_id,user_id,kind,amount)values(c.id,u,'deposit',amount);
  elsif p_action='level_up' then
   if not is_leader then raise exception 'Klan seviyesini lider artırır.';end if;
   if c.level>=20 then raise exception 'Klan en yüksek seviyede.';end if;
   cost:=ludus_private.clan_coin_cost(c.level);exp_cost:=ludus_private.clan_exp_cost(c.level);
   if c.gold<cost or c.experience<exp_cost then raise exception 'Klanın EXP veya denariusu yetersiz.';end if;
   update public.ludus_clans set level=level+1,gold=gold-cost,experience=experience-exp_cost where id=c.id;
   insert into public.ludus_clan_ledger(clan_id,user_id,kind,amount,detail)values(c.id,u,'level',-cost,jsonb_build_object('level',c.level+1,'experience',exp_cost));
  elsif p_action='permission' then
   if not is_leader then raise exception 'Kasa yetkisini lider verir.';end if;
   if jsonb_typeof(p_data->'enabled')is distinct from 'boolean'then raise exception 'Yetki değeri gerekli.';end if;v:=(p_data->>'user_id')::uuid;
   if v=c.leader_id then raise exception 'Liderin kasa yetkisi her zaman açıktır.';end if;
   update public.ludus_clan_members set vault_access=(p_data->>'enabled')::boolean where user_id=v and clan_id=c.id;if not found then raise exception 'Üye bulunamadı.';end if;
  elsif p_action in('vault_deposit','vault_withdraw')then
   if not access then raise exception 'Klan liderinden kasa yetkisi almalısın.';end if;
   select * into it from public.ludus_items where id=(p_data->>'item_id')::uuid for update;
   if not found then raise exception 'Eşya bulunamadı.';end if;
   perform set_config('ludus.clan_transfer','on',true);
   if p_action='vault_deposit'then
    if it.owner_id<>u or it.clan_vault_id is not null or it.clan_roster_id is not null or it.locked_battle_id is not null or it.equipped_by is not null then raise exception 'Yalnızca sana ait, takılı olmayan ve kilitsiz eşyalar kasaya konur.';end if;
    if(select count(*)from public.ludus_items where clan_vault_id=c.id)>=60 then raise exception 'Klan kasasının 60 eşya yuvası dolu.';end if;
    update public.ludus_items set clan_vault_id=c.id,vault_depositor=u,vaulted_at=now()where id=it.id;
    insert into public.ludus_clan_ledger(clan_id,user_id,kind,detail)values(c.id,u,'item_deposit',jsonb_build_object('item_id',it.id,'model',it.model,'kind',it.kind,'enhancement',it.enhancement));
   else
    if it.clan_vault_id is distinct from c.id then raise exception 'Bu eşya klan kasasında değil.';end if;
    update public.ludus_items set owner_id=u,clan_vault_id=null,vault_depositor=null,vaulted_at=null,equipped_by=null,equipped_slot=null where id=it.id;
    insert into public.ludus_clan_ledger(clan_id,user_id,kind,detail)values(c.id,u,'item_withdraw',jsonb_build_object('item_id',it.id,'model',it.model,'kind',it.kind,'enhancement',it.enhancement));
   end if;
   perform set_config('ludus.clan_transfer',old_marker,true);
  elsif p_action='roster_create' then
   if not is_leader then raise exception 'Savaş kadrosunu lider oluşturur.';end if;
   if exists(select 1 from public.ludus_clan_rosters where clan_id=c.id and state in('draft','locked'))then raise exception 'Önce mevcut kadroyu tamamla veya iptal et.';end if;
   if coalesce(p_data->>'kind','')not in('league','cup')or char_length(trim(coalesce(p_data->>'name','')))not between 3 and 40 then raise exception 'Kadro adı ve şampiyona seç.';end if;
   insert into public.ludus_clan_rosters(clan_id,name,kind)values(c.id,trim(p_data->>'name'),p_data->>'kind')returning id into rid;
   insert into public.ludus_clan_roster_invites(roster_id,user_id,state)values(rid,u,'accepted');
  elsif p_action in('roster_invite','roster_join','roster_remove','roster_lock','roster_unlock','roster_cancel','roster_decline')then
   select * into r from public.ludus_clan_rosters where id=(p_data->>'roster_id')::uuid and clan_id=c.id for update;
   if not found or r.state not in('draft','locked')then raise exception 'Aktif savaş kadrosu bulunamadı.';end if;rid:=r.id;
   if p_action in('roster_unlock','roster_cancel')then
    if not is_leader then raise exception 'Kadro kilidini lider yönetir.';end if;
    perform set_config('ludus.clan_transfer','on',true);
    update public.ludus_items set clan_roster_id=null where clan_roster_id=r.id;
    update public.ludus_gladiators set clan_roster_id=null,status='available'where clan_roster_id=r.id;
    perform set_config('ludus.clan_transfer',old_marker,true);
    update public.ludus_clan_rosters set state=case when p_action='roster_cancel'then 'cancelled'else 'draft'end,locked_at=null,finished_at=case when p_action='roster_cancel'then now()end where id=r.id;
   else
    if r.state<>'draft'then raise exception 'Kadro kilitli; önce lider kilidi açmalı.';end if;
    if p_action='roster_invite'then
     if not is_leader then raise exception 'Kadro davetlerini lider gönderir.';end if;v:=(p_data->>'user_id')::uuid;
     if not exists(select 1 from public.ludus_clan_members where user_id=v and clan_id=c.id)then raise exception 'Bu Ludus klanın üyesi değil.';end if;
     insert into public.ludus_clan_roster_invites(roster_id,user_id)values(r.id,v)on conflict(roster_id,user_id)do update set state='pending';
    elsif p_action='roster_join'then
     if not exists(select 1 from public.ludus_clan_roster_invites where roster_id=r.id and user_id=u and state in('pending','accepted'))then raise exception 'Lider önce seni kadroya davet etmeli.';end if;
     select * into g from public.ludus_gladiators where id=(p_data->>'gladiator_id')::uuid and owner_id=u for update;
     if not found or g.status<>'available'or g.clan_roster_id is not null or g.injured_until>now()or g.training_ends_at>now()then raise exception 'Hazır bir gladyatörünü seç.';end if;
     if exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)or exists(select 1 from public.ludus_matches where status in('waiting','playing')and updated_at>now()-interval '30 seconds'and players @>jsonb_build_array(jsonb_build_object('owner',u,'gladiator',jsonb_build_object('id',g.id))))then raise exception 'Bu gladyatör şu anda arenada.';end if;
     if exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters rr on rr.id=e.roster_id where e.gladiator_id=g.id and rr.state in('draft','locked'))then raise exception 'Gladyatör zaten bir kadroda.';end if;
     select min(s)into pos from generate_series(1,20)s where not exists(select 1 from public.ludus_clan_roster_entries where roster_id=r.id and position=s);if pos is null then raise exception 'Kadro 20 gladyatörle dolu.';end if;
     insert into public.ludus_clan_roster_entries(roster_id,user_id,gladiator_id,position)values(r.id,u,g.id,pos);
     update public.ludus_clan_roster_invites set state='accepted'where roster_id=r.id and user_id=u;
    elsif p_action in('roster_remove','roster_decline')then
     if p_action='roster_remove'then
      select user_id into v from public.ludus_clan_roster_entries where id=(p_data->>'entry_id')::uuid and roster_id=r.id;
      if v is null or not(is_leader or v=u)then raise exception 'Bu gladyatörü kadrodan çıkaramazsın.';end if;
      delete from public.ludus_clan_roster_entries where id=(p_data->>'entry_id')::uuid and roster_id=r.id;
     else
      delete from public.ludus_clan_roster_entries where roster_id=r.id and user_id=u;
      update public.ludus_clan_roster_invites set state='declined'where roster_id=r.id and user_id=u;
     end if;
    else
     if not is_leader then raise exception 'Kadroyu lider kilitler.';end if;
     if not exists(select 1 from public.ludus_clan_roster_entries where roster_id=r.id)then raise exception 'Boş kadro kilitlenemez.';end if;
     for g in select gg.*from public.ludus_gladiators gg join public.ludus_clan_roster_entries e on e.gladiator_id=gg.id where e.roster_id=r.id order by gg.id for update of gg loop
      if not exists(select 1 from public.ludus_clan_members where clan_id=c.id and user_id=g.owner_id)or g.status<>'available'or g.clan_roster_id is not null or g.training_ends_at>now()or g.injured_until>now()or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)or exists(select 1 from public.ludus_matches where status in('waiting','playing')and updated_at>now()-interval '30 seconds'and players @>jsonb_build_array(jsonb_build_object('owner',g.owner_id,'gladiator',jsonb_build_object('id',g.id))))then raise exception 'Kadrodaki bir gladyatör şu anda hazır değil.';end if;
      if exists(select 1 from public.ludus_items where equipped_by=g.id and (locked_battle_id is not null or clan_vault_id is not null or clan_roster_id is not null))then raise exception 'Kadrodaki ekipman başka bir işlemde kilitli.';end if;
     end loop;
     perform set_config('ludus.clan_transfer','on',true);
     update public.ludus_gladiators set clan_roster_id=r.id,status='locked'where id in(select gladiator_id from public.ludus_clan_roster_entries where roster_id=r.id);
     update public.ludus_items set clan_roster_id=r.id where equipped_by in(select gladiator_id from public.ludus_clan_roster_entries where roster_id=r.id);
     perform set_config('ludus.clan_transfer',old_marker,true);
     update public.ludus_clan_rosters set state='locked',locked_at=now()where id=r.id;
    end if;
   end if;
  elsif p_action in('leave','kick','transfer_leader')then
   v:=case when p_action='leave'then u else (p_data->>'user_id')::uuid end;
   if p_action<>'leave'and not is_leader then raise exception 'Bu işlemi yalnızca klan lideri yapabilir.';end if;
   if not exists(select 1 from public.ludus_clan_members where user_id=v and clan_id=c.id)then raise exception 'Üye bulunamadı.';end if;
   if p_action='transfer_leader'then
    if v=u then raise exception 'Başka bir klan üyesini seç.';end if;
    update public.ludus_clans set leader_id=v where id=c.id;update public.ludus_clan_members set vault_access=true where user_id=v;
   else
    if v=c.leader_id then raise exception 'Lider ayrılmadan önce liderliği bir üyeye devretmeli.';end if;
    if exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters rr on rr.id=e.roster_id where e.user_id=v and rr.state='locked')then raise exception 'Önce bu üyenin savaş kadrosu kilidini aç.';end if;
    delete from public.ludus_clan_roster_entries where user_id=v and roster_id in(select id from public.ludus_clan_rosters where clan_id=c.id and state='draft');
    delete from public.ludus_clan_members where user_id=v and clan_id=c.id;
   end if;
  else raise exception 'Geçersiz klan işlemi.';
  end if;
 end if;
 insert into public.ludus_clan_operations(user_id,request_id,action,data,clan_id)values(u,p_request,p_action,p_data,cid);
 return jsonb_build_object('state',ludus_private.clan_state(u),'repeated',false);
end $$;

-- A settled personal victory awards its clan once. No historical backfill;
-- practice multiplayer has no ludus_battles reward and earns no clan EXP.
create or replace function ludus_private.clan_victory() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;xp integer;
begin
 if new.finished_at is null or old.finished_at is not null or not coalesce(new.won,false)or new.mode not in('solo20','4x5')then return new;end if;
 select clan_id into cid from public.ludus_clan_members where user_id=new.owner_id;if cid is null then return new;end if;
 xp:=case when new.mode='solo20'then 5 else 3 end;
 insert into public.ludus_clan_championships(source_id,kind,clan_id,user_id,experience)values(new.id,new.mode,cid,new.owner_id,xp)on conflict do nothing;
 if found then update public.ludus_clans set experience=experience+xp,lifetime_experience=lifetime_experience+xp where id=cid;end if;
 return new;
end $$;
drop trigger if exists ludus_clan_victory on public.ludus_battles;
create trigger ludus_clan_victory after update of finished_at,won on public.ludus_battles for each row execute function ludus_private.clan_victory();

-- Championship completion belongs to the trusted future tournament service,
-- never to a leader's browser. A source id is globally unique per category.
create or replace function public.ludus_clan_award_championship(p_clan uuid,p_kind text,p_source uuid,p_roster uuid default null)returns jsonb language plpgsql security definer set search_path='' as $$
declare xp integer;c public.ludus_clans;inserted boolean;marker text:=coalesce(current_setting('ludus.clan_transfer',true),'');old_event public.ludus_clan_championships;
begin
 if p_kind is null or p_kind not in('league','cup')or p_source is null then raise exception 'Geçersiz şampiyona kaydı.';end if;
 perform 1 from public.ludus_accounts where user_id in(select user_id from public.ludus_clan_members where clan_id=p_clan)order by user_id for update;
 perform pg_advisory_xact_lock(202622);
 select * into c from public.ludus_clans where id=p_clan for update;if not found then raise exception 'Klan bulunamadı.';end if;
 select * into old_event from public.ludus_clan_championships where source_id=p_source and kind=p_kind;
 if found then if old_event.clan_id<>p_clan then raise exception 'Şampiyona başka bir klan için kaydedilmiş.';end if;return jsonb_build_object('repeated',true,'experience',old_event.experience);end if;
 if p_roster is not null and not exists(select 1 from public.ludus_clan_rosters where id=p_roster and clan_id=p_clan and kind=p_kind and state='locked')then raise exception 'Kilitli şampiyona kadrosu bulunamadı.';end if;
 xp:=case when p_kind='league'then 100 else 150 end;
 insert into public.ludus_clan_championships(source_id,kind,clan_id,experience)values(p_source,p_kind,p_clan,xp);
 update public.ludus_clans set experience=experience+xp,lifetime_experience=lifetime_experience+xp where id=p_clan;
 if p_roster is not null then
  perform set_config('ludus.clan_transfer','on',true);
  update public.ludus_items set clan_roster_id=null where clan_roster_id=p_roster;
  update public.ludus_gladiators set clan_roster_id=null,status='available'where clan_roster_id=p_roster;
  perform set_config('ludus.clan_transfer',marker,true);
  update public.ludus_clan_rosters set state='finished',finished_at=now()where id=p_roster;
 end if;
 return jsonb_build_object('repeated',false,'experience',xp);
end $$;
revoke all on function ludus_private.clan_capacity(integer),ludus_private.clan_exp_cost(integer),ludus_private.clan_coin_cost(integer),ludus_private.clan_equipment_guard(),ludus_private.clan_gladiator_guard(),ludus_private.clan_state(uuid),ludus_private.clan_victory()from public,anon,authenticated;
revoke all on function public.ludus_clan(text,jsonb,uuid)from public,anon;
grant execute on function public.ludus_clan(text,jsonb,uuid)to authenticated;
revoke all on function public.ludus_clan_award_championship(uuid,text,uuid,uuid)from public,anon,authenticated;
grant execute on function public.ludus_clan_award_championship(uuid,text,uuid,uuid)to service_role;
-- Keep the existing multiplayer rules; join now respects vault and roster reservations.
create or replace function public.ludus_match(p_action text,p_room uuid default null,p_gladiator uuid default null,p_slots jsonb default '{}',p_input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 u uuid:=auth.uid(); ts timestamptz:=clock_timestamp(); r public.ludus_matches; g public.ludus_gladiators;
 own jsonb; enemy jsonb; p jsonb; gear jsonb; arr jsonb; idx integer; target_idx integer; k integer; count_alive integer;
 mx double precision; mz double precision; dt double precision; len double precision; px double precision; pz double precision;
 dist double precision; best double precision; angle double precision; spawn double precision; radius double precision;
 strike boolean; whip boolean; hp integer; last_hit timestamptz; win uuid; selected_weapon text; wanted text;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Hesabına giriş yap.'; end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if p_action='join' then
  perform pg_advisory_xact_lock(202621);
  select m.* into r from public.ludus_matches m where m.status in('waiting','playing') and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text and coalesce((f->>'hp')::int,0)>0 and (f->>'seen')::timestamptz>ts-interval '30 seconds') order by m.created_at desc limit 1 for update;
  if not found then
   select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u for update;
   if not found or g.status<>'available' then raise exception 'Hazır bir gladyatör seç.'; end if;
   if jsonb_typeof(p_slots)<>'object' or (select count(*) from jsonb_object_keys(p_slots))>6 then raise exception 'Geçersiz ekipman seçimi.'; end if;
   select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('equipped_slot',e.key)),'[]') into gear from jsonb_each_text(p_slots)e join public.ludus_items i on i.id::text=e.value and i.owner_id=u and i.locked_battle_id is null and i.clan_vault_id is null and i.clan_roster_id is null where e.key in('main_hand','off_hand','helmet','chest','gloves','legs') and ((e.key='main_hand' and i.kind='weapon')or(e.key='off_hand' and i.kind in('weapon','shield'))or e.key=i.kind);
   if jsonb_array_length(gear)<>(select count(*) from jsonb_object_keys(p_slots)) or (select count(distinct f->>'id') from jsonb_array_elements(gear) f)<>jsonb_array_length(gear) then raise exception 'Ekipman seçimini yenile.'; end if;
   own:=jsonb_build_object('owner',u,'name',g.name,'class',g.class,'gladiator',to_jsonb(g),'items',gear,'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0);
   select m.* into r from public.ludus_matches m where m.status='waiting' and m.starts_at>ts and m.updated_at>ts-interval '30 seconds' order by m.created_at limit 1 for update;
   if found then update public.ludus_matches set players=r.players||jsonb_build_array(own),updated_at=ts where id=r.id returning * into r;
   else insert into public.ludus_matches(players,starts_at,updated_at) values(jsonb_build_array(own),ts+interval '10 seconds',ts) returning * into r; end if;
  end if;
 else
  select m.* into r from public.ludus_matches m where m.id=p_room and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text) for update;
  if not found then raise exception 'Bu maça erişemezsin.'; end if;
 end if;
 select (ord-1)::int into idx from jsonb_array_elements(r.players) with ordinality as e(f,ord) where f->>'owner'=u::text;
 if p_action='leave' then
  if r.status='waiting' then select coalesce(jsonb_agg(f),'[]') into r.players from jsonb_array_elements(r.players) f where f->>'owner'<>u::text;
  elsif r.status='playing' then r.players:=jsonb_set(r.players,array[idx::text],(r.players->idx)||jsonb_build_object('hp',0,'move',0,'block',false,'left',true)); end if;
 elsif p_action in('join','state','step') then
  own:=r.players->idx;
  -- An eliminated player may watch the result, but cannot revive by polling.
  own:=own||jsonb_build_object('seen',ts); r.players:=jsonb_set(r.players,array[idx::text],own);
  if r.status='waiting' then
   select coalesce(jsonb_agg(f),'[]') into r.players from jsonb_array_elements(r.players) f where (f->>'seen')::timestamptz>ts-interval '8 seconds';
   if r.starts_at<=ts then
    if jsonb_array_length(r.players)>=2 then
     r.status:='playing'; arr:='[]'; radius:=least(10,greatest(3,jsonb_array_length(r.players)*.5)); k:=0;
     for p in select value from jsonb_array_elements(r.players) loop
      spawn:=k*2*pi()/jsonb_array_length(r.players);
      arr:=arr||jsonb_build_array(p||jsonb_build_object('x',sin(spawn)*radius,'z',cos(spawn)*radius,'angle',spawn+pi(),'seen',ts)); k:=k+1;
     end loop; r.players:=arr;
    else r.starts_at:=ts+interval '10 seconds'; end if;
   end if;
  elsif r.status='playing' and p_action='step' and (own->>'hp')::int>0 then
   if jsonb_typeof(p_input)<>'object' or coalesce(jsonb_typeof(p_input->'x'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'z'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'attack'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'block'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'special'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'target'),'string')<>'string' then raise exception 'Geçersiz kontrol.'; end if;
   -- Delta comes from the previously persisted server timestamp, never from the client.
   dt:=greatest(0,least(.25,extract(epoch from ts-(r.players->idx->>'tick_at')::timestamptz)));
   if dt is null then dt:=0; end if;
   mx:=greatest(-1,least(1,coalesce((p_input->>'x')::double precision,0))); mz:=greatest(-1,least(1,coalesce((p_input->>'z')::double precision,0))); len:=greatest(1,sqrt(mx*mx+mz*mz));
   px:=(own->>'x')::double precision+mx/len*dt*3.5; pz:=(own->>'z')::double precision+mz/len*dt*3.5;
   if own->>'pull_from' is not null then px:=(own->>'x')::float; pz:=(own->>'z')::float; mx:=0; mz:=0; end if;
   len:=greatest(1,sqrt(px*px+pz*pz)/10.5); px:=px/len; pz:=pz/len;
   target_idx:=null; best:=1e9; wanted:=p_input->>'target'; k:=0;
   for p in select value from jsonb_array_elements(r.players) loop
    if p->>'owner'<>u::text and (p->>'hp')::int>0 then
     dist:=sqrt(power(px-(p->>'x')::float,2)+power(pz-(p->>'z')::float,2));
     if p->>'owner'=wanted then target_idx:=k; exit; elsif dist<best then best:=dist; target_idx:=k; end if;
    end if; k:=k+1;
   end loop;
   enemy:=r.players->target_idx; angle:=coalesce((own->>'angle')::float,0);
   if enemy is not null then angle:=atan2((enemy->>'x')::float-px,(enemy->>'z')::float-pz); end if;
   last_hit:=(own->>'hit_at')::timestamptz;
   strike:=own->>'pull_from' is null and coalesce((p_input->>'attack')::boolean,false) and (last_hit is null or ts-last_hit>=interval '750 milliseconds');
   select f->>'model' into selected_weapon from jsonb_array_elements(own->'items') f where f->>'equipped_slot'='main_hand';
   whip:=selected_weapon='whip' and wanted=enemy->>'owner' and coalesce((p_input->>'special')::boolean,false) and ((own->>'special_at') is null or ts-(own->>'special_at')::timestamptz>=interval '6 seconds');
   own:=own||jsonb_build_object('x',px,'z',pz,'angle',angle,'tick_at',ts,'seen',ts,'move',sqrt(mx*mx+mz*mz),'block',coalesce((p_input->>'block')::boolean,false),'serial',(own->>'serial')::int+case when strike then 1 else 0 end);
   if strike then own:=own||jsonb_build_object('hit_at',ts); end if;
   if enemy is not null then
    dist:=sqrt(power(px-(enemy->>'x')::float,2)+power(pz-(enemy->>'z')::float,2));
    if whip then own:=own||jsonb_build_object('special_at',ts,'pull_serial',(own->>'pull_serial')::int+1,'pull_target',enemy->>'owner'); enemy:=enemy||jsonb_build_object('pull_from',u,'pull_until',ts+interval '6 seconds','pull_at',ts,'block',false);
    elsif strike and dist<=1.85 then hp:=greatest(0,(enemy->>'hp')::int-case when coalesce((enemy->>'block')::boolean,false)then 3 else 14 end); enemy:=enemy||jsonb_build_object('hp',hp); end if;
    r.players:=jsonb_set(r.players,array[target_idx::text],enemy);
   end if;
   r.players:=jsonb_set(r.players,array[idx::text],own);
  end if;
 else raise exception 'Geçersiz işlem.';
 end if;
 if r.status='playing' then
  -- Simulate tethered victims on every room update, even when their own tab is suspended.
  arr:='[]';
  for p in select value from jsonb_array_elements(r.players) loop
   if p->>'pull_from' is not null and (p->>'hp')::int>0 then
    select value into enemy from jsonb_array_elements(r.players) where value->>'owner'=p->>'pull_from' and (value->>'hp')::int>0;
    if not found or (p->>'pull_until')::timestamptz<ts then p:=p||jsonb_build_object('pull_from',null,'pull_until',null);
    else
     dt:=greatest(0,least(.25,extract(epoch from ts-(p->>'pull_at')::timestamptz)));
     px:=(p->>'x')::float; pz:=(p->>'z')::float; dist:=sqrt(power((enemy->>'x')::float-px,2)+power((enemy->>'z')::float-pz,2));
     len:=least(greatest(0,dist-.9),dt*greatest(6,dist*2));
     if dist>.91 then p:=p||jsonb_build_object('x',px+((enemy->>'x')::float-px)/dist*len,'z',pz+((enemy->>'z')::float-pz)/dist*len,'pull_at',ts,'move',0,'block',false);
     else p:=p||jsonb_build_object('pull_from',null,'pull_until',null); end if;
    end if;
   end if;
   arr:=arr||jsonb_build_array(p);
  end loop; r.players:=arr;
  arr:='[]';
  for p in select value from jsonb_array_elements(r.players) loop
   if (p->>'hp')::int>0 and (p->>'seen')::timestamptz<ts-interval '30 seconds' then p:=p||jsonb_build_object('hp',0,'left',true); end if;
   arr:=arr||jsonb_build_array(p);
  end loop; r.players:=arr;
  select count(*),min((f->>'owner'))::uuid into count_alive,win from jsonb_array_elements(r.players) f where (f->>'hp')::int>0;
  if count_alive<=1 then r.status:='finished'; r.winner:=win; end if;
 elsif r.status='waiting' and jsonb_array_length(r.players)=0 then r.status:='finished'; end if;
 update public.ludus_matches set players=r.players,status=r.status,starts_at=r.starts_at,winner=r.winner,updated_at=ts where id=r.id;
 return jsonb_build_object('id',r.id,'status',r.status,'starts_at',r.starts_at,'server_now',ts,'players',r.players,'winner',r.winner);
end; $$;
revoke all on function public.ludus_match(text,uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.ludus_match(text,uuid,uuid,jsonb,jsonb) to authenticated;

commit;
select 'Klan, kasa, savaş kadrosu ve arma sistemi hazır' as result;
