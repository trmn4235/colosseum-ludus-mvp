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
 r:=public.ludus_circus('start',jsonb_build_object('heat',heat,'driving',158,'rules',158),gen_random_uuid());
 assert (r->'heat'->'drive'->>'version')::int=158 and(r->'heat'->'drive'->>'laps')::int=5;
 assert (r->'heat'->'durations'->>'3')::numeric>=300;
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval '3.8 seconds' where id=heat;
 req:=gen_random_uuid();r:=public.ludus_circus('drive',jsonb_build_object('heat',heat,'samples',jsonb_build_array(jsonb_build_object('tick',0,'input',1),jsonb_build_object('tick',1,'input',1))),req);
 assert(r->'heat'->'drive'->'sim'->>'tick')::int=2;
 s:=public.ludus_circus('drive',jsonb_build_object('heat',heat,'samples',jsonb_build_array(jsonb_build_object('tick',0,'input',1),jsonb_build_object('tick',1,'input',1))),req);
 assert (s->>'replayed')::boolean;
 rejected:=false;begin perform public.ludus_circus('drive',jsonb_build_object('heat',heat,'samples',jsonb_build_array(jsonb_build_object('tick',900,'input',1))),gen_random_uuid());exception when raise_exception then rejected:=true;end;assert rejected;
 -- Match the JS idle simulation after sixty seconds, rather than accepting client positions.
 select drive into d from ludus_circus_private.heats where id=heat;
 d:=jsonb_set(d,'{sim}',ludus_circus_private.physics_initial());
 for rank in 1..1200 loop d:=jsonb_set(d,'{sim}',ludus_circus_private.physics_step(d->'sim',0,321,d,'{"0":300,"1":307,"2":314,"3":321}'));end loop;
 assert abs((d->'sim'->>'distance')::float8-325.71048229296224)<1e-6;
 assert(d->'sim'->>'speed')::float8=0 and(d->'sim'->>'crashes')::int>0;
 assert not has_function_privilege('authenticated','ludus_circus_private.physics_step(jsonb,float8,float8,jsonb,jsonb)','EXECUTE');
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval '13.8715 seconds' where id=heat;
 req:=gen_random_uuid();r:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',10.8715),req);
 assert(r->'heat'->'drive'->>'last_hit')::boolean and jsonb_array_length(r->'heat'->'drive'->'boosts')=1;
 s:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',10.8715),req);assert(s->>'replayed')::boolean;
 assert jsonb_array_length(s->'heat'->'drive'->'boosts')=1;
 -- Offline driver cannot keep following the curve or finish by wall-clock time alone.
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval '63 seconds' where id=heat;
 r:=public.ludus_circus();assert(r->'heat'->'drive'->'sim'->>'wall')::float8>1;
 assert(r->'heat'->'drive'->'sim'->>'finish')is null;
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval '500 seconds' where id=heat;
 r:=public.ludus_circus();assert r->'heat'->>'status'='settled' and(r->'heat'->>'winner')::int<3, r->'heat';
 assert(r->>'gold')::int=1000;
 raise notice 'V158 SQL PASS: five laps, input validation, idempotency, JS parity, wall stop, offline DNF, no direct access';
end $$;
rollback;
