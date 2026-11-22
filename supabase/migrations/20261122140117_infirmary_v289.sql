-- V289: server-owned infirmary and seven smith-made consumables in the same vault.
-- Numerical recipe quantities and 5-point syrup baselines are implementation
-- choices; approved papyrus fractions and 3/12/24-hour treatment times are fixed.
create schema ludus_infirmary_private;
revoke all on schema ludus_infirmary_private from public,anon,authenticated;
grant usage on schema ludus_infirmary_private to authenticated;

insert into ludus_supply_private.resources(sku,name,food,sort_order,stage,active)values
 ('beeswax_ointment','Balmumu Merhemi',false,221,'supply',true),
 ('laurel_ointment','Defne Merhemi',false,222,'supply',true),
 ('honey_vinegar_syrup','Ballı Sirke Şurubu',false,223,'supply',true),
 ('fig_syrup','İncir Şurubu',false,224,'supply',true),
 ('wood_splint','Tahta Atel',false,225,'supply',true),
 ('linen_bandage','Keten Sargı',false,226,'supply',true),
 ('vinegar_sponge','Sirkeli Sünger',false,227,'supply',true);

create table ludus_infirmary_private.recipes(
 sku text primary key references ludus_supply_private.resources(sku),name text not null,
 ingredients jsonb not null,output_quantity integer not null default 1 check(output_quantity=1),sort_order integer not null unique
);
insert into ludus_infirmary_private.recipes values
 ('beeswax_ointment','Balmumu Merhemi','[{"sku":"beeswax","quantity":1,"source":"resource"},{"sku":"olive_oil","quantity":1,"source":"food"}]',1,1),
 ('laurel_ointment','Defne Merhemi','[{"sku":"laurel","quantity":1,"source":"resource"},{"sku":"beeswax","quantity":1,"source":"resource"},{"sku":"olive_oil","quantity":1,"source":"food"}]',1,2),
 ('honey_vinegar_syrup','Ballı Sirke Şurubu','[{"sku":"honey","quantity":1,"source":"resource"},{"sku":"wine_vinegar","quantity":1,"source":"resource"}]',1,3),
 ('fig_syrup','İncir Şurubu','[{"sku":"fig","quantity":1,"source":"resource"},{"sku":"honey","quantity":1,"source":"resource"}]',1,4),
 ('wood_splint','Tahta Atel','[{"sku":"wood","quantity":1,"source":"resource"},{"sku":"wool","quantity":1,"source":"resource"},{"sku":"rope","quantity":1,"source":"resource"}]',1,5),
 ('linen_bandage','Keten Sargı','[{"sku":"linen","quantity":1,"source":"resource"},{"sku":"rope","quantity":1,"source":"resource"}]',1,6),
 ('vinegar_sponge','Sirkeli Sünger','[{"sku":"sponge","quantity":1,"source":"resource"},{"sku":"wine_vinegar","quantity":1,"source":"resource"}]',1,7);

