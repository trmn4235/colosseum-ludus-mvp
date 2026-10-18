// The real GLB skeleton and held equipment; no replacement character or placeholder bones.
const assert=require('node:assert/strict');
const {rigRuntime}=require('./performance-v84.cjs');
async function main(){
 const report=[];
 for(const page of ['arena.html','savas.html','multiplayer.html']){
  const c=await rigRuntime(page),T=c.THREE;
  for(const [kind,type]of [['gladius','murmillo'],['spear','hoplomachus'],['trident','retiarius']])for(const chain of kind==='gladius'?[1,2,3]:[1]){
   const m=c.ImportedGladiator.create(0,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];
   Object.assign(f,{x:0,z:0,angle:0,action:'idle',move:0,reaction:0});
   for(let n=0;n<20;n++)c.ImportedGladiator.animate(f,m,n/60,1/60);
   const feet=['Left','Right'].map(side=>m.bones[side+'Foot'].getWorldPosition(new T.Vector3()));
   Object.assign(f,{action:'attack',chain,attackWeapon:kind,attackLeft:false,attackRegion:'chest',attackKind:'light',attackProfile:c.ArenaMotion.profile(kind)});f.duration=f.attackProfile.duration;
   let gripError=0,tipError=0,footError=0,maxStep=0,gripAt=0;
   for(let n=0;n<=Math.ceil(f.duration*60);n++){
    f.timer=Math.min(f.duration,n/60);c.ImportedGladiator.animate(f,m,1+n/60,1/60);m.root.updateMatrixWorld(true);
    const s=c.ArenaMotion.sample(f),grip=m.root.worldToLocal(m.weaponAnchor.getWorldPosition(new T.Vector3())),tip=m.root.worldToLocal(m.weaponAnchor.localToWorld(new T.Vector3(0,f.attackProfile.length,0)));
    if(grip.distanceTo(new T.Vector3(s.grip.x,s.grip.y,s.grip.z))>gripError)gripAt=f.timer;gripError=Math.max(gripError,grip.distanceTo(new T.Vector3(s.grip.x,s.grip.y,s.grip.z)));tipError=Math.max(tipError,tip.distanceTo(new T.Vector3(s.tip.x,s.tip.y,s.tip.z)));
    const step=c.ArenaMotion.body(f).step;maxStep=Math.max(maxStep,step?.forward||0);
    for(const [i,side]of ['Left','Right'].entries()){
     const target=feet[i].clone();if(step?.side===side){target.z+=step.forward;target.y+=step.lift;}
     const point=m.bones[side+'Foot'].getWorldPosition(new T.Vector3());assert.ok(point.toArray().every(Number.isFinite));footError=Math.max(footError,point.distanceTo(target));
    }
   }
   const row={page,kind,chain,gripError,gripAt,tipError,footError,maxStep};report.push(row);
   if(!process.env.LUDUS_RIG_DIAGNOSTIC){assert.ok(gripError<.04,JSON.stringify(row));assert.ok(tipError<.04,JSON.stringify(row));assert.ok(footError<.05,JSON.stringify(row));assert.ok(maxStep>.13);}
   c.ImportedGladiator.dispose(m);
  }
 }
 console.log(JSON.stringify({realRig:true,scenarios:report.length,report}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
