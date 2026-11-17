-- Run with an administrative SQL connection after applying V285.
-- All accounts, battles, drops and balances below are synthetic and rolled back.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); g uuid; bid uuid; mid uuid;
 started jsonb; reward jsonb; replay jsonb; state jsonb; mode text; denied boolean;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (a,'qa-v285-'||a::text||'@example.invalid',jsonb_build_object('username','qa285_'||left(replace(a::text,'-',''),18),'ludus_name','QA V285 A')),
 (b,'qa-v285-'||b::text||'@example.invalid',jsonb_build_object('username','qa285_'||left(replace(b::text,'-',''),18),'ludus_name','QA V285 B'));
 select id into strict g from public.ludus_gladiators where owner_id=a order by id limit 1;
 -- The real Colosseum entrance requires 30 fame; provision only this fixture.
 insert into ludus_pit_private.fame(gladiator_id,points)values(g,30)
 on conflict(gladiator_id)do update set points=30;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 execute 'set local role authenticated';
 state:=public.ludus_special_staff('guard',0);
 if jsonb_array_length(state->'staff')<>6 or state->>'user_id'<>a::text then raise exception 'Owner profile failed';end if;
 execute 'reset role';
 foreach mode in array array['solo20','4x5'] loop
  execute 'set local role authenticated';
  started:=public.ludus_start_battle_v2(g,mode,'{}'::jsonb,gen_random_uuid());
  bid:=(started->>'id')::uuid;
  execute 'reset role';
  update public.ludus_battles set started_at=now()-interval '20 seconds' where id=bid;
  execute 'set local role authenticated';
  reward:=public.ludus_finish_battle_v2(bid,true,'{"alive":true,"exit_slots":{},"kills":4,"damage":200}'::jsonb);
  replay:=public.ludus_finish_battle_v2(bid,true,'{"alive":true,"exit_slots":{},"kills":4,"damage":200}'::jsonb);
  if reward is distinct from replay or jsonb_typeof(reward->'papyri') is distinct from 'array'
    or (reward->>'gold')::int<>100 or (reward->>'diamonds')::int<>1 then raise exception 'Settlement or retry failed: %',mode;end if;
  execute 'reset role';
  if reward is distinct from(select r.reward from public.ludus_battle_receipts r where r.battle_id=bid and r.owner_id=a)
    or reward->'papyri' is distinct from(select r.papyri from ludus_staff_private.loot_receipts_v285 r where r.source_key='battle:'||bid::text and r.owner_id=a)
    then raise exception 'Receipt mismatch: %',mode;end if;
 end loop;
 insert into public.ludus_matches(status,starts_at,venue,players)values('playing',now()-interval '20 seconds','colosseum',
  jsonb_build_array(jsonb_build_object('owner',a,'hp',100,'left',false),jsonb_build_object('owner',b,'hp',0,'left',false)))returning id into mid;
 update public.ludus_matches set status='finished',winner=a where id=mid;
 if not exists(select 1 from public.ludus_matches m where m.id=mid and a=any(m.papyri_eligible_v285))then raise exception 'Winner proof missing';end if;
 execute 'set local role authenticated';
 reward:=public.ludus_match_papyri_v285(mid);replay:=public.ludus_match_papyri_v285(mid);
 if reward is distinct from replay or jsonb_typeof(reward->'papyri') is distinct from 'array' then raise exception 'Multiplayer retry failed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if public.ludus_match_papyri_v285(mid)->'papyri'<>'[]'::jsonb then raise exception 'Losing account got loot';end if;
 state:=public.ludus_special_staff('guard',0);
 if exists(select 1 from jsonb_array_elements(state->'staff')s where (s->>'collected')::int<>0)then raise exception 'Account isolation failed';end if;
 denied:=false;begin perform ludus_staff_private.award_v285(b,'forged');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct grant was accessible';end if;
 perform set_config('request.jwt.claims','{"is_anonymous":true}',true);
 denied:=false;begin perform public.ludus_match_papyri_v285(mid);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous claim accepted';end if;
 execute 'reset role';execute 'set local role anon';
 denied:=false;begin perform public.ludus_match_papyri_v285(mid);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anon role claim accepted';end if;
 execute 'reset role';
end;$test$;
rollback;
select true as live_v285_checks_passed, 'All synthetic data rolled back' as test_data;
