const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixtureDatabase,A,B}=require('./online-projectiles-v76.cjs'),rows=require('../assets/equipment-v198/build-report.json').items;
const migration=n=>fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_'+n+'.sql')),'utf8');
(async()=>{const db=await fixtureDatabase();try{
 await require('./combat-motion-sql-v163.cjs').install(db);await db.exec('alter table public.ludus_items add column if not exists created_at timestamptz default now()');
 await db.exec('create table if not exists public.ludus_shop_catalog(sku text primary key,name text,kind text,model text,price integer,category text);create table ludus_supply_private.production_recipes_v118(sku text primary key,name text,kind text,model text,ingredients jsonb,output_type text,output_quantity int,sort_order int);create table ludus_supply_private.recipes(sku text primary key,ingredients jsonb);');
 for(const name of ['gladiator_equipment_v49','equipment_groups_v168','halberd_v193','arm_equipment_v196','selected_shields_v198','selected_shields_v198'])await db.exec(migration(name));
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 for(const row of rows){
  // A completed battle can injure its fighter; keep the six equipment cases independent.
  const glad=(await q("insert into ludus_gladiators(owner_id,name,class,status,base_stats,stat_version)values($1,'Shield tester','murmillo','available',$2,7)returning id",[A,{health:50,strength:50,defense:50,agility:50,speed:50,conditioning:50}]))[0].id;
  const recipe=(await q('select * from ludus_supply_private.production_recipes_v118 where sku=$1',[row.sku]))[0];assert.equal(recipe.model,row.id);assert.equal(recipe.output_quantity,1);assert.equal((await q('select subcategory from ludus_shop_catalog where sku=$1',[row.sku]))[0].subcategory,row.group);
  const item=(await q("insert into ludus_items(owner_id,kind,model)values($1,'shield',$2)returning id",[A,row.id]))[0].id;await q('select ludus_equip_item($1,$2,$3)',[glad,'off_hand',item]);
  await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await assert.rejects(()=>q('select ludus_equip_item($1,$2,$3)',[glad,'off_hand',item]));await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
  const ticket=(await q("select ludus_start_battle_v2($1,'4x5',$2,$3) r",[glad,{off_hand:item},randomUUID()]))[0].r;assert.equal(ticket.snapshot.items.find(i=>i.id===item).model,row.id);
  const loot=(await q('select loot from ludus_battles where id=$1',[ticket.id]))[0].loot,token=loot.find(i=>i.inventory_id===item).token;await q("update ludus_battles set started_at=now()-interval '30 seconds' where id=$1",[ticket.id]);
  const stats={alive:true,kills:15,seconds:30,exit_slots:{off_hand:token}},finish=async()=>(await q('select ludus_finish_battle_v2($1,true,$2) r',[ticket.id,stats]))[0].r;const result=await finish();assert.deepEqual(await finish(),result);
  assert.deepEqual((await q('select model,equipped_slot,locked_battle_id from ludus_items where id=$1',[item]))[0],{model:row.id,equipped_slot:'off_hand',locked_battle_id:null});
 }
 console.log('V198 SQL PASS: six idempotent registrations, ownership checks, off-hand equip, exact battle entry/exit and result replay.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
