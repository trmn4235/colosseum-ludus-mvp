const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {rigRuntime,inspectScripts}=require('./performance-v84.cjs');
const root=path.join(__dirname,'..'),catalog=fs.readFileSync(root+'/equipment-catalog-v167.js','utf8');
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html'])test(page+': prepared models decrypt, load, share and retain grip origins',async()=>{
 const c=await rigRuntime(page);c.crypto=webcrypto;let requests=0;c.fetch=async url=>{requests++;return new Response(fs.readFileSync(path.join(root,url)));};vm.runInContext(catalog,c);const api=c.LudusEquipmentCatalog;
 assert.equal(requests,0,'No eager downloads on page initialization');
 for(const id of ['warhammer','heavy_mace']){
  const [a,b]=await Promise.all([api.load(c.THREE,id),api.load(c.THREE,id)]);assert.equal(a,b);assert.equal(c.ClassEquipment.weapon(id),a);
  let triangles=0;const palette=new Set();a.traverse(o=>{if(o.isMesh){assert.ok(o.geometry.attributes.normal);const g=o.geometry;triangles+=(g.index?g.index.count:g.attributes.position.count)/3;palette.add(o.material.name);for(const attr of Object.values(g.attributes))assert.ok(Array.from(attr.array).every(Number.isFinite));}});
  assert.equal(triangles,api.entry(id).triangles);assert.ok(palette.has('Dark leather grip'));assert.ok(palette.has('Forged dark steel'));
  const box=new c.THREE.Box3().setFromObject(a);assert.ok(box.min.y<0&&box.max.y>.7);assert.ok(box.max.y-box.min.y<1.2);assert.equal(a.userData.materialVersion,167);
 }
 assert.equal(requests,2);assert.equal(api.revision,2);const data=fs.readFileSync(root+'/assets/equipment-v167/warhammer.cme');data[data.length-1]^=1;await assert.rejects(api.decode(data));
});
test('Helmet retains embedded images; catalog resources are not raw downloadable GLBs',async()=>{
 const c=await rigRuntime('arena.html');c.crypto=webcrypto;vm.runInContext(catalog,c);const b=fs.readFileSync(root+'/assets/equipment-v167/'+c.LudusEquipmentCatalog.entry('sylvain_helmet').file),raw=await c.LudusEquipmentCatalog.decode(b),v=new DataView(raw),n=v.getUint32(12,true),d=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,20,n)));
 assert.equal(d.images.length,4);assert.ok(d.images.every(i=>i.bufferView!==undefined&&!i.uri));assert.equal(d.animations?.length||0,0);const g=await c.LudusEquipmentCatalog.load(c.THREE,'sylvain_helmet',{bytes:b});const box=new c.THREE.Box3().setFromObject(g);assert.ok(Math.abs(box.max.y-box.min.y-.36)<1e-5);
 for(const f of fs.readdirSync(root+'/assets/equipment-v167'))assert.ok(!/\.(fbx|rar|glb)$/i.test(f));
});
test('All page script references and inline scripts remain valid',()=>assert.ok(inspectScripts().length>0));
