/* Compare real GLB rigs and current page scripts. Texture pixels/GPU/phone FPS are not measured. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {rigRuntime}=require('./performance-v84.cjs');
const baseline=process.env.LUDUS_BASELINE_ROOT;
if(!baseline)throw Error('Set LUDUS_BASELINE_ROOT to an unchanged V95 checkout.');
function counters(c){
 const counts={worldUpdates:0,treeUpdates:0};
 for(const [name,key] of [['updateWorldMatrix','worldUpdates'],['updateMatrixWorld','treeUpdates']]){const original=c.THREE.Object3D.prototype[name];c.THREE.Object3D.prototype[name]=function(...args){counts[key]++;return original.apply(this,args);};}
 return counts;
}
function setup(c,type){
 const model=c.ImportedGladiator.create(0,type),fighter=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];
 Object.assign(fighter,{x:0,z:0,angle:0});return{model,fighter};
}
function scenario(c,f,name){
 Object.assign(f,{hp:100,action:'idle',timer:0,deadTime:0,reaction:0,passiveEvade:0,guardFlash:0,blocking:false,move:0,duration:.46,shieldHeldBy:null,attackLeft:false,absoluteBlockUntil:0});
 if(['walk','run','backward'].includes(name))f.move=1;
 if(name==='guard')f.blocking=true;
 if(name==='attack'){f.action='attack';f.attackWeapon=f.weapon;f.attackKind='heavy';f.attackRegion='chest';f.attackProfile=c.ArenaMotion.profile(f.weapon,true);f.duration=f.attackProfile.duration;}
 if(name==='hurt'){f.action='hurt';f.lastRegion='chest';f.reaction=.32;}
 if(name==='dodge'){f.action='dodge';f.dx=.8;f.dz=.6;}
 if(name==='knocked'){f.action='knocked';f.duration=1.5;}
 if(name==='dead'){f.action='dead';f.hp=0;}
}
function pose(m){
 const result=[];
 for(const [name,bone] of m.boneEntries)result.push(...bone.quaternion.toArray(),...bone.matrixWorld.elements);
 for(const o of [m.root,m.body,m.weaponAnchor,m.offhandAnchor,m.gear.shield?.anchor].filter(Boolean))result.push(...o.matrixWorld.elements);
 return result;
}
async function main(){
 const report={note:'Real geometry/rig with placeholder textures. CPU matrix traversal counts and pose equality, not GPU/device FPS.',pages:[]};
 for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html']){
  const before=await rigRuntime(page,{root:baseline}),after=await rigRuntime(page),bc=counters(before),ac=counters(after);let maximumError=0,values=0;
  for(const type of Object.keys(after.ArenaClasses)){
   const b=setup(before,type),a=setup(after,type);let time=0;
   const oldMeshes=[],newMeshes=[];b.model.visual.traverse(o=>{if(o.isSkinnedMesh&&o.visible)oldMeshes.push(o)});a.model.visual.traverse(o=>{if(o.isSkinnedMesh)newMeshes.push(o)});
   assert.equal(oldMeshes.length,5);assert.equal(newMeshes.length,1);assert.ok(newMeshes[0].visible);
   assert.equal(newMeshes[0].geometry.index.count,oldMeshes.reduce((sum,o)=>sum+o.geometry.index.count,0));
   // Body UVs, normals, weights and positions are copied verbatim; no simplification.
   for(const key of Object.keys(newMeshes[0].geometry.attributes)){const actual=newMeshes[0].geometry.attributes[key];let offset=0;for(const mesh of oldMeshes){const expected=mesh.geometry.attributes[key];for(let n=0;n<expected.count;n++)for(let k=0;k<expected.itemSize;k++)assert.equal(actual.getComponent(offset+n,k),expected.getComponent(n,k),key);offset+=expected.count;}}

   for(const name of ['walk','run','backward','guard','attack','hurt','dodge','knocked','dead']){
    scenario(before,b.fighter,name);scenario(after,a.fighter,name);
    for(let i=0;i<36;i++){
     const dt=1/60;time+=dt;
     for(const [c,state] of [[before,b],[after,a]]){const f=state.fighter;f.timer=(name==='knocked'?1.45:name==='dead'?2.5:f.duration||.6)*i/35;f.deadTime=2.5*i/35;f.walk+=dt*6;f.reaction=name==='hurt'?Math.max(0,.32-i*dt):0;f.z+=(name==='run'?4.2:name==='walk'?1.3:name==='backward'?-2:0)*dt;c.ImportedGladiator.animate(f,state.model,time,dt);}
     if(i%7===0||i===35){const expected=pose(b.model),actual=pose(a.model);assert.equal(actual.length,expected.length);for(let j=0;j<actual.length;j++){assert.ok(Number.isFinite(actual[j]));const error=Math.abs(actual[j]-expected[j]);maximumError=Math.max(maximumError,error);assert.ok(error<1e-7,`${page} ${type} ${name} frame ${i}: pose[${j}] error ${error}`);values++;}}
    }
   }
   before.ImportedGladiator.dispose(b.model);after.ImportedGladiator.dispose(a.model);
  }
  assert.ok(ac.treeUpdates<bc.treeUpdates,'scene graph traversals should decrease');
  report.pages.push({page,visibleBodyDraws:'5 → 1',skeletons:'8 → 1',classes:7,scenarios:9,comparedValues:values,maximumError,before:bc,after:ac});
 }
 if(process.env.LUDUS_RIG_REPORT)fs.writeFileSync(process.env.LUDUS_RIG_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
