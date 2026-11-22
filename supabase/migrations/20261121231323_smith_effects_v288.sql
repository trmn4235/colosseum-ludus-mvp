-- V288: learned Demirci knowledge affects the actual server roll and its preview.
-- The owner account lock in ludus_upgrade_item_v10 serializes completed attempts.
create table ludus_staff_private.smith_series_v288 (
 owner_id uuid primary key references public.ludus_accounts(user_id) on delete cascade,
 item_id uuid not null,
 family text not null check(family in ('enhance','sapphire','emerald')),
 completed bigint not null check(completed>0),
 low_streak bigint not null check(low_streak>=0),
 last_success boolean not null,
 last_quality integer,
 last_request uuid not null,
 updated_at timestamptz not null default clock_timestamp()
);
alter table ludus_staff_private.smith_series_v288 enable row level security;
revoke all on ludus_staff_private.smith_series_v288 from public,anon,authenticated;

create or replace function ludus_staff_private.smith_bonus_v288(p_owner uuid,p_item public.ludus_items,p_action text)
returns jsonb language plpgsql stable set search_path='' as $$
declare s ludus_staff_private.smith_series_v288; n bigint:=0; failures bigint:=0; last_ok boolean;
 e record; eligible boolean; general_bonus numeric:=0; conditional_bonus numeric:=0; applied jsonb:='[]'; candidate jsonb:='[]';
begin
 if p_action not in ('enhance','sapphire','emerald') or p_action is null then raise exception 'Geçersiz geliştirme işlemi';end if;
 select * into s from ludus_staff_private.smith_series_v288 where owner_id=p_owner;
 if found and s.item_id=p_item.id and s.family=p_action then n:=s.completed;failures:=s.low_streak;last_ok:=s.last_success;end if;
 for e in select content_id,ordinal,title,effect from ludus_staff_private.learned_papyrus_v288
  where owner_id=p_owner and role_id='smith' and
   ((p_action='enhance' and ordinal between 1 and 9) or (p_action='sapphire' and ordinal between 10 and 17) or (p_action='emerald' and ordinal between 18 and 25)) order by ordinal loop
  eligible:=case e.ordinal
   when 1 then true when 2 then p_item.enhancement+1 between 1 and 4 when 3 then p_item.enhancement+1 between 5 and 8 when 4 then p_item.enhancement+1>=9
   when 5 then last_ok is true when 6 then n>=2 when 7 then n>=4 when 8 then failures>=1 when 9 then failures>=2
   when 10 then true when 11 then n>=2 when 12 then n>=4 when 13 then failures>=1 when 14 then failures>=2
   when 15 then p_item.enhancement between 5 and 8 when 16 then p_item.enhancement>=9
   when 17 then exists(select 1 from jsonb_array_elements(p_item.emeralds) x where (x->>'value')::numeric>=95)
   when 18 then true when 19 then n>=2 when 20 then n>=4 when 21 then failures>=1 when 22 then failures>=2
   when 23 then p_item.enhancement between 5 and 8 when 24 then p_item.enhancement>=9
   when 25 then exists(select 1 from jsonb_each_text(p_item.natural_percentages) x where x.value::numeric>=95)
   else false end;
  if eligible then
   if e.ordinal in (1,10,18) then
    general_bonus:=greatest(general_bonus,least(.002,greatest(0,(e.effect->>'value')::numeric)));
    applied:=applied||jsonb_build_array(jsonb_build_object('id',e.content_id,'title',e.title,'kind','general','bonus',general_bonus));
   elsif least(.004,greatest(0,(e.effect->>'value')::numeric))>conditional_bonus then
    conditional_bonus:=least(.004,greatest(0,(e.effect->>'value')::numeric));
    candidate:=jsonb_build_array(jsonb_build_object('id',e.content_id,'title',e.title,'kind','conditional','bonus',conditional_bonus));
   end if;
  end if;
 end loop;
 return jsonb_build_object('general_bonus',general_bonus,'conditional_bonus',conditional_bonus,'bonus',least(.006,general_bonus+conditional_bonus),'applied',applied||candidate,
  'series',jsonb_build_object('completed',n,'next_attempt',n+1,'low_streak',failures,'last_success',last_ok),'combination','general_plus_highest_conditional');
end $$;

-- Probability mass transfers proportionally from <95 to >=95.
-- Existing 100:95 ratio of 1:5 and all lower-quality relative weights are kept.
create or replace function ludus_staff_private.smith_quality_distribution_v288(p_bonus numeric)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_agg(jsonb_build_object('value',v,'probability',case when v>=95 then w/.6*(.6/365.6+least(.006,greatest(0,p_bonus))) else w/365*(1-(.6/365.6+least(.006,greatest(0,p_bonus)))) end)order by v desc)
 from (values(100,.1::numeric),(95,.5),(90,1),(85,3),(80,5),(75,8),(70,12),(65,16),(60,20),(50,30),(40,45),(30,60),(20,75),(10,90))weights(v,w)
