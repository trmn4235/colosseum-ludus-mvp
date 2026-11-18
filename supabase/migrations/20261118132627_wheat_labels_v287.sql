-- V287: name the existing grain resource wheat without changing its SKU or balances.
begin;
update public.ludus_food_catalog set name='Buğday' where sku='grain';
update ludus_supply_private.resources set name='Buğday' where sku='grain';
update ludus_worker_private.professions_v227 set name='Buğday yetiştiriciliği' where sku='grain';
update ludus_supply_private.destinations set name='Buğday tarlası' where id='grain';
commit;
