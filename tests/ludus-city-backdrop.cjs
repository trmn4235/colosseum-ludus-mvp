// Real city geometry, textures and renderer; isolated account fixtures only.
// CITY_BASELINE_ROOT=/path/to/pr4-before-city node tests/ludus-city-backdrop.cjs
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..');
const output=process.env.CITY_TEST_OUTPUT||path.join(root,'docs/city-performance');
fs.mkdirSync(output,{recursive:true});
const user='00000000-0000-4000-8000-000000000001';
const fighters=['hoplomachus','retiarius'].map((type,i)=>({id:'fighter'+i,name:['Cassius','Titus'][i],class:type,owner_id:user,overall:50,status:'available',session:null}));
const fixture=`
const fixtureUser={id:${JSON.stringify(user)},is_anonymous:false,user_metadata:{}};
const fixtureFighters=${JSON.stringify(fighters)};
window.__fixtureClient={auth:{getUser:async()=>({data:{user:fixtureUser},error:null}),getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})},
from:name=>{let value=name==='ludus_accounts'?{user_id:fixtureUser.id,ludus_name:'Tırman',gold:4800,diamonds:2}:name==='ludus_gladiators'?fixtureFighters:[];let b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value,error:null}),then:(r,j)=>Promise.resolve({data:value,error:null}).then(r,j)};return b;},
rpc:async(name)=>({data:name==='ludus_clan'||name==='ludus_clan_vault'?{server_now:new Date().toISOString(),clan:{id:'clan1',name:'Legio Aurea',gold:7800,level:3,member_count:8,capacity:12,emblem:2,emblem_color:'#c7a967',background:'#541d2b'},wallet:{gold:4800,ludus_name:'Tırman'},is_leader:true,vault_access:true,trophies:{league:2,cup:1},gladiators:fixtureFighters,vault:[],inventory:[],vault_stones:[],inventory_stones:[]}:name==='ludus_progress'?{level:1,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_imperial'?{server_now:new Date().toISOString(),missions:[],assignments:[],gladiators:fixtureFighters,is_admin:false,today:'2026-10-08'}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:{server_now:new Date().toISOString(),gladiators:fixtureFighters},error:null})};`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
async function measure(source,label,browser,failure=null){
const requests=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(source,'.'+decodeURIComponent(url.pathname));
 if(failure==='atlas'&&/^\/assets\/city\/rome-backdrop-.*\.webp$/.test(url.pathname)){requests.push({url:url.pathname,bytes:0,status:404});res.writeHead(404);res.end();return;}
 if(!file.startsWith(source+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 let body=fs.readFileSync(file);requests.push({url:url.pathname,bytes:body.length});
 if(url.pathname==='/ludus.html')body=Buffer.from(body.toString().replace('const accountClient=supabase.createClient','let accountClient=supabase.createClient').replace('const accountReady=(async()=>{',fixture+'\nconst accountReady=(async()=>{accountClient=window.__fixtureClient;').replace('function frame(now){requestAnimationFrame(frame);','function frame(now){requestAnimationFrame(frame);if(window.__freezeFrame)return;'));
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'public,max-age=600','content-security-policy':"connect-src 'self' blob: data:"});res.end(body);
});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true});
 try{
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().includes("Couldn't load texture"))errors.push(m.text());});
 await page.addInitScript(()=>{window.__freezeFrame=true;});
 await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html');
 await page.waitForFunction(()=>window.LudusPreview?.exploring,null,{timeout:120000});
 await page.evaluate(async()=>{await Promise.all([LudusPreview.city.ready,LudusPreview.residentsReady,LudusPreview.ownerAvatar.ready,RomanVisualAssets.ready()]);});
 const overview=await page.evaluate(()=>{
  const w=LudusPreview;let cityTriangles=0,meshes=0,materials=new Set();w.city.root.traverse(o=>{if(o.isMesh){meshes++;cityTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  return{mode:w.city.mode||'3d',cityTriangles,meshes,materials:materials.size,backdropError:!!w.scene.userData.cityBackdropLoadError,landmarks:w.city.landmarks};
 });
 const views=[],images=new Map();
 const poses=[];
 for(const point of [{name:'courtyard',x:0,z:0,y:0},{name:'gallery-left',x:-11,z:8.6,y:3.47},{name:'gallery-right',x:10,z:8.6,y:3.47}])for(let angle=0;angle<8;angle++)poses.push({...point,name:point.name+'-'+angle,yaw:angle*Math.PI/4,pitch:angle%2?.35:-.1});
 // Remove the foreground for three diagnostic views, to expose city silhouette/detail.
 for(const [name,x,z,yaw]of [['city-centre',0,0,-1.47],['city-left',-13,9,.236],['city-right',13,-10,-2.1]])poses.push({name,x,z,y:3.47,yaw,pitch:-.1,cityOnly:true});
 if(failure)poses.splice(1);
 for(const pose of poses){
  const cost=await page.evaluate(pose=>{const w=LudusPreview;Object.assign(w.player,pose);w.followOwner(.001,false);w.ownerAvatar.root.visible=false;w.roster.forEach(g=>g.body.visible=false);
   if(pose.cityOnly)for(const child of w.scene.children)if(child!==w.city.root&&!child.isLight)child.visible=false;
   const gl=w.renderer.getContext(),pixel=new Uint8Array(4),complete=()=>gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
   for(let i=0;i<2;i++)w.renderer.render(w.scene,w.camera);complete();
   const times=[];
   if(['courtyard-0','gallery-left-0','gallery-right-6'].includes(pose.name)){
    // Include the fixed-pose owner/fighters; readback synchronizes the GPU command stream.
    w.ownerAvatar.root.visible=true;w.roster.forEach(g=>g.body.visible=true);
    for(let i=0;i<2;i++){w.renderer.render(w.scene,w.camera);complete();}
    for(let i=0;i<5;i++){const start=performance.now();w.renderer.render(w.scene,w.camera);complete();times.push(performance.now()-start);}
    w.ownerAvatar.root.visible=false;w.roster.forEach(g=>g.body.visible=false);w.renderer.render(w.scene,w.camera);complete();
   }
   const all={...w.renderer.info.render};w.city.root.visible=false;w.renderer.render(w.scene,w.camera);const without={...w.renderer.info.render};w.city.root.visible=true;w.renderer.render(w.scene,w.camera);gl.finish();return{all,without,camera:w.camera.position.toArray(),times};},pose);
  const screenshot=await page.locator('#scene').screenshot();images.set(pose.name,screenshot);
  if(['gallery-left-0','gallery-right-6','city-centre'].includes(pose.name))fs.writeFileSync(path.join(output,label+'-'+pose.name+'.png'),screenshot);
  views.push({pose,cost});
  if(views.length%8===0)console.log(label+': checked '+views.length+' views');
 }
 const functional=await page.evaluate(async()=>{const w=LudusPreview;
  const colliderCount=w.colliders.length,cameraObstacleCount=w.cameraObstacles.length;
  Object.assign(w.player,{x:0,z:0,y:0,yaw:0,pitch:-.1});w.move(100,100);const boundary={x:w.player.x,z:w.player.z};
  w.enterRoom(w.rooms.find(r=>r.kind==='office'));await Promise.all([w.imperial.officeReady,w.imperial.deskReady]);const office=w.roomColliders.map(c=>({...c}));w.leaveRoom();
  w.enterRoom(w.rooms.find(r=>r.kind==='clan'));await w.clanVault.chestReady;
  const deadline=performance.now()+5000;while(!w.roomColliders.some(c=>c.kind==='clan-chest')&&performance.now()<deadline){w.clanVault.tick();await new Promise(r=>setTimeout(r,20));}
  const clan=w.roomColliders.map(c=>({...c}));w.leaveRoom();
  return{colliderCount,cameraObstacleCount,boundary,office,clan};
 });
 assert.deepEqual(errors,[]);assert.ok(functional.boundary.x<=13.35&&functional.boundary.z<=11.35);assert.ok(functional.office.some(c=>c.kind==='desk'));assert.ok(functional.clan.some(c=>c.kind==='clan-chest'));
 const cityFiles=['rome-insula-v30.glb','rome-forum-v30.glb','rome-temple-v30.glb','rome-gateway-v30.glb','colosseum-city-v29.glb','pantheon-city-v29.glb'];
 const network={cityModelBytes:requests.filter(r=>cityFiles.includes(r.url.slice(1))).reduce((n,r)=>n+r.bytes,0),backdropBytes:requests.filter(r=>r.url.startsWith('/assets/city/')).reduce((n,r)=>n+r.bytes,0),sourceStartupBytes:requests.filter(r=>!/^\/(imperial-desk|office-wardrobe|office-daily-book|clan-chest)/.test(r.url)).reduce((n,r)=>n+r.bytes,0)};
 console.log(JSON.stringify({label,overview,network,views:views.length,pass:true}));
 return{record:{label,overview,network,views,requests,errors,functional},images};
 }finally{await context.close();await new Promise(r=>server.close(r));}
}
function imageDiff(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);assert.equal(x.width,y.width);assert.equal(x.height,y.height);let sum=0,changed=0;for(let i=0;i<x.data.length;i+=4){let d=0;for(let c=0;c<3;c++){const v=Math.abs(x.data[i+c]-y.data[i+c]);sum+=v;d=Math.max(d,v);}if(d>16)changed++;}return{meanAbsoluteChannelDifference:sum/(x.width*x.height*3),fractionPixelsDifferenceAbove16:changed/(x.width*x.height)};}
function median(values){const v=[...values].sort((a,b)=>a-b);return v[Math.floor(v.length/2)];}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const before=process.env.CITY_BASELINE_ROOT?await measure(path.resolve(process.env.CITY_BASELINE_ROOT),'before',browser):null;
 const after=await measure(root,'after',browser);
 const fallback=await measure(root,'fallback',browser,'atlas');
 assert.equal(after.record.overview.mode,'backdrop');assert.equal(after.record.network.cityModelBytes,0);assert.ok(after.record.overview.cityTriangles<400);assert.equal(fallback.record.overview.mode,'3d');assert.equal(fallback.record.overview.backdropError,true);assert.equal(fallback.record.network.cityModelBytes,19300648);
 let comparison=null;
 if(before){
  assert.deepEqual(after.record.functional,before.record.functional);assert.deepEqual(after.record.overview.landmarks,before.record.overview.landmarks);
  const visual=Object.fromEntries([...after.images].map(([name,b])=>[name,imageDiff(before.images.get(name),b)]));
  const render=after.record.views.filter(v=>v.cost.times.length).map(v=>{const old=before.record.views.find(o=>o.pose.name===v.pose.name);return{name:v.pose.name,beforeMedianMs:median(old.cost.times),afterMedianMs:median(v.cost.times),beforeTriangles:old.cost.all.triangles,afterTriangles:v.cost.all.triangles,beforeCalls:old.cost.all.calls,afterCalls:v.cost.all.calls};});
  comparison={savedCityBytes:before.record.network.cityModelBytes-after.record.network.backdropBytes,visual,render};
  if(!process.env.CITY_RECORD_ONLY)for(const [name,v]of Object.entries(visual))assert.ok(v.meanAbsoluteChannelDifference<(name.startsWith('city-')?2:1),'visual regression: '+name+' '+v.meanAbsoluteChannelDifference);
 }
 const hashes=Object.fromEntries(['ludus.html','ludus-city-v29.js','assets/city/rome-backdrop-v39.json'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
 fs.writeFileSync(path.join(output,'measurement.json'),JSON.stringify({environment:{browser:browser.version(),renderer:'Chromium/SwiftShader, one-pixel readback per timed frame; fixed-pose owner and two fighters visible',viewport:'844x390 DPR 1 touch',physicalIPhone:false,baselineTree:'b8fe9ed2f62aa9b98c4d62696725872fbf55e037',sourceHashes:hashes},before:before?.record,after:after.record,fallback:fallback.record,comparison},null,2)+'\n');
 console.log(JSON.stringify({pass:true,comparison,output}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
