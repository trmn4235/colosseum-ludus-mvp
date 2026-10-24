/* Actual WebGL buffers and gameplay loops under controlled display cadence. */
const assert=require('node:assert/strict');
module.exports=async(page,kind)=>{
 const result=await page.evaluate(kind=>{
  const p=kind==='arena'?__arena:kind==='caravan'?CaravanField:kind==='circus'?CircusPreview:kind==='ludus'?LudusPreview:window.fixtureRenderHost;
  const r=p.renderer,scale=p.renderScale,draw=r.render;let now=['arena','ludus','online'].includes(kind)?p.now:performance.now();
  const canvas=r.domElement,bounds=()=>{const b=canvas.getBoundingClientRect();return[b.x,b.y,b.width,b.height,getComputedStyle(document.body).fontSize];};
  let resume,pause,step;
  if(kind==='arena'){
   for(const f of p.combat.fighters)f.hp=f.maxHp=100000;p.combat.finished=false;p.resetResult();p.setPaused(false);now=p.now;
   step=dt=>p.step(dt,true);pause=()=>p.setPaused(true);resume=()=>p.setPaused(false);
  }else if(kind==='caravan'){
   for(const f of CaravanBattle.state.combat.fighters)f.hp=f.maxHp=100000;
   resume=()=>CaravanBattle.resume();pause=()=>CaravanBattle.pause();resume();p.resetClock();p.clock(now);
   step=dt=>p.clock(now+=dt*1000);
  }else if(kind==='ludus'||kind==='online'){
   resume=()=>p.suspend(false);pause=()=>p.suspend(true);resume();step=dt=>p.step(dt);now=p.now;
  }else{
   window.testManualFrames=true;window.testScaleFrames=true;
   const w=p.visit.war;resume=()=>document.querySelector('#warContinue').click();pause=()=>w.pause();resume();
   step=dt=>p.render(now+=dt*1000);
  }
  r.render=()=>{};scale.restore(now);const originalBounds=bounds(),maximum=scale.quality.maximum;
  const realSample=scale.sample,realSize=r.setSize;let samples=0,resizes=0;r.setSize=function(...args){resizes++;return realSize.apply(this,args);};scale.sample=function(...args){samples++;return realSample.apply(this,args);};
  for(let i=0;i<100;i++)step(1/10);const slow=r.getPixelRatio(),slowBuffer=[canvas.width,canvas.height];
  pause();if(kind==='arena')for(let i=0;i<20;i++)p.step(.25,false);else for(let i=0;i<20;i++)step(.25);
  const paused=r.getPixelRatio();resume();
  for(let i=0;i<720;i++)step(1/60);const recovered=r.getPixelRatio();
  const finalBounds=bounds();scale.sample=realSample;r.setSize=realSize;pause();
  if(kind==='circus')window.testScaleFrames=false;
  r.render=draw;
  return{kind,samples,resizes,maximum,minimum:scale.quality.minimum,slow,paused,recovered,slowBuffer,originalBounds,finalBounds};
 },kind);
 assert.ok(result.resizes<15,JSON.stringify(result));assert.ok(result.samples>=800,JSON.stringify(result));assert.equal(result.slow,result.minimum);assert.equal(result.paused,result.slow);
 assert.ok(result.recovered>result.slow&&result.recovered<=result.maximum,JSON.stringify(result));
 assert.deepEqual(result.finalBounds,result.originalBounds,'3D quality must not resize the UI');
 console.log('V188 adaptive gameplay:',JSON.stringify(result));
};
