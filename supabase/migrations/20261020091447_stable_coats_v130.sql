-- Seven persistent cosmetic coats; no changes to performance or wallets.
alter table ludus_stable_private.horses add column coat text not null default 'dark_brown'
 check(coat in('white','grey','light_brown','dark_brown','black','pinto','caramel'));

create or replace function ludus_stable_private.card(h ludus_stable_private.horses,t timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
declare r ludus_stable_private.rules;w jsonb;f numeric;c numeric;tr numeric;ex numeric;line numeric;vals jsonb:='{}';k text;v numeric;overall numeric;gene numeric;
begin
 select * into r from ludus_stable_private.rules;w:=r.weights;
 f:=case when h.lifetime_seconds>0 then h.nutrition_points/h.lifetime_seconds else h.feed_grade end;
 c:=case when h.lifetime_seconds>0 then h.care_points/h.lifetime_seconds else 100 end;
 tr:=least(100,h.sessions*100.0/greatest(1,h.eligible_seconds/r.training_cooldown));
 ex:=least(100,h.matches*4);line:=case when h.elite_ancestor then 100 else 0 end;
 for k in select jsonb_object_keys(h.genes)loop
  v:=round(least(100,greatest(1,((h.genes->>k)::numeric*(w->>'genes')::numeric+f*(w->>'nutrition')::numeric+
   (tr*.6+least(100,coalesce((h.training->>k)::numeric,0))*.4)*(w->>'training')::numeric+
   line*(w->>'lineage')::numeric+c*(w->>'care')::numeric+ex*(w->>'experience')::numeric)/100)),1);
  vals:=vals||jsonb_build_object(k,v);
 end loop;
 select round(avg(value::numeric),1) into overall from jsonb_each_text(vals);
 select round(avg(value::numeric),1) into gene from jsonb_each_text(h.genes);
 return jsonb_build_object('id',h.id,'owner_id',h.owner_id,'name',h.name,'coat',h.coat,'sex',h.sex,'born_at',h.born_at,'stage',ludus_stable_private.stage(h.born_at,t),
 'breeder_name',h.breeder_name,'genes',h.genes,'stats',vals,'quality',overall,'elite',overall>=r.elite_threshold,'elite_ancestor',h.elite_ancestor,
 'parents',h.parents,'nutrition',round(f,1),'care',round(c,1),'training_history',round(tr,1),'genetic_quality',gene,'experience',ex,
 'feed_bar',round(greatest(0,least(100,extract(epoch from(h.fed_until-t))/r.meal_seconds*100))),
 'feed_grade',h.feed_grade,'fed_until',h.fed_until,'energy',round(h.energy),'training',h.training,'training_until',h.training_until,
 'training_started',h.training_started,'training_stat',h.training_stat,'last_training',h.last_training,'training_ready',h.last_training+make_interval(secs=>r.training_cooldown),
 'sessions',h.sessions,'matches',h.matches,'wins',h.wins,'pregnant_until',h.pregnant_until,'pregnancy_started',h.pregnancy_started,
 'breeding_ready',h.breeding_ready,'sale_price',h.sale_price,'stud_fee',h.stud_fee,'duel_ready',h.duel_ready,
 'npc_price',greatest(25,floor(overall*3)),'lifetime_hours',round((h.lifetime_seconds/3600)::numeric,1));
end $$;

create or replace function ludus_stable_private.lineage(j jsonb,depth integer default 3)returns jsonb language plpgsql immutable set search_path='' as $$
declare p jsonb;out_parents jsonb:='[]';
begin
 if depth>0 then for p in select value from jsonb_array_elements(coalesce(j->'parents','[]'))loop out_parents:=out_parents||jsonb_build_array(ludus_stable_private.lineage(p,depth-1));end loop;end if;
 return jsonb_build_object('id',j->'id','name',j->'name','coat',j->'coat','sex',j->'sex','quality',j->'quality','elite',j->'elite','breeder_name',j->'breeder_name','wins',j->'wins','parents',out_parents);
end $$;

create or replace function ludus_stable_private.settle(u uuid,t timestamptz)returns void language plpgsql set search_path='' as $$
declare h ludus_stable_private.horses;house ludus_stable_private.houses;r ludus_stable_private.rules;
 dt double precision;covered double precision;span double precision;eligible double precision;start_feed timestamptz;count_meals integer;stock integer;f jsonb;allocations jsonb:='{}';
begin
 select * into r from ludus_stable_private.rules;
 select * into house from ludus_stable_private.houses where owner_id=u for update;
 -- Materialize overdue births first, so an offline foal shares feed fairly with the herd.
 for h in select * from ludus_stable_private.horses where owner_id=u and pregnant_until<=t and foal is not null order by pregnant_until,id for update loop
  f:=h.foal;
  insert into ludus_stable_private.horses(owner_id,breeder_name,name,sex,coat,born_at,genes,parents,elite_ancestor,last_tick,fed_until,feed_grade,groomed_until)
  values(u,(select ludus_name from public.ludus_accounts where user_id=u),'Yeni tay',f->>'sex',coalesce(f->>'coat',h.coat),h.pregnant_until,f->'genes',f->'parents',(f->>'elite_ancestor')::boolean,h.pregnant_until,h.pregnant_until+make_interval(secs=>r.meal_seconds),h.feed_grade,h.pregnant_until+interval'24 hours');
  update ludus_stable_private.horses set foal=null where id=h.id;
 end loop;
 if house.auto_feed then
  stock:=coalesce((house.feed_stock->>house.feed_grade::text)::integer,0);
  -- Allocate rations chronologically across all horses, bounded by available stock.
  select coalesce(jsonb_object_agg(x.id,x.n),'{}')into allocations from(
   select events.id,count(*)::integer n from(
    select animal.id,greatest(animal.last_tick,animal.fed_until)+make_interval(secs=>step::double precision*r.meal_seconds) due
    from ludus_stable_private.horses animal cross join lateral generate_series(0,least(stock,ceil(greatest(0,extract(epoch from(t-greatest(animal.last_tick,animal.fed_until))))/r.meal_seconds)::integer)-1)step
    where animal.owner_id=u order by due,animal.id limit stock
   )events group by events.id
  )x;
 end if;
 for h in select * from ludus_stable_private.horses where owner_id=u order by created_at,id for update loop
  dt:=greatest(0,extract(epoch from(t-h.last_tick)));
  covered:=greatest(0,extract(epoch from(least(t,h.fed_until)-h.last_tick)));
  h.nutrition_points:=h.nutrition_points+covered*h.feed_grade;
  if house.auto_feed and h.fed_until<t then
   start_feed:=greatest(h.fed_until,h.last_tick);stock:=coalesce((house.feed_stock->>house.feed_grade::text)::integer,0);
   count_meals:=coalesce((allocations->>h.id::text)::integer,0);
   if count_meals>0 then
    span:=least(extract(epoch from(t-start_feed)),count_meals::double precision*r.meal_seconds);
    h.nutrition_points:=h.nutrition_points+span*house.feed_grade;h.feed_grade:=house.feed_grade;
    h.fed_until:=start_feed+make_interval(secs=>count_meals::double precision*r.meal_seconds);
    house.feed_stock:=jsonb_set(house.feed_stock,array[house.feed_grade::text],to_jsonb(stock-count_meals));
   end if;
  end if;
  h.care_points:=h.care_points+dt*40+greatest(0,extract(epoch from(least(t,coalesce(h.groomed_until,h.last_tick))-h.last_tick)))*60;
  eligible:=greatest(0,extract(epoch from(t-greatest(h.last_tick,h.born_at+make_interval(secs=>r.young_seconds)))));
  if h.pregnant_until is not null then eligible:=greatest(0,eligible-greatest(0,extract(epoch from(least(t,h.pregnant_until)-greatest(h.last_tick,h.pregnancy_started)))));end if;
  h.eligible_seconds:=h.eligible_seconds+eligible;h.lifetime_seconds:=h.lifetime_seconds+dt;
  h.energy:=least(100,h.energy+dt/360);h.last_tick:=t;
  if h.training_until<=t then
   h.sessions:=h.sessions+1;h.training:=jsonb_set(h.training,array[h.training_stat],to_jsonb(least(100,coalesce((h.training->>h.training_stat)::integer,0)+10)));
   h.training_until:=null;h.training_started:=null;h.training_stat:=null;
  end if;
  if h.pregnant_until<=t then h.pregnant_until:=null;h.pregnancy_started:=null;h.foal:=null;end if;
  update ludus_stable_private.horses set nutrition_points=h.nutrition_points,lifetime_seconds=h.lifetime_seconds,care_points=h.care_points,
   eligible_seconds=h.eligible_seconds,energy=h.energy,last_tick=t,fed_until=h.fed_until,feed_grade=h.feed_grade,
   sessions=h.sessions,training=h.training,training_until=h.training_until,training_started=h.training_started,training_stat=h.training_stat,
   pregnant_until=h.pregnant_until,pregnancy_started=h.pregnancy_started,foal=h.foal where id=h.id;
 end loop;
 update ludus_stable_private.houses set feed_stock=house.feed_stock where owner_id=u;
 update ludus_stable_private.requests set status='expired' where expires_at<=t and status='pending' and(u=mare_owner or u=stallion_owner);
end $$;

create or replace function ludus_stable_private.breed(m uuid,s uuid,t timestamptz)returns void language plpgsql set search_path='' as $$
declare mare ludus_stable_private.horses;stallion ludus_stable_private.horses;r ludus_stable_private.rules;a jsonb;b jsonb;genome jsonb:='{}';k text;v integer;
begin
 select * into r from ludus_stable_private.rules;
 select * into mare from ludus_stable_private.horses where id=m for update;
 select * into stallion from ludus_stable_private.horses where id=s for update;
 if mare.sex is distinct from 'female' or stallion.sex is distinct from 'male' or mare.owner_id is null or stallion.owner_id is null then raise exception 'Bir dişi ve bir erkek at seç.';end if;
 if ludus_stable_private.stage(mare.born_at,t)<>'adult' or ludus_stable_private.stage(stallion.born_at,t)<>'adult' then raise exception 'Çiftleştirme için iki at da yetişkin olmalı.';end if;
 if mare.pregnant_until is not null or mare.training_until is not null or stallion.training_until is not null or mare.breeding_ready>t or stallion.breeding_ready>t or mare.sale_price is not null or stallion.sale_price is not null then raise exception 'Atlar çiftleştirmeye hazır değil.';end if;
 if mare.fed_until<=t or stallion.fed_until<=t or mare.energy<50 or stallion.energy<50 then raise exception 'Atların beslenmesi ve enerjisi yeterli olmalı.';end if;
 if not ludus_stable_private.space(mare.owner_id)then raise exception 'Doğacak tay için ahırda bir boş yer gerekiyor.';end if;
 -- Parent/offspring and siblings cannot be paired. Older shared ancestry stays visible.
 if exists(select 1 from jsonb_array_elements(mare.parents)p where p->>'id'=s::text) or exists(select 1 from jsonb_array_elements(stallion.parents)p where p->>'id'=m::text) or exists(select 1 from jsonb_array_elements(mare.parents)p cross join jsonb_array_elements(stallion.parents)q where p->>'id'=q->>'id') then raise exception 'Yakın akraba atlar çiftleştirilemez.';end if;
 a:=ludus_stable_private.card(mare,t);b:=ludus_stable_private.card(stallion,t);
 for k in select jsonb_object_keys(mare.genes)loop
  v:=greatest(1,least(100,round(((mare.genes->>k)::numeric+(stallion.genes->>k)::numeric)*.4+((a->'stats'->>k)::numeric+(b->'stats'->>k)::numeric)*.1+(random()*16-8))::integer));
  genome:=genome||jsonb_build_object(k,v);
 end loop;
 update ludus_stable_private.horses set pregnancy_started=t,pregnant_until=t+make_interval(secs=>r.pregnancy_seconds),breeding_ready=t+make_interval(secs=>r.pregnancy_seconds+r.breeding_cooldown),
 foal=jsonb_build_object('sex',case when random()<.5 then 'female' else 'male' end,'genes',genome,'coat',case when random()<.9 then case when random()<.5 then mare.coat else stallion.coat end else (array['white','grey','light_brown','dark_brown','black','pinto','caramel'])[1+floor(random()*7)::integer] end,'parents',jsonb_build_array(ludus_stable_private.lineage(a),ludus_stable_private.lineage(b)),
 'elite_ancestor',mare.elite_ancestor or stallion.elite_ancestor or(a->>'elite')::boolean or(b->>'elite')::boolean)where id=m;
 update ludus_stable_private.horses set breeding_ready=t+make_interval(secs=>r.breeding_cooldown)where id=s;
end $$;

create or replace function ludus_stable_private.api(p_action text,p_args jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t timestamptz:=clock_timestamp();r ludus_stable_private.rules;h ludus_stable_private.horses;other ludus_stable_private.horses;house ludus_stable_private.houses;
 receipt ludus_stable_private.receipts;req ludus_stable_private.requests;d ludus_stable_private.duels;
 hid uuid;partner uuid;reqid uuid;target uuid;cost integer;grade integer;qty integer;price integer;k text;genome jsonb:='{}';outcome jsonb:='{}';payload jsonb;lastscore numeric;score numeric;timing numeric;n integer;elapsed numeric;target_ms numeric;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)then raise exception 'Hesabına giriş yap.';end if;
 if p_action is null or p_action not in('state','buy_founder','buy_feed','feed','groom','settings','select','rename','train','breed','stud','request','accept','decline','cancel_request','list','unlist','buy','sell_npc','duel_start','duel_hit','duel_finish') then raise exception 'Geçersiz ahır işlemi.';end if;
 p_args:=coalesce(p_args,'{}');hid:=nullif(p_args->>'horse','')::uuid;target:=nullif(p_args->>'target','')::uuid;reqid:=nullif(p_args->>'id','')::uuid;
 -- Lock all affected accounts in UUID order before any horse or wallet mutation.
 if p_action='buy' then select owner_id into partner from ludus_stable_private.horses where id=hid;
 elsif p_action in('accept','decline','cancel_request') then select * into req from ludus_stable_private.requests where id=reqid;partner:=case when req.mare_owner=u then req.stallion_owner else req.mare_owner end;
 elsif p_action='request' then select owner_id into partner from ludus_stable_private.horses where id=target;end if;
 perform 1 from public.ludus_accounts where user_id=u or user_id=partner order by user_id for update;
 perform ludus_private.level_ensure(u);t:=clock_timestamp();
 select * into r from ludus_stable_private.rules;
 insert into ludus_stable_private.houses(owner_id)values(u)on conflict do nothing;
 if partner is not null then perform ludus_stable_private.settle(partner,t);end if;
 perform ludus_stable_private.settle(u,t);
 select * into house from ludus_stable_private.houses where owner_id=u;
 if p_action<>'state' then
  if p_request is null then raise exception 'İşlem kimliği gerekiyor.';end if;
  select * into receipt from ludus_stable_private.receipts where owner_id=u and request_id=p_request;
  if found then
   if receipt.action<>p_action or receipt.args<>p_args then raise exception 'İşlem kimliği başka bir işlemde kullanılmış.';end if;
   return ludus_stable_private.state(u,t)||jsonb_build_object('result',receipt.result||'{"replayed":true}'::jsonb);
  end if;
 end if;
 if hid is not null then select * into h from ludus_stable_private.horses where id=hid for update;
  if not found or (p_action<>'buy' and h.owner_id is distinct from u)then raise exception 'Bu at ahırında bulunmuyor.';end if;
 end if;
 if p_action in('feed','groom','select','rename','train','breed','stud','list','unlist','buy','sell_npc','duel_start','request') and hid is null then raise exception 'Bir at seç.';end if;
 if p_action in('train','breed','stud','list','sell_npc','duel_start')and exists(select 1 from ludus_stable_private.duels where horse_id=hid and finished_at is null and started_at>t-interval'2 minutes')then raise exception 'Önce devam eden düelloyu tamamla.';end if;
 if p_action in('train','breed','stud','duel_start')and h.sale_price is not null then raise exception 'Önce satış ilanını kaldır.';end if;
 if p_action='buy_founder'then
  if not ludus_stable_private.space(u)then raise exception 'Ahır kapasitesi dolu.';end if;
  if p_args->>'sex' not in('female','male')or p_args->>'sex' is null then raise exception 'Atın cinsiyetini seç.';end if;
  if coalesce(p_args->>'coat','dark_brown') not in('white','grey','light_brown','dark_brown','black','pinto','caramel')then raise exception 'Geçerli bir at görünümü seç.';end if;
  cost:=350;for k in select unnest(array['power','speed','acceleration','agility','stamina','balance','courage','recovery','burst'])loop genome:=genome||jsonb_build_object(k,60+floor(random()*21)::integer);end loop;
  insert into ludus_stable_private.horses(owner_id,name,sex,coat,born_at,genes,last_tick,fed_until,groomed_until)values(u,case when p_args->>'sex'='female'then 'Luna'else 'Aquilo'end,p_args->>'sex',coalesce(p_args->>'coat','dark_brown'),t-make_interval(secs=>r.adult_seconds),genome,t,t+make_interval(secs=>r.meal_seconds),t+interval'24 hours')returning id into hid;
  update ludus_stable_private.houses set selected=hid where owner_id=u;outcome:=jsonb_build_object('message','At ahırına geldi. İlk yem ve bakımı hazır.','horse',hid);
 elsif p_action='buy_feed'then
  grade:=(p_args->>'grade')::integer;qty:=(p_args->>'quantity')::integer;
  if grade is null or grade not in(50,75,100)or qty is null or qty not between 1 and 100 then raise exception 'Yem kalitesi ve miktarını seç.';end if;
  if coalesce((house.feed_stock->>grade::text)::integer,0)+qty>10000 then raise exception 'Yem deposu dolu.';end if;
  cost:=qty*case grade when 50 then 2 when 75 then 4 else 7 end;
  update ludus_stable_private.houses set feed_stock=jsonb_set(feed_stock,array[grade::text],to_jsonb(coalesce((feed_stock->>grade::text)::integer,0)+qty))where owner_id=u;outcome:=jsonb_build_object('message',qty||' öğün yem depoya eklendi.');
 elsif p_action='settings'then
  grade:=(p_args->>'grade')::integer;if grade is null or grade not in(50,75,100)or jsonb_typeof(p_args->'auto')is distinct from 'boolean'then raise exception 'Yemlik ayarlarını kontrol et.';end if;
  update ludus_stable_private.houses set auto_feed=(p_args->>'auto')::boolean,feed_grade=grade where owner_id=u;outcome:='{"message":"Otomatik yemlik ayarları kaydedildi."}';
 elsif p_action='feed'then
  grade:=(p_args->>'grade')::integer;if grade is null or grade not in(50,75,100)then raise exception 'Yem kalitesini seç.';end if;
  if h.fed_until>t+make_interval(secs=>r.meal_seconds/2)then raise exception 'Atın henüz tok. Beslenme yarının altına indiğinde yem verebilirsin.';end if;
  qty:=coalesce((house.feed_stock->>grade::text)::integer,0);if qty<1 then raise exception 'Bu kalitede yem kalmadı.';end if;
  update ludus_stable_private.houses set feed_stock=jsonb_set(feed_stock,array[grade::text],to_jsonb(qty-1))where owner_id=u;
  update ludus_stable_private.horses set fed_until=t+make_interval(secs=>r.meal_seconds),feed_grade=grade where id=hid;outcome:='{"message":"Yem verildi; gıda kalitesi yaşam geçmişine işlenecek."}';
 elsif p_action='groom'then
  update ludus_stable_private.horses set groomed_until=t+interval'24 hours' where id=hid;outcome:='{"message":"Seyis bakımını tamamladı. Bakım etkisi 24 saat sürer."}';
 elsif p_action='select'then update ludus_stable_private.houses set selected=hid where owner_id=u;
 elsif p_action='rename'then
  if length(btrim(coalesce(p_args->>'name','')))not between 1 and 28 then raise exception 'At ismi 1–28 karakter olmalı.';end if;
  update ludus_stable_private.horses set name=btrim(p_args->>'name')where id=hid;outcome:='{"message":"Atın adı güncellendi."}';
 elsif p_action='train'then
  k:=p_args->>'stat';if k is null or not(h.genes?k)then raise exception 'Bir özellik seç.';end if;
  if ludus_stable_private.stage(h.born_at,t)='foal'or h.pregnant_until is not null or h.training_until is not null or h.last_training+make_interval(secs=>r.training_cooldown)>t or h.energy<25 or h.fed_until<=t then raise exception 'At antrenmana hazır değil. Yaş, beslenme, enerji ve dinlenmesini kontrol et.';end if;
  update ludus_stable_private.horses set training_stat=k,training_started=t,training_until=t+make_interval(secs=>r.training_seconds),last_training=t,energy=energy-20 where id=hid;outcome:='{"message":"Antrenman başladı. Tamamlanınca seçtiğin özellik ve geçmiş gelişecek."}';
 elsif p_action='breed'then
  select * into other from ludus_stable_private.horses where id=target and owner_id=u for update;if not found then raise exception 'Ahırından bir eş seç.';end if;
  perform ludus_stable_private.breed(hid,target,t);outcome:='{"message":"Gebelik başladı. Tay için bir ahır yeri ayrıldı."}';
 elsif p_action='stud'then
  price:=(p_args->>'price')::integer;
  if h.sex<>'male'or ludus_stable_private.stage(h.born_at,t)<>'adult' or(price is not null and price not between 1 and 1000000)then raise exception 'Ücretli çiftleştirme için yetişkin erkek at ve geçerli bir ücret gerekiyor.';end if;
  update ludus_stable_private.horses set stud_fee=price where id=hid;outcome:='{"message":"Çiftleştirme ilanı güncellendi."}';
 elsif p_action='request'then
  select * into other from ludus_stable_private.horses where id=target for update;
  if not found or other.owner_id is distinct from partner or partner is null or partner=u or other.stud_fee is null or other.sale_price is not null or other.stud_fee is distinct from (p_args->>'price')::integer then raise exception 'Çiftleştirme ilanı değişti. Listeyi yenile.';end if;
  if h.sex<>'female' or ludus_stable_private.stage(h.born_at,t)<>'adult' or h.pregnant_until is not null then raise exception 'Yetişkin ve gebe olmayan bir dişi at seç.';end if;
  if not ludus_stable_private.space(u)then raise exception 'Tay için ahırda boş yer gerekiyor.';end if;
  if exists(select 1 from ludus_stable_private.requests where mare_id=hid and stallion_id=target and status='pending')then raise exception 'Bu eşleştirme için bekleyen bir talebin var.';end if;
  insert into ludus_stable_private.requests(mare_id,stallion_id,mare_owner,stallion_owner,fee,expires_at)values(hid,target,u,partner,other.stud_fee,t+interval'24 hours');outcome:='{"message":"Çiftleştirme talebi gönderildi. Ücret kabul edildiğinde ödenecek."}';
 elsif p_action in('accept','decline','cancel_request')then
  select * into req from ludus_stable_private.requests where id=reqid for update;
  if not found or req.status<>'pending'or req.expires_at<=t or (p_action in('accept','decline')and req.stallion_owner<>u)or(p_action='cancel_request'and req.mare_owner<>u)then raise exception 'Bu talep işleme açık değil.';end if;
  if p_action='accept'then
   select * into h from ludus_stable_private.horses where id=req.mare_id for update;select * into other from ludus_stable_private.horses where id=req.stallion_id for update;
   if h.owner_id is distinct from req.mare_owner or other.owner_id is distinct from u or req.mare_owner is distinct from partner then raise exception 'Atın sahibi değişmiş. Talep geçersiz.';end if;
   perform ludus_stable_private.breed(req.mare_id,req.stallion_id,t);
   update public.ludus_accounts set gold=gold-req.fee where user_id=req.mare_owner and gold>=req.fee;if not found then raise exception 'Talep sahibinin denariusu yetersiz.';end if;
   update public.ludus_accounts set gold=gold+req.fee where user_id=u;
   update ludus_stable_private.requests set status='accepted'where id=reqid;outcome:='{"message":"Talep kabul edildi. Ücret aktarıldı; tay dişi atın sahibine ait olacak."}';
  else update ludus_stable_private.requests set status=case when p_action='decline'then 'declined'else 'cancelled'end where id=reqid;outcome:='{"message":"Talep kapatıldı."}';end if;
 elsif p_action='list'then
  price:=(p_args->>'price')::integer;if price is null or price not between 1 and 1000000 then raise exception 'Satış fiyatı 1–1.000.000 denarius olmalı.';end if;
  if h.pregnant_until is not null or h.training_until is not null then raise exception 'Gebelik veya antrenman sürerken at satılamaz.';end if;
  update ludus_stable_private.horses set sale_price=price,stud_fee=null where id=hid;outcome:='{"message":"At satışa çıktı. Şeceresi ve yetiştirme geçmişi alıcıya görünür."}';
 elsif p_action='unlist'then update ludus_stable_private.horses set sale_price=null where id=hid;outcome:='{"message":"Satış ilanı kaldırıldı."}';
 elsif p_action in('buy','sell_npc')then
  if p_action='buy'then
   if h.owner_id is distinct from partner or partner is null or partner=u or h.sale_price is null or h.sale_price is distinct from(p_args->>'price')::integer then raise exception 'Satış ilanı değişti. Listeyi yenile.';end if;
   if not ludus_stable_private.space(u)then raise exception 'Ahır kapasitesi dolu.';end if;
   cost:=h.sale_price;update public.ludus_accounts set gold=gold+cost where user_id=partner;
   update ludus_stable_private.horses set owner_id=u,acquired_at=t,sale_price=null,stud_fee=null where id=hid;
   update ludus_stable_private.houses set selected=hid where owner_id=u;outcome:='{"message":"At satın alındı. Şecere ve bütün yetiştirme geçmişi korundu."}';
  else
   if h.pregnant_until is not null or h.training_until is not null then raise exception 'Gebelik veya antrenman sürerken at satılamaz.';end if;
   price:=(ludus_stable_private.card(h,t)->>'npc_price')::integer;
   update public.ludus_accounts set gold=gold+price where user_id=u;
   update ludus_stable_private.horses set owner_id=null,sale_price=null,stud_fee=null where id=hid;outcome:=jsonb_build_object('message','At yetiştiriciye satıldı. '||price||' denarius kazandın.');
  end if;
  update ludus_stable_private.requests set status='cancelled'where status='pending'and(mare_id=hid or stallion_id=hid);
 elsif p_action='duel_start'then
  if coalesce(p_args->>'tier','novice')not in('novice','arena','champion')then raise exception 'Geçerli bir düello ligi seç.';end if;
  if exists(select 1 from ludus_stable_private.duels where owner_id=u and finished_at is null)then raise exception 'Önce açık düellonun sonucunu al.';end if;
  if ludus_stable_private.stage(h.born_at,t)<>'adult'or h.pregnant_until is not null or h.training_until is not null or h.duel_ready>t or h.energy<35 or h.fed_until<=t then raise exception 'Düello için yetişkin, tok, dinlenmiş ve gebe olmayan bir at gerekiyor.';end if;
  payload:=ludus_stable_private.card(h,t);score:=0;for k in select unnest(array['power','speed','acceleration','agility','stamina','balance','courage','recovery','burst'])loop
   score:=score+(payload->'stats'->>k)::numeric*case k when 'power'then .20 when 'speed'then .20 when 'burst'then .15 when 'stamina'then .10 else .07 end;
  end loop;
  insert into ludus_stable_private.duels(owner_id,horse_id,started_at,horse_score,opponent_score,tier,targets)values(u,hid,t,score,case coalesce(p_args->>'tier','novice')when 'champion'then 85 when 'arena'then 65 else 40 end+random()*8,coalesce(p_args->>'tier','novice'),jsonb_build_array(4200+floor(random()*800),10200+floor(random()*800),16200+floor(random()*800)))returning id into reqid;
  update ludus_stable_private.horses set energy=energy-30,duel_ready=t+make_interval(secs=>r.duel_cooldown)where id=hid;outcome:=jsonb_build_object('message','Üç karşılaşmada işaretli anda hamle yap.','duel_id',reqid);
 elsif p_action in('duel_hit','duel_finish')then
  select * into d from ludus_stable_private.duels where id=reqid and owner_id=u for update;if not found then raise exception 'Düello bulunamadı.';end if;
  if d.finished_at is not null then outcome:=d.result;
  else
   elapsed:=extract(epoch from(t-d.started_at))*1000;
   if p_action='duel_hit'then
    n:=(p_args->>'round')::integer;if n is null or n not between 0 and 2 or elapsed<n*6000+1500 or elapsed>(n+1)*6000+500 then raise exception 'Bu karşılaşmanın hamle zamanı geçti.';end if;
    if exists(select 1 from jsonb_array_elements(d.controls)c where(c->>'round')::integer=n)then raise exception 'Bu karşılaşmada hamle yaptın.';end if;
    target_ms:=(d.targets->>n)::numeric;timing:=greatest(0,100-abs(elapsed-target_ms)/12);
    d.controls:=d.controls||jsonb_build_array(jsonb_build_object('round',n,'timing',round(timing,1),'at',round(elapsed)));
    update ludus_stable_private.duels set controls=d.controls where id=reqid;outcome:=jsonb_build_object('message','Hamle isabeti: %'||round(timing),'timing',round(timing,1));
   else
    if elapsed<19000 then raise exception 'Düello henüz tamamlanmadı.';end if;
    select coalesce(sum((c->>'timing')::numeric),0)/3 into timing from jsonb_array_elements(d.controls)c;
    score:=d.horse_score*.75+timing*.25;lastscore:=d.opponent_score*.75+55*.25;
    outcome:=jsonb_build_object('message',case when score>lastscore then 'Düelloyu kazandın!'else 'Rakip bu düelloyu kazandı.'end,'won',score>lastscore,'score',round(score,1),'opponent_score',round(lastscore,1),'timing',round(timing,1));
    update ludus_stable_private.duels set finished_at=t,result=outcome where id=reqid;
    update ludus_stable_private.horses set matches=matches+1,wins=wins+case when score>lastscore then 1 else 0 end where id=d.horse_id;
   end if;
  end if;
 end if;
 if cost is not null then update public.ludus_accounts set gold=gold-cost where user_id=u and gold>=cost;if not found then raise exception 'Denarius yetersiz.';end if;end if;
 if p_action in('settings','buy_feed')then t:=clock_timestamp();perform ludus_stable_private.settle(u,t);end if;
 if p_action<>'state'then insert into ludus_stable_private.receipts(owner_id,request_id,action,args,result)values(u,p_request,p_action,p_args,outcome);end if;
 return ludus_stable_private.state(u,t)||jsonb_build_object('result',outcome);
end $$;

-- Existing grants, private security-definer boundary and RLS remain in place.
notify pgrst,'reload schema';
