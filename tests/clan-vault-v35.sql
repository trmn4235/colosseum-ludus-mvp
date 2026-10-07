-- Run against production with generated fixtures; every row and balance rolls back.
begin;
do $$
declare
 ids uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 cid uuid; iid uuid := gen_random_uuid(); equipped uuid := gen_random_uuid(); glad uuid := gen_random_uuid();
 req uuid; d jsonb; s jsonb; before_item jsonb; after_item jsonb; denied boolean; k integer; g bigint;
begin
 for k in 1..3 loop
  insert into auth.users(id,is_anonymous) values(ids[k],true);
  insert into public.ludus_accounts(user_id,username,ludus_name,gold,diamonds)
   values(ids[k],'qa35_'||left(replace(ids[k]::text,'-',''),12),'QA Chest '||k,5000,10);
 end loop;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 s := public.ludus_clan('create',jsonb_build_object('name','QA Chest '||left(ids[1]::text,8),'emblem',2,'background','#541d2b','emblem_color','#c7a967'),gen_random_uuid());
 cid := (s#>>'{state,clan,id}')::uuid;
 insert into public.ludus_clan_members(user_id,clan_id) values(ids[2],cid);
 insert into public.ludus_items(id,owner_id,kind,model,enhancement) values(iid,ids[1],'weapon','gladius',7);
 insert into public.ludus_gladiators(id,owner_id,name,class) values(glad,ids[1],'QA Guard','murmillo');
 insert into public.ludus_items(id,owner_id,kind,model,equipped_by,equipped_slot) values(equipped,ids[1],'helmet','roman',glad,'helmet');
 insert into public.ludus_stones(owner_id,family,stone_id,quantity) values(ids[1],'sapphire',1,40),(ids[1],'ruby',1,5);
 select to_jsonb(i) - array['owner_id','clan_vault_id','vault_depositor','vaulted_at'] into before_item from public.ludus_items i where id=iid;
 req := gen_random_uuid(); d := jsonb_build_object('clan_id',cid,'item_id',iid);
 perform public.ludus_clan_vault('vault_deposit',d,req);
 s := public.ludus_clan_vault('vault_deposit',d,req);
 if not (s->>'repeated')::boolean then raise exception 'Equipment retry not idempotent'; end if;
 denied := false; begin perform public.ludus_clan_vault('vault_deposit',jsonb_build_object('clan_id',cid,'item_id',equipped),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Equipped gear accepted'; end if;

 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 s := public.ludus_clan_vault();
 if (s->>'vault_access')::boolean or jsonb_array_length(s->'vault')<>1 then raise exception 'Read-only member view or permission'; end if;
 denied := false; begin perform public.ludus_clan_vault('vault_withdraw',d,gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Unauthorized equipment withdrawal'; end if;
 denied := false; begin perform public.ludus_clan_vault('stone_deposit',jsonb_build_object('clan_id',cid,'family','diamond','stone_id',1,'quantity',1),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Unauthorized gem deposit'; end if;
 req := gen_random_uuid(); d := jsonb_build_object('clan_id',cid,'amount',800);
 perform public.ludus_clan_vault('deposit',d,req); s := public.ludus_clan_vault('deposit',d,req);
 if (s#>>'{state,wallet,gold}')::bigint<>4200 or(s#>>'{state,clan,gold}')::bigint<>800 then raise exception 'Coin conservation / duplicate transfer'; end if;
 denied := false; begin perform public.ludus_clan_vault('deposit',jsonb_build_object('clan_id',cid,'amount',801),req); exception when others then denied := true; end;
 if not denied then raise exception 'Idempotency key reused with changed data'; end if;
 foreach d in array array[
  jsonb_build_object('clan_id',cid,'amount',4201),jsonb_build_object('clan_id',cid,'amount',0),
  jsonb_build_object('clan_id',cid,'amount',-1),jsonb_build_object('clan_id',cid,'amount',1.5),
  jsonb_build_object('clan_id',gen_random_uuid(),'amount',100)] loop
  denied := false; begin perform public.ludus_clan_vault('deposit',d,gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'Invalid/overdrawn/wrong-clan donation accepted'; end if;
 end loop;
 denied := false; begin perform public.ludus_clan_vault('withdraw',jsonb_build_object('clan_id',cid,'amount',1),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Clan coins can be withdrawn'; end if;
 if (select gold from public.ludus_accounts where user_id=ids[2])<>4200 or(select gold from public.ludus_clans where id=cid)<>800 then raise exception 'Failed coin operation changed balances'; end if;

 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.ludus_clan('permission',jsonb_build_object('user_id',ids[2],'enabled',true),gen_random_uuid());
 req := gen_random_uuid(); d := jsonb_build_object('clan_id',cid,'family','sapphire','stone_id',1,'quantity',10);
 perform public.ludus_clan_vault('stone_deposit',d,req); perform public.ludus_clan_vault('stone_deposit',d,req);
 if(select quantity from public.ludus_stones where owner_id=ids[1] and family='sapphire' and stone_id=1)<>30
  or(select quantity from public.ludus_clan_vault_stones where clan_id=cid and family='sapphire' and stone_id=1)<>10 then raise exception 'Gem deposit conservation / retry'; end if;
 denied := false; begin perform public.ludus_clan_vault('stone_deposit',d||'{"quantity":31}',gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Gem deposit overdraw'; end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 req := gen_random_uuid(); d := jsonb_build_object('clan_id',cid,'item_id',iid);
 perform public.ludus_clan_vault('vault_withdraw',d,req); perform public.ludus_clan_vault('vault_withdraw',d,req);
 select to_jsonb(i) - array['owner_id','clan_vault_id','vault_depositor','vaulted_at'] into after_item from public.ludus_items i where id=iid;
 if before_item<>after_item or(select owner_id from public.ludus_items where id=iid)<>ids[2] then raise exception 'Gear attributes/ownership changed incorrectly'; end if;
 denied := false; begin perform public.ludus_clan_vault('vault_withdraw',d,gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Same gear withdrawn twice'; end if;
 perform public.ludus_clan_vault('stone_withdraw',jsonb_build_object('clan_id',cid,'family','sapphire','stone_id',1,'quantity',10),gen_random_uuid());
 if exists(select 1 from public.ludus_clan_vault_stones where clan_id=cid and family='sapphire')
  or(select quantity from public.ludus_stones where owner_id=ids[2] and family='sapphire' and stone_id=1)<>10 then raise exception 'Complete gem withdrawal must free slot'; end if;

 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.ludus_clan_vault('stone_deposit',jsonb_build_object('clan_id',cid,'family','diamond','stone_id',1,'quantity',4),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 perform public.ludus_clan_vault('stone_withdraw',jsonb_build_object('clan_id',cid,'family','diamond','stone_id',1,'quantity',3),gen_random_uuid());
 if(select diamonds from public.ludus_accounts where user_id=ids[1])<>6 or(select diamonds from public.ludus_accounts where user_id=ids[2])<>13 then raise exception 'Diamond transfer balances'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.ludus_clan('permission',jsonb_build_object('user_id',ids[2],'enabled',false),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 denied := false; begin perform public.ludus_clan_vault('stone_withdraw',jsonb_build_object('clan_id',cid,'family','diamond','stone_id',1,'quantity',1),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Revoked permission still works'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform set_config('ludus.clan_transfer','on',true);
 insert into public.ludus_items(owner_id,kind,model,clan_vault_id)
  select ids[1],'weapon','sica',cid from generate_series(1,59);
 perform set_config('ludus.clan_transfer','',true);
 -- One gem stack + 59 equipment items fills all 60 shared slots.
 perform public.ludus_clan_vault('stone_deposit',jsonb_build_object('clan_id',cid,'family','diamond','stone_id',1,'quantity',1),gen_random_uuid());
 denied := false; begin perform public.ludus_clan_vault('stone_deposit',jsonb_build_object('clan_id',cid,'family','ruby','stone_id',1,'quantity',1),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'New stack bypassed full chest'; end if;
 insert into public.ludus_items(owner_id,kind,model) values(ids[1],'weapon','trident') returning id into iid;
 denied := false; begin perform public.ludus_clan('vault_deposit',jsonb_build_object('item_id',iid),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Old equipment RPC bypassed stone slot capacity'; end if;
 denied := false; begin perform public.ludus_clan_vault('vault_deposit',jsonb_build_object('clan_id',cid,'item_id',iid),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'New equipment RPC bypassed shared slot capacity'; end if;
 if(select quantity from public.ludus_stones where owner_id=ids[1] and family='ruby' and stone_id=1)<>5 then raise exception 'Failed full-chest transfer lost stones'; end if;
 perform public.ludus_clan_vault('stone_withdraw',jsonb_build_object('clan_id',cid,'family','diamond','stone_id',1,'quantity',2),gen_random_uuid());
 perform public.ludus_clan_vault('vault_deposit',jsonb_build_object('clan_id',cid,'item_id',iid),gen_random_uuid());
 s := public.ludus_clan_vault();
 if jsonb_array_length(s->'vault')+jsonb_array_length(s->'vault_stones')<>60 then raise exception 'Capacity after slot reuse'; end if;
 denied := false; begin perform public.ludus_clan_vault('stone_deposit',jsonb_build_object('clan_id',cid,'family','sapphire','stone_id',99,'quantity',1),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Invalid stone ID accepted'; end if;
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 s := public.ludus_clan_vault();
 if s->'clan'<>'null'::jsonb or jsonb_array_length(s->'vault')<>0 or jsonb_array_length(s->'vault_stones')<>0 then raise exception 'Outsider can view clan chest'; end if;
 denied := false; begin perform public.ludus_clan_vault('deposit',jsonb_build_object('clan_id',cid,'amount',1),gen_random_uuid()); exception when others then denied := true; end;
 if not denied then raise exception 'Outsider can mutate clan chest'; end if;
 if has_function_privilege('anon','public.ludus_clan_vault(text,jsonb,uuid)','EXECUTE')
  or has_function_privilege('authenticated','ludus_private.clan_vault_state(uuid)','EXECUTE')
  or has_table_privilege('authenticated','public.ludus_clan_vault_stones','SELECT,INSERT,UPDATE,DELETE')
  or not(select relrowsecurity from pg_class where oid='public.ludus_clan_vault_stones'::regclass) then raise exception 'Chest access grants / RLS'; end if;
end $$;
rollback;
select 'PASS: read-only member, outsider, permissions/revocation, coin one-way/conservation, invalid amounts, wrong clan, equipment ownership/attributes/equipped guard, gem and diamond stacks, duplicate requests, double withdrawals, shared capacity/legacy RPC, RLS/private grants. All fixtures rolled back.' as result;
