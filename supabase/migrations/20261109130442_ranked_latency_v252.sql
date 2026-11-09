-- Reuse the exact authoritative input rules for humans and bots in memory.
create or replace function ludus_ranked_match_private.apply_input_v252(p_players jsonb, p_index integer, p_input jsonb, ts timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $function$
declare r public.ludus_matches; u uuid;
 own jsonb; enemy jsonb; p jsonb; gear jsonb; arr jsonb; idx integer:=p_index; target_idx integer:=p_index; k integer; count_alive integer;
 mx double precision; mz double precision; dt double precision; len double precision; px double precision; pz double precision;
 dist double precision; best double precision; angle double precision; spawn double precision; radius double precision;
 wind double precision; active double precision; recover double precision; command_id text; wants_guard boolean; guard_eligible boolean; counter boolean; strike boolean; whip boolean; hp integer; last_hit timestamptz; win uuid; selected_weapon text; wanted text; dodge_command text; dodging boolean; dodge_eligible boolean; attack_region text; selected_hand text; stats jsonb; speed_factor float; turn float; wanted_angle float; throwing boolean; special_command text; thrown jsonb; throw_range float; attack_snapshot jsonb; evade_kind text; evade_cost int; evade_duration float;
begin
 r.players:=p_players; r.venue:='ranked'; own:=r.players->idx; u:=(own->>'owner')::uuid;
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
 return r.players;
end $function$;
revoke all on function ludus_ranked_match_private.apply_input_v252(jsonb,integer,jsonb,timestamptz) from public,anon,authenticated;

do $patch$
declare src text:=pg_get_functiondef('ludus_ranked_match_private.match_step(text,uuid,uuid,jsonb,jsonb)'::regprocedure);
 needle text:=$input$   if jsonb_typeof(p_input)<>'object' or coalesce(jsonb_typeof(p_input->'x'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'z'),'number')<>'number' or coalesce(jsonb_typeof(p_input->'attack'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'block'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'special'),'boolean')<>'boolean' or coalesce(jsonb_typeof(p_input->'target'),'string')<>'string' then raise exception 'Geçersiz kontrol.'; end if;
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
   r.players:=jsonb_set(r.players,array[idx::text],own);$input$;
begin
 if position(needle in src)=0 then raise exception 'Unexpected ranked input handler';end if;
 src:=replace(src,needle,'   r.players:=ludus_ranked_match_private.apply_input_v252(r.players,idx,p_input,ts);');
 -- A match row already serializes its inputs. Taking the economy account lock
 -- on every movement request needlessly blocks behind worker/economy updates.
 src:=replace(src,' perform 1 from public.ludus_accounts where user_id=u for update;','');
 execute src;
end $patch$;

create or replace function ludus_bot_private.ranked_tick_v249(p_match uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $function$
declare session_row ludus_bot_private.ranked_sessions_v249;room public.ludus_matches;bot_user uuid;player jsonb;enemy jsonb;
 ts timestamptz:=clock_timestamp();idx integer; failures text;
begin
 if p_user is null or p_user is distinct from auth.uid() then return;end if;
 select s.* into session_row from ludus_bot_private.ranked_sessions_v249 s join public.ludus_matches m on m.id=s.match_id
  where s.match_id=p_match and not p_user=any(s.bot_users)
  and exists(select 1 from jsonb_array_elements(m.players) f where f->>'owner'=p_user::text) for update of s;
 if not found or session_row.last_tick>ts-interval '120 milliseconds' then return;end if;
 select * into room from public.ludus_matches where id=p_match for update;
 if not found or room.venue<>'ranked' or room.status not in('waiting','playing') then return;end if;
 if room.status='waiting' then
  select jsonb_agg(case when (p->>'owner')::uuid=any(session_row.bot_users)
   then p||jsonb_build_object('seen',ts,'ranked_joined',true) else p end order by ord)
   into room.players from jsonb_array_elements(room.players) with ordinality x(p,ord);
 else
  foreach bot_user in array session_row.bot_users loop
   select (ord-1)::integer,p into idx,player from jsonb_array_elements(room.players) with ordinality x(p,ord)
    where p->>'owner'=bot_user::text and coalesce((p->>'hp')::numeric,0)>0;
   if not found then continue;end if;
   select p into enemy from jsonb_array_elements(room.players) p where p->>'ranked_team'<>player->>'ranked_team' and coalesce((p->>'hp')::numeric,0)>0
    order by power((p->>'x')::float-(player->>'x')::float,2)+power((p->>'z')::float-(player->>'z')::float,2)
     -case when p->>'strike_target'=bot_user::text then 1.5 else 0 end,p->>'owner' limit 1;
   if not found then continue;end if;
   begin
    room.players:=ludus_ranked_match_private.apply_input_v252(room.players,idx,ludus_bot_private.tactics_v249(player,enemy,ts),ts);
    room.players:=jsonb_set(room.players,array[idx::text],(room.players->idx)||jsonb_build_object('seen',ts,'ranked_joined',true));
   exception when others then failures:=left(sqlerrm,200);end;
  end loop;
 end if;
 update public.ludus_matches set players=room.players,updated_at=ts where id=room.id;
 update ludus_bot_private.ranked_sessions_v249 set last_tick=ts,last_error=failures where match_id=p_match;
end $function$;
revoke all on function ludus_bot_private.ranked_tick_v249(uuid,uuid) from public,anon,authenticated;

-- Opt-in compact responses preserve V251 clients during rolling deployment.
create or replace function public.ludus_ranked_match_v252(p_action text,p_room uuid default null,p_gladiator uuid default null,p_slots jsonb default '{}'::jsonb,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $function$
declare answer jsonb; packed jsonb:='[]'; p jsonb; view jsonb;
 keys text[]:=array['owner','x','z','angle','hp','maxHp','maxStamina','stamina','move','block','gear_serial','serial','defense_serial','last_defense','defense_from','hit_region','hit_from','strike_region','strike_weapon','strike_hand','wind','active','recover','swing_at','swing_end','recoil_until','recoil_elapsed','recoil_at','stagger_until','throw_until','throw_at','throw_hand','throw_weapon','dodge_until','dodge_kind','dodge_dx','dodge_dz','dodge_at','counter_until','counter_target','cooldown_until','special_at','pull_from','pull_target','left','seen','ranked_joined','tick_at'];
begin
 answer:=public.ludus_ranked_match_v248(p_action,p_room,p_gladiator,p_slots,p_input);
 if p_action<>'step' or answer->>'status'<>'playing' then return answer;end if;
 for p in select value from jsonb_array_elements(answer->'players') loop
  select jsonb_object_agg(key,value) into view from jsonb_each(p) where key=any(keys) and value<>'null'::jsonb;
  view:=view||jsonb_build_object('movement_speed',3.5*coalesce((p->'combat_stats'->>'speed')::float,1)*(.85+.15*coalesce((p->>'acceleration_progress')::float,0)));
  if jsonb_typeof(p->'projectile')='object' then view:=view||jsonb_build_object('projectile',p->'projectile'-'attacker');end if;
  if coalesce((p->>'gear_serial')::int,0)>0 then
   view:=view||jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('kind',i->'kind','model',i->'model','equipped_slot',i->'equipped_slot','enhancement',i->'enhancement')),'[]'::jsonb) from jsonb_array_elements(p->'items') i));
  end if;
  packed:=packed||jsonb_build_array(view);
 end loop;
 return (answer-'players')||jsonb_build_object('players',packed,'delta_version',252);
end $function$;
revoke all on function public.ludus_ranked_match_v252(text,uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.ludus_ranked_match_v252(text,uuid,uuid,jsonb,jsonb) to authenticated;

