const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {rigRuntime}=require('./performance-v84.cjs'),root=path.resolve(__dirname,'..'),report=require('../assets/equipment-v191/build-report.json');
const count=g=>{let n=0;g.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});return n;};
function baselineSource(){
 const html=fs.readFileSync(root+'/arena.html','utf8'),start=html.indexOf('var ClassEquipment='),end=html.indexOf('})();',html.indexOf('return {equip,setWeapon,weapon,sync,item,shield,animateFlex};',start))+5;
 return html.slice(start,end).replace('var ClassEquipment=','var ClassEquipmentV190=').replace(/ function detailedGreave\(\)[\s\S]*?(?= function fitLimb)/,fs.readFileSync(root+'/tests/fixtures/greave-v190.js','utf8'));
}
test('active helmet and icons meet transfer, texture and geometry budgets',async()=>{
 const c=await rigRuntime();c.crypto=crypto.webcrypto;vm.runInContext(fs.readFileSync(root+'/equipment-catalog-v167.js','utf8'),c);
 const file='assets/equipment-v167/'+c.LudusEquipmentCatalog.entry('sylvain_helmet').file,b=fs.readFileSync(root+'/'+file),raw=Buffer.from(await c.LudusEquipmentCatalog.decode(b)),j=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),report.helmet.sha256);assert.equal(b.length,report.helmet.bytes);assert.ok(b.length<500000);
 assert.ok(j.extensionsRequired.includes('EXT_texture_webp'));assert.equal(j.images.length,4);assert.ok(j.images.every(i=>i.bufferView!==undefined&&i.mimeType==='image/webp'&&!i.uri));
 assert.equal(j.meshes.length,1);assert.equal(j.meshes[0].primitives.length,1);assert.equal(j.animations?.length||0,0);assert.ok(report.helmet.decodedTextureBytesWithMips<3.4*1024*1024);
 const g=await c.LudusEquipmentCatalog.load(c.THREE,'sylvain_helmet',{bytes:b});assert.equal(count(g),6652);assert.equal(c.LudusEquipmentCatalog.entry('sylvain_helmet').triangles,count(g));
 for(const r of report.icons){const data=fs.readFileSync(root+'/assets/pit-v191/'+r.file);assert.equal(data.length,r.bytes);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),r.sha256);assert.ok(data.length<35000);assert.ok(r.alpha);assert.equal(r.width,512);}
 const selection=fs.readFileSync(root+'/san-avlusu.html','utf8');assert.ok(!/pit-v178\/(?:stone|wood)-icon\.png/.test(selection));assert.equal((selection.match(/assets\/pit-v191\/(?:stone|wood)-icon\.webp/g)||[]).length,4);
});
for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js'])test(page+': reduced greaves share resources and remain fixed to both legs',async()=>{
 const c=await rigRuntime(page.endsWith('.js')?'arena.html':page,page.endsWith('.js')?{rigFile:page}:{}),T=c.THREE;
 vm.runInContext(baselineSource(),c);const old=c.ClassEquipmentV190.item({kind:'greaves'}),now=c.ClassEquipment.item({kind:'greaves'});
 assert.equal(count(old)*2,5096);assert.equal(count(now)*2,2312);assert.equal(now,c.ClassEquipment.item({kind:'greaves'}));
 const a=new T.Box3().setFromObject(old),b=new T.Box3().setFromObject(now);assert.ok(a.min.distanceTo(b.min)<.001&&a.max.distanceTo(b.max)<.001,'bounds stay within one millimetre');
 const m=c.ImportedGladiator.create(191,'murmillo'),f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0],parts=['Left','Right'].map(side=>m.gear[side+'greave'].group),relative=[];
 for(const action of ['idle','walk','attack','guard','dodge','hurt','down']){
  const p=c.ArenaMotion.profile('gladius');Object.assign(f,{action:action==='walk'||action==='guard'?'idle':action,weapon:'gladius',attackWeapon:'gladius',attackProfile:p,duration:action==='dodge'?.46:p.duration,blocking:action==='guard',move:action==='walk'?1:0,hp:action==='down'?0:100,reaction:action==='hurt'?.2:0,greaves:true});
  for(let i=0;i<30;i++){
   f.timer=i/120;f.walk=i/12;f.deadTime=i/60;c.ImportedGladiator.animate(f,m,i/60,1/60);m.root.updateMatrixWorld(true);
   for(const [j,side]of ['Left','Right'].entries()){
    const g=m.gear[side+'greave'].group;assert.equal(g,parts[j]);assert.equal(count(g),1156);assert.ok(g.visible);
    const local=new T.Matrix4().copy(m.bones[side+'Leg'].matrixWorld).invert().multiply(g.matrixWorld).elements;
    relative[j]||=local.slice();assert.ok(local.every((x,k)=>Number.isFinite(x)&&Math.abs(x-relative[j][k])<1e-7),'no leg-relative slipping');
   }
  }
 }
 const left=[],right=[];parts[0].traverse(o=>{if(o.isMesh)left.push(o)});parts[1].traverse(o=>{if(o.isMesh)right.push(o)});left.forEach((o,i)=>{assert.equal(o.geometry,right[i].geometry);assert.equal(o.material,right[i].material)});
 c.ImportedGladiator.dispose(m);
});
test('every entry point and dynamic loader invalidates changed cached scripts',()=>{
 for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html','san-avlusu.html','equipment-preview-v167.html'])assert.match(fs.readFileSync(root+'/'+page,'utf8'),/equipment-catalog-v167\.js\?v=revision193/);
 assert.match(fs.readFileSync(root+'/caravan-field.html','utf8'),/caravan-battle-v126\.js\?v=revision193/);
 assert.match(fs.readFileSync(root+'/san-avlusu.html','utf8'),/pit-visit-v172\.js\?v=revision193/);
});
