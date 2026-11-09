-- V256: 8–24 net units per worker; 10 purchased units per caravan.
-- Frozen quantities on existing departures and receipts are not rewritten.
create or replace function ludus_worker_private.license_yield_v255(p_level integer) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_level between 5 and 10 then jsonb_build_object(
  'level',p_level,'gross',tax*5,'tax',tax,'net',tax*4) else null end
 from(select (array[2,3,4,4,5,6])[p_level-4] as tax) rates;
$$;
update ludus_worker_private.clan_work_config_v232 set base_quantity=10 where id;

do $patch$
declare src text;
begin
 src:=pg_get_functiondef('ludus_supply_private.api(text,text,integer,uuid)'::regprocedure);
 if position('qty>p_workers*120' in src)=0 or position('''caravan_capacity'',120,' in src)=0
  or position('Her kervan en fazla 120 birim taşır.' in src)=0 then
  raise exception 'Unexpected V255 caravan capacity source';
 end if;
 src:=replace(src,'qty>p_workers*120','qty>p_workers*10');
 src:=replace(src,'Her kervan en fazla 120 birim taşır.','Her kervan en fazla 10 birim taşır.');
 execute replace(src,'''caravan_capacity'',120,','''caravan_capacity'',10,');
end $patch$;
notify pgrst,'reload schema';
