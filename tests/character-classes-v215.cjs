const {rigRuntime}=require('./performance-v84.cjs');

// Exercise each class's real loadout through movement, guard, attack and recovery.
// The same runner is used with decoded model textures in browser verification.
function runClassCases(c,{rates=[15,30,60,120],directions=8,kinds=['light','heavy'],types=Object.keys(c.ArenaClasses)}={}){
 const check=(ok,message)=>{if(!ok)throw Error(message);},T=c.THREE;
 const a=new T.Vector3(),b=new T.Vector3(),scale=new T.Vector3();
 const report={classes:[],scenarios:0,frames:0,minFootGap:Infinity,maxPalmGap:0,maxShoulderShift:0,maxRootError:0};
 for(const type of types){
  const row={type,scenarios:0,maxPalmGap:0};
  for(const rate of rates)for(let direction=0;direction<directions;direction++)for(const kind of kinds){
   const m=c.ImportedGladiator.create(215,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];
   Object.assign(f,{x:0,z:0,angle:.37,hp:100,action:'idle',move:1,motionVersion:163,blocking:false,absoluteBlockUntil:0,reaction:0,guardFlash:0,passiveEvade:0,shieldHeldBy:null,timer:0});
   const dt=1/rate,heading=direction*2*Math.PI/directions+f.angle,key=[type,rate,direction,kind].join(':');let time=0;
   const frame=stage=>{
    time+=dt;
    if(f.move){f.x+=Math.sin(heading)*1.6*dt;f.z+=Math.cos(heading)*1.6*dt;f.walk+=7*dt;}
    const simulation=[f.x,f.z,f.angle,f.hp,f.stamina,f.action,f.timer].join('|');
    c.ImportedGladiator.animate(f,m,time,dt);report.frames++;
    check(simulation===[f.x,f.z,f.angle,f.hp,f.stamina,f.action,f.timer].join('|'),key+' changed simulation');
    check(m.grip166?.Right?.active,key+' missing main weapon grip');
    if(f.leftGear==='scissor')check(m.grip166?.Left?.active,key+' missing Scissor grip');
    if(f.shield&&f.blocking)check(m.grip166?.Left?.active,key+' missing shield guard grip');
    for(const [,bone]of m.boneEntries)check(bone.matrixWorld.elements.every(Number.isFinite),key+' invalid bone');
    report.maxRootError=Math.max(report.maxRootError,Math.hypot(f.x-m.root.position.x,f.z-m.root.position.z));
    for(const side of ['Left','Right']){
     const state=m.grip166?.[side];if(!state?.active)continue;
     const hand=m.bones[side+'Hand'],arm=m.bones[side+'Arm'];
     hand.localToWorld(a.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));
     const gap=a.distanceTo(state.target);row.maxPalmGap=Math.max(row.maxPalmGap,gap);report.maxPalmGap=Math.max(report.maxPalmGap,gap);
     check(gap<.005,key+' '+stage+' '+side+' palm gap '+gap+' timer '+f.timer);
     const shift=arm.getWorldPosition(a).distanceTo(arm.parent.localToWorld(b.copy(arm.userData.anatomyRestPosition)));
     report.maxShoulderShift=Math.max(report.maxShoulderShift,shift);check(shift<.02501,key+' shoulder displacement '+shift);
    }
    if(stage==='walk'&&time>.3){
     const left=m.root.worldToLocal(m.bones.LeftFoot.getWorldPosition(a)),right=m.root.worldToLocal(m.bones.RightFoot.getWorldPosition(b)),gap=left.x-right.x;
     report.minFootGap=Math.min(report.minFootGap,gap);check(gap>.045,key+' crossed feet');check(Math.min(left.y,right.y)>.015,key+' feet below ground');
    }
   };
   try{
    for(let n=0;n<Math.ceil(rate*.5);n++)frame('walk');
    f.blocking=true;for(let n=0;n<Math.ceil(rate*.2);n++)frame('moving guard');
    Object.assign(f,{blocking:false,move:0,action:'attack',timer:0,attackLeft:false,attackWeapon:f.weapon,attackKind:kind,attackRegion:'chest',attackProfile:c.ArenaMotion.profile(f.weapon,kind==='heavy',f.id!==0)});
    f.duration=f.attackProfile.duration;
    for(let n=0;n<=Math.ceil(rate*f.duration);n++){f.timer=Math.min(f.duration,n*dt);frame('attack');}
    Object.assign(f,{action:'idle',timer:0,move:1});
    for(let n=0;n<Math.ceil(rate*.25);n++)frame('recovery');
   }finally{c.ImportedGladiator.dispose(m);}
   row.scenarios++;report.scenarios++;
  }
  report.classes.push(row);
 }
 check(report.maxRootError<1e-7,'render root diverged');
 check(report.scenarios===types.length*rates.length*directions*kinds.length,'class coverage');
 return report;
}
if(require.main===module)rigRuntime().then(c=>console.log(JSON.stringify(runClassCases(c),null,2))).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={runClassCases};
