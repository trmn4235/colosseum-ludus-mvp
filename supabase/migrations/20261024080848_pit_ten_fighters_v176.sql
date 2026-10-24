-- V176: server-owned lineups, rolling 1x10 and five two-gladiator teams.
begin;
create or replace function ludus_pit_private.lineup(p_mode text) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('name',name,'house',house,'class',class,'level',1,'overall',rating,'stat_version',46,'favorite',favorite,
 'base_stats',jsonb_build_object('attack_technique',rating,'defense_technique',rating,'muscle',rating,'speed',rating,'reflex',rating,'conditioning',rating,'tactics',rating)) order by position),'[]'::jsonb)
 from (values
 ('1x10',1,'Varro','Cornelia','secutor',54,true),('1x10',2,'Felix','Valeria','thraex',50,false),('1x10',3,'Drusus','Valeria','murmillo',49,false),
 ('1x10',4,'Marcus','Claudia','provocator',51,false),('1x10',5,'Titus','Claudia','hoplomachus',48,false),('1x10',6,'Lucius','Aurelia','scissor',50,false),
 ('1x10',7,'Cato','Aurelia','secutor',49,false),('1x10',8,'Brutus','Flavia','murmillo',52,false),('1x10',9,'Aulus','Flavia','thraex',48,false),
 ('2x5',1,'Varro','Cornelia','secutor',53,true),('2x5',2,'Felix','Cornelia','thraex',53,true),('2x5',3,'Drusus','Valeria','murmillo',50,false),('2x5',4,'Marcus','Valeria','provocator',50,false),
 ('2x5',5,'Titus','Claudia','hoplomachus',51,false),('2x5',6,'Lucius','Claudia','scissor',49,false),('2x5',7,'Cato','Aurelia','secutor',50,false),('2x5',8,'Brutus','Aurelia','murmillo',52,false)
 ) as fighters(mode,position,name,house,class,rating,favorite) where mode=p_mode;
