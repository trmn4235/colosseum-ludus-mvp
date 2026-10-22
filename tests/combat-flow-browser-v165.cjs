const assert=require('node:assert/strict');
module.exports=async(page,out)=>{
 assert.equal(await page.locator('#sound').count(),0);
 const brawl=await page.evaluate(()=>{
  const a=__arena,c=a.combat,p=c.fighters[0],render=a.renderer.render,tick=c.tick;let frames=0,kills=0;
  a.freeze();a.renderer.render=()=>{};
  Object.assign(p,{hp:10000,maxHp:10000,weapon:'trident',shield:true,chest:true,helmet:true,shoulders:true,gearBase:null});
  c.tick=function(dt){
   const target=this.nearest(p);if(!target)return tick.call(this,dt,{});
   const dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz),close=len<1.7;
   if(close&&p.action==='idle')this.attack(0,false,'chest');
   return tick.call(this,dt,{x:close?0:dx/len,z:close?0:dz/len,faceAngle:Math.atan2(dx,dz)});
  };
  try{
   for(let n=0;n<2400&&!c.finished;n++){
    a.step(n%3===0?1/120:1/60,true);frames++;
    for(const f of c.fighters)if(![f.x,f.z,f.timer,f.hp].every(Number.isFinite))throw Error('Invalid brawl state '+f.id);
   }
   kills=c.fighters.filter(f=>f.hp<=0).length;
   return {frames,kills,time:c.time,action:p.action,finished:c.finished,stats:c.stats};
  }finally{c.tick=tick;a.renderer.render=render;}
 });
 console.log(JSON.stringify({brawl}));assert.ok(brawl.frames>100);assert.ok(brawl.stats.hits>0);
 const progression=await page.evaluate(()=>{
  const a=__arena,c=a.combat; a.resetResult();c.reset('normal','hoplomachus','solo20');const p=c.fighters[0],render=a.renderer.render;let frames=0;
  a.freeze();CombatControlSettings.save('classic');a.renderer.render=()=>{};c.finished=false;c.botStep=()=>{};
  // Create fresh rigs for this separate recovery scenario; settled corpses are immutable.
  for(let i=0;i<a.models.length;i++){const m=a.models[i];a.scene.remove(m.root);ImportedGladiator.dispose(m);a.models[i]=ImportedGladiator.create(i,c.fighters[i].type);a.scene.add(a.models[i].root);}
  Object.assign(p,{hp:100,maxHp:100,stamina:200,maxStamina:200,x:0,z:0,angle:0,action:'idle',timer:0,stunUntil:0,knockedUntil:0,weapon:'trident',offhand:null,shield:true,chest:true,helmet:true,shoulders:true,gearBase:null});
  for(const f of c.fighters.slice(1))Object.assign(f,{hp:100,maxHp:100,action:'idle',timer:0,stunUntil:0,knockedUntil:0,x:2+(f.id%4)*2,z:Math.floor(f.id/4)*2,gearBase:null,chest:true,helmet:true,shoulders:true});
  try{
   for(let n=0;n<600;n++){
    if(n===30)c.knock(p,1.5);
    if(n===145)c.evade(0,1,0,'roll');
    if(n===150)c.knock(p,1.5);
    if(n===270)for(const f of c.fighters.slice(2)){c.knock(f,1.5);f.timer=.35;c.damage(p,f,1000,'chest');}
    if(n===400){p.cooldown=0;p.stamina=200;c.attack(0,false,'chest');}
    a.step(1/60,true);frames++;
    if(!Number.isFinite(c.time)||!Number.isFinite(p.x)||!Number.isFinite(p.timer))throw Error('Non-finite state');
   }
   return {frames,time:c.time,playerAction:p.action,alive:c.fighters.filter(f=>f.hp>0).length,settled:a.models.filter(m=>m.corpseSettled).length,head:a.models[0].bones.Head.getWorldPosition(new THREE.Vector3()).y};
  }finally{a.renderer.render=render;}
 });
 console.log(JSON.stringify({flowProgression:progression}));
 assert.equal(progression.playerAction,'idle');assert.equal(progression.alive,2);assert.ok(progression.settled>=17,'Visible corpses finish falling');assert.ok(progression.head>1.4);
 const before=await page.evaluate(()=>{__arena.combat.lockedTarget=null;return{x:__arena.combat.fighters[0].x,z:__arena.combat.fighters[0].z};});
 await page.evaluate(()=>__arena.setPaused(false));
 const stick=await page.locator('#stick').boundingBox();await page.mouse.move(stick.x+stick.width*.75,stick.y+stick.height*.5);await page.mouse.down();
 const walk=await page.evaluate(()=>{const a=__arena,render=a.renderer.render,m=a.models[0];let previous=m.root.position.clone(),zeroFrames=0; a.renderer.render=()=>{};try{for(let n=0;n<120;n++){a.step(1/120,true);if(n>20&&previous.distanceTo(m.root.position)<.00001)zeroFrames++;previous.copy(m.root.position);}return{zeroFrames};}finally{a.renderer.render=render;}});await page.mouse.up();
 assert.equal(walk.zeroFrames,0,'120 Hz walking has no frozen alternate frames');console.log(JSON.stringify({touchWalk120Hz:walk}));
 const moved=await page.evaluate(()=>({x:__arena.combat.fighters[0].x,z:__arena.combat.fighters[0].z}));assert.ok(Math.hypot(moved.x-before.x,moved.z-before.z)>1,'Movement still works after the fall/death sequence');
 await page.evaluate(()=>{__arena.setPaused(false);const f=__arena.combat.fighters[0];f.cooldown=0;f.stamina=200;f.action='idle';});
 await page.locator('#attack').click();assert.equal(await page.evaluate(()=>__arena.combat.fighters[0].action),'attack','Touch attack still works after the fall/death sequence');
 await page.evaluate(()=>{__arena.step(1/60,true);});await page.screenshot({path:out+'/flow165-after-falls.png'});
};
