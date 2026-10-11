// Two isolated browsers, real models and the current authoritative V76 PostgreSQL RPC.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const {fixtureDatabase:createDatabase,players,setMatch,call,A,B,R}=require('./online-projectiles-v76.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||require('node:os').tmpdir();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
let cleanup=async()=>{};
async function main(){
 const db=await createDatabase();const initial=await players(db,'spear');initial[1].z=8;await setMatch(db,initial);let chain=Promise.resolve(),failNextSpecial=false,lostSpecialState;const inputs=[],actionStates=[];
 const serialized=fn=>{const next=chain.then(fn);chain=next.catch(()=>{});return next;};
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture.local');
  if(url.pathname==='/fixture/rpc'){
   let body='';for await(const chunk of req)body+=chunk;
   try{const {name,args,owner}=JSON.parse(body);let data;
    if(name==='ludus_match')data=await serialized(async()=>{inputs.push({owner,...args.p_input});return call(db,owner,args.p_action,args.p_input||{});});else data={friends:[],pending:[]};
    if(args.p_input?.special)actionStates.push({owner,input:args.p_input,data});
    if(failNextSpecial&&args.p_input?.special){failNextSpecial=false;lostSpecialState=data;res.writeHead(502);res.end('Lost response');return;}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data,error:null}));
   }catch(e){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:null,error:{message:e.message}}));}return;
  }
  const local=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!local.startsWith(root+path.sep)||!fs.existsSync(local)||!fs.statSync(local).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':mime[path.extname(local)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(local).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=process.env.LUDUS_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 let bootHeartbeat;cleanup=async()=>{clearInterval(bootHeartbeat);await browser.close();await new Promise(r=>server.close(r));await db.close();};
 const errors=[],pages=[];
 async function open(owner){
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:1});const p=await context.newPage();pages.push(p);
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(({owner,R})=>{window.fixtureOwner=owner;sessionStorage.setItem('ludus-match-room',R);sessionStorage.setItem('ludus-duel-selection',JSON.stringify({gladiator:'fixture'}));},{owner,R});
  await p.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/multiplayer-v36.js')){
    const setup=`const fixtureUser={id:window.fixtureOwner,is_anonymous:false};supabase.createClient=()=>({auth:{getUser:async()=>({data:{user:fixtureUser},error:null}),getSession:async()=>({data:{session:{user:fixtureUser}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{const response=await fetch('/fixture/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,args,owner:fixtureUser.id})});if(!response.ok)throw Error('Lost response');const result=await response.json();if(name==='ludus_match')window.fixtureLastMatch=result.data;return result;}});window.fixtureAnimations={};const fixtureAnimate=ImportedGladiator.animate;ImportedGladiator.animate=function(f,...args){window.fixtureAnimations[f.name]={action:f.action,weapon:f.weapon,offhand:f.offhand};if(f.action==='spearcast')window.fixtureSawThrow=true;if(window.fixtureScene?.children.some(o=>o.name==='online-projectile'&&o.visible))window.fixtureSawFlight=true;return fixtureAnimate.call(this,f,...args);};const fixtureAdd=THREE.Scene.prototype.add;THREE.Scene.prototype.add=function(...objects){for(const o of objects)if(o.name==='Neberkenezer_Colosseum'){window.fixtureArena=o;window.fixtureScene=this;}return fixtureAdd.apply(this,objects);};`;
    return route.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(root+'/multiplayer-v36.js','utf8')});
   }
   if(u.origin===base)return route.continue();
   const asset=path.join(root,path.basename(u.pathname));if(fs.existsSync(asset)&&fs.statSync(asset).isFile())return route.fulfill({path:asset,contentType:mime[path.extname(asset)]||'application/octet-stream'});
   return route.abort();
  });
  await p.goto(base+'/multiplayer.html?v=revision76',{waitUntil:'domcontentloaded'});
  try{await p.waitForFunction(()=>window.fixtureArena?.userData.drawGroups>0&&!document.getElementById('duelControls').hidden,null,{timeout:60000});}
  catch(e){console.error('Fixture loading state:',await p.locator('#queueMessage').textContent(),await p.locator('#queueCaption').textContent(),errors);throw e;}
  return p;
 }
 // Both fixture players remain connected while the headless renderer loads their models.
 bootHeartbeat=setInterval(()=>serialized(async()=>{await call(db,A,'state');await call(db,B,'state');}).catch(()=>{}),2000);
 const a=await open(A),b=await open(B);clearInterval(bootHeartbeat);
 assert.equal(await a.locator('#duelSpecial small').innerText(),'FIRLAT');
 for(const [width,height]of [[667,375],[844,390],[1366,768]]){
  await a.setViewportSize({width,height});const box=await a.locator('#duelSpecial').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
 }
 await a.setViewportSize({width:844,height:390});
 await a.locator('#duelTarget').click();failNextSpecial=true;const n=inputs.length;await a.locator('#duelSpecial').click();
 await a.waitForFunction(()=>window.fixtureLastMatch?.players[1].hit_serial===1,null,{timeout:20000});
 await b.waitForFunction(()=>window.fixtureLastMatch?.players[1].hit_serial===1,null,{timeout:20000});
 const first=await serialized(()=>call(db,A,'state'));assert.equal(first.players[0].items.length,0);assert.equal(first.players[0].throw_serial,1);assert.ok(first.players[1].hp<100);assert.equal(first.players[0].projectile.resolved,true);
 assert.equal(lostSpecialState.players[0].stamina,74);const sent=inputs.slice(n).filter(x=>x.owner===A&&x.special);assert.ok(sent.length>=2);assert.equal(new Set(sent.map(x=>x.special_id)).size,1);
 assert.equal(await a.locator('#duelSpecial').isHidden(),true);await b.waitForFunction(()=>window.fixtureAnimations.Alpha?.weapon===null);
 assert.equal(await b.evaluate(()=>window.fixtureSawThrow),true);assert.equal(await b.evaluate(()=>window.fixtureSawFlight),true,JSON.stringify(await b.evaluate(()=>({animations:window.fixtureAnimations,shot:window.fixtureLastMatch?.players[0].projectile,meshes:window.fixtureScene?.children.filter(o=>o.name==='online-projectile').map(o=>({visible:o.visible,position:o.position})),now:Date.now()}))));
 assert.equal(await a.locator('#rivalHp').getAttribute('max'),'100');assert.equal(await a.locator('#rivalHp').evaluate(n=>n.value),await b.locator('#selfHp').evaluate(n=>n.value));
 await a.screenshot({path:path.join(out,'online-projectiles-v76.png')});
 // Reconnect uses room equipment, so a thrown weapon cannot reappear.
 const reconnected=await open(A);await reconnected.waitForFunction(()=>window.fixtureAnimations.Alpha?.weapon===null);assert.equal(await reconnected.locator('#duelSpecial').isHidden(),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({sessions:2,realModels:true,sharedDamage:true,throwAnimation:true,flightMesh:true,lostResponseRetry:true,removedWeapon:true,reconnect:true,viewports:3}));
 await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exitCode=1;});
