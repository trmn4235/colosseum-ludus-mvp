-- V193: one craftable Halberd, intentionally filed under Silahlar / Kılıçlar.
-- No currency, inventory, stock or account grants.
insert into public.ludus_shop_catalog(sku,category,name,kind,model,price,subcategory)
 values('halberd','Silahlar','Halberd','weapon','halberd',100,'swords')
 on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,category=excluded.category,subcategory=excluded.subcategory;
insert into ludus_supply_private.production_recipes_v118(sku,name,kind,model,ingredients,output_type,output_quantity,sort_order)
 values('halberd','Halberd','weapon','halberd','{"steel":7,"wood":3,"leather":2,"resin":2,"rope":1}','equipment',1,237)
 on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=1,sort_order=excluded.sort_order;
insert into ludus_supply_private.recipes(sku,ingredients)
 select sku,ingredients from ludus_supply_private.production_recipes_v118 where sku='halberd'
 on conflict(sku) do update set ingredients=excluded.ingredients;

-- Combat registration: replace only known clauses, retaining ownership, ACL and validation.
do $migration$
declare f record;body text;old text;new text;pair text[];
begin
 for f in select p.oid,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in('ludus_start_battle_v2','ludus_finish_battle_v2','ludus_equip_item','ludus_match'))
 or (n.nspname='ludus_private' and p.proname='values_snapshot_v110')
 or (n.nspname='private' and p.proname in('ludus_resolve_combat_v36','ludus_hit_v73')) loop
  body:=pg_get_functiondef(f.oid);
  if f.proname in('ludus_start_battle_v2','ludus_finish_battle_v2','ludus_equip_item','values_snapshot_v110') then
   old:=$s$'heavy_mace','warhammer')$s$;new:=$s$'heavy_mace','warhammer','halberd')$s$;
   if position(old in body)=0 and position(new in body)=0 then raise exception 'Unexpected weapon allowlist in %',f.proname;end if;
   body:=replace(body,old,new);
  elsif f.proname='ludus_match' then
   foreach pair slice 1 in array array[
    array[$s$when 'trident' then .36$s$,$s$when 'halberd' then .36 when 'trident' then .36$s$],
    array[$s$when 'trident' then .24$s$,$s$when 'halberd' then .24 when 'trident' then .24$s$],
    array[$s$when 'trident' then .52$s$,$s$when 'halberd' then .52 when 'trident' then .52$s$]
   ] loop
    if position(pair[2] in body)=0 then
     if position(pair[1] in body)=0 then raise exception 'Unexpected multiplayer timing';end if;
     body:=replace(body,pair[1],pair[2]);
    end if;
   end loop;
  elsif f.proname='ludus_resolve_combat_v36' then
   old:=$s$when 'trident' then 2.50$s$;new:=$s$when 'halberd' then 2.50 when 'trident' then 2.50$s$;
   if position(new in body)=0 then
    if position(old in body)=0 then raise exception 'Unexpected melee reach';end if;
    body:=replace(body,old,new);
   end if;
   body:=replace(body,$s$weapon in('spear','trident')$s$,$s$weapon in('spear','trident','halberd')$s$);
  elsif f.proname='ludus_hit_v73' then
   body:=replace(body,$s$p_weapon in('spear','trident','scissor')$s$,$s$p_weapon in('spear','trident','scissor','halberd')$s$);
   body:=replace(body,$s$p_weapon in ('spear','trident')$s$,$s$p_weapon in ('spear','trident','halberd')$s$);
  end if;
  if position('halberd' in body)=0 then raise exception 'Halberd missing in %',f.proname;end if;
  execute body;
 end loop;
end;$migration$;
