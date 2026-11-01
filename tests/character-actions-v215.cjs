const {rigRuntime}=require('./performance-v84.cjs');

// Inspect the final rendered attachments, after all animation and wrist layers.
function runActionCases(c,{rates=[15,30,60,120]}={}){
 const check=(ok,message)=>{if(!ok)throw Error(message);},T=c.THREE;
 const report={netChecks:0,netFrames:0,shieldCases:0,shieldFrames:0,maxShieldPalmGap:0,maxGuardCarrierShift:0};
 const a=new T.Vector3(),b=new T.Vector3(),scale=new T.Vector3();
 const rig=(type)=>{
  const m=c.ImportedGladiator.create(215,type),sim=new c.ArenaCombat(()=>.999).reset('normal',type),f=sim.fighters[0];
  Object.assign(f,{x:0,z:0,angle:.61,hp:100,action:'idle',timer:0,move:0,walk:0,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,absoluteBlockUntil:0,shieldHeldBy:null,motionVersion:163,attackLeft:false});
  return {m,f,sim};
 };
 const net=rig('retiarius');
 for(const state of [
  {action:'idle',timer:0,netBusy:false,held:true},
  {action:'netcast',timer:0,netBusy:true,held:true},
  {action:'netcast',timer:.15,netBusy:true,held:true},
  {action:'netcast',timer:.299,netBusy:true,held:true},
  {action:'netcast',timer:.3,netBusy:true,held:false},
  {action:'netcast',timer:.6,netBusy:true,held:false},
  {action:'idle',timer:0,netBusy:true,held:false},
  {action:'idle',timer:0,netBusy:false,held:true},
  {action:'netcast',timer:.12,netBusy:true,held:true},
  {action:'hurt',timer:0,netBusy:false,held:true}
 ]){
  const {held,...pose}=state;Object.assign(net.f,pose,{duration:.9});
  c.ImportedGladiator.animate(net.f,net.m,2+report.netChecks/30,1/30);
  check(net.m.gear.left.group.visible===held,'net release visibility '+JSON.stringify(state));report.netChecks++;
 }
 net.f.leftGear=null;c.ImportedGladiator.animate(net.f,net.m,3,1/30);check(!net.m.gear.left.group.visible,'dropped net is hidden');report.netChecks++;
 c.ImportedGladiator.dispose(net.m);
 // Run the real throw/return clock, so a passing pose fixture cannot hide a
 // mismatch with the release age used by the simulated projectile.
 for(const cancelled of [false,true]){
  const sim=new c.ArenaCombat(()=>.999).reset('normal','retiarius'),f=sim.fighters[0],target=sim.fighters.find(other=>other.team!==f.team),m=c.ImportedGladiator.create(215,'retiarius');
  Object.assign(f,{x:0,z:0,angle:0});for(const other of sim.fighters)if(other!==f)Object.assign(other,{x:10+other.id,z:4,stunUntil:100});Object.assign(target,{x:0,z:3});
  check(sim.throwNet(0,target.id),'real net throw starts');check(sim.nets.length===1,'one net projectile');
  for(let frame=0;frame<(cancelled?14:105);frame++){
   if(cancelled&&frame===6){f.action='hurt';f.reaction=.2;f.timer=0;f.duration=.4;}
   sim.tick(1/60,{});c.ImportedGladiator.animate(f,m,sim.time,1/60);const projectile=sim.nets.find(n=>n.owner===f.id),held=!projectile||projectile.age<.3;
   check(m.gear.left.group.visible===held,'real net lifecycle visibility '+JSON.stringify({cancelled,frame,age:projectile?.age,timer:f.timer}));report.netFrames++;
  }
  check(!f.netBusy&&sim.nets.length===0,'net returned or cancelled');c.ImportedGladiator.dispose(m);
 }
 for(const type of Object.keys(c.ArenaClasses).filter(type=>c.ArenaClasses[type].shield))for(const rate of rates)for(const state of ['idle','walk','guard','timedGuard','impact','bash','attack']){
   const {m,f,sim}=rig(type);let time=0;
   // Each case starts from a settled idle pose, then advances at its real rate.
   for(let frame=0;frame<Math.ceil(rate*.35);frame++){time+=1/rate;c.ImportedGladiator.animate(f,m,time,1/rate);}
   sim.time=time;
   if(state==='attack')check(sim.attack(0,false,'chest'),'real class attack starts');
   if(state==='bash'){
    const target=sim.fighters.find(other=>other.team!==f.team);Object.assign(target,{x:f.x,z:f.z+1.5});sim.lockedTarget=target.id;check(sim.special(0,1),'real shield bash starts');
   }
   Object.assign(f,{move:state==='walk'?1:0,blocking:state==='guard'||state==='impact',guardFlash:state==='impact'?.2:0,guardImpact:1,guardImpactX:1,guardImpactY:1,absoluteBlockUntil:state==='timedGuard'?time+2:0});
   const duration=['bash','attack'].includes(state)?f.duration:.5;
   for(let frame=0;frame<Math.ceil(rate*(duration+.25));frame++){
    time+=1/rate;f.walk+=7/rate;
    if(['bash','attack'].includes(state)){f.timer=frame/rate;if(f.timer>=duration){f.action='idle';f.timer=0;}}
    if(state==='impact')f.guardFlash=Math.max(0,.2-frame/rate);
    if(f.move){f.x+=.9/rate;f.z-=1.1/rate;}f.angle=.61+Math.sin(time)*.18;
    const before=JSON.stringify([f.x,f.z,f.hp,f.stamina,f.action,f.timer,f.netBusy]);c.ImportedGladiator.animate(f,m,time,1/rate);
    check(before===JSON.stringify([f.x,f.z,f.hp,f.stamina,f.action,f.timer,f.netBusy]),'animation mutated simulation');
    const hand=m.bones.LeftHand,palm=hand.localToWorld(a.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));
    const grip=m.gear.shield.group.localToWorld(b.set(0,0,-.075)),gap=palm.distanceTo(grip),key=[type,rate,state,frame].join(':');
    report.maxShieldPalmGap=Math.max(report.maxShieldPalmGap,gap);check(gap<.005,key+' shield left palm '+gap);
    // Offensive carry is not a collision block; active defensive coverage is.
    const guarding=f.blocking||f.guardFlash>0||f.absoluteBlockUntil>time;
    if(guarding){
     const gp=c.ArenaMotion.guardPoint(f),push=f.action==='bash'?Math.sin(Math.PI*Math.min(1,f.timer/Math.max(.01,f.duration)))*.14:0;
     const desired=m.root.localToWorld(a.set(gp.x,gp.y,gp.z+push));m.gear.shield.anchor.getWorldPosition(b);
     const shift=desired.distanceTo(b);report.maxGuardCarrierShift=Math.max(report.maxGuardCarrierShift,shift);check(shift<1e-6,key+' shield coverage changed '+shift);
    }
    for(const [,bone]of m.boneEntries)check(bone.matrixWorld.elements.every(Number.isFinite),key+' invalid bone');report.shieldFrames++;
   }
   report.shieldCases++;c.ImportedGladiator.dispose(m);
 }
 return report;
}
if(require.main===module)(async()=>{
 for(const page of (process.env.LUDUS_ACTION_PAGE?[process.env.LUDUS_ACTION_PAGE]:['arena.html','savas.html','multiplayer.html','caravan-field.html'])){
  const c=await rigRuntime(page,page==='caravan-field.html'?{rigFile:'caravan-rig-v126.js'}:{});
  console.log(JSON.stringify({page,...runActionCases(c,{rates:page==='arena.html'?[15,30,60,120]:[30]})}));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={runActionCases};
