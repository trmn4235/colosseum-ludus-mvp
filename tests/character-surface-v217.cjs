/* Sampled two-way geometric surface error after actual runtime skinning.
 * Merging is disabled equally in both rigs to identify clothing/shoe meshes;
 * bone setup, anatomy corrections and animation are the production code.
 * This is a bounded sample, not an exhaustive Hausdorff or phone/GPU test.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {rigRuntime}=require('./performance-v84.cjs'),{compareAssets}=require('./character-asset-v217.cjs');
const {read}=require('../tools/retopo-character-v214.cjs');
const root=path.resolve(__dirname,'..'),sampleCount=96,maxDistance=.01;
function select(items,count=sampleCount){return items.filter((_,i)=>i%Math.max(1,Math.ceil(items.length/count))===0);}
function tree(T,points,indices){
 const triangles=[];
 for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],min=[0,1,2].map(k=>Math.min(...ids.map(v=>points[v*3+k]))),max=[0,1,2].map(k=>Math.max(...ids.map(v=>points[v*3+k])));triangles.push({ids,min,max,center:min.map((v,k)=>(v+max[k])*.5)});}
 function build(list){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of list)for(let k=0;k<3;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}
  if(list.length<=12)return {min,max,list};
  let axis=0;for(let k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;
  list.sort((a,b)=>a.center[axis]-b.center[axis]);const middle=list.length>>1;
  return {min,max,left:build(list.slice(0,middle)),right:build(list.slice(middle))};
 }
 const root=build(triangles),tri=new T.Triangle(),nearest=new T.Vector3();
 const boxDistance=(node,p)=>[p.x,p.y,p.z].reduce((sum,x,k)=>sum+Math.max(node.min[k]-x,0,x-node.max[k])**2,0);
 return point=>{
  let best=Infinity;
  function visit(node){
   if(boxDistance(node,point)>best)return;
   if(node.list){for(const t of node.list){tri.a.fromArray(points,t.ids[0]*3);tri.b.fromArray(points,t.ids[1]*3);tri.c.fromArray(points,t.ids[2]*3);tri.closestPointToPoint(point,nearest);best=Math.min(best,nearest.distanceToSquared(point));}return;}
   const left=boxDistance(node.left,point),right=boxDistance(node.right,point);if(left<=right){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}
  }
  visit(root);return Math.sqrt(best);
 };
}
function meshPoints(T,mesh){
 mesh.skeleton.update();const p=new T.Vector3(),out=new Float64Array(mesh.geometry.attributes.position.count*3);
 for(let i=0;i<out.length/3;i++){p.fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);assert.ok(p.toArray().every(Number.isFinite),'finite skinned point');p.toArray(out,i*3);}
 return out;
}
async function main(){
 const {mapping}=compareAssets({integration:false}),json=read(root+'/gladiator-mobile-v214.glb').json,names=new Map(json.nodes.filter(n=>n.mesh!==undefined).map(n=>[n.name,json.meshes[n.mesh].name])),c=await rigRuntime(),T=c.THREE;
 const html=fs.readFileSync(root+'/arena.html','utf8'),graphics=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('var ImportedGladiator='))[1];
 const start=graphics.indexOf('var ImportedGladiator='),end=graphics.indexOf('})();',graphics.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};',start))+5;
 const source=graphics.slice(start,end),rigs=[];
 for(const version of [214,217]){const rig=vm.runInContext('(function(){'+source.replaceAll(/gladiator-mobile-v\d+\.glb/g,'gladiator-mobile-v'+version+'.glb')+';return ImportedGladiator;})()',c);await rig.load(()=>{});rigs.push(rig);}
 c.ArenaRuntime.optimizeRig=()=>{};
 const poses=['idle','forward','backward','side','guard-back','heavy','dodge','fall'],types=process.env.LUDUS_V217_SURFACE_ONE==='1'?['murmillo']:Object.keys(c.ArenaClasses),rows=[];
 let totalSamples=0,maxError=0,maxRetainedError=0,maxBoneError=0,height=0;
 for(const type of types)for(const pose of poses){
  const models=rigs.map(r=>r.create(217,type)),fighters=models.map(()=>new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0]);
  try{
   if(!height){const box=new T.Box3().setFromObject(models[0].visual);height=box.max.y-box.min.y;}
   const walking=['forward','backward','side','guard-back'].includes(pose);
   for(const f of fighters){Object.assign(f,{x:0,z:0,angle:0,hp:pose==='fall'?0:100,action:pose==='heavy'?'attack':pose==='dodge'?'dodge':pose==='fall'?'down':'idle',timer:0,deadTime:0,walk:0,move:walking?1:0,motionVersion:163,blocking:pose==='guard-back',reaction:0,guardFlash:0,passiveEvade:0,attackLeft:false,attackWeapon:f.weapon,attackKind:'heavy',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(f.weapon,true)});f.duration=pose==='dodge'?.46:f.attackProfile.duration;}
   for(let n=0;n<30;n++)for(let j=0;j<2;j++){
    const f=fighters[j],progress=(n+1)/30;f.timer=pose==='heavy'?f.duration*.55*progress:pose==='dodge'?.27*progress:0;f.deadTime=pose==='fall'?.9*progress:0;
    if(walking){f.walk+=7/60;f.x+=pose==='side'?1.6/60:0;f.z+=pose==='forward'?1.6/60:pose==='side'?0:-1.6/60;}
    rigs[j].animate(f,models[j],(n+1)/60,1/60);
   }
   for(const m of models)m.root.updateMatrixWorld(true);
   for(const [name,bone]of models[0].boneEntries)for(let k=0;k<16;k++)maxBoneError=Math.max(maxBoneError,Math.abs(bone.matrixWorld.elements[k]-models[1].bones[name].matrixWorld.elements[k]));
   assert.ok(maxBoneError<1e-7,'asset change altered actual bone poses');
   const meshes=models.map(m=>{const result={};m.visual.traverse(o=>{const name=names.get(o.name);if(o.isSkinnedMesh&&mapping[name])result[name]=o;});return result;});
   assert.equal(Object.keys(meshes[0]).length,2,'identify both original surface meshes');assert.equal(Object.keys(meshes[1]).length,2);
   for(const name of Object.keys(mapping)){
    const points=meshes.map(m=>meshPoints(T,m[name])),indices=meshes.map(m=>m[name].geometry.index.array),nearest=points.map((p,i)=>tree(T,p,indices[i]));
    const row={type,pose,mesh:name,samples:0,maxDistance:0,sumSquares:0},p=new T.Vector3(),q=new T.Vector3();
    for(let v=0;v<mapping[name].toOriginal.length;v++){p.fromArray(points[0],mapping[name].toOriginal[v]*3);q.fromArray(points[1],v*3);maxRetainedError=Math.max(maxRetainedError,p.distanceTo(q));}
    assert.ok(maxRetainedError<.000002,'retained posed vertices moved');
    const add=(side,point)=>{const distance=nearest[1-side](point);assert.ok(Number.isFinite(distance));row.samples++;row.maxDistance=Math.max(row.maxDistance,distance);row.sumSquares+=distance*distance;};
    for(const v of select(mapping[name].removed))add(0,p.fromArray(points[0],v*3));
    for(let side=0;side<2;side++)for(const t of select(Array.from({length:indices[side].length/3},(_,i)=>i))){p.set(0,0,0);for(let k=0;k<3;k++)p.add(q.fromArray(points[side],indices[side][t*3+k]*3));add(side,p.multiplyScalar(1/3));}
    row.rmsDistance=Math.sqrt(row.sumSquares/row.samples);delete row.sumSquares;
    assert.ok(row.maxDistance<maxDistance,`${type}:${pose}:${name} sampled error ${row.maxDistance} m exceeds ${maxDistance} m`);
    totalSamples+=row.samples;maxError=Math.max(maxError,row.maxDistance);rows.push(row);
   }
  }finally{models.forEach((m,i)=>rigs[i].dispose(m));}
 }
 const report={classes:types.length,poses:types.length*poses.length,surfaceComparisons:rows.length,samples:totalSamples,bodyHeight:height,maxDistanceLimit:maxDistance,maxSampledDistance:maxError,maxSampledFractionOfHeight:maxError/height,maxRetainedVertexDistance:maxRetainedError,maxBoneMatrixDifference:maxBoneError,note:'Deterministic removed-vertex and both triangle-centroid samples against the complete opposite posed surface; not an exhaustive surface bound or physical-device rendering test.',rows};
 if(process.env.LUDUS_SURFACE_OUTPUT)fs.writeFileSync(process.env.LUDUS_SURFACE_OUTPUT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,rows:undefined},null,2));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
