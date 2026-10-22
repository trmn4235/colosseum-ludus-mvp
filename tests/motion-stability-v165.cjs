const assert=require('node:assert/strict'),{rigRuntime,inspectScripts}=require('./performance-v84.cjs');
async function main(){
 const c=await rigRuntime(),T=c.THREE,api=c.ArenaMotionStability,report=[];
 const transition={x:0,z:0,angle:Math.PI-.01,action:'attack',chain:1,duration:1,timer:.7,hp:100,navJump:{airborne:true}},timeline=api.createTimeline();
 timeline.beforeStep([transition],0);transition.angle=-Math.PI+.01;transition.timer=.72;
 const view=timeline.read(transition,1/60,.5,1/60);assert.ok(Math.abs(view.angle-Math.PI)<1e-8);assert.equal(view.timer,.71);
 delete transition.navJump;transition.action='idle';transition.timer=0;
 assert.equal(timeline.read(transition,1/60,.5,1/60).navJump,undefined);assert.equal(view.timer,0,'A new action must not reuse the old attack time');
 assert.equal(transition.angle,-Math.PI+.01,'Rendering never mutates combat');
 // A constant walk must not stop on alternate display frames at 120 Hz.
 for(const rate of [30,60,120,'variable'])for(const interpolate of [false,true]){
  const f=new c.ArenaCombat(()=>.999).reset('normal','hoplomachus').fighters[0],m=c.ImportedGladiator.create(0,'hoplomachus'),timeline=api.createTimeline();
  Object.assign(f,{x:0,z:0,angle:0,action:'idle',move:1,weapon:'trident',shield:true,helmet:true,chest:true,shoulders:true});
  let time=0,remainder=0,last=0,maxSpeedError=0,zeroFrames=0,frames=0;
  for(let n=0;n<360;n++){
   const dt=rate==='variable'?[1/120,1/90,1/60,1/144][n%4]:1/rate;remainder+=dt;
   while(remainder+1e-10>=1/60){timeline.beforeStep([f],time);f.z+=2/60;f.walk+=7/60;time+=1/60;remainder=Math.max(0,remainder-1/60);}
   const visual=interpolate?timeline.read(f,time,remainder*60,1/60):f;
   c.ImportedGladiator.animate(visual,m,time-(interpolate?(1-remainder*60)/60:0),dt);
   const speed=(m.root.position.z-last)/dt;if(n>30){maxSpeedError=Math.max(maxSpeedError,Math.abs(speed-2));if(speed<.001)zeroFrames++;frames++;}
   last=m.root.position.z;
  }
  if(interpolate){assert.ok(maxSpeedError<1e-8,JSON.stringify({rate,maxSpeedError}));assert.equal(zeroFrames,0);assert.ok(m.locomotionWeight>.999);}
  report.push({rate,interpolate,frames,zeroFrames,maxSpeedError});c.ImportedGladiator.dispose(m);
 }
 // Every renderer uses the same anatomical hand limits, without shifting gear.
 let wristFrames=0,maxAttachmentShift=0,maxSwing=0;
 for(const page of ['arena.html','savas.html','multiplayer.html','caravan-field.html','ludus.html']){
  const r=page==='arena.html'?c:await rigRuntime(page,page==='caravan-field.html'?{rigFile:'caravan-rig-v126.js'}:{}),T=r.THREE,normal=r.ArenaMotionStability.wrists;
  r.ArenaMotionStability.wrists=(f,m)=>{
   const anchors=[m.weaponAnchor,m.offhandAnchor,m.gear.shield?.anchor].filter(Boolean),before=anchors.map(a=>({p:a.getWorldPosition(new T.Vector3()),q:a.getWorldQuaternion(new T.Quaternion())}));
   normal(f,m);
   anchors.forEach((a,i)=>{const shift=a.getWorldPosition(new T.Vector3()).distanceTo(before[i].p);maxAttachmentShift=Math.max(maxAttachmentShift,shift);assert.ok(shift<1e-7);const angle=a.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(before[i].q.normalize());assert.ok(angle<1e-5,JSON.stringify({page,action:f.action,weapon:f.weapon,i,angle,shift}));});
   for(const side of ['Left','Right']){
    const h=m.bones[side+'Hand'],axis=m.bones[side+'HandIndex1'].position.clone().normalize(),delta=m.bones.RightHand.userData.anatomy166?h.quaternion.clone():m.rest.get(side+'Hand').q.clone().invert().multiply(h.quaternion),direction=axis.clone().applyQuaternion(delta),angle=axis.angleTo(direction);
    maxSwing=Math.max(maxSwing,angle);assert.ok(angle<=Math.PI/5+1e-6,`${page}: bent ${side} wrist ${angle}`);
   }
   wristFrames++;
  };
  for(const weapon of ['trident','spear','gladius']){
   const sim=new r.ArenaCombat(()=>.999).reset('normal','murmillo'),f=sim.fighters[0],m=r.ImportedGladiator.create(0,'murmillo');
   Object.assign(f,{x:0,z:0,angle:0,weapon,shield:true,helmet:true,chest:true,shoulders:true,cooldown:0});
   for(const action of ['idle','attack','guard','dodge']){
    f.action='idle';f.cooldown=0;f.stamina=100;f.blocking=action==='guard';f.reaction=0;
    if(action==='attack')sim.attack(0,false,'head');if(action==='dodge'){f.action='dodge';f.duration=.46;}
    for(let n=0;n<50;n++){f.timer=n/120;r.ImportedGladiator.animate(f,m,n/120,1/120);}
   }
   r.ImportedGladiator.dispose(m);
  }
  r.ArenaMotionStability.wrists=normal;
 }
 inspectScripts();console.log(JSON.stringify({walking:report,wristFrames,maxSwingDegrees:maxSwing*180/Math.PI,maxAttachmentShift}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
