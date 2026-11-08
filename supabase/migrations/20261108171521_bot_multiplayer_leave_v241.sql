-- Keep a brief place for a human friend in Aventinus and remove the owner's
-- bots when the owner deliberately leaves a multiplayer room.
do $patch$
declare source text;needle text:='needed:=greatest(0,4-jsonb_array_length(room.players));';pos integer;
 replacement text:=$replace$needed:=greatest(0,(case when room.venue='pit' and room.starts_at>ts+interval '3 seconds' then 3 else 4 end)-jsonb_array_length(room.players));$replace$;
begin
 select pg_get_functiondef('ludus_bot_private.online_assist_v237(uuid,uuid)'::regprocedure) into source;
 pos:=position(needle in source);if pos=0 then raise exception 'Unexpected bot multiplayer function.';end if;
 source:=overlay(source placing replacement from pos for length(needle));execute source;
end;$patch$;

create function ludus_bot_private.online_leave_v241(p_match uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare room public.ludus_matches; session_row ludus_bot_private.online_rooms_v237; remaining integer;winner_id uuid;ts timestamptz:=clock_timestamp();
begin
 if p_user is distinct from auth.uid() or p_user is distinct from (select owner_id from ludus_bot_private.settings_v233 where id) then return;end if;
 select * into session_row from ludus_bot_private.online_rooms_v237 where match_id=p_match and owner_id=p_user;
 if not found then return;end if;
 select * into room from public.ludus_matches where id=p_match for update;
 if not found or room.status not in('waiting','playing') then return;end if;
 if room.status='waiting' then
  select coalesce(jsonb_agg(p order by ord),'[]'::jsonb) into room.players
  from jsonb_array_elements(room.players) with ordinality x(p,ord) where not ((p->>'owner')::uuid=any(session_row.bot_users));
  update public.ludus_matches set players=room.players,status=case when jsonb_array_length(room.players)=0 then 'finished' else 'waiting' end,updated_at=ts where id=p_match;
 else
  select coalesce(jsonb_agg(case when (p->>'owner')::uuid=any(session_row.bot_users) then p||'{"hp":0,"move":0,"block":false,"left":true}'::jsonb else p end order by ord),'[]'::jsonb)
  into room.players from jsonb_array_elements(room.players) with ordinality x(p,ord);
  select count(*),min(p->>'owner')::uuid into remaining,winner_id from jsonb_array_elements(room.players) p where coalesce((p->>'hp')::numeric,0)>0;
  update public.ludus_matches set players=room.players,status=case when remaining<=1 then 'finished' else 'playing' end,
   winner=case when remaining<=1 then winner_id else null end,updated_at=ts where id=p_match;
 end if;
end;$$;
revoke all on function ludus_bot_private.online_leave_v241(uuid,uuid) from public,anon,authenticated;

do $patch$
declare source text;needle text:='return jsonb_build_object(''id'',r.id,''venue'',r.venue';pos integer;
 injection text:=$inject$
 if u=(select owner_id from ludus_bot_private.settings_v233 where id) and p_action='leave' then
  begin
   perform ludus_bot_private.online_leave_v241(r.id,u);
   select * into r from public.ludus_matches where id=r.id;
   ts:=clock_timestamp();
  exception when others then null;
  end;
 end if;
 $inject$;
begin
 select pg_get_functiondef('public.ludus_match(text,uuid,uuid,jsonb,jsonb)'::regprocedure) into source;
 if position('online_leave_v241' in source)>0 then raise exception 'Bot leave handling is already installed.';end if;
 pos:=position(needle in source);if pos=0 then raise exception 'Unexpected multiplayer function.';end if;
 source:=overlay(source placing injection||needle from pos for length(needle));execute source;
end;$patch$;
notify pgrst,'reload schema';
