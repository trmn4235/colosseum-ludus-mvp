-- V286: acquired manuscripts are learned explicitly by their owner. Unique
-- manuscripts grant their own passive and remain outside the 500-manuscript collection.
create table ludus_staff_private.unique_effects_v286 (
 papyrus_id text references ludus_staff_private.unique_catalog_v285(id),
 effect_key text not null, label text not null, target text not null,
 percent numeric(10,5) not null check (percent > 0 and percent <= 100),
 primary key (papyrus_id,effect_key)
);
alter table ludus_staff_private.unique_effects_v286 enable row level security;
revoke all on ludus_staff_private.unique_effects_v286 from public,anon,authenticated;

-- Retain all previously issued receipts and their original request namespace.
alter table ludus_staff_private.read_receipts_v284
 add column unique_id text references ludus_staff_private.unique_catalog_v285(id),
 alter column lesson drop not null,
 add constraint one_manuscript_v286 check (num_nonnulls(lesson,unique_id)=1);

insert into ludus_staff_private.effects_v284(role_id,lesson,effect_key,label,target,percent)
select role_id,lesson,'caravan_defense_attack','Kervan savunması saldırı bonusu','caravan_defense',
 case rarity when 'common' then 0.01 when 'rare' then 0.03 when 'very_rare' then 0.10 end
from ludus_staff_private.lessons_v284 where role_id='guard';
insert into ludus_staff_private.unique_effects_v286(papyrus_id,effect_key,label,target,percent)
select id,'caravan_defense_attack','Kervan savunması saldırı bonusu','caravan_defense',0.30
from ludus_staff_private.unique_catalog_v285 where role_id='guard';

create view ludus_staff_private.learned_effects_v286 with (security_invoker=true) as
 select p.owner_id,p.role_id,e.effect_key,e.label,e.target,e.percent
 from ludus_staff_private.papyri_v284 p join ludus_staff_private.effects_v284 e using(role_id,lesson)
 where p.read_at is not null
 union all
 select p.owner_id,c.role_id,e.effect_key,e.label,e.target,e.percent
 from ludus_staff_private.unique_papyri_v285 p
 join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id
 join ludus_staff_private.unique_effects_v286 e using(papyrus_id)
 where p.read_at is not null;
revoke all on ludus_staff_private.learned_effects_v286 from public,anon,authenticated;

create or replace function ludus_staff_private.bonuses_v284(p_owner uuid,p_role text default null)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.key),'[]'::jsonb)
 from (select effect_key as key,label,target,sum(percent) as percent
       from ludus_staff_private.learned_effects_v286
       where owner_id=p_owner and (p_role is null or role_id=p_role)
       group by effect_key,label,target)t
$$;

create or replace function ludus_staff_private.state_v284(p_role text default 'trainer',p_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); staff jsonb; papers jsonb; total integer; page integer;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Giriş gerekiyor.' using errcode='42501';
 end if;
 if not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Ludus bulunamadı.'; end if;
 if not exists(select 1 from ludus_staff_private.roles_v284 where id=p_role) or p_page is null or p_page not between 0 and 83 then
  raise exception 'Çalışan veya sayfa geçersiz.';
 end if;

 with standard as (
  select role_id,count(*) as collected,count(read_at) as learned from ludus_staff_private.papyri_v284
  where owner_id=u group by role_id
 ), special as (
  select c.role_id,count(*) as collected,count(p.read_at) as learned from ludus_staff_private.unique_papyri_v285 p
  join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id where p.owner_id=u group by c.role_id
 )
 select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'title',r.title,'total',r.total_papyri,
   'collected',coalesce(s.collected,0),'read',coalesce(s.learned,0),'overall',coalesce(s.learned,0)*0.2,
   'unique_collected',coalesce(x.collected,0),'unique_read',coalesce(x.learned,0),
   'bonuses',ludus_staff_private.bonuses_v284(u,r.id)) order by r.sort_order),
   coalesce(max(coalesce(s.collected,0)+coalesce(x.collected,0)) filter(where r.id=p_role),0)
 into staff,total from ludus_staff_private.roles_v284 r
 left join standard s on s.role_id=r.id left join special x on x.role_id=r.id;

 page:=least(p_page,greatest(0,(total-1)/6));
 with inventory as (
  select p.lesson,null::text as unique_id,l.title,l.rarity,p.read_at,null::text as finder,null::timestamptz as found_at,
   coalesce((select jsonb_agg(jsonb_build_object('key',e.effect_key,'label',e.label,'target',e.target,'percent',e.percent) order by e.effect_key)
    from ludus_staff_private.effects_v284 e where e.role_id=p.role_id and e.lesson=p.lesson),'[]'::jsonb) as effects
  from ludus_staff_private.papyri_v284 p join ludus_staff_private.lessons_v284 l using(role_id,lesson)
  where p.owner_id=u and p.role_id=p_role
  union all
  select null,c.id,c.title,'unique',p.read_at,d.finder_ludus,d.found_at,
   coalesce((select jsonb_agg(jsonb_build_object('key',e.effect_key,'label',e.label,'target',e.target,'percent',e.percent) order by e.effect_key)
    from ludus_staff_private.unique_effects_v286 e where e.papyrus_id=c.id),'[]'::jsonb)
  from ludus_staff_private.unique_papyri_v285 p join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id
  join ludus_staff_private.unique_discoveries_v285 d using(papyrus_id)
  where p.owner_id=u and c.role_id=p_role
 ), visible as (
  select * from inventory order by (read_at is not null),(rarity='unique') desc,lesson limit 6 offset page*6
 )
 select coalesce(jsonb_agg(to_jsonb(v) order by (read_at is not null),(rarity='unique') desc,lesson),'[]'::jsonb) into papers from visible v;
 return jsonb_build_object('user_id',u,'staff',staff,'role',p_role,'page',page,'paper_count',total,'papyri',papers,'overall_per_read',0.2,'daily_portions',6);