create table ludus_infirmary_private.injury_catalog(
 key text primary key,name text not null,severity text not null check(severity in('light','medium','heavy')),
 body_part text not null,bone text,duration_seconds integer not null,required jsonb not null,
 check(duration_seconds=case severity when 'light' then 10800 when 'medium' then 43200 else 86400 end)
);
insert into ludus_infirmary_private.injury_catalog values
 ('knee_abrasion','Diz sıyrığı','light','knee',null,10800,'{"linen_bandage":1,"vinegar_sponge":1,"beeswax_ointment":1}'),
 ('shoulder_chafing','Omuzda zırh vurması','light','shoulder',null,10800,'{"beeswax_ointment":1}'),
 ('eyebrow_laceration','Yüzeysel kaş yarılması','light','head',null,10800,'{"linen_bandage":1,"vinegar_sponge":1}'),
 ('shoulder_contusion','Hafif omuz ezilmesi','light','shoulder',null,10800,'{"laurel_ointment":1}'),
 ('mild_calf_strain','Hafif baldır zorlanması','light','calf',null,10800,'{"laurel_ointment":1,"fig_syrup":1}'),
 ('deep_forearm_laceration','Derin ön kol kesiği','medium','forearm',null,43200,'{"linen_bandage":2,"vinegar_sponge":1,"beeswax_ointment":1}'),
 ('ankle_sprain','Ayak bileği burkulması','medium','ankle',null,43200,'{"linen_bandage":2,"laurel_ointment":1,"fig_syrup":1}'),
 ('rib_contusion','Kaburga ezilmesi','medium','ribs',null,43200,'{"linen_bandage":2,"laurel_ointment":1,"honey_vinegar_syrup":1}'),
 ('closed_forearm_fracture','Kapalı ön kol kırığı','medium','forearm','forearm',43200,'{"wood_splint":1,"linen_bandage":2,"fig_syrup":1}'),
 ('closed_tibia_fracture','Kapalı, parçalı olmayan kaval kemiği kırığı','medium','tibia','tibia',43200,'{"wood_splint":1,"linen_bandage":2,"fig_syrup":1}'),
 ('open_tibia_fracture','Açık kaval kemiği kırığı','heavy','tibia','tibia',86400,'{"wood_splint":1,"linen_bandage":3,"vinegar_sponge":2,"beeswax_ointment":1,"honey_vinegar_syrup":1,"fig_syrup":1}'),
 ('comminuted_femur_fracture','Parçalı uyluk kemiği kırığı','heavy','femur','femur',86400,'{"wood_splint":2,"linen_bandage":3,"honey_vinegar_syrup":1,"fig_syrup":1}'),
 ('pelvic_fracture','Leğen kemiği kırığı','heavy','pelvis','pelvis',86400,'{"wood_splint":2,"linen_bandage":3,"honey_vinegar_syrup":1,"fig_syrup":1}'),
 ('severe_head_trauma','Ağır kafa travması','heavy','head',null,86400,'{"linen_bandage":2,"vinegar_sponge":1,"honey_vinegar_syrup":1,"fig_syrup":1}'),
 ('internal_abdominal_bleeding','İç kanamalı karın yaralanması','heavy','abdomen',null,86400,'{"linen_bandage":3,"honey_vinegar_syrup":1,"fig_syrup":1}');

create table ludus_infirmary_private.injuries(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.ludus_accounts(user_id)on delete cascade,
 gladiator_id uuid not null references public.ludus_gladiators(id)on delete cascade,injury_key text not null references ludus_infirmary_private.injury_catalog(key),
 severity text not null,body_part text not null,bone text,status text not null default 'untreated' check(status in('untreated','treating','healed')),
 occurred_at timestamptz not null default clock_timestamp(),healed_at timestamptz,source_type text not null,source_id uuid not null,
 context jsonb not null default '{}',treatment_id uuid,unique(source_type,source_id,gladiator_id)
);
create unique index infirmary_one_active_v289 on ludus_infirmary_private.injuries(gladiator_id)where status<>'healed';
create index infirmary_owner_v289 on ludus_infirmary_private.injuries(owner_id,status,occurred_at);
create table ludus_infirmary_private.treatments(
 id uuid primary key default gen_random_uuid(),injury_id uuid not null unique references ludus_infirmary_private.injuries(id)on delete cascade,
 owner_id uuid not null references public.ludus_accounts(user_id)on delete cascade,gladiator_id uuid not null references public.ludus_gladiators(id)on delete cascade,
 started_at timestamptz not null,ends_at timestamptz not null,status text not null default 'active' check(status in('active','finished')),
 finished_at timestamptz,credited_until timestamptz not null,required jsonb not null,consumed jsonb not null,saved jsonb not null,
 doctor_effects jsonb not null,bonuses jsonb not null,clan_treatment_ordinal integer,check(ends_at>started_at)
);
alter table ludus_infirmary_private.injuries add foreign key(treatment_id)references ludus_infirmary_private.treatments(id)on delete set null;
create table ludus_infirmary_private.receipts(
 owner_id uuid not null references public.ludus_accounts(user_id)on delete cascade,request_id uuid not null,payload jsonb not null,outcome jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(owner_id,request_id)
);

-- Private RNG is deliberately not configurable through an RPC/client payload.
create function ludus_infirmary_private.draw_v289()returns double precision language sql volatile set search_path='' as $$select random()$$;
create function ludus_infirmary_private.value_v289(p_owner uuid,p_number integer)
returns numeric language sql stable set search_path='' as $$
 select coalesce((select (effect->>'value')::numeric from ludus_staff_private.learned_papyrus_v288
 where owner_id=p_owner and content_id='doctor_'||lpad(p_number::text,3,'0') and effect->>'unit'='fraction'),0)
$$;
create function ludus_infirmary_private.stock_v289(p_owner uuid,p_sku text,p_source text default 'resource')
returns integer language sql stable set search_path='' as $$
 select case when p_source='food' then coalesce((select quantity from public.ludus_food_stock where owner_id=p_owner and sku=p_sku),0)
 else coalesce((select quantity from ludus_supply_private.stock where owner_id=p_owner and sku=p_sku),0)end
