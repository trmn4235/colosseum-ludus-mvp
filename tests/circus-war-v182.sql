-- Run after migration. Disposable users and settlement changes are rolled back.
begin;
do $$
declare u uuid:=gen_random_uuid();other uuid:=gen_random_uuid();g1 uuid;g2 uuid;g3 uuid;h1 uuid;h2 uuid;r jsonb;rejected boolean;
begin
 insert into auth.users(id,email)values(u,'war-'||u||'@example.invalid'),(other,'war-'||other||'@example.invalid');
 insert into public.ludus_accounts(user_id,username,ludus_name,gold)values(u,'w'||substr(replace(u::text,'-',''),1,16),'War Test',1000),(other,'w'||substr(replace(other::text,'-',''),1,16),'Other Test',1000);
 insert into public.ludus_gladiators(owner_id,name,class)values(u,'Driver','murmillo')returning id into g1;
 insert into public.ludus_gladiators(owner_id,name,class)values(u,'Archer','retiarius')returning id into g2;
 insert into public.ludus_gladiators(owner_id,name,class)values(other,'Foreign','thraex')returning id into g3;
 insert into ludus_stable_private.houses(owner_id)values(u);
 insert into ludus_stable_private.horses(owner_id,name,sex,born_at,genes,fed_until)values(u,'Test A','male',now()-interval'10 days','{"power":80,"speed":80,"acceleration":80,"agility":80,"stamina":80,"balance":80,"courage":80,"recovery":80,"burst":80}',now()+interval'1 day')returning id into h1;
 insert into ludus_stable_private.horses(owner_id,name,sex,born_at,genes,fed_until)values(u,'Test B','female',now()-interval'10 days','{"power":70,"speed":70,"acceleration":70,"agility":70,"stamina":70,"balance":70,"courage":70,"recovery":70,"burst":70}',now()+interval'1 day')returning id into h2;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 r:=public.ludus_circus_war_roster();assert jsonb_array_length(r->'roster')=2;assert jsonb_array_length(r->'horses')=2;
 r:=public.ludus_circus_war_roster(array[g2,g1],array[h2,h1]);assert r->'gladiator_ids'->>0=g2::text;assert r->'horse_ids'->>0=h2::text;assert(r->>'laps')::int=7;
 rejected:=false;begin perform public.ludus_circus_war_roster(array[g1,g1],array[h1,h2]);exception when raise_exception then rejected:=true;end;assert rejected;
 rejected:=false;begin perform public.ludus_circus_war_roster(array[g1,g3],array[h1,h2]);exception when raise_exception then rejected:=true;end;assert rejected;
 rejected:=false;begin perform public.ludus_circus_war_roster(array[g1,g2],array[h1,h1]);exception when raise_exception then rejected:=true;end;assert rejected;
 rejected:=false;begin perform public.ludus_circus_war_roster(array[g1,g2],array[h1,gen_random_uuid()]);exception when raise_exception then rejected:=true;end;assert rejected;
 rejected:=false;begin perform public.ludus_circus_war_roster(null,array[h1,h2]);exception when raise_exception then rejected:=true;end;assert rejected;
 update public.ludus_gladiators set injured_until=now()+interval'1 day' where id=g1;
 rejected:=false;begin perform public.ludus_circus_war_roster(array[g1,g2],array[h1,h2]);exception when raise_exception then rejected:=true;end;assert rejected;
 update public.ludus_gladiators set injured_until=null where id=g1;
 update ludus_stable_private.horses set fed_until=now()-interval'1 day' where id=h1;
 rejected:=false;begin perform public.ludus_circus_war_roster(array[g1,g2],array[h1,h2]);exception when raise_exception then rejected:=true;end;assert rejected;
 assert(select gold from public.ludus_accounts where user_id=u)=1000;
 assert not has_function_privilege('anon','public.ludus_circus_war_roster(uuid[],uuid[])','EXECUTE');
 assert has_function_privilege('authenticated','public.ludus_circus_war_roster(uuid[],uuid[])','EXECUTE');
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 rejected:=false;begin perform public.ludus_circus_war_roster();exception when raise_exception then rejected:=true;end;assert rejected;
end $$;
rollback;
