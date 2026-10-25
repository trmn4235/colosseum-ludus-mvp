const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs'),r=require('../assets/equipment-v193/build-report.json');
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+': Halberd has bounded assets and stable shared hand attachment',async()=>{
 const c=await rigRuntime(page.endsWith('.js')?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;c.crypto=crypto.webcrypto;
 const Loader=T.GLTFLoader;T.GLTFLoader=class extends Loader{constructor(...a){super(...a);this.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new T.Texture())}));}};
 let requests=0;c.fetch=async url=>{requests++;return new Response(fs.readFileSync(url))};vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);assert.equal(requests,0);
 const loaded=await Promise.all(Array.from({length:20},()=>c.LudusEquipmentCatalog.load(T,'halberd'))),model=loaded[0];assert.equal(requests,1);assert.ok(loaded.every(m=>m===model));
 const bytes=fs.readFileSync('assets/equipment-v193/halberd.cme');assert.equal(bytes.length,r.bytes);assert.ok(r.bytes<80000);assert.ok(r.triangles<3000);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.ok(r.decodedTextureBytesWithMips<.34*1024*1024);assert.ok(r.textures.every(t=>t.width<=256&&t.height<=256));
 const b=new T.Box3().setFromObject(model,true),size=b.getSize(new T.Vector3()),meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o)});
 assert.equal(meshes.length,4);assert.equal(meshes.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0),r.triangles);assert.ok(Math.abs(size.y-1.8)<.004);assert.ok(Math.abs(b.min.y+.1)<.004);assert.ok(size.z<.5&&size.x<.15);
 for(const cls of Object.keys(c.ArenaClasses)){
  const m=c.ImportedGladiator.create(193,cls),f=new c.ArenaCombat(()=>.999).reset('normal',cls).fighters[0],p=c.ArenaMotion.profile('halberd');
  assert.equal(p.pole,true);assert.equal(p.length,1.7);
  Object.assign(f,{x:0,z:0,angle:0,weapon:'halberd',pitWeapon:null,offhand:null,leftGear:null,shield:false,helmet:false,chest:false,shoulders:false});let weapon;
  for(const action of ['idle','walk','attack','guard','dodge','hurt','down'])for(let i=0;i<18;i++){
   Object.assign(f,{action:['walk','guard'].includes(action)?'idle':action,attackWeapon:'halberd',attackProfile:p,duration:action==='dodge'?.46:p.duration,blocking:action==='guard',move:action==='walk'?1:0,hp:action==='down'?0:100,reaction:action==='hurt'?.2:0,timer:i/30,walk:i/8,deadTime:i/30});
   c.ImportedGladiator.animate(f,m,i/30,1/30);m.root.updateMatrixWorld(true);weapon||=m.weaponAnchor.children[0];assert.equal(m.weaponAnchor.children[0],weapon);assert.equal(m.equippedWeapon,'halberd');assert.equal(weapon.userData.catalogId,'halberd');assert.ok(m.weaponAnchor.matrixWorld.elements.every(Number.isFinite));
  }
  const clones=[];weapon.traverse(o=>{if(o.isMesh)clones.push(o)});assert.equal(clones.length,4);clones.forEach((o,i)=>{assert.equal(o.geometry,meshes[i].geometry);assert.equal(o.material,meshes[i].material)});c.ImportedGladiator.dispose(m);
 }
 assert.equal(requests,1);
});
test('Halberd category, exact recipe, icon and client/server simulation match',()=>{
 const p=require('../ludus-production-v119.js'),g=require('../equipment-groups-v168.js'),r=p.recipes.find(r=>r.sku==='halberd');assert.deepEqual(r.ingredients,{steel:7,wood:3,leather:2,resin:2,rope:1});assert.equal(r.output_quantity,1);assert.equal(g.groupFor(r).id,'swords');assert.equal(g.breaker(r),false);assert.equal(p.photo('halberd'),'assets/items-v193/halberd.webp');assert.match(p.artwork({kind:'weapon',model:'halberd'}),/items-v193\/halberd.webp/);assert.ok(fs.statSync(p.photo('halberd')).size<25000);
 for(const name of ['caravan-core-v126.js','combat-motion-v163.js'])assert.equal(fs.readFileSync(name,'utf8'),fs.readFileSync('supabase/functions/caravan-combat-v126/'+name,'utf8'));
});
