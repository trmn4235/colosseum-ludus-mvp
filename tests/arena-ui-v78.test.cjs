const {test}=require('node:test'),assert=require('node:assert/strict');
const {runtime,fixture}=require('./combat-stats-v73.cjs');
const result=require('../arena-results-v78.js'),render=require('../arena-render-profile-v78.js');
for(const page of ['arena.html','savas.html','multiplayer.html']){
 test(page+' records received damage and elimination without counting overkill',()=>{
  const c=runtime(page),{sim,a,v}=fixture(c);sim.mode='solo20';a.hp=7;sim.damage(v,a,10000);
  assert.equal(sim.stats.damageTaken,7);assert.equal(sim.stats.placement,2);assert.equal(sim.stats.kills,0);
  const fresh=fixture(c);fresh.v.hp=3;fresh.sim.damage(fresh.a,fresh.v,10000);assert.equal(fresh.sim.stats.damage,3);assert.equal(fresh.sim.stats.kills,1);
 });
 test(page+' successful passive evade adds no received damage',()=>{
  const c=runtime(page),{sim,a,v}=fixture(c,0);a.itemStats={dodge_rate:20};sim.damage(v,a,100);
  assert.equal(sim.stats.damageTaken,0);assert.equal(sim.stats.kills,0);assert.equal(a.hp,100);
 });
}
test('reward rows use the acknowledged amounts and stone name',()=>{
 const rows=result.rewardRows({gold:100,ludus_exp:100,diamonds:1,stone:{name:'Zümrüt IV'},kind:'legs',extracted:[{},{}]});
 assert.equal(rows.find(r=>r.label==='Zümrüt IV').value,'1');assert.equal(rows.find(r=>r.label==='Envantere dönen ekipman').value,'2');
 assert.deepEqual(result.rewardRows({gold:0,diamonds:0}),[]);
});
test('touch default reduces pixels, with detailed and fluent choices retained',()=>{
 const mobile=render.resolve('auto',3,true),desktop=render.resolve('auto',2,false),high=render.resolve('high',3,true),low=render.resolve('low',3,true);
 assert.equal(mobile.dpr,1.25);assert.equal(mobile.shadows,true);assert.equal(desktop.dpr,1.6);assert.equal(high.dpr,1.6);assert.equal(low.shadows,false);assert.equal(low.dpr,1);
 assert.ok(1-mobile.dpr**2/high.dpr**2>.38);
});

const vm=require('node:vm'),fs=require('node:fs');
test('wall torches follow room depth for zero to thirty beds without floor obstacles',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../ludus-rest-v64.js'),'utf8'),c);
 for(const count of [0,1,2,3,5,30]){const l=c.LudusRestRoom.layout(count);assert.equal(l.torches.length,4);assert.ok(l.torches.every(t=>Math.abs(t.x)>4.5||Math.abs(t.z-l.centerZ)>l.depth/2-.4));assert.ok(l.torches.slice(2).every(t=>Math.abs(t.z-l.centerZ)<1e-6));assert.ok(l.beds.every(b=>b.z>4.5-l.depth+.4&&b.z<4.1));}
});