end;
$$;

create function ludus_staff_private.read_v286(p_role text,p_lesson integer,p_unique_id text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); receipt ludus_staff_private.read_receipts_v284;
 learned_at timestamptz; configured boolean; replayed boolean;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Giriş gerekiyor.' using errcode='42501';
 end if;
 if p_request is null or p_role is null or num_nonnulls(p_lesson,p_unique_id)<>1 or (p_lesson is not null and p_lesson not between 1 and 500) then
  raise exception 'Papirüs ve işlem bilgisi gerekiyor.';
 end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.'; end if;
 select * into receipt from ludus_staff_private.read_receipts_v284 where owner_id=u and request_id=p_request;
 replayed:=found;
 if replayed then
  if receipt.role_id<>p_role or receipt.lesson is distinct from p_lesson or receipt.unique_id is distinct from p_unique_id then
   raise exception 'İşlem kimliği farklı bir papirüs için kullanılmış.';
  end if;
 else
  if p_unique_id is null then
   select p.read_at,exists(select 1 from ludus_staff_private.effects_v284 e where e.role_id=p.role_id and e.lesson=p.lesson)
   into learned_at,configured from ludus_staff_private.papyri_v284 p
   where p.owner_id=u and p.role_id=p_role and p.lesson=p_lesson for update of p;
  else
   select p.read_at,exists(select 1 from ludus_staff_private.unique_effects_v286 e where e.papyrus_id=p.papyrus_id)
   into learned_at,configured from ludus_staff_private.unique_papyri_v285 p
   join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id
   where p.owner_id=u and c.role_id=p_role and p.papyrus_id=p_unique_id for update of p;
  end if;
  if not found then raise exception 'Bu papirüs çantanda yok.'; end if;
  if learned_at is not null then raise exception 'Bu papirüs zaten okundu.'; end if;
  if not configured then raise exception 'Bu papirüs henüz okumaya açık değil.'; end if;
  if p_unique_id is null then
   update ludus_staff_private.papyri_v284 set read_at=clock_timestamp() where owner_id=u and role_id=p_role and lesson=p_lesson;
  else
   update ludus_staff_private.unique_papyri_v285 set read_at=clock_timestamp() where owner_id=u and papyrus_id=p_unique_id;
  end if;
  insert into ludus_staff_private.read_receipts_v284(owner_id,request_id,role_id,lesson,unique_id) values(u,p_request,p_role,p_lesson,p_unique_id);
 end if;
 return ludus_staff_private.state_v284(p_role,0)||jsonb_build_object('reading',
        jsonb_build_object('replayed',replayed,'lesson',p_lesson,'unique_id',p_unique_id));
end;
$$;
create or replace function ludus_staff_private.read_v284(p_role text,p_lesson integer,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_staff_private.read_v286(p_role,p_lesson,null,p_request)
$$;
create function public.ludus_special_staff_read_unique(p_role text,p_unique_id text,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select ludus_staff_private.read_v286(p_role,null,p_unique_id,p_request)
$$;
revoke all on function ludus_staff_private.read_v286(text,integer,text,uuid),public.ludus_special_staff_read_unique(text,text,uuid) from public,anon,authenticated;
grant execute on function ludus_staff_private.read_v286(text,integer,text,uuid),public.ludus_special_staff_read_unique(text,text,uuid) to authenticated;

-- The caravan owner's learned percentage is frozen at departure. It follows
-- the encounter when a clan member defends, through replay and automatic resolution.
create function ludus_staff_private.defense_snapshot_v286() returns trigger
language plpgsql set search_path='' as $$
declare attack_percent numeric;
begin
 select coalesce(sum(percent),0) into attack_percent from ludus_staff_private.learned_effects_v286
 where owner_id=new.owner_id and role_id='guard' and effect_key='caravan_defense_attack';
 new.encounter:=new.encounter||jsonb_build_object('staff_attack_percent',attack_percent);
 return new;
end;
$$;
revoke all on function ludus_staff_private.defense_snapshot_v286() from public,anon,authenticated;
create trigger defense_staff_snapshot_v286 before insert on ludus_worker_private.defenses_v230
 for each row execute function ludus_staff_private.defense_snapshot_v286();

create or replace function ludus_worker_private.settle_defenses_v230(p_owner uuid,p_until timestamptz)
returns void language plpgsql set search_path='' as $$
declare d ludus_worker_private.defenses_v230; power numeric;
begin
 for d in select * from ludus_worker_private.defenses_v230
   where owner_id=p_owner and status<>'resolved' and deadline<=p_until order by deadline,id loop
  select coalesce(sum(case when (w->>'armed')::boolean then (w->>'base_damage')::integer*least(6,(w->>'arrows')::integer) else 0 end),0)
   into power from jsonb_array_elements(d.workers)w;
  power:=(power+80*(select jsonb_array_length(escort_team) from ludus_supply_private.jobs where id=d.id))
         *(1+coalesce((d.encounter->>'staff_attack_percent')::numeric,0)/100);
  perform ludus_worker_private.resolve_defense_v230(p_owner,d.id,d.status='ready' and power>=120*(d.encounter->>'guards')::integer,true);
 end loop;
end;
$$;
