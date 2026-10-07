const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'assets/mobile-asset-manifest.json')));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

test('extracted GLBs and WebP textures retain the original bytes and valid containers', () => {
 for (const [file,info] of Object.entries(manifest)) {
  const bytes = fs.readFileSync(path.join(root,file));
  assert.equal(bytes.length,info.bytes,file);assert.equal(sha(bytes),info.sha256,file);
  assert.ok(file.includes(info.sha256.slice(0,12)),'content-addressed URL');
  if(file.endsWith('.glb')) {
   assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
   const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
   assert.ok(doc.meshes.length);assert.ok((doc.images||[]).every(i=>i.bufferView!==undefined),'self-contained images');
  } else {assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
 }
});

test('all four pages use common external equipment and external PBR maps', () => {
 let previous;
 for(const page of ['ludus.html','savas.html','arena.html','multiplayer.html']) {
  const source=fs.readFileSync(path.join(root,page),'utf8');
  const urls=['LUDUS_HELMET_DATA','LUDUS_ARMOUR_DATA'].flatMap(name=>Object.values(JSON.parse(source.match(new RegExp('var '+name+'=(\\{[^\\n]+\\});'))[1])));
  if(previous)assert.deepEqual(urls,previous);previous=urls;
  urls.forEach(file=>assert.ok(manifest[file],page+': '+file));
  const pbr=JSON.parse(source.match(/var ROMAN_PBR_ASSETS=(\{[^\n]+\});/)[1]);
  for(const file of Object.values(pbr))assert.ok(manifest[file],page+': '+file);
  assert.ok(!source.includes('atob(LUDUS_HELMET_DATA'),page);
  assert.ok(!source.includes('atob(LUDUS_ARMOUR_DATA'),page);
 }
});

test('optional baseline check proves each extracted resource came from the previous pages', {skip:!process.env.BASELINE_ROOT}, () => {
 const originals = new Set();
 for(const page of ['ludus.html','savas.html','arena.html','multiplayer.html']) {
  const source=fs.readFileSync(path.join(process.env.BASELINE_ROOT,page),'utf8');
  for(const name of ['LUDUS_HELMET_DATA','LUDUS_ARMOUR_DATA']) {
   const values=JSON.parse(source.match(new RegExp('var '+name+'=(\\{[^\\n]+\\});'))[1]);
   Object.values(values).forEach(value=>originals.add(sha(Buffer.from(value,'base64'))));
  }
  for(const m of source.matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g))originals.add(sha(Buffer.from(m[1],'base64')));
 }
 for(const [file,info] of Object.entries(manifest))assert.ok(originals.has(info.sha256),file);
});
