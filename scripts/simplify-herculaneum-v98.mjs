/** Offline only. npm packages: @gltf-transform/core/functions 4.3.0, meshoptimizer 1.3.0.
 * NODE_PATH is supported for installing build tools outside the game directory.
 */
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {NodeIO}=await import(pathToFileURL(require.resolve('@gltf-transform/core')));
const {weld,prune,dedup,join}=await import(pathToFileURL(require.resolve('@gltf-transform/functions')));
const {MeshoptSimplifier}=await import(pathToFileURL(require.resolve('meshoptimizer')));
await MeshoptSimplifier.ready;
const [input,output]=process.argv.slice(2); if(!input||!output)throw Error('Provide intermediate.glb and output.glb');
const io=new NodeIO(),doc=await io.read(input),root=doc.getRoot();
await doc.transform(weld());
const report=[];
for(const node of root.listNodes()){
 const mesh=node.getMesh();if(!mesh)continue;
 const role=node.getExtras().navalRole;
 for(const p of mesh.listPrimitives()){
  const index=p.getIndices(),pos=p.getAttribute('POSITION'),count=pos.getCount(),indices=new Uint32Array(index.getArray());
  const attributes=new Float32Array(count*8),normal=p.getAttribute('NORMAL').getArray(),uv=p.getAttribute('TEXCOORD_0').getArray(),color=p.getAttribute('COLOR_0').getArray();
  for(let i=0;i<count;i++){attributes.set(normal.slice(i*3,i*3+3),i*8);attributes.set(uv.slice(i*2,i*2+2),i*8+3);attributes.set(color.slice(i*3,i*3+3),i*8+5);}
  const ratio=role==='deck'?.08:role==='sail'?.14:role==='mast'?.3:role.startsWith('oars')?.46:role==='hull'?.44:.45;
  const target=Math.max(36,Math.floor(indices.length*ratio/3)*3);
  const [reduced,error]=MeshoptSimplifier.simplifyWithAttributes(indices,pos.getArray(),3,attributes,8,[.2,.2,.2,.08,.08,.15,.15,.15],null,target,role==='deck'?.001:.012,['Permissive']);
  const [remap,unique]=MeshoptSimplifier.compactMesh(reduced);
  for(const semantic of p.listSemantics()){
   const a=p.getAttribute(semantic),old=a.getArray(),width=a.getElementSize(),result=new old.constructor(unique*width);
   for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)result.set(old.subarray(i*width,(i+1)*width),remap[i]*width);
   a.setArray(result);
  }
  index.setArray(unique<=65535?new Uint16Array(reduced):reduced);
  report.push({name:mesh.getName(),role,before:indices.length/3,after:reduced.length/3,error});
 }
}
// Merge only static meshes with the same material AND role. Keeping oar banks
// separate gives cheap group rotation without skeleton evaluation.
for(const role of ['hull','mast','sail','deck','rigging','rudder','oars-port','oars-starboard']){
 const nodes=root.listNodes().filter(n=>n.getExtras().navalRole===role);
 if(nodes.length<2)continue;
 const group=doc.createNode('Herculaneum '+role).setExtras({navalRole:role});root.listScenes()[0].addChild(group);
 for(const n of nodes)group.addChild(n);
}
await doc.transform(join({keepNamed:false,keepExtras:true}),dedup(),prune());
fs.mkdirSync(path.dirname(output),{recursive:true});await io.write(output,doc);
const data={sourceBytes:22618708,sourceTriangles:66776,bytes:fs.statSync(output).size,
 triangles:root.listMeshes().reduce((sum,m)=>sum+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0),
 meshes:root.listMeshes().length,materials:root.listMaterials().length,textures:root.listTextures().length,parts:report};
fs.writeFileSync(output.replace(/\.glb$/,'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));
