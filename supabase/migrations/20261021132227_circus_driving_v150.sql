alter table ludus_circus_private.heats add column if not exists drive jsonb;
create or replace function ludus_circus_private.drive_metrics(d jsonb,seconds numeric,duration numeric)returns jsonb language plpgsql immutable set search_path='' as $$
declare stamina numeric:=coalesce((d->>'initial')::numeric,100);previous numeric:=0;bonus numeric:=0;finish numeric:=duration;boosting boolean:=false;last_boost numeric:=-100;e jsonb;at_time numeric;
begin
 seconds:=greatest(0,seconds);
 for e in select value from jsonb_array_elements(coalesce(d->'boosts','[]'))loop
  at_time:=(e->>'at')::numeric;if at_time>seconds then exit;end if;
  stamina:=least(100,stamina+greatest(0,at_time-previous)*2.5)-25;previous:=at_time+4;
  bonus:=bonus+.5*greatest(0,least(4,seconds-at_time));boosting:=boosting or(seconds>=at_time and seconds<at_time+4);last_boost:=at_time;
  if finish>at_time then finish:=finish-least(2,(finish-at_time)/3);end if;
 end loop;
 stamina:=greatest(0,least(100,stamina+greatest(0,seconds-previous)*2.5));
 return jsonb_build_object('stamina',stamina,'bonus',bonus,'finish',finish,'boosting',boosting,'cooldown',greatest(0,last_boost+5-seconds),'canBoost',stamina>=25 and not boosting and seconds>=last_boost+5,'progress',greatest(0,least(1,(seconds+bonus)/duration)));
