/* V295: two asset-gated opponents for the single-player Colosseum only.
 * A verified skin replaces an enemy body; the original item/drop records stay on that fighter.
 */
(function(root){
 'use strict';
 const definitions=Object.freeze([
  Object.freeze({key:'aegis',name:'Aegis Sentinel',file:'assets/armor-v295/aegis.glb',health:1.15,damage:1.10}),
  Object.freeze({key:'hoplomachus',name:'Hoplomachus Gladiator',file:'assets/armor-v295/hoplomachus-v295.glb',health:1.15,damage:1.10})
 ]);
 const fighters=new WeakMap(),battles=new WeakMap(),loadouts=new WeakSet(),damageHooks=new WeakSet();
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
 async function prepare(ticket,options,loadManifest=readManifest,loadModel=readModel){
  const templates=new Map();
  if(!eligible(ticket,options))return templates;
  const controller=new AbortController();
  // Optional enemies share a fixed loading budget. The base game can always start.
  let deadline;
  const timeout=new Promise(resolve=>{deadline=setTimeout(()=>{controller.abort();resolve();},10000);});
  const load=(async()=>{
   const manifest=await loadManifest(controller.signal);
   if(manifest.version!==295||!Array.isArray(manifest.models))return;
   await Promise.allSettled(definitions.map(async definition=>{
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
 function applyHealth(f,state,ratio){
  state.baseMaxHp=f.maxHp;
  f.maxHp=Math.max(1,Math.round(state.baseMaxHp*state.definition.health));
  restoreHealth(f,ratio);f.name=state.definition.name;
 }
 function wrapLoadout(loadout){
  if(loadouts.has(loadout))return;
  const apply=loadout.apply,refresh=loadout.refresh;
  loadout.apply=function(f,...args){
   const state=fighters.get(f),ratio=state?healthRatio(f):0,result=apply.call(this,f,...args);
   if(state)applyHealth(f,state,ratio);
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
 function wrapDamage(combat){
  if(damageHooks.has(combat))return;
  const damage=combat.damage;
  combat.damage=function(attacker,victim,base,...args){
   const state=fighters.get(attacker);
   // Scale the damage argument, not attackBonus: V10 weapons compensate attackBonus.
   if(state?.combat===this&&Number.isFinite(base))base*=state.definition.damage;
   return damage.call(this,attacker,victim,base,...args);
  };
  damageHooks.add(combat);
 }
 function detach(combat){
  const old=battles.get(combat);if(!old)return;
  for(const f of old.fighters){
   const state=fighters.get(f);if(!state||state.combat!==combat)continue;
   const ratio=healthRatio(f);f.maxHp=state.baseMaxHp;restoreHealth(f,ratio);f.name=state.originalName;
   delete f.eliteBotV295;fighters.delete(f);
  }
  battles.delete(combat);
 }
 function reject(combat,reason){detach(combat);return {active:false,reason,assignments:[]};}
 function attach(combat,ticket,options={}){
  if(!combat||!Array.isArray(combat.fighters))return {active:false,reason:'invalid-combat',assignments:[]};
  if(!eligible(ticket,options)||combat.mode!==ticket.mode||combat.naval||combat.pitRound||combat.survival)
   return reject(combat,'ineligible-mode');
  const ready=definitions.filter(definition=>{
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
  if(old?.roster===combat.fighters&&old.assignments.length===ready.length&&old.assignments.every((a,i)=>a.key===ready[i].key)&&old.fighters.every(f=>combat.fighters.includes(f)&&f.team!==player.team&&!f.player&&!f.owner&&!f.owner_id))
   return {active:true,assignments:old.assignments};
  const candidates=combat.fighters.filter(f=>Number.isInteger(f.id)&&f.id>0&&!f.player&&!f.owner&&!f.owner_id&&
   f.team!==player.team&&Number.isFinite(f.maxHp)&&f.maxHp>0&&Number.isFinite(f.hp)&&f.hp>0).sort((a,b)=>a.id-b.id);
  if(candidates.length<ready.length)return reject(combat,'insufficient-enemies');
  const first=candidates[0],selected=[first];
  if(ready.length>1)selected.push(candidates.find(f=>f.team!==first.team)||candidates[1]);
  detach(combat);wrapLoadout(loadout);wrapDamage(combat);
  const assignments=selected.map((f,i)=>{
   const definition=ready[i],state={combat,definition,baseMaxHp:f.maxHp,originalName:f.name};
   fighters.set(f,state);f.eliteBotV295=Object.freeze({key:definition.key,name:definition.name});
   applyHealth(f,state,healthRatio(f));
   return Object.freeze({fighterId:f.id,key:definition.key});
  });
  Object.freeze(assignments);battles.set(combat,{roster:combat.fighters,fighters:selected,assignments});
  return {active:true,assignments};
 }
 const api=Object.freeze({definitions,prepare,readManifest,readModel,attach,detach});
 root.ArenaEliteBotsV295=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
