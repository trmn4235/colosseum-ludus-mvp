/* V217 file invariants, independent of the simplifier's reported error. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {read,accessor,values}=require('../tools/retopo-character-v214.cjs');
const root=path.resolve(__dirname,'..'),changedNames=new Set(['loin_geo_Gladiator_MAT_0','shoes_geo_Gladiator_MAT_0']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function visible(j){return j.meshes.filter(m=>!/^(helmet|shield|weapon)_geo/.test(m.name)).reduce((n,m)=>n+j.accessors[m.primitives[0].indices].count/3,0);}
function vertexKeys(model,p){
 const ids=Object.values(p.attributes),buffers=ids.map(id=>accessor(model,id)),widths=ids.map((id,i)=>buffers[i].length/model.json.accessors[id].count);
 return Array.from({length:model.json.accessors[p.attributes.POSITION].count},(_,v)=>buffers.map((b,i)=>b.subarray(v*widths[i],(v+1)*widths[i]).toString('base64')).join('|'));
}
function topology(model,p){
 const pos=values(model,p.attributes.POSITION),ix=values(model,p.indices),vertices=new Set(),edges=new Map();
 const keys=Array.from({length:pos.length/3},(_,i)=>[pos[i*3],pos[i*3+1],pos[i*3+2]].join(','));
 for(let i=0;i<ix.length;i+=3){
  const [a,b,c]=ix.subarray(i,i+3);assert.ok(a<keys.length&&b<keys.length&&c<keys.length,'indices are bounded');
  assert.ok(a!==b&&a!==c&&b!==c,'no repeated triangle vertices');
  const u=[0,1,2].map(k=>pos[b*3+k]-pos[a*3+k]),v=[0,1,2].map(k=>pos[c*3+k]-pos[a*3+k]);
  assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-10,'nonzero triangle area');
  for(const id of [a,b,c])vertices.add(keys[id]);
  for(const [x,y]of [[a,b],[b,c],[c,a]]){const key=keys[x]<keys[y]?keys[x]+'|'+keys[y]:keys[y]+'|'+keys[x];edges.set(key,(edges.get(key)||0)+1);}
 }
 assert.ok([...edges.values()].every(n=>n<=2),'no nonmanifold edges after welding coincident positions');
 return {vertices:vertices.size,edges:edges.size,faces:ix.length/3,euler:vertices.size-edges.size+ix.length/3,borderEdges:[...edges.values()].filter(n=>n===1).length};
}
function compareAssets({integration=true}={}){
 const before=read(root+'/gladiator-mobile-v214.glb'),after=read(root+'/gladiator-mobile-v217.glb'),a=before.json,b=after.json,changed=new Set(),meshes=[],mapping={};
 for(const key of ['nodes','skins','animations','scenes','scene','materials','textures','samplers','extensionsUsed','extensionsRequired'])assert.deepEqual(b[key],a[key],key+' preserved');
 assert.deepEqual(b.meshes,a.meshes,'mesh identities, primitive attributes and materials');assert.equal(b.accessors.length,a.accessors.length);
 const storageOnly=new Set(['bufferView','byteOffset','count','min','max']),metadata=a=>Object.fromEntries(Object.entries(a).filter(([key])=>!storageOnly.has(key)));
 for(let i=0;i<a.accessors.length;i++)assert.deepEqual(metadata(b.accessors[i]),metadata(a.accessors[i]),'accessor type/normalization '+i);
 for(let i=0;i<a.meshes.length;i++){
  const mesh=a.meshes[i],p=mesh.primitives[0],count=b.accessors[p.attributes.POSITION].count,ix=values(after,p.indices);
  assert.ok(ix.every(v=>v<count),mesh.name+' valid indices');
  for(const id of Object.values(p.attributes))assert.ok(values(after,id).every(Number.isFinite),mesh.name+' finite attributes');
  if(!changedNames.has(mesh.name))continue;
  const oldKeys=vertexKeys(before,p),nextKeys=vertexKeys(after,p),lookup=new Map(oldKeys.map((key,index)=>[key,index]));
  const toOriginal=nextKeys.map(key=>{assert.ok(lookup.has(key),'position, normal, tangent, UV, joints and weights retained byte exactly');return lookup.get(key);});
  const retained=new Set(nextKeys),removed=oldKeys.map((_,v)=>v).filter(v=>!retained.has(oldKeys[v]));
  const joints=values(after,p.attributes.JOINTS_0),weights=values(after,p.attributes.WEIGHTS_0);
  for(let v=0;v<count;v++){let sum=0;for(let k=0;k<4;k++){assert.ok(joints[v*4+k]<b.skins[0].joints.length);assert.ok(weights[v*4+k]>=0&&weights[v*4+k]<=1);sum+=weights[v*4+k];}assert.ok(Math.abs(sum-1)<1e-5,'normalized skin weights');}
  const oldJoints=values(before,p.attributes.JOINTS_0),oldWeights=values(before,p.attributes.WEIGHTS_0),oldIx=values(before,p.indices),dominant=oldKeys.map((_,v)=>{let slot=0;for(let k=1;k<4;k++)if(oldWeights[v*4+k]>oldWeights[v*4+slot])slot=k;return oldJoints[v*4+slot];}),locks=new Set();
  for(let t=0;t<oldIx.length;t+=3){const [x,y,z]=oldIx.subarray(t,t+3);if(dominant[x]!==dominant[y]||dominant[x]!==dominant[z])for(const v of [x,y,z])locks.add(v);}
  for(const v of locks)assert.ok(retained.has(oldKeys[v]),'bone transition vertex survives');
  const oldTopology=topology(before,p),newTopology=topology(after,p);
  assert.equal(newTopology.euler,oldTopology.euler,mesh.name+' welded surface topology');
  if(!oldTopology.borderEdges)assert.equal(newTopology.borderEdges,0,mesh.name+' remains closed');
  assert.ok(ix.length<oldIx.length&&count<oldKeys.length&&removed.length>0,'actual reduction');
  Object.values(p.attributes).concat(p.indices).forEach(id=>changed.add(id));
  mapping[mesh.name]={toOriginal,removed};meshes.push({name:mesh.name,beforeTriangles:oldIx.length/3,afterTriangles:ix.length/3,beforeVertices:oldKeys.length,afterVertices:count,lockedVertices:locks.size,oldTopology,newTopology});
 }
 assert.equal(meshes.length,2);
 for(let i=0;i<a.accessors.length;i++)if(!changed.has(i))assert.deepEqual(accessor(after,i),accessor(before,i),'unchanged body/eyes, equipment, skin or animation accessor '+i);
 assert.equal(b.images.length,a.images.length);
 for(let i=0;i<a.images.length;i++){assert.deepEqual(metadata(b.images[i]),metadata(a.images[i]),'texture format '+i);const av=a.bufferViews[a.images[i].bufferView],bv=b.bufferViews[b.images[i].bufferView];assert.deepEqual(after.binary.subarray(bv.byteOffset,bv.byteOffset+bv.byteLength),before.binary.subarray(av.byteOffset,av.byteOffset+av.byteLength),'texture bytes '+i);}
 assert.ok(after.bytes.length<before.bytes.length&&visible(b)<visible(a),'measured file and geometry reduction');
 if(integration){
  for(const file of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js','circus-war-view-v186.js']){
   const code=fs.readFileSync(root+'/'+file,'utf8');assert.ok(code.includes("'gladiator-mobile-v217.glb'"),file+' new asset URL');assert.ok(!code.includes("'gladiator-mobile-v214.glb'"),file+' old asset removed');
  }
  const lod=fs.readFileSync(root+'/assets/naval/gladiator-lod-v217.bin'),header=new Uint32Array(lod.buffer,lod.byteOffset,5),manifest=JSON.parse(fs.readFileSync(root+'/assets/naval/gladiator-lod-v217.json','utf8'));
  const bodyVertices=b.meshes.filter(m=>!/^(helmet|shield|weapon)_geo/.test(m.name)).reduce((n,m)=>n+b.accessors[m.primitives[0].attributes.POSITION].count,0);
  assert.equal(header[0],0x10610d);assert.equal(header[1],bodyVertices,'LOD vertex layout matches active GLB');assert.equal(header[2]/3,visible(b));assert.equal(lod.length,20+(header[3]+header[4])*4);
  assert.ok(header[3]/3<=18000&&header[4]/3<=7500);assert.ok(new Uint32Array(lod.buffer,lod.byteOffset+20,(lod.length-20)/4).every(v=>v<header[1]));
  assert.equal(manifest.source,'gladiator-mobile-v217.glb');assert.equal(manifest.sourceBytes,after.bytes.length);assert.equal(manifest.sourceSha256,hash(after.bytes));assert.equal(manifest.sha256,hash(lod));assert.equal(manifest.bytes,lod.length);assert.equal(manifest.vertices,header[1]);assert.equal(manifest.sourceTriangles,header[2]/3);
  assert.ok(fs.readFileSync(root+'/naval-performance-v106.js','utf8').includes('assets/naval/gladiator-lod-v217.bin'),'active LOD cache URL');
 }
 return {report:{beforeBytes:before.bytes.length,afterBytes:after.bytes.length,beforeVisibleTriangles:visible(a),afterVisibleTriangles:visible(b),texturesIdentical:true,bodyEyesSkinAnimationsIdentical:true,retainedVertexAttributesIdentical:true,meshes,integration},mapping};
}
if(require.main===module)console.log(JSON.stringify(compareAssets({integration:process.env.LUDUS_V217_ASSET_ONLY!=='1'}).report,null,2));
module.exports={compareAssets};
