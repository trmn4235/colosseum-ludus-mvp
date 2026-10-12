// Actual page markup and styles, with scripts disabled: no live account/queue calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/arena-art-v69';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});let checks=0;
 for(const file of ['savas.html','multiplayer.html']){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://art.test')return r.abort();const f=path.join(root,u.pathname);if(!fs.existsSync(f)||!fs.statSync(f).isFile())return r.fulfill({status:404});let body=fs.readFileSync(f);if(f.endsWith('.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));return r.fulfill({body,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.webp')?'image/webp':f.endsWith('.png')?'image/png':'application/octet-stream'});});
  await page.goto('http://art.test/'+file);
  for(const asset of ['arena-modes-v69','multiplayer-poster-v69','gladiator-preparation-v69'])assert.ok(await page.evaluate(async name=>{const image=new Image();image.src='/assets/'+name+'.webp';await image.decode();return image.naturalWidth>1000;},asset),'asset decodes');
  for(const [width,height]of [[1536,706],[844,390],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.documentElement.style.setProperty('--game-height',innerHeight+'px'));
   const selectors=file==='savas.html'?['.mode[data-mode="4x5"]','.mode[data-mode="solo20"]']:['.queue-scene','.queue-title','.queue-body','.queue-footer','#queueCancel'];
   for(const selector of selectors){const b=await page.locator(selector).boundingBox();assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,file+' '+selector+' viewport '+width);}
   if(file==='savas.html'){
    const title=page.locator('#modePage .heading'),titleBox=await title.boundingBox(),cardBox=await page.locator('.mode').first().boundingBox();assert.ok(titleBox.y+titleBox.height<cardBox.y,'title does not overlap posters');assert.equal(await title.locator('h1').innerText(),'SAVAŞINI SEÇ');
    assert.ok(await page.evaluate(async()=>{const image=new Image();image.src='/assets/arena-title-crest-v71.svg';await image.decode();return image.naturalWidth>0;}),'vector crest loads');
    const back=page.locator('.top button').first();assert.equal(await back.evaluate(e=>{const b=e.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2).closest('button')===e;}),true,'background never covers back navigation');
    const backdrop=await page.locator('#modePage').evaluate(e=>getComputedStyle(e,'::before').backgroundImage);assert.ok(backdrop.includes('arena-entrance-v70.webp'));
    assert.ok(await page.evaluate(async()=>{const i=new Image();i.src='/assets/arena-entrance-v70.webp';await i.decode();return i.naturalWidth>1000;}));
    const cards=page.locator('#panel-single .mode');assert.equal(await cards.count(),3);
    for(let i=0;i<2;i++){const c=cards.nth(i),b=await c.boundingBox();assert.ok(Math.abs(b.width/b.height-.75)<.015,'poster aspect ratio');assert.ok(await c.getAttribute('aria-label'),'accessible mode name');const bg=await c.evaluate(e=>getComputedStyle(e.querySelector('.arena-choice-art')).backgroundImage);assert.ok(bg.includes('arena-modes-v69'));assert.equal(await c.evaluate(e=>{const b=e.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2).closest('button')===e;}),true,'art does not intercept button');}
   }else{
    const art=await page.locator('.queue-scene').boundingBox(),controls=await page.locator('.queue-body').boundingBox();assert.ok(art.x+art.width<controls.x,'art/control separation');
    await page.evaluate(()=>{document.querySelector('#queueCount').textContent='20';document.querySelector('#queueNames').textContent='Aquila · Invicta · Maximus · Spartacus';document.querySelector('#queueSeconds').textContent='8';});
    assert.equal(await page.locator('#queueCount').innerText(),'20');
   }
   await page.screenshot({path:path.join(out,file.replace('.html','')+'-'+width+'.png')});checks++;
  }
  if(file==='savas.html'){
   await page.evaluate(()=>{document.querySelector('#modePage').hidden=true;document.querySelector('#setupPage').hidden=false;});
   assert.equal(await page.locator('#modePage').isVisible(),false,'backdrop leaves with mode picker');
   await page.screenshot({path:path.join(out,'preparation-568.png')});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 await browser.close();console.log(JSON.stringify({views:checks,realMarkup:true,liveNetwork:false,posterRatios:true,controlsSeparated:true,out}));
})().catch(e=>{console.error(e);process.exit(1)});
