-- V196: three source-derived arm guards and a separate trident. No inventory/currency grants.
insert into public.ludus_shop_catalog(sku,category,name,kind,model,price,subcategory) values
 ('manica-segmented','Kolluk / omuzluk','Plakalı gladyatör kolluğu','gloves','manica_segmented',100,null),
 ('manica-lion','Kolluk / omuzluk','Aslan başlı gladyatör kolluğu','gloves','manica_lion',100,null),
 ('manica-leather','Kolluk / omuzluk','Tokalı deri kolluk','gloves','manica_leather',100,null),
 ('trident-gladiator','Silahlar','Gladyatör tridenti','weapon','trident_gladiator',100,'polearms')
on conflict(sku) do update set category=excluded.category,name=excluded.name,kind=excluded.kind,model=excluded.model,subcategory=excluded.subcategory;
insert into ludus_supply_private.production_recipes_v118(sku,name,kind,model,ingredients,output_type,output_quantity,sort_order) values
 ('manica-segmented','Plakalı gladyatör kolluğu','gloves','manica_segmented','{"steel":3,"leather":2,"wool_cloth":1}','equipment',1,248),
 ('manica-lion','Aslan başlı gladyatör kolluğu','gloves','manica_lion','{"steel":3,"bronze":1,"leather":3}','equipment',1,249),
 ('manica-leather','Tokalı deri kolluk','gloves','manica_leather','{"leather":4,"iron":1,"wool_cloth":1}','equipment',1,250),
 ('trident-gladiator','Gladyatör tridenti','weapon','trident_gladiator','{"steel":8,"wood":3,"resin":3,"rope":3}','equipment',1,251)
on conflict(sku) do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;
insert into ludus_supply_private.recipes(sku,ingredients)
select sku,ingredients from ludus_supply_private.production_recipes_v118 where sku in('manica-segmented','manica-lion','manica-leather','trident-gladiator')
on conflict(sku) do update set ingredients=excluded.ingredients;

-- Combat registration: checked substitutions keep existing ownership, busy-state,
-- anti-replay checks, privileges, default NPC weapons and loot probabilities intact.
do $migration$
declare f record;body text;before text;old text;replacement text;pair text[];
begin
 for f in select p.oid,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in('ludus_start_battle_v2','ludus_finish_battle_v2','ludus_equip_item','ludus_match'))
 or (n.nspname='ludus_private' and p.proname='values_snapshot_v110')
 or (n.nspname='private' and p.proname in('ludus_resolve_combat_v36','ludus_hit_v73')) loop
  body:=pg_get_functiondef(f.oid);before:=body;
  if f.proname in('ludus_start_battle_v2','ludus_finish_battle_v2','ludus_equip_item','values_snapshot_v110') then
   old:=$s$'warhammer','halberd')$s$;replacement:=$s$'warhammer','halberd','trident_gladiator')$s$;
   if position(old in body)=0 and position(replacement in body)=0 then raise exception 'Unexpected weapon allowlist in %',f.proname;end if;
   body:=replace(body,old,replacement);
  elsif f.proname='ludus_match' then
   foreach pair slice 1 in array array[
    array[$s$when 'trident' then .36$s$,$s$when 'trident_gladiator' then .36 when 'trident' then .36$s$],
    array[$s$when 'trident' then .24$s$,$s$when 'trident_gladiator' then .24 when 'trident' then .24$s$],
    array[$s$when 'trident' then .52$s$,$s$when 'trident_gladiator' then .52 when 'trident' then .52$s$],
    array[$s$in('gladius','sica','spear','trident')$s$,$s$in('gladius','sica','spear','trident','trident_gladiator')$s$]
   ] loop
    if position(pair[2] in body)=0 then
     if position(pair[1] in body)=0 then raise exception 'Unexpected trident combat clause';end if;
     body:=replace(body,pair[1],pair[2]);
    end if;
   end loop;
  elsif f.proname='ludus_resolve_combat_v36' then
   old:=$s$when 'trident' then 2.50$s$;replacement:=$s$when 'trident_gladiator' then 2.50 when 'trident' then 2.50$s$;
   if position(replacement in body)=0 then
    if position(old in body)=0 then raise exception 'Unexpected melee reach';end if;
    body:=replace(body,old,replacement);
   end if;
   body:=replace(body,$s$weapon in('spear','trident','halberd')$s$,$s$weapon in('spear','trident','halberd','trident_gladiator')$s$);
  elsif f.proname='ludus_hit_v73' then
   body:=replace(body,$s$p_weapon in('spear','trident','scissor','halberd')$s$,$s$p_weapon in('spear','trident','scissor','halberd','trident_gladiator')$s$);
   body:=replace(body,$s$p_weapon in ('spear','trident','halberd')$s$,$s$p_weapon in ('spear','trident','halberd','trident_gladiator')$s$);
  end if;
  if position('trident_gladiator' in body)=0 then raise exception 'New trident missing in %',f.proname;end if;
  if body<>before then execute body;end if;
 end loop;
end;$migration$;
