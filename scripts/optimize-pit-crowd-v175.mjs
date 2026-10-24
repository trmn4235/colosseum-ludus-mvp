// Run after prepare-pit-crowd-v175.cjs with glTF Transform, sharp and meshoptimizer installed.
import {NodeIO} from '@gltf-transform/core';
import {weld,simplify,prune,dedup,textureCompress,cloneDocument} from '@gltf-transform/functions';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),path=process.argv[2]||'assets/pit-v175/spectators.glb',source=await io.read(path);
for(const [name,ratio,error]of [['spectators.glb',.16,.002],['spectators-low.glb',.055,.006]]){
 const doc=cloneDocument(source);
 await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio,error,lockBorder:false}),prune(),dedup());
 if(name==='spectators.glb')await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',quality:90,resize:[512,512]}));
 else {for(const m of doc.getRoot().listMaterials())m.setBaseColorTexture(null).setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null);await doc.transform(prune());}
 await io.write(path.replace('spectators.glb',name),doc);
}
