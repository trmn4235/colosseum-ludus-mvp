// Offline conversion only. Requires the same pinned tools as pack-equipment-v191.mjs.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {dedup,flatten,join,prune,quantize,simplify,weld} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';import sharp from 'sharp';
const [source,out]=process.argv.slice(2);if(!source||!out)throw Error('Usage: CONVERTED_DIRECTORY OUTPUT_DIRECTORY');
fs.mkdirSync(out,{recursive:true});await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(path.join(source,'axe-source.glb'));
const triangles=()=>doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((v,p)=>v+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0);
const textures=[],materials=doc.getRoot().listMaterials();
for(const t of doc.getRoot().listTextures()){
 const colour=materials.some(m=>m.getBaseColorTexture()===t),normal=materials.some(m=>m.getNormalTexture()===t);
 const data=await sharp(Buffer.from(t.getImage())).webp({quality:colour?88:normal?94:100,lossless:!colour&&!normal,effort:6}).toBuffer(),meta=await sharp(data).metadata();
 t.setImage(data).setMimeType('image/webp');textures.push({role:colour?'color':normal?'normal':'materialData',width:meta.width,height:meta.height,bytes:data.length});
}
doc.createExtension(EXTTextureWebP).setRequired(true);
await doc.transform(dedup(),prune(),flatten(),join(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.38,error:.003,lockBorder:true}),prune(),quantize({quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));
const raw=Buffer.from(await io.writeBinary(doc));
const header=Buffer.from([67,77,69,49,54,55,0,1]),key=Buffer.from([208,72,199,66,217,77,28,174,206,97,233,116,84,211,101,150,96,56,75,205,232,216,123,120,80,21,163,4,179,62,121,210]),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(header);
const packed=Buffer.concat([header,iv,cipher.update(raw),cipher.final(),cipher.getAuthTag()]);
fs.writeFileSync(path.join(out,'pit_axe.cme'),packed);
const report={...JSON.parse(fs.readFileSync(path.join(source,'source-report.json'))),version:192,bytes:packed.length,triangles:triangles(),primitives:doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().length,0),textures,decodedTextureBytesWithMips:textures.reduce((n,t)=>n+t.width*t.height*4*4/3,0),sha256:crypto.createHash('sha256').update(packed).digest('hex')};
fs.writeFileSync(path.join(out,'build-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
