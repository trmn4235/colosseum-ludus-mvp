-- V289: server-owned injury evidence and one outcome per existing exercise event.
-- The existing fatigue gate (0 or .25) and raid defeat gate (1) are unchanged.
create table ludus_infirmary_private.event_contexts_v289(
 source_type text not null,source_id uuid not null,gladiator_id uuid not null references public.ludus_gladiators(id)on delete cascade,
 owner_id uuid not null references public.ludus_accounts(user_id)on delete cascade,
 started_at timestamptz not null,doctor_ids text[] not null default '{}',flags jsonb not null default '{}',
 return_injuries jsonb not null default '[]',outcome jsonb,completed_at timestamptz,
 primary key(source_type,source_id,gladiator_id)
);
create table ludus_infirmary_private.return_matches_v289(
 injury_id uuid primary key references ludus_infirmary_private.injuries(id)on delete cascade,
 source_type text not null,source_id uuid not null,gladiator_id uuid not null,
 consumed_at timestamptz not null,foreign key(source_type,source_id,gladiator_id)
 references ludus_infirmary_private.event_contexts_v289(source_type,source_id,gladiator_id)on delete cascade
);
alter table ludus_infirmary_private.event_contexts_v289 enable row level security;
alter table ludus_infirmary_private.return_matches_v289 enable row level security;
revoke all on ludus_infirmary_private.event_contexts_v289,ludus_infirmary_private.return_matches_v289 from public,anon,authenticated;

create function ludus_infirmary_private.begin_event_v289(p_source text,p_id uuid,p_gladiator uuid,p_owner uuid,p_at timestamptz,p_items jsonb default '[]')
returns void language plpgsql set search_path='' as $$
declare known text[];prior jsonb;flags jsonb:='{"exertion":true}';
begin
 if p_source not in('training','mission','battle','match','duel','caravan','clan')or p_id is null or p_at is null then raise exception 'Sakatlık kaynağı geçersiz.';end if;
 -- Autonomous bot accounts retain legacy healing until their medical AI exists.
 if exists(select 1 from ludus_bot_private.members_v233 where user_id=p_owner)then return;end if;
 perform 1 from public.ludus_gladiators where id=p_gladiator and owner_id=p_owner for update;if not found then raise exception 'Gladyatör sahibi doğrulanamadı.';end if;
 select coalesce(array_agg(k.content_id),'{}')into known from ludus_staff_private.knowledge_v288 k
 join ludus_staff_private.papyrus_catalog_v288 c using(content_id)where k.owner_id=p_owner and c.role_id='doctor';
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'key',i.injury_key,'severity',i.severity,'bone',i.bone,'side',i.context->>'bone_side')),'[]')into prior
 from ludus_infirmary_private.injuries i where i.gladiator_id=p_gladiator and i.status='healed' and i.healed_at<=p_at
 and not exists(select 1 from ludus_infirmary_private.return_matches_v289 r where r.injury_id=i.id);
 if p_source in('battle','match','duel','caravan','clan')and exists(select 1 from jsonb_array_elements(coalesce(p_items,'[]'))x where x->>'equipped_slot'='gloves' or x->>'model' in('manica_segmented','manica_leather','manica_lion'))then
  flags:=flags||'{"armor_chafe":true}'::jsonb;
 end if;
 insert into ludus_infirmary_private.event_contexts_v289(source_type,source_id,gladiator_id,owner_id,started_at,doctor_ids,flags,return_injuries)
 values(p_source,p_id,p_gladiator,p_owner,p_at,known,flags,prior)on conflict do nothing;
end $$;

