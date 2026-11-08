-- Extend the owner-only dashboard with actual online matches and caravan work.
do $patch$
declare source text;needle text:=$needle$'experience',coalesce(p.experience,0),$needle$;pos integer;
 replacement text:=$replace$'experience',coalesce(p.experience,0),
  'online_matches',(select count(*) from ludus_bot_private.online_rooms_v237 o join public.ludus_matches m on m.id=o.match_id
   where b.user_id=any(o.bot_users) and m.status='finished'),
  'matches',coalesce((e.value->>'matches')::integer,0)+(select count(*) from ludus_bot_private.online_rooms_v237 o join public.ludus_matches m on m.id=o.match_id
   where b.user_id=any(o.bot_users) and m.status='finished'),
  'production_action',(select l.last_action from ludus_bot_private.production_log_v238 l where l.slot=b.slot),
  'production_error',(select l.last_error from ludus_bot_private.production_log_v238 l where l.slot=b.slot),
  'caravan',(select jsonb_build_object('arrives_at',j.ends_at,'cargo',j.cargo) from ludus_supply_private.jobs j
   where j.owner_id=b.user_id and j.claimed_at is null order by j.ends_at,j.id limit 1),$replace$;
begin
 select pg_get_functiondef('ludus_bot_private.dashboard_v235()'::regprocedure) into source;
 if position('production_action' in source)>0 then raise exception 'Bot production dashboard is already installed.';end if;
 pos:=position(needle in source);if pos=0 then raise exception 'Unexpected bot dashboard function.';end if;
 source:=overlay(source placing replacement from pos for length(needle));execute source;
end;$patch$;
