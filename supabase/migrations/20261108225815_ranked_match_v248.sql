-- Ranked 5v5: server-authoritative party matching, team combat and rating.
-- A separate game RPC protects ranked rooms from the free-for-all handler.
alter table public.ludus_matches drop constraint if exists ludus_matches_venue_check;
alter table public.ludus_matches add constraint ludus_matches_venue_check check(venue in ('colosseum','pit','ranked'));
create schema if not exists ludus_ranked_match_private;
revoke all on schema ludus_ranked_match_private from public,anon,authenticated;
grant usage on schema ludus_ranked_match_private to authenticated,service_role;


create or replace function ludus_ranked_match_private.partition(p_sizes int[]) returns jsonb
language plpgsql immutable set search_path='' as $$
declare answer jsonb;
begin
 if p_sizes is null or coalesce(array_length(p_sizes,1),0)>20 or exists(select 1 from unnest(p_sizes) n where n is null or n<1 or n>5) then
  raise exception 'Invalid party sizes';
 end if;
 with recursive subsets(ids,total,lastidx) as (
  select array[]::int[],0,0
  union all
  select s.ids||i,s.total+p_sizes[i],i
  from subsets s cross join lateral generate_series(s.lastidx+1,coalesce(array_length(p_sizes,1),0)) i
  where s.total+p_sizes[i]<=5
 ), sides as (select ids from subsets where total=5)
 select jsonb_build_object('a',a.ids,'b',b.ids) into answer
 from sides a join lateral (select ids from sides b where not (a.ids && b.ids) order by ids limit 1) b on true
 order by least(a.ids[1],b.ids[1]),a.ids,b.ids limit 1;
 return answer;
end $$;

