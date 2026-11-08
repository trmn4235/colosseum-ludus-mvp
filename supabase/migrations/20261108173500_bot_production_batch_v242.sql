-- Buy useful batches of raw materials so one-hour caravan trips are not
-- repeatedly spent transporting just one recipe ingredient.
create or replace function ludus_bot_private.production_need_v238(p_owner uuid,p_sku text,p_qty integer,p_depth integer default 0)
returns jsonb language plpgsql stable set search_path='' as $$
declare have integer; missing integer; r ludus_supply_private.production_recipes_v118; ingredient record; next_step jsonb;
begin
 if p_depth>10 or p_qty<1 or p_qty>50000 then raise exception 'Üretim planı geçersiz.';end if;
 select coalesce(quantity,0) into have from ludus_supply_private.stock where owner_id=p_owner and sku=p_sku;
 missing:=greatest(0,p_qty-coalesce(have,0));
 if missing=0 then return null;end if;
 if exists(select 1 from ludus_supply_private.market_goods_v116 where sku=p_sku and active) then
  return jsonb_build_object('action','buy','sku',p_sku,'quantity',least(60,greatest(missing,case when p_sku in('wood','iron_ore') then 30 else 15 end)));
 end if;
 select * into r from ludus_supply_private.production_recipes_v118 where sku=p_sku;
 if not found then raise exception 'Üretim girdisi bulunamadı: %',p_sku;end if;
 for ingredient in select key,value::integer amount from jsonb_each_text(r.ingredients) order by key loop
  next_step:=ludus_bot_private.production_need_v238(p_owner,ingredient.key,ingredient.amount,p_depth+1);
  if next_step is not null then return next_step;end if;
 end loop;
 return jsonb_build_object('action','craft','sku',p_sku);
end;$$;
revoke all on function ludus_bot_private.production_need_v238(uuid,text,integer,integer) from public,anon,authenticated;
