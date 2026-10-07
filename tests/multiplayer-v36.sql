-- Generated fixtures only. All rows and match changes roll back.
begin;
do $$
declare
 ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 rid uuid:=gen_random_uuid(); ts timestamptz:=clock_timestamp(); p jsonb; s jsonb; denied boolean; k integer;
begin
 for k in 1..3 loop
  insert into auth.users(id,is_anonymous) values(ids[k],true);
  insert into public.ludus_accounts(user_id,username,ludus_name,gold)
   values(ids[k],'qa36_'||left(replace(ids[k]::text,'-',''),12),'QA Arena '||k,1000);
 end loop;
 p:=jsonb_build_array(
  jsonb_build_object('owner',ids[1],'name','QA Alpha','class','murmillo','x',0,'z',0,'angle',0,'hp',100,'serial',0,'stamina',100,'stamina_at',ts,'stamina_regen_at',ts+interval '10 seconds','tick_at',ts,'seen',ts,'block',false,'items',jsonb_build_array(jsonb_build_object('kind','weapon','model','gladius','equipped_slot','main_hand'),jsonb_build_object('kind','shield','model','round','equipped_slot','off_hand'))),
  jsonb_build_object('owner',ids[2],'name','QA Beta','class','murmillo','x',0,'z',1.25,'angle',pi(),'hp',100,'serial',0,'stamina',100,'stamina_at',ts,'tick_at',ts,'seen',ts,'block',false,'items',jsonb_build_array(jsonb_build_object('kind','weapon','model','sica','equipped_slot','main_hand'),jsonb_build_object('kind','shield','model','round','equipped_slot','off_hand'))));
 insert into public.ludus_matches(id,status,players)values(rid,'playing',p);
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 s:=public.ludus_match('step',rid,null,'{}',jsonb_build_object('attack',true,'attack_id','qa-attack','region','head'));
 if s->>'controls_version'<>'36' or s->>'combat_version'<>'23' or s#>>'{players,0,strike_region}'<>'head' or(s#>>'{players,0,stamina}')::float<>87 or(s#>>'{players,1,hp}')::int<>100 then raise exception 'Attack acceptance/version/cost/timing failed';end if;
 update public.ludus_matches set players=jsonb_set(players,'{0,strike_at}',to_jsonb(clock_timestamp()-interval '1 millisecond'))where id=rid;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 s:=public.ludus_match('state',rid);
 if(s#>>'{players,1,hp}')::int<>86 or s#>>'{players,1,hit_region}'<>'head' then raise exception 'Shared authoritative hit failed';end if;
 update public.ludus_matches set players=jsonb_set(jsonb_set(players,'{0,cooldown_until}',to_jsonb(clock_timestamp()-interval '1 second')),'{0,swing_end}',to_jsonb(clock_timestamp()-interval '1 second'))where id=rid;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 s:=public.ludus_match('step',rid,null,'{}',jsonb_build_object('attack',true,'attack_id','qa-attack','region','head'));
 if(s#>>'{players,0,serial}')::int<>1 or(s#>>'{players,1,hp}')::int<>86 or(s#>>'{players,0,stamina}')::float<>87 then raise exception 'Attack retry duplicated damage/cost';end if;
 update public.ludus_matches set players=p where id=rid;
 s:=public.ludus_match('step',rid,null,'{}',jsonb_build_object('dodge',true,'dodge_id','qa-dodge','x',1,'z',0));
 if(s#>>'{players,0,dodge_serial}')::int<>1 or(s#>>'{players,0,stamina}')::float<>75 then raise exception 'Dodge acceptance/cost failed';end if;
 s:=public.ludus_match('step',rid,null,'{}',jsonb_build_object('dodge',true,'dodge_id','qa-dodge','x',1,'z',0));
 if(s#>>'{players,0,dodge_serial}')::int<>1 or(s#>>'{players,0,stamina}')::float<>75 then raise exception 'Dodge retry duplicated cost';end if;
 update public.ludus_matches set players=p where id=rid;
 s:=public.ludus_match('step',rid,null,'{}',jsonb_build_object('attack',true,'attack_id','qa-legacy'));
 if s#>>'{players,0,strike_region}'<>'chest' or s#>>'{players,0,strike_hand}'<>'main_hand' then raise exception 'Legacy controls failed';end if;
 denied:=false;begin perform public.ludus_match('step',rid,null,'{}','{"region":"invalid"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Invalid region accepted';end if;
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 denied:=false;begin perform public.ludus_match('state',rid);exception when others then denied:=true;end;
 if not denied then raise exception 'Outsider can access room';end if;
 if exists(select 1 from public.ludus_accounts where user_id=any(ids) and gold<>1000) then raise exception 'Beta changed balances';end if;
 if has_function_privilege('anon','public.ludus_match(text,uuid,uuid,jsonb,jsonb)','execute')
  or not has_function_privilege('authenticated','public.ludus_match(text,uuid,uuid,jsonb,jsonb)','execute')
  or has_function_privilege('authenticated','private.ludus_advance_combat_v36(jsonb,timestamptz)','execute')
  or has_function_privilege('authenticated','private.ludus_resolve_combat_v36(jsonb,timestamptz)','execute') then raise exception 'RPC/private grants failed';end if;
 if not exists(select 1 from pg_proc where oid='public.ludus_match(text,uuid,uuid,jsonb,jsonb)'::regprocedure and prosecdef and proconfig @>array['search_path=""']) then raise exception 'Security definer search path failed';end if;
end $$;
rollback;
select 'PASS: live V36 controls/version, delayed shared hit, attack/dodge deduplication and costs, legacy payload, invalid region, outsider denial, balances and private grants. All fixtures rolled back.' as result;
