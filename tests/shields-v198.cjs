const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs'),report=require('../assets/equipment-v198/build-report.json'),rows=report.items;
const count=g=>{let n=0;g.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});return n;};
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+': six distinct shields, lazy/shared assets, animation and drops',async()=>{
 const c=await rigRuntime(page.endsWith('.js')?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;c.crypto=crypto.webcrypto;const requests=[];c.fetch=async u=>{requests.push(u);return new Response(fs.readFileSync(u))};vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
 const m=c.ImportedGladiator.create(198,'murmillo'),combat=new c.ArenaCombat(()=>.999).reset('normal','murmillo'),f=combat.fighters[0];Object.assign(f,{x:0,z:0,angle:0,weapon:'gladius',offhand:null,leftGear:null,helmet:false,chest:false,shoulders:false,greaves:false});assert.equal(requests.length,0);
 for(const row of rows){
  Object.assign(f,{shield:true,shieldStyle:row.id,action:'idle',hp:100});c.ImportedGladiator.animate(f,m,0,1/60);assert.equal(requests.filter(u=>u.endsWith(row.file)).length,1);
  const [template,repeat]=await Promise.all([c.LudusEquipmentCatalog.load(T,row.id),c.LudusEquipmentCatalog.load(T,row.id)]);assert.equal(template,repeat);c.ImportedGladiator.animate(f,m,.1,1/60);const group=m.gear.shield.group;assert.equal(group.userData.catalogId,row.id);assert.equal(count(group),row.triangles);
  const bounds=new T.Box3().setFromObject(template),size=bounds.getSize(new T.Vector3());assert.ok(Math.abs(size.y-row.height)<.002);assert.ok(size.x>.5&&size.z<.3);assert.equal(c.ClassEquipment.item({kind:'shield',style:'murmillo',itemEntry:{item:{model:row.id}}}),template);
  const original=[];template.traverse(o=>{if(o.isMesh)original.push(o)});group.traverse(o=>{if(o.isMesh){assert.equal(o.geometry,original[0].geometry);assert.equal(o.material,original[0].material);}});
  for(const action of ['idle','walk','attack','guard','bash','dodge','hurt']){
   const p=c.ArenaMotion.profile('gladius');Object.assign(f,{action:['walk','guard'].includes(action)?'idle':action,attackWeapon:'gladius',attackProfile:p,duration:p.duration,blocking:action==='guard',move:action==='walk'?1:0,reaction:action==='hurt'?.2:0});
   for(let i=0;i<12;i++){f.timer=i/60;f.walk=i/4;c.ImportedGladiator.animate(f,m,i/60,1/60);m.root.updateMatrixWorld(true);assert.equal(m.gear.shield.group,group);assert.ok(group.visible);assert.ok(group.matrixWorld.elements.every(Number.isFinite));}
  }
  const dropped=combat.dropEquipment(f,'shield');assert.equal(dropped.style,row.id);assert.equal(c.ClassEquipment.item(dropped),template);assert.equal(f.shield,false);Object.assign(f,{hp:100,action:'idle',blocking:false});assert.equal(combat.pickup(f.id,dropped.id),true);assert.equal(f.shield,true);assert.equal(f.shieldStyle,row.id);
  f.shield=false;c.ImportedGladiator.animate(f,m,1,1/60);assert.equal(m.gear.shield.group.visible,false);
 }
 assert.equal(requests.length,6);c.ImportedGladiator.dispose(m);
});
test('source identity, transfer size, geometry and embedded texture budgets',async()=>{
 const c=await rigRuntime();c.crypto=crypto.webcrypto;vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
 assert.deepEqual(rows.map(r=>r.number),[2,7,8,17,19,22]);assert.equal(new Set(rows.map(r=>r.sha256)).size,6);
 for(const r of rows){const bytes=fs.readFileSync('assets/equipment-v198/'+r.file);assert.equal(bytes.length,r.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.ok(r.bytes<=350000);assert.ok(r.triangles<=3500);assert.ok(r.triangles<=r.sourceTriangles);assert.equal(r.drawCalls,1);assert.ok(r.decodedTextureBytesWithMips<=4*1024*1024);
  const raw=Buffer.from(await c.LudusEquipmentCatalog.decode(bytes)),json=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.equal(json.animations?.length||0,0);assert.equal(json.skins?.length||0,0);assert.equal(json.materials.length,1);assert.ok(json.images.length>=2&&json.images.length<=3);assert.ok(json.images.every(i=>!i.uri&&i.bufferView!==undefined&&i.mimeType==='image/webp'));
 }
});
test('exact icons, names, recipes and large/medium categories agree',()=>{
 const p=require('../ludus-production-v119.js'),g=require('../equipment-groups-v168.js');for(const r of rows){const recipe=p.recipes.find(x=>x.model===r.id);assert.ok(recipe);assert.equal(recipe.name,r.label);assert.equal(recipe.kind,'shield');assert.equal(recipe.output_quantity,1);assert.equal(p.skuForItem({kind:'shield',model:r.id}),r.sku);assert.equal(g.groupFor(recipe).id,r.group);assert.equal(p.photo(r.sku),'assets/items-v198/'+r.sku+'.webp');assert.ok(fs.statSync(p.photo(r.sku)).size<25000);}
 for(const name of ['caravan-core-v126.js','combat-motion-v163.js'])assert.equal(fs.readFileSync(name,'utf8'),fs.readFileSync('supabase/functions/caravan-combat-v126/'+name,'utf8'));
});
test('battle loadout preserves each selected model on every combat entry point',async()=>{
 const c=await rigRuntime();for(const name of ['arena.html','savas.html','multiplayer.html','caravan-core-v126.js']){
  const text=fs.readFileSync(name,'utf8'),start=text.indexOf('var LudusLoadout='),end=text.indexOf('// Transfer immutable server item tokens',start);vm.runInContext(text.slice(start,end),c);
  for(const r of rows){const f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];c.LudusLoadout.apply(f,{name:'Test',class:'murmillo',stat_version:7,base_stats:{health:50,stamina:50,strength:50,defense:50,speed:50,agility:50}},[{kind:'shield',model:r.id,equipped_slot:'off_hand'}]);assert.equal(f.shield,true);assert.equal(f.shieldStyle,r.id);}
 }
});
