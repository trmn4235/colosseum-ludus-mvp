create schema if not exists ludus_circus_private;
revoke all on schema ludus_circus_private from public,anon;
grant usage on schema ludus_circus_private to authenticated;
create table ludus_circus_private.heats(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.ludus_accounts(user_id),
 created_at timestamptz not null default clock_timestamp(), teams jsonb not null,
 status text not null default 'open' check(status in('open','running','settled')),
 entered boolean not null default false, horse_ids uuid[],
 selected integer check(selected between 0 and 3), stake integer not null default 0 check(stake between 0 and 10000),
 odds numeric, payout bigint not null default 0, paid_at timestamptz,
 started_at timestamptz, finish_at timestamptz, durations jsonb, winner integer,
 check(not entered or selected is null)
);
create unique index circus_active_owner on ludus_circus_private.heats(owner_id)where status<>'settled';
create index circus_owner_history on ludus_circus_private.heats(owner_id,created_at desc);
create table ludus_circus_private.receipts(owner_id uuid not null references public.ludus_accounts(user_id),request_id uuid not null,action text not null,args jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(owner_id,request_id));
alter table ludus_circus_private.heats enable row level security;
alter table ludus_circus_private.receipts enable row level security;
revoke all on all tables in schema ludus_circus_private from public,anon,authenticated;

create function ludus_circus_private.roster()returns jsonb language sql immutable set search_path='' as $$ select '[{"id": 0, "name": "Bordo", "horses": [{"id": "npc-0-0", "name": "Aquila", "coat": "white", "stats": {"power": 82, "speed": 85, "acceleration": 88, "agility": 82, "stamina": 85, "balance": 88, "courage": 82, "recovery": 85, "burst": 88}, "quality": 85.0}, {"id": "npc-0-1", "name": "Invictus", "coat": "grey", "stats": {"power": 86, "speed": 89, "acceleration": 83, "agility": 86, "stamina": 89, "balance": 83, "courage": 86, "recovery": 89, "burst": 83}, "quality": 86.0}], "quality": 85.5, "odds": 1.5}, {"id": 1, "name": "Mavi", "horses": [{"id": "npc-1-0", "name": "Boreas", "coat": "dark_brown", "stats": {"power": 73, "speed": 76, "acceleration": 79, "agility": 73, "stamina": 76, "balance": 79, "courage": 73, "recovery": 76, "burst": 79}, "quality": 76.0}, {"id": "npc-1-1", "name": "Neptunus", "coat": "black", "stats": {"power": 77, "speed": 80, "acceleration": 74, "agility": 77, "stamina": 80, "balance": 74, "courage": 77, "recovery": 80, "burst": 74}, "quality": 77.0}], "quality": 76.5, "odds": 1.9}, {"id": 2, "name": "Yeşil", "horses": [{"id": "npc-2-0", "name": "Viridis", "coat": "pinto", "stats": {"power": 64, "speed": 67, "acceleration": 70, "agility": 64, "stamina": 67, "balance": 70, "courage": 64, "recovery": 67, "burst": 70}, "quality": 67.0}, {"id": "npc-2-1", "name": "Silva", "coat": "caramel", "stats": {"power": 68, "speed": 62, "acceleration": 65, "agility": 68, "stamina": 62, "balance": 65, "courage": 68, "recovery": 62, "burst": 65}, "quality": 65.0}], "quality": 66.0, "odds": 2.3}, {"id": 3, "name": "Altın", "horses": [{"id": "npc-3-0", "name": "Sol", "coat": "light_brown", "stats": {"power": 51, "speed": 54, "acceleration": 48, "agility": 51, "stamina": 54, "balance": 48, "courage": 51, "recovery": 54, "burst": 48}, "quality": 51.0}, {"id": "npc-3-1", "name": "Aurum", "coat": "dark_brown", "stats": {"power": 55, "speed": 49, "acceleration": 52, "agility": 55, "stamina": 49, "balance": 52, "courage": 55, "recovery": 49, "burst": 52}, "quality": 52.0}], "quality": 51.5, "odds": 3.9}]'::jsonb $$;
create function ludus_circus_private.prices(teams jsonb)returns jsonb language sql immutable set search_path='' as $$
 select jsonb_agg(team||jsonb_build_object('odds',(array[1.5,1.9,2.3,3.9])[ranking::int]) order by (team->>'id')::int)
 from(select value team,row_number()over(order by (value->>'quality')::numeric desc,(value->>'id')::int)ranking from jsonb_array_elements(teams))q
