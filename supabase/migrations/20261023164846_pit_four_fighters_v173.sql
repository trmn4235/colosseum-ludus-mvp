-- V173: four independent fighters, venue loan weapons, one fame per win.
begin;
update ludus_pit_private.rules set win_fame=1 where id;
alter table public.ludus_matches add column pit_version integer not null default 0;
-- Preserve existing paid or running two-fighter coupons at their original odds.
alter table ludus_pit_private.bouts add column participants integer not null default 2 check(participants in(2,4));
alter table ludus_pit_private.bouts alter column participants set default 4;
alter table ludus_pit_private.bouts alter column odds set default 3.80;
alter table ludus_pit_private.bouts drop constraint bouts_selected_check;
alter table ludus_pit_private.bouts drop constraint bouts_winner_check;
alter table ludus_pit_private.bouts add constraint bouts_selected_check check(selected>=0 and selected<participants);
alter table ludus_pit_private.bouts add constraint bouts_winner_check check(winner>=0 and winner<participants);
update ludus_pit_private.bouts set participants=4,odds=3.80 where status='open' and selected is null;
create function ludus_pit_private.loan(p_weapon text) returns jsonb language plpgsql set search_path='' as $$
begin
 if p_weapon is null or p_weapon not in('pit_stone_mace','pit_wood_mace') then raise exception 'Avlunun taş veya ahşap gürzünü seç.';end if;
 return jsonb_build_object('kind','weapon','model','heavy_mace','pit_model',p_weapon,'equipped_slot','main_hand','enhancement',0,'base_stats','{}'::jsonb,'sapphires','[]'::jsonb,'rubies','[]'::jsonb,'emeralds','[]'::jsonb,'stat_version',10,'natural_rule_version',2,'natural_stats',ludus_private.item_v10('weapon'),'natural_percentages',(select jsonb_object_agg(key,0) from jsonb_each(ludus_private.item_v10('weapon'))),'certus_used',false);
end $$;
create function ludus_pit_private.start(p_gladiator uuid,p_slots jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();g public.ludus_gladiators;b public.ludus_battles;item jsonb;pool jsonb:='[]';snap jsonb;actor integer;bid uuid;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or p_request is null then raise exception 'Giriş ve işlem kimliği gerekli';end if;
 if p_slots is null or jsonb_typeof(p_slots)<>'object' or p_slots-'pit_weapon'<>'{}'::jsonb then raise exception 'Avluda yalnızca avlu silahı seçilebilir.';end if;
 item:=ludus_pit_private.loan(p_slots->>'pit_weapon');
 perform 1 from public.ludus_accounts where user_id=u for update;if not found then raise exception 'Ludus bulunamadı';end if;
 select * into b from public.ludus_battles where owner_id=u and start_request_id=p_request;
 if found then
  if b.mode<>'pit' or b.gladiator_id<>p_gladiator or b.snapshot->>'pit_weapon' is distinct from p_slots->>'pit_weapon' then raise exception 'İşlem kimliği başka istekte kullanıldı.';end if;
  return jsonb_build_object('id',b.id,'mode',b.mode,'snapshot',b.snapshot);
 end if;
 if exists(select 1 from public.ludus_battles where owner_id=u and finished_at is null) or exists(select 1 from public.ludus_matches m where m.status in('waiting','playing') and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text and coalesce((f->>'hp')::int,0)>0 and (f->>'seen')::timestamptz>now()-interval '30 seconds')) then raise exception 'Devam eden savaşın var. Önce devam et veya savaştan çekil.';end if;
 perform ludus_private.v7_settle(u);
 select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u for update;
 if not found or g.status<>'available' or g.fatigue_value>=100 or g.training_ends_at>now() or g.injured_until>now() or g.clan_roster_id is not null then raise exception 'Hazır bir gladyatör seç.';end if;
 snap:=jsonb_build_object('gladiator',to_jsonb(g)||ludus_food_private.combat_snapshot_v77(u),'items',jsonb_build_array(item),'pit_version',173,'pit_weapon',p_slots->>'pit_weapon','participants',4);
 for actor in 0..3 loop
  pool:=pool||jsonb_build_array(jsonb_build_object('token',gen_random_uuid(),'actor',actor,'slot','main_hand','inventory_id',null,'item',case when actor=0 then item else ludus_pit_private.loan(case when actor%2=0 then 'pit_stone_mace' else 'pit_wood_mace' end) end));
 end loop;
 insert into public.ludus_battles(owner_id,gladiator_id,mode,snapshot,rule_version,start_request_id,loot) values(u,g.id,'pit',snap,2,p_request,pool) returning id into bid;
 return jsonb_build_object('id',bid,'mode','pit','snapshot',snap);
