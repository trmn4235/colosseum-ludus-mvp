const assert=require('node:assert/strict');
module.exports=async page=>{
 const metrics=await page.evaluate(()=>{
  const a=__arena,c=a.combat,r=a.renderer;
  for(const [i,f]of c.fighters.entries())Object.assign(f,{hp:100000,maxHp:100000,chest:true,chestModel:'gladiator_chest',x:(i%5-2)*2,z:(Math.floor(i/5)-2)*2,action:'idle',move:0});
  NavalPerformance.beginFrame(c.fighters,c.fighters[0],false,c.lockedTarget);
  for(const f of c.fighters){a.models[f.id].root.visible=true;a.animateCharacter(f,a.models[f.id],c.time,1/60);}
  a.camera.position.set(0,7,13);a.camera.lookAt(0,1,0);r.info.autoReset=false;r.shadowMap.autoUpdate=true;r.info.reset();r.render(a.scene,a.camera);
  const shadow={...r.info.render},fullBodies=a.models.filter(m=>m.id===0||m.navalBodyLevel===0).length;
  const draw=r.render;r.render=()=>{};const clock=[];
  for(const fps of [10,15,30,60,120]){const before=c.time;for(let i=0;i<fps*2;i++)a.step(1/fps);clock.push({fps,seconds:c.time-before});}
  r.render=draw;r.info.autoReset=true;
  return{shadow,fullBodies,clock};
 });
 assert.ok(metrics.shadow.triangles<1500000,JSON.stringify(metrics));assert.ok(metrics.shadow.calls<430);assert.ok(metrics.fullBodies<=3);
 for(const c of metrics.clock)assert.ok(Math.abs(c.seconds-2)<1/60+.0001,JSON.stringify(c));
 console.log('V187 arena budget:',JSON.stringify(metrics));
};
