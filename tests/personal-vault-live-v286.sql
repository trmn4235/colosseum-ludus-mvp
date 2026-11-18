-- Real database/RLS integration with disposable accounts, rolled back entirely.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); s jsonb; before_gold bigint; denied boolean;
begin
 insert into auth.users(id,email,raw_user_meta_data)
 select u,'qa-vault286-'||u||'@example.invalid',jsonb_build_object('username','qav286_'||left(replace(u::text,'-',''),16),'ludus_name','QA Kasa '||left(u::text,8)) from unnest(array[a,b])u;
 insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson,read_at) select a,'guard',n,now() from generate_series(1,130)n;
 insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson) values(a,'guard',131),(a,'cook',1),(b,'guard',401);
 insert into ludus_supply_private.stock(owner_id,sku,quantity) values(a,'iron_ore',123) on conflict(owner_id,sku)do update set quantity=excluded.quantity;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 s:=public.ludus_personal_vault();before_gold:=(s->>'gold')::bigint;
 if s->>'user_id'<>a::text or (s#>>'{counts,papyrus}')::int<>2 then raise exception 'Chest ownership/count';end if;
 s:=public.ludus_personal_vault('papyrus',0,null);
 if jsonb_array_length(s->'rows')<>2 or exists(select 1 from jsonb_array_elements(s->'rows')r where r->>'read_at' is not null) then raise exception 'Unread separation';end if;
 s:=public.ludus_special_staff_archive('guard',83,false);
 if (s->>'paper_count')::int<>130 or (s->>'page')::int<>21 or jsonb_array_length(s->'papyri')<>4 or (s#>>'{papyri,3,lesson}')::int<>130 then raise exception '130 archive pagination';end if;
 perform public.ludus_special_staff_read('guard',131,request);
 perform public.ludus_special_staff_read('guard',131,request);
 s:=public.ludus_personal_vault('papyrus',0,'guard');if (s->>'total')::int<>0 then raise exception 'Read paper remained in chest';end if;
 s:=public.ludus_special_staff_archive('guard',0,false);if (s->>'paper_count')::int<>131 then raise exception 'Read archive replay';end if;
 s:=public.ludus_personal_vault();if (s->>'gold')::bigint<>before_gold then raise exception 'Reading spent money';end if;
 if has_function_privilege('authenticated','ludus_staff_private.vault_rows_v286(uuid)','EXECUTE') then raise exception 'Private ownership helper exposed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 s:=public.ludus_special_staff_archive('guard',0,false);if (s->>'paper_count')::int<>0 then raise exception 'Other owner archive leaked';end if;
 s:=public.ludus_personal_vault('papyrus');if (s->>'total')::int<>1 or (s#>>'{rows,0,lesson}')::int<>401 then raise exception 'Other owner chest leaked';end if;
 perform set_config('request.jwt.claims','{"is_anonymous":true}',true);denied:=false;
 begin perform public.ludus_personal_vault();exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous chest allowed';end if;
 execute 'reset role';
end;
$test$;
rollback;
select 'PASS V286 personal chest: 130 read archive, unread separation, idempotent learning and account isolation; all fixtures rolled back' as result;
