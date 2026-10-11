const assert=require('node:assert/strict');
const {database,runtime,item,g,core}=require('./combat-stats-v73.cjs');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',R='00000000-0000-4000-8000-000000000003';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
async function fixtureDatabase(){const db=await database();await db.query("insert into ludus_accounts(user_id,username)values($1,'alpha'),($2,'beta')",[A,B]);return db;}
const c=runtime();
async function players(db,weapon='gladius',hand='main_hand'){
 const now=new Date().toISOString(),rows=[];
 for(const owner of [A,B]){
  const items=owner===A?[item(c,'weapon',{id:'weapon-'+hand,model:weapon,equipped_slot:hand,natural_stats:{physical_power:7}})]:[];
  const stats=(await db.query('select private.ludus_combat_stats_v73($1::jsonb,$2::jsonb) s',[JSON.stringify(g),JSON.stringify(items)])).rows[0].s;
  rows.push({owner,name:owner===A?'Alpha':'Beta',class:'secutor',gladiator:{...g,name:owner===A?'Alpha':'Beta'},items,combat_stats:stats,stats_version:76,hp:100,maxHp:100,stamina:100,maxStamina:100,serial:0,pull_serial:0,x:0,z:owner===A?0:3,angle:owner===A?0:Math.PI,seen:now,tick_at:now,stamina_at:now,stamina_regen_at:new Date(Date.now()+10000).toISOString(),block:false});
 }return rows;
}
async function setMatch(db,rows){await db.query("insert into ludus_matches(id,status,players)values($1,'playing',$2::jsonb)on conflict(id)do update set status='playing',players=excluded.players,winner=null",[R,JSON.stringify(rows)]);}
async function call(db,owner,action='step',input={}){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);return(await db.query("select ludus_match($1,$2,null,'{}',$3::jsonb) r",[action,R,JSON.stringify(input)])).rows[0].r;}
async function main(){
 const db=await fixtureDatabase(),step=(input,owner=A)=>call(db,owner,'step',input),resolve=async(rows,ms=1000)=>{
  await db.query('select setseed(0.5)');return(await db.query('select private.ludus_projectiles_v76($1::jsonb,$2::timestamptz) p',[JSON.stringify(rows),new Date(Date.parse(rows[0].projectile.launch_at)+ms).toISOString()])).rows[0].p;
 };
 let kinds=0;
 for(const weapon of ['gladius','sica','spear','trident'])for(const hand of ['main_hand','off_hand']){
  await setMatch(db,await players(db,weapon,hand));const state=await step({special:true,special_id:'throw-'+weapon+hand,hand,target:B,projectile:{base:9999},combat_stats:{attack:9999}}),a=state.players[0];
  assert.equal(state.controls_version,76);assert.equal(a.throw_serial,1);assert.equal(a.items.length,0);near(a.stamina,74);assert.equal(a.projectile.base,['gladius','sica'].includes(weapon)?20:30);assert.equal(state.players[1].hp,100,'no immediate damage');
  const early=await resolve(state.players,-1);assert.equal(early[1].hp,100);
  const landed=await resolve(state.players);assert.ok(landed[1].hp<100);assert.equal(landed[1].hit_serial,1);assert.equal(landed[0].projectile.outcome,'hit');assert.equal((await resolve(landed))[1].hp,landed[1].hp);
  const retry=await step({special:true,special_id:'throw-'+weapon+hand,hand,target:B});assert.equal(retry.players[0].throw_serial,1);near(retry.players[0].stamina,74);kinds++;
 }
 await setMatch(db,await players(db));let state=await step({special:true,special_id:'resistance',target:B}),normal=await resolve(state.players);
 const resistant=structuredClone(state.players);resistant[1].combat_stats.items.projectile_resistance=55;const defended=await resolve(resistant);assert.ok(defended[1].hp>normal[1].hp,'projectile resistance is consumed');
 const slash=structuredClone(state.players);slash[1].combat_stats.items.slash_resistance=55;assert.equal((await resolve(slash))[1].hp,normal[1].hp,'melee resistance does not replace projectile resistance');
 const missed=structuredClone(state.players);missed[1].x=2;assert.equal((await resolve(missed))[1].hp,100,'moving out of fixed path avoids hit');
 const dodged=structuredClone(state.players);dodged[1].dodge_at=dodged[0].projectile.launch_at;assert.equal((await resolve(dodged))[1].hp,100);
 const blocked=structuredClone(state.players);blocked[1].items=[item(c,'shield')];blocked[1].block=true;blocked[1].combat_stats.items={block_power:40};blocked[1].guard_at=blocked[0].projectile.launch_at;
 const guarded=await resolve(blocked);assert.equal(guarded[1].hp,100);near(guarded[1].stamina,88);assert.equal(guarded[1].last_defense,'block');assert.equal(guarded[0].recoil_until,undefined,'projectiles never stagger a remote thrower');assert.equal(guarded[1].counter_until,undefined);
 const rear=structuredClone(blocked);rear[1].angle=0;assert.ok((await resolve(rear))[1].hp<100);
 const empty=structuredClone(blocked);empty[1].stamina=0;assert.ok((await resolve(empty))[1].hp<100);
 const third=structuredClone(state.players);third.push({...structuredClone(third[1]),owner:'third',z:1.5});const collision=await resolve(third);assert.equal(collision[1].hp,100);assert.ok(collision[2].hp<100,'first fighter on ray absorbs one hit');
 const cancelled=structuredClone(state.players);cancelled[0].hp=0;cancelled[0].hit_impact_at=new Date(Date.parse(cancelled[0].projectile.launch_at)-1).toISOString();assert.equal((await resolve(cancelled))[0].projectile.outcome,'cancelled');
 const released=structuredClone(cancelled);released[0].hit_impact_at=new Date(Date.parse(released[0].projectile.launch_at)+10).toISOString();assert.ok((await resolve(released))[1].hp<100,'a weapon released before the thrower dies keeps flying');
 const left=structuredClone(state.players);left[0].hp=0;left[0].left=true;assert.equal((await resolve(left))[0].projectile.outcome,'cancelled');
 for(const change of [r=>r[0].stamina=25,r=>r[1].z=5,r=>r[0].pull_from=B,r=>r[0].recoil_until=new Date(Date.now()+10000).toISOString(),r=>r[0].swing_end=new Date(Date.now()+10000).toISOString(),r=>r[0].items[0].model='mace',r=>r[0].stats_version=75]){
  const rows=await players(db);change(rows);await setMatch(db,rows);const rejected=await step({special:true,special_id:'invalid',target:B});assert.equal(rejected.players[0].throw_serial,undefined);
 }
 for(const input of [{special:true,target:B},{special:true,special_id:'no-lock'},{special:true,special_id:'wrong-hand',hand:'off_hand',target:B}]){await setMatch(db,await players(db));assert.equal((await step(input)).players[0].throw_serial,undefined);}
 for(const input of [{special_id:[]},{special_id:'a'.repeat(81)}])await assert.rejects(()=>step(input),/Geçersiz/);
 // Recompute capacities from remaining equipment after paying the old capacity's cost.
 const low=await players(db);low[0].gladiator={...g,base_stats:{...core,conditioning:5}};low[0].items[0].emeralds=[{id:1,value:100},{id:3,value:100}];low[0].combat_stats=(await db.query('select private.ludus_combat_stats_v73($1::jsonb,$2::jsonb) s',[JSON.stringify(low[0].gladiator),JSON.stringify(low[0].items)])).rows[0].s;Object.assign(low[0],{hp:30,maxHp:30,stamina:30,maxStamina:30});await setMatch(db,low);const paid=(await step({special:true,special_id:'capacity',target:B})).players[0];near(paid.stamina,4);near(paid.maxStamina,10);near(paid.hp,10);near(paid.maxHp,10);
 // State polling by either client advances flight and records exactly one outcome.
 await setMatch(db,state.players);await db.query("update ludus_matches set players=jsonb_set(jsonb_set(jsonb_set(players,'{0,projectile,launch_at}',to_jsonb(clock_timestamp()-interval '1 second')),'{0,projectile,tick_at}',to_jsonb(clock_timestamp()-interval '1 second')),'{0,projectile,expires_at}',to_jsonb(clock_timestamp()-interval '100 milliseconds'))where id=$1",[R]);const observed=await call(db,B,'state');assert.ok(observed.players[1].hp<100);assert.equal((await call(db,A,'state')).players[1].hit_serial,1);
 const grants=(await db.query("select has_function_privilege('authenticated','private.ludus_projectiles_v76(jsonb,timestamptz)','execute') a,has_function_privilege('anon','private.ludus_projectiles_v76(jsonb,timestamptz)','execute') b")).rows[0];assert.deepEqual(grants,{a:false,b:false});
 await db.close();console.log(JSON.stringify({weaponHands:kinds,flight:true,sharedHit:true,resistance:true,guard:true,dodge:true,misses:true,retries:true,capacityAfterThrow:true,inputValidation:true,permissions:true}));
}
module.exports={fixtureDatabase,players,setMatch,call,A,B,R};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
