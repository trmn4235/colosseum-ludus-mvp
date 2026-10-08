const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/city/rome-backdrop-v39.json'),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('city atlas is a valid lossless WebP and matches its recorded source assets',()=>{
 const bytes=fs.readFileSync(path.join(root,manifest.atlas.file));
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.readUInt32LE(4),bytes.length-8);
 assert.equal(bytes.length,manifest.atlas.bytes);assert.equal(hash(bytes),manifest.atlas.sha256);
 assert.ok(bytes.includes(Buffer.from('VP8L')),'lossless image payload');assert.ok(bytes.length<3*1024*1024);
 for(const [file,expected]of Object.entries(manifest.bake.sourceHashes))if(file.endsWith('.glb')||file.endsWith('.jpg'))assert.equal(hash(fs.readFileSync(path.join(root,file))),expected,file+' changed: re-bake the backdrop');
});
test('spatial cards retain both landmark positions and fit the documented texture budget',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'ludus-city-v29.js'),'utf8'),ctx);
 assert.equal(manifest.cards.length,143);assert.deepEqual(manifest.reference,[0,5,0]);assert.equal(manifest.atlas.width,2048);assert.equal(manifest.atlas.height,2048);
 for(const [name,landmark]of Object.entries(ctx.LudusCity.landmarks)){
  const card=manifest.cards.find(c=>c.name===name);assert.ok(card);assert.deepEqual(card.position,Array.from(landmark.position));
 }
 for(const card of manifest.cards){const [x,y,w,h]=card.rect;assert.ok(x>=8&&y>=8&&x+w<=2048-8&&y+h<=2048-8);assert.equal(card.vertices.flat().length,12);assert.ok(card.vertices.flat().every(Number.isFinite));}
 assert.equal(manifest.cards.reduce((n,c)=>n+c.sourceTriangles,0),781431);
});
