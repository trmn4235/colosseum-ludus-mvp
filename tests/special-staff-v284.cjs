const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const migration=name=>fs.readFileSync(path.join(root,'supabase/migrations',fs.readdirSync(root+'/supabase/migrations').find(n=>n.endsWith('_'+name+'.sql'))),'utf8');
function fn(sql,name){const part=sql.slice(sql.indexOf('create or replace function '+name+'('));return part.slice(0,part.indexOf('$$;',part.indexOf('as $$'))+3);}
(async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema ludus_private;
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;
 create table ludus_accounts(user_id uuid primary key,gold bigint not null default 10000);
 create table ludus_gladiators(id uuid primary key default gen_random_uuid(),owner_id uuid references ludus_accounts(user_id));
 create table ludus_workers_v226(id uuid primary key default gen_random_uuid(),owner_id uuid references ludus_accounts(user_id),slot smallint);
 create table ludus_private.first_quest_marks_v111(owner_id uuid,quest text,subject text default '',primary key(owner_id,quest,subject));
 create function ludus_private.first_quest_add_v111(u uuid,q text,s text default '')returns void language sql as $$insert into ludus_private.first_quest_marks_v111 values(u,q,s)on conflict do nothing$$;`);
 for(const name of ['dining_food_v55','dining_meals_v56','dining_nutrition_v57'])await db.exec(migration(name));
 await db.exec("alter table ludus_food_catalog add column retired boolean not null default false;update ludus_food_catalog set retired=true where sku in('bread','meal');insert into ludus_food_catalog(sku,name,price,edible,sort_order,nutrition)values('olive_oil','Zeytinyağı',12,false,9,0);");
 await db.exec(fn(migration('dining_recovery_balance_v59'),'ludus_food_private.recovery_bonus_v59'));
 await db.exec(fn(migration('combat_food_stamina_v60'),'ludus_food_private.combat_bonus_v60'));
 await db.exec(migration('daily_kitchen_v265'));
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 await q('insert into ludus_accounts(user_id)values($1),($2)',[A,B]);await q('insert into ludus_gladiators(owner_id)select $1 from generate_series(1,10)',[A]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q('select ludus_food_state()');await q('update ludus_food_stock set quantity=100 where owner_id=$1',[A]);
 await db.exec(migration('special_staff_v284'));
 const state=async(role='trainer',page=0)=>(await q('select ludus_special_staff($1,$2)as s',[role,page]))[0].s;
 const read=async(role,lesson,request=randomUUID())=>(await q('select ludus_special_staff_read($1,$2,$3)as s',[role,lesson,request]))[0].s;
 await db.exec('set role authenticated');let s=await state();assert.equal(s.staff.length,6);assert(s.staff.every(x=>x.overall===0&&x.collected===0&&x.read===0&&x.total===500&&x.bonuses.length===0));
 await assert.rejects(()=>read('guard',1),/çantanda yok/);await assert.rejects(()=>state('intruder'),/geçersiz/);await assert.rejects(()=>state('cook',84),/geçersiz/);
 await assert.rejects(()=>db.exec('select * from ludus_staff_private.papyri_v284'),/permission denied/);
 await assert.rejects(()=>q('select ludus_staff_private.bonuses_v284($1,null)',[B]),/permission denied/);
 await db.exec('reset role');assert.equal((await q('select count(*)::int n from ludus_staff_private.lessons_v284'))[0].n,0,'cancelled skills are not silently reintroduced');
 // These catalogue entries exist ONLY in the test database, not the release.
 await db.exec("insert into ludus_staff_private.lessons_v284(role_id,lesson,title)select 'guard',n,'Örnek savunma dersi '||n from generate_series(1,500)n;insert into ludus_staff_private.effects_v284(role_id,lesson,effect_key,label,target,percent)select 'guard',n,'fixture_defense_attack','Kervan savunması saldırı bonusu','fixture_only',0.03 from generate_series(1,500)n;");
 await q("insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson)select $1,'guard',n from generate_series(1,26)n",[A]);
 await db.exec('set role authenticated');s=await state('guard');let guard=s.staff.find(x=>x.id==='guard');assert.equal(guard.collected,26);assert.equal(guard.overall,0);assert.equal(s.papyri.length,6);assert.equal((await state('guard',4)).papyri.length,2);
 const id=randomUUID();s=await read('guard',1,id);guard=s.staff.find(x=>x.id==='guard');assert.equal(guard.collected,26);assert.equal(guard.read,1);assert.equal(guard.overall,.2);assert.equal(guard.bonuses[0].percent,.03);
 s=await read('guard',1,id);assert.equal(s.reading.replayed,true);assert.equal(s.staff.find(x=>x.id==='guard').overall,.2);await assert.rejects(()=>read('guard',2,id),/farklı bir papirüs/);await assert.rejects(()=>read('guard',1),/zaten okundu/);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);s=await state('guard');assert.equal(s.paper_count,0);await assert.rejects(()=>read('guard',2),/çantanda yok/);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await assert.rejects(()=>state(),/Giriş/);await assert.rejects(()=>read('guard',2),/Giriş/);await q("select set_config('request.jwt.claims','{}',false)");
 await db.exec('reset role');await assert.rejects(()=>db.exec("insert into ludus_staff_private.lessons_v284 values('guard',501,'invalid')"),/check constraint/);
 await q("insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson)select $1,'guard',n from generate_series(27,500)n",[A]);
 await q('update ludus_staff_private.papyri_v284 set read_at=clock_timestamp()where owner_id=$1',[A]);await db.exec('set role authenticated');guard=(await state('guard')).staff.find(x=>x.id==='guard');assert.equal(guard.collected,500);assert.equal(guard.overall,100);assert.equal(guard.bonuses[0].percent,15);assert.equal((await state('guard',83)).papyri.length,2);
 const food=async()=>(await q('select ludus_food_state()as s'))[0].s;s=await food();assert.deepEqual(s.people,{gladiators:10,workers:8,specialists:6,total:24});assert.equal(s.crew_count,24);assert.equal(s.items.find(i=>i.sku==='grain').quantity,100);
 const req=randomUUID(),items=JSON.stringify([{sku:'grain',quantity:24}]);s=(await q('select ludus_food_serve($1,$2,$3,0)as s',[items,s.today,req]))[0].s;assert.equal(s.menu.coverage,100);assert.equal(s.items.find(i=>i.sku==='grain').quantity,76);assert.equal(s.combat.active_bonus,4);
 s=(await q('select ludus_food_serve($1,$2,$3,0)as s',[items,s.today,req]))[0].s;assert.equal(s.delivery.replayed,true);assert.equal(s.items.find(i=>i.sku==='grain').quantity,76);
 await assert.rejects(()=>q('select ludus_food_serve($1,$2,$3,1)',[JSON.stringify([{sku:'grain',quantity:1}]),s.today,randomUUID()]),/toplam kişi sayısı/);
 await db.exec('reset role');await q('insert into ludus_workers_v226(owner_id,slot)select $1,n from generate_series(1,8)n',[A]);await db.exec('set role authenticated');assert.equal((await food()).crew_count,24,'lazy roster creation does not double count people');
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);assert.equal((await food()).crew_count,14,'workers eat even without gladiators');
 await db.exec('reset role');await q("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');await assert.rejects(()=>state(),/permission denied/);await assert.rejects(()=>read('guard',1),/permission denied/);
 console.log('PASS V284: six zero-overall staff; cancelled catalogue empty; 26/500 received differs from reading; 0.03% precision; 500/100 cap; idempotent, owner-only learning; no direct grants; eight caravan workers plus six specialists in atomic, retry-safe kitchen servings.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
