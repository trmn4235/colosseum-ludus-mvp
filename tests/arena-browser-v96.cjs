/* Real pages/assets with isolated account fixtures; never creates a production battle. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'),exercise=require('../gladiator-exercise-v46.js');
const root=path.resolve(process.env.LUDUS_TEST_ROOT||path.join(__dirname,'..')),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/arena-v96',owner='00000000-0000-4000-8000-000000000001',battle='00000000-0000-4000-8000-000000000078';
const fighters=Object.keys(exercise.profiles).map((type,i)=>({id:'g'+i,name:i?'Gladyatör '+i:'Cassius',class:type,owner_id:owner,overall:50,level:1,status:'available',session:null,stat_version:46,base_stats:exercise.profile(type),fatigue_value:0,exercise_units:0}));
const receipt={gold:100,diamonds:1,stone:{name:'Safir II'},kind:'legs',ludus_exp:100,extracted:Array.from({length:6},()=>({}))};
const fixture=`const fixtureUser={id:${JSON.stringify(owner)},is_anonymous:false,user_metadata:{}},fixtureFighters=${JSON.stringify(fighters)};window.__receipt=${JSON.stringify(receipt)};window.__finishCalls=[];
window.__fixtureClient={auth:{getUser:async()=>({data:{user:fixtureUser}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})},from:name=>{const value=name==='ludus_accounts'?{user_id:fixtureUser.id,ludus_name:'Tırman',gold:3760,diamonds:1}:name==='ludus_gladiators'?fixtureFighters:name==='ludus_battles'?{id:${JSON.stringify(battle)},owner_id:fixtureUser.id,mode:'solo20',rule_version:2,snapshot:{gladiator:{...fixtureFighters[0],combat_morale:90,combat_stamina_bonus:12},items:[]},loot:[]}:[];const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value}),then:(r,j)=>Promise.resolve({data:value}).then(r,j)};return b;},rpc:async(name,args)=>{if(name.startsWith('ludus_finish_battle')){__finishCalls.push({name,args});await new Promise(r=>setTimeout(r,700));return{data:__receipt};}return{data:name==='ludus_clan'||name==='ludus_clan_vault'?{server_now:new Date().toISOString(),clan:null,gladiators:fixtureFighters}:name==='ludus_progress'?{level:3,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_imperial'?{server_now:new Date().toISOString(),missions:[],assignments:[],gladiators:fixtureFighters,is_admin:false,today:'2026-10-11'}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:{server_now:new Date().toISOString(),gladiators:fixtureFighters}};}};`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
let cleanup=async()=>{};
async function main(){
 fs.mkdirSync(out,{recursive:true});const current=fs.existsSync(root+'/arena-runtime-v96.js');
 const server=http.createServer((req,res)=>{
  const filename=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
  if(!filename.startsWith(root+'/')||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404).end();return;}
  let body=fs.readFileSync(filename);
  if(filename.endsWith('/arena.html'))body=Buffer.from(body.toString()
   .replace('function frame(now){const cpuStart','function frame(now){if(window.__stopLoop)return;const cpuStart')
   .replace('var LudusBattle=(function(){',fixture+'\nLudusClient.create=()=>window.__fixtureClient;var LudusBattle=(function(){')
   .replace('mainMenu();Promise.all([LudusBattle.load()',`window.__arena={combat,renderer,scene,camera,models,events,showResult,hud,saveReward,begin,setPaused,
    freeze:()=>{paused=true;window.__stopLoop=true;},
    step:(dt,run=true)=>{paused=!run;window.__stopLoop=false;frame(last+dt*1000);paused=true;window.__stopLoop=true;},
    get started(){return started;}};let drawCount=0;const originalRender=renderer.render;renderer.render=function(...args){drawCount++;return originalRender.apply(this,args)};window.__drawCount=()=>drawCount;
    mainMenu();Promise.all([LudusBattle.load()`));
  res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'}).end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=process.env.LUDUS_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 cleanup=async()=>{await browser.close();await new Promise(r=>server.close(r));};
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:2});await context.route('https://**',r=>r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/arena.html?battle='+battle,{waitUntil:'domcontentloaded'});
 if(current){assert.equal(await page.locator('#intro').count(),0);assert.ok(!await page.getByText('Arena hazırlanıyor',{exact:false}).count());}
 await page.waitForFunction(()=>window.__arena?.started&&__arena.combat.time>.05,null,{timeout:60000});await page.evaluate(()=>__arena.freeze());
 // Render exactly the same twenty fighters, camera, shadow mode and resolution in both revisions.
 const comparison=await page.evaluate(()=>{
  const a=__arena;a.renderer.setPixelRatio(1.25);a.renderer.shadowMap.enabled=true;a.renderer.shadowMap.autoUpdate=true;
  a.camera.position.set(0,6,12);a.camera.lookAt(0,1,0);
  let bodyMeshes=0,skeletons=0,poses=0;
  const originalAnimate=ImportedGladiator.animate;ImportedGladiator.animate=function(...args){poses++;return originalAnimate.apply(this,args)};
  for(let i=0;i<a.models.length;i++){
   const f=a.combat.fighters[i],m=a.models[i];f.x=(i%5-2)*2.8;f.z=(Math.floor(i/5)-2)*3;f.action='idle';f.move=0;f.angle=0;
   ImportedGladiator.animate(f,m,0,1/60);m.root.visible=true;m.visual.traverse(o=>{if(o.isSkinnedMesh){skeletons++;if(o.visible)bodyMeshes++;}});
  }
  a.renderer.render(a.scene,a.camera);const info={calls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,bodyMeshes,skeletons,geometries:a.renderer.info.memory.geometries,textures:a.renderer.info.memory.textures};
  const actual=a.renderer.render;a.renderer.render=()=>{};poses=0;
  for(let i=0;i<120;i++)a.step(1/60,false);
  const pausedPoses=poses;a.renderer.render=actual;ImportedGladiator.animate=originalAnimate;
  return {...info,pausedPoses};
 });
 console.log(JSON.stringify({current,comparison}));
 if(current){assert.equal(comparison.bodyMeshes,20);assert.equal(comparison.skeletons,20);assert.equal(comparison.pausedPoses,0);}
 await page.screenshot({path:out+'/arena-844.png'});
 for(const [w,h]of [[667,375],[932,430],[1024,768]]){await page.setViewportSize({width:w,height:h});await page.evaluate(()=>__arena.step(1/60));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/arena-'+w+'.png'});}
 await page.setViewportSize({width:844,height:390});
 if(current){
  const stopped=await page.evaluate(()=>{__arena.step(1/60,false);const before=__drawCount(),time=__arena.combat.time;for(let i=0;i<60;i++)__arena.step(1/60,false);return {draws:__drawCount()-before,seconds:__arena.combat.time-time};});
  assert.equal(stopped.draws,0);assert.equal(stopped.seconds,0);
  await page.evaluate(()=>__arena.setPaused(false));await page.locator('#pause').click();await page.screenshot({path:out+'/pause.png'});await page.locator('#quality').selectOption('high');assert.equal(await page.evaluate(()=>__arena.renderer.getPixelRatio()),1.6);await page.locator('#quality').selectOption('low');assert.equal(await page.evaluate(()=>__arena.renderer.getPixelRatio()),1);await page.locator('#resume').click();await page.evaluate(()=>__arena.freeze());
 }
 await page.evaluate(()=>{__arena.combat.finished=true;__arena.combat.result='win';__arena.showResult();});
 await page.waitForFunction(()=>window.__finishCalls.length===1&&document.querySelector('#rewardStatus').textContent.includes('Ödüller'),null,{timeout:10000});
 await page.screenshot({path:out+'/result.png'});assert.equal(await page.locator('#resultMenu').isEnabled(),true);
 assert.deepEqual(errors,[]);
 // Missing critical assets still have a retry path; removing the old intro must not hide errors.
 if(current){const failedContext=await browser.newContext({viewport:{width:844,height:390}});await failedContext.route('https://**',r=>r.abort());const failed=await failedContext.newPage();await failed.route('**/Colosseum.glb',r=>r.fulfill({status:503,body:'unavailable'}));await failed.goto(base+'/arena.html?battle='+battle);await failed.waitForFunction(()=>getComputedStyle(document.querySelector('#fatal')).display!=='none',null,{timeout:20000});assert.equal(await failed.locator('#fatal button').isVisible(),true);await failedContext.close();}
 fs.writeFileSync(out+'/report.json',JSON.stringify({current,comparison,errors,engine:process.env.LUDUS_TEST_ENGINE||'chromium',note:'Software-rendered browser, deterministic scene. Draw counts are not phone FPS.'},null,2));console.log(JSON.stringify({current,comparison,errors,out}));await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exit(1)});