-- Candidate eligibility is physical evidence, not a client-selected injury type.
create function ludus_infirmary_private.candidates_v289(p_flags jsonb)
returns text[] language sql immutable set search_path='' as $$
 select array_agg(key order by key)from(values
 ('mild_calf_strain','exertion'),('shoulder_chafing','armor_chafe'),('ankle_sprain','movement'),
 ('knee_abrasion','fall'),('eyebrow_laceration','head_hit'),('shoulder_contusion','shoulder_hit'),
 ('deep_forearm_laceration','arm_hit'),('rib_contusion','torso_hit'),('closed_forearm_fracture','arm_hit'),
 ('closed_tibia_fracture','leg_hit'),('open_tibia_fracture','leg_hit'),('comminuted_femur_fracture','heavy_leg_hit'),
 ('pelvic_fracture','hard_fall'),('severe_head_trauma','head_hit'),('internal_abdominal_bleeding','heavy_torso_hit'))v(key,flag)
 where coalesce((p_flags->>flag)::boolean,false)
$$;
create function ludus_infirmary_private.roll_v289()returns double precision language sql volatile set search_path='' as $$select random()$$;
create function ludus_infirmary_private.prevent_v289(p_key text,p_known text[],p_prior jsonb,p_real_match boolean,p_side text default null)
returns text language plpgsql immutable set search_path='' as $$
declare candidate text;old jsonb;bone text;
begin
 candidate:=case p_key when 'shoulder_chafing'then 'doctor_011' when 'mild_calf_strain'then 'doctor_012'
 when 'ankle_sprain'then 'doctor_013' when 'knee_abrasion'then 'doctor_016' when 'eyebrow_laceration'then 'doctor_017'
 when 'shoulder_contusion'then 'doctor_018' when 'pelvic_fracture'then 'doctor_022' when 'internal_abdominal_bleeding'then 'doctor_023'end;
 if candidate=any(p_known)then return candidate;end if;
 if not p_real_match then return null;end if;
 bone:=case p_key when 'closed_forearm_fracture'then 'forearm' when 'closed_tibia_fracture'then 'tibia'when 'open_tibia_fracture'then 'tibia'when 'comminuted_femur_fracture'then 'femur'when 'pelvic_fracture'then 'pelvis'end;
 for old in select value from jsonb_array_elements(p_prior)loop
  if bone is not null and old->>'bone'=bone and (bone='pelvis' or (p_side is not null and old->>'side'=p_side)) and 'doctor_014'=any(p_known)then return 'doctor_014';end if;
  if p_key='severe_head_trauma'and old->>'key'=p_key and 'doctor_015'=any(p_known)then return 'doctor_015';end if;
  if p_key in('open_tibia_fracture','comminuted_femur_fracture','pelvic_fracture','severe_head_trauma','internal_abdominal_bleeding')
   and old->>'severity'='heavy'and old->>'key'<>p_key and 'doctor_024'=any(p_known)then return 'doctor_024';end if;
 end loop;return null;
end $$;

