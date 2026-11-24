-- Two cosmetics use the same chest stat rules, price and recipe as the decorated breastplate.
insert into public.ludus_shop_catalog(sku,category,name,kind,model,price) values
 ('chest-officer','Göğüs Zırhı','Roma subayı göğüs zırhı','chest','officer_chest',100),
 ('chest-officer-black','Göğüs Zırhı','Siyah Roma subayı göğüs zırhı','chest','officer_chest_black',100)
on conflict(sku) do update set category=excluded.category,name=excluded.name,kind=excluded.kind,model=excluded.model,price=excluded.price;

insert into ludus_supply_private.production_recipes_v118(sku,name,kind,model,ingredients,output_type,output_quantity,sort_order)
select c.sku,c.name,c.kind,c.model,'{"iron":18,"leather":8,"linen":5,"wool_cloth":3}'::jsonb,'equipment',1,
       case c.sku when 'chest-officer' then 258 else 259 end
from public.ludus_shop_catalog c where c.sku in ('chest-officer','chest-officer-black')
on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,
 output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;

insert into ludus_supply_private.recipes(sku,ingredients)
select sku,ingredients from ludus_supply_private.production_recipes_v118 where sku in ('chest-officer','chest-officer-black')
on conflict(sku) do update set ingredients=excluded.ingredients;
