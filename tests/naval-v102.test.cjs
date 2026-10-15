const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../naval-simulation-v97.js'),C=N.constants;
const {fixture,moored}=require('./naval-fixture.cjs');
test('three wide boarding stations on either side accept a complete crossing',()=>{
 for(const side of [-1,1])for(const station of C.bridgeStations){
  const {naval,p}=moored();naval.ships[1].x=side*8;Object.assign(p,{x:side*2.1,z:station});
  assert.equal(naval.interaction().station,station);
  const b=naval.open(0,side,station);assert.ok(b);b.phase='open';b.progress=1;
  for(let x=2.1;x<6.6;x+=.08){p.x=side*x;naval.bound(p);}
  assert.equal(p.shipId,1);assert.ok(N.onDeck(naval.ships[1],p));assert.equal(p.navBridge,null);
 }
});
test('parallel bridges can coexist and bots distribute between them',()=>{
 const {naval,combat}=moored();
 for(const z of C.bridgeStations){const b=naval.open(0,1,z);assert.ok(b);b.phase='open';b.progress=1;}
 assert.equal(naval.bridges.length,3);
 for(const f of combat.fighters.filter(f=>f.team===0&&f.id!==0))naval.botStep(f,1/60,()=>{});
 assert.ok(new Set(combat.fighters.slice(1,5).map(f=>f.navRouteBridge)).size>=2);
});
test('an empty boarding connection retracts when the helmsman steers away',()=>{
 const {naval,combat}=moored();naval.goal=s=>({...s});const b=naval.open(0,1);b.phase='open';b.progress=1;
 naval.takeHelm();for(const f of combat.fighters)if(f.id!==0)Object.assign(f,N.world(naval.ships[f.shipId],0,-2));
 const before={...naval.ships[0]};for(let i=0;i<120;i++)naval.step(1/60,{navalThrottle:1});
 assert.equal(b.phase,'closed');assert.ok(Math.hypot(naval.ships[0].x-before.x,naval.ships[0].z-before.z)>.5);
 assert.equal(naval.candidate(1,-1),null,'an enemy must not immediately relatch a departing ship');
});
test('departure waits for a crossing gladiator, then releases the ships',()=>{
 const {naval,combat}=moored();naval.goal=s=>({...s});const b=naval.open(0,1);b.phase='open';b.progress=1;naval.takeHelm();
 const bot=combat.fighters[1];Object.assign(bot,{x:4,z:0,navBridge:b.id});const before={...naval.ships[0]};
 for(let i=0;i<60;i++)naval.step(1/60,{navalThrottle:1});
 assert.equal(b.phase,'open');assert.equal(naval.ships[0].z,before.z);
 Object.assign(bot,{shipId:1,navBridge:null,x:8,z:-2});for(let i=0;i<120;i++)naval.step(1/60,{navalThrottle:1});
 assert.equal(b.phase,'closed');assert.ok(naval.ships[0].z>before.z+.5);
});
test('the receiving crew can retract a vacant bridge from its landing',()=>{
 const {naval,p}=moored(),b=naval.open(0,1);b.phase='open';b.progress=1;
 Object.assign(p,{shipId:1,x:6.4,z:0});const action=naval.interaction();assert.equal(action.kind,'close');assert.equal(action.bridge,b.id);
});
test('slightly staggered and angled decks receive a fully supported bridge',()=>{
 const {naval}=moored();Object.assign(naval.ships[1],{x:8.5,z:.4,angle:.15});const b=naval.candidate(0,1);assert.ok(b);assert.ok(b.length>=3.2);
 for(const x of [-.5,0])for(const z of [-1,1])assert.ok(N.onDeck(naval.ships[1],N.world(naval.ships[0],C.halfWidth+b.length+x,b.station+z*C.bridgeWidth/2),.12));
});
test('the measured wall, including its oval shape, replaces the invisible circle',()=>{
 const segments=[],count=360;for(let i=0;i<count;i++){const point=k=>({x:65*Math.cos(k*Math.PI*2/count),z:45*Math.sin(k*Math.PI*2/count)});segments.push([point(i),point(i+1)]);}
 const boundary=N.measureBoundary(segments);assert.equal(boundary.length,180);
 const {naval}=fixture();assert.ok(naval.setBoundary(boundary));assert.ok(naval.wallRadius(0)>64);assert.ok(naval.wallRadius(Math.PI/2)<45.01);
 for(const angle of [0,.4,1.2,2.8]){
  const ship=naval.ships[0];Object.assign(ship,{x:80*Math.cos(angle),z:80*Math.sin(angle),angle});
  for(let i=0;i<6;i++)naval.boundShip(ship);
  for(const p of naval.hullPoints(ship))assert.ok(Math.hypot(p.x,p.z)<=naval.wallRadius(Math.atan2(p.z,p.x))+.001);
 }
 assert.equal(naval.setBoundary([NaN]),false);assert.equal(N.measureBoundary([]),null);
});
test('the broadside can approach the wall without the old nine-metre centre buffer',()=>{
 const {naval}=fixture(),ship=naval.ships[0];Object.assign(ship,{x:C.arenaRadius,z:0,angle:0});for(let i=0;i<6;i++)naval.boundShip(ship);
 assert.ok(ship.x>C.arenaRadius-5);for(const p of naval.hullPoints(ship))assert.ok(Math.hypot(p.x,p.z)<C.arenaRadius);
});
test('cirit preview shares the launched projectile direction and height',()=>{
 const {naval,p,combat}=moored();p.navJavelin=true;combat.lockedTarget=5;const aim=naval.javelinAim();assert.equal(aim.target,5);assert.ok(naval.throwJavelin());
 const n=naval.javelins[0];assert.equal(n.dx,aim.dx);assert.equal(n.dz,aim.dz);naval.updateJavelins(.25);
 const q=naval.javelinPoint(aim,n.travel);assert.ok(Math.abs(n.x-q.x)<1e-8&&Math.abs(n.z-q.z)<1e-8&&Math.abs(n.y-q.y)<1e-8);assert.equal(naval.javelinAim(),null);
});
test('complete bot crews retain their combat equipment and receive no fabricated loot',()=>{
 const {naval,combat}=fixture();assert.deepEqual(naval.ships.map(s=>combat.fighters.filter(f=>f.team===s.team).length),[5,5,5,5]);
 assert.equal(naval.player().navalUniform,undefined);for(const f of combat.fighters.slice(1)){assert.ok(f.navalUniform);assert.ok(f.weapon);}
});
