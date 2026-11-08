-- A completed, real bot-assisted Colosseum match pays the same small win
-- reward to a human or bot. The receipt prevents duplicate settlement.
alter table ludus_bot_private.online_rooms_v237 add column finished_at timestamptz;
create table ludus_bot_private.online_rewards_v239(
 match_id uuid primary key references public.ludus_matches(id) on delete cascade,
 winner_id uuid not null references public.ludus_accounts(user_id),
 eligible boolean not null default false,
 reward jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default clock_timestamp()
);
alter table ludus_bot_private.online_rewards_v239 enable row level security;
revoke all on ludus_bot_private.online_rewards_v239 from public,anon,authenticated;

create function ludus_bot_private.online_record_end_v239() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status='playing' and new.status='finished' then
  update ludus_bot_private.online_rooms_v237 set finished_at=coalesce(finished_at,new.updated_at) where match_id=new.id;
 end if;
 return new;
end;$$;
revoke all on function ludus_bot_private.online_record_end_v239() from public,anon,authenticated;
create trigger bot_online_end_v239 after update of status on public.ludus_matches
for each row execute function ludus_bot_private.online_record_end_v239();

create function ludus_bot_private.online_reward_v239(p_match uuid) returns void
language plpgsql security definer set search_path='' as $$
declare m public.ludus_matches; room ludus_bot_private.online_rooms_v237; stone jsonb; xp integer; prize jsonb;
begin
 select * into m from public.ludus_matches where id=p_match for update;
 select * into room from ludus_bot_private.online_rooms_v237 where match_id=p_match;
 if m.id is null or room.match_id is null or m.status<>'finished' or m.venue<>'colosseum' or m.winner is null then return;end if;
 insert into ludus_bot_private.online_rewards_v239(match_id,winner_id) values(m.id,m.winner)
 on conflict(match_id) do nothing;
 if not found then return;end if;
 -- Record rejected results too, so a retry cannot make an early or forfeited
 -- match eligible merely by waiting and polling again.
 if m.starts_at is null or room.finished_at is null or room.finished_at<m.starts_at+interval '10 seconds'
  or not exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=m.winner::text and coalesce((f->>'hp')::numeric,0)>0 and coalesce((f->>'left')::boolean,false)=false)
  or not exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'<>m.winner::text and coalesce((f->>'hp')::numeric,0)<=0 and coalesce((f->>'left')::boolean,false)=false)
  or not exists(select 1 from jsonb_array_elements(m.players) f where (f->>'owner')::uuid=any(room.bot_users)) then return;end if;
 update public.ludus_accounts set gold=gold+100,diamonds=diamonds+1,wins=wins+1 where user_id=m.winner;
 if not found then raise exception 'Kazanan hesap bulunamadı.';end if;
 stone:=ludus_private.win_stone_v10(m.winner);
 xp:=ludus_private.level_grant(m.winner,'battle','bot-multiplayer:'||m.id::text,100,clock_timestamp());
 prize:=jsonb_build_object('gold',100,'diamonds',1,'stone',stone,'ludus_exp',xp);
 update ludus_bot_private.online_rewards_v239 set eligible=true,reward=prize where match_id=m.id;
end;$$;
revoke all on function ludus_bot_private.online_reward_v239(uuid) from public,anon,authenticated;

do $patch$
declare source text;needle text;replacement text;pos integer;
begin
 select pg_get_functiondef('public.ludus_match(text,uuid,uuid,jsonb,jsonb)'::regprocedure) into source;
 if position('online_reward_v239' in source)>0 then raise exception 'Bot multiplayer reward is already installed.';end if;
 needle:='return jsonb_build_object(''id'',r.id,''venue'',r.venue';pos:=position(needle in source);
 if pos=0 then raise exception 'Unexpected multiplayer function; rewards were not installed.';end if;
 replacement:=$inject$
 if u=(select owner_id from ludus_bot_private.settings_v233 where id) and p_action in('join','state','step') and r.status='finished' then
  begin perform ludus_bot_private.online_reward_v239(r.id);exception when others then null;end;
 end if;
 $inject$||needle;
 source:=overlay(source placing replacement from pos for length(needle));
 needle:=$needle$'stats_version',coalesce((r.players->0->>'stats_version')::int,0));$needle$;
 replacement:=$replace$'stats_version',coalesce((r.players->0->>'stats_version')::int,0))||jsonb_build_object(
  'bot_match',exists(select 1 from ludus_bot_private.online_rooms_v237 o where o.match_id=r.id),
  'bot_reward',(select reward from ludus_bot_private.online_rewards_v239 w where w.match_id=r.id and w.winner_id=u and w.eligible));$replace$;
 pos:=position(needle in source);if pos=0 then raise exception 'Unexpected multiplayer response; rewards were not installed.';end if;
 source:=overlay(source placing replacement from pos for length(needle));execute source;
end;$patch$;
notify pgrst,'reload schema';
