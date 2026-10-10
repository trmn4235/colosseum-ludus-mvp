-- Close older menus under their original rules before moving food buffs to combat.
do $$declare u uuid;begin for u in select owner_id from public.ludus_food_house order by owner_id loop perform ludus_food_private.settle_v55(u,(transaction_timestamp()at time zone'Europe/Istanbul')::date);end loop;end;$$;
create table if not exists ludus_food_private.combat_policy_v60(id boolean primary key default true check(id),starts_at timestamptz not null default clock_timestamp());
alter table ludus_food_private.combat_policy_v60 enable row level security;
revoke all on ludus_food_private.combat_policy_v60 from public,anon,authenticated;
insert into ludus_food_private.combat_policy_v60(id)values(true)on conflict(id)do nothing;
-- Called only by authenticated, owner-validated server APIs. Freeze this in the match snapshot.
create or replace function ludus_food_private.combat_bonus_v60(p_owner uuid)
returns numeric language plpgsql set search_path='' as $$
declare bonus numeric:=0;today date:=(clock_timestamp()at time zone'Europe/Istanbul')::date;
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 perform ludus_food_private.settle_v55(p_owner,today);
 select ludus_food_private.recovery_bonus_v59(last_menu)into bonus from public.ludus_food_house where owner_id=p_owner and settled_day=today-1;
 return coalesce(bonus,0);
