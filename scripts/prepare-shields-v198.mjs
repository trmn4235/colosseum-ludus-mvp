/* Six user-selected shields, reduced offline from their licensed originals.
 * node scripts/prepare-shields-v198.mjs SOURCE_DIRECTORY [REPOSITORY_ROOT]
 * Dependencies: @gltf-transform/{core,extensions,functions}@4.1.1,
 * meshoptimizer@0.22.0, three@0.160.0, sharp@0.34.3.
 * CGTrader #8 is converted deterministically; no generative-AI processing.
 */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {dedup,prune,weld,simplify,join,quantize,getBounds} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';import {Vector3,Matrix4,Euler} from 'three';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';import sharp from 'sharp';
const source=path.resolve(process.argv[2]),root=path.resolve(process.argv[3]||'.'),out=path.join(root,'assets/equipment-v198');fs.mkdirSync(out,{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),reports=[],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const key=Buffer.from([208,72,199,66,217,77,28,174,206,97,233,116,84,211,101,150,96,56,75,205,232,216,123,120,80,21,163,4,179,62,121,210]),header=Buffer.from([67,77,69,49,54,55,0,1]);
const configs=[
 {number:2,id:'shield_dura',sku:'shield-dura',label:'Dura Europos oval kalkanı',height:1.12,group:'large_shields',triangles:2500,rotation:[0,0,0]},
 {number:7,id:'shield_parma',sku:'shield-parma',label:'Ahşap Parma kalkanı',height:.74,group:'small_medium_shields',triangles:2000,rotation:[0,0,0]},
 {number:8,id:'shield_celtic',sku:'shield-celtic',label:'Yeşil motifli kalkan',height:.78,group:'small_medium_shields',triangles:2200,rotation:[Math.PI/2,0,0]},
 {number:17,id:'shield_azure',sku:'shield-azure',label:'Mavi demir kuşaklı kalkan',height:.80,group:'small_medium_shields',triangles:3500,rotation:[0,-Math.PI/2,0]},
 {number:19,id:'shield_viridis',sku:'shield-viridis',label:'Yeşil Roma kule kalkanı',height:1.24,group:'large_shields',triangles:2600,rotation:[0,0,0]},
 {number:22,id:'shield_aquila',sku:'shield-aquila',label:'Kartal işlemeli kule kalkanı',height:1.30,group:'large_shields',triangles:2800,rotation:[0,0,0]}
];
async function objDocument(){
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),object=new OBJLoader().parse(fs.readFileSync(path.join(source,'8.obj'),'utf8'));
 const folder=path.join(source,'8-PBR/PBR'),texture=(name,file)=>doc.createTexture(name).setImage(fs.readFileSync(path.join(folder,file))).setMimeType(file.endsWith('.jpg')?'image/jpeg':'image/png');
 const material=doc.createMaterial('Shield_PBR').setBaseColorTexture(texture('Original green motif','shield_diffuse.jpg')).setMetallicFactor(1).setRoughnessFactor(1);
 const rough=await sharp(path.join(folder,'shield_roughness.jpg')).resize(1024,1024).greyscale().raw().toBuffer(),metal=await sharp(path.join(folder,'shield_met.png')).resize(1024,1024).greyscale().raw().toBuffer(),orm=Buffer.alloc(rough.length*3);
 for(let i=0;i<rough.length;i++){orm[i*3]=255;orm[i*3+1]=rough[i];orm[i*3+2]=metal[i];}
 material.setMetallicRoughnessTexture(doc.createTexture('Original roughness and metalness').setMimeType('image/png').setImage(await sharp(orm,{raw:{width:1024,height:1024,channels:3}}).png().toBuffer()));
 object.traverse(o=>{if(!o.isMesh)return;const mesh=doc.createMesh(o.name),p=doc.createPrimitive().setMaterial(material);for(const [src,dst,type]of [['position','POSITION','VEC3'],['normal','NORMAL','VEC3'],['uv','TEXCOORD_0','VEC2']])p.setAttribute(dst,doc.createAccessor().setBuffer(buffer).setType(type).setArray(new Float32Array(o.geometry.attributes[src].array)));p.setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(Uint32Array.from({length:o.geometry.attributes.position.count},(_,i)=>i)));mesh.addPrimitive(p);scene.addChild(doc.createNode(o.name).setMesh(mesh));});
 return doc;
}
async function atlas(doc,primitives,id){const materials=[...new Set(primitives.map(p=>p.getMaterial()))],cols=materials.length===1?1:materials.length<=4?2:3,rows=Math.ceil(materials.length/cols),tile=materials.length===1?512:materials.length<=4?256:170,pad=4,inner=tile-pad*2,width=cols*tile,height=rows*tile,composites={base:[],normal:[],orm:[]},cropInfo=[];
 for(let mi=0;mi<materials.length;mi++){const m=materials[mi],ps=primitives.filter(p=>p.getMaterial()===m),all=ps.flatMap(p=>Array.from(p.getAttribute('TEXCOORD_0').getArray())),us=all.filter((_,i)=>i%2===0),vs=all.filter((_,i)=>i%2===1);let u0=Math.max(0,Math.min(...us)-.005),v0=Math.max(0,Math.min(...vs)-.005),u1=Math.min(1,Math.max(...us)+.005),v1=Math.min(1,Math.max(...vs)+.005);if(Math.min(...us)<0||Math.max(...us)>1||Math.min(...vs)<0||Math.max(...vs)>1){u0=v0=0;u1=v1=1}cropInfo.push({material:m.getName(),uvBounds:[u0,v0,u1,v1]});
  async function pixels(texture,fallback){if(!texture)return Buffer.from(Array.from({length:inner*inner},()=>fallback).flat());const image=Buffer.from(texture.getImage()),meta=await sharp(image).metadata(),left=Math.floor(u0*meta.width),top=Math.floor(v0*meta.height),w=Math.max(1,Math.ceil(u1*meta.width)-left),h=Math.max(1,Math.ceil(v1*meta.height)-top);return sharp(image).extract({left,top,width:Math.min(w,meta.width-left),height:Math.min(h,meta.height-top)}).resize(inner,inner).removeAlpha().toColourspace('srgb').raw().toBuffer();}
  const base=await pixels(m.getBaseColorTexture(),[255,255,255]),normal=await pixels(m.getNormalTexture(),[128,128,255]),orm=await pixels(m.getMetallicRoughnessTexture(),[255,255,255]),ao=m.getOcclusionTexture()?await pixels(m.getOcclusionTexture(),[255,255,255]):null,factor=m.getBaseColorFactor();
  const srgb=x=>x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055,linear=x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);
  for(let i=0;i<base.length;i+=3){for(let k=0;k<3;k++)base[i+k]=Math.round(srgb(linear(base[i+k]/255)*factor[k])*255);orm[i]=ao?ao[i]:255;orm[i+1]=Math.round(orm[i+1]*m.getRoughnessFactor());orm[i+2]=Math.round(orm[i+2]*m.getMetallicFactor())}
  const left=(mi%cols)*tile,top=Math.floor(mi/cols)*tile;
  for(const [role,data]of Object.entries({base,normal,orm})){const b=await sharp(data,{raw:{width:inner,height:inner,channels:3}}).extend({top:pad,bottom:pad,left:pad,right:pad,extendWith:'copy'}).png().toBuffer();composites[role].push({input:b,left,top})}
  for(const p of ps){const uv=p.getAttribute('TEXCOORD_0'),a=new Float32Array(uv.getCount()*2);for(let i=0;i<uv.getCount();i++){let v=[];uv.getElement(i,v);a[i*2]=(left+pad+(v[0]-u0)/(u1-u0)*inner)/width;a[i*2+1]=(top+pad+(v[1]-v0)/(v1-v0)*inner)/height}uv.setArray(a)}
 }
 const material=doc.createMaterial(id+' original PBR atlas').setDoubleSided(true),textureReport=[];
 for(const role of ['base','normal','orm']){const data=await sharp({create:{width,height,channels:3,background:{r:0,g:0,b:0}}}).composite(composites[role]).webp({quality:role==='normal'?94:role==='base'?88:94,effort:6}).toBuffer(),t=doc.createTexture(id+' '+role).setImage(data).setMimeType('image/webp');if(role==='base')material.setBaseColorTexture(t);if(role==='normal')material.setNormalTexture(t);if(role==='orm')material.setMetallicRoughnessTexture(t).setOcclusionTexture(t);textureReport.push({role,width,height,bytes:data.length})}
 primitives.forEach(p=>p.setMaterial(material));for(const m of materials){for(const e of m.listExtensions())e.dispose();m.dispose()}doc.createExtension(EXTTextureWebP).setRequired(true);return{textures:textureReport,crops:cropInfo};}

