const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright'));
const {runtime,item}=require('./combat-stats-v73.cjs');
const root=path.resolve(__dirname,'..');
async function main(){
 const server=http.createServer((req,res)=>{if(req.url.startsWith('/assets/runtime/')){res.writeHead(200,{'Content-Type':'text/javascript'});res.end('');return;}const local=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!local.startsWith(root+'/')||!fs.existsSync(local)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',local.endsWith('.html')?'text/html':local.endsWith('.css')?'text/css':'text/javascript');let body=fs.readFileSync(local);if(local.endsWith('gelistirmeler.html'))body=body.toString().replaceAll('LudusClient.create(ARENA_SUPABASE_CONFIG.url,ARENA_SUPABASE_CONFIG.publishableKey)','window.fixtureClient').replaceAll('supabase.createClient(ARENA_SUPABASE_CONFIG.url,ARENA_SUPABASE_CONFIG.publishableKey)','window.fixtureClient');res.end(body);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),headless:true,args:['--no-sandbox']});}catch(e){await new Promise(r=>server.close(r));throw e;}
 try{
  const page=await browser.newPage(),errors=[],backend=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('.supabase.co'))backend.push(r.url());});
  const c=runtime(),items=['weapon','shield','helmet','chest','gloves','legs'].map((kind,i)=>item(c,kind,{id:String(i),equipped_by:'gladiator',emeralds:[{id:2,value:100},{id:3,value:100},{id:4,value:100},{id:9,value:100}]}));
  await page.addInitScript(items=>{window.fixtureClient={auth:{getUser:async()=>({data:{user:{id:'owner',is_anonymous:false}}}),onAuthStateChange:()=>({})},from(table){const data=table==='ludus_items'?items:table==='ludus_accounts'?{ludus_name:'Test Ludus',gold:100,diamonds:20}:[];const q={select:()=>q,eq:()=>q,order:()=>q,single:()=>q,then:r=>Promise.resolve({data,error:null}).then(r)};return q;},rpc:async(name,args)=>{
   if(name!=='ludus_smith_preview_v288')return{data:{friends:[],pending:[]}};
   if(window.holdPreview){const id=args.p_item;await new Promise(resolve=>{window.releasePreview=resolve;window.heldItem=id;});}
   return{data:{action:args.p_action,item_id:args.p_item,base_chance:.7,chance:args.p_item==='0'?.706:.704,effective_bonus:args.p_item==='0'?.006:.004,general_bonus:.002,conditional_bonus:args.p_item==='0'?.004:.002,series:{next_attempt:5,completed:4,low_streak:2},applied:[{title:'Demirci bilgisi',bonus:.002}]}};
  }};},items);
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  for(const [width,height]of [[844,390],[667,375],[568,320],[1366,768]]){
   await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:'+server.address().port+'/gelistirmeler.html');await page.locator('#itemName').filter({hasText:'+0'}).waitFor();
   await page.locator('#openCombatInfo').click();await page.locator('#combatInfo[open]').waitFor();assert.match(await page.locator('#combatInfo').innerText(),/%0,027/);assert.match(await page.locator('#combatInfo').innerText(),/Başarı %70,6/);assert.match(await page.locator('#combatInfo').innerText(),/Demirci \+0,6 yüzde puan/);assert.match(await page.locator('#combatInfo').innerText(),/5\. deneme/);
   await page.locator('#combatInfo [data-tab="bonus"]').click();assert.match(await page.locator('#combatInfo').innerText(),/6 eşyasının toplamı/);
   const stamina=page.locator('#combatInfo tr').filter({hasText:'Maksimum Kondisyon'});assert.match(await stamina.innerText(),/120\s+100 \/ 100\s+20/);
   const box=await page.locator('#combatInfo').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
   if(width===844){const out=process.env.LUDUS_TEST_OUTPUT||'/tmp';await page.screenshot({path:out+'/combat-inspector-v74.png'});}
   await page.keyboard.press('Escape');assert.equal(await page.locator('#combatInfo').evaluate(d=>d.open),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'openCombatInfo');
  }
  // A new selection clears the old chance while its authoritative request is pending.
  await page.evaluate(()=>{window.holdPreview=true;window.releasePreview=null;});
  await page.locator('#itemTabs button').filter({hasText:'Kalkan'}).click();await page.locator('#inventory .item').first().click();
  await page.waitForFunction(()=>typeof window.releasePreview==='function');await page.locator('#openCombatInfo').click();await page.locator('#combatInfo [data-tab="odds"]').click();
  assert.match(await page.locator('#combatInfo').innerText(),/İşlem hesabı yükleniyor/);assert.doesNotMatch(await page.locator('#combatInfo').innerText(),/Başarı %70,6/);
  await page.evaluate(()=>{window.holdPreview=false;window.releasePreview();});await page.waitForFunction(()=>document.querySelector('#combatInfo').innerText.includes('Başarı %70,4'));
  assert.match(await page.locator('#combatInfo').innerText(),/Demirci \+0,4 yüzde puan/);await page.keyboard.press('Escape');
  // The staff calculation deep link opens the same live dialog.
  await page.goto('http://127.0.0.1:'+server.address().port+'/gelistirmeler.html?smith=1');await page.locator('#combatInfo[open]').waitFor();await page.waitForFunction(()=>document.querySelector('#combatInfo').innerText.includes('Başarı %70,6'));
  assert.deepEqual(errors,[]);assert.deepEqual(backend,[],'all account data and odds come from the fixture, with no API key or backend calls');console.log(JSON.stringify({viewports:4,realPage:true,odds:true,equipmentCaps:true,keyboardClose:true,focusRestored:true}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