$$;
create or replace function ludus_staff_private.smith_quality_roll_v288(p_bonus numeric,p_roll double precision)
returns integer language plpgsql immutable set search_path='' as $$
declare e jsonb; threshold double precision:=0;
begin
 if p_roll<0 or p_roll>=1 or p_roll is null then raise exception 'Geçersiz kalite çekilişi';end if;
 for e in select value from jsonb_array_elements(ludus_staff_private.smith_quality_distribution_v288(p_bonus)) loop
  threshold:=threshold+(e->>'probability')::double precision;
  if p_roll<threshold then return (e->>'value')::integer;end if;
 end loop;
 return 10;
end $$;

create or replace function ludus_staff_private.smith_calculation_v288(p_owner uuid,p_item public.ludus_items,p_action text,p_stone integer)
returns jsonb language plpgsql stable set search_path='' as $$
declare b jsonb; base numeric; ruby numeric:=0; final_chance numeric;stat_key text;
begin
 if p_item.locked_battle_id is not null then raise exception 'Savaşta kullanılan eşya geliştirilemez';end if;
 if p_item.stat_version<>10 then raise exception 'Item kurulumu gerekli';end if;
 b:=ludus_staff_private.smith_bonus_v288(p_owner,p_item,p_action);
 if p_action='enhance' then
  if p_stone is not null and p_stone not between 1 and 4 then raise exception 'Geçersiz Yakut';end if;
  if p_stone=4 and (p_item.enhancement<10 or p_item.enhancement>=15 or p_item.certus_used) then raise exception 'CERTUS yalnızca +10–+15 bandında item başına bir kez';end if;
  if p_stone in (2,3) and p_item.enhancement<6 then raise exception 'Koruma Yakutları +6 ve üzerinde kullanılabilir';end if;
  base:=case when p_item.enhancement<4 then .7 when p_item.enhancement<6 then .6 when p_item.enhancement<8 then .5 when p_item.enhancement<10 then .4 else .3 end;
  if p_stone=1 then ruby:=.02;end if;
  final_chance:=case when p_stone=4 then 1 else least(1,base+ruby+(b->>'bonus')::numeric) end;
  return b||jsonb_build_object('action',p_action,'item_id',p_item.id,'stone_id',p_stone,'base_chance',base,'ruby_bonus',ruby,'guaranteed',coalesce(p_stone=4,false),'chance',final_chance,'effective_bonus',case when p_stone=4 then 0 else final_chance-base-ruby end,'target_plus',p_item.enhancement+1,'destruction_chance_on_failure',case when p_item.enhancement>=6 then .13 else 0 end);
 elsif p_action in ('sapphire','emerald') then
  select effect_key into stat_key from public.ludus_stone_catalog where family=p_action and stone_id=p_stone;
  if not found then raise exception 'Taş tanımlı değil';end if;
  if p_action='sapphire' and not(p_item.natural_stats?stat_key) then raise exception 'Bu Safir eşyanın grubuna uygun değil';end if;
  if p_action='emerald' and not exists(select 1 from jsonb_array_elements(p_item.emeralds) s where (s->>'id')::integer=p_stone) and jsonb_array_length(p_item.emeralds)>=4 then raise exception 'Dört farklı Zümrüt yuvası dolu';end if;
  base:=.6/365.6;
  return b||jsonb_build_object('action',p_action,'item_id',p_item.id,'stone_id',p_stone,'quality_threshold',95,'base_chance',base,'chance',base+(b->>'bonus')::numeric,'effective_bonus',(b->>'bonus')::numeric,'quality_distribution',ludus_staff_private.smith_quality_distribution_v288((b->>'bonus')::numeric));
 end if;
 raise exception 'Geçersiz geliştirme işlemi';
end $$;

