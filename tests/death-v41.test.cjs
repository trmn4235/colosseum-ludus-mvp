const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function runtime(page){const html=fs.readFileSync(path.join(root,page),'utf8'),ctx=vm.createContext({console});const start=html.indexOf('var ArenaClasses='),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);",end=html.indexOf(ending,html.indexOf(marker,start))+ending.length;vm.runInContext(html.slice(start,end),ctx);return ctx;}
for(const page of ['arena.html','savas.html','multiplayer.html'])test(page+': corpse keeps appearance; actual loot transfers once',()=>{
 const {ArenaCombat}=runtime(page),sim=new ArenaCombat(()=>.999).reset('normal','murmillo'),attacker=sim.fighters[0],victim=sim.fighters[5];
 Object.assign(attacker,{x:0,z:0});Object.assign(victim,{x:0,z:1,hp:1,helmet:true,chest:true,greaves:true,shoulders:true,shield:true,weapon:'gladius',helmetModel:'roman',chestModel:'roman',shieldStyle:'murmillo',knockOrigin:{x:-9,z:-9},knockAngle:3,deadTime:3});
 for(const key of Object.keys(victim.wear))victim.wear[key]=10000;
 victim.equipment={weapon:{item:{id:'one-sword',model:'gladius'}},helmet:{item:{id:'one-helmet',model:'roman'}}};
 assert.equal(sim.damage(attacker,victim,3,'chest'),true);assert.equal(victim.hp,0);assert.equal(victim.deadTime,0);assert.equal(victim.knockOrigin,null);assert.equal(victim.knockAngle,null);
 for(const slot of ['helmet','chest','greaves','shoulders','shield']){assert.equal(victim.corpseEquipment[slot],true);assert.equal(victim[slot],false);}
 assert.equal(victim.corpseEquipment.weapon,'gladius');assert.equal(victim.corpseEquipment.helmetModel,'roman');assert.equal(victim.weapon,null);assert.deepEqual(Object.keys(victim.equipment),[]);
 const loot=sim.drops.find(d=>d.slot==='weapon');assert.equal(loot.itemEntry.item.id,'one-sword');assert.equal(sim.damage(attacker,victim,3),false);assert.equal(sim.drops.filter(d=>d.itemEntry?.item.id==='one-sword').length,1);
 attacker.x=loot.x;attacker.z=loot.z;attacker.equipment={};attacker.pickupHand="weapon";assert.equal(sim.pickup(0,loot.id),true);assert.equal(attacker.equipment.weapon.item.id,'one-sword');assert.equal(sim.pickup(0,loot.id),false);assert.equal(victim.corpseEquipment.weapon,'gladius');
});
test('death ignores a stale shield push origin and heading',()=>{
 const ctx=vm.createContext({});for(const p of ['arena-fall-motion-v39.js','arena-ground-fall-v39.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx);
 const f={hp:0,action:'down',deadTime:0,x:7,z:4,angle:.2,knockOrigin:{x:-8,z:9},knockAngle:2};const pose=ctx.GroundFall.pose(f,{hipRest:{y:1.05}});assert.equal(pose.x,7);assert.equal(pose.z,4);assert.equal(pose.heading,.2);
});
