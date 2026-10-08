-- Twelve approved missions repeat every four Istanbul calendar days.
-- Catalog UUIDs are per date; assignments retain their original mission snapshot.
begin;
alter table public.ludus_imperial_catalog add column if not exists detail_image text;
alter table public.ludus_imperial_catalog add column if not exists difficulty integer;
alter table public.ludus_imperial_catalog add column if not exists cycle_revision bigint;
update public.ludus_imperial_catalog set difficulty=slot where difficulty is null;
update public.ludus_imperial_catalog set detail_image=case image
 when 'imperial-trajan-v31.webp' then 'imperial-missions/gun04-kolay-traianus-detay.webp'
 when 'imperial-portus-v31.webp' then 'imperial-missions/gun04-orta-portus-detay.webp'
 when 'imperial-subura-v31.webp' then 'imperial-missions/gun04-zor-subura-detay.webp'
 else image end where detail_image is null;
alter table public.ludus_imperial_catalog alter column difficulty set not null;
alter table public.ludus_imperial_catalog alter column detail_image set not null;
alter table public.ludus_imperial_catalog add constraint ludus_imperial_difficulty check(difficulty between 1 and 3);
create table public.ludus_imperial_cycle(
 id boolean primary key default true check(id),
 start_date date not null,
 entries jsonb not null check(jsonb_typeof(entries)='array' and jsonb_array_length(entries)in(0,12)),
 draft_start_date date not null,
 draft jsonb not null check(jsonb_typeof(draft)='array' and jsonb_array_length(draft)in(0,12)),
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.ludus_imperial_cycle enable row level security;
revoke all on public.ludus_imperial_cycle from public,anon,authenticated,service_role;

-- Invoker helper is private. The authenticated RPC validates the account first.
create or replace function ludus_private.imperial_ensure_day(p_day date)returns void
language plpgsql security invoker set search_path='' as $$
declare plan public.ludus_imperial_cycle; entry jsonb; day_index integer; slot_index integer;
begin
 select * into plan from public.ludus_imperial_cycle where id;
 if not found or p_day is null or p_day<plan.start_date or jsonb_array_length(plan.entries)<>12 then return;end if;
 -- The unique (day,slot) index makes refresh a read once all three entries exist.
 if(select count(*)from public.ludus_imperial_catalog where day=p_day and cycle_revision>=plan.revision)=3 then return;end if;
 day_index:=(p_day-plan.start_date)%4;
 for slot_index in 1..3 loop
  entry:=plan.entries->(day_index*3+slot_index-1);
  insert into public.ludus_imperial_catalog(day,slot,title,description,image,detail_image,difficulty,cycle_revision)
  values(p_day,slot_index,trim(entry->>'title'),trim(entry->>'description'),entry->>'image',entry->>'detail_image',coalesce((entry->>'difficulty')::integer,slot_index),plan.revision)
  on conflict(day,slot)do update set title=excluded.title,description=excluded.description,image=excluded.image,detail_image=excluded.detail_image,difficulty=excluded.difficulty,cycle_revision=excluded.cycle_revision
  where public.ludus_imperial_catalog.cycle_revision is null or public.ludus_imperial_catalog.cycle_revision<excluded.cycle_revision;
 end loop;
end;$$;
revoke all on function ludus_private.imperial_ensure_day(date)from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION ludus_private.imperial(p_action text DEFAULT 'state'::text, p_mission uuid DEFAULT NULL::uuid, p_gladiators uuid[] DEFAULT '{}'::uuid[], p_assignment uuid DEFAULT NULL::uuid, p_week date DEFAULT NULL::date, p_entries jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();today date:=(clock_timestamp()at time zone'Europe/Istanbul')::date; c public.ludus_imperial_catalog;a public.ludus_imperial_assignments;g record;ids uuid[];crew jsonb:='[]';total integer:=0;required integer;hours integer;v_diamonds integer;counts integer[];v_family text;stone integer;reward jsonb:='[]';entry jsonb;i integer;j integer;day_index integer;slot_index integer;is_admin boolean;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u)then raise exception 'Hesabına giriş yap.';end if;
 perform ludus_private.imperial_ensure_day(today);
 perform pg_advisory_xact_lock(hashtextextended(u::text,31));
 perform 1 from public.ludus_accounts where user_id=u for update;
 perform ludus_private.v7_settle(u);
 perform ludus_private.imperial_settle(u);
 is_admin:=exists(select 1 from public.ludus_imperial_admins where user_id=u);
 if p_action='join'then
  select * into c from public.ludus_imperial_catalog where id=p_mission and day=today;
  if not found then raise exception 'Bu görev bugün katılıma açık değil.';end if;
  if not exists(select 1 from public.ludus_imperial_assignments where owner_id=u and mission_id=c.id)then
   if p_gladiators is null or cardinality(p_gladiators)not between 1 and 30 or cardinality(p_gladiators)<>(select count(distinct x)from unnest(p_gladiators)x)then raise exception 'Geçerli ve farklı gladyatörler seç.';end if;
   ids:=array(select x from unnest(p_gladiators)x order by x);
   for g in select * from public.ludus_gladiators where id=any(ids)and owner_id=u order by id for update loop
    if exists(select 1 from public.ludus_clan_roster_entries e join public.ludus_clan_rosters r on r.id=e.roster_id where e.gladiator_id=g.id and r.state in('draft','locked'))or g.clan_roster_id is not null or exists(select 1 from public.ludus_battles where gladiator_id=g.id and finished_at is null)or exists(select 1 from public.ludus_matches m where m.status in('waiting','playing')and m.updated_at>clock_timestamp()-interval '30 seconds'and m.players @>jsonb_build_array(jsonb_build_object('gladiator',jsonb_build_object('id',g.id))))or exists(select 1 from public.ludus_duels where status in('waiting','playing')and updated_at>clock_timestamp()-interval '75 seconds'and g.id in(host_g,guest_g))or g.status<>'available'or coalesce(g.training_ends_at>clock_timestamp(),false)or coalesce(g.injured_until>clock_timestamp(),false)or exists(select 1 from public.ludus_imperial_members where gladiator_id=g.id and active)then raise exception 'Gladyatör başka bir işte veya hazır değil.';end if;
    total:=total+coalesce(g.overall,50);crew:=crew||jsonb_build_array(jsonb_build_object('id',g.id,'name',g.name,'class',g.class,'overall',coalesce(g.overall,50)));
   end loop;
   if jsonb_array_length(crew)<>cardinality(ids)then raise exception 'Yalnızca kendi gladyatörlerini görevlendirebilirsin.';end if;
   required:=case c.difficulty when 1 then 50 when 2 then 150 else 250 end;hours:=case c.difficulty when 1 then 12 when 2 then 18 else 24 end;
   if total<required then raise exception 'Toplam Overall yetersiz: % / %.',total,required;end if;
   insert into public.ludus_imperial_assignments(owner_id,mission_id,mission,gladiators,ends_at)values(u,c.id,to_jsonb(c)||jsonb_build_object('required',required,'hours',hours),crew,clock_timestamp()+make_interval(hours=>hours))returning * into a;
   insert into public.ludus_imperial_members(assignment_id,gladiator_id)select a.id,x from unnest(ids)x;
   update public.ludus_gladiators set status='locked'where id=any(ids)and owner_id=u;
  end if;
 elsif p_action='claim'then
  select * into a from public.ludus_imperial_assignments where id=p_assignment and owner_id=u for update;
  if not found then raise exception 'Görev kaydı bulunamadı.';end if;
  if a.ends_at>clock_timestamp()then raise exception 'Görev henüz bitmedi.';end if;
  if a.claimed_at is null then
   slot_index:=coalesce((a.mission->>'difficulty')::integer,(a.mission->>'slot')::integer);v_diamonds:=case slot_index when 1 then 2 when 2 then 3 else 5 end;counts:=case slot_index when 1 then array[1,0,0]when 2 then array[0,2,0]else array[1,1,2]end;
   for i in 1..3 loop
    v_family:=case i when 1 then 'sapphire'when 2 then 'emerald'else 'ruby'end;
    for j in 1..counts[i]loop
     stone:=1+floor(random()*case i when 1 then 18 when 2 then 15 else 4 end)::integer;
     insert into public.ludus_stones(owner_id,family,stone_id,quantity)values(u,v_family,stone,1)on conflict(owner_id,family,stone_id)do update set quantity=public.ludus_stones.quantity+1;
     reward:=reward||jsonb_build_array(jsonb_build_object('family',v_family,'id',stone,'quantity',1));
    end loop;
   end loop;
   update public.ludus_accounts set stones_version=stones_version+1,diamonds=coalesce(public.ludus_accounts.diamonds,0)+v_diamonds where user_id=u;
   update public.ludus_imperial_assignments set claimed_at=clock_timestamp(),rewards=jsonb_build_object('diamonds',v_diamonds,'stones',reward)where id=a.id;
  end if;
 elsif p_action in('admin_state','save_draft','publish_cycle','publish_week')then
  if not is_admin then raise exception 'Yönetici yetkisi gerekiyor.';end if;
  if p_action<>'admin_state'then
   if p_week is null or p_week<today-3650 or p_week>today+365 then raise exception 'Geçerli bir döngü başlangıç tarihi seç.';end if;
   if jsonb_typeof(p_entries)is distinct from 'array' or jsonb_array_length(p_entries)<>12 then raise exception '4 günlük döngü tam 12 görevden oluşmalı.';end if;
   for i in 0..11 loop
    entry:=p_entries->i;
    if jsonb_typeof(entry)is distinct from 'object' or length(coalesce(entry->>'title',''))>120 or length(coalesce(entry->>'description',''))>1800 or length(coalesce(entry->>'image',''))>500 or length(coalesce(entry->>'detail_image',''))>500 or coalesce(entry->>'difficulty',(i%3+1)::text)!~'^[123]$' then raise exception 'Görev metni, zorluğu veya görseli geçersiz.';end if;
    if p_action in('publish_cycle','publish_week')then
     if length(trim(coalesce(entry->>'title','')))<4 or length(trim(coalesce(entry->>'description','')))<20 or coalesce(entry->>'image','')!~'^(imperial-[a-z0-9-]+\.webp|imperial-missions/[a-z0-9-]+\.webp|https://[^[:space:]]+)$' or coalesce(entry->>'detail_image','')!~'^(imperial-[a-z0-9-]+\.webp|imperial-missions/[a-z0-9-]+\.webp|https://[^[:space:]]+)$' or entry->>'image'=entry->>'detail_image' then raise exception '% numaralı görevin başlık, açıklama ve iki ayrı görselini tamamla.',i+1;end if;
    end if;
   end loop;
   if p_action='save_draft'then
    insert into public.ludus_imperial_cycle(id,start_date,entries,draft_start_date,draft)values(true,p_week,'[]',p_week,p_entries)
    on conflict(id)do update set draft_start_date=excluded.draft_start_date,draft=excluded.draft,updated_at=clock_timestamp();
   else
    insert into public.ludus_imperial_cycle(id,start_date,entries,draft_start_date,draft)values(true,p_week,p_entries,p_week,p_entries)
    on conflict(id)do update set start_date=excluded.start_date,entries=excluded.entries,draft_start_date=excluded.draft_start_date,draft=excluded.draft,revision=public.ludus_imperial_cycle.revision+1,updated_at=clock_timestamp();
    perform ludus_private.imperial_ensure_day(today);
   end if;
  end if;
  return jsonb_build_object('is_admin',true,'days',4,'week',(select draft_start_date from public.ludus_imperial_cycle where id),'entries',coalesce((select draft from public.ludus_imperial_cycle where id),'[]'::jsonb));
 elsif p_action<>'state'then raise exception 'Geçersiz işlem.';end if;
 return jsonb_build_object('today',today,'server_now',clock_timestamp(),'is_admin',is_admin,'cycle_day',(select case when today>=start_date then (today-start_date)%4+1 end from public.ludus_imperial_cycle where id),'missions',coalesce((select jsonb_agg(to_jsonb(x)order by slot)from public.ludus_imperial_catalog x where day=today),'[]'::jsonb),'assignments',coalesce((select jsonb_agg(to_jsonb(x)order by started_at desc)from public.ludus_imperial_assignments x where owner_id=u and((mission->>'day')::date=today or claimed_at is null)),'[]'::jsonb),'gladiators',coalesce((select jsonb_agg(to_jsonb(x)order by name)from public.ludus_gladiators x where owner_id=u),'[]'::jsonb));
end;$function$;

CREATE OR REPLACE FUNCTION ludus_private.level_imperial_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare xp integer;
begin
 if tg_op='INSERT'then
  new.mission:=new.mission||jsonb_build_object('ludus_exp',case coalesce((new.mission->>'difficulty')::integer,(new.mission->>'slot')::integer) when 1 then 500 when 2 then 750 else 1000 end);return new;
 end if;
 if old.claimed_at is null and new.claimed_at is not null then
  xp:=coalesce((new.mission->>'ludus_exp')::integer,case coalesce((new.mission->>'difficulty')::integer,(new.mission->>'slot')::integer) when 1 then 500 when 2 then 750 else 1000 end);
  xp:=ludus_private.level_grant(new.owner_id,'imperial',new.id::text,xp,new.claimed_at);
  new.rewards:=coalesce(new.rewards,'{}')||jsonb_build_object('ludus_exp',xp);
 end if;return new;
end $function$;

revoke all on function ludus_private.imperial(text,uuid,uuid[],uuid,date,jsonb),ludus_private.level_imperial_event()from public,anon,authenticated,service_role;
insert into public.ludus_imperial_cycle(id,start_date,entries,draft_start_date,draft)values(true,(clock_timestamp()at time zone'Europe/Istanbul')::date,'[{"cycle_day": 1, "slot": 1, "difficulty": 1, "title": "Aventinus Tepesi Hırsızı", "description": "\"Bana muhalif bir pleb lideri, Aventinus Tepesi''ndeki evinde Senato yolsuzluklarımı içeren belgeler saklıyor. Evine sız, o parşömenleri çal ve yerine yasadışı büyü/tılsım malzemeleri bırak ki ertesi gün onu vatana ihanet ve cadılıkla suçlayabileyim.\"", "image": "imperial-missions/gun01-kolay-aventinus-kart.webp", "detail_image": "imperial-missions/gun01-kolay-aventinus-detay.webp"}, {"cycle_day": 1, "slot": 2, "difficulty": 2, "title": "Palmyra İsyan Tohumu", "description": "\"Palmyra''da Roma''ya sadık görünen yeni valinin aslında halkı örgütlediğini duydum. Valinin korumalarını aşarak yatak odasına sız. Duvara kanla yerel dilde isyan sloganları yaz ve valiyi öldürerek suçu radikal örgütlere yık; böylece şehre ordu sokma hakkım doğsun.\"", "image": "imperial-missions/gun01-orta-palmyra-kart.webp", "detail_image": "imperial-missions/gun01-orta-palmyra-detay.webp"}, {"cycle_day": 1, "slot": 3, "difficulty": 3, "title": "Nisibis Kuşatması / Sasaniler", "description": "\"Doğu sınırındaki Nisibis (Nusaybin) kalesi düşmek üzere. Sasanilerin kuşatma kulelerini koruyan nöbetçileri gizlilikle temizle, kulelerin ahşap ayaklarına zift dök ve hepsini ateşe vererek orduya zaman kazandır.\"", "image": "imperial-missions/gun01-zor-nisibis-kart.webp", "detail_image": "imperial-missions/gun01-zor-nisibis-detay.webp"}, {"cycle_day": 2, "slot": 1, "difficulty": 1, "title": "Hamamda Boğma", "description": "Caracalla Hamamları''nın buhar odasında (Sudatorium), imparatora suikast planlayan bir muhbiri, kaza süsü vererek suyun altında boğup öldürün.", "image": "imperial-missions/gun02-kolay-hamam-kart.webp", "detail_image": "imperial-missions/gun02-kolay-hamam-detay.webp"}, {"cycle_day": 2, "slot": 2, "difficulty": 2, "title": "Pompeii Vergi Kaçakçısı", "description": "\"Pompeii''deki zengin bir zeytinyağı tüccarı Senato''ya rüşvet vererek imparatorluk vergisinden kaçıyor. Evine hırsız kılığına girerek sız, gizli altın kasasını boşalt ve duvara ''Vergisini ödemeyenin sonu'' yazarak suçu yerel çetelere at.\"", "image": "imperial-missions/gun02-orta-pompeii-vergi-kart.webp", "detail_image": "imperial-missions/gun02-orta-pompeii-vergi-detay.webp"}, {"cycle_day": 2, "slot": 3, "difficulty": 3, "title": "Aktium Sabotajı", "description": "Aktium deniz savaşı başlamadan hemen önceki gece, Mark Antony ve Kleopatra’nın amiral gemisinin omurgasını ve kürek mekanizmalarını suyun altından sızarak sabote edin.", "image": "imperial-missions/gun02-zor-aktium-kart.webp", "detail_image": "imperial-missions/gun02-zor-aktium-detay.webp"}, {"cycle_day": 3, "slot": 1, "difficulty": 3, "title": "Masada Fedaileri", "description": "Dik yamaçtaki Masada Kalesi''nin düşmesini hızlandırmak için gece vakti uçurumlardan tırmanarak kaleye sızın ve içerideki direnişçilerin su sarnıçlarını zehirleyin.", "image": "imperial-missions/gun03-masada-kart.webp", "detail_image": "imperial-missions/gun03-masada-detay.webp"}, {"cycle_day": 3, "slot": 2, "difficulty": 3, "title": "Kudüs Yağması", "description": "General Titus’un ordusu Kudüs Tapınağı''na girerken, kaosun ortasında tapınağın altındaki kutsal altın şamdanı (Menora) askerlerden önce çalıp Roma’daki efendinize göndermek üzere kaçırın.", "image": "imperial-missions/gun03-kudus-kart.webp", "detail_image": "imperial-missions/gun03-kudus-detay.webp"}, {"cycle_day": 3, "slot": 3, "difficulty": 3, "title": "Cannae Felaketini Gizlemek", "description": "\"Hannibal Cannae''de ordumuzu haritadan sildi. Bu haber Roma''ya ulaşırsa halk şehri terk eder ve devlet çöker. Savaş alanından kaçıp Senato''ya haber götürmeye çalışan o yaralı ulakları yolda bul ve sustur. Zaman kazanmalıyım.\"", "image": "imperial-missions/gun03-cannae-kart.webp", "detail_image": "imperial-missions/gun03-cannae-detay.webp"}, {"cycle_day": 4, "slot": 1, "difficulty": 1, "title": "Traianus Pazarında Hırsız Avı", "description": "Traianus Pazarının kalabalık koridorlarında imparatorluk mallarını çalan bir çete izini kaybettiriyor. Görevlendirdiğin gladyatörler tüccarların arasına karışıp hırsızların izini sürecek, elebaşını yakalayacak ve çalınan mühürlü sandığı saraya geri getirecek. Operasyon boyunca ekibin Ludustan uzakta olacak.", "image": "imperial-missions/gun04-kolay-traianus-kart.webp", "detail_image": "imperial-missions/gun04-kolay-traianus-detay.webp"}, {"cycle_day": 4, "slot": 2, "difficulty": 2, "title": "Portus Limanında Kaçakçılara Baskın", "description": "Portus limanında geceleri yüklenen gemilerde yasaklı mallar taşındığı bildirildi. Ekibin rıhtımdaki depoları gözleyecek, kaçakçıların sevkiyat saatini belirleyecek ve imparatorun emriyle sessiz bir baskın düzenleyecek. Güçlü bir ekip, muhafızların müdahalesini beklemeden kaçış yollarını kapatmalı.", "image": "imperial-missions/gun04-orta-portus-kart.webp", "detail_image": "imperial-missions/gun04-orta-portus-detay.webp"}, {"cycle_day": 4, "slot": 3, "difficulty": 3, "title": "Subura Hamamları Suikasti", "description": "Subura hamamlarında bir imparatorluk görevlisine karşı suikast planlandığına dair gizli bir haber ulaştı. Gladyatörlerin kalabalığın içine sızarak komplocuları izleyecek, hedefi güvenli bir çıkışa ulaştıracak ve saldırı gerçekleşmeden şebekeyi etkisiz hale getirecek. Sarayın en hassas emri için toplam gücü yüksek bir ekip gerekiyor.", "image": "imperial-missions/gun04-zor-subura-kart.webp", "detail_image": "imperial-missions/gun04-zor-subura-detay.webp"}]'::jsonb,(clock_timestamp()at time zone'Europe/Istanbul')::date,'[{"cycle_day": 1, "slot": 1, "difficulty": 1, "title": "Aventinus Tepesi Hırsızı", "description": "\"Bana muhalif bir pleb lideri, Aventinus Tepesi''ndeki evinde Senato yolsuzluklarımı içeren belgeler saklıyor. Evine sız, o parşömenleri çal ve yerine yasadışı büyü/tılsım malzemeleri bırak ki ertesi gün onu vatana ihanet ve cadılıkla suçlayabileyim.\"", "image": "imperial-missions/gun01-kolay-aventinus-kart.webp", "detail_image": "imperial-missions/gun01-kolay-aventinus-detay.webp"}, {"cycle_day": 1, "slot": 2, "difficulty": 2, "title": "Palmyra İsyan Tohumu", "description": "\"Palmyra''da Roma''ya sadık görünen yeni valinin aslında halkı örgütlediğini duydum. Valinin korumalarını aşarak yatak odasına sız. Duvara kanla yerel dilde isyan sloganları yaz ve valiyi öldürerek suçu radikal örgütlere yık; böylece şehre ordu sokma hakkım doğsun.\"", "image": "imperial-missions/gun01-orta-palmyra-kart.webp", "detail_image": "imperial-missions/gun01-orta-palmyra-detay.webp"}, {"cycle_day": 1, "slot": 3, "difficulty": 3, "title": "Nisibis Kuşatması / Sasaniler", "description": "\"Doğu sınırındaki Nisibis (Nusaybin) kalesi düşmek üzere. Sasanilerin kuşatma kulelerini koruyan nöbetçileri gizlilikle temizle, kulelerin ahşap ayaklarına zift dök ve hepsini ateşe vererek orduya zaman kazandır.\"", "image": "imperial-missions/gun01-zor-nisibis-kart.webp", "detail_image": "imperial-missions/gun01-zor-nisibis-detay.webp"}, {"cycle_day": 2, "slot": 1, "difficulty": 1, "title": "Hamamda Boğma", "description": "Caracalla Hamamları''nın buhar odasında (Sudatorium), imparatora suikast planlayan bir muhbiri, kaza süsü vererek suyun altında boğup öldürün.", "image": "imperial-missions/gun02-kolay-hamam-kart.webp", "detail_image": "imperial-missions/gun02-kolay-hamam-detay.webp"}, {"cycle_day": 2, "slot": 2, "difficulty": 2, "title": "Pompeii Vergi Kaçakçısı", "description": "\"Pompeii''deki zengin bir zeytinyağı tüccarı Senato''ya rüşvet vererek imparatorluk vergisinden kaçıyor. Evine hırsız kılığına girerek sız, gizli altın kasasını boşalt ve duvara ''Vergisini ödemeyenin sonu'' yazarak suçu yerel çetelere at.\"", "image": "imperial-missions/gun02-orta-pompeii-vergi-kart.webp", "detail_image": "imperial-missions/gun02-orta-pompeii-vergi-detay.webp"}, {"cycle_day": 2, "slot": 3, "difficulty": 3, "title": "Aktium Sabotajı", "description": "Aktium deniz savaşı başlamadan hemen önceki gece, Mark Antony ve Kleopatra’nın amiral gemisinin omurgasını ve kürek mekanizmalarını suyun altından sızarak sabote edin.", "image": "imperial-missions/gun02-zor-aktium-kart.webp", "detail_image": "imperial-missions/gun02-zor-aktium-detay.webp"}, {"cycle_day": 3, "slot": 1, "difficulty": 3, "title": "Masada Fedaileri", "description": "Dik yamaçtaki Masada Kalesi''nin düşmesini hızlandırmak için gece vakti uçurumlardan tırmanarak kaleye sızın ve içerideki direnişçilerin su sarnıçlarını zehirleyin.", "image": "imperial-missions/gun03-masada-kart.webp", "detail_image": "imperial-missions/gun03-masada-detay.webp"}, {"cycle_day": 3, "slot": 2, "difficulty": 3, "title": "Kudüs Yağması", "description": "General Titus’un ordusu Kudüs Tapınağı''na girerken, kaosun ortasında tapınağın altındaki kutsal altın şamdanı (Menora) askerlerden önce çalıp Roma’daki efendinize göndermek üzere kaçırın.", "image": "imperial-missions/gun03-kudus-kart.webp", "detail_image": "imperial-missions/gun03-kudus-detay.webp"}, {"cycle_day": 3, "slot": 3, "difficulty": 3, "title": "Cannae Felaketini Gizlemek", "description": "\"Hannibal Cannae''de ordumuzu haritadan sildi. Bu haber Roma''ya ulaşırsa halk şehri terk eder ve devlet çöker. Savaş alanından kaçıp Senato''ya haber götürmeye çalışan o yaralı ulakları yolda bul ve sustur. Zaman kazanmalıyım.\"", "image": "imperial-missions/gun03-cannae-kart.webp", "detail_image": "imperial-missions/gun03-cannae-detay.webp"}, {"cycle_day": 4, "slot": 1, "difficulty": 1, "title": "Traianus Pazarında Hırsız Avı", "description": "Traianus Pazarının kalabalık koridorlarında imparatorluk mallarını çalan bir çete izini kaybettiriyor. Görevlendirdiğin gladyatörler tüccarların arasına karışıp hırsızların izini sürecek, elebaşını yakalayacak ve çalınan mühürlü sandığı saraya geri getirecek. Operasyon boyunca ekibin Ludustan uzakta olacak.", "image": "imperial-missions/gun04-kolay-traianus-kart.webp", "detail_image": "imperial-missions/gun04-kolay-traianus-detay.webp"}, {"cycle_day": 4, "slot": 2, "difficulty": 2, "title": "Portus Limanında Kaçakçılara Baskın", "description": "Portus limanında geceleri yüklenen gemilerde yasaklı mallar taşındığı bildirildi. Ekibin rıhtımdaki depoları gözleyecek, kaçakçıların sevkiyat saatini belirleyecek ve imparatorun emriyle sessiz bir baskın düzenleyecek. Güçlü bir ekip, muhafızların müdahalesini beklemeden kaçış yollarını kapatmalı.", "image": "imperial-missions/gun04-orta-portus-kart.webp", "detail_image": "imperial-missions/gun04-orta-portus-detay.webp"}, {"cycle_day": 4, "slot": 3, "difficulty": 3, "title": "Subura Hamamları Suikasti", "description": "Subura hamamlarında bir imparatorluk görevlisine karşı suikast planlandığına dair gizli bir haber ulaştı. Gladyatörlerin kalabalığın içine sızarak komplocuları izleyecek, hedefi güvenli bir çıkışa ulaştıracak ve saldırı gerçekleşmeden şebekeyi etkisiz hale getirecek. Sarayın en hassas emri için toplam gücü yüksek bir ekip gerekiyor.", "image": "imperial-missions/gun04-zor-subura-kart.webp", "detail_image": "imperial-missions/gun04-zor-subura-detay.webp"}]'::jsonb);
select ludus_private.imperial_ensure_day((clock_timestamp()at time zone'Europe/Istanbul')::date);
commit;
