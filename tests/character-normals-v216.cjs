const {rigRuntime}=require('./performance-v84.cjs');

// Independent oracle for the r160 skin-normal shader: weighted bone matrices,
// both bind matrices, then the mesh's normal matrix. This checks the rendered
// directions, not the implementation's rebasing matrix or its stored normals.
// Self-contained so the browser runner can execute the same assertions.
function runNormalCases(c,{types=Object.keys(c.ArenaClasses),samples=10,poses=['idle','forward','backward','side','attack','guard']}={}){
 const T=c.THREE,check=(ok,message)=>{if(!ok)throw Error(message);};
 const report={classes:[],restChecks:0,restVertices:0,cachedRestChecks:0,poses:0,frames:0,normalSamples:0,maxRestNormalDegrees:0,maxRestPositionError:0,maxPalmGap:0};
 const blend=new T.Matrix4(),matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),v=new T.Vector3(),p=new T.Vector3(),q=new T.Vector3(),scale=new T.Vector3();
 const original=c.ArenaAnatomy.prepare;let inspect=false,currentMesh,indices=[],firstGeometry;
 function body(visual){let mesh;visual.traverse(o=>{if(!mesh&&o.isSkinnedMesh&&!o.userData.replaceGear)mesh=o;});return mesh;}
 function capture(mesh){return{geometry:mesh.geometry,world:mesh.matrixWorld.clone(),normal:new T.Matrix3().getNormalMatrix(mesh.matrixWorld),bind:mesh.bindMatrix.clone(),inverse:mesh.bindMatrixInverse.clone(),bones:mesh.skeleton.bones.map((b,i)=>b.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[i]))};}
 function skin(state,i){
  const a=state.geometry.attributes;blend.elements.fill(0);
  for(let k=0;k<4;k++){
   const weight=a.skinWeight.getComponent(i,k),bone=state.bones[a.skinIndex.getComponent(i,k)];
   for(let j=0;j<16;j++)blend.elements[j]+=bone.elements[j]*weight;
  }
  return matrix.copy(state.inverse).multiply(blend).multiply(state.bind);
 }
 function normal(state,i,out){return out.fromBufferAttribute(state.geometry.attributes.normal,i).applyMatrix3(normalMatrix.setFromMatrix4(skin(state,i))).applyNormalMatrix(state.normal);}
 function position(state,i,out){return out.fromBufferAttribute(state.geometry.attributes.position,i).applyMatrix4(skin(state,i)).applyMatrix4(state.world);}
 function sameArray(a,b,label){check(a?.length===b?.length,label+' length');for(let i=0;i<a.length;i++)check(a[i]===b[i],label+' at '+i);}
 c.ArenaAnatomy.prepare=(root,visual,bones)=>{
  root.updateMatrixWorld(true);const mesh=body(visual),before=inspect?capture(mesh):null,material=mesh.material;
  original(root,visual,bones);root.updateMatrixWorld(true);currentMesh=mesh;
  if(!inspect)return;
  const after=capture(mesh),a=before.geometry.attributes,b=after.geometry.attributes;
  check(a.position.count===b.position.count,'vertex count changed');
  sameArray(before.geometry.index.array,after.geometry.index.array,'topology');
  for(const key of Object.keys(a))if(!['position','normal','skinIndex','skinWeight'].includes(key))sameArray(a[key].array,b[key].array,key);
  check(mesh.material===material,'material changed');
  if(firstGeometry){check(after.geometry===firstGeometry,'prepared skin is not shared');report.cachedRestChecks++;}else firstGeometry=after.geometry;
  const affected=[];let left=0,right=0;
  for(let i=0;i<a.position.count;i++){
   normal(before,i,p);normal(after,i,q);const dot=Math.max(-1,Math.min(1,p.dot(q))),degrees=Math.acos(dot)*180/Math.PI;
   check(Number.isFinite(degrees)&&degrees<.001,'rest normal '+i+' changed by '+degrees+' degrees');
   report.maxRestNormalDegrees=Math.max(report.maxRestNormalDegrees,degrees);
   position(before,i,p);position(after,i,q);const gap=p.distanceTo(q);
   check(gap<.000002,'rest surface '+i+' moved '+gap+' m');report.maxRestPositionError=Math.max(report.maxRestPositionError,gap);
   // Rebased positions identify the finger region even when the corrected
   // normal happens to equal the source attribute exactly.
   if(a.position.getX(i)!==b.position.getX(i)||a.position.getY(i)!==b.position.getY(i)||a.position.getZ(i)!==b.position.getZ(i)){
    affected.push(i);if(p.x<0)right++;else left++;
   }
   report.restVertices++;
  }
  check(affected.length>1000&&left>100&&right>100,'both finger regions must be covered');
  indices=affected.filter((_,i)=>i%Math.max(1,Math.floor(affected.length/64))===0);
  report.restChecks++;
 };
 try{
  for(const type of types){
   let count=0;
   for(const pose of poses){
    inspect=pose===poses[0];const m=c.ImportedGladiator.create(216,type),mesh=currentMesh,f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];
    const walking=['forward','backward','side'].includes(pose);
    Object.assign(f,{x:0,z:0,angle:0,hp:100,motionVersion:163,action:pose==='attack'?'attack':'idle',timer:0,walk:0,move:walking?1:0,blocking:pose==='guard',reaction:0,guardFlash:0,passiveEvade:0,attackLeft:false,attackWeapon:f.weapon,attackKind:'light',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(f.weapon)});f.duration=f.attackProfile.duration;
    let time=0;
    try{
     for(let sample=0;sample<samples;sample++){
      for(let frame=0;frame<6;frame++){
       time+=1/60;f.timer=(sample+frame/6)/samples*f.duration;
       if(walking){f.walk+=7/60;f.x+=pose==='side'?1.6/60:0;f.z+=pose==='forward'?1.6/60:pose==='backward'?-1.6/60:0;}
       const simulation=[f.x,f.z,f.angle,f.hp,f.stamina,f.action,f.timer].join('|');
       c.ImportedGladiator.animate(f,m,time,1/60);report.frames++;
       check(simulation===[f.x,f.z,f.angle,f.hp,f.stamina,f.action,f.timer].join('|'),type+':'+pose+' changed simulation');
      }
      const key=[type,pose,sample].join(':');m.root.updateMatrixWorld(true);const state=capture(mesh);
      for(const i of indices){
       normal(state,i,v);check(v.toArray().every(Number.isFinite)&&Math.abs(v.length()-1)<1e-6,key+' invalid finger normal '+i);
       position(state,i,v);m.root.worldToLocal(v);check(v.toArray().every(Number.isFinite)&&v.length()<3,key+' invalid finger surface '+i);report.normalSamples++;
      }
      for(const side of ['Left','Right']){
       const grip=m.grip166?.[side];if(!grip?.active)continue;const hand=m.bones[side+'Hand'];
       hand.localToWorld(v.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));const gap=v.distanceTo(grip.target);
       check(gap<.005,key+' palm gap '+gap);report.maxPalmGap=Math.max(report.maxPalmGap,gap);
      }
      report.poses++;count++;
     }
    }finally{c.ImportedGladiator.dispose(m);}
   }
   report.classes.push({type,poses:count});
  }
 }finally{c.ArenaAnatomy.prepare=original;}
 check(report.poses===types.length*poses.length*samples,'pose coverage');
 check(report.restChecks===types.length,'class rest coverage');
 check(report.cachedRestChecks===Math.max(0,types.length-1),'cached instance coverage');
 return report;
}

async function main(){
 const variants=[['arena','arena.html',{}],['war-selection','savas.html',{}],['multiplayer','multiplayer.html',{}],['ludus','ludus.html',{}],['caravan-and-pit','arena.html',{rigFile:'caravan-rig-v126.js'}]],rows=[];
 for(const [name,page,options]of variants){const c=await rigRuntime(page,options);rows.push({name,...runNormalCases(c)});}
 console.log(JSON.stringify({variants:rows,poses:rows.reduce((sum,r)=>sum+r.poses,0),restVertices:rows.reduce((sum,r)=>sum+r.restVertices,0),normalSamples:rows.reduce((sum,r)=>sum+r.normalSamples,0)},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runNormalCases};
