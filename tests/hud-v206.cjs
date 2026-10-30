/* Layout regression: production HUD and callbacks, isolated from real accounts. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const fixture=require('./hud-v206-fixture.cjs');
const root=path.resolve(__dirname,'..'),output=process.env.LUDUS_TEST_OUTPUT||'/tmp/hud-v206';
const source=fs.readFileSync(path.join(root,'ludus.html'),'utf8');
for(const [,attrs,script]of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|type="(?:module|importmap)"/.test(attrs))new vm.Script(script);
new vm.Script(fs.readFileSync(path.join(root,'ludus-hud-v206.js'),'utf8'));
assert(!/ludus-hud-v202|LudusHudV202|ludusHudFitV205/.test(source));
assert.equal((source.match(/ludusHud\.setGold\(gold\)/g)||[]).length,3,'food, supply and stable wallet callbacks');
assert.equal((source.match(/ludusHud\.setWallet\(values\)/g)||[]).length,2,'reward and vault wallet callbacks');
fixture(root);
require('../ludus-hud-v206.js');
const {amount,rosterCounts}=globalThis.LudusHudV206;
assert.equal(amount(null,'gold'),'—');assert.equal(amount(0,'gold'),'0');assert.equal(amount(2000,'diamond'),'2000');
const now=Date.now(),future=new Date(now+60000).toISOString();
const rows=[{id:'free'},{id:'mission',status:'locked'},{id:'clan',clan_roster_id:'clan'}, {id:'market',market_listing_id:'item'}, {id:'battle',locked_battle_id:'battle'}, {id:'hurt',injured_until:future}, {id:'training',session:{train_until:future}}, {id:'rest',session:{rest_until:future}}];
assert.deepEqual(rosterCounts(rows,true,now),{free:1,total:8});assert.deepEqual(rosterCounts(rows,false,now),{free:null,total:8});assert.equal(rosterCounts(rows,true,now+61000).free,4);
console.log('PASS inline scripts, production callbacks, unknown and busy unit states.');
async function run(){
 const {chromium,webkit}=require('playwright');
 fs.mkdirSync(output,{recursive:true});const browser=await(process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const url=new URL(route.request().url()),file=path.resolve(root,'.'+url.pathname);if(url.hostname!=='hud.test'||!file.startsWith(root+path.sep))return route.abort();
   try{const body=url.pathname==='/ludus.html'?fixture(root):fs.readFileSync(file);return route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404});}});
  await page.goto('http://hud.test/ludus.html');await page.evaluate(()=>hudReady);await page.evaluate(()=>document.fonts.ready);
  await page.locator('#ludusHud img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
  assert.equal(await page.locator('#ludusWorldNav').count(),0);assert.equal(await page.locator('#beginnerOpen').isVisible(),false);
  const expected=['ludusLevelBadge','gold','diamond','sapphire','emerald','ruby','caravanHud','gladiatorHud','ludusMap','imperialRankings','friendsOpen','messagesOpen','accountLink'];
  for(const [width,height]of [[1440,800],[932,430],[874,402],[844,390],[760,360],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   for(const [label,values]of [['normal',[984125,2000,2000,2000,2000]],['large',[1100000,999717,17999393,14999215,3999841]],['zero',[0,0,0,0,0]],['edge',[999999,9999,9999,9999,9999]]]){
    await page.evaluate(values=>hud.setWallet(values),values);
    const check=await page.evaluate(()=>{
     const menu=document.getElementById('ludusHud'),r=menu.getBoundingClientRect(),nodes=[...menu.querySelectorAll('#accountSummary .money,.hud-crew>*,.hud-navigation>*,.tools>.hud-action,.hud-level')].filter(n=>n.getClientRects().length);
     const boxes=nodes.map(n=>{const b=n.getBoundingClientRect();return {name:n.id||n.dataset.currency,left:b.left,right:b.right};});
     const content=nodes.flatMap(n=>[...n.querySelectorAll('img,svg,.hud-value,.hud-count,#messageUnread')].filter(c=>c.getClientRects().length).map(c=>{const b=c.getBoundingClientRect(),parent=n.getBoundingClientRect();return {name:n.id||n.dataset.currency,left:b.left,right:b.right,clipped:b.left<parent.left-.5||b.right>parent.right+.5};}));
     const icon=menu.querySelector('.hud-icon--coin').getBoundingClientRect(),original=parseFloat(getComputedStyle(menu).getPropertyValue('--hud206-original-icon'));
     return {background:getComputedStyle(menu).backgroundColor,backgroundImage:getComputedStyle(menu).backgroundImage,order:boxes.map(b=>b.name),
      scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,
      overflow:[...boxes,...content].filter(b=>b.left<r.left-.5||b.right>r.right+.5||b.left<0||b.right>innerWidth+.5||b.clipped),
      overlap:boxes.slice(1).filter((b,i)=>b.left<boxes[i].right-.5),
      missed:nodes.filter(n=>n.matches('button,a')&&!n.disabled).filter(n=>{const b=n.getBoundingClientRect();return !n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}).map(n=>n.id),iconWidth:icon.width};
    });
    assert.equal(check.background,'rgba(0, 0, 0, 0)');assert.equal(check.backgroundImage,'none');assert(!check.scroll);
    assert.deepEqual(check.order,expected);assert.deepEqual(check.overflow,[],`${width} ${label} clipped text/icon`);assert.deepEqual(check.overlap,[],`${width} ${label} overlap`);assert.deepEqual(check.missed,[],`${width} ${label} touch targets`);
    const base=width<=610?21:width<=760?25:Math.max(24,Math.min(42,width*.033));assert(Math.abs(check.iconWidth-base*.75)<.03,'icons exactly 25% smaller');
    assert.deepEqual(await page.locator('#accountSummary .money').evaluateAll(nodes=>nodes.map(n=>n.lastChild.textContent)),values.map((v,i)=>amount(v,['gold','diamond','sapphire','emerald','ruby'][i])));
    if(label==='large')await page.screenshot({path:path.join(output,`hud-${width}.png`)});
   }
   console.log(`PASS ${width}×${height}: four balance states, content bounds, order, alpha and touch targets.`);
  }
  await page.setViewportSize({width:932,height:430});
  for(const level of [1,9,10,50,100]){
   await page.evaluate(n=>hud.setLevel(n),level);assert.equal(await page.locator('.hud-level-number').textContent(),String(level));
   const center=await page.locator('.hud-level-number').evaluate(n=>{const ctx=document.createElement('canvas').getContext('2d');ctx.font='600 '+n.getAttribute('font-size')+'px Georgia';const m=ctx.measureText(n.textContent),y=Number(n.getAttribute('y'));return y+(m.actualBoundingBoxDescent-m.actualBoundingBoxAscent)/2;});assert(Math.abs(center-93)<.05,'visible numeral vertically centered in medallion');
  }
  await page.evaluate(()=>hud.setLevel(50));await page.evaluate(()=>hud.setGold(1100000));assert.equal(await page.locator('.money[data-currency=gold] .hud-value').textContent(),amount(1100000,'gold'));
  await page.evaluate(()=>hud.setCaravans({free_caravans:2,caravans:6}));assert.equal(await page.locator('#caravanHud .hud-count').textContent(),'2/6');
  await page.evaluate(()=>hud.setRoster([{id:'1'},{id:'2',status:'locked'}]));assert.equal(await page.locator('#gladiatorHud .hud-count').textContent(),'1/2');
  await page.evaluate(()=>hud.setRoster([{id:'1'}],false));assert.equal(await page.locator('#gladiatorHud .hud-count').textContent(),'—/1');
  for(const id of ['caravanHud','gladiatorHud','friendsOpen','messagesOpen'])await page.locator('#'+id).tap();
  await page.locator('#accountLink').tap();await page.locator('#beginnerHelp').tap();assert.deepEqual(await page.evaluate(()=>hudClicks),{caravans:1,gladiators:1,friends:1,messages:1,help:1});
  assert.equal(new URL(await page.locator('#imperialRankings').getAttribute('href'),'http://hud.test/').pathname,'/siralamalar.html');assert.equal(new URL(await page.locator('#ludusMap').getAttribute('href'),'http://hud.test/').pathname,'/roma.html');
  await page.setViewportSize({width:393,height:852});await page.locator('#landscapeGate').waitFor({state:'visible'});assert.equal(await page.locator('#ludusHud').isVisible(),false);
  await page.setViewportSize({width:852,height:393});await page.waitForFunction(()=>document.getElementById('landscapeGate').hidden&&!document.getElementById('ludusHud').inert);assert(await page.locator('#ludusHud').isVisible());
  assert.deepEqual(errors,[]);await context.close();console.log('PASS numeral centering, live counters, settings/help, destinations and rotation.');
 }finally{await browser.close();}
}
if(!process.argv.includes('--static'))run().catch(e=>{console.error(e);process.exitCode=1;});
