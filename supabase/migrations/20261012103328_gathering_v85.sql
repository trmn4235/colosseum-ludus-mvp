-- V85: free, finite worker expeditions. No businesses, ingredient trading or cooking.
-- Existing purchased food and already-earned rewards are preserved.
create schema if not exists ludus_supply_private;
revoke all on schema ludus_supply_private from public,anon,authenticated;
grant usage on schema ludus_supply_private to authenticated;

alter table ludus_private.level_reward_catalog add column if not exists workers integer not null default 0 check(workers between 0 and 1);
update ludus_private.level_reward_catalog set workers=case when level%5=0 then 1 else 0 end;
-- Retroactive delivery adds only the new entitlement, never reissues gold/items.
update ludus_private.level_rewards r set rewards=r.rewards||jsonb_build_object('workers',c.workers)
from ludus_private.level_reward_catalog c where c.level=r.level and r.claimed_at is not null
and c.workers>0 and not r.rewards?'workers';

create table if not exists ludus_supply_private.resources(
 sku text primary key,name text not null,food boolean not null,sort_order integer not null unique
);
insert into ludus_supply_private.resources values
 ('iron','Demir',false,1),('copper','Bakır',false,2),('wood','Odun',false,3),
 ('leather','Deri',false,4),('linen','Keten',false,5),('grain','Tahıl',true,6),
 ('apple','Elma',true,7),('meat','Et',true,8),('fish','Balık',true,9),
 ('egg','Yumurta',true,10),('beer','Şarap',true,11),('olive_oil','Zeytinyağı',true,12)
on conflict(sku)do update set name=excluded.name,food=excluded.food,sort_order=excluded.sort_order;
create table if not exists ludus_supply_private.destinations(
 id text primary key,name text not null,description text not null,
 seconds integer not null check(seconds>=60),yields jsonb not null,
 x integer not null check(x between 0 and 100),y integer not null check(y between 0 and 100),sort_order integer not null
);
insert into ludus_supply_private.destinations values
 ('iron','Demir madeni','Kuzey yamaçlarında demir toplama.',3600,'{"iron":12}',23,17,1),
 ('copper','Bakır madeni','Doğu tepelerindeki bakır damarları.',3600,'{"copper":12}',73,17,2),
 ('wood','Orman','Kereste için odun toplama.',3600,'{"wood":20}',13,39,3),
 ('hunt','Av sahası','Aynı seferde et ve deri elde edilir.',3600,'{"meat":8,"leather":6}',37,34,4),
 ('linen','Keten tarlası','Dokuma ve sargılar için keten.',3600,'{"linen":20}',69,40,5),
 ('grain','Tahıl tarlası','Yemekhane için temel besin.',3600,'{"grain":24}',87,58,6),
 ('apple','Elma bahçesi','Menüye meyve sağlayan bahçe.',3600,'{"apple":20}',52,61,7),
 ('fish','Nehir kıyısı','Nehirde balık tutma.',3600,'{"fish":12}',13,72,8),
 ('egg','Çiftlik','Çiftlikten yumurta toplama.',3600,'{"egg":16}',76,80,9),
 ('wine','Bağ evi','Bağ evinden şarap tedariki.',3600,'{"beer":8}',36,85,10),
 ('olive_oil','Zeytinlik','Zeytinlikteki sıkım evinden yağ tedariki.',3600,'{"olive_oil":6}',89,34,11)
