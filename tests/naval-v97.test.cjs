const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../naval-simulation-v97.js'),C=N.constants;
const {fixture,moored}=require('./naval-fixture.cjs');
test('four crews of five start on four decks, with four bot helmsmen and twice the V100 water area',()=>{
 const {combat,naval}=fixture();assert.equal(combat.fighters.length,20);assert.equal(naval.ships.length,4);assert.ok(Math.abs((C.arenaRadius/34.2)**2-2)<1e-12);
 for(const s of naval.ships){assert.equal(combat.fighters.filter(f=>f.shipId===s.id).length,5);assert.ok(s.helm>0);for(const f of combat.fighters.filter(f=>f.shipId===s.id))assert.ok(N.onDeck(s,f));}
});
test('player takes and releases the helm; a living teammate immediately resumes control',()=>{
 const {combat,naval,p}=fixture();assert.ok(naval.takeHelm());assert.equal(naval.ships[0].helm,0);
 const before={...naval.ships[0]};for(let i=0;i<60;i++)combat.tick(1/60,{navalThrottle:1,navalSteer:.3});assert.ok(Math.hypot(naval.ships[0].x-before.x,naval.ships[0].z-before.z)>.5);
 assert.ok(naval.releaseHelm());assert.ok(naval.ships[0].helm>0&&naval.ships[0].helm<5);assert.equal(naval.manual,false);assert.equal(p.shipId,0);
});
test('takeover is denied from another ship, while stunned, or after death',()=>{
 const {naval,p,combat}=fixture();p.shipId=1;assert.equal(naval.takeHelm(),false);p.shipId=0;p.stunUntil=combat.time+2;assert.equal(naval.takeHelm(),false);p.stunUntil=0;p.hp=0;assert.equal(naval.takeHelm(),false);
});
test('a dead captain is replaced, and an empty crew stops safely',()=>{
 const {naval,combat}=fixture();const first=naval.ships[0].helm;combat.fighters[first].hp=0;naval.assignCaptain(naval.ships[0]);assert.notEqual(naval.ships[0].helm,first);
 for(let i=1;i<5;i++)combat.fighters[i].hp=0;naval.step(1/60);assert.equal(naval.ships[0].helm,null);assert.equal(naval.ships[0].speed,0);
});
test('the player death also hands the helm to a surviving teammate',()=>{const {naval,p}=fixture();naval.takeHelm();p.hp=0;naval.afterStep();assert.equal(naval.manual,false);assert.ok(naval.ships[0].helm>0);});
test('an incapacitated helmsman relinquishes control to an able teammate',()=>{
 const {naval,p,combat}=fixture();naval.takeHelm();p.stunUntil=combat.time+2;p.action='knocked';naval.afterStep();assert.equal(naval.manual,false);
 const captain=naval.ships[0].helm;assert.ok(captain>0);combat.fighters[captain].stunUntil=2;naval.assignCaptain(naval.ships[0]);assert.notEqual(naval.ships[0].helm,captain);
});
test('cached corpse and roll poses follow deck translation and rotation',()=>{
 const {naval,p}=fixture(),s=naval.ships[0],point=N.world(s,1,-2),m={root:{position:{...point,y:.1},rotation:{y:.3}},fallTransition:{...point,heading:.3},rollTransition:{heading:.4}};
 naval.carryPose(p,m);s.x+=2;s.z-=3;s.angle+=.5;naval.carryPose(p,m);const expected=N.world(s,1,-2);
 assert.ok(Math.hypot(m.root.position.x-expected.x,m.root.position.z-expected.z)<1e-8);assert.equal(m.root.position.y,.1);assert.equal(m.fallTransition.heading,.8);assert.equal(m.rollTransition.heading,.9);
 assert.ok(Math.hypot(m.fallTransition.x-expected.x,m.fallTransition.z-expected.z)<1e-8);
});
test('collisions cannot push a hull outside the enlarged arena',()=>{
 const {naval,combat}=fixture(),limit=C.arenaRadius-Math.hypot(C.hullLength,C.hullWidth)-.3;
 Object.assign(naval.ships[0],{x:limit-.1,z:0});Object.assign(naval.ships[1],{x:limit-5,z:0});
 naval.takeHelm();for(let i=0;i<600;i++){naval.step(1/60,{navalThrottle:1,navalSteer:.2});for(const s of naval.ships)for(const p of naval.hullPoints(s))assert.ok(Math.hypot(p.x,p.z)<=naval.wallRadius(Math.atan2(p.z,p.x))+.001);}
});
test('the added water is navigable beyond the old hull boundary',()=>{
 const {naval}=fixture();Object.assign(naval.ships[0],{x:34,z:0,speed:0});naval.takeHelm();naval.step(1/60,{});
 assert.ok(naval.ships[0].x>33.9);assert.ok(Math.hypot(naval.ships[0].x,naval.ships[0].z)+Math.hypot(C.hullLength,C.hullWidth)<C.arenaRadius);
});
test('landing requires the whole end of the board, parallel decks, and low speed',()=>{
 const {naval}=moored(),t=naval.ships[1];assert.equal(naval.candidate(0,1)?.to,1);assert.equal(naval.candidate(0,-1),null);
 for(const change of [{x:16},{x:5},{z:5.3},{angle:.4},{speed:.6},{turn:.2}]){const original={...t};Object.assign(t,change);assert.equal(naval.candidate(0,1),null,JSON.stringify(change));Object.assign(t,original);}
});
test('the action is visible only near a valid bridge station; the click revalidates the target',()=>{
 const {naval,p}=moored();assert.equal(naval.interaction()?.kind,'open');p.x=0;p.z=4;assert.equal(naval.interaction(),null);p.x=2.1;p.z=0;naval.ships[1].z=12;assert.equal(naval.operate(),false);assert.equal(naval.bridges.length,0);
});
test('another hull blocks a bridge even if the distant landing looks valid',()=>{const {naval}=moored();Object.assign(naval.ships[2],{x:5,z:0,angle:Math.PI/2});assert.equal(naval.candidate(0,1),null);});
test('both port and starboard gates validate independently',()=>{const {naval,p}=moored();naval.ships[1].x=-8;p.x=-2.1;assert.equal(naval.interaction()?.side,-1);assert.ok(naval.operate());assert.equal(naval.bridges[0].side,-1);assert.equal(naval.candidate(0,1),null);});
test('an opening bridge locks both ships and cannot be opened twice',()=>{
 const {naval,p,combat}=moored(),b=naval.open(0,1);assert.ok(b);assert.equal(naval.open(0,1),null);assert.equal(naval.open(1,-1),null);
 const before=naval.ships.slice(0,2).map(s=>[s.x,s.z,s.angle]);naval.takeHelm();Object.assign(combat.fighters[1],{x:3.7,z:0,navBridge:b.id});for(let i=0;i<60;i++)naval.step(1/60,{navalThrottle:1,navalSteer:1});assert.deepEqual(naval.ships.slice(0,2).map(s=>[s.x,s.z,s.angle]),before);assert.equal(b.phase,'open');
});
test('a bridge only becomes walkable after it finishes opening',()=>{
 const {naval,p}=moored(),b=naval.open(0,1);p.x=3.4;naval.bound(p);assert.ok(p.x<C.halfWidth);
 b.progress=1;b.phase='open';p.x=3.4;naval.bound(p);assert.equal(p.x,3.4);assert.equal(p.navBridge,b.id);
});
test('boarding updates ship ownership and a used bridge cannot retract',()=>{
 const {naval,p}=moored(),b=naval.open(0,1);b.progress=1;b.phase='open';
 for(let x=2.1;x<=6.5;x+=.1){p.x=x;naval.bound(p);if(x>3&&x<5){assert.equal(naval.close(b.id),false);assert.equal(b.phase,'open');}}
 assert.equal(p.shipId,1);assert.equal(p.navBridge,null);assert.ok(N.onDeck(naval.ships[1],p));
});
test('without a bridge neither walking nor a large displaced point can cross water',()=>{const {naval,p}=moored();p.x=8;naval.bound(p);assert.equal(p.shipId,0);assert.ok(N.onDeck(naval.ships[0],p));});
test('navigation finds a connected route across multiple vessels',()=>{
 const {naval}=moored();Object.assign(naval.ships[2],{x:16,z:0,angle:0});for(const [id,side]of [[0,1],[1,1]]){const b=naval.open(id,side);assert.ok(b);b.phase='open';b.progress=1;}
 assert.equal(naval.route(0,2).length,2);assert.equal(naval.route(0,3),null);
});
test('autopilots, boarding and real combat run without leaving any deck or bridge',()=>{
 const {naval,combat}=fixture();let opened=0,boarded=0;
 for(let i=0;i<60*150&&!combat.finished;i++){
   combat.tick(1/60,{});opened=Math.max(opened,naval.bridges.filter(b=>b.phase==='open').length);boarded=Math.max(boarded,combat.fighters.filter(f=>f.shipId!==f.team).length);
   for(const f of combat.fighters){assert.ok(Number.isFinite(f.x)&&Number.isFinite(f.z));assert.ok(N.onDeck(naval.ships[f.shipId],f)||naval.bridges.some(b=>b.phase==='open'&&naval.onBridge(b,f)),`unsupported fighter ${f.id} at ${f.x},${f.z}`);}
 }
 assert.ok(opened>=2,'multiple opponents must open boarding routes');assert.ok(boarded>0,'bots must use the routes');assert.ok(combat.finished,'the match must be able to finish');
});
