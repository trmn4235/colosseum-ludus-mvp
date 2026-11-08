-- Restrict fleet assignment to the 39 registered bot slots (Supabase safeupdate).
create or replace function public.ludus_bot_assign_v233() returns jsonb language plpgsql security definer set search_path='' as $$
declare c ludus_bot_private.settings_v233; owner_clan uuid; clan_ids uuid[]; rival uuid; g integer; v_name text; suffix integer; leader uuid;
begin
 select * into c from ludus_bot_private.settings_v233 where id for update;
 if c.ready then return jsonb_build_object('ready',true,'replayed',true);end if;
 if not c.setup_requested or c.owner_id is null or (select count(*) from ludus_bot_private.members_v233 where user_id is not null)<>39 then raise exception 'Botlar henüz hazır değil.';end if;
 perform 1 from public.ludus_accounts where user_id=c.owner_id or user_id in(select user_id from ludus_bot_private.members_v233) order by user_id for update;
 select m.clan_id into owner_clan from public.ludus_clan_members m join public.ludus_clans k on k.id=m.clan_id where m.user_id=c.owner_id and k.leader_id=c.owner_id;
 if owner_clan is null or (select count(*) from public.ludus_clan_members where clan_id=owner_clan)<>1 then raise exception 'Liderin klanında yalnızca kendi hesabı bulunmalı.';end if;
 if exists(select 1 from public.ludus_clan_members where user_id in(select user_id from ludus_bot_private.members_v233)) then raise exception 'Bir bot başka bir klana katılmış.';end if;
 clan_ids:=array[owner_clan];
 for g in 1..3 loop
  select user_id into leader from ludus_bot_private.members_v233 where slot=10+(g-1)*10;
  v_name:=(array['Legio Aquila','Legio Invicta','Legio Fulmina'])[g];suffix:=2;
  while exists(select 1 from public.ludus_clans k where lower(btrim(k.name))=lower(v_name)) loop
   v_name:=(array['Legio Aquila','Legio Invicta','Legio Fulmina'])[g]||' '||suffix;suffix:=suffix+1;
  end loop;
  insert into public.ludus_clans(name,emblem,background,emblem_color,leader_id)
   values(v_name,(array[13,25,30])[g],(array['#682333','#263D5B','#34543F'])[g],'#E0BF74',leader) returning id into rival;
  clan_ids:=array_append(clan_ids,rival);
 end loop;
 update ludus_bot_private.members_v233 set clan_id=clan_ids[ludus_bot_private.group_v233(slot)+1] where slot between 1 and 39 and user_id is not null;
 insert into public.ludus_clan_members(user_id,clan_id,vault_access)
  select user_id,clan_id,slot in(10,20,30) from ludus_bot_private.members_v233 order by slot;
 update ludus_bot_private.settings_v233 set ready=true,setup_requested=false,last_error=null,updated_at=clock_timestamp() where id;
 return jsonb_build_object('ready',true,'clans',4,'bots',39);
end;$$;
