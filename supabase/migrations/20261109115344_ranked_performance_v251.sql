-- Advance the shared combat world once per real player's request. Each bot
-- still sends its own authoritative input, but must not recalculate the whole
-- ten-fighter world again inside the same bot batch.
do $patch$
declare
 src text:=pg_get_functiondef('ludus_ranked_match_private.match_step(text,uuid,uuid,jsonb,jsonb)'::regprocedure);
 needle text:=$old$ if r.status='playing' then r.players:=private.ludus_advance_combat_v36(r.players,ts);if r.venue='pit' then r.players:=ludus_pit_private.bounds(r.players);end if;r.players:=ludus_ranked_match_private.resolve_combat_v248(r.players,ts);r.players:=ludus_ranked_match_private.projectiles_v248(r.players,ts); end if;$old$;
 replacement text:=$new$ if r.status='playing' and not exists(select 1 from ludus_bot_private.ranked_sessions_v249 s where s.match_id=r.id and u=any(s.bot_users)) then
  r.players:=private.ludus_advance_combat_v36(r.players,ts);
  if r.venue='pit' then r.players:=ludus_pit_private.bounds(r.players);end if;
  r.players:=ludus_ranked_match_private.resolve_combat_v248(r.players,ts);
  r.players:=ludus_ranked_match_private.projectiles_v248(r.players,ts);
 end if;$new$;
begin
 if position(needle in src)=0 then raise exception 'Unexpected ranked match handler';end if;
 if length(src)-length(replace(src,needle,''))<>length(needle) then raise exception 'Ranked world advance is not unique';end if;
 execute replace(src,needle,replacement);
end $patch$;
