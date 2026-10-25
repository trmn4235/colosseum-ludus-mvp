const assert=require('node:assert/strict');
module.exports=async(page,base,fixture,screenshot,fits)=>{
 const requests=[];const watch=req=>{if(req.url().includes('/pit-v192/pit_axe.cme'))requests.push(req.url())};page.on('request',watch);
 try{
  await page.goto(base+'/san-avlusu.html?fight=2x5');await page.waitForFunction(()=>PitVisit.ready&&document.querySelector('#fightDialog').open,null,{timeout:90000});
  assert.equal(requests.length,0,'the courtyard entrance does not load the axe mesh');
  for(const name of ['weapon','mate_weapon'])await page.locator('input[name='+name+'][value=pit_axe]').check();
  await page.waitForFunction(()=>[...document.querySelectorAll('img[src*="pit-v192/axe-icon"]')].every(i=>i.complete&&i.naturalWidth===512));
  for(const [width,height]of [[932,430],[667,375],[390,844]]){
   await page.setViewportSize({width,height});assert.equal(await page.locator('.weapon-card:visible').count(),8);await fits();
   assert.equal(await page.locator('input[value=pit_axe]:checked').count(),2);assert.match(await page.locator('#fightMessage').textContent(),/Balta.*Balta/);await screenshot('pit-axe-v192-selection-'+width);
  }
  await page.setViewportSize({width:932,height:430});await page.locator('#fightStart').click();await page.waitForURL('**/arena.html?battle=*');
  await page.waitForFunction(()=>window.__pitTest?.combat.pitRound?.mode==='2x5'&&document.querySelector('#hud').style.display!=='none',null,{timeout:90000});
  assert.equal(requests.length,1,'two axes share one download');
  const actual=await page.evaluate(()=>{const c=__pitTest.combat,m=__pitTest.models;return{chosen:JSON.parse(sessionStorage.getItem('pit-test-selection')).p_slots,types:c.fighters.slice(0,2).map(f=>f.pitWeapon),models:m.slice(0,2).map(o=>o.equippedWeapon),loaded:!!LudusEquipmentCatalog.get('pit_axe'),error:LudusEquipmentCatalog.error('pit_axe')}});
  assert.equal(actual.chosen.pit_weapon,'pit_axe');assert.equal(actual.chosen.teammate_weapon,'pit_axe');assert.deepEqual(actual.types,['pit_axe','pit_axe']);assert.deepEqual(actual.models,['pit_axe','pit_axe']);assert.ok(actual.loaded);assert.equal(actual.error,null);
  await page.evaluate(()=>{const c=__pitTest.combat;CombatControlSettings.save('classic');c.botStep=()=>{};for(const f of c.fighters)Object.assign(f,{x:-7,z:-6+f.id,action:'idle',cooldown:0,stunUntil:0,stamina:100,hp:1000,maxHp:1000});Object.assign(c.fighters[0],{x:0,z:0,angle:0});Object.assign(c.fighters[1],{x:1.7,z:0,angle:0});Object.assign(c.fighters[2],{x:0,z:1.4,angle:Math.PI,blocking:false,shield:false,weapon:null,hp:1000});__pitTest.setAim(0);});
  const frame=await page.evaluate(()=>__pitTest.renderer.info.render.frame);await page.waitForFunction(n=>__pitTest.renderer.info.render.frame>n+12,frame,{timeout:90000});
  await screenshot('pit-axe-v192-in-hand');await page.locator('#attack').click();await page.waitForFunction(()=>__pitTest.combat.fighters[2].hp<1000,null,{timeout:30000});
  assert.ok(await page.evaluate(()=>__pitTest.models.slice(0,2).every(m=>m.weaponAnchor.children[0]?.userData.catalogId==='pit_axe'&&m.boneEntries.every(([,b])=>b.matrixWorld.elements.every(Number.isFinite)))));
  await page.goto(base+'/san-avlusu.html?fight=1x10');await page.waitForFunction(()=>PitVisit.ready&&document.querySelector('#fightDialog').open,null,{timeout:90000});
  await page.locator('input[name=weapon][value=pit_axe]').check();assert.equal(await page.locator('.weapon-card:visible').count(),4);await fits();await page.locator('#fightStart').click();await page.waitForURL('**/arena.html?battle=*');await page.waitForFunction(()=>window.__pitTest?.combat.pitRound?.mode==='1x10'&&document.querySelector('#hud').style.display!=='none',null,{timeout:90000});
  assert.equal(await page.evaluate(()=>__pitTest.models[0].equippedWeapon),'pit_axe');
  console.log('V192 browser PASS: both independent axe choices, three screen sizes, one shared download, in-hand meshes, actual melee damage and solo/pair entry.');
 }finally{page.off('request',watch)}
};
