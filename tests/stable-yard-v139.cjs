const fs=require('fs'),path=require('path'),http=require('http'),{createRequire}=require('module'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/stable-yard-v139';fs.mkdirSync(out,{recursive:true});
const prefix=fs.readFileSync(root+'/tests/production-browser-v122.cjs','utf8').split('const mime=')[0];
let fixture=new Function('require','__dirname',prefix+'\nreturn fixture;')(createRequire(root+'/tests/production-browser-v122.cjs'),root+'/tests');
const stable=JSON.parse(fs.readFileSync('/tmp/stable-fixture-v136.json'));
fixture=fixture.replace('const accountClient=window.__fixtureClient;',`window.__stableState=${JSON.stringify(stable)};__stableState.user_id=__fixtureUser.id;__stableState.gold=99999;__stableState.level=50;__stableState.horses=Array.from({length:12},(_,i)=>({...structuredClone(__stableState.horses[i%__stableState.horses.length]),id:'horse-'+i,name:'Aquila '+(i+1),coat:LudusHorseAppearance.coats[i%7].id,stage:'adult'}));__stableState.house.selected='horse-0';const oldRpc=__fixtureClient.rpc;__fixtureClient.rpc=(name,args={})=>name==='ludus_stable'?Promise.resolve({data:{...structuredClone(__stableState),server_now:new Date().toISOString()}}):name==='ludus_social'?Promise.resolve({data:{friends:[],pending:[],requests:[]}}):oldRpc(name,args);window.LudusClient.create=()=>__fixtureClient;const accountClient=__fixtureClient;`);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();let body=fs.readFileSync(f);if(f.endsWith('/ludus.html'))body=Buffer.from(body.toString().replace('function frame(now){requestAnimationFrame(frame);','function frame(now){requestAnimationFrame(frame);if(window.__freeze)return;').replace(/const accountClient=LudusClient.create\([^;]+;/,()=>fixture));res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'}).end(body);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:874,height:402},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:/,r=>r.abort());
try{await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.LudusPreview?.roster?.filter(g=>g.model?.gear).length===2,null,{timeout:90000});await page.evaluate(async()=>{await LudusPreview.accountReady;await LudusPreview.residentsReady;});await page.waitForFunction(()=>document.getElementById('loading').hidden,null,{timeout:60000});
 await page.evaluate(()=>{const p=LudusPreview;if(!p.exploring)p.toggleExplore();p.enterRoom(p.rooms.find(r=>r.kind==='stable'));});
 await page.waitForFunction(()=>LudusPreview.stableRoom.groom&&LudusPreview.stableRoom.horses.length===12);
 async function render(){await page.evaluate(()=>{const p=LudusPreview;GamePerformance.beginFrame(performance.now());p.followOwner(.05,false);p.camera.updateMatrixWorld(true);p.stableRoom.tick(.04);p.stableSystem.tick();p.roomActions.tick();p.roomScene.updateMatrixWorld(true);p.renderer.render(p.roomScene,p.camera);});}
 await render();await page.screenshot({path:out+'/yard-874.png'});
 assert.equal(await page.locator('.stable-hud').count(),0,'the bottom menu is removed');
 const lights=await page.evaluate(()=>{const p=LudusPreview,types=[];p.stableRoom.root.traverse(o=>{if(o.isLight)types.push(o.type);});return{types,sky:p.roomScene.background===p.scene.background,environment:p.roomScene.environment===p.scene.environment};});
 assert.deepEqual(lights,{types:['DirectionalLight'],sky:true,environment:true});
 // Near the groom the compact world action opens all existing horse tabs.
 await page.getByRole('button',{name:'Seyisle konuş'}).tap();
 await page.locator('.stable-modal:not([hidden])').waitFor();assert.equal(await page.locator('.stable-body').getAttribute('data-view'),'groom');
 assert.equal(await page.locator('.stable-tabs button').count(),7);
 await page.getByRole('button',{name:'Ahır panelini kapat'}).tap();await render();
 // The groom itself is tappable, without opening the panel after camera drags.
 const point=await page.evaluate(()=>{const p=LudusPreview,v=p.stableRoom.groom.position.clone();v.y+=1.1;v.project(p.camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});
 await page.touchscreen.tap(point.x,point.y);await page.locator('.stable-modal:not([hidden])').waitFor();
 await page.getByRole('button',{name:'Ahır panelini kapat'}).tap();await render();
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+45,point.y,{steps:5});await page.mouse.move(point.x,point.y,{steps:5});await page.mouse.up();
 assert.equal(await page.locator('.stable-modal').isVisible(),false,'looking around does not open horse care');
 await page.evaluate(()=>{const p=LudusPreview;p.player.yaw=0;p.player.pitch=.14;});await render();
 await page.keyboard.press('KeyE');await page.locator('.stable-modal:not([hidden])').waitFor();await page.getByRole('button',{name:'Ahır panelini kapat'}).click();
 for(const [width,height]of [[1536,706],[874,402],[667,375],[568,320]]){
  await page.setViewportSize({width,height});await render();
  const b=await page.locator('#stableGroomAction').boundingBox();assert.ok(b&&b.width>=44&&b.height>=44&&b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height,'groom action fits '+width);
  const head=await page.evaluate(()=>{const p=LudusPreview,v=p.stableRoom.groom.position.clone();v.y+=p.stableRoom.groom.userData.height+.2;v.project(p.camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});assert.ok(Math.abs(b.x+b.width/2-head.x)<3&&Math.abs(b.y+b.height/2-head.y)<3,'action stays attached to groom at '+width);
  await page.screenshot({path:out+'/yard-'+width+'.png'});
 }
 await page.evaluate(()=>{const p=LudusPreview;p.player.x=0;p.player.z=-35;});await render();
 assert.equal(await page.locator('#stableGroomAction').isVisible(),false,'groom action requires proximity');
 await page.screenshot({path:out+'/yard-rear.png'});
 await page.evaluate(()=>{const p=LudusPreview;p.leaveRoom();p.enterRoom(p.rooms.find(r=>r.kind==='office'));p.followOwner(.05,false);p.renderer.render(p.roomScene,p.camera);});
 assert.equal(await page.locator('#stableGroomAction').isVisible(),false);
 assert.equal(await page.evaluate(()=>LudusPreview.roomScene.background===LudusPreview.scene.background),false,'interior lighting is restored');
 for(let i=0;i<3;i++){await page.evaluate(()=>{const p=LudusPreview;p.leaveRoom();p.enterRoom(p.rooms.find(r=>r.kind==='stable'));});await render();}
 assert.equal(await page.evaluate(()=>{let count=0;LudusPreview.roomProps.traverse(o=>{if(o.isLight)count++;});return count;}),1,'re-entry reuses the sun');
 assert.equal(await page.locator('#stableGroomAction').count(),1,'re-entry reuses the interaction');
 await page.evaluate(()=>{__stableState.horses=[];__stableState.house.selected=null;return LudusPreview.stableSystem.refresh();});await render();
 await page.getByRole('button',{name:'Seyisle konuş'}).tap();await page.getByRole('button',{name:'Pazar',exact:true}).click();assert.ok(await page.locator('.stable-founder').isVisible(),'the groom also opens the market before owning a horse');
 assert.deepEqual(errors,[]);console.log('V139 yard PASS: actual scene, twelve horses, open-air daylight, groom tap and E, no bottom bar, four phone/desktop sizes, distance gating and room restoration.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
