const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../caravan-core-v126.js');const engine=require('../caravan-simulation-v127.js');
const ticket={encounter:{version:126,rules:127,seed:42,guards:2,archers:1},team:[{id:'fighter-a',name:'A',class:'murmillo',overall:50,items:[]},{id:'fighter-b',name:'B',class:'thraex',overall:50,items:[]}]};
function play(){const s=engine.create(ticket);while(!s.combat.finished){engine.step(s,[0,0,3142,1,0,0]);s.combat.drain();}return s;}
const before=play();require('../rank-telemetry-v200.js');const after=play();
const snapshot=s=>({result:s.combat.result,steps:s.steps,stats:s.combat.stats,fighters:s.combat.fighters.map(f=>({hp:f.hp,stamina:f.stamina,x:f.x,z:f.z}))});
assert.deepEqual(snapshot(after),snapshot(before),'rank telemetry cannot alter combat, RNG or timing');
// Exact attribution without random combat defenses obscuring the assist threshold.
class Combat{constructor(){this.reset();}reset(){this.fighters=[{id:0,team:0,hp:100,maxHp:100},{id:1,team:0,hp:100,maxHp:100},{id:2,team:1,hp:100,maxHp:100},{id:3,team:2,hp:100,maxHp:100}];this.stats={};}damage(a,v,n){const damage=Math.min(v.hp,n);v.hp-=damage;return damage>0;}damageProjectileV10(a,v,p,n){return this.damage(a,v,n);}}
const c={ArenaCombat:Combat,Map,WeakMap};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../rank-telemetry-v200.js'),'utf8'),c);
const game=new Combat(),[a,b,v,other]=game.fighters;
game.damageProjectileV10(a,v,{},15);game.damage(b,v,85);assert.equal(c.LudusRankTelemetry.assists(game),1,'projectile contribution counted once');
game.damage(b,v,100);assert.equal(c.LudusRankTelemetry.assists(game),1,'no duplicate credit on dead target');
game.reset();let [x,y,z]=game.fighters;game.damage(x,z,9);game.damage(y,z,100);assert.equal(c.LudusRankTelemetry.assists(game),0,'under 10% does not qualify');
game.reset();[x,y,z]=game.fighters;game.damage(x,z,20);game.damage(game.fighters[3],z,100);assert.equal(c.LudusRankTelemetry.assists(game),0,'opposing team final hit does not award assist');
const edge={ArenaCombat:class extends Combat{},Map};vm.createContext(edge);vm.runInContext(fs.readFileSync(require.resolve('../supabase/functions/caravan-combat-v126/career-combat-v162.js'),'utf8'),edge);
const ec=new edge.ArenaCombat(),ea=ec.fighters[0],eb=ec.fighters[1],ev=ec.fighters[2];ec.damage(ea,ev,15);ec.damage(eb,ev,85);
const result=edge.CaravanCareer.participants({ticket,combat:ec});assert.equal(result[0].assists,1);assert.equal(result[0].kills,0);assert.equal(result[1].kills,1);
console.log('PASS V200 assists: melee/projectile attribution, 10% threshold, team identity, dead targets, reset, deterministic replay and unchanged combat.');
