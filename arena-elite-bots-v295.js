/* V296: Victor and match-selected commanders for the single-player Colosseum only.
 * A verified skin replaces an enemy body; the original item/drop records stay on that fighter.
 */
(function(root){
 'use strict';
 const definitions=Object.freeze([
  Object.freeze({key:'aegis',variant:'imperator',name:'Imperator',file:'assets/armor-v295/aegis.glb',health:1.15,damage:1.10,armor:1.15,attackSpeed:1.15,speed:1}),
  Object.freeze({key:'hoplomachus',variant:null,name:'Victor',file:'assets/armor-v295/hoplomachus-v295.glb',health:1.15,damage:1.10*1.15,armor:1.15,attackSpeed:1.15,speed:1.15})
 ]);
 const legatus=Object.freeze({...definitions[0],variant:'legatus',name:'Legatus legionis',armor:1.25,attackSpeed:1.25});
 const fighters=new WeakMap(),battles=new WeakMap(),loadouts=new WeakSet(),combatHooks=new WeakSet();
 const poleWeapons=new Set(['spear','trident','trident_gladiator','halberd']),openActions=new Set(['attack','recoil','stagger','hurt']);
 const specialActions=new Set(['bash','hook','spearcast','netcast']),attackActions=new Set(['attack','recoil','stagger',...specialActions]);
 function selectedDefinitions(options){return options.commander===null?[definitions[1]]:[options.commander==='legatus'?legatus:definitions[0],definitions[1]];}
 const requiredBones=['Hips','Spine','Spine1','Spine2','Neck','Head'];
 for(const side of ['Left','Right']){
  for(const part of ['Shoulder','Arm','ForeArm','Hand','HandIndex1','HandIndex2','HandIndex3','HandIndex4','UpLeg','Leg','Foot']){
   requiredBones.push(side+part);
  }
 }
 function eligible(ticket,options){
  return options.singlePlayer===true && ['solo20','4x5'].includes(ticket?.mode) &&
   !options.naval && !options.pit && !options.ranked;
 }
 async function readManifest(signal){
  const res=await fetch('assets/armor-v295/source-manifest.json?v=295',{signal,cache:'no-cache'});
  if(!res.ok)throw Error('Missing special opponent manifest');
  return res.json();
 }
 async function readModel(path,signal){
  const res=await fetch(path,{signal});
  if(!res.ok)throw Error('Missing special opponent model');
  const gltf=await new THREE.GLTFLoader().parseAsync(await res.arrayBuffer(),'');
  return gltf.scene;
 }
 function compatible(scene){
  const bones=new Set();let skins=0;
  scene.traverse(node=>{
   if(node.isBone)bones.add(node.name.replace(/^mixamorig:?/,'').replace(/_\d+$/,''));
   if(node.isSkinnedMesh && node.geometry?.attributes.skinIndex && node.geometry?.attributes.skinWeight)skins++;
  });
  return skins>0 && requiredBones.every(name=>bones.has(name));
 }
 async function prepare(ticket,options={},loadManifest=readManifest,loadModel=readModel){
  const templates=new Map();
  if(!eligible(ticket,options))return templates;
  const controller=new AbortController();
  // Optional enemies share a fixed loading budget. The base game can always start.
  let deadline;
  const timeout=new Promise(resolve=>{deadline=setTimeout(()=>{controller.abort();resolve();},10000);});
  const load=(async()=>{
   const manifest=await loadManifest(controller.signal);
   if(manifest.version!==295||!Array.isArray(manifest.models))return;
   await Promise.allSettled(selectedDefinitions(options).map(async definition=>{
    const row=manifest.models.find(m=>m.id===definition.key);
    if(row?.ready!==true||row.rigVerified!==true||row.outputPath!==definition.file)return;
    const model=await loadModel(definition.file,controller.signal);
    if(!controller.signal.aborted && compatible(model))templates.set(definition.key,model);
   }));
  })();
  try{await Promise.race([load,timeout]);}catch(_){/* Ordinary enemies fill missing slots. */}
  finally{clearTimeout(deadline);}
  return templates;
 }
 function healthRatio(f){return Number.isFinite(f.hp)&&Number.isFinite(f.maxHp)&&f.maxHp>0?Math.max(0,Math.min(1,f.hp/f.maxHp)):0;}
 function restoreHealth(f,ratio){f.hp=ratio*f.maxHp;}
 function applyStats(f,state,ratio){
  state.baseMaxHp=f.maxHp;
  state.baseDefense=f.defenseBonus;state.baseSpeed=f.speedBonus;state.baseTactics=f.tactics;
  f.maxHp=Math.max(1,Math.round(state.baseMaxHp*state.definition.health));
  f.defenseBonus=(state.baseDefense??1)*state.definition.armor;
  f.speedBonus=(state.baseSpeed??1)*state.definition.speed;
  if(state.definition.key==='hoplomachus')f.tactics=Math.max(85,Number(state.baseTactics)||0);
  restoreHealth(f,ratio);f.name=state.definition.name;
 }
 function wrapLoadout(loadout){
  if(loadouts.has(loadout))return;
  const apply=loadout.apply,refresh=loadout.refresh;
  loadout.apply=function(f,...args){
   const state=fighters.get(f),ratio=state?healthRatio(f):0,result=apply.call(this,f,...args);
   if(state)applyStats(f,state,ratio);
   return result;
  };
  loadout.refresh=function(f,...args){
   const state=fighters.get(f),ratio=state?healthRatio(f):0,result=refresh.call(this,f,...args);
   // The original refresh preserves missing HP after apply. Elites preserve HP percentage.
   if(state){restoreHealth(f,ratio);f.name=state.definition.name;}
   return result;
  };
  loadouts.add(loadout);
 }
 function stateFor(combat,f){const state=fighters.get(f);return state?.combat===combat?state:null;}
 const turn=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
 function scaleProfile(f,state){
  const p=f.attackProfile;if(!p||p===state.scaledProfile)return;
  const rate=state.definition.attackSpeed;
  for(const key of ['wind','active','recover'])p[key]/=rate;
  p.duration=p.wind+p.active+p.recover;f.duration=p.duration;f.hitTime=p.wind;state.scaledProfile=p;
 }
 // Reuse one probe per elite. Flank/evasion planning creates no objects per frame.
 function clearStep(combat,f,state,x,z){
  const probe=state.probe;probe.x=x;probe.z=z;combat.bound(probe);
  if(Math.hypot(probe.x-x,probe.z-z)>.08)return false;
  for(const other of combat.fighters)if(other!==f&&other.hp>0&&Math.hypot(x-other.x,z-other.z)<.72)return false;
  return true;
 }
 function evadeVictor(combat,f,t,state){
  const aim=Math.atan2(t.x-f.x,t.z-f.z),side=state.flankSide;
  for(let i=0;i<2;i++){
   const sign=i?-side:side,x=Math.cos(aim)*sign-Math.sin(aim)*.25,z=-Math.sin(aim)*sign-Math.cos(aim)*.25,len=Math.hypot(x,z);
   const travel=f.motionVersion===163?1.15:3.7;
   if(!clearStep(combat,f,state,f.x+x/len*travel,f.z+z/len*travel))continue;
   const ok=f.motionVersion===163&&typeof combat.evade==='function'?combat.evade(f.id,x,z,'step'):combat.dodge(f.id,x,z);
   if(ok){state.flankSide=sign;f.aiEvadeAt=combat.time+1.25;state.flankUntil=0;return true;}
  }
  return false;
 }
 function flankVictor(combat,f,dt,state){
  let target=combat.fighters[f.target];if(!combat.enemy(f,target))target=combat.nearest(f);
  if(!target||f.stamina<38||combat.botThreat(f))return false;
  const dx=f.x-target.x,dz=f.z-target.z,d=Math.hypot(dx,dz),weapon=f.weapon||f.offhand;
  const radius=poleWeapons.has(weapon)?1.85:weapon==='whip'?1.3:weapon?1.1:.85;
  if(d<.72||d>3.2)return false;
  const rear=Math.atan2(dx,dz),behind=(dx*Math.sin(target.angle)+dz*Math.cos(target.angle))/d<-.45;
  if(state.flankTarget!==target.id||combat.time>state.flankUntil){
   if(combat.time<state.nextFlank||behind||!openActions.has(target.action)&&!target.blocking)return false;
   state.flankTarget=target.id;state.flankUntil=combat.time+1.4;state.nextFlank=combat.time+2.2;
   const delta=turn(target.angle+Math.PI,rear);if(Math.abs(delta)<2.95)state.flankSide=Math.sign(delta)||state.flankSide;
  }
  f.target=target.id;f.angle=Math.atan2(-dx,-dz);f.blocking=false;f.guardRegion=null;
  if(behind&&d<=radius+.15){state.flankUntil=0;return f.cooldown<=0&&combat.attack(f.id,false,combat.botAttackRegion(f,target));}
  const radial=(radius-d)*1.4,speed=(combat.difficulty==='easy'?1.9:2.45)*(f.body.legs<30?.75:1)*(f.speedBonus||1);
  for(let i=0;i<2;i++){
   const side=i?-state.flankSide:state.flankSide;
   let x=dz/d*side+dx/d*radial,z=-dx/d*side+dz/d*radial;const len=Math.hypot(x,z);x=f.x+x/len*speed*dt;z=f.z+z/len*speed*dt;
   if(!clearStep(combat,f,state,x,z))continue;
   f.x=x;f.z=z;f.move=.75;state.flankSide=side;return true;
  }
  state.flankUntil=0;return false;
 }
 function wrapCombat(combat){
  if(combatHooks.has(combat))return;
  const damage=combat.damage;
  combat.damage=function(attacker,victim,base,...args){
   const state=fighters.get(attacker);
   // Scale the damage argument, not attackBonus: V10 weapons compensate attackBonus.
   if(state?.combat===this&&Number.isFinite(base))base*=state.definition.damage;
   return damage.call(this,attacker,victim,base,...args);
  };
  const attack=combat.attack,special=combat.special,deflect=combat.deflectAttack,hit=combat.hit,tick=combat.tick,botStep=combat.botStep,botDefend=combat.botDefend;
  combat.attack=function(id,...args){const ok=attack.call(this,id,...args),f=this.fighters[id],state=stateFor(this,f);if(ok&&state)scaleProfile(f,state);return ok;};
  combat.special=function(id,...args){const ok=special.call(this,id,...args),f=this.fighters[id],state=stateFor(this,f);if(ok&&state&&f.action==='attack')scaleProfile(f,state);return ok;};
  combat.deflectAttack=function(f,...args){const active=f.action==='attack',result=deflect.call(this,f,...args),state=stateFor(this,f);if(active&&state&&['recoil','stagger'].includes(f.action)){f.duration/=state.definition.attackSpeed;state.recoilDuration=f.duration;}return result;};
  combat.hit=function(f,...args){const active=f.action==='attack',result=hit.call(this,f,...args),state=stateFor(this,f);
   if(active&&state&&['recoil','stagger'].includes(f.action)&&f.duration!==state.recoilDuration){
    const rate=state.definition.attackSpeed;
    // Authored thrust contact resets recoil to max(.28, profile.recover) after
    // deflectAttack; profile.recover has already been divided exactly once.
    if(f.motionVersion===163&&['spear','trident','trident_gladiator'].includes(f.attackWeapon))f.duration=Math.max(.28/rate,f.attackProfile.recover);
    else f.duration/=rate;
    state.recoilDuration=f.duration;
   }return result;
  };
  combat.botDefend=function(f,t){
   const state=stateFor(this,f);if(!state||state.definition.key!=='hoplomachus')return botDefend.call(this,f,t);
   if(!t){state.threatId=null;return botDefend.call(this,f,t);}
   if(state.threatId!==t.id||state.threatAttack!==t.lastAttack){state.threatId=t.id;state.threatAttack=t.lastAttack;state.noticedAt=this.time;state.evadeTried=false;}
   // React to a visible wind-up, then commit once; do not reroll every frame.
   if(this.time-state.noticedAt<(this.difficulty==='easy'?.14:.10))return true;
   if(!state.evadeTried){state.evadeTried=true;if(f.stamina>=36&&this.time>=(f.aiEvadeAt||0)&&evadeVictor(this,f,t,state))return true;}
   return botDefend.call(this,f,t);
  };
  combat.botStep=function(f,dt){const state=stateFor(this,f);if(state?.definition.key==='hoplomachus'&&flankVictor(this,f,dt,state))return;return botStep.call(this,f,dt);};
  combat.tick=function(dt,...args){
   const battle=battles.get(this);if(!battle||this.finished)return tick.call(this,dt,...args);
   dt=Math.max(0,Math.min(.05,dt));
   for(const f of battle.fighters){const state=stateFor(this,f);if(!state)continue;
    state.beforeAction=f.action;state.beforeCooldown=f.cooldown;state.beforeHand=f.handSpecial261;state.beforeStage=f.handSpecial261?.stage;
    if(f.hp<=0||f.stunUntil>this.time)continue;
    const extra=dt*(state.definition.attackSpeed-1);
    // Fixed-time specials use a virtual preparation clock, shared by their animation,
    // release event and recovery. Missile flight and net immobilization stay real time.
    if(specialActions.has(f.action))f.timer+=extra;
    if(f.skillMotion&&f.action==='hook')f.skillMotion.age+=extra;
    if(f.handSpecial261)f.handSpecial261.start-=extra;
   }
   for(const n of this.projectiles){const state=stateFor(this,this.fighters[n.owner]);if(state&&!n.launched)n.age+=Math.min(Math.max(0,.27-n.age),dt*(state.definition.attackSpeed-1));}
   for(const n of this.nets){const state=stateFor(this,this.fighters[n.owner]);if(state&&n.age<.3)n.age+=Math.min(.3-n.age,dt*(state.definition.attackSpeed-1));}
   const result=tick.call(this,dt,...args);
   for(const f of battle.fighters){const state=stateFor(this,f);if(!state)continue;const rate=state.definition.attackSpeed,p=f.attackProfile,previous=state.scaledProfile;
    // A miss adds recovery after the initial profile is built; divide only that addition.
    if(p&&previous&&p!==previous&&p.wind===previous.wind&&p.active===previous.active&&p.recover>previous.recover){p.recover=previous.recover+(p.recover-previous.recover)/rate;p.duration=p.wind+p.active+p.recover;if(f.action==='attack')f.duration=p.duration;state.scaledProfile=p;}
    if(state.beforeHand?.stage===2&&state.beforeStage!==2&&f.action==='attack')f.duration/=rate;
    if(f.cooldown>state.beforeCooldown&&attackActions.has(state.beforeAction))f.cooldown/=rate;
   }
   return result;
  };
  combatHooks.add(combat);
 }
 function detach(combat){
  const old=battles.get(combat);if(!old)return;
  for(const f of old.fighters){
   const state=fighters.get(f);if(!state||state.combat!==combat)continue;
   const ratio=healthRatio(f);f.maxHp=state.baseMaxHp;restoreHealth(f,ratio);f.name=state.originalName;
   for(const [key,value] of [['defenseBonus',state.baseDefense],['speedBonus',state.baseSpeed],['tactics',state.baseTactics]]){if(value===undefined)delete f[key];else f[key]=value;}
   delete f.eliteBotV295;fighters.delete(f);
  }
  battles.delete(combat);
 }
 function reject(combat,reason){detach(combat);return {active:false,reason,assignments:[]};}
 function attach(combat,ticket,options={}){
  if(!combat||!Array.isArray(combat.fighters))return {active:false,reason:'invalid-combat',assignments:[]};
  if(!eligible(ticket,options)||combat.mode!==ticket.mode||combat.naval||combat.pitRound||combat.survival)
   return reject(combat,'ineligible-mode');
  const ready=selectedDefinitions(options).filter(definition=>{
   try{return options.assetsReady?.(definition.key)===true;}catch(_){return false;}
  });
  if(!ready.length)return reject(combat,'assets-not-ready');
  const loadout=options.loadout;
  if(typeof loadout?.apply!=='function'||typeof loadout?.refresh!=='function'||typeof combat.damage!=='function')return reject(combat,'missing-hooks');
  const player=combat.fighters.find(f=>f.id===0);
  const unique=new Set(combat.fighters.map(f=>f.id));
  if(!player||unique.size!==combat.fighters.length)return reject(combat,'invalid-roster');
  const old=battles.get(combat);
  // Reattaching an existing battle never replaces a defeated special opponent.
  if(old?.roster===combat.fighters&&old.assignments.length===ready.length&&old.assignments.every((a,i)=>a.key===ready[i].key&&old.fighters[i].eliteBotV295?.variant===ready[i].variant)&&old.fighters.every(f=>combat.fighters.includes(f)&&f.team!==player.team&&!f.player&&!f.owner&&!f.owner_id))
   return {active:true,assignments:old.assignments};
  const candidates=combat.fighters.filter(f=>Number.isInteger(f.id)&&f.id>0&&!f.player&&!f.owner&&!f.owner_id&&
   f.team!==player.team&&Number.isFinite(f.maxHp)&&f.maxHp>0&&Number.isFinite(f.hp)&&f.hp>0).sort((a,b)=>a.id-b.id);
  if(candidates.length<ready.length)return reject(combat,'insufficient-enemies');
  const first=candidates[0],selected=[first];
  if(ready.length>1)selected.push(candidates.find(f=>f.team!==first.team)||candidates[1]);
  detach(combat);wrapLoadout(loadout);wrapCombat(combat);
  const assignments=selected.map((f,i)=>{
   const definition=ready[i],state={combat,definition,baseMaxHp:f.maxHp,originalName:f.name,probe:{x:0,z:0},flankSide:f.id%2?1:-1,flankUntil:0,nextFlank:0,flankTarget:null};
   fighters.set(f,state);f.eliteBotV295=Object.freeze({key:definition.key,name:definition.name,variant:definition.variant});
   applyStats(f,state,healthRatio(f));
   return Object.freeze({fighterId:f.id,key:definition.key});
  });
  Object.freeze(assignments);battles.set(combat,{roster:combat.fighters,fighters:selected,assignments});
  return {active:true,assignments};
 }
 const api=Object.freeze({definitions,prepare,readManifest,readModel,attach,detach});
 root.ArenaEliteBotsV295=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
