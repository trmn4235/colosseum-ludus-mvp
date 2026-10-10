'use strict';
// Isolated, loopback-only UI/motion QA. The served HTML alone gets an account stub
// and inspection hooks. Production files and live accounts are never changed.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/arena-presentation-v65');
const baselineRef = process.env.ARENA_BASELINE_REF || 'a6f530d';
const mode = process.argv[2] || 'both';
const ticket = {id:'00000000-0000-4000-8000-000000000065',mode:'solo20',snapshot:{gladiator:{id:'qa65',class:'secutor',name:'Motion QA',overall:50},items:[]}};
fs.mkdirSync(out,{recursive:true});
const sources = {baseline:execFileSync('git',['show',baselineRef+':arena.html'],{cwd:root,maxBuffer:5e6}).toString()};
function fixture(source,rigOnly=false) {
 if(rigOnly){const marker='let renderer;try{renderer=ArenaCreateRenderer';const stub=`window.__qaNoGPU=true;THREE.WebGLRenderer=class {constructor(o){this.domElement=o.canvas;this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>1};this.info={render:{calls:0,triangles:0}};this.dpr=1;}setPixelRatio(v){this.dpr=v;}getPixelRatio(){return this.dpr;}setSize(w,h){this.domElement.width=w;this.domElement.height=h;}render(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld();}dispose(){}forceContextLoss(){}setAnimationLoop(){}getContext(){return {VERSION:'VERSION',RENDERER:'RENDERER',getExtension:()=>null,getParameter:()=> 'NO GPU: skeleton and DOM only'};}};`;
 assert.ok(source.includes(marker));source=source.replace(marker,stub+marker);
 }

 const a=source.indexOf('var LudusBattle='), b=source.indexOf('/* Poly Haven',a);
 assert.ok(a>0 && b>a,'account code fixture anchor exists');
 source=source.slice(0,a)+`var LudusBattle={ticket:${JSON.stringify(ticket)},load:async()=>({}),stage:()=>{},finish:async()=>({})};\n`+source.slice(b);
 source=source.replaceAll('requestAnimationFrame(frame)','(window.__qaManual?0:requestAnimationFrame(frame))');
 const marker='mainMenu();Promise.all([LudusBattle.load()';
 assert.ok(source.includes(marker),'private inspection hook anchor exists');
 return source.replace(marker,`window.__arena={combat,models,renderer,scene,camera,perfMeter,worldInput,clearInput,setPaused,animateCharacter,frame,strike,resize,active,get controls(){return touchControls;},get paused(){return paused;},set joy(v){joy=v;},set cameraYaw(v){cameraYaw=v;},set last(v){last=v;},set accumulator(v){accumulator=v;}};`+marker);
}
const requests=[],servedSources={};
const {createHash}=require('node:crypto');
const {compact}=require('./summarize-arena-presentation-v65.cjs');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local'),variant=url.pathname.startsWith('/baseline/')?'baseline':'after';
 if(url.pathname==='/qa-result'&&req.method==='POST'){let body='';req.on('data',b=>body+=b);req.on('end',()=>{try{const data=JSON.parse(body),variant=data.variant;Object.assign(data.report,servedSources[variant]||{});assert.ok(['baseline','after'].includes(variant));for(const shot of data.report.snapshots||[]){fs.writeFileSync(path.join(out,variant+'-'+shot.name+'.png'),Buffer.from(shot.data.split(',')[1],'base64'));delete shot.data;}if(process.env.ARENA_KEEP_RAW==='1')fs.writeFileSync(path.join(out,variant+'-raw.json'),JSON.stringify(data.report));data.report=compact(data.report);fs.writeFileSync(path.join(out,variant+'-report.json'),JSON.stringify(data.report,null,2));console.log(variant+': cloud browser '+JSON.stringify({pass:data.report.pass,error:data.report.error,cpu:data.report.animationCpuMsPerPose,frame:data.report.frameTiming}));sheets().catch(console.error);res.end('saved');}catch(e){res.writeHead(400);res.end(e.message);}});return;}
 if(url.pathname==='/qa'){const v=url.searchParams.get('variant')==='after'?'after':'baseline',rigOnly=url.searchParams.has('rigonly');res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"connect-src 'self'; object-src 'none'"});return res.end(`<html><head><title>Arena isolated ${v} QA</title><style>body{margin:0;background:#15201e;color:#f1e4cb;font:14px Arial}h1{font-size:18px;padding:12px}#gallery{display:grid;grid-template-columns:repeat(3,1fr)}figure{margin:3px}img{width:100%}pre{white-space:pre-wrap;padding:12px}iframe{border:0}</style></head><body><h1 id=state>Running ${v}: real local assets, no account</h1><iframe id=arena width=844 height=390 src=/${v}/arena.html?selftest=1${rigOnly?'&rigonly=1':''}></iframe><div id=gallery></div><pre id=summary></pre><script>addEventListener('message',async e=>{if(e.origin!==location.origin)return;if(e.data.type==='qa-size'){arena.width=e.data.width;arena.height=e.data.height;setTimeout(()=>e.source.postMessage({type:'qa-sized'},location.origin),50);}if(e.data.type==='qa-result'){const r=e.data.report;state.textContent='${v}: '+(r.pass?'PASS':'FAIL');for(const s of r.snapshots){const f=document.createElement('figure'),i=document.createElement('img'),c=document.createElement('figcaption');i.src=s.data;c.textContent=s.name;f.append(c,i);gallery.append(f);}summary.textContent=JSON.stringify({pass:r.pass,error:r.error,renderer:r.renderer,cpu:r.animationCpuMsPerPose,frame:r.noGPU?null:r.frameTiming,nonGraphicsOnly:!!r.noGPU,viewports:r.layouts?.length,pause:r.pause},null,2);arena.style.display='none';await fetch('/qa-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({variant:'${v}',report:r})});}});</script></body></html>`);}
 const pathname=url.pathname.replace(/^\/(baseline|after)\//,'/');
 const file=path.resolve(root,'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
 requests.push({variant,path:pathname});
 let data=fs.readFileSync(file);
 if(file.endsWith('/arena.html')){const src=variant==='baseline'?sources.baseline:data.toString();servedSources[variant]={sourceSha256:createHash('sha256').update(src).digest('hex'),motionSha256:variant==='after'?createHash('sha256').update(fs.readFileSync(path.join(root,'arena-presentation-v65.js'))).digest('hex'):null,baselineRef,fixtureServedAt:new Date().toISOString()};data=Buffer.from(fixture(src,url.searchParams.has('rigonly'))+(url.searchParams.has('selftest')?'<script src="/tests/arena-presentation-browser-v65.js"></script>':''));}
 const ext=path.extname(file),type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png'}[ext]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"connect-src 'self' blob: data:; object-src 'none'"});res.end(data);
});
const stat=xs=>{const a=xs.slice().sort((a,b)=>a-b);return {count:a.length,mean:a.reduce((s,x)=>s+x,0)/Math.max(1,a.length),p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]||0,max:a.at(-1)||0,min:a[0]||0};};
async function init(browser,variant){
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:1});
 const errors=[],external=[],failed=[];
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.protocol==='http:'&&url.hostname==='127.0.0.1')return route.continue();external.push(url.origin+url.pathname);return route.abort('blockedbyclient');});
 await context.addInitScript(()=>{let seed=6500;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
 await page.goto(`http://127.0.0.1:${server.address().port}/${variant}/arena.html`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__arena?.models.length===20&&document.getElementById('intro').hidden,{timeout:120000});
 await page.evaluate(()=>{window.__qaManual=true;});
 await page.waitForTimeout(250);
 return {context,page,errors,external,failed};
}
async function run(browser,variant){
 console.log(variant+': loading real models');
 const {context,page,errors,external,failed}=await init(browser,variant);
 try{
 const loaded=await page.evaluate(()=>({models:__arena.models.length,rigBones:Object.keys(__arena.models[0].bones).length,imported:__arena.models.every(m=>m.imported),renderer:__arena.renderer.getContext().getParameter(__arena.renderer.getContext().VERSION)}));
 assert.equal(loaded.models,20);assert.ok(loaded.rigBones>30);assert.ok(loaded.imported);
 console.log(variant+': models ready');
 if(process.env.ARENA_QA_SMOKE){await page.screenshot({path:path.join(out,variant+'-smoke.png')});console.log(loaded);return;}
 // A deterministic, real-rig preview: same camera, lighting, equipment and world.
 await page.evaluate(()=>{
  const q=__arena,c=q.combat,f=c.fighters[0],m=q.models[0];window.__qaFighter=JSON.parse(JSON.stringify(f));
  for(const model of q.models)model.root.visible=false;m.root.visible=true;
  Object.assign(f,{x:0,z:0,angle:0,hp:120,maxHp:120,stamina:100,action:'idle',timer:0,move:0,walk:0,weapon:'gladius',offhand:null,shield:true,shieldHeldBy:null,guardFlash:0,reaction:0,flash:0,absoluteBlockUntil:0,blocking:false,nettedUntil:0,cooldown:0});
  q.camera.position.set(3.5,2.7,5.4);q.camera.lookAt(0,1.1,0);q.camera.updateMatrixWorld();
  document.getElementById('hud').style.visibility='hidden';document.getElementById('controls').style.visibility='hidden';document.getElementById('enemyLabels').style.visibility='hidden';document.getElementById('toast').style.visibility='hidden';
  q.renderer.shadowMap.enabled=false;
  window.__qaPose=(dt=1/60)=>{q.animateCharacter(f,m,c.time,dt);m.root.updateMatrixWorld(true);};
  window.__qaMeasure=()=>{
   const pos=o=>o.getWorldPosition(new THREE.Vector3()).toArray(),rot=o=>o.getWorldQuaternion(new THREE.Quaternion()).toArray();
   const sample=f.action==='attack'?ArenaMotion.sample(f):null,anchor=f.attackLeft?m.offhandAnchor:m.weaponAnchor;
   const rootQ=m.root.getWorldQuaternion(new THREE.Quaternion()),dir=new THREE.Vector3(0,1,0).applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion()));
   const expected=sample?new THREE.Vector3(sample.dir.x,sample.dir.y,sample.dir.z).applyQuaternion(rootQ):null;
   return {time:c.time,sim:[f.x,f.z],root:pos(m.root),body:pos(m.body),leftHand:pos(m.bones.LeftHand),rightHand:pos(m.bones.RightHand),leftFoot:pos(m.bones.LeftFoot),rightFoot:pos(m.bones.RightFoot),shield:pos(m.gear.shield.anchor),shieldRotation:rot(m.gear.shield.anchor),weapon:pos(anchor),bladeAngle:expected?dir.angleTo(expected):null,gripOffset:sample?anchor.getWorldPosition(new THREE.Vector3()).distanceTo((f.attackLeft?m.bones.LeftHand:m.bones.RightHand).getWorldPosition(new THREE.Vector3())):null};
  };
  for(let i=0;i<90;i++){c.time+=1/60;__qaPose();}q.renderer.render(q.scene,q.camera);
 });
 const screenshots=[];
 async function snap(name){
  await page.evaluate(()=>__arena.renderer.render(__arena.scene,__arena.camera));
  const filename=variant+'-'+name+'.png';await page.locator('#scene').screenshot({path:path.join(out,filename)});screenshots.push({phase:name,file:filename});
 }
 await snap('idle');
 const motion=await page.evaluate(()=>{
  const q=__arena,f=q.combat.fighters[0],dt=1/60,segments={};
  function step(){q.combat.time+=dt;__qaPose(dt);return __qaMeasure();}
  for(const [name,speed,count] of [['walk',1.45,60],['run',3.7,60],['stop',0,30]]){
   const samples=[];for(let i=0;i<count;i++){f.move=speed?1:0;f.z+=speed*dt;f.walk+=speed*dt*4;samples.push(step());}segments[name]=samples;
  }
  f.x=0;f.z=0;f.move=0;for(let i=0;i<90;i++)step();
  segments.guardEnter=[];f.blocking=true;f.guardRegion='head';for(let i=0;i<18;i++)segments.guardEnter.push(step());
  segments.guardRelease=[];f.blocking=false;f.guardRegion=null;for(let i=0;i<24;i++)segments.guardRelease.push(step());
  return segments;
 });
 // Screenshot pairs at fixed motion times; movement is retained but camera follows root.
 for(const [name,speed] of [['walk',1.45],['run',3.7]]){
  await page.evaluate(({speed})=>{const q=__arena,f=q.combat.fighters[0];Object.assign(f,{x:0,z:0,move:1,action:'idle',blocking:false});for(let i=0;i<24;i++){f.z+=speed/60;f.walk+=speed/60*4;q.combat.time+=1/60;__qaPose();}q.camera.position.set(3.5,2.7,5.4+f.z);q.camera.lookAt(0,1.1,f.z);},{speed});await snap(name+'-contact');
  await page.evaluate(({speed})=>{const q=__arena,f=q.combat.fighters[0];for(let i=0;i<9;i++){f.z+=speed/60;f.walk+=speed/60*4;q.combat.time+=1/60;__qaPose();}q.camera.position.set(3.5,2.7,5.4+f.z);q.camera.lookAt(0,1.1,f.z);},{speed});await snap(name+'-passing');
 }
 await page.evaluate(()=>{const q=__arena,f=q.combat.fighters[0];Object.assign(f,{x:0,z:0,move:0,action:'idle'});q.camera.position.set(3.5,2.7,5.4);q.camera.lookAt(0,1.1,0);for(let i=0;i<60;i++){q.combat.time+=1/60;__qaPose();}f.blocking=true;f.guardRegion='head';for(let i=0;i<18;i++){q.combat.time+=1/60;__qaPose();}});await snap('guard-head');
 const attack=await page.evaluate(()=>{
  const q=__arena,f=q.combat.fighters[0],result={};Object.assign(f,{blocking:false,guardRegion:null,action:'idle',move:0});for(let i=0;i<60;i++){q.combat.time+=1/60;__qaPose();}
  for(const region of ['chest','head','leftLeg']){
   Object.assign(f,{action:'attack',timer:0,attackWeapon:'gladius',attackKind:'light',attackLeft:false,attackRegion:region,attackProfile:ArenaMotion.profile('gladius',false,false),chain:1});f.duration=f.attackProfile.duration;
   const samples=[];for(let i=0;i<=Math.ceil(f.duration*60);i++){f.timer=Math.min(f.duration,i/60);q.combat.time+=1/60;__qaPose();samples.push(__qaMeasure());}result[region]=samples;
   f.action='idle';for(let i=0;i<45;i++){q.combat.time+=1/60;__qaPose();}
  }return result;
 });
 for(const [name,phase] of [['strike-windup',.22],['strike-contact',.47],['strike-recovery',.78]]){
  await page.evaluate(({phase})=>{const q=__arena,f=q.combat.fighters[0];Object.assign(f,{action:'idle',timer:0,blocking:false,attackRegion:'chest'});for(let i=0;i<40;i++){q.combat.time+=1/60;__qaPose();}f.action='attack';f.attackProfile=ArenaMotion.profile('gladius');f.duration=f.attackProfile.duration;for(let i=0;i<=Math.floor(f.duration*phase*60);i++){f.timer=i/60;q.combat.time+=1/60;__qaPose();}},{phase});await snap(name);
 }
 // CPU-only repeated full-rig animation, not GPU timing or claimed device FPS.
 const animationCpu=await page.evaluate(()=>{
  const q=__arena,f=q.combat.fighters[0],times=[];Object.assign(f,{action:'idle',move:1,blocking:false});
  for(let batch=0;batch<16;batch++){const start=performance.now();for(let i=0;i<60;i++){f.z+=2/60;f.walk+=2/60*4;q.combat.time+=1/60;__qaPose();}if(batch>2)times.push((performance.now()-start)/60);}return times;
 });
 // Restore all twenty fighters for identical-scene frame/CPU observation.
 await page.evaluate(()=>{
  const q=__arena,c=q.combat;c.finished=false;c.time=12;q.accumulator=0;
  c.fighters.forEach((f,i)=>{const a=i*Math.PI*2/20;Object.assign(f,{hp:120,maxHp:120,x:Math.sin(a)*5,z:Math.cos(a)*5,angle:a+Math.PI,action:'idle',move:.6,walk:i*.4,cooldown:999,blocking:false,reaction:0,guardFlash:0});q.models[i].root.visible=true;});
  c.fighters[0].x=0;c.fighters[0].z=0;c.tick=function(dt){this.time+=dt;for(const f of this.fighters)f.walk+=dt*3;};
  q.clearInput();q.setPaused(false);q.perfMeter.reset();q.last=performance.now();window.__qaManual=false;requestAnimationFrame(q.frame);
 });
 await page.waitForTimeout(Number(process.env.ARENA_FRAME_WINDOW_MS||8000));
 const frameTiming=await page.evaluate(()=>{window.__qaManual=true;return __arena.perfMeter.snapshot();});await page.waitForTimeout(150);
 // Responsive UI uses actual controls on the loaded scene, without scrolling.
 await page.evaluate(()=>{document.getElementById('hud').style.visibility='';document.getElementById('controls').style.visibility='';document.getElementById('enemyLabels').style.visibility='';});
 const layouts=[];
 for(const [width,height]of [[667,375],[844,390],[932,430],[740,320],[1366,768]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>__arena.resize());
  const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,bodyHeight:document.body.scrollHeight,boxes:[...document.querySelectorAll('.body-target,#attack,#block,#dodge,#special')].map(e=>{const b=e.getBoundingClientRect();return{id:e.id||e.dataset.region,x:b.x,y:b.y,w:b.width,h:b.height};})}));
  assert.ok(layout.scrollHeight<=height+1&&layout.bodyHeight<=height+1,'no vertical page scroll');assert.ok(layout.scrollWidth<=width+1,'no horizontal page scroll');
  for(const b of layout.boxes)assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.w<=width+1&&b.y+b.h<=height+1,JSON.stringify(b));
  for(let i=0;i<layout.boxes.length;i++)for(let j=i+1;j<layout.boxes.length;j++){const a=layout.boxes[i],b=layout.boxes[j];assert.ok(a.x+a.w<=b.x+1||b.x+b.w<=a.x+1||a.y+a.h<=b.y+1||b.y+b.h<=a.y+1,'controls overlap '+a.id+'/'+b.id);}
  layouts.push(layout);
 }
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>__arena.resize());
 // Repeated real pointer hold/release and attack mode must not latch defense.
 await page.locator('#block').dispatchEvent('pointerdown',{pointerId:101});
 for(let i=0;i<5;i++){
  const b=await page.locator('[data-region="head"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();assert.equal(await page.evaluate(()=>__arena.worldInput().guardRegion),'head');await page.mouse.up();assert.equal(await page.evaluate(()=>__arena.worldInput().block),false);
 }
 await page.locator('#attack').dispatchEvent('pointerdown',{pointerId:102});
 const attackRequests=[];for(const region of ['head','chest','leftArm','rightArm','leftLeg','rightLeg','chest']){
  await page.evaluate(()=>{const f=__arena.combat.fighters[0];Object.assign(f,{hp:120,action:'idle',cooldown:0,stamina:100,stunUntil:0});});await page.locator('[data-region="'+region+'"]').click();attackRequests.push(await page.evaluate(()=>__arena.combat.fighters[0].attackRegion));
 }
 assert.deepEqual(attackRequests,['head','chest','leftArm','rightArm','leftLeg','rightLeg','chest']);
 const pause=await page.evaluate(()=>{const q=__arena;q.joy={x:1,y:0};q.setPaused(true);const input=q.worldInput(),before=q.combat.time;window.__qaManual=true;q.last=performance.now();q.frame(performance.now()+17);const stopped=q.combat.time===before;q.setPaused(false);return {stopped,cleared:input.x===0&&input.z===0&&!input.block,resumed:q.active()};});
 assert.ok(pause.stopped&&pause.cleared&&pause.resumed);
 await page.screenshot({path:path.join(out,variant+'-controls-844.png')});
 assert.deepEqual(errors,[],'no page exceptions');assert.deepEqual(external,[],'fixture made no external requests');
 function continuity(samples,key){const ds=[];for(let i=1;i<samples.length;i++)ds.push(Math.hypot(...samples[i][key].map((x,k)=>x-samples[i-1][key][k])));return stat(ds);}
 const continuityReport={};for(const [name,samples]of Object.entries(motion))continuityReport[name]=Object.fromEntries(['root','leftHand','rightHand','leftFoot','rightFoot','shield'].map(key=>[key,continuity(samples,key)]));
 const alignment={};for(const [region,samples]of Object.entries(attack)){const profile={wind:.26,active:.22};const active=samples.filter((s,i)=>i/60>=profile.wind&&i/60<=profile.wind+profile.active);alignment[region]={bladeAngleRadians:stat(active.map(s=>s.bladeAngle)),gripOffsetMetres:stat(samples.map(s=>s.gripOffset)),footLeft:continuity(samples,'leftFoot'),footRight:continuity(samples,'rightFoot')};assert.ok(alignment[region].bladeAngleRadians.max<1e-5,'weapon direction matches authoritative strike '+region);assert.ok(alignment[region].gripOffsetMetres.max<1e-5,'weapon stays in attacking hand '+region);}
 const report={variant,baselineRef,loaded,animationCpuMsPerPose:stat(animationCpu),frameTiming,continuity:continuityReport,alignment,layouts,pause,repeatedInputs:attackRequests,errors,external,failed,screenshots,rawMotion:motion,rawAttack:attack,limitations:'Headless Chromium SwiftShader, DPR 1; CPU/JS metrics are not GPU timings or physical-device FPS. Fixed real-asset scene and deterministic pose samples prove continuity/alignment, not human judgments of naturalness.'};
 fs.writeFileSync(path.join(out,variant+'-report.json'),JSON.stringify(report,null,2));
 console.log(variant+': PASS '+JSON.stringify({animationCpu:report.animationCpuMsPerPose,frame:frameTiming,pause}));
 return report;
 }finally{await context.close();}
}
async function sheets(){
 const variants=['baseline','after'],labels=['idle','walk-contact','walk-passing','run-contact','run-passing','guard-head','strike-windup','strike-contact','strike-recovery'];
 for(const variant of variants){if(!fs.existsSync(path.join(out,variant+'-idle.png')))continue;const tiles=[];for(let i=0;i<labels.length;i++){const p=path.join(out,variant+'-'+labels[i]+'.png');if(!fs.existsSync(p))continue;const b=await sharp(p).resize(422,195).toBuffer();tiles.push({input:b,left:(i%3)*422,top:Math.floor(i/3)*223+28});const label=Buffer.from(`<svg width="422" height="28"><rect width="422" height="28" fill="#15201e"/><text x="10" y="19" fill="#f2e7d0" font-family="sans-serif" font-size="15">${variant}: ${labels[i]}</text></svg>`);tiles.push({input:label,left:(i%3)*422,top:Math.floor(i/3)*223});}await sharp({create:{width:1266,height:669,channels:4,background:'#15201e'}}).composite(tiles).png().toFile(path.join(out,variant+'-contact-sheet.png'));}
}
(async()=>{
 await new Promise(r=>server.listen(Number(process.env.ARENA_QA_PORT||0),'127.0.0.1',r));
 if(mode==='serve'){console.log('QA server http://127.0.0.1:'+server.address().port+'/qa?variant=baseline');return;}
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{for(const variant of mode==='both'?['baseline','after']:[mode])await run(browser,variant);await sheets();}
 finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
