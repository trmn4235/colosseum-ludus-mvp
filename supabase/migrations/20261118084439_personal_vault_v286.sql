-- The personal chest is a view of existing ownership, never a second inventory.
-- Reading changes read_at atomically; the same row then belongs to the archive.
create function ludus_staff_private.papers_v286(p_owner uuid)
returns table(role text,lesson integer,unique_id text,title text,rarity text,
 read_at timestamptz,finder text,found_at timestamptz,effects jsonb)
language sql stable security definer set search_path='' as $$
 select p.role_id,p.lesson::integer,null::text,l.title,l.rarity,p.read_at,null::text,null::timestamptz,
  coalesce((select jsonb_agg(jsonb_build_object('key',e.effect_key,'label',e.label,'target',e.target,'percent',e.percent) order by e.effect_key)
   from ludus_staff_private.effects_v284 e where e.role_id=p.role_id and e.lesson=p.lesson),'[]'::jsonb)
 from ludus_staff_private.papyri_v284 p join ludus_staff_private.lessons_v284 l using(role_id,lesson)
 where p.owner_id=p_owner
 union all
 select c.role_id,null::integer,c.id,c.title,'unique',p.read_at,d.finder_ludus,d.found_at,
  coalesce((select jsonb_agg(jsonb_build_object('key',e.effect_key,'label',e.label,'target',e.target,'percent',e.percent) order by e.effect_key)
   from ludus_staff_private.unique_effects_v286 e where e.papyrus_id=c.id),'[]'::jsonb)
 from ludus_staff_private.unique_papyri_v285 p join ludus_staff_private.unique_catalog_v285 c on c.id=p.papyrus_id
 join ludus_staff_private.unique_discoveries_v285 d using(papyrus_id) where p.owner_id=p_owner;
$$;
revoke all on function ludus_staff_private.papers_v286(uuid) from public,anon,authenticated;

create function ludus_staff_private.archive_v286(p_role text,p_page integer,p_unique boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); total integer; page integer; papers jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Giriş gerekiyor.' using errcode='42501'; end if;
 if not exists(select 1 from public.ludus_accounts where user_id=u) then raise exception 'Ludus bulunamadı.'; end if;
 if not exists(select 1 from ludus_staff_private.roles_v284 where id=p_role) or p_page is null or p_page not between 0 and 83 or p_unique is null then raise exception 'Çalışan veya sayfa geçersiz.'; end if;
 select count(*) into total from ludus_staff_private.papers_v286(u) p
 where p.role=p_role and p.read_at is not null and (p.unique_id is not null)=p_unique;
 page:=least(p_page,greatest(0,(total-1)/6));
 select coalesce(jsonb_agg(to_jsonb(v) order by v.lesson,v.unique_id),'[]'::jsonb) into papers from (
  select * from ludus_staff_private.papers_v286(u) p
  where p.role=p_role and p.read_at is not null and (p.unique_id is not null)=p_unique
  order by p.lesson,p.unique_id limit 6 offset page*6
 ) v;
 return jsonb_build_object('user_id',u,'role',p_role,'page',page,'unique',p_unique,'paper_count',total,'papyri',papers);
end;
$$;
revoke all on function ludus_staff_private.archive_v286(text,integer,boolean) from public,anon,authenticated;

