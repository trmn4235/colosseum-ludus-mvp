const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {script}=require('./infirmary-fixture-v289.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'infirmary-v289-'));
const selectors='#infirmaryModal,.inf289-header,#infirmaryTitle,.inf289-filters,.inf289-body,.inf289-list,.inf289-patients,.inf289-patient,.inf289-detail,.inf289-patient-heading,.inf289-preview-columns,.inf289-materials,.inf289-material-table,.inf289-material-row,.inf289-material-row>span,.inf289-effects,.inf289-effect-rows,.inf289-effect,.inf289-actions,.inf289-treatment,.inf289-footer';
const html=`<!doctype html><html lang="tr" data-ui-theme="white"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/ui-theme-v275.js"></script><link rel="stylesheet" href="/ui-theme-v275.css"><link rel="stylesheet" href="/infirmary-v289.css"><link rel="stylesheet" href="/infirmary-supplies-v289.css"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}button{font:inherit;min-height:42px;padding:9px 16px}</style></head><body data-roman-screen="ludus"><button id="entry">Reviri aç</button><script src="/infirmary-v289.js"></script><script src="/infirmary-supplies-v289.js"></script><script>
window.testUser={id:'ui-owner'};window.__testClient={rpc:async()=>({error:{message:'Unexpected RPC'}})};
${script()}
window.paused=false;let infPause=false,medPause=false;
window.infirmary=LudusInfirmaryV289.create({client:__testClient,ready:Promise.resolve({user_id:testUser.id}),openProduction:()=>medical.open({returnTo:()=>infirmary.open()}),onOpen(){infPause=paused;paused=true;},onClose(){paused=infPause;}});
window.medical=LudusInfirmarySuppliesV289.create({client:__testClient,ready:Promise.resolve({user_id:testUser.id}),onCraft:()=>infirmary.refresh(),onOpen(){medPause=paused;paused=true;},onClose(){paused=medPause;}});
document.querySelector('#entry').onclick=()=>infirmary.open();
</script></body></html>`;
const layoutFailures=[];
async function checkLayout(page,label,collect=false){
 const bad=await page.evaluate(selectors=>[...document.querySelectorAll(selectors)].filter(node=>node.getClientRects().length).flatMap(node=>{const r=node.getBoundingClientRect();return node.scrollHeight>node.clientHeight+2||node.scrollWidth>node.clientWidth+2||r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5?[{class:node.className,height:node.clientHeight,scrollHeight:node.scrollHeight,width:node.clientWidth,scrollWidth:node.scrollWidth,rect:[r.x,r.y,r.width,r.height]}]:[];}),selectors);
 const readability=await page.evaluate(()=>{
  const failures=[],title=document.querySelector('#infirmaryTitle'),header=document.querySelector('.inf289-header'),titleStyle=getComputedStyle(title),headerStyle=getComputedStyle(header),titleRect=title.getBoundingClientRect();
  if(title.textContent!=='Revir'||titleStyle.display==='none'||titleStyle.visibility!=='visible'||Number(titleStyle.opacity)===0||titleRect.height<parseFloat(titleStyle.fontSize)||titleRect.width<30||titleStyle.color!==headerStyle.color||titleStyle.color===headerStyle.backgroundColor)failures.push({part:'title',text:title.textContent,color:titleStyle.color,headerColor:headerStyle.color,background:headerStyle.backgroundColor,rect:[titleRect.width,titleRect.height]});
  if(headerStyle.pointerEvents!=='auto')failures.push({part:'header controls',pointerEvents:headerStyle.pointerEvents});
  for(const patient of document.querySelectorAll('.inf289-patient')){
   const row=patient.getBoundingClientRect();let previousBottom=row.top;
   for(const child of patient.children){const box=child.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(child);const text=range.getBoundingClientRect();if(box.height<text.height-.5||box.top<previousBottom-.5||text.top<row.top+1||text.bottom>row.bottom-1)failures.push({part:'patient line',text:child.textContent,row:[row.top,row.bottom],box:[box.top,box.bottom],textRect:[text.top,text.bottom]});previousBottom=box.bottom;}
  }
  return failures;
 });
 const failures=[...bad,...readability];
 if(collect){if(failures.length)layoutFailures.push({label,failures});}
 else assert.deepEqual(failures,[],label+' geometry and readable text');
}
async function selectInjury(page,id){await page.evaluate(id=>infirmary.open({injuryId:id}),id);await page.waitForFunction(id=>infirmary.preview?.injury_id===id&&!document.querySelector('.inf289-start')?.disabled,id);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const safari=!!process.env.LUDUS_WEBKIT_TEST;
 const browser=await(safari?webkit:chromium).launch({headless:true,...(!safari?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}),...(process.env.LUDUS_BROWSER_PATH&&!safari?{executablePath:process.env.LUDUS_BROWSER_PATH}:{})});
 let page;const errors=[];
 try{
  page=await browser.newPage({viewport:{width:874,height:402}});page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{const pathname=new URL(route.request().url()).pathname;if(pathname==='/fixture')return route.fulfill({contentType:'text/html',body:html});const file=path.join(root,pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':undefined});});
  await page.goto('https://infirmary.test/fixture');await page.locator('#entry').click();await page.waitForFunction(()=>infirmary.preview?.injury_id==='injury-0');
  assert.equal(await page.locator('.inf289-material-row[data-sku="linen_bandage"] [role=cell]').allTextContents().then(cells=>cells.join('|')),'Keten Sargı Bezi|1|20');
  assert.match(await page.locator('.inf289-patient-heading').innerText(),/Yorgunluk 45,5\/100/);assert.match(await page.locator('.inf289-recovery').innerText(),/10,04 puan\/saat/);
  const sizes=[[1280,720],[874,402],[852,393],[667,375],[568,320],[390,844]];
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});
   for(let index=0;index<15;index++){
    await selectInjury(page,'injury-'+index);await checkLayout(page,JSON.stringify({width,height,injury:index,screen:'preview'}),true);
    const seenMaterials=new Set(await page.locator('.inf289-material-row[data-sku]').evaluateAll(rows=>rows.map(row=>row.dataset.sku)));
    for(const pager of ['.inf289-material-pager','.inf289-effect-pager']){
     const next=page.locator(pager+' button:last-child');while(await next.count()&&await next.isEnabled()){await next.click();await checkLayout(page,JSON.stringify({width,height,injury:index,pager}),true);for(const sku of await page.locator('.inf289-material-row[data-sku]').evaluateAll(rows=>rows.map(row=>row.dataset.sku)))seenMaterials.add(sku);}
     const previous=page.locator(pager+' button:first-child');while(await previous.count()&&await previous.isEnabled())await previous.click();
    }
    assert.deepEqual([...seenMaterials].sort(),await page.evaluate(()=>infirmary.preview.required.map(row=>row.sku).sort()),'Every required material remains reachable at '+width+'×'+height+' injury '+index);
    if([0,5,10].includes(index))await page.screenshot({path:path.join(out,`revir-${width}-${['hafif','orta','kotu'][Math.floor(index/5)]}.png`)});
   }
   for(const theme of ['blue','black','white']){await page.evaluate(theme=>LudusTheme.set(theme),theme);await checkLayout(page,theme+' '+width+' heavy',true);}
  }
  assert.deepEqual(layoutFailures,[],'All fifteen injury previews, all six sizes and all pages must fit');
  await page.setViewportSize({width:874,height:402});await selectInjury(page,'injury-5');await page.evaluate(()=>__infDropNext=true);await page.locator('.inf289-start').click();
  await page.getByRole('button',{name:'Yeniden dene',exact:true}).waitFor();assert.equal(await page.evaluate(()=>infirmary.state.injuries[5].status),'untreated');
  await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await page.locator('.inf289-countdown').waitFor();assert.equal(await page.evaluate(()=>__infCommits),1);
  assert.equal(await page.evaluate(()=>{const calls=__infReads.filter(call=>call.p_action==='start');return calls.length===2&&calls[0].p_request===calls[1].p_request;}),true);
  assert.match(await page.locator('.inf289-saved').innerText(),/Keten Sargı Bezi × 1/);assert.equal(await page.locator('.inf289-finish').isDisabled(),true);
  for(const[width,height]of sizes){await page.setViewportSize({width,height});await checkLayout(page,width+' active treatment');await page.screenshot({path:path.join(out,`revir-${width}-tedavide.png`)});}
  await page.setViewportSize({width:874,height:402});await page.locator('.inf289-production').click();await page.locator('#medicalSuppliesModal').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>paused),true);assert.equal(await page.locator('#infirmaryModal').isVisible(),false);
  await page.locator('[data-recipe="linen_bandage"]').click();await page.locator('[data-craft]').click();await page.waitForFunction(()=>medical.state.inventory.find(i=>i.sku==='linen_bandage').quantity===20);
  await page.getByRole('button',{name:'Geri dön',exact:true}).click();await page.locator('#infirmaryModal').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>paused),true);
  await page.evaluate(()=>{__infNow+=43200000;return infirmary.refresh();});await page.waitForFunction(()=>infirmary.state.injuries[5].status==='healed');
  await page.getByRole('button',{name:'Tamamlanan · 1',exact:true}).click();assert.match(await page.locator('.inf289-complete').innerText(),/Tedavi tamamlandı/);assert.equal(await page.locator('.inf289-start').count(),0);
  await page.getByRole('button',{name:'Önceki kayıtlar · 1',exact:true}).click();assert.match(await page.locator('.inf289-list').innerText(),/Eski kayıtlı gladyatör/);assert.equal(await page.locator('.inf289-start').count(),0);
  await page.getByRole('button',{name:'Reviri kapat',exact:true}).click();assert.equal(await page.evaluate(()=>paused),false);
  await page.close();
  // Actual ludus.html: room marker, Doctor profile, forge category and pause/return lifecycle.
  const base=fs.readFileSync(path.join(__dirname,'daily-kitchen-ui-v265.cjs'),'utf8'),sandbox={};vm.runInNewContext(base.slice(base.indexOf('const user='),base.indexOf('(async()=>{'))+';this.fixture=mock+foodMock;',sandbox);
  const supplyFixture=`const revirWorldRPC=__testClient.rpc;__testClient.rpc=async(name,args)=>{if(name==='ludus_supply')return{data:{user_id:testUser.id,server_now:new Date().toISOString(),gold:4800,level:1,workers:1,free_workers:1,busy_workers:0,resources:[],recipes:[],jobs:[],destinations:[],deliveries:[]}};return revirWorldRPC(name,args);};`;
  const fixture=sandbox.fixture+require('./special-staff-fixture-v288.cjs').script()+script()+supplyFixture;
  page=await browser.newPage({viewport:{width:874,height:402},hasTouch:true});page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8765/**',route=>{const file=path.join(root,new URL(route.request().url()).pathname);if(!fs.existsSync(file))return route.fulfill({status:404});let body=fs.readFileSync(file);if(file.endsWith('ludus.html'))body=Buffer.from(body.toString().replace('const accountClient=LudusClient.create','let accountClient=LudusClient.create').replace('const accountReady=(async()=>{',fixture+'\nconst accountReady=(async()=>{accountClient=window.__testClient;'));return route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});});await page.route('https://**',route=>route.abort());
  await page.goto('http://127.0.0.1:8765/ludus.html');await page.waitForFunction(()=>window.LudusPreview?.exploring&&LudusPreview.infirmary.state?.injuries.length===15,null,{timeout:90000});await page.bringToFront();
  await page.evaluate(()=>{LudusPreview.enterRoom(LudusPreview.rooms.find(room=>room.kind==='infirmary'));Object.assign(LudusPreview.player,{x:-2.54,z:2.6,yaw:0,pitch:0});});
  await page.locator('#infirmaryAction').waitFor({state:'visible',timeout:30000});await page.locator('#infirmaryAction').click();await page.waitForFunction(()=>LudusPreview.infirmary.preview?.can_start);assert.equal(await page.evaluate(()=>LudusPreview.paused),true);await checkLayout(page,'actual ludus infirmary');
  await page.locator('.inf289-production').click();await page.locator('#medicalSuppliesModal').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>LudusPreview.paused),true);
  await page.getByRole('button',{name:'Geri dön',exact:true}).click();await page.locator('#infirmaryModal').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>LudusPreview.paused),true);
  await page.getByRole('button',{name:'Reviri kapat',exact:true}).click();assert.equal(await page.evaluate(()=>LudusPreview.paused),false);
  await page.evaluate(()=>LudusPreview.specialStaff.open('doctor'));await page.locator('.inf289-staff-action').click();await page.locator('#infirmaryModal').waitFor({state:'visible'});assert.equal(await page.locator('#specialStaffModal').isVisible(),false);await page.getByRole('button',{name:'Reviri kapat',exact:true}).click();
  await page.evaluate(()=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(room=>room.kind==='upgrades'));return LudusPreview.supplySystem.open('craft');});await page.getByRole('button',{name:'Revir malzemeleri',exact:true}).click();await page.locator('#medicalSuppliesModal').waitFor({state:'visible'});assert.equal(await page.locator('#supplyModal').isVisible(),false);assert.equal(await page.evaluate(()=>LudusPreview.paused),true);
  await page.getByRole('button',{name:'Geri dön',exact:true}).click();await page.locator('#supplyModal[data-view="craft"]').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>LudusPreview.paused),true);
  await page.evaluate(()=>LudusPreview.supplySystem.close());assert.equal(await page.evaluate(()=>LudusPreview.paused),false);assert.deepEqual(errors,[]);
  console.log('PASS V289 revir UI: fifteen injuries/six sizes/three themes, material and fatigue previews, saved receipt/idempotent start, server timer, legacy/completed records, real room and doctor entry, forge production and pause-safe return.');
 }catch(error){if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'infirmary-failure.png')}).catch(()=>{});throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
