/* Production HUD rendering/callbacks in an isolated account fixture. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const fixture=require('./hud-v208-fixture.cjs');
const root=path.resolve(__dirname,'..'),output=process.env.LUDUS_TEST_OUTPUT||'/tmp/hud-v208';
const source=fs.readFileSync(path.join(root,'ludus.html'),'utf8');
for(const [,attrs,script]of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|type="(?:module|importmap)"/.test(attrs))new vm.Script(script);
new vm.Script(fs.readFileSync(path.join(root,'ludus-hud-v208.js'),'utf8'));
assert(!/ludus-hud-v20[267]|LudusHudV20[267]|ludusHudFitV205/.test(source));
assert.equal((source.match(/ludusHud\.setGold\(gold\)/g)||[]).length,3,'food, supply and stable callbacks');
assert.equal((source.match(/ludusHud\.setWallet\(values\)/g)||[]).length,2,'reward and vault callbacks');
fixture(root);
require('../ludus-hud-v208.js');
const {amount,rosterCounts}=globalThis.LudusHudV208;
assert.equal(amount(null),'—');assert.equal(amount(0),'0');assert.equal(amount(2000),'2000');
const now=Date.now(),future=new Date(now+60000).toISOString();
const rows=[{id:'free'},{id:'mission',status:'locked'},{id:'clan',clan_roster_id:'clan'},{id:'market',market_listing_id:'item'},{id:'battle',locked_battle_id:'battle'},{id:'hurt',injured_until:future},{id:'training',session:{train_until:future}},{id:'rest',session:{rest_until:future}}];
assert.deepEqual(rosterCounts(rows,true,now),{free:1,total:8});assert.deepEqual(rosterCounts(rows,false,now),{free:null,total:8});assert.equal(rosterCounts(rows,true,now+61000).free,4);
console.log('PASS inline scripts, production callbacks, unknown and busy unit states.');

async function run(){
 const {chromium,webkit}=require('playwright');
 fs.mkdirSync(output,{recursive:true});const browser=await(process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url()),file=path.resolve(root,'.'+url.pathname);if(url.hostname!=='hud.test'||!file.startsWith(root+path.sep))return route.abort();
   try{const body=url.pathname==='/ludus.html'?fixture(root):fs.readFileSync(file);return route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404});}
  });
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.goto('http://hud.test/ludus.html');await page.evaluate(()=>hudReady);await page.evaluate(()=>document.fonts.ready);
  await page.locator('#ludusHud img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
  assert.equal(await page.locator('#ludusWorldNav').count(),0);assert.equal(await page.locator('#beginnerOpen').isVisible(),false);
  assert.equal(await page.locator('.hud-divider').count(),2);assert.equal(await page.locator('.hud-flourish').count(),2);
  assert.equal(await page.locator('#hud208-marble image').getAttribute('href'),'assets/hud-v207/cream-marble.webp');
  const expected=['gold','diamond','sapphire','emerald','ruby','ludusMap','ludusLevelBadge','imperialRankings','gladiatorHud','caravanHud','friendsOpen','messagesOpen','accountLink'];
  async function geometry(label,safeInset=6){
   await settle();
   const c=await page.evaluate(checkFrame=>{
    const menu=document.getElementById('ludusHud'),r=menu.getBoundingClientRect(),nodes=[...menu.querySelectorAll('.hud-indicator')].filter(n=>!n.hidden);
    const rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,cx:b.x+b.width/2,cy:b.y+b.height/2};};
    const boxes=nodes.map(n=>({name:n.id||n.dataset.currency,...rect(n)}));
    const safe=rect(menu.querySelector('.hud-safe-area'));
    const pieces=selectors=>nodes.filter(n=>n.matches(selectors)).flatMap(n=>[...n.querySelectorAll('.hud-art-clip,.hud-value,.hud-count')].map(rect));
    const gaps=(pieces,start,end)=>[pieces[0].left-start,...pieces.slice(1).map((p,i)=>p.left-pieces[i].right),end-pieces.at(-1).right];
    const left=pieces('.money'),right=pieces('#gladiatorHud,#caravanHud,#friendsOpen,#messagesOpen,#accountLink');
    const map=rect(document.getElementById('ludusMap')),level=rect(document.getElementById('ludusLevelBadge')),rank=rect(document.getElementById('imperialRankings'));
    const textOverflow=[...menu.querySelectorAll('.hud-value,.hud-count')].filter(n=>{const range=document.createRange();range.selectNodeContents(n);const t=range.getBoundingClientRect(),b=n.getBoundingClientRect();return t.left<b.left-.3||t.right>b.right+.3;}).map(n=>n.textContent);
    let frame=null;
    if(checkFrame){
     const p=menu.querySelector('.frame-shadow'),length=p.getTotalLength(),ys=[[],[]];
     for(let i=0;i<=1024;i++){const point=p.getPointAtLength(length*i/1024);for(let side=0;side<2;side++)if(Math.abs(point.x-r.width*(side?.75:.25))<4)ys[side].push(point.y);}
     frame={height:p.getBBox().height,wings:ys.map(y=>({top:Math.min(...y),bottom:Math.max(...y),height:Math.max(...y)-Math.min(...y)}))};
    }
    return {width:r.width,height:r.height,viewport:innerWidth,edgeLeft:r.left,edgeRight:innerWidth-r.right,order:boxes.map(b=>b.name),safe,frame,
     icons:nodes.map(n=>({key:n.dataset.key,...rect(n.querySelector('.hud-art-clip'))})),
     leftGaps:gaps(left,Math.max(rect(menu.querySelector('.flourish-left')).right,safe.left),rect(menu.querySelector('.divider-left')).left),
     rightGaps:gaps(right,rect(menu.querySelector('.divider-right')).right,Math.min(rect(menu.querySelector('.flourish-right')).left,safe.right)),
     center:level.cx-(r.x+r.width/2),mapGap:level.left-map.right,rankGap:rank.left-level.right,
     clipped:boxes.filter(b=>b.left<safe.left-.3||b.right>safe.right+.3),overlap:boxes.slice(1).filter((b,i)=>b.left<boxes[i].right-.3),textOverflow,
     missed:nodes.filter(n=>n.matches('a,button')&&!n.disabled).filter(n=>{const b=n.getBoundingClientRect();return !n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}).map(n=>n.id),
     scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};
   },/normal|notch/.test(label));
   const s=(c.viewport-2*safeInset)/1024;
   assert.deepEqual(c.order,expected,label+' order');assert(!c.scroll,label+' viewport overflow');
   for(const key of ['clipped','overlap','textOverflow','missed'])assert.deepEqual(c[key],[],label+' '+key);
   assert(Math.abs(c.edgeLeft-6)<.1&&Math.abs(c.edgeRight-6)<.1,label+' decoration remains 6px from both edges, including a notch');
   assert(Math.abs(c.safe.left-safeInset)<.1&&Math.abs(c.viewport-c.safe.right-safeInset)<.1,label+' symmetric control safe area');
   assert(Math.abs(c.height-115.2*s)<.1,label+' approved badge and artwork scale preserved');
   if(c.frame){
    assert(Math.abs(c.frame.height-101.2*s)<.1,label+' unchanged central frame height');
    for(const wing of c.frame.wings){assert(Math.abs(wing.height-60*s)<.1,label+' visibly thinner marble wing');assert(Math.abs((wing.top+wing.bottom)/2-c.height/2)<.1,label+' top/bottom symmetry');}
    assert(Math.abs(c.frame.wings[0].height-c.frame.wings[1].height)<.05,label+' matching left/right wing heights');
   }
   assert(Math.abs(c.center)<.03&&Math.abs(c.mapGap-c.rankGap)<.04,label+' central mirror symmetry');
   assert(Math.abs(c.mapGap-12*s)<.04,label+' approved center clearance');
   for(const gap of [c.leftGaps,c.rightGaps]){
    assert(Math.min(...gap)>=4.95*s,label+' visible clearance '+JSON.stringify(gap));
    assert(Math.max(...gap)-Math.min(...gap)<.08,label+' equal piece gaps including boundaries '+JSON.stringify({gap,icons:c.icons}));
   }
   for(const i of c.icons){const size=(i.key==='level'?79.2:['map','rankings'].includes(i.key)?41.4:27)*s;
    assert(Math.abs(i.width-size)<.04&&Math.abs(i.height-size)<.04,label+' approved icon size '+i.key);}
  }
  for(const [width,height]of [[1440,800],[932,430],[874,402],[844,390],[760,360],[667,375],[568,320]]){
   await page.setViewportSize({width,height});
   for(const [label,values]of [['normal',[2000,2000,2000,2000,2000]],['large',[1100000,999717,17999393,14999215,3999841]],['zero',[0,0,0,0,0]],['edge',[999999,9999,9999,9999,9999]],['limits',[999000000,999000000,999000000,999000000,999000000]],['pending',[null,null,null,null,null]]]){
    await page.evaluate(values=>hud.setWallet(values),values);await geometry(width+' '+label);
    // The production account callback defaults the two optional gem fields to zero.
    if(['normal','zero','pending'].includes(label))assert.deepEqual(await page.locator('.hud-value').allTextContents(),label==='pending'?['—','—','—','0','0']:values.map(amount));
    const titles=await page.locator('.money').evaluateAll(ns=>ns.map(n=>n.title));
    if(label!=='pending')for(let i=0;i<5;i++)assert(titles[i].startsWith(new Intl.NumberFormat('tr-TR').format(values[i])+' '),'exact live value accessible');
    if(label==='normal'||label==='limits')await page.screenshot({path:path.join(output,`hud-${width}-${label}.png`)});
   }
   console.log(`PASS ${width}×${height}: six balance states, equal edge/gap measurements, sizes, content and touch targets.`);
  }
  await page.setViewportSize({width:874,height:402});await page.evaluate(()=>hud.setWallet([2000,2000,2000,2000,2000]));
  for(const inset of [47,62]){
   await page.locator('#ludusHud').evaluate((n,inset)=>n.style.setProperty('--hud208-safe',inset+'px'),inset);await geometry('symmetric notch clearance '+inset,inset);
   await page.screenshot({path:path.join(output,`hud-notch-${inset}.png`)});
  }
  await page.locator('#ludusHud').evaluate(n=>n.style.removeProperty('--hud208-safe'));
  await page.evaluate(()=>{document.getElementById('messagesOpen').hidden=true;document.getElementById('accountLink').hidden=true;});await settle();
  assert.equal(await page.locator('#accountLink').isVisible(),false);
  await page.evaluate(()=>{document.getElementById('messagesOpen').hidden=false;document.getElementById('accountLink').hidden=false;});await geometry('authentication visibility');
  for(const level of [1,9,10,50,100]){
   await page.evaluate(n=>hud.setLevel(n),level);assert.equal(await page.locator('.hud-level-number').textContent(),String(level));
   const center=await page.locator('.hud-level-number').evaluate(n=>{const ctx=document.createElement('canvas').getContext('2d');ctx.font='600 '+n.getAttribute('font-size')+'px Georgia';const m=ctx.measureText(n.textContent);return Number(n.getAttribute('y'))+(m.actualBoundingBoxDescent-m.actualBoundingBoxAscent)/2;});
   assert(Math.abs(center-(93-7)/178*48)<.05,'visible numeral centered in medallion');
  }
  await page.evaluate(()=>hud.setLevel(50));await page.evaluate(()=>hud.setGold(1100000));await settle();
  assert((await page.locator('.money[data-currency=gold]').getAttribute('aria-label')).startsWith('1.100.000 '));
  await page.evaluate(()=>hud.setCaravans({free_caravans:2,caravans:6}));assert.equal(await page.locator('#caravanHud .hud-count').textContent(),'2/6');
  await page.evaluate(()=>hud.setRoster([{id:'1'},{id:'2',status:'locked'}]));assert.equal(await page.locator('#gladiatorHud .hud-count').textContent(),'1/2');
  await page.evaluate(()=>hud.setRoster([{id:'1'}],false));assert.equal(await page.locator('#gladiatorHud .hud-count').textContent(),'—/1');await geometry('updated counters');
  for(const id of ['caravanHud','gladiatorHud','friendsOpen','messagesOpen'])await page.locator('#'+id).tap();
  await page.locator('#accountLink').tap();await page.locator('#beginnerHelp').tap();assert.deepEqual(await page.evaluate(()=>hudClicks),{caravans:1,gladiators:1,friends:1,messages:1,help:1});
  assert.equal(new URL(await page.locator('#imperialRankings').getAttribute('href'),'http://hud.test/').pathname,'/siralamalar.html');
  assert.equal(new URL(await page.locator('#ludusMap').getAttribute('href'),'http://hud.test/').pathname,'/roma.html');
  await page.setViewportSize({width:393,height:852});await page.locator('#landscapeGate').waitFor({state:'visible'});assert.equal(await page.locator('#ludusHud').isVisible(),false);
  await page.setViewportSize({width:852,height:393});await page.waitForFunction(()=>document.getElementById('landscapeGate').hidden&&!document.getElementById('ludusHud').inert);assert(await page.locator('#ludusHud').isVisible());
  assert.deepEqual(errors,[]);await context.close();console.log('PASS numeral centering, live counters, settings/help, destinations and rotation.');
 }finally{await browser.close();}
}
if(!process.argv.includes('--static'))run().catch(e=>{console.error(e);process.exitCode=1;});
