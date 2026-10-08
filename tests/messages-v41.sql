-- Only generated accounts are used. All test users, friendships and messages roll back.
begin;
do $$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()]; req uuid:=gen_random_uuid(); s jsonb; denied boolean; k integer;
begin
 for k in 1..3 loop
  insert into auth.users(id,is_anonymous) values(ids[k],false);
  insert into public.ludus_accounts(user_id,username,ludus_name,gold,diamonds)
   values(ids[k],'qa41_'||left(replace(ids[k]::text,'-',''),12),'QA Message '||k,0,0);
 end loop;
 insert into public.ludus_friends(requester,target,state) values(ids[1],ids[2],'accepted');
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'role','authenticated','is_anonymous',false)::text,true);
 s:=public.ludus_messages();
 if jsonb_array_length(s->'friends')<>1 or jsonb_array_length(s->'conversations')<>0 then raise exception 'Wrong empty inbox/friends'; end if;
 s:=public.ludus_messages('send',ids[2],' <b>Test</b> ',req);
 perform public.ludus_messages('send',ids[2],' <b>Test</b> ',req);
 if (select count(*) from ludus_message_private.messages where sender_id=ids[1])<>1 or s#>>'{messages,0,body}'<>'<b>Test</b>' then raise exception 'Duplicate retry/body'; end if;
 denied:=false;begin perform public.ludus_messages('send',ids[2],'Changed',req);exception when others then denied:=true;end;
 if not denied then raise exception 'Changed retry accepted'; end if;
 denied:=false;begin perform public.ludus_messages('send',ids[3],'Stranger',gen_random_uuid());exception when others then denied:=true;end;
 if not denied then raise exception 'Stranger send accepted'; end if;
 denied:=false;begin perform public.ludus_messages('send',ids[1],'Self',gen_random_uuid());exception when others then denied:=true;end;
 if not denied then raise exception 'Self send accepted'; end if;
 denied:=false;begin perform public.ludus_messages('send',ids[2],' ',gen_random_uuid());exception when others then denied:=true;end;
 if not denied then raise exception 'Empty body accepted'; end if;
 denied:=false;begin perform public.ludus_messages('send',ids[2],repeat('x',1001),gen_random_uuid());exception when others then denied:=true;end;
 if not denied then raise exception 'Long body accepted'; end if;
 if(select read_at from ludus_message_private.messages where client_request=req) is not null then raise exception 'Sender marked own outgoing message read'; end if;
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[3],'role','authenticated','is_anonymous',false)::text,true);
 s:=public.ludus_messages();if jsonb_array_length(s->'conversations')<>0 or (s->>'unread')::int<>0 then raise exception 'Outsider inbox leaked'; end if;
 denied:=false;begin perform public.ludus_messages('thread',ids[1]);exception when others then denied:=true;end;
 if not denied then raise exception 'Outsider thread accessible'; end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'role','authenticated','is_anonymous',false)::text,true);
 s:=public.ludus_messages();if(s->>'unread')::int<>1 then raise exception 'Unread missing'; end if;
 s:=public.ludus_messages('thread',ids[1]);if(s->>'unread')::int<>0 or(s#>>'{messages,0,mine}')::boolean then raise exception 'Read/recipient direction incorrect'; end if;
 perform public.ludus_messages('send',ids[1],'Reply',gen_random_uuid());
 update public.ludus_friends set state='removed' where requester=ids[1] and target=ids[2];
 s:=public.ludus_messages('thread',ids[1]);if jsonb_array_length(s->'messages')<>2 then raise exception 'Own history lost after unfriend'; end if;
 denied:=false;begin perform public.ludus_messages('send',ids[1],'After removal',gen_random_uuid());exception when others then denied:=true;end;
 if not denied then raise exception 'Removed friend can send'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'role','authenticated','is_anonymous',true)::text,true);
 denied:=false;begin perform public.ludus_messages();exception when others then denied:=true;end;
 if not denied then raise exception 'Anonymous account accepted'; end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 denied:=false;begin perform public.ludus_messages();exception when others then denied:=true;end;
 if not denied then raise exception 'Missing auth accepted'; end if;
 if has_function_privilege('anon','public.ludus_messages(text,uuid,text,uuid)','EXECUTE')
  or has_function_privilege('anon','ludus_message_private.handle(text,uuid,text,uuid)','EXECUTE')
  or has_table_privilege('authenticated','ludus_message_private.messages','SELECT,INSERT,UPDATE,DELETE')
  or not(select relrowsecurity from pg_class where oid='ludus_message_private.messages'::regclass) then raise exception 'Unsafe message grants/RLS'; end if;
end $$;
rollback;
select 'PASS: friend-only messages, outsider isolation, read state, immutable/idempotent retry, self/empty/long rejection, removal, anonymous/no auth, private grants and RLS. All fixtures rolled back.' as result;
