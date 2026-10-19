const assert=require('node:assert/strict'),fs=require('node:fs');
require('../caravan-core-v126.js');const S=require('../caravan-simulation-v127.js'),old=require('../caravan-simulation-v126.js');
const ticket=structuredClone(JSON.parse(fs.readFileSync('/tmp/raid-state-v126.json')).active);ticket.encounter.rules=127;
ticket.team[0].items=[{kind:'weapon',model:'spear',equipped_slot:'main_hand',enhancement:3},{kind:'shield',model:'small',equipped_slot:'off_hand'}];
const fresh=()=>{const s=S.create(ticket);s.combat.fighters[0].pickupHand='weapon';return s;},idle=[0,0,3142,0,0,0];
assert.ok(S.valid(S.packet({region:'head',guardRegion:'leftArm',flags:255})));
for(const p of [[0,0,0,0],[101,0,0,0,0,0],[0,0,0,256,0,0],[0,0,0,0,7,0],[0,0,0,0,0,8],[0,0,0,NaN,0,0]])assert.equal(S.valid(p),false);
assert.throws(()=>S.create({...ticket,encounter:{...ticket.encounter,rules:126}}));
{
 const s=fresh(),c=s.combat,p=c.fighters[0],d=c.dropWeapon(p);assert.equal(p.weapon,null);assert.equal(d.kind,'spear');assert.equal(d.itemEntry.item.enhancement,3);
 p.x=d.x+3;assert.equal(c.nearestDrop(0),null);assert.equal(c.pickup(0,d.id),false);
 p.x=d.x;p.z=d.z;p.stunUntil=1;assert.equal(c.pickup(0,d.id),false);p.stunUntil=0;
 S.step(s,[0,0,3142,32,0,0]);assert.equal(p.weapon,'spear');assert.equal(p.equipment.weapon.item.enhancement,3);assert.equal(c.drops.some(x=>x.id===d.id),false);assert.equal(c.pickup(0,d.id),false);
 c.wearEquipment(p,'weapon',1000);assert.equal(p.weapon,null);assert.ok(c.drops.length);assert.equal(c.drops.at(-1).durability,20);
}
{
 const s=fresh(),c=s.combat,p=c.fighters[0];S.step(s,[0,0,3142,64,0,0]);assert.equal(p.pickupHand,'offhand');S.step(s,idle);S.step(s,idle);S.step(s,[0,0,3142,128,0,0]);assert.ok(c.lockedTarget>=ticket.team.length);
}
{
 const s=fresh(),c=s.combat,p=c.fighters[0],enemy=c.fighters[ticket.team.length];enemy.x=p.x;enemy.z=p.z-3;
 S.step(s,[0,0,3142,8,0,0]);assert.equal(p.weapon,null);assert.equal(c.projectiles.length,1);
 for(let i=0;i<150;i++)S.step(s,idle);assert.ok(c.drops.some(d=>d.kind==='spear')||c.fighters.some(f=>f.weapon==='spear'),'thrown spear returns to the shared pickup system');
}
{
 const s=fresh();S.step(s,[0,0,3142,1,1,0]);assert.equal(s.combat.fighters[0].attackRegion,'head');
 const g=fresh();S.step(g,[0,0,3142,2,0,4]);assert.equal(g.combat.fighters[0].guardRegion,'leftArm');
}
const snapshot=s=>({result:s.combat.result,fighters:s.combat.fighters.map(f=>({hp:f.hp,stamina:f.stamina,weapon:f.weapon,offhand:f.offhand,equipment:f.equipment})),drops:s.combat.drops});
const s=S.create(ticket);while(!s.combat.finished){const flags=s.steps%180===0?128:s.steps%90===0?32:1;S.step(s,[0,0,3142,flags,Math.floor(s.steps/30)%6,0]);s.combat.drain();}
assert.deepEqual(snapshot(S.replay(ticket,s.commands,s.steps)),snapshot(s));
assert.ok(s.combat.drops.length,'defeated fighters leave real equipment');
const legacy={...ticket,encounter:{...ticket.encounter}};delete legacy.encounter.rules;assert.equal(old.create(legacy).combat.allowDrops,false);
console.log('V127 arena PASS: ground pickup distance/stun/ownership, transferred item stats, wear drops, hand and target switching, thrown spear recovery, regional attack/guard, exact replay and frozen V126 support.');
