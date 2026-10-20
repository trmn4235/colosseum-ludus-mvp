// Real workshop DOM and assets; all account data and transactions are local fixtures.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/workshop-v133';
const raw=fs.readFileSync(path.join(root,'gelistirmeler.html'),'utf8'),context=vm.createContext({});
vm.runInContext(raw.slice(raw.indexOf('var LudusItemSystem ='),raw.indexOf("if(typeof module!==")),context);
const rules=context.LudusItemSystem;
const items=['legs','weapon','shield','helmet','chest','gloves'].flatMap(kind=>Array.from({length:8},(_,n)=>({id:kind+'-'+n,kind,model:kind==='weapon'?'gladius':kind==='shield'?'round':kind==='helmet'?'roman':kind,enhancement:n?10:1,stat_version:10,natural_rule_version:2,natural_stats:rules.baseStats(kind),natural_percentages:Object.fromEntries(rules.statsFor(kind).map((s,i)=>[s.key,[30,30,0,10,20,0][i]])),emeralds:[],equipped_by:null,locked_battle_id:null})));
async function checkLayout(page,label){
 const bad=await page.evaluate(()=>{
  const visible=e=>e.getClientRects().length&&!e.closest('[hidden]');
  const failures=[...document.querySelectorAll('.game-shell,.layout,.panel,.forge-stage,.forge-chance,.material-cost,.materials-head,.stone-list,.material-stone')].filter(visible).flatMap(e=>{const r=e.getBoundingClientRect();return e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2||r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5?[{element:e.className,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight]}]:[]});
  for(const card of document.querySelectorAll('.material-stone')){
   const name=card.querySelector('small'),qty=card.querySelector('.quantity'),bounds=card.getBoundingClientRect(),qr=qty.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(name);
   for(const r of range.getClientRects()){
    if(r.left<bounds.left||r.right>bounds.right||r.top<bounds.top||r.bottom>bounds.bottom)failures.push({clipped:name.textContent});
    if(r.left<qr.right&&r.right>qr.left&&r.top<qr.bottom&&r.bottom>qr.top)failures.push({overlap:name.textContent});
   }
   range.selectNodeContents(qty);const r=range.getBoundingClientRect();if(r.right>bounds.right||r.bottom>bounds.bottom)failures.push({clippedQuantity:qty.textContent});
  }
  const cta=document.getElementById('enhance').getBoundingClientRect();if(cta.height<(innerHeight<=350?44:50)||cta.width<130)failures.push({smallButton:[cta.width,cta.height]});
  return failures;
 });
 assert.deepEqual(bad,[],label);
 assert.equal(await page.locator('#successRate').isVisible(),true,label+' probability visible');
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1536,height:706},hasTouch:true}),errors=[];let safe=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(items=>{
  const user={id:'00000000-0000-4000-8000-000000000001'},account={ludus_name:'Tırman',gold:999999,diamonds:999999};
  const stones=['sapphire','emerald','ruby'].flatMap(family=>Array.from({length:family==='ruby'?4:family==='emerald'?15:18},(_,i)=>({family,stone_id:i+1,quantity:999999})));
  window.fixtureItems=items;window.calls=[];window.upgradeMode='success';window.upgradeResults={};window.releaseUpgrade=null;
  window.fixtureClient={auth:{getUser:async()=>({data:{user}}),onAuthStateChange:()=>{}},rpc:async(name,args)=>{
   calls.push({name,args:structuredClone(args)});if(name!=='ludus_upgrade_item_v10')return{data:{friends:[]}};
   await new Promise(resolve=>{window.releaseUpgrade=resolve;});
   if(upgradeMode==='network')return{error:{code:'08006',message:'Test bağlantı kesintisi'}};
   if(!upgradeResults[args.p_request]){const item=items.find(i=>i.id===args.p_item);if(args.p_action==='enhance'){account.diamonds--;item.enhancement++;upgradeResults[args.p_request]={action:'enhance',success:true,plus:item.enhancement};}else{const stone=stones.find(s=>s.family===args.p_action&&s.stone_id===args.p_stone);stone.quantity--;upgradeResults[args.p_request]={action:args.p_action,percentage:50};}}
   return{data:upgradeResults[args.p_request]};
  },from:table=>{const data=table==='ludus_accounts'?account:table==='ludus_items'?items:table==='ludus_stones'?stones:[];return{select(){return this},eq(){return this},order(){return this},single(){return this},then(a,b){return Promise.resolve({data}).then(a,b)}}}};
 },items);
 const adapt=text=>safe?text.replace(/env\(safe-area-inset-(left|right|top|bottom)\)/g,(_,side)=>({left:'59px',right:'59px',top:'0px',bottom:'21px'})[side]):text;
 await page.route('**/*',async route=>{
  const file=decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
  if(file==='gelistirmeler.html')return route.fulfill({contentType:'text/html',body:adapt(raw.replaceAll('LudusClient.create(ARENA_SUPABASE_CONFIG.url,ARENA_SUPABASE_CONFIG.publishableKey)','window.fixtureClient'))});
  if(file.startsWith('assets/runtime/'))return route.fulfill({contentType:'text/javascript',body:''});
  const local=path.join(root,file);return fs.existsSync(local)&&fs.statSync(local).isFile()?route.fulfill({contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.webp')?'image/webp':'application/octet-stream',body:file.endsWith('.css')?adapt(fs.readFileSync(local,'utf8')):fs.readFileSync(local)}):route.fulfill({status:404,body:''});
 });
 const materials=async label=>{
  for(const id of['openSafir','openEmeraldStrip','openRuby']){
   await page.locator('#'+id).click();
   do{await checkLayout(page,label+' '+id);if(await page.locator('#nextMaterials').isDisabled())break;await page.locator('#nextMaterials').click();}while(true);
  }
 };
 try{
  await page.goto('https://ludus.test/gelistirmeler.html');await page.waitForFunction(()=>!document.getElementById('enhance').disabled);
  for(const[width,height]of[[1536,706],[1440,900],[874,402],[852,393],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(60);
   for(const category of['Silah','Kalkan','Miğfer','Zırh','Omuzluk','Bacaklık']){await page.locator('#itemTabs').getByRole('button',{name:category,exact:true}).click();await page.locator('.item').first().click();await page.locator('#openSafir').click();await checkLayout(page,width+' '+category);if(['Silah','Miğfer','Bacaklık'].includes(category))await materials(width+' '+category);}
   await page.locator('#openSafir').click();await page.screenshot({path:path.join(out,'workshop-'+width+'.png')});
   await page.locator('#openEmeraldStrip').click();for(let i=0;i<(width<=1100?4:2);i++)await page.locator('#nextMaterials').click();
   const longStone=page.locator('.material-stone').filter({hasText:'Minimum Hasarı Maksimuma Yaklaştırma'});await longStone.click();
   assert.equal(await longStone.getAttribute('aria-pressed'),'true');await checkLayout(page,width+' selected long emerald');
   assert.match(await page.locator('#materialInfo').textContent(),/Minimum Hasarı Maksimuma Yaklaştırma/);
   await page.screenshot({path:path.join(out,'workshop-emerald-'+width+'.png')});await page.locator('#resetMaterial').click();
  }
  // Filled sockets remain compact; tapping one reveals its complete effect in the forge.
  await page.evaluate(()=>{fixtureItems.find(i=>i.id==='legs-1').emeralds=[9,11,13,4].map(id=>({id,value:100}));});await page.locator('.item').nth(1).click();await checkLayout(page,'filled sockets');
  await page.locator('.socket').first().click();assert.match(await page.locator('#materialInfo').textContent(),/Minimum Hasarı Maksimuma Yaklaştırma/);assert.equal(await page.locator('#enhance').textContent(),'YÜZDEYİ YENİLE');await checkLayout(page,'filled socket selection');await page.locator('#resetMaterial').click();
  // Safe insets reduce the usable width without pushing controls beneath the notch.
  safe=true;await page.setViewportSize({width:874,height:402});await page.reload();await page.waitForFunction(()=>!document.getElementById('enhance').disabled);await materials('safe areas');
  await page.locator('#openEmeraldStrip').click();for(let i=0;i<4;i++)await page.locator('#nextMaterials').click();await page.locator('.material-stone').first().click();await checkLayout(page,'safe selected emerald');await page.screenshot({path:path.join(out,'workshop-safe.png')});await page.locator('#resetMaterial').click();
  // A rapid second press during an in-flight response cannot submit twice.
  await page.locator('#enhance').click();await page.waitForFunction(()=>typeof releaseUpgrade==='function');
  assert.equal(await page.locator('#enhance').isDisabled(),true);assert.equal(await page.locator('#enhance').textContent(),'İŞLENİYOR…');
  await page.evaluate(()=>{document.getElementById('enhance').click();releaseUpgrade();});
  await page.waitForFunction(()=>!document.getElementById('enhance').disabled);assert.equal(await page.locator('#targetLevel').textContent(),'+3');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='ludus_upgrade_item_v10').length),1);
  // A failed response keeps its request ID when the player retries.
  await page.evaluate(()=>{upgradeMode='network';releaseUpgrade=null});await page.locator('#enhance').click();await page.waitForFunction(()=>typeof releaseUpgrade==='function');await page.evaluate(()=>releaseUpgrade());await page.waitForFunction(()=>document.getElementById('enhance').textContent==='İŞLEMİ TAMAMLA');await checkLayout(page,'pending retry');
  await page.evaluate(()=>{upgradeMode='success';releaseUpgrade=null});await page.locator('#enhance').click();await page.waitForFunction(()=>typeof releaseUpgrade==='function');await page.evaluate(()=>releaseUpgrade());await page.waitForFunction(()=>!document.getElementById('enhance').disabled);
  const requests=await page.evaluate(()=>calls.filter(c=>c.name==='ludus_upgrade_item_v10').map(c=>c.args.p_request));assert.equal(requests.length,3);assert.equal(requests[1],requests[2]);assert.equal(await page.locator('#targetLevel').textContent(),'+4');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.forge-ring').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({viewports:6,allGemNames:true,largeQuantities:true,stonePaging:true,selectedStonePreserved:true,safeAreas:true,minimumCTA:44,doubleTapGuard:true,retryRequestPreserved:true,reducedMotion:true,pageErrors:0}));
 }catch(e){await page.screenshot({path:path.join(out,'workshop-failure.png')});throw e;}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
