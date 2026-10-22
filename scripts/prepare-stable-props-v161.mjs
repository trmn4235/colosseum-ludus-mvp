// UV-preserving conversion of the credited 0 A.D. props. No generated artwork.
// node scripts/prepare-stable-props-v161.mjs /path/to/downloaded/source
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import * as T from 'three';
import {ColladaLoader} from 'three/examples/jsm/loaders/ColladaLoader.js';
const src=process.argv[2],out='assets/stable-v161';
const dom=new JSDOM();globalThis.DOMParser=dom.window.DOMParser;globalThis.document=dom.window.document;
const specs=[['amphorae','amphorae_treasure','hele_props_a'],['basket','wrld_basket_a','basket_rome_1'],['fodder','gaul_stable_hay_stack','celt_struct'],['bucket','rome_blacksmith_bucket','rome_struct_2']];
for(const [name,mesh,tex] of specs){
 const xml=fs.readFileSync(path.join(src,mesh+'.dae'),'utf8').replace(/<library_images>[\s\S]*?<\/library_images>/g,'');
 const doc=new dom.window.DOMParser().parseFromString(xml,'application/xml');
 for(const polygon of [...doc.getElementsByTagName('polygons')]){
  const inputs=[...polygon.getElementsByTagName('input')],stride=1+Math.max(...inputs.map(i=>Number(i.getAttribute('offset')))),tri=[];
  for(const p of polygon.getElementsByTagName('p')){const v=p.textContent.trim().split(/\s+/);for(let i=1;i<v.length/stride-1;i++)tri.push(...v.slice(0,stride),...v.slice(i*stride,(i+1)*stride),...v.slice((i+1)*stride,(i+2)*stride));}
  const node=doc.createElementNS(polygon.namespaceURI,'triangles');node.setAttribute('count',tri.length/stride/3);if(polygon.hasAttribute('material'))node.setAttribute('material',polygon.getAttribute('material'));inputs.forEach(i=>node.appendChild(i.cloneNode(true)));const p=doc.createElementNS(polygon.namespaceURI,'p');p.textContent=tri.join(' ');node.appendChild(p);polygon.replaceWith(node);
 }
 const scene=new ColladaLoader().parse(new dom.window.XMLSerializer().serializeToString(doc),'').scene;scene.updateMatrixWorld(true);
 const all=[];scene.traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!g.attributes.normal)g.computeVertexNormals();all.push(g);}});
 const box=new T.Box3();all.forEach(g=>{g.computeBoundingBox();box.union(g.boundingBox);});
 const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),scale=1/size.y;
 if(!all.length||!Number.isFinite(scale)||size.y<=0)throw Error('Empty source geometry: '+mesh);
 const chunks=[],views=[],accessors=[];let bytes=0;
 function buffer(data,target){const b=Buffer.from(data.buffer,data.byteOffset,data.byteLength);const i=views.length;views.push({buffer:0,byteOffset:bytes,byteLength:b.length,...(target?{target}:{})});chunks.push(b);bytes+=b.length;const pad=(4-bytes%4)%4;if(pad){chunks.push(Buffer.alloc(pad));bytes+=pad;}return i;}
 function attribute(data,n,type){const view=buffer(data,34962),a={bufferView:view,componentType:5126,count:data.length/n,type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i++) {a.min[i%3]=Math.min(a.min[i%3],data[i]);a.max[i%3]=Math.max(a.max[i%3],data[i]);}}accessors.push(a);return accessors.length-1;}
 const primitives=all.map(g=>{
  g.translate(-center.x,-box.min.y,-center.z).scale(scale,scale,scale);
  const uv=g.attributes.uv.array.slice();for(let i=1;i<uv.length;i+=2)uv[i]=1-uv[i];
  const p={attributes:{POSITION:attribute(g.attributes.position.array,3,'VEC3'),NORMAL:attribute(g.attributes.normal.array,3,'VEC3'),TEXCOORD_0:attribute(uv,2,'VEC2')},material:0};
  if(g.index){const data=new Uint32Array(g.index.array);accessors.push({bufferView:buffer(data,34963),componentType:5125,count:data.length,type:'SCALAR'});p.indices=accessors.length-1;}return p;
 });
 const image=fs.readFileSync(path.join(src,tex+'.jpg')),imageView=buffer(image);
 const gltf={asset:{version:'2.0',generator:'0 A.D. UV-preserving conversion; see CREDITS.txt',copyright:'Wildfire Games, CC BY-SA 3.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name}],meshes:[{primitives}],buffers:[{byteLength:bytes}],bufferViews:views,accessors,images:[{bufferView:imageView,mimeType:'image/jpeg'}],textures:[{source:0,sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],materials:[{name:'0 A.D. '+tex,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.92},doubleSided:false}]};
 let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),head=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(path.join(out,name+'.glb'),Buffer.concat([head,jh,json,bh,bin]));
 console.log(name,{metreDimensions:size.multiplyScalar(scale).toArray(),bytes:28+json.length+bin.length,vertices:all.reduce((n,g)=>n+g.attributes.position.count,0)});
}
