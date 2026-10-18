const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {rigRuntime,inspectScripts}=require('./performance-v84.cjs');
async function main(){
 inspectScripts();const c=await rigRuntime(),T=c.THREE;
 const source=fs.readFileSync('arena.html','utf8'),start=source.indexOf('function animateCharacter('),end=source.indexOf('// Reusable rope',start);
 c.combat={fighters:[{x:0,z:0}]};c.naval=null;c.GamePerformance={characterShadows(){}};vm.runInContext(source.slice(start,end),c);
 let deaths=0;
 for(const type of Object.keys(c.ArenaClasses))for(const hidden of [false,true]){
  const m=c.ImportedGladiator.create(1,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[1];
  Object.assign(f,{id:1,x:12,z:0,action:'idle',move:0});c.animateCharacter(f,m,0,1/60);
  f.hp=0;f.action='down';f.deadTime=0;m.root.visible=!hidden;
  for(let n=1;n<=300;n++){f.deadTime=n/60;c.animateCharacter(f,m,n/60,1/60);}
  if(hidden){assert.ok(!m.corpseSettled);m.root.visible=true;for(let n=0;n<6;n++)c.animateCharacter(f,m,5+n/60,1/60);}
  assert.equal(m.corpseSettled,true,`${type} hidden=${hidden}: final pose must settle`);
  m.root.updateMatrixWorld(true);const head=m.bones.Head.getWorldPosition(new T.Vector3());assert.ok(head.y<.7,`${type}: corpse head still upright at ${head.y}`);
  const pose=m.bones.Head.matrixWorld.toArray();for(let n=0;n<60;n++){f.deadTime+=1/60;c.animateCharacter(f,m,6+n/60,1/60);m.root.updateMatrixWorld(true);}assert.deepEqual(m.bones.Head.matrixWorld.toArray(),pose);
  c.ImportedGladiator.dispose(m);deaths++;
 }
 const scene=new T.Scene(),batch=new c.ArenaRuntime.DropBatch(T,scene),drops=Array.from({length:17},(_,i)=>({id:i+1,kind:'gladius',x:i*.1,z:-i*.2})),template=()=>c.ClassEquipment.weapon('gladius');
 const originals=[];for(const d of drops){const o=template(d).clone(true);o.rotation.set(Math.PI/2,d.id*.71,0);o.position.set(d.x,.16,d.z);o.updateMatrixWorld(true);o.traverseVisible(m=>{if(m.isMesh)originals.push({g:m.geometry,m:m.matrixWorld.clone()});});}
 batch.update(drops,template,true);let instances=0;for(const mesh of batch.meshes){instances+=mesh.count;for(let i=0;i<mesh.count;i++){const mat=new T.Matrix4();mesh.getMatrixAt(i,mat);assert.ok(originals.some(o=>o.g===mesh.geometry&&o.m.elements.every((v,k)=>Math.abs(v-mat.elements[k])<1e-6)));}}
 assert.equal(instances,originals.length);assert.ok(batch.meshes.length<originals.length/5);const stable=batch.meshes[0];batch.update(drops,()=>{throw Error('unchanged loot must not rebuild');},true);assert.equal(batch.meshes[0],stable);
 batch.update(drops.slice(1),template,true);assert.equal(batch.meshes.reduce((n,m)=>n+m.count,0),originals.length*16/17);batch.clear();assert.equal(scene.children.length,0);
 c.localStorage={getItem:()=> 'right'};vm.runInContext(fs.readFileSync('arena-perspective-v101.js','utf8'),c);assert.equal(c.ArenaPerspective.load(),'right');
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const pitch of [.2,.57,.85]){const f={x:2,z:3,navHeight:.8},v=c.ArenaPerspective.shoulder(f,yaw,pitch),right=(v.pos.x-f.x)*Math.cos(yaw)-(v.pos.z-f.z)*Math.sin(yaw);assert.ok(Math.abs(right-.72)<1e-8);assert.ok(Object.values(v.pos).every(Number.isFinite));assert.ok(v.pos.y>1.5);}
 console.log(JSON.stringify({deathScenarios:deaths,lootMeshesBefore:originals.length,lootDrawBatches:stable.count?originals.length/17:0,camera:'right shoulder persisted; four headings and three pitches',scripts:'all parsed'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
