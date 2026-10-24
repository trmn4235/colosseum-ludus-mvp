const assert=require('node:assert/strict');
global.CircusDriving=require('../circus-driving-v151.js');global.CircusPhysics=require('../circus-physics-v158.js');const C=require('../circus-war-core-v182.js');
const roster=Array.from({length:4},(_,i)=>({name:'Team '+i,quality:70,crew:[0,1].map(j=>({id:`${i}-${j}`,name:'Fighter '+j})),horses:[{id:i+'a'},{id:i+'b'}]}));
const fresh=()=>C.initial(roster,182);
assert.equal(C.LAPS,7);assert.equal(C.TOTAL,7*C.LENGTH);
let s=fresh();C.damage(s,3,1);assert.equal(s.teams[3].crew[1].hp,50);C.damage(s,3,1);assert.equal(s.teams[3].crew[1].hp,0);assert.equal(s.teams[3].archer,-1);assert.equal(C.switchRole(s),false);assert.equal(s.role,0);C.damage(s,3,0);C.damage(s,3,0);assert.equal(s.teams[3].eliminated,true);assert.deepEqual(s.teams[3].horses,roster[3].horses);
s=fresh();C.switchRole(s);assert.equal(s.role,1);C.damage(s,3,0);C.damage(s,3,0);assert.equal(s.role,1);assert.equal(s.teams[3].driver,1);assert.equal(s.teams[3].archer,-1);
// Manual steering is not automated. The same seed and inputs produce identical state.
let a=fresh(),b=fresh();for(let k=0;k<150;k++){C.step(a,{steer:.4});C.step(b,{steer:.4});}assert.deepEqual(a,b);assert.ok(a.teams[3].heading>.3);
// Targeted swept arrow test: a real person's capsule receives exactly one hit.
s=fresh();s.teams[0].lane=0;const p=C.point(s.teams[0],0);let hit=C.trace(s,3,{x:p.x-2,y:p.y,z:p.z},{x:p.x+2,y:p.y,z:p.z});assert.equal(hit.team,0);assert.equal(hit.role,0);
const pose=C.course(100,0);hit=C.trace(s,3,{x:pose.x-.75-2,y:1.25,z:pose.z+2.4},{x:pose.x-.75+2,y:1.25,z:pose.z+2.4});assert.equal(hit.blocked,'horse');assert.equal(hit.team,undefined);
assert.equal(C.trace(s,3,{x:10,y:2,z:0},{x:-10,y:2,z:0}).blocked,'wall');
// Autopilot must complete all seven laps, including both bends, without wall lock.
s=fresh();C.switchRole(s);for(const t of s.teams)t.nextShot=1e9;for(let k=0;k<18000&&!s.done;k++)C.step(s);assert.ok(s.winner!==null,'Bot race finishes');assert.equal(s.teams[s.winner].distance,C.TOTAL);assert.ok(s.teams[3].distance>C.TOTAL*.75,'Own bot drives while player is archer');assert.ok(s.teams.every(t=>t.wall<2.5),'No autopilot wall lock');
// Real bot arrows, not scripted damage; switching into driver lets our archer act.
s=fresh();let shots=0,hits=0;for(let k=0;k<2000&&!s.done;k++){C.step(s,{steer:C.autopilot(s.teams[3],3)});shots+=s.events.filter(e=>e.kind==='shot').length;hits+=s.events.filter(e=>e.kind==='hit').length;}assert.ok(shots>4);assert.ok(hits>0);assert.deepEqual(s.teams.map(t=>t.horses),roster.map(t=>t.horses));
console.log(JSON.stringify({passed:true,laps:7,halfMaxHP:true,horseImmunity:true,roleSwitch:true,survivorDrives:true,deterministic:true,sevenLapAI:true,botShots:shots,botHits:hits}));
