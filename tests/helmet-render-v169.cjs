const fs=require('fs'),path=require('path'),http=require('http');
fs.mkdirSync('/tmp/helmet-v169',{recursive:true});
const root=path.resolve(__dirname,'..'),{chromium}=require('playwright');
const {scripts}=(()=>{const scripts=p=>[...fs.readFileSync(root+'/'+p,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);return{scripts}})();
const src=scripts('arena.html'),gfx=src.find(s=>s.includes('var ImportedGladiator=')),end=gfx.indexOf('})();',gfx.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5;
const combat=src.find(s=>s.includes('var ArenaClasses=')),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);",start=combat.indexOf('var ArenaClasses='),finish=combat.indexOf(ending,combat.indexOf(marker,start))+ending.length;
const deps=['owner-three-r160.js','ludus-manica-v119.js','arena-runtime-v96.js','combat-curves-v163.js','combat-motion-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js','equipment-catalog-v167.js'];
const html='<html><body style="margin:0"><span id="loadStatus"></span>'+deps.map(d=>'<script src="/'+d+'"></script>').join('')+'<script>async function ArenaAssetLoad(name){return (await fetch(name)).arrayBuffer();}</script><script>'+combat.slice(start,finish)+'</script><script>'+gfx.slice(0,end)+'</script>'+['arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v43.js','arena-locomotion-v44.js'].filter(d=>fs.existsSync(root+'/'+d)).map(d=>'<script src="/'+d+'"></script>').join('')+'</body></html>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}const p=path.join(root,url.pathname);if(!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],headless:true});const page=await browser.newPage({viewport:{width:1000,height:850}});page.on('pageerror',e=>console.error(e));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');const result=await page.evaluate(async()=>{
 await ImportedGladiator.load(()=>{});await LudusEquipmentCatalog.load(THREE,'sylvain_helmet');
 const T=THREE,scene=new T.Scene();scene.background=new T.Color('#e8e8e5');scene.add(new T.HemisphereLight(0xffffff,0x6f6f70,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,5);scene.add(light);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});renderer.setSize(1000,850);renderer.setPixelRatio(1);document.body.appendChild(renderer.domElement);
 const camera=new T.PerspectiveCamera(32,1000/850,.01,100),m=ImportedGladiator.create(1,'murmillo'),f=new ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
 Object.assign(f,{x:0,z:0,angle:0,helmet:true,helmetModel:'sylvain_helmet',chest:false,shoulders:false,weapon:null,shield:false,leftGear:null,move:0,action:'idle'});scene.add(m.root);const shots=[];let clock=0;
 for(const pose of ['idle','walk','attack','guard','dodge']){
  const p=ArenaMotion.profile('gladius');Object.assign(f,{action:pose==='walk'||pose==='guard'?'idle':pose,blocking:pose==='guard',move:pose==='walk'?1:0,weapon:pose==='attack'?'gladius':null,attackWeapon:'gladius',attackProfile:p,duration:pose==='dodge'?.46:p.duration});
  for(let i=0;i<30;i++){f.walk=i/10;f.timer=i/120;clock+=1/60;ImportedGladiator.animate(f,m,clock,1/60)}m.teamMark.visible=false;
  const center=m.gear.helmet.group.getWorldPosition(new T.Vector3());
  for(const [view,x,y,z]of [['front',0,.04,1.05],['side',1.05,.04,0],['back',0,.04,-1.05]]){
   camera.position.copy(center).add(new T.Vector3(x,y,z));camera.lookAt(center);renderer.render(scene,camera);shots.push({name:pose+'-'+view,png:renderer.domElement.toDataURL().split(',')[1]});
  }
 }
 // Render the actual licensed mesh as the inventory photograph, with full silhouette and transparent background.
 scene.remove(m.root);const icon=LudusEquipmentCatalog.get('sylvain_helmet').clone(true);scene.add(icon);scene.background=null;renderer.setClearColor(0x000000,0);renderer.setSize(320,320);
 const iconCamera=new T.OrthographicCamera(-.225,.225,.225,-.225,.01,10);iconCamera.position.set(.65,.22,1);iconCamera.lookAt(0,0,0);renderer.render(scene,iconCamera);
 return {shots,icon:renderer.domElement.toDataURL('image/webp',.94).split(',')[1]};
 });for(const s of result.shots)fs.writeFileSync('/tmp/helmet-v169/'+s.name+'.png',Buffer.from(s.png,'base64'));
 if(process.env.RENDER_HELMET_ICON==='1'){fs.mkdirSync(root+'/assets/items-v169',{recursive:true});fs.writeFileSync(root+'/assets/items-v169/helmet-sylvain.webp',Buffer.from(result.icon,'base64'));}
 console.log('V169 visual review: 15 head-mounted views captured with original textures.');
 await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1)});
