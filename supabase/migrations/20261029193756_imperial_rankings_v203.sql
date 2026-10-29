-- Independent achievement boards and one real equipped gladiator per player.
-- V200's reader and stored event points remain compatible with cached clients.
begin;
alter table ludus_rank_private.events drop constraint events_category_check;
alter table ludus_rank_private.events add constraint events_category_check
 check(category in('multiplayer','colosseum','naval','circus','caravan','guild'));

create function ludus_rank_private.archive_colosseum_v203(b jsonb) returns void
language plpgsql set search_path='' as $$
declare u uuid;s jsonb:=b->'stats';outcome integer;
begin
 -- The persisted venue is authoritative: pit results can carry solo20 telemetry.
 if b->>'finished_at' is null or b->>'mode' not in('4x5','solo20')
  or coalesce(s->>'game_mode',b->>'mode') not in('4x5','solo20') then return;end if;
 select owner_id into u from public.ludus_gladiators where id=(b->>'gladiator_id')::uuid;
 if u is null then return;end if;
 outcome:=case when b->>'won'='true' then 1 when b->>'won'='false' then -1 else 0 end;
 insert into ludus_rank_private.events(source,event_id,participant_id,owner_id,gladiator_id,category,outcome,kills,deaths,assists,points,played_at)
 values('battle',(b->>'id')::uuid,(b->>'gladiator_id')::uuid,u,(b->>'gladiator_id')::uuid,'colosseum',outcome,
 ludus_rank_private.num(s->'kills'),case when s->>'abandoned'='true' then null when s->>'alive'='true' then 0 when s->>'alive'='false' then 1 end,
 ludus_rank_private.num(s->'assists'),case outcome when 1 then 20 when -1 then -5 else 0 end,(b->>'finished_at')::timestamptz)
 on conflict do nothing;
end $$;
create function ludus_rank_private.capture_colosseum_v203() returns trigger
language plpgsql set search_path='' as $$
begin perform ludus_rank_private.archive_colosseum_v203(to_jsonb(new));return new;end $$;
revoke all on function ludus_rank_private.archive_colosseum_v203(jsonb),ludus_rank_private.capture_colosseum_v203() from public,anon,authenticated;
create trigger rank_colosseum_v203 after insert on ludus_career_private.battles for each row execute function ludus_rank_private.capture_colosseum_v203();
select ludus_rank_private.archive_colosseum_v203(to_jsonb(b)) from ludus_career_private.battles b where mode in('4x5','solo20');

