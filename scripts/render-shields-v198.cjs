/* Actual shield models rendered with studio lighting; no source-page screenshots. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/shields-v198';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(root+'/arena.html','utf8'),scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const gfx=scripts.find(s=>s.includes('var ImportedGladiator=')),end=gfx.indexOf('})();',gfx.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5;
const combat=scripts.find(s=>s.includes('var ArenaClasses=')),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);",start=combat.indexOf('var ArenaClasses='),finish=combat.indexOf(ending,combat.indexOf(marker,start))+ending.length;
const deps=['owner-three-r160.js','ludus-manica-v119.js','arena-runtime-v96.js','combat-curves-v163.js','combat-motion-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js','equipment-catalog-v167.js'];
const html='<html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#e8e8e5"><span id="loadStatus"></span>'+deps.map(d=>'<script src="/'+d+'"></script>').join('')+'<script>async function ArenaAssetLoad(name){const response=await fetch(name);if(!response.ok)throw Error(name+": HTTP "+response.status);return response.arrayBuffer();}</script><script>'+combat.slice(start,finish)+'</script><script>'+gfx.slice(0,end)+'</script>'+['arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v91.js','arena-locomotion-v91.js'].map(d=>'<script src="/'+d+'"></script>').join('')+'</body></html>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}const p=path.resolve(root,'.'+url.pathname);if(!p.startsWith(root+'/')||!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await(process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch(process.env.LUDUS_WEBKIT_TEST?{headless:true}:{headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:640,height:640}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
 const report=require('../assets/equipment-v198/build-report.json').items;
 const result=await page.evaluate(async rows=>{
  await ImportedGladiator.load(()=>{});const T=THREE,scene=new T.Scene(),renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,640);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  scene.add(new T.HemisphereLight(0xfff4dc,0x3d4b61,2));for(const [color,power,position]of [[0xfff1d8,3,[-3,4,5]],[0xd3e4ff,1.5,[3,1,2]],[0xffffff,2,[-2,3,-2]]]){const l=new T.DirectionalLight(color,power);l.position.set(...position);scene.add(l)}
  const env=new T.Scene();env.background=new T.Color(.32,.36,.40);for(const [x,y,z,sx,sy,sz]of [[0,3,0,4,.05,4],[-3,1,0,.05,3,4],[0,1,4,3,2,.05]]){const panel=new T.Mesh(new T.BoxGeometry(sx,sy,sz),new T.MeshBasicMaterial({color:0xffffff}));panel.position.set(x,y,z);env.add(panel)}const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(env,.06);scene.environment=environment.texture;pmrem.dispose();
  const results=[];for(const row of rows){
   const template=await LudusEquipmentCatalog.load(T,row.id),model=template.clone(true);scene.add(model);const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),edge=Math.max(size.x,size.y)*.60,camera=new T.OrthographicCamera(-edge,edge,edge,-edge,.001,20),shots={};
   for(const [side,dir]of [['front',1],['back',-1]]){camera.position.copy(center).add(new T.Vector3(.30,.08,2*dir));camera.lookAt(center);renderer.render(scene,camera);shots[side]=renderer.domElement.toDataURL().split(',')[1];}
   const drawCalls=renderer.info.render.calls,triangles=renderer.info.render.triangles;scene.remove(model);
   const m=ImportedGladiator.create(198,'murmillo'),f=new ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];Object.assign(f,{x:0,z:0,angle:0,hp:100,helmet:false,weapon:'gladius',shield:true,shieldStyle:row.id,chest:false,shoulders:false,greaves:true,leftGear:null,offhand:null});scene.add(m.root);
   const worn=[];for(const pose of ['idle','guard','attack']){
    const p=ArenaMotion.profile('gladius');Object.assign(f,{action:pose==='guard'?'idle':pose,attackWeapon:'gladius',attackProfile:p,duration:p.duration,timer:pose==='attack'?p.wind+p.active*.5:0,blocking:pose==='guard'});for(let frame=0;frame<24;frame++)ImportedGladiator.animate(f,m,frame/60,1/60);m.teamMark.visible=false;m.root.updateMatrixWorld(true);
    const target=new T.Vector3(.05,1.05,0),portrait=new T.PerspectiveCamera(35,1,.01,20);portrait.position.copy(target).add(new T.Vector3(1.3,.35,3.5));portrait.lookAt(target);renderer.setClearColor(0xbbb5a7,1);renderer.render(scene,portrait);
    const g=m.gear.shield.group,palm=m.bones.LeftHand.getWorldPosition(new T.Vector3());worn.push({pose,data:renderer.domElement.toDataURL().split(',')[1],visible:g.visible,catalogId:g.userData.catalogId,handOffset:g.getWorldPosition(new T.Vector3()).distanceTo(palm)});
   }
   scene.remove(m.root);ImportedGladiator.dispose(m);renderer.setClearColor(0,0);results.push({id:row.id,sku:row.sku,shots,worn,triangles,drawCalls});
  }renderer.dispose();environment.dispose();return results;
 },report);
 assert.deepEqual(errors,[]);const sharp=require('sharp'),data=[];if(process.env.LUDUS_REBUILD_SHIELD_ICONS)fs.mkdirSync(root+'/assets/items-v198',{recursive:true});
 for(const row of result){assert.equal(row.drawCalls,1);assert.equal(row.triangles,report.find(r=>r.id===row.id).triangles);for(const [side,image]of Object.entries(row.shots))fs.writeFileSync(out+'/'+row.id+'-'+side+'.png',Buffer.from(image,'base64'));for(const pose of row.worn){assert.equal(pose.visible,true);assert.equal(pose.catalogId,row.id);fs.writeFileSync(out+'/'+row.id+'-'+pose.pose+'.png',Buffer.from(pose.data,'base64'));}
  const icon=await sharp(Buffer.from(row.shots.front,'base64')).resize(320,320).webp({quality:90,alphaQuality:100,effort:6}).toBuffer();assert.ok(icon.length<25000);if(process.env.LUDUS_REBUILD_SHIELD_ICONS)fs.writeFileSync(root+'/assets/items-v198/'+row.sku+'.webp',icon);
  data.push({id:row.id,sku:row.sku,triangles:row.triangles,drawCalls:row.drawCalls,iconBytes:icon.length,poses:row.worn.map(({data,...rest})=>rest)});
 }
 fs.writeFileSync(out+'/render-report.json',JSON.stringify(data,null,2));console.log(JSON.stringify(data));
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
