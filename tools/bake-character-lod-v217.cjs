/* Offline only. Rebuild the shared body LOD indices for the V217 GLB.
 * Reproduce with meshoptimizer@0.23.0; MESHOPT_MODULE may point to its index.js.
 * The game reuses the original position/normal/UV/skin buffers at every level.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{pathToFileURL}=require('node:url');
const {rigRuntime}=require('../tests/performance-v84.cjs');
const root=path.resolve(__dirname,'..'),source='gladiator-mobile-v217.glb',output='assets/naval/gladiator-lod-v217.bin';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const {MeshoptSimplifier:S}=await import(pathToFileURL(process.env.MESHOPT_MODULE||require.resolve('meshoptimizer')).href);await S.ready;
 const sourceBytes=fs.readFileSync(path.join(root,source)),c=await rigRuntime(),m=c.ImportedGladiator.create(1),bodies=[];
 m.visual.traverse(o=>{if(o.isSkinnedMesh)bodies.push(o);});assert.equal(bodies.length,1,'One shared merged character body');
 const g=bodies[0].geometry,a=g.attributes,count=a.position.count,positions=new Float32Array(count*3),attributes=new Float32Array(count*13);
 for(let i=0;i<count;i++){
  for(let k=0;k<3;k++){positions[i*3+k]=a.position.getComponent(i,k);attributes[i*13+k]=a.normal.getComponent(i,k);}
  for(let k=0;k<2;k++)attributes[i*13+3+k]=a.uv.getComponent(i,k);
  for(let k=0;k<4;k++){attributes[i*13+5+k]=a.skinIndex.getComponent(i,k);attributes[i*13+9+k]=a.skinWeight.getComponent(i,k);}
 }
 const indices=Uint32Array.from(g.index.array),weights=[.08,.08,.08,.08,.08,.003,.003,.003,.003,.15,.15,.15,.15],levels=[],measurements=[];
 assert.equal(count,24454,'Use the V217 body vertex order');assert.equal(indices.length/3,41638,'Use the V217 body topology');
 for(const [target,error]of [[18000,.004],[7500,.009]]){
  const [index,actualError]=S.simplifyWithAttributes(indices,positions,3,attributes,13,weights,null,target*3,error,[]);
  assert.ok(index.length>0&&index.length/3<=target,'Preserve the existing triangle budget');
  for(const vertex of index)assert.ok(vertex<count,'LOD indices address original vertices');
  levels.push(index);measurements.push({targetTriangles:target,triangles:index.length/3,relativeError:actualError});
 }
 const header=Uint32Array.from([0x10610d,count,indices.length,...levels.map(a=>a.length)]),bytes=Buffer.concat([Buffer.from(header.buffer),...levels.map(a=>Buffer.from(a.buffer))]);
 const report={source,sourceBytes:sourceBytes.length,sourceSha256:hash(sourceBytes),vertices:count,sourceTriangles:indices.length/3,output,bytes:bytes.length,sha256:hash(bytes),levels:measurements};
 assert.equal(hash(fs.readFileSync(path.join(root,source))),report.sourceSha256,'Source GLB must remain unchanged');
 fs.writeFileSync(path.join(root,output),bytes);fs.writeFileSync(path.join(root,'assets/naval/gladiator-lod-v217.json'),JSON.stringify(report,null,2)+'\n');
 c.ImportedGladiator.dispose(m);console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