create table ludus_ranked_match_private.queue(room_id uuid primary key references ludus_ranked_party_private.rooms_v244(id) on delete cascade, queued_at timestamptz not null default clock_timestamp(), match_id uuid);
create table ludus_ranked_match_private.matches(id uuid primary key default gen_random_uuid(),team_a uuid[] not null,team_b uuid[] not null,created_at timestamptz not null default clock_timestamp());
revoke all on ludus_ranked_match_private.queue,ludus_ranked_match_private.matches from public,anon,authenticated;
create function ludus_ranked_match_private.match_waiting() returns void language plpgsql security definer set search_path='' as $$
declare r record;rooms uuid[];sizes int[];choice jsonb;a_rooms uuid[];b_rooms uuid[];a_users uuid[];b_users uuid[];v_match_id uuid;
begin
 -- Stale or changed parties stop waiting; no one is silently moved to a match.
 delete from ludus_ranked_match_private.queue q where q.match_id is null and exists(
  select 1 from ludus_ranked_party_private.members_v244 m left join public.ludus_presence p on p.user_id=m.user_id
   where m.room_id=q.room_id and (p.last_seen is null or p.last_seen<clock_timestamp()-interval '75 seconds'
    or m.ready_signature is null or m.ready_signature is distinct from ludus_ranked_party_private.signature_v246(m.user_id,m.gladiator_id)));
 select array_agg(room_id order by queued_at,room_id),array_agg(size order by queued_at,room_id) into rooms,sizes
 from (select room_id,queued_at,size from (
        select counted.*,row_number() over(partition by size order by queued_at,room_id) pos from (
         select q.room_id,q.queued_at,count(m.user_id)::int size from ludus_ranked_match_private.queue q
         join ludus_ranked_party_private.members_v244 m on m.room_id=q.room_id where q.match_id is null
         group by q.room_id,q.queued_at
        ) counted
       ) ordered where pos<=case size when 1 then 10 when 2 then 4 else 2 end) candidates;
 choice:=ludus_ranked_match_private.partition(sizes);
 if choice is null then return;end if;
 select array_agg(rooms[(v#>>'{}')::int]) into a_rooms from jsonb_array_elements(choice->'a') v;
 select array_agg(rooms[(v#>>'{}')::int]) into b_rooms from jsonb_array_elements(choice->'b') v;
 select array_agg(m.user_id order by array_position(a_rooms,m.room_id),m.joined_at,m.user_id) into a_users
  from ludus_ranked_party_private.members_v244 m where m.room_id=any(a_rooms);
 select array_agg(m.user_id order by array_position(b_rooms,m.room_id),m.joined_at,m.user_id) into b_users
  from ludus_ranked_party_private.members_v244 m where m.room_id=any(b_rooms);
 if cardinality(a_users)<>5 or cardinality(b_users)<>5 or a_users && b_users then raise exception 'Invalid match composition';end if;
 v_match_id:=ludus_ranked_match_private.create_live_match(a_users,b_users);
 insert into ludus_ranked_match_private.matches(id,team_a,team_b) values(v_match_id,a_users,b_users);
 update ludus_ranked_match_private.queue set match_id=v_match_id where room_id=any(a_rooms||b_rooms);
end $$;
create function ludus_ranked_match_private.queue_action(p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r ludus_ranked_party_private.rooms_v244; m uuid; q ludus_ranked_match_private.queue; count_members int; count_ready int;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Giriş yapmalısın.';end if;
 select room_id into m from ludus_ranked_party_private.members_v244 where user_id=u;
 if m is null then raise exception 'Önce takıma katıl.';end if;
 if p_action='state' then
  select * into q from ludus_ranked_match_private.queue where room_id=m;
  if q.room_id is not null and q.match_id is null and exists(select 1 from ludus_ranked_party_private.members_v244 z left join public.ludus_presence p on p.user_id=z.user_id
   where z.room_id=m and (p.last_seen is null or p.last_seen<clock_timestamp()-interval '75 seconds' or z.ready_signature is null
    or z.ready_signature is distinct from ludus_ranked_party_private.signature_v246(z.user_id,z.gladiator_id))) then
   perform pg_advisory_xact_lock(hashtextextended('ranked-queue',248));
   select * into q from ludus_ranked_match_private.queue where room_id=m;
   if q.room_id is not null and q.match_id is null then
    update ludus_ranked_party_private.members_v244 z set ready_signature=null where z.room_id=m and
     (z.ready_signature is distinct from ludus_ranked_party_private.signature_v246(z.user_id,z.gladiator_id)
      or not exists(select 1 from public.ludus_presence p where p.user_id=z.user_id and p.last_seen>clock_timestamp()-interval '75 seconds'));
    delete from ludus_ranked_match_private.queue where room_id=m and match_id is null;
    q:=null;
   end if;
  end if;
  return jsonb_build_object('status',case when q.room_id is null then 'idle' when q.match_id is null then 'waiting' else 'matched' end,'match_id',q.match_id);
 end if;
 if p_action not in ('start','cancel') then raise exception 'Geçersiz işlem.';end if;
 perform pg_advisory_xact_lock(hashtextextended('ranked-queue',248));
 select * into r from ludus_ranked_party_private.rooms_v244 where id=m for update;
 if r.id is null then raise exception 'Önce takıma katıl.';end if;
 if r.leader_id<>u then raise exception 'Yalnızca grup lideri başlatabilir.';end if;
 select * into q from ludus_ranked_match_private.queue where room_id=m;
 if p_action='start' then
  if q.match_id is not null then return jsonb_build_object('status','matched','match_id',q.match_id);end if;
  select count(*),count(*) filter(where p.last_seen>clock_timestamp()-interval '75 seconds' and z.ready_signature is not null
     and z.ready_signature=ludus_ranked_party_private.signature_v246(z.user_id,z.gladiator_id)) into count_members,count_ready
    from ludus_ranked_party_private.members_v244 z left join public.ludus_presence p on p.user_id=z.user_id where z.room_id=m;
  if count_members<1 or count_members>5 or count_ready<>count_members then raise exception 'Tüm oyuncular çevrimiçi ve READY olmalı.';end if;
  update ludus_ranked_party_private.invites_v244 set state='cancelled' where room_id=m and state='pending';
  insert into ludus_ranked_match_private.queue(room_id) values(m) on conflict do nothing;
  perform ludus_ranked_match_private.match_waiting();
 else
  if q.match_id is not null then raise exception 'Eşleşme bulundu; bekleme iptal edilemez.';end if;
  delete from ludus_ranked_match_private.queue where room_id=m;
 end if;
 select * into q from ludus_ranked_match_private.queue where room_id=m;
 return jsonb_build_object('status',case when q.room_id is null then 'idle' when q.match_id is null then 'waiting' else 'matched' end,'match_id',q.match_id);
end $$;
revoke all on function ludus_ranked_match_private.queue_action(text),ludus_ranked_match_private.match_waiting() from public,anon,authenticated;

grant execute on function ludus_ranked_match_private.queue_action(text) to authenticated;
create function ludus_ranked_match_private.party_action(p_action text,p_peer uuid default null,p_gladiator uuid default null,p_invite uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();mine uuid;target_room uuid;v_match uuid;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Giriş yapmalısın.';end if;
 if p_action in ('create','accept','invite','remove','leave','select','ready','unready') then
  perform pg_advisory_xact_lock(hashtextextended('ranked-queue',248));
  select room_id into mine from ludus_ranked_party_private.members_v244 where user_id=u;
  if p_action='accept' then select room_id into target_room from ludus_ranked_party_private.invites_v244 where id=p_invite and target_id=u;end if;
  select match_id into v_match from ludus_ranked_match_private.queue where room_id in (mine,target_room) and match_id is not null limit 1;
  if v_match is not null then raise exception 'Maç sırasında takım değiştirilemez.';end if;
  delete from ludus_ranked_match_private.queue where room_id in (mine,target_room) and match_id is null;
 end if;
 return ludus_ranked_party_private.handle_ready_v246(p_action,p_peer,p_gladiator,p_invite);
end $$;
revoke all on function ludus_ranked_match_private.party_action(text,uuid,uuid,uuid) from public,anon;
grant execute on function ludus_ranked_match_private.party_action(text,uuid,uuid,uuid) to authenticated;


create function ludus_ranked_match_private.create_live_match(p_a uuid[],p_b uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid;g public.ludus_gladiators;member ludus_ranked_party_private.members_v244;items jsonb;fighter jsonb;stats jsonb;players jsonb:='[]'::jsonb;mid uuid;ts timestamptz:=clock_timestamp();team text;
begin
 if cardinality(p_a)<>5 or cardinality(p_b)<>5 or p_a&&p_b or (select count(distinct x) from unnest(p_a||p_b)x)<>10 then raise exception 'Geçersiz eşleşme kadrosu.';end if;
 -- Use the same account-first locking order as equipment and game operations.
 perform 1 from public.ludus_accounts a where a.user_id=any(p_a||p_b) order by a.user_id for update;
 perform 1 from public.ludus_gladiators gg join ludus_ranked_party_private.members_v244 m on m.gladiator_id=gg.id
  where m.user_id=any(p_a||p_b) order by gg.owner_id,gg.id for update of gg;
 perform 1 from public.ludus_items i where i.owner_id=any(p_a||p_b) and i.equipped_by is not null order by i.owner_id,i.id for update;
 foreach uid in array p_a||p_b loop
  select * into member from ludus_ranked_party_private.members_v244 where user_id=uid;
  if not found or member.ready_signature is null or member.ready_signature is distinct from ludus_ranked_party_private.signature_v246(uid,member.gladiator_id)
   or not exists(select 1 from public.ludus_presence where user_id=uid and last_seen>ts-interval '75 seconds') then raise exception 'Takım hazırlanırken bir oyuncu artık hazır değil.';end if;
  select * into g from public.ludus_gladiators where id=member.gladiator_id and owner_id=uid;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.equipped_slot,i.id),'[]'::jsonb) into items from public.ludus_items i where i.owner_id=uid and i.equipped_by=g.id;
  if exists(select 1 from jsonb_array_elements(items) i where i->>'equipped_slot' not in ('main_hand','off_hand','helmet','chest','gloves','legs')
   or not ((i->>'equipped_slot'='main_hand' and i->>'kind'='weapon') or (i->>'equipped_slot'='off_hand' and i->>'kind' in ('weapon','shield')) or (i->>'equipped_slot' in ('helmet','chest','gloves','legs') and i->>'equipped_slot'=i->>'kind')))
   or jsonb_array_length(items)<>(select count(distinct i->>'equipped_slot') from jsonb_array_elements(items) i) then raise exception 'Ekipman yuvaları doğrulanamadı.';end if;
  team:=case when uid=any(p_a) then 'a' else 'b' end;
  fighter:=jsonb_build_object('owner',uid,'ranked_team',team,'ranked_joined',false,'ranked_signature',member.ready_signature,'name',g.name,'class',g.class,'gladiator',to_jsonb(g)||ludus_food_private.combat_snapshot_v77(uid),'items',items,
   'career',jsonb_build_object('version',162,'assist_version',200,'kills',0,'deaths',0,'damage',0,'damageTaken',0,'contributors','{}'::jsonb),
   'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'maxStamina',100,'stamina',100,'stamina_at',ts,'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0);
  stats:=private.ludus_combat_stats_v73(fighter->'gladiator',items);
  fighter:=fighter||jsonb_build_object('stats_version',77,'combat_stats',stats,'hp',(stats->>'maxHp')::numeric::int,'maxHp',(stats->>'maxHp')::numeric::int,'stamina',(stats->>'maxStamina')::numeric::int,'maxStamina',(stats->>'maxStamina')::numeric::int);
  players:=players||jsonb_build_array(fighter);
 end loop;
 insert into public.ludus_matches(venue,pit_version,players,starts_at,updated_at) values('ranked',0,players,ts+interval '120 seconds',ts) returning id into mid;
 return mid;
end $$;
revoke all on function ludus_ranked_match_private.create_live_match(uuid[],uuid[]) from public,anon,authenticated;

create function ludus_ranked_match_private.signature_in_match(p_user uuid,p_gladiator uuid,p_ignore uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5((to_jsonb(g)||jsonb_build_object('equipment',coalesce((
  select jsonb_agg(to_jsonb(i) order by i.id) from public.ludus_items i
  where i.owner_id=p_user and i.equipped_by=g.id
 ),'[]'::jsonb)))::text)
 from public.ludus_gladiators g
 where g.id=p_gladiator and g.owner_id=p_user and g.status='available' and g.fatigue_value<100
  and g.clan_roster_id is null and g.market_listing_id is null
  and (g.injured_until is null or g.injured_until<=clock_timestamp())
  and (g.training_ends_at is null or g.training_ends_at<=clock_timestamp())
  and not exists(select 1 from public.ludus_battles b where b.gladiator_id=g.id and b.finished_at is null)
  and not exists(select 1 from public.ludus_imperial_members m where m.gladiator_id=g.id and m.active)
  and not exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters r on r.id=e.roster_id
    where e.gladiator_id=g.id and r.state in ('draft','locked'))
  and not exists(select 1 from public.ludus_matches m where m.id<>p_ignore and m.status in ('waiting','playing')
    and m.updated_at>clock_timestamp()-interval '30 seconds'
    and m.players @> jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
  and not exists(select 1 from public.ludus_duels d where d.status in ('waiting','playing')
    and d.updated_at>clock_timestamp()-interval '75 seconds' and g.id in (d.host_g,d.guest_g))
  and not exists(select 1 from public.ludus_items i where i.owner_id=p_user and i.equipped_by=g.id
    and (i.locked_battle_id is not null or i.clan_vault_id is not null or i.clan_roster_id is not null or i.market_listing_id is not null));
$$;
revoke all on function ludus_ranked_match_private.signature_in_match(uuid,uuid,uuid) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION ludus_ranked_match_private.resolve_combat_v248(p_players jsonb, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 players jsonb:=p_players; a jsonb; v jsonb; ai integer; vi integer; impact timestamptz;
 distance double precision; facing double precision; guard_facing double precision; reach double precision;
 perfect boolean; guarded boolean; amount integer; outcome text; weapon text; passive text; cost numeric; recoil float; hit jsonb; modern boolean;
begin
 -- Old, already due strikes resolve before accepting the next input. Defense cannot be backdated.
 for ai in select (ord-1)::int from jsonb_array_elements(p_players) with ordinality e(f,ord)
  where f->>'strike_at' is not null and (f->>'strike_at')::timestamptz<=p_now
  order by (f->>'strike_at')::timestamptz,ord loop
  a:=players->ai; impact:=(a->>'strike_at')::timestamptz;
  if impact is null or (a->>'hp')::int<=0 then continue; end if;
  a:=a||jsonb_build_object('strike_at',null,'strike_resolved',true); outcome:='miss';
  if coalesce((a->>'stagger_until')::timestamptz,'epoch')>impact or a->>'pull_from' is not null then
   players:=jsonb_set(players,array[ai::text],a); continue;
  end if;
  select (ord-1)::int into vi from jsonb_array_elements(players) with ordinality e(f,ord)
   where f->>'owner'=a->>'strike_target' and (f->>'hp')::int>0 and a->>'ranked_team' is not null and f->>'ranked_team' is not null and f->>'ranked_team'<>a->>'ranked_team';
  if found then
   v:=players->vi; weapon:=a->>'strike_weapon';
   reach:=case weapon when 'spear' then 2.50 when 'halberd' then 2.50 when 'trident_gladiator' then 2.50 when 'trident' then 2.50 when 'heavy_mace' then 1.95 when 'warhammer' then 1.95 when 'mace' then 1.95 when 'whip' then 1.90 when 'gladius' then 1.60 when 'sica' then 1.60 else 1.10 end;
   distance:=sqrt(power((a->>'x')::float-(v->>'x')::float,2)+power((a->>'z')::float-(v->>'z')::float,2));
   facing:=atan2((v->>'x')::float-(a->>'x')::float,(v->>'z')::float-(a->>'z')::float)-(a->>'angle')::float;
   facing:=abs(atan2(sin(facing),cos(facing)));
   if distance<=reach and facing<=1.05 and not private.ludus_evade_avoids_v163(v,impact,coalesce(a->>'strike_region','chest')) then
    guard_facing:=atan2((a->>'x')::float-(v->>'x')::float,(a->>'z')::float-(v->>'z')::float)-(v->>'angle')::float;
    guarded:=coalesce((v->>'stamina')::float,100)>0 and coalesce((v->>'block')::boolean,false) and abs(atan2(sin(guard_facing),cos(guard_facing)))<1.35
     and exists(select 1 from jsonb_array_elements(v->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='shield');
    perfect:=guarded and v->>'guard_at' is not null and extract(epoch from impact-(v->>'guard_at')::timestamptz) between 0 and .24;
    modern:=coalesce((v->>'stats_version')::int,0) in (73,74,75,76,77);
    cost:=case when perfect then 6 else 20 end; passive:='none';
    if modern and guarded and coalesce((v->>'stamina')::numeric,100)<cost then
     guarded:=false;perfect:=false;v:=v||jsonb_build_object('stamina',0,'block',false,'guard_at',null);
    end if;
    if modern and not guarded then
     passive:=private.ludus_passive_defense_v73(v,impact,abs(atan2(sin(guard_facing),cos(guard_facing)))<1.1,random()::numeric,random()::numeric,random()::numeric);
     if passive='autoblock' then guarded:=true;perfect:=false;cost:=20;end if;
    end if;
    if passive='evade' then
     outcome:='evade';
     v:=v||jsonb_build_object('defense_serial',coalesce((v->>'defense_serial')::int,0)+1,'last_defense','evade','defense_from',a->>'owner','defense_at',p_now);
    elsif guarded or passive='parry' then
     outcome:=case when perfect then 'perfect' when passive='parry' then 'parry' else 'block' end;
     if modern then
      cost:=case when passive='parry' then 6 else cost*(1-least(.4,greatest(0,coalesce((v->'combat_stats'->'items'->>'block_power')::numeric,0)/100))) end;
      v:=v||jsonb_build_object('stamina',greatest(0,coalesce((v->>'stamina')::numeric,100)-cost),'stamina_regen_at',p_now+interval '900 milliseconds');
     end if;
     recoil:=case when perfect then .62/(1+greatest(0,least(.3,coalesce((a->'combat_stats'->'items'->>'recovery_speed')::float,0)/100))) else .23 end;
     if not perfect and coalesce((a->>'stats_version')::int,0)>=75 then recoil:=recoil/(1+greatest(0,least(.3,coalesce((a->'combat_stats'->'items'->>'recovery_speed')::float,0)/100)));end if;
     a:=a||jsonb_build_object('recoil_at',p_now,'recoil_elapsed',greatest(0,extract(epoch from impact-(a->>'swing_at')::timestamptz)),
      'recoil_until',p_now+recoil*interval '1 second',
      'cooldown_until',p_now+recoil*interval '1 second',
      'stagger_until',case when perfect then p_now+recoil*interval '1 second' else null end,'swing_end',p_now);
     v:=v||jsonb_build_object('defense_serial',coalesce((v->>'defense_serial')::int,0)+1,'last_defense',outcome,'defense_from',a->>'owner','defense_at',p_now);
     if guarded and passive<>'parry' then v:=private.ludus_shield_impact_v168(v,weapon);end if;
     if perfect then v:=v||jsonb_build_object('guard_at',null,'counter_until',p_now+interval '700 milliseconds','counter_target',a->>'owner'); end if;
    else
     amount:=case when coalesce((a->>'strike_counter')::boolean,false) then 17 else 14 end;
     outcome:=case when amount=17 then 'counter' else 'hit' end;
     if coalesce((a->>'stats_version')::int,0) in (73,74,75,76,77) then
      hit:=private.ludus_hit_v73(a,v,weapon,coalesce(a->>'strike_hand','main_hand'),amount,random()::numeric,random()::numeric);
      amount:=(hit->>'damage')::int;
      if (hit->>'critical')::boolean then outcome:='critical';end if;
     end if;
     hit:=ludus_career_private.hit(a,v,amount);a:=hit->0;v:=hit->1;
     v:=v||jsonb_build_object('hp',greatest(0,(v->>'hp')::int-amount),'hit_serial',coalesce((v->>'hit_serial')::int,0)+1,'hit_from',a->>'owner','hit_time',p_now,'hit_impact_at',impact,'hit_region',coalesce(a->>'strike_region','chest'),'block',false,'guard_at',null);
     if weapon in('spear','trident','halberd','trident_gladiator') then
      recoil:=greatest(.28,coalesce((a->>'recover')::float,.48));
      a:=a||jsonb_build_object('recoil_at',p_now,'recoil_elapsed',greatest(0,extract(epoch from impact-(a->>'swing_at')::timestamptz)),'recoil_until',p_now+recoil*interval '1 second','swing_end',p_now,'cooldown_until',p_now+recoil*interval '1 second');
     end if;
    end if;
    players:=jsonb_set(players,array[vi::text],v);
   end if;
  end if;
  -- V114: a missed strike has to return to guard before another strike starts.
  if outcome in ('miss','evade') then
   a:=a||jsonb_build_object('recover',coalesce((a->>'recover')::numeric,0)+.14,
    'swing_end',coalesce((a->>'swing_end')::timestamptz,impact)+interval '140 milliseconds',
    'cooldown_until',coalesce((a->>'cooldown_until')::timestamptz,impact)+interval '140 milliseconds');
  end if;
  a:=a||jsonb_build_object('attack_result',outcome);players:=jsonb_set(players,array[ai::text],a);
 end loop;
 return players;
end; $function$
;
CREATE OR REPLACE FUNCTION ludus_ranked_match_private.projectiles_v248(p_players jsonb, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 players jsonb:=p_players; a jsonb; v jsonb; shot jsonb; candidate jsonb; hit jsonb; s jsonb;
 ai int; vi int; selected int; start_at timestamptz; finish_at timestamptz; impact timestamptz;
 ox float; oz float; dx float; dz float; from_d float; to_d float; along float; side2 float; contact float; best float;
 facing float; guarded boolean; passive text; outcome text; cost numeric;
begin
 -- Earlier releases must resolve first, regardless of player array order.
 for ai in select (ord-1)::int from jsonb_array_elements(p_players) with ordinality e(f,ord)
  order by (f->'projectile'->>'launch_at')::timestamptz nulls last,ord loop
  a:=players->ai;shot:=a->'projectile';
  if shot is null or shot='null'::jsonb or coalesce((shot->>'resolved')::boolean,false) then continue;end if;
  start_at:=(shot->>'launch_at')::timestamptz;
  if p_now<start_at then continue;end if;
  -- A throw interrupted before release drops harmlessly; released weapons remain in flight.
  if not coalesce((shot->>'launched')::boolean,false) and (coalesce((a->>'left')::boolean,false) or ((a->>'hp')::int<=0 and coalesce((a->>'hit_impact_at')::timestamptz,(a->>'hit_time')::timestamptz,p_now)<=start_at) or (a->>'pull_from' is not null and coalesce((a->>'pull_at')::timestamptz,p_now)<=start_at) or (coalesce((a->>'recoil_at')::timestamptz,p_now)<=start_at and coalesce((a->>'stagger_until')::timestamptz,'epoch')>start_at)) then
   shot:=shot||jsonb_build_object('resolved',true,'ended_at',p_now,'outcome','cancelled','x',shot->'origin_x','z',shot->'origin_z');
   players:=jsonb_set(players,array[ai::text],a||jsonb_build_object('projectile',shot));continue;
  end if;
  finish_at:=least(p_now,(shot->>'expires_at')::timestamptz);
  from_d:=greatest(0,extract(epoch from coalesce((shot->>'tick_at')::timestamptz,start_at)-start_at)*12);
  to_d:=greatest(0,extract(epoch from finish_at-start_at)*12);
  if to_d<=from_d then continue;end if;
  ox:=(shot->>'origin_x')::float;oz:=(shot->>'origin_z')::float;dx:=(shot->>'dx')::float;dz:=(shot->>'dz')::float;
  selected:=null;best:=to_d+1;
  for vi in 0..jsonb_array_length(players)-1 loop
   candidate:=players->vi;
   if vi=ai or (candidate->>'hp')::int<=0 or a->>'ranked_team' is null or candidate->>'ranked_team' is null or a->>'ranked_team'=candidate->>'ranked_team' then continue;end if;
   along:=((candidate->>'x')::float-ox)*dx+((candidate->>'z')::float-oz)*dz;
   side2:=greatest(0,power((candidate->>'x')::float-ox,2)+power((candidate->>'z')::float-oz,2)-along*along);
   if side2>.55*.55 then continue;end if;
   contact:=greatest(from_d,along-sqrt(.55*.55-side2));
   if along+sqrt(.55*.55-side2)<from_d or contact>to_d or contact>=best then continue;end if;
   impact:=start_at+contact/12*interval '1 second';
   if private.ludus_evade_avoids_v163(candidate,impact,'chest') then continue;end if;
   selected:=vi;best:=contact;
  end loop;
  outcome:='miss';
  if selected is not null then
   v:=players->selected;impact:=start_at+best/12*interval '1 second';s:=v->'combat_stats'->'items';
   facing:=atan2(-dx,-dz)-coalesce((v->>'angle')::float,0);facing:=abs(atan2(sin(facing),cos(facing)));
   guarded:=coalesce((v->>'block')::boolean,false) and facing<1.35 and coalesce((v->>'stamina')::float,0)>=20
    and exists(select 1 from jsonb_array_elements(v->'items') it where it->>'kind'='shield' and it->>'equipped_slot'='off_hand');
   passive:='none';
   if not guarded then passive:=private.ludus_passive_defense_v73(v,impact,facing<1.1,random()::numeric,random()::numeric,random()::numeric);end if;
   if passive='evade' then outcome:='evade';
   elsif guarded or passive in('autoblock','parry') then
    outcome:=case when passive='parry' then 'parry' else 'block' end;
    cost:=case when passive='parry' then 6 else 20*(1-least(.4,greatest(0,coalesce((s->>'block_power')::numeric,0)/100))) end;
    v:=v||jsonb_build_object('stamina',greatest(0,(v->>'stamina')::numeric-cost),'stamina_regen_at',p_now+interval '900 milliseconds');
   else
    hit:=private.ludus_hit_v73(shot->'attacker',v,shot->>'weapon',shot->>'hand',(shot->>'base')::numeric,random()::numeric,random()::numeric,true);
    outcome:=case when (hit->>'critical')::boolean then 'critical' else 'hit' end;
    s:=ludus_career_private.hit(a,v,(hit->>'damage')::numeric);a:=s->0;v:=s->1;
    v:=v||jsonb_build_object('hp',greatest(0,(v->>'hp')::int-(hit->>'damage')::int),'hit_serial',coalesce((v->>'hit_serial')::int,0)+1,'hit_from',a->>'owner','hit_time',p_now,'hit_impact_at',impact,'hit_region','chest','block',false,'guard_at',null);
   end if;
   if outcome in('block','parry','evade') then
    v:=v||jsonb_build_object('defense_serial',coalesce((v->>'defense_serial')::int,0)+1,'last_defense',outcome,'defense_from',a->>'owner','defense_at',p_now);
   end if;
   players:=jsonb_set(players,array[selected::text],v);
   shot:=shot||jsonb_build_object('resolved',true,'ended_at',impact,'outcome',outcome,'victim',v->>'owner','x',ox+dx*best,'z',oz+dz*best);
  elsif finish_at>=(shot->>'expires_at')::timestamptz then
   shot:=shot||jsonb_build_object('resolved',true,'ended_at',finish_at,'outcome','miss','x',ox+dx*to_d,'z',oz+dz*to_d);
  else shot:=shot||jsonb_build_object('x',ox+dx*to_d,'z',oz+dz*to_d);end if;
  shot:=shot||jsonb_build_object('launched',true,'tick_at',finish_at);
  players:=jsonb_set(players,array[ai::text],a||jsonb_build_object('projectile',shot));
 end loop;
 return players;
end;$function$
;

create table ludus_ranked_match_private.live_ratings(user_id uuid primary key,points integer not null default 1500);
create table ludus_ranked_match_private.live_results(match_id uuid not null,user_id uuid not null,gladiator_id uuid not null,outcome text not null,delta integer not null,kills integer,deaths integer,assists integer,primary key(match_id,user_id));
revoke all on ludus_ranked_match_private.live_ratings,ludus_ranked_match_private.live_results from public,anon,authenticated;
create function ludus_ranked_match_private.settle_match(p_match uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.ludus_matches;winning_team text;p jsonb;uid uuid;d int;kills int;deaths int;assists int;
begin
 select * into r from public.ludus_matches where id=p_match and venue='ranked' for update;
 if not found or r.status<>'finished' or r.winner is null then return;end if;
 if jsonb_array_length(r.players)<>10 or (select count(distinct f->>'owner') from jsonb_array_elements(r.players)f)<>10
  or (select count(*) from jsonb_array_elements(r.players)f where f->>'ranked_team'='a')<>5
  or (select count(*) from jsonb_array_elements(r.players)f where f->>'ranked_team'='b')<>5 then raise exception 'Ranked kadrosu doğrulanamadı.';end if;
 select f->>'ranked_team' into winning_team from jsonb_array_elements(r.players)f where f->>'owner'=r.winner::text;
 if winning_team is null then raise exception 'Kazanan takım doğrulanamadı.';end if;
 for p in select value from jsonb_array_elements(r.players) loop
  uid:=(p->>'owner')::uuid;d:=case when p->>'ranked_team'=winning_team then 10 else -5 end;
  kills:=case when p->'career'->>'version'='162' then coalesce((p->'career'->>'kills')::int,0) end;
  deaths:=case when coalesce((p->>'left')::boolean,false) then null when p->'career'->>'version'='162' then coalesce((p->'career'->>'deaths')::int,0) end;
  assists:=null;
  if p->'career'->>'assist_version'='200' then
   select count(*)::int into assists from jsonb_array_elements(r.players) victim
    where victim->'career'->>'killer' is not null and victim->'career'->>'killer'<>uid::text and victim->>'owner'<>uid::text
    and coalesce((victim->'career'->'contributors'->>uid::text)::numeric,0)>=greatest(1,coalesce((victim->>'maxHp')::numeric,100)*.1);
  end if;
  insert into ludus_ranked_match_private.live_results(match_id,user_id,gladiator_id,outcome,delta,kills,deaths,assists) values(r.id,uid,(p->'gladiator'->>'id')::uuid,case when d>0 then 'win' else 'loss' end,d,kills,deaths,assists) on conflict do nothing;
  if found then insert into ludus_ranked_match_private.live_ratings(user_id,points) values(uid,1500+d) on conflict(user_id) do update set points=ludus_ranked_match_private.live_ratings.points+excluded.points-1500;end if;
 end loop;
end $$;
revoke all on function ludus_ranked_match_private.settle_match(uuid) from public,anon,authenticated;
create function ludus_ranked_match_private.cleanup_match(p_match uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update ludus_ranked_party_private.members_v244 m set ready_signature=null
  where exists(select 1 from ludus_ranked_match_private.queue q where q.match_id=p_match and q.room_id=m.room_id);
 delete from ludus_ranked_match_private.queue where match_id=p_match;
end $$;
revoke all on function ludus_ranked_match_private.cleanup_match(uuid) from public,anon,authenticated;

create function ludus_ranked_match_private.board(p_query text default '',p_clan uuid default null,p_page integer default 0,p_page_size integer default 8) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();mine uuid;answer jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Sıralamalar için hesabına giriş yap.';end if;
 if length(coalesce(p_query,''))>80 then raise exception 'Arama çok uzun.';end if;
 p_query:=lower(trim(coalesce(p_query,'')));p_page:=greatest(0,coalesce(p_page,0));p_page_size:=greatest(1,least(12,coalesce(p_page_size,8)));
 select clan_id into mine from public.ludus_clan_members where user_id=u;
 with totals as (
  select user_id,count(*)::int matches,count(*) filter(where outcome='win')::int wins,count(*) filter(where outcome='loss')::int losses,
   case when count(kills)=count(*) then sum(kills) end kills,case when count(deaths)=count(*) then sum(deaths) end deaths,case when count(assists)=count(*) then sum(assists) end assists,
   sum(kills) filter(where kills is not null and deaths is not null) kd_kills,sum(deaths) filter(where kills is not null and deaths is not null) kd_deaths,
   sum(kills) filter(where kills is not null and deaths is not null and assists is not null) kda_kills,sum(deaths) filter(where kills is not null and deaths is not null and assists is not null) kda_deaths,
   sum(assists) filter(where kills is not null and deaths is not null and assists is not null) kda_assists,
   count(*) filter(where kills is not null and deaths is not null and assists is not null) tracked
   from ludus_ranked_match_private.live_results group by user_id
 ), candidates as (
  select a.user_id id,a.username name,a.ludus_name subtitle,c.id clan_id,c.name clan,c.emblem,c.emblem_color,c.background,
   coalesce(r.points,1500) score,a.user_id=u mine,
   jsonb_build_object('rating',coalesce(r.points,1500),'matches',coalesce(t.matches,0),'wins',coalesce(t.wins,0),'losses',coalesce(t.losses,0),
    'kills',t.kills,'deaths',t.deaths,'assists',t.assists,'kd_kills',t.kd_kills,'kd_deaths',t.kd_deaths,
    'kda_kills',t.kda_kills,'kda_deaths',t.kda_deaths,'kda_assists',t.kda_assists,'tracked',coalesce(t.tracked,0),'participants',coalesce(t.matches,0)) metrics
  from public.ludus_accounts a left join ludus_ranked_match_private.live_ratings r on r.user_id=a.user_id left join totals t on t.user_id=a.user_id
  left join public.ludus_clan_members cm on cm.user_id=a.user_id left join public.ludus_clans c on c.id=cm.clan_id
  where p_clan is null or c.id=p_clan
 ), ranked as materialized(select *,rank() over(order by score desc) rank from candidates),
 filtered as materialized(select * from ranked where p_query='' or strpos(lower(name),p_query)>0 or strpos(lower(subtitle),p_query)>0),
 total as(select count(*) n from filtered),paging as(select least(p_page,greatest(0,ceil(n::numeric/p_page_size)::int-1)) page from total),
 visible as(select * from filtered order by score desc,lower(name),id limit p_page_size offset (select page*p_page_size from paging))
 select jsonb_build_object('version',203,'scope','players','category','ranked','group','all','sort','score',
  'page',(select page from paging),'page_size',p_page_size,'total',(select n from total),
  'rows',coalesce((select jsonb_agg(to_jsonb(v) order by score desc,lower(name),id) from visible v),'[]'::jsonb),
  'own',(select to_jsonb(r) from ranked r where r.mine limit 1),'profile',null,
  'clans',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.ludus_clans),'[]'::jsonb),
  'my_clan',mine,'server_now',now(),'guild_matches',0,'defense_matches',0) into answer;
 return answer;
end $$;
revoke all on function ludus_ranked_match_private.board(text,uuid,integer,integer) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION ludus_ranked_match_private.match_step(p_action text, p_room uuid DEFAULT NULL::uuid, p_gladiator uuid DEFAULT NULL::uuid, p_slots jsonb DEFAULT '{}'::jsonb, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_venue text:=case when p_input->>'venue'='pit' then 'pit' else 'colosseum' end; u uuid:=auth.uid(); ts timestamptz:=clock_timestamp(); r public.ludus_matches; g public.ludus_gladiators;
 own jsonb; enemy jsonb; p jsonb; gear jsonb; arr jsonb; idx integer; target_idx integer; k integer; count_alive integer;
 mx double precision; mz double precision; dt double precision; len double precision; px double precision; pz double precision;
 dist double precision; best double precision; angle double precision; spawn double precision; radius double precision;
 wind double precision; active double precision; recover double precision; command_id text; wants_guard boolean; guard_eligible boolean; counter boolean; strike boolean; whip boolean; hp integer; last_hit timestamptz; win uuid; selected_weapon text; wanted text; dodge_command text; dodging boolean; dodge_eligible boolean; attack_region text; selected_hand text; stats jsonb; speed_factor float; turn float; wanted_angle float; throwing boolean; special_command text; thrown jsonb; throw_range float; attack_snapshot jsonb; evade_kind text; evade_cost int; evade_duration float;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Hesabına giriş yap.'; end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if p_action not in ('state','step','leave') then raise exception 'Geçersiz işlem.';end if;
 select m.* into r from public.ludus_matches m where m.id=p_room and m.venue='ranked'
  and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text) for update;
 if not found then raise exception 'Bu maça erişemezsin.';end if;
 if r.status='playing' and r.updated_at<clock_timestamp()-interval '30 seconds' then
  update public.ludus_matches set status='finished',winner=null,updated_at=clock_timestamp() where id=r.id;
  perform ludus_ranked_match_private.cleanup_match(r.id);
  return jsonb_build_object('id',r.id,'venue',r.venue,'status','finished','server_now',clock_timestamp(),'players',r.players,'winner',null);
 end if;
 ts:=clock_timestamp();
 if r.status='playing' then r.players:=private.ludus_advance_combat_v36(r.players,ts);if r.venue='pit' then r.players:=ludus_pit_private.bounds(r.players);end if;r.players:=ludus_ranked_match_private.resolve_combat_v248(r.players,ts);r.players:=ludus_ranked_match_private.projectiles_v248(r.players,ts); end if;
 select (ord-1)::int into idx from jsonb_array_elements(r.players) with ordinality as e(f,ord) where f->>'owner'=u::text;
 if p_action='leave' then
  if r.status='waiting' then r.status:='finished';r.winner:=null;
  elsif r.status='playing' then r.players:=jsonb_set(r.players,array[idx::text],(r.players->idx)||jsonb_build_object('hp',0,'move',0,'block',false,'left',true)); end if;
 elsif p_action in('join','state','step') then
  own:=r.players->idx;
  -- An eliminated player may watch the result, but cannot revive by polling.
  own:=own||jsonb_build_object('seen',ts,'ranked_joined',true); r.players:=jsonb_set(r.players,array[idx::text],own);
  if r.status='waiting' then
   if r.created_at+interval '120 seconds'<ts then r.status:='finished';r.winner:=null;
   elsif not exists(select 1 from jsonb_array_elements(r.players) f where not coalesce((f->>'ranked_joined')::boolean,false) or (f->>'seen')::timestamptz<ts-interval '30 seconds') then
    r.starts_at:=least(r.starts_at,ts+interval '5 seconds');
    if r.starts_at<=ts then
     if exists(select 1 from jsonb_array_elements(r.players) f where f->>'ranked_signature' is distinct from ludus_ranked_match_private.signature_in_match((f->>'owner')::uuid,(f->'gladiator'->>'id')::uuid,r.id)) then
      r.status:='finished';r.winner:=null;
     else
     r.status:='playing'; arr:='[]'; k:=0;
     for p in select value from jsonb_array_elements(r.players) loop
      spawn:=case when p->>'ranked_team'='a' then -6 else 6 end;
      arr:=arr||jsonb_build_array(p||jsonb_build_object('x',(mod(k,5)-2)*1.5,'z',spawn,'angle',case when p->>'ranked_team'='a' then 0 else pi() end,'seen',ts));k:=k+1;
     end loop; r.players:=arr;
     end if;
    end if;
   end if;
  elsif r.status='playing' and p_action='step' and (own->>'hp')::int>0 then
   if jsonb_typeof(p_input)<>'object' or coalesce(jsonb_typeof(p_input->'x'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'z'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'attack'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'block'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'special'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'target'),'string')<>'string' then raise exception 'Geçersiz kontrol.'; end if;
   if coalesce(jsonb_typeof(p_input->'dodge'),'boolean')<>'boolean'
    or coalesce(jsonb_typeof(p_input->'dodge_id'),'null') not in('string','null')
    or length(coalesce(p_input->>'dodge_id',''))>80
    or coalesce(jsonb_typeof(p_input->'region'),'string')<>'string'
    or coalesce(p_input->>'region','chest') not in('chest','head','legs','leftArm','rightArm')
    or coalesce(jsonb_typeof(p_input->'hand'),'string')<>'string'
    or coalesce(p_input->>'hand','main_hand') not in('main_hand','off_hand') then raise exception 'Geçersiz kontrol.'; end if;
   special_command:=coalesce(p_input->>'special_id','');
   if coalesce(jsonb_typeof(p_input->'special_id'),'null') not in('string','null') or length(special_command)>80 then raise exception 'Geçersiz özel hareket.';end if;
   attack_region:=coalesce(p_input->>'region','chest');
   selected_hand:=coalesce(p_input->>'hand','main_hand');
   if selected_hand='off_hand' and not exists(select 1 from jsonb_array_elements(own->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='weapon') then selected_hand:='main_hand'; end if;
   -- Delta comes from the previously persisted server timestamp, never from the client.
   dt:=greatest(0,least(.25,extract(epoch from ts-(r.players->idx->>'tick_at')::timestamptz)));
   if dt is null then dt:=0; end if;
   mx:=greatest(-1,least(1,coalesce((p_input->>'x')::double precision,0))); mz:=greatest(-1,least(1,coalesce((p_input->>'z')::double precision,0))); len:=greatest(1,sqrt(mx*mx+mz*mz));
   radius:=case when coalesce((own->>'swing_end')::timestamptz,'epoch')>ts or coalesce((own->>'dodge_until')::timestamptz,'epoch')>ts then 0 when coalesce((p_input->>'block')::boolean,false) then 1.8 else 3.5 end;
   if coalesce((own->>'stats_version')::int,0) in (73,74,75,76,77) then
    stats:=own->'combat_stats';
    speed_factor:=case when sqrt(mx*mx+mz*mz)>.001 and radius>0 and own->>'pull_from' is null and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
     then least(1,coalesce((own->>'acceleration_progress')::float,0)+dt*(3+least(30,greatest(0,coalesce((stats->'items'->>'acceleration')::float,0)))/5)) else 0 end;
    own:=own||jsonb_build_object('acceleration_progress',speed_factor);
    radius:=radius*coalesce((stats->>'speed')::float,1)*(.85+.15*speed_factor);
   end if;
   px:=(own->>'x')::double precision+mx/len*dt*radius; pz:=(own->>'z')::double precision+mz/len*dt*radius;
   if own->>'pull_from' is not null or coalesce((own->>'stagger_until')::timestamptz,'epoch')>ts or coalesce((own->>'recoil_until')::timestamptz,'epoch')>ts then px:=(own->>'x')::float; pz:=(own->>'z')::float; mx:=0; mz:=0; end if;
   if r.venue='pit' then px:=greatest(-10.86370849898476,least(10.86370849898476,px));pz:=greatest(-8.03528137423857,least(8.03528137423857,pz));else len:=greatest(1,sqrt(px*px+pz*pz)/10.5); px:=px/len; pz:=pz/len;end if;
   target_idx:=null; best:=1e9; wanted:=p_input->>'target'; k:=0;
   for p in select value from jsonb_array_elements(r.players) loop
    if p->>'owner'<>u::text and (p->>'hp')::int>0 and p->>'ranked_team' is not null and own->>'ranked_team' is not null and p->>'ranked_team'<>own->>'ranked_team' then
     dist:=sqrt(power(px-(p->>'x')::float,2)+power(pz-(p->>'z')::float,2));
     if p->>'owner'=wanted then target_idx:=k; exit; elsif dist<best then best:=dist; target_idx:=k; end if;
    end if; k:=k+1;
   end loop;
   enemy:=r.players->target_idx; angle:=coalesce((own->>'angle')::float,0);
   if enemy is not null and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts then
    wanted_angle:=atan2((enemy->>'x')::float-px,(enemy->>'z')::float-pz);
    if coalesce((own->>'stats_version')::int,0) in (73,74,75,76,77) then
     turn:=atan2(sin(wanted_angle-angle),cos(wanted_angle-angle));
     angle:=angle+turn*least(1,(1-exp(-18*dt))*(1+least(.3,greatest(0,coalesce((own->'combat_stats'->'items'->>'turn_speed')::float,0)/100))));
    else angle:=wanted_angle;end if;
   end if;
   evade_kind:=coalesce(p_input->>'dodge_kind','roll');
   if evade_kind not in('roll','step','duck','jump') or coalesce(jsonb_typeof(p_input->'dodge_kind'),'null') not in('null','string') then raise exception 'Geçersiz kaçınma.';end if;
   evade_cost:=case evade_kind when 'roll' then 25 when 'jump' then 22 else 18 end;
   evade_duration:=case evade_kind when 'roll' then .46 when 'jump' then .72 when 'duck' then .65 else .42 end;
   dodge_command:=coalesce(p_input->>'dodge_id','');
   dodge_eligible:=own->>'pull_from' is null and coalesce((own->>'stamina')::float,100)>=evade_cost and coalesce((own->>'evade_ready_at')::timestamptz,'epoch')<=ts
    and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts;
   dodging:=coalesce((p_input->>'dodge')::boolean,false) and dodge_command<>'' and dodge_command is distinct from own->>'last_dodge_command' and dodge_eligible;
   if coalesce((p_input->>'dodge')::boolean,false) and dodge_command<>'' then own:=own||jsonb_build_object('last_dodge_command',dodge_command); end if;
   if dodging then
    len:=sqrt(mx*mx+mz*mz);
    own:=own||jsonb_build_object('dodge_at',ts,'motion_version',163,'dodge_kind',evade_kind,'evade_ready_at',ts+(evade_duration+.25)*interval '1 second','dodge_travel',case evade_kind when 'duck' then 0 when 'jump' then case when len>.01 then .65 else 0 end else 1.15 end,'dodge_until',ts+evade_duration*interval '1 second','dodge_tick_at',ts,'dodge_serial',coalesce((own->>'dodge_serial')::int,0)+1,
     'dodge_dx',case when len>.01 then mx/len else -sin(angle) end,'dodge_dz',case when len>.01 then mz/len else -cos(angle) end,
     'stamina',greatest(0,coalesce((own->>'stamina')::float,100)-evade_cost),'stamina_regen_at',ts+interval '1 second');
   end if;
   last_hit:=(own->>'hit_at')::timestamptz;
   command_id:=coalesce(p_input->>'attack_id','');
   if jsonb_typeof(p_input->'attack_id') not in('string','null') or length(command_id)>80 then raise exception 'Geçersiz saldırı işlemi.'; end if;
   strike:=not dodging and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>=13 and enemy is not null and own->>'pull_from' is null and coalesce((p_input->>'attack')::boolean,false)
    and coalesce((own->>'cooldown_until')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and (command_id='' or command_id is distinct from own->>'last_attack_command')
    and (own->>'swing_at' is not null or last_hit is null or ts-last_hit>=interval '750 milliseconds');
   if coalesce((p_input->>'attack')::boolean,false) and command_id<>'' then own:=own||jsonb_build_object('last_attack_command',command_id); end if;
   select f->>'model' into selected_weapon from jsonb_array_elements(own->'items') f where f->>'equipped_slot'=selected_hand and f->>'kind'='weapon';
   whip:=coalesce(not dodging and own->>'pull_from' is null and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>=28 and sqrt(power(px-(enemy->>'x')::float,2)+power(pz-(enemy->>'z')::float,2))<=2 and coalesce((own->>'cooldown_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and selected_weapon='whip' and wanted=enemy->>'owner' and coalesce((p_input->>'special')::boolean,false) and ((own->>'special_at') is null or ts-(own->>'special_at')::timestamptz>=interval '6 seconds'),false);
   throwing:=false;
   if coalesce((own->>'stats_version')::int,0)>=76 then
    select f into thrown from jsonb_array_elements(own->'items') f where f->>'equipped_slot'=coalesce(p_input->>'hand','main_hand') and f->>'kind'='weapon';
    throw_range:=case when thrown->>'model' in('gladius','sica') then 4.5 else 9 end;
    throwing:=coalesce(coalesce((p_input->>'special')::boolean,false) and special_command<>'' and special_command is distinct from own->>'last_special_command'
     and thrown->>'model' in('gladius','sica','spear','trident','trident_gladiator') and not dodging and own->>'pull_from' is null
     and coalesce((own->>'stamina')::float,0)>=26 and enemy is not null and wanted=enemy->>'owner'
     and sqrt(power(px-(enemy->>'x')::float,2)+power(pz-(enemy->>'z')::float,2))<=throw_range
     and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
     and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts
     and coalesce((own->>'cooldown_until')::timestamptz,'epoch')<=ts
     and (own->>'special_at' is null or ts-(own->>'special_at')::timestamptz>=interval '8 seconds'),false);
    whip:=whip and special_command<>'' and special_command is distinct from own->>'last_special_command'
     and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts;
    if coalesce((p_input->>'special')::boolean,false) and special_command<>'' then own:=own||jsonb_build_object('last_special_command',special_command);end if;
   end if;
   if whip or throwing then strike:=false; end if;
   if radius=0 then mx:=0;mz:=0; end if;
   wants_guard:=coalesce((p_input->>'block')::boolean,false);
   guard_eligible:=not dodging and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts and coalesce((own->>'stamina')::float,100)>0 and own->>'pull_from' is null and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and exists(select 1 from jsonb_array_elements(own->'items') f where f->>'equipped_slot'='off_hand' and f->>'kind'='shield');
   if wants_guard and not coalesce((own->>'guard_requested')::boolean,false) then
    own:=own||jsonb_build_object('guard_at',case when guard_eligible and coalesce((own->>'guard_rearm')::timestamptz,'epoch')<=ts then ts else null end,'guard_rearm',greatest(ts+interval '420 milliseconds',coalesce((own->>'guard_rearm')::timestamptz,'epoch')));
   end if;
   own:=own||jsonb_build_object('guard_requested',wants_guard);
   own:=own||jsonb_build_object('x',px,'z',pz,'angle',angle,'tick_at',ts,'seen',ts,'move',sqrt(mx*mx+mz*mz),'block',wants_guard and guard_eligible and not strike and not whip and not throwing,'serial',(own->>'serial')::int+case when strike then 1 else 0 end);
   if strike then
    wind:=case selected_weapon when 'gladius' then .25 when 'sica' then .23 when 'spear' then .32 when 'halberd' then .36 when 'trident_gladiator' then .36 when 'trident' then .36 when 'heavy_mace' then .40 when 'warhammer' then .44 when 'heavy_mace' then .40 when 'whip' then .32 else .22 end;
    active:=case selected_weapon when 'gladius' then .20 when 'sica' then .19 when 'spear' then .22 when 'halberd' then .24 when 'trident_gladiator' then .24 when 'trident' then .24 when 'heavy_mace' then .26 when 'warhammer' then .26 when 'heavy_mace' then .26 when 'whip' then .24 else .18 end;
    recover:=case selected_weapon when 'gladius' then .45 when 'sica' then .40 when 'spear' then .48 when 'halberd' then .52 when 'trident_gladiator' then .52 when 'trident' then .52 when 'heavy_mace' then .56 when 'warhammer' then .60 when 'heavy_mace' then .56 when 'whip' then .48 else .35 end;
    if coalesce((own->>'stats_version')::int,0) in (73,74,75,76,77) then
     speed_factor:=least(1.18,(.9+.002*greatest(0,least(100,coalesce((own->'combat_stats'->>'agility')::float,50))))*(1+least(.25,greatest(0,coalesce((own->'combat_stats'->'items'->>'attack_speed')::float,0)/100))));
     wind:=wind/speed_factor;active:=active/speed_factor;recover:=recover/speed_factor;
    end if;
    counter:=coalesce((own->>'counter_until')::timestamptz,'epoch')>ts and own->>'counter_target'=enemy->>'owner';
    if counter then wind:=wind*.55;recover:=recover*.85; end if;
    own:=own||jsonb_build_object('stamina',greatest(0,coalesce((own->>'stamina')::float,100)-13),'stamina_regen_at',ts+interval '1 second','hit_at',ts,'swing_at',ts,'wind',wind,'active',active,'recover',recover,'strike_at',ts+(wind+active*.5)*interval '1 second',
     'strike_target',enemy->>'owner','strike_weapon',selected_weapon,'strike_region',attack_region,'strike_hand',selected_hand,'strike_counter',counter,'strike_resolved',false,'swing_end',ts+(wind+active+recover)*interval '1 second',
     'cooldown_until',ts+(wind+active+recover)*interval '1 second','recoil_at',null,'recoil_until',null,'stagger_until',null,'attack_result',null);
    if counter then own:=own||jsonb_build_object('counter_until',null,'counter_target',null); end if;
   end if;
   if throwing then
    -- Snapshot before removal: thrown-item and remaining-gear effects are counted once.
    attack_snapshot:=jsonb_build_object('stats_version',coalesce((own->>'stats_version')::int,76),'items',own->'items','combat_stats',own->'combat_stats');
    select coalesce(jsonb_agg(f),'[]') into gear from jsonb_array_elements(own->'items') f where f->>'equipped_slot'<>thrown->>'equipped_slot';
    stats:=private.ludus_combat_stats_v73(own->'gladiator',gear);
    own:=own||jsonb_build_object('items',gear,'combat_stats',stats,'maxHp',(stats->>'maxHp')::int,'hp',least((own->>'hp')::int,(stats->>'maxHp')::int),
     'maxStamina',(stats->>'maxStamina')::numeric,'stamina',least((stats->>'maxStamina')::numeric,greatest(0,(own->>'stamina')::numeric-26)),
     'stamina_regen_at',ts+interval '1 second','special_at',ts,'throw_at',ts,'throw_until',ts+interval '700 milliseconds',
     'throw_serial',coalesce((own->>'throw_serial')::int,0)+1,'throw_hand',thrown->>'equipped_slot','throw_weapon',thrown->>'model','gear_serial',coalesce((own->>'gear_serial')::int,0)+1,
     'swing_end',ts+interval '700 milliseconds','cooldown_until',ts+interval '700 milliseconds','strike_at',null,'block',false,'guard_at',null,'move',0,
     'projectile',jsonb_build_object('id',special_command,'weapon',thrown->>'model','hand',thrown->>'equipped_slot','origin_x',px,'origin_z',pz,'x',px,'z',pz,'dx',sin(angle),'dz',cos(angle),
      'launch_at',ts+interval '270 milliseconds','expires_at',ts+(0.27+throw_range/12)*interval '1 second','tick_at',ts+interval '270 milliseconds',
      'resolved',false,'launched',false,'attacker',attack_snapshot,'base',case when thrown->>'model' in('gladius','sica') then 20 else 30 end));
   end if;
   if enemy is not null then
    dist:=sqrt(power(px-(enemy->>'x')::float,2)+power(pz-(enemy->>'z')::float,2));
    if whip then own:=own||jsonb_build_object('stamina',greatest(0,coalesce((own->>'stamina')::float,100)-28),'stamina_regen_at',ts+interval '1 second','special_at',ts,'pull_serial',(own->>'pull_serial')::int+1,'pull_target',enemy->>'owner'); enemy:=enemy||jsonb_build_object('pull_from',u,'pull_until',ts+interval '6 seconds','pull_at',ts,'block',false);
    end if;
    r.players:=jsonb_set(r.players,array[target_idx::text],enemy);
   end if;
   r.players:=jsonb_set(r.players,array[idx::text],own);
  end if;
 else raise exception 'Geçersiz işlem.';
 end if;
 if r.status='playing' then
  -- Simulate tethered victims on every room update, even when their own tab is suspended.
  arr:='[]';
  for p in select value from jsonb_array_elements(r.players) loop
   if p->>'pull_from' is not null and (p->>'hp')::int>0 then
    select value into enemy from jsonb_array_elements(r.players) where value->>'owner'=p->>'pull_from' and (value->>'hp')::int>0;
    if not found or (p->>'pull_until')::timestamptz<ts then p:=p||jsonb_build_object('pull_from',null,'pull_until',null);
    else
     dt:=greatest(0,least(.25,extract(epoch from ts-(p->>'pull_at')::timestamptz)));
     px:=(p->>'x')::float; pz:=(p->>'z')::float; dist:=sqrt(power((enemy->>'x')::float-px,2)+power((enemy->>'z')::float-pz,2));
     len:=least(greatest(0,dist-.9),dt*greatest(6,dist*2));
     if dist>.91 then p:=p||jsonb_build_object('x',px+((enemy->>'x')::float-px)/dist*len,'z',pz+((enemy->>'z')::float-pz)/dist*len,'pull_at',ts,'move',0,'block',false);
     else p:=p||jsonb_build_object('pull_from',null,'pull_until',null); end if;
    end if;
   end if;
   arr:=arr||jsonb_build_array(p);
  end loop; r.players:=arr;
  arr:='[]';
  for p in select value from jsonb_array_elements(r.players) loop
   if (p->>'hp')::int>0 and (p->>'seen')::timestamptz<ts-interval '30 seconds' then p:=p||jsonb_build_object('hp',0,'left',true); end if;
   arr:=arr||jsonb_build_array(p);
  end loop; r.players:=arr;
  if not exists(select 1 from jsonb_array_elements(r.players) f where f->'projectile' is not null and f->'projectile'<>'null'::jsonb and not coalesce((f->'projectile'->>'resolved')::boolean,false)) then
   select count(distinct f->>'ranked_team'),min(f->>'owner')::uuid into count_alive,win from jsonb_array_elements(r.players) f where (f->>'hp')::int>0;
   if count_alive<=1 then r.status:='finished';r.winner:=win;end if;
  end if;
 end if;
 if r.venue='pit' then r.players:=ludus_pit_private.bounds(r.players);end if;
 update public.ludus_matches set players=r.players,status=r.status,starts_at=r.starts_at,winner=r.winner,updated_at=ts where id=r.id;

 if r.status='finished' then perform ludus_ranked_match_private.settle_match(r.id);perform ludus_ranked_match_private.cleanup_match(r.id);end if;
 return jsonb_build_object('id',r.id,'venue',r.venue,'status',r.status,'starts_at',r.starts_at,'server_now',ts,'players',r.players,'winner',r.winner,'combat_version',23,'combat_feel_version',114,'motion_version',163,'controls_version',77,'stats_version',77);
end; $function$;


-- Preserve the established party API while adding queue actions and rating.
alter function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) rename to handle_ready_v246;
revoke all on function ludus_ranked_party_private.handle_ready_v246(text,uuid,uuid,uuid) from public,anon,authenticated;

create function ludus_ranked_match_private.party_entry(p_action text,p_peer uuid default null,p_gladiator uuid default null,p_invite uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;qs jsonb;u uuid:=auth.uid();points int;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Giriş yapmalısın.';end if;
 if p_action in ('start','cancel_queue') then
  perform ludus_ranked_party_private.handle_ready_v246('state',null,null,null);
  perform ludus_ranked_match_private.queue_action(case when p_action='start' then 'start' else 'cancel' end);
  result:=ludus_ranked_party_private.handle_ready_v246('state',null,null,null);
 else
  result:=ludus_ranked_match_private.party_action(p_action,p_peer,p_gladiator,p_invite);
 end if;
 if result->'party' is not null and result->'party'<>'null'::jsonb then
  qs:=ludus_ranked_match_private.queue_action('state');result:=jsonb_set(result,'{party,queue}',qs,true);
 end if;
 select r.points into points from ludus_ranked_match_private.live_ratings r where r.user_id=u;
 return result||jsonb_build_object('ranked_rating',coalesce(points,1500));
end $$;
revoke all on function ludus_ranked_match_private.party_entry(text,uuid,uuid,uuid) from public,anon;
grant execute on function ludus_ranked_match_private.party_entry(text,uuid,uuid,uuid) to authenticated;

create function ludus_ranked_party_private.handle_v244(p_action text,p_peer uuid,p_gladiator uuid,p_invite uuid)
returns jsonb language sql security definer set search_path='' as $$select ludus_ranked_match_private.party_entry(p_action,p_peer,p_gladiator,p_invite)$$;
revoke all on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) from public,anon;
grant execute on function ludus_ranked_party_private.handle_v244(text,uuid,uuid,uuid) to authenticated;

alter table ludus_ranked_match_private.queue enable row level security;
alter table ludus_ranked_match_private.matches enable row level security;
alter table ludus_ranked_match_private.live_ratings enable row level security;
alter table ludus_ranked_match_private.live_results enable row level security;
revoke all on all tables in schema ludus_ranked_match_private from public,anon,authenticated;
revoke all on all functions in schema ludus_ranked_match_private from public,anon,authenticated;
grant execute on function ludus_ranked_match_private.match_step(text,uuid,uuid,jsonb,jsonb),ludus_ranked_match_private.board(text,uuid,integer,integer) to authenticated;
create function public.ludus_ranked_board_v248(p_query text default '',p_clan uuid default null,p_page integer default 0,p_page_size integer default 8)
returns jsonb language sql stable security invoker set search_path='' as $$select ludus_ranked_match_private.board(p_query,p_clan,p_page,p_page_size)$$;
revoke all on function public.ludus_ranked_board_v248(text,uuid,integer,integer) from public,anon;
grant execute on function public.ludus_ranked_board_v248(text,uuid,integer,integer) to authenticated;
create function public.ludus_ranked_match_v248(p_action text,p_room uuid default null,p_gladiator uuid default null,p_slots jsonb default '{}'::jsonb,p_input jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$select ludus_ranked_match_private.match_step(p_action,p_room,p_gladiator,p_slots,p_input)$$;
revoke all on function public.ludus_ranked_match_v248(text,uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.ludus_ranked_match_v248(text,uuid,uuid,jsonb,jsonb) to authenticated;

-- Prevent the legacy all-against-all engine and its reward trigger from handling ranked games.
do $migration$
declare
 src text:=pg_get_functiondef('public.ludus_match(text,uuid,uuid,jsonb,jsonb)'::regprocedure);
 anchor text:=$old$ if p_action='join' and r.venue<>v_venue then raise exception 'Önce diğer arenadaki maçından ayrıl.';end if;$old$;
 guard text:=$new$ if r.venue='ranked' then raise exception 'Bu maç Ranked Arena ekranından açılmalı.';end if;$new$;
 archive text:=pg_get_functiondef('ludus_rank_private.archive_match(jsonb)'::regprocedure);
 old_venue text:=$old$coalesce(m->>'venue','arena')='pit'$old$;
 new_venue text:=$new$coalesce(m->>'venue','arena') in ('pit','ranked')$new$;
begin
 if position(guard in src)=0 then
  if position(anchor in src)=0 then raise exception 'Unexpected legacy match handler';end if;
  src:=replace(src,anchor,anchor||E'\n'||guard);execute src;
 end if;
 if position(new_venue in archive)=0 then
  if position(old_venue in archive)=0 then raise exception 'Unexpected legacy match archive';end if;
  archive:=replace(archive,old_venue,new_venue);execute archive;
 end if;
end $migration$;
notify pgrst,'reload schema';
