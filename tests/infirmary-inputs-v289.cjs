// Exercise the real V118→V268 supply/worker fixture, then the V289 input migration.
// Reuse the fixture through a final test callback; no production RPC is mocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const inputs=[['beeswax','Balmumu',2],['laurel','Defne',1],['honey','Bal',3],['fig','İncir',2],['wine_vinegar','Şarap sirkesi',1],['sponge','Doğal sünger',2]],ids=inputs.map(x=>x[0]);
function frontends(professions){
 const context=vm.createContext({});vm.runInContext(read('ludus-supply-v85.js'),context);
 const atlas=JSON.parse(JSON.stringify(vm.runInContext('LudusSupply.atlas',context)));
 assert.equal(atlas.length,22);assert.equal(new Set(atlas.map(x=>x.id)).size,22);
 assert.deepEqual(new Set(atlas.map(x=>x.sku||x.id)),new Set(professions),'all database sources have a map entry');
 assert.equal(new Set(atlas.map(x=>x.at.join(':'))).size,22,'no source overlaps another source');
 assert.equal(new Set(atlas.map(x=>x.at[0])).size,6);assert.equal(new Set(atlas.map(x=>x.at[1])).size,4);
 assert.ok(atlas.every(x=>x.at.every(n=>n>0&&n<100)),'all source positions remain inside the map');
 for(const file of ['ludus-workers-v226.js','ludus-clan-workers-v232.js','ludus-clan-caravans-v268.js','ludus-work-map-v260.js']){
  const text=read(file),match=text.match(/const labels=(\{[^;]+\});/);assert.ok(match,file+' labels');
  const labels=vm.runInNewContext('('+match[1]+')');
  assert.deepEqual(new Set(Object.keys(labels)),new Set(professions),file+' covers every selectable source');
  for(const id of ids)assert.ok(typeof labels[id]==='string'&&labels[id]!==id,file+' localized '+id);
 }
 for(const [file,name]of [['ludus-supply-v85.js','professions'],['ludus-clan-caravans-v268.js','places']]){
  const match=read(file).match(new RegExp('const '+name+'=(\\{[^;]+\\});'));assert.ok(match,file+' '+name);
  assert.deepEqual(new Set(Object.keys(vm.runInNewContext('('+match[1]+')'))),new Set(professions),file+' '+name+' has no stale whitelist');
 }
}
async function run(env){
 const {db,q,migration,randomUUID,owners,work,roster,supply,identify,admin,reject,routeFor}=env,owner=owners[0];
 await admin();
 const balanceSnapshot=async()=>(await q(`select jsonb_build_object(
  'stock',(select jsonb_agg(s order by owner_id,sku)from ludus_supply_private.stock s),
  'food',(select jsonb_agg(s order by owner_id,sku)from public.ludus_food_stock s),
  'money',(select jsonb_agg(s order by user_id)from(select user_id,gold,diamonds from public.ludus_accounts)s),
  'skills',(select jsonb_agg(s order by worker_id,sku)from ludus_worker_private.skills_v227 s)) s`))[0].s;
 const functionSnapshot=async()=>q(`select n.nspname,p.proname,pg_get_functiondef(p.oid) definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='ludus_worker_private' and p.proname in('license_yield_v255','deliver_licensed_owner_v255','clan_tick_v232','caravan_fill_v268','clan_work_v232','caravan_depart_v227'))
   or(n.nspname='public' and p.proname in('ludus_supply','ludus_worker_caravan_depart_v227','ludus_clan_work_v232')) order by n.nspname,p.proname,p.oid`);
 const before=await balanceSnapshot(),definitions=await functionSnapshot();assert.ok(definitions.length>=7);
 const oldResources=await q('select * from ludus_supply_private.resources order by sku');
 const oldRecipes=await q('select * from ludus_supply_private.production_recipes_v118 order by sku');
 await db.exec(migration('infirmary_inputs_v289'));
 assert.deepEqual(await balanceSnapshot(),before,'catalog addition never grants, resets or debits inventory, money or worker skills');
 assert.deepEqual(await functionSnapshot(),definitions,'licensed/purchase functions and parameters remain unchanged');
 assert.deepEqual(await q('select * from ludus_supply_private.resources where not(sku=any($1::text[])) order by sku',[ids]),oldResources,'old catalogue rows remain unchanged');
 assert.deepEqual(await q('select * from ludus_supply_private.production_recipes_v118 order by sku'),oldRecipes,'input registration does not alter old recipes');
 const resources=await q('select sku,name,food,stage,active from ludus_supply_private.resources where sku=any($1::text[]) order by sku',[ids]);
 assert.equal(resources.length,6);
 for(const [id,name,price]of inputs){
  assert.deepEqual(resources.find(x=>x.sku===id),{sku:id,name,food:false,stage:'raw',active:true});
  const market=(await q('select base_price,active from ludus_supply_private.market_goods_v116 where sku=$1',[id]))[0];
  assert.equal(Number(market.base_price),price);assert.equal(market.active,true);
 }
 const professions=await q('select sku from ludus_worker_private.professions_v227 order by sort_order');assert.equal(professions.length,22);
 assert.equal((await q('select count(*)::int n from ludus_supply_private.market_goods_v116 where active'))[0].n,22);
 frontends(professions.map(x=>x.sku));
 const rates=(await q('select ludus_worker_private.license_yield_v255(n) y from generate_series(5,10)n')).map(x=>x.y);
 assert.deepEqual(rates.map(x=>x.net),[8,12,16,16,20,24]);assert.ok(rates.every(x=>x.gross===x.tax+x.net&&x.tax*5===x.gross));
 await identify(owner);let state=await work();assert.equal(state.config.duration_minutes,360);assert.equal(state.config.team_limit,10);assert.equal(state.config.tax_percent,20);
 assert.equal((await supply()).caravan_capacity,10);assert.equal((await supply()).shopping_seconds,10800);
 assert.equal((await roster()).professions.length,22);assert.ok((await roster()).workers.every(w=>w.skills.length===22));
 const held=async(who,sku)=>Number((await q('select quantity from ludus_supply_private.stock where owner_id=$1 and sku=$2',[who,sku]))[0]?.quantity||0);
 let delivered=0,purchased=0;
 for(const [sku]of inputs){
  await identify(owner);state=await work();const worker=state.workers.find(w=>!w.busy).id;
  const request=randomUUID(),payload={sku,workers:[worker]};state=await work('create',payload,request);const jobId=state.result_job_id;
  assert.equal((await work('create',payload,request)).result_job_id,jobId,'collection request retry reuses one job');
  await admin();await q("update ludus_worker_private.caravan_lobbies_v268 set created_at=clock_timestamp()-interval '20 seconds' where job_id=$1",[jobId]);
  await q('select ludus_worker_private.caravan_fill_v268(clock_timestamp())');await identify(owner);
  const job=(await work()).jobs.find(j=>j.id===jobId);assert.equal(job.status,'collecting');assert.equal(job.worker_count,10);
  assert.equal(Date.parse(job.ends_at)-Date.parse(job.started_at),21600000);
  assert.ok(job.participants.every(p=>p.quantity===8&&p.gross_quantity===10&&p.tax_quantity===2),'new source uses existing floor-level yield');
  await admin();const amounts=await q('select owner_id,sum(quantity)::int net from ludus_worker_private.clan_work_people_v232 where job_id=$1 group by owner_id',[jobId]);
  const heldBefore=new Map();for(const a of amounts)heldBefore.set(a.owner_id,await held(a.owner_id,sku));
  const taxBefore=Number((await q('select quantity from ludus_worker_private.state_collections_v255 where sku=$1',[sku]))[0]?.quantity||0);
  await q('select ludus_worker_private.clan_tick_v232(clock_timestamp())');assert.equal(await held(owner,sku),heldBefore.get(owner),'no early delivery');
  await q("update ludus_worker_private.clan_work_jobs_v232 set started_at=clock_timestamp()-interval '6 hours',ends_at=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
  await q('select ludus_worker_private.clan_tick_v232(clock_timestamp())');await q('select ludus_worker_private.clan_tick_v232(clock_timestamp())');
  for(const a of amounts)assert.equal(await held(a.owner_id,sku),heldBefore.get(a.owner_id)+a.net,'net '+sku+' delivered once to its owner');
  assert.equal(Number((await q('select quantity from ludus_worker_private.state_collections_v255 where sku=$1',[sku]))[0].quantity),taxBefore+20,'one 20% collection tax');
  assert.equal((await q('select count(*)::int n from public.ludus_food_stock where sku=$1',[sku]))[0].n,0,'medical production input does not create a dining stock');
  delivered++;
  await identify(owner);const buy=async(key,id=randomUUID())=>(await q("select public.ludus_worker_caravan_depart_v227('buy',$1,1,$2,array[$3]::uuid[],0,0,'{}'::uuid[]) s",[key,id,worker]))[0].s;
  const routeTooLarge=await routeFor(sku,11);await reject(()=>buy(routeTooLarge),/10 birim/);
  const key=await routeFor(sku,10),buyRequest=randomUUID(),gold=Number((await supply()).gold);
  const bought=await buy(key,buyRequest),trip=bought.jobs.find(j=>j.id===bought.result.job_id);
  assert.equal(trip.cargo[sku],10);assert.equal(Date.parse(trip.ends_at)-Date.parse(trip.started_at),10800000);assert.ok(Number(bought.gold)<gold);
  assert.equal((await buy(key,buyRequest)).result.job_id,trip.id);
  await admin();const balance=await held(owner,sku);
  await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '3 hours',ends_at=clock_timestamp()-interval '1 second' where id=$1",[trip.id]);
  await identify(owner);await roster();await roster();await admin();assert.equal(await held(owner,sku),balance+10,'purchase '+sku+' delivered once');
  purchased++;
 }
 assert.equal(delivered,6);assert.equal(purchased,6);
 console.log('V289 infirmary inputs PASS: six registered materials/professions/active prices, all 22 map and worker/clan labels, unchanged balances/functions/old recipes, six real licensed deliveries and purchases, 20% tax, 6h/3h/10-unit limits and replay.');
}
module.exports=run;
if(require.main===module){
 const last=require.resolve('./clan-caravans-v268.cjs'),previous=require(last);
 require.cache[last].exports=async env=>{await previous(env);await run(env);};
 process.env.LUDUS_CARAVAN_COMBAT_TEST='1';
 require('./production-v119.cjs');
}
