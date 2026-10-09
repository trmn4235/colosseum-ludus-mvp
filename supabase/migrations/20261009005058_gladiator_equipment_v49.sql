-- Set one equipment slot atomically. Inventory values and character stats are never client-writable.
create or replace function public.ludus_equip_item(p_gladiator uuid,p_slot text,p_item uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();g public.ludus_gladiators;i public.ludus_items;inventory jsonb;training jsonb;
begin
 if u is null then raise exception 'Giriş gerekli.';end if;
 if p_slot is null or p_slot not in('main_hand','off_hand','helmet','chest','gloves','legs')or p_item is null then raise exception 'Geçerli bir eşya ve yuva seç.';end if;
 perform 1 from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Ludus bulunamadı.';end if;
 perform ludus_private.imperial_settle(u);perform ludus_private.v7_settle(u);
 select * into g from public.ludus_gladiators where id=p_gladiator and owner_id=u for update;
 if not found then raise exception 'Gladyatör bulunamadı.';end if;
 if g.status<>'available' or g.clan_roster_id is not null or g.training_ends_at>clock_timestamp()or g.injured_until>clock_timestamp()
  or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)
  or exists(select 1 from public.ludus_imperial_members where gladiator_id=g.id and active)
  or exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters r on r.id=e.roster_id where e.gladiator_id=g.id and r.state in('draft','locked'))
  or exists(select 1 from public.ludus_matches m where m.status in('waiting','playing')and m.updated_at>clock_timestamp()-interval '30 seconds'and m.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))
  or exists(select 1 from public.ludus_duels where status in('waiting','playing')and updated_at>clock_timestamp()-interval '75 seconds'and g.id in(host_g,guest_g))
 then raise exception 'Gladyatör meşgul; ekipmanı değiştirilemez.';end if;
 select * into i from public.ludus_items where id=p_item and owner_id=u for update;
 if not found or i.locked_battle_id is not null or i.clan_vault_id is not null or i.clan_roster_id is not null or(i.equipped_by is not null and i.equipped_by<>g.id)then raise exception 'Eşya kullanılamıyor veya sana ait değil.';end if;
 if not((p_slot='main_hand'and i.kind='weapon'and i.model in('gladius','sica','spear','trident','mace','whip'))or(p_slot='off_hand'and i.kind in('weapon','shield'))or(p_slot=i.kind and p_slot in('helmet','chest','gloves','legs')))then raise exception 'Eşya bu yuvaya uygun değil.';end if;
 if exists(select 1 from public.ludus_items where owner_id=u and equipped_by=g.id and(locked_battle_id is not null or clan_vault_id is not null or clan_roster_id is not null))then raise exception 'Gladyatörün ekipmanı kilitli.';end if;
 update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=u and((equipped_by=g.id and equipped_slot=p_slot)or id=i.id);
 update public.ludus_items set equipped_by=g.id,equipped_slot=p_slot where id=i.id and owner_id=u;
 training:=public.ludus_training_state();
 select coalesce(jsonb_agg(to_jsonb(item)order by item.created_at,item.id),'[]'::jsonb)into inventory from public.ludus_items item where owner_id=u;
 return jsonb_build_object('training',training,'items',inventory);
end;$$;
revoke all on function public.ludus_equip_item(uuid,text,uuid)from public,anon;
grant execute on function public.ludus_equip_item(uuid,text,uuid)to authenticated;
notify pgrst,'reload schema';