$$;
revoke all on function ludus_pit_private.lineup(text) from public,anon,authenticated;
create or replace function ludus_pit_private.start(p_gladiator uuid,p_slots jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();g public.ludus_gladiators;mate public.ludus_gladiators;b public.ludus_battles;item jsonb;mate_item jsonb;pool jsonb:='[]';snap jsonb;actor integer;bid uuid;
 mode text:=coalesce(p_slots->>'pit_mode','legacy');participants integer;own_house text;roster jsonb;mate_id uuid;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or p_request is null then raise exception 'Giriş ve işlem kimliği gerekli';end if;
 if p_slots is null or jsonb_typeof(p_slots)<>'object' or p_slots-array['pit_weapon','pit_mode','teammate','teammate_weapon']<>'{}'::jsonb then raise exception 'Avluda yalnızca avlu silahı ve müsabaka seçilebilir.';end if;
 if mode not in ('legacy','1x10','2x5') then raise exception 'Geçersiz avlu müsabakası.';end if;
 if mode<>'2x5' and (p_slots ? 'teammate' or p_slots ? 'teammate_weapon') then raise exception 'Takım arkadaşı yalnızca 2x5 için seçilir.';end if;
 item:=ludus_pit_private.loan(p_slots->>'pit_weapon');participants:=case when mode='legacy' then 4 else 10 end;
 if mode='2x5' then
  mate_id:=(p_slots->>'teammate')::uuid;mate_item:=ludus_pit_private.loan(p_slots->>'teammate_weapon');
  if mate_id is null or mate_id=p_gladiator then raise exception 'İki farklı gladyatör seç.';end if;
 end if;
 select coalesce(nullif(ludus_name,''),username) into own_house from public.ludus_accounts where user_id=u for update;if not found then raise exception 'Ludus bulunamadı';end if;
 select * into b from public.ludus_battles where owner_id=u and start_request_id=p_request;
 if found then
  if b.mode<>'pit' or b.gladiator_id<>p_gladiator or b.snapshot->>'pit_weapon' is distinct from p_slots->>'pit_weapon'
   or coalesce(b.snapshot->>'pit_mode','legacy')<>mode or b.snapshot->'teammate'->>'id' is distinct from mate_id::text
   or b.snapshot->>'teammate_weapon' is distinct from p_slots->>'teammate_weapon' then raise exception 'İşlem kimliği başka istekte kullanıldı.';end if;
  return jsonb_build_object('id',b.id,'mode',b.mode,'snapshot',b.snapshot);
 end if;
 if exists(select 1 from public.ludus_battles where owner_id=u and finished_at is null) or exists(select 1 from public.ludus_matches m where m.status in('waiting','playing') and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text and coalesce((f->>'hp')::int,0)>0 and (f->>'seen')::timestamptz>now()-interval '30 seconds')) then raise exception 'Devam eden savaşın var. Önce devam et veya savaştan çekil.';end if;
 perform ludus_private.v7_settle(u);
 select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u for update;
 if not found or g.status<>'available' or g.fatigue_value>=100 or g.training_ends_at>now() or g.injured_until>now() or g.clan_roster_id is not null or to_jsonb(g)->>'market_listing_id' is not null then raise exception 'Hazır bir gladyatör seç.';end if;
 snap:=jsonb_build_object('gladiator',to_jsonb(g)||ludus_food_private.combat_snapshot_v77(u),'items',jsonb_build_array(item),'pit_version',case when mode='legacy' then 173 else 176 end,'pit_weapon',p_slots->>'pit_weapon','participants',participants);
 if mode<>'legacy' then
  roster:=jsonb_build_array(snap->'gladiator'||jsonb_build_object('house',own_house));
  if mode='2x5' then
   select * into mate from public.ludus_gladiators where id=mate_id and owner_id=u for update;
   if not found or mate.status<>'available' or mate.fatigue_value>=100 or mate.training_ends_at>now() or mate.injured_until>now() or mate.clan_roster_id is not null or to_jsonb(mate)->>'market_listing_id' is not null then raise exception 'Hazır bir takım arkadaşı seç.';end if;
   snap:=snap||jsonb_build_object('teammate',to_jsonb(mate)||ludus_food_private.combat_snapshot_v77(u),'teammate_weapon',p_slots->>'teammate_weapon');
   roster:=roster||jsonb_build_array(snap->'teammate'||jsonb_build_object('house',own_house));
  end if;
  snap:=snap||jsonb_build_object('pit_mode',mode,'pit_roster',roster||ludus_pit_private.lineup(mode));
 end if;
 for actor in 0..participants-1 loop
  pool:=pool||jsonb_build_array(jsonb_build_object('token',gen_random_uuid(),'actor',actor,'slot','main_hand','inventory_id',null,'item',case when actor=0 then item when actor=1 and mode='2x5' then mate_item else ludus_pit_private.loan(case when actor%2=0 then 'pit_stone_mace' else 'pit_wood_mace' end) end));
 end loop;
 insert into public.ludus_battles(owner_id,gladiator_id,mode,snapshot,rule_version,start_request_id,loot) values(u,g.id,'pit',snap,2,p_request,pool) returning id into bid;
 return jsonb_build_object('id',bid,'mode','pit','snapshot',snap);