create function ludus_infirmary_private.outcome_v289(p_source text,p_id uuid,p_gladiator uuid,p_risk numeric,p_real_match boolean,p_at timestamptz)
returns jsonb language plpgsql set search_path='' as $$
declare e ludus_infirmary_private.event_contexts_v289;choices text[];chosen text;original text;protection text;bone_side text;result jsonb;prior jsonb:='[]';old jsonb;claimed boolean;
begin
 select * into e from ludus_infirmary_private.event_contexts_v289 where source_type=p_source and source_id=p_id and gladiator_id=p_gladiator for update;
 -- In-flight events started before deployment keep their original untyped outcome.
 if not found then return jsonb_build_object('legacy',true,'injured',p_risk>0 and ludus_infirmary_private.roll_v289()<p_risk);end if;
 if e.outcome is not null then return e.outcome;end if;
 if p_risk is null or p_risk not between 0 and 1 then raise exception 'Sakatlık olasılığı geçersiz.';end if;
 if p_real_match and p_source in('battle','match','duel','caravan','clan')then
  for old in select value from jsonb_array_elements(e.return_injuries)loop
   insert into ludus_infirmary_private.return_matches_v289(injury_id,source_type,source_id,gladiator_id,consumed_at)
   values((old->>'id')::uuid,p_source,p_id,p_gladiator,p_at)on conflict do nothing;claimed:=found;
   if claimed then prior:=prior||jsonb_build_array(old);end if;
  end loop;
 end if;
 result:=jsonb_build_object('version',289,'injured',false,'baseline_risk',p_risk,'evidence_source',case when p_source='caravan'then 'server_replay'when p_source in('match','duel')then 'server_pvp'else 'server_exercise'end,
 'flags',e.flags,'first_return',prior,'real_match',p_real_match);
 if p_risk>0 and ludus_infirmary_private.roll_v289()<p_risk then
  choices:=ludus_infirmary_private.candidates_v289(e.flags);
  if cardinality(choices)>0 then
   chosen:=choices[1+floor(ludus_infirmary_private.roll_v289()*cardinality(choices))::integer];original:=chosen;
   if chosen='closed_forearm_fracture'then
    if coalesce((e.flags->>'arm_left_hit')::boolean,false)<>coalesce((e.flags->>'arm_right_hit')::boolean,false)then bone_side:=case when(e.flags->>'arm_left_hit')::boolean then 'left'else 'right'end;end if;
   elsif chosen in('closed_tibia_fracture','open_tibia_fracture','comminuted_femur_fracture')then
    if coalesce((e.flags->>'leg_left_hit')::boolean,false)<>coalesce((e.flags->>'leg_right_hit')::boolean,false)then bone_side:=case when(e.flags->>'leg_left_hit')::boolean then 'left'else 'right'end;end if;
   elsif chosen='pelvic_fracture'then bone_side:='midline';end if;
   protection:=ludus_infirmary_private.prevent_v289(chosen,e.doctor_ids,prior,p_real_match,bone_side);
   if protection is not null and ludus_infirmary_private.roll_v289()<.004 then
    result:=result||jsonb_build_object('prevented',true,'prevention_papyrus',protection,'original_injury',chosen);
   else
    if chosen='open_tibia_fracture'and p_real_match and 'doctor_021'=any(e.doctor_ids)and ludus_infirmary_private.roll_v289()<.004 then chosen:='closed_tibia_fracture';end if;
    result:=result||jsonb_build_object('injured',true,'injury_key',chosen,'bone_side',bone_side,'original_injury',original,'conversion_papyrus',case when chosen<>original then 'doctor_021'end);
   end if;
  end if;
 end if;
 update ludus_infirmary_private.event_contexts_v289 set outcome=result,completed_at=p_at where source_type=p_source and source_id=p_id and gladiator_id=p_gladiator;
 return result;
end $$;
create function ludus_infirmary_private.assign_outcome_v289(p_source text,p_id uuid,p_gladiator uuid,p_outcome jsonb)
returns void language plpgsql set search_path='' as $$
declare e ludus_infirmary_private.event_contexts_v289;
begin
 if p_outcome->>'injury_key'is null or not coalesce((p_outcome->>'injured')::boolean,false)then return;end if;
 select * into e from ludus_infirmary_private.event_contexts_v289 where source_type=p_source and source_id=p_id and gladiator_id=p_gladiator;
 if not found or e.outcome is distinct from p_outcome then raise exception 'Sakatlık sonucu doğrulanamadı.';end if;
 perform ludus_infirmary_private.assign_injury_v289(e.owner_id,p_gladiator,p_outcome->>'injury_key',p_source,p_id,p_outcome||jsonb_build_object('verified',true,'started_at',e.started_at));
end $$;

create function ludus_infirmary_private.exercise_begin_v289()returns trigger language plpgsql set search_path='' as $$
declare items jsonb:='[]';
begin
 if new.source='battle'then select snapshot->'items'into items from public.ludus_battles where id=new.source_id;
 elsif new.source='match'then select x->'items'into items from public.ludus_matches m cross join lateral jsonb_array_elements(m.players)x where m.id=new.source_id and x->'gladiator'->>'id'=new.gladiator_id::text;
 elsif new.source='duel'then select x->'items'into items from public.ludus_duels d cross join lateral jsonb_array_elements(jsonb_build_array(d.a,d.b))x where d.id=new.source_id and x->'gladiator'->>'id'=new.gladiator_id::text;end if;
 perform ludus_infirmary_private.begin_event_v289(new.source,new.source_id,new.gladiator_id,new.owner_id,new.started_at,coalesce(items,'[]'));
 return new;
