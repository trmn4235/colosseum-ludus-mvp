-- Existing production settlement captured before V285. Used unchanged to verify
-- that new BEFORE triggers reach the returned reward and immutable receipt.
CREATE OR REPLACE FUNCTION public.ludus_finish_battle_v2(p_battle uuid, p_won boolean, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();b public.ludus_battles;kv record;entry jsonb;it jsonb;tokens text[]:='{}';exits jsonb;keep uuid[]:='{}';iid uuid;newids jsonb:='[]';kind text;model text;prize jsonb:='{}';alive boolean;typed_stone jsonb;
begin
 if uid is null then raise exception 'Giriş gerekli';end if;
 perform 1 from public.ludus_accounts where user_id=uid for update;
 select reward into prize from public.ludus_battle_receipts where battle_id=p_battle and owner_id=uid;
 if found then return prize;end if;
 prize:='{}';
 select * into b from public.ludus_battles where id=p_battle and owner_id=uid for update;
 if not found or b.rule_version<>2 then raise exception 'Savaş kaydı bulunamadı veya eski sürüm';end if;
 if b.mode='pit' then return ludus_pit_private.finish(p_battle,p_won,p_stats);end if;
 if b.mode='survival' then return ludus_private.finish_survival_v83(p_battle,p_stats);end if;
 if b.finished_at is not null then return coalesce(b.reward,'{}');end if;
 if coalesce(p_won,false) and now()<b.started_at+interval '10 seconds' then raise exception 'Savaş süresi doğrulanamadı';end if;
 if now()>b.started_at+interval '2 hours' then p_won:=false;end if;
 alive:=coalesce((p_stats->>'alive')::boolean,false);
 exits:=case when p_won and alive then coalesce(p_stats->'exit_slots','{}') else '{}'::jsonb end;
 if jsonb_typeof(exits)<>'object' then raise exception 'Çıkış ekipmanı geçersiz';end if;
 for kv in select * from jsonb_each_text(exits) loop
  if kv.key not in ('main_hand','off_hand','helmet','chest','gloves','legs') then raise exception 'Geçersiz çıkış yuvası';end if;
  if kv.value is null then continue;end if;
  if kv.value=any(tokens) then raise exception 'Aynı eşya iki kez alınamaz';end if;
  select value into entry from jsonb_array_elements(b.loot) where value->>'token'=kv.value;
  if not found then raise exception 'Bu eşya savaşta yok';end if;
  it:=entry->'item';
  if not ((kv.key='main_hand' and it->>'kind'='weapon' and it->>'model' in ('gladius','sica','spear','trident','mace','whip','heavy_mace','warhammer','halberd','trident_gladiator')) or (kv.key='off_hand' and it->>'kind' in ('weapon','shield')) or (kv.key=it->>'kind' and kv.key in ('helmet','chest','gloves','legs'))) then raise exception 'Çıkış ekipmanı yuvaya uymuyor';end if;
  tokens:=array_append(tokens,kv.value);
  if entry->>'inventory_id' is not null then keep:=array_append(keep,(entry->>'inventory_id')::uuid);end if;
 end loop;
 -- The carried-in set is replaced atomically by the living winner's carried-out set.
 delete from public.ludus_items where owner_id=uid and locked_battle_id=b.id and not(id=any(keep));
 update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=uid and locked_battle_id=b.id;
 for kv in select * from jsonb_each_text(exits) loop
  if kv.value is null then continue;end if;
  select value into entry from jsonb_array_elements(b.loot) where value->>'token'=kv.value;it:=entry->'item';
  if entry->>'inventory_id' is not null then
   iid:=(entry->>'inventory_id')::uuid;
   update public.ludus_items set locked_battle_id=null,equipped_by=b.gladiator_id,equipped_slot=kv.key where id=iid and owner_id=uid and locked_battle_id=b.id;
   if not found then raise exception 'Eşya kilidi doğrulanamadı';end if;
  else
   insert into public.ludus_items(owner_id,kind,model,enhancement,base_stats,sapphires,rubies,equipped_by,equipped_slot,stat_version,natural_rule_version,natural_stats,natural_percentages,emeralds,certus_used) values(uid,it->>'kind',it->>'model',(it->>'enhancement')::integer,it->'base_stats',it->'sapphires',it->'rubies',b.gladiator_id,kv.key,coalesce((it->>'stat_version')::integer,0),coalesce((it->>'natural_rule_version')::integer,0),coalesce(it->'natural_stats','{}'),coalesce(it->'natural_percentages','{}'),coalesce(it->'emeralds','[]'),coalesce((it->>'certus_used')::boolean,false)) returning id into iid;
  end if;
  newids:=newids||jsonb_build_array(iid);
 end loop;
 if p_won then
  kind:=(array['weapon','shield','helmet','gloves','legs'])[1+floor(random()*5)::integer];model:=case kind when 'weapon' then (array['gladius','sica','spear','trident'])[1+floor(random()*4)::integer] when 'shield' then 'round' when 'helmet' then 'gold' else 'starter' end;
  insert into public.ludus_items(owner_id,kind,model) values(uid,kind,model) returning id into iid;
  typed_stone:=ludus_private.win_stone_v10(uid);
  prize:=jsonb_build_object('gold',100,'diamonds',1,'stone',typed_stone,'kind',kind,'item_id',iid);
  update public.ludus_accounts set gold=gold+100,diamonds=diamonds+1,wins=wins+1 where user_id=uid;
  update public.ludus_gladiators set wins_4x5=wins_4x5+case when b.mode='4x5' then 1 else 0 end,wins_solo20=wins_solo20+case when b.mode='solo20' then 1 else 0 end where id=b.gladiator_id;
 else update public.ludus_accounts set losses=losses+1 where user_id=uid;end if;
 prize:=prize||jsonb_build_object('extracted',newids,'gear_lost',not(coalesce(p_won,false) and alive));
 update public.ludus_battles set finished_at=now(),won=coalesce(p_won,false),reward=prize,stats=case when pg_column_size(p_stats)<16384 then p_stats else '{}'::jsonb end where id=b.id returning reward into prize;
 insert into public.ludus_battle_receipts(battle_id,owner_id,reward,finished_at) values(b.id,uid,prize,now());
 delete from public.ludus_battles where owner_id=uid and finished_at is not null and id not in(select id from public.ludus_battles where owner_id=uid and finished_at is not null order by finished_at desc limit 5);
 return prize;
end $function$
