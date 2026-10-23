-- V169: a distinct wearable helmet; existing items and player balances are unchanged.
insert into public.ludus_shop_catalog(sku,category,name,kind,model,price)
values ('helmet-sylvain','Miğferler','Vizörlü gladyatör miğferi','helmet','sylvain_helmet',100)
on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,category=excluded.category;
insert into ludus_supply_private.production_recipes_v118(sku,name,kind,model,ingredients,output_type,output_quantity,sort_order)
values ('helmet-sylvain','Vizörlü gladyatör miğferi','helmet','sylvain_helmet','{"steel":5,"leather":3,"linen":2,"wool_cloth":1}','equipment',1,245)
on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;
insert into ludus_supply_private.recipes(sku,ingredients)
values ('helmet-sylvain','{"steel":5,"leather":3,"linen":2,"wool_cloth":1}')
on conflict(sku) do update set ingredients=excluded.ingredients;
