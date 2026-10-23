-- V172: Şan Avlusu. Pentagon enclosure, rectangular 16 × 12 m combat floor.
begin;
create schema if not exists ludus_pit_private;
revoke all on schema ludus_pit_private from public,anon;
grant usage on schema ludus_pit_private to authenticated,service_role;
create table ludus_pit_private.rules(id boolean primary key default true check(id),entry_fame integer not null check(entry_fame>0),win_fame integer not null check(win_fame>0),gate_enabled boolean not null default false);
insert into ludus_pit_private.rules values(true,30,10,false);
create table ludus_pit_private.fame(gladiator_id uuid primary key references public.ludus_gladiators(id) on delete cascade,points integer not null default 0 check(points>=0));
create table ludus_pit_private.awards(source_id uuid primary key,gladiator_id uuid not null references public.ludus_gladiators(id) on delete cascade,points integer not null,created_at timestamptz not null default now());
create index on ludus_pit_private.awards(gladiator_id);
create table ludus_pit_private.bouts(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,status text not null default 'open' check(status in('open','running','settled')),selected integer check(selected in(0,1)),stake integer not null default 0,odds numeric not null default 1.90,winner integer check(winner in(0,1)),started_at timestamptz,finish_at timestamptz,payout bigint not null default 0,created_at timestamptz not null default now());
create index on ludus_pit_private.bouts(owner_id,created_at desc,id desc);
create table ludus_pit_private.receipts(owner_id uuid not null references public.ludus_accounts(user_id) on delete cascade,request_id uuid not null,action text not null,args jsonb not null,primary key(owner_id,request_id));
alter table ludus_pit_private.rules enable row level security;
alter table ludus_pit_private.fame enable row level security;
alter table ludus_pit_private.awards enable row level security;
alter table ludus_pit_private.bouts enable row level security;
alter table ludus_pit_private.receipts enable row level security;
revoke all on all tables in schema ludus_pit_private from public,anon,authenticated;
alter table public.ludus_battles drop constraint ludus_battles_mode_check;
alter table public.ludus_battles add constraint ludus_battles_mode_check check(mode in('4x5','solo20','survival','pit'));
alter table public.ludus_matches add column venue text not null default 'colosseum' check(venue in('colosseum','pit'));
create index ludus_matches_pit_queue_v172 on public.ludus_matches(venue,created_at) where status='waiting';

create function ludus_pit_private.award(p_source uuid,p_gladiator uuid) returns integer language plpgsql set search_path='' as $$
declare n integer;
begin
 select win_fame into n from ludus_pit_private.rules where id;
 insert into ludus_pit_private.awards(source_id,gladiator_id,points) values(p_source,p_gladiator,n) on conflict do nothing;
 if not found then return 0;end if;
 insert into ludus_pit_private.fame(gladiator_id,points) values(p_gladiator,n) on conflict(gladiator_id) do update set points=ludus_pit_private.fame.points+excluded.points;
 return n;
end $$;
create function ludus_pit_private.gate() returns trigger language plpgsql security definer set search_path='' as $$
declare needed integer;earned integer;
begin
 if new.mode<>'pit' and (select gate_enabled from ludus_pit_private.rules where id) then
  select entry_fame into needed from ludus_pit_private.rules where id;
  select points into earned from ludus_pit_private.fame where gladiator_id=new.gladiator_id;
  if coalesce(earned,0)<needed then raise exception 'Colosseum için % Şan gerekiyor. Bu gladyatör: % Şan. Şan Avlusu’nda düello kazan.',needed,coalesce(earned,0);end if;
 end if;
 return new;
