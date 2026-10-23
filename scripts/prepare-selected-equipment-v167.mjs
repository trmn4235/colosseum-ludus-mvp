import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'meshoptimizer';

// Offline, deterministic material painting. Source files are never AI inputs.
globalThis.window={URL};
T.TextureLoader.prototype.load=function(){return new T.Texture();};
await MeshoptSimplifier.ready;
const source=process.argv[2],output=process.argv[3];
if(!source||!output)throw Error('Usage: node scripts/prepare-selected-equipment-v167.mjs SOURCE_DIR OUT_DIR');
fs.mkdirSync(output,{recursive:true});
const materials=[
 {name:'Forged dark steel',pbrMetallicRoughness:{baseColorFactor:[.28,.32,.36,1],metallicFactor:.88,roughnessFactor:.4}},
 {name:'Aged bronze',pbrMetallicRoughness:{baseColorFactor:[.34,.215,.09,1],metallicFactor:.82,roughnessFactor:.42}},
 {name:'Dark leather grip',pbrMetallicRoughness:{baseColorFactor:[.07,.033,.018,1],metallicFactor:0,roughnessFactor:.82}},
 {name:'Oiled hardwood',pbrMetallicRoughness:{baseColorFactor:[.105,.052,.023,1],metallicFactor:0,roughnessFactor:.76}}
];
const reports=[];
function compact(g){const old=g.index.array,used=[...new Set(old)],map=new Map(used.map((x,i)=>[x,i])),result=new T.BufferGeometry();for(const [name,a]of Object.entries(g.attributes)){const arr=new Float32Array(used.length*a.itemSize);used.forEach((v,i)=>{for(let j=0;j<a.itemSize;j++)arr[i*a.itemSize+j]=a.array[v*a.itemSize+j];});result.setAttribute(name,new T.BufferAttribute(arr,a.itemSize));}result.setIndex(Array.from(old,i=>map.get(i)));return result;}
function writeGLB(name,primitives,meta){
 const chunks=[],views=[],accessors=[];let offset=0;
 function buffer(arr,target){const bytes=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength),id=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return id;}
 function attr(arr,width,type,target=34962){const a={bufferView:buffer(arr,target),componentType:arr instanceof Uint32Array?5125:5126,count:arr.length/width,type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<arr.length;i++){a.min[i%3]=Math.min(a.min[i%3],arr[i]);a.max[i%3]=Math.max(a.max[i%3],arr[i]);}}accessors.push(a);return accessors.length-1;}
 const ps=primitives.map(({geometry:g,material})=>{const p=g.attributes.position,n=g.attributes.normal,colors=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),variation=.90+.085*Math.sin(149*x+91*y+67*z)*Math.sin(73*x-110*y+94*z);for(let c=0;c<3;c++)colors[i*3+c]=variation;}const attributes={POSITION:attr(p.array,3,'VEC3'),NORMAL:attr(n.array,3,'VEC3'),COLOR_0:attr(colors,3,'VEC3')};if(g.attributes.uv)attributes.TEXCOORD_0=attr(g.attributes.uv.array,2,'VEC2');return {attributes,indices:attr(new Uint32Array(g.index.array),1,'SCALAR',34963),material};});
 const doc={asset:{version:'2.0',generator:'Colosseum & Magnus V167 offline material preparation',copyright:'Source model: tokeshi / CGTrader; Royalty Free License (no AI)'},scene:0,scenes:[{nodes:[0]}],nodes:[{name,mesh:0}],meshes:[{name,primitives:ps}],materials,buffers:[{byteLength:offset}],bufferViews:views,accessors,extras:meta};
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),h=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);const data=Buffer.concat([h,jh,json,bh,bin]);fs.writeFileSync(path.join(output,name+'.glb'),data);return data;
}
for(const [file,key]of [['Hammer_3.fbx','warhammer'],['Mace_2_optimized.fbx','heavy_mace']]){
 const b=fs.readFileSync(path.join(source,file)),root=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');root.updateMatrixWorld(true);const prims=[],parts=[];let original=0;
 root.traverse(o=>{if(!o.isMesh)return;let g=o.geometry.clone().applyMatrix4(o.matrixWorld);const triangles=g.index?g.index.count/3:g.attributes.position.count/3;original+=triangles;
  if(key==='warhammer')g.applyMatrix4(new T.Matrix4().makeRotationX(Math.PI/2)).translate(-4.66,57,.06).scale(.0105,.0105,.0105);
  else g.translate(0,.75,0).scale(.65,.65,.65);
  g=mergeVertices(g,1e-5);let error=0;
  if(key==='warhammer'&&triangles>2000){const target=o.name==='Torus'?800:1500;const [indices,e]=MeshoptSimplifier.simplify(new Uint32Array(g.index.array),g.attributes.position.array,3,target*3,.004,['Permissive']);g.setIndex(new T.BufferAttribute(indices,1));error=e;g=compact(g);}
  if(key==='warhammer')prims.push({geometry:g,material:o.name==='Torus'?1:o.name==='Куб'?0:o.name==='Окружность001'?2:1});
  else {const groups=new Map(),p=g.attributes.position,idx=g.index.array;for(let i=0;i<idx.length;i+=3){const y=(p.getY(idx[i])+p.getY(idx[i+1])+p.getY(idx[i+2]))/3/.65-.75;let mat=y>.22?0:y>.13?1:y>-.4?3:y>-.99?2:1;if(!groups.has(mat))groups.set(mat,[]);groups.get(mat).push(idx[i],idx[i+1],idx[i+2]);}for(const [material,indices]of groups){const sub=g.clone();sub.setIndex(indices);prims.push({geometry:compact(sub),material});}}
  parts.push({name:o.name,sourceTriangles:triangles,triangles:g.index.count/3,simplificationError:error});
 });
 const box=new T.Box3();for(const p of prims){p.geometry.computeBoundingBox();box.union(p.geometry.boundingBox);}
 const count=prims.reduce((n,p)=>n+p.geometry.index.count/3,0),meta={id:key,version:167,source:file,handOrigin:[0,0,0],longAxis:'+Y',triangles:count,paint:'Hand-authored PBR materials and deterministic vertex patina; no generative AI',originalTexturesIncluded:false};
 const data=writeGLB(key,prims,meta);const report={...meta,bytes:data.length,sourceTriangles:original,bounds:{min:box.min.toArray(),max:box.max.toArray()},parts,sha256:crypto.createHash('sha256').update(data).digest('hex')};reports.push(report);console.log(JSON.stringify(report));
}
fs.writeFileSync(path.join(output,'build-report.json'),JSON.stringify(reports,null,2));
