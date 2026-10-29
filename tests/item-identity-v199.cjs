const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs'),visuals=require('../item-visuals-v199.js'),report=require('../assets/items-v199/render-report.json');
const read=f=>fs.readFileSync(f,'utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const wrappers=['savas.html','multiplayer.html','pazar.html','gelistirmeler.html','klan.html','clan-equipment-v35.js','ludus-supply-icons-v89.js'];
function wrapper(file){const s=read(file);if(file==='ludus-supply-icons-v89.js')return s;const a=s.indexOf('var LudusIcons=');return s.slice(a,s.indexOf('})();',a)+5);}
function context(){const c=vm.createContext({});for(const f of ['item-visuals-v199.js','ludus-production-v119.js','equipment-groups-v168.js'])vm.runInContext(read(f),c);return c;}
test('all equipment cards preserve exact identity, aliases and neutral unknowns in every UI wrapper',()=>{
 const rows=Object.values(visuals.records).filter(r=>r.kind!=='supply');assert.equal(rows.length,36);
 for(const file of wrappers){const c=context();vm.runInContext(wrapper(file),c);const api=c.LudusIcons||c.LudusSupplyIcons;
  for(const available of [true,false]){if(!available)c.LudusProduction=undefined;
   for(const r of rows)for(const model of [r.model,...r.aliases])for(const staleSku of ['sica','heavy_mace']){const item={kind:r.kind,model,sku:staleSku,enhancement:7,emeralds:[{id:2,value:80}]},before=JSON.stringify(item);assert.ok(api.svg(item).includes(r.icon),file+' '+model);assert.equal(JSON.stringify(item),before);}
   for(const kind of ['weapon','shield','helmet','chest','gloves','legs'])assert.ok(!api.svg({kind,model:'unknown',sku:'heavy_mace'}).includes('<image'),file+' unknown '+kind);
  }
  c.LudusItemVisuals=undefined;assert.ok(!api.svg({kind:'weapon',model:'unknown'}).includes('<image'));
 }
 assert.equal(visuals.entry({kind:'chest',model:'starter'}).model,'chest_plate');assert.equal(visuals.entry({kind:'chest'}).model,'chest_plate');assert.equal(visuals.entry({kind:'helmet',model:'secutor'}).model,'gold');assert.equal(visuals.entry({kind:'gloves',model:'starter'}).model,'armor_shoulder');
});
test('recipes, enhancements, Sica and Gladius assets remain unchanged',()=>{
 const c=context();assert.equal(hash(JSON.stringify(c.LudusProduction.recipes)),'d1f52fa1e01ec4316a481766b9eb28016193cb413dcf0f6073d065832424e3b2');
 for(const [sku,sha]of [['sica','6e4fb7ab8a4dca6bcb4c270229bbe3722c6c8b84ff5d32240f0ea9a5b354e772'],['gladius','af2cc23aff60ed5f9a9d762c06ad4ec445ac20c44db2ac1270af63d35cebae35']]){assert.equal(c.LudusProduction.photo(sku),'assets/items-v118/'+sku+'.webp');assert.equal(hash(fs.readFileSync(c.LudusProduction.photo(sku))),sha);assert.equal(visuals.nameForItem({kind:'weapon',model:sku}),null);}
});
test('22 exact model renders and optimized original chest stay within budgets',()=>{
 assert.equal(report.length,22);assert.equal(new Set(report.map(r=>r.sha256)).size,22);
 for(const r of report){const b=fs.readFileSync(r.icon);assert.equal(b.length,r.bytes);assert.equal(hash(b),r.sha256);assert.ok(b.length<35000);assert.equal(visuals.records[r.sku].icon,r.icon);assert.match(r.geometrySha256,/^[a-f0-9]{64}$/);}
 const r=require('../assets/equipment-v199/build-report.json'),b=fs.readFileSync(r.file),d=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert.equal(hash(b),r.sha256);assert.equal(hash(fs.readFileSync(r.source)),r.sourceSha256);assert.equal(r.triangles,3305);assert.ok(r.bytes<70000);assert.equal(r.primitives,1);assert.ok(!d.extensionsRequired?.includes('KHR_mesh_quantization'),'runtime merger requires decoded float positions');
});
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+': two distinct chest models, shared fitted resources and unchanged sword selection',async()=>{
 const c=await rigRuntime(page.endsWith('.js')?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),a=c.LudusArmour.get('chest','gladiator_chest'),b=c.LudusArmour.get('chest','chest_plate');assert.notEqual(a,b);assert.notEqual(a.children[0].geometry,b.children[0].geometry);assert.equal(c.LudusArmour.model('chest','starter'),'chest_plate');let count=0;a.traverse(o=>{if(o.isMesh)count+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});assert.equal(count,3305);assert.equal(c.ClassEquipment.weapon('gladius'),c.ClassEquipment.weapon('sica'));
 const m=c.ImportedGladiator.create(199,'murmillo'),f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];f.chest=true;
 for(const model of ['gladiator_chest','chest_plate','gladiator_chest']){f.chestModel=model;c.ImportedGladiator.animate(f,m,0,0);assert.equal(m.chestModel,model);assert.ok(m.gear.chest.group.visible);assert.ok(m.gear.chest.group.children[0].isSkinnedMesh);}
 c.ImportedGladiator.dispose(m);
});
test('browser entry points load visual identities before production and invalidate changed scripts',()=>{
 for(const f of ['ludus.html','savas.html','multiplayer.html','pazar.html','gelistirmeler.html','klan.html']){const s=read(f);assert.ok(s.includes('item-visuals-v199.js?v=revision199'),f);assert.ok(s.indexOf('item-visuals-v199.js')<s.indexOf('ludus-production-v119.js'));assert.ok(s.includes('ludus-production-v119.js?v=revision199'));}
 for(const f of ['caravan-battle-v126.js','pit-visit-v172.js'])assert.ok(read(f).includes('revision199'));
 assert.equal((read('san-avlusu.html').match(/assets\/items-v199\/bow.webp/g)||[]).length,2);
});
module.exports={wrapper,wrappers};
