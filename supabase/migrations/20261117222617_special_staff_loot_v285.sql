-- V285: match-settlement loot. The cancelled passive catalogue stays empty.
-- Standard manuscripts can be collected now; reading remains gated by effects.
alter table ludus_staff_private.lessons_v284 add column rarity text not null default 'common'
 check(rarity in('common','rare','very_rare'));
insert into ludus_staff_private.lessons_v284(role_id,lesson,title,rarity)
select r.id,n,r.title||' papirüsü '||lpad(n::text,3,'0'),
 case when n<=400 then 'common' when n<=490 then 'rare' else 'very_rare' end
from ludus_staff_private.roles_v284 r cross join generate_series(1,500)n;

create table ludus_staff_private.unique_catalog_v285 (
 id text primary key,role_id text not null unique references ludus_staff_private.roles_v284(id),title text not null
);
insert into ludus_staff_private.unique_catalog_v285 values
 ('trainer-first','trainer','Arena Ustasının Son Öğüdü'),('cook-first','cook','Usta Aşçının Saklı Defteri'),
 ('doctor-first','doctor','Şifacının Son Nüshası'),('smith-first','smith','Örsün Saklı Sırrı'),
 ('guard-first','guard','Muhafızın Son Vasiyeti'),('groom-first','groom','Seyisin Saklı Öğretisi');
-- No FK to accounts: deleting an account must NEVER make a unique drop again.
create table ludus_staff_private.unique_discoveries_v285 (
 papyrus_id text primary key references ludus_staff_private.unique_catalog_v285(id),
 first_owner_id uuid not null,finder_ludus text not null,found_at timestamptz not null default clock_timestamp(),source_key text not null
);
create table ludus_staff_private.unique_papyri_v285 (
 papyrus_id text primary key references ludus_staff_private.unique_discoveries_v285(papyrus_id),
 owner_id uuid not null references public.ludus_accounts(user_id)on delete cascade,read_at timestamptz
);
create table ludus_staff_private.loot_receipts_v285 (
 source_key text not null,owner_id uuid not null references public.ludus_accounts(user_id)on delete cascade,
 papyri jsonb not null default '[]' check(jsonb_typeof(papyri)='array'),created_at timestamptz not null default clock_timestamp(),
 primary key(source_key,owner_id)
);
alter table ludus_staff_private.unique_catalog_v285 enable row level security;
alter table ludus_staff_private.unique_discoveries_v285 enable row level security;
alter table ludus_staff_private.unique_papyri_v285 enable row level security;
alter table ludus_staff_private.loot_receipts_v285 enable row level security;
revoke all on all tables in schema ludus_staff_private from public,anon,authenticated;

create function ludus_staff_private.rarity_v285(p_roll integer)returns text
language sql immutable set search_path='' as $$
 select case when p_roll<0 or p_roll>=1000000 then null when p_roll<1 then 'unique'
 when p_roll<1001 then 'very_rare' when p_roll<41001 then 'rare' when p_roll<161001 then 'common' end
$$;
create function ludus_staff_private.roll_v285()returns integer language sql volatile set search_path='' as $$
 select floor(random()*1000000)::integer
