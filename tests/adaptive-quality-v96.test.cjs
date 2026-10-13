const test=require('node:test'),assert=require('node:assert/strict');
const {AdaptiveQuality}=require('../arena-runtime-v96.js');
function run(rate,seconds,dpr=1.25,quality=new AdaptiveQuality(),start=0){
  let changes=0;
  for(let n=0;n<=rate*seconds;n++){
    const value=quality.sample(start+n*1000/rate,dpr);
    if(value!==null){dpr=value;changes++;}
  }
  return {dpr,changes,quality};
}
test('sustained slow rendering lowers resolution within its floor',()=>{
  const result=run(30,30);assert.equal(result.dpr,.875);assert.equal(result.changes,3);
});
test('60 and 120 Hz remain at their original resolution',()=>{
  for(const rate of [60,120])assert.equal(run(rate,20).changes,0);
});
test('stable recovery restores resolution gradually, never above the maximum',()=>{
  const result=run(60,40,.875);assert.equal(result.dpr,1.25);assert.equal(result.changes,3);
});
test('a background tab gap is discarded instead of triggering a downgrade',()=>{
  const q=new AdaptiveQuality();run(60,10,1.25,q);assert.equal(q.sample(70000,1.25),null);
  assert.equal(run(60,10,1.25,q,70000).changes,0);
});
test('pausing resets the measurement and allows a fresh warmup',()=>{
  const q=new AdaptiveQuality();run(30,3,1.25,q);q.reset(10000);
  assert.equal(run(30,1,1.25,q,10000).changes,0);
});
test('single loading spikes do not trigger quality oscillation',()=>{
  const q=new AdaptiveQuality();let value=1.25;
  for(let n=0;n<1000;n++){const next=q.sample(n*1000/60+(n>=500?150:0),value);if(next!==null)value=next;}
  assert.equal(value,1.25);
});
