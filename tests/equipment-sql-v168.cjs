const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {fixtureDatabase,players,setMatch,call,A,B}=require('./online-projectiles-v76.cjs');
const {runtime,item}=require('./combat-stats-v73.cjs');
const file=fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(f=>f.endsWith('_equipment_groups_v168.sql')),sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8');
(async()=>{const db=await fixtureDatabase();try{
 await require('./combat-motion-sql-v163.cjs').install(db);
 await db.exec("create table if not exists public.ludus_shop_catalog(sku text primary key,name text,kind text,model text,price integer,category text);create table ludus_supply_private.production_recipes_v118(sku text primary key,name text,kind text,model text,ingredients jsonb,output_type text,output_quantity int,sort_order int);create table ludus_supply_private.recipes(sku text primary key,ingredients jsonb);");
 await db.exec(sql);await db.exec(sql);
 const c=runtime();let cases=0;
 for(const weapon of ['mace','heavy_mace','warhammer'])for(const model of ['large','round','small'])for(const perfect of [false,true]){
  let rows=await players(db,weapon);rows[1].z=1;rows[1].items=[item(c,'shield',{model,id:'shield',equipped_slot:'off_hand'})];rows[1].block=true;
  for(let n=1;n<=2;n++){
   const at=new Date(Date.now()+n*3000).toISOString();Object.assign(rows[0],{hp:100,strike_at:at,strike_weapon:weapon,strike_target:B,strike_region:'chest',swing_at:new Date(Date.parse(at)-500).toISOString(),stagger_until:null,recoil_until:null});Object.assign(rows[1],{stamina:100,block:true,guard_at:perfect?new Date(Date.parse(at)-100).toISOString():null});
   rows=(await db.query('select private.ludus_resolve_combat_v36($1,$2) p',[rows,at])).rows[0].p;
   assert.equal(rows[1].items.some(i=>i.kind==='shield'),n===1,weapon+model+n);
   assert.equal(rows[1].hp,100);assert.ok(Number.isFinite(rows[1].maxHp));assert.ok(Number.isFinite(rows[1].stamina));
   assert.deepEqual((await db.query('select private.ludus_resolve_combat_v36($1,$2) p',[rows,at])).rows[0].p,rows,'duplicate resolve cannot count again');
  }
  assert.equal(rows[1].broken_items.length,1);assert.equal(rows[1].gear_serial,1);assert.equal(rows[1].block,false);cases++;
 }
 for(const weapon of ['heavy_mace','warhammer']){const rows=await players(db,weapon);rows[1].z=1;await setMatch(db,rows);const state=await call(db,A,'step',{attack:true,attack_id:weapon,target:B});assert.equal(state.players[0].strike_weapon,weapon);assert.equal(state.players[0].wind,weapon==='warhammer'?.44:.40);}
 const rows=await players(db,'gladius');rows[1].items=[item(c,'shield',{id:'s'})];const unchanged=(await db.query('select private.ludus_shield_impact_v168($1,$2) p',[rows[1],'gladius'])).rows[0].p;assert.deepEqual(unchanged,JSON.parse(JSON.stringify(rows[1])));
 const grants=(await db.query("select has_function_privilege('authenticated','private.ludus_shield_impact_v168(jsonb,text)','execute') a,has_function_privilege('anon','private.ludus_shield_impact_v168(jsonb,text)','execute') b")).rows[0];assert.deepEqual(grants,{a:false,b:false});
 console.log('V168 SQL PASS: '+cases+' two-hit cases, shield sizes, perfect guards, replay protection, timings, private permissions, idempotent migration.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
