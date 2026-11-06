// Production worker panel with isolated accounts and a server/client clock skew.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({browser,root,out})=>{
 const context=await browser.newContext({viewport:{width:844,height:390}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const url=new URL(route.request().url()),file=path.resolve(root,'.'+url.pathname);if(url.hostname!=='workers.test'||!file.startsWith(root+path.sep))return route.abort();try{return route.fulfill({body:url.pathname==='/workers'?require('./workers-fixture-v229.cjs')():fs.readFileSync(file),contentType:url.pathname==='/workers'?'text/html; charset=utf-8':({'.js':'text/javascript','.css':'text/css','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404});}});
 const fit=async selector=>{for(const n of await page.locator(selector).all()){const r=await n.evaluate(e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:e.scrollWidth-e.clientWidth,h:e.scrollHeight-e.clientHeight};});assert.ok(r.w<3&&r.h<3&&r.x>=0&&r.y>=0&&r.right<=page.viewportSize().width+1&&r.bottom<=page.viewportSize().height+1,selector+' '+JSON.stringify(r));}};
 try{
  await page.goto('http://workers.test/workers');await page.waitForSelector('.worker-card');assert.equal(await page.locator('.worker-card').count(),8);
  const first=page.locator('[data-worker-id="00000000-0000-4000-8000-000000000200"]'),blocked=page.locator('[data-worker-id="00000000-0000-4000-8000-000000000201"]');
  assert.match(await first.innerText(),/Demir cevheri alışverişi/);assert.match(await first.locator('.worker-task-countdown').innerText(),/Dönüş: 00:01:/,'server time offset prevents the extra ten minutes');
  assert.equal(await blocked.locator('.worker-task-countdown').innerText(),'Teslimat bekleniyor');
  const before=await first.locator('.worker-task-countdown').innerText();await page.waitForFunction(before=>document.querySelector('.worker-task-countdown').textContent!==before,before,{timeout:4000});
  for(const [width,height]of [[844,390],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await fit('.worker-card');await fit('.worker-task');await first.click();await fit('.worker-profile');await fit('.worker-archery');await fit('.worker-skill');
   assert.equal(await page.locator('.worker-skill').count(),9);assert.equal(await page.locator('.worker-arrow-damage').innerText(),'14 temel ok hasarı');assert.equal(await page.locator('.worker-archery progress').getAttribute('value'),'50');
   await page.screenshot({path:path.join(out,'worker-profile-'+width+'.png')});await page.getByRole('button',{name:'‹ İşçilerim',exact:true}).click();
  }
  await first.click();await page.locator('#workerNameV226').fill('Taslak isim');const calls=await page.evaluate(()=>__calls);await page.evaluate(()=>__shift+=31000);await page.waitForTimeout(1300);assert.equal(await page.locator('#workerNameV226').inputValue(),'Taslak isim');assert.equal(await page.evaluate(()=>__calls),calls,'background updates do not interrupt name entry');
  await page.getByRole('button',{name:'Vazgeç',exact:true}).click();await page.getByRole('button',{name:'İşçi sayfasını kapat',exact:true}).click();await page.evaluate(()=>{__shift+=31000;__supplyFailure=true;});const closedCalls=await page.evaluate(()=>__calls);await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>__calls),closedCalls,'closed panel stops polling');
  await page.getByRole('button',{name:'İşçileri aç',exact:true}).click();await page.waitForSelector('.worker-card');assert.match(await first.innerText(),/Demir cevheri alışverişi/,'owned job survives a separate supply RPC failure');assert.equal(await blocked.locator('.worker-task-countdown').innerText(),'Teslimat bekleniyor');
  assert.deepEqual(errors,[]);console.log('V229 browser PASS: eight task cards, live server-based countdown, pending delivery, nine professions plus archery, draft preservation and mobile fit.');
 }finally{await context.close();}
};
