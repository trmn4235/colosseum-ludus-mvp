/* Actual login markup and combat controls, with isolated account stubs only. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/ui-revisions-v79';
const viewports=[[568,320],[667,375],[844,390],[1536,706]];
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
function accountFixture(scenario){return `
 const fixtureUser={id:'00000000-0000-4000-8000-000000000079',is_anonymous:false};
 supabase.createClient=()=>({auth:{
  onAuthStateChange(fn){window.__authListener=fn;return{data:{subscription:{unsubscribe(){}}}};},
  async getSession(){if(${JSON.stringify(scenario)}==='recovery')__authListener('PASSWORD_RECOVERY',{user:fixtureUser});return{data:{session:{user:fixtureUser}},error:null};},
  async getUser(){return{data:{user:fixtureUser},error:null};},
  async signOut(){__authListener('SIGNED_OUT',null);return{error:null};}
 },from(){const b={select(){return b;},eq(){return b;},async single(){return{data:${scenario==='error'?'null':"{ludus_name:'Legio Tırman'}"},error:${scenario==='error'?"{message:'isolated account error'}":'null'}};}};return b;}});
 `;}
function controlsFixture(){
 const arena=read('arena.html');
 const head=arena.slice(arena.indexOf('<head>')+6,arena.indexOf('</head>')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const body=arena.slice(arena.indexOf('<section id="hud"'),arena.indexOf('<section id="intro"'));
 return `<html><head>${head}</head><body data-roman-screen="arena">${body}<script src="combat-control-settings-v44.js"></script><script src="arena-controls-v43.js"></script><script>
 ArenaTouchControls.mount({active:()=>false,release(){},guardClassic(){},cancelAttack(){}});
 </script></body></html>`;
}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 for(const file of ['index.html','ludus.html','savas.html','arena.html','multiplayer.html']){
  const source=read(file);
  for(const match of source.matchAll(/(?:arena|savas|ludus|multiplayer)\.html\?v=(revision[\d.]+)/g))assert.equal(match[1],'revision79',file+' navigation is current');
  for(const match of source.matchAll(/searchParams\.set\('v','(revision[\d.]+)'\)/g))assert.equal(match[1],'revision79',file+' navigation helper is current');
 }
 assert.match(read('index.html'),/login-intro-v40\.css\?v=revision80/);
 assert.match(read('arena.html'),/arena-controls-v43\.css\?v=revision79/);
 assert.equal(JSON.parse(read('manifest.webmanifest')).start_url,'./index.html?v=revision80');
 const ludus=read('ludus.html'),frontZ=Number(ludus.match(/const residentHomeFrontZ=([\d.]+);/)[1]);
 const homeExpression=ludus.match(/g\.data\.forEach\(\(row,i\)=>\{const home=(\{[^}]+\})/)[1];
 assert.equal(frontZ,2.4);assert.equal((ludus.match(/z:residentHomeFrontZ/g)||[]).length,2,'starter and account rows share the new anchor');
 for(const count of [2,7,8,14,30])for(let i=0;i<count;i++){
  const home=vm.runInNewContext('('+homeExpression+')',{i,g:{data:Array(count)},residentHomeFrontZ:frontZ});
  assert.ok(Math.abs((4.4-Math.floor(i/7)*2.5)-home.z-2)<1e-9,'every roster row moves exactly two metres');
  assert.ok(home.z>-11&&home.z<8&&Math.abs(home.x)<=9,'home remains in courtyard');
 }
 const browser=await chromium.launch({headless:true,executablePath:'/tmp/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
 const errors=[],remote=[];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://ui-v79.test'){remote.push(url.href);return route.abort();}
  if(url.pathname==='/controls-fixture')return route.fulfill({body:controlsFixture(),contentType:'text/html'});
  const filename=path.resolve(root,'.'+url.pathname);
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile())return route.fulfill({status:404});
  let body=fs.readFileSync(filename);
  if(url.pathname==='/index.html')body=Buffer.from(body.toString().replace('const URL_BASE=',accountFixture(url.searchParams.get('case'))+'\nconst URL_BASE='));
  return route.fulfill({body,contentType:filename.endsWith('.html')?'text/html':filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':filename.endsWith('.webp')?'image/webp':'application/octet-stream'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.body.dataset.introState==='ready'&&getComputedStyle(document.getElementById('entryPanel')).opacity==='1');
 async function measure(name,width,height){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const b=await page.locator('#entryPanel').boundingBox();
  assert.ok(b.x>=0&&b.x<width*.15&&b.y>=0&&b.y<=12&&b.x+b.width<=width+.5&&b.y+b.height<=height+.5,name+' stays top-left: '+JSON.stringify(b));
  assert.ok(b.width<=340.5&&b.width<width*.31,'smaller auth panel');
  const titleGap=await page.locator('#loginArtwork').evaluate((image,right)=>{const b=image.getBoundingClientRect(),scale=Math.min(b.width/image.naturalWidth,b.height/image.naturalHeight);return b.x+(b.width-image.naturalWidth*scale)/2+488*scale-right;},b.x+b.width);
  assert.ok(titleGap>=12,'blank space before Colosseum C: '+titleGap);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal scrolling');
  await page.screenshot({path:path.join(out,name+'-'+width+'.png')});return b;
 }
 try{
  await page.goto('http://ui-v79.test/index.html?case=welcome');await ready();
  assert.equal(await page.locator('#welcomeName').innerText(),'Legio Tırman');assert.equal(await page.locator('#enter').isEnabled(),true);
  for(const [width,height]of viewports){await page.setViewportSize({width,height});await measure('welcome',width,height);}
  await page.locator('#logout').click();
  for(const [width,height]of viewports){
   await page.setViewportSize({width,height});const login=await measure('login',width,height);
   await page.locator('#register').click();const register=await measure('register',width,height);
   assert.equal(register.x,login.x);assert.equal(register.y,login.y);assert.ok(register.height>=login.height,'longer membership form grows down');
   for(const selector of ['#newUsername','#ludusName','#email','#newPassword','#createOwner','#registerForm button[type=submit]','#back']){
    await page.locator(selector).scrollIntoViewIfNeeded();const b=await page.locator(selector).boundingBox();assert.ok(b.y>=register.y&&b.y+b.height<=register.y+register.height+.5,'membership control is reachable: '+selector);
   }
   await page.locator('#back').click();await page.locator('#forgot').click();const forgot=await measure('forgot',width,height);
   assert.equal(forgot.y,login.y);assert.equal(forgot.x,login.x);await page.locator('#back').click();
  }
  await page.goto('http://ui-v79.test/index.html?case=error');await ready();
  assert.equal(await page.locator('#enter').isEnabled(),false);assert.match(await page.locator('#accountMessage').innerText(),/Ludus adı yüklenemedi/);
  await page.setViewportSize({width:844,height:390});await measure('account-error',844,390);
  await page.locator('#entryPanel').evaluate(n=>n.style.setProperty('--entry-safe-left','59px'));await measure('safe-left',844,390);
  await page.locator('#entryPanel').evaluate(n=>n.style.removeProperty('--entry-safe-left'));
  await page.goto('http://ui-v79.test/index.html?case=recovery&mode=recovery');await ready();
  assert.equal(await page.locator('#resetForm').isVisible(),true);
  for(const [width,height]of viewports){await page.setViewportSize({width,height});await measure('reset',width,height);}
  await page.setViewportSize({width:568,height:220});await page.evaluate(()=>document.body.dataset.compactKeyboard='true');
  await measure('keyboard',568,220);await page.locator('#repeatPassword').fill('preview-password-only');
  assert.ok(await page.locator('#repeatPassword').evaluate(n=>{const b=n.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;}),'focused field is reachable with keyboard');
  await page.goto('http://ui-v79.test/controls-fixture');
  for(const preset of ['classic'])for(const [width,height]of viewports){
   await page.setViewportSize({width,height});await page.evaluate(preset=>document.body.dataset.controlLayout=preset,preset);
   const report=await page.evaluate(()=>{
    const rect=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
    return{vitals:rect(document.querySelector('.vitals')),icons:[...document.querySelectorAll('.vital-icon')].map(rect),bars:[...document.querySelectorAll('.vitals .meter')].map(rect),values:[hpText.textContent,stText.textContent]};
   });
   assert.ok(report.vitals.x<25&&report.vitals.width<=205.1);
   for(const icon of report.icons)assert.ok(icon.x>=0&&icon.x<8&&icon.width===20&&icon.height===20,'compact icon at left edge');
   for(const bar of report.bars)assert.equal(bar.height,10,'thin bars in both control layouts');
   assert.ok(report.icons[0].bottom<=report.icons[1].y,'health and stamina icons do not overlap');
   assert.deepEqual(report.values,['120 / 120','100 / 100']);
   await page.screenshot({path:path.join(out,'hud-'+preset+'-'+width+'.png')});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[],'no real account requests');
  console.log(JSON.stringify({viewports:viewports.length,authModes:6,authAnchor:'top-left',titleGap:true,simulatedSafeLeft:59,keyboard:true,hudPresets:2,iconPixels:20,barPixels:10,currentNavigation:true,pageErrors:0,productionRequests:0,out}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
