// Two isolated sessions consume actual PostgreSQL evade events and animate the real rig.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const {fixtureDatabase:createDatabase,players,setMatch,call,A,B,R}=require('./online-projectiles-v76.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||require('node:os').tmpdir();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
let cleanup=async()=>{};
async function main(){
 const db=await createDatabase();const initial=await players(db,'spear');initial[1].z=8;for(const p of initial){p.stats_version=77;p.gladiator.combat_morale=p.owner===A?100:0;}await setMatch(db,initial);let chain=Promise.resolve(),failNextSpecial=false,lostSpecialState;const inputs=[],actionStates=[];
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
    const setup=`const fixtureUser={id:window.fixtureOwner,is_anonymous:false};supabase.createClient=()=>({auth:{getUser:async()=>({data:{user:fixtureUser},error:null}),getSession:async()=>({data:{session:{user:fixtureUser}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{const response=await fetch('/fixture/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,args,owner:fixtureUser.id})});if(!response.ok)throw Error('Lost response');const result=await response.json();if(name==='ludus_match')window.fixtureLastMatch=result.data;return result;}});window.fixtureAnimations={};window.fixtureSlips={};const fixtureAnimate=ImportedGladiator.animate;ImportedGladiator.animate=function(f,...args){window.fixtureAnimations[f.name]={action:f.action,weapon:f.weapon,offhand:f.offhand};if(f.action==='spearcast')window.fixtureSawThrow=true;if(window.fixtureScene?.children.some(o=>o.name==='online-projectile'&&o.visible))window.fixtureSawFlight=true;if(window.fixtureFreezeSlip&&f.name==='Beta')f.passiveEvade=.18;const before=args[0].bones.Spine2.quaternion.clone();const result=fixtureAnimate.call(this,f,...args);if(f.passiveEvade>0){const entry=window.fixtureSlips[f.name]||{frames:0,change:0,guardFlash:0};entry.frames++;entry.change=Math.max(entry.change,args[0].bones.Spine2.quaternion.angleTo(before));entry.guardFlash=Math.max(entry.guardFlash,f.guardFlash||0);window.fixtureSlips[f.name]=entry;}return result;};const fixtureAdd=THREE.Scene.prototype.add;THREE.Scene.prototype.add=function(...objects){for(const o of objects)if(o.name==='Neberkenezer_Colosseum'){window.fixtureArena=o;window.fixtureScene=this;}return fixtureAdd.apply(this,objects);};`;
    return route.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(root+'/multiplayer-v36.js','utf8')});
   }
   if(u.origin===base)return route.continue();
   const asset=path.join(root,path.basename(u.pathname));if(fs.existsSync(asset)&&fs.statSync(asset).isFile())return route.fulfill({path:asset,contentType:mime[path.extname(asset)]||'application/octet-stream'});
   return route.abort();
  });
  await p.goto(base+'/multiplayer.html?v=revision77',{waitUntil:'domcontentloaded'});
  try{await p.waitForFunction(()=>window.fixtureArena?.userData.drawGroups>0&&!document.getElementById('duelControls').hidden,null,{timeout:60000});}
  catch(e){console.error('Fixture loading state:',await p.locator('#queueMessage').textContent(),await p.locator('#queueCaption').textContent(),errors);throw e;}
  return p;
 }
 // Both fixture players remain connected while the headless renderer loads their models.
 bootHeartbeat=setInterval(()=>serialized(async()=>{await call(db,A,'state');await call(db,B,'state');}).catch(()=>{}),2000);
 const a=await open(A),b=await open(B);clearInterval(bootHeartbeat);
 assert.match(await a.locator('#selfFoodBonus').innerText(),/Moral 100/);assert.match(await b.locator('#selfFoodBonus').innerText(),/Moral 0/);
 for(const [width,height]of [[667,375],[844,390],[1366,768]]){
  await a.setViewportSize({width,height});for(const id of ['#duelAttack','#selfFoodBonus']){const box=await a.locator(id).boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,id);}
 }
 await a.setViewportSize({width:844,height:390});
 await serialized(async()=>{
  const rows=await players(db),now=new Date(),impact=new Date(now-50).toISOString();
  for(const p of rows){p.stats_version=77;p.gladiator.combat_morale=p.owner===A?100:0;}
  rows[1].z=1.25;rows[1].combat_stats.items.dodge_rate=20;
  Object.assign(rows[0],{strike_at:impact,strike_target:B,strike_weapon:'gladius',strike_hand:'main_hand',swing_at:new Date(now-500).toISOString()});
  let result;for(let seed=1;seed<=100;seed++){await db.query('select setseed($1)',[seed/100]);result=(await db.query('select private.ludus_resolve_combat_v36($1,$2) p',[JSON.stringify(rows),now.toISOString()])).rows[0].p;if(result[1].last_defense==='evade')break;}
  assert.equal(result[1].last_defense,'evade');assert.equal(result[1].hp,100);await setMatch(db,result);
 });
 for(const p of [a,b])await p.waitForFunction(()=>window.fixtureSlips.Beta?.frames>=3,null,{timeout:20000});
 for(const p of [a,b]){const slip=await p.evaluate(()=>window.fixtureSlips.Beta);assert.ok(slip.change>.01);assert.equal(slip.guardFlash,0);}
 assert.equal(await a.locator('#rivalHp').evaluate(n=>n.value),100);assert.equal(await b.locator('#selfHp').evaluate(n=>n.value),100);
 await a.evaluate(()=>window.fixtureFreezeSlip=true);await a.waitForTimeout(300);await a.screenshot({path:path.join(out,'arena-completion-v77.png')});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({sessions:2,realModels:true,serverEvadeEvent:true,bodySlip:true,noShieldFlash:true,moraleVisible:true,viewports:3}));
 await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exitCode=1;});
