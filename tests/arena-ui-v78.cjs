/* Real pages/assets with isolated account fixtures; never creates a production battle. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'),exercise=require('../gladiator-exercise-v46.js');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/arena-ui-v78',owner='00000000-0000-4000-8000-000000000001',battle='00000000-0000-4000-8000-000000000078';
const fighters=Object.keys(exercise.profiles).map((type,i)=>({id:'g'+i,name:i?'Gladyatör '+i:'Cassius',class:type,owner_id:owner,overall:50,level:1,status:'available',session:null,stat_version:46,base_stats:exercise.profile(type),fatigue_value:0,exercise_units:0}));
const receipt={gold:100,diamonds:1,stone:{name:'Safir II'},kind:'legs',ludus_exp:100,extracted:Array.from({length:6},()=>({}))};
const fixture=`const fixtureUser={id:${JSON.stringify(owner)},is_anonymous:false,user_metadata:{}},fixtureFighters=${JSON.stringify(fighters)};window.__receipt=${JSON.stringify(receipt)};window.__finishCalls=[];
window.__fixtureClient={auth:{getUser:async()=>({data:{user:fixtureUser}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})},from:name=>{const value=name==='ludus_accounts'?{user_id:fixtureUser.id,ludus_name:'Tırman',gold:3760,diamonds:1}:name==='ludus_gladiators'?fixtureFighters:name==='ludus_battles'?{id:${JSON.stringify(battle)},owner_id:fixtureUser.id,mode:'solo20',rule_version:2,snapshot:{gladiator:{...fixtureFighters[0],combat_morale:90,combat_stamina_bonus:12},items:[]},loot:[]}:[];const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value}),then:(r,j)=>Promise.resolve({data:value}).then(r,j)};return b;},rpc:async(name,args)=>{if(name.startsWith('ludus_finish_battle')){__finishCalls.push({name,args});await new Promise(r=>setTimeout(r,700));return{data:__receipt};}return{data:name==='ludus_clan'||name==='ludus_clan_vault'?{server_now:new Date().toISOString(),clan:null,gladiators:fixtureFighters}:name==='ludus_progress'?{level:3,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_imperial'?{server_now:new Date().toISOString(),missions:[],assignments:[],gladiators:fixtureFighters,is_admin:false,today:'2026-10-11'}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:{server_now:new Date().toISOString(),gladiators:fixtureFighters}};}};`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
let cleanup=async()=>{};
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const filename=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!filename.startsWith(root+'/')||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404).end();return;}let body=fs.readFileSync(filename);
  if(filename.endsWith('/arena.html'))body=Buffer.from(body.toString().replace('var LudusBattle=(function(){',fixture+'\nsupabase.createClient=()=>window.__fixtureClient;var LudusBattle=(function(){').replace('mainMenu();Promise.all([ticketReady',"window.__arena={combat,renderer,scene,camera,showResult,hud,saveReward,freeze:()=>{paused=true;},get started(){return started;}};mainMenu();Promise.all([ticketReady"));
  if(filename.endsWith('/ludus.html'))body=Buffer.from(body.toString().replace('const accountClient=supabase.createClient','let accountClient=supabase.createClient').replace('const accountReady=(async()=>{',fixture+'\nconst accountReady=(async()=>{accountClient=window.__fixtureClient;').replace('function frame(now){requestAnimationFrame(frame);','function frame(now){requestAnimationFrame(frame);if(window.__freezeFrame)return;'));
  res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'}).end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});cleanup=async()=>{await browser.close();await new Promise(r=>server.close(r));};
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:2});await context.route('https://**',r=>r.abort());
 const arena=await context.newPage(),errors=[];arena.on('pageerror',e=>errors.push(e.message));
 await arena.goto(base+'/arena.html?battle='+battle);await arena.waitForFunction(()=>window.__arena?.started&&__arena.combat.time>.05,null,{timeout:60000});
 await arena.evaluate(()=>__arena.freeze());assert.equal(await arena.evaluate(()=>__arena.renderer.getPixelRatio()),1.25);
 const hud=await arena.locator('.vitals').boundingBox(),icon=await arena.locator('.vital-icon').first().boundingBox();assert.equal(Math.round(icon.width),20);assert.ok(icon.x>=0&&icon.x<8);assert.ok(hud.x<25);
 await arena.screenshot({path:out+'/hud-844.png'});
 await arena.evaluate(()=>{Object.assign(__arena.combat,{result:'win',time:245});Object.assign(__arena.combat.stats,{hits:50,damage:572,damageTaken:86,kills:7,blocks:12,dodges:5,parries:2});__arena.showResult();});
 assert.equal(await arena.locator('#resultRewards .result-reward-row').count(),0,'no awards before acknowledgement');
 await arena.waitForFunction(()=>document.querySelectorAll('.result-reward-row').length===6);assert.match(await arena.locator('#resultRewards').innerText(),/Safir II/);assert.match(await arena.locator('#resultStats').innerText(),/Alınan hasar\s+86/);assert.equal(await arena.locator('#resultRank').innerText(),'1 / 20');
 const renderBefore=await arena.evaluate(()=>__arena.renderer.info.render.frame);await arena.waitForTimeout(250);assert.equal(await arena.evaluate(()=>__arena.renderer.info.render.frame),renderBefore,'finished battle stops rendering WebGL');
 for(const [width,height]of [[568,320],[667,375],[844,390],[1536,706]]){
  await arena.setViewportSize({width,height});
  for(const selector of ['#resultTitle','.result-rewards','.result-summary','#again','#resultMenu']){const b=await arena.locator(selector).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+.5&&b.y+b.height<=height+.5,selector+' '+width);}
  const overlap=await arena.locator('#resultStats').evaluate(n=>n.scrollHeight>n.clientHeight+1);assert.equal(overlap,false,'stats fit '+width);
  if(width>=844)assert.equal(await arena.locator('#resultRewards').evaluate(n=>n.scrollHeight>n.clientHeight+1),false,'acknowledged rewards fit '+width);
  await arena.screenshot({path:out+'/result-'+width+'.png'});
 }
 assert.equal(await arena.evaluate(()=>__finishCalls.length),1,'resize does not resubmit rewards');
 await arena.evaluate(()=>{Object.assign(__arena.combat,{result:'loss'});__arena.combat.stats.placement=9;ArenaBattleResult.show(document,__arena.combat);ArenaBattleResult.rewards(document,{gold:0,diamonds:0});});assert.equal(await arena.locator('#resultRank').innerText(),'9 / 20');assert.match(await arena.locator('#resultRewards').innerText(),/ödül kazanılmadı/);
 const ludus=await context.newPage();ludus.on('pageerror',e=>errors.push(e.message));let releaseOffice;const officeGate=new Promise(r=>releaseOffice=r);
 await ludus.route('**/*office*.glb*',async route=>{await officeGate;await route.continue();});await ludus.route('**/imperial-desk-v31.glb*',async route=>{await officeGate;await route.continue();});
 await ludus.goto(base+'/ludus.html');await ludus.waitForFunction(()=>window.LudusPreview?.exploring&&LudusPreview.roster.every(g=>g.model),null,{timeout:60000});
 assert.ok(await ludus.evaluate(()=>LudusPreview.roster.every(g=>g.home.z===2.4)),'V79 resident row stands two metres farther from balcony');
 await ludus.evaluate(()=>{const w=LudusPreview;window.__freezeFrame=true;Object.assign(w.player,{x:0,y:3.47,z:8.3,yaw:0,pitch:-.60});for(const g of w.roster){g.path=[];g.body.position.set(g.home.x,0,g.home.z);}w.updateResidents(1/60);w.followOwner(.05,false);w.renderer.render(w.scene,w.camera);});
 await ludus.screenshot({path:out+'/balcony-v79-844.png'});await ludus.evaluate(()=>window.__freezeFrame=false);
 await ludus.evaluate(()=>LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind==='office')));assert.equal(await ludus.evaluate(()=>LudusPreview.roomProps.children.length),0,'no former table or carpet while approved office models load');releaseOffice();await ludus.waitForFunction(()=>LudusPreview.roomColliders.some(c=>c.kind==='desk'),null,{timeout:60000});
 await ludus.evaluate(()=>{const w=LudusPreview;window.__freezeFrame=true;w.leaveRoom();w.enterRoom(w.rooms.find(r=>r.kind==='rest'));w.camera.position.set(0,4.3,4.3);w.camera.lookAt(0,1.4,-1.6);w.camera.updateMatrixWorld();w.ownerAvatar.root.visible=false;w.renderer.render(w.roomScene,w.camera);});
 const rest=await ludus.evaluate(()=>{const w=LudusPreview,g=w.roomProps.getObjectByName('Dinlenme · Kahverengi yer yatakları'),m=g.getObjectByName('Duvar meşalesi sapları'),v=new THREE.Matrix4();return{count:g.userData.counts,torches:w.restRoom.layout.torches,positions:Array.from({length:m.count},(_,i)=>{m.getMatrixAt(i,v);return new THREE.Vector3().setFromMatrixPosition(v).toArray();}),floorObstacles:w.roomColliders.filter(c=>c.kind==='rest-torch').length};});
 assert.equal(rest.count.torches,4);assert.deepEqual(rest.torches.map(t=>t.wall),['back','front','left','right']);assert.ok(rest.positions.every(p=>p[1]>2&&Math.abs(p[0])>4||p[1]>2&&Math.abs(p[2])>4));assert.equal(rest.floorObstacles,0);
 await ludus.screenshot({path:out+'/rest-844.png'});
 await ludus.evaluate(()=>{LudusPreview.leaveRoom();LudusPreview.updateActivities(0);});assert.ok(await ludus.evaluate(()=>LudusPreview.roster.every(g=>g.home.z===2.4&&g.body.parent===LudusPreview.scene)),'returning residents keep the shifted home row');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({viewports:4,receiptBeforeRewards:true,realArena:true,smallerHud:true,mobileDpr:1.25,noOldOffice:true,wallTorches:4,residentOffsetMetres:2,restReturn:true,out}));await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exitCode=1;});
