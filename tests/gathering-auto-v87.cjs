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
 const v87=migration('supply_auto_delivery_v87').split('-- Production scheduling:')[0];await db.exec(v87);await db.exec(v87);await db.exec(migration('supply_delivery_history_index_v87'));await db.exec(migration('supply_delivery_history_index_v87'));
 const call=async(action='state',key=null,workers=1,id=randomUUID())=>(await q('select ludus_supply($1,$2,$3,$4)as s',[action,key,workers,id]))[0].s;
 const mature=async(id)=>{await db.exec('reset role');await q("update ludus_supply_private.jobs set started_at=started_at-interval'2 hours',ends_at=ends_at-interval'2 hours'where id=$1",[id]);await db.exec('set role authenticated');};
 await db.exec('set role authenticated');let s=await call();assert.equal(s.automatic_delivery,true);
 await assert.rejects(()=>q('select ludus_supply_private.settle_owner_v87($1,clock_timestamp())',[B]),/permission denied/);
 await assert.rejects(()=>q('select ludus_supply_private.deliver_due_v87(100)'),/permission denied/);
 const send=randomUUID();s=await call('send','iron',1,send);const job=s.jobs[0];s=await call();assert.equal(s.jobs.length,1);assert.equal(s.free_workers,0);assert.equal(s.resources.find(r=>r.sku==='iron').quantity,0,'no early delivery');
 await mature(job.id);await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);s=await call();assert.equal(s.deliveries.length,0,'other account cannot see cargo');await assert.rejects(()=>call('claim',job.id),/Sefer bulunamadı/);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);s=await call();assert.equal(s.jobs.length,0);assert.equal(s.deliveries.length,1);assert.equal(s.free_workers,1);assert.equal(s.resources.find(r=>r.sku==='iron').quantity,12);
 await call('claim',job.id);s=await call('send','iron',1,send);assert.equal(s.result.replayed,true);assert.equal(s.jobs.length,0);assert.equal(s.resources.find(r=>r.sku==='iron').quantity,12,'manual and send retries never duplicate delivery');
 s=await call('send','hunt');const mixed=s.jobs[0];await mature(mixed.id);await db.exec('reset role');await q("update ludus_supply_private.stock set quantity=50000 where owner_id=$1 and sku='leather'",[A]);const meatBefore=(await q("select quantity from ludus_food_stock where owner_id=$1 and sku='meat'",[A]))[0].quantity;
 await db.exec('set role authenticated');s=await call();assert.equal(s.jobs.length,1);assert.ok(s.jobs[0].delivery_check_at);assert.equal(s.resources.find(r=>r.sku==='meat').quantity,meatBefore,'mixed cargo never partly delivered');assert.equal(s.free_workers,0);
 await db.exec('reset role');await q("update ludus_supply_private.stock set quantity=0 where owner_id=$1 and sku='leather'",[A]);await db.exec('set role authenticated');s=await call();assert.equal(s.jobs.length,0);assert.equal(s.free_workers,1);assert.equal(s.resources.find(r=>r.sku==='leather').quantity,6);assert.equal(s.resources.find(r=>r.sku==='meat').quantity,meatBefore+8);
 s=await call('send','grain');const offline=s.jobs[0];await mature(offline.id);await db.exec('reset role');await q("select set_config('request.jwt.claim.sub','',false)");assert.equal((await q('select ludus_supply_private.deliver_due_v87(100)as n'))[0].n,1,'cron works without a player JWT');assert.equal((await q('select ludus_supply_private.deliver_due_v87(100)as n'))[0].n,0,'cron replay is idempotent');
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);await db.exec('set role authenticated');s=await call();assert.equal(s.resources.find(r=>r.sku==='grain').quantity,24);assert.equal(s.free_workers,1);
 // Nutrition is settled before adding new food; a delayed delivery cannot rewrite old days.
 s=await call('send','fish');await mature(s.jobs[0].id);await db.exec('reset role');await q('update ludus_food_stock set quantity=0 where owner_id=$1',[A]);await q("update ludus_food_house set settled_day=(clock_timestamp()at time zone'Europe/Istanbul')::date-3 where owner_id=$1",[A]);await q('select ludus_supply_private.deliver_due_v87(100)');assert.equal((await q("select quantity from ludus_food_stock where owner_id=$1 and sku='fish'",[A]))[0].quantity,12);assert.equal((await q("select last_menu->>'available_units' as units from ludus_food_house where owner_id=$1",[A]))[0].units,'0');
 await db.exec('set role authenticated');await q("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>call(),/giriş yap/);
 await db.close();console.log('V87 SQL PASS: automatic state/cron delivery; no early arrival; free workers; retry idempotency; owner isolation; private helper ACLs; atomic full-capacity cargo; later retry; offline nutrition ordering.');
})().catch(e=>{console.error(e);process.exitCode=1;});
