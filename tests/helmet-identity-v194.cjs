const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs');
const expected={gold:['gladiator',4347],silver:['knights',3271],winged:['winged',3896],roman:['roman',11290],sylvain_helmet:['sylvain_helmet',6652],viking_helmet:['viking_helmet',4076],steel_helmet:['steel_helmet',2358]};
const meshes=model=>{const a=[];model.traverse(o=>{if(o.isMesh)a.push(o)});return a;};
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+': all seven item IDs select distinct real helmets, four restored models follow every class',async()=>{
 const c=await rigRuntime(page.endsWith('.js')?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;c.crypto=crypto.webcrypto;vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
 for(const id of ['sylvain_helmet','viking_helmet','steel_helmet']){const entry=c.LudusEquipmentCatalog.entry(id);await c.LudusEquipmentCatalog.load(T,id,{bytes:fs.readFileSync('assets/equipment-v167/'+entry.file)});}
 const identities=new Set(),shapes=new Set();for(const [id,[key,triangles]]of Object.entries(expected)){
  const model=c.LudusHelmets.get(id);assert.equal(c.LudusHelmets.model(id),key);const ms=meshes(model);assert.equal(ms.length,id==='silver'?2:1,'helmet mesh batching');assert.equal(ms.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0),triangles);identities.add(model);shapes.add(ms[0].geometry);assert.equal(c.ClassEquipment.item({kind:'helmet',itemEntry:{item:{kind:'helmet',model:id}}}),model);
 }assert.equal(identities.size,7);assert.equal(shapes.size,7,'different icons may not resolve to a recoloured common mesh');
 for(const [alias,id]of [['gladiator_helmet','gold'],['knights_helm','silver'],['winged_helmet_gameready','winged'],['roman_helmet','roman']])assert.equal(c.LudusHelmets.get(alias),c.LudusHelmets.get(id));
 for(const type of Object.keys(c.ArenaClasses)){
  const m=c.ImportedGladiator.create(194,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];Object.assign(f,{x:0,z:0,angle:0,helmet:true,chest:false,shoulders:false,greaves:false,offhand:null,leftGear:null,shield:false});
  for(const id of ['gold','silver','winged','roman']){f.helmetModel=id;let stable,relative;for(const action of ['idle','walk','attack','guard','dodge','hurt','down'])for(let n=0;n<6;n++){
   const p=c.ArenaMotion.profile('gladius');Object.assign(f,{action:['walk','guard'].includes(action)?'idle':action,weapon:action==='attack'?'gladius':null,attackWeapon:'gladius',attackProfile:p,duration:action==='dodge'?.46:p.duration,blocking:action==='guard',move:action==='walk'?1:0,hp:action==='down'?0:100,reaction:action==='hurt'?.2:0,timer:n/20,walk:n/8,deadTime:n/20});c.ImportedGladiator.animate(f,m,n/20,1/20);m.root.updateMatrixWorld(true);stable||=m.gear.helmet.group;assert.equal(m.gear.helmet.group,stable);assert.equal(stable.userData.helmetModel,expected[id][0]);
   const local=new T.Matrix4().copy(m.bones.Head.matrixWorld).invert().multiply(stable.matrixWorld).elements;relative||=local.slice();assert.ok(local.every((v,i)=>Number.isFinite(v)&&Math.abs(v-relative[i])<1e-6),id+' '+action+' head attachment');
  }const original=meshes(c.LudusHelmets.get(id));meshes(stable).forEach((o,i)=>{assert.equal(o.geometry,original[i].geometry);assert.equal(o.material.map,original[i].material.map)});}
  c.ImportedGladiator.dispose(m);
 }
});
test('names and four generated-from-model icons agree throughout the UI and source geometry is preserved',()=>{
 const p=require('../ludus-production-v119.js');for(const [sku,name]of [['helmet-gold','Gladyatör miğferi'],['helmet-silver','Şövalye miğferi'],['helmet-winged','Kanatlı miğfer'],['helmet-roman','Roma miğferi']]){
  const r=p.recipes.find(r=>r.sku===sku);assert.equal(r.name,name);assert.equal(r.output_quantity,1);assert.equal(p.photo(sku),'assets/items-v194/'+sku+'.webp');assert.match(p.artwork({kind:'helmet',model:r.model}),new RegExp('items-v194/'+sku+'.webp'));assert.ok(fs.statSync(p.photo(sku)).size<40000);
 }
 const report=require('../assets/items-v194/source-audit.json');for(const r of report){assert.equal(r.geometryIdentical,true);assert.equal(r.sourceGeometrySha256,r.gameGeometrySha256);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(r.gameModel)).digest('hex'),r.gameSha256);}
 for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js']){const s=fs.readFileSync(page,'utf8');assert.ok(!s.includes("['knights','winged'].includes(key)?'gladiator'"));assert.ok(!s.includes('Secutor miğferi')&&!s.includes('Thraex miğferi'));}
 for(const page of ['gelistirmeler.html','pazar.html','klan.html','savas.html','multiplayer.html']){const s=fs.readFileSync(page,'utf8');for(const sku of ['helmet-gold','helmet-silver','helmet-winged','helmet-roman'])assert.ok(s.includes('assets/items-v194/'+sku+'.webp'),page+' fallback icon '+sku);}
 for(const page of ['ludus.html','klan.html','pazar.html','gelistirmeler.html'])assert.match(fs.readFileSync(page,'utf8'),/ludus-production-v119.js\?v=revision197/);
});

test('shared titles and fallback icons preserve all seven identities even without the production module',()=>{
 const p=require('../ludus-production-v119.js');global.LudusProduction=p;const forum=require('../forum-market-v66.js');
 for(const r of p.recipes.filter(r=>r.kind==='helmet')){const item={kind:'helmet',model:r.model,name:'old cached label'};assert.equal(p.nameForItem(item),r.name);assert.equal(forum.modelName(item),r.name);assert.equal(forum.title(item),r.name+' +0');}
 delete global.LudusProduction;
 for(const file of ['ludus-supply-icons-v89.js','clan-equipment-v35.js']){const c=vm.createContext({});vm.runInContext(fs.readFileSync(file,'utf8'),c);const icon=c.LudusSupplyIcons||c.LudusIcons;assert.ok(icon,file);for(const r of p.recipes.filter(r=>r.kind==='helmet'))assert.ok(icon.svg({kind:'helmet',model:r.model}).includes(p.photo(r.sku)),file+' '+r.sku);}
});
