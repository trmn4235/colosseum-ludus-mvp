/* Offline clothing/footwear reduction only; this is not manual retopology.
 * Reproduce with meshoptimizer@0.23.0 (MESHOPT_MODULE may point to index.js).
 * Retained vertex bytes, skin, animation, body, eyes and image bytes are preserved.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {read,accessor,values,bounds,pack}=require('./retopo-character-v214.cjs');
const root=path.resolve(__dirname,'..'),sourceFile='gladiator-mobile-v214.glb',outputFile='gladiator-mobile-v217.glb';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function main(){
 const {MeshoptSimplifier:S}=require(process.env.MESHOPT_MODULE||'meshoptimizer');await S.ready;
 const source=read(path.join(root,sourceFile)),json=structuredClone(source.json),arrays=json.accessors.map((_,i)=>accessor(source,i));
 const images=json.images.map(im=>{const v=json.bufferViews[im.bufferView];return source.binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);});
 const targets={loin_geo_Gladiator_MAT_0:9000,shoes_geo_Gladiator_MAT_0:10000},meshes=[];
 for(const mesh of json.meshes){
  const target=targets[mesh.name];if(!target)continue;
  assert.equal(mesh.primitives.length,1,'Expected one material primitive');
  const p=mesh.primitives[0],positions=values(source,p.attributes.POSITION),normals=values(source,p.attributes.NORMAL),uvs=values(source,p.attributes.TEXCOORD_0);
  const joints=values(source,p.attributes.JOINTS_0),weights=values(source,p.attributes.WEIGHTS_0),indices=Uint32Array.from(values(source,p.indices)),count=positions.length/3;
  const attributes=new Float32Array(count*5),dominant=new Uint16Array(count),locks=new Uint8Array(count);
  for(let i=0;i<count;i++){
   attributes.set(normals.subarray(i*3,i*3+3),i*5);attributes.set(uvs.subarray(i*2,i*2+2),i*5+3);
   let slot=0;for(let k=1;k<4;k++)if(weights[i*4+k]>weights[i*4+slot])slot=k;dominant[i]=joints[i*4+slot];
  }
  for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.subarray(i,i+3);if(dominant[a]!==dominant[b]||dominant[a]!==dominant[c])locks[a]=locks[b]=locks[c]=1;}
  // The error ceiling may stop above the requested target. Never relax seam,
  // border or dominant-bone locks merely to meet a headline triangle count.
  const [reduced,error]=S.simplifyWithAttributes(indices,positions,3,attributes,5,[.5,.5,.5,1,1],locks,target*3,.003,['LockBorder']);
  const [remap,vertexCount]=S.compactMesh(reduced);
  assert.ok(reduced.length<indices.length&&error<=.00301,'Bounded reduction');
  assert.equal(json.accessors[p.indices].componentType,5125,'Keep 32-bit indices');
  for(const id of Object.values(p.attributes)){
   const a=json.accessors[id],width=arrays[id].length/a.count,compact=Buffer.alloc(vertexCount*width);
   for(let old=0;old<remap.length;old++)if(remap[old]!==0xffffffff)arrays[id].copy(compact,remap[old]*width,old*width,(old+1)*width);
   a.count=vertexCount;arrays[id]=compact;bounds(a,compact);
  }
  arrays[p.indices]=Buffer.from(reduced.buffer,reduced.byteOffset,reduced.byteLength);json.accessors[p.indices].count=reduced.length;bounds(json.accessors[p.indices],arrays[p.indices]);
  meshes.push({name:mesh.name,targetTriangles:target,beforeTriangles:indices.length/3,afterTriangles:reduced.length/3,beforeVertices:count,afterVertices:vertexCount,lockedVertices:locks.reduce((a,b)=>a+b,0),relativeError:error});
 }
 assert.equal(meshes.length,2,'Only the two intended meshes');
 const output=pack(json,arrays,images),visible=j=>j.meshes.filter(m=>!/^(helmet|shield|weapon)_geo/.test(m.name)).reduce((n,m)=>n+j.accessors[m.primitives[0].indices].count/3,0);
 const report={source:sourceFile,sourceSha256:hash(source.bytes),output:outputFile,outputSha256:hash(output),beforeBytes:source.bytes.length,afterBytes:output.length,beforeVisibleTriangles:visible(source.json),afterVisibleTriangles:visible(json),maxRelativeError:.003,meshes};
 fs.writeFileSync(path.join(root,outputFile),output);fs.writeFileSync(path.join(root,'tests/character-asset-v217.json'),JSON.stringify(report,null,2)+'\n');
 assert.equal(hash(fs.readFileSync(path.join(root,sourceFile))),report.sourceSha256,'Source stays unchanged');
 console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
