-- V288: snapshot learned combat bonuses at entry; no retrofit of open fights.
-- Existing V286 guard percentage, automatic settlement and match verification stay intact.
begin;
update ludus_staff_private.papyrus_catalog_v288
set runtime_status='active',
    runtime_reason='4×5 ve Solo20 arena maçlarında; Ranked desteği hazırlanıyor.',
    runtime_note='4×5 ve Solo20 arena maçlarında; Ranked desteği hazırlanıyor.'
where content_id in ('doctore_001','doctore_002','doctore_003','doctore_005','doctore_006','doctore_007','doctore_008','doctore_009','doctore_010','doctore_011','doctore_012','doctore_013','doctore_014','doctore_015','doctore_016','doctore_017','doctore_018','doctore_020','doctore_021','doctore_022','doctore_023','doctore_024','doctore_025');
update ludus_staff_private.papyrus_catalog_v288
set runtime_status='active',runtime_reason='Oyuncunun katıldığı kervan savunmasında etkindir.',runtime_note='Oyuncunun katıldığı kervan savunmasında etkindir. Otomatik savunmada eski genel bonus hesabı korunur.'
where content_id in ('guard_001','guard_002','guard_003','guard_004','guard_005','guard_006','guard_007','guard_008','guard_010','guard_011','guard_012','guard_014','guard_017','guard_018','guard_019','guard_020','guard_023','guard_024');
update ludus_staff_private.papyrus_catalog_v288 set runtime_status='pending_feature',runtime_reason='Balta normal arena ekipmanında henüz kullanılamıyor.' where content_id in ('doctore_004','doctore_019');
update ludus_staff_private.papyrus_catalog_v288 set runtime_status='pending_feature',runtime_reason=case
 when content_id='guard_009' then 'Mevcut kervan savunmasında koşu kondisyon tüketmiyor.'
 when content_id='guard_013' then 'Mevcut kervan savunmasında düşman okçusu bulunmuyor.'
 when content_id in ('guard_015','guard_016') then 'Yük arabası henüz hasar alan bir savaş hedefi değil.'
 when content_id in ('guard_021','guard_022') then 'Mevcut kervan savunmasında dalga sistemi bulunmuyor.'
 when content_id='guard_025' then 'Bu kervan savunması motorunda kalkan kırma özel hareketi henüz bulunmuyor.' end
where content_id in ('guard_009','guard_013','guard_015','guard_016','guard_021','guard_022','guard_025');

update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active',runtime_reason='4×5 ve Solo20 arena maçlarında; diğer mod desteği hazırlanıyor.',runtime_note='4×5 ve Solo20 arena maçlarında; diğer mod desteği hazırlanıyor.'
where content_id in ('chef_001','chef_003','chef_004','chef_005','chef_006','chef_007','chef_008','chef_009','chef_010','chef_011','chef_012','chef_014','chef_015','chef_017','chef_018','chef_019','chef_020','chef_021','chef_023','chef_025');

create function ludus_staff_private.arena_combat_snapshot_v288() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.mode in ('4x5','solo20') then
  new.snapshot:=new.snapshot||jsonb_build_object('staff_combat_v288',jsonb_build_object(
   'version',288,'effects',ludus_staff_private.catalog_effects_v288(new.owner_id,null)));
 end if;
 return new;
end $$;
create trigger staff_arena_snapshot_v288 before insert on public.ludus_battles
for each row execute function ludus_staff_private.arena_combat_snapshot_v288();

create function ludus_staff_private.defense_combat_snapshot_v288() returns trigger
language plpgsql set search_path='' as $$
begin
 new.encounter:=new.encounter||jsonb_build_object('staff_combat_v288',jsonb_build_object(
  'version',288,'effects',ludus_staff_private.catalog_effects_v288(new.owner_id,'guard')));
 return new;
end $$;
-- Alphabetically after the V286 trigger; retain its staff_attack_percent unchanged.
create trigger defense_staff_snapshot_v288 before insert on ludus_worker_private.defenses_v230
for each row execute function ludus_staff_private.defense_combat_snapshot_v288();
revoke all on function ludus_staff_private.arena_combat_snapshot_v288(),ludus_staff_private.defense_combat_snapshot_v288() from public,anon,authenticated;
commit;
