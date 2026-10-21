create or replace function ludus_circus_private.physics_initial()returns jsonb language sql immutable set search_path='' as $$select '{"tick":0,"distance":0,"lane":10.2,"heading":0,"speed":0,"wall":0,"crashes":0,"impact":0,"finish":null}'::jsonb$$;
create or replace function ludus_circus_private.bot_drive(i int)returns jsonb language plpgsql immutable set search_path='' as $$
declare d jsonb:='{"initial":100,"boosts":[]}';at_time float8;k int;m jsonb;
begin for k in 0..59 loop at_time:=7+i*1.7+k*9.5;m:=ludus_circus_private.drive_metrics(d,at_time::numeric,600);if mod(k+i,5)<>0 and(m->>'canBoost')::boolean then d:=jsonb_set(d,'{boosts}',(d->'boosts')||jsonb_build_array(jsonb_build_object('at',at_time)));end if;end loop;return d;end $$;
create or replace function ludus_circus_private.physics_bounds(distance float8)returns float8[] language plpgsql immutable set search_path='' as $$
declare s float8:=distance-floor(distance/(792+70*pi()))*(792+70*pi());angle float8;c float8;sn float8;off float8;meta float8;edge float8;outer_r float8;max_r float8;min_r float8;disc float8;
begin
 if s<396 or(s>=396+35*pi() and s<792+35*pi())then return array[-28.4,11.1]::float8[];end if;
 if s<396+35*pi()then angle:=(s-396)/35;off:=34;meta:=17;edge:=16.5;else angle:=(s-792-35*pi())/35;off:=46;meta:=5;edge:=8.5;end if;
 c:=abs(cos(angle));sn:=sin(angle);outer_r:=case when c>1e-8 then 46.1/c else 1e9 end;max_r:=outer_r;
 if outer_r*sn>off then max_r:=off*sn+sqrt(greatest(0,46.1^2-off^2*c*c));end if;
 disc:=7.6^2-meta^2*c*c;min_r:=greatest(least(case when c>1e-8 then 6.6/c else 1e9 end,case when sn>1e-8 then edge/sn else 1e9 end),case when disc>=0 then meta*sn+sqrt(disc)else 0 end);
 return array[min_r-35,max_r-35];
end $$;
create or replace function ludus_circus_private.physics_step(state jsonb,input float8,duration float8,drive jsonb,plans jsonb)returns jsonb language plpgsql immutable set search_path='' as $$
declare dt float8:=.05;total float8:=(792+70*pi())*5;tick int:=(state->>'tick')::int;t float8:=tick*.05;dist float8:=(state->>'distance')::float8;lane float8:=(state->>'lane')::float8;heading float8:=(state->>'heading')::float8;speed float8:=(state->>'speed')::float8;wall float8:=(state->>'wall')::float8;crashes int:=(state->>'crashes')::int;impact float8:=greatest(0,(state->>'impact')::float8-.05);finish float8:=(state->>'finish')::float8;section float8;curve boolean;scale float8;metrics jsonb;target float8;nextlane float8;nextdist float8;limits float8[];i int;b jsonb;blane float8;bdist float8;
begin
 if finish is not null then return state||jsonb_build_object('tick',tick+1,'impact',impact);end if;
 section:=dist+100-floor((dist+100)/(792+70*pi()))*(792+70*pi());curve:=(section>=396 and section<396+35*pi())or section>=792+35*pi();scale:=case when curve then greatest(.2,1+lane/35)else 1 end;
 heading:=greatest(-1.2,least(1.2,heading+(greatest(-1,least(1,input))*.85+case when curve then speed/(35*scale)else 0 end)*dt));
 metrics:=ludus_circus_private.drive_metrics(drive,t::numeric,duration::numeric);target:=total/duration*case when(metrics->>'boosting')::boolean then 1.5 else 1 end;speed:=speed+greatest(-8*dt,least(3.4*dt,target-speed));
 nextlane:=lane+sin(heading)*speed*dt;nextdist:=dist+greatest(0,cos(heading))*speed*dt/scale;limits:=ludus_circus_private.physics_bounds(100+nextdist);
 if nextlane<limits[1] or nextlane>limits[2]then
  if wall=0 then crashes:=crashes+1;speed:=speed*.58;impact:=.7;end if;wall:=wall+dt;speed:=greatest(0,speed-(5+wall*7)*dt);if wall>=2.5 then speed:=0;end if;nextlane:=greatest(limits[1],least(limits[2],nextlane));
 else wall:=0;end if;
 for i in 0..2 loop
  b:=ludus_circus_private.drive_metrics(drive->'bots'->i,t::numeric,(plans->>(i::text))::numeric);bdist:=total*(b->>'progress')::float8;blane:=(array[-12,-3,5])[i+1]+sin(t*.13+i)*1.5;
  if abs(bdist-nextdist)<5.1 and abs(blane-nextlane)<2.8 then
   if impact=0 then crashes:=crashes+1;impact:=.6;speed:=speed*.48;end if;
   nextdist:=least(nextdist,greatest(dist,bdist-5.1));nextlane:=greatest(limits[1],least(limits[2],nextlane+case when nextlane>=blane then 1 else -1 end*.8*dt));
  end if;
 end loop;
 dist:=greatest(dist,nextdist);if dist>=total then dist:=total;finish:=(tick+1)*dt;speed:=0;end if;
 return jsonb_build_object('tick',tick+1,'distance',dist,'lane',nextlane,'heading',heading,'speed',speed,'wall',wall,'crashes',crashes,'impact',impact,'finish',finish);