end $$;
CREATE OR REPLACE FUNCTION public.ludus_start_battle_v2(p_gladiator uuid, p_mode text, p_slots jsonb, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();g public.ludus_gladiators;it public.ludus_items;kv record;bid uuid;snap jsonb;pool jsonb:='[]';used uuid[]:='{}';entry jsonb;cls text;weapon text;shield text;actor integer;slot text;kind text;model text;b public.ludus_battles;
begin
 if p_mode='pit' then return ludus_pit_private.start(p_gladiator,p_slots,p_request);end if;
 if uid is null or p_request is null then raise exception 'Giriş ve işlem kimliği gerekli'; end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;if not found then raise exception 'Ludus bulunamadı';end if;
 select * into b from public.ludus_battles where owner_id=uid and start_request_id=p_request;
 if found then return jsonb_build_object('id',b.id,'mode',b.mode,'snapshot',b.snapshot);end if;
 if exists(select 1 from public.ludus_battles where owner_id=uid and finished_at is null) then raise exception 'Devam eden savaşın var. Önce devam et veya savaştan çekil.';end if;
 if p_mode is null or p_mode not in ('4x5','solo20','survival','pit') then raise exception 'Geçersiz mod';end if;
 perform ludus_private.v7_settle(uid);
 select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=uid for update;
 if not found then raise exception 'Gladyatör bulunamadı';end if;
 if g.status<>'available' or g.fatigue_value>=100 or g.training_ends_at>now() or g.injured_until>now() then raise exception 'Gladyatör savaşa hazır değil';end if;
 if p_slots is null or jsonb_typeof(p_slots)<>'object' then raise exception 'Ekipman seçimi gerekli';end if;
 for kv in select * from jsonb_each_text(p_slots) loop
  if kv.key not in ('main_hand','off_hand','helmet','chest','gloves','legs') then raise exception 'Geçersiz yuva';end if;
  if kv.value is null then continue;end if;
  select * into it from public.ludus_items where id=kv.value::uuid and owner_id=uid for update;
  if not found or it.locked_battle_id is not null or (it.equipped_by is not null and it.equipped_by<>g.id) then raise exception 'Eşya sana ait değil, başka gladyatörde veya savaşta';end if;
  if it.id=any(used) then raise exception 'Bir eşya iki yuvaya takılamaz';end if;
  if not ((kv.key='main_hand' and it.kind='weapon' and it.model in ('gladius','sica','spear','trident','heavy_mace','whip','heavy_mace','warhammer')) or (kv.key='off_hand' and it.kind in ('weapon','shield')) or (kv.key=it.kind and kv.key in ('helmet','chest','gloves','legs'))) then raise exception 'Eşya bu yuvaya uygun değil';end if;
  used:=array_append(used,it.id);
 end loop;
 update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=uid and equipped_by=g.id;
 for kv in select * from jsonb_each_text(p_slots) loop
  if kv.value is not null then
   update public.ludus_items set equipped_by=g.id,equipped_slot=kv.key where id=kv.value::uuid returning * into it;
   pool:=pool||jsonb_build_array(jsonb_build_object('token',gen_random_uuid(),'actor',0,'slot',kv.key,'inventory_id',it.id,'item',to_jsonb(it)));
  end if;
 end loop;
 -- Bot equipment is generated here; extraction can only use tokens in this server-owned pool.
 for actor in 1..(case when p_mode='pit' then 1 else 19 end) loop
  cls:=(array['murmillo','thraex','hoplomachus','secutor','retiarius','provocator','scissor'])[actor%7+1];
  weapon:=case cls when 'thraex' then 'sica' when 'hoplomachus' then 'spear' when 'retiarius' then 'trident' else 'gladius' end;
  shield:=case cls when 'thraex' then 'small' when 'hoplomachus' then 'round' when 'retiarius' then 'net' when 'scissor' then 'scissor' else 'large' end;
  foreach slot in array array['main_hand','off_hand','helmet','chest','gloves','legs'] loop
   if slot='chest' and cls not in ('murmillo','scissor') then continue;end if;
   kind:=case slot when 'main_hand' then 'weapon' when 'off_hand' then case when shield in ('net','scissor') then 'weapon' else 'shield' end else slot end;
   model:=case slot when 'main_hand' then weapon when 'off_hand' then shield when 'helmet' then case when p_mode='4x5' and actor<5 then 'gold' else 'silver' end else 'starter' end;
   pool:=pool||jsonb_build_array(jsonb_build_object('token',gen_random_uuid(),'actor',actor,'slot',slot,'inventory_id',null,'item',jsonb_build_object('kind',kind,'model',model,'enhancement',0,'base_stats','{}'::jsonb,'sapphires','[]'::jsonb,'rubies','[]'::jsonb,'stat_version',10,'natural_rule_version',2,'natural_stats',ludus_private.item_v10(kind),'natural_percentages',(select jsonb_object_agg(key,0) from jsonb_each(ludus_private.item_v10(kind))),'emeralds','[]'::jsonb,'certus_used',false)));
  end loop;
 end loop;
 snap:=jsonb_build_object('gladiator',to_jsonb(g)||ludus_food_private.combat_snapshot_v77(uid),'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.ludus_items i where i.equipped_by=g.id),'[]'::jsonb));
 if p_mode='survival' then snap:=snap||jsonb_build_object('survival_record',public.ludus_survival_record_v83());end if;
 insert into public.ludus_battles(owner_id,gladiator_id,mode,snapshot,rule_version,start_request_id,loot) values(uid,g.id,p_mode,snap,2,p_request,pool) returning id into bid;
 update public.ludus_items set locked_battle_id=bid where id=any(used);
 return jsonb_build_object('id',bid,'mode',p_mode,'snapshot',snap);
end $function$
;
CREATE OR REPLACE FUNCTION ludus_pit_private.finish(p_battle uuid, p_won boolean, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();b public.ludus_battles;prize jsonb;earned integer:=0;
begin
 if u is null then raise exception 'Giriş gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 select reward into prize from public.ludus_battle_receipts where battle_id=p_battle and owner_id=u;
 if found then return prize;end if;
 select * into b from public.ludus_battles where id=p_battle and owner_id=u and mode='pit' for update;
 if not found then raise exception 'Düello bulunamadı';end if;
 if b.finished_at is not null then return b.reward;end if;
 p_won:=coalesce(p_won,false) and now()<b.started_at+interval '2 hours';
 if p_won and (now()<b.started_at+interval '10 seconds' or (case when coalesce((b.snapshot->>'pit_version')::int,0)>=173 then coalesce((p_stats->>'opponents_defeated')::int,0)<>3 or coalesce((p_stats->>'kills')::int,0) not between 0 and 3 else coalesce((p_stats->>'kills')::int,0)<>1 end) or not coalesce((p_stats->>'alive')::boolean,false)) then raise exception 'Düello sonucu doğrulanamadı';end if;
 if pg_column_size(p_stats)>16384 then raise exception 'Sonuç çok büyük';end if;
 if p_won then earned:=ludus_pit_private.award(b.id,b.gladiator_id);end if;
 -- Training pit protects the exact carried-in inventory; no fabricated loot or lost items.
 update public.ludus_items set locked_battle_id=null where owner_id=u and locked_battle_id=b.id;
 prize:=jsonb_build_object('gold',0,'fame',earned,'gear_lost',false,'pit',true,'fame_total',coalesce((select points from ludus_pit_private.fame where gladiator_id=b.gladiator_id),0));
 update public.ludus_battles set finished_at=now(),won=p_won,stats=p_stats,reward=prize where id=b.id returning reward into prize;
 insert into public.ludus_battle_receipts(battle_id,owner_id,reward,finished_at) values(b.id,u,prize,now());
 return prize;
end $function$
;
CREATE OR REPLACE FUNCTION public.ludus_match(p_action text, p_room uuid DEFAULT NULL::uuid, p_gladiator uuid DEFAULT NULL::uuid, p_slots jsonb DEFAULT '{}'::jsonb, p_input jsonb DEFAULT '{}'::jsonb)
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
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Hesabına giriş yap.'; end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if p_action='join' then
  perform ludus_private.v7_settle(u);
  perform pg_advisory_xact_lock(202621);
  select m.* into r from public.ludus_matches m where m.status in('waiting','playing') and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text and coalesce((f->>'hp')::int,0)>0 and (f->>'seen')::timestamptz>ts-interval '30 seconds') order by m.created_at desc limit 1 for update;
  if not found then
   select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u for update;
   if not found or g.status<>'available'or g.fatigue_value>=100 or g.injured_until>clock_timestamp()or g.training_ends_at>clock_timestamp()or g.clan_roster_id is not null or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null) then raise exception 'Hazır bir gladyatör seç.'; end if;
   if jsonb_typeof(p_slots)<>'object' or (select count(*) from jsonb_object_keys(p_slots))>6 then raise exception 'Geçersiz ekipman seçimi.'; end if;
   if v_venue='pit' then
    if p_slots<>'{}'::jsonb then raise exception 'Avluda kişisel ekipman kullanılamaz.';end if;
    gear:=jsonb_build_array(ludus_pit_private.loan(p_input->>'pit_weapon'));
   else
   select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('equipped_slot',e.key)),'[]') into gear from jsonb_each_text(p_slots)e join public.ludus_items i on i.id::text=e.value and i.owner_id=u and i.locked_battle_id is null and i.clan_vault_id is null and i.clan_roster_id is null where e.key in('main_hand','off_hand','helmet','chest','gloves','legs') and ((e.key='main_hand' and i.kind='weapon')or(e.key='off_hand' and i.kind in('weapon','shield'))or e.key=i.kind);
   if jsonb_array_length(gear)<>(select count(*) from jsonb_object_keys(p_slots)) or (select count(distinct f->>'id') from jsonb_array_elements(gear) f)<>jsonb_array_length(gear) then raise exception 'Ekipman seçimini yenile.'; end if;
   end if;
   own:=jsonb_build_object('owner',u,'name',g.name,'class',g.class,'gladiator',to_jsonb(g)||ludus_food_private.combat_snapshot_v77(u),'items',gear,'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'maxStamina',100,'stamina',100,'stamina_at',ts,'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0);
   stats:=private.ludus_combat_stats_v73(own->'gladiator',gear);
   own:=own||jsonb_build_object('stats_version',77,'combat_stats',stats,'hp',(stats->>'maxHp')::numeric::int,'maxHp',(stats->>'maxHp')::numeric::int,'stamina',(stats->>'maxStamina')::numeric::int,'maxStamina',(stats->>'maxStamina')::numeric::int);
   select m.* into r from public.ludus_matches m where m.status='waiting' and m.venue=v_venue and (v_venue<>'pit' or (m.pit_version=173 and jsonb_array_length(m.players)<4)) and not exists(select 1 from jsonb_array_elements(m.players) f where coalesce((f->>'stats_version')::int,0)<>77) and m.starts_at>ts and m.updated_at>ts-interval '30 seconds' order by m.created_at limit 1 for update;
   if found then update public.ludus_matches set players=r.players||jsonb_build_array(own),updated_at=ts where id=r.id returning * into r;
   else insert into public.ludus_matches(venue,pit_version,players,starts_at,updated_at) values(v_venue,case when v_venue='pit' then 173 else 0 end,jsonb_build_array(own),ts+interval '10 seconds',ts) returning * into r; end if;
  end if;
 else
  select m.* into r from public.ludus_matches m where m.id=p_room and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text) for update;
  if not found then raise exception 'Bu maça erişemezsin.'; end if;
 end if;
 if p_action='join' and r.venue<>v_venue then raise exception 'Önce diğer arenadaki maçından ayrıl.';end if;
 ts:=clock_timestamp();
 if r.status='playing' then r.players:=private.ludus_advance_combat_v36(r.players,ts);if r.venue='pit' then r.players:=ludus_pit_private.bounds(r.players);end if;r.players:=private.ludus_resolve_combat_v36(r.players,ts);r.players:=private.ludus_projectiles_v76(r.players,ts); end if;
 select (ord-1)::int into idx from jsonb_array_elements(r.players) with ordinality as e(f,ord) where f->>'owner'=u::text;
 if p_action='leave' then
  if r.status='waiting' then select coalesce(jsonb_agg(f),'[]') into r.players from jsonb_array_elements(r.players) f where f->>'owner'<>u::text;
  elsif r.status='playing' then r.players:=jsonb_set(r.players,array[idx::text],(r.players->idx)||jsonb_build_object('hp',0,'move',0,'block',false,'left',true)); end if;
 elsif p_action in('join','state','step') then
  own:=r.players->idx;
  -- An eliminated player may watch the result, but cannot revive by polling.
  own:=own||jsonb_build_object('seen',ts); r.players:=jsonb_set(r.players,array[idx::text],own);
  if r.status='waiting' then
   select coalesce(jsonb_agg(f),'[]') into r.players from jsonb_array_elements(r.players) f where (f->>'seen')::timestamptz>ts-interval '8 seconds';
   if r.starts_at<=ts then
    if jsonb_array_length(r.players)>=(case when r.venue='pit' and r.pit_version=173 then 4 else 2 end) then
     r.status:='playing'; arr:='[]'; radius:=least(10,greatest(3,jsonb_array_length(r.players)*.5)); k:=0;
     for p in select value from jsonb_array_elements(r.players) loop
      spawn:=k*2*pi()/jsonb_array_length(r.players);
      arr:=arr||jsonb_build_array(p||jsonb_build_object('x',sin(spawn)*radius,'z',cos(spawn)*radius,'angle',spawn+pi(),'seen',ts)); k:=k+1;
     end loop; r.players:=arr;
    else r.starts_at:=ts+interval '10 seconds'; end if;
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
    if p->>'owner'<>u::text and (p->>'hp')::int>0 then
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
     and thrown->>'model' in('gladius','sica','spear','trident') and not dodging and own->>'pull_from' is null
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
    wind:=case selected_weapon when 'gladius' then .25 when 'sica' then .23 when 'spear' then .32 when 'trident' then .36 when 'heavy_mace' then .40 when 'warhammer' then .44 when 'heavy_mace' then .40 when 'whip' then .32 else .22 end;
    active:=case selected_weapon when 'gladius' then .20 when 'sica' then .19 when 'spear' then .22 when 'trident' then .24 when 'heavy_mace' then .26 when 'warhammer' then .26 when 'heavy_mace' then .26 when 'whip' then .24 else .18 end;
    recover:=case selected_weapon when 'gladius' then .45 when 'sica' then .40 when 'spear' then .48 when 'trident' then .52 when 'heavy_mace' then .56 when 'warhammer' then .60 when 'heavy_mace' then .56 when 'whip' then .48 else .35 end;
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
  select count(*),min((f->>'owner'))::uuid into count_alive,win from jsonb_array_elements(r.players) f where (f->>'hp')::int>0;
  if count_alive<=1 and not exists(select 1 from jsonb_array_elements(r.players) f where f->'projectile' is not null and f->'projectile'<>'null'::jsonb and not coalesce((f->'projectile'->>'resolved')::boolean,false)) then r.status:='finished'; r.winner:=win; end if;
 elsif r.status='waiting' and jsonb_array_length(r.players)=0 then r.status:='finished'; end if;
 if r.venue='pit' then r.players:=ludus_pit_private.bounds(r.players);end if;
 update public.ludus_matches set players=r.players,status=r.status,starts_at=r.starts_at,winner=r.winner,updated_at=ts where id=r.id;
 return jsonb_build_object('id',r.id,'venue',r.venue,'pit_version',r.pit_version,'status',r.status,'starts_at',r.starts_at,'server_now',ts,'players',r.players,'winner',r.winner,'combat_version',23,'combat_feel_version',114,'motion_version',163,'controls_version',case when coalesce((r.players->0->>'stats_version')::int,0)>=77 then 77 when coalesce((r.players->0->>'stats_version')::int,0)>=76 then 76 else 36 end,'stats_version',coalesce((r.players->0->>'stats_version')::int,0));
