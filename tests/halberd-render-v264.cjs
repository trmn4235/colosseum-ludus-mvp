// Render the actual Halberd, skeleton and three cuts in each hand for visual review.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const out=process.env.LUDUS_TEST_OUTPUT||'/tmp/halberd-v264';fs.mkdirSync(out,{recursive:true});
const root=path.resolve(__dirname,'..'),{chromium}=require('playwright');
const {scripts}=(()=>{const scripts=p=>[...fs.readFileSync(root+'/'+p,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);return{scripts}})();
const src=scripts('arena.html'),gfx=src.find(s=>s.includes('var ImportedGladiator=')),end=gfx.indexOf('})();',gfx.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5;
const combat=src.find(s=>s.includes('var ArenaClasses=')),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);",start=combat.indexOf('var ArenaClasses='),finish=combat.indexOf(ending,combat.indexOf(marker,start))+ending.length;
const deps=['owner-three-r160.js','ludus-manica-v119.js','arena-runtime-v96.js','combat-curves-v163.js','combat-motion-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js','equipment-catalog-v167.js'];
const html='<html><body style="margin:0"><span id="loadStatus"></span>'+deps.map(d=>'<script src="/'+d+'"></script>').join('')+'<script>async function ArenaAssetLoad(name){return (await fetch(name)).arrayBuffer();}</script><script>'+combat.slice(start,finish)+'</script><script>'+gfx.slice(0,end)+'</script>'+['arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v91.js','arena-locomotion-v91.js'].filter(d=>fs.existsSync(root+'/'+d)).map(d=>'<script src="/'+d+'"></script>').join('')+'</body></html>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}const p=path.join(root,url.pathname);if(!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(p));});

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage({viewport:{width:800,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
 const result=await page.evaluate(async()=>{
  await ImportedGladiator.load(()=>{});await LudusEquipmentCatalog.load(THREE,'halberd');
  const T=THREE,scene=new T.Scene();scene.background=new T.Color('#d8d6d0');scene.add(new T.HemisphereLight(0xffffff,0x635b51,2.1));const light=new T.DirectionalLight(0xffffff,2.6);light.position.set(-3,4,5);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(800,800);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0xc5bcae,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const camera=new T.PerspectiveCamera(40,1,.01,100);camera.position.set(-.5,3.1,6.2);camera.lookAt(0,1,.7);
  const m=ImportedGladiator.create(0,'murmillo'),f=new ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
  Object.assign(f,{x:0,z:0,angle:0,helmet:false,chest:false,shoulders:false,weapon:'halberd',shield:false,leftGear:null,move:0,action:'idle'});scene.add(m.root);const shots=[];let clock=0;
  for(const left of [false,true])for(const chain of [1,2,3]){
   Object.assign(f,{action:'idle',offhand:left?'halberd':null,attackLeft:left,chain});for(let n=0;n<15;n++)ImportedGladiator.animate(f,m,clock+=1/60,1/60);
   const p=ArenaMotion.profile('halberd');Object.assign(f,{action:'attack',attackWeapon:'halberd',attackProfile:p,duration:p.duration,attackRegion:'chest',attackKind:'light'});
   let n=0;for(const [name,t] of [['chamber',p.wind],['contact',p.wind+p.active*.48],['finish',p.wind+p.active]]){
    while(n/60<t){f.timer=n/60;ImportedGladiator.animate(f,m,clock+=1/60,1/60);n++;}f.timer=t;ImportedGladiator.animate(f,m,clock+=1/60,1/60);m.teamMark.visible=false;renderer.render(scene,camera);
    shots.push({name:(left?'left':'right')+'-'+chain+'-'+name,png:renderer.domElement.toDataURL().split(',')[1]});
   }
  }
  return shots;
 });assert.equal(result.length,18);assert.deepEqual(errors,[]);for(const s of result)fs.writeFileSync(out+'/'+s.name+'.png',Buffer.from(s.png,'base64'));console.log(JSON.stringify({rendered:result.length}));

 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