create function ludus_rank_private.board_v203(p_scope text,p_category text,p_group text,p_sort text,p_clan uuid,p_query text,p_page integer,p_page_size integer,p_target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();mine uuid;answer jsonb;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Sıralamalar için hesabına giriş yap.';end if;
 if p_scope is null or p_scope not in('players','clans','fighters') or p_category is null or p_category not in('power','colosseum','naval','circus','caravan','guild')
 or p_group is null or p_group not in('all','gladiator','attack','defense','mobility','raid') or p_sort is null or p_sort not in('score','wins') then raise exception 'Geçersiz sıralama ölçütü.';end if;
 if p_scope<>'players' then p_category:='guild';p_group:='all';end if;
 if p_category='power' then p_sort:='score';end if;
 if p_category in('circus','caravan') then p_sort:='wins';end if;
 if p_category='power' and p_group not in('all','gladiator','attack','defense','mobility') then raise exception 'Geçersiz güç grubu.';end if;
 if p_category='caravan' and p_group not in('all','raid','defense') then raise exception 'Geçersiz kervan grubu.';end if;
 if p_scope='players' and p_category='guild' then raise exception 'Geçersiz sıralama türü.';end if;
 p_page:=greatest(0,least(100000,coalesce(p_page,0)));p_page_size:=greatest(1,least(20,coalesce(p_page_size,8)));p_query:=left(trim(coalesce(p_query,'')),60);
 select clan_id into mine from public.ludus_clan_members where user_id=u;
 with items as materialized(
  select i.equipped_by,i.owner_id,
   case when i.equipped_slot in('main_hand','off_hand') then 'attack' when i.equipped_slot in('helmet','chest') then 'defense' else 'mobility' end equipment_group,
   ludus_rank_private.item_score(to_jsonb(i)) score
  from public.ludus_items i
  where p_scope='players' and i.equipped_by is not null and i.clan_vault_id is null and i.market_listing_id is null
   and i.equipped_slot in('main_hand','off_hand','helmet','chest','gloves','legs')
 ), gear as(
  select g.id,g.owner_id,g.name,g.class,round(g.overall,2) gladiator,
   case when count(*)filter(where i.equipment_group='attack' and i.score is null)=0 then round(coalesce(sum(i.score)filter(where i.equipment_group='attack'),0)/2,2) end attack,
   case when count(*)filter(where i.equipment_group='defense' and i.score is null)=0 then round(coalesce(sum(i.score)filter(where i.equipment_group='defense'),0)/2,2) end defense,
   case when count(*)filter(where i.equipment_group='mobility' and i.score is null)=0 then round(coalesce(sum(i.score)filter(where i.equipment_group='mobility'),0)/2,2) end mobility
  from public.ludus_gladiators g left join items i on i.equipped_by=g.id and i.owner_id=g.owner_id
  where p_scope='players' group by g.id,g.owner_id,g.name,g.class,g.overall
 ), strengths as(
  select *,round((gladiator+attack+defense+mobility)/4,2) power,round((attack+defense+mobility)/3,2) equipment from gear
 ), representatives as(
  select *,count(*)over(partition by owner_id) roster_count,
   row_number()over(partition by owner_id order by
    case when p_category<>'power' or p_group='all' then power when p_group='gladiator' then gladiator when p_group='attack' then attack when p_group='defense' then defense else mobility end desc nulls last,
    power desc nulls last,lower(name),id) choice from strengths
 ), event_rows as(
  select e.*,case when e.category in('colosseum','multiplayer') then 'colosseum'
    else e.category||case when e.category='caravan' then '_'||e.side else '' end end metric from ludus_rank_private.events e where category<>'guild'
  union all select e.*,'caravan' from ludus_rank_private.events e where category='caravan'
 ), grouped as(
  select owner_id,metric,count(distinct (source,event_id)) matches,
   count(distinct (source,event_id))filter(where outcome=1) wins,count(distinct (source,event_id))filter(where outcome=-1) losses,
   case when count(kills)=count(*) then sum(kills) end kills,case when count(deaths)=count(*) then sum(deaths) end deaths,
   case when count(assists)=count(*) then sum(assists) end assists,
   sum(kills)filter(where kills is not null and deaths is not null) kd_kills,sum(deaths)filter(where kills is not null and deaths is not null) kd_deaths,
   sum(kills)filter(where kills is not null and deaths is not null and assists is not null) kda_kills,
   sum(deaths)filter(where kills is not null and deaths is not null and assists is not null) kda_deaths,
   sum(assists)filter(where kills is not null and deaths is not null and assists is not null) kda_assists,
   count(*)filter(where kills is not null and deaths is not null) kd_tracked,
   count(*)filter(where kills is not null and deaths is not null and assists is not null) tracked,count(*) participants
  from event_rows group by owner_id,metric
 ), summaries as(
  select owner_id,jsonb_object_agg(metric,to_jsonb(g)-'owner_id'-'metric'||
   case when metric in('colosseum','naval') then jsonb_build_object('rating',1500+20*wins-5*losses) else '{}'::jsonb end) stats from grouped g group by owner_id
 ), clan_stats as(
  select clan_id,count(distinct event_id) matches,count(distinct event_id)filter(where outcome=1) wins,count(distinct event_id)filter(where outcome=-1) losses
  from ludus_rank_private.events where category='guild' group by clan_id
 ), fighter_stats as(
  select gladiator_id,count(*) matches,count(*)filter(where outcome=1) wins,count(*)filter(where outcome=-1) losses,
   sum(kills) kills,sum(deaths) deaths,sum(assists) assists from ludus_rank_private.events where category='guild' group by gladiator_id
 ), candidates as(
  select a.user_id id,a.user_id owner_id,a.username name,a.ludus_name subtitle,c.id clan_id,c.name clan,c.emblem,c.emblem_color,c.background,
   jsonb_build_object('power',p.power,'gladiator',p.gladiator,'equipment',p.equipment,'attack',p.attack,'defense',p.defense,'mobility',p.mobility,'roster_count',coalesce(p.roster_count,0))||coalesce(s.stats,'{}') stats,
   case when p.id is not null then jsonb_build_object('id',p.id,'name',p.name,'class',p.class) end gladiator,
   null::text class,a.user_id=u mine
  from public.ludus_accounts a left join representatives p on p.owner_id=a.user_id and p.choice=1 left join summaries s on s.owner_id=a.user_id
  left join public.ludus_clan_members cm on cm.user_id=a.user_id left join public.ludus_clans c on c.id=cm.clan_id where p_scope='players'
  union all
  select c.id,null,c.name,'Hanedan',c.id,c.name,c.emblem,c.emblem_color,c.background,
   jsonb_build_object('guild',jsonb_build_object('matches',coalesce(s.matches,0),'wins',coalesce(s.wins,0),'losses',coalesce(s.losses,0),'points',coalesce(r.points,1500))),null::jsonb,null,c.id=mine
  from public.ludus_clans c left join clan_stats s on s.clan_id=c.id left join ludus_rank_private.ratings r on r.scope='clan' and r.entity_id=c.id where p_scope='clans'
  union all
  select g.id,g.owner_id,g.name,a.username,c.id,c.name,c.emblem,c.emblem_color,c.background,
   jsonb_build_object('gladiator',g.overall,'guild',to_jsonb(s)-'gladiator_id'||jsonb_build_object('points',coalesce(r.points,1500))),null::jsonb,g.class,g.owner_id=u
  from fighter_stats s join public.ludus_gladiators g on g.id=s.gladiator_id join public.ludus_accounts a on a.user_id=g.owner_id
  left join public.ludus_clan_members cm on cm.user_id=g.owner_id left join public.ludus_clans c on c.id=cm.clan_id
  left join ludus_rank_private.ratings r on r.scope='fighter' and r.entity_id=g.id where p_scope='fighters'
 ), measured as(
  select *,case when p_category='power' then (stats->>case p_group when 'all' then 'power' else p_group end)::numeric
   when p_sort='wins' then coalesce((stats->(p_category||case when p_category='caravan' and p_group<>'all' then '_'||p_group else '' end)->>'wins')::numeric,0)
   when p_category in('colosseum','naval') then coalesce((stats->p_category->>'rating')::numeric,1500)
   when p_category='guild' then coalesce((stats->'guild'->>'points')::numeric,1500)
   else 0 end score,
   coalesce(stats->(p_category||case when p_category='caravan' and p_group<>'all' then '_'||p_group else '' end),
    jsonb_build_object('matches',0,'wins',0,'losses',0,'kills',0,'deaths',0,'assists',0,'rating',case when p_category in('colosseum','naval') then 1500 end)) metrics
  from candidates where p_clan is null or clan_id=p_clan
 ), ranked as materialized(
  select *,case when score is not null then rank()over(order by score desc nulls last) end rank from measured
 ), filtered as materialized(
  select * from ranked where p_query='' or strpos(lower(name),lower(p_query))>0 or strpos(lower(subtitle),lower(p_query))>0
   or (p_category='power' and strpos(lower(gladiator->>'name'),lower(p_query))>0)
 ), total as(select count(*) n from filtered), paging as(
  select least(p_page,greatest(0,ceil(n::numeric/p_page_size)::int-1)) page from total
 ), visible as(select * from filtered order by score desc nulls last,lower(name),id limit p_page_size offset(select page*p_page_size from paging))
 select jsonb_build_object('version',203,'scope',p_scope,'category',p_category,'group',p_group,'sort',p_sort,'page',(select page from paging),'page_size',p_page_size,'total',(select n from total),
  'rows',coalesce((select jsonb_agg(to_jsonb(v)order by score desc nulls last,lower(name),id)from visible v),'[]'),
  'own',(select to_jsonb(r)from ranked r where r.mine order by score desc nulls last,id limit 1),
  'profile',(select to_jsonb(r)from ranked r where id=p_target),
  'clans',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)order by c.name)from public.ludus_clans c),'[]'),
  'my_clan',mine,'server_now',now(),'guild_matches',(select count(*)from ludus_rank_private.settlements where source='guild'),
  'defense_matches',(select count(*)from ludus_rank_private.settlements where source='defense')) into answer;
 return answer;
end $$;
create function public.ludus_rankings_v203(p_scope text default 'players',p_category text default 'power',p_group text default 'all',p_sort text default 'score',p_clan uuid default null,p_query text default '',p_page integer default 0,p_page_size integer default 8,p_target uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select ludus_rank_private.board_v203(p_scope,p_category,p_group,p_sort,p_clan,p_query,p_page,p_page_size,p_target)$$;
revoke all on function ludus_rank_private.board_v203(text,text,text,text,uuid,text,integer,integer,uuid),public.ludus_rankings_v203(text,text,text,text,uuid,text,integer,integer,uuid) from public,anon,authenticated;
grant execute on function ludus_rank_private.board_v203(text,text,text,text,uuid,text,integer,integer,uuid),public.ludus_rankings_v203(text,text,text,text,uuid,text,integer,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
