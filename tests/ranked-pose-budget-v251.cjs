// CPU-only real gladiator rigs, placeholder textures and procedural equipment.
const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const {rigRuntime}=require('./performance-v84.cjs'),motion=require('../multiplayer-motion-v251.js');
async function main(){
 const c=await rigRuntime('multiplayer.html',{skipEquipment:true}),models=[],fighters=[];
 for(let i=0;i<10;i++){
  const f=new c.ArenaCombat().reset('normal','murmillo').fighters[0];
  Object.assign(f,{id:i,team:i<5?0:1,x:i-5,z:i<5?-3:3,angle:0,move:1,action:'idle',hp:100});fighters.push(f);models.push(c.ImportedGladiator.create(i,'murmillo'));
 }
 function run(limited){let poses=0;const next=Array(10).fill(0),last=Array(10).fill(0),start=performance.now();
  for(let frame=0;frame<60;frame++)for(let i=0;i<10;i++){
   const f=fighters[i],m=models[i],time=frame*1000/60;f.walk+=7/60;f.x+=.01;
   const interval=motion.poseInterval(limited,i===0,i<5,3);
   if(interval!==Infinity&&time>=next[i]){c.ImportedGladiator.animate(f,m,time/1000,frame?Math.min(.25,(time-last[i])/1000):1/60);next[i]=time+interval;last[i]=time;poses++;}
   else{m.root.position.set(f.x,0,f.z);m.root.rotation.y=f.angle;}
  }
  return {poses,ms:Math.round(performance.now()-start)};
 }
 const baseline=run(false),limited=run(true);assert.equal(baseline.poses,600);assert.ok(limited.poses<200,'the crowded mobile match must use substantially fewer full rig poses');
 for(let i=0;i<10;i++)assert.ok(Math.abs(models[i].root.position.x-fighters[i].x)<1e-6,'all world positions remain current');
 console.log('PASS V251: 10 real rigs, one second of simulated frames: '+baseline.poses+' → '+limited.poses+' full poses; CPU '+baseline.ms+' → '+limited.ms+' ms (not a phone FPS measurement).');
}
main().catch(e=>{console.error(e);process.exitCode=1});
