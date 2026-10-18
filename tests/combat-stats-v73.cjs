// Execute the shipped engines and PostgreSQL functions, without production player data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),exercise=require('../gladiator-exercise-v46.js');
const core=Object.fromEntries(exercise.attributes.map(([k])=>[k,50]));
const g={class:'secutor',stat_version:46,level:1,overall:50,base_stats:core};
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
const near=(a,b)=>assert.ok(Math.abs(Number(a)-Number(b))<1e-6,String(a)+' != '+b);
function runtime(page='arena.html'){
 const html=fs.readFileSync(root+'/'+page,'utf8'),c=vm.createContext({console,LudusExercise:exercise});
 const start=html.indexOf('var ArenaClasses='),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",end="})(typeof window!=='undefined'?window:globalThis);";
 vm.runInContext(html.slice(start,html.indexOf(end,html.indexOf(marker,start))+end.length),c);
 const load=html.indexOf('var LudusLoadout='),finish=html.indexOf('})();',html.indexOf('P.damageProjectileV10=',load))+5;
 vm.runInContext(html.slice(load,finish).replace(/<\/script>[\s\S]*?<script[^>]*>/g,''),c);return c;
}
function item(c,kind='weapon',extra={}){return{stat_version:10,natural_rule_version:2,kind,model:kind==='weapon'?'gladius':kind==='shield'?'round':kind,equipped_slot:kind==='weapon'?'main_hand':kind==='shield'?'off_hand':kind,enhancement:0,natural_stats:c.LudusItemSystem.baseStats(kind),natural_percentages:{},emeralds:[],...extra};}
function fixture(c,random=.999){
 const sim=new c.ArenaCombat(()=>random).reset('normal','secutor');sim.botStep=()=>{};
 for(const f of sim.fighters){f.hp=0;f.cooldown=999;}
 const a=sim.fighters[0],v=sim.fighters[5];
 for(const f of[a,v])c.LudusLoadout.apply(f,g,[]);
 Object.assign(a,{hp:100,cooldown:0,x:0,z:0,angle:0,weapon:'gladius'});
 Object.assign(v,{hp:100,cooldown:999,x:0,z:1.2,angle:Math.PI,weapon:'gladius'});
 return{sim,a,v};
}
function pve(){
 for(const page of['arena.html','savas.html','multiplayer.html']){
  const c=runtime(page);
  for(const automatic of[false,true]){
   const{sim,a,v}=fixture(c,0);Object.assign(v,{shield:true,shieldHeldBy:null,blocking:!automatic,stamina:100,maxStamina:100,itemStats:{block_rate:30,block_power:40}});
   sim.attack(0);assert.equal(sim.guard(a,v,false),true);near(v.stamina,88);
  }
  for(const hand of['main','off']){
   const{sim,a,v}=fixture(c,.01);Object.assign(v,{weapon:hand==='main'?'gladius':null,offhand:hand==='off'?'gladius':null,shield:false,itemStats:{parry_rate:20}});
   sim.attack(0);assert.equal(sim.guard(a,v,false),true);near(v.stamina,94);
  }
  {const{sim,a,v}=fixture(c,0);Object.assign(v,{weapon:null,offhand:'gladius',shield:false,stamina:0,itemStats:{parry_rate:20}});sim.attack(0);assert.equal(sim.guard(a,v,false),false);}
  {const{sim,a,v}=fixture(c);c.LudusLoadout.apply(a,{...g,base_stats:{...core,muscle:0,attack_technique:0,tactics:0}},[]);v.hp=10000;sim.damage(a,v,200,'chest');assert.ok(10000-v.hp<=1,'zero strength must not become default attack');}
  {const{sim,a}=fixture(c);c.LudusLoadout.apply(a,{...g,base_stats:{...core,reflex:0}},[]);sim.attack(0);near(a.duration,.75/.9);}
  for(const capacity of[10,20,50])for(const hand of['weapon','offhand']){
   const{sim,a}=fixture(c),glad={...g,base_stats:{...core,conditioning:capacity}};
   const w=item(c,'weapon',{equipped_slot:hand==='weapon'?'main_hand':'off_hand',emeralds:[{id:3,value:100}]});
   c.LudusLoadout.apply(a,glad,[w]);a.equipment={[hand]:{token:'throw-test',item:w}};a.gearBase=glad;
   a.stamina=Math.min(50,a.maxStamina);const before=a.stamina;
   assert.equal(sim.special(0,hand==='weapon'?0:1),true);near(a.stamina,Math.min(a.maxStamina,before-26));assert.ok(a.stamina>=0);
  }
  for(const dropped of[false,true]){
   const{sim,a,v}=fixture(c,.01),w=item(c,'weapon',{natural_stats:{physical_power:7}}),legs=item(c,'legs',{natural_stats:{},emeralds:[{id:6,value:100}]});
   c.LudusLoadout.apply(a,g,dropped?[legs]:[w,legs]);v.hp=10000;const original=a.itemStats;
   sim.damageProjectileV10(a,v,{kind:'gladius',itemEntry:{item:w}},200,'chest',false);
   assert.ok(sim.events.some(e=>e.type==='critical'),'remaining gear critical bonus reaches projectile');assert.equal(a.itemStats,original);
  }
  {const{sim,a,v}=fixture(c);const w=item(c,'weapon',{natural_stats:{physical_power:7},emeralds:[{id:5,value:100}]});c.LudusLoadout.apply(a,g,[w]);let seen;const old=sim.damage;sim.damage=function(a){seen=a.itemStats.physical_power;return true;};sim.damageProjectileV10(a,v,{kind:'gladius',itemEntry:{item:w}},1);near(seen,14);sim.damage=old;}
 }
 return{engines:3,automaticBlock:true,offhandParry:true,zeroStats:true,throwCosts:true,projectileGear:true};
}
async function database(){
 const db=new PGlite();await db.waitReady;
 await db.exec(fs.readFileSync(root+'/tests/fixtures/gladiator-v46.sql','utf8'));
 await db.exec("create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt()to authenticated;alter table ludus_accounts add column username text,add column ludus_name text;");
 await db.exec(fs.readFileSync(root+'/ludus-multiplayer-v36.sql','utf8'));
 const migrate=async name=>db.exec(fs.readFileSync(root+'/supabase/migrations/'+fs.readdirSync(root+'/supabase/migrations').find(f=>f.endsWith('_'+name+'.sql')),'utf8'));
 for(const name of['gladiator_exercise_v46','targeted_training_v51','dining_food_v55','dining_meals_v56','dining_nutrition_v57','dining_recovery_v58','dining_recovery_balance_v59','combat_food_stamina_v60','combat_stats_v73','combat_stats_v73','combat_stats_v74','combat_stats_v74','combat_stats_v75','combat_stats_v75','online_projectiles_v76','online_projectiles_v76','arena_completion_v77','arena_completion_v77','arena_combat_realism_v114','arena_combat_realism_v114'])await migrate(name);
 return db;
}
module.exports={runtime,item,fixture,database,g,core};
async function main(){
 const local=pve(),db=await database(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const c=runtime(),snap=async(g,items=[])=>(await q('select private.ludus_combat_stats_v73($1::jsonb,$2::jsonb) s',[JSON.stringify(g),JSON.stringify(items)]))[0].s;
 const cases=[];
 for(const type of Object.keys(c.ArenaClasses))cases.push([{...g,class:type,base_stats:exercise.profile(type)},[]]);
 for(const [key]of exercise.attributes)for(const value of[0,50,80,100])cases.push([{...g,base_stats:{...core,[key]:value}},[]]);
 for(const s of c.LudusItemSystem.natural){const kind=s.group==='offense'?'weapon':s.group==='defense'?'chest':'legs';cases.push([g,[item(c,kind,{enhancement:10,natural_percentages:{[s.key]:100}})]]);}
 for(const s of c.LudusItemSystem.emeralds)cases.push([g,[item(c,'legs',{emeralds:[{id:s.id,value:100}]})]]);
 cases.push([{...g,level:11},['weapon','shield','helmet','chest','gloves','legs'].map(k=>item(c,k,{enhancement:15,emeralds:[{id:2,value:100},{id:3,value:100},{id:4,value:100},{id:9,value:100}]}))]);
 cases.push([{class:'murmillo',stat_version:7,base_stats:c.ArenaClasses.murmillo.stats,level:2,overall:62},[{kind:'helmet',equipped_slot:'helmet',base_stats:{health:4,defense:3},enhancement:6,sapphires:[{stat:'strength',value:10,percent:true}],rubies:[]}]]);
 for(const [glad,items]of cases){
  const s=await snap(glad,items),f=fixture(c).a;c.LudusLoadout.apply(f,glad,items);
  for(const[server,client]of[['maxHp','maxHp'],['maxStamina','maxStamina'],['attack','attackBonus'],['defense','defenseBonus'],['speed','speedBonus'],['agility','agility'],['native_attack','nativeAttackBonus']])near(s[server],f[client]);
  for(const[k,v]of Object.entries(f.itemStats))near(s.items[k],v);
  near(s.attack_speed,c.ArenaMotion.speedFactor(f));
 }
 const time='2026-10-11T12:00:00Z',now='2026-10-11T12:00:01Z';
 const player=async(owner,items=[],glad=g)=>({owner,class:glad.class,gladiator:glad,items,stats_version:73,combat_stats:await snap(glad,items),hp:100,maxHp:100,stamina:100,maxStamina:100,stamina_at:time,seen:time,x:0,z:owner===A?0:1.25,angle:owner===A?0:Math.PI,block:false,serial:0});
 const hit=async(a,v,crit=.999,roll=.999,weapon='gladius',projectile=false)=>(await q("select private.ludus_hit_v73($1::jsonb,$2::jsonb,$3,'main_hand',100,$4,$5,$6) h",[JSON.stringify(a),JSON.stringify(v),weapon,crit,roll,projectile]))[0].h;
 const a=await player(A),v=await player(B),base=(await hit(a,v)).damage;
 const stronger=await player(A,[],{...g,base_stats:{...core,muscle:90}});assert.ok((await hit(stronger,v)).damage>base);
 const defended=await player(B,[item(c,'chest',{enhancement:15})]);assert.ok((await hit(a,defended)).damage<base);
 const crit=await player(A,[item(c,'legs',{natural_stats:{},emeralds:[{id:6,value:100},{id:7,value:100},{id:8,value:100},{id:9,value:100}]})]);
 assert.equal((await hit(crit,v,.01)).critical,true);assert.ok((await hit(crit,v,.01)).damage>base);
 const resist=await player(B,[item(c,'chest',{natural_stats:{critical_resistance:20,projectile_resistance:50}})]);
 assert.equal((await hit(crit,resist,.01)).critical,false);assert.ok((await hit(a,resist,.99,.99,'gladius',true)).damage<base);
 const block=await player(B,[item(c,'shield',{natural_stats:{block_rate:30,block_power:40}})]);
 const parry=await player(B,[item(c,'weapon',{equipped_slot:'off_hand',natural_stats:{},emeralds:[{id:11,value:100}]})]);
 const passive=async(p,r=.01)=>(await q('select private.ludus_passive_defense_v73($1::jsonb,$2,true,$3,$3,$3) d',[JSON.stringify(p),time,r]))[0].d;
 assert.equal(await passive(block),'autoblock');assert.equal(await passive(parry),'parry');
 parry.stamina=0;assert.equal(await passive(parry),'none');
 const evader=await player(B,[item(c,'legs',{natural_stats:{dodge_rate:20}})]);assert.equal(await passive(evader),'evade');evader.swing_end=now;assert.equal(await passive(evader),'none');
 const advance=async(p)=>(await q('select private.ludus_advance_combat_v36($1::jsonb,$2::timestamptz) p',[JSON.stringify([p]),now]))[0].p[0];
 const regen=await player(A,[item(c,'helmet',{natural_stats:{},emeralds:[{id:1,value:100},{id:2,value:100},{id:3,value:100},{id:4,value:100}]})]);
 Object.assign(regen,{hp:90,maxHp:120,maxStamina:120,stamina:110});let advanced=await advance(regen);near(advanced.stamina,120);assert.equal(advanced.hp,90);near(advanced.hp_regen_fraction,.5);
 regen.hp_regen_fraction=.5;advanced=await advance(regen);assert.equal(advanced.hp,91);near(advanced.hp_regen_fraction,0);
 regen.hp=0;assert.equal((await advance(regen)).hp,0,'regen never revives');
 const dodge=await player(A,[item(c,'legs',{natural_stats:{dodge_distance:25}})]);Object.assign(dodge,{dodge_at:time,dodge_tick_at:time,dodge_until:'2026-10-11T12:00:00.460Z',dodge_dx:1,dodge_dz:0,stamina_regen_at:now});near((await advance(dodge)).x,7.5*.46*1.25);
 const resolve=async(p)=>(await q('select private.ludus_resolve_combat_v36($1::jsonb,$2::timestamptz) p',[JSON.stringify(p),now]))[0].p;
 const strike=p=>Object.assign(p,{strike_at:'2026-10-11T12:00:00.500Z',swing_at:time,strike_target:B,strike_weapon:'gladius',strike_hand:'main_hand'});
 let resolved=await resolve([strike(structuredClone(stronger)),structuredClone(v)]);assert.ok(resolved[1].hp<86,'server actually applies character damage');assert.deepEqual(await resolve(resolved),resolved,'hit resolves exactly once');
 Object.assign(block,{block:true,guard_at:time});resolved=await resolve([strike(structuredClone(a)),block]);assert.equal(resolved[1].hp,100);near(resolved[1].stamina,88);
 const legacyA=structuredClone(a),legacyV=structuredClone(v);delete legacyA.stats_version;delete legacyA.combat_stats;delete legacyV.stats_version;delete legacyV.combat_stats;resolved=await resolve([strike(legacyA),legacyV]);assert.equal(resolved[1].hp,86,'existing room damage stays unchanged');
 // Join uses database-owned gladiators/items, preserving eligibility and food rules.
 await q('insert into ludus_accounts(user_id,gold)values($1,1000),($2,1000),($3,1000)',[A,B,C]);
 const oldQueue=(await q("insert into ludus_matches(status,starts_at,players)values('waiting',now()+interval '25 seconds',$1::jsonb)returning id",[JSON.stringify([await player(B)])]))[0].id;
 const ga=(await q("insert into ludus_gladiators(owner_id,name,class,base_stats,stat_version)values($1,'Alpha','secutor',$2::jsonb,46)returning id",[A,JSON.stringify({...core,conditioning:80})]))[0].id;
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 let joined=(await q("select ludus_match('join',null,$1,'{}',$2::jsonb) r",[ga,JSON.stringify({combat_stats:{attack:9999},hp:9999})]))[0].r;
 assert.notEqual(joined.id,oldQueue,'new queues cannot join old reflex snapshots');assert.equal(joined.players[0].stats_version,77);assert.equal(joined.players[0].maxHp,160);assert.equal(joined.players[0].hp,160);assert.ok(joined.players[0].combat_stats.attack<2);
 const liveA=await player(A),liveB=await player(B);liveA.seen=liveB.seen=new Date().toISOString();liveA.stamina_at=liveB.stamina_at=liveA.seen;
 await q("update ludus_matches set status='playing',players=$2::jsonb where id=$1",[joined.id,JSON.stringify([liveA,liveB])]);
 const step=async(input)=>(await q("select ludus_match('step',$1,null,'{}',$2::jsonb) r",[joined.id,JSON.stringify(input)]))[0].r;
 let state=await step({attack:true,attack_id:'one',target:B});assert.equal(state.players[0].serial,1);const before=state.players[0].stamina;
 state=await step({attack:true,attack_id:'one',hp:99999,combat_stats:{attack:99999}});assert.equal(state.players[0].serial,1);assert.equal(state.players[0].stamina,before);assert.equal(state.players[0].combat_stats.attack,1);
 // Verify that movement/turn and attack cadence consume the cached modifiers.
 const mover=await player(A,[item(c,'legs',{natural_stats:{acceleration:30,movement_speed:30,turn_speed:30},emeralds:[{id:15,value:100}]})],{...g,base_stats:{...core,speed:80,reflex:80}});
 const tick=new Date(Date.now()-100).toISOString();Object.assign(mover,{angle:Math.PI/2,seen:liveA.seen,stamina_at:liveA.seen,tick_at:tick});
 await q("update ludus_matches set status='playing',winner=null,players=$2::jsonb where id=$1",[joined.id,JSON.stringify([mover,liveB])]);
 state=await step({x:1,z:0,target:B});let moved=state.players[0];const dt=Math.min(.25,(Date.parse(moved.tick_at)-Date.parse(tick))/1000);
 const expectedX=3.5*1.6*1.3*(.85+.15*Math.min(1,dt*9))*dt;
 assert.ok(Math.abs(moved.x-expectedX)<.02,'server movement applies speed, acceleration and gear');
 const aim=Math.atan2(-moved.x,1.25),turn=Math.atan2(Math.sin(aim-Math.PI/2),Math.cos(aim-Math.PI/2));
 assert.ok(Math.abs(moved.angle-(Math.PI/2+turn*Math.min(1,(1-Math.exp(-18*dt))*1.3)))<.03,'server turn consumes turn speed');
 state=await step({attack:true,attack_id:'haste',target:B});near(state.players[0].wind,.22/(1.06*1.04));
 // An old cached speed must not bypass the combined V114 limit.
 mover.combat_stats.attack_speed=1.3*1.04;await q("update ludus_matches set players=$2::jsonb where id=$1",[joined.id,JSON.stringify([mover,liveB])]);
 state=await step({attack:true,attack_id:'cached-v73',target:B});near(state.players[0].wind,.22/(1.06*1.04));
 const recovered=await player(A,[item(c,'legs',{natural_stats:{recovery_speed:30}})]),perfect=await player(B,[item(c,'shield',{natural_stats:{block_power:40}})]);
 Object.assign(perfect,{block:true,guard_at:'2026-10-11T12:00:00.400Z'});
 resolved=await resolve([strike(recovered),perfect]);assert.equal(resolved[1].last_defense,'perfect');near(resolved[1].stamina,96.4);
 assert.ok((Date.parse(resolved[0].stagger_until)-Date.parse(now))/1000<.49);assert.equal(resolved[0].stagger_until,resolved[0].recoil_until,'recoil cannot keep a shortened stagger locked');
 let automatic=false;for(let seed=1;seed<=20&&!automatic;seed++){await q('select setseed($1)',[seed/20]);const shield=structuredClone(block);shield.block=false;resolved=await resolve([strike(structuredClone(a)),shield]);if(resolved[1].last_defense==='block'){near(resolved[1].stamina,88);automatic=true;}}
 assert.equal(automatic,true,'automatic block applies the same block power refund in resolver');
 await q("select set_config('request.jwt.claim.sub',$1,false)",[C]);await assert.rejects(()=>q("select ludus_match('state',$1)",[joined.id]),/erişemezsin/);
 const permissions=(await q("select has_function_privilege('authenticated','private.ludus_combat_stats_v73(jsonb,jsonb)','execute') calc,has_function_privilege('anon','public.ludus_match(text,uuid,uuid,jsonb,jsonb)','execute') anon_match,has_function_privilege('authenticated','public.ludus_match(text,uuid,uuid,jsonb,jsonb)','execute') auth_match"))[0];
 assert.deepEqual(permissions,{calc:false,anon_match:false,auth_match:true});
 await db.close();console.log(JSON.stringify({...local,snapshotParityCases:cases.length,authoritativeDamage:true,defenses:true,regeneration:true,dodgeDistance:true,legacyRooms:true,repeatableMigration:true,serverOwnedSnapshots:true,idempotentCommands:true,permissions:true}));
}
if(require.main===module)main().catch(e=>{console.error({message:e.message,where:e.where,position:e.position,stack:e.stack});process.exitCode=1;});


