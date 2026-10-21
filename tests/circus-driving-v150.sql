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
 r:=public.ludus_circus('start',jsonb_build_object('heat',heat,'driving',150),gen_random_uuid());assert r->'heat'->'drive'->>'version'='150';
 -- Invalid future or stale timestamps cannot create boosts.
 rejected:=false;begin perform public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',9999),gen_random_uuid());exception when raise_exception then rejected:=true;end;assert rejected;
 update ludus_circus_private.heats set started_at=clock_timestamp()-make_interval(secs=>(3+at_time)::double precision)where id=heat;
 r:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',at_time),req);
 assert (r->'heat'->'drive'->>'last_hit')::boolean;
 assert jsonb_array_length(r->'heat'->'drive'->'boosts')=1;
 s:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',at_time),req);assert (s->>'replayed')::boolean;
 assert jsonb_array_length(s->'heat'->'drive'->'boosts')=1;
 rejected:=false;begin perform public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',at_time),gen_random_uuid());exception when raise_exception then rejected:=true;end;assert rejected;
 -- A miss is recorded once and spends no stamina.
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval'20 seconds'where id=heat;
 r:=public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',17),gen_random_uuid());
 assert not(r->'heat'->'drive'->>'last_hit')::boolean;assert jsonb_array_length(r->'heat'->'drive'->'boosts')=1;
 -- The 4-second segment adds 50% distance, lowers finish time by 2s, spends 25, then recovers.
 d:=ludus_circus_private.drive_metrics('{"initial":100,"boosts":[{"at":10}]}',11,120);
 assert (d->>'stamina')::numeric=75 and (d->>'bonus')::numeric=.5 and (d->>'finish')::numeric=118;
 assert (d->>'boosting')::boolean and not(d->>'canBoost')::boolean;
 d:=ludus_circus_private.drive_metrics('{"initial":100,"boosts":[{"at":10}]}',15,120);
 assert (d->>'stamina')::numeric=77.5 and(d->>'canBoost')::boolean;
 update ludus_circus_private.heats set started_at=clock_timestamp()-interval'24.4 seconds',drive='{"version":150,"initial":100,"boosts":[{"at":1},{"at":6.1},{"at":11.2},{"at":16.3}],"last_attempt":16.3}'where id=heat;
 rejected:=false;begin perform public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',21.4),gen_random_uuid());exception when raise_exception then rejected:=true;end;assert rejected;
 -- Finish is derived from accepted inputs, rather than the original random winner.
 update ludus_circus_private.heats set durations='{"0":120,"1":123,"2":126,"3":129}',winner=0,drive='{"version":150,"initial":100,"boosts":[{"at":1},{"at":8},{"at":15},{"at":22},{"at":33}]}',started_at=clock_timestamp()-interval'140 seconds',finish_at=clock_timestamp()-interval'1 second'where id=heat;
 r:=public.ludus_circus();assert r->'heat'->>'status'='settled'and(r->'heat'->>'winner')::int=3;
 assert (r->>'gold')::int=1000;
 r:=public.ludus_circus();assert (r->>'gold')::int=1000;
 assert not has_function_privilege('authenticated','ludus_circus_private.drive_metrics(jsonb,numeric,numeric)','EXECUTE');
 assert not has_table_privilege('authenticated','ludus_circus_private.heats','UPDATE');
 -- A spectator betting race never accepts manual boosts or changes its draw.
 r:=public.ludus_circus('next',jsonb_build_object('heat',heat),gen_random_uuid());heat:=(r->'heat'->>'id')::uuid;
 r:=public.ludus_circus('bet',jsonb_build_object('heat',heat,'team',0,'stake',100),gen_random_uuid());
 r:=public.ludus_circus('start',jsonb_build_object('heat',heat,'driving',150),gen_random_uuid());assert r->'heat'->'drive'='null';
 rejected:=false;begin perform public.ludus_circus('boost',jsonb_build_object('heat',heat,'at',0),gen_random_uuid());exception when raise_exception then rejected:=true;end;assert rejected;
end $$;
rollback;
select 'PASS V150: own-team controls, timestamp/cooldown/stamina validation, miss, 50% segment, idempotency, changed finish order, unchanged wallet and spectator betting; fixtures rolled back' as result;
