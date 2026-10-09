// Real production assets and renderer; execution on a desktop test runner is not an iPhone benchmark.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');let server;
const {chromium,webkit}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
(async()=>{
 if(!process.env.LUDUS_TEST_URL){server=spawn('python3',['-u',path.resolve(__dirname,'../tools/training-test-server-v50.py')]);await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('server ready'))resolve();else process.stdout.write(d);});server.stderr.on('data',d=>process.stderr.write(d));server.on('exit',code=>reject(Error('Test server exited '+code)));});}
 const engine=process.env.LUDUS_TEST_ENGINE||'chromium',browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}:{})}),page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1}),errors=[],backend=[];
 page.on('pageerror',e=>{if(!errors.includes(e.message))console.error('Page:',e.message);errors.push(e.message);});page.on('request',r=>{if(r.url().includes('supabase.co'))backend.push(r.url());});
 await page.goto(process.env.LUDUS_TEST_URL||'http://127.0.0.1:9033/training-test-v50.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('loading').hidden,{},{timeout:180000});assert.ok(await page.evaluate(()=>globalThis.TrainingTest?.current?.ready),await page.locator('#measurement').textContent());
 assert.deepEqual(await page.evaluate(()=>TrainingTest.current.props.group.userData.counts),{posts:2,leaningRudis:4,shoulderBeams:3});
 assert.equal(await page.evaluate(()=>TrainingTest.current.pool.length),2);assert.ok(await page.evaluate(()=>TrainingTest.current.pool[0].model.imported));
 await page.getByRole('button',{name:'Antrenmana başla',exact:true}).click();await page.waitForFunction(()=>TrainingTest.current.pool.some(g=>g.state.action==='attack'),{},{timeout:20000});assert.deepEqual(errors,[],'Actual swing completed without a runtime error');
 assert.ok(await page.evaluate(()=>TrainingTest.current.pool.every(g=>g.model.root.position.y===0)));assert.ok(await page.evaluate(()=>TrainingTest.current.pool.every(g=>g.model.weaponAnchor.children.length===1&&g.model.weaponAnchor.children[0].geometry===TrainingTest.current.props.rudisGeometry)));
 await page.screenshot({path:'/tmp/training-v50-'+engine+'.png'});console.log(JSON.stringify({engine,model:'real gladiator-mobile.glb',pairedAnimation:true,woodenPracticeSwords:true,props:{posts:2,rudis:4,beams:3},metrics:await page.evaluate(()=>TrainingTest.current.metrics)}));
 const results=[];
 for(const count of (process.env.LUDUS_TEST_COUNTS||'2').split(',').map(Number)){
  await page.evaluate(n=>TrainingTest.current.setCount(n),count);await page.evaluate(()=>TrainingTest.current.setSmart(true));
  const result=await page.evaluate(()=>TrainingTest.current.measure({warmMs:500,sampleMs:1800}));results.push(result);console.log(JSON.stringify({engine,count,smart:true,idleFPS:result.idle.fps,trainingFPS:result.training.fps,animationMs:result.training.animationMs,changeMs:result.changeMs,active:result.metrics.active,hidden:result.metrics.hidden}));
  if(count>2)assert.ok(result.metrics.hidden>0,'Off-camera rig work is suspended');console.log(JSON.stringify({animationProfile:await page.evaluate(()=>TrainingTest.current.profileAnimation())}));
 }
 if(process.env.LUDUS_TEST_LEGACY){
  await page.evaluate(()=>TrainingTest.current.setSmart(false));const result=await page.evaluate(()=>TrainingTest.current.measure({warmMs:500,sampleMs:2200}));results.push(result);assert.equal(result.metrics.active,result.count);console.log(JSON.stringify({engine,count:result.count,smart:false,idleFPS:result.idle.fps,trainingFPS:result.training.fps,animationMs:result.training.animationMs,changeMs:result.changeMs}));
 }
 for(const count of [12,30]){
  await page.evaluate(n=>TrainingTest.current.setCount(n),count);await page.evaluate(()=>{TrainingTest.current.setSmart(true);TrainingTest.current.setView(false);});await page.waitForTimeout(300);
  const crowded=await page.evaluate(()=>({metrics:TrainingTest.current.metrics,profile:TrainingTest.current.profileAnimation()}));assert.ok(crowded.metrics.hidden>0);console.log(JSON.stringify({engine,crowd:count,...crowded}));
 }
 await page.evaluate(()=>TrainingTest.current.setView(true));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>TrainingTest.current.metrics.active),30,'Wide view actually renders the complete crowd');
 await page.evaluate(()=>TrainingTest.current.setSmart(false));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>TrainingTest.current.metrics.active),30,'Legacy mode updates every fighter');
 await page.evaluate(()=>{TrainingTest.current.setSmart(true);TrainingTest.current.setView(false);});
 for(const viewport of [{width:1024,height:768},{width:667,height:375},{width:640,height:320},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),'Viewport has no scrolling');const box=await page.locator('#scene').boundingBox();assert.ok(box.height>100,'Training remains visible');
 }
 await page.locator('#scene').evaluate(n=>n.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));assert.equal(await page.evaluate(()=>TrainingTest.current.ready),false);assert.ok(await page.getByRole('button',{name:'Akıcılığı ölç',exact:true}).isDisabled(),'Lost graphics context cannot produce a misleading FPS result');
 assert.deepEqual(backend,[],'Test never calls an account or reward endpoint');assert.deepEqual(errors,[]);
 const output={engine,runner:'headless browser, hardware-specific',noAccountWrites:true,noPageErrors:true,noScroll:true,results};fs.writeFileSync('/tmp/training-v50-'+engine+'-results.json',JSON.stringify(output,null,2));await browser.close();server?.kill();console.log(JSON.stringify({engine,noAccountWrites:true,pageErrors:0,noScroll:true,results:'/tmp/training-v50-'+engine+'-results.json'}));
})().catch(e=>{server?.kill();console.error(e);process.exit(1);});
