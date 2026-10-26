const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const report=require('../assets/equipment-v195/build-report.json');
const c=vm.createContext({crypto:crypto.webcrypto});vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
async function glb(file){const bytes=fs.readFileSync(file),raw=file.endsWith('.cme')?Buffer.from(await c.LudusEquipmentCatalog.decode(bytes)):bytes,n=raw.readUInt32LE(12);return {bytes,j:JSON.parse(raw.subarray(20,20+n)),bin:raw.subarray(28+n)};}
function accessor(model,index){const a=model.j.accessors[index],v=model.j.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],unit={5122:2,5123:2,5125:4,5126:4}[a.componentType],size=width*unit,stride=v.byteStride||size,start=(v.byteOffset||0)+(a.byteOffset||0);assert.ok(size);return Buffer.concat(Array.from({length:a.count},(_,i)=>model.bin.subarray(start+i*stride,start+i*stride+size)));}
function primitives(m){return m.j.meshes.flatMap(x=>x.primitives);}
function indices(m,p){const a=m.j.accessors[p.indices],b=accessor(m,p.indices),unit=a.componentType===5125?4:2;return Array.from({length:a.count},(_,i)=>unit===4?b.readUInt32LE(i*unit):b.readUInt16LE(i*unit));}
test('all seven active helmets include their textures within 350,000 bytes',async()=>{
 assert.equal(report.helmets.length,7);assert.equal(report.maxModelAndTextureBytes,350000);
 for(const row of report.helmets){const model=await glb(row.file);assert.equal(model.bytes.length,row.bytes);assert.ok(model.bytes.length<=350000,row.id);assert.equal(crypto.createHash('sha256').update(model.bytes).digest('hex'),row.sha256);assert.ok(model.j.images.length>0);assert.ok(model.j.images.every(i=>Number.isInteger(i.bufferView)&&!i.uri));assert.ok(model.j.buffers.every(b=>!b.uri));assert.equal(primitives(model).reduce((n,p)=>n+model.j.accessors[p.indices].count/3,0),row.triangles);assert.equal(fs.statSync(row.icon).size,row.iconBytes);}
});
test('packing preserves every triangle, vertex position and material assignment',async()=>{
 for(const row of report.helmets.filter(h=>!h.unchanged)){
  const before=await glb(row.source),after=await glb(row.file),a=primitives(before),b=primitives(after);assert.equal(a.length,b.length);assert.equal(before.j.materials.length,after.j.materials.length);
  const hash=crypto.createHash('sha256');for(let i=0;i<a.length;i++){const positions=accessor(before,a[i].attributes.POSITION);assert.deepEqual(accessor(after,b[i].attributes.POSITION),positions,row.id+' positions');hash.update(positions);assert.deepEqual(indices(after,b[i]),indices(before,a[i]),row.id+' topology');assert.equal(before.j.materials[a[i].material].name,after.j.materials[b[i].material].name);}
  assert.equal(hash.digest('hex'),row.positionSha256);assert.equal(row.sourceTriangles,row.triangles);assert.ok(row.bytes<row.sourceBytes);assert.equal(crypto.createHash('sha256').update(before.bytes).digest('hex'),row.sourceSha256);
 }
});
test('every rig uses the budgeted files without falling back to a heavier helmet',()=>{
 for(const file of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js']){const s=fs.readFileSync(file,'utf8'),data=JSON.parse(s.match(/var LUDUS_HELMET_DATA=(\{[^;]+\});/)[1]);for(const row of report.helmets.filter(h=>!h.id.endsWith('_helmet')))assert.equal(data[row.id],row.file,file+' '+row.id);}
 for(const row of report.helmets.filter(h=>h.id.endsWith('_helmet'))){const file=require('node:path').normalize('assets/equipment-v167/'+c.LudusEquipmentCatalog.entry(row.id).file);assert.equal(file,row.file);}
 for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','san-avlusu.html','equipment-preview-v167.html'])assert.match(fs.readFileSync(page,'utf8'),/equipment-catalog-v167\.js\?v=revision198/);
 assert.match(fs.readFileSync('caravan-battle-v126.js','utf8'),/revision198/);assert.match(fs.readFileSync('pit-visit-v172.js','utf8'),/s.src=file\+'\?v='\+\('revision198'\)/);
});
