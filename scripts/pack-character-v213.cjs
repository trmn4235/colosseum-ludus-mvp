// Texture-only repack: geometry, skin, joints and animation bytes stay identical.
// Usage: node scripts/pack-character-v213.cjs ORIGINAL.glb OUTPUT.glb
const fs=require('node:fs'),assert=require('node:assert/strict'),sharp=require('sharp');
async function pack(input,output){
 const source=fs.readFileSync(input),jsonSize=source.readUInt32LE(12),doc=JSON.parse(source.subarray(20,20+jsonSize)),binary=source.subarray(28+jsonSize);
 const imageViews=new Map(doc.images.map(image=>[image.bufferView,image])),parts=[];let size=0;
 for(const [index,view]of doc.bufferViews.entries()){
  let bytes=binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  if(imageViews.has(index)){
   // Keep full color-map resolution. Data maps use 512px and lossless WebP,
   // avoiding lossy block artifacts in normal maps while cutting texture memory.
   const image=imageViews.get(index),lossless=image.mimeType!=='image/jpeg';
   const imagePipeline=sharp(bytes);if(lossless)imagePipeline.resize({width:512,height:512,fit:'inside',withoutEnlargement:true});
   bytes=await imagePipeline.webp(lossless?{lossless:true,effort:6}:{quality:90,effort:6}).toBuffer();image.mimeType='image/webp';
  }
  view.byteOffset=size;view.byteLength=bytes.length;parts.push(bytes);size+=bytes.length;
  const padding=(4-size%4)%4;if(padding){parts.push(Buffer.alloc(padding));size+=padding;}
 }
 for(const texture of doc.textures){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
 doc.extensionsUsed=[...new Set([...(doc.extensionsUsed||[]),'EXT_texture_webp'])];doc.extensionsRequired=[...new Set([...(doc.extensionsRequired||[]),'EXT_texture_webp'])];
 doc.buffers[0].byteLength=size;doc.asset.extras.modifications+=' V213: WebP color maps at original resolution; normal/metal/roughness maps at 512px with lossless WebP. Geometry, skin, joints and animations unchanged.';
 let metadata=Buffer.from(JSON.stringify(doc));metadata=Buffer.concat([metadata,Buffer.alloc((4-metadata.length%4)%4,32)]);
 const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+metadata.length+size,8);header.writeUInt32LE(metadata.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(size);binHeader.writeUInt32LE(0x004e4942,4);
 const result=Buffer.concat([header,metadata,binHeader,...parts]);assert.equal(result.length,28+metadata.length+size);fs.writeFileSync(output,result);
 console.log(JSON.stringify({beforeBytes:source.length,afterBytes:result.length,reductionPercent:100*(1-result.length/source.length),textures:doc.images.length,geometryChanged:false}));
}
if(require.main===module)pack(process.argv[2],process.argv[3]).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={pack};
