const assert=require('node:assert/strict');global.CircusDriving=require('../circus-driving-v151');const P=require('../circus-physics-v158');const plans={0:300,1:307,2:314,3:321},drive={initial:100,boosts:[]};
assert.equal(P.LAPS,5);assert.equal(P.TOTAL,P.LENGTH*5);
let idle=P.initial();for(let i=0;i<1200;i++)idle=P.step(idle,0,321,drive,plans);assert.equal(idle.speed,0);assert.ok(idle.wall>2.5&&idle.crashes>0,'No steering misses the turn and stops against the wall');
let controlled=P.initial();for(let i=0;i<1200;i++)controlled=P.step(controlled,P.section(100+controlled.distance).curve?-.6:0,321,drive,plans);assert.ok(controlled.distance>idle.distance+500&&controlled.crashes===0,'Steering through corners changes the outcome');
let recover=idle;for(let i=0;i<60;i++)recover=P.step(recover,-1,321,drive,plans);assert.ok(recover.wall===0&&recover.speed>1,'Steering away recovers from a wall stop');
let left=P.initial(),right=P.initial();for(let i=0;i<30;i++){left=P.step(left,1,321,drive,plans);right=P.step(right,-1,321,drive,plans);}assert.ok(left.lane>10.2&&right.lane<10.2,'Left/right input values match follow-camera view');
let hit={...P.initial(),distance:0,lane:-12,speed:20};hit=P.step(hit,0,321,drive,plans);assert.ok(hit.crashes>0&&hit.speed<12,'Vehicle contact costs actual speed');
for(let i=0;i<4;i++){let d={initial:100,boosts:[]};for(const e of P.botDrive(i).boosts){assert.equal(CircusDriving.metrics(d,e.at,600).canBoost,true,'AI respects stamina and cooldown');d.boosts.push(e);}assert.ok(d.boosts.length>20);assert.ok(P.bot(i,50,300).distance>50/300*P.TOTAL,'AI boosts add actual progress');}
for(let j=0;j<10000;j++){const s=j/10000*P.LENGTH,b=P.bounds(s);assert.ok(Number.isFinite(b[0])&&Number.isFinite(b[1])&&b[0]<b[1]);}
console.log(JSON.stringify({passed:true,fiveLaps:true,manualCorners:true,wallStopAndRecovery:true,vehicleContact:true,aiStaminaAndBoosts:true,idleDistance:idle.distance,controlledDistance:controlled.distance}));