end;$$;
create or replace function ludus_food_private.menu_v55(p_crew integer,p_items jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare target integer:=greatest(0,p_crew)*20;goal integer:=case when p_crew>0 then p_crew*20+19 else 0 end;paths jsonb[];scores integer[];
 entry jsonb;sku text;weight integer;remaining integer;chunk integer;take integer;j integer;
 candidate jsonb;score integer;types integer;groups integer;count_items integer;
 used integer:=0;wine integer:=0;served jsonb:='[]';available bigint:=0;group_coverage numeric:=0;quality numeric:=0;coverage numeric:=0;
begin
 -- Integer portions, five-unit steps, bounded knapsack: maximize nutrition
 -- with the smallest excess for indivisible portions. Prefer groups and variety at equal totals.
 paths:=array_fill(null::jsonb,array[goal+1]);scores:=array_fill(-1000000,array[goal+1]);
 paths[1]:='{}';scores[1]:=0;
 for entry in select value from jsonb_array_elements(p_items)loop
  sku:=entry->>'sku';weight:=case sku when 'meat' then 6 when 'fish' then 5
   when 'meal' then 20 when 'egg' then 4 when 'bread' then 3 when 'grain' then 4 when 'apple' then 3 when 'beer' then 1 else 0 end;
  available:=available+weight*5*(entry->>'quantity')::bigint;
  if weight=0 then continue;end if;
  remaining:=least((entry->>'quantity')::integer,goal/weight);if sku='beer' then remaining:=least(remaining,p_crew);end if;chunk:=1;
  while remaining>0 loop
   take:=least(chunk,remaining);
   for j in reverse goal..weight*take loop
    if paths[j-weight*take+1]is not null then
     candidate:=jsonb_set(paths[j-weight*take+1],array[sku],to_jsonb(coalesce((paths[j-weight*take+1]->>sku)::integer,0)+take));
     select count(*),count(distinct case key when 'beer' then null when 'grain' then 'staple' when 'bread' then 'staple'
      when 'apple' then 'fruit' else 'protein' end),sum(value::integer)
     into types,groups,count_items from jsonb_each_text(candidate);
     if candidate?'meal' then groups:=3;end if;
     score:=groups*10000+types*100-count_items;
     if scores[j+1]<score then paths[j+1]:=candidate;scores[j+1]:=score;end if;
    end if;
   end loop;
   remaining:=remaining-take;chunk:=chunk*2;
  end loop;
 end loop;
 candidate:=null;
 for j in target..goal loop if paths[j+1]is not null then used:=j*5;candidate:=paths[j+1];exit;end if;end loop;
 if candidate is null then for j in reverse target..0 loop if paths[j+1]is not null then used:=j*5;candidate:=paths[j+1];exit;end if;end loop;end if;
 for entry in select value from jsonb_array_elements(p_items)loop
  sku:=entry->>'sku';
  if sku='beer' then wine:=coalesce((candidate->>sku)::integer,0);take:=wine;
  else take:=coalesce((candidate->>sku)::integer,0);end if;
  served:=served||jsonb_build_array(jsonb_build_object('sku',sku,'quantity',take));
 end loop;
 if p_crew>0 then
  select least(3,coalesce(sum(least(1.0,n/p_crew)*case when g='complete' then 3 else 1 end),0))into group_coverage from
  (select case key when 'meal' then 'complete' when 'grain' then 'staple' when 'bread' then 'staple' when 'apple' then 'fruit' when 'beer' then null else 'protein' end g,
   sum(value::numeric)n from jsonb_each_text(candidate)where key<>'beer' group by 1)x;
  coverage:=least(1,used::numeric/(p_crew*100));
 end if;
 if p_crew>0 and coverage=1 then
  quality:=50*least(1.0,(coalesce((candidate->>'meat')::numeric,0)+coalesce((candidate->>'fish')::numeric,0)+coalesce((candidate->>'egg')::numeric,0)+coalesce((candidate->>'meal')::numeric,0))/p_crew)
   +50*least(1.0,(coalesce((candidate->>'apple')::numeric,0)+coalesce((candidate->>'meal')::numeric,0))/p_crew);
 end if;
 return jsonb_build_object('quality',round(quality,1),'recovery_bonus_percent',0,'stamina_bonus_percent',case when coverage=1 then case when quality>=100 then 12 when quality>=50 then 8 else 4 end else 0 end,'menu_tier',case when coverage<1 or p_crew=0 then 'insufficient' when quality>=100 then 'balanced' when quality>=50 then 'supported' else 'basic' end,'crew_count',p_crew,'daily_need',p_crew*100,'meal_size',50,'meals_per_day',2,
 'units',used,'available_units',available,'missing_units',greatest(0,p_crew*100-used),'extra_units',greatest(0,used-p_crew*100),'served',served,
 'meals',least(p_crew*2,used/50),'available_meals',available/50,'meal_days',case when p_crew>0 then available/(p_crew*100)end,
 'coverage',case when p_crew>0 then round(coverage*100,1)end,
 'morale',case when p_crew>0 then round(least(100,70.0*coverage+20.0/3*group_coverage*coverage+10.0*wine/p_crew*coverage),1)end);
end;$$;
create or replace function ludus_food_private.api_v55(p_action text,p_sku text,p_quantity integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();today date:=(transaction_timestamp()at time zone'Europe/Istanbul')::date;
 coins bigint;crew integer;price integer;stock integer;receipt public.ludus_food_orders;
 house public.ludus_food_house;items jsonb;served jsonb;history jsonb;purchase jsonb;forecast jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Giriş gerekiyor.';end if;
 if p_action not in('state','buy') or p_action is null then raise exception 'İşlem geçersiz.';end if;
 select gold into coins from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 select count(*)into crew from public.ludus_gladiators where owner_id=u;
 insert into public.ludus_food_house(owner_id,crew_count,settled_day)values(u,crew,today-1)on conflict(owner_id)do nothing;
 insert into public.ludus_food_stock(owner_id,sku)select u,sku from public.ludus_food_catalog on conflict(owner_id,sku)do nothing;
 perform ludus_food_private.settle_v55(u,today);
 update public.ludus_food_house set crew_count=crew where owner_id=u;
 if p_action='buy' then
  if p_request is null or p_quantity is null or p_quantity not between 1 and 5000 then raise exception '1–5000 porsiyon ve işlem kimliği gerekiyor.';end if;
  select * into receipt from public.ludus_food_orders where owner_id=u and request_id=p_request;
  if found then
   if receipt.sku<>p_sku or receipt.quantity<>p_quantity or p_sku is null then raise exception 'İşlem kimliği başka bir alımda kullanılmış.';end if;
   purchase:=jsonb_build_object('request_id',p_request,'sku',p_sku,'quantity',receipt.quantity,'cost',receipt.quantity*receipt.unit_price,'replayed',true);
  else
   select c.price,s.quantity into price,stock from public.ludus_food_catalog c join public.ludus_food_stock s using(sku)where s.owner_id=u and c.sku=p_sku;
   if not found then raise exception 'Gıda bulunamadı.';end if;
   if stock+p_quantity>50000 then raise exception 'Bu gıda için stok sınırı 50.000 porsiyon.';end if;
   if coins<price*p_quantity then raise exception 'Denarius yetersiz.';end if;
   update public.ludus_accounts set gold=gold-price*p_quantity where user_id=u returning gold into coins;
   update public.ludus_food_stock set quantity=quantity+p_quantity where owner_id=u and sku=p_sku;
   insert into public.ludus_food_orders(owner_id,request_id,sku,quantity,unit_price)values(u,p_request,p_sku,p_quantity,price);
   purchase:=jsonb_build_object('request_id',p_request,'sku',p_sku,'quantity',p_quantity,'cost',price*p_quantity,'replayed',false);
  end if;
 end if;
 select jsonb_agg(jsonb_build_object('sku',sku,'quantity',quantity))into served from public.ludus_food_stock where owner_id=u;
 forecast:=ludus_food_private.menu_v55(crew,served);
 select * into house from public.ludus_food_house where owner_id=u;
 select jsonb_agg(jsonb_build_object('sku',c.sku,'name',c.name,'price',c.price,'nutrition',c.nutrition,'edible',c.edible,'quantity',s.quantity,'daily',coalesce((select (e.value->>'quantity')::integer from jsonb_array_elements(forecast->'served')e(value)where e.value->>'sku'=c.sku),0),'days',case when crew>0 then s.quantity/crew end)order by c.sort_order),
 jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',s.quantity)order by c.sort_order)
 into items,served from public.ludus_food_catalog c join public.ludus_food_stock s using(sku)where s.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(h)order by h.to_day desc),'[]')into history from
 (select from_day,to_day,crew_count,menu from public.ludus_food_history where owner_id=u order by to_day desc limit 12)h;
 return jsonb_build_object('user_id',u,'today',today,'server_now',transaction_timestamp(),'reset_at',(today+1)::timestamp at time zone'Europe/Istanbul',
 'gold',coins,'crew_count',crew,'settled_day',house.settled_day,'last_menu',house.last_menu,'menu',forecast,'recovery',jsonb_build_object('active_bonus',0,'forecast_bonus',0,'base_rate',10),'combat',jsonb_build_object('active_bonus',ludus_food_private.combat_bonus_v60(u),'forecast_bonus',forecast->'stamina_bonus_percent','active_until',(today+1)::timestamp at time zone'Europe/Istanbul','base_multiplier',.65),'items',items,'history',history,'purchase',purchase);
