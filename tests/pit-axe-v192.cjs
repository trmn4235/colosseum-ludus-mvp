const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs'),report=require('../assets/pit-v192/build-report.json');
test('axe stays within geometry, texture and hand-scale budgets and shares its buffers',async()=>{
 const c=await rigRuntime(),T=c.THREE;c.crypto=crypto.webcrypto;
 for(const file of ['equipment-catalog-v167.js','pit-arena-v172.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const bytes=fs.readFileSync('assets/pit-v192/pit_axe.cme'),raw=Buffer.from(await c.LudusEquipmentCatalog.decode(bytes)),json=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
 assert.equal(bytes.length,report.bytes);assert.ok(bytes.length<140000);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),report.sha256);
 assert.ok(report.triangles<=1700);assert.ok(report.decodedTextureBytesWithMips<1024*1024);assert.ok(report.textures.every(t=>t.width<=256&&t.height<=256));
 assert.ok(!json.skins?.length&&!json.animations?.length);assert.ok(json.images.every(i=>i.bufferView!==undefined&&i.mimeType==='image/webp'&&!i.uri));
 const axe=await c.LudusEquipmentCatalog.load(T,'pit_axe',{bytes}),b=new T.Box3().setFromObject(axe,true),size=b.getSize(new T.Vector3()),meshes=[];
 axe.traverse(o=>{if(o.isMesh)meshes.push(o)});assert.equal(meshes.length,2);assert.equal(meshes.reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0),report.triangles);
 assert.ok(Math.abs(size.y-.90)<.004);assert.ok(Math.abs(b.min.y+.14)<.004);assert.ok(size.x<.4&&size.z<.08);
 await c.LudusEquipmentCatalog.load(T,'pit_wood_mace',{bytes:fs.readFileSync('assets/pit-v173/pit_wood_mace.cme')});
 for(const type of Object.keys(c.ArenaClasses)){
  const m=c.ImportedGladiator.create(192,type),reference=c.ImportedGladiator.create(192,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];c.PitArena.equip(f,{pit_model:'pit_axe'});
  assert.equal(f.pitWeapon,'pit_axe');assert.equal(f.weapon,'heavy_mace');assert.ok(!f.pitBow&&!f.shield&&!f.chest&&!f.helmet);
  const p=c.ArenaMotion.profile(f.weapon);let weapon;
  for(const action of ['idle','walk','attack','guard','dodge','hurt','down'])for(let i=0;i<12;i++){
   Object.assign(f,{action:['walk','guard'].includes(action)?'idle':action,attackWeapon:f.weapon,attackProfile:p,duration:action==='dodge'?.46:p.duration,blocking:action==='guard',move:action==='walk'?1:0,hp:action==='down'?0:100,reaction:action==='hurt'?.2:0,timer:i/60,walk:i/8,deadTime:i/60});
   c.ImportedGladiator.animate(f,m,i/60,1/60);c.ImportedGladiator.animate({...f,pitWeapon:'pit_wood_mace'},reference,i/60,1/60);m.root.updateMatrixWorld(true);reference.root.updateMatrixWorld(true);
   weapon||=m.weaponAnchor.children[0];assert.equal(m.weaponAnchor.children[0],weapon);assert.equal(m.equippedWeapon,'pit_axe');
   assert.ok(m.weaponAnchor.matrixWorld.elements.every((v,k)=>Number.isFinite(v)&&Math.abs(v-reference.weaponAnchor.matrixWorld.elements[k])<1e-5),'axe uses the existing fitted hand socket through '+action);
  }
  const clones=[];weapon.traverse(o=>{if(o.isMesh)clones.push(o)});assert.equal(clones.length,2);clones.forEach((o,i)=>{assert.equal(o.geometry,meshes[i].geometry);assert.equal(o.material,meshes[i].material)});
  c.ImportedGladiator.dispose(m);c.ImportedGladiator.dispose(reference);
 }
});
test('preload deduplicates selected weapons and does not fetch an unselected axe',async()=>{
 const calls=[],c={THREE:{},LudusEquipmentCatalog:{load:async(_,id)=>calls.push(id)}};vm.createContext(c);vm.runInContext(fs.readFileSync('pit-arena-v172.js','utf8'),c);
 await c.PitArena.preload(['pit_stone_mace','pit_bow','pit_stone_mace']);assert.deepEqual(calls,['pit_stone_mace']);
 calls.length=0;await c.PitArena.preload(['pit_axe','pit_axe','pit_wood_mace']);assert.deepEqual(calls,['pit_axe','pit_wood_mace']);
});
