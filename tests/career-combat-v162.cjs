const assert=require('node:assert/strict');
require('../caravan-core-v126.js');const engine=require('../caravan-simulation-v127.js');
const ticket={encounter:{version:126,rules:127,seed:42,guards:2,archers:1},team:[{id:'fighter-a',name:'A',class:'murmillo',overall:50,items:[]},{id:'fighter-b',name:'B',class:'thraex',overall:50,items:[]}]};
function play(){const s=engine.create(ticket);while(!s.combat.finished){engine.step(s,[0,0,3142,1,0,0]);s.combat.drain();}return s;}
const original=play();require('../supabase/functions/caravan-combat-v126/career-combat-v162.js');const tracked=play();
const snapshot=s=>({result:s.combat.result,steps:s.steps,stats:s.combat.stats,fighters:s.combat.fighters.map(f=>({hp:f.hp,stamina:f.stamina,x:f.x,z:f.z}))});
assert.deepEqual(snapshot(tracked),snapshot(original),'telemetry cannot alter combat, random draws or replay');
assert.deepEqual(CaravanCareer.participants(engine.replay(ticket,tracked.commands,tracked.steps)),CaravanCareer.participants(tracked),'authoritative replay produces identical per-fighter stats');
const s=engine.create(ticket),a=s.combat.fighters[0],b=s.combat.fighters[1],v=s.combat.fighters[2];v.hp=5;v.itemStats={};
s.combat.damage(b,v,100000,'chest',false);const records=CaravanCareer.participants(s);assert.equal(records[0].kills,0);assert.equal(records[1].kills,1);assert.equal(records[1].damage,5,'only actual remaining HP counts');
s.combat.damage(b,v,100000,'chest',false);assert.equal(CaravanCareer.participants(s)[1].kills,1,'already dead targets do not count twice');
console.log('PASS caravan career: individual attribution, capped overkill, no duplicate kill, deterministic replay, combat unchanged');
