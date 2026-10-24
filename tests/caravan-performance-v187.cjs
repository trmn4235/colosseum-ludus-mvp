/* Full 5v6 encounter, local account only. Includes shadow passes, not just the forest. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.env.LUDUS_TEST_ROOT||path.join(__dirname,'..'));
const ticket={id:'00000000-0000-4000-8000-000000000187',status:'ready',region:'wood',encounter:{version:126,rules:168,seed:56457744,cargo:'wood',guards:5,archers:1,attempt:1,quantity:60},team:Array.from({length:5},(_,i)=>({id:'fixture-'+i,name:'Avcı '+i,class:['murmillo','thraex','retiarius','hoplomachus','secutor'][i],overall:50,items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'},{kind:'shield',model:'large',equipped_slot:'off_hand'},{kind:'chest',model:'murmillo',equipped_slot:'chest'}]}))};
const stub=`window.LudusClient={create:()=>({auth:{getUser:async()=>({data:{user:{id:'performance-fixture'}}})},rpc:async()=>({data:{user_id:'performance-fixture',version:126,history:[],active:${JSON.stringify(ticket)},result:${JSON.stringify(ticket)}}}),functions:{invoke:async()=>({error:{message:'Fixture does not award loot'}})}})};`;
const server=http.createServer((req,res)=>{
 const uri=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+uri);
 if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
 let body=fs.readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
 if(uri==='/ludus-client-v84.js')body=stub;
 if(uri==='/caravan-field-v125.js')body=body.toString().replace('window.CaravanField={','window.CaravanField={stop(){cancelAnimationFrame(raf);raf=0;},resetClock(){last=0;},clock(now){tick(now);cancelAnimationFrame(raf);raf=0;},advance(dt){for(const m of mixers)m.update(dt);detail.update(dt);battle.frame(dt);},');
 if(uri==='/caravan-battle-v126.js')body=body.toString().replace('models.push(m);','models.push(m);window.testModels=models;');
 res.end(body);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:932,height:430},deviceScaleFactor:2,hasTouch:true,isMobile:true});await context.route(/^https:/,r=>r.abort());
  const page=await context.newPage(),errors=[],requests=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:'+server.address().port+'/caravan-field.html?raid='+ticket.id,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.CaravanBattle?.state);await page.evaluate(()=>CaravanField.stop());
  const metrics=await page.evaluate(()=>{
   const f=CaravanField,r=f.renderer,b=CaravanBattle;
   for(let i=0;i<180;i++)f.advance(1/60);
   const replay=CaravanSimulationV168.replay(b.state.ticket,b.state.commands,b.state.steps),replayExact=JSON.stringify(replay.combat.fighters.map(x=>x.hp))===JSON.stringify(b.state.combat.fighters.map(x=>x.hp));
   r.info.autoReset=false;
   f.scene.children.filter(o=>o.isLight&&o.castShadow).forEach(o=>o.shadow.needsUpdate=false);r.info.reset();r.render(f.scene,f.camera);const color={...r.info.render};
   f.detail.shadow.shadow.needsUpdate=true;r.info.reset();r.render(f.scene,f.camera);const shadow={...r.info.render};
   const clock=[],render=r.render;r.render=()=>{};
   for(const fps of [10,15,30,60,120]){
    const c=b.state.combat;for(const p of c.fighters)p.hp=p.maxHp=100000;
    f.resetClock();f.clock(1000);const before=c.time;for(let i=1;i<=fps*2;i++)f.clock(1000+i*1000/fps);
    clock.push({fps,seconds:c.time-before});
   }
   b.pause();const before=b.state.steps;for(let i=0;i<60;i++)f.advance(1/60);const pausedSteps=b.state.steps-before;r.render=render;
   return{fighters:b.state.combat.fighters.length,color,shadow,pixelRatio:r.getPixelRatio(),clock,pausedSteps,replayExact,fullBodies:testModels.filter(m=>m.id===0||m.navalBodyLevel===0).length};
  });
  assert.deepEqual(errors,[]);assert.equal(metrics.fighters,11);assert.equal(metrics.replayExact,true);assert.equal(metrics.pausedSteps,0);
  assert.ok(metrics.color.triangles<800000,JSON.stringify(metrics));assert.ok(metrics.shadow.triangles<1100000,JSON.stringify(metrics));assert.ok(metrics.shadow.calls<330);
  assert.ok(metrics.pixelRatio<=1.25);assert.ok(metrics.fullBodies<=3);for(const c of metrics.clock)assert.ok(Math.abs(c.seconds-2)<1/30+.0001,JSON.stringify(c));
  assert.ok(!requests.some(url=>/gladiator_chest.*\.glb/.test(url)),'Retired armour must not download');
  console.log(JSON.stringify({metrics,errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
