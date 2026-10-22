// Real GLBs: skin/armour seam drift, head lock, swaps, translation and shared GPU resources.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {rigRuntime,inspectScripts}=require('./performance-v84.cjs');
const parts=['chest','shoulder','otherShoulder','collar'];
function state(c,variant){
 const f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
 return Object.assign(f,{x:0,z:0,angle:0,hp:100,chest:true,helmet:true,shoulders:true,shield:false,weapon:'gladius',motionVersion:163,
  helmetModel:variant?'roman':'gladiator',chestModel:variant?'chest_plate':'gladiator_chest',shoulderModel:variant?'shoulder_armor':'armor_shoulder'});
}
function landmarks(c,m){
 const T=c.THREE,body=m.equipmentFit164.body,g=body.geometry,points=[],p=new T.Vector3();
 for(let i=0;i<g.attributes.position.count;i++){
  body.getVertexPosition(i,p).applyMatrix4(body.matrixWorld);let region=0,trunk=0;
  for(let k=0;k<4;k++){const name=body.skeleton.bones[g.attributes.skinIndex.getComponent(i,k)].name,w=g.attributes.skinWeight.getComponent(i,k);if(/Spine|Hips|Neck|(Left|Right)(Shoulder|Arm)/.test(name))region+=w;if(/Spine|Hips|Neck/.test(name))trunk+=w;}
  if(p.y>1.05&&p.y<1.8&&region>.9)points.push({id:i,p:p.clone(),trunk});
 }
 const pairs=[];
 for(const slot of parts)m.gear[slot].group.traverse(o=>{
  if(!o.isMesh||!m.gear[slot].group.visible)return;
  assert.ok(o.isSkinnedMesh);assert.equal(o.skeleton,body.skeleton);assert.equal(o.frustumCulled,false);
  assert.ok(o.material.depthTest&&o.material.depthWrite&&!o.material.transparent&&o.material.polygonOffset);
  for(let i=0;i<o.geometry.attributes.position.count;i+=Math.max(1,Math.floor(o.geometry.attributes.position.count/60))){
   o.getVertexPosition(i,p).applyMatrix4(o.matrixWorld);let d=Infinity,id;
   // A rigid front panel follows ribs, not the neighbouring upper-arm skin.
   const torsoPanel=m.chestModel==='chest_plate'&&slot==='chest'&&p.y<1.61;
   for(const b of points){if(torsoPanel&&b.trunk<.98)continue;const dist=p.distanceToSquared(b.p);if(dist<d){d=dist;id=b.id;}}
   assert.ok(Number.isFinite(d));pairs.push({o,i,id,slot,rest:Math.sqrt(d)});
  }
 });
 return pairs;
}
async function main(){
 const report=[];let frames=0;
 for(const page of ['arena.html','savas.html','multiplayer.html','caravan-field.html','ludus.html']){
  const c=await rigRuntime(page,page==='caravan-field.html'?{rigFile:'caravan-rig-v126.js'}:{}),T=c.THREE;
  for(const variant of [0,1]){
   const m=c.ImportedGladiator.create(1,'murmillo'),f=state(c,variant);
   c.ClassEquipment.sync(m,f);m.root.updateMatrixWorld(true);
   const pairs=landmarks(c,m),p=new T.Vector3(),q=new T.Vector3(),helmetRest=m.bones.Head.matrixWorld.clone().invert().multiply(m.gear.helmet.group.matrixWorld),row={page,variant,drift:{}};
   const geometry=m.gear.chest.group.children[0].geometry,body=m.equipmentFit164.body;
   for(const pose of ['idle','walk','attack','guard','duck','jump','roll']){
    Object.assign(f,{action:'idle',move:0,walk:0,blocking:false,reaction:0,timer:0});
    if(pose==='walk')f.move=1;if(pose==='guard')f.blocking=true;
    if(pose==='attack')Object.assign(f,{action:'attack',attackWeapon:'gladius',attackProfile:c.ArenaMotion.profile('gladius'),attackKind:'light',attackRegion:'chest',attackLeft:false,duration:.65});
    if(['duck','jump','roll'].includes(pose))Object.assign(f,{action:pose==='roll'?'dodge':'evade',evadeKind:pose,duration:.65});
    for(let n=0;n<41;n++){
     f.timer=n/60;f.walk=n/15;f.x=n*.03;f.z=n*.01;f.angle=n*.017;
     c.ImportedGladiator.animate(f,m,n/60,1/60);frames++;
     assert.equal(m.gear.chest.group.children[0].geometry,geometry,'No per-frame geometry rebuild');
     for(const key of ['helmet','chest','shoulder','otherShoulder'])assert.equal(m.gear[key].group.visible,true);
     const helmet=m.bones.Head.matrixWorld.clone().invert().multiply(m.gear.helmet.group.matrixWorld);
     assert.ok(helmet.elements.every((v,i)=>Math.abs(v-helmetRest.elements[i])<1e-6),'Helmet must remain locked to head');
     for(const pair of pairs){
      pair.o.getVertexPosition(pair.i,p).applyMatrix4(pair.o.matrixWorld);body.getVertexPosition(pair.id,q).applyMatrix4(body.matrixWorld);
      assert.ok(p.toArray().every(Number.isFinite));const drift=Math.abs(p.distanceTo(q)-pair.rest);
      row.drift[pair.slot]=Math.max(row.drift[pair.slot]||0,drift);
     }
    }
   }
   // The extreme roll can compress a rim. None may detach by a body-width.
   for(const [part,d]of Object.entries(row.drift))assert.ok(d<.075,JSON.stringify({page,variant,part,d}));
   const copy=c.ImportedGladiator.create(2,'murmillo'),copyState=state(c,variant);c.ClassEquipment.sync(copy,copyState);
   assert.equal(copy.gear.chest.group.children[0].geometry,geometry,'Reuse the fitted geometry');
   assert.notEqual(copy.equipmentFit164.body.skeleton,body.skeleton,'Fighters keep independent skeletons');
   // An item swap while bent must use the original bind pose, not capture that bent pose.
   f.chestModel=variant?'gladiator_chest':'chest_plate';c.ClassEquipment.sync(m,f);
   copyState.chestModel=f.chestModel;c.ClassEquipment.sync(copy,copyState);
   assert.equal(copy.gear.chest.group.children[0].geometry,m.gear.chest.group.children[0].geometry);
   for(const helmetModel of ['gladiator','roman','knights','winged']){f.helmetModel=helmetModel;c.ClassEquipment.sync(m,f);m.gear.helmet.group.traverse(o=>{if(o.isMesh)assert.ok(!o.frustumCulled&&o.material.depthTest&&o.material.polygonOffset);});}
   Object.assign(f,{chest:false,shoulders:false,helmet:false});c.ClassEquipment.sync(m,f);
   for(const key of ['helmet','chest','shoulder','otherShoulder','collar'])assert.equal(m.gear[key].group.visible,false);
   Object.assign(f,{chest:true,shoulders:true,helmet:true,shoulderModel:'manica'});c.ClassEquipment.sync(m,f);
   assert.ok(m.gear.Leftmanica.group.visible&&m.gear.Rightmanica.group.visible);
   c.ImportedGladiator.dispose(m);c.ImportedGladiator.dispose(copy);report.push(row);
  }
  if(page==='caravan-field.html'){
   c.Image=class{set src(value){this.width=this.height=1;queueMicrotask(()=>this.onload?.());}};
   const bytes=fs.readFileSync(require('node:path').join(__dirname,'../assets/caravan-v128/driver.glb'));
   const source=(await new T.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
   const driver=c.ImportedGladiator.create(30,'murmillo',source),f=state(c,0);f.chest=f.shoulders=f.helmet=false;
   for(let n=0;n<5;n++)c.ImportedGladiator.animate(f,driver,n/60,1/60);
   assert.ok(driver.bones.Head.matrixWorld.elements.every(Number.isFinite));c.ImportedGladiator.dispose(driver);
  }
 }
 console.log(JSON.stringify({frames,renderers:5,parsedPages:inspectScripts().length,report}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
