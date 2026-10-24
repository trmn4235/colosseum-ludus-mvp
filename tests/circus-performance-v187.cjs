/* Full war race + cached sun and live shadows. All account requests are local fixtures. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(process.env.LUDUS_TEST_ROOT||path.join(__dirname,'..')),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/circus-performance-v187';fs.mkdirSync(out,{recursive:true});
const fixture=`var LudusClient={create(){const teams=structuredClone(CircusRoster),owner='test-owner';window.warFixture={user_id:owner,name:'Aquila Ludus',roster:[{id:'g1',name:'Aulus Varro',class:'murmillo',ready:true},{id:'g2',name:'Cassius Nero',class:'retiarius',ready:true},{id:'g3',name:'Titus',class:'thraex',ready:false}],horses:teams[0].horses.map((h,i)=>({...h,id:'h'+i,eligible:true}))};window.warCalls=[];return{auth:{getUser:async()=>({data:{user:{id:owner,user_metadata:{}}}})},rpc:async(name,args={})=>{if(name==='ludus_circus_war_roster'){warCalls.push(args);if(window.rejectWarStart&&args.p_gladiators)return{error:{message:'Gladyatörün müsabakaya hazır değil.'}};return{data:structuredClone(warFixture)};}return{data:{user_id:owner,server_now:new Date().toISOString(),gold:1000,horses:warFixture.horses,history:{items:[]},heat:{id:'normal-race',teams,status:'open',entered:false,selected:null,stake:0,payout:0,started_at:null,durations:null,winner:null}}};}}}};`;
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream');let body=fs.readFileSync(f);if(f.endsWith('/circus-maximus-v147.js'))body=body.toString().replace('function render(now=performance.now()) {','function render(now=performance.now()) {if(window.testManualFrames)return;');res.end(body);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader Error|WebGLProgram|VALIDATE_STATUS|Error linking/.test(m.text()))errors.push(m.text());});await page.route('**/ludus-client-v84.js*',r=>r.fulfill({contentType:'text/javascript',body:fixture}));
try{
 await page.route(/^https:/,r=>r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/circus-maximus.html?preview=1');await page.waitForFunction(()=>window.CircusPreview?.ready);
 await page.evaluate(()=>{const p=CircusPreview;p.renderer.setPixelRatio(1.25);window.realRender=p.renderer.render.bind(p.renderer);p.renderer.render=()=>{};});
 await page.evaluate(()=>CircusPreview.startVisit());await page.waitForFunction(()=>CircusPreview.visit?.active);await page.evaluate(()=>CircusPreview.visit.war.open());await page.waitForSelector('#war-fighter0');await page.locator('#warStart').click();await page.waitForFunction(()=>CircusPreview.visit.war.active);
 const metrics=await page.evaluate(()=>{
  const p=CircusPreview,w=p.visit.war,s=w.state,r=p.renderer;window.testManualFrames=true;w.pause();document.querySelector('#warPausePanel').close();
  Object.assign(s,CircusWarCore.initial(s.teams,187));for(const t of s.teams)t.nextShot=1e9;for(let k=0;k<520;k++)CircusWarCore.step(s);w.update(0);
  r.info.autoReset=false;
  function sample(shadow){r.shadowMap.needsUpdate=shadow;r.info.reset();realRender(p.scene,p.camera);return{...r.info.render};}
  sample(true);const color=sample(false),shadow=sample(true);
  const pose=()=>w.view.crews.flat().flatMap(m=>['Head','RightHand','LeftHand','RightFoot','LeftFoot'].flatMap(n=>m.bones[n].matrixWorld.elements.slice()));
  ArenaRuntime.matrixCache.enabled=false;w.view.update(s,0,p.camera);w.view.update(s,0,p.camera);const old=pose();
  ArenaRuntime.matrixCache.enabled=true;w.view.update(s,0,p.camera);const current=pose();
  const poseError=Math.max(...current.map((v,i)=>Math.abs(v-old[i]))),clocks=[];
  for(const fps of [10,15,30,60,120]){
   w.pause();document.querySelector('#warContinue').click();const before=s.time;
   for(let i=0;i<fps*2;i++)w.update(1/fps);clocks.push({fps,seconds:s.time-before});
  }
  w.pause();const before=s.tick;for(let i=0;i<60;i++)w.update(1/60);const pausedTicks=s.tick-before;
  const basketMeshes=w.view.baskets.map(b=>{let n=0;b.traverse(o=>{if(o.isMesh)n++;});return n;});
  return{color,shadow,poseError,clocks,pausedTicks,basketMeshes};
 });
 assert.deepEqual(errors,[]);assert.ok(metrics.color.triangles<1100000,JSON.stringify(metrics));assert.ok(metrics.shadow.triangles<1800000,JSON.stringify(metrics));assert.ok(metrics.shadow.calls<400,JSON.stringify(metrics));
 assert.ok(metrics.poseError<1e-8,JSON.stringify(metrics));assert.equal(metrics.pausedTicks,0);assert.ok(metrics.basketMeshes.every(n=>n<=20));for(const c of metrics.clocks)assert.ok(Math.abs(c.seconds-2)<1e-8,JSON.stringify(c));
 console.log(JSON.stringify({metrics,errors}));
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
