const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../naval-simulation-v97.js'),C=N.constants,{fixture,moored}=require('./naval-fixture.cjs');
function rackReady(){const f=moored();Object.assign(f.p,N.world(f.naval.ships[0],C.rackX+.7,C.rackZ));return f;}
function rangeReady(){const f=rackReady();f.naval.takeJavelin();for(const actor of f.combat.fighters)if(actor.id!==0)Object.assign(actor,{x:40,z:40});Object.assign(f.combat.fighters[5],{x:f.p.x+12,z:f.p.z,blocking:false});return f;}
test('four angled starts have separated hulls and staggered boarding goals',()=>{
 const {naval}=fixture();assert.equal(new Set(naval.ships.map(s=>s.angle)).size,4);
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.equal(N.separation(naval.ships[i],naval.ships[j]),null);
 assert.ok(new Set(naval.ships.map(s=>Math.round(naval.goal(s).z))).size>=3);
});
test('a moving deck rack supplies exactly one carried javelin without touching equipment',()=>{
 const {naval,p}=rackReady(),gear={weapon:p.weapon,offhand:p.offhand,shield:p.shield};
 assert.equal(naval.rack().id,0);assert.equal(naval.takeJavelin(),true);assert.equal(naval.ships[0].javelins,7);assert.equal(naval.takeJavelin(),false);
 assert.deepEqual({weapon:p.weapon,offhand:p.offhand,shield:p.shield},gear);
 const s=naval.ships[0];s.x=10;s.z=-7;s.angle=.8;Object.assign(p,N.world(s,C.rackX,C.rackZ));assert.equal(naval.rack().id,0);
});
test('distant, empty, busy, airborne, stunned, dead or piloted pickups are rejected',()=>{
 for(const modify of [f=>f.p.x+=5,f=>f.naval.ships[0].javelins=0,f=>f.p.action='attack',f=>f.p.navJump={},f=>f.p.stunUntil=2,f=>f.p.hp=0,f=>f.naval.manual=true]){const f=rackReady();modify(f);assert.equal(f.naval.takeJavelin(),false);assert.equal(f.p.navJavelin,false);}
});
test('a throw requires an enemy, stamina and an idle grounded player',()=>{
 for(const modify of [f=>f.combat.fighters[5].x=50,f=>f.p.stamina=17,f=>f.p.action='attack',f=>f.p.navJump={},f=>f.p.stunUntil=2,f=>f.naval.manual=true]){const f=rangeReady();modify(f);assert.equal(f.naval.throwJavelin(),false);assert.equal(f.p.navJavelin,true);assert.equal(f.naval.javelins.length,0);}
});
test('the existing attack control throws the carried javelin with one stamina payment',()=>{
 const {naval,combat,p}=rangeReady(),stamina=p.stamina,weapon=p.weapon;
 assert.equal(combat.attack(0),true);assert.equal(p.stamina,stamina-C.javelinCost);assert.equal(combat.attack(0),false);assert.equal(naval.javelins.length,1);
 naval.updateJavelins(.2);assert.equal(p.navJavelin,true);naval.updateJavelins(.05);assert.equal(p.navJavelin,false);assert.equal(naval.javelins[0].launched,true);assert.equal(p.weapon,weapon);
});
test('a cancelled windup keeps the javelin; death clears it',()=>{
 const {naval,p}=rangeReady();naval.throwJavelin();p.action='hurt';naval.updateJavelins(.1);assert.equal(naval.javelins.length,0);assert.equal(p.navJavelin,true);
 p.action='idle';naval.throwJavelin();p.hp=0;naval.updateJavelins(.1);assert.equal(naval.javelins.length,0);assert.equal(p.navJavelin,false);
});
test('a cirit crosses water, ignores allies, damages the target and never creates loot',()=>{
 const {naval,combat,p}=rangeReady(),target=combat.fighters[5],ally=combat.fighters[1];Object.assign(ally,{x:p.x+5,z:p.z});
 const hp=target.hp,allyHp=ally.hp,drops=combat.drops.length;naval.throwJavelin();for(let i=0;i<100;i++)naval.updateJavelins(1/60);
 assert.ok(target.hp<hp);assert.equal(ally.hp,allyHp);assert.equal(naval.javelins.length,0);assert.equal(combat.drops.length,drops);assert.equal(p.navJavelin,false);
});
test('a missed cirit expires at range instead of appearing on a deck',()=>{
 const {naval,combat,p}=rangeReady();naval.throwJavelin();combat.fighters[5].z+=10;const hp=combat.fighters[5].hp;
 for(let i=0;i<180;i++)naval.updateJavelins(1/60);assert.equal(combat.fighters[5].hp,hp);assert.equal(naval.javelins.length,0);assert.equal(combat.drops.length,0);assert.equal(p.weapon,'gladius');
});
test('an airborne opponent is not hit by a low projectile and a finished match freezes it',()=>{
 const {naval,combat}=rangeReady(),target=combat.fighters[5],hp=target.hp;target.navHeight=1.2;naval.throwJavelin();for(let i=0;i<100;i++)naval.updateJavelins(1/60);assert.equal(target.hp,hp);
 const f=rangeReady();f.naval.throwJavelin();f.combat.finished=true;f.combat.tick(.05,{});assert.equal(f.naval.javelins[0].age,0);
});

test('a boarding bridge cannot land inside a javelin rack',()=>{const {naval}=moored();naval.ships[1].z=-C.rackZ;assert.equal(naval.candidate(0,1),null);});
