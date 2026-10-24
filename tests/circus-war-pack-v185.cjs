const assert=require('node:assert/strict');
global.CircusDriving=require('../circus-driving-v183');global.CircusMotion=require('../circus-motion-v183');global.CircusPhysics=require('../circus-physics-v183');
const C=require('../circus-war-core-v185');
const roster=Array.from({length:4},(_,i)=>({name:'Team '+i,quality:70,crew:[{id:i+'a'},{id:i+'b'}],horses:[{id:i+'h0'},{id:i+'h1'}]}));
function fresh(seed=185){const s=C.initial(roster,seed);s.role=1;for(const t of s.teams)t.nextShot=1e9;return s;}
function advance(s,seconds,input=()=>({})){for(let k=0;k<seconds/C.DT&&!s.done;k++){const old=s.teams.map(t=>({distance:t.distance,speed:t.speed,broken:t.broken,eliminated:t.eliminated}));C.step(s,input(s));s.teams.forEach((t,i)=>{const delta=t.distance-old[i].distance;assert.ok(delta>=0&&delta<3,'Pack movement stays within physical travel per tick');if(old[i].broken||old[i].eliminated){assert.equal(t.distance,old[i].distance);assert.equal(t.speed,0);}});}return s;}
const gaps=s=>s.teams.slice(0,3).map(t=>t.distance-s.teams[3].distance);
let formationSamples=0,closeSamples=0,whipOpportunities=0;
for(const seed of [185,1,4242]){
 const s=fresh(seed);advance(s,20);
 for(let k=0;k<2600;k++){advance(s,C.DT);const d=gaps(s),own=s.teams[3],side=s.teams[1];formationSamples++;if(d[0]>8&&d[0]<23&&Math.abs(d[1])<4.5&&d[2]<-7&&d[2]>-23)closeSamples++;
  const a=C.origin(own,1),p=C.point(side,1);if(Math.hypot(p.x-a.x,p.y-a.y,p.z-a.z)<3)whipOpportunities++;
 }
 assert.ok(s.teams.every(t=>t.wall<.1),'Formation clears both bends');
}
assert.ok(closeSamples/formationSamples>.9,'One rival ahead, one beside and one behind through multiple laps');assert.ok(whipOpportunities>100,'Side rival periodically comes within the genuine 3 m whip range');
// Either defeating both crew or disabling the wheels brings the leader alongside.
for(const cause of ['crew','wheels']){
 const s=fresh();advance(s,24);assert.ok(gaps(s)[0]>8);
 if(cause==='crew')for(let r=0;r<2;r++){C.damage(s,1,r);C.damage(s,1,r);}else{C.wheelDamage(s,1,0);C.wheelDamage(s,1,1);}
 const stopped=s.teams[1].distance;advance(s,14);assert.ok(Math.abs(gaps(s)[0])<4);assert.ok(Math.abs(s.teams[0].lane-s.teams[3].lane)<4);assert.equal(s.teams[1].distance,stopped);
 C.wheelDamage(s,0,0);C.wheelDamage(s,0,1);advance(s,14);assert.ok(Math.abs(gaps(s)[2])<4,'Last active rival approaches after the second elimination');
}
// A boost creates a lead before the formation gradually closes; it is never cancelled.
let s=fresh();advance(s,16);const before=gaps(s)[1];s.teams[3].boostUntil=s.time+4;s.teams[3].nextBoost=s.time+5;advance(s,2);assert.ok(gaps(s)[1]<before-1,'Acceleration earns real distance');advance(s,10);assert.ok(Math.abs(gaps(s)[1])<4);
// Steering still matters: opponents pass a car held against the wall instead of waiting.
s=fresh();s.role=0;advance(s,65);assert.equal(s.teams[3].speed,0);assert.ok(Math.max(...gaps(s))>40);
// Saved V183 races acquire slots without a position jump; V185 saves replay identically.
s=fresh();advance(s,30);delete s.pack;const start=s.teams.map(t=>t.distance);advance(s,.05);s.teams.forEach((t,i)=>assert.ok(t.distance-start[i]<2));const clone=JSON.parse(JSON.stringify(s));advance(s,15);advance(clone,15);assert.deepEqual(s,clone);
// The finish is decided by actual progress, with rivals free to sprint for the line.
s=fresh();advance(s,20);for(const t of s.teams)t.distance+=C.TOTAL-s.teams[3].distance-180;advance(s,40);assert.equal(s.done,true);assert.ok(s.winner!==null);assert.equal(s.teams[s.winner].distance,C.TOTAL);
console.log(JSON.stringify({passed:true,formationCoverage:closeSamples/formationSamples,whipOpportunities,leaderClosesAfterElimination:true,noTeleport:true,boostAdvantage:true,wallPenalty:true,resume:true,competitiveFinish:true}));