$$;
-- Internal only; callers are settlement triggers, never a client RPC.
create function ludus_staff_private.award_v285(p_owner uuid,p_source text)returns jsonb
language plpgsql security definer set search_path='' as $$
declare selected_rarity text;paper record;discovery record;answer jsonb:='[]';finder text;
begin
 if p_owner is null or p_source is null then raise exception 'Ganimet kaydı eksik.';end if;
 perform 1 from public.ludus_accounts where user_id=p_owner for update;
 if not found then return answer;end if;
 if exists(select 1 from ludus_bot_private.members_v233 where user_id=p_owner)then return answer;end if;
 insert into ludus_staff_private.loot_receipts_v285(source_key,owner_id)values(p_source,p_owner)on conflict do nothing;
 if not found then return(select papyri from ludus_staff_private.loot_receipts_v285 where source_key=p_source and owner_id=p_owner);end if;
 selected_rarity:=ludus_staff_private.rarity_v285(ludus_staff_private.roll_v285());
 if selected_rarity='unique' then
  select c.* into paper from ludus_staff_private.unique_catalog_v285 c
  where not exists(select 1 from ludus_staff_private.unique_discoveries_v285 d where d.papyrus_id=c.id)
  order by random()limit 1 for update of c skip locked;
  if found then
   select coalesce(nullif(ludus_name,''),username,'Ludus')into finder from public.ludus_accounts where user_id=p_owner;
   insert into ludus_staff_private.unique_discoveries_v285(papyrus_id,first_owner_id,finder_ludus,source_key)
   values(paper.id,p_owner,finder,p_source)on conflict do nothing returning * into discovery;
   if found then
    insert into ludus_staff_private.unique_papyri_v285(papyrus_id,owner_id)values(paper.id,p_owner);
    answer:=jsonb_build_array(jsonb_build_object('unique_id',paper.id,'role',paper.role_id,'title',paper.title,'rarity','unique',
     'role_title',(select title from ludus_staff_private.roles_v284 where id=paper.role_id),'quantity',1,'finder',discovery.finder_ludus,'found_at',discovery.found_at));
   end if;
  end if;
 elsif selected_rarity is not null then
  select l.* into paper from ludus_staff_private.lessons_v284 l where l.rarity=selected_rarity
  and not exists(select 1 from ludus_staff_private.papyri_v284 p where p.owner_id=p_owner and p.role_id=l.role_id and p.lesson=l.lesson)
  order by random()limit 1;
  if found then
   insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson)values(p_owner,paper.role_id,paper.lesson);
   answer:=jsonb_build_array(jsonb_build_object('role',paper.role_id,'lesson',paper.lesson,'title',paper.title,'rarity',selected_rarity,
    'role_title',(select title from ludus_staff_private.roles_v284 where id=paper.role_id),'quantity',1));
  end if;
 end if;
 update ludus_staff_private.loot_receipts_v285 set papyri=answer where source_key=p_source and owner_id=p_owner;
 return answer;
end;$$;

create function ludus_staff_private.battle_loot_v285()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.finished_at is null and new.finished_at is not null and new.won
 and new.mode in('solo20','4x5','pit')and new.finished_at>=new.started_at+interval '10 seconds'
 and new.finished_at<=new.started_at+interval '2 hours' then
  new.reward:=coalesce(new.reward,'{}')||jsonb_build_object('papyri',ludus_staff_private.award_v285(new.owner_id,'battle:'||new.id::text));
 end if;
 return new;
end;$$;
create trigger staff_battle_loot_v285 before update of finished_at on public.ludus_battles
for each row execute function ludus_staff_private.battle_loot_v285();

-- Capture eligibility in the match transaction; each winner claims under only their
-- own account lock. This avoids taking teammates' account locks from a match lock.
alter table public.ludus_matches add column papyri_eligible_v285 uuid[] not null default '{}';
create function ludus_staff_private.match_loot_v285()returns trigger
language plpgsql security definer set search_path='' as $$
declare p jsonb;team text;
begin
 if old.status<>'playing' or new.status<>'finished' or new.winner is null or new.starts_at is null
 or clock_timestamp()<new.starts_at+interval '10 seconds' or clock_timestamp()>new.starts_at+interval '2 hours'
 or new.venue not in('ranked','colosseum','pit')then return new;end if;
 if not exists(select 1 from jsonb_array_elements(new.players)f where f->>'owner'=new.winner::text
 and coalesce((f->>'hp')::numeric,0)>0 and not coalesce((f->>'left')::boolean,false))then return new;end if;
 select f->>'ranked_team' into team from jsonb_array_elements(new.players)f where f->>'owner'=new.winner::text;
 if new.venue='ranked' and(team is null or jsonb_array_length(new.players)<>10
 or(select count(distinct f->>'owner')from jsonb_array_elements(new.players)f)<>10
 or(select count(*)from jsonb_array_elements(new.players)f where f->>'ranked_team'='a')<>5
 or(select count(*)from jsonb_array_elements(new.players)f where f->>'ranked_team'='b')<>5)then return new;end if;
 -- A forfeit alone is not an eligible reward; at least one opponent was defeated.
 if not exists(select 1 from jsonb_array_elements(new.players)f where coalesce((f->>'hp')::numeric,0)<=0
 and not coalesce((f->>'left')::boolean,false)and case when new.venue='ranked' then f->>'ranked_team'<>team else f->>'owner'<>new.winner::text end)then return new;end if;
 for p in select f from jsonb_array_elements(new.players)f where not coalesce((f->>'left')::boolean,false)
 and case when new.venue='ranked' then f->>'ranked_team'=team else f->>'owner'=new.winner::text end
 order by f->>'owner' loop
  new.papyri_eligible_v285:=array_append(new.papyri_eligible_v285,(p->>'owner')::uuid);
 end loop;
 return new;
end;$$;
create trigger staff_match_loot_v285 before update of status on public.ludus_matches
for each row execute function ludus_staff_private.match_loot_v285();