for(const config of configs){
 const bytes=fs.readFileSync(path.join(source,config.number+(config.number===8?'.obj':'.glb'))),doc=config.number===8?await objDocument():await io.readBinary(bytes),oldNodes=doc.getRoot().listNodes(),scene=doc.createScene(config.id),buffer=doc.createBuffer(),mesh=doc.createMesh(config.id),primitives=[];
 const rotation=new Matrix4().makeRotationFromEuler(new Euler(...config.rotation));let sourceTriangles=0;
 for(const n of oldNodes)if(n.getMesh())for(const p of n.getMesh().listPrimitives()){
  const a=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),uv=p.getAttribute('TEXCOORD_0'),matrix=rotation.clone().multiply(new Matrix4().fromArray(n.getWorldMatrix())),positions=[],normals=[];
  for(let i=0;i<a.getCount();i++){const v=[],nr=[];a.getElement(i,v);normal.getElement(i,nr);positions.push(...new Vector3(...v).applyMatrix4(matrix).toArray());normals.push(...new Vector3(...nr).transformDirection(matrix).toArray());}
  const indices=p.getIndices()?.getArray()||Uint32Array.from({length:a.getCount()},(_,i)=>i);sourceTriangles+=indices.length/3;
  const next=doc.createPrimitive().setMaterial(p.getMaterial()).setAttribute('POSITION',doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array(positions))).setAttribute('NORMAL',doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array(normals))).setAttribute('TEXCOORD_0',doc.createAccessor().setBuffer(buffer).setType('VEC2').setArray(new Float32Array(uv.getArray()))).setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint32Array(indices)));
  if(config.number===8){const tex=next.getAttribute('TEXCOORD_0').getArray();for(let i=1;i<tex.length;i+=2)tex[i]=1-tex[i];}
  mesh.addPrimitive(next);primitives.push(next);
 }
 scene.addChild(doc.createNode(config.id).setMesh(mesh));oldNodes.forEach(n=>n.dispose());doc.getRoot().listScenes().filter(s=>s!==scene).forEach(s=>s.dispose());doc.getRoot().setDefaultScene(scene);doc.getRoot().listAnimations().forEach(a=>a.dispose());doc.getRoot().listSkins().forEach(s=>s.dispose());
 const bounds=getBounds(scene),scale=config.height/(bounds.max[1]-bounds.min[1]),center=bounds.min.map((v,i)=>(v+bounds.max[i])/2);
 for(const p of primitives){const a=p.getAttribute('POSITION'),data=a.getArray();for(let i=0;i<data.length;i++)data[i]=(data[i]-center[i%3])*scale;}
 const atlasReport=await atlas(doc,primitives,config.id);await doc.transform(prune(),dedup(),join(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,config.triangles/sourceTriangles),error:config.number===8?.01:.003,lockBorder:false}),prune(),quantize({quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));
 const glb=Buffer.from(await io.writeBinary(doc)),iv=crypto.createHash('sha256').update(glb).digest().subarray(0,12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(header);const packed=Buffer.concat([header,iv,cipher.update(glb),cipher.final(),cipher.getAuthTag()]);if(packed.length>350000)throw Error(config.id+' exceeds 350 KB: '+packed.length);
 fs.writeFileSync(path.join(out,config.id+'.cme'),packed);if(process.env.SHIELD_PREVIEW_DIR){fs.mkdirSync(process.env.SHIELD_PREVIEW_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.SHIELD_PREVIEW_DIR,config.id+'.glb'),glb);}
 const triangles=doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0),drawCalls=doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().length,0);
 reports.push({...config,file:config.id+'.cme',sourceBytes:bytes.length,sourceTriangles,triangles,bytes:packed.length,drawCalls,bounds:getBounds(scene),sourceSha256:sha(bytes),sha256:sha(packed),...atlasReport,decodedTextureBytesWithMips:atlasReport.textures.reduce((n,t)=>n+t.width*t.height*4*4/3,0)});console.log(config.number,config.id,triangles,packed.length,drawCalls);
}
fs.writeFileSync(path.join(out,'build-report.json'),JSON.stringify({version:198,maxModelAndTextureBytes:350000,items:reports},null,2)+'\n');
