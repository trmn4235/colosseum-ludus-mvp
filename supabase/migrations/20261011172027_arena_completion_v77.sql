-- V77: settled-menu morale is frozen by owner-validated battle entry points.
begin;
create or replace function ludus_food_private.combat_snapshot_v77(p_owner uuid)
returns jsonb language plpgsql set search_path='' as $$
declare bonus numeric; morale numeric:=50;
begin
 bonus:=ludus_food_private.combat_bonus_v60(p_owner);
 select coalesce((last_menu->>'morale')::numeric,50) into morale from public.ludus_food_house
 where owner_id=p_owner and settled_day=(clock_timestamp() at time zone 'Europe/Istanbul')::date-1;
 return jsonb_build_object('combat_stamina_bonus',bonus,'combat_morale',least(100,greatest(0,coalesce(morale,50))));
end;$$;
revoke all on function ludus_food_private.combat_snapshot_v77(uuid) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ludus_start_battle_v2(p_gladiator uuid, p_mode text, p_slots jsonb, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();g public.ludus_gladiators;it public.ludus_items;kv record;bid uuid;snap jsonb;pool jsonb:='[]';used uuid[]:='{}';entry jsonb;cls text;weapon text;shield text;actor integer;slot text;kind text;model text;b public.ludus_battles;
begin
 if uid is null or p_request is null then raise exception 'Giriş ve işlem kimliği gerekli'; end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;if not found then raise exception 'Ludus bulunamadı';end if;
 select * into b from public.ludus_battles where owner_id=uid and start_request_id=p_request;
 if found then return jsonb_build_object('id',b.id,'mode',b.mode,'snapshot',b.snapshot);end if;
 if exists(select 1 from public.ludus_battles where owner_id=uid and finished_at is null) then raise exception 'Devam eden savaşın var. Önce devam et veya savaştan çekil.';end if;
 if p_mode is null or p_mode not in ('4x5','solo20') then raise exception 'Geçersiz mod';end if;
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
  if not ((kv.key='main_hand' and it.kind='weapon' and it.model in ('gladius','sica','spear','trident','mace','whip')) or (kv.key='off_hand' and it.kind in ('weapon','shield')) or (kv.key=it.kind and kv.key in ('helmet','chest','gloves','legs'))) then raise exception 'Eşya bu yuvaya uygun değil';end if;
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
 for actor in 1..19 loop
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
 insert into public.ludus_battles(owner_id,gladiator_id,mode,snapshot,rule_version,start_request_id,loot) values(uid,g.id,p_mode,snap,2,p_request,pool) returning id into bid;
 update public.ludus_items set locked_battle_id=bid where id=any(used);
 return jsonb_build_object('id',bid,'mode',p_mode,'snapshot',snap);
end $function$
;
CREATE OR REPLACE FUNCTION public.ludus_match(p_action text, p_room uuid DEFAULT NULL::uuid, p_gladiator uuid DEFAULT NULL::uuid, p_slots jsonb DEFAULT '{}'::jsonb, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid:=auth.uid(); ts timestamptz:=clock_timestamp(); r public.ludus_matches; g public.ludus_gladiators;
 own jsonb; enemy jsonb; p jsonb; gear jsonb; arr jsonb; idx integer; target_idx integer; k integer; count_alive integer;
 mx double precision; mz double precision; dt double precision; len double precision; px double precision; pz double precision;
 dist double precision; best double precision; angle double precision; spawn double precision; radius double precision;
 wind double precision; active double precision; recover double precision; command_id text; wants_guard boolean; guard_eligible boolean; counter boolean; strike boolean; whip boolean; hp integer; last_hit timestamptz; win uuid; selected_weapon text; wanted text; dodge_command text; dodging boolean; dodge_eligible boolean; attack_region text; selected_hand text; stats jsonb; speed_factor float; turn float; wanted_angle float; throwing boolean; special_command text; thrown jsonb; throw_range float; attack_snapshot jsonb;
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
   select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('equipped_slot',e.key)),'[]') into gear from jsonb_each_text(p_slots)e join public.ludus_items i on i.id::text=e.value and i.owner_id=u and i.locked_battle_id is null and i.clan_vault_id is null and i.clan_roster_id is null where e.key in('main_hand','off_hand','helmet','chest','gloves','legs') and ((e.key='main_hand' and i.kind='weapon')or(e.key='off_hand' and i.kind in('weapon','shield'))or e.key=i.kind);
   if jsonb_array_length(gear)<>(select count(*) from jsonb_object_keys(p_slots)) or (select count(distinct f->>'id') from jsonb_array_elements(gear) f)<>jsonb_array_length(gear) then raise exception 'Ekipman seçimini yenile.'; end if;
   own:=jsonb_build_object('owner',u,'name',g.name,'class',g.class,'gladiator',to_jsonb(g)||ludus_food_private.combat_snapshot_v77(u),'items',gear,'x',0,'z',0,'angle',0,'hp',100,'maxHp',100,'maxStamina',100,'stamina',100,'stamina_at',ts,'block',false,'serial',0,'move',0,'seen',ts,'hit_at',null,'special_at',null,'pull_until',null,'pull_from',null,'pull_serial',0);
   stats:=private.ludus_combat_stats_v73(own->'gladiator',gear);
   own:=own||jsonb_build_object('stats_version',77,'combat_stats',stats,'hp',(stats->>'maxHp')::numeric::int,'maxHp',(stats->>'maxHp')::numeric::int,'stamina',(stats->>'maxStamina')::numeric::int,'maxStamina',(stats->>'maxStamina')::numeric::int);
   select m.* into r from public.ludus_matches m where m.status='waiting' and not exists(select 1 from jsonb_array_elements(m.players) f where coalesce((f->>'stats_version')::int,0)<>77) and m.starts_at>ts and m.updated_at>ts-interval '30 seconds' order by m.created_at limit 1 for update;
   if found then update public.ludus_matches set players=r.players||jsonb_build_array(own),updated_at=ts where id=r.id returning * into r;
   else insert into public.ludus_matches(players,starts_at,updated_at) values(jsonb_build_array(own),ts+interval '10 seconds',ts) returning * into r; end if;
  end if;
 else
  select m.* into r from public.ludus_matches m where m.id=p_room and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=u::text) for update;
  if not found then raise exception 'Bu maça erişemezsin.'; end if;
 end if;
 ts:=clock_timestamp();
 if r.status='playing' then r.players:=private.ludus_advance_combat_v36(r.players,ts);r.players:=private.ludus_resolve_combat_v36(r.players,ts);r.players:=private.ludus_projectiles_v76(r.players,ts); end if;
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
    if jsonb_array_length(r.players)>=2 then
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
   len:=greatest(1,sqrt(px*px+pz*pz)/10.5); px:=px/len; pz:=pz/len;
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
   dodge_command:=coalesce(p_input->>'dodge_id','');
   dodge_eligible:=own->>'pull_from' is null and coalesce((own->>'stamina')::float,100)>=25
    and coalesce((own->>'swing_end')::timestamptz,'epoch')<=ts and coalesce((own->>'recoil_until')::timestamptz,'epoch')<=ts
    and coalesce((own->>'stagger_until')::timestamptz,'epoch')<=ts and coalesce((own->>'dodge_until')::timestamptz,'epoch')<=ts;
   dodging:=coalesce((p_input->>'dodge')::boolean,false) and dodge_command<>'' and dodge_command is distinct from own->>'last_dodge_command' and dodge_eligible;
   if coalesce((p_input->>'dodge')::boolean,false) and dodge_command<>'' then own:=own||jsonb_build_object('last_dodge_command',dodge_command); end if;
   if dodging then
    len:=sqrt(mx*mx+mz*mz);
    own:=own||jsonb_build_object('dodge_at',ts,'dodge_until',ts+interval '460 milliseconds','dodge_tick_at',ts,'dodge_serial',coalesce((own->>'dodge_serial')::int,0)+1,
     'dodge_dx',case when len>.01 then mx/len else -sin(angle) end,'dodge_dz',case when len>.01 then mz/len else -cos(angle) end,
     'stamina',greatest(0,coalesce((own->>'stamina')::float,100)-25),'stamina_regen_at',ts+interval '1 second');
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
    wind:=case selected_weapon when 'gladius' then .26 when 'sica' then .22 when 'spear' then .30 when 'trident' then .34 when 'mace' then .40 when 'whip' then .32 else .24 end;
    active:=case selected_weapon when 'sica' then .20 when 'trident' then .23 when 'mace' then .26 when 'whip' then .24 else .22 end;
    recover:=case selected_weapon when 'gladius' then .32 when 'sica' then .28 when 'spear' then .34 when 'trident' then .37 when 'mace' then .43 when 'whip' then .36 else .28 end;
    if coalesce((own->>'stats_version')::int,0) in (73,74,75,76,77) then
     speed_factor:=greatest(.01,coalesce((own->'combat_stats'->>'attack_speed')::float,1));
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
 update public.ludus_matches set players=r.players,status=r.status,starts_at=r.starts_at,winner=r.winner,updated_at=ts where id=r.id;
 return jsonb_build_object('id',r.id,'status',r.status,'starts_at',r.starts_at,'server_now',ts,'players',r.players,'winner',r.winner,'combat_version',23,'controls_version',case when coalesce((r.players->0->>'stats_version')::int,0)>=77 then 77 when coalesce((r.players->0->>'stats_version')::int,0)>=76 then 76 else 36 end,'stats_version',coalesce((r.players->0->>'stats_version')::int,0));
