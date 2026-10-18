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
 create table ludus_shop_catalog(sku text primary key,name text,kind text,model text,price integer default 100,category text);
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

 await db.exec(migration('caravan_collection_v116'));
 const before=(await q('select gold from ludus_accounts where user_id=$1',[A]))[0].gold;
 await db.exec(migration('production_items_v118'));
 await q("insert into ludus_supply_private.stock(owner_id,sku,quantity)values($1,'wooden_handle',7)on conflict(owner_id,sku)do update set quantity=7",[A]);
 const update=migration('production_items_v119');await db.exec(update);await db.exec(update);
 assert.equal((await q("select quantity from ludus_supply_private.stock where owner_id=$1 and sku='wooden_handle'",[A]))[0].quantity,7,'retired stock retained');
 await q('update ludus_progression set experience=ludus_private.level_threshold(30)where owner_id=$1',[A]);
 if(process.env.LUDUS_MARKET_HISTORY_TEST||process.env.LUDUS_CARAVAN_LOADOUT_TEST)await db.exec(migration('market_history_v121'));
 const initialItems=(await q('select count(*)::integer n from ludus_items where owner_id=$1',[A]))[0].n;
 const catalog=require('../ludus-production-v119.js');
 const call=async(action='state',key=null,id=randomUUID())=>(await q('select ludus_supply($1,$2,1,$3)as s',[action,key,id]))[0].s;
 const stock=async(sku)=>(await call()).resources.find(r=>r.sku===sku).quantity;
 await db.exec('set role authenticated');let s=await call();
 assert.equal(s.resources.length,29);assert.equal(s.recipes.length,33);
 assert.equal(s.jobs[0].cargo.iron,24,'old cargo is unchanged');
 assert.equal(Number(s.gold),Number(before),'no money minted');
 assert.equal(s.recipes.filter(r=>r.sku==='gladius').length,1);
 assert.deepEqual(s.recipes.find(r=>r.sku==='gladius').ingredients,{steel:2,leather:1,wood:1});
 assert.ok(s.recipes.every(r=>r.output_quantity===(r.sku==='arrow'?50:1)));
 assert.ok(s.recipes.every(r=>Object.values(r.ingredients).every(n=>Number.isInteger(n)&&n>0)));
 assert.ok(!s.resources.some(r=>r.sku==='salt'));

 assert.deepEqual(new Set(s.recipes.map(r=>r.sku)),new Set(catalog.recipes.map(r=>r.sku)));
 for(const r of s.recipes)assert.deepEqual(r.ingredients,catalog.recipes.find(c=>c.sku===r.sku).ingredients,r.sku+' client/server recipe');
 for(const sku of ['iron','copper','tin','lead','bronze','steel'])assert.ok(s.resources.some(r=>r.sku===sku),sku+' ingot exists');
 assert.deepEqual(s.recipes.find(r=>r.sku==='bronze').ingredients,{copper:3,tin:1,charcoal:1});
 for(const sku of catalog.retired){assert.ok(!s.resources.some(r=>r.sku===sku));await assert.rejects(()=>call('craft',sku),/tarifi bulunamadı/);}
 assert.ok(s.recipes.every(r=>!Object.keys(r.ingredients).some(k=>catalog.retired.includes(k))));
 assert.equal(s.recipes.find(r=>r.sku==='manica').model,'manica');
 assert.equal(catalog.skuForItem({kind:'gloves',model:'manica'}),'manica');
 const city=(await q('select ludus_caravan_city(1)as s'))[0].s;
 if(process.env.LUDUS_MARKET_HISTORY_TEST){
  assert.equal(city.interval_seconds,900);assert.equal(city.epoch,Math.floor(Date.parse(city.server_now)/900000));assert.equal(Date.parse(city.expires_at),(city.epoch+1)*900000);
  for(const g of city.goods){assert.equal(g.history.points.length,1);assert.ok(Date.parse(g.history.points[0].at)>=Date.parse(g.history.started_at));assert.equal(g.history.points[0].price,g.unit_price);assert.equal(Date.parse(g.history.day_end)-Date.parse(g.history.day_start),86400000);}
  await db.exec('reset role');await q("update ludus_supply_private.market_clock_v121 set started_at=clock_timestamp()-interval'48 hours'");await db.exec('set role authenticated');
  const day=(await q('select ludus_caravan_city(1)as s'))[0].s;for(const g of day.goods){assert.equal(g.history.points.length,96);for(let i=1;i<96;i++)assert.equal(Date.parse(g.history.points[i].at)-Date.parse(g.history.points[i-1].at),900000);assert.equal(g.history.points.at(-1).price,g.unit_price);assert.ok(g.history.points.every(p=>Date.parse(p.at)<=Date.parse(day.server_now)));}
  fs.writeFileSync('/tmp/market-history-v121.json',JSON.stringify(day));
  await assert.rejects(()=>q('select * from ludus_supply_private.market_clock_v121'),/permission denied/);
  const h=day.goods.find(g=>g.sku==='iron_ore');await assert.rejects(()=>call('buy',[1,h.sku,day.epoch-1,1].join(':')),/süresi doldu/);
  await db.exec('reset role');const epoch=BigInt(day.epoch),def=(await q("select pg_get_functiondef('ludus_supply_private.api(text,text,integer,uuid)'::regprocedure) s"))[0].s;assert.ok(def.includes('/900'));assert.ok(!def.includes('/60)'));
  const prices=await q('select ludus_supply_private.market_price_v121(1,1,1.5,$1::bigint) p,ludus_supply_private.market_price_v121(1,1,1.5,$1::bigint) p2',[String(epoch)]);assert.equal(prices[0].p,prices[0].p2);const boundaries=await q("select ludus_supply_private.market_price_v121(1,1,1.5,floor(extract(epoch from t)/900)::bigint) p from(values(timestamptz'2026-10-18 00:00:00Z'),(timestamptz'2026-10-18 00:14:59Z'),(timestamptz'2026-10-18 00:15:00Z')) v(t)");assert.equal(boundaries[0].p,boundaries[1].p);assert.notEqual(boundaries[1].p,boundaries[2].p);await db.exec('set role authenticated');
 }
 assert.deepEqual(new Set(city.goods.map(g=>g.sku)),new Set(catalog.raw.map(r=>r[0])));
 await assert.rejects(()=>call('buy',[1,'iron',city.epoch,1].join(':')),/bulunamadı/);
 await assert.rejects(()=>q('select * from ludus_supply_private.production_recipes_v118'),/permission denied/);
 await assert.rejects(()=>call('craft','charcoal'),/malzemelerin eksik/);
 await db.exec('reset role');
 // Walk a complete chain from purchased raw inputs to one steel Gladius.
 for(const [sku,quantity]of Object.entries({iron_ore:4,wood:9,hide:1}))await q('update ludus_supply_private.stock set quantity=$3 where owner_id=$1 and sku=$2',[A,sku,quantity]);
 await db.exec('set role authenticated');
 for(let i=0;i<4;i++)await call('craft','charcoal');
 for(let i=0;i<2;i++)await call('craft','iron');
 for(let i=0;i<2;i++)await call('craft','steel');
 await call('craft','leather');
 const craftId=randomUUID();s=await call('craft','gladius',craftId);const item=s.result.item_id;
 assert.equal(s.result.quantity,1);assert.ok(item);
 for(const sku of ['iron_ore','wood','hide','charcoal','iron','steel','leather'])assert.equal(await stock(sku),0,sku+' consumed exactly once');
 s=await call('craft','gladius',craftId);assert.equal(s.result.item_id,item);assert.equal(s.result.replayed,true);
 await assert.rejects(()=>call('craft','sica',craftId),/başka bir işlemde/);
 await db.exec('reset role');assert.equal((await q('select count(*)::integer n from ludus_items where owner_id=$1',[A]))[0].n,initialItems+1);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await db.exec('set role authenticated');assert.equal(await stock('steel'),0);await assert.rejects(()=>call('craft','gladius'),/malzemelerin eksik/);
 await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 // A late missing ingredient rolls back earlier debits.
 await q("update ludus_supply_private.stock set quantity=3 where owner_id=$1 and sku='wood'",[A]);await q("update ludus_supply_private.stock set quantity=2 where owner_id=$1 and sku='rope'",[A]);
 await db.exec('set role authenticated');await assert.rejects(()=>call('craft','bow'),/malzemelerin eksik/);assert.equal(await stock('wood'),3);assert.equal(await stock('rope'),2);
 await db.exec('reset role');await q("update ludus_supply_private.stock set quantity=1 where owner_id=$1 and sku='resin'",[A]);await db.exec('set role authenticated');
 const bowId=randomUUID();s=await call('craft','bow',bowId);assert.equal(await stock('bow'),1);assert.equal(s.result.quantity,1);await call('craft','bow',bowId);assert.equal(await stock('bow'),1);
 // Arrow packs are the only multi-output recipe, with capacity rollback.
 await db.exec('reset role');for(const [sku,n]of Object.entries({wood:5,iron:1,rope:1,arrow:49975}))await q('update ludus_supply_private.stock set quantity=$3 where owner_id=$1 and sku=$2',[A,sku,n]);await db.exec('set role authenticated');
 await assert.rejects(()=>call('craft','arrow'),/deposu dolu/);assert.equal(await stock('wood'),5);assert.equal(await stock('arrow'),49975);
 await db.exec('reset role');await q("update ludus_supply_private.stock set quantity=0 where owner_id=$1 and sku='arrow'",[A]);await db.exec('set role authenticated');
 const arrowId=randomUUID();s=await call('craft','arrow',arrowId);assert.equal(s.result.quantity,50);assert.equal(await stock('arrow'),50);await call('craft','arrow',arrowId);assert.equal(await stock('arrow'),50);
 // API permissions and schema validation prevent fractional or public minting.
 await db.exec('reset role');await assert.rejects(()=>q("update ludus_supply_private.production_recipes_v118 set ingredients='{\"wood\":0.5}' where sku='bow'"),/check constraint/);
 await assert.rejects(()=>q("update ludus_supply_private.production_recipes_v118 set output_quantity=2 where sku='bow'"),/check constraint/);
 await db.exec('set role authenticated');await q(`select set_config('request.jwt.claims','{"is_anonymous":true}',false)`);await assert.rejects(()=>call(),/giriş yap/);await q(`select set_config('request.jwt.claims','{}',false)`);

 // Manufacture every recipe once from exact sufficient stock, checking all debits and outputs.
 await db.exec('reset role');
 for(const r of catalog.resources)await q('update ludus_supply_private.stock set quantity=1000 where owner_id=$1 and sku=$2',[A,r.sku]);
 await db.exec('set role authenticated');
 for(const recipe of catalog.recipes){
  const beforeState=await call(),before=new Map(beforeState.resources.map(r=>[r.sku,r.quantity]));
  const request=randomUUID(),after=await call('craft',recipe.sku,request);
  assert.equal(after.result.quantity,recipe.output_quantity,recipe.sku+' yield');
  for(const [sku,n]of Object.entries(recipe.ingredients))assert.equal(after.resources.find(r=>r.sku===sku).quantity,before.get(sku)-n,recipe.sku+' consumes '+sku);
  if(recipe.output_type==='resource')assert.equal(after.resources.find(r=>r.sku===recipe.sku).quantity,before.get(recipe.sku)+recipe.output_quantity);
  else{await db.exec('reset role');const [item]=await q('select kind,model from ludus_items where id=$1',[after.result.item_id]);assert.equal(item.kind,recipe.kind);assert.equal(item.model,recipe.model);await db.exec('set role authenticated');}
  assert.equal((await call('craft',recipe.sku,request)).result.replayed,true);
 }
 if(process.env.LUDUS_CARAVAN_LOADOUT_TEST)await require('./production-loadout-v122.cjs')({db,q,A,B,call,stock,migration,randomUUID});
 fs.writeFileSync('/tmp/production-state-v119.json',JSON.stringify(await call()));

 await db.exec('reset role;set role anon');await assert.rejects(()=>call(),/permission denied/);
 await db.close();console.log('V119 PASS: all 33 recipes and exact debits, 6 ingots, separate manica, inactive assembly parts, integer inputs, one steel Gladius, raw-to-item chain, 50 arrows only, replay, ownership, rollback, capacity, legacy cargo and currency preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
