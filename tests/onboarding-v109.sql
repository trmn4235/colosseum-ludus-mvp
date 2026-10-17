-- All disposable fixtures are rolled back.
begin;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); h uuid:=gen_random_uuid();
 s jsonb; first_completion text; denied boolean;
begin
 insert into auth.users(id,is_anonymous)values(a,false),(b,false);
 insert into public.ludus_accounts(user_id,username,ludus_name,gold,diamonds)
 values(a,'qa109_'||left(replace(a::text,'-',''),12),'QA Guide',1000,0),
 (b,'qa109_'||left(replace(b::text,'-',''),12),'QA Other',1000,0);
 insert into public.ludus_gladiators(id,owner_id,name,class)values(g,a,'QA Felix','murmillo'),(h,b,'QA Other','thraex');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 s:=public.ludus_onboarding();
 if not(s->>'should_open')::boolean or(s#>>'{steps,inspect}')::boolean or(s#>>'{steps,equipment}')::boolean
 or(s#>>'{steps,mission}')::boolean or(s#>>'{steps,training}')::boolean then raise exception 'New account state incorrect: %',s;end if;
 s:=public.ludus_onboarding('present');
 if(s->>'should_open')::boolean then raise exception 'First-run shown twice';end if;
 s:=public.ludus_onboarding('inspect',g);
 if not(s#>>'{steps,inspect}')::boolean then raise exception 'Inspection not saved';end if;
 denied:=false;begin perform public.ludus_onboarding('inspect',h);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Another owner inspected';end if;
 denied:=false;begin perform public.ludus_onboarding('mission');exception when others then denied:=true;end;
 if not denied then raise exception 'Client was able to claim a milestone';end if;
 s:=public.ludus_onboarding('dismiss');s:=public.ludus_onboarding();
 if(s->>'should_open')::boolean or not(s#>>'{steps,inspect}')::boolean then raise exception 'Dismissal lost progress';end if;
 denied:=false;begin perform 1 from ludus_private.onboarding_v109;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct private table exposed';end if;
 reset role;
 insert into public.ludus_items(owner_id,kind,model,equipped_by,equipped_slot)values(a,'weapon','gladius',g,'main_hand');
 insert into public.ludus_training_sessions(owner_id,gladiator_id,training_day,started_at,train_until,rest_until,exercise_stat)
 values(a,g,current_date,now(),now()+interval '1 hour',now()+interval '2 hours','strength');
 insert into public.ludus_imperial_assignments(owner_id,mission_id,mission,gladiators,started_at,ends_at)
 select a,id,'{"title":"QA first mission","difficulty":1}','[]',now(),now()+interval '12 hours'
 from public.ludus_imperial_catalog limit 1;
 set local role authenticated;
 s:=public.ludus_onboarding();
 if not(s#>>'{steps,equipment}')::boolean or not(s#>>'{steps,mission}')::boolean
 or not(s#>>'{steps,training}')::boolean or s->>'completed_at' is null then raise exception 'Real milestones missing: %',s;end if;
 first_completion:=s->>'completed_at';
 s:=public.ludus_onboarding();if s->>'completed_at'<>first_completion then raise exception 'Completion changed on retry';end if;
 reset role;
 update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=a;
 set local role authenticated;
 s:=public.ludus_onboarding();if not(s#>>'{steps,equipment}')::boolean then raise exception 'Milestone regressed after unequip';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','is_anonymous',false)::text,true);
 s:=public.ludus_onboarding();
 if(s#>>'{steps,inspect}')::boolean or(s#>>'{steps,mission}')::boolean or(s#>>'{steps,training}')::boolean then raise exception 'Account data leaked';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','is_anonymous',true)::text,true);
 denied:=false;begin perform public.ludus_onboarding();exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous account accepted';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 denied:=false;begin perform public.ludus_onboarding();exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Missing identity accepted';end if;
 reset role;
 if has_function_privilege('anon','public.ludus_onboarding(text,uuid)','execute') then raise exception 'Anonymous RPC grant';end if;
 if exists(select 1 from public.ludus_accounts where user_id in(a,b)and(gold<>1000 or diamonds<>0)) then raise exception 'Guide changed wallet';end if;
 if exists(select 1 from public.ludus_imperial_assignments where owner_id=a and(completed_at is not null or claimed_at is not null)) then raise exception 'Guide settled a mission';end if;
end $$;
select 'PASS: account isolation, one-time intro, dismissal, real milestones, durable completion, no reward changes' as result;
rollback;
