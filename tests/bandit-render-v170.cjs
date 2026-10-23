const fs=require('fs'),path=require('path'),http=require('http');
fs.mkdirSync('/tmp/bandit-v170',{recursive:true});
const root=path.resolve(__dirname,'..'),{chromium}=require('playwright');
const {scripts}=(()=>{const scripts=p=>[...fs.readFileSync(root+'/'+p,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);return{scripts}})();
const src=scripts('arena.html'),gfx=src.find(s=>s.includes('var ImportedGladiator=')),end=gfx.indexOf('})();',gfx.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5;
const combat=src.find(s=>s.includes('var ArenaClasses=')),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);",start=combat.indexOf('var ArenaClasses='),finish=combat.indexOf(ending,combat.indexOf(marker,start))+ending.length;
const deps=['owner-three-r160.js','ludus-manica-v119.js','arena-runtime-v96.js','combat-curves-v163.js','combat-motion-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js','equipment-catalog-v167.js','arena-locomotion-data-v91.js','arena-locomotion-data-v170.js','arena-locomotion-v91.js'];
const html='<html><body style="margin:0"><span id="loadStatus"></span>'+deps.map(d=>'<script src="/'+d+'"></script>').join('')+'<script>async function ArenaAssetLoad(name){return (await fetch(name)).arrayBuffer();}</script><script>'+combat.slice(start,finish)+'</script><script>'+gfx.slice(0,end)+'</script>'+['arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v43.js','arena-locomotion-v44.js'].filter(d=>fs.existsSync(root+'/'+d)).map(d=>'<script src="/'+d+'"></script>').join('')+'</body></html>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}const p=path.join(root,url.pathname);if(!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/helmet-chrome/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],headless:true});const page=await browser.newPage({viewport:{width:1200,height:700}});page.on('pageerror',e=>console.error(e));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
const result=await page.evaluate(async()=>{
 await ImportedGladiator.load(()=>{});const T=THREE,scene=new T.Scene();scene.background=new T.Color('#dededb');scene.add(new T.HemisphereLight(0xffffff,0x777777,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,5,5);scene.add(light);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,700);document.body.appendChild(renderer.domElement);const camera=new T.PerspectiveCamera(32,1200/700,.01,100);camera.position.set(1.4,2.4,7.8);camera.lookAt(0,1,0);
 const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:0xc4c4ba}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
 const shots=[];
 for(const [label,speed]of [['idle',0],['walk',1.4],['run',4.2]]){
  const models=[];
  for(let j=0;j<3;j++){
   const type=j===2?'retiarius':'murmillo',m=ImportedGladiator.create(j,type),f=new ArenaCombat(()=>.999).reset('normal',type).fighters[0];Object.assign(f,{x:0,z:0,angle:j===1?Math.PI/2:0,action:'idle',move:speed?1:0});
   if(j===0)Object.assign(f,{weapon:null,shield:false,chest:false,shoulders:false,helmet:false,leftGear:null});
   for(let i=0;i<120+j*7;i++){f.x+=Math.sin(f.angle)*speed/60;f.z+=Math.cos(f.angle)*speed/60;f.walk+=speed/60;ImportedGladiator.animate(f,m,i/60,1/60);}
   m.root.position.set((j-1)*1.6,0,0);scene.add(m.root);models.push(m);
  }
  renderer.render(scene,camera);shots.push({name:label,png:renderer.domElement.toDataURL().split(',')[1]});for(const m of models){scene.remove(m.root);ImportedGladiator.dispose(m);}
 }
 return shots;
});for(const s of result)fs.writeFileSync('/tmp/bandit-v170/'+s.name+'.png',Buffer.from(s.png,'base64'));console.log('Captured idle, walk and run: unarmed, sword/shield, trident.');await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1)});
