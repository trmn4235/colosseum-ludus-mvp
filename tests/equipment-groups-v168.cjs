const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {runtime,item,g}=require('./combat-stats-v73.cjs');
const groups=require('../equipment-groups-v168.js');
test('six complete mutually exclusive subcategories and matching item artwork',()=>{
 const c=vm.createContext({});for(const file of ['ludus-production-v119.js','equipment-groups-v168.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),c);
 assert.equal(c.LudusEquipmentGroups.groups.length,6);
 for(const r of c.LudusProduction.recipes.filter(r=>['weapon','shield'].includes(r.kind))){assert.equal(c.LudusEquipmentGroups.groups.filter(g=>g.kind===r.kind&&g.models.includes(r.model)).length,1,r.sku);assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',c.LudusProduction.photo(r.sku))));}
 for(const id of ['heavy_mace','warhammer']){const r=c.LudusProduction.recipes.find(r=>r.sku===id);assert.equal(r.output_quantity,1);assert.ok(Object.values(r.ingredients).every(n=>Number.isInteger(n)&&n>0));assert.match(c.LudusProduction.artwork({kind:'weapon',model:id}),new RegExp('items-v168/'+id));}
 const forum=require('../forum-market-v66.js');global.LudusEquipmentGroups=groups;
 assert.deepEqual(forum.filterListings(['gladius','mace','heavy_mace','warhammer','net'].map(model=>({asset:{kind:'weapon',model},price:100})),{kind:'weapon',subcategory:'blunt'}).map(r=>r.asset.model),['mace','heavy_mace','warhammer']);
});
for(const page of ['arena.html','savas.html','multiplayer.html'])for(const weapon of ['mace','heavy_mace','warhammer']){
 test(page+': '+weapon+' breaks on second shield impact, never on a miss',()=>{
  const c=runtime(page),sim=new c.ArenaCombat(()=>.999),a=sim.fighters[5],v=sim.fighters[0];sim.time=10;
  Object.assign(a,{x:0,z:1,angle:Math.PI,weapon,attackWeapon:weapon,action:'attack',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(weapon)});
  Object.assign(v,{x:0,z:0,angle:0,shield:true,blocking:true,guardRegion:null,guardPressedAt:-99,stamina:100,maxStamina:100});
  v.blocking=false;assert.equal(sim.guard(a,v),false);assert.equal(v.shieldBreakerHits,undefined);v.blocking=true;
  assert.equal(sim.guard(a,v),true);assert.equal(v.shield,true);assert.equal(v.shieldBreakerHits,1);
  a.action='attack';v.blocking=true;assert.equal(sim.guard(a,v),true);assert.equal(v.shield,false);assert.equal(v.wear.shield,0);assert.equal(sim.drops.at(-1).shattered,true);assert.equal(sim.canPickup(v,sim.drops.at(-1)),false);
 });
 test(page+': '+weapon+' offhand/perfect guard and legacy replay',()=>{
  const c=runtime(page),sim=new c.ArenaCombat(()=>.999),a=sim.fighters[5],v=sim.fighters[0];sim.time=1;
  Object.assign(a,{x:0,z:1,weapon:'gladius',offhand:weapon,attackLeft:true,attackWeapon:weapon,action:'attack',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(weapon)});
  Object.assign(v,{x:0,z:0,angle:0,shield:true,blocking:true,guardPressedAt:1,stamina:100,guardRegion:null});
  assert.equal(sim.guard(a,v),true);assert.equal(v.shieldBreakerHits,1);assert.equal(v.shield,true);
  sim.equipmentVersion=167;a.action='attack';v.blocking=true;v.guardPressedAt=-99;assert.equal(sim.guard(a,v),true);assert.equal(v.shieldBreakerHits,1);assert.equal(v.shield,true);
  sim.equipmentVersion=168;v.shield=false;v.guardRegion='chest';v.weapon='gladius';a.action='attack';sim.guard(a,v);assert.equal(v.shieldBreakerHits,1,'weapon parry is not shield impact');
 });
}

test('battle-disabled owned shields remain in extraction; a replacement shield starts clean',()=>{const c=runtime('arena.html'),sim=new c.ArenaCombat(()=>.999),a=sim.fighters[5],v=sim.fighters[0];c.LudusLoadout.apply(v,g,[item(c,'shield')]);v.gearBase=g;v.equipment={shield:{token:'owned-shield',item:item(c,'shield')}};Object.assign(a,{weapon:'warhammer',attackWeapon:'warhammer'});sim.shieldBreakerHit(a,v);sim.shieldBreakerHit(a,v);assert.equal(v.shield,false);assert.equal(c.LudusLoadout.exitSlots(v).off_hand,'owned-shield');sim.drops.push({id:999,kind:'shield',style:'secutor',x:v.x,z:v.z,durability:65});Object.assign(v,{action:'idle',hp:100,stunUntil:0});assert.equal(sim.pickup(v.id,999),true);assert.equal(v.shieldBreakerHits,0);});
