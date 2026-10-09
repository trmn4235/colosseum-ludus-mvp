-- Selected training never awards other attributes, including at the cap or after mixed activities.
begin;
create or replace function ludus_private.exercise_complete_v46(p_source text,p_id uuid,p_gladiator uuid,p_units integer,p_stat text,p_at timestamptz)returns void language plpgsql set search_path='' as $$
declare e ludus_private.exercise_events_v46;g public.ludus_gladiators;d ludus_private.exercise_days_v46;v_day date:=(p_at at time zone'Europe/Istanbul')::date;k text;w jsonb;stats jsonb;take integer;new_injury boolean;
begin
 select * into e from ludus_private.exercise_events_v46 where source=p_source and source_id=p_id and gladiator_id=p_gladiator for update;
 if not found or e.finished_at is not null then return;end if;
 select * into g from public.ludus_gladiators where id=e.gladiator_id for update;
 if g.clan_roster_id is not null then return;end if;
 stats:=g.base_stats;
 if p_units>0 then
  insert into ludus_private.exercise_days_v46(gladiator_id,day,budget)values(g.id,v_day,ludus_private.exercise_budget_v46(g.overall))on conflict do nothing;
  select * into d from ludus_private.exercise_days_v46 where gladiator_id=g.id and exercise_days_v46.day=v_day for update;
  take:=least(p_units,3-d.units);w:=d.weights;
  if take>0 then
   foreach k in array ludus_private.exercise_keys_v46()loop
    w:=w||jsonb_build_object(k,coalesce((w->>k)::numeric,0)+case when p_stat is null then take::numeric/7 when p_stat=k then take else 0 end);
   end loop;
   if d.units+take=3 then
    if p_source='training' and p_stat=any(ludus_private.exercise_keys_v46()) then
     -- Training owns the chosen target, even after earlier battles. Overflow never changes another stat.
     stats:=jsonb_set(stats,array[p_stat],to_jsonb(least(100,(stats->>p_stat)::numeric+d.budget)));
    else
     stats:=ludus_private.exercise_adjust_v46(stats,d.budget,w);
    end if;
   end if;
   update ludus_private.exercise_days_v46 set units=d.units+take,weights=w,awarded_at=case when d.units+take=3 then p_at else null end where gladiator_id=g.id and exercise_days_v46.day=v_day;
  end if;
 end if;
 new_injury:=e.injury_risk>0 and random()<e.injury_risk;
 if new_injury then stats:=ludus_private.exercise_adjust_v46(stats,-least(35,ludus_private.exercise_mean_v46(stats)*7));end if;
 update public.ludus_gladiators set base_stats=stats,overall=ludus_private.exercise_mean_v46(stats),
 fatigue_rest_from=p_at,injured_until=case when new_injury then p_at+interval '12 hours'else injured_until end,
 injury_level=case when new_injury then 1 else injury_level end,status=case when new_injury then 'injured'else status end where id=g.id;
 update ludus_private.exercise_events_v46 set finished_at=p_at,injured=new_injury where source=p_source and source_id=p_id and gladiator_id=g.id;
end;$$;
revoke all on function ludus_private.exercise_complete_v46(text,uuid,uuid,integer,text,timestamptz) from public,anon,authenticated;
commit;
