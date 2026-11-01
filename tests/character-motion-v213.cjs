const {rigRuntime}=require('./performance-v84.cjs');
// The same scenario runner is also executed against real browser-loaded assets.
function runMotionCases(c,{rates=[15,30,60,120],directions=8,hands=[false,true]}={}){
 const check=(yes,message)=>{if(!yes)throw Error(message);};
 const report={scenarios:0,frames:0,minFootGap:Infinity,maxPalmGap:0,maxEntryBodyStep:0,maxRootError:0,minAttackBodyY:Infinity,phaseByRate:[]};
 const T=c.THREE,a=new T.Vector3(),b=new T.Vector3(),scale=new T.Vector3();
 for(const rate of rates)for(let dir=0;dir<directions;dir++)for(const weapon of ['gladius','spear','trident'])for(const left of hands){
  const m=c.ImportedGladiator.create(213,'murmillo'),f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
  Object.assign(f,{x:0,z:0,angle:.37,hp:100,action:'idle',move:1,weapon,offhand:left?weapon:null,shield:false,chest:true,helmet:true,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,shieldHeldBy:null,motionVersion:163,attackLeft:left});
  const heading=dir*Math.PI/4+f.angle,key=[rate,dir,weapon,left].join(':'),dt=1/rate;let time=0;
  function pose(stage){
   const before=[f.x,f.z,f.angle,f.hp,f.stamina,f.action,f.timer].join('|');c.ImportedGladiator.animate(f,m,time,dt);report.frames++;
   check(before===[f.x,f.z,f.angle,f.hp,f.stamina,f.action,f.timer].join('|'),key+' simulation changed');
   for(const [,bone]of m.boneEntries)check(bone.matrixWorld.elements.every(Number.isFinite),key+' non-finite bone');
   report.maxRootError=Math.max(report.maxRootError,Math.hypot(f.x-m.root.position.x,f.z-m.root.position.z));
   for(const side of ['Left','Right']){
    const state=m.grip166?.[side];if(!state?.active)continue;
    const hand=m.bones[side+'Hand'];hand.localToWorld(a.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));const gap=a.distanceTo(state.target);
    report.maxPalmGap=Math.max(report.maxPalmGap,gap);check(gap<.005,key+' '+stage+' palm gap '+gap);
   }
   if(stage==='walk'&&time>.3){
    const leftFoot=m.root.worldToLocal(m.bones.LeftFoot.getWorldPosition(a)),rightFoot=m.root.worldToLocal(m.bones.RightFoot.getWorldPosition(b)),gap=leftFoot.x-rightFoot.x;
    report.minFootGap=Math.min(report.minFootGap,gap);check(gap>.045,key+' crossed feet '+gap);
    check(Math.min(leftFoot.y,rightFoot.y)>.02,key+' foot below ground');
   }
  }
  pose('start');
  for(let n=0;n<Math.round(rate*1.2);n++){time+=dt;f.x+=Math.sin(heading)*2*dt;f.z+=Math.cos(heading)*2*dt;f.walk+=7*dt;pose('walk');}
  if(dir===4&&weapon==='spear'&&!left)report.phaseByRate.push({rate,phase:m.locomotionPhase});
  const previousBody=m.body.position.y;Object.assign(f,{action:'attack',timer:0,move:0,attackWeapon:weapon,attackKind:'light',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(weapon)});f.duration=f.attackProfile.duration;
  for(let n=0;n<=Math.ceil(f.duration*rate);n++){time+=dt;f.timer=Math.min(f.duration,n*dt);pose('attack');if(!n)report.maxEntryBodyStep=Math.max(report.maxEntryBodyStep,Math.abs(m.body.position.y-previousBody));report.minAttackBodyY=Math.min(report.minAttackBodyY,m.body.position.y);}
  Object.assign(f,{action:'idle',timer:0,move:1});
  for(let n=0;n<Math.ceil(rate*.35);n++){time+=dt;f.x-=Math.sin(heading)*dt;f.z-=Math.cos(heading)*dt;f.walk+=dt*5;pose('resume');}
  Object.assign(f,{blocking:true,move:0});for(let n=0;n<Math.ceil(rate*.15);n++){time+=dt;pose('guard');}
  c.ImportedGladiator.dispose(m);report.scenarios++;
 }
 check(report.maxRootError<1e-7,'render root diverged');check(report.minAttackBodyY>=-.55,'excessive attack crouch');check(report.maxEntryBodyStep<.20,'attack entry jumps');
 const phases=report.phaseByRate.map(x=>x.phase);check(Math.max(...phases)-Math.min(...phases)<.005,'distance-based cadence changed with frame rate');
 return report;
}
if(require.main===module)rigRuntime().then(c=>console.log(JSON.stringify(runMotionCases(c),null,2))).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runMotionCases};