end $$;
create trigger injury_exercise_begin_v289 after insert on ludus_private.exercise_events_v46 for each row execute function ludus_infirmary_private.exercise_begin_v289();

-- Observe only server-validated player rows. Clients have no table UPDATE grant.
create function ludus_infirmary_private.pvp_evidence_v289()returns trigger language plpgsql set search_path='' as $$
declare players jsonb;before_players jsonb;x jsonb;old_x jsonb;v_flags jsonb;source text;gid uuid;hit boolean;loss numeric;
begin
 if old.status<>'playing'then return new;end if;
 source:=case when tg_table_name='ludus_matches'then 'match'else 'duel'end;
 if source='match'then players:=new.players;before_players:=old.players;else players:=jsonb_build_array(new.a,new.b);before_players:=jsonb_build_array(old.a,old.b);end if;
 for x in select value from jsonb_array_elements(players)loop
  if x->'gladiator'->>'id'is null or coalesce((x->>'is_bot')::boolean,false)then continue;end if;
  gid:=(x->'gladiator'->>'id')::uuid;select v into old_x from jsonb_array_elements(before_players)v where v->>'owner'=x->>'owner';if old_x is null then continue;end if;
  v_flags:='{}';hit:=coalesce((x->>'hit_serial')::integer,0)>coalesce((old_x->>'hit_serial')::integer,0);
  loss:=greatest(0,coalesce((old_x->>'hp')::numeric,0)-coalesce((x->>'hp')::numeric,0));
  if abs(coalesce((x->>'x')::numeric,0)-coalesce((old_x->>'x')::numeric,0))+abs(coalesce((x->>'z')::numeric,0)-coalesce((old_x->>'z')::numeric,0))>.01 then v_flags:=v_flags||'{"movement":true}';end if;
  if hit and loss>0 then
   if x->>'hit_region'='head'then v_flags:=v_flags||'{"head_hit":true}';
   elsif x->>'hit_region'in('rightArm','leftArm')then v_flags:=v_flags||'{"arm_hit":true}'::jsonb||jsonb_build_object(case x->>'hit_region' when 'leftArm'then 'arm_left_hit'else 'arm_right_hit'end,true);
   elsif x->>'hit_region'in('legs','rightLeg','leftLeg')then v_flags:=v_flags||'{"leg_hit":true}';if x->>'hit_region'<>'legs'then v_flags:=v_flags||jsonb_build_object(case x->>'hit_region'when 'leftLeg'then 'leg_left_hit'else 'leg_right_hit'end,true);end if;
   elsif x->>'hit_region'='chest'then v_flags:=v_flags||'{"torso_hit":true}';end if;
   -- A server-computed loss of at least a quarter of maximum HP is a heavy impact.
   if coalesce((x->>'hit_serial')::integer,0)-coalesce((old_x->>'hit_serial')::integer,0)=1 and loss>=greatest(1,coalesce((x->>'maxHp')::numeric,100)*.25)then
    if x->>'hit_region'='chest'then v_flags:=v_flags||'{"heavy_torso_hit":true}';
    elsif x->>'hit_region'in('legs','rightLeg','leftLeg')then v_flags:=v_flags||'{"heavy_leg_hit":true}';end if;
   end if;
  end if;
  if x->>'knocked_at'is not null and x->>'knocked_at'is distinct from old_x->>'knocked_at'then
   v_flags:=v_flags||'{"fall":true}';
   if (x->>'knocked_until')::timestamptz>=(x->>'knocked_at')::timestamptz+interval '1.5 seconds'then v_flags:=v_flags||'{"hard_fall":true}';end if;
  end if;
  update ludus_infirmary_private.event_contexts_v289 set flags=event_contexts_v289.flags||v_flags where source_type=source and source_id=new.id and gladiator_id=gid and outcome is null;
 end loop;return new;
