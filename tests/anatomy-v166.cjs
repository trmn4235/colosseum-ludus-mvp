// Actual skinned surface and palm contact, not just bone-local angle assertions.
const assert=require('node:assert/strict'),{rigRuntime}=require('./performance-v84.cjs');
async function main(){
 const report=[];
 for(const page of (process.env.LUDUS_ANATOMY_PAGE?[process.env.LUDUS_ANATOMY_PAGE]:['arena.html','savas.html','multiplayer.html','caravan-field.html','ludus.html'])){
  const c=await rigRuntime(page,page==='caravan-field.html'?{rigFile:'caravan-rig-v126.js'}:{}),T=c.THREE;
  const m=c.ImportedGladiator.create(166,'retiarius'),f=new c.ArenaCombat(()=>.999).reset('normal','retiarius').fighters[0];
  Object.assign(f,{x:0,z:0,angle:0,hp:100,action:'idle',move:0,chest:true,chestModel:'chest_plate',helmet:true,shoulders:false,shield:false,weapon:'trident',offhand:null,leftGear:null,motionVersion:163});
  const body=m.equipmentFit164.body,geometry=body.geometry,row={page,restError:0,maxPalmGap:0,maxShoulderReach:0,palmCases:{},chestGap:[Infinity,-Infinity],frames:0};
  // Joint rebinding must not move any original body vertex at rest.
  const prepare=c.ArenaAnatomy.prepare;c.ArenaAnatomy.prepare=()=>{};const original=c.ImportedGladiator.create(167,'retiarius');c.ArenaAnatomy.prepare=prepare;
  const a=new T.Vector3(),b=new T.Vector3(),source=original.equipmentFit164.body;
  for(let i=0;i<geometry.attributes.position.count;i++){
   body.getVertexPosition(i,a).applyMatrix4(body.matrixWorld);source.getVertexPosition(i,b).applyMatrix4(source.matrixWorld);row.restError=Math.max(row.restError,a.distanceTo(b));
  }
  assert.ok(row.restError<1e-5,JSON.stringify(row));c.ImportedGladiator.dispose(original);
  for(const part of ['Arm','ForeArm','Hand']){
   m.bones['Left'+part].getWorldPosition(a);m.bones['Right'+part].getWorldPosition(b);
   assert.ok(Math.abs(a.y-b.y)<1e-6&&Math.abs(a.z-b.z)<1e-6,'Both arm pivots lie inside the matching skin');
  }
  c.ClassEquipment.sync(m,f);m.root.updateMatrixWorld(true);
  m.gear.chest.group.traverse(mesh=>{
   if(!mesh.isMesh||mesh.name==='fitted-breastplate-straps')return;
   for(let i=0;i<mesh.geometry.attributes.position.count;i+=7){
    mesh.getVertexPosition(i,a).applyMatrix4(mesh.matrixWorld);
    const ray=new T.Raycaster(new T.Vector3(a.x,a.y,1),new T.Vector3(0,0,-1)),hit=ray.intersectObject(m.equipmentFit164.shell.mesh,false)[0];
    if(!hit)continue;const gap=a.z-hit.point.z;row.chestGap[0]=Math.min(row.chestGap[0],gap);row.chestGap[1]=Math.max(row.chestGap[1],gap);
   }
  });
  assert.ok(row.chestGap[0]>.004&&row.chestGap[1]<.022,JSON.stringify(row));
  let time=0;
  for(const weapon of ['trident','spear','gladius','sica'])for(const left of [false,true])for(const pose of ['idle','walk','attack','guard']){
   Object.assign(f,{weapon,offhand:left?weapon:null,action:pose==='attack'?'attack':'idle',attackLeft:left,attackWeapon:weapon,attackKind:'light',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(weapon),blocking:pose==='guard',shield:pose==='guard'&&!left,move:pose==='walk'?1:0,reaction:0,guardFlash:0,timer:0});
   f.duration=f.attackProfile.duration;
   for(let n=0;n<45;n++){
    time+=1/60;f.timer=n/44*f.duration;f.walk=n/8;if(pose==='walk'){f.x+=.012;f.z+=.018;}
    c.ImportedGladiator.animate(f,m,time,1/60);row.frames++;
    assert.equal(body.geometry,geometry,'Skin geometry must be cached across frames');
    for(const side of ['Left','Right']){
     const h=m.bones[side+'Hand'],arm=m.bones[side+'Arm'],state=m.grip166?.[side];if(!state?.active)continue;
     const shift=arm.getWorldPosition(a).distanceTo(arm.parent.localToWorld(b.copy(arm.userData.anatomyRestPosition)));row.maxShoulderReach=Math.max(row.maxShoulderReach,shift);assert.ok(shift<=.02501,'Shoulder reach is limited to 2.5 cm');
     h.localToWorld(a.set(0,.075,.025).divideScalar(h.getWorldScale(b).x));
     const gap=a.distanceTo(state.target),key=weapon+':'+pose+':'+left+':'+side;
     if(gap>row.maxPalmGap){row.worst={key,n};}row.maxPalmGap=Math.max(row.maxPalmGap,gap);row.palmCases[key]=Math.max(row.palmCases[key]||0,gap);
     assert.ok(Number.isFinite(gap)&&gap<.005,`Palm left the grip: ${JSON.stringify({page,key,gap,n})}`);
    }
   }
  }
  row.palmCases=Object.entries(row.palmCases).sort((a,b)=>b[1]-a[1]).slice(0,5);
  report.push(row);console.error(JSON.stringify(row));c.ImportedGladiator.dispose(m);
 }
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
