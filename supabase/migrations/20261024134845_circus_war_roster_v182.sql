-- Account-owned loadouts for the unranked, local seven-lap combat race.
-- No client-reported result, reward, persistent HP change or wallet write is accepted.
create or replace function ludus_circus_private.war_roster(p_gladiators uuid[],p_horses uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t timestamptz:=clock_timestamp();gs jsonb;hs jsonb;team_name text;gids uuid[];hids uuid[];
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 select ludus_name into team_name from public.ludus_accounts where user_id=u;
 if not found then raise exception 'Ludus hesabı gerekli.';end if;
 perform ludus_private.v7_settle(u);perform ludus_stable_private.settle(u,t);
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'class',g.class,'ready',
  (g.status='available' and g.fatigue_value<100 and coalesce(g.training_ends_at<=t,true) and coalesce(g.injured_until<=t,true) and g.clan_roster_id is null and to_jsonb(g)->>'market_listing_id' is null))order by g.created_at,g.id),'[]')into gs from public.ludus_gladiators g where g.owner_id=u;
 select coalesce(jsonb_agg(ludus_stable_private.card(h,t)||jsonb_build_object('eligible',ludus_circus_private.eligible(h,t))order by h.created_at,h.id),'[]')into hs from ludus_stable_private.horses h where h.owner_id=u;
 if p_gladiators is not null or p_horses is not null then
  if coalesce(cardinality(p_gladiators),0)<>2 or coalesce(cardinality(p_horses),0)<>2 or p_gladiators[1] is null or p_gladiators[2] is null or p_horses[1] is null or p_horses[2] is null or p_gladiators[1]=p_gladiators[2] or p_horses[1]=p_horses[2]then raise exception 'İki farklı gladyatör ve iki farklı at seç.';end if;
  select array_agg((x->>'id')::uuid)into gids from jsonb_array_elements(gs)x where(x->>'ready')::boolean;
  select array_agg((x->>'id')::uuid)into hids from jsonb_array_elements(hs)x where(x->>'eligible')::boolean;
  if not(p_gladiators<@coalesce(gids,'{}'::uuid[]))then raise exception 'Gladyatörlerin senin ludusundan ve müsabakaya hazır olmalı.';end if;
  if not(p_horses<@coalesce(hids,'{}'::uuid[]))then raise exception 'Atların senin ahırından, yetişkin, tok ve dinlenmiş olmalı.';end if;
 end if;
 return jsonb_build_object('user_id',u,'name',team_name,'roster',gs,'horses',hs,'gladiator_ids',p_gladiators,'horse_ids',p_horses,'laps',7,'server_now',t);
end $$;
revoke all on function ludus_circus_private.war_roster(uuid[],uuid[])from public,anon,authenticated;
grant execute on function ludus_circus_private.war_roster(uuid[],uuid[])to authenticated;
create or replace function public.ludus_circus_war_roster(p_gladiators uuid[] default null,p_horses uuid[] default null)
returns jsonb language sql security invoker set search_path='' as $$select ludus_circus_private.war_roster(p_gladiators,p_horses)$$;
revoke all on function public.ludus_circus_war_roster(uuid[],uuid[])from public,anon;
grant execute on function public.ludus_circus_war_roster(uuid[],uuid[])to authenticated;