end $$;
create trigger pit_gate_v172 before insert on public.ludus_battles for each row execute function ludus_pit_private.gate();
create function ludus_pit_private.finish(p_battle uuid,p_won boolean,p_stats jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();b public.ludus_battles;prize jsonb;earned integer:=0;
begin
 if u is null then raise exception 'Giriş gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 select reward into prize from public.ludus_battle_receipts where battle_id=p_battle and owner_id=u;
 if found then return prize;end if;
 select * into b from public.ludus_battles where id=p_battle and owner_id=u and mode='pit' for update;
 if not found then raise exception 'Düello bulunamadı';end if;
 if b.finished_at is not null then return b.reward;end if;
 p_won:=coalesce(p_won,false) and now()<b.started_at+interval '2 hours';
 if p_won and (now()<b.started_at+interval '10 seconds' or coalesce((p_stats->>'kills')::int,0)<>1 or not coalesce((p_stats->>'alive')::boolean,false)) then raise exception 'Düello sonucu doğrulanamadı';end if;
 if pg_column_size(p_stats)>16384 then raise exception 'Sonuç çok büyük';end if;
 if p_won then earned:=ludus_pit_private.award(b.id,b.gladiator_id);end if;
 -- Training pit protects the exact carried-in inventory; no fabricated loot or lost items.
 update public.ludus_items set locked_battle_id=null where owner_id=u and locked_battle_id=b.id;
 prize:=jsonb_build_object('gold',0,'fame',earned,'gear_lost',false,'pit',true,'fame_total',coalesce((select points from ludus_pit_private.fame where gladiator_id=b.gladiator_id),0));
 update public.ludus_battles set finished_at=now(),won=p_won,stats=p_stats,reward=prize where id=b.id returning reward into prize;
 insert into public.ludus_battle_receipts(battle_id,owner_id,reward,finished_at) values(b.id,u,prize,now());
 return prize;
end $$;

-- Preserve all existing ownership, gear and combat checks, extending exact versioned seams.
do $patch$
declare s text;old text;
begin
 select pg_get_functiondef('public.ludus_start_battle_v2(uuid,text,jsonb,uuid)'::regprocedure) into s;old:=s;
 s:=replace(s,'''4x5'',''solo20'',''survival''','''4x5'',''solo20'',''survival'',''pit''');
 s:=replace(s,'for actor in 1..19 loop','for actor in 1..(case when p_mode=''pit'' then 1 else 19 end) loop');
 if s=old or position('1..(case when p_mode=''pit''' in s)=0 then raise exception 'Unexpected start function version';end if;execute s;
 select pg_get_functiondef('public.ludus_finish_battle_v2(uuid,boolean,jsonb)'::regprocedure) into s;old:=s;
 s:=replace(s,'if b.mode=''survival'' then',E'if b.mode=''pit'' then return ludus_pit_private.finish(p_battle,p_won,p_stats);end if;\n if b.mode=''survival'' then');
 if s=old then raise exception 'Unexpected finish function version';end if;execute s;
 if to_regprocedure('ludus_private.daily_battle_event()') is not null then
  s:=pg_get_functiondef('ludus_private.daily_battle_event()'::regprocedure);
  s:=replace(s,'new.mode=''survival''','new.mode in(''survival'',''pit'')');execute s;
 end if;
 select pg_get_functiondef('public.ludus_match(text,uuid,uuid,jsonb,jsonb)'::regprocedure) into s;
 s:=replace(s,'u uuid:=auth.uid();','v_venue text:=case when p_input->>''venue''=''pit'' then ''pit'' else ''colosseum'' end; u uuid:=auth.uid();');
 s:=replace(s,'m.status=''waiting'' and not exists','m.status=''waiting'' and m.venue=v_venue and (v_venue<>''pit'' or jsonb_array_length(m.players)<2) and not exists');
 s:=replace(s,'insert into public.ludus_matches(players,starts_at,updated_at) values(jsonb_build_array(own),','insert into public.ludus_matches(venue,players,starts_at,updated_at) values(v_venue,jsonb_build_array(own),');
 -- Existing active rooms may only be resumed at their own venue.
 s:=replace(s,'ts:=clock_timestamp();',E'if p_action=''join'' and r.venue<>v_venue then raise exception ''Önce diğer arenadaki maçından ayrıl.'';end if;\n ts:=clock_timestamp();');
 s:=replace(s,'r.players:=private.ludus_resolve_combat_v36(r.players,ts);','if r.venue=''pit'' then r.players:=ludus_pit_private.bounds(r.players);end if;r.players:=private.ludus_resolve_combat_v36(r.players,ts);');
 s:=replace(s,'len:=greatest(1,sqrt(px*px+pz*pz)/10.5); px:=px/len; pz:=pz/len;','if r.venue=''pit'' then px:=greatest(-7.55,least(7.55,px));pz:=greatest(-5.55,least(5.55,pz));else len:=greatest(1,sqrt(px*px+pz*pz)/10.5); px:=px/len; pz:=pz/len;end if;');
 s:=replace(s,'update public.ludus_matches set players=r.players,status=r.status',E'if r.venue=''pit'' then r.players:=ludus_pit_private.bounds(r.players);end if;\n update public.ludus_matches set players=r.players,status=r.status');
 s:=replace(s,'''id'',r.id,''status'',r.status','''id'',r.id,''venue'',r.venue,''status'',r.status');
 if position('m.venue=v_venue' in s)=0 or position('values(v_venue,jsonb_build_array(own)' in s)=0 then raise exception 'Unexpected match function version';end if;
 execute s;
end $patch$;
create function ludus_pit_private.bounds(players jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(p||jsonb_build_object('x',greatest(-7.55,least(7.55,(p->>'x')::float8)),'z',greatest(-5.55,least(5.55,(p->>'z')::float8))) order by ord),'[]') from jsonb_array_elements(players) with ordinality e(p,ord);
$$;
create function ludus_pit_private.match_finish() returns trigger language plpgsql security definer set search_path='' as $$
declare g uuid;
begin
 if new.venue='pit' and new.status='finished' and old.status='playing' and new.winner is not null and jsonb_array_length(new.players)=2 then
  select (p->'gladiator'->>'id')::uuid into g from jsonb_array_elements(new.players) p where p->>'owner'=new.winner::text;
  if exists(select 1 from public.ludus_gladiators where id=g and owner_id=new.winner)then perform ludus_pit_private.award(new.id,g);end if;
 end if;return new;
end $$;
create trigger pit_match_award_v172 after update of status on public.ludus_matches for each row execute function ludus_pit_private.match_finish();

create function ludus_pit_private.api(p_action text,p_args jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t timestamptz:=clock_timestamp();b ludus_pit_private.bouts;r ludus_pit_private.receipts;choice integer;amount integer;balance bigint;roster jsonb;history jsonb;needed integer;win_points integer;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','bet','start','next')then raise exception 'Geçersiz avlu işlemi.';end if;
 p_args:=coalesce(p_args,'{}');
 select gold into balance from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus hesabı gerekli.';end if;
 select * into b from ludus_pit_private.bouts where owner_id=u order by created_at desc,id desc limit 1 for update;
 if not found then insert into ludus_pit_private.bouts(owner_id)values(u)returning * into b;end if;
 if b.status='running' and t>=b.finish_at then
  b.payout:=case when b.selected=b.winner then floor(b.stake*b.odds)::bigint else 0 end;
  update public.ludus_accounts set gold=gold+b.payout where user_id=u;
  update ludus_pit_private.bouts set status='settled',payout=b.payout where id=b.id returning * into b;
 end if;
 if p_action<>'state' then
  if p_request is null then raise exception 'İşlem kimliği gerekli.';end if;
  select * into r from ludus_pit_private.receipts where owner_id=u and request_id=p_request;
  if found then
   if r.action<>p_action or r.args<>p_args then raise exception 'İşlem kimliği başka istekte kullanıldı.';end if;
  else
   if p_args->>'bout' is distinct from b.id::text then raise exception 'Müsabaka değişti. Gişeyi yenile.';end if;
   if p_action='bet' then
    if b.status<>'open' or b.selected is not null then raise exception 'Bu müsabakaya bahis kapanmış.';end if;
    choice:=(p_args->>'fighter')::int;amount:=(p_args->>'stake')::int;
    if choice is null or choice not in(0,1) or amount is null or amount not between 10 and 1000 or amount%10<>0 then raise exception 'Gladyatör seç; 10–1.000 arası, 10 katı denarius gir.';end if;
    update public.ludus_accounts set gold=gold-amount where user_id=u and gold>=amount;
    if not found then raise exception 'Denarius yetersiz.';end if;
    update ludus_pit_private.bouts set selected=choice,stake=amount where id=b.id returning * into b;
   elsif p_action='start' then
    if b.status<>'open' then raise exception 'Müsabaka zaten başladı.';end if;
    update ludus_pit_private.bouts set status='running',winner=floor(random()*2)::int,started_at=t,finish_at=t+interval '45 seconds' where id=b.id returning * into b;
   elsif p_action='next' then
    if b.status<>'settled' then raise exception 'Önce mevcut müsabaka bitmeli.';end if;
    insert into ludus_pit_private.bouts(owner_id)values(u)returning * into b;
   end if;
   insert into ludus_pit_private.receipts values(u,p_request,p_action,p_args);
  end if;
 end if;
 select entry_fame,win_fame into needed,win_points from ludus_pit_private.rules where id;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'class',g.class,'fame',coalesce(f.points,0)) order by g.created_at,g.id),'[]') into roster from public.ludus_gladiators g left join ludus_pit_private.fame f on f.gladiator_id=g.id where g.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]')into history from(select id,selected,stake,odds,winner,payout,created_at from ludus_pit_private.bouts where owner_id=u and status='settled' and selected is not null order by created_at desc limit 5)x;
 return jsonb_build_object('gold',(select gold from public.ludus_accounts where user_id=u),'entry_fame',needed,'win_fame',win_points,'roster',roster,'history',history,'server_now',t,'bout',jsonb_build_object('id',b.id,'status',b.status,'selected',b.selected,'stake',b.stake,'odds',b.odds,'started_at',b.started_at,'finish_at',b.finish_at,'winner',case when b.status='settled' then b.winner else null end,'payout',b.payout));
end $$;
create function public.ludus_pit(p_action text default 'state',p_args jsonb default '{}',p_request uuid default null) returns jsonb language sql security invoker set search_path='' as $$select ludus_pit_private.api(p_action,p_args,p_request)$$;
revoke all on all functions in schema ludus_pit_private from public,anon,authenticated;
grant execute on function ludus_pit_private.api(text,jsonb,uuid) to authenticated,service_role;
revoke all on function public.ludus_pit(text,jsonb,uuid) from public,anon;
grant execute on function public.ludus_pit(text,jsonb,uuid) to authenticated,service_role;
commit;
