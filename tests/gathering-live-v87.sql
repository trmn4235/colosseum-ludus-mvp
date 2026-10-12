-- Real PostgreSQL integration, using an existing account only inside a rollback.
begin;
set local statement_timeout='15s';
do $$declare u uuid;begin
 select user_id into u from public.ludus_accounts order by created_at limit 1 for update skip locked;
 if u is null then raise exception 'A fixture account is required';end if;
 perform set_config('v87_test.owner',u::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false)::text,true);
 perform ludus_private.level_ensure(u);
 update public.ludus_progression set experience=ludus_private.level_threshold(50)where owner_id=u;
 insert into ludus_private.level_rewards(owner_id,level,claimed_at,rewards)values(u,5,clock_timestamp(),'{"workers":1}')
 on conflict(owner_id,level)do update set claimed_at=coalesce(ludus_private.level_rewards.claimed_at,excluded.claimed_at);
 update ludus_supply_private.jobs set claimed_at=clock_timestamp()where owner_id=u and claimed_at is null;
 perform public.ludus_supply();
 update ludus_supply_private.stock set quantity=100 where owner_id=u;
end;$$;
set local role authenticated;
do $$declare s jsonb;r uuid:=gen_random_uuid();jid text;denied boolean:=false;begin
 s:=public.ludus_supply();assert(s->>'automatic_delivery')::boolean;
 s:=public.ludus_supply('send','copper',1,r);jid:=s->'result'->>'job_id';perform set_config('v87_test.job',jid,true);perform set_config('v87_test.request',r::text,true);
 assert jsonb_array_length(s->'jobs')=1;
 begin perform public.ludus_supply('claim',jid,1,gen_random_uuid());exception when raise_exception then denied:=true;end;assert denied,'No early arrival';
 denied:=false;begin perform ludus_supply_private.deliver_due_v87(100);exception when insufficient_privilege then denied:=true;end;assert denied,'Private cron helper is inaccessible';
end;$$;
reset role;
do $$declare n integer;u uuid:=current_setting('v87_test.owner')::uuid;begin
 update ludus_supply_private.jobs set started_at=started_at-interval'2 hours',ends_at=ends_at-interval'2 hours'where id=current_setting('v87_test.job')::uuid;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 n:=ludus_supply_private.settle_owner_v87(u);assert n=1,'Offline settlement works without a player JWT';
 n:=ludus_supply_private.settle_owner_v87(u);assert n=0,'Repeated delivery is a no-op';
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false)::text,true);
end;$$;
set local role authenticated;
do $$declare s jsonb;begin
 s:=public.ludus_supply();assert jsonb_array_length(s->'jobs')=0;assert(s->>'free_workers')::integer=(s->>'workers')::integer;
 assert(select(value->>'quantity')::integer=112 from jsonb_array_elements(s->'resources')where value->>'sku'='copper');
 assert exists(select 1 from jsonb_array_elements(s->'deliveries')where value->>'id'=current_setting('v87_test.job'));
 s:=public.ludus_supply('send','copper',1,current_setting('v87_test.request')::uuid);assert(s->'result'->>'replayed')::boolean;assert jsonb_array_length(s->'jobs')=0;
 s:=public.ludus_supply('claim',current_setting('v87_test.job'),1,gen_random_uuid());
 assert(select(value->>'quantity')::integer=112 from jsonb_array_elements(s->'resources')where value->>'sku'='copper');
end;$$;
reset role;
rollback;
select 'V87 live integration passed; all fixtures rolled back' as result;
