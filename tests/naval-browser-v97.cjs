/* Real pages/assets with isolated account fixtures; never creates a production battle. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'),exercise=require('../gladiator-exercise-v46.js');
const root=path.resolve(process.env.LUDUS_TEST_ROOT||path.join(__dirname,'..')),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/naval-v97',owner='00000000-0000-4000-8000-000000000001',battle='00000000-0000-4000-8000-000000000078';
const fighters=Object.keys(exercise.profiles).map((type,i)=>({id:'g'+i,name:i?'Gladyatör '+i:'Cassius',class:type,owner_id:owner,overall:50,level:1,status:'available',session:null,stat_version:46,base_stats:exercise.profile(type),fatigue_value:0,exercise_units:0}));
const receipt={gold:100,diamonds:1,stone:{name:'Safir II'},kind:'legs',ludus_exp:100,extracted:Array.from({length:6},()=>({}))};
const fixture=`const fixtureUser={id:${JSON.stringify(owner)},is_anonymous:false,user_metadata:{}},fixtureFighters=${JSON.stringify(fighters)};window.__receipt=${JSON.stringify(receipt)};window.__finishCalls=[];
window.__fixtureClient={auth:{getUser:async()=>({data:{user:fixtureUser}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})},from:name=>{const value=name==='ludus_accounts'?{user_id:fixtureUser.id,ludus_name:'Tırman',gold:3760,diamonds:1}:name==='ludus_gladiators'?fixtureFighters:name==='ludus_battles'?(location.pathname.endsWith('/savas.html')?[]:{id:${JSON.stringify(battle)},owner_id:fixtureUser.id,mode:'4x5',rule_version:2,snapshot:{gladiator:{...fixtureFighters[0],combat_morale:90,combat_stamina_bonus:12},items:[]},loot:Array.from({length:20},(_,actor)=>({actor,slot:'main_hand',token:'blade-'+actor,item:{kind:'weapon',model:'gladius',stat_version:7,base_stats:{}}}))}):[];const b={select:()=>b,eq:()=>b,order:()=>b,is:()=>b,limit:()=>b,single:async()=>({data:value}),then:(r,j)=>Promise.resolve({data:value}).then(r,j)};return b;},rpc:async(name,args)=>{if(name==='ludus_start_battle_v2'){sessionStorage.setItem('__fixtureStart',JSON.stringify(args));return{data:{id:${JSON.stringify(battle)},mode:'4x5',rule_version:2}};}if(name.startsWith('ludus_finish_battle')){__finishCalls.push({name,args});await new Promise(r=>setTimeout(r,700));return{data:__receipt};}return{data:name==='ludus_clan'||name==='ludus_clan_vault'?{server_now:new Date().toISOString(),clan:null,gladiators:fixtureFighters}:name==='ludus_progress'?{level:3,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_imperial'?{server_now:new Date().toISOString(),missions:[],assignments:[],gladiators:fixtureFighters,is_admin:false,today:'2026-10-11'}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:{server_now:new Date().toISOString(),gladiators:fixtureFighters}};}};`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
let cleanup=async()=>{};
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  const filename=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
  if(!filename.startsWith(root+'/')||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404).end();return;}
  let body=fs.readFileSync(filename);
  if(filename.endsWith('/arena.html'))body=Buffer.from(body.toString()
   .replace('function frame(now){const cpuStart','function frame(now){if(window.__stopLoop)return;const cpuStart')
   .replace('var LudusBattle=(function(){',fixture+'\nLudusClient.create=()=>window.__fixtureClient;var LudusBattle=(function(){')
   .replace('mainMenu();Promise.all([LudusBattle.load()',`window.__arena={combat,renderer,scene,camera,models,events,showResult,hud,begin,setPaused,
    get naval(){return naval},get view(){return navalView},
    freeze:()=>{paused=true;window.__stopLoop=true;},
    step:(dt,run=true)=>{paused=!run;window.__stopLoop=false;frame(last+dt*1000);paused=true;window.__stopLoop=true;},
    get started(){return started;}};mainMenu();Promise.all([LudusBattle.load()`));
  if(filename.endsWith('/savas.html'))body=Buffer.from(body.toString().replace(" const $=id=>document.getElementById(id),client=LudusClient.create",fixture+"\nLudusClient.create=()=>window.__fixtureClient; const $=id=>document.getElementById(id),client=LudusClient.create"));
  res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'}).end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 cleanup=async()=>{await browser.close();await new Promise(r=>server.close(r));};
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:1.5});await context.route('https://**',r=>r.abort());
 const page=await context.newPage(),errors=[],boatRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(r.url().includes('/assets/naval/')&&r.url().includes('.glb'))boatRequests.push(r.url());});
 await page.goto(base+'/savas.html?choose=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('fighterName').textContent==='Cassius');
 assert.equal(await page.locator('#panel-single [data-mode]').count(),4);
 await page.locator('[data-mode="naval4x5"]').click();assert.match(await page.locator('#modeTitle').innerText(),/Deniz Savaşı/);
 await page.locator('#enter').click();await page.waitForURL('**/arena.html?**');
 assert.equal(new URL(page.url()).searchParams.get('arena'),'naval');
 const start=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('__fixtureStart')));assert.equal(start.p_mode,'4x5');assert.equal(start.p_gladiator,'g0');assert.ok(start.p_request);

 await page.waitForFunction(()=>window.__arena?.started&&__arena.combat.time>.05,null,{timeout:60000});await page.evaluate(()=>__arena.freeze());
 assert.equal(await page.locator('#fatal').isVisible(),false,'the initial naval render must finish without a fatal error');
 assert.deepEqual(errors,[]);
 const initial=await page.evaluate(()=>({ships:__arena.naval.ships.length,fighters:__arena.combat.fighters.length,counts:__arena.naval.ships.map(s=>__arena.combat.fighters.filter(f=>f.team===s.team).length),calls:__arena.renderer.info.render.calls,triangles:__arena.renderer.info.render.triangles}));
 assert.equal(initial.ships,4);assert.deepEqual(initial.counts,[5,5,5,5]);assert.equal(initial.fighters,20);
 const boatAsset=await page.evaluate(()=>{
  const views=__arena.view.views,geometries=new Set(),textures=new Set();let skinned=0,triangles=0,meshes=0;
  for(const v of views)v.group.traverse(o=>{if(!o.isMesh||!o.userData.navalRole)return;meshes++;if(o.isSkinnedMesh)skinned++;geometries.add(o.geometry.uuid);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(o.material[key])textures.add(o.material[key].uuid);});
  // Sample the entire playable rectangle against the rendered deck triangles.
  // This catches a hull resize whose corners leave fighters standing on water.
  const boat=views[0].group;boat.updateMatrixWorld(true);const decks=[];boat.traverse(o=>{if(o.isMesh&&o.userData.navalRole==='deck')decks.push(o);});
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),misses=[];
  const ship=views[0].ship,C=NavalSimulation.constants;
  for(let x=-C.halfWidth+C.margin;x<=C.halfWidth-C.margin+.01;x+=.28)for(let z=-C.halfLength+C.margin;z<=C.halfLength-C.margin+.01;z+=.28){const q=NavalSimulation.world(ship,x,z);ray.set(new THREE.Vector3(q.x,2,q.z),down);const hit=ray.intersectObjects(decks,false)[0];if(!hit||Math.abs(hit.point.y)>.025)misses.push({x,z,y:hit?.point.y});}
  return{meshes,geometries:geometries.size,textures:textures.size,skinned,triangles,misses};
 });
 assert.equal(boatRequests.length,1,'four boats load one shared GLB');
 assert.equal(boatAsset.skinned,0,'the boat must not evaluate a skeleton');
 assert.equal(boatAsset.geometries,boatAsset.meshes/4,'geometry is shared across all four clones');
 assert.ok(boatAsset.textures<=8,'source textures are shared, not copied per ship');
 assert.ok(boatAsset.triangles<40000,'all four boats stay below 40,000 triangles');
 assert.deepEqual(boatAsset.misses,[],'every playable deck sample has a rendered surface');
 await page.screenshot({path:out+'/naval-844.png'});
 await page.evaluate(()=>{const s=__arena.naval.ships[0];__arena.camera.position.set(s.x+14,9,s.z-16);__arena.camera.lookAt(s.x,.6,s.z);__arena.renderer.render(__arena.scene,__arena.camera);});
 await page.screenshot({path:out+'/boat-five-crew.png'});
 await page.evaluate(()=>__arena.setPaused(false));await page.locator('#navalHelm').click();
 assert.equal(await page.evaluate(()=>__arena.naval.manual),true);await page.evaluate(()=>{const render=__arena.renderer.render;__arena.renderer.render=()=>{};try{for(let i=0;i<45;i++)__arena.step(1/60);}finally{__arena.renderer.render=render;}__arena.step(1/60);});
 await page.screenshot({path:out+'/helm.png'});
 assert.equal(await page.locator('#navalSailing').isVisible(),true);assert.equal(await page.locator('#attack').isVisible(),false);
 await page.evaluate(()=>__arena.setPaused(false));await page.locator('#navalHelm').click();assert.equal(await page.evaluate(()=>__arena.naval.manual),false);assert.ok(await page.evaluate(()=>__arena.naval.ships[0].helm>0));
 // Align two decks, put the player at the hinge, and render the real interaction UI.
 await page.evaluate(()=>{
   const n=__arena.naval;n.bridges=[];n.time=0;for(const s of n.ships)Object.assign(s,{speed:0,turn:0,angle:0});
   Object.assign(n.ships[0],{x:0,z:0});Object.assign(n.ships[1],{x:8,z:0});Object.assign(n.ships[2],{x:-18,z:0});Object.assign(n.ships[3],{x:18,z:18});
   for(const f of __arena.combat.fighters){f.shipId=f.team;f.navBridge=null;Object.assign(f,NavalSimulation.world(n.ships[f.shipId],f.id%2?1:-1,f.id%5-2));}
   Object.assign(n.player(),{x:2.1,z:0,action:'idle',stunUntil:0});
   __arena.camera.position.set(8,12,-14);__arena.camera.lookAt(3,0,0);__arena.view.update(0);for(let i=0;i<20;i++)ImportedGladiator.animate(__arena.combat.fighters[i],__arena.models[i],0,1/60);
   for(const m of __arena.models){m.root.visible=true;m.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}__arena.renderer.render(__arena.scene,__arena.camera);__arena.setPaused(false);__arena.view.update(0);
 });
 assert.equal(await page.locator('#navalBridge').isVisible(),true);
 const gold=await page.locator('#navalBridge').evaluate(e=>getComputedStyle(e).backgroundImage);assert.ok(gold.includes('228, 185, 64'));
 await page.screenshot({path:out+'/bridge-ready.png'});
 await page.locator('#navalBridge').click();assert.equal(await page.evaluate(()=>__arena.naval.bridges[0]?.phase),'opening');
 await page.evaluate(()=>{const n=__arena.naval;for(let i=0;i<60;i++)n.step(1/60,{});__arena.view.update(1);for(let i=0;i<20;i++){const m=__arena.models[i];m.root.visible=true;ImportedGladiator.animate(__arena.combat.fighters[i],m,1,1/60);m.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}__arena.renderer.render(__arena.scene,__arena.camera);});
 assert.equal(await page.evaluate(()=>__arena.naval.bridges[0].phase),'open');await page.screenshot({path:out+'/bridge-open.png'});
 const crossing=await page.evaluate(()=>{const n=__arena.naval,p=n.player();for(let x=2.1;x<6.6;x+=.08){p.x=x;n.bound(p);}return{ship:p.shipId,bridge:p.navBridge};});assert.equal(crossing.ship,1);assert.equal(crossing.bridge,null);
 await page.evaluate(()=>{const n=__arena.naval;n.bridges=[];n.player().shipId=0;n.player().x=2.1;n.player().z=0;n.ships[1].angle=.6;__arena.view.update(1);});assert.equal(await page.locator('#navalBridge').isVisible(),false);
 for(const [w,h] of [[667,375],[932,430],[1024,768]]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(()=>{__arena.step(1/60);});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/naval-'+w+'.png'});
 }
 await page.evaluate(()=>__arena.setPaused(true));assert.equal(await page.locator('#navalControls').isVisible(),false);
 assert.deepEqual(errors,[]);
 // The remembered scene survives a same-device resume URL without its arena parameter.
 await page.goto(base+'/arena.html?battle='+battle,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__arena?.started,null,{timeout:60000});assert.equal(await page.evaluate(()=>__arena.naval.ships.length),4);await page.evaluate(()=>__arena.freeze());
 fs.writeFileSync(out+'/report.json',JSON.stringify({initial,boatAsset,boatRequests:boatRequests.length,errors,viewports:4,controls:'menu selection, server ticket, take/release, AI takeover, valid and invalid bridge, boarding, pause, resume',note:'Chromium with software GPU. Not a physical phone FPS measurement.'},null,2));
 console.log(JSON.stringify({initial,boatAsset,errors,out}));await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exit(1);});
