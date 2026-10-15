/* Offline only: no simplifier, mesh processing or new character asset in gameplay.
   Reproduce with meshoptimizer 1.3.0 (MIT), MESHOPT_MODULE=/path/to/index.js. */
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {rigRuntime}=require('../tests/performance-v84.cjs');
(async()=>{
 const {MeshoptSimplifier:S}=await import(pathToFileURL(process.env.MESHOPT_MODULE||require.resolve('meshoptimizer')).href);await S.ready;
 const c=await rigRuntime(),m=c.ImportedGladiator.create(1);let g;m.visual.traverse(o=>{if(o.isSkinnedMesh)g=o.geometry;});
 const a=g.attributes,count=a.position.count,positions=new Float32Array(count*3),attributes=new Float32Array(count*13);
 for(let i=0;i<count;i++){
  for(let k=0;k<3;k++){positions[i*3+k]=a.position.getComponent(i,k);attributes[i*13+k]=a.normal.getComponent(i,k);}
  for(let k=0;k<2;k++)attributes[i*13+3+k]=a.uv.getComponent(i,k);
  for(let k=0;k<4;k++){attributes[i*13+5+k]=a.skinIndex.getComponent(i,k);attributes[i*13+9+k]=a.skinWeight.getComponent(i,k);}
 }
 const indices=Uint32Array.from(g.index.array),weights=[.08,.08,.08,.08,.08,.003,.003,.003,.003,.15,.15,.15,.15],levels=[];
 for(const [target,error] of [[18000,.004],[7500,.009]]){
  const [index,actualError]=S.simplifyWithAttributes(indices,positions,3,attributes,13,weights,null,target*3,error,[]);
  levels.push(index);console.log(JSON.stringify({triangles:index.length/3,error:actualError,sourceTriangles:indices.length/3,vertices:count}));
 }
 const header=Uint32Array.from([0x10610d,count,indices.length,...levels.map(a=>a.length)]),buffer=Buffer.concat([Buffer.from(header.buffer),...levels.map(a=>Buffer.from(a.buffer))]);
 fs.writeFileSync(path.join(__dirname,'../assets/naval/gladiator-lod-v106.bin'),buffer);
})().catch(e=>{console.error(e);process.exitCode=1;});