end $$;
revoke all on function ludus_circus_private.physics_initial()from public,anon,authenticated;
revoke all on function ludus_circus_private.bot_drive(int)from public,anon,authenticated;
revoke all on function ludus_circus_private.physics_bounds(float8)from public,anon,authenticated;
revoke all on function ludus_circus_private.physics_step(jsonb,float8,float8,jsonb,jsonb)from public,anon,authenticated;
create or replace function ludus_circus_private.api(p_action text,p_args jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t timestamptz:=clock_timestamp();a public.ludus_accounts;h ludus_circus_private.heats;receipt ludus_circus_private.receipts;
 v_teams jsonb;cards jsonb:='[]';owned jsonb;horse ludus_stable_private.horses;hid uuid;ids uuid[];v_selected integer;v_stake integer;idx integer;rank integer;score numeric;v_durations jsonb;v_winner integer;replayed boolean:=false;v_history jsonb;v_history_count int;v_history_page int;v_elapsed numeric;v_at numeric;v_position numeric;v_metrics jsonb;v_initial numeric;v_finish numeric;v_order jsonb;v_sample jsonb;v_tick int;v_input numeric;v_sim jsonb;v_target int;v_end numeric;v_bot jsonb;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','bet','enter','cancel_entry','start','next','boost','drive')then raise exception 'Geçersiz hipodrom işlemi.';end if;
 p_args:=coalesce(p_args,'{}');
 select * into a from public.ludus_accounts where user_id=u for update;
 if not found then raise exception 'Önce ludus hesabını oluştur.';end if;
 perform ludus_stable_private.settle(u,t);
 select * into h from ludus_circus_private.heats where owner_id=u order by created_at desc,id desc limit 1 for update;
 if not found then insert into ludus_circus_private.heats(owner_id,teams)values(u,ludus_circus_private.roster())returning * into h;end if;
 if h.drive->>'version'='158' and h.status='running' then
  v_elapsed:=greatest(0,extract(epoch from(t-h.started_at))-3);
  if p_action='drive' then
   if not h.entered or not coalesce((h.drive->>'manual')::boolean,false) or coalesce(p_args->>'heat','')<>h.id::text then raise exception 'Bu yarışta sürüş kapalı.';end if;
   if jsonb_typeof(p_args->'samples') is distinct from 'array' or jsonb_array_length(p_args->'samples')>80 then raise exception 'Sürüş paketi geçersiz.';end if;
   for v_sample in select value from jsonb_array_elements(p_args->'samples') loop
    v_tick:=(v_sample->>'tick')::int;v_input:=(v_sample->>'input')::numeric;
    if v_tick is null or v_tick<0 or v_tick>floor(v_elapsed/.05)+1 or v_input is null or v_input::text in('NaN','Infinity','-Infinity') or abs(v_input)>1 then raise exception 'Sürüş girdisi geçersiz.';end if;
    v_sim:=h.drive->'sim';
    if v_tick<(v_sim->>'tick')::int then continue;end if;
    if v_tick>(v_sim->>'tick')::int+80 then raise exception 'Sürüş bağlantısını yenile.';end if;
    while (v_sim->>'tick')::int<v_tick loop v_sim:=ludus_circus_private.physics_step(v_sim,0,(h.durations->>'3')::float8,h.drive,h.durations);end loop;
    v_sim:=ludus_circus_private.physics_step(v_sim,v_input::float8,(h.durations->>'3')::float8,h.drive,h.durations);
    h.drive:=jsonb_set(h.drive,'{sim}',v_sim);
   end loop;
  end if;
  if coalesce((h.drive->>'manual')::boolean,false) then
   v_sim:=h.drive->'sim';v_target:=greatest(0,floor((least(v_elapsed,660)-1)/.05)::int);
   while (v_sim->>'tick')::int<v_target loop v_sim:=ludus_circus_private.physics_step(v_sim,0,(h.durations->>'3')::float8,h.drive,h.durations);end loop;
   h.drive:=jsonb_set(h.drive,'{sim}',v_sim);
  end if;
  v_order:='[]';v_end:=0;
  for idx in 0..3 loop
   if idx=3 and coalesce((h.drive->>'manual')::boolean,false) then
    v_finish:=coalesce((h.drive->'sim'->>'finish')::numeric,1000000);
   else
    v_bot:=ludus_circus_private.drive_metrics(h.drive->'bots'->idx,v_elapsed,(h.durations->>(idx::text))::numeric);v_finish:=(v_bot->>'finish')::numeric;
   end if;
   v_order:=v_order||jsonb_build_array(jsonb_build_object('team',idx,'time',v_finish));
   if idx<3 or not coalesce((h.drive->>'manual')::boolean,false) then v_end:=greatest(v_end,v_finish);end if;
  end loop;
  select jsonb_agg(value order by (value->>'time')::numeric,(value->>'team')::int)into v_order from jsonb_array_elements(v_order);
  h.winner:=(v_order->0->>'team')::int;
  if coalesce((h.drive->>'manual')::boolean,false)then v_end:=greatest(v_end,least(coalesce((h.drive->'sim'->>'finish')::numeric,1000000),v_end+30));end if;
  update ludus_circus_private.heats set drive=h.drive,winner=h.winner,finish_at=h.started_at+make_interval(secs=>(3+v_end)::float8)where id=h.id returning * into h;
 end if;
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
   elsif p_action='drive' then
    if h.drive->>'version' is distinct from '158' or not h.entered then raise exception 'Bu yarışta sürüş kapalı.';end if;
   elsif p_action='boost' then
    if h.status<>'running' or not h.entered or h.selected is not null or coalesce(h.drive->>'version','') not in('150','158') or(h.drive->>'version'='158' and not coalesce((h.drive->>'manual')::boolean,false)) then raise exception 'Hızlanma yalnızca kendi yarışında kullanılabilir.';end if;
    v_elapsed:=extract(epoch from(t-h.started_at))-3;v_at:=(p_args->>'at')::numeric;
    if v_at is null or v_at::text in('NaN','Infinity','-Infinity') or v_at<0 or v_at>v_elapsed+.05 or v_at<v_elapsed-.65 then raise exception 'Hamle zamanı geçersiz veya bağlantı gecikti.';end if;
    v_metrics:=ludus_circus_private.drive_metrics(h.drive,v_at,(h.durations->>'3')::numeric);
    if (h.drive->>'version'='150' and (v_metrics->>'progress')::numeric>=1) or (h.drive->>'version'='158' and h.drive->'sim'->>'finish' is not null) then raise exception 'Takımın yarışı tamamladı.';end if;
    if v_at-coalesce((h.drive->>'last_attempt')::numeric,-100)<.8 then raise exception 'Yeni hamle için kısa bir süre bekle.';end if;
    if not(v_metrics->>'canBoost')::boolean then raise exception 'Hızlanmak için kondisyonun dolmasını bekle.';end if;
    v_position:=1-abs(1-mod(v_at/.85,2));
    h.drive:=h.drive||jsonb_build_object('last_attempt',v_at,'last_hit',v_position between .70 and .88);
    if v_position between .70 and .88 then
     h.drive:=jsonb_set(h.drive,'{boosts}',(h.drive->'boosts')||jsonb_build_array(jsonb_build_object('at',v_at)));
    end if;
    if h.drive->>'version'='158' then
     update ludus_circus_private.heats set drive=h.drive where id=h.id returning * into h;
    else
    v_metrics:=ludus_circus_private.drive_metrics(h.drive,v_elapsed,(h.durations->>'3')::numeric);
    select greatest((v_metrics->>'finish')::numeric,max(value::numeric)filter(where key<>'3'))into v_finish from jsonb_each_text(h.durations);
    update ludus_circus_private.heats set drive=h.drive,finish_at=h.started_at+make_interval(secs=>(3+v_finish)::double precision)where id=h.id returning * into h;
    end if;
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
    if p_args->>'rules'='158' then
     select jsonb_object_agg(key,(value::numeric)*2.5)into v_durations from jsonb_each_text(v_durations);
     h.drive:=jsonb_build_object('version',158,'laps',5,'manual',h.entered and p_args->>'driving'='158','initial',coalesce(v_initial,100),'boosts','[]'::jsonb,'last_attempt',-100,'sim',ludus_circus_private.physics_initial(),'bots',jsonb_build_array(ludus_circus_private.bot_drive(0),ludus_circus_private.bot_drive(1),ludus_circus_private.bot_drive(2),ludus_circus_private.bot_drive(3)));
     if h.entered then select min(energy)into v_initial from ludus_stable_private.horses where owner_id=u and id=any(h.horse_ids);h.drive:=jsonb_set(h.drive,'{initial}',to_jsonb(v_initial));end if;
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
