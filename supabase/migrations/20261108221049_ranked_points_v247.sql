-- Correct multiplayer results to +10 for wins and -5 for losses.
-- Recalculate only legacy multiplayer wins recorded under the old +20 rule.
create or replace function ludus_rank_private.archive_match(m jsonb) returns void language plpgsql set search_path='' as $$
declare p jsonb;s jsonb;a numeric;won integer;
begin
 if m->>'status'<>'finished' or coalesce(m->>'venue','arena')='pit' or m->>'starts_at' is null
  or (m->>'starts_at')::timestamptz>(m->>'updated_at')::timestamptz or jsonb_array_length(m->'players')<2 then return;end if;
 for p in select value from jsonb_array_elements(m->'players') loop
  s:=p->'career';a:=null;
  if s->>'assist_version'='200' then
   select count(*) into a from jsonb_array_elements(m->'players') victim
    where victim->'career'->>'killer' is not null and victim->'career'->>'killer'<>p->>'owner'
    and victim->>'owner'<>p->>'owner'
    and coalesce(ludus_rank_private.num(victim->'career'->'contributors'->(p->>'owner')),0)>=greatest(1,coalesce(ludus_rank_private.num(victim->'maxHp'),100)*.1);
  end if;
  won:=case when m->>'winner' is null then 0 when m->>'winner'=p->>'owner' then 1 else -1 end;
  insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,gladiator_id,category,outcome,kills,deaths,assists,points,played_at)
  values('online',(m->>'id')::uuid,(p->>'owner')::uuid,(p->>'owner')::uuid,(p->'gladiator'->>'id')::uuid,'multiplayer',won,
   ludus_rank_private.num(s->'kills'),ludus_rank_private.num(s->'deaths'),a,case won when 1 then 10 when -1 then -5 else 0 end,(m->>'updated_at')::timestamptz) on conflict do nothing;
 end loop;
end $$;

update ludus_rank_private.events
 set points=10
 where source='online' and category='multiplayer' and outcome=1 and points=20;

-- V203 also calculates a combined Colosseum board. Read stored event points there
-- so online wins contribute +10, while existing single-player and naval rules stay intact.
do $migration$
declare
 source text:=pg_get_functiondef('ludus_rank_private.board_v203(text,text,text,text,uuid,text,integer,integer,uuid)'::regprocedure);
 old_group text:='count(*)filter(where kills is not null and deaths is not null and assists is not null) tracked,count(*) participants';
 new_group text:='count(*)filter(where kills is not null and deaths is not null and assists is not null) tracked,count(*) participants,coalesce(sum(points),0) scored_points';
 old_rule text:=$old$case when metric in('colosseum','naval') then jsonb_build_object('rating',1500+20*wins-5*losses) else '{}'::jsonb end$old$;
 new_rule text:=$new$case when metric='colosseum' then jsonb_build_object('rating',1500+scored_points) when metric='naval' then jsonb_build_object('rating',1500+20*wins-5*losses) else '{}'::jsonb end$new$;
begin
 if position(new_group in source)=0 then
  if position(old_group in source)=0 then raise exception 'Unexpected V203 ranking aggregation';end if;
  source:=replace(source,old_group,new_group);
 end if;
 if position(new_rule in source)=0 then
  if position(old_rule in source)=0 then raise exception 'Unexpected V203 ranking formula';end if;
  source:=replace(source,old_rule,new_rule);
 end if;
 execute source;
end $migration$;
notify pgrst,'reload schema';
