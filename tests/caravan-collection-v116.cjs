// Run the shipped SQL against PostgreSQL (PGlite), including permissions and replay.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),A=randomUUID(),B=randomUUID();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const migration=n=>read('supabase/migrations/'+fs.readdirSync(root+'/supabase/migrations').find(f=>f.endsWith('_'+n+'.sql')));
function fn(text,name){const escaped=name.replaceAll('.','\\.');const m=text.match(new RegExp('create or replace function '+escaped+'\\([^;]+?\\$\\$[\\s\\S]+?\\$\\$;','i'));assert.ok(m,name);return m[0];}
(async()=>{
 const db=new PGlite(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema ludus_private;
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt()to authenticated;
 create table ludus_accounts(user_id uuid primary key,gold bigint default 10000,diamonds integer default 0,stones_version integer default 0,ludus_name text default 'Test');
 create table ludus_gladiators(id uuid primary key default gen_random_uuid(),owner_id uuid references ludus_accounts(user_id),name text,class text);
 create table ludus_items(id uuid primary key default gen_random_uuid(),owner_id uuid,kind text,model text,enhancement integer default 0);
 create table ludus_shop_catalog(sku text primary key,name text,kind text,model text);
 create table ludus_stone_catalog(family text,stone_id integer);
 create table ludus_stones(owner_id uuid,family text,stone_id integer,quantity integer,primary key(owner_id,family,stone_id));
 insert into ludus_stone_catalog values('sapphire',1),('emerald',1),('ruby',1);`);
 const products={'gladius':['weapon','gladius'],'sica':['weapon','sica'],'scissor':['weapon','scissor'],'spear':['weapon','spear'],'trident':['weapon','trident'],'mace':['weapon','mace'],'whip':['weapon','whip'],'net':['weapon','net'],'shield-medium':['shield','round'],'shield-large':['shield','large'],'helmet-roman':['helmet','roman'],'helmet-gold':['helmet','gold'],'helmet-silver':['helmet','silver'],'helmet-winged':['helmet','winged'],'chest':['chest','gladiator_chest'],'chest-plate':['chest','chest_plate'],'gloves':['gloves','armor_shoulder'],'shoulder-armor':['gloves','shoulder_armor'],'legs':['legs','starter']};
 for(const [sku,[kind,model]]of Object.entries(products))await q('insert into ludus_shop_catalog values($1,$1,$2,$3)',[sku,kind,model]);
 const levels=read('ludus-level-v37.sql');await db.exec(levels.slice(levels.indexOf('create schema'),levels.indexOf('-- New EXP')));
 for(const name of ['level_deliver_gladiator','level_claim','level_state'])await db.exec(fn(levels,'ludus_private.'+name));
 await db.exec(fn(levels,'public.ludus_progress'));
 await db.exec('revoke all on function public.ludus_progress(text,integer)from public,anon;grant execute on function public.ludus_progress(text,integer)to authenticated');
 for(const name of ['dining_food_v55','dining_meals_v56','dining_nutrition_v57'])await db.exec(migration(name));
 await db.exec(fn(migration('dining_recovery_balance_v59'),'ludus_food_private.recovery_bonus_v59'));
 for(const name of ['menu_v55','combat_bonus_v60','api_v55'])await db.exec(fn(migration('combat_food_stamina_v60'),'ludus_food_private.'+name));
 await q('insert into ludus_accounts(user_id)values($1),($2)',[A,B]);
 await q("insert into ludus_gladiators(owner_id,name,class)values($1,'Tester','secutor')",[A]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q('select ludus_progress()');await q('select ludus_food_state()');
 // Seed a previously claimed level-five reward and previously purchased food.
 await q('update ludus_progression set experience=ludus_private.level_threshold(5)where owner_id=$1',[A]);
 await q('select ludus_progress()');await q('select ludus_progress(\'claim\',5)');
 const oldBuy=randomUUID();await q("select ludus_food_buy('bread',3,$1)",[oldBuy]);
 const goldBefore=(await q('select gold from ludus_accounts where user_id=$1',[A]))[0].gold;
 await db.exec(migration('gathering_v85'));
 await db.exec(migration('supply_auto_delivery_v87').split('-- Production scheduling:')[0]);
 // An old expedition survives the entitlement migration, including its exact cargo.
 await q("insert into ludus_supply_private.jobs(owner_id,destination,workers,started_at,ends_at,cargo)values($1,'iron',2,clock_timestamp(),clock_timestamp()+interval'1 hour','{\"iron\":24}')",[A]);
 const update=migration('caravan_collection_v116');await db.exec(update);await db.exec(update);
 assert.equal((await q('select gold from ludus_accounts where user_id=$1',[A]))[0].gold,goldBefore,'migration never reissues currency');
 const call=async(action='state',key=null,workers=1,id=randomUUID())=>(await q('select ludus_supply($1,$2,$3,$4)as s',[action,key,workers,id]))[0].s;
 const city=async(id)=>(await q('select ludus_caravan_city($1)as s',[id]))[0].s;
 await db.exec('set role authenticated');let s=await call();
 assert.equal(s.caravans,1);assert.equal(s.busy_caravans,2);assert.equal(s.free_caravans,0);assert.equal(s.jobs[0].cargo.iron,24);
 await assert.rejects(()=>call('send','grain'),/boş kervan/);
 await db.exec('reset role');await q("update ludus_supply_private.jobs set started_at=started_at-interval'2 hours',ends_at=ends_at-interval'2 hours'where owner_id=$1",[A]);
 for(const [level,count,next]of [[1,1,10],[9,1,10],[10,2,20],[19,2,20],[20,3,30],[30,4,40],[40,5,50],[49,5,50],[50,6,null]]){
  await q('update ludus_progression set experience=ludus_private.level_threshold($2)where owner_id=$1',[A,level]);
  await db.exec('set role authenticated');s=await call();assert.equal(s.caravans,count);assert.equal(s.free_caravans,count);assert.equal(s.next_caravan_level,next);
  const progress=(await q('select ludus_progress()as s'))[0].s;assert.equal(progress.caravans,count);assert.deepEqual(progress.rewards.filter(r=>r.caravans).map(r=>r.level),[10,20,30,40,50]);assert.ok(progress.rewards.every(r=>r.workers===0));
  await db.exec('reset role');
 }
 assert.equal((await q('select gold from ludus_accounts where user_id=$1',[A]))[0].gold,goldBefore,'automatic caravans do not claim unrelated rewards');
 await db.exec('set role authenticated');s=await call();assert.equal(s.resources.find(r=>r.sku==='iron').quantity,24);assert.equal(s.cities.length,60);
 await assert.rejects(()=>call('send','iron'),/şehir haritası/);
 await assert.rejects(()=>call('send','city-1'),/şehir haritası/);
 const request=randomUUID();s=await call('send','hunt',1,request);assert.deepEqual(s.jobs[0].cargo,{meat:15});
 const hunt=s.jobs[0];s=await call('send','hunt',1,request);assert.equal(s.jobs.length,1);assert.equal(s.result.replayed,true);
 await assert.rejects(()=>call('send','grain',1,request),/İşlem kimliği/);
 let quote=await city(1);assert.equal(quote.goods.length,5);assert.ok(quote.goods.every(g=>g.bar>=1&&g.bar<=10));
 const offer=quote.goods[0],key=[1,offer.sku,quote.epoch,15].join(':'),buyId=randomUUID();
 s=await call('buy',key,1,buyId);const purchased=s.jobs.find(j=>j.purchase),paid=s.result.cost;assert.deepEqual(purchased.cargo,{[offer.sku]:15});assert.equal(paid,Math.ceil(offer.unit_price*15));assert.equal(Number(s.gold),Number(goldBefore)-paid);
 s=await call('buy',key,1,buyId);assert.equal(s.jobs.length,2);assert.equal(s.result.replayed,true);assert.equal(Number(s.gold),Number(goldBefore)-paid);
 quote=await city(1);assert.equal(quote.goods[0].stock,offer.stock-15);
 await assert.rejects(()=>call('buy',[1,offer.sku,quote.epoch-1,15].join(':')),/süresi doldu/);
 await assert.rejects(()=>call('buy',[1,offer.sku,quote.epoch,16].join(':')),/en fazla 15/);
 await assert.rejects(()=>city(61),/bulunamadı/);
 await assert.rejects(()=>q('select * from ludus_supply_private.market_sales_v116'),/permission denied/);
 await assert.rejects(()=>q('select ludus_supply_private.offer_v116(1,\'iron\',1)'),/permission denied/);
 await assert.rejects(()=>q('select ludus_supply_private.worker_count($1)',[A]),/permission denied/);
 await db.exec('reset role');
 // Cumulative availability: 15 green, 20 at 9+, 30 at 8+; no city stays green next minute.
 for(let minute=100;minute<160;minute++){
  const rows=await q("select ludus_supply_private.offer_v116(id,'iron',$1)as o,ludus_supply_private.offer_v116(id,'iron',$1+1)as n from ludus_supply_private.cities_v116",[minute]);
  assert.equal(rows.filter(r=>r.o.bar===10).length,15);assert.equal(rows.filter(r=>r.o.bar>=9).length,20);assert.equal(rows.filter(r=>r.o.bar>=8).length,30);assert.ok(rows.every(r=>r.o.bar!==10||r.n.bar!==10));
 }
 // A second owner sees the global reservation but cannot claim the first owner's cargo.
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await db.exec('set role authenticated');let b=await call();assert.equal(b.caravans,1);assert.equal(b.jobs.length,0);await assert.rejects(()=>call('claim',purchased.id),/Sefer bulunamadı/);
 await db.exec('reset role');quote=await city(1);
 await q("insert into ludus_supply_private.market_sales_v116(epoch,city,sku,quantity)values($1,1,'iron',$2)on conflict(epoch,city,sku)do update set quantity=excluded.quantity",[quote.epoch,quote.goods[0].capacity-1]);
 await db.exec('set role authenticated');await assert.rejects(()=>call('buy',[1,'iron',quote.epoch,2].join(':')),/stok kalmadı/);assert.equal((await call()).jobs.length,0);
 await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q("update ludus_supply_private.jobs set started_at=started_at-interval'2 hours',ends_at=ends_at-interval'2 hours'where id=$1",[purchased.id]);
 await db.exec('set role authenticated');s=await call();assert.equal(s.resources.find(r=>r.sku==='iron').quantity,39);assert.equal(s.jobs.length,1);assert.equal(s.free_caravans,5);s=await call();assert.equal(s.resources.find(r=>r.sku==='iron').quantity,39,'delivery exactly once');
 fs.writeFileSync('/tmp/caravan-progress-v116.json',JSON.stringify((await q('select ludus_progress()as s'))[0].s));
 fs.writeFileSync('/tmp/caravan-state-v116.json',JSON.stringify(s));fs.writeFileSync('/tmp/caravan-quote-v116.json',JSON.stringify(await city(2)));
 await q(`select set_config('request.jwt.claims','{"is_anonymous":true}',false)`);await assert.rejects(()=>call(),/giriş yap/);await assert.rejects(()=>city(1),/giriş yap/);
 await db.exec('reset role;set role anon');await assert.rejects(()=>call(),/permission denied/);await assert.rejects(()=>city(1),/permission denied/);
 await db.close();console.log('V116 PASS: automatic 1–6 caravans, old cargo, 60 cities, 60s quotes, shared stock, transaction replay, ownership, capacity, automatic delivery and no duplicate currency.');
})().catch(e=>{console.error(e);process.exitCode=1;});