end; $function$
;
CREATE OR REPLACE FUNCTION private.ludus_resolve_combat_v36(p_players jsonb, p_now timestamp with time zone)
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
   where f->>'owner'=a->>'strike_target' and (f->>'hp')::int>0;
  if found then
   v:=players->vi; weapon:=a->>'strike_weapon';
   reach:=case weapon when 'spear' then 2.65 when 'trident' then 2.55 when 'mace' then 1.95 when 'whip' then 1.90 when 'gladius' then 1.85 when 'sica' then 1.85 else 1.10 end;
   distance:=sqrt(power((a->>'x')::float-(v->>'x')::float,2)+power((a->>'z')::float-(v->>'z')::float,2));
   facing:=atan2((v->>'x')::float-(a->>'x')::float,(v->>'z')::float-(a->>'z')::float)-(a->>'angle')::float;
   facing:=abs(atan2(sin(facing),cos(facing)));
   if distance<=reach and facing<=1.05 and not (coalesce((v->>'dodge_at')::timestamptz,'epoch')<=impact and coalesce((v->>'dodge_at')::timestamptz,'epoch')+interval '370 milliseconds'>impact) then
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
     if perfect then v:=v||jsonb_build_object('guard_at',null,'counter_until',p_now+interval '700 milliseconds','counter_target',a->>'owner'); end if;
    else
     amount:=case when coalesce((a->>'strike_counter')::boolean,false) then 17 else 14 end;
     outcome:=case when amount=17 then 'counter' else 'hit' end;
     if coalesce((a->>'stats_version')::int,0) in (73,74,75,76,77) then
      hit:=private.ludus_hit_v73(a,v,weapon,coalesce(a->>'strike_hand','main_hand'),amount,random()::numeric,random()::numeric);
      amount:=(hit->>'damage')::int;
      if (hit->>'critical')::boolean then outcome:='critical';end if;
     end if;
     v:=v||jsonb_build_object('hp',greatest(0,(v->>'hp')::int-amount),'hit_serial',coalesce((v->>'hit_serial')::int,0)+1,'hit_from',a->>'owner','hit_time',p_now,'hit_impact_at',impact,'hit_region',coalesce(a->>'strike_region','chest'),'block',false,'guard_at',null);
    end if;
    players:=jsonb_set(players,array[vi::text],v);
   end if;
  end if;
  a:=a||jsonb_build_object('attack_result',outcome);players:=jsonb_set(players,array[ai::text],a);
 end loop;
 return players;
