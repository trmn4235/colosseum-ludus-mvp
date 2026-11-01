const {rigRuntime}=require('./performance-v84.cjs');
function runPoseCases(c){
 const check=(ok,message)=>{if(!ok)throw Error(message);},T=c.THREE,a=new T.Vector3(),b=new T.Vector3(),scale=new T.Vector3();
 const report={poses:0,maxPalmGap:0,maxShoulderShift:0,skinSamples:0};
 for(const weapon of ['gladius','sica','spear','trident'])for(const left of [false,true])for(const pose of ['idle','forward','backward','side','attack','guard']){
  const m=c.ImportedGladiator.create(214,'murmillo'),f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0],walking=['forward','backward','side'].includes(pose);
  Object.assign(f,{x:0,z:0,angle:0,hp:100,motionVersion:163,weapon,offhand:left?weapon:null,shield:pose==='guard'&&!left,shieldStyle:'murmillo',chest:true,helmet:true,action:pose==='attack'?'attack':'idle',move:walking?1:0,blocking:pose==='guard',reaction:0,guardFlash:0,passiveEvade:0,attackLeft:left,attackWeapon:weapon,attackKind:'light',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(weapon),timer:0});f.duration=f.attackProfile.duration;
  const meshes=[];m.root.traverse(o=>{if(o.isSkinnedMesh&&o.visible&&!o.userData.wornEquipment164)meshes.push(o);});let time=0;
  for(let sample=0;sample<10;sample++){
   for(let frame=0;frame<6;frame++){time+=1/60;f.timer=(sample+frame/6)/10*f.duration;if(walking){f.walk+=7/60;f.x+=pose==='side'?1.6/60:0;f.z+=pose==='forward'?1.6/60:pose==='backward'?-1.6/60:0;}c.ImportedGladiator.animate(f,m,time,1/60);}
   const key=[weapon,left,pose,sample].join(':');
   for(const [,bone]of m.boneEntries)check(bone.matrixWorld.elements.every(Number.isFinite),key+' invalid bone');
   for(const side of ['Left','Right']){
    const state=m.grip166?.[side];if(!state?.active)continue;const hand=m.bones[side+'Hand'],arm=m.bones[side+'Arm'];
    hand.localToWorld(a.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));const gap=a.distanceTo(state.target);report.maxPalmGap=Math.max(report.maxPalmGap,gap);check(gap<.005,key+' palm contact '+gap);
    const shift=arm.getWorldPosition(a).distanceTo(arm.parent.localToWorld(b.copy(arm.userData.anatomyRestPosition)));report.maxShoulderShift=Math.max(report.maxShoulderShift,shift);check(shift<.02501,key+' shoulder moved');
   }
   for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i+=137){mesh.getVertexPosition(i,a).applyMatrix4(mesh.matrixWorld);m.root.worldToLocal(a);check(a.toArray().every(Number.isFinite)&&a.length()<3,key+' invalid skinned vertex');report.skinSamples++;}
   report.poses++;
  }
  c.ImportedGladiator.dispose(m);
 }
 check(report.poses===480,'pose coverage');return report;
}
if(require.main===module)rigRuntime().then(c=>console.log(JSON.stringify(runPoseCases(c),null,2))).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runPoseCases};