create function public.ludus_special_staff_archive(p_role text,p_page integer default 0,p_unique boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
 select ludus_staff_private.archive_v286(p_role,p_page,p_unique);
$$;
revoke all on function public.ludus_special_staff_archive(text,integer,boolean) from public,anon;
grant execute on function public.ludus_special_staff_archive(text,integer,boolean) to authenticated;

create function ludus_staff_private.vault_rows_v286(p_owner uuid)
returns table(category text,key text,sort_order integer,entry jsonb)
language sql stable security definer set search_path='' as $$
 select 'money','denarius',0,jsonb_build_object('type','money','name','Denarius','quantity',a.gold)
 from public.ludus_accounts a where a.user_id=p_owner
 union all
 select 'stone','diamond',1,jsonb_build_object('type','stone','family','diamond','stone_id',1,'quantity',a.diamonds)
 from public.ludus_accounts a where a.user_id=p_owner and a.diamonds>0
 union all
 select 'stone',s.family||':'||s.stone_id,2,jsonb_build_object('type','stone','family',s.family,'stone_id',s.stone_id,'quantity',s.quantity)
 from public.ludus_stones s where s.owner_id=p_owner and s.quantity>0
 union all
 select 'papyrus',p.role||':'||coalesce(p.unique_id,p.lesson::text),3,
  to_jsonb(p)||jsonb_build_object('type','papyrus','name',p.title,'quantity',1,'role_name',r.name,'role_title',r.title)
 from ludus_staff_private.papers_v286(p_owner) p join ludus_staff_private.roles_v284 r on r.id=p.role where p.read_at is null
 union all
 select 'resource',s.sku,4,jsonb_build_object('type','resource','sku',s.sku,'name',r.name,'stage',r.stage,'quantity',s.quantity,'retired',not r.active)
 from ludus_supply_private.stock s join ludus_supply_private.resources r using(sku) where s.owner_id=p_owner and s.quantity>0
 union all
 select 'food',s.sku,5,jsonb_build_object('type','food','sku',s.sku,'name',c.name,'quantity',s.quantity,'retired',c.retired)
 from public.ludus_food_stock s join public.ludus_food_catalog c using(sku) where s.owner_id=p_owner and s.quantity>0
 union all
 select 'equipment',i.id::text,6,jsonb_build_object('type','equipment','id',i.id,'kind',i.kind,'model',i.model,
  'enhancement',i.enhancement,'base_stats',i.base_stats,'natural_stats',i.natural_stats,'natural_percentages',i.natural_percentages,
  'sapphires',i.sapphires,'emeralds',i.emeralds,'rubies',i.rubies,'quantity',1,'equipped_by',i.equipped_by,'equipped_name',g.name,
  'equipped_slot',i.equipped_slot,'in_battle',i.locked_battle_id is not null,'on_market',i.market_listing_id is not null,
  'in_clan_roster',i.clan_roster_id is not null)
 from public.ludus_items i left join public.ludus_gladiators g on g.id=i.equipped_by and g.owner_id=p_owner
 where i.owner_id=p_owner and i.clan_vault_id is null;
$$;
revoke all on function ludus_staff_private.vault_rows_v286(uuid) from public,anon,authenticated;

create function ludus_staff_private.vault_v286(p_category text,p_page integer,p_role text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); total integer; page integer; rows jsonb; counts jsonb; balance bigint;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Giriş gerekiyor.' using errcode='42501'; end if;
 select gold into balance from public.ludus_accounts where user_id=u;
 if not found then raise exception 'Ludus bulunamadı.'; end if;
 if p_category is null or p_category not in ('all','money','stone','papyrus','resource','equipment','food') or p_page is null or p_page not between 0 and 10000
  or (p_role is not null and not exists(select 1 from ludus_staff_private.roles_v284 where id=p_role)) then raise exception 'Kasa bölümü veya sayfa geçersiz.'; end if;
 select coalesce(jsonb_object_agg(c.category,c.n),'{}'::jsonb) into counts from (
  select v.category,count(*) n from ludus_staff_private.vault_rows_v286(u) v group by v.category
 ) c;
 select count(*) into total from ludus_staff_private.vault_rows_v286(u) v
 where (p_category='all' or v.category=p_category) and (p_role is null or v.category<>'papyrus' or v.entry->>'role'=p_role);
 page:=least(p_page,greatest(0,(total-1)/8));
 select coalesce(jsonb_agg(v.entry||jsonb_build_object('key',v.category||':'||v.key)||case when v.category='papyrus' then jsonb_build_object('bonuses',ludus_staff_private.bonuses_v284(u,v.entry->>'role')) else '{}'::jsonb end order by v.sort_order,v.key),'[]'::jsonb) into rows from (
  select * from ludus_staff_private.vault_rows_v286(u) v
  where (p_category='all' or v.category=p_category) and (p_role is null or v.category<>'papyrus' or v.entry->>'role'=p_role)
  order by v.sort_order,v.key limit 8 offset page*8
 ) v;
 return jsonb_build_object('user_id',u,'gold',balance,'category',p_category,'role',p_role,'page',page,'total',total,'counts',counts,'rows',rows);
end;
$$;
revoke all on function ludus_staff_private.vault_v286(text,integer,text) from public,anon,authenticated;

create function public.ludus_personal_vault(p_category text default 'all',p_page integer default 0,p_role text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select ludus_staff_private.vault_v286(p_category,p_page,p_role);
$$;
revoke all on function public.ludus_personal_vault(text,integer,text) from public,anon;
grant execute on function public.ludus_personal_vault(text,integer,text) to authenticated;