end; $function$
;
CREATE OR REPLACE FUNCTION private.ludus_advance_combat_v36(p_players jsonb, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 arr jsonb:='[]'; p jsonb; energy float; dt float; tick timestamptz; finish timestamptz; px float; pz float; len float; cap float; health_cap int; fraction float; healed int; extra jsonb; modern boolean;
begin
 for p in select value from jsonb_array_elements(p_players) loop
  if coalesce((p->>'hp')::int,0)>0 then
   modern:=coalesce((p->>'stats_version')::int,0) in (73,74,75,76,77);
   extra:=case when modern then p->'combat_stats'->'items' else '{}'::jsonb end;
   cap:=case when modern then greatest(1,coalesce((p->>'maxStamina')::float,100)) else 100 end;
   health_cap:=greatest(1,coalesce((p->>'maxHp')::int,100));
   tick:=coalesce((p->>'stamina_at')::timestamptz,p_now);
   dt:=greatest(0,least(2,extract(epoch from p_now-tick)));
   energy:=least(cap,greatest(0,coalesce((p->>'stamina')::float,cap)));
   if coalesce((p->>'block')::boolean,false) then energy:=greatest(0,energy-dt*2);
   elsif coalesce((p->>'swing_end')::timestamptz,'epoch')<=p_now and coalesce((p->>'dodge_until')::timestamptz,'epoch')<=p_now
    and (not modern or (p->>'pull_from' is null and coalesce((p->>'stagger_until')::timestamptz,'epoch')<=p_now and coalesce((p->>'recoil_until')::timestamptz,'epoch')<=p_now)) then
    dt:=greatest(0,least(dt,extract(epoch from p_now-greatest(tick,coalesce((p->>'stamina_regen_at')::timestamptz,tick)))));
    energy:=least(cap,energy+dt*(16+greatest(0,least(8,coalesce((extra->>'stamina_regeneration')::float,0))))*.65*(1+least(12,greatest(0,coalesce((p->'gladiator'->>'combat_stamina_bonus')::numeric,0)))/100)*(1+(least(100,greatest(0,coalesce((p->'gladiator'->>'combat_morale')::numeric,50)))-50)/1000));
    if modern then
     -- Keep fractional healing between ticks; hp remains an integer for existing clients.
     fraction:=coalesce((p->>'hp_regen_fraction')::float,0)+dt*greatest(0,least(2,coalesce((extra->>'hp_regeneration')::float,0)));
     healed:=least(health_cap,(p->>'hp')::int+floor(fraction)::int);
     p:=p||jsonb_build_object('hp',healed,'hp_regen_fraction',case when healed>=health_cap then 0 else fraction-floor(fraction) end);
    end if;
   end if;
   p:=p||jsonb_build_object('stamina',energy,'maxStamina',cap,'stamina_at',p_now);
   if energy<=0 then p:=p||jsonb_build_object('block',false,'guard_at',null); end if;
   if p->>'dodge_until' is not null and p->>'dodge_tick_at' is not null then
    finish:=least(p_now,(p->>'dodge_until')::timestamptz);
    dt:=greatest(0,least(.46,extract(epoch from finish-(p->>'dodge_tick_at')::timestamptz)));
    if dt>0 and p->>'pull_from' is null then
     px:=(p->>'x')::float+coalesce((p->>'dodge_dx')::float,0)*7.5*dt*(1+greatest(0,least(.25,coalesce((extra->>'dodge_distance')::float,0)/100)));pz:=(p->>'z')::float+coalesce((p->>'dodge_dz')::float,0)*7.5*dt*(1+greatest(0,least(.25,coalesce((extra->>'dodge_distance')::float,0)/100)));
     len:=greatest(1,sqrt(px*px+pz*pz)/10.5);
     p:=p||jsonb_build_object('x',px/len,'z',pz/len,'move',0,'block',false,'dodge_tick_at',finish);
    end if;
   end if;
  end if;
  arr:=arr||jsonb_build_array(p);
 end loop;
 return arr;
end; $function$
;
commit;
