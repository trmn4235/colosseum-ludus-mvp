/* Real texture decoding, original/packed comparisons and worn equipment in both browser engines. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/equipment-v191/render';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(root+'/arena.html','utf8'),scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const gfx=scripts.find(s=>s.includes('var ImportedGladiator=')),end=gfx.indexOf('})();',gfx.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5;
const combat=scripts.find(s=>s.includes('var ArenaClasses=')),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);",start=combat.indexOf('var ArenaClasses='),finish=combat.indexOf(ending,combat.indexOf(marker,start))+ending.length;
const deps=['owner-three-r160.js','ludus-manica-v119.js','arena-runtime-v96.js','combat-curves-v163.js','combat-motion-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js','equipment-catalog-v167.js'];
const cs=gfx.indexOf('var ClassEquipment='),ce=gfx.indexOf('})();',gfx.indexOf('return {equip,setWeapon,weapon,sync,item,shield,animateFlex};',cs))+5;
const baseline=gfx.slice(cs,ce).replace('var ClassEquipment=','var ClassEquipmentV190=').replace(/ function detailedGreave\(\)[\s\S]*?(?= function fitLimb)/,fs.readFileSync(root+'/tests/fixtures/greave-v190.js','utf8'));
const html='<html><body style="margin:0;background:#e8e8e5"><span id="loadStatus"></span>'+deps.map(d=>'<script src="/'+d+'"></script>').join('')+'<script>async function ArenaAssetLoad(name){return (await fetch(name)).arrayBuffer();}</script><script>'+combat.slice(start,finish)+'</script><script>'+gfx.slice(0,end)+'</script><script>'+baseline+'</script>'+['arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v43.js','arena-locomotion-v44.js'].map(d=>'<script src="/'+d+'"></script>').join('')+'</body></html>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}const p=path.resolve(root,'.'+url.pathname);if(!p.startsWith(root+'/')||!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const safari=!!process.env.LUDUS_WEBKIT_TEST;
 const browser=await(safari?webkit:chromium).launch(safari?{headless:true}:{headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:640,height:640}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
  await page.evaluate(async()=>{await ImportedGladiator.load(()=>{});await Promise.all(Array.from({length:20},()=>LudusEquipmentCatalog.load(THREE,'sylvain_helmet')));});
  assert.equal(requests.filter(p=>p==='/assets/equipment-v191/sylvain_helmet.cme').length,1);assert.ok(!requests.includes('/assets/equipment-v167/sylvain_helmet.cme'));
  for(const file of ['roman_scutum_shield.glb','roman_shield.glb']){assert.equal(requests.filter(p=>p==='/assets/equipment-v190/'+file).length,1);assert.ok(!requests.includes('/'+file));}
  const result=await page.evaluate(async()=>{
   const T=THREE,scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});renderer.setSize(640,640);renderer.setPixelRatio(1);renderer.setClearColor(0,0);document.body.replaceChildren(renderer.domElement);
   scene.add(new T.HemisphereLight(0xffffff,0x6f6f70,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,5);scene.add(light);
   const env=new T.Scene();env.background=new T.Color(.65,.65,.65);for(const [x,y,z,sx,sy,sz]of [[0,3,0,4,.05,4],[-3,1,0,.05,3,4],[0,1,4,3,2,.05]]){const panel=new T.Mesh(new T.BoxGeometry(sx,sy,sz),new T.MeshBasicMaterial({color:0xffffff}));panel.position.set(x,y,z);env.add(panel)}
   const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(env,.08);scene.environment=environment.texture;pmrem.dispose();const camera=new T.OrthographicCamera(-.28,.28,.28,-.28,.01,100),shots=[],comparisons=[],gl=renderer.getContext();
   const shot=name=>shots.push({name,png:renderer.domElement.toDataURL().split(',')[1]});
   function pixels(){const a=new Uint8Array(640*640*4);gl.readPixels(0,0,640,640,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
   const raw=await LudusEquipmentCatalog.decode(await(await fetch('/assets/equipment-v167/sylvain_helmet.cme')).arrayBuffer()),source=(await new T.GLTFLoader().parseAsync(raw,'')).scene;
   source.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(source),scale=.36/bounds.getSize(new T.Vector3()).y,original=new T.Group();original.add(source);source.scale.multiplyScalar(scale);source.position.sub(bounds.getCenter(new T.Vector3()).multiplyScalar(scale));source.traverse(o=>{if(o.isMesh)o.material.envMapIntensity=.8;});
   const variants=[['helmet',original,LudusEquipmentCatalog.get('sylvain_helmet')],['greave',ClassEquipmentV190.item({kind:'greaves'}),ClassEquipment.item({kind:'greaves'})]];
   for(const [kind,beforeModel,afterModel]of variants){
    const center=new T.Box3().setFromObject(beforeModel).getCenter(new T.Vector3());
    for(const [view,x,y,z]of [['front',0,0,3],['back',0,0,-3],['angle',2,.6,3],['side',3,0,0]]){
     camera.position.copy(center).add(new T.Vector3(x,y,z));camera.lookAt(center);scene.add(beforeModel);renderer.render(scene,camera);const before=pixels(),beforeCalls=renderer.info.render.calls,beforeTriangles=renderer.info.render.triangles;shot(kind+'-'+view+'-before');scene.remove(beforeModel);scene.add(afterModel);renderer.render(scene,camera);const after=pixels();shot(kind+'-'+view+'-after');scene.remove(afterModel);
     let union=0,intersection=0,total=0,error=0;for(let i=0;i<before.length;i+=4){const a=before[i+3]>127,b=after[i+3]>127;if(a||b)union++;if(a&&b){intersection++;for(let k=0;k<3;k++){error+=Math.abs(before[i+k]-after[i+k]);total++;}}}
     comparisons.push({kind,view,silhouetteIoU:intersection/union,meanColourError:error/(total*255),beforeCalls,calls:renderer.info.render.calls,beforeTriangles,triangles:renderer.info.render.triangles});
    }
   }
   // The actual loaded assets, attached to the live character skeleton through combat poses.
   const m=ImportedGladiator.create(191,'murmillo'),f=new ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];scene.add(m.root);
   Object.assign(f,{x:0,z:0,angle:0,helmet:true,helmetModel:'sylvain_helmet',chest:false,shoulders:false,greaves:true,shield:false,move:0,offhand:null,leftGear:null});camera.left=camera.bottom=-1.1;camera.right=camera.top=1.1;camera.updateProjectionMatrix();camera.position.set(1.4,1.35,3.5);camera.lookAt(0,.9,0);
   let time=0;for(const pose of ['idle','walk','attack','guard','dodge']){
    const p=ArenaMotion.profile('gladius');Object.assign(f,{action:pose==='walk'||pose==='guard'?'idle':pose,blocking:pose==='guard',move:pose==='walk'?1:0,weapon:'gladius',attackWeapon:'gladius',attackProfile:p,duration:pose==='dodge'?.46:p.duration});
    for(let i=0;i<25;i++){time+=1/60;f.timer=i/120;f.walk=i/10;ImportedGladiator.animate(f,m,time,1/60);}m.teamMark.visible=false;renderer.render(scene,camera);shot('worn-'+pose);
   }
   const textureSizes=[];LudusEquipmentCatalog.get('sylvain_helmet').traverse(o=>{if(o.isMesh)for(const key of ['map','normalMap','roughnessMap','specularIntensityMap']){const t=o.material[key];if(t)textureSizes.push([key,t.image.width,t.image.height]);}});
   ImportedGladiator.dispose(m);environment.dispose();renderer.dispose();
   const iconComparisons=[];
   for(const name of ['stone','wood']){
    const before=new Image(),after=new Image();before.src='/assets/pit-v178/'+name+'-icon.png';after.src='/assets/pit-v191/'+name+'-icon.webp';await Promise.all([before.decode(),after.decode()]);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.drawImage(before,0,0,512,512);const a=ctx.getImageData(0,0,512,512).data;ctx.clearRect(0,0,512,512);ctx.drawImage(after,0,0);const b=ctx.getImageData(0,0,512,512).data;let union=0,intersection=0,error=0,total=0;
    for(let i=0;i<a.length;i+=4){if(a[i+3]>127||b[i+3]>127)union++;if(a[i+3]>127&&b[i+3]>127){intersection++;for(let k=0;k<3;k++){error+=Math.abs(a[i+k]-b[i+k]);total++;}}}
    iconComparisons.push({name,width:after.naturalWidth,height:after.naturalHeight,silhouetteIoU:intersection/union,meanColourError:error/(total*255)});
   }
   return {shots,comparisons,textureSizes,iconComparisons};
  });
  for(const s of result.shots)fs.writeFileSync(out+'/'+s.name+'.png',Buffer.from(s.png,'base64'));
  fs.writeFileSync(out+'/comparisons.json',JSON.stringify({...result,shots:result.shots.map(s=>s.name)},null,2));
  for(const row of result.comparisons){assert.ok(row.silhouetteIoU>.975,JSON.stringify(row));assert.ok(row.meanColourError<.085,JSON.stringify(row));assert.equal(row.calls,row.kind==='helmet'?1:2);assert.equal(row.triangles,row.kind==='helmet'?6652:1156);assert.ok(row.triangles<row.beforeTriangles*.6);}
  assert.equal(result.textureSizes.length,4);assert.ok(result.textureSizes.every(t=>t[1]<=512&&t[2]<=512));
  for(const row of result.iconComparisons){assert.equal(row.width,512);assert.ok(row.silhouetteIoU>.99);assert.ok(row.meanColourError<.04,JSON.stringify(row));}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:safari?'webkit':'chromium',views:result.shots.length,comparisons:result.comparisons,textureSizes:result.textureSizes,icons:result.iconComparisons}));
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
