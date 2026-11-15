const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
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
 create table ludus_private.first_quest_marks_v111(owner_id uuid,quest text,subject text default '',primary key(owner_id,quest,subject));
 create function ludus_private.first_quest_add_v111(u uuid,q text,s text default '')returns void language sql as $$insert into ludus_private.first_quest_marks_v111 values(u,q,s)on conflict do nothing$$;`);
 for(const name of ['dining_food_v55','dining_meals_v56','dining_nutrition_v57'])await db.exec(migration(name));
 await db.exec("alter table ludus_food_catalog add column retired boolean not null default false;update ludus_food_catalog set retired=true where sku in('bread','meal');insert into ludus_food_catalog(sku,name,price,edible,sort_order,nutrition)values('olive_oil','Zeytinyağı',12,false,9,0);");
 await db.exec(fn(migration('dining_recovery_balance_v59'),'ludus_food_private.recovery_bonus_v59'));
 await db.exec(fn(migration('combat_food_stamina_v60'),'ludus_food_private.combat_bonus_v60'));
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 await q('insert into ludus_accounts(user_id)values($1),($2)',[A,B]);await q('insert into ludus_gladiators(owner_id)select $1 from generate_series(1,10)',[A]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q('select ludus_food_state()');await q('update ludus_food_stock set quantity=100 where owner_id=$1',[A]);
 await db.exec('update ludus_food_house set settled_day=settled_day-7');
 const kitchen=migration('daily_kitchen_v265');await db.exec(kitchen);await db.exec(kitchen);
 const state=async()=>(await q('select ludus_food_state()as s'))[0].s;
 let s=await state();const today=s.today;
 const serve=async(items,revision,request=randomUUID(),day=today)=>(await q('select ludus_food_serve($1,$2,$3,$4)as s',[JSON.stringify(items),day,request,revision]))[0].s;
 const items=o=>Object.entries(o).map(([sku,quantity])=>({sku,quantity}));
 await db.exec('set role authenticated');s=await state();assert.equal(s.items.find(i=>i.sku==='grain').quantity,100,'cutover preserves all stock');assert.equal(s.menu.coverage,0);assert.equal(s.combat.active_bonus,0,'stock alone gives no bonus');assert.deepEqual(s.kitchen.ingredients,[]);
 const id=randomUUID();s=await serve(items({grain:2,apple:2,fish:2,meat:2,egg:2}),0,id);
 assert.equal(s.menu.portions,10);assert.equal(s.menu.coverage,100);assert.equal(s.menu.variety,100);assert.equal(s.combat.active_bonus,12,'bonus starts immediately');assert.equal(s.kitchen.revision,1);assert.equal(s.items.find(i=>i.sku==='grain').quantity,98);assert.equal(s.kitchen.ingredients.length,5);
 const spent=JSON.stringify(s.items);s=await serve(items({egg:2,meat:2,fish:2,apple:2,grain:2}),0,id);assert.equal(s.delivery.replayed,true);assert.equal(JSON.stringify(s.items),spent,'reordered retry consumes once');
 await assert.rejects(()=>serve(items({grain:1}),0,id),/İşlem kimliği/);
 await assert.rejects(()=>serve(items({beer:1}),0),/başka bir oturum/);
 await assert.rejects(()=>serve(items({grain:1}),1),/gladyatör sayısı/);
 s=await serve(items({beer:3,olive_oil:2}),1);assert.equal(s.kitchen.revision,2);assert.equal(s.menu.portions,10);assert.equal(s.menu.coverage,100);assert.equal(s.combat.active_bonus,12);
 for(const bad of [null,{},[],items({grain:0}),items({grain:-1}),items({grain:1.5}),items({grain:5001}),items({unknown:1}),[{sku:'grain',quantity:'1'}],[{sku:'grain',quantity:1},{sku:'grain',quantity:1}]])await assert.rejects(()=>serve(bad,2));
 await assert.rejects(()=>serve(items({beer:8}),2),/kişi başına/);
 await assert.rejects(()=>db.exec('update ludus_food_stock set quantity=9999'),/permission denied/);
 await assert.rejects(()=>db.exec('select * from ludus_food_private.kitchen_days_v265'),/permission denied/);
 await assert.rejects(()=>q('select ludus_food_private.settle_v55($1,current_date+1)',[A]),/permission denied/);
 await db.exec('reset role');assert.equal((await q("select count(*)::int n from ludus_private.first_quest_marks_v111 where owner_id=$1 and quest='food_day'",[A]))[0].n,1);
 // Moving the day forward clears effects without touching the pantry.
 const stockBefore=JSON.stringify((await state()).items.map(i=>[i.sku,i.quantity]));
 await q('update ludus_food_private.kitchen_days_v265 set day=day-1 where owner_id=$1',[A]);await db.exec('update ludus_food_house set settled_day=settled_day-1000');
 await db.exec('set role authenticated');s=await state();assert.equal(s.menu.coverage,0);assert.equal(s.combat.active_bonus,0);assert.equal(s.kitchen.revision,0);assert.equal(JSON.stringify(s.items.map(i=>[i.sku,i.quantity])),stockBefore,'absence never auto-consumes');
 await assert.rejects(()=>serve(items({grain:1}),0,randomUUID(),'2000-01-01'),/Gün değişti/);
 // A historical receipt is still safe after midnight.
 await db.exec('reset role');await q('update ludus_food_private.kitchen_receipts_v265 set day=day-1 where owner_id=$1 and request_id=$2',[A,id]);const yesterday=(await q("select ((clock_timestamp()at time zone'Europe/Istanbul')::date-1)::text d"))[0].d;await db.exec('set role authenticated');
 s=await serve(items({grain:2,apple:2,fish:2,meat:2,egg:2}),0,id,yesterday);assert.equal(s.delivery.replayed,true);assert.equal(s.menu.coverage,0);
 // Partial food and insufficient inventory are atomic; buying does not feed.
 s=await serve(items({grain:3}),0);assert.equal(s.menu.coverage,30);assert.equal(s.combat.active_bonus,0);
 await db.exec('reset role');await q("update ludus_food_stock set quantity=0 where owner_id=$1 and sku='apple'",[A]);await db.exec('set role authenticated');
 const unchanged=JSON.stringify((await state()).items);await assert.rejects(()=>serve(items({fish:2,apple:1}),1),/envanterde/);assert.equal(JSON.stringify((await state()).items),unchanged);
 s=(await q('select ludus_food_buy($1,$2,$3)as s',['apple',7,randomUUID()]))[0].s;assert.equal(s.menu.coverage,30);assert.equal(s.items.find(i=>i.sku==='apple').quantity,7);
 s=await serve(items({apple:7}),1);assert.equal(s.menu.coverage,100);assert.equal(s.combat.active_bonus,4,'two types out of five');
 await db.exec('reset role');await q('insert into ludus_gladiators(owner_id)values($1)',[A]);await db.exec('set role authenticated');s=await state();assert.equal(s.menu.coverage,90.9);assert.equal(s.combat.active_bonus,0,'new gladiator needs a portion');s=await serve(items({fish:1}),2);assert.equal(s.menu.coverage,100);assert.equal(s.combat.active_bonus,8);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);s=await state();assert.equal(s.crew_count,0);assert.equal(s.menu.coverage,0);assert.deepEqual(s.kitchen.ingredients,[]);await assert.rejects(()=>serve(items({grain:1}),0),/gladyatör yok/);
 await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await assert.rejects(()=>state(),/Giriş/);await assert.rejects(()=>serve(items({grain:1}),0),/Giriş/);await db.exec('reset role;set role anon');await assert.rejects(()=>state(),/permission denied/);await assert.rejects(()=>serve(items({grain:1}),0),/permission denied/);await db.exec('reset role');
 const context={};vm.runInNewContext(fs.readFileSync(root+'/daily-kitchen-v265.js','utf8'),context);
 for(const crew of [0,1,2,5,10,12])for(const stock of [{},{grain:1},{beer:2},{olive_oil:2},{grain:2,apple:1},{grain:2,apple:2,fish:2,meat:2,egg:2},{bread:1,grain:1,meal:1}]){const list=items(stock),js=context.LudusFood.menu(crew,list),sql=(await q('select ludus_food_private.menu_v265($1,$2)as m',[crew,JSON.stringify(list)]))[0].m;for(const k of ['portions','types','variety','coverage','quality'])assert.equal(js[k],sql[k],k+' parity');assert.equal(js.goal,sql.variety_goal);}
 console.log('PASS V265: daily manual servings, immediate bonus, two meters, stock preservation, midnight, no offline consumption, retry safety, concurrent revision guards, stock atomicity, roster changes, tutorial and owner/anonymous permissions; 42 client/server menu comparisons.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