end; $function$
;
create or replace function ludus_pit_private.bounds(players jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(p||jsonb_build_object('x',greatest(-10.86370849898476,least(10.86370849898476,(p->>'x')::float8)),'z',greatest(-8.03528137423857,least(8.03528137423857,(p->>'z')::float8))) order by ord),'[]') from jsonb_array_elements(players) with ordinality e(p,ord);
$$;
CREATE OR REPLACE FUNCTION ludus_pit_private.match_finish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid;
begin
 if new.venue='pit' and new.status='finished' and old.status='playing' and new.winner is not null and jsonb_array_length(new.players)=(case when new.pit_version=173 then 4 else 2 end) then
  select (p->'gladiator'->>'id')::uuid into g from jsonb_array_elements(new.players) p where p->>'owner'=new.winner::text;
  if exists(select 1 from public.ludus_gladiators where id=g and owner_id=new.winner)then perform ludus_pit_private.award(new.id,g);end if;
 end if;return new;
end $function$
;
CREATE OR REPLACE FUNCTION ludus_pit_private.api(p_action text, p_args jsonb, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();t timestamptz:=clock_timestamp();b ludus_pit_private.bouts;r ludus_pit_private.receipts;choice integer;amount integer;balance bigint;roster jsonb;history jsonb;needed integer;win_points integer;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','bet','start','next')then raise exception 'Geçersiz avlu işlemi.';end if;
 p_args:=coalesce(p_args,'{}');
 select gold into balance from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus hesabı gerekli.';end if;
 select * into b from ludus_pit_private.bouts where owner_id=u order by created_at desc,id desc limit 1 for update;
 if not found then insert into ludus_pit_private.bouts(owner_id)values(u)returning * into b;end if;
 if b.status='running' and t>=b.finish_at then
  b.payout:=case when b.selected=b.winner then floor(b.stake*b.odds)::bigint else 0 end;
  update public.ludus_accounts set gold=gold+b.payout where user_id=u;
  update ludus_pit_private.bouts set status='settled',payout=b.payout where id=b.id returning * into b;
 end if;
 if p_action<>'state' then
  if p_request is null then raise exception 'İşlem kimliği gerekli.';end if;
  select * into r from ludus_pit_private.receipts where owner_id=u and request_id=p_request;
  if found then
   if r.action<>p_action or r.args<>p_args then raise exception 'İşlem kimliği başka istekte kullanıldı.';end if;
  else
   if p_args->>'bout' is distinct from b.id::text then raise exception 'Müsabaka değişti. Gişeyi yenile.';end if;
   if p_action='bet' then
    if b.status<>'open' or b.selected is not null then raise exception 'Bu müsabakaya bahis kapanmış.';end if;
    choice:=(p_args->>'fighter')::int;amount:=(p_args->>'stake')::int;
    if choice is null or (choice<0 or choice>=b.participants) or amount is null or amount not between 10 and 1000 or amount%10<>0 then raise exception 'Gladyatör seç; 10–1.000 arası, 10 katı denarius gir.';end if;
    update public.ludus_accounts set gold=gold-amount where user_id=u and gold>=amount;
    if not found then raise exception 'Denarius yetersiz.';end if;
    update ludus_pit_private.bouts set selected=choice,stake=amount where id=b.id returning * into b;
   elsif p_action='start' then
    if b.status<>'open' then raise exception 'Müsabaka zaten başladı.';end if;
    update ludus_pit_private.bouts set status='running',winner=floor(random()*b.participants)::int,started_at=t,finish_at=t+interval '45 seconds' where id=b.id returning * into b;
   elsif p_action='next' then
    if b.status<>'settled' then raise exception 'Önce mevcut müsabaka bitmeli.';end if;
    insert into ludus_pit_private.bouts(owner_id)values(u)returning * into b;
   end if;
   insert into ludus_pit_private.receipts values(u,p_request,p_action,p_args);
  end if;
 end if;
 select entry_fame,win_fame into needed,win_points from ludus_pit_private.rules where id;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'class',g.class,'fame',coalesce(f.points,0)) order by g.created_at,g.id),'[]') into roster from public.ludus_gladiators g left join ludus_pit_private.fame f on f.gladiator_id=g.id where g.owner_id=u;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]')into history from(select id,selected,stake,odds,winner,payout,created_at from ludus_pit_private.bouts where owner_id=u and status='settled' and selected is not null order by created_at desc limit 5)x;
 return jsonb_build_object('gold',(select gold from public.ludus_accounts where user_id=u),'entry_fame',needed,'win_fame',win_points,'roster',roster,'history',history,'server_now',t,'bout',jsonb_build_object('id',b.id,'participants',b.participants,'status',b.status,'selected',b.selected,'stake',b.stake,'odds',b.odds,'started_at',b.started_at,'finish_at',b.finish_at,'winner',case when b.status='settled' then b.winner else null end,'payout',b.payout));
end $function$
;
revoke all on function ludus_pit_private.loan(text) from public,anon,authenticated;
revoke all on function ludus_pit_private.start(uuid,jsonb,uuid) from public,anon,authenticated;
commit;
