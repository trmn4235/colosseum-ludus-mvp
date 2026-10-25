-- Restore labels to the user's original imported 3D models.
-- Model IDs, owned items, upgrades, recipes, prices and quantities are unchanged.
update public.ludus_shop_catalog
 set name=case sku when 'helmet-silver' then 'Şövalye miğferi' when 'helmet-winged' then 'Kanatlı miğfer' end
 where (sku='helmet-silver' and kind='helmet' and model='silver')
    or (sku='helmet-winged' and kind='helmet' and model='winged');
update ludus_supply_private.production_recipes_v118
 set name=case sku when 'helmet-silver' then 'Şövalye miğferi' when 'helmet-winged' then 'Kanatlı miğfer' end
 where (sku='helmet-silver' and kind='helmet' and model='silver')
    or (sku='helmet-winged' and kind='helmet' and model='winged');