$$;
create function ludus_infirmary_private.busy_v289(p_gladiator uuid)
returns boolean language sql stable set search_path='' as $$
 select coalesce((select coalesce(g.training_ends_at>clock_timestamp(),false) or g.clan_roster_id is not null
  or coalesce(to_jsonb(g)->>'market_listing_id','')<>'' or g.status not in('available','injured','resting')
  or exists(select 1 from public.ludus_battles b where b.gladiator_id=g.id and b.finished_at is null)
  or exists(select 1 from public.ludus_matches m where m.status in('waiting','playing')and m.updated_at>clock_timestamp()-interval'30 seconds'and m.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
  or exists(select 1 from public.ludus_duels d where d.status in('waiting','playing')and d.updated_at>clock_timestamp()-interval'75 seconds'and g.id in(d.host_g,d.guest_g))
  or exists(select 1 from public.ludus_imperial_members m where m.gladiator_id=g.id and m.active)
 from public.ludus_gladiators g where g.id=p_gladiator),true)
$$;

create function ludus_infirmary_private.assign_injury_v289(p_owner uuid,p_gladiator uuid,p_key text,p_source_type text,p_source_id uuid,p_context jsonb default '{}')
returns uuid language plpgsql set search_path='' as $$
declare cat ludus_infirmary_private.injury_catalog;found_id uuid;g public.ludus_gladiators;
begin
 select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=p_owner for update;
 if not found then raise exception 'Gladyatör bu ludusa ait değil.';end if;
 select id into found_id from ludus_infirmary_private.injuries where source_type=p_source_type and source_id=p_source_id and gladiator_id=p_gladiator;
 if found_id is not null then return found_id;end if;
 select id into found_id from ludus_infirmary_private.injuries where gladiator_id=p_gladiator and status<>'healed';
 if found_id is not null then return found_id;end if;
 select * into cat from ludus_infirmary_private.injury_catalog where key=p_key;
 if not found or p_source_id is null or nullif(p_source_type,'')is null then raise exception 'Sakatlık kaydı geçersiz.';end if;
 insert into ludus_infirmary_private.injuries(owner_id,gladiator_id,injury_key,severity,body_part,bone,source_type,source_id,context)
 values(p_owner,p_gladiator,p_key,cat.severity,cat.body_part,cat.bone,p_source_type,p_source_id,coalesce(p_context,'{}'))returning id into found_id;
 update public.ludus_gladiators set status='injured',injury_level=case cat.severity when 'light' then 1 when 'medium' then 2 else 3 end,
 injured_until='9999-12-31T00:00:00Z'::timestamptz where id=p_gladiator;
 return found_id;
end $$;

-- All old injuries remain outside the typed tables and keep their old deadlines.
-- An active typed injury cannot be cleared by any legacy timer or status update.
create function ludus_infirmary_private.guard_gladiator_v289()returns trigger language plpgsql security definer set search_path='' as $$
declare i ludus_infirmary_private.injuries;until_at timestamptz;
begin
 select * into i from ludus_infirmary_private.injuries where gladiator_id=new.id and status<>'healed';
 if not found then return new;end if;
 if new.owner_id is distinct from old.owner_id or(new.clan_roster_id is distinct from old.clan_roster_id and new.clan_roster_id is not null)
 or(new.training_ends_at is distinct from old.training_ends_at and new.training_ends_at>clock_timestamp())
 or(to_jsonb(new)->>'market_listing_id' is distinct from to_jsonb(old)->>'market_listing_id' and to_jsonb(new)->>'market_listing_id' is not null)then
 raise exception 'Tedavi bekleyen gladyatör bu işleme katılamaz.';end if;
 select ends_at into until_at from ludus_infirmary_private.treatments where id=i.treatment_id and status='active';
 new.status:='injured';new.injured_until:=coalesce(until_at,'9999-12-31T00:00:00Z'::timestamptz);
 new.injury_level:=case i.severity when 'light' then 1 when 'medium' then 2 else 3 end;return new;
end $$;
create trigger infirmary_gladiator_guard_v289 before update on public.ludus_gladiators for each row execute function ludus_infirmary_private.guard_gladiator_v289();

alter function ludus_private.exercise_recover_v46(uuid)rename to exercise_recover_pre_v289;
create function ludus_infirmary_private.recover_v289(p_gladiator uuid)
returns void language plpgsql set search_path='' as $$
declare owner uuid;i ludus_infirmary_private.injuries;t ludus_infirmary_private.treatments;ts timestamptz:=clock_timestamp();span numeric;extra numeric;value numeric;
begin
 select owner_id into owner from public.ludus_gladiators where id=p_gladiator;if not found then return;end if;
 perform 1 from public.ludus_accounts where user_id=owner for update;
 perform 1 from public.ludus_gladiators where id=p_gladiator for update;
 select * into i from ludus_infirmary_private.injuries where gladiator_id=p_gladiator and status<>'healed' for update;
 perform ludus_private.exercise_recover_pre_v289(p_gladiator);
 if i.id is null or i.status<>'treating' then return;end if;
 select * into t from ludus_infirmary_private.treatments where id=i.treatment_id and status='active' for update;
 if not found then return;end if;
 span:=greatest(0,extract(epoch from least(ts,t.ends_at)-greatest(t.credited_until,t.started_at)));
 extra:=span/3600*10*coalesce((t.bonuses->>'recovery_rate')::numeric,0)
  +span/extract(epoch from(t.ends_at-t.started_at))*coalesce((t.bonuses->>'honey_extra')::numeric,0);
 if ts>=t.ends_at then extra:=extra+coalesce((t.bonuses->>'fig_discharge')::numeric,0);end if;
 select greatest(0,fatigue_value-extra)into value from public.ludus_gladiators where id=p_gladiator;
 if ts>=t.ends_at then
  update ludus_infirmary_private.treatments set status='finished',finished_at=t.ends_at,credited_until=t.ends_at where id=t.id;
  update ludus_infirmary_private.injuries set status='healed',healed_at=t.ends_at where id=i.id;
  update public.ludus_gladiators set status='available',injury_level=0,injured_until=null,fatigue_value=value,fatigue=ceil(value)where id=p_gladiator;
 else
  update ludus_infirmary_private.treatments set credited_until=greatest(t.credited_until,least(ts,t.ends_at))where id=t.id;
  update public.ludus_gladiators set fatigue_value=value,fatigue=ceil(value)where id=p_gladiator;
 end if;
end $$;
create function ludus_private.exercise_recover_v46(p_gladiator uuid)returns void language plpgsql set search_path='' as $$
begin perform ludus_infirmary_private.recover_v289(p_gladiator);end $$;

create function ludus_infirmary_private.clan_eligible_v289(p_injury uuid)
returns boolean language sql stable set search_path='' as $$
 select coalesce((select i.source_type='clan' and coalesce((i.context->>'verified')::boolean,false)
 and(select count(*)from ludus_infirmary_private.injuries j where j.owner_id=i.owner_id and j.source_type='clan' and j.source_id=i.source_id)>=2
 and exists(select 1 from ludus_infirmary_private.treatments t join ludus_infirmary_private.injuries j on j.id=t.injury_id
 where j.owner_id=i.owner_id and j.source_type='clan' and j.source_id=i.source_id and j.id<>i.id)
 from ludus_infirmary_private.injuries i where i.id=p_injury),false)
$$;
create function ludus_infirmary_private.effects_v289(p_owner uuid,p_injury uuid)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('content_id',l.content_id,'label',case l.ordinal
 when 1 then 'Sargı tasarrufu' when 2 then 'Tahta Atel tasarrufu' when 3 then 'Sirkeli Sünger tasarrufu'
 when 4 then 'Balmumu Merhemi tasarrufu' when 5 then 'Defne Merhemi tasarrufu' when 6 then 'Ballı Sirke Şurubu ek yorgunluk giderimi'
 when 7 then 'İncir Şurubu taburculuk etkisi' when 8 then 'Hafif sakatlıkta dinlenme' when 9 then 'Orta sakatlıkta dinlenme'
 when 10 then 'Kötü sakatlıkta dinlenme' when 19 then 'Derin ön kol kesiğinde sargı tasarrufu' when 20 then 'Kaburga ezilmesinde Ballı Sirke Şurubu'
 when 25 then 'Klan yaralılarında sarf malzemesi tasarrufu'else l.title end,
 'value',(l.effect->>'value')::numeric,'effect_text',case when l.effect->>'operation'='event_probability' then
 '%'||replace(trim(trailing '.'from trim(trailing '0'from to_char((l.effect->>'value')::numeric*100,'FM990.000'))),'.',',')||' ihtimalle gereken malzemeden bir adet korunur.'
 else c.effect_text end)order by l.ordinal),'[]'::jsonb)
 from ludus_staff_private.learned_papyrus_v288 l join ludus_staff_private.papyrus_catalog_v288 c using(content_id)
 cross join ludus_infirmary_private.injuries i join ludus_infirmary_private.injury_catalog k on k.key=i.injury_key
 where l.owner_id=p_owner and i.id=p_injury and l.role_id='doctor'
 and not(l.ordinal=1 and i.injury_key='deep_forearm_laceration'and ludus_infirmary_private.value_v289(p_owner,19)>ludus_infirmary_private.value_v289(p_owner,1))
 and not(l.ordinal=6 and i.injury_key='rib_contusion'and ludus_infirmary_private.value_v289(p_owner,20)>ludus_infirmary_private.value_v289(p_owner,6))and(
 (l.ordinal=1 and coalesce((k.required->>'linen_bandage')::integer,0)>=2)or(l.ordinal=2 and k.required?'wood_splint')or
 (l.ordinal=3 and k.required?'vinegar_sponge')or(l.ordinal=4 and k.required?'beeswax_ointment')or(l.ordinal=5 and k.required?'laurel_ointment')or
 (l.ordinal=6 and k.required?'honey_vinegar_syrup')or(l.ordinal=7 and k.required?'fig_syrup')or
 (l.ordinal=8 and i.severity='light')or(l.ordinal=9 and i.severity='medium')or(l.ordinal=10 and i.severity='heavy')or
 (l.ordinal=19 and i.injury_key='deep_forearm_laceration')or(l.ordinal=20 and i.injury_key='rib_contusion')or
 (l.ordinal=25 and ludus_infirmary_private.clan_eligible_v289(i.id)))