end $$;
create trigger injury_pvp_evidence_v289 before update on public.ludus_matches for each row execute function ludus_infirmary_private.pvp_evidence_v289();
create trigger injury_duel_evidence_v289 before update on public.ludus_duels for each row execute function ludus_infirmary_private.pvp_evidence_v289();

-- Preserve V51 daily growth, fatigue load, penalty and event receipt semantics.
do $patch$declare source text;begin
 select pg_get_functiondef('ludus_private.exercise_complete_v46(text,uuid,uuid,integer,text,timestamptz)'::regprocedure)into source;
 if position('new_injury:=e.injury_risk>0 and random()<e.injury_risk;'in source)=0 or position('new_injury boolean;'in source)=0 then raise exception 'Exercise injury hook differs from reviewed source';end if;
 source:=replace(source,'new_injury boolean;','new_injury boolean;injury_result jsonb;');
 source:=replace(source,'new_injury:=e.injury_risk>0 and random()<e.injury_risk;',
 'injury_result:=ludus_infirmary_private.outcome_v289(p_source,p_id,g.id,e.injury_risk,p_source in(''battle'',''match'',''duel'')and p_units>0,p_at);new_injury:=coalesce((injury_result->>''injured'')::boolean,false);');
 source:=replace(source,'update ludus_private.exercise_events_v46 set finished_at=p_at,injured=new_injury',
 'perform ludus_infirmary_private.assign_outcome_v289(p_source,p_id,g.id,injury_result);update ludus_private.exercise_events_v46 set finished_at=p_at,injured=new_injury');
 execute source;
end $patch$;

-- A raid's actual entry freezes doctor knowledge and healed-injury return rights.
create function ludus_infirmary_private.raid_begin_v289()returns trigger language plpgsql set search_path='' as $$
declare x jsonb;
begin
 if old.battle_started_at is null and new.battle_started_at is not null then
  for x in select value from jsonb_array_elements(new.team)loop
   perform ludus_infirmary_private.begin_event_v289('caravan',new.id,(x->>'id')::uuid,new.owner_id,new.battle_started_at,coalesce(x->'items','[]'));
  end loop;
 end if;return new;
end $$;
create trigger injury_raid_begin_v289 after update of battle_started_at on ludus_supply_private.raids_v124 for each row execute function ludus_infirmary_private.raid_begin_v289();

