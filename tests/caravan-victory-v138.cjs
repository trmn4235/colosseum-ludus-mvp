// Exercise the shipped result renderer with real page styles and isolated server-result fixtures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const out=process.env.LUDUS_TEST_OUTPUT||'/tmp/caravan-victory-v138';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const uri=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+uri);
 if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream');
 let data=fs.readFileSync(file);
 // Keep the actual page, styles and victory script; omit the unrelated WebGL simulation.
 if(uri==='/caravan-field.html')data=data.toString().replace(/<script\b[^>]*src="(?!caravan-victory-v138\.js)[^"]*"[^>]*><\/script>/g,'');
 res.end(data);
});
const delivered={id:'verified-test-raid',status:'resolved',success:true,loot:{lead_ore:60},delivered_at:'2026-10-20T18:00:00Z'};
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1536,height:706},hasTouch:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.route(/^https:/,route=>route.abort());
 const url='http://127.0.0.1:'+server.address().port+'/caravan-field.html';
 try{
  await page.goto(url);await page.evaluate(()=>document.fonts.ready);
  for(const result of [{...delivered,status:'active'},{...delivered,success:false},null]){
   assert.equal(await page.evaluate(value=>CaravanVictory.show(value),result),false);
   assert.equal(await page.locator('.caravan-victory').count(),0,'unverified and losing results never open victory art');
  }
  await page.evaluate(value=>CaravanVictory.show(value),delivered);
  assert.equal(await page.locator('#caravanVictoryLoot').innerText(),'60 kurşun cevheri depomuza taşındı.');
  assert.equal(await page.getByRole('dialog',{name:'Kervan baskını başarılı'}).count(),1);
  await page.waitForFunction(()=>document.querySelector('.caravan-victory-art').naturalWidth>0);
  for(const [width,height]of [[568,320],[667,375],[874,402],[932,430],[1366,768],[1536,706],[390,844]]){
   await page.setViewportSize({width,height});
   const geometry=await page.evaluate(()=>{
    const box=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
    const dialog=document.querySelector('.caravan-victory');
    return{dialog:box(dialog),art:box(dialog.querySelector('img')),content:[...dialog.querySelectorAll('.caravan-victory-kicker,h2,#caravanVictoryLoot,.caravan-victory-return,#caravanVictoryNext')].map(box),scroll:dialog.scrollWidth>dialog.clientWidth||dialog.scrollHeight>dialog.clientHeight};
   });
   assert.deepEqual(geometry.dialog,{x:0,y:0,w:width,h:height},'edge-to-edge result');
   assert.deepEqual(geometry.art,{x:0,y:0,w:width,h:height},'edge-to-edge photograph');
   assert.equal(geometry.scroll,false,'normal reward fits without scrolling at '+width);
   for(let i=0;i<geometry.content.length;i++){
    const a=geometry.content[i];assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=width+1&&a.y+a.h<=height+1,'visible content at '+width);
    for(const b of geometry.content.slice(i+1))assert.ok(!(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1),'separate labels at '+width);
   }
   assert.ok(geometry.content[3].h>=44,'touch target at '+width);
   if([568,874,1536,390].includes(width))await page.screenshot({path:out+'/victory-'+width+'.png'});
  }
  // The native modal traps focus; Escape cannot reveal the already finished battle.
  await page.keyboard.press('Escape');assert.equal(await page.locator('.caravan-victory').evaluate(e=>e.open),true);
  for(let i=0;i<3;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement===document.body||!!document.activeElement.closest('.caravan-victory')),true);}
  await page.evaluate(()=>document.querySelector('.field-top .back').focus());assert.notEqual(await page.evaluate(()=>document.activeElement.className),'back');
  await page.evaluate(value=>CaravanVictory.show(value),{...delivered,loot:{wood:47,copper_ore:91},delivered_at:null});
  assert.equal(await page.locator('#caravanVictoryLoot').innerText(),'47 odun, 91 bakır cevheri güvende; depoda yer açılınca taşınacak.');
  await page.setViewportSize({width:568,height:320});
  assert.ok(await page.locator('.caravan-victory-return').isVisible());
  // Unusually long cargo names remain text and scroll instead of colliding with the action.
  const longName='<img src=x onerror=alert(1)> '+('uzun kervan ganimeti '.repeat(35));
  await page.evaluate(value=>CaravanVictory.show(value),{...delivered,loot:{[longName]:999999}});
  assert.equal(await page.locator('#caravanVictoryLoot img').count(),0);
  await page.locator('.caravan-victory-return').scrollIntoViewIfNeeded();
  const button=await page.locator('.caravan-victory-return').boundingBox();assert.ok(button.y>=0&&button.y+button.height<=321);
  assert.equal(await page.locator('.caravan-victory').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  // A failed photo request still leaves a dark, readable result and a working exit.
  await page.route('**/assets/caravan-v138/victory.webp',route=>route.abort());await page.reload();
  await page.evaluate(value=>CaravanVictory.show(value),delivered);
  await page.waitForFunction(()=>document.querySelector('.caravan-victory-art').hidden);
  assert.equal(await page.locator('#caravanVictoryLoot').innerText(),'60 kurşun cevheri depomuza taşındı.');
  await page.route('**/ludus.html',route=>route.fulfill({contentType:'text/html',body:'Ludus navigation fixture'}));
  await page.getByRole('link',{name:'Ludus’a dön'}).tap();await page.waitForURL('**/ludus.html');
  assert.deepEqual(errors,[]);
  console.log('V138 victory PASS: seven viewports, full-screen art, real cargo/delivery state, no overlapping text, 44px+ action, keyboard focus, failed-image fallback and return navigation.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