end;$$;




-- Preserve already-earned recovery; from this correction onward idle recovery is 10/hour.
create or replace function ludus_private.exercise_recover_v46(p_gladiator uuid)returns void language plpgsql set search_path='' as $$
declare g public.ludus_gladiators;v numeric;ts timestamptz:=clock_timestamp();owner uuid;cut timestamptz;
begin
 select owner_id into owner from public.ludus_gladiators where id=p_gladiator;
 if not found then return;end if;
 perform 1 from public.ludus_accounts where user_id=owner for update;
 perform ludus_food_private.settle_v55(owner,(ts at time zone'Europe/Istanbul')::date);
 select * into g from public.ludus_gladiators where id=p_gladiator for update;
 if not found or g.clan_roster_id is not null then return;end if;
 select starts_at into cut from ludus_food_private.combat_policy_v60 where id;
 v:=greatest(0,g.fatigue_value-ludus_food_private.recovery_base_v59(g.fatigue_rest_from,least(ts,cut))
  -ludus_food_private.recovery_extra_v58(owner,g.fatigue_rest_from,least(ts,cut))
  -greatest(0,extract(epoch from ts-greatest(g.fatigue_rest_from,cut)))/3600*10);
 update public.ludus_gladiators set fatigue_value=v,fatigue=ceil(v),fatigue_rest_from=greatest(ts,g.fatigue_rest_from),recovery_rate=10,recovery_rate_until=null,
 status=case when status='injured'and injured_until<=ts then 'available'else status end,
 injury_level=case when injured_until<=ts then 0 else injury_level end where id=g.id;
