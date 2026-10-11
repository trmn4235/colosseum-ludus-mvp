const assert=require('node:assert/strict');
const {runtime,fixture,item,database,g,core}=require('./combat-stats-v73.cjs');
const inspector=require('../combat-inspector-v74.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
async function main(){
 const db=await database();let samples=0;
 for(const page of ['arena.html','savas.html','multiplayer.html']){
  const c=runtime(page);let previous=Infinity;
  for(let reflex=0;reflex<=100;reflex++){
   const glad={...g,base_stats:{...core,reflex}},gear=[item(c,'legs',{emeralds:[{id:15,value:100}]})],{sim,a}=fixture(c);
   c.LudusLoadout.apply(a,glad,gear);assert.equal(sim.attack(0),true);assert.ok(a.duration<previous,'every reflex point must shorten attacks');previous=a.duration;
   const s=(await db.query('select private.ludus_combat_stats_v73($1::jsonb,$2::jsonb) s',[JSON.stringify(glad),JSON.stringify(gear)])).rows[0].s;
   near(a.duration,.72/s.attack_speed);samples++;
  }
 }
 const c=runtime(),rules=c.LudusItemSystem,gear=['weapon','shield','helmet','chest','gloves','legs'].map((kind,i)=>item(c,kind,{id:String(i),equipped_by:'gladiator',emeralds:[{id:2,value:100},{id:3,value:100},{id:4,value:100},{id:9,value:100}]}));
 const unrelated=item(c,'legs',{equipped_by:'other',emeralds:[{id:3,value:100}]});
 const report=inspector.inspect(rules,gear[0],[...gear,unrelated]);assert.equal(report.count,6);
 for(const[key,raw,used,excess]of[['max_stamina',120,100,20],['hp_regeneration',3,2,1],['stamina_regeneration',18,8,10],['minimum_damage',60,20,40]]){
  const r=report.rows.find(r=>r.key===key);near(r.raw,raw);near(r.used,used);near(r.excess,excess);
 }
 assert.equal(report.rows.find(r=>r.key==='physical_power').used,null);
 const single=inspector.inspect(rules,{...gear[0],equipped_by:null},gear);assert.equal(single.count,1);assert.equal(single.equipped,false);
 near(rules.percentageChances.reduce((s,p)=>s+p.chance,0),100);near(rules.percentageChances[0].chance,.1/365.6*100);
 await db.close();console.log(JSON.stringify({reflexParitySamples:samples,allPointsImprove:true,equipmentTotals:true,unusedBonuses:true,conditionalEffects:true,oddsTotal:100}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
