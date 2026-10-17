const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/combat-values-v110';
const report=JSON.parse(fs.readFileSync(path.join(out,'combat-values-fixture.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'ludus.html'),'utf8');
const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|<link rel="stylesheet" href="([^"?]+)[^"]*">/g)].map(m=>m[1]!==undefined?m[1]:fs.existsSync(path.join(root,m[2]))?fs.readFileSync(path.join(root,m[2]),'utf8'):'').join('\n');
async function layout(page,label){
 const bad=await page.evaluate(()=>{
  const selectors=['.exercise-attribute-heading','.exercise-attribute-heading h3','.combat-values','.combat-values-shell','.combat-values-content','.combat-values-detail','.combat-values-list','.combat-values-stats','.combat-values-sources','.combat-values-context','.combat-values-cap','.combat-values-foot','.combat-values-source'];
  const elements=[...document.querySelectorAll(selectors.join(','))];
  return elements.filter(e=>e.getClientRects().length).flatMap(e=>{const r=e.getBoundingClientRect();return e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2||r.top<-.5||r.bottom>innerHeight+.5||r.left<-.5||r.right>innerWidth+.5?[{class:e.className,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight],rect:[r.left,r.top,r.right,r.bottom]}]:[];});
 });
 assert.deepEqual(bad,[],label+' overflow');
 const hiddenControls=await page.evaluate(()=>[...document.querySelectorAll('#combat-values button')].filter(b=>{const r=b.getBoundingClientRect();return r.height<20||r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth;}).map(b=>b.textContent));
 assert.deepEqual(hiddenControls,[],label+' unreachable controls');
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:874,height:402}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="tr"><body></body></html>'}));
  await page.goto('https://ludus.test/');await page.setContent('<style>'+styles+'</style><section id="orders" hidden></section>');
  await page.evaluate(()=>document.body.dataset.romanScreen='ludus');
  await page.addScriptTag({path:root+'/ludus-combat-values-v110.js'});await page.addScriptTag({path:root+'/gladiator-exercise-v46.js'});
  await page.evaluate(report=>{
   window.fixtureReport=report;window.owner=report.owner_id;window.calls=[];window.authListeners=[];window.fail=false;window.hold=false;window.resolveHeld=null;
   window.glad={name:report.gladiator.name,type:'secutor',items:report.items,record:{...report.gladiator,owner_id:owner,status:'available',stat_version:46,fatigue_value:0}};
   const client={auth:{onAuthStateChange:fn=>{authListeners.push(fn);}},rpc:async(name,args)=>{calls.push({name,args});if(hold)return new Promise(resolve=>{resolveHeld=resolve;});return fail?{error:{message:'offline'}}:{data:structuredClone(fixtureReport)};}};
   window.controller=LudusExercise.create({client,getUser:()=>owner,roster:()=>[glad],loaded:()=>true,refresh:async()=>{},inventory:()=>[],apply:()=>{},className:()=> 'Secutor'});controller.open(glad);
  },report);
  assert.equal(await page.locator('.exercise-attribute-heading h3').textContent(),'ÖZELLİKLER');
  await page.getByRole('button',{name:'Savaş Değerleri',exact:true}).click();await page.waitForSelector('.combat-values-stat');
  assert.equal(await page.locator('#orders').evaluate(e=>e.inert),true);
  assert.equal(await page.evaluate(()=>calls.length),1);assert.deepEqual(await page.evaluate(()=>calls[0]),{name:'ludus_combat_values',args:{p_gladiator:report.gladiator.id}});
  for(const[width,height]of[[1536,864],[874,402],[852,393],[667,375],[640,320]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(120);
   for(const tab of['Saldırı','Savunma','Dayanıklılık']){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    const metrics=await page.locator('.combat-values-stat').count();for(let i=0;i<metrics;i++){await page.locator('.combat-values-stat').nth(i).click();await layout(page,width+'x'+height+' '+tab+' '+i);}
    const next=page.getByRole('button',{name:'Sonraki özellik sayfası',exact:true});if(await next.isEnabled()){await next.click();await layout(page,width+'x'+height+' next metrics');}
   }
   if(width===874){await page.getByRole('tab',{name:'Dayanıklılık',exact:true}).click();await page.locator('[data-stat=max_stamina]').click();await page.screenshot({path:out+'/combat-values-phone.png'});}
  }
  await page.setViewportSize({width:874,height:402});await page.waitForTimeout(120);await page.getByRole('tab',{name:'Dayanıklılık',exact:true}).click();await page.locator('[data-stat=stamina_regeneration]').click();
  const before=await page.locator('.combat-values-total>strong').textContent();await page.getByRole('button',{name:'Çok oyunculu',exact:true}).click();assert.notEqual(await page.locator('.combat-values-total>strong').textContent(),before);
  const nextSource=page.getByRole('button',{name:'Sonraki katkı sayfası',exact:true});while(await nextSource.isEnabled())await nextSource.click();assert.ok((await page.locator('.combat-values-sources').textContent()).includes('Moral'));await layout(page,'last sources');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#combat-values').count(),0);assert.equal(await page.locator('#orders').isVisible(),true);assert.equal(await page.locator('#orders').evaluate(e=>e.inert),false);assert.equal(await page.evaluate(()=>document.activeElement.className),'exercise-combat-values');
  await page.evaluate(()=>{fixtureReport.totals.max_hp=333;});await page.getByRole('button',{name:'Savaş Değerleri',exact:true}).click();await page.waitForSelector('.combat-values-stat');await page.getByRole('tab',{name:'Dayanıklılık',exact:true}).click();assert.equal(await page.locator('[data-stat=max_hp] strong').textContent(),'333');
  await page.evaluate(()=>{fixtureReport.totals.max_hp=444;glad.items=[...glad.items,{id:'changed'}];controller.render();});await page.waitForFunction(()=>document.querySelector('[data-stat=max_hp] strong')?.textContent==='444');
  await page.locator('.combat-values-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Yenile');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'combat-values-close');
  await page.evaluate(()=>{fail=true;});await page.locator('#combat-values').getByRole('button',{name:'Yenile',exact:true}).click();await page.waitForSelector('.combat-values-state [role=alert],.combat-values-state[role=alert]');assert.equal(await page.locator('.combat-values-stat').count(),0);await layout(page,'network error');
  await page.evaluate(()=>fail=false);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await page.waitForSelector('.combat-values-stat');
  await page.evaluate(()=>{glad.record.name='<img src=x onerror=alert(1)>';controller.render();});await page.waitForSelector('.combat-values-stat');assert.equal(await page.locator('.combat-values-identity img').count(),0);
  await page.evaluate(()=>{hold=true;});await page.locator('#combat-values').getByRole('button',{name:'Yenile',exact:true}).click();await page.waitForFunction(()=>!!resolveHeld);assert.equal(await page.locator('.combat-values-stat').count(),0);
  await page.evaluate(()=>authListeners.forEach(fn=>fn('SIGNED_OUT',null)));assert.equal(await page.locator('#combat-values').count(),0);await page.evaluate(()=>resolveHeld({data:fixtureReport}));await page.waitForTimeout(30);assert.equal(await page.locator('#combat-values').count(),0,'late reply after logout');
  await page.evaluate(()=>{hold=false;fixtureReport.owner_id='wrong-owner';});await page.getByRole('button',{name:'Savaş Değerleri',exact:true}).click();await page.waitForSelector('.combat-values-state[role=alert]');assert.equal(await page.locator('.combat-values-stat').count(),0,'owner mismatch never rendered');
  await page.evaluate(()=>controller.close());assert.equal(await page.locator('#combat-values').count(),0);assert.equal(await page.locator('#orders').isVisible(),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({viewports:5,allTabs:true,paginatedSources:true,noVerticalScroll:true,bothModes:true,gearRefresh:true,escapeAndFocus:true,errorRetry:true,lateReplyAndOwnerGuards:true,textSafety:true,pageErrors:0}));
 }catch(e){await page.screenshot({path:out+'/combat-values-failure.png'});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
