// Real models and real V36 PostgreSQL RPCs, served locally to two isolated browser sessions.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const {createDatabase,players,setMatch,call,A,B,R}=require('./multiplayer-v36.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||require('node:os').tmpdir();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
let cleanup=async()=>{};
async function main(){
 const db=await createDatabase();await setMatch(db);let chain=Promise.resolve(),failNextAttack=false,lostAttackState;const inputs=[],actionStates=[];
 const serialized=fn=>{const next=chain.then(fn);chain=next.catch(()=>{});return next;};
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture.local');
  if(url.pathname==='/fixture/rpc'){
   let body='';for await(const chunk of req)body+=chunk;
   try{const {name,args,owner}=JSON.parse(body);let data;
    if(name==='ludus_match')data=await serialized(async()=>{inputs.push({owner,...args.p_input});return call(db,owner,args.p_action,args.p_input||{});});else data={friends:[],pending:[]};
    if(args.p_input?.attack||args.p_input?.dodge)actionStates.push({owner,input:args.p_input,data});
    if(failNextAttack&&args.p_input?.attack){failNextAttack=false;lostAttackState=data;res.writeHead(502);res.end('Lost response');return;}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data,error:null}));
   }catch(e){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:null,error:{message:e.message}}));}return;
  }
  const local=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!local.startsWith(root+path.sep)||!fs.existsSync(local)||!fs.statSync(local).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':mime[path.extname(local)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(local).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=process.env.LUDUS_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 cleanup=async()=>{await browser.close();await new Promise(r=>server.close(r));await db.close();};
 const errors=[],pages=[];
 async function open(owner){
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:1});const p=await context.newPage();pages.push(p);
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(({owner,R})=>{window.fixtureOwner=owner;sessionStorage.setItem('ludus-match-room',R);sessionStorage.setItem('ludus-duel-selection',JSON.stringify({gladiator:'fixture'}));},{owner,R});
  await p.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/multiplayer-v36.js')){
    const setup=`const fixtureUser={id:window.fixtureOwner,is_anonymous:false};supabase.createClient=()=>({auth:{getUser:async()=>({data:{user:fixtureUser},error:null}),getSession:async()=>({data:{session:{user:fixtureUser}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{const response=await fetch('/fixture/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,args,owner:fixtureUser.id})});if(!response.ok)throw Error('Lost response');return response.json();}});const fixtureAdd=THREE.Scene.prototype.add;THREE.Scene.prototype.add=function(...objects){for(const o of objects)if(o.name==='Neberkenezer_Colosseum'){window.fixtureArena=o;window.fixtureScene=this;}return fixtureAdd.apply(this,objects);};`;
    return route.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(root+'/multiplayer-v36.js','utf8')});
   }
   if(u.origin===base)return route.continue();
   const asset=path.join(root,path.basename(u.pathname));if(fs.existsSync(asset)&&fs.statSync(asset).isFile())return route.fulfill({path:asset,contentType:mime[path.extname(asset)]||'application/octet-stream'});
   return route.abort();
  });
  await p.goto(base+'/multiplayer.html?v=revision36',{waitUntil:'domcontentloaded'});
  try{await p.waitForFunction(()=>window.fixtureArena?.userData.drawGroups>0&&!document.getElementById('duelControls').hidden,null,{timeout:60000});}
  catch(e){console.error('Fixture loading state:',await p.locator('#queueMessage').textContent(),await p.locator('#queueCaption').textContent(),errors);throw e;}
  return p;
 }
 const a=await open(A),b=await open(B);
 assert.equal(await a.locator('#selfName').textContent(),'Hoplomachus');assert.equal(await b.locator('#selfName').textContent(),'Cassius');
 const overlap=(a,b)=>a.left<b.right-.5&&b.left<a.right-.5&&a.top<b.bottom-.5&&b.top<a.bottom-.5;
 for(const [width,height]of [[667,375],[740,360],[844,390],[852,393],[932,430],[1024,768],[1366,768],[2048,944]]){
  await a.setViewportSize({width,height});await a.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const g=await a.evaluate(()=>{
   const rect=n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
   return{scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,controls:[...document.querySelectorAll('#duelActions button')].filter(n=>!n.hidden).map(n=>({id:n.id,rect:rect(n),svg:!!n.querySelector('svg')})),stick:rect(document.getElementById('duelStick')),hud:[...document.querySelectorAll('.mp-health>div,.mp-top>div')].map(rect)};
  });assert.equal(g.scroll,false,width+' scroll');
  for(const c of g.controls){assert.ok(c.svg);assert.ok(c.rect.left>=0&&c.rect.top>=0&&c.rect.right<=width+.5&&c.rect.bottom<=height+.5,width+' clipped '+c.id);assert.ok(!overlap(c.rect,g.stick));}
  for(let i=0;i<g.controls.length;i++)for(let j=i+1;j<g.controls.length;j++)assert.ok(!overlap(g.controls[i].rect,g.controls[j].rect),width+' overlapping controls');
  for(let i=0;i<g.hud.length;i++)for(let j=i+1;j<g.hud.length;j++)assert.ok(!overlap(g.hud[i],g.hud[j]),width+' overlapping HUD '+i+' '+j);
 }
 await a.setViewportSize({width:844,height:390});
 await a.locator('#duelTarget').click();assert.equal(await a.locator('#duelTarget').getAttribute('aria-pressed'),'true');await a.locator('#duelTarget').click();assert.equal(await a.locator('#duelTarget').getAttribute('aria-pressed'),'false');
 async function fresh(){await serialized(()=>setMatch(db));await a.waitForFunction(()=>document.getElementById('selfHp').value===100&&document.getElementById('rivalHp').value===100&&document.getElementById('selfStamina').value===100);}
 for(const [region,dx,dy]of [['chest',0,0],['head',0,-35],['legs',0,35],['leftArm',-35,0],['rightArm',35,0]]){
  await fresh();const n=inputs.length,box=await a.locator('#duelAttack').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await a.mouse.move(x,y);await a.mouse.down();await a.mouse.move(x+dx,y+dy);await a.mouse.up();
  await a.waitForFunction(()=>document.getElementById('rivalHp').value===86);
  const sent=inputs.slice(n).find(x=>x.owner===A&&x.attack);assert.equal(sent.region,region);
  await b.waitForFunction(()=>document.getElementById('selfHp').value===86,'both sessions share damage');
 }
 await fresh();failNextAttack=true;const n=inputs.length;await a.locator('#duelAttack').click();await a.waitForFunction(()=>document.getElementById('rivalHp').value===86);
 const retry=inputs.slice(n).filter(x=>x.owner===A&&x.attack);assert.ok(retry.length>=2);assert.equal(new Set(retry.map(x=>x.attack_id)).size,1,'lost response reuses command ID');
 assert.equal(lostAttackState.players[0].stamina,87,'one attack costs 13 at acceptance');
 let state=await serialized(()=>call(db,A,'state'));assert.equal(state.players[0].serial,1);assert.ok(state.players[0].stamina>=87&&state.players[0].stamina<=100,'retry adds no cost; time may regenerate stamina');
 await fresh();const block=await a.locator('#duelBlock').boundingBox();await a.mouse.move(block.x+block.width/2,block.y+block.height/2);await a.mouse.down();
 await a.waitForFunction(()=>document.getElementById('duelBlock').classList.contains('pressed'));state=await serialized(()=>call(db,A,'state'));assert.equal(state.players[0].block,true);
 await a.mouse.up();await a.waitForFunction(()=>!document.getElementById('duelBlock').classList.contains('pressed'));
 await fresh();const dn=actionStates.length;await a.locator('#duelDodge').click();await a.waitForFunction(()=>document.getElementById('selfStamina').value<80);state=await serialized(()=>call(db,A,'state'));assert.equal(state.players[0].dodge_serial,1);assert.equal(actionStates.slice(dn).find(x=>x.owner===A&&x.input.dodge).data.players[0].stamina,75,'one dodge costs 25 at acceptance');
 await fresh();await a.screenshot({path:path.join(out,'multiplayer-v36-844x390.png')});
 await a.setViewportSize({width:393,height:852});await a.locator('#landscapeGate').waitFor({state:'visible',timeout:5000});
 assert.deepEqual(errors,[],'browser errors');console.log('V36 browser checks passed: real Colosseum, eight viewports, no scrolling/overlap, symbols, target toggle, five swipe regions, two-player damage, lost response retry, held guard, dodge, portrait gate.');
 await cleanup();
}
main().catch(async e=>{console.error(e);await cleanup();process.exitCode=1;});
