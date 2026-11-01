const {rigRuntime}=require('./performance-v84.cjs');

// Exercise the actual animation layers, including moving manual/timed guards.
function runGuardCases(c,{rates=[15,30,60,120],directions=8,weapons=['gladius','sica','spear','trident'],classes=['murmillo'],classLoadout=false}={}){
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const report={scenarios:0,frames:0,maxGuardLayers:0,maxLowerBodyChange:0,minFootGap:Infinity,maxPalmGap:0};
 const lower=['Hips','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'];
 const legacy=c.QuaterniusMotion.apply,authored=c.ArenaAuthoredMotion.apply;
 let frameLayers=0;
 c.QuaterniusMotion.apply=function(...args){const used=legacy.apply(this,args);if(used)frameLayers++;return used;};
 c.ArenaAuthoredMotion.apply=function(f,m,time){
  const moving=f.action==='idle'&&(f.blocking||f.absoluteBlockUntil>time)&&m.locomotionWeight>.005;
  const before=moving?lower.map(key=>m.bones[key].matrixWorld.elements.slice()):null;
  const used=authored.call(this,f,m,time);if(used)frameLayers++;
  if(before)for(let n=0;n<lower.length;n++)for(let i=0;i<16;i++)report.maxLowerBodyChange=Math.max(report.maxLowerBodyChange,Math.abs(before[n][i]-m.bones[lower[n]].matrixWorld.elements[i]));
  return used;
 };
 try{
  const T=c.THREE,a=new T.Vector3(),b=new T.Vector3(),scale=new T.Vector3();
  for(const type of classes)for(const rate of rates)for(let dir=0;dir<directions;dir++)for(const weapon of weapons)for(const timed of [false,true]){
   const m=c.ImportedGladiator.create(214,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];
   Object.assign(f,{x:0,z:0,angle:.37,hp:100,action:'idle',move:1,weapon,offhand:null,shield:classLoadout?!!c.ArenaClasses[type].shield:true,shieldStyle:classLoadout?type:'murmillo',chest:true,helmet:true,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,shieldHeldBy:null,motionVersion:163,attackLeft:false,absoluteBlockUntil:0});
   const dt=1/rate,heading=dir*Math.PI/4+f.angle,key=[type,rate,dir,weapon,timed].join(':');let time=0;
   const step=guard=>{
    time+=dt;f.x+=Math.sin(heading)*1.6*dt;f.z+=Math.cos(heading)*1.6*dt;f.walk+=7*dt;f.blocking=guard&&!timed;f.absoluteBlockUntil=guard&&timed?time+1:0;
    const state=[f.x,f.z,f.hp,f.stamina,f.action,f.timer].join('|');frameLayers=0;c.ImportedGladiator.animate(f,m,time,dt);report.frames++;
    check(state===[f.x,f.z,f.hp,f.stamina,f.action,f.timer].join('|'),key+' simulation changed');
    if(guard){report.maxGuardLayers=Math.max(report.maxGuardLayers,frameLayers);check(frameLayers===1,key+' guard layers '+frameLayers);check(report.maxLowerBodyChange<1e-8,key+' guard overwrites walking legs '+report.maxLowerBodyChange);}
    for(const [,bone]of m.boneEntries)check(bone.matrixWorld.elements.every(Number.isFinite),key+' non-finite bone');
    if(time>.3){
     const left=m.root.worldToLocal(m.bones.LeftFoot.getWorldPosition(a)),right=m.root.worldToLocal(m.bones.RightFoot.getWorldPosition(b));
     const gap=left.x-right.x;report.minFootGap=Math.min(report.minFootGap,gap);check(gap>.045,key+' crossed feet '+gap);check(Math.min(left.y,right.y)>.015,key+' foot below ground');
    }
    for(const side of ['Left','Right']){const state=m.grip166?.[side];if(!state?.active)continue;const hand=m.bones[side+'Hand'];hand.localToWorld(a.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));const gap=a.distanceTo(state.target);report.maxPalmGap=Math.max(report.maxPalmGap,gap);check(gap<.005,key+' palm gap '+gap);}
   };
   for(let i=0;i<Math.ceil(rate*.2);i++)step(false);
   for(let i=0;i<Math.ceil(rate*.8);i++)step(true);
   for(let i=0;i<Math.ceil(rate*.2);i++)step(false);
   c.ImportedGladiator.dispose(m);report.scenarios++;
  }
 }finally{c.QuaterniusMotion.apply=legacy;c.ArenaAuthoredMotion.apply=authored;}
 return report;
}
if(require.main===module)rigRuntime().then(c=>console.log(JSON.stringify(runGuardCases(c),null,2))).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={runGuardCases};
