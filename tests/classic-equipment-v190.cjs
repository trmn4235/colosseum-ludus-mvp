const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs'),root=path.resolve(__dirname,'..');
const reports=JSON.parse(fs.readFileSync(root+'/assets/equipment-v190/build-report.json'));
function count(group){let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});return triangles;}
test('three embedded texture packages retain topology within transfer and decoded-image budgets',()=>{
 for(const r of reports){
  const bytes=fs.readFileSync(root+'/assets/equipment-v190/'+r.file),source=fs.readFileSync(root+'/'+r.file),d=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(bytes.length,r.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.equal(crypto.createHash('sha256').update(source).digest('hex'),r.sourceSha256);
  assert.ok(bytes.length<250000&&bytes.length<source.length*.15,r.file);assert.ok(d.extensionsRequired.includes('EXT_texture_webp'));
  assert.equal(d.animations?.length||0,0);assert.equal(d.materials.length,1);assert.equal(d.images.length,3);assert.ok(d.images.every(i=>i.mimeType==='image/webp'&&i.bufferView!==undefined&&!i.uri));
  assert.ok(r.textures.every(t=>t.width<=512&&t.height<=512));assert.ok(r.decodedTextureBytesWithMips<=3*1024*1024);
 }
});
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+': optimized shields and shared sword retain size, grip identity, topology and reuse',async()=>{
 const c=await rigRuntime(page.endsWith('.js')?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;
 assert.equal(c.ImportedEquipment.loaded,3,'the new image format must not silently fall back to procedural equipment');
 for(const [kind,file,get]of [['scutum','roman_scutum_shield.glb',()=>c.ImportedEquipment.shield('secutor')],['shield','roman_shield.glb',()=>c.ImportedEquipment.shield('hoplomachus')],['sword','roman_spatha.glb',()=>c.ImportedEquipment.weapon('gladius')]]){
  const bytes=fs.readFileSync(root+'/'+file),gltf=await new T.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),original=c.ImportedEquipment.prepare(gltf.scene,kind),packed=get();
  const a=new T.Box3().setFromObject(original),b=new T.Box3().setFromObject(packed);
  assert.equal(count(packed),count(original));assert.equal(count(packed),reports.find(r=>r.file===file).triangles);
  assert.ok(a.min.distanceTo(b.min)<.0003&&a.max.distanceTo(b.max)<.0003,'quantized bounds within 0.3 mm');
  assert.equal(packed.userData.asset,file,'logical asset identity retains both sword grip corrections');assert.equal(packed,get(),'reuse template');
  const left=[],right=[];packed.traverse(o=>{if(o.isMesh)left.push(o)});packed.clone(true).traverse(o=>{if(o.isMesh)right.push(o)});left.forEach((o,i)=>{assert.equal(o.geometry,right[i].geometry);assert.equal(o.material,right[i].material)});
 }
 assert.equal(c.ClassEquipment.weapon('gladius'),c.ClassEquipment.weapon('sica'),'two item IDs reuse one sword asset');
 const m=c.ImportedGladiator.create(190,'murmillo'),f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
 for(const weapon of ['gladius','sica'])for(const shieldStyle of ['secutor','hoplomachus']){
  Object.assign(f,{weapon,shield:true,shieldStyle,action:'idle',move:0});c.ImportedGladiator.animate(f,m,0,1/60);const sword=m.weaponAnchor.children[0],shield=m.gear.shield.group;
  for(let i=1;i<=45;i++){c.ImportedGladiator.animate(f,m,i/60,1/60);assert.equal(m.weaponAnchor.children[0],sword);assert.equal(m.gear.shield.group,shield);}
  assert.equal(sword.userData.asset,'roman_spatha.glb');assert.equal(count(shield),shieldStyle==='secutor'?1466:1246);
 }
 c.ImportedGladiator.dispose(m);
});
