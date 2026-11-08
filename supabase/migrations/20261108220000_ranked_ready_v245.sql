-- Preserve the V244 party API while adding authenticated, per-member readiness.
-- Starting a ranked battle remains disabled until the team combat service is ready.
alter table ludus_ranked_party_private.members_v244 add column ready_signature text;

create function ludus_ranked_party_private.signature_v245(p_user uuid,p_gladiator uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5((to_jsonb(g)||jsonb_build_object('equipment',coalesce((
  select jsonb_agg(to_jsonb(i) order by i.id) from public.ludus_items i
  where i.owner_id=p_user and i.equipped_by=g.id
 ),'[]'::jsonb)))::text)
 from public.ludus_gladiators g
 where g.id=p_gladiator and g.owner_id=p_user and g.status='available' and g.fatigue_value<100
  and g.clan_roster_id is null and (g.injured_until is null or g.injured_until<=clock_timestamp())
  and (g.training_ends_at is null or g.training_ends_at<=clock_timestamp());
$$;
revoke all on function ludus_ranked_party_private.signature_v245(uuid,uuid) from public,anon,authenticated;

alter function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) rename to handle_core_v245;
revoke all on function ludus_ranked_party_private.handle_core_v245(text,uuid,uuid,uuid) from public,anon,authenticated;

create function ludus_ranked_party_private.handle_v244(p_action text,p_peer uuid,p_gladiator uuid,p_invite uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); mine uuid; selected uuid; sig text; result jsonb; decorated jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Giriş yapmalısın.';end if;
 -- The V244 handler takes this user lock before taking a room lock.
 if p_action in ('create','accept','leave') then perform pg_advisory_xact_lock(hashtextextended(u::text,244));end if;
 select room_id into mine from ludus_ranked_party_private.members_v244 where user_id=u;
 -- Serialize readiness and roster changes with the room. The original handler also
 -- locks this same row on invitations and membership changes.
 if p_action='accept' and mine is null then
  select room_id into mine from ludus_ranked_party_private.invites_v244 where id=p_invite and target_id=u and state='pending';
 end if;
 if mine is not null and p_action in ('ready','unready','select','leave','remove','invite','accept') then
  perform 1 from ludus_ranked_party_private.rooms_v244 where id=mine for update;
 end if;
 if p_action in ('ready','unready') then
  select gladiator_id into selected from ludus_ranked_party_private.members_v244 where user_id=u and room_id=mine for update;
  if selected is null then raise exception 'Önce bir takıma katıl.';end if;
  if p_action='ready' then
   sig:=ludus_ranked_party_private.signature_v245(u,selected);
   if sig is null then raise exception 'Gladyatörün artık hazır değil. Başka bir gladyatör seç.';end if;
   update ludus_ranked_party_private.members_v244 set ready_signature=sig where user_id=u and room_id=mine;
  else
   update ludus_ranked_party_private.members_v244 set ready_signature=null where user_id=u and room_id=mine;
  end if;
  result:=ludus_ranked_party_private.handle_core_v245('state',null,null,null);
 else
  result:=ludus_ranked_party_private.handle_core_v245(p_action,p_peer,p_gladiator,p_invite);
  if p_action='select' then
   update ludus_ranked_party_private.members_v244 set ready_signature=null where user_id=u;
  end if;
 end if;
 if result->'party' is not null and result->'party'<>'null'::jsonb then
  select coalesce(jsonb_agg(entry.value||jsonb_build_object('ready',coalesce(m.ready_signature is not null
    and m.ready_signature=ludus_ranked_party_private.signature_v245(m.user_id,m.gladiator_id),false)) order by entry.ordinality),'[]'::jsonb)
   into decorated from jsonb_array_elements(result->'party'->'members') with ordinality entry(value,ordinality)
   join ludus_ranked_party_private.members_v244 m on m.user_id=(entry.value->>'user_id')::uuid;
  result:=jsonb_set(result,'{party,members}',decorated);
 end if;
 return result;
end;$$;
revoke all on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) from public,anon;
grant execute on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
