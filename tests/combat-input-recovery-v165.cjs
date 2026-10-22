const assert=require('node:assert/strict');
module.exports=async page=>{
 const ready=()=>page.evaluate(()=>{const a=__arena,f=a.combat.fighters[0];a.resetResult();a.combat.finished=false;Object.assign(f,{hp:100,weapon:'trident',shield:true,shieldHeldBy:null,gearBase:null,action:'idle',timer:0,cooldown:0,stamina:100,stunUntil:0,knockedUntil:0});CombatControlSettings.save('classic');a.setPaused(false);});
 const step=(frames=1)=>page.evaluate(frames=>{const a=__arena,render=a.renderer.render;a.renderer.render=()=>{};try{for(let n=0;n<frames;n++)a.step(1/120,true);}finally{a.renderer.render=render;}},frames);
 await ready();
 const block=await page.locator('#block').boundingBox();await page.mouse.move(block.x+block.width/2,block.y+block.height/2);await page.mouse.down();
 assert.equal(await page.locator('#block').evaluate(e=>e.classList.contains('pressed')),true);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
 assert.equal(await page.locator('#pauseMenu').isVisible(),true);
 assert.equal(await page.locator('#block').evaluate(e=>e.classList.contains('pressed')),false,'Interrupted guard must not stay pressed after input reset');
 await page.locator('#resume').click();await step();
 assert.equal(await page.evaluate(()=>__arena.combat.fighters[0].blocking),false);
 await page.setViewportSize({width:390,height:844});await page.setViewportSize({width:844,height:390});
 assert.equal(await page.locator('#app').evaluate(e=>e.inert),false,'Rotating back restores controls');
 await ready();
 if(process.env.LUDUS_TEST_ENGINE!=='webkit'){
  const client=await page.context().newCDPSession(page),stick=await page.locator('#stick').boundingBox(),attack=await page.locator('#attack').boundingBox();
  await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await page.evaluate(()=>{window.__inputEvents=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>__inputEvents.push({type,target:e.target.id,id:e.pointerId,pointer:e.pointerType}),true);});
  const first={id:1,x:stick.x+stick.width*.75,y:stick.y+stick.height*.5},second={id:2,x:attack.x+attack.width*.5,y:attack.y+attack.height*.5};
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,second]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>__inputEvents.some(e=>e.type==='pointerup'),null,{timeout:3000});
  assert.equal(await page.evaluate(()=>__arena.combat.fighters[0].action),'attack','Movement and attack accept separate fingers');
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...first,id:4}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.evaluate(()=>{__arena.combat.fighters[0].action='idle';});await step(3);assert.equal(await page.evaluate(()=>__arena.combat.fighters[0].move),0,'Cancelled stick input releases movement');
  await ready();await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:3,x:block.x+block.width/2,y:block.y+block.height/2}]});
  await step(3);assert.equal(await page.evaluate(()=>__arena.combat.fighters[0].blocking),true);
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await step(3);
  assert.equal(await page.evaluate(()=>__arena.combat.fighters[0].blocking),false);
  assert.equal(await page.locator('#block').evaluate(e=>e.classList.contains('pressed')),false);
  await client.detach();
 }
 await ready();await page.locator('#attack').click();assert.equal(await page.evaluate(()=>__arena.combat.fighters[0].action),'attack');
 await page.evaluate(()=>__arena.freeze());console.log(JSON.stringify({inputRecovery:{blur:true,rotation:true,cancel:true,multiTouch:process.env.LUDUS_TEST_ENGINE!=='webkit',attack:true}}));
};
