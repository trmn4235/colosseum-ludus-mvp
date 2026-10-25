-- V189: two lightweight helmets using the existing equipment and crafting rules.
-- Existing inventory, stats, balances and permissions are unchanged.
insert into public.ludus_shop_catalog(sku,category,name,kind,model,price)
values ('helmet-viking','Miğferler','Boynuzlu Viking miğferi','helmet','viking_helmet',100),
       ('helmet-steel','Miğferler','Çelik miğfer','helmet','steel_helmet',100)
on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,category=excluded.category;
insert into ludus_supply_private.production_recipes_v118(sku,name,kind,model,ingredients,output_type,output_quantity,sort_order)
values ('helmet-viking','Boynuzlu Viking miğferi','helmet','viking_helmet','{"steel":5,"leather":3,"linen":2,"wool_cloth":1}','equipment',1,246),
       ('helmet-steel','Çelik miğfer','helmet','steel_helmet','{"steel":5,"leather":3,"linen":2,"wool_cloth":1}','equipment',1,247)
on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;
insert into ludus_supply_private.recipes(sku,ingredients)
values ('helmet-viking','{"steel":5,"leather":3,"linen":2,"wool_cloth":1}'),
       ('helmet-steel','{"steel":5,"leather":3,"linen":2,"wool_cloth":1}')
on conflict(sku) do update set ingredients=excluded.ingredients;
