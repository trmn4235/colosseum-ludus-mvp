const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs'),report=require('../assets/equipment-v197/build-report.json'),ids=report.items.map(r=>r.id);
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+': four independent items, lazy load, bind-pose attachment and switching',async()=>{
 const c=await rigRuntime(page.endsWith('.js')?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;c.crypto=crypto.webcrypto;const requests=[];c.fetch=async u=>{requests.push(u);return new Response(fs.readFileSync(u))};vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
 const m=c.ImportedGladiator.create(196,'murmillo'),f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];Object.assign(f,{x:0,z:0,angle:.7,weapon:null,offhand:null,leftGear:null,shield:false,helmet:false,chest:false,shoulders:false,greaves:false});
 assert.equal(requests.length,0);const mounts=[m.gear.armUpper.group,m.gear.armFore.group];assert.equal(m.gear.armUpper.anchor.parent,m.bones.RightArm);assert.equal(m.gear.armFore.anchor.parent,m.bones.RightForeArm);
 for(const id of ids.filter(i=>i.startsWith('manica'))){
  Object.assign(f,{shoulders:true,shoulderModel:id,action:'idle',hp:100});c.ImportedGladiator.animate(f,m,0,1/60);assert.equal(requests.filter(u=>u.endsWith(id+'.cme')).length,1);
  const template=await c.LudusEquipmentCatalog.load(T,id);c.ImportedGladiator.animate(f,m,.1,1/60);assert.ok(m.gear.armFore.group.visible);assert.equal(m.gear.armFore.group.userData.catalogId,id);assert.equal(m.gear.armFore.group.children.length,1);
  assert.equal(m.gear.shoulder.group.children.length,id==='manica_leather'?0:1);if(id!=='manica_leather')assert.ok(m.gear.shoulder.group.userData.rigidArmour196,'rigid cap stays inside its slot group');
  const foreign=[];m.gear.armFore.group.traverse(o=>{if(o.isMesh)foreign.push(o)});assert.equal(foreign[0].geometry,template.getObjectByName('fore').geometry,'shared mesh, no per-fighter clone');
  const stable={upper:null,fore:null};for(const action of ['idle','walk','attack','guard','dodge','hurt','down'])for(let i=0;i<30;i++){
   const p=c.ArenaMotion.profile('trident_gladiator');Object.assign(f,{action:['walk','guard'].includes(action)?'idle':action,weapon:null,attackWeapon:'trident_gladiator',attackProfile:p,duration:action==='dodge'?.46:p.duration,blocking:action==='guard',move:action==='walk'?1:0,hp:action==='down'?0:100,reaction:action==='hurt'?.2:0,timer:i/75,walk:i/8,deadTime:i/30,x:i*.03,z:i*.02,angle:i*.02});c.ImportedGladiator.animate(f,m,i/30,1/30);m.root.updateMatrixWorld(true);
   for(const [slot,bone,key]of [['armUpper','RightArm','upper'],['armFore','RightForeArm','fore']]){const group=m.gear[slot].group,relative=new T.Matrix4().copy(m.bones[bone].matrixWorld).invert().multiply(group.matrixWorld).elements;if(!stable[key])stable[key]=relative.slice();assert.ok(relative.every((v,k)=>Number.isFinite(v)&&Math.abs(v-stable[key][k])<1e-6),'no animated slipping');assert.equal(group,mounts[key==='upper'?0:1]);}
  }
  Object.assign(f,{hp:100,action:'idle',shoulders:false});c.ImportedGladiator.animate(f,m,4,1/60);assert.equal(m.gear.armFore.group.visible,false);assert.equal(m.gear.shoulder.group.visible,false);
 }
 assert.deepEqual(c.ArenaMotion.profile('trident_gladiator'),c.ArenaMotion.profile('trident'));
 await Promise.all(Array.from({length:12},()=>c.LudusEquipmentCatalog.load(T,'trident_gladiator')));Object.assign(f,{weapon:'trident_gladiator',shoulders:true,shoulderModel:'manica'});c.ImportedGladiator.animate(f,m,5,1/60);assert.equal(m.weaponAnchor.children[0].userData.catalogId,'trident_gladiator');assert.equal(m.gear.armFore.group.visible,false);assert.equal(m.gear.Leftmanica.group.visible,true);assert.equal(c.ClassEquipment.item({kind:'trident_gladiator'}),c.LudusEquipmentCatalog.get('trident_gladiator'));
 assert.equal(requests.length,4);c.ImportedGladiator.dispose(m);
});
test('transfer, triangles, embedded textures and source provenance stay bounded',async()=>{
 const c=await rigRuntime();c.crypto=crypto.webcrypto;vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
 for(const r of report.items){const bytes=fs.readFileSync('assets/equipment-v197/'+r.file);assert.equal(bytes.length,r.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.ok(r.bytes<350000);assert.ok(r.triangles<=4000);assert.ok(r.triangles<=r.extractedTriangles);assert.equal(c.LudusEquipmentCatalog.entry(r.id).triangles,r.triangles);assert.ok(r.drawCalls<=3);assert.ok(r.decodedTextureBytesWithMips<=4*1024*1024);
  const raw=await c.LudusEquipmentCatalog.decode(bytes),view=new DataView(raw),d=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,20,view.getUint32(12,true))));assert.equal(d.animations?.length||0,0);assert.equal(d.skins?.length||0,0);assert.equal(d.materials.length,1);assert.equal(d.images.length,3);assert.ok(d.images.every(i=>!i.uri&&i.bufferView!==undefined));assert.ok(d.meshes.every(m=>m.primitives.every(p=>!p.attributes.JOINTS_0&&!p.attributes.WEIGHTS_0)));
 }
});
test('three arm recipes and one polearm use distinct names and realistic inventory artwork',()=>{
 const p=require('../ludus-production-v119.js'),g=require('../equipment-groups-v168.js');for(const id of ids){const row=p.recipes.find(r=>r.model===id);assert.ok(row);assert.equal(p.skuForItem({kind:row.kind,model:id}),row.sku);assert.equal(row.output_quantity,1);assert.ok(fs.statSync(p.photo(row.sku)).size<25000);assert.match(p.artwork(row),/items-v197/);if(row.kind==='weapon')assert.equal(g.groupFor(row).id,'polearms');else assert.equal(row.kind,'gloves');}
 for(const name of ['caravan-core-v126.js','combat-motion-v163.js'])assert.equal(fs.readFileSync(name,'utf8'),fs.readFileSync('supabase/functions/caravan-combat-v126/'+name,'utf8'));
});