end $$;
revoke all on function ludus_circus_private.drive_metrics(jsonb,numeric,numeric)from public,anon,authenticated;
create or replace function ludus_circus_private.api(p_action text,p_args jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t timestamptz:=clock_timestamp();a public.ludus_accounts;h ludus_circus_private.heats;receipt ludus_circus_private.receipts;
 v_teams jsonb;cards jsonb:='[]';owned jsonb;horse ludus_stable_private.horses;hid uuid;ids uuid[];v_selected integer;v_stake integer;idx integer;rank integer;score numeric;v_durations jsonb;v_winner integer;replayed boolean:=false;v_history jsonb;v_history_count int;v_history_page int;v_elapsed numeric;v_at numeric;v_position numeric;v_metrics jsonb;v_initial numeric;v_finish numeric;v_order jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','bet','enter','cancel_entry','start','next','boost')then raise exception 'Geçersiz hipodrom işlemi.';end if;
 p_args:=coalesce(p_args,'{}');
 select * into a from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Önce ludus hesabını oluştur.';end if;
 perform ludus_stable_private.settle(u,t);
 select * into h from ludus_circus_private.heats where owner_id=u order by created_at desc,id desc limit 1 for update;
 if not found then insert into ludus_circus_private.heats(owner_id,teams)values(u,ludus_circus_private.roster())returning * into h;end if;
 if h.drive->>'version'='150' and h.status='running' then
  v_elapsed:=greatest(0,extract(epoch from(t-h.started_at))-3);
  v_metrics:=ludus_circus_private.drive_metrics(h.drive,v_elapsed,(h.durations->>'3')::numeric);
  select jsonb_agg(jsonb_build_object('team',key::int,'time',case when key='3' then (v_metrics->>'finish')::numeric else value::numeric end)order by case when key='3' then (v_metrics->>'finish')::numeric else value::numeric end,key::int)into v_order from jsonb_each_text(h.durations);
  if t>=h.finish_at then h.winner:=(v_order->0->>'team')::int;end if;
 end if;
 if h.status='running' and t>=h.finish_at then
  h.payout:=case when h.selected=h.winner then floor(h.stake*h.odds)::bigint else 0 end;
  update public.ludus_accounts set gold=gold+h.payout where user_id=u;
  update ludus_circus_private.heats set status='settled',winner=h.winner,payout=h.payout,paid_at=t where id=h.id returning * into h;
 end if;
 if p_action<>'state' then
  if p_request is null then raise exception 'İşlem kimliği gerekiyor.';end if;
  select * into receipt from ludus_circus_private.receipts where owner_id=u and request_id=p_request;
  if found then
   if receipt.action<>p_action or receipt.args<>p_args then raise exception 'İşlem kimliği başka bir işlemde kullanılmış.';end if;
   replayed:=true;
  else
   if coalesce(p_args->>'heat','')<>h.id::text then raise exception 'Yarış değişti. Gişeyi yenile.';end if;
   if p_action='next' then
    if h.status<>'settled' then raise exception 'Mevcut yarış bitmeden yeni yarış açılamaz.';end if;
    insert into ludus_circus_private.heats(owner_id,teams)values(u,ludus_circus_private.roster())returning * into h;
   elsif p_action='bet' then
    if h.status<>'open' or h.entered or h.selected is not null then raise exception 'Bu yarış için kupon yapılamaz.';end if;
    v_selected:=(p_args->>'team')::int;v_stake:=(p_args->>'stake')::int;
    if v_selected is null or v_selected not between 0 and 3 or v_stake is null or v_stake not between 10 and 10000 or v_stake%10<>0 then raise exception 'Takım seç ve 10–10.000 arasında, 10 katı denarius gir.';end if;
    update public.ludus_accounts set gold=gold-v_stake where user_id=u and gold>=v_stake;
    if not found then raise exception 'Denarius yetersiz.';end if;
    update ludus_circus_private.heats set selected=v_selected,stake=v_stake,odds=(h.teams->v_selected->>'odds')::numeric where id=h.id returning * into h;
   elsif p_action='enter' then
    if h.status<>'open' or h.selected is not null then raise exception 'Kuponlu veya başlamış yarışa katılamazsın.';end if;
    ids:=array[(p_args->>'horse1')::uuid,(p_args->>'horse2')::uuid];
    if ids[1] is null or ids[2] is null or ids[1]=ids[2] then raise exception 'İki farklı at seç.';end if;
    foreach hid in array ids loop
     select * into horse from ludus_stable_private.horses where id=hid and owner_id=u;
     if not found or not ludus_circus_private.eligible(horse,t)then raise exception 'Atların yetişkin, tok, dinlenmiş ve boşta olmalı.';end if;
     cards:=cards||jsonb_build_array(ludus_stable_private.card(horse,t));
    end loop;
    select round(avg((value->>'quality')::numeric),1)into score from jsonb_array_elements(cards);
    v_teams:=jsonb_set(h.teams,'{3}',jsonb_build_object('id',3,'name',a.ludus_name,'horses',cards,'quality',score));
    update ludus_circus_private.heats set entered=true,horse_ids=ids,teams=ludus_circus_private.prices(v_teams)where id=h.id returning * into h;
   elsif p_action='cancel_entry' then
    if h.status<>'open' then raise exception 'Yarış başladı.';end if;
    update ludus_circus_private.heats set entered=false,horse_ids=null,teams=ludus_circus_private.roster()where id=h.id returning * into h;
   elsif p_action='boost' then
    if h.status<>'running' or not h.entered or h.selected is not null or h.drive->>'version' is distinct from '150' then raise exception 'Hızlanma yalnızca kendi yarışında kullanılabilir.';end if;
    v_elapsed:=extract(epoch from(t-h.started_at))-3;v_at:=(p_args->>'at')::numeric;
    if v_at is null or v_at::text in('NaN','Infinity','-Infinity') or v_at<0 or v_at>v_elapsed+.05 or v_at<v_elapsed-.65 then raise exception 'Hamle zamanı geçersiz veya bağlantı gecikti.';end if;
    v_metrics:=ludus_circus_private.drive_metrics(h.drive,v_at,(h.durations->>'3')::numeric);
    if (v_metrics->>'progress')::numeric>=1 then raise exception 'Takımın yarışı tamamladı.';end if;
    if v_at-coalesce((h.drive->>'last_attempt')::numeric,-100)<.8 then raise exception 'Yeni hamle için kısa bir süre bekle.';end if;
    if not(v_metrics->>'canBoost')::boolean then raise exception 'Hızlanmak için kondisyonun dolmasını bekle.';end if;
    v_position:=1-abs(1-mod(v_at/.85,2));
    h.drive:=h.drive||jsonb_build_object('last_attempt',v_at,'last_hit',v_position between .70 and .88);
    if v_position between .70 and .88 then
     h.drive:=jsonb_set(h.drive,'{boosts}',(h.drive->'boosts')||jsonb_build_array(jsonb_build_object('at',v_at)));
    end if;
    v_metrics:=ludus_circus_private.drive_metrics(h.drive,v_elapsed,(h.durations->>'3')::numeric);
    select greatest((v_metrics->>'finish')::numeric,max(value::numeric)filter(where key<>'3'))into v_finish from jsonb_each_text(h.durations);
    update ludus_circus_private.heats set drive=h.drive,finish_at=h.started_at+make_interval(secs=>(3+v_finish)::double precision)where id=h.id returning * into h;
   elsif p_action='start' then
    if h.status<>'open' then raise exception 'Bu yarış zaten başladı.';end if;
    if h.entered then foreach hid in array h.horse_ids loop
     select * into horse from ludus_stable_private.horses where id=hid and owner_id=u;
     if not found or not ludus_circus_private.eligible(horse,t)then raise exception 'Katılım atlarını tekrar kontrol et.';end if;
    end loop;end if;
    -- Server draws the order only after all bets close. Better teams are more likely, never guaranteed, to win.
    select jsonb_object_agg(id::text,duration),min(id)filter(where place=1) into v_durations,v_winner from(
     select (team->>'id')::int id,row_number()over(order by ticket)place,120+(row_number()over(order by ticket)-1)*3+random() duration
     from(select value team,-ln(greatest(random(),.000001))/power(greatest(1,(value->>'quality')::numeric),4)ticket from jsonb_array_elements(h.teams))q
    )r;
    if h.entered and p_args->>'driving'='150' then
     select least(100,greatest(0,min(energy)))into v_initial from ludus_stable_private.horses where owner_id=u and id=any(h.horse_ids);
     h.drive:=jsonb_build_object('version',150,'initial',v_initial,'boosts','[]'::jsonb,'last_attempt',-100);
    end if;
    update ludus_circus_private.heats set status='running',drive=h.drive,started_at=t,finish_at=t+make_interval(secs=>3+(select max(value::double precision)from jsonb_each_text(v_durations))),durations=v_durations,winner=v_winner where id=h.id returning * into h;
   end if;
   insert into ludus_circus_private.receipts(owner_id,request_id,action,args)values(u,p_request,p_action,p_args);
  end if;
 end if;
 select coalesce(jsonb_agg(ludus_stable_private.card(x,t)||jsonb_build_object('eligible',ludus_circus_private.eligible(x,t),'ineligible_reasons',to_jsonb(array_remove(array[case when ludus_stable_private.stage(x.born_at,t)<>'adult' then 'Yetişkin değil' end,case when x.pregnant_until is not null then 'Gebe' end,case when x.training_until is not null then 'Antrenmanda' end,case when x.sale_price is not null then 'Satışta' end,case when x.energy<35 then 'Enerji 35 altında' end,case when x.fed_until<=t then 'Aç' end,case when x.duel_ready>t then 'Düello dinlenmesinde' end]::text[],null)))order by x.created_at),'[]')into owned from ludus_stable_private.horses x where x.owner_id=u;
 select count(*) into v_history_count from ludus_circus_private.heats where owner_id=u and selected is not null;
 v_history_page:=least(greatest(0,coalesce((p_args->>'history_page')::int,0)),greatest(0,(v_history_count-1)/3));
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'created_at',q.created_at,'team_name',q.teams->q.selected->>'name','stake',q.stake,'odds',q.odds,'status',q.status,'payout',q.payout,'won',case when q.status='settled' then q.selected=q.winner else null end)order by q.created_at desc,q.id desc),'[]')into v_history
 from(select * from ludus_circus_private.heats where owner_id=u and selected is not null order by created_at desc,id desc limit 3 offset v_history_page*3)q;
 return jsonb_build_object('user_id',u,'server_now',t,'gold',(select gold from public.ludus_accounts where user_id=u),'horses',owned,'replayed',replayed,'history',jsonb_build_object('items',v_history,'total',v_history_count,'page',v_history_page,'pages',greatest(1,(v_history_count+2)/3)),'heat',
 jsonb_build_object('id',h.id,'teams',h.teams,'status',h.status,'entered',h.entered,'horse_ids',h.horse_ids,'selected',h.selected,'stake',h.stake,'odds',h.odds,'payout',h.payout,'paid_at',h.paid_at,'started_at',h.started_at,'finish_at',h.finish_at,'drive',h.drive,'durations',case when h.status='open' then null else h.durations end,'winner',case when h.status='settled' then h.winner else null end));
end $$;

-- Existing API privileges are retained by CREATE OR REPLACE; helpers are private.
