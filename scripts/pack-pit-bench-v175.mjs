// Pack the original CC0 geometry and resize photographic maps for mobile use.
import {NodeIO} from '@gltf-transform/core';
import sharp from 'sharp';
const io=new NodeIO(),doc=await io.read(process.argv[2]||'/tmp/pit-v175-sources/bench/bench.gltf');
for(const texture of doc.getRoot().listTextures()){
 const image=await sharp(texture.getImage()).resize(512,512,{fit:'inside'}).jpeg({quality:90}).toBuffer();
 texture.setImage(image).setMimeType('image/jpeg');
}
await io.write(process.argv[3]||'assets/pit-v175/bench.glb',doc);