create function ludus_staff_private.match_papyri_v285(p_match uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();answer jsonb;eligible uuid[];
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
 if not exists(select 1 from public.ludus_matches m where m.id=p_match and m.status='finished'
 and exists(select 1 from jsonb_array_elements(m.players)p where p->>'owner'=u::text))then raise exception 'Tamamlanan maça erişemezsin.' using errcode='42501';end if;
 select papyri_eligible_v285 into eligible from public.ludus_matches where id=p_match;
 if u=any(eligible)then answer:=ludus_staff_private.award_v285(u,'match:'||p_match::text);end if;
 return jsonb_build_object('papyri',coalesce(answer,'[]'::jsonb));
end;$$;
create function public.ludus_match_papyri_v285(p_match uuid)returns jsonb
language sql security invoker set search_path='' as $$select ludus_staff_private.match_papyri_v285(p_match)$$;

create or replace function ludus_staff_private.state_v284(p_role text default 'trainer',p_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();staff jsonb;papers jsonb;total integer;page integer;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Giriş gerekiyor.' using errcode='42501';end if;
 if not exists(select 1 from public.ludus_accounts where user_id=u)then raise exception 'Ludus bulunamadı.';end if;
 if not exists(select 1 from ludus_staff_private.roles_v284 where id=p_role)or p_page is null or p_page<0 or p_page>83 then raise exception 'Çalışan veya sayfa geçersiz.';end if;
 select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'title',r.title,'total',r.total_papyri,
 'collected',(select count(*)from ludus_staff_private.papyri_v284 p where p.owner_id=u and p.role_id=r.id),
 'read',(select count(*)from ludus_staff_private.papyri_v284 p where p.owner_id=u and p.role_id=r.id and p.read_at is not null),
 'overall',(select count(*)*0.2 from ludus_staff_private.papyri_v284 p where p.owner_id=u and p.role_id=r.id and p.read_at is not null),
 'unique_collected',(select count(*)from ludus_staff_private.unique_papyri_v285 p join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id where p.owner_id=u and c.role_id=r.id),
 'bonuses',ludus_staff_private.bonuses_v284(u,r.id))order by r.sort_order)into staff from ludus_staff_private.roles_v284 r;
 select count(*)into total from(
 select 1 from ludus_staff_private.papyri_v284 where owner_id=u and role_id=p_role
 union all select 1 from ludus_staff_private.unique_papyri_v285 p join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id where p.owner_id=u and c.role_id=p_role)t;
 page:=least(p_page,greatest(0,(total-1)/6));
 with all_papers as(
 select p.lesson,null::text unique_id,l.title,l.rarity,p.read_at,null::text finder,null::timestamptz found_at,
 coalesce((select jsonb_agg(jsonb_build_object('key',e.effect_key,'label',e.label,'target',e.target,'percent',e.percent)order by e.effect_key)
 from ludus_staff_private.effects_v284 e where e.role_id=p.role_id and e.lesson=p.lesson),'[]'::jsonb)effects
 from ludus_staff_private.papyri_v284 p join ludus_staff_private.lessons_v284 l using(role_id,lesson)where p.owner_id=u and p.role_id=p_role
 union all select null::smallint,c.id,c.title,'unique',p.read_at,d.finder_ludus,d.found_at,'[]'::jsonb
 from ludus_staff_private.unique_papyri_v285 p join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id
 join ludus_staff_private.unique_discoveries_v285 d using(papyrus_id)where p.owner_id=u and c.role_id=p_role
 ),visible as(select * from all_papers order by (rarity='unique')desc,read_at nulls first,lesson limit 6 offset page*6)
 select coalesce(jsonb_agg(to_jsonb(v)order by (rarity='unique')desc,read_at nulls first,lesson),'[]'::jsonb)into papers from visible v;
 return jsonb_build_object('user_id',u,'staff',staff,'role',p_role,'page',page,'paper_count',total,'papyri',papers,'overall_per_read',0.2,'daily_portions',6);
end;$$;
revoke all on function ludus_staff_private.rarity_v285(integer),ludus_staff_private.roll_v285(),ludus_staff_private.award_v285(uuid,text),
 ludus_staff_private.battle_loot_v285(),ludus_staff_private.match_loot_v285(),ludus_staff_private.match_papyri_v285(uuid),public.ludus_match_papyri_v285(uuid)from public,anon,authenticated;
grant execute on function ludus_staff_private.match_papyri_v285(uuid),public.ludus_match_papyri_v285(uuid)to authenticated;
