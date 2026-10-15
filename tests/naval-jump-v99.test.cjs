const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../naval-simulation-v97.js'),C=N.constants,{moored}=require('./naval-fixture.cjs');
function setup(){const f=moored();f.naval.goal=s=>({...s});f.naval.botStep=()=>{};return f;}
function run(f,seconds,input={}){for(let t=0;t<seconds;t+=1/60)f.combat.tick(1/60,input);}

test('port and starboard jumps select a clear point inside the other deck',()=>{
 for(const side of [-1,1]){const {naval,p}=setup();naval.ships[1].x=side*8;p.x=side*2.1;
  const hit=naval.jumpCandidate();assert.equal(hit?.to,1);assert.equal(hit.side,side);assert.ok(N.onDeck(naval.ships[1],hit.end,.6));assert.ok(Math.hypot(hit.end.x-p.x,hit.end.z-p.z)<=C.jumpRange);
 }
});

test('no jump is offered from the centre, across a long gap, or during unsafe ship motion',()=>{
 const {naval,p}=setup();p.x=0;assert.equal(naval.jumpCandidate(),null);p.x=2.1;
 for(const change of [{x:10},{speed:3},{turn:.5}]){const old={...naval.ships[1]};Object.assign(naval.ships[1],change);assert.equal(naval.jumpCandidate(),null);Object.assign(naval.ships[1],old);}
 naval.ships[1].vx=3;assert.equal(naval.jumpCandidate(),null);
});

test('low stamina, death, stun, attack, a bridge and manual helm prevent jumping',()=>{
 for(const state of [{stamina:19},{hp:0},{stunUntil:1},{action:'attack'},{navBridge:1}]){const f=setup();Object.assign(f.p,state);assert.equal(f.naval.jump(),false);assert.equal(f.p.navJump,null);}
 const f=setup();f.naval.takeHelm();assert.equal(f.naval.jump(),false);
});

test('the press rechecks the landing and never spends stamina on an invalid jump',()=>{
 const {naval,p}=setup(),stamina=p.stamina;assert.ok(naval.jumpCandidate());naval.ships[1].x=12;assert.equal(naval.jump(),false);assert.equal(p.stamina,stamina);
});

test('one press spends stamina once, takes a real airborne arc and lands without a bridge',()=>{
 const f=setup(),{naval,p,combat}=f,stamina=p.stamina;assert.ok(naval.jump());const target={...p.navJump.landing};
 assert.equal(p.stamina,stamina-C.jumpCost);assert.equal(naval.jump(),false);assert.equal(combat.attack(0),false);assert.equal(combat.dodge(0,1,0),false);assert.equal(naval.takeHelm(),false);assert.equal(naval.interaction(),null);
 run(f,.45,{x:-1,z:1,block:true});assert.ok(p.navHeight>1);assert.ok(p.x>3&&p.x<5.8);assert.equal(p.shipId,0);assert.equal(p.blocking,false);
 run(f,.42);assert.equal(p.shipId,1);assert.equal(p.navJump,null);assert.equal(p.navHeight,0);assert.ok(N.onDeck(naval.ships[1],p));
 const landed=N.local(naval.ships[1],p);assert.ok(Math.hypot(landed.x-target.x,landed.z-target.z)<1e-8);assert.equal(naval.bridges.length,0);assert.equal(p.action,'navalLand');
 run(f,.35);assert.equal(p.action,'idle');assert.equal(combat.drain().filter(e=>e.type==='navalland').length,1);
});

test('a moving and rotating target carries the landing point without a frame teleport',()=>{
 const f=setup(),{naval,p}=f;
 naval.goal=s=>s.id===1?{x:s.x,z:s.z+.5,angle:s.angle+.002}:s.id===0?{x:s.x,z:s.z+.2,angle:s.angle}:({...s});
 f.combat.tick(1/60,{});assert.ok(naval.jump());let previous={x:p.x,z:p.z};let apex=0;
 for(let i=0;i<54;i++){f.combat.tick(1/60,{});assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<.25);previous={x:p.x,z:p.z};apex=Math.max(apex,p.navHeight);}
 assert.equal(p.shipId,1);assert.ok(apex>1);assert.ok(N.onDeck(naval.ships[1],p));assert.ok(naval.ships[1].z>.5);assert.ok(naval.ships[1].angle>0);
});

