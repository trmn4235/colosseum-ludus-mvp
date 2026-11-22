-- V288: only existing husbandry calculations. No invented injury/meal flows.
-- Stable training is settled by the authenticated, owner-checked stable RPC.
create or replace function ludus_staff_private.care_value_v288(p_owner uuid,p_content text)
returns numeric language sql stable set search_path='' as $$
 select coalesce((select (effect->>'value')::numeric
  from ludus_staff_private.learned_papyrus_v288
  where owner_id=p_owner and content_id=p_content and effect->>'unit'='fraction'),0)
$$;
revoke all on function ludus_staff_private.care_value_v288(uuid,text)from public,anon,authenticated;

do $care$
declare source text;patched text;old_gain text;new_gain text;old_finish text;new_finish text;
begin
 select pg_get_functiondef('ludus_stable_private.settle(uuid,timestamptz)'::regprocedure)into source;
 old_gain:='least(100,coalesce((h.training->>h.training_stat)::integer,0)+10)';
 new_gain:='least(100,coalesce((h.training->>h.training_stat)::numeric,0)+10*(1+ludus_staff_private.care_value_v288(u,case h.training_stat when ''stamina'' then ''groom_002'' when ''speed'' then ''groom_020'' else '''' end)))';
 old_finish:='h.training_until:=null;h.training_started:=null;h.training_stat:=null;';
 -- The existing API charges 20 energy at the start. Credit the learned saving
 -- only when training completes, once, with the same maximum-energy cap.
 new_finish:='h.energy:=least(100,h.energy+20*ludus_staff_private.care_value_v288(u,''groom_021''));'||chr(10)||'   '||old_finish;
 if position(old_gain in source)=0 or position(old_finish in source)=0 then
  raise exception 'V288 stable settlement hook differs from reviewed V129/V130 source';
 end if;
 patched:=replace(replace(source,old_gain,new_gain),old_finish,new_finish);
 execute patched;
end $care$;

update ludus_staff_private.papyrus_catalog_v288
 set runtime_status='active',runtime_reason='Ahırdaki tamamlanan antrenman hesabında uygulanır.'
 where content_id in('groom_002','groom_020','groom_021');
