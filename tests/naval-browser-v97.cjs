/* Real pages/assets with isolated account fixtures; never creates a production battle. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright'),exercise=require('../gladiator-exercise-v46.js');
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
   .replace('mainMenu();Promise.all([LudusBattle.load()',`window.__arena={combat,renderer,scene,camera,models,events,showResult,hud,begin,setPaused,toast,
    get cameraMode(){return cameraMode},
    get naval(){return naval},get view(){return navalView},
    freeze:()=>{paused=true;window.__stopLoop=true;},
    step:(dt,run=true)=>{paused=!run;window.__stopLoop=false;frame(last+dt*1000);paused=true;window.__stopLoop=true;},
    get started(){return started;}};mainMenu();Promise.all([LudusBattle.load()`));
  if(filename.endsWith('/savas.html'))body=Buffer.from(body.toString().replace(" const $=id=>document.getElementById(id),client=LudusClient.create",fixture+"\nLudusClient.create=()=>window.__fixtureClient; const $=id=>document.getElementById(id),client=LudusClient.create"));
  res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'}).end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':chromium.executablePath()),args:['--no-sandbox','--enable-unsafe-swiftshader']});
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
 await page.evaluate(()=>{document.getElementById('toast').style.transition='none';document.getElementById('toast').style.opacity='0';});await page.screenshot({path:out+'/naval-844.png'});
 const outfit=await page.evaluate(()=>{
  let triangles=0;const maps=new Set(),sails=[];
  for(const v of __arena.view.views){v.group.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.material.map)maps.add(o.material.map.uuid);}});const sail=v.group.getObjectByName('Open sail');sail.geometry.computeBoundingBox();sails.push({height:sail.geometry.boundingBox.max.y-sail.geometry.boundingBox.min.y,map:sail.material.map.uuid,flag:!!v.group.getObjectByName('paint'),rack:v.rackShafts.count});}
  const p=__arena.naval.player(),c=__arena.camera;
  return{triangles,textures:maps.size,sails,cameraDistance:Math.hypot(c.position.x-p.x,c.position.z-p.z)};
 });
 console.log(JSON.stringify({outfit}));assert.equal(new Set(outfit.sails.map(s=>s.map)).size,4);assert.ok(outfit.sails.every(s=>s.height>3.5&&!s.flag&&s.rack===8));assert.ok(outfit.triangles<50000,'complete outfitted fleet stays below 50,000 triangles');assert.ok(outfit.cameraDistance<4.5,'V101 camera is closer than V100');
 const hudLayout=await page.evaluate(()=>{const helm=document.getElementById('navalHelm'),head=document.querySelector('[data-region=head]'),team=document.getElementById('teamScore');__arena.toast('Kondisyon bitti, savunman kırıldı.');return{helm:helm.getBoundingClientRect().width,head:head.getBoundingClientRect().width,text:helm.textContent.trim(),teamY:team.getBoundingClientRect().top,height:innerHeight,energyFont:parseFloat(getComputedStyle(document.getElementById('toast')).fontSize),areaRatio:(NavalSimulation.constants.arenaRadius/34.2)**2};});
 assert.equal(hudLayout.text,'');assert.ok(Math.abs(hudLayout.helm-hudLayout.head)<.1);assert.ok(hudLayout.teamY>hudLayout.height*.8);assert.ok(hudLayout.energyFont<=9);assert.ok(Math.abs(hudLayout.areaRatio-2)<1e-12);
 await page.screenshot({path:out+'/compact-energy.png'});
 async function perspective(mode){await page.evaluate(()=>__arena.setPaused(true));await page.selectOption('#cameraPerspective',mode);await page.locator('#resume').click();await page.evaluate(()=>__arena.step(1/60));}
 await perspective('first');
 const eyeView=await page.evaluate(()=>{const a=__arena,p=a.naval.player(),m=a.models[0],eye=ArenaPerspective.eye(THREE,m,p,p.angle,new THREE.Vector3()),helmet=[];m.gear.helmet.anchor.traverse(o=>{if(o.isMesh)helmet.push(a.camera.layers.test(o.layers));});return{mode:a.cameraMode,saved:ArenaPerspective.load(),height:a.camera.position.y,eyeHeight:eye.y,mask:m.eyeView.enabled.value,helmetVisible:helmet.some(Boolean),fov:a.camera.fov,armMeshes:m.eyeView.geometries.length,otherActorMask:!!a.models[1].eyeView};});
 assert.equal(eyeView.mode,'first');assert.equal(eyeView.saved,'first');assert.ok(Math.abs(eyeView.height-eyeView.eyeHeight)<.001);assert.ok(eyeView.height>1.5&&eyeView.height<2.3);assert.equal(eyeView.mask,1);assert.equal(eyeView.helmetVisible,false);assert.equal(eyeView.otherActorMask,false);assert.equal(eyeView.fov,68);
 await page.evaluate(()=>{document.getElementById('toast').style.opacity='0';});await page.screenshot({path:out+'/first-person.png'});
 await page.evaluate(()=>__arena.setPaused(true));await page.screenshot({path:out+'/camera-settings.png'});await page.locator('#resume').click();
 // Eye view stays attached to the helmsman instead of orbiting around the boat.
 await page.locator('#navalHelm').click();await page.evaluate(()=>__arena.step(1/60));
 assert.equal(await page.evaluate(()=>__arena.naval.manual),true);assert.ok(await page.evaluate(()=>Math.hypot(__arena.camera.position.x-__arena.naval.player().x,__arena.camera.position.z-__arena.naval.player().z))<.4);
 await page.evaluate(()=>__arena.setPaused(false));await page.locator('#navalHelm').click();await perspective('third');
 assert.equal(await page.evaluate(()=>__arena.models[0].eyeView.enabled.value),0);assert.equal(await page.evaluate(()=>__arena.camera.layers.isEnabled(1)),true);
 await page.evaluate(()=>{__arena.camera.position.set(24,19,-31);__arena.camera.lookAt(-1,2,0);__arena.renderer.render(__arena.scene,__arena.camera);});await page.screenshot({path:out+'/fleet-sails.png'});

 await page.evaluate(()=>{const s=__arena.naval.ships[0];__arena.camera.position.set(s.x+14,9,s.z-16);__arena.camera.lookAt(s.x,.6,s.z);__arena.renderer.render(__arena.scene,__arena.camera);});
 await page.screenshot({path:out+'/boat-five-crew.png'});
 await page.evaluate(()=>__arena.setPaused(false));await page.locator('#navalHelm').click();
 assert.equal(await page.evaluate(()=>__arena.naval.manual),true);await page.evaluate(()=>{const render=__arena.renderer.render;__arena.renderer.render=()=>{};try{for(let i=0;i<45;i++)__arena.step(1/60);}finally{__arena.renderer.render=render;}__arena.step(1/60);});
 const heading=await page.evaluate(()=>__arena.naval.ships[0].angle);
 await page.keyboard.down('KeyD');await page.evaluate(()=>{const render=__arena.renderer.render;__arena.renderer.render=()=>{};try{for(let i=0;i<12;i++)__arena.step(1/60);}finally{__arena.renderer.render=render;}});await page.keyboard.up('KeyD');
 const rightHeading=await page.evaluate(()=>__arena.naval.ships[0].angle);assert.ok(rightHeading<heading,'D turns the bow to the right in the following camera');
 await page.keyboard.down('KeyA');await page.evaluate(()=>{const render=__arena.renderer.render;__arena.renderer.render=()=>{};try{for(let i=0;i<12;i++)__arena.step(1/60);}finally{__arena.renderer.render=render;}__arena.step(1/60);});await page.keyboard.up('KeyA');
 assert.ok(await page.evaluate(()=>__arena.naval.ships[0].angle)>rightHeading,'A turns left');
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
 const receivingGate=await page.evaluate(()=>__arena.view.views[1].gates.value[0].toArray());assert.deepEqual(receivingGate,[-1,0,1]);
 await page.evaluate(()=>{const n=__arena.naval;n.ships[1].z=2.8;__arena.view.update(1);__arena.renderer.render(__arena.scene,__arena.camera);});
 assert.equal(await page.evaluate(()=>__arena.view.views[1].gates.value[0].y),-2.8,'receiving gate follows the staggered bridge landing');await page.screenshot({path:out+'/bridge-offset.png'});
 await page.evaluate(()=>{__arena.naval.ships[1].z=0;__arena.view.update(1);});
 const crossing=await page.evaluate(()=>{const n=__arena.naval,p=n.player();for(let x=2.1;x<6.6;x+=.08){p.x=x;n.bound(p);}return{ship:p.shipId,bridge:p.navBridge};});assert.equal(crossing.ship,1);assert.equal(crossing.bridge,null);
 await page.evaluate(()=>{const n=__arena.naval;n.bridges=[];n.player().shipId=0;n.player().x=2.1;n.player().z=0;n.ships[1].angle=.6;__arena.view.update(1);});assert.equal(await page.locator('#navalBridge').isVisible(),false);
 // A closed-bridge jump uses the real controls, animation and deck model.
 await page.evaluate(()=>{
  const n=__arena.naval;n.bridges=[];n.time=0;n.goal=s=>({...s});n.botStep=()=>{};
  for(const s of n.ships)Object.assign(s,{angle:0,speed:0,turn:0,vx:0,vz:0});
  Object.assign(n.ships[0],{x:0,z:0});Object.assign(n.ships[1],{x:8,z:0});Object.assign(n.ships[2],{x:-20,z:0});Object.assign(n.ships[3],{x:20,z:18});
  for(const f of __arena.combat.fighters){Object.assign(f,{shipId:f.team,navBridge:null,navJump:null,navHeight:0,navJumpReady:0,stunUntil:0,knockedUntil:0,action:'idle',timer:0,stamina:f.maxStamina,move:0});Object.assign(f,NavalSimulation.world(n.ships[f.shipId],f.id%2?1:-1,f.id%5-2));}
  Object.assign(n.player(),{x:2.1,z:0});__arena.setPaused(false);__arena.view.update(__arena.combat.time);
  for(let i=0;i<20;i++)ImportedGladiator.animate(__arena.combat.fighters[i],__arena.models[i],__arena.combat.time,1/60);
  document.getElementById('toast').style.transition='none';document.getElementById('toast').style.opacity='0';__arena.camera.position.set(13,8,-13);__arena.camera.lookAt(4,.6,0);__arena.renderer.render(__arena.scene,__arena.camera);
  window.__jumpFrames=(frames,run=true)=>{const render=__arena.renderer.render;__arena.renderer.render=()=>{};try{for(let i=0;i<frames;i++)__arena.step(1/60,run);}finally{__arena.renderer.render=render;}__arena.renderer.render(__arena.scene,__arena.camera);};
 });
 assert.equal(await page.locator('#navalJump').isVisible(),true);
 assert.equal(await page.evaluate(()=>__arena.view.landingMark.visible),true);
 await page.screenshot({path:out+'/jump-ready.png'});
 const jumpStamina=await page.evaluate(()=>__arena.naval.player().stamina);
 await page.locator('#navalJump').click();assert.ok(await page.evaluate(()=>!!__arena.naval.player().navJump));
 assert.equal(await page.evaluate(()=>__arena.naval.player().stamina),jumpStamina-20);
 await perspective('first');await page.evaluate(()=>__jumpFrames(27));
 const jumpApex=await page.evaluate(()=>{const f=__arena.naval.player(),m=__arena.models[0];return{height:f.navHeight,renderHeight:m.root.position.y,shadow:m.shadow.visible,ship:f.shipId,footHeight:m.bones.LeftFoot.getWorldPosition(new THREE.Vector3()).y,elapsed:f.navJump.elapsed};});
 assert.ok(jumpApex.height>1);assert.ok(Math.abs(jumpApex.renderHeight-jumpApex.height)<1e-8);assert.ok(jumpApex.footHeight>.8);assert.equal(jumpApex.shadow,false);assert.equal(jumpApex.ship,0);assert.ok(await page.evaluate(()=>__arena.camera.position.y)>2.5,'eye view rises with the jump');
 await page.evaluate(()=>{__arena.camera.position.set(12,6,-11);__arena.camera.lookAt(4,.9,0);__arena.renderer.render(__arena.scene,__arena.camera);});await page.screenshot({path:out+'/jump-airborne.png'});
 await page.evaluate(()=>{__arena.setPaused(true);__jumpFrames(10,false);});assert.equal(await page.evaluate(()=>__arena.naval.player().navJump.elapsed),jumpApex.elapsed,'pause freezes the airborne arc');
 await page.evaluate(()=>{__arena.setPaused(false);__jumpFrames(38);});
 assert.deepEqual(await page.evaluate(()=>({ship:__arena.naval.player().shipId,jump:__arena.naval.player().navJump,height:__arena.models[0].root.position.y})),{ship:1,jump:null,height:0});
 await page.screenshot({path:out+'/jump-landed.png'});
 await page.evaluate(()=>{__jumpFrames(30);__arena.setPaused(false);});await page.keyboard.press('Space');
 assert.equal(await page.evaluate(()=>__arena.naval.player().navJump?.to),0,'Space jumps back without triggering an attack');
 await page.evaluate(()=>__jumpFrames(65));assert.equal(await page.evaluate(()=>__arena.naval.player().shipId),0);
 await page.evaluate(()=>{const n=__arena.naval;Object.assign(n.player(),{x:2.1,z:0,action:'idle',stamina:100,navJumpReady:0});n.ships[1].x=14;__arena.setPaused(false);__arena.view.update(__arena.combat.time);});
 assert.equal(await page.locator('#navalJump').isVisible(),false,'the icon hides when the other deck is beyond reach');
 await page.evaluate(()=>{__arena.naval.ships[1].x=8;});await perspective('third');
 for(const [w,h] of [[667,375],[932,430],[1024,768]]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>{__arena.step(1/60);__arena.renderer.render(__arena.scene,__arena.camera);});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/naval-'+w+'.png'});
  assert.equal(await page.locator('#navalJump').isVisible(),true);
  const overlaps=await page.evaluate(()=>{const a=document.getElementById('navalJump').getBoundingClientRect();return ['navalHelm','stick','attack','block','dodge','special','hand','target'].filter(id=>{const b=document.getElementById(id).getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});});
  assert.deepEqual(overlaps,[],'jump control must not cover existing controls at '+w+'px');
  const teamOverlaps=await page.evaluate(()=>{const a=document.getElementById('teamScore').getBoundingClientRect();return ['navalHelm','navalJump','stick','attack','block','dodge','special','hand','target'].filter(id=>{const b=document.getElementById(id).getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});});assert.deepEqual(teamOverlaps,[],'bottom teams must not overlap controls at '+w+'px');
  await page.evaluate(()=>{__arena.naval.player().navJavelin=true;__arena.setPaused(false);__arena.view.update(__arena.combat.time);});
  const ciritOverlaps=await page.evaluate(()=>{const a=document.getElementById('navalJavelin').getBoundingClientRect();return ['navalHelm','navalJump','navalBridge','stick','attack','block','dodge','special','hand','target','teamScore'].filter(id=>{const b=document.getElementById(id).getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});});
  assert.deepEqual(ciritOverlaps,[],'cirit control must not overlap at '+w+'px');await page.evaluate(()=>{__arena.naval.player().navJavelin=false;});
 }

 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const equipped=await page.evaluate(()=>{
  const n=__arena.naval,p=n.player(),C=NavalSimulation.constants;n.ships[0].javelins=8;
  Object.assign(p,{shipId:0,x:C.rackX+.7,z:C.rackZ,action:'idle',stunUntil:0,navJavelin:false,navJump:null,navHeight:0,stamina:100});
  for(const f of __arena.combat.fighters.filter(f=>f.team===1))Object.assign(f,{x:8+(f.id%2),z:3});
  Object.assign(__arena.combat.fighters[5],{x:8,z:C.rackZ,action:'idle',blocking:false});__arena.combat.lockedTarget=5;
  __arena.setPaused(false);__jumpFrames(1);__arena.setPaused(false);__arena.view.update(__arena.combat.time);__arena.camera.position.set(5,4,-8);__arena.camera.lookAt(-1,1.1,-2);__arena.renderer.render(__arena.scene,__arena.camera);
  return{weapon:p.weapon,offhand:p.offhand,shield:p.shield,hp:__arena.combat.fighters[5].hp};
 });
 assert.equal(await page.locator('#navalJavelin').isEnabled(),true);await page.locator('#navalJavelin').click();
 assert.equal(await page.evaluate(()=>__arena.naval.player().navJavelin),true);await page.evaluate(()=>{__arena.view.update(__arena.combat.time);__arena.renderer.render(__arena.scene,__arena.camera);});
 assert.equal(await page.evaluate(()=>__arena.view.views[0].rackShafts.count),7);assert.equal(await page.evaluate(()=>__arena.view.heldJavelin.visible),true);
 await page.screenshot({path:out+'/javelin-ready.png'});
 await page.locator('#navalJavelin').click();await page.evaluate(()=>__jumpFrames(23));
 assert.equal(await page.evaluate(()=>__arena.naval.javelins.length),1);assert.equal(await page.evaluate(()=>[...__arena.view.javelinViews.values()].some(o=>o.visible)),true);
 const flightAge=await page.evaluate(()=>__arena.naval.javelins[0].age);await page.evaluate(()=>{__arena.setPaused(true);__jumpFrames(10,false);});assert.equal(await page.evaluate(()=>__arena.naval.javelins[0].age),flightAge);
 await page.evaluate(()=>{__arena.setPaused(false);__jumpFrames(55);});
 const afterThrow=await page.evaluate(()=>{const p=__arena.naval.player();return{weapon:p.weapon,offhand:p.offhand,shield:p.shield,hp:__arena.combat.fighters[5].hp,carried:p.navJavelin,projectiles:__arena.naval.javelins.length};});
 assert.ok(afterThrow.hp<equipped.hp,'visible cirit hits the target across the water');assert.equal(afterThrow.weapon,equipped.weapon);assert.equal(afterThrow.offhand,equipped.offhand);assert.equal(afterThrow.shield,equipped.shield);assert.equal(afterThrow.carried,false);assert.equal(afterThrow.projectiles,0);
 await page.evaluate(()=>{__arena.setPaused(false);const n=__arena.naval;Object.assign(n.player(),{x:NavalSimulation.constants.rackX+.7,z:NavalSimulation.constants.rackZ,action:'idle'});});await page.keyboard.press('KeyF');assert.equal(await page.evaluate(()=>__arena.naval.player().navJavelin),true);await page.keyboard.press('KeyQ');assert.equal(await page.evaluate(()=>__arena.naval.javelins.length),1);await page.evaluate(()=>__jumpFrames(100));
 await perspective('first');
 await page.evaluate(()=>{
  const n=__arena.naval;__arena.setPaused(false);Object.assign(n.player(),{x:2.1,z:0,stamina:100,navJumpReady:0});n.jump();__jumpFrames(20);
  __arena.combat.damage(__arena.combat.fighters[5],n.player(),100000);__jumpFrames(8);
 });
 const airborneFall=await page.evaluate(()=>{const f=__arena.naval.player(),m=__arena.models[0];return{hp:f.hp,jumping:!!f.navJump,offset:Math.hypot(m.root.position.x-f.x,m.root.position.z-f.z)};});
 assert.equal(await page.evaluate(()=>__arena.camera.fov),53,'death switches eye view to a spectator camera');assert.equal(await page.evaluate(()=>__arena.models[0].eyeView.enabled.value),0);assert.equal(airborneFall.hp,0);assert.equal(airborneFall.jumping,true);assert.ok(airborneFall.offset<1,'the cached death pose travels with the arc');
 await page.evaluate(()=>__jumpFrames(40));
 assert.equal(await page.evaluate(()=>{const f=__arena.naval.player(),m=__arena.models[0];return f.shipId===1&&!f.navJump&&NavalSimulation.onDeck(__arena.naval.ships[1],m.root.position,0);}),true,'the rendered corpse ends on the destination deck');
 await page.evaluate(()=>__arena.setPaused(true));assert.equal(await page.locator('#navalControls').isVisible(),false);
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>localStorage.setItem('ludus-camera-perspective','first'));
 // The remembered scene survives a same-device resume URL without its arena parameter.
 await page.goto(base+'/arena.html?battle='+battle,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__arena?.started,null,{timeout:60000});assert.equal(await page.evaluate(()=>__arena.naval.ships.length),4);await page.evaluate(()=>__arena.freeze());assert.equal(await page.evaluate(()=>__arena.cameraMode),'first');assert.equal(await page.inputValue('#cameraPerspective'),'first');
 fs.writeFileSync(out+'/report.json',JSON.stringify({initial,boatAsset,outfit,hudLayout,eyeView,boatRequests:boatRequests.length,errors,viewports:4,jumpApex,controls:'menu selection, server ticket, take/release, AI takeover, left/right helm, valid and invalid bridge, boarding, touch and Space jump, airborne pose, pause in flight, landing, range and control overlap, four open insignia sails, raised hulls, close camera, cirit rack stock, touch/F pickup, touch/Q throw, actual hit, original equipment, pause in flight, resume',note:'Chromium with software GPU. Not a physical phone FPS measurement.'},null,2));
 console.log(JSON.stringify({initial,boatAsset,errors,out}));await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exit(1);});
