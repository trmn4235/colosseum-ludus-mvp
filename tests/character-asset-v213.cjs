const fs=require('node:fs'),assert=require('node:assert/strict'),sharp=require('sharp');
const path=require('node:path'),root=path.resolve(__dirname,'..');
function glb(file){const bytes=fs.readFileSync(path.join(root,file)),size=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(8),bytes.length);return {bytes,json:JSON.parse(bytes.subarray(20,20+size)),binary:bytes.subarray(size+28)};}
async function main(){
 const before=glb('gladiator-mobile.glb'),after=glb('gladiator-mobile-v213.glb'),images=new Set(before.json.images.map(x=>x.bufferView)),textures=[];
 for(const key of ['accessors','meshes','nodes','skins','animations','scenes'])assert.deepEqual(after.json[key],before.json[key],key+' unchanged');
 for(const [i,view]of before.json.bufferViews.entries()){
  const next=after.json.bufferViews[i],a=before.binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),b=after.binary.subarray(next.byteOffset,next.byteOffset+next.byteLength);
  if(!images.has(i))assert.deepEqual(b,a,'geometry/animation buffer '+i);
  else{const m=await sharp(b).metadata();assert.equal(m.format,'webp');assert.ok(m.width>=512&&m.height>=512);textures.push({view:i,width:m.width,height:m.height,bytes:b.length});}
 }
 assert.ok(after.bytes.length<before.bytes.length*.6,'at least 40% smaller');
 for(const file of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js','circus-war-view-v186.js'])assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes("'gladiator-mobile-v217.glb'"),file+' uses fresh asset URL');
 console.log(JSON.stringify({beforeBytes:before.bytes.length,afterBytes:after.bytes.length,reductionPercent:100*(1-after.bytes.length/before.bytes.length),geometrySkinAnimationByteIdentical:true,textures},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
