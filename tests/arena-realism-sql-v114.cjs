const assert=require('node:assert/strict');
const {runtime}=require('./combat-stats-v73.cjs');
const {fixtureDatabase,players,setMatch,call,A,B}=require('./online-projectiles-v76.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
async function main(){
 const c=runtime(),db=await fixtureDatabase();let cadenceCases=0;
 try{
  for(const kind of ['gladius','sica','spear','trident','mace','whip'])for(const reflex of [0,50,100]){
   const rows=await players(db,kind);rows[0].gladiator.base_stats.reflex=reflex;rows[1].z=1.2;
   rows[0].combat_stats=(await db.query('select private.ludus_combat_stats_v73($1,$2) s',[JSON.stringify(rows[0].gladiator),JSON.stringify(rows[0].items)])).rows[0].s;
   // Even a legacy cached haste value cannot evade the authoritative combined limit.
   rows[0].combat_stats.attack_speed=999;
   await setMatch(db,rows);const state=await call(db,A,'step',{attack:true,attack_id:kind+reflex,target:B}),a=state.players[0];
   assert.equal(state.combat_feel_version,114);assert.equal(a.serial,1);
   const factor=c.ArenaMotion.speedFactor({agility:reflex,itemStats:{}}),p=c.ArenaMotion.profile(kind);
   near(a.wind,p.wind/factor);near(a.active,p.active/factor);near(a.recover,p.recover/factor);cadenceCases++;
  }
  const rows=await players(db);rows[1].z=1.2;await setMatch(db,rows);
  const state=await call(db,A,'step',{attack:true,attack_id:'miss',target:B}),original=state.players[0];state.players[1].z=9;
  const time=new Date(Date.parse(original.swing_at)+500).toISOString();
  const resolve=async p=>(await db.query('select private.ludus_resolve_combat_v36($1,$2) p',[JSON.stringify(p),time])).rows[0].p;
  const missed=await resolve(state.players);assert.equal(missed[0].attack_result,'miss');near(missed[0].recover,original.recover+.14);
  assert.equal(Date.parse(missed[0].swing_end)-Date.parse(original.swing_end),140);
  const repeated=await resolve(missed);assert.deepEqual(repeated,missed);
  for(const kind of ['spear','trident'])for(const projectile of [false,true])for(const distance of [.9,1.9]){
   const a={x:0,z:0,combat_stats:{attack:1,items:{}},items:[]},v={x:0,z:distance,combat_stats:{defense:1,items:{}}};
   const hit=(await db.query("select private.ludus_hit_v73($1,$2,$3,'main_hand',1000,1,1,$4) h",[JSON.stringify(a),JSON.stringify(v),kind,projectile])).rows[0].h;
   const expected=projectile?1000:Math.round(1000*c.ArenaMotion.impactQuality({...a,weapon:kind},v));near(hit.damage,expected);
  }
  const grants=(await db.query("select has_function_privilege('anon','public.ludus_match(text,uuid,uuid,jsonb,jsonb)','execute') anon_match,has_function_privilege('authenticated','private.ludus_hit_v73(jsonb,jsonb,text,text,numeric,numeric,numeric,boolean)','execute') private_hit")).rows[0];assert.deepEqual(grants,{anon_match:false,private_hit:false});
  console.log(JSON.stringify({cadenceCases,authoritativeHaste:true,missRecoveryOnce:true,polearmDistance:true,projectilePower:true,permissions:true}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
