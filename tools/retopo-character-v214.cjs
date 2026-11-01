/* Offline, index-only reduction. npm install --no-save meshoptimizer@0.23.0
 * Keeps the body/eyes, original vertex attributes, skin, animation and textures.
 * Only the loin cloth and shoes are reduced; this is not manual retopology.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},types={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
function read(file){
 const bytes=fs.readFileSync(file),size=bytes.readUInt32LE(12);
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 return {bytes,json:JSON.parse(bytes.subarray(20,20+size)),binary:bytes.subarray(size+28)};
}
function accessor(model,id){
 const a=model.json.accessors[id],v=model.json.bufferViews[a.bufferView],Type=types[a.componentType];assert.ok(Type&&!a.sparse,'packed accessor');
 const width=components[a.type]*Type.BYTES_PER_ELEMENT,stride=v.byteStride||width,offset=(v.byteOffset||0)+(a.byteOffset||0),packed=Buffer.alloc(a.count*width);
 for(let i=0;i<a.count;i++)model.binary.copy(packed,i*width,offset+i*stride,offset+i*stride+width);
 return packed;
}
function values(model,id){const a=model.json.accessors[id],b=accessor(model,id),Type=types[a.componentType];return new Type(b.buffer,b.byteOffset,b.length/Type.BYTES_PER_ELEMENT);}
function bounds(a,bytes){
 if(!a.min&&!a.max)return;const Type=types[a.componentType],data=new Type(bytes.buffer,bytes.byteOffset,bytes.length/Type.BYTES_PER_ELEMENT),width=components[a.type];
 const min=Array(width).fill(Infinity),max=Array(width).fill(-Infinity);
 for(let i=0;i<data.length;i++){min[i%width]=Math.min(min[i%width],data[i]);max[i%width]=Math.max(max[i%width],data[i]);}if(a.min)a.min=min;if(a.max)a.max=max;
}
function pack(json,arrays,images){
 const chunks=[],views=[];let length=0;
 const append=(bytes,target)=>{const padding=(4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}const id=views.length;views.push({buffer:0,byteOffset:length,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes);length+=bytes.length;return id;};
 json.accessors.forEach((a,i)=>{const target=json.bufferViews[a.bufferView].target;a.bufferView=append(arrays[i],target);delete a.byteOffset;});
 json.images.forEach((im,i)=>{im.bufferView=append(images[i]);});json.bufferViews=views;json.buffers=[{byteLength:length}];
 const raw=Buffer.from(JSON.stringify(json)),j=Buffer.alloc((raw.length+3)&~3,0x20);raw.copy(j);const bin=Buffer.concat(chunks),b=Buffer.alloc((bin.length+3)&~3);bin.copy(b);
 const h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+b.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(b.length,0);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,j,bh,b]);
}
async function main(){
 const {MeshoptSimplifier:S}=require('meshoptimizer');await S.ready;
 const source=read(path.join(root,'gladiator-mobile-v213.glb')),j=structuredClone(source.json),arrays=j.accessors.map((_,i)=>accessor(source,i));
 const images=j.images.map(im=>{const v=j.bufferViews[im.bufferView];return source.binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}),meshes=[];
 const targets={loin_geo_Gladiator_MAT_0:12000,shoes_geo_Gladiator_MAT_0:12926};
 for(const mesh of j.meshes){
  const p=mesh.primitives[0],before=j.accessors[p.indices].count/3,target=targets[mesh.name];if(!target)continue;
  const pos=values(source,p.attributes.POSITION),normal=values(source,p.attributes.NORMAL),uv=values(source,p.attributes.TEXCOORD_0),joints=values(source,p.attributes.JOINTS_0),weights=values(source,p.attributes.WEIGHTS_0),indices=new Uint32Array(values(source,p.indices)),count=pos.length/3;
  const attrs=new Float32Array(count*5),dominant=new Uint16Array(count),locks=new Uint8Array(count);
  for(let i=0;i<count;i++){attrs.set(normal.subarray(i*3,i*3+3),i*5);attrs.set(uv.subarray(i*2,i*2+2),i*5+3);let slot=0;for(let k=1;k<4;k++)if(weights[i*4+k]>weights[i*4+slot])slot=k;dominant[i]=joints[i*4+slot];}
  // Keep edges where the dominant bone changes, in addition to open borders/UV seams.
  for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.subarray(i,i+3);if(dominant[a]!==dominant[b]||dominant[a]!==dominant[c])locks[a]=locks[b]=locks[c]=1;}
  const [reduced,error]=S.simplifyWithAttributes(indices,pos,3,attrs,5,[.5,.5,.5,1,1],locks,target*3,.002,['LockBorder']);
  const [remap,vertexCount]=S.compactMesh(reduced);
  for(const id of Object.values(p.attributes)){
   const a=j.accessors[id],width=arrays[id].length/a.count,compact=Buffer.alloc(vertexCount*width);
   for(let old=0;old<remap.length;old++)if(remap[old]!==0xffffffff)arrays[id].copy(compact,remap[old]*width,old*width,(old+1)*width);
   a.count=vertexCount;arrays[id]=compact;bounds(a,compact);
  }
  arrays[p.indices]=Buffer.from(reduced.buffer,reduced.byteOffset,reduced.byteLength);j.accessors[p.indices].count=reduced.length;bounds(j.accessors[p.indices],arrays[p.indices]);
  meshes.push({name:mesh.name,beforeTriangles:before,afterTriangles:reduced.length/3,beforeVertices:count,afterVertices:vertexCount,lockedVertices:locks.reduce((a,b)=>a+b,0),relativeError:error});
 }
 const output=pack(j,arrays,images),file=path.join(root,'gladiator-mobile-v214.glb');fs.writeFileSync(file,output);
 const visible=model=>model.meshes.filter(m=>!/^(helmet|shield|weapon)_geo/.test(m.name)).reduce((n,m)=>n+model.accessors[m.primitives[0].indices].count/3,0);
 const report={source:'gladiator-mobile-v213.glb',output:path.basename(file),beforeBytes:source.bytes.length,afterBytes:output.length,beforeVisibleTriangles:visible(source.json),afterVisibleTriangles:visible(j),meshes};
 fs.writeFileSync(path.join(root,'tests/character-asset-v214.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={read,accessor,values,bounds,pack};
