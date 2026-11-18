-- Administrative integration check. All users, papers and encounters belong to
-- this transaction. The six real single-copy manuscripts are never reserved.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 standard_request uuid:=gen_random_uuid(); unique_request uuid:=gen_random_uuid();
 first_trip uuid:=gen_random_uuid(); next_trip uuid:=gen_random_uuid();
 other_trip uuid:=gen_random_uuid(); trip uuid; who uuid; place text; lesson_id integer;
 s jsonb; profile jsonb; denied boolean;
begin
 insert into auth.users(id,email,raw_user_meta_data)
 select u,'qa-v286-'||u::text||'@example.invalid',
   jsonb_build_object('username','qa286_'||left(replace(u::text,'-',''),16),'ludus_name','QA '||left(replace(u::text,'-',''),16))
 from unnest(array[a,b])u;
 insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson)
 select a,'guard',n from unnest(array[401,491,492,493,494])n;
 insert into ludus_staff_private.roles_v284(id,name,title,sort_order) values('qa286','QA','QA',999);
 insert into ludus_staff_private.unique_catalog_v285 values('qa286-unique','qa286','QA tek nüsha');
 insert into ludus_staff_private.unique_discoveries_v285(papyrus_id,first_owner_id,finder_ludus,source_key)
 values('qa286-unique',a,'QA İlk Bulan','qa286');
 insert into ludus_staff_private.unique_papyri_v285(papyrus_id,owner_id) values('qa286-unique',a);
 insert into ludus_staff_private.unique_effects_v286(papyrus_id,effect_key,label,target,percent)
 select 'qa286-unique',effect_key,label,target,percent from ludus_staff_private.unique_effects_v286 where papyrus_id='guard-first';
 select id into strict place from ludus_supply_private.destinations order by id limit 1;
 foreach trip in array array[first_trip,next_trip,other_trip] loop
  who:=case when trip=other_trip then b else a end;
  insert into ludus_supply_private.jobs(id,owner_id,destination,workers,started_at,ends_at,cargo,escort_team,loadout)
  values(trip,who,place,1,now()-interval '1 hour',now()+interval '2 hours','{"iron_ore":10}','[{}]','{"arrow":9}');
  if trip=first_trip then
   insert into ludus_worker_private.defenses_v230(id,owner_id,departure,starts_at,deadline,encounter,workers,original_cargo)
   values(trip,a,1,now()-interval '2 minutes',now()-interval '1 minute','{"version":230,"guards":2}',
    '[{"armed":true,"base_damage":20,"arrows":6},{"armed":true,"base_damage":13,"arrows":3}]','{"iron_ore":10}');
  end if;
 end loop;

 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 s:=public.ludus_special_staff('guard',0);
 select value into strict profile from jsonb_array_elements(s->'staff') where value->>'id'='guard';
 if (profile->>'collected')::int<>5 or (profile->>'overall')::numeric<>0 or (profile->>'readable')::int<>5 or profile->'bonuses'<>'[]' then raise exception 'Receiving granted progress';end if;
 s:=public.ludus_special_staff_read('guard',401,standard_request);
 select value into strict profile from jsonb_array_elements(s->'staff') where value->>'id'='guard';
 if (profile->>'readable')::int<>4 or (profile->>'overall')::numeric<>.2 or (profile#>>'{bonuses,0,percent}')::numeric<>.03 then raise exception 'Standard read';end if;
 s:=public.ludus_special_staff_read('guard',401,standard_request);
 if s#>>'{reading,replayed}'<>'true' then raise exception 'Standard receipt';end if;
 foreach lesson_id in array array[491,492,493,494] loop perform public.ludus_special_staff_read('guard',lesson_id,gen_random_uuid()); end loop;
 s:=public.ludus_special_staff_read_unique('qa286','qa286-unique',unique_request);
 select value into strict profile from jsonb_array_elements(s->'staff') where value->>'id'='qa286';
 if (profile->>'overall')::numeric<>0 or (profile->>'unique_read')::int<>1 or
   (profile#>>'{bonuses,0,percent}')::numeric<>.30 or s#>>'{papyri,0,finder}'<>'QA İlk Bulan' then raise exception 'Unique read';end if;
 s:=public.ludus_special_staff_read_unique('qa286','qa286-unique',unique_request);
 if s#>>'{reading,replayed}'<>'true' then raise exception 'Unique receipt';end if;
 denied:=false;
 begin perform public.ludus_special_staff_read('guard',401,unique_request);
 exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Receipt crossed manuscript types';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.ludus_special_staff_read_unique('qa286','qa286-unique',gen_random_uuid());
 exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Other account could read';end if;
 execute 'reset role';

 foreach trip in array array[next_trip,other_trip] loop
  who:=case when trip=other_trip then b else a end;
  insert into ludus_worker_private.defenses_v230(id,owner_id,departure,starts_at,deadline,encounter,workers,original_cargo)
  values(trip,who,2,now()-interval '2 minutes',now()-interval '1 minute','{"version":230,"guards":2}',
   '[{"armed":true,"base_damage":20,"arrows":6},{"armed":true,"base_damage":13,"arrows":3}]','{"iron_ore":10}');
 end loop;
 if (select (encounter->>'staff_attack_percent')::numeric from ludus_worker_private.defenses_v230 where id=next_trip) is distinct from .43
 or exists(select 1 from ludus_worker_private.defenses_v230 where id in(first_trip,other_trip) and (encounter->>'staff_attack_percent')::numeric is distinct from 0)then raise exception 'Snapshot scope';end if;
 perform ludus_worker_private.settle_defenses_v230(a,clock_timestamp());
 perform ludus_worker_private.settle_defenses_v230(b,clock_timestamp());
 if exists(select 1 from ludus_worker_private.defenses_v230 where id in(first_trip,next_trip,other_trip) and success is distinct from (id=next_trip))
 then raise exception 'Automatic defense outcomes';end if;
end;
$test$;
rollback;
select true as verified_v286;
