-- Production verification: fixture accounts, clan, coins and awards all roll back.
begin;
do $$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];gids uuid[]:=array[gen_random_uuid(),gen_random_uuid()];iid uuid:=gen_random_uuid();cid uuid;rid uuid;request uuid:=gen_random_uuid();source uuid:=gen_random_uuid();s jsonb;q uuid;k integer;denied boolean;
begin
 for k in 1..3 loop
  insert into auth.users(id,is_anonymous)values(ids[k],true);
  insert into public.ludus_accounts(user_id,username,ludus_name,gold)values(ids[k],'qa22_'||left(replace(ids[k]::text,'-',''),12),'QA Ludus '||k,5000);
 end loop;
 for k in 1..2 loop insert into public.ludus_gladiators(id,owner_id,name,class)values(gids[k],ids[k],'QA Marcus '||k,'murmillo');end loop;
 insert into public.ludus_items(id,owner_id,kind,model)values(iid,ids[1],'weapon','gladius');
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 s:=public.ludus_clan('create',jsonb_build_object('name','QA Legio '||left(source::text,8),'emblem',30,'background','#791c2a','emblem_color','#d8b36d'),gen_random_uuid());cid:=(s#>>'{state,clan,id}')::uuid;
 if(s#>>'{state,clan,capacity}')::int<>10 then raise exception 'Başlangıç kapasitesi';end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);perform public.ludus_clan('apply',jsonb_build_object('clan_id',cid),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);s:=public.ludus_clan();q:=(s#>>'{applications,0,id}')::uuid;perform public.ludus_clan('request_accept',jsonb_build_object('id',q),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);perform public.ludus_clan('deposit','{"amount":800}',request);perform public.ludus_clan('deposit','{"amount":800}',request);s:=public.ludus_clan();
 if(s#>>'{clan,gold}')::int<>800 or(s#>>'{wallet,gold}')::int<>4200 then raise exception 'Tek seferlik kasa transferi';end if;
 denied:=false;begin perform public.ludus_clan('permission',jsonb_build_object('user_id',ids[3],'enabled',true),gen_random_uuid());exception when others then denied:=true;end;if not denied then raise exception 'Lider yetki kontrolü';end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);perform public.ludus_clan('vault_deposit',jsonb_build_object('item_id',iid),gen_random_uuid());perform public.ludus_clan('permission',jsonb_build_object('user_id',ids[2],'enabled',true),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);perform public.ludus_clan('vault_withdraw',jsonb_build_object('item_id',iid),gen_random_uuid());if(select owner_id from public.ludus_items where id=iid)<>ids[2]then raise exception 'Eşya devri';end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);s:=public.ludus_clan('roster_create','{"name":"QA Lejyon","kind":"league"}',gen_random_uuid());rid:=(s#>>'{state,roster,id}')::uuid;
 perform public.ludus_clan('roster_invite',jsonb_build_object('roster_id',rid,'user_id',ids[2]),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);perform public.ludus_clan('roster_join',jsonb_build_object('roster_id',rid,'gladiator_id',gids[2]),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);perform public.ludus_clan('roster_lock',jsonb_build_object('roster_id',rid),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);perform public.ludus_training_state();denied:=false;begin perform public.ludus_match('join',null,gids[2]);exception when others then denied:=true;end;if not denied then raise exception 'Kilitli kadro multiplayer engeli';end if;
 perform public.ludus_clan_award_championship(cid,'league',source,rid);perform public.ludus_clan_award_championship(cid,'league',source,rid);
 s:=public.ludus_clan();if(s#>>'{clan,experience}')::int<>100 or(s#>>'{trophies,league}')::int<>1 then raise exception 'Şampiyonluk tek seferlik kayıt';end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);s:=public.ludus_clan('level_up','{}',gen_random_uuid());if(s#>>'{state,clan,level}')::int<>2 or(s#>>'{state,clan,experience}')::int<>0 or(s#>>'{state,clan,gold}')::int<>300 then raise exception 'EXP ve denarius tüketimi';end if;
 if ludus_private.clan_capacity(20)<>30 or has_function_privilege('authenticated','public.ludus_clan_award_championship(uuid,text,uuid,uuid)','EXECUTE')or has_function_privilege('anon','public.ludus_clan(text,jsonb,uuid)','EXECUTE')then raise exception 'Kapasite veya ödül yetki sınırı';end if;
 if exists(select 1 from pg_class where relname like 'ludus_clan%'and relkind='r'and not relrowsecurity)then raise exception 'Klan RLS eksik';end if;
end $$;
rollback;
select 'GEÇTİ: klan kurma, başvuru, üyelik, tekrar güvenli denarius, kasa izni, eşya devri, kadro kilidi, Ludus yükleme, multiplayer engeli, tek şampiyonluk, EXP+denarius, kapasite ve yetkiler. Test verisi kalmadı.'as result;
