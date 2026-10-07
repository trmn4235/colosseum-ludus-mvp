begin;
create schema if not exists ludus_private;
revoke all on schema ludus_private from public,anon,authenticated;
create table if not exists public.ludus_imperial_admins(user_id uuid primary key references public.ludus_accounts(user_id));
create table if not exists public.ludus_imperial_weeks(start_date date primary key,draft jsonb not null,updated_at timestamptz not null default now());
create table if not exists public.ludus_imperial_catalog(id uuid primary key default gen_random_uuid(),day date not null,slot integer not null check(slot between 1 and 3),title text not null check(length(title) between 4 and 120),description text not null check(length(description) between 20 and 1800),image text not null,unique(day,slot));
create table if not exists public.ludus_imperial_assignments(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.ludus_accounts(user_id),mission_id uuid not null references public.ludus_imperial_catalog(id),mission jsonb not null,gladiators jsonb not null,started_at timestamptz not null default clock_timestamp(),ends_at timestamptz not null,completed_at timestamptz,claimed_at timestamptz,rewards jsonb,unique(owner_id,mission_id));
create table if not exists public.ludus_imperial_members(assignment_id uuid not null references public.ludus_imperial_assignments(id),gladiator_id uuid not null references public.ludus_gladiators(id),active boolean not null default true,primary key(assignment_id,gladiator_id));
create unique index if not exists ludus_imperial_one_active on public.ludus_imperial_members(gladiator_id)where active;
create index if not exists ludus_imperial_owner on public.ludus_imperial_assignments(owner_id,ends_at);
alter table public.ludus_imperial_admins enable row level security;
alter table public.ludus_imperial_weeks enable row level security;
alter table public.ludus_imperial_catalog enable row level security;
alter table public.ludus_imperial_assignments enable row level security;
alter table public.ludus_imperial_members enable row level security;
revoke all on public.ludus_imperial_admins,public.ludus_imperial_weeks,public.ludus_imperial_catalog,public.ludus_imperial_assignments,public.ludus_imperial_members from anon,authenticated;
create or replace function ludus_private.imperial_settle(p_owner uuid)returns void language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if auth.uid() is null or auth.uid()<>p_owner then raise exception 'Giriş gerekiyor.';end if;
 for r in select id from public.ludus_imperial_assignments where owner_id=p_owner and completed_at is null and ends_at<=clock_timestamp()order by ends_at for update loop
  update public.ludus_gladiators set status='available'where owner_id=p_owner and status='locked'and id in(select gladiator_id from public.ludus_imperial_members where assignment_id=r.id and active);
  update public.ludus_imperial_members set active=false where assignment_id=r.id;
  update public.ludus_imperial_assignments set completed_at=ends_at where id=r.id;
 end loop;
end;$$;
revoke all on function ludus_private.imperial_settle(uuid)from public,anon,authenticated;
create or replace function ludus_private.imperial(p_action text default 'state',p_mission uuid default null,p_gladiators uuid[] default '{}',p_assignment uuid default null,p_week date default null,p_entries jsonb default null)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();today date:=(clock_timestamp()at time zone'Europe/Istanbul')::date; c public.ludus_imperial_catalog;a public.ludus_imperial_assignments;g record;ids uuid[];crew jsonb:='[]';total integer:=0;required integer;hours integer;v_diamonds integer;counts integer[];v_family text;stone integer;reward jsonb:='[]';entry jsonb;i integer;j integer;day_index integer;slot_index integer;is_admin boolean;
begin
 if u is null or not exists(select 1 from public.ludus_accounts where user_id=u)then raise exception 'Hesabına giriş yap.';end if;
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
   required:=case c.slot when 1 then 50 when 2 then 150 else 250 end;hours:=case c.slot when 1 then 12 when 2 then 18 else 24 end;
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
   slot_index:=(a.mission->>'slot')::integer;v_diamonds:=case slot_index when 1 then 2 when 2 then 3 else 5 end;counts:=case slot_index when 1 then array[1,0,0]when 2 then array[0,2,0]else array[1,1,2]end;
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
 elsif p_action in('admin_state','save_draft','publish_week')then
  if not is_admin then raise exception 'Yönetici yetkisi gerekiyor.';end if;
  if p_week is null then raise exception 'Haftanın başlangıç tarihini seç.';end if;
  if p_action in('save_draft','publish_week')then
   if jsonb_typeof(p_entries)is distinct from 'array'or jsonb_array_length(p_entries)<>21 then raise exception 'Hafta tam 21 görevden oluşmalı.';end if;
   if p_week<today-6 or p_week>today+365 then raise exception 'Geçerli bir yayın haftası seç.';end if;
   for i in 0..20 loop
    entry:=p_entries->i;
    if jsonb_typeof(entry)is distinct from 'object'or length(coalesce(entry->>'title',''))>120 or length(coalesce(entry->>'description',''))>1800 or length(coalesce(entry->>'image',''))>500 then raise exception 'Görev metni veya görseli geçersiz.';end if;
    if p_action='publish_week'then
     if length(trim(coalesce(entry->>'title','')))<4 or length(trim(coalesce(entry->>'description','')))<20 or coalesce(entry->>'image','')!~'^(imperial-[a-z0-9-]+\.webp|https://[^[:space:]]+)$'then raise exception '% numaralı görevin başlık, açıklama ve görselini tamamla.',i+1;end if;
     day_index:=i/3;slot_index:=i%3+1;
     insert into public.ludus_imperial_catalog(day,slot,title,description,image)values(p_week+day_index,slot_index,trim(entry->>'title'),trim(entry->>'description'),entry->>'image')on conflict(day,slot)do update set title=excluded.title,description=excluded.description,image=excluded.image;
    end if;
   end loop;
   insert into public.ludus_imperial_weeks(start_date,draft)values(p_week,p_entries)on conflict(start_date)do update set draft=excluded.draft,updated_at=clock_timestamp();
  end if;
  return jsonb_build_object('is_admin',true,'week',p_week,'entries',coalesce((select draft from public.ludus_imperial_weeks where start_date=p_week),'[]'::jsonb));
 elsif p_action<>'state'then raise exception 'Geçersiz işlem.';end if;
 return jsonb_build_object('today',today,'server_now',clock_timestamp(),'is_admin',is_admin,'missions',coalesce((select jsonb_agg(to_jsonb(x)order by slot)from public.ludus_imperial_catalog x where day=today),'[]'::jsonb),'assignments',coalesce((select jsonb_agg(to_jsonb(x)order by started_at desc)from public.ludus_imperial_assignments x where owner_id=u and((mission->>'day')::date=today or claimed_at is null)),'[]'::jsonb),'gladiators',coalesce((select jsonb_agg(to_jsonb(x)order by name)from public.ludus_gladiators x where owner_id=u),'[]'::jsonb));
