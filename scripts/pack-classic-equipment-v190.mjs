/* Offline texture and vertex packing; topology, materials and item identities stay intact.
 * npm: @gltf-transform/{core,extensions,functions}@4.1.1 sharp@0.34.3
 * node scripts/pack-classic-equipment-v190.mjs SOURCE_ROOT OUTPUT_DIR
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {dedup,flatten,join,prune,quantize,weld} from '@gltf-transform/functions';
import sharp from 'sharp';

const [source='.',output='assets/equipment-v190']=process.argv.slice(2);
fs.mkdirSync(output,{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),reports=[];
const triangleCount=doc=>doc.getRoot().listNodes().reduce((sum,n)=>sum+(n.getMesh()?.listPrimitives().reduce((v,p)=>v+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0)||0),0);
for(const file of ['roman_scutum_shield.glb','roman_shield.glb','roman_spatha.glb']){
 const input=fs.readFileSync(path.join(source,file)),doc=await io.readBinary(input),triangles=triangleCount(doc),materials=doc.getRoot().listMaterials(),textures=[];
 for(const texture of doc.getRoot().listTextures()){
  const original=Buffer.from(texture.getImage()),meta=await sharp(original).metadata();
  const normal=materials.some(m=>m.getNormalTexture()===texture),colour=materials.some(m=>m.getBaseColorTexture()===texture),size=colour||normal?512:256;
  const encoded=await sharp(original).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp({...(colour?{quality:88}:normal?{quality:94}:{lossless:true}),effort:6}).toBuffer();
  texture.setImage(encoded).setMimeType('image/webp');const next=await sharp(encoded).metadata();
  textures.push({role:colour?'baseColour':normal?'normal':'occlusionRoughnessMetalness',sourceWidth:meta.width,sourceHeight:meta.height,width:next.width,height:next.height,sourceBytes:original.length,bytes:encoded.length,lossless:!colour&&!normal});
 }
 doc.createExtension(EXTTextureWebP).setRequired(true);
 // Join the small shield's seven rigid pieces before quantization; the game keeps one draw call.
 await doc.transform(dedup(),flatten(),join(),weld(),prune(),quantize({quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));
 if(triangleCount(doc)!==triangles)throw Error(file+': topology changed');
 const data=Buffer.from(await io.writeBinary(doc));fs.writeFileSync(path.join(output,file),data);
 const report={file,version:190,sourceBytes:input.length,bytes:data.length,reductionPercent:Number(((1-data.length/input.length)*100).toFixed(2)),triangles,textures,decodedTextureBytesWithMips:textures.reduce((n,t)=>n+t.width*t.height*4*4/3,0),sourceSha256:crypto.createHash('sha256').update(input).digest('hex'),sha256:crypto.createHash('sha256').update(data).digest('hex')};
 reports.push(report);console.log(JSON.stringify(report));
}
fs.writeFileSync(path.join(output,'build-report.json'),JSON.stringify(reports,null,2)+'\n');