$$;

create function ludus_infirmary_private.bonuses_v289(p_owner uuid,p_injury uuid)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('recovery_rate',ludus_infirmary_private.value_v289(p_owner,case i.severity when 'light'then 8 when 'medium'then 9 else 10 end),
 'recovery_per_hour',10*(1+ludus_infirmary_private.value_v289(p_owner,case i.severity when 'light'then 8 when 'medium'then 9 else 10 end)),
 'honey_extra',case when c.required?'honey_vinegar_syrup'then 5*(1+greatest(ludus_infirmary_private.value_v289(p_owner,6),case when i.injury_key='rib_contusion'then ludus_infirmary_private.value_v289(p_owner,20)else 0 end))else 0 end,
 'fig_discharge',case when c.required?'fig_syrup'then 5*(1+ludus_infirmary_private.value_v289(p_owner,7))else 0 end)
 from ludus_infirmary_private.injuries i join ludus_infirmary_private.injury_catalog c on c.key=i.injury_key where i.id=p_injury and i.owner_id=p_owner
$$;

create function ludus_infirmary_private.preview_v289(p_owner uuid,p_injury uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare i ludus_infirmary_private.injuries;k ludus_infirmary_private.injury_catalog;required_rows jsonb;enough boolean;reason text;bonuses jsonb;
begin
 select * into i from ludus_infirmary_private.injuries where id=p_injury and owner_id=p_owner;
 if not found then raise exception 'Sakatlık kaydı bu ludusa ait değil.';end if;
 select * into k from ludus_infirmary_private.injury_catalog where key=i.injury_key;
 select jsonb_agg(jsonb_build_object('sku',e.key,'name',r.name,'required',e.value::integer,'owned',ludus_infirmary_private.stock_v289(p_owner,e.key))order by r.sort_order),
 bool_and(ludus_infirmary_private.stock_v289(p_owner,e.key)>=e.value::integer)into required_rows,enough
 from jsonb_each_text(k.required)e join ludus_supply_private.resources r on r.sku=e.key;
 reason:=case when i.status<>'untreated' then 'Bu yaralı için tedavi zaten başlatılmış.' when ludus_infirmary_private.busy_v289(i.gladiator_id)then 'Gladyatörün devam eden görevini veya karşılaşmasını tamamla.' when not enough then 'Tedavi için malzeme eksik.'else null end;
 bonuses:=ludus_infirmary_private.bonuses_v289(p_owner,i.id);
 return jsonb_build_object('injury_id',i.id,'can_start',reason is null,'reason',reason,'required',required_rows,'duration_seconds',k.duration_seconds,
 'recovery',jsonb_build_object('base_per_hour',10,'doctor_rate',bonuses->'recovery_rate','per_hour',bonuses->'recovery_per_hour','honey_total',bonuses->'honey_extra','fig_discharge',bonuses->'fig_discharge'),
 'doctor_effects',ludus_infirmary_private.effects_v289(p_owner,i.id));
end $$;

create function ludus_infirmary_private.state_v289(p_owner uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare recipes_json jsonb;inventory_json jsonb;injuries_json jsonb;treatments_json jsonb;legacy_json jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('sku',r.sku,'name',r.name,'profession','smith','output_quantity',1,'ingredients',items.rows,
 'max_craftable',greatest(0,least(100,50000-ludus_infirmary_private.stock_v289(p_owner,r.sku),items.maximum)))order by r.sort_order),'[]')into recipes_json
 from ludus_infirmary_private.recipes r cross join lateral(
 select jsonb_agg(e.value||jsonb_build_object('name',coalesce(s.name,e.value->>'sku'),'owned',ludus_infirmary_private.stock_v289(p_owner,e.value->>'sku',e.value->>'source'))order by e.ordinality)rows,
 min(ludus_infirmary_private.stock_v289(p_owner,e.value->>'sku',e.value->>'source')/(e.value->>'quantity')::integer)maximum
 from jsonb_array_elements(r.ingredients)with ordinality e(value,ordinality)left join ludus_supply_private.resources s on s.sku=e.value->>'sku')items;
 select coalesce(jsonb_agg(jsonb_build_object('sku',r.sku,'name',r.name,'quantity',ludus_infirmary_private.stock_v289(p_owner,r.sku))order by r.sort_order),'[]')into inventory_json from ludus_infirmary_private.recipes r;
 select coalesce(jsonb_agg(x.row order by x.occurred_at desc),'[]')into injuries_json from(
 select to_jsonb(i)||jsonb_build_object('gladiator_name',g.name,'injury_name',c.name,'duration_seconds',c.duration_seconds,'fatigue_value',g.fatigue_value)row,i.occurred_at
 from ludus_infirmary_private.injuries i join public.ludus_gladiators g on g.id=i.gladiator_id join ludus_infirmary_private.injury_catalog c on c.key=i.injury_key
 where i.owner_id=p_owner order by(i.status='healed'),i.occurred_at desc limit 200)x;
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('fatigue_value',g.fatigue_value)order by t.started_at desc),'[]')into treatments_json from ludus_infirmary_private.treatments t join public.ludus_gladiators g on g.id=t.gladiator_id where t.owner_id=p_owner;
 select coalesce(jsonb_agg(jsonb_build_object('gladiator_id',g.id,'gladiator_name',g.name,'injury_level',g.injury_level,'injured_until',g.injured_until,'status','legacy')order by g.name),'[]')into legacy_json
 from public.ludus_gladiators g where g.owner_id=p_owner and g.status='injured' and not exists(select 1 from ludus_infirmary_private.injuries i where i.gladiator_id=g.id and i.status<>'healed');
 return jsonb_build_object('user_id',p_owner,'server_now',clock_timestamp(),'recipes',recipes_json,'inventory',inventory_json,'injuries',injuries_json,'treatments',treatments_json,'legacy_injuries',legacy_json);
