/* Actual model and simulation throw lifecycle checks. CPU runs use the original
 * GLB geometry/rig with placeholder images; browser runs decode real textures.
 * No simulation methods are replaced. The portable runner also runs in WebKit.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rigRuntime}=require('./performance-v84.cjs');

function runThrowCases(c,{rates=[20,60,120],types=Object.keys(c.ArenaClasses),weapons=['gladius','sica','spear','trident','trident_gladiator'],interruptions=true,boundaries=true}={}){
 const check=(ok,message)=>{if(!ok)throw Error(message);},T=c.THREE;
 check(typeof c.ArenaAnatomy.pendingThrow==='function'&&typeof c.ArenaAnatomy.throwPose==='function','V218 throw adapters are loaded');
 const report={classes:types.length,weapons:weapons.length,rates,scenarios:0,interruptionScenarios:0,boundaryScenarios:0,frames:0,prelaunchFrames:0,releasedFrames:0,snapshotChecks:0,contactChecks:0,fingerChecks:0,freshModels:0,interpolationChecks:0,boundaryChecks:0,maxPalmGap:0,maxFingerAngleError:0};
 const a=new T.Vector3(),b=new T.Vector3(),scale=new T.Vector3(),axis=new T.Vector3(1,0,0),expectedQ=new T.Quaternion(),actualQ=new T.Quaternion(),bendQ=new T.Quaternion();
 const protectedState=state=>JSON.stringify({
  fighter:state.f,projectiles:state.sim.projectiles,drops:state.sim.drops,stats:state.sim.stats,time:state.sim.time,finished:state.sim.finished
 },(_key,value)=>value instanceof Set?[...value]:value);
 function contact(model,left,kind,key){
  const side=left?'Left':'Right',hand=model.bones[side+'Hand'],anchor=left?model.offhandAnchor:model.weaponAnchor;
  check(anchor.children.length===1,key+' held item has exactly one attachment');
  check(anchor.visible&&anchor.children[0].visible,key+' held item is visible');
  hand.localToWorld(a.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));
  const offset=['spear','trident','trident_gladiator','halberd'].includes(kind)?-.16:anchor.children[0]?.userData.asset==='roman_spatha.glb'?-.065:0;
  anchor.localToWorld(b.set(0,offset,0));
  const gap=a.distanceTo(b);report.maxPalmGap=Math.max(report.maxPalmGap,gap);report.contactChecks++;
  check(gap<.005,key+' '+side+' handle separated from palm '+gap);
  check(model.grip166?.[side]?.active,key+' '+side+' missing active grip');
  const angles=['spear','trident','trident_gladiator'].includes(kind)?[.70,.82,.72]:[.84,.98,.84];
  for(let i=1;i<=3;i++){
   const name=side+'HandIndex'+i,bone=model.bones[name],rest=model.rest.get(name);
   check(bone&&rest,key+' '+name+' must exist in the actual GLB');
   expectedQ.copy(rest.q).multiply(bendQ.setFromAxisAngle(axis,angles[i-1])).normalize();
   const error=actualQ.copy(bone.quaternion).normalize().angleTo(expectedQ);report.maxFingerAngleError=Math.max(report.maxFingerAngleError,error);report.fingerChecks++;
   check(error<1e-6,key+' '+name+' opened while holding the item '+error);
  }
 }
 function create(type,kind,left){
  const sim=new c.ArenaCombat(()=>.999).reset('normal',type),f=sim.fighters[0],otherKind=kind==='gladius'?'sica':'gladius';
  Object.assign(f,{x:0,z:0,angle:0,hp:100,maxHp:100,action:'idle',timer:0,walk:0,move:0,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,absoluteBlockUntil:0,shieldHeldBy:null,motionVersion:163,shield:false,leftGear:null,weapon:left?otherKind:kind,offhand:left?kind:otherKind,attackLeft:left,pickupHand:left?'offhand':'weapon',cooldown:0});
  const item=(slot,model)=>({token:'v218-'+type+'-'+slot,item:{id:'v218-'+slot,kind:'weapon',model,enhancement:0,stat_version:10,natural_stats:{},natural_percentages:{},emeralds:[]}});
  f.equipment={weapon:item('weapon',f.weapon),offhand:item('offhand',f.offhand)};
  // Keep the real bots in the simulation, outside the throw path and unable to
  // attack. Only target placement is changed; special/tick remain untouched.
  for(const other of sim.fighters)if(other!==f)Object.assign(other,{x:8+other.id*.15,z:-8+other.id*.13,stunUntil:100});
  const target=sim.fighters.find(other=>other.team!==f.team);Object.assign(target,{x:0,z:3});sim.lockedTarget=target.id;
  const model=c.ImportedGladiator.create(218,type);
  return {sim,f,model,target,type,kind,left,slot:left?'offhand':'weapon',otherSlot:left?'weapon':'offhand',otherKind};
 }
 function draw(state,model=state.model,label='',timer){
  const {f,sim,left,slot,otherSlot,otherKind}=state,key=[state.type,state.kind,left?'left':'right',label,sim.time.toFixed(6)].join(':');
  const before=protectedState(state),visual=timer===undefined?f:{...f,timer},kind=c.ArenaAnatomy.pendingThrow(f,sim.projectiles),pose=c.ArenaAnatomy.throwPose(visual,kind,f.attackLeft);
  const shot=sim.projectiles.find(n=>n.owner===f.id&&!n.launched),pending=f.hp>0&&f.action==='spearcast'&&!!shot;
  check(kind===(pending?shot.kind:null),key+' projection must follow the live projectile');
  check(pose[slot]===(pending?shot.kind:f[slot]),key+' selected display slot');
  check(pose[otherSlot]===f[otherSlot]&&pose[otherSlot]===otherKind,key+' changed the nonthrowing hand');
  for(const name of Object.keys(visual))if(name!==slot)check(pose[name]===visual[name],key+' projection changed '+name);
  c.ImportedGladiator.animate(pose,model,sim.time,state.dt||1/60);report.frames++;
  check(protectedState(state)===before,key+' visualization mutated inventory, stamina, cooldown or simulation');report.snapshotChecks++;
  check(model.equippedWeapon===pose.weapon&&model.offhandKind===pose.offhand,key+' actual displayed loadout differs');
  for(const handLeft of [false,true]){
   const held=handLeft?pose.offhand:pose.weapon,anchor=handLeft?model.offhandAnchor:model.weaponAnchor;
   check(anchor.children.length===(held?1:0),key+' phantom or absent '+(handLeft?'left':'right')+' item');
   if(held&&f.hp>0)contact(model,handLeft,held,key);
  }
  for(const [,bone]of model.boneEntries)check(bone.matrixWorld.elements.every(Number.isFinite),key+' invalid bone matrix');
  if(pending)report.prelaunchFrames++;else if(f[slot]===null)report.releasedFrames++;
  return {pending,shot,pose};
 }
 function start(state){
  for(let i=0;i<4;i++)draw(state,state.model,'settled idle');
  const {f,sim,slot,left}=state,entry=f.equipment[slot],stamina=f.stamina,time=sim.time;
  check(sim.special(0,left?1:0),state.type+':'+state.kind+' real throw must start');
  check(f.action==='spearcast'&&f[slot]===null&&!f.equipment[slot],'real special removes the selected inventory item immediately');
  check(f.stamina===stamina-26&&f.skillReady[left?1:0]===time+8,'special cost/cooldown unchanged');
  check(sim.projectiles.length===1&&sim.projectiles[0].itemEntry===entry&&sim.projectiles[0].kind===state.kind,'projectile retains the removed item token');
  state.entry=entry;state.projectileId=sim.projectiles[0].id;
  // A real throw has acquired its direction. Move the target off that direction
  // so this visual regression does not test projectile damage or AI decisions.
  Object.assign(state.target,{x:8,z:-5});
  draw(state,state.model,'special start');
 }
 function tick(state,dt,label){state.dt=dt;state.sim.tick(dt,{});return draw(state,state.model,label);}
 function advance(state,time,label){
  while(state.sim.time<time-1e-10)tick(state,Math.min(1/60,time-state.sim.time),label);
 }
 function replacement(state,label){
  const fresh=c.ImportedGladiator.create(218,state.type);
  try{draw(state,fresh,label);report.freshModels++;}finally{c.ImportedGladiator.dispose(fresh);}
 }
 for(const type of types)for(const rate of rates)for(const kind of weapons)for(const left of [false,true]){
  const state=create(type,kind,left);state.dt=1/rate;
  let beforeRelease=false,afterRelease=false,freshBefore=false,freshAfter=false;
  try{
   start(state);
   const representative=rate===rates[0]&&kind===weapons[0];
   while(state.sim.time<1.1){
    const {pending,shot}=tick(state,1/rate,'throw/recovery');
    if(pending){
     check(shot.age<.27,'the real projectile is unlaunched before its release age');beforeRelease=true;
     if(state.sim.time>=.1&&!freshBefore){
      // Timer interpolation can cross the release threshold before simulation.
      draw(state,state.model,'display timer ahead of release',.4);report.interpolationChecks++;freshBefore=true;
      if(representative)replacement(state,'new model during wind-up');
     }
    }else if(state.sim.projectiles.some(n=>n.id===state.projectileId&&n.launched)){
     afterRelease=true;
     if(!freshAfter){
      // A late visual clock cannot resurrect a projectile already in flight.
      draw(state,state.model,'display timer behind release',.01);report.interpolationChecks++;freshAfter=true;
      if(representative)replacement(state,'new model after release');
     }
    }
   }
   check(beforeRelease&&afterRelease,'both sides of actual launch must be observed at '+rate+' Hz');
   check(state.f.action==='idle'&&state.f[state.slot]===null,'recovery must leave the thrown slot empty');
   check(!state.sim.projectiles.some(n=>n.id===state.projectileId),'projectile completes its real lifecycle');
   const drops=state.sim.drops.filter(d=>d.itemEntry===state.entry);
   check(drops.length===1&&drops[0].kind===kind,'exactly one dropped copy retains the item token');
   report.scenarios++;
  }finally{c.ImportedGladiator.dispose(state.model);}
 }
 if(interruptions)for(let i=0;i<types.length;i++)for(const left of [false,true])for(const when of ['before','after'])for(const reason of ['hurt','death']){
  const state=create(types[i],weapons[(i+Number(left))%weapons.length],left);
  try{
   start(state);advance(state,when==='before'?.15:.32,when+' interruption');
   const projectile=state.sim.projectiles.find(n=>n.id===state.projectileId);
   check(projectile&&projectile.launched===(when==='after'),'interruption is on the intended side of release');
   if(reason==='death')Object.assign(state.f,{hp:0,action:'down',timer:0});
   else Object.assign(state.f,{action:'hurt',timer:0,duration:.4,reaction:.2});
   // Render before tick removes the old pending projectile as well: the live
   // action/death cancels its visual even while that projectile is still listed.
   draw(state,state.model,reason+' immediate');
   tick(state,1/60,reason+' next tick');
   if(when==='before')check(!state.sim.projectiles.some(n=>n.id===state.projectileId),'cancelled wind-up leaves no projectile');
   else check(state.sim.projectiles.some(n=>n.id===state.projectileId&&n.launched),'postrelease interruption does not cancel flight');
   advance(state,1.1,reason+' cleanup');
   check(state.f[state.slot]===null&&!state.f.equipment[state.slot],'interruption does not restore the inventory item');
   check(state.sim.drops.filter(d=>d.itemEntry===state.entry).length===1,'interruption leaves one physical item');
   report.interruptionScenarios++;
  }finally{c.ImportedGladiator.dispose(state.model);}
 }
 if(boundaries)for(const kind of weapons)for(const left of [false,true]){
  const state=create(types[0],kind,left);
  try{
   start(state);advance(state,.269,'just before release');
   let shot=state.sim.projectiles.find(n=>n.id===state.projectileId);
   check(shot&&!shot.launched&&draw(state).pending,'item remains held at 0.269 seconds');report.boundaryChecks++;
   tick(state,.27-state.sim.time,'exact release');shot=state.sim.projectiles.find(n=>n.id===state.projectileId);
   check(shot&&shot.age===.27&&shot.launched&&!draw(state).pending,'item leaves the hand at the actual 0.27-second release');report.boundaryChecks++;
   report.boundaryScenarios++;
  }finally{c.ImportedGladiator.dispose(state.model);}
 }
 // An unrelated actor's pending throw must not appear in this actor's hand.
 {
  const state=create(types[0],weapons[0],false);
  try{
   start(state);const before=protectedState(state),shot=state.sim.projectiles[0];
   check(c.ArenaAnatomy.pendingThrow(state.f,[{...shot,owner:state.f.id+1}])===null,'foreign projectile is ignored');
   check(c.ArenaAnatomy.pendingThrow(state.f,[{...shot,launched:true}])===null,'launched projectile is ignored');
   check(c.ArenaAnatomy.pendingThrow({...state.f,action:'hurt'},[shot])===null,'hurt actor has no pending visual');
   check(c.ArenaAnatomy.pendingThrow({...state.f,hp:0},[shot])===null,'dead actor has no pending visual');
   check(c.ArenaAnatomy.throwPose(state.f,null)===state.f,'no pending item keeps the original visual state');
   const visual={...state.f,attackLeft:true,weapon:state.otherKind,offhand:null},pose=c.ArenaAnatomy.throwPose(visual,shot.kind,true);
   check(pose.offhand===shot.kind&&pose.weapon===visual.weapon&&visual.offhand===null,'explicit selected hand restores only the display copy');
   check(protectedState(state)===before,'adapter edge cases changed simulation');report.snapshotChecks++;
  }finally{c.ImportedGladiator.dispose(state.model);}
 }
 check(report.scenarios===types.length*weapons.length*2*rates.length,'complete class/weapon/hand/rate coverage');
 check(report.prelaunchFrames>0&&report.releasedFrames>0,'prelaunch and released geometry are both covered');
 return report;
}

// performance-v84 intentionally loads the arena core for generic rig fixtures.
// Replace only that fixture core here with the selected page's actual core;
// this keeps per-page projectile timing covered without changing its helper.
async function throwRuntime(page='arena.html'){
 const root=path.resolve(process.env.LUDUS_PERF_ROOT||path.join(__dirname,'..'));
 const c=await rigRuntime(page,page==='caravan-field.html'?{rigFile:'caravan-rig-v126.js'}:{});
 if(page==='caravan-field.html'){
  vm.runInContext(fs.readFileSync(path.join(root,'caravan-core-v126.js'),'utf8'),c,{filename:'caravan-core-v126.js'});
  for(const file of ['arena-locomotion-data-v91.js','arena-locomotion-v91.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
 }else{
  const html=fs.readFileSync(path.join(root,page),'utf8'),script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(match=>match[1].includes('var ArenaClasses='))?.[1];
  const marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);";
  const start=script?.indexOf('var ArenaClasses='),markerAt=script?.indexOf(marker,start),finish=script?.indexOf(ending,markerAt);
  if(!(start>=0&&markerAt>=0&&finish>markerAt))throw Error('Missing actual combat core in '+page);
  vm.runInContext(script.slice(start,finish+ending.length),c,{filename:page+':actual-combat-core'});
 }
 return c;
}

if(require.main===module)(async()=>{
 const pages=process.env.LUDUS_THROW_PAGE?[process.env.LUDUS_THROW_PAGE]:['arena.html','savas.html','multiplayer.html','caravan-field.html'];
 const reports=[];
 for(const page of pages){
  const c=await throwRuntime(page),report=runThrowCases(c,{rates:page==='arena.html'?[20,60,120]:[60]});
  reports.push({page,...report});
 }
 console.log(JSON.stringify({note:'CPU scene-graph checks use the real GLB with placeholder images. The unchanged actual page cores drive special/tick; these checks do not measure rendering or iPhone FPS.',reports},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={runThrowCases,throwRuntime};
