-- Disposable fixtures; no player money, horse energy or race records survive.
begin;
do $$
declare u uuid:=gen_random_uuid();r jsonb;s jsonb;heat uuid;req uuid:=gen_random_uuid();h1 uuid;h2 uuid;at_time numeric:=10.8715;rejected boolean;d jsonb;
begin
 insert into auth.users(id,email)values(u,'drive-test-'||u||'@example.invalid');
 insert into public.ludus_accounts(user_id,username,ludus_name,gold)values(u,'dr'||substr(replace(u::text,'-',''),1,16),'Drive Test',1000);
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 insert into ludus_stable_private.houses(owner_id)values(u);
 insert into ludus_stable_private.horses(owner_id,name,sex,born_at,genes,fed_until)values(u,'Drive A','male',now()-interval'10 days','{"power":80,"speed":80,"acceleration":80,"agility":80,"stamina":80,"balance":80,"courage":80,"recovery":80,"burst":80}',now()+interval'1 day')returning id into h1;
 insert into ludus_stable_private.horses(owner_id,name,sex,born_at,genes,fed_until)values(u,'Drive B','female',now()-interval'10 days','{"power":70,"speed":70,"acceleration":70,"agility":70,"stamina":70,"balance":70,"courage":70,"recovery":70,"burst":70}',now()+interval'1 day')returning id into h2;
 r:=public.ludus_circus();heat:=(r->'heat'->>'id')::uuid;
 r:=public.ludus_circus('enter',jsonb_build_object('heat',heat,'horse1',h1,'horse2',h2),gen_random_uuid());
 r:=public.ludus_circus('start',jsonb_build_object('heat',heat,'driving',158,'rules',158,'motion',183),gen_random_uuid());
 assert (r->'heat'->'drive'->>'version')::int=158 and(r->'heat'->'drive'->>'laps')::int=5;
 assert (r->'heat'->'durations'->>'3')::numeric>=300;
 assert r->'heat'->'drive'->>'motion'='183';
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval '13.2 seconds' where id=heat;
 req:=gen_random_uuid();r:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',10.2),req);
 assert (r->'heat'->'drive'->>'misses')::int=1 and not(r->'heat'->'drive'->>'last_hit')::boolean;
 s:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',10.2),req);
 assert(s->>'replayed')::boolean and(s->'heat'->'drive'->>'misses')::int=1;
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval '14.9 seconds' where id=heat;
 r:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',11.9),gen_random_uuid());
 assert(r->'heat'->'drive'->>'misses')::int=2;
 -- .72 was valid at race start but is outside the twice-shrunk band [.73,.85].
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval '17.212 seconds' where id=heat;
 r:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',14.212),gen_random_uuid());
 assert(r->'heat'->'drive'->>'misses')::int=3 and not(r->'heat'->'drive'->>'last_hit')::boolean;
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval '18.9715 seconds' where id=heat;
 r:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',15.9715),gen_random_uuid());
 assert(r->'heat'->'drive'->>'last_hit')::boolean and jsonb_array_length(r->'heat'->'drive'->'boosts')=1;
 assert(r->'heat'->'drive'->>'misses')::int=3;
 assert(r->>'gold')::int=1000;
 assert not has_function_privilege('authenticated','ludus_circus_private.motion_step(jsonb,float8,boolean,float8)','EXECUTE');
 raise notice 'V183 SQL PASS: progressive target, successful center, idempotent missed attempts, unchanged gold';
end $$;
rollback;
