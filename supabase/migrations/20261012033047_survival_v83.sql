-- V83: Survival shares authenticated battle tickets, but never settles as a lost equipment match.
begin;
alter table public.ludus_battles drop constraint if exists ludus_battles_mode_check;
alter table public.ludus_battles add constraint ludus_battles_mode_check check(mode in('4x5','solo20','survival'));
create table if not exists ludus_private.survival_records_v83(
 owner_id uuid primary key references public.ludus_accounts(user_id) on delete cascade,
 battle_id uuid not null,stage integer not null check(stage>0),completed integer not null check(completed>=0),
 ludus_name text not null,gladiator_name text not null,gladiator_class text not null,
 achieved_at timestamptz not null default now()
);
alter table ludus_private.survival_records_v83 enable row level security;
revoke all on ludus_private.survival_records_v83 from public,anon,authenticated;
create index if not exists survival_rank_v83 on ludus_private.survival_records_v83(stage desc,completed desc,achieved_at);

create or replace function public.ludus_survival_record_v83() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli';end if;
 select jsonb_build_object('stage',stage,'completed',completed,'ludus_name',ludus_name,'gladiator_name',gladiator_name,'gladiator_class',gladiator_class)
 into r from ludus_private.survival_records_v83 order by stage desc,completed desc,achieved_at limit 1;
 return r;
end $$;
revoke all on function public.ludus_survival_record_v83() from public,anon;
grant execute on function public.ludus_survival_record_v83() to authenticated;

create or replace function ludus_private.finish_survival_v83(p_battle uuid,p_stats jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();b public.ludus_battles;prize jsonb;st integer;done integer;kills bigint;n bigint;min_kills bigint;max_kills bigint;seconds numeric;best integer;changed boolean:=false;abandoned boolean;
begin
 if uid is null then raise exception 'Giriş gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;
 select * into b from public.ludus_battles where id=p_battle and owner_id=uid for update;
 if not found or b.mode<>'survival' then raise exception 'Survival kaydı bulunamadı';end if;
 if b.finished_at is not null then return coalesce(b.reward,'{}');end if;
 if p_stats is null or jsonb_typeof(p_stats)<>'object' or pg_column_size(p_stats)>16384 then raise exception 'Geçersiz Survival sonucu';end if;
 abandoned:=coalesce((p_stats->>'abandoned')::boolean,false);
 st:=coalesce((p_stats->>'survival_stage')::integer,0);done:=coalesce((p_stats->>'survival_completed')::integer,0);
 kills:=coalesce((p_stats->>'kills')::bigint,0);seconds:=coalesce((p_stats->>'seconds')::numeric,0);
 if abandoned then st:=0;done:=0;kills:=0;end if;
 if st<0 or done<0 or not(st=0 and done=0 or st=done+1) or seconds<0 or kills<0 then raise exception 'Geçersiz Survival seviyesi';end if;
 n:=done/10;min_kills:=done::bigint+n*(n-1)/2;
 max_kills:=min_kills+case when st=0 then 0 when st%10=0 then st/10 else 1 end;
 if kills<min_kills or kills>max_kills or seconds>extract(epoch from(now()-b.started_at))+3 then raise exception 'Survival ilerlemesi doğrulanamadı';end if;
 if st>0 and (seconds<5 or now()<b.started_at+interval '5 seconds') then raise exception 'Survival süresi doğrulanamadı';end if;
 select stage into best from ludus_private.survival_records_v83 where owner_id=uid;
 if st>0 then
  insert into ludus_private.survival_records_v83(owner_id,battle_id,stage,completed,ludus_name,gladiator_name,gladiator_class)
   select uid,b.id,st,done,a.ludus_name,b.snapshot->'gladiator'->>'name',b.snapshot->'gladiator'->>'class' from public.ludus_accounts a where a.user_id=uid
   on conflict(owner_id)do update set battle_id=excluded.battle_id,stage=excluded.stage,completed=excluded.completed,
    ludus_name=excluded.ludus_name,gladiator_name=excluded.gladiator_name,gladiator_class=excluded.gladiator_class,achieved_at=now()
   where (excluded.stage,excluded.completed)>(survival_records_v83.stage,survival_records_v83.completed);
  changed:=found;
 end if;
 update public.ludus_items set locked_battle_id=null where owner_id=uid and locked_battle_id=b.id;
 prize:=jsonb_build_object('survival',true,'stage',st,'completed',done,'personal_best',greatest(coalesce(best,0),st),'new_record',changed,'gear_lost',false,'gold',0);
 update public.ludus_battles set finished_at=now(),won=false,reward=prize,stats=p_stats where id=b.id returning reward into prize;
 insert into public.ludus_battle_receipts(battle_id,owner_id,reward,finished_at)values(b.id,uid,prize,now());
 return prize;
end $$;
revoke all on function ludus_private.finish_survival_v83(uuid,jsonb) from public,anon,authenticated;

-- Preserve the deployed V77 equipment checks, food snapshot and deduplicated request IDs.
do $migration$
declare source text;updated text;
begin
 source:=pg_get_functiondef('public.ludus_start_battle_v2(uuid,text,jsonb,uuid)'::regprocedure);
 if position('survival_record' in source)=0 then
  updated:=replace(source,$old$p_mode not in ('4x5','solo20')$old$,$new$p_mode not in ('4x5','solo20','survival')$new$);
  if updated=source then raise exception 'Unexpected battle start definition';end if;
  source:=updated;
  updated:=replace(source,' insert into public.ludus_battles(owner_id,gladiator_id,mode,snapshot,rule_version,start_request_id,loot)',
   E' if p_mode=''survival'' then snap:=snap||jsonb_build_object(''survival_record'',public.ludus_survival_record_v83());end if;\n insert into public.ludus_battles(owner_id,gladiator_id,mode,snapshot,rule_version,start_request_id,loot)');
  if updated=source then raise exception 'Unexpected battle snapshot definition';end if;
  execute updated;
 end if;
 source:=pg_get_functiondef('public.ludus_finish_battle_v2(uuid,boolean,jsonb)'::regprocedure);
 if position('finish_survival_v83' in source)=0 then
  updated:=replace(source,' if b.finished_at is not null then return coalesce(b.reward,''{}'');end if;',
   E' if b.mode=''survival'' then return ludus_private.finish_survival_v83(p_battle,p_stats);end if;\n if b.finished_at is not null then return coalesce(b.reward,''{}'');end if;');
  if updated=source then raise exception 'Unexpected battle finish definition';end if;
  execute updated;
 end if;
 -- Survival has its own record, not a Solo 20 win or a daily battle category.
 if to_regprocedure('ludus_private.daily_battle_event()') is not null then
  source:=pg_get_functiondef('ludus_private.daily_battle_event()'::regprocedure);
  if position('survival' in source)=0 then
   updated:=regexp_replace(source,'begin',E'begin\n if new.mode=''survival'' then return new;end if;','i');
   if updated=source then raise exception 'Unexpected daily battle definition';end if;
   execute updated;
  end if;
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
