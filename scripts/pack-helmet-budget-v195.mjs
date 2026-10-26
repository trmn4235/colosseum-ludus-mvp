/* Offline packing; no new runtime decoder. Preserve every triangle and position.
 * npm: @gltf-transform/{core,extensions,functions}@4.1.1 sharp@0.34.3
 * node scripts/pack-helmet-budget-v195.mjs [REPOSITORY_ROOT]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {dedup,prune,quantize} from '@gltf-transform/functions';

const root=path.resolve(process.argv[2]||'.'),out=path.join(root,'assets/equipment-v195');
fs.mkdirSync(out,{recursive:true});
const key=Buffer.from([208,72,199,66,217,77,28,174,206,97,233,116,84,211,101,150,96,56,75,205,232,216,123,120,80,21,163,4,179,62,121,210]),header=Buffer.from([67,77,69,49,54,55,0,1]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function unpack(b){const d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(8,20));d.setAAD(header);d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(20,-16)),d.final()]);}
function pack(b){const iv=crypto.createHash('sha256').update('helmet-budget-v195').update(b).digest().subarray(0,12),c=crypto.createCipheriv('aes-256-gcm',key,iv);c.setAAD(header);return Buffer.concat([header,iv,c.update(b),c.final(),c.getAuthTag()]);}
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),rows=[];
const inputs=[
 ['gladiator','assets/equipment/gladiator-9bcb0ac9d566.glb','gladiator.glb','assets/items-v194/helmet-gold.webp'],
 ['knights','assets/equipment/knights-e30cc69af0fd.glb','knights.glb','assets/items-v194/helmet-silver.webp'],
 ['winged','assets/equipment/winged-111637d14990.glb','winged.glb','assets/items-v194/helmet-winged.webp'],
 ['roman','assets/equipment/roman-6d187d4b7f8c.glb','roman.glb','assets/items-v194/helmet-roman.webp'],
 ['sylvain_helmet','assets/equipment-v191/sylvain_helmet.cme','sylvain_helmet.cme','assets/items-v169/helmet-sylvain.webp']
];
for(const [id,source,file,icon]of inputs){
 const before=fs.readFileSync(path.join(root,source)),raw=source.endsWith('.cme')?unpack(before):before,doc=await io.readBinary(raw);
 const primitives=()=>doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives());
 const count=()=>primitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0);
 const positionHash=()=>{const h=crypto.createHash('sha256');for(const p of primitives())h.update(Buffer.from(p.getAttribute('POSITION').getArray().buffer,p.getAttribute('POSITION').getArray().byteOffset,p.getAttribute('POSITION').getArray().byteLength));return h.digest('hex');};
 const sourceTriangles=count(),sourcePositions=positionHash(),textures=[],materials=doc.getRoot().listMaterials();
 for(const t of doc.getRoot().listTextures()){
  const original=Buffer.from(t.getImage()),meta=await sharp(original).metadata(),colour=materials.some(m=>m.getBaseColorTexture()===t),normal=materials.some(m=>m.getNormalTexture()===t),role=colour?'baseColour':normal?'normal':'materialData';
  const size=colour||normal?512:256;
  const image=await sharp(original).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp({quality:colour?90:94,alphaQuality:100,effort:6}).toBuffer(),m=await sharp(image).metadata();
  t.setImage(image).setMimeType('image/webp');textures.push({role,sourceWidth:meta.width,sourceHeight:meta.height,width:m.width,height:m.height,sourceBytes:original.length,bytes:image.length});
 }
 doc.createExtension(EXTTextureWebP).setRequired(true);
 // Index width is storage only. Keep ordering, positions, topology, node transforms and fit intact.
 for(const p of primitives()){const a=p.getIndices();if(a&&a.getArray() instanceof Uint32Array&&a.getArray().every(v=>v<65536))a.setArray(new Uint16Array(a.getArray()));}
 // The legacy fitting code bakes world transforms; leave POSITION as Float32.
 if(!source.endsWith('.cme'))await doc.transform(quantize({pattern:/^(NORMAL|TANGENT|TEXCOORD_\d+)$/,quantizeNormal:16,quantizeTexcoord:16}));
 await doc.transform(dedup(),prune());
 if(count()!==sourceTriangles||positionHash()!==sourcePositions)throw Error(id+': geometry changed');
 const glb=Buffer.from(await io.writeBinary(doc)),bytes=file.endsWith('.cme')?pack(glb):glb;
 if(bytes.length>350000)throw Error(id+': exceeds 350 KB: '+bytes.length);
 fs.writeFileSync(path.join(out,file),bytes);
 rows.push({id,source,file:'assets/equipment-v195/'+file,sourceBytes:before.length,bytes:bytes.length,sourceTriangles,triangles:count(),positionsIdentical:true,positionSha256:sourcePositions,sourceSha256:sha(before),sha256:sha(bytes),icon,iconBytes:fs.statSync(path.join(root,icon)).size,textures,decodedTextureBytesWithMips:textures.reduce((n,t)=>n+t.width*t.height*4*4/3,0)});
}
for(const [id,icon]of [['viking_helmet','assets/items-v189/helmet-viking.webp'],['steel_helmet','assets/items-v189/helmet-steel.webp']]){
 const file='assets/equipment-v189/'+id+'.cme',bytes=fs.readFileSync(path.join(root,file)),doc=await io.readBinary(unpack(bytes)),triangles=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0);
 if(bytes.length>350000)throw Error(id+': exceeds 350 KB');
 rows.push({id,source:file,file,sourceBytes:bytes.length,bytes:bytes.length,sourceTriangles:triangles,triangles,positionsIdentical:true,unchanged:true,sourceSha256:sha(bytes),sha256:sha(bytes),icon,iconBytes:fs.statSync(path.join(root,icon)).size});
}
const report={version:195,maxModelAndTextureBytes:350000,helmets:rows};
fs.writeFileSync(path.join(out,'build-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(({id,sourceBytes,bytes,triangles,iconBytes})=>({id,sourceBytes,bytes,triangles,iconBytes})),null,2));