on conflict(id)do update set name=excluded.name,description=excluded.description,seconds=excluded.seconds,yields=excluded.yields,x=excluded.x,y=excluded.y,sort_order=excluded.sort_order;
create table if not exists ludus_supply_private.stock(
 owner_id uuid not null references public.ludus_accounts(user_id),sku text not null references ludus_supply_private.resources(sku),
 quantity integer not null default 0 check(quantity between 0 and 50000),primary key(owner_id,sku)
);
create index if not exists supply_stock_sku on ludus_supply_private.stock(sku);
create table if not exists ludus_supply_private.jobs(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.ludus_accounts(user_id),
 destination text not null references ludus_supply_private.destinations(id),workers integer not null check(workers between 1 and 10),
 started_at timestamptz not null,ends_at timestamptz not null,claimed_at timestamptz,
 cargo jsonb not null,check(ends_at>started_at)
);
create index if not exists supply_jobs_owner_open on ludus_supply_private.jobs(owner_id,ends_at)where claimed_at is null;
create index if not exists supply_jobs_destination on ludus_supply_private.jobs(destination);
create index if not exists supply_jobs_owner on ludus_supply_private.jobs(owner_id);
create table if not exists ludus_supply_private.receipts(
 owner_id uuid not null references public.ludus_accounts(user_id),request_id uuid not null,
 payload jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(owner_id,request_id)
);
create table if not exists ludus_supply_private.recipes(
 sku text primary key references public.ludus_shop_catalog(sku),ingredients jsonb not null
);
insert into ludus_supply_private.recipes values
 ('gladius','{"iron":6,"wood":2,"leather":2}'),('sica','{"iron":6,"wood":2,"leather":2}'),
 ('scissor','{"iron":8,"leather":3,"linen":2}'),('spear','{"iron":4,"wood":6}'),
 ('trident','{"iron":7,"wood":5}'),('mace','{"iron":6,"wood":4,"leather":2}'),
 ('whip','{"leather":8,"wood":2}'),('net','{"linen":12}'),
 ('shield-medium','{"wood":8,"leather":3,"copper":2}'),('shield-large','{"wood":12,"leather":4,"copper":3}'),
 ('helmet-roman','{"iron":4,"copper":3,"linen":2}'),('helmet-gold','{"iron":4,"copper":4,"linen":2}'),
 ('helmet-silver','{"iron":6,"copper":2,"linen":2}'),('helmet-winged','{"iron":6,"copper":4,"linen":2}'),
 ('chest','{"iron":8,"copper":2,"leather":4,"linen":4}'),('chest-plate','{"iron":10,"copper":2,"leather":4,"linen":4}'),
 ('gloves','{"leather":5,"linen":4,"copper":2}'),('shoulder-armor','{"iron":4,"leather":4,"linen":3,"copper":2}'),
 ('legs','{"iron":5,"copper":2,"leather":3,"linen":3}')
on conflict(sku)do update set ingredients=excluded.ingredients;

create or replace function ludus_supply_private.worker_count(p_owner uuid)
returns integer language sql stable set search_path='' as $$
 select least(10,coalesce(sum(c.workers),0))::integer from ludus_private.level_rewards r
 join ludus_private.level_reward_catalog c using(level)
 join public.ludus_progression p on p.owner_id=r.owner_id
 where r.owner_id=p_owner and r.claimed_at is not null and r.level<=ludus_private.level_from_exp(p.experience)
$$;