-- Called only by the authenticated Edge replay. No browser can submit injury flags.
create function ludus_infirmary_private.verified_raid_v289(p_owner uuid,p_raid uuid,p_won boolean,p_seconds numeric,p_stats jsonb,p_evidence jsonb,p_completed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j ludus_supply_private.raids_v124;x jsonb;entry jsonb;v_flags jsonb;result jsonb;v_outcome jsonb;gid uuid;allowed text[]:=array['movement','fall','hard_fall','head_hit','shoulder_hit','arm_hit','torso_hit','heavy_torso_hit','leg_hit','heavy_leg_hit','arm_left_hit','arm_right_hit','leg_left_hit','leg_right_hit'];k text;
begin
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 select * into j from ludus_supply_private.raids_v124 where id=p_raid and owner_id=p_owner for update;if not found then raise exception 'Baskın bulunamadı.';end if;
 if j.resolved_at is not null then return ludus_supply_private.raid_view_v124(j);end if;
 if p_evidence is null or jsonb_typeof(p_evidence)<>'array'or jsonb_array_length(p_evidence)<>cardinality(j.gladiators) or p_completed is null then raise exception 'Savaş olayları doğrulanamadı.';end if;
 if(select count(distinct v->>'id')from jsonb_array_elements(p_evidence)v)<>cardinality(j.gladiators)then raise exception 'Savaş katılımcıları yinelenmiş.';end if;
 for x in select value from jsonb_array_elements(p_evidence)loop
  gid:=(x->>'id')::uuid;if not gid=any(j.gladiators)then raise exception 'Savaş katılımcısı doğrulanamadı.';end if;
  v_flags:='{}';for k in select unnest(allowed)loop
   if x->'flags'?k and jsonb_typeof(x->'flags'->k)<>'boolean'then raise exception 'Savaş olayı geçersiz.';end if;
   if coalesce((x->'flags'->>k)::boolean,false)then v_flags:=v_flags||jsonb_build_object(k,true);end if;
  end loop;
  update ludus_infirmary_private.event_contexts_v289 set flags=event_contexts_v289.flags||v_flags where source_type='caravan'and source_id=p_raid and gladiator_id=gid and outcome is null;
 end loop;
 -- Existing verifier validates elapsed time, result receipt, equipment, loot and career.
 result:=public.ludus_caravan_verified_v162(p_owner,p_raid,p_won,p_seconds,p_stats);
 for gid in select unnest(j.gladiators)loop
  v_outcome:=ludus_infirmary_private.outcome_v289('caravan',p_raid,gid,case when p_won then 0 else 1 end,p_completed and p_seconds>=10,clock_timestamp());
  if not coalesce((v_outcome->>'legacy')::boolean,false)then
   if(v_outcome->>'injured')::boolean then perform ludus_infirmary_private.assign_outcome_v289('caravan',p_raid,gid,v_outcome);
   elsif not p_won then update public.ludus_gladiators set status='available',injury_level=0,injured_until=null where id=gid and owner_id=p_owner;end if;
  end if;
 end loop;
 return result;
end $$;
create function public.ludus_caravan_verified_v289(p_owner uuid,p_raid uuid,p_won boolean,p_seconds numeric,p_stats jsonb,p_evidence jsonb,p_completed boolean)
returns jsonb language sql security invoker set search_path='' as $$select ludus_infirmary_private.verified_raid_v289(p_owner,p_raid,p_won,p_seconds,p_stats,p_evidence,p_completed)$$;
revoke all on function public.ludus_caravan_verified_v289(uuid,uuid,boolean,numeric,jsonb,jsonb,boolean),ludus_infirmary_private.verified_raid_v289(uuid,uuid,boolean,numeric,jsonb,jsonb,boolean)from public,anon,authenticated;
grant usage on schema ludus_infirmary_private to service_role;
grant execute on function public.ludus_caravan_verified_v289(uuid,uuid,boolean,numeric,jsonb,jsonb,boolean),ludus_infirmary_private.verified_raid_v289(uuid,uuid,boolean,numeric,jsonb,jsonb,boolean)to service_role;
revoke all on function ludus_infirmary_private.begin_event_v289(text,uuid,uuid,uuid,timestamptz,jsonb),ludus_infirmary_private.candidates_v289(jsonb),ludus_infirmary_private.roll_v289(),ludus_infirmary_private.prevent_v289(text,text[],jsonb,boolean,text),ludus_infirmary_private.outcome_v289(text,uuid,uuid,numeric,boolean,timestamptz),ludus_infirmary_private.assign_outcome_v289(text,uuid,uuid,jsonb),ludus_infirmary_private.exercise_begin_v289(),ludus_infirmary_private.pvp_evidence_v289(),ludus_infirmary_private.raid_begin_v289()from public,anon,authenticated;
update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active',runtime_reason=null,
 runtime_note='Mevcut sakatlanma olasılığı korunur; darbe ve düşüş koşulları sunucuda doğrulanır. Dönüş koruması iyileşmeden sonraki ilk tamamlanan maçta bir kez uygulanır.'
where content_id in('doctor_011','doctor_012','doctor_013','doctor_014','doctor_015','doctor_016','doctor_017','doctor_018','doctor_021','doctor_022','doctor_023','doctor_024');

update ludus_staff_private.papyrus_catalog_v288 set runtime_note='Omuz koruması kervan avının sunucuda tekrar oynatılan gerçek üstkol/omuz silah temasında uygulanır; genel kol darbesi omuz darbesi sayılmaz.'where content_id='doctor_018';
