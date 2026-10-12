const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');const root=path.resolve(__dirname,'..'),out='/tmp/arena-tabs-v81';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox']});const page=await browser.newPage();
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://art.test')return r.abort();const f=path.join(root,u.pathname);if(!fs.existsSync(f))return r.fulfill({status:404});let body=fs.readFileSync(f);if(f.endsWith('.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,m=>m.includes('src="arena-tabs-v81.js')?m:''));return r.fulfill({body,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'application/javascript':f.endsWith('.svg')?'image/svg+xml':'image/webp'});});
await page.goto('http://art.test/savas.html');let views=0;
for(const [width,height]of [[1536,706],[1024,768],[844,390],[667,375],[568,320]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.documentElement.style.setProperty('--game-height',innerHeight+'px'));
for(const tab of ['single','multi','clan']){await page.locator('[data-arena-tab="'+tab+'"]').click();assert.equal(await page.locator('[data-arena-panel]:visible').count(),1);const panel=page.locator('[data-arena-panel="'+tab+'"]');
for(const e of await panel.locator(tab==='clan'?'.clan-card':'.mode,.ranked-card').all()){const b=await e.boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+.5&&b.y+b.height<=height+.5,tab+' card fits '+width);}
const tabbox=await page.locator('.arena-tabs').boundingBox();const back=await page.locator('#back').boundingBox();assert.ok(back.x+back.width<tabbox.x,'back separate');assert.equal(await page.locator('.balance,#wallet,#ludusName').count(),0,'arena header has no account balances');
if(tab==='clan'){assert.equal(await panel.locator('.clan-card').count(),4);assert.equal(await panel.locator('.clan-team-detail').count(),4);assert.match(await panel.innerText(),/4 TAKIM/);assert.match(await panel.innerText(),/2 TAKIM/);assert.match(await panel.innerText(),/Her takımda 10 gladyatör/);assert.match(await panel.innerText(),/Her takımda 20 gladyatör/);assert.doesNotMatch(await panel.innerText(),/\d+[x×]\d+/);assert.match(await panel.innerText(),/YAKINDA/);await panel.locator('img').evaluateAll(async imgs=>Promise.all(imgs.map(i=>i.decode())));}
if(tab==='multi'){
 assert.equal(await panel.locator('.ranked-card').count(),2,'two ranked announcements');
 assert.equal(await panel.locator('[data-mode]').count(),1,'only the beta can open preparation');
 assert.deepEqual(await panel.locator('.ranked-soon').allTextContents(),['YAKINDA','YAKINDA']);
 await panel.locator('img').evaluateAll(async imgs=>Promise.all(imgs.map(i=>i.decode())));
 const geometry=await panel.locator('.ranked-card').evaluateAll(cards=>cards.map(card=>{
  const art=card.querySelector('.ranked-art').getBoundingClientRect(),img=card.querySelector('img');
  return {width:art.width,height:art.height,ratio:img.naturalWidth/img.naturalHeight,overflow:[...card.querySelectorAll('.ranked-copy,.ranked-points,.ranked-rule')].some(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)};
 }));
 geometry.forEach(g=>{assert.ok(g.height>55,'art is visible');assert.ok(g.width/g.height>=g.ratio-.02,'keep every gladiator across the image width');assert.equal(g.overflow,false,'ranked copy fits');});
}
await page.screenshot({path:out+'/'+tab+'-'+width+'.png'});views++;}}
await page.evaluate(()=>{document.querySelector('#modePage').hidden=true;document.querySelector('#setupPage').hidden=false;window.backClicks=0;document.querySelector('#back').onclick=()=>{window.backClicks++;document.querySelector('#modePage').hidden=false;document.querySelector('#setupPage').hidden=true;};});await page.locator('[data-arena-tab="multi"]').click();assert.equal(await page.evaluate(()=>window.backClicks),1);assert.equal(await page.locator('#panel-multi').isVisible(),true);await browser.close();console.log(JSON.stringify({views,out}));})().catch(e=>{console.error(e);process.exit(1)});
