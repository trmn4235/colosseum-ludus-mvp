const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../naval-simulation-v97.js'),C=N.constants,{moored}=require('./naval-fixture.cjs');
function setup(){const f=moored();f.naval.goal=s=>({...s});f.naval.ships[1].x=11.4;Object.assign(f.p,{x:C.ropeX,z:C.ropeZ});
 for(const other of f.combat.fighters.filter(o=>o.team!==0)){other.shipId=2;Object.assign(other,N.world(f.naval.ships[2],(other.id%3-1)*1.3,other.id%5-2));}
 const ai=f.naval.botStep.bind(f.naval);f.naval.botStep=(bot,dt)=>{if(bot.team===0)ai(bot,dt,()=>{});};return f;}
function run(f,seconds){for(let t=0;t<seconds;t+=1/60)f.combat.tick(1/60,{});}
test('both mast-side ropes reach a clear deck beyond the ordinary jump range',()=>{
 for(const side of [-1,1]){const {naval,p}=setup();naval.ships[1].x=side*11.4;p.x=side*C.ropeX;
  assert.equal(naval.jumpCandidate(),null);const r=naval.ropeCandidate();assert.equal(r?.to,1);assert.equal(r.side,side);assert.ok(N.onDeck(naval.ships[1],r.end,.7));assert.ok(Math.hypot(r.end.x-p.x,r.end.z-p.z)>C.jumpRange);}
});
test('rope launch requires the mast, an idle grounded fighter, stamina and safe motion',()=>{
 for(const change of [{z:0},{action:'attack'},{hp:0},{stunUntil:1},{stamina:24},{navBridge:3},{navJumpReady:10}]){const f=setup();Object.assign(f.p,change);assert.equal(f.naval.swing(),false);}
 const f=setup();f.naval.takeHelm();assert.equal(f.naval.swing(),false);
 for(const change of [{x:20},{turn:.7},{speed:3}]){const g=setup();Object.assign(g.naval.ships[1],change);assert.equal(g.naval.swing(),false);}
});
test('a third hull and an occupied destination block the rope without charging stamina',()=>{
 const f=setup();Object.assign(f.naval.ships[3],{x:6,z:4,angle:Math.PI/2});const stamina=f.p.stamina;assert.equal(f.naval.swing(),false);assert.equal(f.p.stamina,stamina);
 const g=setup();for(const [i,o]of g.combat.fighters.slice(1).entries()){o.shipId=1;Object.assign(o,N.world(g.naval.ships[1],i%2?-1:-1.8,4.5-Math.floor(i/2)%5*.6));}assert.equal(g.naval.ropeCandidate(),null);
});
test('rope swing spends once, follows a continuous elevated arc and restores ordinary combat',()=>{
 const f=setup();f.naval.botStep=()=>{};const stamina=f.p.stamina;assert.ok(f.naval.swing());assert.equal(f.p.stamina,stamina-25);assert.equal(f.naval.swing(),false);assert.equal(f.combat.attack(0),false);assert.equal(f.naval.takeHelm(),false);
 let last={...f.p},peak=0;for(let i=0;i<102;i++){f.combat.tick(1/60,{});assert.ok(Math.hypot(f.p.x-last.x,f.p.z-last.z)<.25);last={...f.p};peak=Math.max(peak,f.p.navHeight);}
 assert.ok(peak>2);assert.equal(f.p.shipId,1);assert.equal(f.p.navJump,null);assert.equal(f.p.navHeight,0);assert.ok(N.onDeck(f.naval.ships[1],f.p));run(f,.4);assert.equal(f.p.action,'idle');assert.equal(f.combat.drain().filter(e=>e.type==='navalrope').length,1);
});
test('the rope follows a moving rotated destination and reserves its landing',()=>{
 const f=setup();f.naval.botStep=()=>{};Object.assign(f.combat.fighters[5],{shipId:1,x:11.4,z:-3});f.naval.goal=s=>s.id===1?{x:s.x,z:s.z+.5,angle:s.angle+.002}:s;f.combat.tick(1/60,{});assert.ok(f.naval.swing());
 const other=f.combat.fighters[1];Object.assign(other,{x:C.ropeX,z:C.ropeZ});assert.equal(f.naval.swing(other,1),false,'one fighter per physical rope');run(f,1.8);assert.equal(f.p.shipId,1);assert.ok(N.onDeck(f.naval.ships[1],f.p));assert.ok(f.naval.ships[1].z>.5);
});
test('interrupted windup refunds the rope; an airborne hit or death cannot strand the actor',()=>{
 const f=setup();f.naval.botStep=()=>{};const stamina=f.p.stamina;f.naval.swing();f.combat.damage(f.combat.fighters[5],f.p,1);run(f,.04);assert.equal(f.p.navJump,null);assert.equal(f.p.stamina,stamina);assert.equal(f.p.shipId,0);
 for(const lethal of [false,true]){const g=setup();g.naval.botStep=()=>{};g.naval.swing();run(g,.8);assert.ok(N.jumpPose(g.p).poses.LeftArm[0]<-2);g.combat.damage(g.combat.fighters[5],g.p,lethal?100000:3);if(!lethal)g.combat.knock(g.p,1.2);run(g,.03);assert.equal(g.p.navJump.released,true);run(g,1);assert.equal(g.p.navJump,null);assert.equal(g.p.shipId,1);assert.equal(g.p.navHeight,0);assert.ok(N.onDeck(g.naval.ships[1],g.p));}
});
test('rally brings all four living teammates, including the captain, to the player',()=>{
 const f=setup();f.p.x=0;f.p.z=2;assert.ok(f.naval.toggleRally());run(f,6);assert.equal(f.naval.rallyStatus().near,4);assert.equal(f.naval.rallyStatus().total,4);assert.ok(f.naval.toggleRally());assert.equal(f.naval.rally,false);
});
test('rally followers use an available bridge instead of teleporting',()=>{
 const f=setup();f.naval.ships[1].x=8;Object.assign(f.p,{shipId:1,x:8,z:2});assert.ok(f.naval.toggleRally());let crossedBridge=false;
 for(let i=0;i<900;i++){f.combat.tick(1/60,{});crossedBridge||=f.combat.fighters.slice(1,5).some(o=>o.navBridge);}
 assert.ok(crossedBridge);assert.ok(f.naval.bridges.some(b=>b.phase==='open'));assert.equal(f.naval.rallyStatus().near,4);
});
test('rally crew can follow the player over water using the mast ropes in sequence',()=>{
 const f=setup();Object.assign(f.p,{shipId:1,x:11.4,z:2});assert.ok(f.naval.toggleRally());run(f,30);
 assert.deepEqual(Array.from(f.combat.fighters.slice(1,5),o=>o.shipId),[1,1,1,1]);assert.equal(f.naval.rallyStatus().near,4);assert.ok(f.combat.drain().filter(e=>e.type==='navalrope').length>=4);assert.equal(f.naval.bridges.length,0);
});
test('an unreachable recall waits on a safe deck; player death ends the order',()=>{
 const f=setup();Object.assign(f.naval.ships[1],{x:30});Object.assign(f.p,{shipId:1,x:30,z:2});f.naval.toggleRally();run(f,8);
 assert.ok(f.combat.fighters.slice(1,5).every(o=>o.shipId===0&&!o.navJump&&N.onDeck(f.naval.ships[0],o)));f.p.hp=0;run(f,.1);assert.equal(f.naval.rally,false);assert.equal(f.naval.toggleRally(),false);
});
test('recall changes only allied orders, refuses an empty crew, and respects the finished match',()=>{
 const f=setup(),target=f.combat.fighters[5];target.target=19;f.naval.toggleRally();assert.equal(target.target,19);f.combat.finished=true;assert.equal(f.naval.toggleRally(),false);const g=setup();g.combat.fighters.slice(1,5).forEach(o=>o.hp=0);assert.equal(g.naval.toggleRally(),false);
});
test('both transfer clocks stay bounded on a delayed frame and hit heights follow the rope',()=>{
 const f=setup();f.naval.swing();f.combat.tick(5,{});assert.equal(f.naval.time,.05);assert.equal(f.combat.time,.05);const base=f.context.ArenaMotion.target(f.p,'chest').y;run(f,.7);assert.ok(Math.abs(f.context.ArenaMotion.target(f.p,'chest').y-base-f.p.navHeight)<1e-8);
});
