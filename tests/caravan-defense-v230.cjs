const assert=require('node:assert/strict'),fs=require('node:fs');
require('../caravan-core-v126.js');require('../combat-curves-v163.js');require('../combat-motion-v163.js');const S=require('../caravan-defense-simulation-v230.js');
const ticket=JSON.parse(fs.readFileSync('/tmp/defense-ticket-v230.json'));const idle=[0,0,0,0,0,0];
const initial=S.create(ticket),c=initial.combat,worker=c.fighters.find(f=>f.worker);
assert.equal(c.fighters[0].team,0);assert.equal(worker.team,0);assert.equal(worker.arrowDamage,ticket.workers[0].base_damage);assert.equal(worker.arrowsLeft,ticket.workers[0].arrows);
assert.equal(c.fighters.filter(f=>f.team===1).length,ticket.encounter.guards);
// Friendly units are skipped by arrows, and level damage reaches the actual hit.
for(const damage of [9,28]){
 const t=structuredClone(ticket);t.workers[0].base_damage=damage;const state=S.create(t),c=state.combat,w=c.fighters.find(f=>f.worker),enemy=c.fighters.find(f=>f.team===1),ally=c.fighters[0],hits=[];
 c.botStep=()=>{};c.guard=()=>false;c.damage=(a,b,n)=>hits.push({from:a.id,to:b.id,damage:n});
 ally.x=enemy.x=4;ally.z=enemy.z=13;c.arrows=[{owner:w.id,x:4,z:13,dx:0,dz:0,age:0}];S.step(state,idle);
 assert.deepEqual(hits,[{from:w.id,to:enemy.id,damage}]);
}
const t=structuredClone(ticket);t.workers[0].arrows=1;const s=S.create(t),w=s.combat.fighters.find(f=>f.worker);for(const f of s.combat.fighters)if(!f.worker){f.hp=f.maxHp=100000;f.x=4;f.z=12;}s.combat.attack=()=>{};s.combat.damage=()=>{};for(let i=0;i<360;i++)S.step(s,idle);assert.equal(w.arrowsLeft,0);assert.equal(w.pendingArrow,null,'an empty quiver cannot fire again');
const snapshot=s=>({result:s.combat.result,steps:s.steps,f:s.combat.fighters.map(f=>[f.hp,f.x,f.z,f.arrowsLeft])});
const battle=S.create(ticket);while(!battle.combat.finished){S.step(battle,[0,0,0,1,0,0]);battle.combat.drain();}assert.deepEqual(snapshot(S.replay(ticket,battle.commands,battle.steps)),snapshot(battle));
assert.throws(()=>S.replay(ticket,battle.commands,battle.steps+1));assert.throws(()=>S.replay(ticket,[[0,0,0,999999,0,0]],1));
for(const f of ['caravan-core-v126.js','combat-curves-v163.js','combat-motion-v163.js','caravan-defense-simulation-v230.js'])assert.equal(fs.readFileSync(f,'utf8'),fs.readFileSync('supabase/functions/caravan-defense-v230/'+f,'utf8'),'server/client '+f);
console.log('V230 simulation PASS: allied workers, level-based arrow hits, no friendly fire, finite ammunition, deterministic battle replay and identical server rules.');
