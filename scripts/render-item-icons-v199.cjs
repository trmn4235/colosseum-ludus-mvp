/* Exact game geometry and materials, photographed with a studio environment.
 * No generative edits. Rebuild deliberately with LUDUS_REBUILD_ITEM_ICONS=1.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright'),sharp=require('sharp'),root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/item-icons-v199';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(root+'/arena.html','utf8'),section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const blocks=[source.match(/var ArenaClasses=[\s\S]*?\n};/)[0],section('var ImportedEquipment=','var QUATERNIUS_COMBAT='),section('var LUDUS_HELMET_DATA=','/* Gladiator by huyunited')];
const bow=fs.readFileSync(root+'/pit-archery-v178.js','utf8');blocks.push(bow.slice(bow.indexOf(' function bowModel('),bow.indexOf(' function pose('))+'\nwindow.ItemIconBow=bowModel;');
const deps=['owner-three-r160.js','arena-runtime-v96.js','ludus-manica-v119.js','equipment-catalog-v167.js','item-visuals-v199.js','ludus-production-v119.js','equipment-groups-v168.js'];
const fixture='<html><head><link rel="icon" href="data:,"></head><body>'+deps.map(f=>'<script src="/'+f+'"></script>').join('')+'<script>async function ArenaAssetLoad(name){const response=await fetch(name);if(!response.ok)throw Error(name+" "+response.status);return response.arrayBuffer();}</script><script>'+blocks.join('\n')+'</script></body></html>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture);}const p=path.resolve(root,'.'+url.pathname);if(!p.startsWith(root+'/')||!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(p));});
async function render(){await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:768,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
const result=await page.evaluate(async()=>{
 await ImportedEquipment.load();await LudusArmour.load();
 const rows=Object.values(LudusItemVisuals.records).filter(r=>r.icon.startsWith('assets/items-v199/'));
 for(const r of rows)if(LudusEquipmentCatalog.entry(r.model))await LudusEquipmentCatalog.load(THREE,r.model);
 await RomanVisualAssets.ready();
 const T=THREE,scene=new T.Scene(),renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(768,768);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 scene.add(new T.HemisphereLight(0xfff8ec,0x5a6374,2));for(const [color,power,position]of [[0xfff3e1,3,[-3,4,5]],[0xdce9ff,1.7,[3,1,2]],[0xffffff,2,[-2,3,-2]]]){const l=new T.DirectionalLight(color,power);l.position.set(...position);scene.add(l);}
 const env=new T.Scene();env.background=new T.Color(.40,.42,.45);for(const [x,y,z,sx,sy,sz]of [[0,3,0,4,.05,4],[-3,1,0,.05,3,4],[0,1,4,3,2,.05]]){const panel=new T.Mesh(new T.BoxGeometry(sx,sy,sz),new T.MeshBasicMaterial({color:0xffffff}));panel.position.set(x,y,z);env.add(panel);}const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(env,.06);scene.environment=environment.texture;pmrem.dispose();
 const images=[];for(const r of rows){let template;
  if(r.sku==='bow')template=ItemIconBow(T);else if(r.kind==='shield')template=ClassEquipment.shield(r.model);else if(['chest','gloves'].includes(r.kind))template=LudusArmour.get(r.kind,r.model);else if(r.kind==='legs')template=ClassEquipment.item({kind:'greaves'});else template=ClassEquipment.item({kind:r.model});
  const group=new T.Group(),model=template.clone(true);group.add(model);
  // Paired greaves and mirrored shoulder caps use the actual worn pieces, never a painted substitute.
  if(r.kind==='legs'){model.position.x=-.12;const other=model.clone(true);other.position.x=.12;group.add(other);}
  if(r.model==='shoulder_armor'){model.position.x=-.16;model.scale.x=-1;const other=template.clone(true);other.position.x=.16;group.add(other);}
  const pole=['halberd','trident_gladiator'].includes(r.model);if(pole)model.rotation.y=-Math.PI/2;
  if(r.kind==='weapon'&&!['net','scissor'].includes(r.model)||r.sku==='bow')group.rotation.z=-Math.PI/4;
  if(r.sku==='bow')model.rotation.y=-Math.PI/2;
  if(r.kind==='gloves'&&r.model.startsWith('manica_')){model.rotation.y=Math.PI/2;group.rotation.z=-.25;}
  scene.add(group);group.updateMatrixWorld(true);
  const dir=new T.Vector3(.35,.16,2).normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),dir).normalize(),up=new T.Vector3().crossVectors(dir,right),points=[];
  const box=new T.Box3().setFromObject(group),center=box.getCenter(new T.Vector3());let width=0,height=0;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).sub(center);width=Math.max(width,Math.abs(p.dot(right)));height=Math.max(height,Math.abs(p.dot(up)));}
  const edge=Math.max(width,height)*1.12,camera=new T.OrthographicCamera(-edge,edge,edge,-edge,.001,30);camera.position.copy(center).addScaledVector(dir,8);camera.lookAt(center);renderer.render(scene,camera);
  const geometry=[];group.traverse(o=>{if(o.isMesh){geometry.push({position:Array.from(o.geometry.attributes.position.array),index:o.geometry.index?Array.from(o.geometry.index.array):null});}});
  images.push({sku:r.sku,model:r.model,icon:r.icon,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,geometry,png:renderer.domElement.toDataURL().split(',')[1]});scene.remove(group);
 }
 renderer.dispose();environment.dispose();return images;
});assert.deepEqual(errors,[]);const report=[];for(const r of result){
 const png=Buffer.from(r.png,'base64'),icon=await sharp(png).resize(320,320).webp({quality:92,alphaQuality:100,effort:6}).toBuffer(),meta=await sharp(icon).metadata();assert.ok(meta.hasAlpha);assert.ok(icon.length<35000,r.sku+' icon budget');
 // Compare saved artwork to a fresh render, allowing only WebP and GPU rounding differences.
 if(process.env.LUDUS_REBUILD_ITEM_ICONS!=='1'){
  const a=await sharp(png).resize(320,320).ensureAlpha().raw().toBuffer(),b=await sharp(root+'/'+r.icon).ensureAlpha().raw().toBuffer();assert.equal(a.length,b.length);let union=0,intersection=0,error=0,n=0;
  for(let i=0;i<a.length;i+=4){if(a[i+3]>127||b[i+3]>127)union++;if(a[i+3]>127&&b[i+3]>127){intersection++;for(let k=0;k<3;k++){error+=Math.abs(a[i+k]-b[i+k]);n++;}}}
  assert.ok(intersection/union>.97,r.sku+' icon silhouette differs from model');assert.ok(error/(n*255)<.08,r.sku+' icon materials differ from model');
 }
 fs.writeFileSync(out+'/'+r.sku+'.png',png);if(process.env.LUDUS_REBUILD_ITEM_ICONS==='1'){fs.mkdirSync(path.dirname(root+'/'+r.icon),{recursive:true});fs.writeFileSync(root+'/'+r.icon,icon);}
 report.push({sku:r.sku,model:r.model,icon:r.icon,triangles:r.triangles,drawCalls:r.drawCalls,bytes:icon.length,geometrySha256:crypto.createHash('sha256').update(JSON.stringify(r.geometry)).digest('hex'),sha256:crypto.createHash('sha256').update(icon).digest('hex')});
}fs.writeFileSync(out+'/render-report.json',JSON.stringify(report,null,2)+'\n');if(process.env.LUDUS_REBUILD_ITEM_ICONS==='1')fs.writeFileSync(root+'/assets/items-v199/render-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({icons:report.length,bytes:report.reduce((s,r)=>s+r.bytes,0),errors}));return report;
}finally{await browser.close();server.closeAllConnections();server.close();}}
if(require.main===module)render().catch(e=>{console.error(e);server.close();process.exitCode=1;});module.exports={fixture,render};
