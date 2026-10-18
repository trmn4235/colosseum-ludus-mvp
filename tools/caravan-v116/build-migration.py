"""Compose V116 from the previous authoritative RPCs, keeping old receipt replay."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[2]
def migration(suffix): return next((root/'supabase/migrations').glob('*_'+suffix+'.sql')).read_text()
def fn(text,name):
 return re.search(r'create or replace function '+re.escape(name)+r'\([^;]+?\$\$[\s\S]+?\$\$;',text,re.I)[0]
v85=migration('gathering_v85');v87=migration('supply_auto_delivery_v87')
out=['''-- V116: the driver and caravan are one entitlement; no worker hiring or claims.
alter table ludus_private.level_reward_catalog add column if not exists caravans integer not null default 0 check(caravans between 0 and 1);
update ludus_private.level_reward_catalog set workers=0,caravans=case when level%10=0 then 1 else 0 end;
create or replace function ludus_supply_private.worker_count(p_owner uuid)
returns integer language sql stable set search_path='' as $$
 select 1+least(50,ludus_private.level_from_exp(coalesce((select experience from public.ludus_progression where owner_id=p_owner),0)))/10
$$;
revoke all on function ludus_supply_private.worker_count(uuid) from public,anon,authenticated;
-- Existing jobs and cargo remain intact, even if they use more than the new limit.
-- Food routes no longer return manufacturing inputs; one caravan carries 15 portions.
update ludus_supply_private.destinations set yields=jsonb_build_object(case id when 'hunt' then 'meat' when 'wine' then 'beer' else id end,15)
 where id in('grain','apple','hunt','fish','egg','wine','olive_oil');
create table if not exists ludus_supply_private.cities_v116(
 id integer primary key check(id between 1 and 60),name text not null,region text not null,
 longitude numeric not null,latitude numeric not null,x numeric not null,y numeric not null
);
create table if not exists ludus_supply_private.market_goods_v116(
 sku text primary key references ludus_supply_private.resources(sku),base_price numeric not null check(base_price>0),slot integer unique not null
);
insert into ludus_supply_private.market_goods_v116 values
 ('iron',1.5,0),('copper',1.2,1),('wood',.6,2),('leather',2.5,3),('linen',1,4) on conflict(sku)do nothing;
create table if not exists ludus_supply_private.market_sales_v116(
 epoch bigint not null,city integer not null references ludus_supply_private.cities_v116(id),
 sku text not null references ludus_supply_private.market_goods_v116(sku),quantity integer not null check(quantity>=0),primary key(epoch,city,sku)
);
alter table ludus_supply_private.jobs add column if not exists purchase jsonb;
''']
cities=json.loads((root/'assets/caravan-v116/cities.json').read_text())
for c in cities:
 q=lambda s:"'"+s.replace("'","''")+"'"
 out.append(f"insert into ludus_supply_private.cities_v116 values({c['id']},{q(c['name'])},{q(c['region'])},{c['lon']},{c['lat']},{c['x']},{c['y']})on conflict(id)do update set name=excluded.name,region=excluded.region;\n")
out.append('''insert into ludus_supply_private.destinations(id,name,description,seconds,yields,x,y,sort_order)
 select 'city-'||id,name,'Şehirden malzeme alımı',3600,'{}'::jsonb,x,y,100+id from ludus_supply_private.cities_v116 on conflict(id)do nothing;
create or replace function ludus_supply_private.offer_v116(p_city integer,p_sku text,p_epoch bigint)
returns jsonb language plpgsql stable set search_path='' as $$
declare g ludus_supply_private.market_goods_v116;rank integer;bar integer;coefficient numeric;capacity integer;sold integer;
begin
 select * into g from ludus_supply_private.market_goods_v116 where sku=p_sku;
 if not found or not exists(select 1 from ludus_supply_private.cities_v116 where id=p_city)then raise exception 'Şehir veya malzeme bulunamadı.';end if;
 rank:=mod(p_city-1+mod(p_epoch,60)::integer*17+g.slot*11,60);
 bar:=case when rank<15 then 10 when rank<20 then 9 when rank<30 then 8 else 1+mod(rank-30,7)end;
 coefficient:=(array[15.8,12,9,6.5,4.7,3.4,2.5,1.8,1.35,1]::numeric[])[bar];
 capacity:=bar*30;
 select quantity into sold from ludus_supply_private.market_sales_v116 where epoch=p_epoch and city=p_city and sku=p_sku;
 return jsonb_build_object('sku',p_sku,'bar',bar,'unit_price',round(g.base_price*coefficient,2),'stock',greatest(0,capacity-coalesce(sold,0)),'capacity',capacity);
end;$$;
create or replace function ludus_supply_private.city_v116(p_city integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();ts timestamptz:=clock_timestamp();epoch bigint;city ludus_supply_private.cities_v116;goods jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 select * into city from ludus_supply_private.cities_v116 where id=p_city;
 if not found then raise exception 'Şehir bulunamadı.';end if;
 epoch:=floor(extract(epoch from ts)/60)::bigint;
 select jsonb_agg(ludus_supply_private.offer_v116(p_city,g.sku,epoch)||jsonb_build_object('name',r.name)order by g.slot)
 into goods from ludus_supply_private.market_goods_v116 g join ludus_supply_private.resources r using(sku);
 return jsonb_build_object('city',to_jsonb(city),'epoch',epoch,'expires_at',to_timestamp((epoch+1)*60),'server_now',ts,'goods',goods);
end;$$;
create or replace function public.ludus_caravan_city(p_city integer)
returns jsonb language sql security invoker set search_path='' as $$select ludus_supply_private.city_v116(p_city)$$;
''')
api=fn(v87,'ludus_supply_private.api')
api=api.replace('delivered jsonb;','delivered jsonb;parts text[];city_id integer;market_epoch bigint;offer jsonb;cost bigint;balance bigint;goods_sku text;')
api=api.replace("('state','send','claim','craft')","('state','send','claim','craft','buy')")
api=api.replace('Yeterli boş işçi yok. İlk işçi 5. seviye ödülündedir.','Yeterli boş kervan yok. Yeni kervan her 10 seviyede otomatik açılır.').replace('İşçiler yola çıktı.','Kervan yola çıktı.').replace('İşçiler henüz dönmedi.','Kervan henüz dönmedi.')
api=api.replace("if not found then raise exception 'Bölge bulunamadı.';end if;", "if not found or dest.id not in('grain','apple','hunt','fish','egg','wine','olive_oil')then raise exception 'Bu malzeme sağ duvardaki şehir haritasından alınır.';end if;")
needle="   else\n    select * into recipe"
replacement='''   elsif p_action='buy'then
    if p_workers is null or p_workers<1 or p_workers>greatest(0,total-occupied)then raise exception 'Yeterli boş kervan yok.';end if;
    parts:=string_to_array(p_key,':');
    if array_length(parts,1)<>4 then raise exception 'Alım bilgisi geçersiz.';end if;
    city_id:=parts[1]::integer;goods_sku:=parts[2];market_epoch:=parts[3]::bigint;qty:=parts[4]::integer;
    if market_epoch<>floor(extract(epoch from ts)/60)::bigint then raise exception 'Fiyatın süresi doldu. Şehirleri yeniden incele.';end if;
    if qty is null or qty<1 or qty>p_workers*15 then raise exception 'Her kervan en fazla 15 birim taşır.';end if;
    offer:=ludus_supply_private.offer_v116(city_id,goods_sku,market_epoch);
    cost:=ceil((offer->>'unit_price')::numeric*qty);
    select gold into balance from public.ludus_accounts where user_id=u;
    if balance<cost then raise exception 'Denarius yetersiz.';end if;
    -- Atomic global stock reservation; concurrent buyers cannot oversell a quote.
    insert into ludus_supply_private.market_sales_v116(epoch,city,sku,quantity)values(market_epoch,city_id,goods_sku,qty)
    on conflict(epoch,city,sku)do update set quantity=ludus_supply_private.market_sales_v116.quantity+excluded.quantity
    where ludus_supply_private.market_sales_v116.quantity+excluded.quantity<=(offer->>'capacity')::integer;
    if not found then raise exception 'Şehirde bu kadar stok kalmadı. Şehri yeniden incele.';end if;
    if qty>(offer->>'capacity')::integer then raise exception 'Şehirde bu kadar stok yok.';end if;
    update public.ludus_accounts set gold=gold-cost where user_id=u;
    insert into ludus_supply_private.jobs(owner_id,destination,workers,started_at,ends_at,cargo,purchase)
    values(u,'city-'||city_id,p_workers,ts,ts+interval'1 hour',jsonb_build_object(goods_sku,qty),
     jsonb_build_object('city',city_id,'epoch',market_epoch,'unit_price',offer->'unit_price','cost',cost))returning * into job;
    answer:=jsonb_build_object('message','Malzeme alındı. Kervan yükü kasaya getirecek.','job_id',job.id,'cost',cost);
   else
    select * into recipe'''
assert needle in api;api=api.replace(needle,replacement)
api=api.replace("'free_workers',total-occupied", "'free_workers',greatest(0,total-occupied),'caravans',total,'busy_caravans',occupied,'free_caravans',greatest(0,total-occupied),'caravan_capacity',15")
api=api.replace("'next_worker_level',case when lv<50 then (lv/5+1)*5 end,'unclaimed_workers',lv/5-total", "'next_worker_level',case when lv<50 then (lv/10+1)*10 end,'next_caravan_level',case when lv<50 then (lv/10+1)*10 end,'unclaimed_workers',0")
api=api.replace("'gold',food->'gold'", "'gold',(select gold from public.ludus_accounts where user_id=u),'cities',(select jsonb_agg(to_jsonb(c)order by id)from ludus_supply_private.cities_v116 c)")
out.append(api)
claim=fn(v85,'ludus_private.level_claim').replace("'workers',c.workers","'workers',0,'caravans',c.caravans,'caravans_automatic',true");out.append(claim)
state=fn(v85,'ludus_private.level_state').replace("'workers',ludus_supply_private.worker_count(u)","'workers',ludus_supply_private.worker_count(u),'caravans',ludus_supply_private.worker_count(u),'caravan_limit',6,'starting_caravans',1")
state=state.replace("'next_worker_level',case when lv<50 then (lv/5+1)*5 end", "'next_worker_level',case when lv<50 then (lv/10+1)*10 end,'next_caravan_level',case when lv<50 then (lv/10+1)*10 end")
out.append(state)
out.append('''alter table ludus_supply_private.cities_v116 enable row level security;
alter table ludus_supply_private.market_goods_v116 enable row level security;
alter table ludus_supply_private.market_sales_v116 enable row level security;
revoke all on ludus_supply_private.cities_v116,ludus_supply_private.market_goods_v116,ludus_supply_private.market_sales_v116 from public,anon,authenticated;
revoke all on function ludus_supply_private.offer_v116(integer,text,bigint),ludus_supply_private.city_v116(integer)from public,anon,authenticated;
grant execute on function ludus_supply_private.city_v116(integer)to authenticated;
revoke all on function public.ludus_caravan_city(integer)from public,anon;
grant execute on function public.ludus_caravan_city(integer)to authenticated;
notify pgrst,'reload schema';
''')
out.append('''-- The optional introduction guide follows the new level-one availability.
do $guide$ declare definition text;begin
 if to_regprocedure('ludus_private.first_quests_state_v111(text,text,text)')is not null then
  select pg_get_functiondef('ludus_private.first_quests_state_v111(text,text,text)'::regprocedure)into definition;
  if position('not advanced or lv>=5' in definition)>0 then
   execute replace(definition,'not advanced or lv>=5','true');
  end if;
 end if;
end;$guide$;
'''.replace('\n+','\n'))
dest=next((root/'supabase/migrations').glob('*_caravan_collection_v116.sql'))
dest.write_text('\n'.join(out));print(dest.name)
