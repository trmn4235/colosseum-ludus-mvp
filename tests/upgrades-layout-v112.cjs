const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/combat-values-v110';
const report=JSON.parse(fs.readFileSync(path.join(out,'combat-values-fixture.json'),'utf8'));
const raw=fs.readFileSync(path.join(root,'gelistirmeler.html'),'utf8');
async function layout(page,label){
 const bad=await page.evaluate(()=>{
  const selectors='.game-shell,.workspace,.layout,.item-panel,.operation,.inventory-panel,.combined-stones,.materials-head,.stats,.sockets,.stone-list,.pouch,.gem-grid,.pouch-aside';
  return [...document.querySelectorAll(selectors)].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).flatMap(e=>{const r=e.getBoundingClientRect();return e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2||r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5?[{cls:e.className,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight],rect:[r.left,r.top,r.right,r.bottom]}]:[];});
 });
 assert.deepEqual(bad,[],label+' overflow');
 const bounds=await page.locator('.game-shell').boundingBox(),view=page.viewportSize();
 assert.deepEqual(bounds,{x:0,y:0,...view},label+' edge-to-edge shell');
 assert.equal(await page.locator('.side').count(),0,'removed navigation');
 const buttons=await page.evaluate(()=>['enhance','openPouch','openCombatInfo'].flatMap(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return r.width<=0||r.height<19||r.bottom>innerHeight||r.right>innerWidth?[id]:[];}));
 assert.deepEqual(buttons,[],label+' footer and action reachable');
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:874,height:402}}),errors=[];let safe=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(report=>{
  window.calls=[];const user={id:report.owner_id};
  const items=report.items.map(i=>({...i,enhancement:0,emeralds:[],owner_id:user.id,equipped_by:null,locked_battle_id:null}));
  const legs=items.find(i=>i.kind==='legs');for(let i=1;i<9;i++)items.push({...legs,id:'legs-'+i});
  window.fixtureItems=items;
  window.fixtureClient={auth:{getUser:async()=>({data:{user}}),onAuthStateChange:()=>{}},rpc:async(name,args)=>{calls.push({name,args});if(name==='ludus_upgrade_item_v10')throw Error('Unexpected transaction in layout test');return {data:{friends:[]}};},from:table=>{
   const data=table==='ludus_accounts'?{ludus_name:'Tırman',gold:1372,diamonds:15}:table==='ludus_items'?items:table==='ludus_stones'?['sapphire','emerald','ruby'].flatMap(family=>Array.from({length:family==='ruby'?4:family==='emerald'?15:18},(_,i)=>({family,stone_id:i+1,quantity:5}))):[];
   const query={select(){return this},eq(){return this},order(){return this},single(){return this},then(resolve,reject){return Promise.resolve({data}).then(resolve,reject)}};return query;
  }};
 },report);
 const adapt=text=>safe?text.replace(/env\(safe-area-inset-(left|right|top|bottom)\)/g,(_,side)=>({left:'59px',right:'59px',top:'0px',bottom:'21px'})[side]):text;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),file=decodeURIComponent(url.pathname.slice(1));
  if(file==='gelistirmeler.html')return route.fulfill({contentType:'text/html',body:adapt(raw.replaceAll('LudusClient.create(ARENA_SUPABASE_CONFIG.url,ARENA_SUPABASE_CONFIG.publishableKey)','window.fixtureClient'))});
  if(file.startsWith('assets/runtime/'))return route.fulfill({contentType:'text/javascript',body:''});
  const local=path.join(root,file);if(fs.existsSync(local)&&fs.statSync(local).isFile())return route.fulfill({contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.webp')?'image/webp':'application/octet-stream',body:file.endsWith('.css')?adapt(fs.readFileSync(local,'utf8')):fs.readFileSync(local)});
  return route.fulfill({status:404,body:''});
 });
 try{
  await page.goto('https://ludus.test/gelistirmeler.html');await page.waitForFunction(()=>document.getElementById('wallet').textContent.includes('Tırman'));
  for(const[width,height]of[[1536,706],[1440,900],[874,402],[852,393],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(80);
   for(const category of['Silah','Kalkan','Miğfer','Zırh','Omuzluk','Bacaklık']){await page.locator('#itemTabs').getByRole('button',{name:category,exact:true}).click();await page.locator('.item').first().click();await layout(page,width+'x'+height+' '+category);}
   assert.equal(await page.locator('#inventory .item').count(),4);await page.locator('#nextItems').click();assert.equal(await page.locator('#inventory .item').count(),4);await page.locator('#nextItems').click();assert.equal(await page.locator('#inventory .item').count(),1);await page.locator('#previousItems').click();await page.locator('#previousItems').click();
   if(width===874)await page.screenshot({path:out+'/upgrades-phone-v112.png'});
   await page.locator('#openPouch').click();await page.waitForSelector('#pouchOverlay:not([hidden])');await layout(page,width+'x'+height+' pouch');
   for(const category of['Elmas','Safir','Zümrüt','Yakut']){await page.locator('#gemTabs').getByRole('button',{name:category,exact:true}).click();await page.locator('.gem-slot:not(.empty-slot)').first().click();await layout(page,width+'x'+height+' '+category);}
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'openPouch');
  }
  assert.deepEqual(await page.evaluate(()=>[...new Set(calls.filter(c=>c.name==='ludus_first_quests'&&c.args.p_action==='stones').map(c=>c.args.p_subject))].sort()),['diamond','emerald','ruby','sapphire']);
  safe=true;await page.setViewportSize({width:874,height:402});await page.reload();await page.waitForFunction(()=>document.getElementById('wallet').textContent.includes('Tırman'));await layout(page,'iPhone safe areas');await page.screenshot({path:out+'/upgrades-safearea-v112.png'});
  await page.setViewportSize({width:402,height:874});await page.waitForSelector('#landscapeGate:not([hidden])');assert.equal(await page.locator('.game-shell').evaluate(e=>e.inert),true);
  await page.setViewportSize({width:874,height:402});await page.waitForSelector('#landscapeGate[hidden]',{state:'attached'});assert.equal(await page.locator('.game-shell').evaluate(e=>e.inert),false);await layout(page,'landscape restored');
  assert.equal(await page.evaluate(()=>calls.some(c=>c.name==='ludus_upgrade_item_v10')),false);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({viewports:6,edgeToEdge:true,noSidebar:true,allEquipmentCategories:true,inventoryPaging:true,pouchAndQuestTracking:true,safeAreas:true,rotation:true,transactions:0,pageErrors:0}));
 }catch(e){await page.screenshot({path:out+'/upgrades-failure-v112.png'});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
