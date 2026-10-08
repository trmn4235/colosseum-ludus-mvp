// Browser checks for the cinematic hold, reveal, mobile layout and auth controls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LOGIN_QA_OUTPUT;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
const requests=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const body=fs.readFileSync(file);requests.push(url.pathname);
 res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','content-security-policy':"connect-src 'self' https://*.supabase.co"});
 if(url.pathname.endsWith('login-v40.webp'))setTimeout(()=>res.end(body),350);else res.end(body);
});
async function setup(browser,viewport,options={}){
 const context=await browser.newContext({viewport,hasTouch:true,...options}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://*.supabase.co/**',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Kullanıcı adı veya şifre hatalı.'})}));
 await page.addInitScript(()=>{
  window.__introEvents=[];
  new MutationObserver(records=>{for(const r of records)if(r.target===document.body)window.__introEvents.push({state:document.body.dataset.introState,time:performance.now()});})
   .observe(document,{subtree:true,attributes:true,attributeFilter:['data-intro-state']});
 });
 return{context,page,errors};
}
async function shot(page,name){if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,name+'.png')});}}
async function ready(page){await page.waitForFunction(()=>document.body.dataset.introState==='ready');}
async function bounds(page){return page.evaluate(()=>{
 const panel=document.getElementById('entryPanel'),r=panel.getBoundingClientRect(),img=document.getElementById('loginArtwork');
 const controls=['username','password','submitLogin','forgot','register'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return{id,x:b.x,y:b.y,right:b.right,bottom:b.bottom};});
 return{width:innerWidth,height:innerHeight,panel:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},opacity:getComputedStyle(panel).opacity,inert:panel.inert,fit:getComputedStyle(img).objectFit,image:[img.naturalWidth,img.naturalHeight],scroll:document.documentElement.scrollWidth>innerWidth,controls};
 });}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/index.html';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox']});
 const results=[];
 try{
  for(const [i,[width,height]]of [[844,390],[667,375],[740,360],[932,430],[1366,768]].entries()){
   const{context,page,errors}=await setup(browser,{width,height});
   await page.goto(url,{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#entryPanel').evaluate(p=>p.inert),true,'controls are inert during the artwork');
   await page.waitForFunction(()=>document.body.dataset.introState==='artwork');
   if(i===0){
    await shot(page,'01-artwork');
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(()=>document.body.dataset.introState),'artwork');
    assert.equal(await page.locator('#entryPanel').evaluate(p=>getComputedStyle(p).opacity),'0');
    await page.waitForFunction(()=>document.body.dataset.introState==='revealing');
    await page.waitForTimeout(420);
    const fading=await page.locator('#entryPanel').evaluate(p=>({opacity:Number(getComputedStyle(p).opacity),inert:p.inert}));
    assert.ok(fading.opacity>0&&fading.opacity<1,'panel fades gradually');assert.equal(fading.inert,true);
    await shot(page,'02-reveal');
   }
   await ready(page);
   const b=await bounds(page);assert.equal(b.opacity,'1');assert.equal(b.inert,false);assert.equal(b.fit,'contain');assert.deepEqual(b.image,[1536,711]);assert.equal(b.scroll,false);
   assert.ok(b.panel.x>width*.5,'auth panel is on the right');assert.ok(b.panel.right<=width&&b.panel.bottom<=height);
   for(const c of b.controls)assert.ok(c.x>=b.panel.x&&c.right<=b.panel.right+.5&&c.y>=b.panel.y&&c.bottom<=height,'visible control '+c.id);
   const events=await page.evaluate(()=>window.__introEvents),art=events.find(e=>e.state==='artwork'),reveal=events.find(e=>e.state==='revealing'),done=events.find(e=>e.state==='ready');
   assert.ok(reveal.time-art.time>=1950&&reveal.time-art.time<2400,'two-second artwork hold');
   assert.ok(done.time-reveal.time>=940&&done.time-reveal.time<1300,'one-second reveal');
   if(i===0){
    await shot(page,'03-login');
    await page.locator('#username').fill('test_owner');await page.locator('#password').fill('test-password');
    await page.locator('#togglePassword').click();assert.equal(await page.locator('#password').getAttribute('type'),'text');await page.locator('#togglePassword').click();
    await page.locator('#submitLogin').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('hatalı'));
    await page.locator('#register').click();await page.locator('#newUsername').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>document.activeElement.id),'newUsername');
    await shot(page,'04-register');await page.locator('#back').click();await page.locator('#forgot').click();await page.locator('#recoveryEmail').waitFor({state:'visible'});
    await shot(page,'05-forgot');await page.locator('#back').click();assert.equal(await page.locator('#username').isVisible(),true);
   }else await shot(page,`login-${width}x${height}`);
   await page.locator('#register').click();
   const registration=await page.evaluate(()=>({panel:document.getElementById('entryPanel').getBoundingClientRect().bottom,back:document.getElementById('back').getBoundingClientRect().bottom}));
   assert.ok(registration.back<=registration.panel,'registration buttons fit without an initial scroll');
   await shot(page,`register-${width}x${height}`);
   assert.deepEqual(errors,[]);results.push({viewport:[width,height],holdMs:Math.round(reveal.time-art.time),revealMs:Math.round(done.time-reveal.time),panel:b.panel});await context.close();
  }
  // Rotating from portrait must not consume the unseen two-second presentation.
  {
   const{context,page,errors}=await setup(browser,{width:390,height:844});await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.body.dataset.introState==='artwork');await page.waitForTimeout(2200);
   assert.equal(await page.evaluate(()=>document.body.dataset.introState),'artwork');assert.equal(await page.locator('#landscapeGate').isVisible(),true);
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>document.body.dataset.introState),'artwork');await ready(page);assert.deepEqual(errors,[]);await context.close();results.push({portraitHold:true});
  }
  {
   const{context,page}=await setup(browser,{width:844,height:390},{reducedMotion:'reduce'});await page.goto(url);await ready(page);
   assert.equal(await page.locator('#entryPanel').evaluate(p=>getComputedStyle(p).transform),'none');await context.close();results.push({reducedMotion:true});
  }
  {
   const{context,page}=await setup(browser,{width:844,height:390});await page.route('**/colosseum-magnus-login-v40.webp',r=>r.abort());await page.goto(url);await ready(page);
   assert.equal(await page.locator('#artworkFallback').isVisible(),true);assert.equal(await page.locator('#username').isVisible(),true);await context.close();results.push({missingArtworkRecovery:true});
  }
  assert.equal(requests.some(r=>r.endsWith('.glb')),false,'anonymous entry does not load 3D models');
  console.log(JSON.stringify({pass:true,results,anonymousModelDownloads:0}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
