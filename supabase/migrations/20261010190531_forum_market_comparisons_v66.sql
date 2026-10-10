-- Compare against all live listings, even when the browser shows the latest 500.
create index market_sales_model_v66 on ludus_private.market_listings_v66(kind,model,enhancement,sold_at desc)where status='sold';
create or replace function ludus_private.market_state_v66()returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();listings jsonb;mine jsonb;assets jsonb;fighters jsonb;last_sales jsonb;comparisons jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 perform ludus_private.market_expire_v66();
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'asset_type',r.asset_type,'asset',r.snapshot,
  'price',r.price,'created_at',r.created_at,'expires_at',r.expires_at,'own',r.seller_id=u,
  'seller',a.ludus_name,'status',r.status)order by r.created_at desc),'[]')into listings
 from(select * from ludus_private.market_listings_v66 where status='active'and expires_at>clock_timestamp()order by created_at desc limit 500)r
 join public.ludus_accounts a on a.user_id=r.seller_id;
 select coalesce(jsonb_agg(to_jsonb(r)-array['seller_id','buyer_id']order by r.created_at desc),'[]')into mine
 from(select * from ludus_private.market_listings_v66 where seller_id=u order by created_at desc limit 30)r;
 select coalesce(jsonb_agg(to_jsonb(i)-array['owner_id','legacy_v10','legacy_sapphire_percentages']order by i.created_at desc),'[]')into assets
 from public.ludus_items i where owner_id=u and equipped_by is null and locked_battle_id is null and clan_roster_id is null and clan_vault_id is null and market_listing_id is null;
 select coalesce(jsonb_agg(to_jsonb(g)-array['owner_id','legacy_base_stats']order by g.created_at),'[]')into fighters
 from public.ludus_gladiators g where owner_id=u and status='available'and clan_roster_id is null and market_listing_id is null
  and coalesce(training_ends_at,'-infinity')<=clock_timestamp()and coalesce(injured_until,'-infinity')<=clock_timestamp()
  and not exists(select 1 from public.ludus_items where equipped_by=g.id)
  and not exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)
  and not exists(select 1 from public.ludus_imperial_members where gladiator_id=g.id and active)
  and not exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters r on r.id=e.roster_id where e.gladiator_id=g.id and r.state in('draft','locked'))
  and not exists(select 1 from public.ludus_matches m where m.status in('waiting','playing')and m.updated_at>clock_timestamp()-interval '30 seconds'and m.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
  and not exists(select 1 from public.ludus_duels where status in('waiting','playing')and updated_at>clock_timestamp()-interval '75 seconds'and g.id in(host_g,guest_g));
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'model',model,'enhancement',enhancement,'price',price,'sold_at',sold_at)order by sold_at desc),'[]')into last_sales
 from(select * from ludus_private.market_listings_v66 where status='sold'order by sold_at desc limit 100)r;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]')into comparisons from(
  select keys.kind,keys.model,keys.enhancement,
   (select count(*)from ludus_private.market_listings_v66 l where l.status='active'and l.expires_at>clock_timestamp()and(l.kind,l.model,l.enhancement)=(keys.kind,keys.model,keys.enhancement))as count,
   (select min(l.price)from ludus_private.market_listings_v66 l where l.status='active'and l.expires_at>clock_timestamp()and(l.kind,l.model,l.enhancement)=(keys.kind,keys.model,keys.enhancement))as low,
   (select round(avg(l.price))from ludus_private.market_listings_v66 l where l.status='active'and l.expires_at>clock_timestamp()and(l.kind,l.model,l.enhancement)=(keys.kind,keys.model,keys.enhancement))as average,
   (select l.price from ludus_private.market_listings_v66 l where l.status='sold'and(l.kind,l.model,l.enhancement)=(keys.kind,keys.model,keys.enhancement)order by l.sold_at desc limit 1)as last
  from(select distinct kind,model,enhancement from ludus_private.market_listings_v66 where status='sold'or(status='active'and expires_at>clock_timestamp()))keys
 )c;
 return jsonb_build_object('gold',(select gold from public.ludus_accounts where user_id=u),'server_now',clock_timestamp(),
  'listings',listings,'mine',mine,'items',assets,'gladiators',fighters,'sales',last_sales,'comparisons',comparisons,'commission_percent',5);
end;$$;

-- Keep the original privileged training implementation out of the public API.
alter function public.ludus_training_state_pre_market_v66()set schema ludus_private;
create or replace function public.ludus_training_state()returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform ludus_private.market_expire_v66();
 return ludus_private.ludus_training_state_pre_market_v66();
end;$$;
notify pgrst,'reload schema';
