// Two isolated browsers, real models and the current authoritative V76 PostgreSQL RPC.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright'));
const {fixtureDatabase:createDatabase,players,setMatch,call,A,B,R}=require('./online-projectiles-v76.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||require('node:os').tmpdir();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
let cleanup=async()=>{};
async function main(){
 const db=await createDatabase();await require('./combat-motion-sql-v163.cjs').install(db);const initial=await players(db,'spear');initial[1].z=8;await setMatch(db,initial);let chain=Promise.resolve(),failNextSpecial=false,lostSpecialState;const inputs=[],actionStates=[];
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
 const browser=process.env.LUDUS_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
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
  // The first live WebGL session shares the software GPU while the second loads.
  // Use the same startup budget as the real-model readiness check below.
  await p.goto(base+'/multiplayer.html?v=revision76',{waitUntil:'domcontentloaded',timeout:60000});
  try{await p.waitForFunction(()=>window.fixtureArena?.userData.drawGroups>0&&!document.getElementById('duelControls').hidden,null,{timeout:60000});}
  catch(e){console.error('Fixture loading state:',await p.locator('#queueMessage').textContent(),await p.locator('#queueCaption').textContent(),errors);throw e;}
  return p;
 }
 // Both fixture players remain connected while the headless renderer loads their models.
 bootHeartbeat=setInterval(()=>serialized(async()=>{await call(db,A,'state');await call(db,B,'state');}).catch(()=>{}),2000);
 const a=await open(A),b=await open(B);clearInterval(bootHeartbeat);
 for(const kind of ['duck','jump','step','roll']){
  await serialized(async()=>{const rows=await players(db,'spear');rows[1].z=8;await setMatch(db,rows);});
  await a.waitForFunction(()=>window.fixtureLastMatch?.players[0].stamina===100);if(kind==='step')await a.locator('#duelDodge').dispatchEvent('pointerdown',{pointerId:45});else await a.keyboard.press({duck:'KeyC',jump:'KeyV',roll:'KeyB'}[kind]);
  await b.waitForFunction(kind=>window.fixtureLastMatch?.players[0].dodge_kind===kind,kind);const sent=inputs.filter(x=>x.owner===A&&x.dodge).at(-1);assert.equal(sent.dodge_kind,kind);
  await b.waitForFunction(()=>Date.parse(window.fixtureLastMatch.players[0].dodge_until)<Date.now());
 }
 for(const [width,height]of [[667,375],[844,390],[932,430]]){await a.setViewportSize({width,height});const boxes=await a.locator('.evasion163 button,.duel-action,#duelStick').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return{name:e.id||e.dataset.evasion,x:b.x,y:b.y,w:b.width,h:b.height};}));assert.equal(await a.locator('.evasion163').count(),0);for(const a of boxes.filter(b=>b.name==='duelStick')){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=width&&a.y+a.h<=height);for(const b of boxes.filter(b=>b.name!==a.name))assert.ok(!(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1),a.name+' overlaps '+b.name);}}
 await a.screenshot({path:path.join(out,'online-motion-v163.png')});assert.deepEqual(errors,[]);console.log(JSON.stringify({sessions:2,realModels:true,touchActions:1,keyboardActions:3,serverAcknowledged:true,viewports:3,errors}));
 await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exitCode=1;});