$$;
create function ludus_circus_private.eligible(h ludus_stable_private.horses,t timestamptz)returns boolean language sql stable set search_path='' as $$
 select ludus_stable_private.stage(h.born_at,t)='adult' and h.pregnant_until is null and h.training_until is null and h.sale_price is null and h.energy>=35 and h.fed_until>t and (h.duel_ready is null or h.duel_ready<=t)
$$;
create function ludus_circus_private.api(p_action text,p_args jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t timestamptz:=clock_timestamp();a public.ludus_accounts;h ludus_circus_private.heats;receipt ludus_circus_private.receipts;
 teams jsonb;cards jsonb:='[]';owned jsonb;horse ludus_stable_private.horses;hid uuid;ids uuid[];v_selected integer;v_stake integer;idx integer;rank integer;score numeric;v_durations jsonb;v_winner integer;replayed boolean:=false;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','bet','enter','cancel_entry','start','next')then raise exception 'Geçersiz hipodrom işlemi.';end if;
 p_args:=coalesce(p_args,'{}');
 select * into a from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Önce ludus hesabını oluştur.';end if;
 perform ludus_stable_private.settle(u,t);
 select * into h from ludus_circus_private.heats where owner_id=u order by created_at desc,id desc limit 1 for update;
 if not found then insert into ludus_circus_private.heats(owner_id,teams)values(u,ludus_circus_private.roster())returning * into h;end if;
 if h.status='running' and t>=h.finish_at then
  h.payout:=case when h.selected=h.winner then floor(h.stake*h.odds)::bigint else 0 end;
  update public.ludus_accounts set gold=gold+h.payout where user_id=u;
  update ludus_circus_private.heats set status='settled',payout=h.payout,paid_at=t where id=h.id returning * into h;
 end if;
 if p_action<>'state' then
  if p_request is null then raise exception 'İşlem kimliği gerekiyor.';end if;
  select * into receipt from ludus_circus_private.receipts where owner_id=u and request_id=p_request;
  if found then
   if receipt.action<>p_action or receipt.args<>p_args then raise exception 'İşlem kimliği başka bir işlemde kullanılmış.';end if;
   replayed:=true;
  else
   if coalesce(p_args->>'heat','')<>h.id::text then raise exception 'Yarış değişti. Gişeyi yenile.';end if;
   if p_action='next' then
    if h.status<>'settled' then raise exception 'Mevcut yarış bitmeden yeni yarış açılamaz.';end if;
    insert into ludus_circus_private.heats(owner_id,teams)values(u,ludus_circus_private.roster())returning * into h;
   elsif p_action='bet' then
    if h.status<>'open' or h.entered or h.selected is not null then raise exception 'Bu yarış için kupon yapılamaz.';end if;
    v_selected:=(p_args->>'team')::int;v_stake:=(p_args->>'stake')::int;
    if v_selected is null or v_selected not between 0 and 3 or v_stake is null or v_stake not between 10 and 10000 or v_stake%10<>0 then raise exception 'Takım seç ve 10–10.000 arasında, 10 katı denarius gir.';end if;
    update public.ludus_accounts set gold=gold-v_stake where user_id=u and gold>=v_stake;
    if not found then raise exception 'Denarius yetersiz.';end if;
    update ludus_circus_private.heats set selected=v_selected,stake=v_stake,odds=(h.teams->v_selected->>'odds')::numeric where id=h.id returning * into h;
   elsif p_action='enter' then
    if h.status<>'open' or h.selected is not null then raise exception 'Kuponlu veya başlamış yarışa katılamazsın.';end if;
    ids:=array[(p_args->>'horse1')::uuid,(p_args->>'horse2')::uuid];
    if ids[1] is null or ids[2] is null or ids[1]=ids[2] then raise exception 'İki farklı at seç.';end if;
    foreach hid in array ids loop
     select * into horse from ludus_stable_private.horses where id=hid and owner_id=u;
     if not found or not ludus_circus_private.eligible(horse,t)then raise exception 'Atların yetişkin, tok, dinlenmiş ve boşta olmalı.';end if;
     cards:=cards||jsonb_build_array(ludus_stable_private.card(horse,t));
    end loop;
    select round(avg((value->>'quality')::numeric),1)into score from jsonb_array_elements(cards);
    teams:=jsonb_set(h.teams,'{3}',jsonb_build_object('id',3,'name',a.ludus_name,'horses',cards,'quality',score));
    update ludus_circus_private.heats set entered=true,horse_ids=ids,teams=ludus_circus_private.prices(teams)where id=h.id returning * into h;
   elsif p_action='cancel_entry' then
    if h.status<>'open' then raise exception 'Yarış başladı.';end if;
    update ludus_circus_private.heats set entered=false,horse_ids=null,teams=ludus_circus_private.roster()where id=h.id returning * into h;
   elsif p_action='start' then
    if h.status<>'open' then raise exception 'Bu yarış zaten başladı.';end if;
    if h.entered then foreach hid in array h.horse_ids loop
     select * into horse from ludus_stable_private.horses where id=hid and owner_id=u;
     if not found or not ludus_circus_private.eligible(horse,t)then raise exception 'Katılım atlarını tekrar kontrol et.';end if;
    end loop;end if;
    -- Server draws the order only after all bets close. Better teams are more likely, never guaranteed, to win.
    select jsonb_object_agg(id::text,duration),min(id)filter(where place=1) into v_durations,v_winner from(
     select (team->>'id')::int id,row_number()over(order by ticket)place,120+(row_number()over(order by ticket)-1)*3+random() duration
     from(select value team,-ln(greatest(random(),.000001))/power(greatest(1,(value->>'quality')::numeric),4)ticket from jsonb_array_elements(h.teams))q
    )r;
    update ludus_circus_private.heats set status='running',started_at=t,finish_at=t+make_interval(secs=>3+(select max(value::double precision)from jsonb_each_text(v_durations))),durations=v_durations,winner=v_winner where id=h.id returning * into h;
   end if;
   insert into ludus_circus_private.receipts(owner_id,request_id,action,args)values(u,p_request,p_action,p_args);
  end if;
 end if;
 select coalesce(jsonb_agg(ludus_stable_private.card(x,t)||jsonb_build_object('eligible',ludus_circus_private.eligible(x,t))order by x.created_at),'[]')into owned from ludus_stable_private.horses x where x.owner_id=u;
 return jsonb_build_object('user_id',u,'server_now',t,'gold',(select gold from public.ludus_accounts where user_id=u),'horses',owned,'replayed',replayed,'heat',
 jsonb_build_object('id',h.id,'teams',h.teams,'status',h.status,'entered',h.entered,'horse_ids',h.horse_ids,'selected',h.selected,'stake',h.stake,'odds',h.odds,'payout',h.payout,'paid_at',h.paid_at,'started_at',h.started_at,'finish_at',h.finish_at,'durations',case when h.status='open' then null else h.durations end,'winner',case when h.status='settled' then h.winner else null end));
end $$;
revoke all on all functions in schema ludus_circus_private from public,anon,authenticated;
grant execute on function ludus_circus_private.api(text,jsonb,uuid)to authenticated;
create function public.ludus_circus(p_action text default 'state',p_args jsonb default '{}',p_request uuid default null)returns jsonb language sql security invoker set search_path='' as $$select ludus_circus_private.api(p_action,p_args,p_request)$$;
revoke all on function public.ludus_circus(text,jsonb,uuid)from public,anon;
grant execute on function public.ludus_circus(text,jsonb,uuid)to authenticated;
