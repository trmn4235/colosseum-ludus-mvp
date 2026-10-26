-- V198: six selected shields, independent catalogue entries and server-owned recipes.
-- No inventory, currency or permissions change. Existing shield rules accept kind=shield.
insert into public.ludus_shop_catalog(sku,category,name,kind,model,price,subcategory) values
 ('shield-dura','Kalkanlar','Dura Europos oval kalkanı','shield','shield_dura',100,'large_shields'),
 ('shield-parma','Kalkanlar','Ahşap Parma kalkanı','shield','shield_parma',100,'small_medium_shields'),
 ('shield-celtic','Kalkanlar','Yeşil motifli kalkan','shield','shield_celtic',100,'small_medium_shields'),
 ('shield-azure','Kalkanlar','Mavi demir kuşaklı kalkan','shield','shield_azure',100,'small_medium_shields'),
 ('shield-viridis','Kalkanlar','Yeşil Roma kule kalkanı','shield','shield_viridis',100,'large_shields'),
 ('shield-aquila','Kalkanlar','Kartal işlemeli kule kalkanı','shield','shield_aquila',100,'large_shields')
on conflict(sku) do update set category=excluded.category,name=excluded.name,kind=excluded.kind,model=excluded.model,subcategory=excluded.subcategory;
insert into ludus_supply_private.production_recipes_v118(sku,name,kind,model,ingredients,output_type,output_quantity,sort_order) values
 ('shield-dura','Dura Europos oval kalkanı','shield','shield_dura','{"wood":6,"resin":2,"leather":3,"bronze":2}','equipment',1,252),
 ('shield-parma','Ahşap Parma kalkanı','shield','shield_parma','{"wood":3,"resin":1,"leather":2,"bronze":1}','equipment',1,253),
 ('shield-celtic','Yeşil motifli kalkan','shield','shield_celtic','{"wood":4,"resin":2,"leather":2,"iron":2}','equipment',1,254),
 ('shield-azure','Mavi demir kuşaklı kalkan','shield','shield_azure','{"wood":4,"resin":2,"leather":2,"steel":2}','equipment',1,255),
 ('shield-viridis','Yeşil Roma kule kalkanı','shield','shield_viridis','{"wood":7,"resin":3,"leather":3,"steel":3}','equipment',1,256),
 ('shield-aquila','Kartal işlemeli kule kalkanı','shield','shield_aquila','{"wood":7,"resin":3,"leather":3,"iron":3,"bronze":1}','equipment',1,257)
on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;
insert into ludus_supply_private.recipes(sku,ingredients)
select sku,ingredients from ludus_supply_private.production_recipes_v118 where sku in('shield-dura','shield-parma','shield-celtic','shield-azure','shield-viridis','shield-aquila')
on conflict(sku) do update set ingredients=excluded.ingredients;