end;$$;
alter table public.ludus_gladiators alter column recovery_rate set default 10;
alter table public.ludus_gladiators drop constraint if exists ludus_gladiators_recovery_rate_check;
update public.ludus_gladiators set recovery_rate=10,recovery_rate_until=null;
alter table public.ludus_gladiators add constraint ludus_gladiators_recovery_rate_check check(recovery_rate=10);
do $$declare g uuid;begin for g in select id from public.ludus_gladiators where clan_roster_id is null order by owner_id,id loop perform ludus_private.exercise_recover_v46(g);end loop;end;$$;
revoke all on function ludus_food_private.combat_bonus_v60(uuid),ludus_food_private.menu_v55(integer,jsonb),ludus_private.exercise_recover_v46(uuid)from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ludus_start_battle_v2(p_gladiator uuid, p_mode text, p_slots jsonb, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();g public.ludus_gladiators;it public.ludus_items;kv record;bid uuid;snap jsonb;pool jsonb:='[]';used uuid[]:='{}';entry jsonb;cls text;weapon text;shield text;actor integer;slot text;kind text;model text;b public.ludus_battles;
begin
 if uid is null or p_request is null then raise exception 'Giriş ve işlem kimliği gerekli'; end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;if not found then raise exception 'Ludus bulunamadı';end if;
 select * into b from public.ludus_battles where owner_id=uid and start_request_id=p_request;
 if found then return jsonb_build_object('id',b.id,'mode',b.mode,'snapshot',b.snapshot);end if;
 if exists(select 1 from public.ludus_battles where owner_id=uid and finished_at is null) then raise exception 'Devam eden savaşın var. Önce devam et veya savaştan çekil.';end if;
 if p_mode is null or p_mode not in ('4x5','solo20') then raise exception 'Geçersiz mod';end if;
 perform ludus_private.v7_settle(uid);
 select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=uid for update;
 if not found then raise exception 'Gladyatör bulunamadı';end if;
 if g.status<>'available' or g.fatigue_value>=100 or g.training_ends_at>now() or g.injured_until>now() then raise exception 'Gladyatör savaşa hazır değil';end if;
 if p_slots is null or jsonb_typeof(p_slots)<>'object' then raise exception 'Ekipman seçimi gerekli';end if;
 for kv in select * from jsonb_each_text(p_slots) loop
  if kv.key not in ('main_hand','off_hand','helmet','chest','gloves','legs') then raise exception 'Geçersiz yuva';end if;
  if kv.value is null then continue;end if;
  select * into it from public.ludus_items where id=kv.value::uuid and owner_id=uid for update;
  if not found or it.locked_battle_id is not null or (it.equipped_by is not null and it.equipped_by<>g.id) then raise exception 'Eşya sana ait değil, başka gladyatörde veya savaşta';end if;
  if it.id=any(used) then raise exception 'Bir eşya iki yuvaya takılamaz';end if;
  if not ((kv.key='main_hand' and it.kind='weapon' and it.model in ('gladius','sica','spear','trident','mace','whip')) or (kv.key='off_hand' and it.kind in ('weapon','shield')) or (kv.key=it.kind and kv.key in ('helmet','chest','gloves','legs'))) then raise exception 'Eşya bu yuvaya uygun değil';end if;
  used:=array_append(used,it.id);
 end loop;
 update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=uid and equipped_by=g.id;
 for kv in select * from jsonb_each_text(p_slots) loop
  if kv.value is not null then
   update public.ludus_items set equipped_by=g.id,equipped_slot=kv.key where id=kv.value::uuid returning * into it;
   pool:=pool||jsonb_build_array(jsonb_build_object('token',gen_random_uuid(),'actor',0,'slot',kv.key,'inventory_id',it.id,'item',to_jsonb(it)));
  end if;
 end loop;
 -- Bot equipment is generated here; extraction can only use tokens in this server-owned pool.
 for actor in 1..19 loop
  cls:=(array['murmillo','thraex','hoplomachus','secutor','retiarius','provocator','scissor'])[actor%7+1];
  weapon:=case cls when 'thraex' then 'sica' when 'hoplomachus' then 'spear' when 'retiarius' then 'trident' else 'gladius' end;
  shield:=case cls when 'thraex' then 'small' when 'hoplomachus' then 'round' when 'retiarius' then 'net' when 'scissor' then 'scissor' else 'large' end;
  foreach slot in array array['main_hand','off_hand','helmet','chest','gloves','legs'] loop
   if slot='chest' and cls not in ('murmillo','scissor') then continue;end if;
   kind:=case slot when 'main_hand' then 'weapon' when 'off_hand' then case when shield in ('net','scissor') then 'weapon' else 'shield' end else slot end;
   model:=case slot when 'main_hand' then weapon when 'off_hand' then shield when 'helmet' then case when p_mode='4x5' and actor<5 then 'gold' else 'silver' end else 'starter' end;
   pool:=pool||jsonb_build_array(jsonb_build_object('token',gen_random_uuid(),'actor',actor,'slot',slot,'inventory_id',null,'item',jsonb_build_object('kind',kind,'model',model,'enhancement',0,'base_stats','{}'::jsonb,'sapphires','[]'::jsonb,'rubies','[]'::jsonb,'stat_version',10,'natural_rule_version',2,'natural_stats',ludus_private.item_v10(kind),'natural_percentages',(select jsonb_object_agg(key,0) from jsonb_each(ludus_private.item_v10(kind))),'emeralds','[]'::jsonb,'certus_used',false)));
  end loop;
 end loop;
 snap:=jsonb_build_object('gladiator',to_jsonb(g)||jsonb_build_object('combat_stamina_bonus',ludus_food_private.combat_bonus_v60(uid)),'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.ludus_items i where i.equipped_by=g.id),'[]'::jsonb));
 insert into public.ludus_battles(owner_id,gladiator_id,mode,snapshot,rule_version,start_request_id,loot) values(uid,g.id,p_mode,snap,2,p_request,pool) returning id into bid;
 update public.ludus_items set locked_battle_id=bid where id=any(used);
 return jsonb_build_object('id',bid,'mode',p_mode,'snapshot',snap);
end $function$

;
CREATE OR REPLACE FUNCTION public.ludus_match(p_action text, p_room uuid DEFAULT NULL::uuid, p_gladiator uuid DEFAULT NULL::uuid, p_slots jsonb DEFAULT '{}'::jsonb, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid:=auth.uid(); ts timestamptz:=clock_timestamp(); r public.ludus_matches; g public.ludus_gladiators;
 own jsonb; enemy jsonb; p jsonb; gear jsonb; arr jsonb; idx integer; target_idx integer; k integer; count_alive integer;
 mx double precision; mz double precision; dt double precision; len double precision; px double precision; pz double precision;
 dist double precision; best double precision; angle double precision; spawn double precision; radius double precision;
 wind double precision; active double precision; recover double precision; command_id text; wants_guard boolean; guard_eligible boolean; counter boolean; strike boolean; whip boolean; hp integer; last_hit timestamptz; win uuid; selected_weapon text; wanted text; dodge_command text; dodging boolean; dodge_eligible boolean; attack_region text; selected_hand text;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Hesabına giriş yap.'; end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if p_action='join' then
  perform ludus_private.v7_settle(u);
  perform pg_advisory_xact_lock(202621);
  select m.* into r from public.ludus_matches m where m.status in('waiting','playing') and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text and coalesce((f->>'hp')::int,0)>0 and (f->>'seen')::timestamptz>ts-interval '30 seconds') order by m.created_at desc limit 1 for update;
  if not found then
   select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u for update;
   if not found or g.status<>'available'or g.fatigue_value>=100 or g.injured_until>clock_timestamp()or g.training_ends_at>clock_timestamp()or g.clan_roster_id is not null or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null) then raise exception 'Hazır bir gladyatör seç.'; end if;
   if jsonb_typeof(p_slots)<>'object' or (select count(*) from jsonb_object_keys(p_slots))>6 then raise exception 'Geçersiz ekipman seçimi.'; end if;
   select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('equipped_slot',e.key)),'[]') into gear from jsonb_each_text(p_slots)e join public.ludus_items i on i.id::text=e.value and i.owner_id=u and i.locked_battle_id is null and i.clan_vault_id is null and i.clan_roster_id is null where e.key in('main_hand','off_hand','helmet','chest','gloves','legs') and ((e.key='main_hand' and i.kind='weapon')or(e.key='off_hand' and i.kind in('weapon','shield'))or e.key=i.kind);
   if jsonb_array_length(gear)<>(select count(*) from jsonb_object_keys(p_slots)) or (select count(distinct f->>'id') from jsonb_array_elements(gear) f)<>jsonb_array_length(gear) then raise exception 'Ekipman seçimini yenile.'; end if;
   own:=jsonb_build_object('owner',u,'name',g.name,'class',g.class,'gladiator',to_jsonb(g)||jsonb_build_object('combat_stamina_bonus',ludus_food_private.combat_bonus_v60(u)),'items',gear,'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'maxStamina',100,'stamina',100,'stamina_at',ts,'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0);
   select m.* into r from public.ludus_matches m where m.status='waiting' and m.starts_at>ts and m.updated_at>ts-interval '30 seconds' order by m.created_at limit 1 for update;
   if found then update public.ludus_matches set players=r.players||jsonb_build_array(own),updated_at=ts where id=r.id returning * into r;
   else insert into public.ludus_matches(players,starts_at,updated_at) values(jsonb_build_array(own),ts+interval '10 seconds',ts) returning * into r; end if;
  end if;
 else
  select m.* into r from public.ludus_matches m where m.id=p_room and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text) for update;
  if not found then raise exception 'Bu maça erişemezsin.'; end if;
 end if;
 ts:=clock_timestamp();
 if r.status='playing' then r.players:=private.ludus_advance_combat_v36(r.players,ts);r.players:=private.ludus_resolve_combat_v36(r.players,ts); end if;
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
   if coalesce(jsonb_typeof(p_input->'dodge'),'boolean')<>'boolean'
    or coalesce(jsonb_typeof(p_input->'dodge_id'),'null') not in('string','null')
    or length(coalesce(p_input->>'dodge_id',''))>80
    or coalesce(jsonb_typeof(p_input->'region'),'string')<>'string'
    or coalesce(p_input->>'region','chest') not in('chest','head','legs','leftArm','rightArm')
    or coalesce(jsonb_typeof(p_input->'hand'),'string')<>'string'
    or coalesce(p_input->>'hand','main_hand') not in('main_hand','off_hand') then raise exception 'Geçersiz kontrol.'; end if;
   attack_region:=coalesce(p_input->>'region','chest');
   selected_hand:=coalesce(p_input->>'hand','main_hand');
   if selected_hand='off_hand' and not exists(select 1 from jsonb_array_elements(own->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='weapon') then selected_hand:='main_hand'; end if;
   -- Delta comes from the previously persisted server timestamp, never from the client.
   dt:=greatest(0,least(.25,extract(epoch from ts-(r.players->idx->>'tick_at')::timestamptz)));
   if dt is null then dt:=0; end if;
   mx:=greatest(-1,least(1,coalesce((p_input->>'x')::double precision,0))); mz:=greatest(-1,least(1,coalesce((p_input->>'z')::double precision,0))); len:=greatest(1,sqrt(mx*mx+mz*mz));
   radius:=case when coalesce((own->>'swing_end')::timestamptz,'epoch')>ts or coalesce((own->>'dodge_until')::timestamptz,'epoch')>ts then 0 when coalesce((p_input->>'block')::boolean,false) then 1.8 else 3.5 end;
   px:=(own->>'x')::double precision+mx/len*dt*radius; pz:=(own->>'z')::double precision+mz/len*dt*radius;
   if own->>'pull_from' is not null or coalesce((own->>'stagger_until')::timestamptz,'epoch')>ts or coalesce((own->>'recoil_until')::timestamptz,'epoch')>ts then px:=(own->>'x')::float; pz:=(own->>'z')::float; mx:=0; mz:=0; end if;
   len:=greatest(1,sqrt(px*px+pz*pz)/10.5); px:=px/len; pz:=pz/len;
   target_idx:=null; best:=1e9; wanted:=p_input->>'target'; k:=0;
   for p in select value from jsonb_array_elements(r.players) loop
    if p->>'owner'<>u::text and (p->>'hp')::int>0 then
     dist:=sqrt(power(px-(p->>'x')::float,2)+power(pz-(p->>'z')::float,2));
     if p->>'owner'=wanted then target_idx:=k; exit; elsif dist<best then best:=dist; target_idx:=k; end if;
    end if; k:=k+1;
   end loop;
   enemy:=r.players->target_idx; angle:=coalesce((own->>'angle')::float,0);
   if enemy is not null and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts then angle:=atan2((enemy->>'x')::float-px,(enemy->>'z')::float-pz); end if;
   dodge_command:=coalesce(p_input->>'dodge_id','');
   dodge_eligible:=own->>'pull_from' is null and coalesce((own->>'stamina')::float,100)>=25
    and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts;
   dodging:=coalesce((p_input->>'dodge')::boolean,false) and dodge_command<>'' and dodge_command is distinct from own->>'last_dodge_command' and dodge_eligible;
   if coalesce((p_input->>'dodge')::boolean,false) and dodge_command<>'' then own:=own||jsonb_build_object('last_dodge_command',dodge_command); end if;
   if dodging then
    len:=sqrt(mx*mx+mz*mz);
    own:=own||jsonb_build_object('dodge_at',ts,'dodge_until',ts+interval '460 milliseconds','dodge_tick_at',ts,'dodge_serial',coalesce((own->>'dodge_serial')::int,0)+1,
     'dodge_dx',case when len>.01 then mx/len else -sin(angle) end,'dodge_dz',case when len>.01 then mz/len else -cos(angle) end,
     'stamina',greatest(0,coalesce((own->>'stamina')::float,100)-25),'stamina_regen_at',ts+interval '1 second');
   end if;
   last_hit:=(own->>'hit_at')::timestamptz;
   command_id:=coalesce(p_input->>'attack_id','');
   if jsonb_typeof(p_input->'attack_id') not in('string','null') or length(command_id)>80 then raise exception 'Geçersiz saldırı işlemi.'; end if;
   strike:=not dodging and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>=13 and enemy is not null and own->>'pull_from' is null and coalesce((p_input->>'attack')::boolean,false)
    and coalesce((own->>'cooldown_until')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and (command_id='' or command_id is distinct from own->>'last_attack_command')
    and (own->>'swing_at' is not null or last_hit is null or ts-last_hit>=interval '750 milliseconds');
   if coalesce((p_input->>'attack')::boolean,false) and command_id<>'' then own:=own||jsonb_build_object('last_attack_command',command_id); end if;
   select f->>'model' into selected_weapon from jsonb_array_elements(own->'items') f where f->>'equipped_slot'=selected_hand and f->>'kind'='weapon';
   whip:=coalesce(not dodging and own->>'pull_from' is null and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>=28 and sqrt(power(px-(enemy->>'x')::float,2)+power(pz-(enemy->>'z')::float,2))<=2 and coalesce((own->>'cooldown_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and selected_weapon='whip' and wanted=enemy->>'owner' and coalesce((p_input->>'special')::boolean,false) and ((own->>'special_at') is null or ts-(own->>'special_at')::timestamptz>=interval '6 seconds'),false);
   if whip then strike:=false; end if;
   if radius=0 then mx:=0;mz:=0; end if;
   wants_guard:=coalesce((p_input->>'block')::boolean,false);
   guard_eligible:=not dodging and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>0 and own->>'pull_from' is null and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and exists(select 1 from jsonb_array_elements(own->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='shield');
   if wants_guard and not coalesce((own->>'guard_requested')::boolean,false) then
    own:=own||jsonb_build_object('guard_at',case when guard_eligible and coalesce((own->>'guard_rearm')::timestamptz,'epoch')<=ts then ts else null end,'guard_rearm',greatest(ts+interval '420 milliseconds',coalesce((own->>'guard_rearm')::timestamptz,'epoch')));
   end if;
   own:=own||jsonb_build_object('guard_requested',wants_guard);
   own:=own||jsonb_build_object('x',px,'z',pz,'angle',angle,'tick_at',ts,'seen',ts,'move',sqrt(mx*mx+mz*mz),'block',wants_guard and guard_eligible and not strike and not whip,'serial',(own->>'serial')::int+case when strike then 1 else 0 end);
   if strike then
    wind:=case selected_weapon when 'gladius' then .26 when 'sica' then .22 when 'spear' then .30 when 'trident' then .34 when 'mace' then .40 when 'whip' then .32 else .24 end;
    active:=case selected_weapon when 'sica' then .20 when 'trident' then .23 when 'mace' then .26 when 'whip' then .24 else .22 end;
    recover:=case selected_weapon when 'gladius' then .32 when 'sica' then .28 when 'spear' then .34 when 'trident' then .37 when 'mace' then .43 when 'whip' then .36 else .28 end;
    counter:=coalesce((own->>'counter_until')::timestamptz,'epoch')>ts and own->>'counter_target'=enemy->>'owner';
    if counter then wind:=wind*.55;recover:=recover*.85; end if;
    own:=own||jsonb_build_object('stamina',greatest(0,coalesce((own->>'stamina')::float,100)-13),'stamina_regen_at',ts+interval '1 second','hit_at',ts,'swing_at',ts,'wind',wind,'active',active,'recover',recover,'strike_at',ts+(wind+active*.5)*interval '1 second',
     'strike_target',enemy->>'owner','strike_weapon',selected_weapon,'strike_region',attack_region,'strike_hand',selected_hand,'strike_counter',counter,'strike_resolved',false,'swing_end',ts+(wind+active+recover)*interval '1 second',
     'cooldown_until',ts+(wind+active+recover)*interval '1 second','recoil_at',null,'recoil_until',null,'stagger_until',null,'attack_result',null);
    if counter then own:=own||jsonb_build_object('counter_until',null,'counter_target',null); end if;
   end if;
   if enemy is not null then
    dist:=sqrt(power(px-(enemy->>'x')::float,2)+power(pz-(enemy->>'z')::float,2));
    if whip then own:=own||jsonb_build_object('stamina',greatest(0,coalesce((own->>'stamina')::float,100)-28),'stamina_regen_at',ts+interval '1 second','special_at',ts,'pull_serial',(own->>'pull_serial')::int+1,'pull_target',enemy->>'owner'); enemy:=enemy||jsonb_build_object('pull_from',u,'pull_until',ts+interval '6 seconds','pull_at',ts,'block',false);
    end if;
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
 return jsonb_build_object('id',r.id,'status',r.status,'starts_at',r.starts_at,'server_now',ts,'players',r.players,'winner',r.winner,'combat_version',23,'controls_version',36);
end; $function$

;
CREATE OR REPLACE FUNCTION private.ludus_advance_combat_v36(p_players jsonb, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 arr jsonb:='[]'; p jsonb; energy float; dt float; tick timestamptz; finish timestamptz; px float; pz float; len float;
begin
 for p in select value from jsonb_array_elements(p_players) loop
  if coalesce((p->>'hp')::int,0)>0 then
   tick:=coalesce((p->>'stamina_at')::timestamptz,p_now);
   dt:=greatest(0,least(2,extract(epoch from p_now-tick)));
   energy:=least(100,greatest(0,coalesce((p->>'stamina')::float,100)));
   if coalesce((p->>'block')::boolean,false) then energy:=greatest(0,energy-dt*2);
   elsif coalesce((p->>'swing_end')::timestamptz,'epoch')<=p_now and coalesce((p->>'dodge_until')::timestamptz,'epoch')<=p_now then
    dt:=greatest(0,least(dt,extract(epoch from p_now-greatest(tick,coalesce((p->>'stamina_regen_at')::timestamptz,tick)))));
    energy:=least(100,energy+dt*16*.65*(1+least(12,greatest(0,coalesce((p->'gladiator'->>'combat_stamina_bonus')::numeric,0)))/100));
   end if;
   p:=p||jsonb_build_object('stamina',energy,'maxStamina',100,'stamina_at',p_now);
   if energy<=0 then p:=p||jsonb_build_object('block',false,'guard_at',null); end if;
   if p->>'dodge_until' is not null and p->>'dodge_tick_at' is not null then
    finish:=least(p_now,(p->>'dodge_until')::timestamptz);
    dt:=greatest(0,least(.46,extract(epoch from finish-(p->>'dodge_tick_at')::timestamptz)));
    if dt>0 and p->>'pull_from' is null then
     px:=(p->>'x')::float+coalesce((p->>'dodge_dx')::float,0)*7.5*dt;pz:=(p->>'z')::float+coalesce((p->>'dodge_dz')::float,0)*7.5*dt;
     len:=greatest(1,sqrt(px*px+pz*pz)/10.5);
     p:=p||jsonb_build_object('x',px/len,'z',pz/len,'move',0,'block',false,'dodge_tick_at',finish);
    end if;
   end if;
  end if;
  arr:=arr||jsonb_build_array(p);
 end loop;
 return arr;
end; $function$


;
revoke all on function private.ludus_advance_combat_v36(jsonb,timestamptz)from public,anon,authenticated;