end;$$;
revoke all on function ludus_private.imperial(text,uuid,uuid[],uuid,date,jsonb)from public,anon;
revoke all on function ludus_private.imperial(text,uuid,uuid[],uuid,date,jsonb)from authenticated;
create or replace function public.ludus_imperial(p_action text default 'state',p_mission uuid default null,p_gladiators uuid[] default '{}',p_assignment uuid default null,p_week date default null,p_entries jsonb default null)returns jsonb language sql security definer set search_path='' as $$select ludus_private.imperial(p_action,p_mission,p_gladiators,p_assignment,p_week,p_entries);$$;
revoke all on function public.ludus_imperial(text,uuid,uuid[],uuid,date,jsonb)from public,anon;
grant execute on function public.ludus_imperial(text,uuid,uuid[],uuid,date,jsonb)to authenticated;
-- Releasing a completed mission happens before the existing roster/training RPC too.
do $$begin
 if to_regprocedure('public.ludus_training_state()')is not null and to_regprocedure('public.ludus_training_state_pre_imperial_v31()')is null then
  alter function public.ludus_training_state()rename to ludus_training_state_pre_imperial_v31;
 end if;
end$$;
revoke all on function public.ludus_training_state_pre_imperial_v31()from public,anon,authenticated;
create or replace function public.ludus_training_state()returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid()is null then raise exception 'Giriş gerekiyor.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,31));perform ludus_private.imperial_settle(auth.uid());
 return public.ludus_training_state_pre_imperial_v31();
end;$$;
revoke all on function public.ludus_training_state()from public,anon;
grant execute on function public.ludus_training_state()to authenticated;
insert into public.ludus_imperial_catalog(day,slot,title,description,image)values
 ((clock_timestamp()at time zone'Europe/Istanbul')::date,1,'Traianus Pazarında Hırsız Avı','Traianus Pazarının kalabalık koridorlarında imparatorluk mallarını çalan bir çete izini kaybettiriyor. Görevlendirdiğin gladyatörler tüccarların arasına karışıp hırsızların izini sürecek, elebaşını yakalayacak ve çalınan mühürlü sandığı saraya geri getirecek. Operasyon boyunca ekibin Ludustan uzakta olacak.','imperial-trajan-v31.webp'),
 ((clock_timestamp()at time zone'Europe/Istanbul')::date,2,'Portus Limanında Kaçakçılara Baskın','Portus limanında geceleri yüklenen gemilerde yasaklı mallar taşındığı bildirildi. Ekibin rıhtımdaki depoları gözleyecek, kaçakçıların sevkiyat saatini belirleyecek ve imparatorun emriyle sessiz bir baskın düzenleyecek. Güçlü bir ekip, muhafızların müdahalesini beklemeden kaçış yollarını kapatmalı.','imperial-portus-v31.webp'),
 ((clock_timestamp()at time zone'Europe/Istanbul')::date,3,'Subura Hamamları Suikasti','Subura hamamlarında bir imparatorluk görevlisine karşı suikast planlandığına dair gizli bir haber ulaştı. Gladyatörlerin kalabalığın içine sızarak komplocuları izleyecek, hedefi güvenli bir çıkışa ulaştıracak ve saldırı gerçekleşmeden şebekeyi etkisiz hale getirecek. Sarayın en hassas emri için toplam gücü yüksek bir ekip gerekiyor.','imperial-subura-v31.webp')on conflict(day,slot)do nothing;
commit;
-- First administrator is deliberately NOT selected automatically. After verifying
-- the intended owner's UUID, the project owner runs:
-- insert into public.ludus_imperial_admins(user_id)values('VERIFIED-OWNER-UUID')on conflict do nothing;
