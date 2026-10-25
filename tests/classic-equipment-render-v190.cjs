/* Real texture decoding, original/packed comparisons and worn equipment in both browser engines. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/equipment-v190/render';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(root+'/arena.html','utf8'),scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const gfx=scripts.find(s=>s.includes('var ImportedGladiator=')),end=gfx.indexOf('})();',gfx.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5;
const combat=scripts.find(s=>s.includes('var ArenaClasses=')),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);",start=combat.indexOf('var ArenaClasses='),finish=combat.indexOf(ending,combat.indexOf(marker,start))+ending.length;
const deps=['owner-three-r160.js','ludus-manica-v119.js','arena-runtime-v96.js','combat-curves-v163.js','combat-motion-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js','equipment-catalog-v167.js'];
const html='<html><body style="margin:0;background:#e8e8e5"><span id="loadStatus"></span>'+deps.map(d=>'<script src="/'+d+'"></script>').join('')+'<script>async function ArenaAssetLoad(name){return (await fetch(name)).arrayBuffer();}</script><script>'+combat.slice(start,finish)+'</script><script>'+gfx.slice(0,end)+'</script>'+['arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js','arena-locomotion-data-v43.js','arena-locomotion-v44.js'].map(d=>'<script src="/'+d+'"></script>').join('')+'</body></html>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}const p=path.resolve(root,'.'+url.pathname);if(!p.startsWith(root+'/')||!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const safari=!!process.env.LUDUS_WEBKIT_TEST;
 const browser=await(safari?webkit:chromium).launch(safari?{headless:true}:{headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:640,height:640}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
  await page.evaluate(()=>ImportedGladiator.load(()=>{}));
  for(const file of ['roman_scutum_shield.glb','roman_shield.glb','roman_spatha.glb']){assert.equal(requests.filter(p=>p==='/assets/equipment-v190/'+file).length,1);assert.ok(!requests.includes('/'+file),'old multi-MB asset must not be fetched');}
  const result=await page.evaluate(async()=>{
   const T=THREE,scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});renderer.setSize(640,640);renderer.setPixelRatio(1);renderer.setClearColor(0,0);document.body.replaceChildren(renderer.domElement);
   scene.add(new T.HemisphereLight(0xffffff,0x6f6f70,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,5);scene.add(light);
   const env=new T.Scene();env.background=new T.Color(.65,.65,.65);for(const [x,y,z,sx,sy,sz]of [[0,3,0,4,.05,4],[-3,1,0,.05,3,4],[0,1,4,3,2,.05]]){const panel=new T.Mesh(new T.BoxGeometry(sx,sy,sz),new T.MeshBasicMaterial({color:0xffffff}));panel.position.set(x,y,z);env.add(panel)}
   const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(env,.08);scene.environment=environment.texture;pmrem.dispose();const camera=new T.OrthographicCamera(-.7,.7,.7,-.7,.01,100),shots=[],comparisons=[],gl=renderer.getContext();
   const shot=(name)=>shots.push({name,png:renderer.domElement.toDataURL().split(',')[1]});
   function pixels(){const a=new Uint8Array(640*640*4);gl.readPixels(0,0,640,640,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
   for(const [kind,file,packed]of [['scutum','roman_scutum_shield.glb',ImportedEquipment.shield('secutor')],['shield','roman_shield.glb',ImportedEquipment.shield('hoplomachus')],['sword','roman_spatha.glb',ImportedEquipment.weapon('gladius')]]){
    const data=await(await fetch('/'+file)).arrayBuffer(),original=ImportedEquipment.prepare((await new T.GLTFLoader().parseAsync(data,'')).scene,kind),center=new T.Box3().setFromObject(original).getCenter(new T.Vector3());
    for(const [view,x,y,z]of [['front',0,0,3],['back',0,0,-3],['angle',2,.6,3]]){
     camera.position.copy(center).add(new T.Vector3(x,y,z));camera.lookAt(center);scene.add(original);renderer.render(scene,camera);const before=pixels();shot(kind+'-'+view+'-before');scene.remove(original);scene.add(packed);renderer.render(scene,camera);const after=pixels();shot(kind+'-'+view+'-after');scene.remove(packed);
     let union=0,intersection=0,total=0,error=0;for(let i=0;i<before.length;i+=4){const a=before[i+3]>127,b=after[i+3]>127;if(a||b)union++;if(a&&b){intersection++;for(let k=0;k<3;k++){error+=Math.abs(before[i+k]-after[i+k]);total++;}}}
     comparisons.push({kind,view,silhouetteIoU:intersection/union,meanColourError:error/(total*255),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
    }
   }
   // Use both item IDs in the actual character rig; the sword asset tag controls hand placement.
   const m=ImportedGladiator.create(190,'murmillo'),f=new ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0],grips=[];scene.add(m.root);
   Object.assign(f,{x:0,z:0,angle:0,helmet:false,chest:false,shoulders:false,greaves:false,shield:true,move:0,offhand:null,leftGear:null});camera.left=camera.bottom=-1.15;camera.right=camera.top=1.15;camera.updateProjectionMatrix();camera.position.set(2,1.5,3.5);camera.lookAt(0,.9,0);
   let time=0;for(const weapon of ['gladius','sica'])for(const shieldStyle of ['secutor','hoplomachus']){
    Object.assign(f,{weapon,shieldStyle,attackWeapon:weapon,attackProfile:ArenaMotion.profile(weapon)});
    for(const pose of ['idle','attack','guard']){f.action=pose==='guard'?'idle':pose;f.blocking=pose==='guard';f.duration=f.attackProfile.duration;for(let i=0;i<25;i++){time+=1/60;f.timer=i/120;ImportedGladiator.animate(f,m,time,1/60)}m.teamMark.visible=false;renderer.render(scene,camera);shot(weapon+'-'+shieldStyle+'-'+pose);grips.push(m.weaponAnchor.children[0].userData.asset);}
   }
   ImportedGladiator.dispose(m);environment.dispose();renderer.dispose();return {shots,comparisons,grips};
  });
  for(const s of result.shots)fs.writeFileSync(out+'/'+s.name+'.png',Buffer.from(s.png,'base64'));
  for(const row of result.comparisons){assert.ok(row.silhouetteIoU>.99,JSON.stringify(row));assert.ok(row.meanColourError<.075,JSON.stringify(row));assert.equal(row.calls,1);assert.equal(row.triangles,{scutum:1466,shield:1246,sword:4994}[row.kind]);}
  assert.ok(result.grips.every(v=>v==='roman_spatha.glb'));assert.deepEqual(errors,[]);fs.writeFileSync(out+'/comparisons.json',JSON.stringify(result.comparisons,null,2));console.log(JSON.stringify({engine:safari?'webkit':'chromium',views:result.shots.length,comparisons:result.comparisons,gripChecks:result.grips.length,requests:'three versioned models, no original multi-MB downloads'}));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