end $$;
CREATE OR REPLACE FUNCTION ludus_pit_private.finish(p_battle uuid, p_won boolean, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();b public.ludus_battles;prize jsonb;earned integer:=0;mate_earned integer:=0;selected_mode text;members jsonb;expected integer;team_count integer;
begin
 if u is null then raise exception 'Giriş gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 select reward into prize from public.ludus_battle_receipts where battle_id=p_battle and owner_id=u;
 if found then return prize;end if;
 select * into b from public.ludus_battles where id=p_battle and owner_id=u and mode='pit' for update;
 if not found then raise exception 'Düello bulunamadı';end if;
 if b.finished_at is not null then return b.reward;end if;
 p_won:=coalesce(p_won,false) and now()<b.started_at+interval '2 hours';
 selected_mode:=b.snapshot->>'pit_mode';
 if coalesce((b.snapshot->>'pit_version')::int,0)>=176 then
  if pg_column_size(p_stats)>16384 then raise exception 'Sonuç çok büyük';end if;
  expected:=case when selected_mode='2x5' then 8 else 9 end;team_count:=case when selected_mode='2x5' then 2 else 1 end;
  if p_won then
   members:=p_stats->'team_members';
   if now()<b.started_at+interval '10 seconds' or coalesce(p_stats->>'pit_mode','')<>selected_mode
    or coalesce((p_stats->>'entrants')::int,0)<>10 or coalesce((p_stats->>'opponents_defeated')::int,0)<>expected
    or coalesce((p_stats->>'kills')::int,-1) not between 0 and expected
    or coalesce((p_stats->>'team_alive')::int,0) not between 1 and team_count
    or coalesce(jsonb_typeof(members),'')<>'array' then raise exception 'Müsabaka sonucu doğrulanamadı';end if;
   if jsonb_array_length(members)<>team_count or members->0->>'id' is distinct from b.gladiator_id::text
    or (selected_mode='2x5' and members->1->>'id' is distinct from b.snapshot->'teammate'->>'id')
    or coalesce((members->0->>'alive')::boolean,false) is distinct from coalesce((p_stats->>'alive')::boolean,false)
    or (select count(*) from jsonb_array_elements(members) m where coalesce((m->>'alive')::boolean,false))<>(p_stats->>'team_alive')::int
    then raise exception 'Takım sonucu doğrulanamadı';end if;
  end if;
 else
  if p_won and (now()<b.started_at+interval '10 seconds' or (case when coalesce((b.snapshot->>'pit_version')::int,0)>=173 then coalesce((p_stats->>'opponents_defeated')::int,0)<>3 or coalesce((p_stats->>'kills')::int,0) not between 0 and 3 else coalesce((p_stats->>'kills')::int,0)<>1 end) or not coalesce((p_stats->>'alive')::boolean,false)) then raise exception 'Düello sonucu doğrulanamadı';end if;
 end if;
 if pg_column_size(p_stats)>16384 then raise exception 'Sonuç çok büyük';end if;
 if p_won then earned:=ludus_pit_private.award(b.id,b.gladiator_id);if selected_mode='2x5' then mate_earned:=ludus_pit_private.award(md5(b.id::text||':teammate')::uuid,(b.snapshot->'teammate'->>'id')::uuid);end if;end if;
 -- Training pit protects the exact carried-in inventory; no fabricated loot or lost items.
 update public.ludus_items set locked_battle_id=null where owner_id=u and locked_battle_id=b.id;
 prize:=jsonb_build_object('gold',0,'fame',earned,'teammate_fame',mate_earned,'gear_lost',false,'pit',true,'fame_total',coalesce((select points from ludus_pit_private.fame where gladiator_id=b.gladiator_id),0));
 update public.ludus_battles set finished_at=now(),won=p_won,stats=p_stats,reward=prize where id=b.id returning reward into prize;
 insert into public.ludus_battle_receipts(battle_id,owner_id,reward,finished_at) values(b.id,u,prize,now());
 return prize;
end $function$
;
-- Extend the existing betting API without changing coupons or payouts.
do $patch$
declare s text;old text;
begin
 select pg_get_functiondef('ludus_pit_private.api(text,jsonb,uuid)'::regprocedure) into s;old:=s;
 s:=replace(s,'''class'',g.class,''fame''','''class'',g.class,''ready'',(g.status=''available'' and g.fatigue_value<100 and coalesce(g.training_ends_at<=now(),true) and coalesce(g.injured_until<=now(),true) and g.clan_roster_id is null and to_jsonb(g)->>''market_listing_id'' is null),''fame''');
 s:=replace(s,'''entry_fame'',needed,''win_fame'',win_points','''entry_fame'',needed,''win_fame'',win_points,''lineups'',jsonb_build_object(''1x10'',ludus_pit_private.lineup(''1x10''),''2x5'',ludus_pit_private.lineup(''2x5''))');
 s:=replace(s,' select entry_fame,win_fame into needed,win_points',' perform ludus_private.v7_settle(u); select entry_fame,win_fame into needed,win_points');
 if s=old then raise exception 'Avlu API noktası bulunamadı';end if;
 execute s;
end $patch$;
revoke all on function ludus_pit_private.start(uuid,jsonb,uuid),ludus_pit_private.finish(uuid,boolean,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
