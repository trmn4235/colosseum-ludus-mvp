-- Disposable fixtures and every wallet change are rolled back.
begin;
do $$
declare u uuid:=gen_random_uuid();other uuid:=gen_random_uuid();r jsonb;s jsonb;heat uuid;req uuid:=gen_random_uuid();args jsonb;gold bigint;h1 uuid;h2 uuid;rejected boolean;
begin
 insert into auth.users(id,email)values(u,'circus-test-'||u||'@example.invalid');
 insert into public.ludus_accounts(user_id,username,ludus_name,gold)values(u,'ct'||substr(replace(u::text,'-',''),1,16),'Circus Test',1000);
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 r:=public.ludus_circus();heat:=(r->'heat'->>'id')::uuid;
 assert jsonb_array_length(r->'heat'->'teams')=4;
 assert (select sum(jsonb_array_length(value->'horses'))from jsonb_array_elements(r->'heat'->'teams'))=8;
 args:=jsonb_build_object('heat',heat,'team',0,'stake',100);
 r:=public.ludus_circus('bet',args,req);assert (r->>'gold')::int=900;
 s:=public.ludus_circus('bet',args,req);assert (s->>'gold')::int=900 and (s->>'replayed')::boolean;
 rejected:=false;begin perform public.ludus_circus('bet',args||'{"stake":200}',req);exception when raise_exception then rejected:=true;end;assert rejected;
 r:=public.ludus_circus('start',jsonb_build_object('heat',heat),gen_random_uuid());assert r->'heat'->>'status'='running';
 rejected:=false;begin perform public.ludus_circus('bet',args,gen_random_uuid());exception when raise_exception then rejected:=true;end;assert rejected;
 r:=public.ludus_circus();assert (r->>'gold')::int=900 and r->'heat'->>'winner' is null;
 update ludus_circus_private.heats set finish_at=clock_timestamp()-interval'1 second',winner=0 where id=heat;
 r:=public.ludus_circus();assert (r->>'gold')::int=1050 and (r->'heat'->>'payout')::int=150;
 r:=public.ludus_circus();assert (r->>'gold')::int=1050;
 r:=public.ludus_circus('next',jsonb_build_object('heat',heat),gen_random_uuid());heat:=(r->'heat'->>'id')::uuid;
 insert into ludus_stable_private.houses(owner_id)values(u);
 insert into ludus_stable_private.horses(owner_id,name,sex,born_at,genes,fed_until)values(u,'Test A','male',now()-interval'10 days','{"power":80,"speed":80,"acceleration":80,"agility":80,"stamina":80,"balance":80,"courage":80,"recovery":80,"burst":80}',now()+interval'1 day')returning id into h1;
 insert into ludus_stable_private.horses(owner_id,name,sex,born_at,genes,fed_until)values(u,'Test B','female',now()-interval'10 days','{"power":70,"speed":70,"acceleration":70,"agility":70,"stamina":70,"balance":70,"courage":70,"recovery":70,"burst":70}',now()+interval'1 day')returning id into h2;
 rejected:=false;begin perform public.ludus_circus('enter',jsonb_build_object('heat',heat,'horse1',h1,'horse2',h1),gen_random_uuid());exception when raise_exception then rejected:=true;end;assert rejected;
 r:=public.ludus_circus('enter',jsonb_build_object('heat',heat,'horse1',h1,'horse2',h2),gen_random_uuid());assert (r->'heat'->>'entered')::boolean;
 assert r->'heat'->'teams'->3->'horses'->0->>'id'=h1::text;
 rejected:=false;begin perform public.ludus_circus('bet',jsonb_build_object('heat',heat,'team',3,'stake',100),gen_random_uuid());exception when raise_exception then rejected:=true;end;assert rejected;
 r:=public.ludus_circus('start',jsonb_build_object('heat',heat),gen_random_uuid());assert r->'heat'->>'status'='running';
 assert not has_table_privilege('authenticated','ludus_circus_private.heats','SELECT');
 assert not has_function_privilege('anon','public.ludus_circus(text,jsonb,uuid)','EXECUTE');
 assert has_function_privilege('authenticated','public.ludus_circus(text,jsonb,uuid)','EXECUTE');
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 rejected:=false;begin perform public.ludus_circus();exception when raise_exception then rejected:=true;end;assert rejected;
end $$;
rollback;
select 'PASS: eight horses, escrow, idempotency, closed betting, settlement once, own-pair entry, role grants, no anonymous access; fixtures rolled back' as result;
