const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs');
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+': helmet loads on demand, follows the head and survives switching',async()=>{
 const c=await rigRuntime(page==='caravan-rig-v126.js'?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;
 c.crypto=webcrypto;let requests=0;c.fetch=async url=>{requests++;return new Response(fs.readFileSync(url))};vm.runInContext(fs.readFileSync('equipment-catalog-v167.js','utf8'),c);
 assert.equal(requests,0);const engine=new c.ArenaCombat(()=>.999),m=c.ImportedGladiator.create(169,'murmillo'),f=engine.reset('normal','murmillo').fighters[0];
 Object.assign(f,{x:0,z:0,angle:0,helmet:true,helmetModel:'sylvain_helmet',weapon:null,shield:false,shoulders:false,chest:false,offhand:null,leftGear:null});
 c.ImportedGladiator.animate(f,m,0,1/60);assert.equal(requests,1);const empty=m.gear.helmet.group;
 await c.LudusEquipmentCatalog.load(T,'sylvain_helmet');c.ImportedGladiator.animate(f,m,1/60,1/60);
 assert.notEqual(m.gear.helmet.group,empty,'async load replaces the placeholder without changing selected gear');
 assert.equal(m.gear.helmet.group.userData.catalogId,'sylvain_helmet');assert.equal(m.gear.helmet.anchor.parent,m.bones.Head);
 const stable=m.gear.helmet.group;let relative;
 for(const action of ['idle','walk','attack','guard','dodge','hurt','down']){
  const profile=c.ArenaMotion.profile('gladius');Object.assign(f,{action:action==='walk'||action==='guard'?'idle':action,weapon:action==='attack'?'gladius':null,attackWeapon:'gladius',attackProfile:profile,duration:action==='dodge'?.46:profile.duration,blocking:action==='guard',move:action==='walk'?1:0,hp:action==='down'?0:100,reaction:action==='hurt'?.2:0});
  for(let i=0;i<60;i++){
   f.timer=i/120;f.walk=i/12;f.deadTime=i/60;c.ImportedGladiator.animate(f,m,2+i/60,1/60);m.root.updateMatrixWorld(true);
   const local=new T.Matrix4().copy(m.bones.Head.matrixWorld).invert().multiply(m.gear.helmet.group.matrixWorld).elements;
   if(!relative)relative=local.slice();assert.ok(local.every((x,j)=>Number.isFinite(x)&&Math.abs(x-relative[j])<1e-7),'no pose-dependent slip relative to head');
   assert.equal(m.gear.helmet.group,stable,'no per-frame rebuilding/flicker');assert.equal(stable.visible,true);
  }
 }
 assert.equal(requests,1);let meshCount=0;stable.traverse(o=>{if(o.isMesh){meshCount++;assert.equal(o.frustumCulled,false)}});assert.equal(meshCount,1);
 Object.assign(f,{hp:100,action:'idle',helmetModel:'roman'});c.ImportedGladiator.animate(f,m,4,1/60);assert.equal(m.helmetStyle,'roman');
 f.helmetModel='sylvain_helmet';c.ImportedGladiator.animate(f,m,5,1/60);assert.equal(m.gear.helmet.group.userData.catalogId,'sylvain_helmet');assert.equal(requests,1);
 const drop=c.ClassEquipment.item({kind:'helmet',itemEntry:{item:{kind:'helmet',model:'sylvain_helmet'}}});assert.equal(drop,c.LudusEquipmentCatalog.get('sylvain_helmet'));
 c.ImportedGladiator.dispose(m);
});
test('helmet identity, exact photograph and four-material recipe remain distinct',()=>{
 const p=require('../ludus-production-v119.js'),r=p.recipes.find(r=>r.sku==='helmet-sylvain');assert.deepEqual(r.ingredients,{steel:5,leather:3,linen:2,wool_cloth:1});assert.equal(r.output_quantity,1);assert.equal(p.skuForItem({kind:'helmet',model:'sylvain_helmet'}),r.sku);assert.match(p.artwork({kind:'helmet',model:'sylvain_helmet'}),/items-v169\/helmet-sylvain.webp/);assert.ok(fs.statSync(p.photo(r.sku)).size>2000);
});
