const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),fixture=require('./hud-v202-fixture.cjs');
const root=path.resolve(__dirname,'..'),output=process.env.LUDUS_TEST_OUTPUT||'/tmp/hud-v202';
const source=fs.readFileSync(path.join(root,'ludus.html'),'utf8');
for(const [,attrs,script]of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|type="(?:module|importmap)"/.test(attrs))new vm.Script(script);
const state={Intl};vm.runInNewContext(fs.readFileSync(path.join(root,'ludus-hud-v202.js'),'utf8'),state);
const {rosterCounts,amount}=state.LudusHudV202,now=Date.parse('2026-10-29T18:00:00Z'),later=new Date(now+60000).toISOString(),earlier=new Date(now-60000).toISOString();
const rows=[{id:'1',status:'available'},{id:'2',status:'locked'},{id:'3',status:'available',injured_until:later},{id:'4',status:'available',clan_roster_id:'clan'},{id:'5',status:'available',session:{train_until:later,rest_until:later}},{id:'6',status:'available',session:{train_until:earlier,rest_until:later}},{id:'7',status:'available',market_listing_id:'listing'},{id:'8',status:'available',training_ends_at:later},{id:'9',status:'available',injured_until:earlier,session:{rest_until:earlier}},{id:'10',status:'available',locked_battle_id:'battle'}];
assert.equal(rosterCounts(rows,true,now).free,2);assert.equal(rosterCounts(rows,false,now).free,null);assert.equal(rosterCounts(rows.map(record=>({record})),true,now).total,10);
assert.equal(rosterCounts(rows,true,now+61000).free,6);assert.equal(rosterCounts([],true,now).total,0);
assert.equal(amount(2000,'diamond'),'2000');assert.equal(amount(984125,'gold'),'984.125');assert.equal(amount(null,'ruby'),'—');assert.equal(amount(0,'ruby'),'0');
async function run(){
 fs.mkdirSync(output,{recursive:true});const browser=await(process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Route all requests locally. These tests never contact a real account or game API.
  await page.route('**/*',route=>{const url=new URL(route.request().url()),file=path.resolve(root,'.'+url.pathname);if(url.hostname!=='hud.test'||!file.startsWith(root+path.sep))return route.abort();
   try{const body=url.pathname==='/ludus.html'?fixture(root):fs.readFileSync(file);return route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404});}});
  await page.goto('http://hud.test/ludus.html');await page.waitForFunction(()=>window.hud&&[...document.querySelectorAll('#ludusHud img')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.locator('#ludusWorldNav').count(),0);assert.equal(await page.locator('#beginnerOpen').isVisible(),false);
  for(const [width,height]of [[1440,800],[932,430],[874,402],[844,390],[760,360],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   for(const [label,values]of [['normal',[984125,2000,2000,2000,2000]],['large',[984125,999717,17999393,14999215,3999841]],['zero',[0,0,0,0,0]]]){
    await page.evaluate(values=>hud.setWallet(values),values);
    const check=await page.evaluate(()=>{const hud=document.getElementById('ludusHud'),r=hud.getBoundingClientRect();const nodes=[...hud.querySelectorAll('.money,.hud-action,.hud-level,.hud-value,.hud-count')].filter(n=>n.getClientRects().length);
     return {scale:getComputedStyle(hud).transform,marble:getComputedStyle(hud).backgroundImage,height:r.height,scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,
      overflow:nodes.filter(n=>{const b=n.getBoundingClientRect();return b.left<0||b.right>innerWidth+.5||b.top<0||b.bottom>innerHeight+.5||n.scrollWidth>n.clientWidth+2;}).map(n=>({id:n.id||n.className,w:n.clientWidth,sw:n.scrollWidth,text:n.textContent})),
      missed:nodes.filter(n=>n.matches('a,button')&&!n.disabled).filter(n=>{const b=n.getBoundingClientRect();return !n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}).map(n=>n.id),
      groups:[...hud.children].filter(n=>n.getClientRects().length).map(n=>{const b=n.getBoundingClientRect();return {name:n.id||n.className,left:b.left,right:b.right};})};});
    assert.match(check.scale,/matrix\(0\.9, 0, 0, 0\.9,/);assert.match(check.marble,/honed-marble/);assert(!check.scroll,`${width} ${label}: unexpected page scrolling ${JSON.stringify(check)}`);assert(check.height<=51);assert.deepEqual(check.overflow,[],`${width} ${label} clipping`);assert.deepEqual(check.missed,[],`${width} ${label} hit targets`);
    for(let i=1;i<check.groups.length;i++)assert(check.groups[i].left>=check.groups[i-1].right-1,`${width} ${label} overlapping groups ${JSON.stringify(check.groups)}`);
    if(label==='normal')await page.screenshot({path:path.join(output,`hud-${width}.png`)});
   }
   console.log(`PASS ${width}×${height}: normal/large/zero balances, one row, visible icons and touch targets.`);
  }
  await page.setViewportSize({width:932,height:430});
  for(const level of [1,5,9,10,50,99]){
   const centered=await page.evaluate(level=>{hud.setLevel({level});const b=document.querySelector('.hud-level').getBoundingClientRect(),r=document.createRange();r.selectNodeContents(document.querySelector('.hud-level-number'));const n=r.getBoundingClientRect();return Math.abs((b.left+b.right-n.left-n.right)/2);},level);
   assert(centered<1,'level '+level+' center');assert.equal(await page.locator('.hud-level-number').textContent(),String(level));
  }
  await page.evaluate(()=>{hud.setRoster(hudData.roster,false,hudData.now);hud.setCaravans({});});assert.equal(await page.locator('#gladiatorHud .hud-count').textContent(),'—/12');assert.equal(await page.locator('#caravanHud .hud-count').textContent(),'—/—');
  await page.evaluate(()=>{hud.setRoster(hudData.roster,true,hudData.now);hud.setCaravans({free_caravans:2,caravans:6});hud.setGold(12345);});
  assert.equal(await page.locator('#gladiatorHud .hud-count').textContent(),'8/12');assert.equal(await page.locator('#caravanHud .hud-count').textContent(),'2/6');assert.match(await page.locator('[data-currency=gold]').getAttribute('aria-label'),/12\.345/);
  for(const id of ['caravanHud','gladiatorHud','friendsOpen','messagesOpen'])await page.locator('#'+id).tap();
  await page.locator('#accountLink').tap();await page.locator('#beginnerHelp').tap();assert.deepEqual(await page.evaluate(()=>hudClicks),{caravans:1,gladiators:1,friends:1,messages:1,help:1});
  for(const [id,target]of [['ludusMap','roma.html'],['imperialRankings','siralamalar.html'],['ludusLevelBadge','ludus-seviye.html']])assert.equal(new URL(await page.locator('#'+id).getAttribute('href'),'http://hud.test/').pathname,'/'+target);
  await page.setViewportSize({width:393,height:852});await page.locator('#landscapeGate').waitFor({state:'visible'});assert(await page.locator('#landscapeGate').isVisible());assert.equal(await page.locator('#ludusHud').isVisible(),false);
  await page.setViewportSize({width:852,height:393});await page.waitForFunction(()=>document.getElementById('landscapeGate').hidden&&!document.getElementById('ludusHud').inert);assert.equal(await page.locator('#ludusHud').getAttribute('inert'),null);assert(await page.locator('#imperialRankings').isVisible());
  assert.deepEqual(errors,[]);await context.close();console.log('PASS availability states, live updates, level centering, retained handlers, settings/help, destinations and rotation.');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
