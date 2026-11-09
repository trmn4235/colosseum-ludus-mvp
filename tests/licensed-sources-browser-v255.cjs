const assert=require('node:assert/strict');
module.exports=async({page,fit,out})=>{
 await page.evaluate(async()=>{
  Object.assign(__supply,{licensed_work_version:255,shopping_seconds:10800,caravan_capacity:10,free_workers:6,free_caravans:6,busy_workers:0,busy_caravans:0,gold:1000000});
  window.__quoteTTL=60000;window.__licensedSource=null;window.addEventListener('ludus-work-license',e=>window.__licensedSource=e.detail.sku);
  LudusPreview.supplySystem.close();await LudusPreview.supplySystem.open('map');await LudusPreview.supplySystem.refresh();
 });
 const food=[['grain','grain'],['apple','apple'],['fish','fish'],['hunt','meat'],['egg','egg'],['wine','beer'],['olive_oil','olive_oil']];
 for(const [site,sku] of food){
  await page.locator('[data-destination="'+site+'"]').click();await page.locator('[data-buy="'+sku+'"]').waitFor();
  assert.match(await page.locator('.supply-trip-note').innerText(),/10 birim.*3 saat/);
  await page.locator('#sourceQuantity').fill('11');assert.ok(await page.locator('[data-buy]').isDisabled());
  await page.locator('#sourceQuantity').fill('10');assert.ok(await page.locator('[data-buy]').isEnabled());
  if(sku==='fish'){
   for(const [width,height] of [[844,390],[667,375],[568,320]]){await page.setViewportSize({width,height});await fit('.supply-source-detail');await fit('.supply-scene');await fit('.supply-license-open');await fit('.caravan-purchase');}
   await page.screenshot({path:out+'/licensed-food-v255.png'});
  }
  await page.locator('[data-buy]').click();assert.ok(await page.locator('[data-worker-confirm]').isDisabled());
  await page.locator('[data-worker="00000000-0000-4000-8000-000000000207"]').click();await page.locator('[data-worker-confirm]').click();
  await page.waitForFunction(sku=>__lastBuy?.p_key.split(':')[1]===sku,sku);
  assert.equal((await page.evaluate(()=>__lastBuy.p_key)).split(':')[3],'10');assert.equal((await page.evaluate(()=>__lastBuy.p_worker_ids)).length,1);
  await page.evaluate(async()=>{__supply.free_caravans=__supply.free_workers=6;await LudusPreview.supplySystem.refresh();});await page.locator('.supply-back').click();
 }
 await page.locator('[data-destination=fish]').click();await page.locator('.supply-license-open').click();
 assert.equal(await page.evaluate(()=>__licensedSource),'fish');assert.ok(await page.locator('#supplyModal').isHidden());
 console.log('V256 source browser PASS: all seven food sources use explicit paid worker checkout, 10-unit capacity, three-hour labels and a working six-hour license entry.');
};
