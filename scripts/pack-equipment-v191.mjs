/* Offline asset reduction. No runtime decoder is added.
 * npm: @gltf-transform/{core,extensions,functions}@4.1.1 meshoptimizer@0.22.0 sharp@0.34.3
 * node scripts/pack-equipment-v191.mjs [REPOSITORY_ROOT]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {dedup,flatten,join,prune,quantize,simplify,weld} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';

const root=path.resolve(process.argv[2]||'.'),out=path.join(root,'assets/equipment-v191');
fs.mkdirSync(out,{recursive:true});
const key=Buffer.from([208,72,199,66,217,77,28,174,206,97,233,116,84,211,101,150,96,56,75,205,232,216,123,120,80,21,163,4,179,62,121,210]);
const header=Buffer.from([67,77,69,49,54,55,0,1]);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const source=fs.readFileSync(path.join(root,'assets/equipment-v167/sylvain_helmet.cme'));
const decipher=crypto.createDecipheriv('aes-256-gcm',key,source.subarray(8,20));
decipher.setAAD(header);decipher.setAuthTag(source.subarray(-16));
const raw=Buffer.concat([decipher.update(source.subarray(20,-16)),decipher.final()]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.readBinary(raw);
const triangles=()=>doc.getRoot().listNodes().reduce((s,n)=>s+(n.getMesh()?.listPrimitives().reduce((v,p)=>v+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0)||0),0);
const sourceTriangles=triangles(),textures=[],materials=doc.getRoot().listMaterials();
for(const t of doc.getRoot().listTextures()){
 const input=Buffer.from(t.getImage()),old=await sharp(input).metadata();
 const colour=materials.some(m=>m.getBaseColorTexture()===t),normal=materials.some(m=>m.getNormalTexture()===t),size=colour||normal?512:256;
 const data=await sharp(input).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp({...colour?{quality:90}:normal?{quality:96}:{lossless:true},effort:6}).toBuffer();
 const m=await sharp(data).metadata();t.setImage(data).setMimeType('image/webp');
 textures.push({role:colour?'baseColour':normal?'normal':'materialData',sourceWidth:old.width,sourceHeight:old.height,width:m.width,height:m.height,sourceBytes:input.length,bytes:data.length});
}
doc.createExtension(EXTTextureWebP).setRequired(true);
// Static helmet: merge its three rigid parts and preserve UV borders while reducing curved surfaces.
await doc.transform(dedup(),prune(),flatten(),join(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.5,error:.001,lockBorder:true}),prune(),quantize({quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));
const packed=Buffer.from(await io.writeBinary(doc)),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(header);
const bytes=Buffer.concat([header,iv,cipher.update(packed),cipher.final(),cipher.getAuthTag()]);
fs.writeFileSync(path.join(out,'sylvain_helmet.cme'),bytes);
const report={version:191,helmet:{file:'sylvain_helmet.cme',sourceBytes:source.length,bytes:bytes.length,sourceTriangles,triangles:triangles(),sourcePrimitives:3,primitives:doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().length,0),textures,sourceDecodedTextureBytesWithMips:textures.reduce((n,t)=>n+t.sourceWidth*t.sourceHeight*4*4/3,0),decodedTextureBytesWithMips:textures.reduce((n,t)=>n+t.width*t.height*4*4/3,0),sourceSha256:sha(source),sha256:sha(bytes)},icons:[]};
const iconOut=path.join(root,'assets/pit-v191');fs.mkdirSync(iconOut,{recursive:true});
for(const name of ['stone-icon','wood-icon']){
 const input=fs.readFileSync(path.join(root,'assets/pit-v178',name+'.png')),old=await sharp(input).metadata();
 const data=await sharp(input).resize(512,512,{fit:'inside',withoutEnlargement:true}).webp({quality:90,alphaQuality:100,effort:6}).toBuffer();
 const m=await sharp(data).metadata();fs.writeFileSync(path.join(iconOut,name+'.webp'),data);
 report.icons.push({file:name+'.webp',sourceBytes:input.length,bytes:data.length,sourceWidth:old.width,sourceHeight:old.height,width:m.width,height:m.height,alpha:m.hasAlpha,sourceSha256:sha(input),sha256:sha(data)});
}
report.greaves={sourceTrianglesPerPair:5096,trianglesPerPair:2312,sourceSharedGeometryBytes:72184,sharedGeometryBytes:37272,drawCallsPerPair:4,note:'Procedural geometry; both legs, fighters and dropped items share the template buffers. No external mesh download.'};
fs.writeFileSync(path.join(out,'build-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
