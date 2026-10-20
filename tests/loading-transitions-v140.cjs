// Real entry markup and styles; hold artwork requests to inspect intermediate frames.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..');
const out=process.env.LUDUS_TEST_OUTPUT||'/tmp/loading-transitions-v140';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const uri=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+uri);
 if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
 let body=fs.readFileSync(file);
 if(file.endsWith('.html'))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>(tag.includes('src="caravan-victory-v138.js')||tag.startsWith('<script id="gameViewport"'))?tag:'');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream');res.end(body);
});
const sizes=[[1536,706],[932,430],[874,402],[667,375],[568,320],[402,874],[390,844]];
async function coversViewport(page,selector){
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 const geometry=await page.locator(selector).evaluate(element=>{
  const r=element.getBoundingClientRect(),style=getComputedStyle(element);
  return {box:[r.x,r.y,r.width,r.height],viewport:[0,0,innerWidth,innerHeight],opaque:style.backgroundColor!=='rgba(0, 0, 0, 0)',targets:[[1,1],[innerWidth-2,1],[1,innerHeight-2],[innerWidth-2,innerHeight-2]].map(([x,y])=>document.elementFromPoint(x,y)?.outerHTML.slice(0,160)),corners:[[1,1],[innerWidth-2,1],[1,innerHeight-2],[innerWidth-2,innerHeight-2]].every(([x,y])=>element.contains(document.elementFromPoint(x,y)))};
 });
 assert.deepEqual(geometry.box,geometry.viewport,selector+' covers the viewport without an inherited translation');
 assert.equal(geometry.opaque,true,selector+' has an opaque fallback while art downloads');
 assert.equal(geometry.corners,true,selector+' blocks the world in every corner: '+JSON.stringify(geometry));
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=process.env.LUDUS_WEBKIT_TEST?await webkit.launch({headless:true,...(process.env.LUDUS_WEBKIT_EXECUTABLE_PATH?{executablePath:process.env.LUDUS_WEBKIT_EXECUTABLE_PATH}:{})}):await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1536,height:706},hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:/,route=>route.abort());
 const base='http://127.0.0.1:'+server.address().port;
 let releaseArt;
 try{
  for(const file of ['ludus.html','caravan-field.html']){
   await page.goto(base+'/'+file);await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:out+'/'+file.replace('.html','')+'-initial.png'});
   for(const [width,height]of sizes){
    await page.setViewportSize({width,height});if(file==='ludus.html'&&height>width){await coversViewport(page,'#landscapeGate');assert.equal(await page.locator('#loading').isVisible(),false);continue;}await coversViewport(page,'#loading');
    await page.locator('#loading').evaluate(e=>e.hidden=true);assert.equal(await page.locator('#loading').isVisible(),false);
    await page.locator('#loading').evaluate(e=>e.hidden=false);await coversViewport(page,'#loading');
   }
   // Repeated entry and reload must not leave the prior loading transform behind.
   await page.setViewportSize({width:874,height:402});await page.reload();await coversViewport(page,'#loading');
  }
  await page.setViewportSize({width:874,height:402});
  await page.route('**/assets/art-v136/ludus-training.webp',route=>route.abort());
  await page.goto(base+'/ludus.html');await coversViewport(page,'#loading');
  await page.screenshot({path:out+'/ludus-art-fallback.png'});
  // A slow victory photo never uncovers the old white verification card.
  const artGate=new Promise(resolve=>releaseArt=resolve);
  await page.route('**/assets/caravan-v138/victory.webp',async route=>{await artGate;await route.continue();});
  await page.setViewportSize({width:874,height:402});
  await page.goto(base+'/caravan-field.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{document.getElementById('loading').hidden=true;CaravanVictory.pending();window.pendingDialog=document.querySelector('.caravan-victory');window.pendingArt=pendingDialog.querySelector('img');});
  await coversViewport(page,'.caravan-victory');
  assert.equal(await page.locator('#caravanVictoryTitle').innerText(),'Sonuç kaydediliyor…');
  assert.equal(await page.locator('.caravan-victory-return').isVisible(),false);
  assert.equal(await page.locator('.caravan-victory').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('.caravan-victory-art').evaluate(e=>e.naturalWidth),0);
  for(let i=0;i<8;i++){
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   assert.equal(await page.locator('.caravan-victory').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(17, 26, 19)');
  }
  await page.screenshot({path:out+'/pending-slow-photo.png'});
  releaseArt();await page.waitForFunction(()=>document.querySelector('.caravan-victory-art').naturalWidth>0);
  await page.evaluate(()=>document.querySelector('.caravan-victory-art').decode());
  await page.screenshot({path:out+'/pending-photo-ready.png'});
  await page.evaluate(()=>CaravanVictory.show({status:'resolved',success:true,loot:{wood:60},delivered_at:'2026-10-20T20:00:00Z'}));
  assert.equal(await page.evaluate(()=>pendingDialog===document.querySelector('.caravan-victory')&&pendingArt===document.querySelector('.caravan-victory-art')),true,'same decoded image and dialog through settlement');
  assert.equal(await page.locator('#caravanVictoryLoot').innerText(),'60 odun depomuza taşındı.');
  assert.equal(await page.locator('.caravan-victory').getAttribute('aria-busy'),'false');
  assert.equal(await page.locator('.caravan-victory-return').isVisible(),true);
  await page.screenshot({path:out+'/verified-victory.png'});
  await page.evaluate(()=>CaravanVictory.close());assert.equal(await page.locator('.caravan-victory:modal').count(),0,'errors and defeats can replace the pending screen');
  assert.deepEqual(errors,[]);
  console.log('V140 PASS: both loading screens, seven viewport sizes, hide/show, reload, missing loading art, slow victory art, opaque pending frames and one continuous result surface.');
 }finally{releaseArt?.();await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
