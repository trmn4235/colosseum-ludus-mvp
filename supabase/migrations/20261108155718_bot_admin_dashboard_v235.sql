-- Read-only bot details. The existing owner-only check also protects this view.
create function ludus_bot_private.dashboard_v235() returns jsonb
language plpgsql security definer set search_path='' as $$
declare base jsonb; bots jsonb; week_end timestamptz;
begin
 base:=ludus_bot_private.admin_v233('state','{}'::jsonb);
 week_end:=ludus_worker_private.week_end_v232(clock_timestamp());
 select coalesce(jsonb_agg(e.value||jsonb_build_object(
  'experience',coalesce(p.experience,0),
  'worker_count',(select count(*) from public.ludus_workers_v226 w where w.owner_id=b.user_id),
  'weekly_quantity',(select coalesce(sum(cp.quantity),0) from ludus_worker_private.clan_work_people_v232 cp
    join ludus_worker_private.clan_work_jobs_v232 cj on cj.id=cp.job_id
    where cp.owner_id=b.user_id and cj.clan_id=b.clan_id and cp.completed_at>=week_end-interval '7 days' and cp.completed_at<week_end),
  'battle_mode',battle.mode,'battle_started_at',battle.started_at,
  'gladiators',(select coalesce(jsonb_agg(jsonb_build_object(
    'name',g.name,'class',g.class,'overall',g.overall,'fame',coalesce(f.points,0),
    'weapon',(select jsonb_build_object('model',i.model,'plus',i.enhancement,'emeralds',i.emeralds)
      from public.ludus_items i where i.owner_id=b.user_id and i.equipped_by=g.id and i.equipped_slot='main_hand'
      order by i.id limit 1)) order by g.overall desc,g.id),'[]'::jsonb)
   from public.ludus_gladiators g left join ludus_pit_private.fame f on f.gladiator_id=g.id where g.owner_id=b.user_id),
  'stones',(select coalesce(jsonb_object_agg(x.family,x.amount),'{}'::jsonb) from
    (select st.family,sum(st.quantity)::bigint amount from public.ludus_stones st
     where st.owner_id=b.user_id and st.quantity>0 group by st.family)x)
 ) order by b.slot),'[]'::jsonb) into bots
 from jsonb_array_elements(base->'bots') e
 join ludus_bot_private.members_v233 b on b.slot=(e.value->>'slot')::integer
 left join public.ludus_progression p on p.owner_id=b.user_id
 left join public.ludus_battles battle on battle.id=b.battle_id and battle.owner_id=b.user_id;
 return base||jsonb_build_object('bots',bots,'server_now',clock_timestamp());
end;$$;
create function public.ludus_bot_dashboard_v235() returns jsonb
language sql security invoker set search_path='' as $$select ludus_bot_private.dashboard_v235()$$;
revoke all on function ludus_bot_private.dashboard_v235() from public,anon,authenticated;
grant execute on function ludus_bot_private.dashboard_v235() to authenticated;
revoke all on function public.ludus_bot_dashboard_v235() from public,anon;
grant execute on function public.ludus_bot_dashboard_v235() to authenticated;
