const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),fixture=require('./hud-v205-fixture.cjs');
const root=path.resolve(__dirname,'..'),output=process.env.LUDUS_TEST_OUTPUT||'/tmp/hud-v205';
const source=fs.readFileSync(path.join(root,'ludus.html'),'utf8');
for(const [,attrs,script]of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|type="(?:module|importmap)"/.test(attrs))new vm.Script(script);
assert(!/ludus-hud-v202|LudusHudV202|updateGladiatorHud/.test(source),'retired marble HUD must not load');
async function run(){
 fs.mkdirSync(output,{recursive:true});const browser=await(process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const url=new URL(route.request().url()),file=path.resolve(root,'.'+url.pathname);if(url.hostname!=='hud.test'||!file.startsWith(root+path.sep))return route.abort();
   try{const body=url.pathname==='/ludus.html'?fixture(root):fs.readFileSync(file);return route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404});}});
  await page.goto('http://hud.test/ludus.html');await page.evaluate(()=>hudReady);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#ludusHud,#gladiatorHud,.hud-level').count(),0);
  assert.equal(await page.locator('#ludusWorldNav').count(),1);assert(await page.locator('#beginnerOpen').isVisible());
  assert.equal(await page.locator('#caravanHud svg').getAttribute('stroke'),'currentColor');assert.equal(await page.locator('#caravanHud img').count(),0);
  for(const [width,height]of [[1440,800],[932,430],[874,402],[844,390],[760,360],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   for(const [label,values]of [['normal',[984125,2000,2000,2000,2000]],['large',[1100000,999717,17999393,14999215,3999841]],['zero',[0,0,0,0,0]]]){
    await page.evaluate(values=>hud.setWallet(values),values);
    const check=await page.evaluate(()=>{const menu=document.querySelector('.ludus-menu'),r=menu.getBoundingClientRect();
     const nodes=[...document.querySelectorAll('#accountSummary>span,.ludus-menu .tools>button')].filter(n=>n.getClientRects().length),boxes=nodes.map(n=>{const b=n.getBoundingClientRect();return {name:n.id||n.title,left:b.left,right:b.right};});
     const content=nodes.flatMap(n=>{const boxes=[...n.querySelectorAll('svg,.caravan-hud-count,.fq-book-count')].map(c=>c.getBoundingClientRect());for(const c of n.childNodes)if(c.nodeType===Node.TEXT_NODE&&c.textContent.trim()){const range=document.createRange();range.selectNode(c);boxes.push(range.getBoundingClientRect());}return boxes.map(b=>({name:n.id||n.title,left:b.left,right:b.right}));});
     return {background:getComputedStyle(menu).backgroundImage,height:r.height,scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,
      overflow:[...boxes,...content].filter(b=>b.left<r.left-.5||b.right>r.right+.5||b.left<0||b.right>innerWidth+.5),
      missed:nodes.filter(n=>n.matches('button')&&!n.disabled).filter(n=>{const b=n.getBoundingClientRect();return !n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}).map(n=>n.id),
      overlap:boxes.slice(1).filter((b,i)=>b.left<boxes[i].right-1),
      navGap:document.getElementById('ludusWorldNav').getBoundingClientRect().top-r.bottom};});
    assert.match(check.background,/50, 18, 28/);assert(!check.scroll,`${width} ${label}: page scrolling`);assert(check.height<=42);
    assert.deepEqual(check.overflow,[],`${width} ${label} clipped actual text/icons`);assert.deepEqual(check.overlap,[],`${width} ${label} overlap`);assert.deepEqual(check.missed,[],`${width} ${label} hit targets`);assert(check.navGap>=0,'map/rankings overlap');
    assert.deepEqual(await page.locator('#accountSummary .money').evaluateAll(nodes=>nodes.map(n=>n.lastChild.textContent)),values.map(String));
    if(label!=='zero')await page.screenshot({path:path.join(output,`hud-${width}-${label}.png`)});
   }
   console.log(`PASS ${width}×${height}: restored burgundy menu, normal/large/zero balances, text, icons and touch targets.`);
  }
  await page.setViewportSize({width:932,height:430});
  for(const level of [1,9,10,50]){await page.evaluate(n=>hud.setLevel(n),level);assert.equal(await page.locator('#ludusLevelBadge').textContent(),'Sv. '+level);}
  await page.evaluate(()=>hud.setCaravans({free_caravans:2,caravans:6}));assert.equal(await page.locator('#caravanHud .caravan-hud-count').textContent(),'2/6');
  assert.equal(await page.locator('#caravanHud').evaluate(n=>n.nextElementSibling.id),'ludusLevelBadge');
  for(const id of ['friendsOpen','messagesOpen'])await page.locator('#'+id).tap();
  await page.locator('#beginnerOpen').tap();assert(await page.locator('#beginnerGuide').isVisible());await page.getByRole('button',{name:'Başlangıç rehberini kapat',exact:true}).tap();
  await page.locator('#accountLink').tap();await page.locator('#beginnerHelp').tap();assert.deepEqual(await page.evaluate(()=>hudClicks),{friends:1,messages:1,guide:1,help:1});
  await page.evaluate(()=>hud.setBook(22));assert.equal(await page.locator('#beginnerOpen').isVisible(),false);
  assert.equal(new URL(await page.locator('#imperialRankings').getAttribute('href'),'http://hud.test/').pathname,'/siralamalar.html');
  assert.equal(new URL(await page.locator('#ludusWorldNav a').first().getAttribute('href'),'http://hud.test/').pathname,'/roma.html');
  await page.setViewportSize({width:393,height:852});await page.locator('#landscapeGate').waitFor({state:'visible'});assert.equal(await page.locator('.ludus-menu').isVisible(),false);
  await page.setViewportSize({width:852,height:393});await page.waitForFunction(()=>document.getElementById('landscapeGate').hidden&&!document.querySelector('.ludus-menu').inert);assert(await page.locator('.ludus-menu').isVisible());
  assert.deepEqual(errors,[]);await context.close();console.log('PASS old counters, guide, settings/help, navigation and rotation.');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
