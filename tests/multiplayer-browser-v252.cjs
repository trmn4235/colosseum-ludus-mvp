// Full ranked renderer with real models/equipment and an isolated delayed RPC.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function(context,base,out){
 const root=path.resolve(__dirname,'..'),owner='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000252';
 const classes=['provocator','murmillo','retiarius','murmillo','thraex','retiarius','secutor','murmillo','thraex','scissor'];
 const players=classes.map((type,i)=>({owner:i?'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'):owner,name:'Roma-'+(i+1),class:type,ranked_team:i<5?'a':'b',bot_v249:i>0,ranked_joined:true,
  gladiator:{class:type,overall:50},combat_stats:{speed:1},items:[
   {kind:'weapon',model:type==='retiarius'?'trident':type==='thraex'?'sica':'gladius',equipped_slot:'main_hand',enhancement:5},
   {kind:type==='retiarius'||type==='scissor'?'weapon':'shield',model:type==='retiarius'?'net':type==='scissor'?'scissor':type==='thraex'?'small':'large',equipped_slot:'off_hand',enhancement:5},
   {kind:'helmet',model:i===0?'viking_helmet':type,equipped_slot:'helmet',enhancement:0},
   {kind:'gloves',model:i===0?'manica_lion':'starter',equipped_slot:'gloves',enhancement:0},
   {kind:'legs',model:'starter',equipped_slot:'legs',enhancement:0},
   ...(['provocator','murmillo','scissor'].includes(type)?[{kind:'chest',model:i===0?'chest_plate':type,equipped_slot:'chest',enhancement:0}]:[])],
  x:(i%5-2)*1.6,z:i<5?-3:3,angle:i<5?0:Math.PI,hp:100,maxHp:100,stamina:100,maxStamina:100,serial:0,gear_serial:0,move:1,block:false}));
 const fixture=`window.__mpFixture={hold:false,held:0,responses:0,releases:[]};
 const fixtureRoom={id:${JSON.stringify(id)},status:'playing',players:${JSON.stringify(players)},combat_version:23,controls_version:77,server_now:new Date().toISOString()};
 LudusClient.create=()=>({auth:{getUser:async()=>({data:{user:{id:${JSON.stringify(owner)},is_anonymous:false}}})},rpc:async(name,args)=>{
  if(args.p_action==='step'){
   if(__mpFixture.hold){__mpFixture.held++;await new Promise(resolve=>__mpFixture.releases.push(resolve));}
   else await new Promise(resolve=>setTimeout(resolve,30));
   __mpFixture.responses++;
   return {data:{...fixtureRoom,server_now:new Date().toISOString(),delta_version:252,players:fixtureRoom.players.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>!['name','class','gladiator','combat_stats','items','ranked_team','bot_v249'].includes(key))))}};
  }
  return {data:{...fixtureRoom,server_now:new Date().toISOString()}};
 }});`;
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({id})=>sessionStorage.setItem('ludus-ranked-room',id),{id});
 let source=fs.readFileSync(root+'/multiplayer-v36.js','utf8');
 source=fixture+'\n'+source.replace('function frame(t){requestAnimationFrame(frame);','function frame(t){window.__mpFrames=(window.__mpFrames||0)+1;requestAnimationFrame(frame);')
  .replace('requestAnimationFrame(frame);boot();',`window.__mpTest={get ready(){return ready&&!!room;},get room(){return room;},get renderer(){return renderer;},get camera(){return camera;},get states(){return states;},get models(){return models;},get self(){return states.get(owner);}};requestAnimationFrame(frame);boot();`);
 await page.route('**/multiplayer-v36.js*',route=>route.fulfill({contentType:'text/javascript',body:source}));
 await page.goto(base+'/multiplayer.html?venue=ranked&v=252',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__mpTest?.ready&&__mpTest.models.size===10&&__mpFixture.responses>2,null,{timeout:90000});
 assert.equal(await page.locator('#duelControls').isVisible(),true);
 await page.evaluate(()=>{__mpFixture.hold=true;});
 await page.waitForFunction(()=>__mpFixture.held>0);
 const start=await page.evaluate(()=>{
  const a=__mpTest,right=new THREE.Vector3(1,0,0).applyQuaternion(a.camera.quaternion);right.y=0;right.normalize();
  return {x:a.self.x,z:a.self.z,right:{x:right.x,z:right.z},frames:__mpFrames,responses:__mpFixture.responses,at:performance.now()};
 });
 await page.keyboard.down('ArrowLeft');
 await page.waitForFunction(start=>{
  const f=__mpTest.self;return __mpFrames>start.frames+10&&(f.x-start.x)*start.right.x+(f.z-start.z)*start.right.z<-.1;
 },start,{timeout:20000});
 const report=await page.evaluate(start=>{
  const a=__mpTest;let meshes=0;
  for(const m of a.models.values())m.root.traverse(o=>{if(o.isMesh)meshes++;});
  return {fighters:a.models.size,meshes,calls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,framesWhileWaiting:__mpFrames-start.frames,waitingMs:performance.now()-start.at,responses:__mpFixture.responses,boundedDistance:Math.hypot(a.self.x-start.x,a.self.z-start.z),pixelRatio:a.renderer.getPixelRatio(),fullGear:a.room.players.every(p=>p.items.length>=5),errors:[]};
 },start);
 assert.equal(report.responses,start.responses,'rendering and touch movement continue without a server reply');
 assert.ok(report.boundedDistance<=.421,'prediction remains bounded while the connection is delayed');
 assert.ok(report.fullGear,'compact responses preserve all equipment');
 assert.ok(report.meshes>=100,'test uses complete rigs and equipment');
 assert.ok(report.calls<500&&report.triangles<1500000,'ranked scene stays within geometry/draw budgets');
 assert.ok(report.pixelRatio<=1,'ranked touch device uses its resolution budget');
 await page.keyboard.up('ArrowLeft');
 await page.screenshot({path:out+'/multiplayer-v252.png'});
 await page.evaluate(()=>{__mpFixture.hold=false;for(const resolve of __mpFixture.releases.splice(0))resolve();});
 await page.waitForFunction(start=>__mpFixture.responses>start.responses,start);
 assert.deepEqual(errors,[]);report.errors=errors;
 report.note='Software WebGL renderer; frame count while the RPC is held is not physical iPhone FPS.';
 fs.writeFileSync(out+'/multiplayer-v252.json',JSON.stringify(report,null,2));console.log(JSON.stringify({multiplayerV252:report}));
 await page.close();
};
