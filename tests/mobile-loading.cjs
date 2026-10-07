// Real HTTP + real models; only account/RPC data are isolated fixtures.
// BASELINE_ROOT=/path/to/af08a6a NODE_PATH=/path/to/modules node tests/mobile-loading.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {PNG} = require('pngjs');
const root = path.resolve(process.env.MOBILE_ROOT || path.join(__dirname, '..'));
const output = process.env.LUDUS_TEST_OUTPUT || path.join(root, 'docs/mobile-performance');
fs.mkdirSync(output, {recursive:true});
const user = '00000000-0000-4000-8000-000000000001';
const fighters = ['hoplomachus', 'retiarius'].map((type, i) => ({id:'fighter'+i, name:['Cassius','Titus'][i], class:type, owner_id:user, overall:50, status:'available', session:null}));
const items = fighters.flatMap(g => ['helmet','chest','shoulders','legs','main_hand'].map(slot => ({id:g.id+slot, equipped_by:g.id, equipped_slot:slot, kind:slot==='main_hand'?'weapon':slot, model:slot==='main_hand'?'gladius':slot==='helmet'?'gladiator':slot==='chest'?'gladiator_chest':slot==='shoulders'?'armor_shoulder':'legs'})));
const fixture = `
const fixtureUser={id:${JSON.stringify(user)},is_anonymous:false,user_metadata:{}};
const fixtureFighters=${JSON.stringify(fighters)},fixtureItems=${JSON.stringify(items)};
window.__fixtureClient={auth:{getUser:async()=>({data:{user:fixtureUser},error:null}),getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})},
from:name=>{let value=name==='ludus_accounts'?{user_id:fixtureUser.id,ludus_name:'Tırman',gold:4800,diamonds:2}:name==='ludus_gladiators'?fixtureFighters:name==='ludus_items'?fixtureItems:[];let b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value,error:null}),then:(r,j)=>Promise.resolve({data:value,error:null}).then(r,j)};return b;},
rpc:async(name)=>({data:name==='ludus_clan'||name==='ludus_clan_vault'?{server_now:new Date().toISOString(),clan:{id:'clan1',name:'Legio Aurea',gold:7800,level:3,member_count:8,capacity:12,emblem:2,emblem_color:'#c7a967',background:'#541d2b'},wallet:{gold:4800,ludus_name:'Tırman'},is_leader:true,vault_access:true,trophies:{league:2,cup:1},gladiators:fixtureFighters,vault:[],inventory:[],vault_stones:[],inventory_stones:[]}:name==='ludus_progress'?{level:1,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_imperial'?{server_now:new Date().toISOString(),missions:[],assignments:[],gladiators:fixtureFighters,is_admin:false,today:'2026-10-08'}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:{server_now:new Date().toISOString(),gladiators:fixtureFighters},error:null})};
`;
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const servers = [];
function snapshotDiff(a,b) {
 const x=PNG.sync.read(fs.readFileSync(a)),y=PNG.sync.read(fs.readFileSync(b));
 assert.equal(x.width,y.width);assert.equal(x.height,y.height);
 let sum=0,changed=0;
 for(let i=0;i<x.data.length;i+=4){let d=0;for(let c=0;c<3;c++){const v=Math.abs(x.data[i+c]-y.data[i+c]);sum+=v;d=Math.max(d,v);}if(d>16)changed++;}
 return {meanAbsoluteChannelDifference:sum/(x.width*x.height*3),fractionPixelsDifferenceAbove16:changed/(x.width*x.height)};
}
async function measure(source,label,browser) {
 const requests=[],errors=[];let stage='startup';
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');const file=path.resolve(source,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(source+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let body=fs.readFileSync(file);const sourceBytes=body.length;
  const gzipBytes=zlib.gzipSync(body).length;
  if(url.pathname==='/ludus.html') body=Buffer.from(body.toString().replace('const accountClient=supabase.createClient','let accountClient=supabase.createClient').replace('const accountReady=(async()=>{',fixture+'\nconst accountReady=(async()=>{accountClient=window.__fixtureClient;').replace('function frame(now){requestAnimationFrame(frame);','function frame(now){requestAnimationFrame(frame);if(window.__freezeFrame){imperial.tick();clanVault?.tick();if(window.__renderOnce){renderer.render(activeRoom?roomScene:scene,camera);window.__renderOnce=false;}return;}'));
  requests.push({stage,url:url.pathname+url.search,sourceBytes,gzipBytes});
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','content-length':body.length,'cache-control':'public,max-age=600','content-security-policy':"connect-src 'self'"});res.end(body);
 });
 servers.push(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const start=Date.now();await page.goto(base+'/ludus.html');
 await page.waitForFunction(()=>window.LudusPreview?.exploring,null,{timeout:90000});
 const courtyardReadyMs=Date.now()-start;
 await page.evaluate(async()=>{const w=LudusPreview;await Promise.all([w.residentsReady,w.city.ready,w.ownerAvatar.ready]);});
 await page.waitForFunction(()=>LudusPreview.roster.every(g=>g.model),null,{timeout:90000});
 // Include the old idle arena prefetch and any late equipment completions.
 await page.waitForTimeout(1800);
 const startupMs=Date.now()-start;
 async function capture(name) {
  await page.evaluate(()=>{window.__freezeFrame=true;window.__renderOnce=true;});
  await page.waitForFunction(()=>window.__renderOnce===false);
  const file=path.join(output,label+'-'+name+'.png');await page.screenshot({path:file});return path.basename(file);
 }
 // Fixed time eliminates owner and fighter motion from visual comparisons.
 await page.evaluate(()=>{const w=LudusPreview;w.ownerAvatar.root.visible=false;w.roster.forEach(g=>g.body.visible=false);Object.assign(w.player,{x:0,y:0,z:8,yaw:Math.PI,pitch:.05});w.followOwner(.1,false);});
 const screenshots=[await capture('courtyard')];
 const startup=await page.evaluate(()=>({resources:performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).map(r=>({url:new URL(r.name).pathname+new URL(r.name).search,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,duration:r.duration})),renderer:{geometries:LudusPreview.renderer.info.memory.geometries,textures:LudusPreview.renderer.info.memory.textures,calls:LudusPreview.renderer.info.render.calls,triangles:LudusPreview.renderer.info.render.triangles}}));
 stage='office';await page.evaluate(async()=>{const w=LudusPreview;w.enterRoom(w.rooms.find(r=>r.kind==='office'));await Promise.all([w.imperial.officeReady,w.imperial.deskReady]);await new Promise(r=>setTimeout(r,200));Object.assign(w.player,{x:0,y:0,z:2.6,yaw:0,pitch:-.06});w.followOwner(.1,false);});
 screenshots.push(await capture('office'));
 const office=await page.evaluate(()=>({colliders:LudusPreview.roomColliders.map(c=>({...c})),hotspots:[...document.querySelectorAll('.office-object-hotspot')].map(x=>({label:x.getAttribute('aria-label'),visible:!x.hidden}))}));
 assert.ok(office.colliders.some(c=>c.kind==='desk'));assert.ok(office.colliders.some(c=>c.kind==='wardrobe'));
 stage='clan';await page.evaluate(async()=>{const w=LudusPreview;w.leaveRoom();w.enterRoom(w.rooms.find(r=>r.kind==='clan'));await w.clanVault.chestReady;await new Promise(r=>setTimeout(r,250));Object.assign(w.player,{x:1.2,y:0,z:.1,yaw:.05,pitch:-.05});w.followOwner(.1,false);});
 await page.waitForSelector('#clanVaultMarker:not([hidden])');screenshots.push(await capture('clan'));
 await page.getByRole('button',{name:'Klan sandığını aç',exact:true}).click();await page.waitForSelector('.clan-vault-modal:not([hidden])');assert.equal(await page.locator('.clan-vault-panel').count(),2);
 await page.getByRole('button',{name:'Klan sandığını kapat',exact:true}).click();
 const clan=await page.evaluate(()=>({colliders:LudusPreview.roomColliders.filter(c=>c.kind==='clan-chest')}));assert.equal(clan.colliders.length,1);
 stage='repeat-rooms';await page.evaluate(async()=>{const w=LudusPreview;w.leaveRoom();w.enterRoom(w.rooms.find(r=>r.kind==='office'));await w.imperial.officeReady;w.leaveRoom();w.enterRoom(w.rooms.find(r=>r.kind==='clan'));await w.clanVault.chestReady;});await page.waitForTimeout(300);
 assert.equal(requests.filter(r=>r.stage==='repeat-rooms'&&r.url.includes('.glb')).length,0,'room assets must be reused');
 stage='reload';await page.reload();await page.waitForFunction(()=>LudusPreview?.exploring,null,{timeout:90000});await page.evaluate(async()=>{await LudusPreview.residentsReady;});await page.waitForTimeout(1000);
 assert.deepEqual(errors,[]);
 const result={label,courtyardReadyMs,startupMs,requests,startup,office,clan,screenshots,errors,sourceStartupBytes:requests.filter(r=>r.stage==='startup').reduce((n,r)=>n+r.sourceBytes,0)};
 await context.close();await new Promise(r=>server.close(r));return result;
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const before=process.env.BASELINE_ROOT?await measure(path.resolve(process.env.BASELINE_ROOT),'before',browser):null;
  const after=await measure(root,'after',browser);
  const comparison=before?{savedSourceBytes:before.sourceStartupBytes-after.sourceStartupBytes,visual:Object.fromEntries(['courtyard','office','clan'].map(name=>[name,snapshotDiff(path.join(output,'before-'+name+'.png'),path.join(output,'after-'+name+'.png'))]))}:null;
  const sourceHashes=Object.fromEntries(['ludus.html','owner-avatar.js','imperial-missions-v31.js','clan-vault-v35.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  fs.writeFileSync(path.join(output,'measurement.json'),JSON.stringify({environment:{browser:'Chromium '+browser.version()+', SwiftShader',viewport:'844x390, DPR 1, touch',network:'local HTTP, uncompressed, fresh context; HTTPS backend mocked',physicalIPhone:false,baselineCommit:'af08a6a',sourceHashes},before,after,comparison},null,2)+'\n');
  if(before){assert.deepEqual(after.office.colliders,before.office.colliders);assert.deepEqual(after.clan.colliders,before.clan.colliders);for(const v of Object.values(comparison.visual))assert.ok(v.meanAbsoluteChannelDifference<2,'visual regression');assert.ok(comparison.savedSourceBytes>15*1024*1024,'startup reduction');}
  if(!process.env.MOBILE_RECORD_ONLY){
   assert.equal(after.requests.filter(r=>r.stage==='startup'&&/\/(Colosseum|imperial-desk|office-wardrobe|office-daily-book|clan-chest)/.test(r.url)).length,0,'no arena or room assets at startup');
   assert.equal(after.requests.filter(r=>r.stage==='office'&&r.url.includes('office-daily-book')).length,1,'one download for both books');
   assert.equal(after.requests.filter(r=>r.stage==='reload'&&r.url.includes('owner-makehuman')).length,0,'large owner GLB survives reload through the persistent cache');
  }
  console.log(JSON.stringify({pass:true,comparison,sourceStartupBytes:after.sourceStartupBytes,output}));
 } finally {await browser.close();for(const server of servers)if(server.listening)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