end $$;

create function ludus_infirmary_private.api_v289(p_action text,p_args jsonb,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=auth.uid();r ludus_infirmary_private.recipes;i ludus_infirmary_private.injuries;k ludus_infirmary_private.injury_catalog;
 t ludus_infirmary_private.treatments;receipt ludus_infirmary_private.receipts;payload jsonb;outcome jsonb;result jsonb;preview jsonb;
 entry jsonb;sku text;source text;qty integer;need integer;stock integer;spent jsonb:='[]';consumed jsonb;saved jsonb:='{}';chance numeric;
 ids uuid;ts timestamptz;doctor_effects jsonb;bonuses jsonb;rate numeric;extra numeric;fig numeric;clan_ordinal integer;g record;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;if not found then raise exception 'Ludus bulunamadı.';end if;
 if p_action is null or p_action not in('state','preview','craft','start','finish')or p_args is null or jsonb_typeof(p_args)<>'object' then raise exception 'Revir işlemi geçersiz.';end if;
 perform ludus_food_private.settle_v55(u,(clock_timestamp()at time zone'Europe/Istanbul')::date);
 for g in select id from public.ludus_gladiators where owner_id=u and(status='injured' or exists(select 1 from ludus_infirmary_private.injuries j where j.gladiator_id=ludus_gladiators.id and j.status<>'healed'))order by id loop
  perform ludus_private.exercise_recover_v46(g.id);
 end loop;
 if p_action in('craft','start','finish')then
  if p_request is null then raise exception 'İşlem kimliği gerekiyor.';end if;
  payload:=jsonb_build_object('action',p_action,'args',p_args);
  select * into receipt from ludus_infirmary_private.receipts where owner_id=u and request_id=p_request;
  if found then
   if receipt.payload<>payload then raise exception 'Bu işlem kimliği başka bir istek için kullanılmış.';end if;
   return ludus_infirmary_private.state_v289(u)||jsonb_build_object('outcome',receipt.outcome||'{"replayed":true}'::jsonb);
  end if;
 end if;
 if p_action='preview' then preview:=ludus_infirmary_private.preview_v289(u,(p_args->>'injury_id')::uuid);
 elsif p_action='craft' then
  if coalesce(p_args->>'quantity','')!~'^[1-9][0-9]{0,2}$'then raise exception 'Üretim adedi 1 ile 100 arasında olmalı.';end if;
  qty:=(p_args->>'quantity')::integer;if qty>100 then raise exception 'Üretim adedi 1 ile 100 arasında olmalı.';end if;
  select * into r from ludus_infirmary_private.recipes where recipes.sku=p_args->>'sku';if not found then raise exception 'Reçete bulunamadı.';end if;
  if ludus_infirmary_private.stock_v289(u,r.sku)+qty>50000 then raise exception 'Kasa kapasitesi dolu.';end if;
  -- Preflight the entire recipe before any stock debit, never create ingredients.
  for entry in select value from jsonb_array_elements(r.ingredients)order by value->>'source',value->>'sku' loop
   sku:=entry->>'sku';source:=entry->>'source';need:=(entry->>'quantity')::integer*qty;
   if source='food'then perform 1 from public.ludus_food_stock s where s.owner_id=u and s.sku=sku for update;
   else perform 1 from ludus_supply_private.stock s where s.owner_id=u and s.sku=sku for update;end if;
   if ludus_infirmary_private.stock_v289(u,sku,source)<need then raise exception 'Üretim için malzeme eksik.';end if;
  end loop;
  for entry in select value from jsonb_array_elements(r.ingredients)loop
   sku:=entry->>'sku';source:=entry->>'source';need:=(entry->>'quantity')::integer*qty;
   if source='food'then update public.ludus_food_stock s set quantity=s.quantity-need where s.owner_id=u and s.sku=sku;
   else update ludus_supply_private.stock s set quantity=s.quantity-need where s.owner_id=u and s.sku=sku;end if;
   spent:=spent||jsonb_build_array(jsonb_build_object('sku',sku,'quantity',need,'source',source));
  end loop;
  insert into ludus_supply_private.stock(owner_id,sku,quantity)values(u,r.sku,qty)on conflict on constraint stock_pkey do update set quantity=ludus_supply_private.stock.quantity+excluded.quantity;
  outcome:=jsonb_build_object('action','craft','sku',r.sku,'quantity',qty,'spent',spent);
 elsif p_action='start' then
  select * into i from ludus_infirmary_private.injuries where id=(p_args->>'injury_id')::uuid and owner_id=u for update;
  if not found then raise exception 'Sakatlık kaydı bu ludusa ait değil.';end if;
  perform 1 from public.ludus_gladiators where id=i.gladiator_id and owner_id=u for update;
  preview:=ludus_infirmary_private.preview_v289(u,i.id);
  if not(preview->>'can_start')::boolean then raise exception '%',preview->>'reason';end if;
  select * into k from ludus_infirmary_private.injury_catalog where key=i.injury_key;
  -- Full stock is mandatory BEFORE all random savings, including doctor_025.
  for sku,need in select key,value::integer from jsonb_each_text(k.required)order by key loop
   perform 1 from ludus_supply_private.stock s where s.owner_id=u and s.sku=sku for update;
   if ludus_infirmary_private.stock_v289(u,sku)<need then raise exception 'Tedavi için malzeme eksik.';end if;
  end loop;
  consumed:=k.required;doctor_effects:=ludus_infirmary_private.effects_v289(u,i.id);
  for sku,need in select key,value::integer from jsonb_each_text(k.required)order by key loop
   chance:=case sku when 'linen_bandage' then case when need>=2 then greatest(ludus_infirmary_private.value_v289(u,1),case when i.injury_key='deep_forearm_laceration' then ludus_infirmary_private.value_v289(u,19)else 0 end)else 0 end
    when 'wood_splint'then ludus_infirmary_private.value_v289(u,2)when 'vinegar_sponge'then ludus_infirmary_private.value_v289(u,3)
    when 'beeswax_ointment'then ludus_infirmary_private.value_v289(u,4)when 'laurel_ointment'then ludus_infirmary_private.value_v289(u,5)else 0 end;
   if chance>0 and ludus_infirmary_private.draw_v289()<chance then consumed:=jsonb_set(consumed,array[sku],to_jsonb(need-1));saved:=saved||jsonb_build_object(sku,1);end if;
  end loop;
  if ludus_infirmary_private.clan_eligible_v289(i.id)then
   select count(*)+1 into clan_ordinal from ludus_infirmary_private.treatments x join ludus_infirmary_private.injuries y on y.id=x.injury_id where y.owner_id=u and y.source_type='clan' and y.source_id=i.source_id;
   chance:=ludus_infirmary_private.value_v289(u,25);
   if chance>0 and ludus_infirmary_private.draw_v289()<chance then
    select key into sku from jsonb_each_text(consumed)where value::integer>0 order by key offset floor(ludus_infirmary_private.draw_v289()*(select count(*)from jsonb_each_text(consumed)where value::integer>0))::integer limit 1;
    if sku is not null then consumed:=jsonb_set(consumed,array[sku],to_jsonb((consumed->>sku)::integer-1));saved:=jsonb_set(saved,array[sku],to_jsonb(coalesce((saved->>sku)::integer,0)+1));end if;
   end if;
  end if;
  for sku,need in select key,value::integer from jsonb_each_text(consumed)loop
   update ludus_supply_private.stock s set quantity=s.quantity-need where s.owner_id=u and s.sku=sku;
  end loop;
  bonuses:=ludus_infirmary_private.bonuses_v289(u,i.id);ts:=clock_timestamp();
  insert into ludus_infirmary_private.treatments(injury_id,owner_id,gladiator_id,started_at,ends_at,credited_until,required,consumed,saved,doctor_effects,bonuses,clan_treatment_ordinal)
  values(i.id,u,i.gladiator_id,ts,ts+make_interval(secs=>k.duration_seconds),ts,k.required,consumed,saved,doctor_effects,bonuses,clan_ordinal)returning * into t;
  update ludus_infirmary_private.injuries set status='treating',treatment_id=t.id where id=i.id;
  update public.ludus_gladiators set status='injured',injured_until=t.ends_at,fatigue_rest_from=ts where id=i.gladiator_id;
  outcome:=jsonb_build_object('action','start','injury_id',i.id,'treatment_id',t.id,'started_at',t.started_at,'ends_at',t.ends_at,'consumed',consumed,'saved',saved);
  preview:=preview||jsonb_build_object('can_start',false,'reason','Tedavi başlatıldı.');
 elsif p_action='finish' then
  select * into t from ludus_infirmary_private.treatments where id=(p_args->>'treatment_id')::uuid and owner_id=u for update;
  if not found then raise exception 'Tedavi kaydı bu ludusa ait değil.';end if;
  if t.status<>'finished' then raise exception 'Revir süresi henüz tamamlanmadı.';end if;
  outcome:=jsonb_build_object('action','finish','treatment_id',t.id,'injury_id',t.injury_id,'finished_at',t.finished_at);
 end if;
 if outcome is not null then
  outcome:=outcome||jsonb_build_object('request_id',p_request,'replayed',false);
  insert into ludus_infirmary_private.receipts(owner_id,request_id,payload,outcome)values(u,p_request,payload,outcome);
 end if;
 result:=ludus_infirmary_private.state_v289(u);
 if preview is not null then result:=result||jsonb_build_object('preview',preview);end if;
 if outcome is not null then result:=result||jsonb_build_object('outcome',outcome);end if;
 return result;
end $$;
create function public.ludus_infirmary_v289(p_action text default 'state',p_args jsonb default '{}',p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select ludus_infirmary_private.api_v289(p_action,p_args,p_request)$$;

do $$declare tab text;begin
 foreach tab in array array['recipes','injury_catalog','injuries','treatments','receipts']loop
 execute format('alter table ludus_infirmary_private.%I enable row level security',tab);
 execute format('revoke all on ludus_infirmary_private.%I from public,anon,authenticated',tab);
 end loop;
end $$;
revoke all on all functions in schema ludus_infirmary_private from public,anon,authenticated;
revoke all on function ludus_private.exercise_recover_pre_v289(uuid),ludus_private.exercise_recover_v46(uuid),public.ludus_infirmary_v289(text,jsonb,uuid)from public,anon,authenticated;
grant execute on function ludus_infirmary_private.api_v289(text,jsonb,uuid),public.ludus_infirmary_v289(text,jsonb,uuid)to authenticated;
update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active',runtime_reason='Revirdeki gerçek tedavi ve malzeme hesabında uygulanır.'
where profession='doctor'and ordinal in(1,2,3,4,5,6,7,8,9,10,19,20);
update ludus_staff_private.papyrus_catalog_v288 set runtime_status='pending_feature',runtime_reason='Doğrulanmış klan savaşı yaralanma kaydı bekleniyor.'where content_id='doctor_025';