create or replace function ludus_supply_private.api(p_action text,p_key text,p_workers integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();food jsonb;answer jsonb;payload jsonb;
 receipt ludus_supply_private.receipts;dest ludus_supply_private.destinations;job ludus_supply_private.jobs;
 recipe ludus_supply_private.recipes;product public.ludus_shop_catalog;entry record;iid uuid;lv integer;
 total integer;occupied integer;qty integer;held integer;cargo jsonb;items jsonb;routes jsonb;open_jobs jsonb;crafts jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','send','claim','craft')then raise exception 'Geçersiz işlem.';end if;
 -- One account lock orders progression, food, inventory and worker mutations.
 perform ludus_private.level_ensure(u);
 food:=ludus_food_private.api_v55('state',null,null,null);
 insert into ludus_supply_private.stock(owner_id,sku)select u,r.sku from ludus_supply_private.resources r where not r.food on conflict do nothing;
 lv:=ludus_private.level_from_exp((select experience from public.ludus_progression where owner_id=u));
 total:=ludus_supply_private.worker_count(u);
 select coalesce(sum(workers),0)::integer into occupied from ludus_supply_private.jobs where owner_id=u and claimed_at is null;
 if p_action<>'state'then
  if p_request is null or p_key is null then raise exception 'İşlem kimliği ve hedef gerekiyor.';end if;
  payload:=jsonb_build_object('action',p_action,'key',p_key,'workers',p_workers);
  select * into receipt from ludus_supply_private.receipts where owner_id=u and request_id=p_request;
  if found then
   if receipt.payload<>payload then raise exception 'İşlem kimliği başka bir işlemde kullanılmış.';end if;
   answer:=receipt.result||'{"replayed":true}'::jsonb;
  else
   if p_action='send'then
    if p_workers is null or p_workers<1 or p_workers>total-occupied then raise exception 'Yeterli boş işçi yok. İlk işçi 5. seviye ödülündedir.';end if;
    select * into dest from ludus_supply_private.destinations where id=p_key;
    if not found then raise exception 'Bölge bulunamadı.';end if;
    select jsonb_object_agg(key,value::integer*p_workers)into cargo from jsonb_each_text(dest.yields);
    insert into ludus_supply_private.jobs(owner_id,destination,workers,started_at,ends_at,cargo)
    values(u,dest.id,p_workers,ts,ts+make_interval(secs=>dest.seconds),cargo)returning * into job;
    answer:=jsonb_build_object('message','İşçiler yola çıktı.','job_id',job.id);
   elsif p_action='claim'then
    select * into job from ludus_supply_private.jobs where owner_id=u and id::text=p_key for update;
    if not found then raise exception 'Sefer bulunamadı.';end if;
    if job.ends_at>ts then raise exception 'İşçiler henüz dönmedi.';end if;
    if job.claimed_at is null then
     -- Food was settled above; a newly delivered load cannot retroactively feed past days.
     for entry in select j.key,j.value::integer amount,r.food from jsonb_each_text(job.cargo)j join ludus_supply_private.resources r on r.sku=j.key loop
      if entry.food then
       select quantity into held from public.ludus_food_stock where owner_id=u and sku=entry.key;
       if held+entry.amount>50000 then raise exception 'Erzak deposu dolu; seferdeki yük korunuyor.';end if;
       update public.ludus_food_stock set quantity=quantity+entry.amount where owner_id=u and sku=entry.key;
      else
       select quantity into held from ludus_supply_private.stock where owner_id=u and sku=entry.key;
       if held+entry.amount>50000 then raise exception 'Malzeme deposu dolu; seferdeki yük korunuyor.';end if;
       update ludus_supply_private.stock set quantity=quantity+entry.amount where owner_id=u and sku=entry.key;
      end if;
     end loop;
     update ludus_supply_private.jobs set claimed_at=ts where id=job.id;
    end if;
    answer:=jsonb_build_object('message','Sefer yükü depoya teslim edildi.','cargo',job.cargo);
   else
    select * into recipe from ludus_supply_private.recipes where sku=p_key;
    if not found then raise exception 'Üretim tarifi bulunamadı.';end if;
    for entry in select key,value::integer amount from jsonb_each_text(recipe.ingredients)loop
     select quantity into held from ludus_supply_private.stock where owner_id=u and sku=entry.key;
     if coalesce(held,0)<entry.amount then raise exception 'Üretim için malzemelerin eksik.';end if;
     update ludus_supply_private.stock set quantity=quantity-entry.amount where owner_id=u and sku=entry.key;
    end loop;
    select * into product from public.ludus_shop_catalog where sku=p_key;
    insert into public.ludus_items(owner_id,kind,model)values(u,product.kind,product.model)returning id into iid;
    answer:=jsonb_build_object('message','Basic +0 ekipman envanterine eklendi.','item_id',iid);
   end if;
   insert into ludus_supply_private.receipts(owner_id,request_id,payload,result)values(u,p_request,payload,answer);
  end if;
 end if;
 select jsonb_agg(to_jsonb(r)||jsonb_build_object('quantity',case when r.food then coalesce(f.quantity,0)else coalesce(s.quantity,0)end)order by r.sort_order)
 into items from ludus_supply_private.resources r left join ludus_supply_private.stock s on s.sku=r.sku and s.owner_id=u
 left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u;
 select jsonb_agg(to_jsonb(d)order by d.sort_order)into routes from ludus_supply_private.destinations d;
 select coalesce(jsonb_agg(to_jsonb(j)||jsonb_build_object('ready',j.ends_at<=ts)order by j.ends_at),'[]')into open_jobs
 from ludus_supply_private.jobs j where j.owner_id=u and j.claimed_at is null;
 select coalesce(sum(workers),0)::integer into occupied from ludus_supply_private.jobs where owner_id=u and claimed_at is null;
 select jsonb_agg(jsonb_build_object('sku',r.sku,'ingredients',r.ingredients,'name',c.name,'kind',c.kind,'model',c.model)order by c.kind,r.sku)
 into crafts from ludus_supply_private.recipes r join public.ludus_shop_catalog c using(sku);
 return jsonb_build_object('user_id',u,'server_now',ts,'level',lv,'workers',total,'busy_workers',occupied,'free_workers',total-occupied,
 'next_worker_level',case when lv<50 then (lv/5+1)*5 end,'unclaimed_workers',lv/5-total,
 'resources',items,'destinations',routes,'jobs',open_jobs,'recipes',crafts,'result',answer,'gold',food->'gold');
end;$$;
create or replace function public.ludus_supply(p_action text default 'state',p_key text default null,p_workers integer default 1,p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.api(p_action,p_key,p_workers,p_request)$$;

alter table ludus_supply_private.resources enable row level security;
alter table ludus_supply_private.destinations enable row level security;
alter table ludus_supply_private.stock enable row level security;
alter table ludus_supply_private.jobs enable row level security;
alter table ludus_supply_private.receipts enable row level security;
alter table ludus_supply_private.recipes enable row level security;
revoke all on all tables in schema ludus_supply_private from public,anon,authenticated;
revoke all on all functions in schema ludus_supply_private from public,anon,authenticated;
grant execute on function ludus_supply_private.api(text,text,integer,uuid)to authenticated;
revoke all on function public.ludus_supply(text,text,integer,uuid)from public,anon;
grant execute on function public.ludus_supply(text,text,integer,uuid)to authenticated;

-- Keep reward issuance and the existing reward ledger atomic.
create or replace function ludus_private.level_claim(u uuid,lv integer)returns void language plpgsql set search_path='' as $$
declare r ludus_private.level_rewards;c ludus_private.level_reward_catalog;it public.ludus_items;pick public.ludus_shop_catalog;outcome jsonb;g jsonb;stones jsonb:='[]';items jsonb:='[]';f text;quantity integer;sid integer;j integer;
begin
 select * into r from ludus_private.level_rewards where owner_id=u and level=lv for update;
 if not found then raise exception 'Bu seviye henüz açılmadı.';end if;
 select * into c from ludus_private.level_reward_catalog where level=lv;
 if r.claimed_at is null then
  update public.ludus_accounts set gold=gold+c.denarius,diamonds=diamonds+c.diamonds,stones_version=stones_version+1 where user_id=u;
  foreach f in array array['sapphire','emerald','ruby']loop
   quantity:=case f when 'sapphire'then c.sapphire when 'emerald'then c.emerald else c.ruby end;
   for j in 1..quantity loop
    select stone_id into sid from public.ludus_stone_catalog where family=f order by random()limit 1;
    if sid is null then raise exception 'Taş kataloğu bulunamadı.';end if;
    insert into public.ludus_stones(owner_id,family,stone_id,quantity)values(u,f,sid,1)on conflict(owner_id,family,stone_id)do update set quantity=public.ludus_stones.quantity+1;
    stones:=stones||jsonb_build_array(jsonb_build_object('family',f,'id',sid,'quantity',1));
   end loop;
  end loop;
  for j in 1..c.items loop
   select * into pick from public.ludus_shop_catalog where kind in('weapon','shield','helmet','chest','gloves','legs')order by random()limit 1;
   if not found then raise exception 'Eşya kataloğu bulunamadı.';end if;
   insert into public.ludus_items(owner_id,kind,model)values(u,pick.kind,pick.model)returning * into it;
   items:=items||jsonb_build_array(to_jsonb(it));
  end loop;
  if c.gladiators>0 then g:=ludus_private.level_deliver_gladiator(u,lv);end if;
  outcome:=jsonb_build_object('gold',c.denarius,'diamonds',c.diamonds,'stones',stones,'items',items,'gladiator',g,'workers',c.workers);
  update ludus_private.level_rewards set claimed_at=clock_timestamp(),rewards=outcome,gladiator_pending=c.gladiators>0 and g is null where owner_id=u and level=lv;
 elsif r.gladiator_pending then
  g:=ludus_private.level_deliver_gladiator(u,lv);
  if g is not null then update ludus_private.level_rewards set rewards=rewards||jsonb_build_object('gladiator',g),gladiator_pending=false where owner_id=u and level=lv;end if;
 end if;
end $$;
create or replace function ludus_private.level_state(u uuid)returns jsonb language plpgsql set search_path='' as $$
declare p public.ludus_progression;lv integer;lower_exp bigint;cost bigint;owned integer;eligible boolean;rows jsonb;d date:=(clock_timestamp()at time zone'Europe/Istanbul')::date;
begin
 select * into p from public.ludus_progression where owner_id=u;lv:=ludus_private.level_from_exp(p.experience);
 lower_exp:=ludus_private.level_threshold(lv);cost:=case when lv<50 then ludus_private.level_exp_cost(lv)else 0 end;
 select count(*)::integer into owned from public.ludus_gladiators where owner_id=u;
 eligible:=owned<greatest(p.legacy_slots,ludus_private.level_granted_gladiators(lv))and exists(
  select 1 from unnest(array['murmillo','thraex','hoplomachus','secutor','retiarius','provocator','scissor'])c where not exists(select 1 from public.ludus_gladiators where owner_id=u and class=c));
 select jsonb_agg(to_jsonb(c)||jsonb_build_object('unlocked',c.level<=lv,'claimed',r.claimed_at is not null,'gladiator_pending',coalesce(r.gladiator_pending,false),'claimable',c.level<=lv and(r.claimed_at is null or(r.gladiator_pending and eligible)),'result',coalesce(r.rewards,'{}'))order by c.level)into rows
 from ludus_private.level_reward_catalog c left join ludus_private.level_rewards r on r.owner_id=u and r.level=c.level;
 return jsonb_build_object('server_now',clock_timestamp(),'level',lv,'experience',p.experience,'current_exp',case when lv<50 then p.experience-lower_exp else 0 end,'next_exp',cost,'starting_gladiators',2,'granted_gladiators',ludus_private.level_granted_gladiators(lv),'owned_gladiators',owned,'gladiator_slots',greatest(p.legacy_slots,ludus_private.level_granted_gladiators(lv)),
  'battle_exp_today',case when p.battle_day=d then p.battle_exp else 0 end,'battle_wins_today',case when p.battle_day=d then p.battle_wins else 0 end,'battle_exp_limit',2500,'rewards',rows,
  'claimable_count',(select count(*)from jsonb_array_elements(rows)q where(q->>'claimable')::boolean),'pending_gladiator_count',(select count(*)from ludus_private.level_rewards where owner_id=u and gladiator_pending),
  'workers',ludus_supply_private.worker_count(u),'next_worker_level',case when lv<50 then (lv/5+1)*5 end,'wallet',(select jsonb_build_object('gold',gold,'diamonds',diamonds,'ludus_name',ludus_name)from public.ludus_accounts where user_id=u),
  'last_exp',(select jsonb_build_object('source',source,'key',source_key,'experience',experience)from ludus_private.level_exp_events where owner_id=u order by occurred_at desc limit 1));
end $$;

-- Settle completed days with the previous menu once, before adding the oil rule.
create table if not exists ludus_food_private.policy_v85(id boolean primary key default true check(id),starts_at timestamptz not null default clock_timestamp());
alter table ludus_food_private.policy_v85 enable row level security;
revoke all on ludus_food_private.policy_v85 from public,anon,authenticated;
do $$declare u uuid;begin
 if not exists(select 1 from ludus_food_private.policy_v85 where id)then
  for u in select owner_id from public.ludus_food_house order by owner_id loop
   perform ludus_food_private.settle_v55(u,(transaction_timestamp()at time zone'Europe/Istanbul')::date);
  end loop;
  insert into ludus_food_private.policy_v85(id)values(true);
 end if;
end;$$;
alter table public.ludus_food_catalog add column if not exists retired boolean not null default false;
update public.ludus_food_catalog set retired=true where sku in('bread','meal');
insert into public.ludus_food_catalog(sku,name,price,edible,sort_order,nutrition)
values('olive_oil','Zeytinyağı',12,false,9,0)on conflict(sku)do update set name=excluded.name,price=excluded.price,edible=false,nutrition=0;
insert into public.ludus_food_stock(owner_id,sku)select owner_id,'olive_oil'from public.ludus_food_house on conflict do nothing;
create or replace function ludus_food_private.menu_base_v85(p_crew integer,p_items jsonb)
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
create or replace function ludus_food_private.menu_v55(p_crew integer,p_items jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare menu jsonb;oil integer;used integer:=0;top_menu boolean;
begin
 menu:=ludus_food_private.menu_base_v85(p_crew,p_items);
 select coalesce(sum((value->>'quantity')::integer),0)::integer into oil from jsonb_array_elements(p_items)where value->>'sku'='olive_oil';
 top_menu:=p_crew>0 and (menu->>'coverage')::numeric=100 and (menu->>'quality')::numeric>=100;
 if top_menu and oil>=p_crew then
  used:=p_crew;
 elsif top_menu then
  -- Existing full nutrition remains; only the highest-quality bonus requires oil.
  menu:=menu||jsonb_build_object('quality',75,'stamina_bonus_percent',8,'menu_tier','supported');
 end if;
 menu:=jsonb_set(menu,'{served}',coalesce((select jsonb_agg(value)from jsonb_array_elements(menu->'served')where value->>'sku'<>'olive_oil'),'[]')||jsonb_build_array(jsonb_build_object('sku','olive_oil','quantity',used)));
 return menu||jsonb_build_object('olive_oil_used',used,'olive_oil_needed',case when top_menu then p_crew else 0 end,'balanced_without_oil',top_menu);
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
   if exists(select 1 from public.ludus_food_catalog where sku=p_sku and retired)then raise exception 'Bu hazır gıdanın satışı kaldırıldı. Mevcut stok korunuyor.';end if;
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
 select jsonb_agg(jsonb_build_object('sku',c.sku,'name',c.name,'price',c.price,'nutrition',c.nutrition,'retired',c.retired,'edible',c.edible,'quantity',s.quantity,'daily',coalesce((select (e.value->>'quantity')::integer from jsonb_array_elements(forecast->'served')e(value)where e.value->>'sku'=c.sku),0),'days',case when crew>0 then s.quantity/crew end)order by c.sort_order),
 jsonb_agg(jsonb_build_object('sku',c.sku,'quantity',s.quantity)order by c.sort_order)
 into items,served from public.ludus_food_catalog c join public.ludus_food_stock s using(sku)where s.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(h)order by h.to_day desc),'[]')into history from
 (select from_day,to_day,crew_count,menu from public.ludus_food_history where owner_id=u order by to_day desc limit 12)h;
 return jsonb_build_object('user_id',u,'today',today,'server_now',transaction_timestamp(),'reset_at',(today+1)::timestamp at time zone'Europe/Istanbul',
 'gold',coins,'crew_count',crew,'settled_day',house.settled_day,'last_menu',house.last_menu,'menu',forecast,'recovery',jsonb_build_object('active_bonus',0,'forecast_bonus',0,'base_rate',10),'combat',jsonb_build_object('active_bonus',ludus_food_private.combat_bonus_v60(u),'forecast_bonus',forecast->'stamina_bonus_percent','active_until',(today+1)::timestamp at time zone'Europe/Istanbul','base_multiplier',.65),'items',items,'history',history,'purchase',purchase);
end;$$;
revoke all on function ludus_food_private.menu_base_v85(integer,jsonb),ludus_food_private.menu_v55(integer,jsonb)from public,anon,authenticated;
revoke all on function ludus_private.level_claim(uuid,integer),ludus_private.level_state(uuid)from public,anon,authenticated;
notify pgrst,'reload schema';
