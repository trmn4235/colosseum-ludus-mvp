-- Transactional integration test. Fixtures and every sale are rolled back.
begin;
set local statement_timeout='25s';
do $$
declare s uuid:=gen_random_uuid();b uuid:=gen_random_uuid();other uuid:=gen_random_uuid();it uuid;gid uuid;listing uuid;
 req uuid:=gen_random_uuid();buy_req uuid:=gen_random_uuid();args jsonb;outcome jsonb;again jsonb;before_stats jsonb;blocked boolean;
begin
 insert into auth.users(id,email)values(s,s::text||'@example.invalid'),(b,b::text||'@example.invalid'),(other,other::text||'@example.invalid');
 insert into public.ludus_accounts(user_id,username,ludus_name,gold)values(s,'ms_'||left(s::text,8),'Forum Test Seller',1000),(b,'mb_'||left(b::text,8),'Forum Test Buyer',100000),(other,'mo_'||left(other::text,8),'Forum Test Other',0);
 perform set_config('request.jwt.claim.sub',s::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',s,'role','authenticated','is_anonymous',false)::text,true);
 insert into public.ludus_items(owner_id,kind,model,enhancement)values(s,'weapon','gladius',5)returning id into it;
 update public.ludus_items set natural_percentages='{"physical_power":70,"critical_rate":85}',emeralds='[{"id":5,"value":70}]'where id=it;
 select to_jsonb(i)-array['owner_id','market_listing_id']into before_stats from public.ludus_items i where id=it;
 args:=jsonb_build_object('asset_type','item','asset_id',it,'price',1001,'hours',24);
 outcome:=public.ludus_market('create',args,req);listing:=(outcome->'result'->>'listing_id')::uuid;
 if not exists(select 1 from public.ludus_items where id=it and owner_id is null and market_listing_id=listing)then raise exception 'TEST: item not escrowed';end if;
 if exists(select 1 from public.ludus_items where id=it and owner_id=s)then raise exception 'TEST: old arena client can see sale item';end if;
 again:=public.ludus_market('create',args,req);
 if again->'result'<>outcome->'result'or(select count(*)from ludus_private.market_listings_v66 where asset_id=it)<>1 then raise exception 'TEST: create retry duplicated listing';end if;
 blocked:=false;begin update public.ludus_items set enhancement=6 where id=it;exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: sale item can be changed';end if;
 blocked:=false;begin perform public.ludus_market('buy',jsonb_build_object('listing_id',listing,'expected_price',1001),gen_random_uuid());exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: seller bought own item';end if;
 perform set_config('request.jwt.claim.sub',other::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',other,'role','authenticated')::text,true);
 blocked:=false;begin perform public.ludus_market('cancel',jsonb_build_object('listing_id',listing),gen_random_uuid());exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: other user cancelled listing';end if;
 blocked:=false;begin perform public.ludus_market('buy',jsonb_build_object('listing_id',listing,'expected_price',1001),gen_random_uuid());exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: buyer without gold succeeded';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 blocked:=false;begin perform public.ludus_market('buy',jsonb_build_object('listing_id',listing,'expected_price',1002),gen_random_uuid());exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: price mismatch accepted';end if;
 args:=jsonb_build_object('listing_id',listing,'expected_price',1001);outcome:=public.ludus_market('buy',args,buy_req);again:=public.ludus_market('buy',args,buy_req);
 if again->'result'<>outcome->'result'then raise exception 'TEST: retry result differs';end if;
 if(select gold from public.ludus_accounts where user_id=b)<>98999 or(select gold from public.ludus_accounts where user_id=s)<>1950 then raise exception 'TEST: wallet transfer or commission incorrect';end if;
 if(select to_jsonb(i)-array['owner_id','market_listing_id']from public.ludus_items i where id=it)<>before_stats then raise exception 'TEST: stats or stones changed';end if;
 if not exists(select 1 from public.ludus_items where id=it and owner_id=b and market_listing_id is null)then raise exception 'TEST: item not transferred';end if;
 blocked:=false;begin perform public.ludus_market('buy',jsonb_build_object('listing_id',listing,'expected_price',1002),buy_req);exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: request id reused for different payload';end if;
 blocked:=false;begin perform public.ludus_market('buy',args,gen_random_uuid());exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: item sold twice';end if;
 -- Cancel, then expire, a new listing. Every property survives escrow.
 outcome:=public.ludus_market('create',jsonb_build_object('asset_type','item','asset_id',it,'price',900,'hours',6),gen_random_uuid());listing:=(outcome->'result'->>'listing_id')::uuid;
 perform public.ludus_market('cancel',jsonb_build_object('listing_id',listing),gen_random_uuid());
 if not exists(select 1 from public.ludus_items where id=it and owner_id=b and market_listing_id is null)then raise exception 'TEST: cancel did not return item';end if;
 outcome:=public.ludus_market('create',jsonb_build_object('asset_type','item','asset_id',it,'price',900,'hours',6),gen_random_uuid());listing:=(outcome->'result'->>'listing_id')::uuid;
 update ludus_private.market_listings_v66 set expires_at=clock_timestamp()-interval '1 second'where id=listing;
 perform public.ludus_training_state();
 if not exists(select 1 from public.ludus_items where id=it and owner_id=b and market_listing_id is null)then raise exception 'TEST: ordinary game load did not release expiry';end if;
 -- Gladiator trading and the last-fighter protection.
 perform set_config('request.jwt.claim.sub',s::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',s,'role','authenticated')::text,true);
 insert into public.ludus_gladiators(owner_id,name,class)values(s,'Test Marcus','murmillo')returning id into gid;
 blocked:=false;begin perform public.ludus_market('create',jsonb_build_object('asset_type','gladiator','asset_id',gid,'price',1000,'hours',12),gen_random_uuid());exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: seller listed last gladiator';end if;
 insert into public.ludus_gladiators(owner_id,name,class)values(s,'Test Lucius','hoplomachus');
 outcome:=public.ludus_market('create',jsonb_build_object('asset_type','gladiator','asset_id',gid,'price',1000,'hours',12),gen_random_uuid());listing:=(outcome->'result'->>'listing_id')::uuid;
 if not exists(select 1 from public.ludus_gladiators where id=gid and status='locked'and market_listing_id=listing)then raise exception 'TEST: gladiator not reserved';end if;
 blocked:=false;begin update public.ludus_gladiators set status='available'where id=gid;exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: reserved gladiator can be used';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 perform public.ludus_market('buy',jsonb_build_object('listing_id',listing,'expected_price',1000),gen_random_uuid());
 if not exists(select 1 from public.ludus_gladiators where id=gid and owner_id=b and status='available'and market_listing_id is null)then raise exception 'TEST: gladiator transfer failed';end if;
 -- Guests have no access to the privileged transaction entry point or tables.
 if has_function_privilege('anon','public.ludus_market(text,jsonb,uuid)','execute')or has_function_privilege('anon','ludus_private.market_call_v66(text,jsonb,uuid)','execute')or has_table_privilege('authenticated','ludus_private.market_listings_v66','insert,update,delete')then raise exception 'TEST: marketplace permissions too broad';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','is_anonymous',true)::text,true);
 blocked:=false;begin perform public.ludus_market();exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'TEST: anonymous session can use marketplace';end if;
 -- Exercise the invoker wrappers with the exact role PostgREST uses.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','is_anonymous',false)::text,true);
 execute 'set local role authenticated';
 outcome:=public.ludus_market();
 if(outcome->>'gold')::bigint<>97999 then raise exception 'TEST: authenticated RPC returned wrong wallet';end if;
 perform public.ludus_training_state();
 execute 'reset role';
end;$$;
rollback;
select 'passed; all fixtures rolled back' as forum_market_v66_integration;
