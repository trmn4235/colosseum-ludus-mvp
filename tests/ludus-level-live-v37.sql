-- Generated account only. No email is sent; every fixture rolls back.
begin;
do $$
declare u uuid:=gen_random_uuid(); g uuid; b uuid; r jsonb; saved jsonb;
 d date:=(clock_timestamp()at time zone'Europe/Istanbul')::date;
 gold_before bigint; diamonds_before integer; items_before integer; stones_before integer;
begin
 insert into auth.users(id,is_anonymous,email,raw_user_meta_data)
 values(u,false,'qa37_'||u::text||'@example.invalid',jsonb_build_object('username','qa37_'||left(replace(u::text,'-',''),12),'ludus_name','QA Ludus V37'));
 perform set_config('request.jwt.claim.sub',u::text,true);
 r:=public.ludus_progress();
 if(r->>'owned_gladiators')::integer<>2 or(r->>'granted_gladiators')::integer<>2 or(r->>'level')::integer<>1 then raise exception 'Starter count failed';end if;
 perform public.ludus_daily_state();
 r:=public.ludus_daily_claim(d,'visit');
 if(r#>>'{reward,ludus_exp}')::integer<>150 then raise exception 'Daily EXP failed';end if;
 perform public.ludus_daily_claim(d,'visit');
 if(public.ludus_progress()->>'experience')::integer<>150 then raise exception 'Daily duplicate failed';end if;
 select id into g from public.ludus_gladiators where owner_id=u limit 1;
 perform public.ludus_start_battle_v2(g,'4x5','{}',gen_random_uuid());
 select id into b from public.ludus_battles where owner_id=u and finished_at is null limit 1;
 update public.ludus_battles set started_at=clock_timestamp()-interval '1 minute'where id=b;
 r:=public.ludus_finish_battle_v2(b,true,'{"alive":true,"exit_slots":{}}');
 if(r->>'ludus_exp')::integer<>100 then raise exception 'Battle EXP response failed';end if;
 saved:=r;r:=public.ludus_finish_battle_v2(b,true,'{"alive":true,"exit_slots":{}}');
 if r<>saved or(public.ludus_progress()->>'experience')::integer<>250 then raise exception 'Battle receipt duplicate failed';end if;
 perform ludus_private.level_grant(u,'imperial','qa37_1',1000,clock_timestamp());
 perform ludus_private.level_grant(u,'imperial','qa37_2',1000,clock_timestamp());
 perform ludus_private.level_grant(u,'imperial','qa37_3',1000,clock_timestamp());
 select gold,diamonds into gold_before,diamonds_before from public.ludus_accounts where user_id=u;
 select count(*)into items_before from public.ludus_items where owner_id=u;
 select coalesce(sum(quantity),0)into stones_before from public.ludus_stones where owner_id=u;
 r:=public.ludus_progress('claim',2);
 if(r->>'owned_gladiators')::integer<>3 or(r->>'granted_gladiators')::integer<>3 then raise exception 'Level 2 roster failed';end if;
 if(r#>>'{wallet,gold}')::bigint<>gold_before+200 or(r#>>'{wallet,diamonds}')::integer<>diamonds_before+2 then raise exception 'Level 2 currency failed';end if;
 if(select count(*)from public.ludus_items where owner_id=u)<>items_before+1 or(select sum(quantity)from public.ludus_stones where owner_id=u)<>stones_before+3 then raise exception 'Level 2 item/stone draw failed';end if;
 saved:=r;r:=public.ludus_progress('claim',2);
 if r->'wallet'<>saved->'wallet' or(r->>'owned_gladiators')::integer<>3 or(select count(*)from public.ludus_items where owner_id=u)<>items_before+1 then raise exception 'Level claim duplicate failed';end if;
 update public.ludus_progression set experience=ludus_private.level_threshold(6)where owner_id=u;
 r:=public.ludus_progress('claim',null);
 if(r->>'owned_gladiators')::integer<>4 or(r->>'granted_gladiators')::integer<>4 then raise exception 'Level 6 count failed';end if;
 update public.ludus_progression set experience=ludus_private.level_threshold(10)where owner_id=u;
 r:=public.ludus_progress('claim',null);
 if(r->>'owned_gladiators')::integer<>5 or(r->>'granted_gladiators')::integer<>5 then raise exception 'Level 10 count failed';end if;
 if exists(select class from public.ludus_gladiators where owner_id=u group by class having count(*)>1)then raise exception 'Duplicate gladiator class';end if;
 if has_function_privilege('anon','public.ludus_progress(text,integer)','execute')or has_function_privilege('authenticated','ludus_private.level_grant(uuid,text,text,integer,timestamptz)','execute')or has_table_privilege('authenticated','public.ludus_progression','update')then raise exception 'Client EXP permissions failed';end if;
end $$;
rollback;
select 'PASS: live starter 2, daily and battle EXP, duplicate receipts and level claims, actual random items/stones, 3/4/5 gladiators and client grants. All fixtures rolled back.' as result;
