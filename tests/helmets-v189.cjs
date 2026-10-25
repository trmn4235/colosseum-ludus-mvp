const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs');
// CPU rig tests skip pixels; the browser suite decodes the actual WebP images.
function cpuTextures(c){const Loader=c.THREE.GLTFLoader;c.THREE.GLTFLoader=class extends Loader{constructor(...args){super(...args);this.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new c.THREE.Texture())}));}};}
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])for(const id of ['viking_helmet','steel_helmet'])test(page+': '+id+' loads on demand, follows the head and survives switching',async()=>{
 const c=await rigRuntime(page==='caravan-rig-v126.js'?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;
 cpuTextures(c);c.crypto=webcrypto;let requests=0;c.fetch=async url=>{requests++;return new Response(fs.readFileSync(url))};vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
 assert.equal(requests,0);const engine=new c.ArenaCombat(()=>.999),m=c.ImportedGladiator.create(169,'murmillo'),f=engine.reset('normal','murmillo').fighters[0];
 Object.assign(f,{x:0,z:0,angle:0,helmet:true,helmetModel:id,weapon:null,shield:false,shoulders:false,chest:false,offhand:null,leftGear:null});
 c.ImportedGladiator.animate(f,m,0,1/60);assert.equal(requests,1);const empty=m.gear.helmet.group;
 await c.LudusEquipmentCatalog.load(T,id);c.ImportedGladiator.animate(f,m,1/60,1/60);
 assert.notEqual(m.gear.helmet.group,empty,'async load replaces the placeholder without changing selected gear');
 assert.equal(m.gear.helmet.group.userData.catalogId,id);assert.equal(m.gear.helmet.anchor.parent,m.bones.Head);
 const stable=m.gear.helmet.group;let relative;
 for(const action of ['idle','walk','attack','guard','dodge','hurt','down']){
  const profile=c.ArenaMotion.profile('gladius');Object.assign(f,{action:action==='walk'||action==='guard'?'idle':action,weapon:action==='attack'?'gladius':null,attackWeapon:'gladius',attackProfile:profile,duration:action==='dodge'?.46:profile.duration,blocking:action==='guard',move:action==='walk'?1:0,hp:action==='down'?0:100,reaction:action==='hurt'?.2:0});
  for(let i=0;i<60;i++){
   f.timer=i/120;f.walk=i/12;f.deadTime=i/60;c.ImportedGladiator.animate(f,m,2+i/60,1/60);m.root.updateMatrixWorld(true);
   const local=new T.Matrix4().copy(m.bones.Head.matrixWorld).invert().multiply(m.gear.helmet.group.matrixWorld).elements;
   if(!relative)relative=local.slice();assert.ok(local.every((x,j)=>Number.isFinite(x)&&Math.abs(x-relative[j])<1e-7),'no pose-dependent slip relative to head');
   assert.equal(m.gear.helmet.group,stable,'no per-frame rebuilding/flicker');assert.equal(stable.visible,true);
  }
 }
 assert.equal(requests,1);let meshCount=0;stable.traverse(o=>{if(o.isMesh){meshCount++;assert.equal(o.frustumCulled,false)}});assert.equal(meshCount,1);
 Object.assign(f,{hp:100,action:'idle',helmetModel:'roman'});c.ImportedGladiator.animate(f,m,4,1/60);assert.equal(m.helmetStyle,'roman');
 f.helmetModel=id;c.ImportedGladiator.animate(f,m,5,1/60);assert.equal(m.gear.helmet.group.userData.catalogId,id);assert.equal(requests,1);
 const drop=c.ClassEquipment.item({kind:'helmet',itemEntry:{item:{kind:'helmet',model:id}}});assert.equal(drop,c.LudusEquipmentCatalog.get(id));
 c.ImportedGladiator.dispose(m);
});
test('both helmets fit bounded geometry, texture and transfer budgets',async()=>{
 const reports=JSON.parse(fs.readFileSync('assets/equipment-v189/build-report.json','utf8'));
 const c=await rigRuntime('arena.html');cpuTextures(c);c.crypto=webcrypto;vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
 for(const r of reports){
  const bytes=fs.readFileSync('assets/equipment-v189/'+r.id+'.cme');assert.equal(bytes.length,r.bytes);assert.ok(r.bytes<350000);assert.equal(r.primitives,1);
  assert.ok(r.triangles<=(r.id==='viking_helmet'?4500:2500));assert.ok(r.triangles<r.sourceTriangles);
  assert.equal(c.LudusEquipmentCatalog.entry(r.id).triangles,r.triangles);
  assert.ok(r.textures.every(t=>t.width<=512&&t.height<=512));assert.ok(r.textures.reduce((sum,t)=>sum+t.width*t.height*4*4/3,0)<=3*1024*1024);
  const raw=await c.LudusEquipmentCatalog.decode(bytes),view=new DataView(raw),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,20,view.getUint32(12,true))));
  assert.equal(doc.animations?.length||0,0);assert.equal(doc.materials.length,1);assert.ok(doc.images.every(i=>i.bufferView!==undefined&&!i.uri));
  const template=await c.LudusEquipmentCatalog.load(c.THREE,r.id,{bytes}),meshes=[];template.traverse(o=>{if(o.isMesh)meshes.push(o)});
  for(let i=0;i<20;i++){const cloned=[];template.clone(true).traverse(o=>{if(o.isMesh)cloned.push(o)});assert.equal(cloned.length,1);assert.equal(cloned[0].geometry,meshes[0].geometry);assert.equal(cloned[0].material,meshes[0].material);}
 }
});
test('two distinct recipes and actual model photographs are registered',()=>{
 const p=require('../ludus-production-v119.js');
 for(const [sku,id,label] of [['helmet-viking','viking_helmet','Boynuzlu Viking miğferi'],['helmet-steel','steel_helmet','Çelik miğfer']]){
  const r=p.recipes.find(r=>r.sku===sku);assert.equal(r.model,id);assert.equal(r.name,label);assert.equal(r.output_quantity,1);assert.deepEqual(r.ingredients,{steel:5,leather:3,linen:2,wool_cloth:1});
  assert.equal(p.skuForItem({kind:'helmet',model:id}),sku);assert.match(p.artwork({kind:'helmet',model:id}),new RegExp('items-v189/'+sku));assert.ok(fs.statSync(p.photo(sku)).size>2000);
 }
});
