const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant execute on function auth.jwt()to authenticated;
 grant usage on schema auth to authenticated;grant execute on function auth.uid()to authenticated;
 create table ludus_accounts(user_id uuid primary key,gold bigint not null default 10000);
 create table ludus_gladiators(id uuid primary key default gen_random_uuid(),owner_id uuid references ludus_accounts(user_id));`);
 const sql=fs.readFileSync(root+'/supabase/migrations/'+fs.readdirSync(root+'/supabase/migrations').find(f=>f.endsWith('_dining_food_v55.sql')),'utf8');await db.exec(sql);await db.exec(sql);
 await db.query('insert into ludus_accounts(user_id)values($1),($2)',[a,b]);await db.query('insert into ludus_gladiators(owner_id)values($1),($1)',[a]);
 const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const state=async()=> (await query('select ludus_food_state()as value'))[0].value;
 const buy=async(sku,n,request=randomUUID())=>(await query('select ludus_food_buy($1,$2,$3)as value',[sku,n,request]))[0].value;
 await query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('set role authenticated');
 let s=await state();assert.equal(s.crew_count,2);assert.equal(s.last_menu,null);assert.equal(s.items.every(i=>i.quantity===0),true);assert.equal(s.menu.morale,0);
 const id=randomUUID();s=await buy('grain',10,id);assert.equal(s.gold,9990);s=await buy('grain',10,id);assert.equal(s.gold,9990);assert.equal(s.purchase.replayed,true);assert.equal(s.items[0].quantity,10);
 await assert.rejects(()=>buy('grain',11,id),/İşlem kimliği/);await assert.rejects(()=>buy('grain',0),/1–5000/);await assert.rejects(()=>buy('invalid',1),/Gıda bulunamadı/);
 await assert.rejects(()=>db.query("update ludus_food_stock set quantity=50000"),/permission denied/);await assert.rejects(()=>db.query("select ludus_food_private.settle_v55($1,current_date+100)",[a]),/permission denied/);
 for(const sku of ['apple','fish','meat','beer'])await buy(sku,10);s=await state();assert.equal(s.menu.morale,100);assert.equal(s.menu.coverage,100);assert.equal(s.gold,9880);
 await db.exec('reset role');await db.exec("update ludus_food_house set settled_day=settled_day-3");await db.exec('set role authenticated');s=await state();assert.ok(s.items.every(i=>i.quantity===4));assert.equal(s.last_menu.morale,100);assert.equal(s.history[0].to_day,s.settled_day);const before=JSON.stringify(s.items);assert.equal(JSON.stringify((await state()).items),before);
 // Roster growth on a new day cannot charge the extra fighter for prior days.
 await db.exec('reset role');await db.exec("delete from ludus_food_history;update ludus_food_house set settled_day=settled_day-1");await query('insert into ludus_gladiators(owner_id)values($1)',[a]);await db.exec('set role authenticated');s=await state();assert.equal(s.crew_count,3);assert.ok(s.items.every(i=>i.quantity===2));assert.equal(s.history[0].crew_count,2);
 // Long absence is compressed by stock-depletion boundaries, never by 1000 daily loops.
 await db.exec('reset role');await db.exec("delete from ludus_food_history;update ludus_food_house set settled_day=settled_day-1000");await db.exec('set role authenticated');s=await state();assert.ok(s.items.every(i=>i.quantity===0));assert.equal(s.last_menu.morale,0);assert.ok(s.history.length<12);
 await buy('beer',3);s=await state();assert.equal(s.menu.coverage,0);assert.equal(s.menu.morale,0);await buy('grain',1);s=await state();assert.equal(s.menu.coverage,33.3);assert.ok(s.menu.morale<50);
 // A failed purchase cannot debit the wallet or increment stock.
 await db.exec('reset role');await query('update ludus_accounts set gold=0 where user_id=$1',[a]);await db.exec('set role authenticated');const stockBefore=(await state()).items;await assert.rejects(()=>buy('meat',3),/Denarius yetersiz/);assert.deepEqual((await state()).items,stockBefore);
 await query("select set_config('request.jwt.claim.sub',$1,false)",[b]);s=await state();assert.equal(s.crew_count,0);assert.equal(s.menu.morale,null);assert.equal((await query('select count(*)::int as n from ludus_food_orders'))[0].n,0);assert.equal((await query('select count(*)::int as n from ludus_food_stock'))[0].n,5);
 await query("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await assert.rejects(()=>state(),/Giriş gerekiyor/);assert.equal((await query('select count(*)::int as n from ludus_food_stock'))[0].n,0);await query("select set_config('request.jwt.claims','{}',false)");await db.exec('reset role');await query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>state(),/Giriş gerekiyor/);await db.exec('set role anon');await assert.rejects(()=>state(),/permission denied/);await db.close();console.log(JSON.stringify({migrationRepeatable:true,retrySafe:true,atomicPurchase:true,offlineDays:1000,rosterHistory:true,partialMeals:true,beerDoesNotFeed:true,ownerIsolation:true,privateClock:true}));
})().catch(e=>{console.error(e);process.exit(1)});
