-- Bot fighters are match-local copies. Do not deduct exercise or alter injury
-- on their real gladiators; real players retain the existing training rules.
do $patch$
declare src text:=pg_get_functiondef('ludus_private.exercise_pvp_v46()'::regprocedure);
 needle text:=$old$  if x is null or x->'gladiator'->>'id' is null then continue;end if;$old$;
 injection text:=$new$  if v_source='match' and (
   (coalesce(x->>'bot_v249','false')='true' and exists(select 1 from ludus_bot_private.ranked_sessions_v249 s where s.match_id=new.id and (x->>'owner')::uuid=any(s.bot_users)))
   or (coalesce(x->>'bot_v237','false')='true' and exists(select 1 from ludus_bot_private.online_rooms_v237 s where s.match_id=new.id and (x->>'owner')::uuid=any(s.bot_users)))
  ) then continue;end if;
$new$;
begin
 if position(needle in src)=0 then raise exception 'Unexpected multiplayer exercise trigger';end if;
 if position('ranked_sessions_v249' in src)>0 then raise exception 'Bot exercise protection already installed';end if;
 execute replace(src,needle,needle||E'\n'||injection);
end $patch$;
