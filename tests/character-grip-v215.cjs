const {rigRuntime}=require('./performance-v84.cjs');

// Compare actual equipment handle points with the rendered palm after all
// animation layers. Checking only the IK target misses a weapon left at the wrist.
function runGripCases(c,{rates=[15,30,60,120]}={}){
 const check=(ok,message)=>{if(!ok)throw Error(message);},T=c.THREE;
 const a=new T.Vector3(),b=new T.Vector3(),scale=new T.Vector3();
 const report={scenarios:0,frames:0,contacts:0,scissorContacts:0,pickupChecks:0,sicaFrames:0,maxHandleGap:0,maxScissorGap:0,maxWristSwing:0,maxShoulderShift:0};
 function contact(m,left,kind,key){
  const hand=m.bones[(left?'Left':'Right')+'Hand'],state=m.grip166?.[left?'Left':'Right'],anchor=left?m.offhandAnchor:m.weaponAnchor;
  hand.localToWorld(a.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));
  const offset=['spear','trident','trident_gladiator','halberd'].includes(kind)?-.16:anchor.children[0]?.userData.asset==='roman_spatha.glb'?-.065:0;
  anchor.localToWorld(b.set(0,offset,0));
  const gap=a.distanceTo(b);report.maxHandleGap=Math.max(report.maxHandleGap,gap);report.contacts++;
  check(gap<.005,key+' handle left palm '+gap);check(state?.active,key+' missing carried weapon grip');
 }
 function scissor(m,key){
  const hand=m.bones.LeftHand;
  hand.localToWorld(a.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));
  m.gear.left.group.localToWorld(b.set(0,-.075,.025));
  const gap=a.distanceTo(b);report.maxScissorGap=Math.max(report.maxScissorGap,gap);report.scissorContacts++;
  check(m.grip166?.Left?.active,key+' missing Scissor grip');check(gap<1e-5,key+' Scissor sleeve left palm '+gap);
  // The sleeve extends back over the forearm; its blade remains beyond the hand.
  const cuff=m.gear.left.group.localToWorld(a.set(0,.2,0)),wrist=hand.getWorldPosition(b),axis=m.bones.LeftForeArm.getWorldPosition(scale).sub(wrist);
  check(cuff.sub(wrist).dot(axis)>0,key+' reversed Scissor sleeve');
 }
 for(const type of Object.keys(c.ArenaClasses))for(const rate of rates){
  const m=c.ImportedGladiator.create(215,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];
  Object.assign(f,{x:0,z:0,angle:.61,hp:100,motionVersion:163,action:'idle',timer:0,move:0,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,absoluteBlockUntil:0,shieldHeldBy:null});
  let time=0;const dt=1/rate,draw=()=>{
   time+=dt;const key=[type,rate,f.action,f.timer.toFixed(4)].join(':'),before=JSON.stringify([f.x,f.z,f.hp,f.stamina,f.action,f.timer]);
   c.ImportedGladiator.animate(f,m,time,dt);report.frames++;
   check(before===JSON.stringify([f.x,f.z,f.hp,f.stamina,f.action,f.timer]),key+' changed simulation');contact(m,false,f.weapon,key);
   if(f.leftGear==='scissor')scissor(m,key);
   for(const [,bone]of m.boneEntries)check(bone.matrixWorld.elements.every(Number.isFinite),key+' non-finite bone');
  };
  try{
   const special=type==='retiarius'?'netcast':type==='scissor'?'hook':'bash';
   for(const action of ['idle',special,'idle','hurt','idle']){
    Object.assign(f,{action,timer:0,duration:action==='netcast'?.9:.55,reaction:action==='hurt'?.2:0,netBusy:action==='netcast',attackLeft:action==='hook'});
    const duration=action==='idle'?.3:f.duration;
    for(let n=0;n<=Math.ceil(rate*duration);n++){f.timer=Math.min(duration,n*dt);if(action==='hurt')f.reaction=Math.max(0,.2-f.timer);draw();}
   }
  }finally{c.ImportedGladiator.dispose(m);}
  report.scenarios++;
 }
 // A valid dual loadout retains the inactive weapon through either hand's attack.
 for(const rate of rates)for(const attackingLeft of [false,true]){
  const m=c.ImportedGladiator.create(215,'scissor'),f=new c.ArenaCombat(()=>.999).reset('normal','scissor').fighters[0];
  Object.assign(f,{x:0,z:0,angle:-.73,hp:100,motionVersion:163,weapon:'gladius',offhand:'sica',shield:false,leftGear:null,action:'idle',timer:0,move:0,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,absoluteBlockUntil:0,shieldHeldBy:null});
  let time=0;const dt=1/rate;
  try{
   for(let n=0;n<Math.ceil(rate*.3);n++){time+=dt;c.ImportedGladiator.animate(f,m,time,dt);}
   Object.assign(f,{action:'attack',attackLeft:attackingLeft,attackWeapon:attackingLeft?f.offhand:f.weapon,attackKind:'light',attackRegion:'chest'});f.attackProfile=c.ArenaMotion.profile(f.attackWeapon);f.duration=f.attackProfile.duration;
   for(let n=0;n<=Math.ceil(rate*f.duration);n++){
    f.timer=Math.min(f.duration,n*dt);time+=dt;c.ImportedGladiator.animate(f,m,time,dt);report.frames++;
    contact(m,!attackingLeft,attackingLeft?f.weapon:f.offhand,['dual',rate,attackingLeft,n].join(':'));
   }
  }finally{c.ImportedGladiator.dispose(m);}
  report.scenarios++;
 }
 // Picking up another left-hand item must not retain the Scissor sleeve frame.
 for(const next of ['net',null]){
  const models=[c.ImportedGladiator.create(215,'scissor'),c.ImportedGladiator.create(216,'scissor')],fighters=models.map(()=>new c.ArenaCombat(()=>.999).reset('normal','scissor').fighters[0]);
  fighters.forEach(f=>Object.assign(f,{x:0,z:0,angle:.4,hp:100,motionVersion:163,action:'idle',timer:0,move:0,blocking:false}));fighters[0].leftGear=next;
  try{
   for(let n=0;n<12;n++)for(let i=0;i<2;i++)c.ImportedGladiator.animate(fighters[i],models[i],n/30,1/30);
   fighters[1].leftGear=next;
   for(let i=0;i<2;i++)c.ImportedGladiator.animate(fighters[i],models[i],.4,1/30);
   const expected=models[0].gear.left.anchor,actual=models[1].gear.left.anchor;
   check(expected.position.distanceTo(actual.position)<1e-8,'Scissor pickup retained attachment position');
   check(expected.quaternion.angleTo(actual.quaternion)<1e-7,'Scissor pickup retained sleeve orientation');report.pickupChecks++;
  }finally{models.forEach(m=>c.ImportedGladiator.dispose(m));}
 }
 // Regress the reachable Sica pose that lost its handle at t=0.4 after a
 // valid walk -> moving guard -> attack transition at 60 FPS.
 {
  const m=c.ImportedGladiator.create(215,'thraex'),f=new c.ArenaCombat(()=>.999).reset('normal','thraex').fighters[0],dt=1/60;
  Object.assign(f,{x:0,z:0,angle:.37,hp:100,action:'idle',move:1,motionVersion:163,blocking:false,absoluteBlockUntil:0,reaction:0,guardFlash:0,passiveEvade:0,shieldHeldBy:null,timer:0});let time=0;
  const frame=()=>{
   time+=dt;if(f.move){f.x+=Math.sin(f.angle)*1.6*dt;f.z+=Math.cos(f.angle)*1.6*dt;f.walk+=7*dt;}
   c.ImportedGladiator.animate(f,m,time,dt);report.frames++;report.sicaFrames++;contact(m,false,'sica','Sica60:'+f.timer);
   const hand=m.bones.RightHand,arm=m.bones.RightArm;
   a.copy(m.bones.RightHandIndex1.position).normalize();b.copy(a).applyQuaternion(hand.quaternion);const swing=a.angleTo(b);
   report.maxWristSwing=Math.max(report.maxWristSwing,swing);check(swing<Math.PI/5+1e-6,'Sica wrist exceeded anatomical limit');
   const shift=arm.getWorldPosition(a).distanceTo(arm.parent.localToWorld(b.copy(arm.userData.anatomyRestPosition)));
   report.maxShoulderShift=Math.max(report.maxShoulderShift,shift);check(shift<.02501,'Sica grip stretched shoulder');
  };
  try{
   for(let n=0;n<30;n++)frame();f.blocking=true;for(let n=0;n<12;n++)frame();
   Object.assign(f,{blocking:false,move:0,action:'attack',timer:0,attackLeft:false,attackWeapon:f.weapon,attackKind:'light',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(f.weapon)});f.duration=f.attackProfile.duration;
   for(let n=0;n<=Math.ceil(60*f.duration);n++){f.timer=Math.min(f.duration,n*dt);frame();}
  }finally{c.ImportedGladiator.dispose(m);}
 }
 check(report.scissorContacts>0,'Scissor coverage');return report;
}
if(require.main===module)rigRuntime().then(c=>console.log(JSON.stringify(runGripCases(c),null,2))).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runGripCases};
