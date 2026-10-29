/* Offline restoration of the original chest identity. No runtime decoder or source texture download. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {dedup,flatten,join,prune,simplify,weld} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
const root=path.resolve(process.argv[2]||'.'),dir=path.join(root,'assets/equipment-v199');
fs.mkdirSync(dir,{recursive:true});
const sourcePath='assets/equipment/gladiator_chest-e2f685b66fb6.glb',input=fs.readFileSync(path.join(root,sourcePath));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.readBinary(input);
const triangles=()=>doc.getRoot().listNodes().reduce((s,n)=>s+(n.getMesh()?.listPrimitives().reduce((v,p)=>v+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0)||0),0);
const before=triangles(),textures=[],materials=doc.getRoot().listMaterials();
for(const t of doc.getRoot().listTextures()){
 const old=Buffer.from(t.getImage()),meta=await sharp(old).metadata(),base=materials.some(m=>m.getBaseColorTexture()===t),normal=materials.some(m=>m.getNormalTexture()===t),size=base?512:normal?256:128;
 const bytes=await sharp(old).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp({quality:base?90:96,effort:6}).toBuffer();t.setImage(bytes).setMimeType('image/webp');
 const m=await sharp(bytes).metadata();textures.push({role:base?'baseColor':normal?'normal':'material',sourceWidth:meta.width,sourceHeight:meta.height,width:m.width,height:m.height,bytes:bytes.length});
}
if(textures.length)doc.createExtension(EXTTextureWebP).setRequired(true);
await MeshoptSimplifier.ready;
await doc.transform(dedup(),prune(),flatten(),join(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.065,error:.008,lockBorder:false}),prune());
const bytes=Buffer.from(await io.writeBinary(doc)),count=triangles();
if(count>4800||bytes.length>350000)throw Error('Restored chest exceeds its mobile budget: '+count+' triangles, '+bytes.length+' bytes');
fs.writeFileSync(path.join(dir,'gladiator_chest.glb'),bytes);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={version:199,source:sourcePath,sourceBytes:input.length,sourceTriangles:before,sourceSha256:sha(input),file:'assets/equipment-v199/gladiator_chest.glb',bytes:bytes.length,triangles:count,primitives:doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().length,0),sha256:sha(bytes),textures};
fs.writeFileSync(path.join(dir,'build-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
