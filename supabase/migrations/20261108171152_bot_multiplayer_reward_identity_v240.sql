-- Level EXP validates auth.uid(); settle the validated winner as that owner,
-- and restore the real caller on both success and failure.
create or replace function ludus_bot_private.online_reward_v239(p_match uuid) returns void
language plpgsql security definer set search_path='' as $$
declare m public.ludus_matches; room ludus_bot_private.online_rooms_v237; stone jsonb; xp integer; prize jsonb;
 original_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),'');
begin
 select * into m from public.ludus_matches where id=p_match for update;
 select * into room from ludus_bot_private.online_rooms_v237 where match_id=p_match;
 if m.id is null or room.match_id is null or m.status<>'finished' or m.venue<>'colosseum' or m.winner is null then return;end if;
 insert into ludus_bot_private.online_rewards_v239(match_id,winner_id) values(m.id,m.winner)
 on conflict(match_id) do nothing;
 if not found then return;end if;
 if m.starts_at is null or room.finished_at is null or room.finished_at<m.starts_at+interval '10 seconds'
  or not exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=m.winner::text and coalesce((f->>'hp')::numeric,0)>0 and coalesce((f->>'left')::boolean,false)=false)
  or not exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'<>m.winner::text and coalesce((f->>'hp')::numeric,0)<=0 and coalesce((f->>'left')::boolean,false)=false)
  or not exists(select 1 from jsonb_array_elements(m.players) f where (f->>'owner')::uuid=any(room.bot_users)) then return;end if;
 update public.ludus_accounts set gold=gold+100,diamonds=diamonds+1,wins=wins+1 where user_id=m.winner;
 if not found then raise exception 'Kazanan hesap bulunamadı.';end if;
 perform set_config('request.jwt.claim.sub',m.winner::text,true);
 stone:=ludus_private.win_stone_v10(m.winner);
 xp:=ludus_private.level_grant(m.winner,'battle','bot-multiplayer:'||m.id::text,100,clock_timestamp());
 perform set_config('request.jwt.claim.sub',original_sub,true);
 prize:=jsonb_build_object('gold',100,'diamonds',1,'stone',stone,'ludus_exp',xp);
 update ludus_bot_private.online_rewards_v239 set eligible=true,reward=prize where match_id=m.id;
exception when others then
 perform set_config('request.jwt.claim.sub',original_sub,true);
 raise;
end;$$;
revoke all on function ludus_bot_private.online_reward_v239(uuid) from public,anon,authenticated;
