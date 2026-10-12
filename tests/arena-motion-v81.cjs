/* Real pages/assets with isolated account fixtures; never creates a production battle. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'),exercise=require('../gladiator-exercise-v46.js');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/arena-motion-v81',owner='00000000-0000-4000-8000-000000000001',battle='00000000-0000-4000-8000-000000000078';
const fighters=Object.keys(exercise.profiles).map((type,i)=>({id:'g'+i,name:i?'Gladyatör '+i:'Cassius',class:type,owner_id:owner,overall:50,level:1,status:'available',session:null,stat_version:46,base_stats:exercise.profile(type),fatigue_value:0,exercise_units:0}));
const receipt={gold:100,diamonds:1,stone:{name:'Safir II'},kind:'legs',ludus_exp:100,extracted:Array.from({length:6},()=>({}))};
const fixture=`const fixtureUser={id:${JSON.stringify(owner)},is_anonymous:false,user_metadata:{}},fixtureFighters=${JSON.stringify(fighters)};window.__receipt=${JSON.stringify(receipt)};window.__finishCalls=[];
window.__fixtureClient={auth:{getUser:async()=>({data:{user:fixtureUser}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})},from:name=>{const value=name==='ludus_accounts'?{user_id:fixtureUser.id,ludus_name:'Tırman',gold:3760,diamonds:1}:name==='ludus_gladiators'?fixtureFighters:name==='ludus_battles'?{id:${JSON.stringify(battle)},owner_id:fixtureUser.id,mode:'solo20',rule_version:2,snapshot:{gladiator:{...fixtureFighters[0],combat_morale:90,combat_stamina_bonus:12},items:[]},loot:[]}:[];const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value}),then:(r,j)=>Promise.resolve({data:value}).then(r,j)};return b;},rpc:async(name,args)=>{if(name.startsWith('ludus_finish_battle')){__finishCalls.push({name,args});await new Promise(r=>setTimeout(r,700));return{data:__receipt};}return{data:name==='ludus_clan'||name==='ludus_clan_vault'?{server_now:new Date().toISOString(),clan:null,gladiators:fixtureFighters}:name==='ludus_progress'?{level:3,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_imperial'?{server_now:new Date().toISOString(),missions:[],assignments:[],gladiators:fixtureFighters,is_admin:false,today:'2026-10-11'}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:{server_now:new Date().toISOString(),gladiators:fixtureFighters}};}};`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
let cleanup=async()=>{};
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const filename=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!filename.startsWith(root+'/')||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404).end();return;}let body=fs.readFileSync(filename);
  if(filename.endsWith('/arena.html'))body=Buffer.from(body.toString().replace('function frame(now){const cpuStart', 'function frame(now){if(window.__freezeFrame)return;const cpuStart').replace('var LudusBattle=(function(){',fixture+'\nLudusClient.create=()=>window.__fixtureClient;var LudusBattle=(function(){').replace('mainMenu();Promise.all([LudusBattle.load()',"window.__arena={combat,renderer,scene,camera,showResult,hud,saveReward,freeze:()=>{paused=true;window.__freezeFrame=true;},get started(){return started;}};mainMenu();Promise.all([LudusBattle.load()"));
  if(filename.endsWith('/ludus.html'))body=Buffer.from(body.toString().replace('const accountClient=supabase.createClient','let accountClient=supabase.createClient').replace('const accountReady=(async()=>{',fixture+'\nconst accountReady=(async()=>{accountClient=window.__fixtureClient;').replace('function frame(now){requestAnimationFrame(frame);','function frame(now){requestAnimationFrame(frame);if(window.__freezeFrame)return;'));
  res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'}).end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});cleanup=async()=>{await browser.close();await new Promise(r=>server.close(r));};
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:2});await context.route('https://**',r=>r.abort());
 const arena=await context.newPage(),errors=[];arena.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message)});
 await arena.goto(base+'/arena.html?battle='+battle);await arena.waitForFunction(()=>window.__arena?.started&&__arena.combat.time>.05,null,{timeout:30000}).catch(async e=>{console.error(await arena.evaluate(()=>({url:location.href,arena:!!window.__arena,text:document.body.innerText.slice(-1800)})));throw e});
 await arena.evaluate(()=>__arena.freeze());assert.equal(await arena.evaluate(()=>__arena.renderer.getPixelRatio()),1.25);
 const hud=await arena.locator('.vitals').boundingBox(),icon=await arena.locator('.vital-icon').first().boundingBox();assert.equal(Math.round(icon.width),20);assert.ok(icon.x>=0&&icon.x<8);assert.ok(hud.x<25);
 await arena.screenshot({path:out+'/hud-844.png'});
 if(process.env.LUDUS_MOTION_PREVIEW){
  await arena.evaluate(()=>{
   const T=THREE,scene=new T.Scene();scene.background=new T.Color('#ded8c9');scene.add(new T.HemisphereLight(0xffffff,0x7c6547,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(2,5,3);scene.add(light);
   const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0xb8a78d,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);scene.add(new T.GridHelper(100,100,0x837766,0x9b8a73));
   const camera=new T.PerspectiveCamera(36,1.5,.1,120),model=ImportedGladiator.create(100,'murmillo'),fighter=new ArenaCombat().reset('normal','murmillo').fighters[0];scene.add(model.root);fighter.x=0;fighter.z=0;fighter.angle=0;fighter.move=1;fighter.action='idle';__arena.renderer.setPixelRatio(1);__arena.renderer.setSize(600,400,false);
   window.__motionLab={scene,camera,model,fighter,time:0};
  });
  for(const [name,speed] of [['walk',1.35],['jog',3.28],['run',4.2]]){
   for(let i=0;i<60;i++){
    const png=await arena.evaluate(({speed})=>{const l=__motionLab;for(let k=0;k<2;k++){l.time+=1/60;l.fighter.z+=speed/60;ImportedGladiator.animate(l.fighter,l.model,l.time,1/60)}l.camera.position.set(3.6,1.65,l.fighter.z+2.3);l.camera.lookAt(0,1.05,l.fighter.z);__arena.renderer.render(l.scene,l.camera);return __arena.renderer.domElement.toDataURL('image/png').split(',')[1]},{speed});
    fs.writeFileSync(out+'/'+name+'-'+String(i).padStart(3,'0')+'.png',Buffer.from(png,'base64'));
   }
  }
 }
 const cadence=await arena.evaluate(()=>[30,60].map(fps=>{
  const m=ImportedGladiator.create(200+fps,'murmillo'),f=new ArenaCombat().reset('normal','murmillo').fighters[0];f.x=0;f.z=0;f.angle=0;f.move=1;f.action='idle';ImportedGladiator.animate(f,m,0,1/fps);
  for(let i=1;i<=fps*2;i++){f.z+=2.8/fps;ImportedGladiator.animate(f,m,i/fps,1/fps)}const phase=m.locomotionPhase;
  f.move=0;for(let i=0;i<fps;i++)ImportedGladiator.animate(f,m,2+i/fps,1/fps);const stopped=m.locomotionClip===null&&m.locomotionPhase===phase;
  f.move=1;f.z+=100;ImportedGladiator.animate(f,m,4,1/fps);const teleport=m.locomotionClip===null;
  ImportedGladiator.dispose(m);return {fps,phase,stopped,teleport};
 }));assert.ok(Math.abs(cadence[0].phase-cadence[1].phase)<.002,'cadence follows distance at 30 and 60 FPS');assert.ok(cadence.every(x=>x.stopped&&x.teleport));console.log(JSON.stringify({cadence}));
 const poses=await arena.evaluate(()=>{
 const m=ImportedGladiator.create(101,'murmillo'),f=new ArenaCombat().reset('normal','murmillo').fighters[0];__arena.scene.add(m.root);f.x=0;f.z=0;f.move=1;f.action='idle';let result=[];
 for(const speed of [1,3,6]){m.locomotionSpeed=speed;for(let i=0;i<60;i++){f.z+=speed/60;ImportedGladiator.animate(f,m,i/60,1/60);}const feet=['Left','Right'].map(side=>m.root.worldToLocal(m.bones[side+'Foot'].getWorldPosition(new THREE.Vector3())).y);result.push({speed,clip:m.locomotionClip,phase:m.locomotionPhase,feet,foot:m.bones.LeftFoot.getWorldPosition(new THREE.Vector3()).toArray()});__arena.camera.position.set(3,2.3,f.z+4);__arena.camera.lookAt(0,1,f.z);__arena.renderer.render(__arena.scene,__arena.camera);}
 f.action='attack';f.timer=.1;ImportedGladiator.animate(f,m,2,1/60);result.push({attackClip:m.locomotionClip});return result;
 });assert.deepEqual(poses.slice(0,3).map(p=>p.clip),['walk','jog','run']);assert.equal(poses[3].attackClip,null);assert.ok(poses.slice(0,3).every(p=>p.foot.every(Number.isFinite)));assert.ok(poses.slice(0,3).every(p=>Math.min(...p.feet)>=0&&Math.min(...p.feet)<.15),'stance foot stays near sand');await arena.screenshot({path:out+'/motion-v81.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify({poses,out}));await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exit(1)});
