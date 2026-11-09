-- Return only the visible equipment of the authenticated player's own party.
-- Keep the existing invitation, bot, READY and matchmaking rules unchanged.
create function ludus_ranked_party_private.lineup_v253(p_action text,p_peer uuid,p_gladiator uuid,p_invite uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();result jsonb;mine uuid;decorated jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Önce hesabına giriş yap.';end if;
 result:=public.ludus_ranked_party_v244(p_action,p_peer,p_gladiator,p_invite);
 if result->'party' is null or result->'party'='null'::jsonb then return result;end if;
 select m.room_id into mine from ludus_ranked_party_private.members_v244 m where m.user_id=u;
 if mine is null or mine is distinct from (result->'party'->>'id')::uuid then raise exception 'Takım üyeliği doğrulanamadı.';end if;
 select coalesce(jsonb_agg(entry.value||jsonb_build_object('appearance',jsonb_build_object(
  'gladiator',jsonb_build_object('id',g.id,'name',g.name,'class',g.class,'overall',g.overall,
    'level',to_jsonb(g)->'level','stat_version',to_jsonb(g)->'stat_version','base_stats',to_jsonb(g)->'base_stats'),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'model',i.model,
    'enhancement',i.enhancement,'equipped_slot',i.equipped_slot) order by i.equipped_slot,i.id)
   from public.ludus_items i where i.owner_id=m.user_id and i.equipped_by=m.gladiator_id
    and i.equipped_slot in ('main_hand','off_hand','helmet','chest','gloves','legs')),'[]'::jsonb)))
  order by entry.ordinality),'[]'::jsonb) into decorated
 from jsonb_array_elements(result->'party'->'members') with ordinality entry(value,ordinality)
 join ludus_ranked_party_private.members_v244 m on m.room_id=mine and m.user_id=(entry.value->>'user_id')::uuid
 join public.ludus_gladiators g on g.id=m.gladiator_id and g.owner_id=m.user_id;
 return jsonb_set(result,'{party,members}',decorated);
end;$$;
revoke all on function ludus_ranked_party_private.lineup_v253(text,uuid,uuid,uuid) from public,anon;
grant execute on function ludus_ranked_party_private.lineup_v253(text,uuid,uuid,uuid) to authenticated;
create function public.ludus_ranked_party_v253(p_action text default 'state',p_peer uuid default null,p_gladiator uuid default null,p_invite uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_ranked_party_private.lineup_v253(p_action,p_peer,p_gladiator,p_invite);
$$;
revoke all on function public.ludus_ranked_party_v253(text,uuid,uuid,uuid) from public,anon;
grant execute on function public.ludus_ranked_party_v253(text,uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
