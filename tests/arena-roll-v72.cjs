// Render the production gladiator/rig and authored clip in an isolated local arena.
// No accounts or match RPCs: all mesh, texture and equipment files are the actual assets.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/arena-roll-v72';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(root+'/arena.html','utf8'),start=source.indexOf('var ArenaClasses='),end=source.indexOf('</script>',source.indexOf('var ImportedGladiator='));
const script="window.ArenaAssetLoad=async name=>{const r=await fetch(name);if(!r.ok)throw Error(name);return r.arrayBuffer();};\n"+source.slice(start,end);
const markup=`<!doctype html><style>body{margin:0;background:#faf9f6}canvas{display:block}#label{position:absolute;top:14px;left:20px;font:14px sans-serif;color:#591823}</style><div id="label">Yuvarlanma · gerçek oyun modeli</div><script src="/owner-three-r160.js"></script><script src="/arena-fall-motion-v39.js"></script><script src="/arena-ground-fall-v39.js"></script><script src="/arena-roll-motion-v72.js"></script><script src="/arena-roll-v72.js"></script><script>${script}</script>`;
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local');if(u.pathname==='/'){res.setHeader('content-type','text/html');return res.end(markup);}const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
   await ImportedGladiator.load(()=>{});await RomanVisualAssets.ready();
   const T=THREE;window.qa={scene:new T.Scene(),renderer:new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}),camera:new T.PerspectiveCamera(36,1000/600,.1,80)};
   qa.renderer.setSize(1000,600);qa.renderer.setPixelRatio(1);qa.renderer.setClearColor(0xfaf9f6);document.body.append(qa.renderer.domElement);
   qa.scene.add(new T.HemisphereLight(0xffffff,0x666666,2.3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(4,7,4);qa.scene.add(light);
   const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:0xe5e2df,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;qa.scene.add(floor);
   qa.camera.position.set(4,2.7,5.5);qa.camera.lookAt(0,.9,0);
   qa.f=new ArenaCombat(()=>.999).reset().fighters[0];Object.assign(qa.f,{x:0,z:0,angle:0,action:'idle',move:0,walk:0,flash:0,reaction:0});
   qa.m=ImportedGladiator.create(0,'secutor');qa.scene.add(qa.m.root);
   for(let i=0;i<20;i++)ImportedGladiator.animate(qa.f,qa.m,i/60,1/60);
   qa.render=()=>qa.renderer.render(qa.scene,qa.camera);qa.render();
  });
  await page.screenshot({path:out+'/ready.png'});
  const all=[];
  for(const [direction,dx,dz]of [['forward',0,1],['backward',0,-1],['side',1,0]]){
   const samples=await page.evaluate(({dx,dz})=>{
    const {f,m}=qa;Object.assign(f,{x:0,z:0,angle:0,action:'idle',move:0});for(let i=0;i<20;i++)ImportedGladiator.animate(f,m,i/60,1/60);
    Object.assign(f,{action:'dodge',duration:.46,timer:0,dx,dz});const result=[];
    for(let i=0;i<=55;i++){
     f.timer=i/120;ImportedGladiator.animate(f,m,f.timer,1/120);
     const pos=k=>m.bones[k].getWorldPosition(new THREE.Vector3());const head=pos('Head'),hips=pos('Hips');
     result.push({t:f.timer,head:head.toArray(),hips:hips.toArray(),foot:pos('LeftFoot').toArray(),root:m.root.position.toArray(),clip:m.authoredRoll});
    }
    return result;
   },{dx,dz});
   assert.ok(samples.some(s=>s.head[1]<s.hips[1]-.15),'full inversion: '+direction);
   assert.ok(samples.every(s=>s.head.every(Number.isFinite)&&s.head[1]>.08),'head clears floor: '+direction);
   assert.ok(samples.every(s=>s.clip==='Roll'),'authored clip used');
   assert.ok(samples.at(-1).head[1]>1.6,'finishes standing');
   for(let i=1;i<samples.length;i++)assert.ok(Math.hypot(...samples[i].head.map((v,j)=>v-samples[i-1].head[j]))<.4,'continuous retarget');
   all.push({direction,samples});
   // Save representative production poses at quarter intervals.
   for(const [label,phase]of [['tuck',.22],['inverted',.45],['rise',.72],['finish',1]]){
    await page.evaluate(({phase,dx,dz})=>{const {f,m}=qa;f.action='idle';for(let i=0;i<20;i++)ImportedGladiator.animate(f,m,0,1/60);Object.assign(f,{action:'dodge',duration:.46,timer:0,dx,dz});for(let i=0;i<=Math.floor(phase*55);i++){f.timer=i/120;ImportedGladiator.animate(f,m,f.timer,1/120);}qa.render();document.getElementById('label').textContent='YUVARLANMA · '+Math.round(phase*100)+'%';},{phase,dx,dz});
    await page.screenshot({path:out+'/'+direction+'-'+label+'.png'});
   }
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/motion-metrics.json',JSON.stringify(all,null,2));console.log(JSON.stringify({directions:3,realModel:true,fullInversion:true,headClearance:true,errors,out}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
