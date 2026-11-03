// Actual preparation page and decoded models, with isolated local account data.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp':'sharp');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/preparation-v224';
const types=['murmillo','thraex','hoplomachus','secutor','retiarius','provocator','scissor'];
const roster=types.map((type,i)=>({id:'g'+i,class:type,name:type,level:1,status:'available',overall:50,experience:0}));
const items=['halberd','mace','spear','heavy_mace','gladius','trident'].map(model=>({id:model,model,kind:'weapon',name:model,enhancement:0}));
items.push(...['shield_viridis','shield_aquila','small','round'].map(model=>({id:model,model,kind:'shield',name:model,enhancement:0})),{id:'helmet',kind:'helmet',model:'gladiator',name:'Miğfer'},{id:'legs',kind:'legs',model:'greaves',name:'Bacaklık'});
const fixture=`window.__fixture={auth:{getUser:async()=>({data:{user:{id:'test',is_anonymous:false}}})},from:name=>{const data=name==='ludus_accounts'?{gold:1000}:name==='ludus_gladiators'?${JSON.stringify(roster)}:name==='ludus_items'?${JSON.stringify(items)}:[];const b={select:()=>b,eq:()=>b,is:()=>b,limit:()=>b,order:()=>b,single:async()=>({data}),then:(r,j)=>Promise.resolve({data}).then(r,j)};return b;},rpc:async name=>({data:name==='ludus_training_state'?{gladiators:${JSON.stringify(roster)}}:null})};LudusClient.create=()=>__fixture;`;
const expose=`window.__prep={get model(){return model},get state(){return state},get renderer(){return renderer},get scene(){return scene},get camera(){return camera},select(type,weapon,shield){selected=roster.find(g=>g.class===type);drafts.set(selected.id,{main_hand:weapon,off_hand:shield,helmet:'helmet',legs:'legs'});render();updatePreview();}};`;
let browser;const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();let body=fs.readFileSync(f);if(f.endsWith('/savas.html'))body=Buffer.from(body.toString().replace(" const $=id=>document.getElementById(id),client=LudusClient.create",fixture+"\n const $=id=>document.getElementById(id),client=LudusClient.create").replace(' load();\n})();',expose+'\n load();\n})();').replace('function frame(t){requestAnimationFrame(frame);','function frame(t){requestAnimationFrame(frame);if(window.__freeze224)return;'));res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'}).end(body);});
(async()=>{try{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const engine=process.env.LUDUS_TEST_ENGINE==='webkit'?webkit:chromium;
 browser=await engine.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),...(engine===chromium?{args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}:{} )});
 const page=await browser.newPage({viewport:{width:1536,height:706}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/savas.html',{waitUntil:'domcontentloaded'});
 await page.locator('[data-mode="solo20"]').click();await page.waitForFunction(()=>window.__prep?.model,null,{timeout:60000});
 await page.evaluate(async()=>{await Promise.all(['halberd','heavy_mace','shield_viridis','shield_aquila'].map(id=>LudusEquipmentCatalog.load(THREE,id)));});
 const shots=[],report=[];
 for(const type of types)for(const [weapon,shield]of [['halberd','shield_viridis'],['mace','small'],['spear','small'],['heavy_mace','shield_aquila']]){
  await page.evaluate(({type,weapon,shield})=>__prep.select(type,weapon,shield),{type,weapon,shield});
  await page.waitForTimeout(100);
  const result=await page.evaluate(()=>{
   window.__freeze224=true;const {state:f,model:m,renderer:r,scene:s}=__prep,T=THREE;const shots=[];
   r.setPixelRatio(1);r.setSize(420,560,false);s.background=new T.Color('#eeeae1');const cam=new T.PerspectiveCamera(34,420/560,.05,30);cam.position.set(0,1.4,5);cam.lookAt(0,1.3,0);
   for(const [view,angle]of [['front',0],['side',Math.PI/2]]){f.angle=angle;for(let i=0;i<3;i++)ImportedGladiator.animate(f,m,i/30,1/30);m.teamMark.visible=false;r.render(s,cam);shots.push({view,data:r.domElement.toDataURL('image/png').split(',')[1]});}
   const up=new T.Vector3(0,1,0).applyQuaternion(m.gear.shield.group.getWorldQuaternion(new T.Quaternion()));
   if(up.y<.99999)throw Error('Tilted shield');
   let textures=0;m.visual.traverseVisible(o=>{if(o.isSkinnedMesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat.map){if(!mat.map.image?.width)throw Error('Undecoded texture');textures++;}});
   if(!textures)throw Error('No body textures');return{shots,textures};
  });
  for(const shot of result.shots){const name=[type,weapon,shot.view].join('-'),bytes=Buffer.from(shot.data,'base64');fs.writeFileSync(path.join(out,name+'.png'),bytes);shots.push({name,bytes});}report.push({type,weapon,shield,textures:result.textures});
 }
 // Actual item buttons remain live; changes preserve the presentation flag.
 await page.evaluate(()=>{__freeze224=false;__prep.select('hoplomachus','mace','small');});
 await page.locator('#inventory .item').filter({hasText:'Mızrak'}).click();
 assert.equal(await page.evaluate(()=>__prep.state.weapon),'spear');assert.equal(await page.evaluate(()=>__prep.state.presentation224),true);
 await page.screenshot({path:out+'/preparation-page.png'});
 for(const [width,height]of [[844,390],[667,375]]){await page.setViewportSize({width,height});await page.waitForTimeout(120);await page.screenshot({path:out+'/preparation-'+width+'.png'});const dims=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));assert.ok(dims.scrollWidth<=width+1&&dims.scrollHeight<=height+1,'mobile viewport fits '+JSON.stringify(dims));}
 const tiles=[];for(let i=0;i<shots.length;i++){tiles.push({input:await sharp(shots[i].bytes).resize(210,280).toBuffer(),left:i%8*210,top:Math.floor(i/8)*304});tiles.push({input:Buffer.from(`<svg width="210" height="24"><rect width="210" height="24" fill="#eeeae1"/><text x="4" y="16" font-family="sans-serif" font-size="10">${shots[i].name}</text></svg>`),left:i%8*210,top:Math.floor(i/8)*304+280});}
 await sharp({create:{width:1680,height:7*304,channels:3,background:'#eeeae1'}}).composite(tiles).png().toFile(out+'/contact-sheet.png');
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({classes:7,views:shots.length,report,errors},null,2));console.log(JSON.stringify({classes:7,views:shots.length,errors,out}));
 }finally{await browser?.close();server.closeAllConnections();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
