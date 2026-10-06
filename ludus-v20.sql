begin;
create table if not exists public.ludus_friends (
 requester uuid not null references public.ludus_accounts(user_id),target uuid not null references public.ludus_accounts(user_id),state text not null default 'pending' check(state in('pending','accepted','removed')),updated_at timestamptz not null default now(), check(requester<>target),primary key(requester,target));
create unique index if not exists ludus_friends_pair on public.ludus_friends(least(requester,target),greatest(requester,target));
alter table public.ludus_friends enable row level security;
revoke all on public.ludus_friends from anon,authenticated;
create table if not exists public.ludus_presence(user_id uuid primary key references public.ludus_accounts(user_id),last_seen timestamptz not null default now());
alter table public.ludus_presence enable row level security;
revoke all on public.ludus_presence from anon,authenticated;
create or replace function public.ludus_social(p_action text default 'list',p_username text default null,p_peer uuid default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();v uuid;r public.ludus_friends;result jsonb;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Hesabına giriş yap.';end if;
 insert into public.ludus_presence(user_id,last_seen)values(u,clock_timestamp())on conflict(user_id)do update set last_seen=excluded.last_seen;
 if p_action='request' then
  select user_id into v from public.ludus_accounts where lower(username)=lower(trim(p_username));
  if v is null then raise exception 'Bu kullanıcı adı bulunamadı.';end if;
  if v=u then raise exception 'Kendine arkadaşlık isteği gönderemezsin.';end if;
  if(select count(*)from public.ludus_friends where requester=u and state='pending')>=20 then raise exception 'Önce bekleyen isteklerini tamamla.';end if;
  select * into r from public.ludus_friends where least(requester,target)=least(u,v)and greatest(requester,target)=greatest(u,v)for update;
  if found then
   if r.state='removed' then update public.ludus_friends set requester=u,target=v,state='pending',updated_at=now()where requester=r.requester and target=r.target;end if;
  else insert into public.ludus_friends(requester,target)values(u,v)on conflict do nothing;end if;
 elsif p_action in('accept','remove')then
  if p_action='accept'then update public.ludus_friends set state='accepted',updated_at=now()where target=u and requester=p_peer and state='pending';
  else update public.ludus_friends set state='removed',updated_at=now()where ((requester=u and target=p_peer)or(target=u and requester=p_peer))and state<>'removed';end if;
 elsif p_action not in('list','ping')then raise exception 'Geçersiz işlem.';end if;
 if p_action='ping'then return jsonb_build_object('ok',true);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.user_id,'username',a.username,'name',a.ludus_name,'state',f.state,'incoming',f.target=u,'online',f.state='accepted' and coalesce(p.last_seen>clock_timestamp()-interval '75 seconds',false))order by a.username),'[]'::jsonb)into result
 from public.ludus_friends f join public.ludus_accounts a on a.user_id=case when f.requester=u then f.target else f.requester end left join public.ludus_presence p on p.user_id=a.user_id
 where(u=f.requester or u=f.target)and f.state<>'removed';
 return jsonb_build_object('friends',result);
end;$$;
revoke all on function public.ludus_social(text,text,uuid)from public,anon;
grant execute on function public.ludus_social(text,text,uuid)to authenticated;
insert into public.ludus_shop_catalog(sku,category,name,kind,model,price) values('helmet-roman','Miğferler','Roma miğferi','helmet','roman',100)on conflict(sku)do update set name=excluded.name,model=excluded.model,category=excluded.category,price=excluded.price;
commit;
select 'Arkadaşlar ve Roma miğferi hazır' as result;
begin;
create table if not exists public.ludus_duels(
 id uuid primary key default gen_random_uuid(),host_id uuid not null references public.ludus_accounts(user_id),guest_id uuid references public.ludus_accounts(user_id),host_g uuid not null,guest_g uuid,status text not null default 'waiting' check(status in('waiting','playing','finished')),a jsonb not null,b jsonb,winner uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),a_at timestamptz not null default now(),b_at timestamptz,a_hit timestamptz,b_hit timestamptz);