test('rotated decks use their local coordinates for launch and landing',()=>{
 const f=setup(),{naval,p}=f,s=naval.ships[0];s.angle=.7;Object.assign(naval.ships[1],{...N.world(s,8,0),angle:.7});
 for(const a of f.combat.fighters)Object.assign(a,N.world(naval.ships[a.shipId],a.id%2?1:-1,a.id%5-2));Object.assign(p,N.world(s,2.1,0));
 assert.ok(naval.jump());run(f,1.1);assert.equal(p.shipId,1);assert.ok(N.onDeck(naval.ships[1],p));
});

test('a third hull and an occupied landing cannot be jumped through',()=>{
 const f=setup();Object.assign(f.naval.ships[2],{x:4,z:0,angle:Math.PI/2});assert.equal(f.naval.jumpCandidate(),null);
 const g=setup();const spots=[];for(const x of [-1.95,-1.3])for(const z of [0,.9,-.9,1.8,-1.8])spots.push(N.world(g.naval.ships[1],x,z));
 for(const [i,a]of g.combat.fighters.slice(1).entries()){a.shipId=1;Object.assign(a,spots[i%spots.length]);}assert.equal(g.naval.jumpCandidate(),null);
});

test('a hit or a disappearing landing during windup cancels safely and refunds the jump',()=>{
 for(const reason of ['hit','landing']){const f=setup(),stamina=f.p.stamina;f.naval.jump();
  if(reason==='hit')f.combat.damage(f.combat.fighters[5],f.p,1);else f.naval.ships[1].x=15;
  run(f,.04);assert.equal(f.p.navJump,null);assert.equal(f.p.navHeight,0);assert.equal(f.p.shipId,0);assert.ok(N.onDeck(f.naval.ships[0],f.p));assert.equal(f.p.stamina,stamina);
 }
});

test('airborne hit and death preserve health effects and do not strand the fighter over water',()=>{
 for(const lethal of [false,true]){const f=setup();f.naval.jump();run(f,.45);const hp=f.p.hp;
  f.combat.damage(f.combat.fighters[5],f.p,lethal?100000:3);assert.ok(f.p.hp<hp);run(f,.6);
  assert.equal(f.p.navJump,null);assert.equal(f.p.navHeight,0);assert.equal(f.p.shipId,1);assert.ok(N.onDeck(f.naval.ships[1],f.p));if(lethal)assert.equal(f.p.hp,0);
 }
});

test('hit-test target heights follow the visible arc and return to deck level',()=>{
 const f=setup(),base=f.context.ArenaMotion.target(f.p,'chest').y;f.naval.jump();run(f,.45);
 assert.ok(Math.abs(f.context.ArenaMotion.target(f.p,'chest').y-base-f.p.navHeight)<1e-8);assert.ok(N.jumpPose(f.p).poses.LeftLeg[0]>.8);
 run(f,.8);assert.equal(f.context.ArenaMotion.target(f.p,'chest').y,base);assert.equal(N.jumpPose(f.p),null);
});

test('large frame delays clamp both combat and jump clocks to the same step',()=>{
 const f=setup();f.naval.jump();f.combat.tick(5,{});assert.equal(f.combat.time,.05);assert.equal(f.naval.time,.05);assert.equal(f.p.navHeight,0);assert.ok(f.p.navJump);
});

test('a cached fall pose follows the airborne fighter and the change of deck',()=>{
 const {naval,p}=setup(),m={root:{position:{x:p.x+.1,y:0,z:p.z},rotation:{y:p.angle}},fallTransition:{x:p.x+.1,z:p.z,heading:p.angle}};
 naval.jump();naval.carryPose(p,m);p.x+=1;p.z+=.3;naval.carryPose(p,m);
 assert.ok(Math.abs(m.fallTransition.x-p.x-.1)<1e-8);assert.ok(Math.abs(m.root.position.z-p.z)<1e-8);
 p.x=6.05;p.shipId=1;p.navJump=null;naval.carryPose(p,m);
 assert.ok(Math.abs(m.fallTransition.x-p.x-.1)<1e-8);assert.equal(m.navalJumpFrame,null);
});
