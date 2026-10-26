const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const{rigRuntime}=require('./performance-v84.cjs'),oldReport=require('../assets/equipment-v196/build-report.json'),report=require('../assets/equipment-v197/build-report.json');
test('fitted equipment keeps topology, textures and transfer budgets; shaft is centered in the grip',async()=>{
 const c=await rigRuntime('ludus.html');c.crypto=crypto.webcrypto;vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);const T=c.THREE;
 for(const row of report.items){
  const before=oldReport.items.find(r=>r.id===row.id);assert.equal(row.triangles,before.triangles);assert.equal(row.drawCalls,before.drawCalls);assert.ok(Math.abs(row.bytes-before.bytes)<1024);assert.equal(row.fitVersion,197);
  const models=[],textureHashes=[];for(const version of [196,197]){const raw=await c.LudusEquipmentCatalog.decode(fs.readFileSync('assets/equipment-v'+version+'/'+row.file));const data=Buffer.from(raw),jsonLength=data.readUInt32LE(12),json=JSON.parse(data.subarray(20,20+jsonLength).toString()),binary=28+jsonLength;textureHashes.push(json.images.map(image=>{const v=json.bufferViews[image.bufferView];return crypto.createHash('sha256').update(data.subarray(binary+(v.byteOffset||0),binary+(v.byteOffset||0)+v.byteLength)).digest('hex');}));models.push((await new T.GLTFLoader().parseAsync(raw,'')).scene);}
  assert.deepEqual(textureHashes[0],textureHashes[1]);
  const meshes=[];for(const model of models){const list=[];model.traverse(o=>{if(o.isMesh)list.push(o)});meshes.push(list);}assert.equal(meshes[0].length,meshes[1].length);
  for(let i=0;i<meshes[0].length;i++){
   const a=meshes[0][i].geometry,b=meshes[1][i].geometry;assert.equal(a.index.count,b.index.count);assert.deepEqual(Array.from(a.index.array),Array.from(b.index.array));for(let v=0;v<a.attributes.uv.count;v++){assert.equal(a.attributes.uv.getX(v),b.attributes.uv.getX(v));assert.equal(a.attributes.uv.getY(v),b.attributes.uv.getY(v));}for(let v=0;v<b.attributes.position.count;v++)assert.ok([b.attributes.position.getX(v),b.attributes.position.getY(v),b.attributes.position.getZ(v)].every(Number.isFinite));
   if(['upper','fore'].includes(meshes[1][i].name)){b.computeBoundingBox();const box=b.boundingBox;assert.ok(box.max.y-box.min.y<.23);for(let v=0;v<b.attributes.position.count;v++)assert.ok(Math.hypot(b.attributes.position.getX(v),b.attributes.position.getZ(v))<.15,'no torso-sized flare');}
  }
  if(row.id==='trident_gladiator'){
   const oldBox=new T.Box3().setFromObject(models[0]),box=new T.Box3().setFromObject(models[1]);assert.ok(Math.abs((box.max.y-box.min.y)/(oldBox.max.y-oldBox.min.y)-1.2)<.01,'20% longer shaft');assert.ok(Math.abs(box.min.y+.45)<1e-5,'usable shaft behind the palm');
   const a=meshes[1][0].geometry.attributes.position;for(const [low,high]of [[-.3,-.1],[0,.2],[.3,.6]]){const ring=[];for(let i=0;i<a.count;i++)if(a.getY(i)>=low&&a.getY(i)<high)ring.push([a.getX(i),a.getZ(i)]);assert.ok(ring.length>8);for(const k of [0,1])assert.ok(Math.abs((Math.max(...ring.map(p=>p[k]))+Math.min(...ring.map(p=>p[k])))/2)<.004,'shaft axis stays in the palm');}
   assert.deepEqual(row.axisScale,[1.3,1.2,1.3]);
  }
 }
});
test('legacy manica is mounted before animation and switching cannot capture a bent pose',async()=>{
 const c=await rigRuntime('ludus.html'),T=c.THREE,m=c.ImportedGladiator.create(197,'murmillo'),f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
 const matrices=new Map();for(const side of ['Left','Right']){const slot=m.gear[side+'manica'];assert.ok(slot);m.root.updateMatrixWorld(true);matrices.set(side,new T.Matrix4().copy(m.bones[side+'ForeArm'].matrixWorld).invert().multiply(slot.group.matrixWorld));}
 Object.assign(f,{weapon:'trident',action:'attack',attackWeapon:'trident',attackProfile:c.ArenaMotion.profile('trident'),timer:.4,shoulderModel:'starter'});for(let i=0;i<15;i++)c.ImportedGladiator.animate(f,m,i/60,1/60);
 f.shoulders=true;f.shoulderModel='manica';c.ImportedGladiator.animate(f,m,.4,1/60);m.root.updateMatrixWorld(true);
 for(const side of ['Left','Right']){const slot=m.gear[side+'manica'],relative=new T.Matrix4().copy(m.bones[side+'ForeArm'].matrixWorld).invert().multiply(slot.group.matrixWorld);assert.ok(slot.group.visible);assert.ok(relative.elements.every((v,i)=>Math.abs(v-matrices.get(side).elements[i])<1e-6));}
 c.ImportedGladiator.dispose(m);
});
