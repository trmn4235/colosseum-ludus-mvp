const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {runtime,fixture,item}=require('./combat-stats-v73.cjs');
const {fixtureDatabase,players,A,B,setMatch,call}=require('./online-projectiles-v76.cjs');
const dir=path.join(__dirname,'../supabase/migrations'),read=s=>fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>f.endsWith(s))),'utf8');
function local(){
 const c=runtime();vm.runInContext(fs.readFileSync(path.join(__dirname,'../combat-specials-v261.js'),'utf8'),c);c.HandSpecials.install(c.ArenaCombat);
 assert.equal(c.HandSpecials.kind({model:'gladius'}),'double');assert.equal(c.HandSpecials.kind({model:'heavy_mace',pit_model:'pit_axe'}),'sweep');assert.equal(c.HandSpecials.kind({model:'bow'}),null);
 for(const index of [0,1]){const {sim,a,v}=fixture(c);Object.assign(a,{weapon:index?null:'gladius',offhand:index?'sica':null,stamina:100});v.z=1;v.hp=v.maxHp=1000;sim.lockedTarget=v.id;
  assert.equal(sim.special(0,index),true);assert.equal(a.stamina,87);assert.equal(sim.special(0,index),false);const hand=index?'offhand':'weapon';assert.ok(a[hand]);
  for(let n=0;n<80;n++)sim.tick(.01,{});assert.equal(a.stamina,80.5);assert.equal(sim.stats.hits,2);assert.ok(v.hp<1000);assert.ok(a[hand]);
 }
 for(const index of [0,1]){const {sim,a,v}=fixture(c);Object.assign(a,{weapon:index?'trident':'net',leftGear:index?'net':null,shield:false});v.z=2;sim.lockedTarget=v.id;assert.equal(sim.special(0,index),true);for(let n=0;n<50;n++)sim.tick(.01,{});assert.equal(a.stamina,74);assert.equal(sim.nets.length,1);assert.equal(sim.nets[0].hand,index);}
 {const {sim,a,v}=fixture(c);v.z=1;a.stamina=19;assert.equal(sim.special(0,0),false);assert.equal(a.stamina,19);}
 {const {sim,a,v}=fixture(c);v.z=1;a.shield=true;a.shieldHeldBy=null;assert.equal(sim.specialKind(a,1),'bash');assert.equal(sim.special(0,1),true);assert.equal(a.stamina,74);for(let n=0;n<40;n++)sim.tick(.01,{});assert.equal(v.action,'knocked');}
 for(const weapon of ['mace','heavy_mace','warhammer']){const {sim,a,v}=fixture(c);Object.assign(a,{weapon});Object.assign(v,{z:1,shield:true,shieldHeldBy:null,blocking:true,guardInput:true,guardPressedAt:-99});assert.equal(sim.shieldBreakerHit(a,v),false);assert.equal(sim.special(0,0),true);sim.time=.36;sim.tick(.01,{});assert.equal(v.shield,false,weapon);assert.equal(a.stamina,74);}
 {const {sim,a,v}=fixture(c);Object.assign(a,{weapon:'halberd'});v.z=1.4;const t=sim.fighters[6],ally=sim.fighters[1],third=sim.fighters[7];for(const [f,x,z]of [[t,.8,1.5],[third,-.9,1.5],[ally,.4,1.4]])Object.assign(f,{hp:1000,maxHp:1000,x,z,cooldown:999,action:'idle',shield:false});v.hp=v.maxHp=1000;sim.lockedTarget=v.id;assert.equal(sim.special(0),true);sim.time=.36;sim.tick(.01,{});assert.ok(v.hp<1000);assert.ok(t.hp<1000);assert.equal(third.hp,1000);assert.equal(ally.hp,1000);}
 console.log('PASS local: both hands, two sword hits, 13 + 6.5 stamina, shield bash, active shield break, two-enemy sweep.');
}
async function sql(){const db=await fixtureDatabase();try{
 await require('./combat-motion-sql-v163.cjs').install(db);
 await db.exec("create table public.ludus_shop_catalog(sku text primary key,name text,kind text,model text,price integer,category text);create table ludus_supply_private.production_recipes_v118(sku text primary key,name text,kind text,model text,ingredients jsonb,output_type text,output_quantity int,sort_order int);create table ludus_supply_private.recipes(sku text primary key,ingredients jsonb);create schema ludus_ranked_match_private;alter table public.ludus_matches add column if not exists venue text default 'colosseum';");
 await db.exec(read('_equipment_groups_v168.sql'));
 const rank=read('_ranked_match_v248.sql'),latency=read('_ranked_latency_v252.sql');
 const at=rank.indexOf('CREATE OR REPLACE FUNCTION ludus_ranked_match_private.resolve_combat_v248');await db.exec(rank.slice(at,rank.indexOf('create table ludus_ranked_match_private.live_ratings',at)));
 await db.exec(latency.slice(latency.indexOf('create or replace function ludus_ranked_match_private.apply_input_v252'),latency.indexOf('do $patch$')));
 const pack=latency.indexOf('create or replace function public.ludus_ranked_match_v252');await db.exec(latency.slice(pack));
 await db.exec(read('_hand_specials_v261.sql'));
 const ts='2026-11-11T00:00:00Z',time=ms=>new Date(Date.parse(ts)+ms).toISOString();
 const begin=async(rows,cmd,ms=0)=>(await db.query('select private.ludus_begin_special_v261($1,0,$2,$3) p',[rows,{special:true,special_id:'test',hand:'main_hand',target:B,...cmd},time(ms)])).rows[0].p;
 const resolve=async(rows,ms)=>(await db.query('select private.ludus_resolve_special_v261($1,$2) p',[rows,time(ms)])).rows[0].p;
 const base=async(w='gladius',hand='main_hand')=>{const rows=await players(db,w,hand);rows[1].z=1;for(const p of rows)p.career={version:162,kills:0,deaths:0,damage:0,damageTaken:0};return rows;};
 for(const hand of ['main_hand','off_hand']){let rows=await base('gladius',hand);rows=await begin(rows,{hand});assert.equal(rows[0].stamina,87);assert.equal(rows[0].items.length,1);assert.deepEqual(await begin(rows,{hand}),rows);rows=await resolve(rows,180);assert.equal(rows[1].hit_serial,1);rows=await resolve(rows,520);assert.equal(rows[1].hit_serial,2);assert.equal(rows[0].stamina,80.5);assert.deepEqual(await resolve(rows,800),rows);}
 {let rows=await base();rows[0].stamina=19;assert.equal((await begin(rows,{}))[0].stamina,19);assert.equal((await begin(rows,{}))[0].special_v261,undefined);}
 {let rows=await base();rows[0].items.push(item(runtime(),'shield'));rows=await begin(rows,{});rows=await resolve(rows,800);rows=await begin(rows,{hand:'off_hand',special_id:'left'},1000);assert.equal(rows[0].special_v261.kind,'bash');assert.ok(rows[0].special_ready_v261.main_hand);assert.ok(rows[0].special_ready_v261.off_hand);rows=await resolve(rows,1400);assert.ok(rows[1].knocked_until);}
 for(const w of ['mace','heavy_mace','warhammer']){let rows=await base(w);rows[1].items=[item(runtime(),'shield')];rows[1].block=true;rows=await resolve(await begin(rows,{}),360);assert.equal(rows[1].shield_broken,true);assert.equal(rows[1].items.length,0);assert.equal(rows[1].hp,100);}
 {let rows=await base('halberd');const original=structuredClone(rows[1]);rows[0].ranked_team='a';rows[1].ranked_team='b';for(let n=2;n<=4;n++)rows.push({...original,owner:'00000000-0000-4000-8000-00000000000'+n+1,x:(n-1)*.4,ranked_team:n===3?'a':'b'});rows=await resolve(await begin(rows,{}),360);assert.equal(rows[1].hit_serial,1);assert.equal(rows[2].hit_serial,1);assert.equal(rows[3].hp,100);assert.equal(rows[4].hp,100);}
 {let rows=await base('net','off_hand');rows=await begin(rows,{hand:'off_hand'});const miss=structuredClone(rows);miss[1].x=1.2;assert.equal((await resolve(miss,1000))[1].net_until,undefined);rows=await resolve(rows,1000);assert.ok(rows[1].net_until);assert.equal(rows[0].stamina,74);}
 {let rows=await base('whip');rows=await resolve(await begin(rows,{}),360);assert.equal(rows[1].pull_from,A);}
 {let rows=await base('spear');rows=await begin(rows,{});assert.equal(rows[0].items.length,0);assert.equal(rows[0].projectile.weapon,'spear');assert.equal(rows[0].projectile.base,30);assert.equal(rows[0].stamina,74);}
 {let rows=await base();rows[0].ranked_team=rows[1].ranked_team='a';assert.equal((await begin(rows,{}))[0].special_v261,undefined);rows[1].ranked_team='b';rows[1].z=6;assert.equal((await begin(rows,{}))[0].special_v261,undefined);}
 {let rows=await base();rows=await begin(rows,{});rows[0].stagger_until=time(2000);assert.equal((await resolve(rows,600))[1].hp,100);}
 // Real input handler must not execute the retired sword throw or a simultaneous normal attack.
 {let rows=await base();rows[0].ranked_team='a';rows[1].ranked_team='b';rows=(await db.query('select ludus_ranked_match_private.apply_input_v252($1,0,$2,$3) p',[rows,{special:true,special_id:'via-input',hand:'main_hand',target:B,attack:true,attack_id:'also-attack'},ts])).rows[0].p;assert.equal(rows[0].special_v261.kind,'double');assert.equal(rows[0].items.length,1);assert.equal(rows[0].stamina,87);assert.equal(rows[0].strike_at,null);}
 {let rows=await base();await setMatch(db,rows);const r=await call(db,A,'step',{special:true,special_id:'public-rpc',hand:'main_hand',target:B});assert.equal(r.players[0].special_v261.kind,'double');assert.equal(r.players[0].items.length,1);}
 const permissions=(await db.query("select has_function_privilege('authenticated','private.ludus_begin_special_v261(jsonb,int,jsonb,timestamptz)','execute') a,has_function_privilege('anon','private.ludus_resolve_special_v261(jsonb,timestamptz)','execute') b")).rows[0];assert.deepEqual(permissions,{a:false,b:false});
 console.log('PASS server: authenticated RPC, exact costs, replay safety, independent hand cooldowns, targets, cancellation, net trajectory, shield break, no client stat trust.');
}finally{await db.close();}}
(async()=>{local();await sql();})().catch(e=>{console.error({message:e.message,where:e.where,position:e.position,query:e.query?.slice(Math.max(0,Number(e.position)-200),Number(e.position)+200),stack:e.stack});process.exitCode=1});
