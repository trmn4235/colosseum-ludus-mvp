-- Live integration smoke test. Every fixture and reward is rolled back.
begin;
do $$declare u uuid;begin
 select user_id into u from public.ludus_accounts order by created_at limit 1;
 if u is null then raise exception 'A fixture account is required';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false)::text,true);
 perform ludus_private.level_ensure(u);
 update public.ludus_progression set experience=ludus_private.level_threshold(50)where owner_id=u;
 insert into ludus_private.level_rewards(owner_id,level,claimed_at,rewards)values(u,5,clock_timestamp(),'{"workers":1}')
 on conflict(owner_id,level)do update set claimed_at=coalesce(ludus_private.level_rewards.claimed_at,excluded.claimed_at);
 perform public.ludus_supply();
 update ludus_supply_private.stock set quantity=100 where owner_id=u;
end;$$;
set local role authenticated;
do $$declare s jsonb;r uuid:=gen_random_uuid();jid text;failed boolean:=false;iid uuid;begin
 s:=public.ludus_supply();assert(s->>'workers')::integer>=1;assert jsonb_array_length(s->'resources')=12;
 s:=public.ludus_supply('send','copper',1,r);jid:=s->'result'->>'job_id';
 perform set_config('v85_test.job',jid,true);
 s:=public.ludus_supply('send','copper',1,r);assert(s->'result'->>'replayed')::boolean;
 begin perform public.ludus_supply('claim',jid,1,gen_random_uuid());exception when raise_exception then failed:=true;end;
 assert failed,'Early delivery must fail';
 s:=public.ludus_supply('craft','gladius',1,gen_random_uuid());iid:=(s->'result'->>'item_id')::uuid;
 perform set_config('v85_test.item',iid::text,true);
end;$$;
reset role;
do $$declare it public.ludus_items;m jsonb;begin
 select * into it from public.ludus_items where id=current_setting('v85_test.item')::uuid;
 assert it.owner_id=auth.uid()and it.kind='weapon'and it.model='gladius'and it.enhancement=0;
 assert it.stat_version=10 and it.natural_stats<>'{}'::jsonb,'Use the real equipment normalization trigger';
 update ludus_supply_private.jobs set started_at=started_at-interval'2 hours',ends_at=ends_at-interval'2 hours'
 where id=current_setting('v85_test.job')::uuid;
 m:=ludus_food_private.menu_v55(1,'[{"sku":"egg","quantity":2},{"sku":"apple","quantity":4},{"sku":"olive_oil","quantity":1}]');
 assert(m->>'stamina_bonus_percent')::integer=12 and(m->>'olive_oil_used')::integer=1;
 m:=ludus_food_private.menu_v55(1,'[{"sku":"grain","quantity":5},{"sku":"olive_oil","quantity":5}]');
 assert(m->>'olive_oil_used')::integer=0;
end;$$;
set local role authenticated;
do $$declare s jsonb;failed boolean:=false;begin
 s:=public.ludus_supply('claim',current_setting('v85_test.job'),1,gen_random_uuid());
 s:=public.ludus_supply('claim',current_setting('v85_test.job'),1,gen_random_uuid());
 assert(select(value->>'quantity')::integer=112 from jsonb_array_elements(s->'resources')where value->>'sku'='copper');
 begin perform public.ludus_food_buy('meal',1,gen_random_uuid());exception when raise_exception then failed:=true;end;
 assert failed,'Retired food must not be purchasable';
end;$$;
reset role;
rollback;
select 'V85 live integration passed; all fixtures rolled back' as result;
