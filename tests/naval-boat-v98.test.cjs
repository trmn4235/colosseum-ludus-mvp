const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const bytes=fs.readFileSync(path.join(__dirname,'../assets/naval/herculaneum-v98.glb'));
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const primitives=doc.meshes.flatMap(m=>m.primitives);

test('the downloaded boat remains within the mobile asset budget',()=>{
 assert.equal(bytes.subarray(0,4).toString(),'glTF');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.ok(bytes.length<2_000_000,'ship download must stay below 2 MB');
 const triangles=primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0);
 assert.ok(triangles<10_000,'four ships must stay below 40,000 asset triangles');
 assert.ok(doc.meshes.length<=16,'keep the draw cost bounded per boat');
 assert.ok(doc.textures.length<=8);
 assert.equal(doc.animations?.length||0,0);
 assert.equal(doc.skins?.length||0,0);
 for(const p of primitives){assert.equal(p.targets?.length||0,0);assert.equal(p.attributes.JOINTS_0,undefined);}
 assert.deepEqual(doc.extensionsRequired||[],[],'no runtime decoder dependency');
 assert.ok(doc.buffers.every(b=>!b.uri)&&doc.images.every(i=>!i.uri),'asset is self-contained');
});

test('the enlarged visible hull fits inside the simulation collision envelope',()=>{
 const {constants:C}=require('../naval-simulation-v97.js');
 const boxes=doc.nodes.filter(n=>n.mesh!==undefined&&n.extras?.navalRole==='hull')
  .flatMap(n=>doc.meshes[n.mesh].primitives.map(p=>doc.accessors[p.attributes.POSITION]));
 const lo=[0,1,2].map(k=>Math.min(...boxes.map(b=>b.min[k])));
 const hi=[0,1,2].map(k=>Math.max(...boxes.map(b=>b.max[k])));
 assert.ok(hi[2]-lo[2]>16,'the intended enlarged hull is present');
 assert.ok(hi[0]-lo[0]>6,'five-person battle deck has a widened hull');
 assert.ok(Math.max(Math.abs(lo[0]),Math.abs(hi[0]))<=C.hullWidth);
 assert.ok(Math.max(Math.abs(lo[2]),Math.abs(hi[2]))<=C.hullLength);
});

test('the redistributed derivative preserves attribution and modification notice',()=>{
 const credit=doc.asset.extras;
 assert.match(credit.author,/Opus Poly/);
 assert.match(credit.license,/CC-BY-4\.0/);
 assert.match(credit.source,/fd84e8e9cf184426b1701e80c9018067/);
 assert.match(credit.modifications,/Widened battle deck/);
 assert.match(credit.sourceSHA256,/^[a-f0-9]{64}$/);
});
