/* Offline reduction and packing. Raw licensed models/textures are not published.
   npm: three@0.160.1 meshoptimizer@0.22.0 @gltf-transform/{core,extensions,functions}@4.1.1 sharp@0.34.3
   node scripts/pack-helmets-v189.mjs SOURCE_DIR PREPARED_DIR OUTPUT_DIR */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {mergeVertices,mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'meshoptimizer';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {dedup,prune,quantize,weld} from '@gltf-transform/functions';
import sharp from 'sharp';
const [source,prepared,output]=process.argv.slice(2);if(!output)throw Error('Expected source, prepared, output directories');
fs.mkdirSync(output,{recursive:true});
await MeshoptSimplifier.ready;
globalThis.window={URL};T.TextureLoader.prototype.load=function(){return new T.Texture();};
const input=fs.readFileSync(path.join(source,'steel.fbx')),root=new FBXLoader().parse(input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength),'');root.updateMatrixWorld(true);
const parts=[],geometries=[];
root.traverse(o=>{
 if(!o.isMesh)return;
 let g=mergeVertices(o.geometry.clone().applyMatrix4(o.matrixWorld),1e-5);const original=g.index.count/3;let error=0;
 if(o.name==='Rivets_low'){
  const [indices,e]=MeshoptSimplifier.simplify(new Uint32Array(g.index.array),g.attributes.position.array,3,660*3,.02,[]);error=e;g.setIndex(new T.BufferAttribute(indices,1));
 }
 parts.push({part:o.name,sourceTriangles:original,triangles:g.index.count/3,error});geometries.push(g);
});
const geometry=mergeVertices(mergeGeometries(geometries,false),1e-5);geometry.rotateY(Math.PI/2);geometry.computeBoundingBox();const box=geometry.boundingBox,size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-center.z);geometry.scale(.25/size.x,.35/size.y,.245/size.z);
const doc=new Document(),buffer=doc.createBuffer();
const p=doc.createPrimitive();
for(const [key,name,type] of [['position','POSITION','VEC3'],['normal','NORMAL','VEC3'],['uv','TEXCOORD_0','VEC2']])p.setAttribute(name,doc.createAccessor().setType(type).setArray(geometry.attributes[key].array).setBuffer(buffer));
p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(geometry.index.array)).setBuffer(buffer));
const prefix=path.join(source,'textures','Helmetv2_low_lambert1_');
function texture(name,bytes,mime){return doc.createTexture(name).setImage(bytes).setMimeType(mime);}
const base=texture('Original base colour',await sharp(prefix+'BaseColor.png').resize(512,512).jpeg({quality:82}).toBuffer(),'image/jpeg');
const normal=texture('Original normal',await sharp(prefix+'Normal.png').resize(512,512).webp({quality:90,effort:6}).toBuffer(),'image/webp');
const rough=await sharp(prefix+'Roughness.png').resize(256,256).greyscale().raw().toBuffer(),metal=await sharp(prefix+'Metallic.png').resize(256,256).greyscale().raw().toBuffer();
const orm=Buffer.alloc(256*256*3);for(let i=0;i<rough.length;i++){orm[i*3]=255;orm[i*3+1]=rough[i];orm[i*3+2]=metal[i];}
const packed=texture('Original roughness and metalness',await sharp(orm,{raw:{width:256,height:256,channels:3}}).webp({quality:90,effort:6}).toBuffer(),'image/webp');
p.setMaterial(doc.createMaterial('Source steel').setBaseColorTexture(base).setNormalTexture(normal).setMetallicRoughnessTexture(packed).setMetallicFactor(1).setRoughnessFactor(1));
doc.createScene().addChild(doc.createNode('Steel helmet').setMesh(doc.createMesh('Steel helmet').addPrimitive(p)));
doc.createExtension(EXTTextureWebP).setRequired(true);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
await io.write(path.join(prepared,'steel_helmet.glb'),doc);
const reports=[];
for(const id of ['viking_helmet','steel_helmet']){
 const d=id==='steel_helmet'?doc:await io.read(path.join(prepared,id+'.glb'));
 if(id==='viking_helmet'){
  const materials=d.getRoot().listMaterials();
  for(const t of d.getRoot().listTextures()){
   const isNormal=materials.some(m=>m.getNormalTexture()===t),isBase=materials.some(m=>m.getBaseColorTexture()===t);
   const size=isNormal||isBase?512:256;
   const image=sharp(t.getImage()).resize(size,size);
   t.setImage(await (isBase?image.jpeg({quality:82}):image.webp({quality:90,effort:6})).toBuffer()).setMimeType(isBase?'image/jpeg':'image/webp');
  }
  d.createExtension(EXTTextureWebP).setRequired(true);
 }
 await d.transform(weld(),dedup(),prune(),quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}));
 const meshes=d.getRoot().listMeshes(),primitives=meshes.flatMap(m=>m.listPrimitives());
 const triangles=primitives.reduce((n,p)=>n+p.getIndices().getCount()/3,0);
 const raw=Buffer.from(await io.writeBinary(d));
 const key=Buffer.from([208,72,199,66,217,77,28,174,206,97,233,116,84,211,101,150,96,56,75,205,232,216,123,120,80,21,163,4,179,62,121,210]),header=Buffer.from([67,77,69,49,54,55,0,1]);
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(header);
 const data=Buffer.concat([header,iv,cipher.update(raw),cipher.final(),cipher.getAuthTag()]);fs.writeFileSync(path.join(output,id+'.cme'),data);
 const sourceParts=id==='steel_helmet'?parts:JSON.parse(fs.readFileSync(path.join(prepared,'viking-source-report.json')));
 const textures=await Promise.all(d.getRoot().listTextures().map(async t=>{const m=await sharp(t.getImage()).metadata();return{name:t.getName(),width:m.width,height:m.height,bytes:t.getImage().length,mime:t.getMimeType()};}));
 reports.push({id,sourceTriangles:sourceParts.reduce((n,p)=>n+p.sourceTriangles,0),triangles,primitives:primitives.length,bytes:data.length,sourceBytes:fs.statSync(path.join(source,id==='viking_helmet'?'viking.fbx':'steel.fbx')).size,textures,parts:sourceParts,sha256:crypto.createHash('sha256').update(data).digest('hex')});
}
fs.writeFileSync(path.join(output,'build-report.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));
