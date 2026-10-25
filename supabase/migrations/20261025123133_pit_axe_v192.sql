-- V192: add the axe to venue loans; personal inventory, ownership and fame rules stay intact.
begin;
create or replace function ludus_pit_private.loan(p_weapon text) returns jsonb language plpgsql set search_path='' as $$
begin
 if p_weapon is null or p_weapon not in('pit_stone_mace','pit_wood_mace','pit_bow','pit_axe') then raise exception 'Avlunun taş gürzünü, ahşap gürzünü, baltasını veya yayını seç.';end if;
 return jsonb_build_object('kind','weapon','model',case when p_weapon='pit_bow' then 'bow' else 'heavy_mace' end,'pit_model',p_weapon,'equipped_slot','main_hand','enhancement',0,'base_stats','{}'::jsonb,'sapphires','[]'::jsonb,'rubies','[]'::jsonb,'emeralds','[]'::jsonb,'stat_version',10,'natural_rule_version',2,'natural_stats',ludus_private.item_v10('weapon'),'natural_percentages',(select jsonb_object_agg(key,0) from jsonb_each(ludus_private.item_v10('weapon'))),'certus_used',false);
end $$;
revoke all on function ludus_pit_private.loan(text) from public,anon,authenticated;
commit;