alter table public.ludus_duels enable row level security;
revoke all on public.ludus_duels from anon,authenticated;
create or replace function public.ludus_duel(p_action text,p_room uuid default null,p_gladiator uuid default null,p_slots jsonb default '{}'::jsonb,p_input jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();r public.ludus_duels;g public.ludus_gladiators;s jsonb;own jsonb;enemy jsonb;is_a boolean;ts timestamptz:=clock_timestamp();dt numeric;mx numeric;mz numeric;len numeric;px numeric;pz numeric;dist numeric;hit_at timestamptz;strike boolean;hp numeric;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u)then raise exception 'Hesabına giriş yap.';end if;
 if p_action='join'then
  perform pg_advisory_xact_lock(202620);
  select * into r from public.ludus_duels where (host_id=u or guest_id=u)and status in('waiting','playing')and updated_at>ts-interval '75 seconds' order by created_at desc limit 1 for update;
  if not found then
   select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u;
   if not found or g.status<>'available' then raise exception 'Hazır bir gladyatör seç.';end if;
   if jsonb_typeof(p_slots)<>'object'or (select count(*)from jsonb_object_keys(p_slots))>6 then raise exception 'Geçersiz ekipman seçimi.';end if;
   select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('equipped_slot',e.key)),'[]'::jsonb)into s from jsonb_each_text(p_slots)e join public.ludus_items i on i.id::text=e.value and i.owner_id=u and i.locked_battle_id is null where e.key in('main_hand','off_hand','helmet','chest','gloves','legs') and ((e.key='main_hand'and i.kind='weapon')or(e.key='off_hand'and i.kind in('weapon','shield'))or e.key=i.kind);
   own:=jsonb_build_object('owner',u,'name',g.name,'class',g.class,'gladiator',to_jsonb(g),'items',s,'x',0,'z',-3,'angle',0,'hp',100,'maxHp',100,'block',false,'action','idle','serial',0);
   select * into r from public.ludus_duels where status='waiting'and host_id<>u and updated_at>ts-interval '30 seconds'order by created_at limit 1 for update skip locked;
   if found then
    own:=own||jsonb_build_object('z',3,'angle',pi());update public.ludus_duels set guest_id=u,guest_g=g.id,b=own,status='playing',updated_at=ts,a_at=ts,b_at=ts where id=r.id returning * into r;
   else insert into public.ludus_duels(host_id,host_g,a,updated_at,a_at)values(u,g.id,own,ts,ts)returning * into r;end if;
  end if;
 else
  select * into r from public.ludus_duels where id=p_room and(host_id=u or guest_id=u)for update;
  if not found then raise exception 'Bu düelloya erişemezsin.';end if;
  is_a:=r.host_id=u;own:=case when is_a then r.a else r.b end;enemy:=case when is_a then r.b else r.a end;
  if p_action='leave'and r.status<>'finished'then update public.ludus_duels set status='finished',winner=case when is_a then r.guest_id else r.host_id end,updated_at=ts where id=r.id returning * into r;
  elsif p_action='step'then
   if r.status='playing'and ts-(case when is_a then r.b_at else r.a_at end)>interval '20 seconds'then update public.ludus_duels set status='finished',winner=u,updated_at=ts where id=r.id returning * into r;
   elsif r.status='playing'then
    if jsonb_typeof(p_input)<>'object' or coalesce(jsonb_typeof(p_input->'x'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'z'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'attack'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'block'),'boolean')<>'boolean' then raise exception 'Geçersiz kontrol.';end if;
    dt:=greatest(0,least(.25,extract(epoch from ts-(case when is_a then r.a_at else r.b_at end))));
    mx:=greatest(-1,least(1,coalesce((p_input->>'x')::numeric,0)));mz:=greatest(-1,least(1,coalesce((p_input->>'z')::numeric,0)));len:=greatest(1,sqrt(mx*mx+mz*mz));
    px:=greatest(-7,least(7,(own->>'x')::numeric+mx/len*dt*3.5));pz:=greatest(-7,least(7,(own->>'z')::numeric+mz/len*dt*3.5));dist:=sqrt(power(px-(enemy->>'x')::numeric,2)+power(pz-(enemy->>'z')::numeric,2));
    hit_at:=case when is_a then r.a_hit else r.b_hit end;
    strike:=coalesce((p_input->>'attack')::boolean,false)and(hit_at is null or ts-hit_at>=interval '750 milliseconds');
    own:=own||jsonb_build_object('x',px,'z',pz,'angle',atan2((enemy->>'x')::double precision-px::double precision,(enemy->>'z')::double precision-pz::double precision),'block',coalesce((p_input->>'block')::boolean,false),'action',case when strike then 'attack'when coalesce((p_input->>'block')::boolean,false)then 'block'else 'idle'end,'serial',coalesce((own->>'serial')::integer,0)+case when strike then 1 else 0 end,'move',sqrt(mx*mx+mz*mz));
    if strike then hit_at:=ts;if dist<=1.85 then hp:=greatest(0,(enemy->>'hp')::numeric-case when coalesce((enemy->>'block')::boolean,false)then 3 else 14 end);enemy:=enemy||jsonb_build_object('hp',hp);if hp=0 then r.status:='finished';r.winner:=u;end if;end if;end if;
    if is_a then r.a:=own;r.b:=enemy;r.a_at:=ts;r.a_hit:=hit_at;else r.b:=own;r.a:=enemy;r.b_at:=ts;r.b_hit:=hit_at;end if;
    update public.ludus_duels set a=r.a,b=r.b,a_at=r.a_at,b_at=r.b_at,a_hit=r.a_hit,b_hit=r.b_hit,status=r.status,winner=r.winner,updated_at=ts where id=r.id returning * into r;
   elsif r.status='waiting'then update public.ludus_duels set updated_at=ts,a_at=ts where id=r.id returning * into r;end if;
  elsif p_action<>'state'then raise exception 'Geçersiz işlem.';end if;
 end if;
 return jsonb_build_object('id',r.id,'status',r.status,'host',r.host_id,'winner',r.winner,'a',r.a,'b',r.b,'server_now',ts);
end;$$;
revoke all on function public.ludus_duel(text,uuid,uuid,jsonb,jsonb)from public,anon;
grant execute on function public.ludus_duel(text,uuid,uuid,jsonb,jsonb)to authenticated;
commit;
select 'Multiplayer düello sunucusu hazır' as result;
