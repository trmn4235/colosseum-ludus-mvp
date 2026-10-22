// The actual ludus page, renderer, room entry and models; only account data is isolated.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/stable-scene-v159';fs.mkdirSync(out,{recursive:true});
const uid='00000000-0000-4000-8000-000000000159';
const horse=(i)=>({id:'horse-'+i,name:'Aquila '+(i+1),sex:i%2?'male':'female',stage:'adult',coat:['dark_brown','black','white','grey','caramel','pinto','light_brown'][i%7],quality:70,feed_bar:90,energy:100,stats:{speed:70,stamina:70,power:70,agility:70,burst:70,temperament:70},genes:{},training:{},nutrition:70,training_history:70,care:80,experience:0,parents:[],sessions:0,matches:0,wins:0,lifetime_hours:0});
const stable={user_id:uid,gold:1000,level:50,capacity:12,reserved:0,horses:Array.from({length:12},(_,i)=>horse(i)),house:{selected:'horse-0',feed_grade:75,feed_stock:{50:0,75:10,100:0},auto_feed:true},requests:[],studs:[],market:[],rules:{weights:{},pregnancy_seconds:3600},duel:null};
const fixture=`
window.__rpcCalls=[];window.__stableState=${JSON.stringify(stable)};
window.__fixtureClient={
auth:{getUser:async()=>({data:{user:{id:'${uid}',is_anonymous:false,user_metadata:{}}}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})},
from:name=>{const value=name==='ludus_accounts'?{user_id:'${uid}',ludus_name:'Test Ludus',gold:1000,diamonds:3}:[];const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value}),then:(r,j)=>Promise.resolve({data:value}).then(r,j)};return b;},
rpc:async(name,args={})=>{
__rpcCalls.push({name,args});const common={server_now:new Date().toISOString(),user_id:'${uid}',gladiators:[]};
if(name==='ludus_stable')return{data:{...common,...structuredClone(__stableState)}};
if(name==='ludus_training_state')return{data:common};
if(name==='ludus_first_quests')return{data:{...common,should_open:false,quests:{},count:0,total:22,starters:[]}};
if(name==='ludus_imperial')return{data:{...common,missions:[],assignments:[],is_admin:false,today:'2026-10-22'}};
if(name==='ludus_progress')return{data:{level:50,current_exp:0,next_exp:0,rewards:[],claimable_count:0}};
if(name==='ludus_clan')return{data:{clan:null}};
if(name==='ludus_social')return{data:{friends:[],pending:[],requests:[]}};
if(name==='ludus_message_center')return{data:{...common,friends:[],conversations:[],unread:0,can_send:false,messages:[],message_total:0,notifications:[],notification_total:0,approvals:[],approval_total:0}};
return{error:{message:'Unavailable isolated test feature: '+name}};
}};LudusClient.create=()=>window.__fixtureClient;const accountClient=window.__fixtureClient;`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();let body=fs.readFileSync(f);if(f.endsWith('/ludus.html'))body=Buffer.from(body.toString().replace('function frame(now){requestAnimationFrame(frame);','function frame(now){requestAnimationFrame(frame);if(window.__freeze)return;').replace(/const accountClient=LudusClient.create\([^;]+;/,()=>fixture));res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'}).end(body);});
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:874,height:402},hasTouch:true}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
page.on('console',m=>{if(m.type()==='error'){console.error('CONSOLE',m.text().slice(0,350));if(m.text().includes('WebGLProgram'))errors.push(m.text());}});
await page.route(/^https:/,r=>r.abort());
try{
await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html?room=stable',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.LudusPreview&&document.getElementById('loading').hidden,null,{timeout:90000});
await page.waitForFunction(()=>LudusPreview.stableRoom.groom&&LudusPreview.stableRoom.horses.length===12,null,{timeout:60000});
await page.evaluate(()=>LudusPreview.ownerAvatar.ready);
// A shader can compile with a missing image; wait for the actual sourced maps before judging its appearance.
await page.waitForFunction(()=>{
 const materials=new Set();LudusPreview.stableRoom.root.traverse(o=>{if(o.material?.userData.source)materials.add(o.material);});
 return materials.size>=3&&[...materials].every(m=>['map','bumpMap','roughnessMap'].every(key=>m[key]?.image?.complete&&m[key].image.naturalWidth===1024));
},null,{timeout:30000});
const loadedMaterials=await page.evaluate(()=>{
 const materials=new Set();LudusPreview.stableRoom.root.traverse(o=>{if(o.material?.userData.source)materials.add(o.material);});
 return [...materials].map(m=>({source:m.userData.source,colorSpace:m.map.colorSpace,heightColorSpace:m.bumpMap.colorSpace,roughnessColorSpace:m.roughnessMap.colorSpace,files:['map','bumpMap','roughnessMap'].map(key=>m[key].image.currentSrc)}));
});
assert.ok(loadedMaterials.every(m=>m.colorSpace==='srgb'&&m.heightColorSpace===''&&m.roughnessColorSpace===''),'PBR data maps must not undergo color correction');
async function render(){await page.evaluate(()=>{const p=LudusPreview;p.followOwner(.05,false);p.camera.updateMatrixWorld(true);p.stableRoom.tick(.04);p.stableSystem.tick();p.roomActions.tick();p.roomScene.updateMatrixWorld(true);p.renderer.shadowMap.needsUpdate=true;p.renderer.render(p.roomScene,p.camera);});}
async function capture(name){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const bytes=await page.screenshot({path:out+'/'+name}),img=PNG.sync.read(bytes),colors=new Set();
 for(let y=90;y<img.height-20;y+=12)for(let x=20;x<img.width-20;x+=12){const i=(y*img.width+x)*4;colors.add([img.data[i]>>4,img.data[i+1]>>4,img.data[i+2]>>4].join(','));}
 assert.ok(colors.size>16,'the screenshot contains the rendered scene, not an empty cleared canvas: '+name);
}
await render();await capture('entry-874.png');
const state=await page.evaluate(()=>{const p=LudusPreview;return{version:document.body.dataset.stableScene,features:p.stableRoom.root.userData,player:{...p.player},bounds:p.roomBounds,horses:p.stableRoom.horses.length,calls:p.renderer.info.render.calls,triangles:p.renderer.info.render.triangles};});console.log(JSON.stringify(state));
assert.equal(state.version,'160');assert.equal(state.horses,12);assert.equal(state.features.wallHeight,5.6);
assert.equal(await page.evaluate(()=>LudusPreview.allowed(0,-18)),true,'the entire route from the yard to the apron is open');
assert.equal(await page.evaluate(()=>LudusPreview.allowed(0,-22)),false,'the half gates block entry into occupied horse rooms');
await page.evaluate(()=>{const p=LudusPreview;for(const x of [-18.7,-8.5,1.7,18.7]){if(!p.allowed(x,-18.2))throw Error('blocked frontage '+x);}const ray=new THREE.Raycaster();for(const [x,z]of [[0,-10],[-12,-8],[12,-8],[0,1]]){ray.set(new THREE.Vector3(x,2,z),new THREE.Vector3(0,1,0));if(ray.intersectObject(p.stableRoom.root,true).length)throw Error('training yard roofed at '+x+','+z);}});
await page.getByRole('button',{name:'Seyisle konuş'}).click();await page.locator('.stable-modal:not([hidden])').waitFor();
assert.equal(await page.locator('.stable-tabs button').count(),7);
await page.getByRole('button',{name:'Ahır panelini kapat'}).click();await render();
for(const [width,height]of [[1280,720],[568,320]]){await page.setViewportSize({width,height});await render();await capture('entry-'+width+'.png');}
await page.setViewportSize({width:1280,height:720});
await page.evaluate(()=>{Object.assign(LudusPreview.player,{x:-6.2,z:-17.9,yaw:-.38,pitch:-.02});});await render();await capture('stone-rooms-1280.png');
await page.evaluate(()=>{Object.assign(LudusPreview.player,{x:-12,z:-15.5,yaw:Math.PI-.30,pitch:.24});});await render();await capture('sand-yard-1280.png');
for(let i=0;i<2;i++){await page.evaluate(()=>{const p=LudusPreview;p.leaveRoom();p.enterRoom(p.rooms.find(r=>r.kind==='stable'));});await render();}
assert.equal(await page.evaluate(()=>LudusPreview.roomProps.children.filter(o=>o===LudusPreview.stableRoom.root).length),1);
assert.equal(await page.evaluate(()=>__rpcCalls.filter(r=>r.name==='ludus_stable'&&r.args.p_action).length),0,'verification never buys or changes a horse');
// Return navigation uses the real saved frame; old floor-plan positions must not override the new entry.
await page.route('**/pazar.html*',route=>route.fulfill({contentType:'text/html',body:'<p>Navigation fixture</p>'}));
await page.evaluate(()=>{Object.assign(LudusPreview.player,{x:7,z:-18.2});LudusNavigation.go('pazar.html');});
await page.waitForURL('**/pazar.html*');const frameId=new URL(page.url()).searchParams.get('nav');assert.ok(frameId);
await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html?restore='+frameId);
await page.waitForFunction(()=>window.LudusPreview&&document.getElementById('loading').hidden,null,{timeout:90000});
assert.equal(await page.evaluate(()=>LudusPreview.player.z),-18.2,'current floor-plan position survives a return');
await page.evaluate(id=>{const key='ludus-return-v12:'+id,record=JSON.parse(sessionStorage.getItem(key));record.state.stableLayout=141;record.state.player={x:0,y:0,z:1.6,yaw:0,pitch:.14};sessionStorage.setItem(key,JSON.stringify(record));},frameId);
await page.reload();await page.waitForFunction(()=>window.LudusPreview&&document.getElementById('loading').hidden,null,{timeout:90000});
assert.equal(await page.evaluate(()=>LudusPreview.player.z),-10,'legacy floor-plan position falls back to the new entry');
assert.deepEqual(errors,[]);
fs.writeFileSync(out+'/result.json',JSON.stringify({pass:true,state,loadedMaterials,errors},null,2));
console.log('PASS: actual ludus entry, twelve stone rooms, unroofed sand yard, 5.6m walls, clear frontage, groom interaction, three viewports, re-entry, no account mutations.');
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