create or replace function public.ludus_smith_preview_v288(p_item uuid,p_action text,p_stone integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();it public.ludus_items;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Giriş gerekli';end if;
 select * into it from public.ludus_items where owner_id=uid and id=p_item;
 if not found then raise exception 'Eşya bulunamadı';end if;
 return ludus_staff_private.smith_calculation_v288(uid,it,p_action,p_stone);
end $$;

-- Original V10 resource, ruby, destruction and receipt behavior is preserved.
create or replace function public.ludus_upgrade_item_v10(p_item uuid,p_action text,p_stone integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();it public.ludus_items;receipt public.ludus_upgrade_receipts;
 f text;stat_key text;rolled integer;chance double precision;ok boolean;result jsonb;old_plus integer;exploded boolean:=false;destroyed boolean:=false;
 smith jsonb;was_low boolean;
begin
 if uid is null or p_request is null then raise exception 'Giriş ve işlem kimliği gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;if not found then raise exception 'Ludus bulunamadı';end if;
 select * into receipt from public.ludus_upgrade_receipts where owner_id=uid and request_id=p_request;
 if found then
  if receipt.item_id is distinct from p_item or receipt.action is distinct from p_action or receipt.stone_id is distinct from p_stone then raise exception 'İşlem kimliği başka istekte kullanıldı';end if;
  return receipt.result;
 end if;
 select * into it from public.ludus_items where owner_id=uid and id=p_item for update;
 if not found then raise exception 'Eşya bulunamadı';end if;
 old_plus:=it.enhancement;
 smith:=ludus_staff_private.smith_calculation_v288(uid,it,p_action,p_stone);
 if p_action='enhance' then
  if p_stone is not null and not exists(select 1 from public.ludus_stones where owner_id=uid and family='ruby' and stone_id=p_stone and quantity>0) then raise exception 'Yakut yetersiz';end if;
  update public.ludus_accounts set diamonds=diamonds-1 where user_id=uid and diamonds>0;if not found then raise exception 'Elmas yetersiz';end if;
  chance:=(smith->>'chance')::double precision;
  ok:=random()<chance;
  if not ok and old_plus>=6 then exploded:=random()<.13;end if;
  if p_stone in (1,4) then update public.ludus_stones set quantity=quantity-1 where owner_id=uid and family='ruby' and stone_id=p_stone;end if;
  if exploded and p_stone in (2,3) then update public.ludus_stones set quantity=quantity-1 where owner_id=uid and family='ruby' and stone_id=p_stone;end if;
  if exploded and p_stone is distinct from 2 and p_stone is distinct from 3 then
   delete from public.ludus_items where id=it.id;destroyed:=true;
  else
   update public.ludus_items set enhancement=case when exploded and p_stone=3 then 4 when ok then enhancement+1 else enhancement end,certus_used=certus_used or coalesce(p_stone=4,false) where id=it.id returning * into it;
  end if;
  result:=jsonb_build_object('success',ok,'action',p_action,'before_plus',old_plus,'plus',case when destroyed then null else it.enhancement end,'chance',chance,'exploded',exploded,'destruction_chance_on_failure',case when old_plus>=6 then .13 else 0 end,'destroyed',destroyed,'protection',case when exploded and p_stone=2 then 'TENAX' when exploded and p_stone=3 then 'VESPER' else null end,'item',case when destroyed then null else to_jsonb(it) end);
  was_low:=not ok;
 elsif p_action in ('sapphire','emerald') then
  f:=p_action;select effect_key into stat_key from public.ludus_stone_catalog where family=f and stone_id=p_stone;
  update public.ludus_stones set quantity=quantity-1 where owner_id=uid and family=f and stone_id=p_stone and quantity>0;if not found then raise exception 'Taş yetersiz';end if;
  rolled:=ludus_staff_private.smith_quality_roll_v288((smith->>'bonus')::numeric,random());
  if f='sapphire' then update public.ludus_items set natural_percentages=jsonb_set(natural_percentages,array[stat_key],to_jsonb(rolled)) where id=it.id returning * into it;
  else update public.ludus_items set emeralds=coalesce((select jsonb_agg(s) from jsonb_array_elements(emeralds) s where (s->>'id')::integer<>p_stone),'[]')||jsonb_build_array(jsonb_build_object('id',p_stone,'value',rolled)) where id=it.id returning * into it;end if;
  result:=jsonb_build_object('success',true,'action',p_action,'stone_id',p_stone,'percentage',rolled,'item',to_jsonb(it));
  was_low:=rolled<95;
 else raise exception 'Geçersiz geliştirme işlemi';end if;
 -- A rejected attempt rolls back all writes. Replayed requests return above.
 insert into ludus_staff_private.smith_series_v288(owner_id,item_id,family,completed,low_streak,last_success,last_quality,last_request)
 values(uid,p_item,p_action,(smith#>>'{series,completed}')::bigint+1,case when was_low then (smith#>>'{series,low_streak}')::bigint+1 else 0 end,not was_low,rolled,p_request)
 on conflict(owner_id)do update set item_id=excluded.item_id,family=excluded.family,completed=excluded.completed,low_streak=excluded.low_streak,last_success=excluded.last_success,last_quality=excluded.last_quality,last_request=excluded.last_request,updated_at=clock_timestamp();
 result:=result||jsonb_build_object('smith',smith);
 insert into public.ludus_upgrade_receipts(owner_id,request_id,item_id,action,stone_id,result) values(uid,p_request,p_item,p_action,p_stone,result);
 return result;
end $$;

revoke all on function ludus_staff_private.smith_bonus_v288(uuid,public.ludus_items,text),ludus_staff_private.smith_quality_distribution_v288(numeric),ludus_staff_private.smith_quality_roll_v288(numeric,double precision),ludus_staff_private.smith_calculation_v288(uuid,public.ludus_items,text,integer) from public,anon,authenticated;
revoke all on function public.ludus_smith_preview_v288(uuid,text,integer) from public,anon;
grant execute on function public.ludus_smith_preview_v288(uuid,text,integer) to authenticated;
revoke all on function public.ludus_upgrade_item_v10(uuid,text,integer,uuid) from public,anon;
grant execute on function public.ludus_upgrade_item_v10(uuid,text,integer,uuid) to authenticated;

update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active',runtime_reason=null where role_id='smith' and ordinal between 1 and 25;
