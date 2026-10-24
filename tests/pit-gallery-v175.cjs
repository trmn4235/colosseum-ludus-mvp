const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const path=require('node:path'),root=path.resolve(__dirname,'..'),server=require('node:http').createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/tmp/helmet-chrome/chromium')?'/tmp/helmet-chrome/chromium':undefined),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{const page=await browser.newPage({viewport:{width:932,height:430}}),errors=[],missing=[];page.on('response',r=>{if(r.status()===404)missing.push(r.url());});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});const capture=page.screenshot.bind(page);page.screenshot=async options=>{await page.evaluate(()=>{window.__savedHidden=Object.getOwnPropertyDescriptor(document,'hidden');Object.defineProperty(document,'hidden',{configurable:true,value:true});});try{return await capture({...options,timeout:90000});}finally{await page.evaluate(()=>{delete document.hidden;if(window.__savedHidden)Object.defineProperty(document,'hidden',window.__savedHidden);delete window.__savedHidden;});}};page.on('pageerror',e=>{if(!errors.includes(e.message))console.error(e.stack);errors.push(e.message);});
 await page.route('**/ludus-client-v84.js*',r=>r.fulfill({contentType:'application/javascript',body:`const startedAt=new Date().toISOString();window.__pitMock={gold:2000,entry_fame:30,win_fame:1,roster:[{id:'g1',name:'Cassius',fame:20}],history:[],server_now:startedAt,bout:{id:'bout1',participants:4,status:'running',selected:0,stake:50,odds:3.8,winner:null,started_at:startedAt,finish_at:new Date(Date.parse(startedAt)+45000).toISOString(),payout:0}};window.LudusClient={create:()=>({auth:{getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}}})},rpc:async()=>{window.__pitMock.server_now=new Date().toISOString();return{data:window.__pitMock};}})};`}));
 const out='/tmp/pit-v175';fs.mkdirSync(out,{recursive:true});
 await page.goto('http://127.0.0.1:'+port+'/san-avlusu.html?travel=pit');
 await page.waitForFunction(()=>PitVisit.ready,null,{timeout:90000});await page.waitForFunction(()=>!document.querySelector('#romeTravelLoading'),null,{timeout:30000});
 await page.waitForFunction(()=>PitVisit.renderer.info.render.frame>3);
 const geometry=await page.evaluate(()=>{
  const root=PitVisit.scene.userData.pitRoot,T=THREE;root.updateMatrixWorld(true);const rays=[];
  for(const axis of ['x','z'])for(const sign of [-1,1])for(const across of [-.9,-.5,0,.5,.9]){
   const half=PitArena.half,origin=new T.Vector3(axis==='x'?sign*(half.x+2):across*(half.x+3.5),PitArena.galleryY+1.65,axis==='z'?sign*(half.z+2):across*(half.z+3.5));
   const direction=new T.Vector3(axis==='x'?sign:0,0,axis==='z'?sign:0),ray=new T.Raycaster(origin,direction,0,3);
   rays.push(ray.intersectObject(root,true).some(hit=>hit.object.userData.parts?.some(name=>/Yüksek sıvalı dış|Kapalı yüksek dış/.test(name))));
  }
  const tunic=PitVisit.dominus.root.getObjectByName('OwnerWhiteTunic');tunic.geometry.computeBoundingBox();
  return {rays,outerHeight:root.userData.outerHeight,hem:Math.min(...Array.from({length:tunic.geometry.attributes.position.count},(_,i)=>tunic.geometry.attributes.position.getY(i))),people:root.userData.spectatorCount,lods:root.userData.crowdLods.length,obstacles:root.userData.obstacles.length,cameraObstacles:root.userData.cameraObstacles.length,parts:root.children.filter(o=>o.userData.parts).flatMap(o=>o.userData.parts),crowdError:root.userData.crowdError};
 });
 console.log('Closed-wall probes:',geometry.rays.length,'camera blockers:',geometry.cameraObstacles);assert.ok(geometry.rays.every(Boolean),'every gallery eye-height outward ray must hit a closed exterior wall');assert.ok(geometry.outerHeight-PitArenaHeight()>3);function PitArenaHeight(){return 3.54;}
 assert.ok(geometry.hem>.54&&geometry.hem<.59,'level knee hem');assert.equal(geometry.people,24);assert.ok(geometry.lods>0);assert.ok(geometry.obstacles>=30);assert.equal(geometry.crowdError,undefined);assert.ok(geometry.cameraObstacles>=30);assert.ok(geometry.parts.includes('Kapalı niş sırtı'));
 const positions=process.env.PIT_GALLERY_QUICK?[]:await page.evaluate(()=>{const h=PitArena.half;return [[0,h.z+2.1],[h.x+2,0],[0,-h.z-2.1],[-h.x-2,0],[h.x+2.7,h.z+2.7]];});
 for(let i=0;i<positions.length;i++){
  await page.evaluate(([x,z])=>{PitVisit.dominus.root.position.set(x,PitArena.galleryY,z);PitVisit.showView('overview');},positions[i]);
  for(let turn=0;turn<4;turn++){
   await page.mouse.move(400,220);await page.mouse.down();await page.mouse.move(596.35,220);await page.mouse.up();
   const frame=await page.evaluate(()=>PitVisit.renderer.info.render.frame);await page.waitForFunction(n=>PitVisit.renderer.info.render.frame>n+3,frame,{timeout:20000});
   assert.equal(await page.evaluate(()=>PitVisit.scene.userData.pitRoot.userData.cameraObstacles.some(b=>b.containsPoint(PitVisit.camera.position))),false,'camera must stay outside solid walls/posts');
   if(turn===0)await page.screenshot({path:out+'/gallery-'+i+'.png'});
  }
 }
 await page.evaluate(()=>{PitVisit.dominus.root.position.set(-2,PitArena.galleryY,PitArena.half.z+2.2);PitVisit.showView('overview');});
 const poses=await page.evaluate(()=>{
  const actor=PitVisit.dominus,T=THREE,bones={};actor.root.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:]?/,'')]=o;});let maxPlantError=0,locks=0,finite=true;
  for(let n=0;n<180;n++){actor.root.position.x+=1.65/60;actor.root.rotation.y=Math.PI/2;actor.animate(1/60,1.65);for(const [side,lock]of Object.entries(actor.root.userData.pitFootLocks)){const actual=bones[side+'Foot'].getWorldPosition(new T.Vector3());maxPlantError=Math.max(maxPlantError,actual.distanceTo(lock.target));locks++;}for(const bone of Object.values(bones))finite=finite&&bone.matrixWorld.elements.every(Number.isFinite);}
  return{maxPlantError,locks,finite};
 });assert.ok(poses.finite);assert.ok(poses.locks>0);assert.ok(poses.maxPlantError<.06,'planted feet must remain close to their contact');
 for(const [width,height]of [[932,430],[667,375],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));await page.screenshot({path:out+'/size-'+width+'.png'});}
 await page.setViewportSize({width:932,height:430});await page.evaluate(()=>PitVisit.showView('watch'));await page.waitForFunction(()=>PitVisit.rigs||PitVisit.rigError,null,{timeout:60000});assert.equal(await page.evaluate(()=>PitVisit.rigError),null);await page.waitForTimeout(500);await page.screenshot({path:out+'/watch.png'});
 const rendering=await page.evaluate(()=>({calls:PitVisit.renderer.info.render.calls,triangles:PitVisit.renderer.info.render.triangles,programs:PitVisit.renderer.info.programs.length,near:PitVisit.scene.userData.pitRoot.userData.crowdLods.reduce((n,r)=>n+r.near.count,0),far:PitVisit.scene.userData.pitRoot.userData.crowdLods.reduce((n,r)=>n+r.far.count,0)}));
 assert.ok(rendering.far>0);assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);console.log({closedWalls:geometry.rays.every(Boolean),outerHeight:geometry.outerHeight,hem:geometry.hem,poses,rendering,errors,missing});
 }finally{server.closeAllConnections();server.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
