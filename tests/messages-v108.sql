-- Fixtures are generated and entirely rolled back. No real recipient is used.
begin;
do $$
declare
 ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 clan uuid:=gen_random_uuid();gid uuid:=gen_random_uuid();req uuid:=gen_random_uuid();future_req uuid:=gen_random_uuid();
 s jsonb;t jsonb;denied boolean;k integer;event text;through text;first_id text;
begin
 for k in 1..3 loop
  insert into auth.users(id,is_anonymous)values(ids[k],false);
  insert into public.ludus_accounts(user_id,username,ludus_name,gold,diamonds)values(ids[k],'qa108_'||left(replace(ids[k]::text,'-',''),12),'QA108 '||k,1000,0);
 end loop;
 insert into public.ludus_friends(requester,target,state)values(ids[1],ids[2],'accepted');
 insert into public.ludus_clans(id,name,emblem,background,emblem_color,leader_id)values(clan,'QA108 Test',1,'#651c2b','#b99a57',ids[1]);
 insert into public.ludus_clan_members(user_id,clan_id,joined_at)values(ids[1],clan,now()-interval '1 day'),(ids[2],clan,now()-interval '1 day');
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'role','authenticated','is_anonymous',false)::text,true);
 insert into public.ludus_gladiators(id,owner_id,name,class)values(gid,ids[1],'QA Felix','murmillo');
 insert into public.ludus_training_sessions(id,owner_id,gladiator_id,training_day,started_at,train_until,rest_until,exercise_stat)
 values(gen_random_uuid(),ids[1],gid,current_date,now()-interval '3 hours',now()-interval '2 hours',now()-interval '1 hour','strength');
 insert into public.ludus_imperial_assignments(owner_id,mission_id,mission,gladiators,started_at,ends_at)
 select ids[1],id,'{"title":"QA Ostia","difficulty":1}','[]',now()-interval '2 hours',now()-interval '1 hour' from public.ludus_imperial_catalog limit 1;
 insert into public.ludus_upgrade_receipts(owner_id,request_id,item_id,action,result)values(ids[1],gen_random_uuid(),gen_random_uuid(),'enhance','{"success":true,"plus":4}');
 insert into ludus_private.level_rewards(owner_id,level)select ids[1],min(level)from ludus_private.level_reward_catalog on conflict do nothing;
 insert into ludus_supply_private.jobs(owner_id,destination,workers,started_at,ends_at,claimed_at,cargo)
 select ids[1],id,1,now()-interval '2 hours',now()-interval '1 hour',now()-interval '1 hour','{}' from ludus_supply_private.destinations limit 1;
 insert into ludus_private.market_listings_v66(seller_id,asset_type,asset_id,snapshot,kind,model,enhancement,price,expires_at,status,buyer_id,sold_at,net_income)
 values(ids[1],'item',gen_random_uuid(),'{}','weapon','gladius',4,100,now(),'sold',ids[2],now()-interval '5 minutes',95);
 s:=public.ludus_message_center('state','{"notification_limit":20}');
 if(s->>'notification_total')::integer<>7 or(s->>'notification_unread')::integer<>7 then raise exception 'Missing real events: %',s;end if;
 if exists(select 1 from public.ludus_imperial_assignments where owner_id=ids[1]and(completed_at is not null or claimed_at is not null))
 or (select gold from public.ludus_accounts where user_id=ids[1])<>1000 then raise exception 'Inbox changed game progress';end if;
 t:=public.ludus_message_center();if(t->>'notification_total')::integer<>7 then raise exception 'Duplicate events on refresh';end if;
 event:=s#>>'{notifications,0,event_key}';
 t:=public.ludus_message_center('read',jsonb_build_object('event_key',event));if(t->>'notification_unread')::integer<>6 then raise exception 'Read not persisted';end if;
 through:=s->>'notification_latest';
 -- Events that arrive after the clear confirmation must survive.
 insert into ludus_message_private.notifications_v108 values(ids[1],'new-after-confirm','reward','New','New event','levels',clock_timestamp(),null,null);
 t:=public.ludus_message_center('clear',jsonb_build_object('through',through));
 if(t->>'notification_total')::int<>1 then raise exception 'Clear removed unseen newer event';end if;
 t:=public.ludus_message_center();if(t->>'notification_total')::int<>1 then raise exception 'Dismissed events reappeared';end if;
 s:=public.ludus_message_center('send',jsonb_build_object('channel','private','peer',ids[2],'body','<b>Private fixture</b>'),req);
 perform public.ludus_message_center('send',jsonb_build_object('channel','private','peer',ids[2],'body','<b>Private fixture</b>'),req);
 if(select count(*)from ludus_message_private.messages where sender_id=ids[1])<>1 then raise exception 'Duplicate private retry';end if;
 denied:=false;begin perform public.ludus_message_center('send',jsonb_build_object('channel','private','peer',ids[3],'body','Outsider'),gen_random_uuid());exception when others then denied:=true;end;if not denied then raise exception 'Stranger send allowed';end if;
 denied:=false;begin perform public.ludus_message_center('send',jsonb_build_object('channel','global','body','changed'),req);exception when others then denied:=true;end;if not denied then raise exception 'Cross-channel retry accepted';end if;
 req:=gen_random_uuid();s:=public.ludus_message_center('send','{"channel":"guild","body":"QA announcement","announcement":true}',req);
 perform public.ludus_message_center('send','{"channel":"guild","body":"QA announcement","announcement":true}',req);
 if(select count(*)from ludus_message_private.channels_v108 where sender_id=ids[1])<>1 then raise exception 'Duplicate guild retry';end if;
 denied:=false;begin perform public.ludus_message_center('send','{"channel":"guild","body":"Changed","announcement":true}',req);exception when others then denied:=true;end;if not denied then raise exception 'Mutable retry accepted';end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'role','authenticated','is_anonymous',false)::text,true);
 s:=public.ludus_message_center('thread','{"channel":"guild"}');
 if(s->>'message_total')::int<>1 or(s->>'notification_total')::int<>1 or(s->>'unread')::int<>1 then raise exception 'Guild announcement/private unread missing';end if;
 denied:=false;begin perform public.ludus_message_center('send','{"channel":"guild","body":"Not leader","announcement":true}',gen_random_uuid());exception when others then denied:=true;end;if not denied then raise exception 'Member can announce';end if;
 s:=public.ludus_message_center('thread',jsonb_build_object('channel','private','peer',ids[1],'limit',1));if(s->>'unread')::int<>0 then raise exception 'Visible private message not read';end if;
 -- Pagination is server bounded and ordered; only the visible page is read.
 update ludus_message_private.messages set created_at=clock_timestamp()-interval '30 seconds' where sender_id=ids[1];
 insert into ludus_message_private.messages(sender_id,recipient_id,body,client_request,created_at)
 select ids[1],ids[2],'History '||x,gen_random_uuid(),clock_timestamp()-make_interval(secs=>10-x) from generate_series(1,6)x;
 s:=public.ludus_message_center('thread',jsonb_build_object('channel','private','peer',ids[1],'limit',2));
 first_id:=s#>>'{messages,0,id}';if jsonb_array_length(s->'messages')<>2 or(s->>'unread')::int<>4 then raise exception 'Pagination/read visibility incorrect: %',s;end if;
 insert into ludus_message_private.messages(id,sender_id,recipient_id,body,client_request)values(future_req,ids[1],ids[2],'Arrived during pagination',gen_random_uuid());
 t:=public.ludus_message_center('thread',jsonb_build_object('channel','private','peer',ids[1],'limit',2,'offset',2,'thread_until',s->>'thread_until'));if(t->>'message_total')::int<>7 then raise exception 'New message shifted old history pages';end if;
 delete from ludus_message_private.messages where id=future_req;
 if exists(select 1 from jsonb_array_elements(t->'messages')x where x->>'id'=first_id)then raise exception 'Overlapping history pages';end if;
 update public.ludus_friends set state='removed'where requester=ids[1]and target=ids[2];
 s:=public.ludus_message_center('thread',jsonb_build_object('channel','private','peer',ids[1]));if(s->>'can_send')::boolean or(s->>'message_total')::int<>7 then raise exception 'Unfriend history/access failed';end if;
 delete from public.ludus_clan_members where user_id=ids[2];
 s:=public.ludus_message_center('thread','{"channel":"guild"}');if jsonb_array_length(s->'messages')<>0 or(s->>'can_send')::boolean then raise exception 'Former member sees guild';end if;
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[3],'role','authenticated','is_anonymous',false)::text,true);
 s:=public.ludus_message_center('thread',jsonb_build_object('channel','guild','clan_id',clan));if jsonb_array_length(s->'messages')<>0 or(s->>'notification_total')::int<>0 then raise exception 'Outsider data leak';end if;
 denied:=false;begin perform public.ludus_message_center('read',jsonb_build_object('event_key',event));exception when others then denied:=true;end;if not denied then raise exception 'Outsider read accepted';end if;
 denied:=false;begin perform public.ludus_message_center('thread',jsonb_build_object('channel','private','peer',ids[1]));exception when others then denied:=true;end;if not denied then raise exception 'Outsider thread accepted';end if;
 denied:=false;begin perform public.ludus_message_center('send','{"channel":"global","body":" "}',gen_random_uuid());exception when others then denied:=true;end;if not denied then raise exception 'Empty message accepted';end if;
 denied:=false;begin perform public.ludus_message_center('send',jsonb_build_object('channel','global','body',repeat('x',1001)),gen_random_uuid());exception when others then denied:=true;end;if not denied then raise exception 'Oversize message accepted';end if;
 for k in 1..10 loop perform public.ludus_message_center('send',jsonb_build_object('channel','global','body','Public fixture '||k),gen_random_uuid());end loop;
 denied:=false;begin perform public.ludus_message_center('send','{"channel":"global","body":"Too fast"}',gen_random_uuid());exception when others then denied:=true;end;if not denied then raise exception 'Rate limit failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[3],'role','authenticated','is_anonymous',true)::text,true);
 denied:=false;begin perform public.ludus_message_center();exception when others then denied:=true;end;if not denied then raise exception 'Anonymous admitted';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 denied:=false;begin perform public.ludus_message_center();exception when others then denied:=true;end;if not denied then raise exception 'Missing auth admitted';end if;
 if has_function_privilege('anon','public.ludus_message_center(text,jsonb,uuid)','EXECUTE')
 or has_function_privilege('authenticated','ludus_message_private.sync_notifications_v108(uuid)','EXECUTE')
 or has_table_privilege('authenticated','ludus_message_private.notifications_v108','SELECT,INSERT,UPDATE,DELETE')
 or has_table_privilege('authenticated','ludus_message_private.channels_v108','SELECT,INSERT,UPDATE,DELETE')
 or exists(select 1 from pg_class where oid in('ludus_message_private.notifications_v108'::regclass,'ludus_message_private.channels_v108'::regclass)and not relrowsecurity)
 then raise exception 'Unsafe grants or RLS';end if;
 -- Leave the disposable user's claims for an actual authenticated-role RPC.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'role','authenticated','is_anonymous',false)::text,true);
end $$;
set local role authenticated;
do $$begin if(public.ludus_message_center('thread','{"channel":"global"}')->>'message_total')::int<10 then raise exception 'Authenticated RPC failed';end if;end $$;
reset role;
rollback;
select 'PASS: seven authoritative event types; deduplication, durable read/clear, unseen-event protection; private/guild/global authorization, leader-only announcements, pagination, idempotency, limits, RLS and grants. All fixtures rolled back.' as result;
