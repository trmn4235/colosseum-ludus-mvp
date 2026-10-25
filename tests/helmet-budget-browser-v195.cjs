/* Compare fitted helmets before/after byte reduction, with actual decoded textures in both browser engines. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/helmet-budget-v195';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(root+'/arena.html','utf8'),scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const gfx=scripts.find(s=>s.includes('var ImportedGladiator=')),end=gfx.indexOf('})();',gfx.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5;
const combat=scripts.find(s=>s.includes('var ArenaClasses=')),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);",start=combat.indexOf('var ArenaClasses='),finish=combat.indexOf(ending,combat.indexOf(marker,start))+ending.length;
const deps=['owner-three-r160.js','ludus-manica-v119.js','arena-runtime-v96.js','combat-curves-v163.js','combat-motion-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js','equipment-catalog-v167.js'];
const html='<html><body style="margin:0;background:#e8e8e5"><span id="loadStatus"></span>'+deps.map(d=>'<script src="/'+d+'"></script>').join('')+'<script>async function ArenaAssetLoad(name){return (await fetch(name)).arrayBuffer();}</script><script>'+combat.slice(start,finish)+'</script><script>'+gfx.slice(0,end)+'</script>'+['arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v43.js','arena-locomotion-v44.js'].map(d=>'<script src="/'+d+'"></script>').join('')+'</body></html>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}const p=path.resolve(root,'.'+url.pathname);if(!p.startsWith(root+'/')||!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const safari=!!process.env.LUDUS_WEBKIT_TEST,browser=await(safari?webkit:chromium).launch(safari?{headless:true}:{headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:512,height:512}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));
  await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
  await page.evaluate(async()=>{await ImportedGladiator.load(()=>{});await Promise.all(Array.from({length:20},()=>LudusEquipmentCatalog.load(THREE,'sylvain_helmet')));});
  const rows=require('../assets/equipment-v195/build-report.json').helmets.filter(r=>!r.unchanged);
  for(const row of rows){assert.equal(requests.filter(p=>p==='/'+row.file).length,1,row.id+' one shared download');assert.ok(!requests.includes('/'+row.source),row.id+' old heavy package is not loaded');}
  const result=await page.evaluate(async rows=>{
   const T=THREE,scene=new T.Scene(),renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
   scene.add(new T.HemisphereLight(0xffffff,0x6f6f70,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,5);scene.add(light);
   const env=new T.Scene();env.background=new T.Color(.65,.65,.65);for(const [x,y,z,sx,sy,sz]of [[0,3,0,4,.05,4],[-3,1,0,.05,3,4],[0,1,4,3,2,.05]]){const panel=new T.Mesh(new T.BoxGeometry(sx,sy,sz),new T.MeshBasicMaterial({color:0xffffff}));panel.position.set(x,y,z);env.add(panel)}
   const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(env,.08);scene.environment=environment.texture;pmrem.dispose();
   const gl=renderer.getContext(),comparisons=[],shots=[];
   function pixels(){const p=new Uint8Array(512*512*4);gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;}
   for(const row of rows){
    const input=await(await fetch('/'+row.source)).arrayBuffer(),raw=row.source.endsWith('.cme')?await LudusEquipmentCatalog.decode(input):input,loaded=(await new T.GLTFLoader().parseAsync(raw,'')).scene;
    let original;
    if(row.id==='sylvain_helmet'){
     loaded.updateMatrixWorld(true);const b=new T.Box3().setFromObject(loaded),scale=.36/b.getSize(new T.Vector3()).y;original=new T.Group();original.add(loaded);loaded.scale.multiplyScalar(scale);loaded.position.sub(b.getCenter(new T.Vector3()).multiplyScalar(scale));loaded.traverse(o=>{if(o.isMesh)o.material.envMapIntensity=.8;});
    }else original=LudusHelmets.prepare(loaded,row.id);
    const current=LudusHelmets.get(row.id),beforeBounds=new T.Box3().setFromObject(original),afterBounds=new T.Box3().setFromObject(current),boundError=Math.max(beforeBounds.min.distanceTo(afterBounds.min),beforeBounds.max.distanceTo(afterBounds.max)),center=beforeBounds.getCenter(new T.Vector3()),size=beforeBounds.getSize(new T.Vector3()),edge=Math.max(size.x,size.y,size.z)*.70,camera=new T.OrthographicCamera(-edge,edge,edge,-edge,.001,10);
    for(const [view,x,y,z]of [['front',0,.05,1],['back',0,.05,-1],['angle',.65,.22,1],['side',1,.05,0]]){
     camera.position.copy(center).add(new T.Vector3(x,y,z));camera.lookAt(center);scene.add(original);renderer.render(scene,camera);const a=pixels(),beforeTriangles=renderer.info.render.triangles,beforeCalls=renderer.info.render.calls;shots.push({name:row.id+'-'+view+'-before',png:renderer.domElement.toDataURL().split(',')[1]});scene.remove(original);
     scene.add(current);renderer.render(scene,camera);const b=pixels(),triangles=renderer.info.render.triangles,calls=renderer.info.render.calls;shots.push({name:row.id+'-'+view+'-after',png:renderer.domElement.toDataURL().split(',')[1]});scene.remove(current);
     let union=0,intersection=0,error=0,total=0;for(let i=0;i<a.length;i+=4){if(a[i+3]>127||b[i+3]>127)union++;if(a[i+3]>127&&b[i+3]>127){intersection++;for(let k=0;k<3;k++){error+=Math.abs(a[i+k]-b[i+k]);total++;}}}
     comparisons.push({id:row.id,view,boundError,beforeTriangles,triangles,beforeCalls,calls,silhouetteIoU:intersection/union,meanColourError:error/(total*255)});
    }
   }
   renderer.dispose();environment.dispose();return {comparisons,shots};
  },rows);
  const engine=safari?'webkit':'chromium';
  for(const shot of result.shots)fs.writeFileSync(out+'/'+shot.name+'-'+engine+'.png',Buffer.from(shot.png,'base64'));
  fs.writeFileSync(out+'/comparisons-'+engine+'.json',JSON.stringify(result.comparisons,null,2)+'\n');
  for(const r of result.comparisons){assert.ok(r.boundError<.00001,JSON.stringify(r));assert.equal(r.triangles,r.beforeTriangles);assert.equal(r.calls,r.beforeCalls);assert.ok(r.silhouetteIoU>.995,JSON.stringify(r));assert.ok(r.meanColourError<.05,JSON.stringify(r));}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,comparisons:result.comparisons}));
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
