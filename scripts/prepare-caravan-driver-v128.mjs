import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,weld,simplify,prune,textureCompress} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),d=await io.read(root+'/owner-makehuman-v27.glb');
const keep=new Set(['OwnerSkin','OwnerEyes','OwnerWhiteTunic','OwnerSandals','Hair_crop','Brow_natural','Beard_scruffy']);
for(const n of d.getRoot().listNodes())if(n.getMesh()&&!keep.has(n.getName()))n.dispose();
for(const a of d.getRoot().listAnimations())a.dispose();
for(const m of d.getRoot().listMeshes())for(const p of m.listPrimitives())for(const t of p.listTargets())p.removeTarget(t);
for(const n of d.getRoot().listNodes())n.setWeights([]);
for(const m of d.getRoot().listMeshes())m.setWeights([]);
await d.transform(prune());
const skin=d.createTexture('driver-natural-skin').setImage(fs.readFileSync(root+'/owner-skin-light-v27.jpg')).setMimeType('image/jpeg');
const color=hex=>[...hex.matchAll(/[a-f0-9]{2}/gi)].map(x=>{const n=parseInt(x[0],16)/255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);}).concat(1);
for(const n of d.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives()){
 const m=p.getMaterial();m.setMetallicFactor(0).setRoughnessFactor(.85);
 if(n.getName()==='OwnerSkin')m.setBaseColorTexture(skin).setBaseColorFactor([1,1,1,1]).setAlphaMode('OPAQUE').setDoubleSided(false);
 if(/^(Hair_|Beard_|Brow_)/.test(n.getName()))m.setBaseColorFactor(color('34251e')).setAlphaMode('MASK').setAlphaCutoff(.1).setDoubleSided(true);
 if(n.getName()==='OwnerWhiteTunic')m.setBaseColorFactor(color('cfc1a2')).setAlphaMode('OPAQUE').setDoubleSided(true);
 if(n.getName()==='OwnerSandals')m.setBaseColorFactor(color('756048')).setAlphaMode('OPAQUE').setDoubleSided(true);
}
await MeshoptSimplifier.ready;
await d.transform(weld(),simplify({simplifier:{...MeshoptSimplifier,simplify:(i,p,s,c,e,f)=>MeshoptSimplifier.simplify(i,p,s,c,e,[...f,'Permissive'])},ratio:.16,error:.012}),dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[512,512],quality:86}));
await io.write(root+'/assets/caravan-v128/driver.glb',d);
console.log('Driver triangles:',d.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0));
