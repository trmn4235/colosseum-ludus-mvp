const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const {runtime,item}=require('./combat-stats-v73.cjs');
const root=path.resolve(__dirname,'..');
async function main(){
 const server=http.createServer((req,res)=>{const local=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!local.startsWith(root+'/')||!fs.existsSync(local)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',local.endsWith('.html')?'text/html':local.endsWith('.css')?'text/css':'text/javascript');let body=fs.readFileSync(local);if(local.endsWith('gelistirmeler.html'))body=body.toString().replaceAll('supabase.createClient(ARENA_SUPABASE_CONFIG.url,ARENA_SUPABASE_CONFIG.publishableKey)','window.fixtureClient');res.end(body);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/tmp/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const c=runtime(),items=['weapon','shield','helmet','chest','gloves','legs'].map((kind,i)=>item(c,kind,{id:String(i),equipped_by:'gladiator',emeralds:[{id:2,value:100},{id:3,value:100},{id:4,value:100},{id:9,value:100}]}));
  await page.addInitScript(items=>{window.fixtureClient={auth:{getUser:async()=>({data:{user:{id:'owner',is_anonymous:false}}}),onAuthStateChange:()=>({})},from(table){const data=table==='ludus_items'?items:table==='ludus_accounts'?{ludus_name:'Test Ludus',gold:100,diamonds:20}:[];const q={select:()=>q,eq:()=>q,order:()=>q,single:()=>q,then:r=>Promise.resolve({data,error:null}).then(r)};return q;},rpc:async()=>({data:{friends:[],pending:[]}})};},items);
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  for(const [width,height]of [[844,390],[667,375],[568,320],[1366,768]]){
   await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:'+server.address().port+'/gelistirmeler.html');await page.locator('#itemName').filter({hasText:'+0'}).waitFor();
   await page.locator('#openCombatInfo').click();await page.locator('#combatInfo[open]').waitFor();assert.match(await page.locator('#combatInfo').innerText(),/%0,027/);
   await page.locator('#combatInfo [data-tab="bonus"]').click();assert.match(await page.locator('#combatInfo').innerText(),/6 eşyasının toplamı/);
   const stamina=page.locator('#combatInfo tr').filter({hasText:'Maksimum Kondisyon'});assert.match(await stamina.innerText(),/120\s+100 \/ 100\s+20/);
   const box=await page.locator('#combatInfo').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
   if(width===844){const out=process.env.LUDUS_TEST_OUTPUT||'/tmp';await page.screenshot({path:out+'/combat-inspector-v74.png'});}
   await page.keyboard.press('Escape');assert.equal(await page.locator('#combatInfo').evaluate(d=>d.open),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'openCombatInfo');
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({viewports:4,realPage:true,odds:true,equipmentCaps:true,keyboardClose:true,focusRestored:true}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
