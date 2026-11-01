// Real browser regressions: an unfinished optional image cannot lock the login form.
// Run with LUDUS_WEBKIT_TEST=1 for WebKit. All backend responses are local fixtures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),useWebkit=process.env.LUDUS_WEBKIT_TEST==='1';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
const artworkPath='/assets/colosseum-magnus-login-v40.webp';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
});
async function runCase(browser,base,stalled){
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],modelRequests=[],remoteRequests=[],imageRoutes=[];
 let loginRequests=0;
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('.glb'))modelRequests.push(url.pathname);
  if(url.origin===base){
   if(stalled==='network'&&url.pathname===artworkPath){imageRoutes.push(route);return;}
   return route.continue();
  }
  remoteRequests.push(url.origin+url.pathname);
  if(url.hostname.endsWith('.supabase.co')){
   const headers={'access-control-allow-origin':base,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'apikey, content-type, authorization, x-client-info'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   if(url.pathname==='/functions/v1/account-login')loginRequests++;
   return route.fulfill({status:401,headers,contentType:'application/json',body:JSON.stringify({error:'Kullanıcı adı veya şifre hatalı.'})});
  }
  return route.abort();
 });
 await page.addInitScript(({stalled})=>{
  window.__introEvents=[];
  new MutationObserver(records=>{
   for(const record of records)if(record.target===document.body)window.__introEvents.push(document.body.dataset.introState);
  }).observe(document,{subtree:true,attributes:true,attributeFilter:['data-intro-state']});
  if(stalled==='decode'){
   const decode=HTMLImageElement.prototype.decode;
   HTMLImageElement.prototype.decode=function(){
    if(this.id!=='loginArtwork')return decode.call(this);
    window.__artworkDecodeWaiting=true;
    return new Promise((resolve,reject)=>{window.__releaseArtworkDecode=()=>decode.call(this).then(resolve,reject);});
   };
  }
 },{stalled});
 try{
  const started=Date.now();
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#entryPanel').evaluate(panel=>panel.inert),true,'login initially respects the artwork presentation');
  if(stalled==='network')assert.ok(imageRoutes.length>0,'the actual artwork request is pending');
  else await page.waitForFunction(()=>window.__artworkDecodeWaiting===true,{},{timeout:3000});
  await page.waitForFunction(()=>{
   const panel=document.getElementById('entryPanel');
   return document.body.dataset.introState==='ready'&&!panel.inert&&getComputedStyle(panel).opacity==='1';
  },{},{timeout:15000});
  const recoveredMs=Date.now()-started;
  assert.ok(recoveredMs<16000,'the eight-second artwork deadline and existing intro finish in bounded time');
  assert.equal(await page.locator('#artworkFallback').isVisible(),true,'the existing fallback is visible');
  assert.equal(await page.locator('#loginArtwork').evaluate(image=>image.hidden),true,'the stalled image is hidden');
  if(stalled==='network')assert.notEqual(await page.evaluate(()=>document.readyState),'complete','recovery does not wait for document load');

  // Releasing the original operation must not reset the ready page or steal typed input.
  await page.locator('#username').fill('entry_fixture');
  if(stalled==='network'){
   for(const route of imageRoutes)await route.fulfill({status:200,contentType:'image/webp',body:fs.readFileSync(root+artworkPath)});
   await page.waitForFunction(()=>document.getElementById('loginArtwork').naturalWidth>0);
  }else await page.evaluate(()=>window.__releaseArtworkDecode());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(()=>document.body.dataset.introState),'ready','late completion cannot replay the intro');
  assert.equal(await page.locator('#username').inputValue(),'entry_fixture','late completion preserves input');
  assert.equal(await page.locator('#artworkFallback').isVisible(),true,'late completion preserves the fallback');
  assert.deepEqual(await page.evaluate(()=>window.__introEvents),['artwork','revealing','ready'],'only one intro sequence runs');

  // Prove the recovered controls perform the normal login action against a fixture only.
  await page.locator('#password').fill('fixture-only-password');
  await page.locator('#submitLogin').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('hatalı'));
  assert.equal(loginRequests,1,'usable login calls the mocked backend once');
  assert.deepEqual(errors,[],'no uncaught script errors');
  assert.deepEqual(modelRequests,[],'anonymous recovery never downloads models');
  assert.ok(remoteRequests.every(url=>new URL(url).hostname.endsWith('.supabase.co')),'only expected mocked backend calls occur');
  return{stalled,recoveredMs,lateCompletionPreservedReady:true,usableLogin:true,anonymousModelDownloads:0};
 }finally{await context.close();}
}
(async()=>{
 let browser;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base='http://127.0.0.1:'+server.address().port;
  browser=await(useWebkit?webkit:chromium).launch(useWebkit?{headless:true}:{headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
  const results=[];
  for(const stalled of ['network','decode'])results.push(await runCase(browser,base,stalled));
  console.log(JSON.stringify({pass:true,engine:useWebkit?'webkit':'chromium',results}));
 }finally{
  if(browser)await browser.close();
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
