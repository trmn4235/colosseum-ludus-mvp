-- Owner-only unread counts use the same configured effects as reading.
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
  select p.role_id,count(*) as collected,count(p.read_at) as learned,
   count(*) filter(where p.read_at is null and exists(
    select 1 from ludus_staff_private.effects_v284 e where e.role_id=p.role_id and e.lesson=p.lesson)) as readable
  from ludus_staff_private.papyri_v284 p where p.owner_id=u group by p.role_id
 ), special as (
  select c.role_id,count(*) as collected,count(p.read_at) as learned,
   count(*) filter(where p.read_at is null and exists(
    select 1 from ludus_staff_private.unique_effects_v286 e where e.papyrus_id=p.papyrus_id)) as readable
  from ludus_staff_private.unique_papyri_v285 p
  join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id where p.owner_id=u group by c.role_id
 )
 select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'title',r.title,'total',r.total_papyri,
   'collected',coalesce(s.collected,0),'read',coalesce(s.learned,0),'overall',coalesce(s.learned,0)*0.2,
   'readable',coalesce(s.readable,0)+coalesce(x.readable,0),
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
