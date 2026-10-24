/* Exercise the shipped scheduler with eleven visible actors and fixed combat poses. */
const assert=require('node:assert/strict');
module.exports=async page=>{
 const metrics=await page.evaluate(()=>{
  const b=CaravanBattle,c=b.state.combat,animate=ImportedGladiator.animate,visibility=GamePerformance.characterVisibility;
  c.fighters.forEach((f,i)=>Object.assign(f,{hp:100000,maxHp:100000,action:'idle',timer:0,move:0,reaction:0,guardFlash:0,blocking:false,absoluteBlockUntil:0,x:i===0?0:(i%2?1:-1)*5,z:i===0?0:Math.floor(i/2)}));
  c.lockedTarget=null;GamePerformance.characterVisibility=m=>{m.root.visible=true;};
  const result=[];let counts;
  ImportedGladiator.animate=function(f,...args){counts[f.id]++;return animate.call(this,f,...args);};
  try{
   for(const fps of [60,120]){
    for(const m of testModels){m.poseSignature=null;m.poseDelta=0;m.poseBudget=0;}
    counts=Array(c.fighters.length).fill(0);const loads=[],times=[];
    for(let frame=0;frame<fps*3;frame++){
     const before=counts.reduce((a,b)=>a+b,0),start=performance.now();b.testRenderActors(1/fps);const elapsed=performance.now()-start;
     if(frame>fps){loads.push(counts.reduce((a,b)=>a+b,0)-before);times.push(elapsed);}
    }
    times.sort((a,b)=>a-b);result.push({fps,cpuMs:{p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]},minimum:Math.min(...loads),maximum:Math.max(...loads),mean:loads.reduce((a,b)=>a+b,0)/loads.length,focus:c.fighters.filter(f=>NavalPerformance.focus(f.id)).map(f=>f.id),counts});
   }
  }finally{ImportedGladiator.animate=animate;GamePerformance.characterVisibility=visibility;for(const m of testModels)m.poseSignature=null;b.testRenderActors(0);}
  return result;
 });
 console.log('V188 caravan pose cadence:',JSON.stringify(metrics));
 for(const row of metrics){
  assert.equal(row.focus.length,3);assert.ok(row.maximum<=3+Math.ceil(8*30/row.fps)+1,JSON.stringify(row));
  assert.ok(row.minimum>=3+Math.floor(8*30/row.fps)-1,JSON.stringify(row));
  for(let id=0;id<row.counts.length;id++)assert.ok(Math.abs(row.counts[id]-(row.focus.includes(id)?row.fps*3:90))<2,JSON.stringify(row));
 }
};
