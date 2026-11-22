/* V288: learned papyrus effects on existing combat events. Server snapshots only.
 * No new actions, drops, online rules, random draws, or writes live here.
 */
(function(root){
 'use strict';
 const TRAINER=new Set([1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,22,23,24,25].map(n=>'doctore_'+String(n).padStart(3,'0')));
 const GUARD=new Set([1,2,3,4,5,6,7,8,10,11,12,14,17,18,19,20,23,24].map(n=>'guard_'+String(n).padStart(3,'0')));
 const positive=n=>Number.isFinite(n)&&n>=0?n:0;
 function state(f){return f?.staffCombatV288;}
 function has(f,id){return !!state(f)?.learned.includes(id);}
 function weapon(w){return ['gladius','sica','spatha'].includes(w)?'sword':['trident','trident_gladiator'].includes(w)?'trident':['mace','heavy_mace'].includes(w)?'mace':w==='warhammer'?'hammer':w;}
 function bind(f,snapshot,role,kind){
  delete f.staffCombatV288;
  if(snapshot?.version!==288||!Array.isArray(snapshot.effects))return;
  const allowed=role==='trainer'?TRAINER:GUARD;
  const learned=[...new Set(snapshot.effects.filter(e=>e?.role===role&&allowed.has(e.content_id)).map(e=>e.content_id))];
  if(learned.length)f.staffCombatV288=Object.freeze({role,kind,learned:Object.freeze(learned)});
 }
 function attachArena(combat,ticket){
  for(const f of combat.fighters){delete f.staffCombatV288;delete f.staffChefV288;}
  if(!['4x5','solo20'].includes(ticket?.mode)||!combat.fighters[0])return;
  root.SpecialStaffCareV288?.installCombat(combat.constructor);
  const f=combat.fighters[0],snapshot=ticket.snapshot?.staff_combat_v288;
  bind(f,snapshot,'trainer','gladiator');
  if(snapshot?.version===288&&Array.isArray(snapshot.effects)&&root.SpecialStaffCareV288){
   f.staffChefV288=root.SpecialStaffCareV288.createChef(snapshot.effects.filter(e=>e.role==='cook'));
   const old=f.maxStamina;f.maxStamina=f.staffChefV288.maximum(old);f.stamina=Math.min(f.maxStamina,f.stamina+(f.maxStamina-old));
  }
 }
 function attachDefense(combat,ticket){
  for(const f of combat.fighters){delete f.staffCombatV288;if(f.team===0)bind(f,ticket.encounter?.staff_combat_v288,'guard',f.worker?'worker':'gladiator');}
 }
 function shieldSize(f){return ['thraex','hoplomachus','shield_parma','shield_celtic','shield_azure'].includes(f?.shieldStyle)?'small_or_medium':'large';}
 function cost(f,base,action,w){
  if(!Number.isFinite(base))return base;w=weapon(w);let rate=0;
  if(state(f)?.role==='trainer'){
   if((action==='normal'||action==='double')&&w==='sword'&&has(f,'doctore_003'))rate=.004;
   if(action==='normal'&&((w==='halberd'&&has(f,'doctore_020'))||(w==='trident'&&has(f,'doctore_023'))))rate=.004;
   if(action==='breaker'&&((w==='mace'&&has(f,'doctore_006'))||(w==='hammer'&&has(f,'doctore_021'))))rate=.004;
   if(action==='net'&&has(f,'doctore_008')||action==='pull'&&has(f,'doctore_009')||action==='bash'&&has(f,'doctore_022'))rate=.004;
   if(action==='throw'&&((w==='spear'&&has(f,'doctore_017'))||(w==='trident'&&has(f,'doctore_018'))))rate=.004;
   if(action==='block'&&f.shield&&has(f,shieldSize(f)==='large'?'doctore_010':'doctore_011'))rate=.004;
  }else if(state(f)?.kind==='gladiator'){
   if(action==='normal'&&has(f,'guard_003'))rate=.002;
   if(action==='throw'&&((w==='spear'&&has(f,'guard_004'))||(w==='trident'&&has(f,'guard_005'))))rate=.004;
   if(action==='block'&&f.shield&&has(f,'guard_006'))rate=.002;
   if(action==='bash'&&has(f,'guard_007')||action==='net'&&has(f,'guard_023')||action==='pull'&&has(f,'guard_024'))rate=.004;
   if(action==='roll'&&has(f,'guard_008'))rate=.002;
  }
  const chefAction=action==='normal'||action==='double'?'normal_attack':action==='block'?'successful_block':action==='roll'?'roll':'special';
  const chef=f?.staffChefV288?.cost(chefAction,base)??base;
  return Math.max(0,chef-base*rate);
 }
 function attackCost(combat,f,base,heavy){
  if(f?.staffSpecialPreparingV288)return base;
  const chain=!heavy&&combat.time-f.lastAttack<1.4?f.chain%3+1:1;
  const w=f.offhand&&(chain===2||!f.weapon)?f.offhand:f.weapon;
  // Normal melee includes the existing light/heavy button, but excludes hand specials.
  return cost(f,base,'normal',w);
 }
 function specialCost(f,base,kind,w,index){return cost(f,base,kind,w??(index===1?f.offhand:f.weapon));}
 function criticalChance(f,base){return Math.min(1,positive(base)+(weapon(f.attackWeapon??f.weapon)==='trident'&&has(f,'doctore_001')?.002:0));}
 function covered(f,region){
  if(region==='head'&&f.helmet)return 'head';
  if(region==='chest'&&f.chest)return 'torso';
  if(['legs','leftLeg','rightLeg'].includes(region)&&f.greaves)return 'leg';
  // The current imported manica is mounted on the right arm, never the bare left arm.
  if(region==='rightArm'&&f.shoulders&&['manica_segmented','manica_leather','manica_lion'].includes(f.shoulderModel))return 'arm';
  return null;
 }
 function damage(a,v,base,region){
  if(!Number.isFinite(base))return base;
  const w=weapon(a.attackWeapon??a.weapon),projectile=!!a.itemProjectile||['spearcast','swordcast','throw'].includes(a.action),normal=a.action==='attack'&&!a.handSpecial261;
  let up=0,down=0;
  if(state(a)?.role==='trainer'){
   if(w==='spear'&&has(a,'doctore_002')||w==='hammer'&&has(a,'doctore_007'))up+=.002;
   if(normal&&((w==='whip'&&has(a,'doctore_024'))||(w==='mace'&&has(a,'doctore_025'))))up+=.002;
   if(w==='halberd'&&a.handSpecial261?.kind==='sweep'&&v.id!==a.handSpecial261.target&&has(a,'doctore_005'))up+=.004;
   if(a.staffCriticalHitV288&&w==='sword'&&has(a,'doctore_016'))base*=1.004;
  }else if(state(a)?.role==='guard'){
   if(has(a,'guard_001'))up+=.0001;
   if(state(a).kind==='worker'&&a.itemProjectile&&has(a,'guard_002'))up+=.002;
  }
  const protection=covered(v,region);
  if(state(v)?.role==='trainer'){
   const id={head:'doctore_012',torso:'doctore_013',arm:'doctore_014',leg:'doctore_015'}[protection];if(id&&has(v,id))down+=.002;
  }else if(state(v)?.role==='guard'){
   if(state(v).kind==='worker'){if(!projectile&&has(v,'guard_014'))down+=.002;}
   else{
    if(v.maxHp>0&&v.hp/v.maxHp<.25&&has(v,'guard_012'))down+=.004;
    const id={head:'guard_017',torso:'guard_018',arm:'guard_019',leg:'guard_020'}[protection];if(id&&has(v,id))down+=.002;
   }
  }
  return base*(1+up)*(1-down);
 }
 function regeneration(f,amount){
  const chef=f?.staffChefV288?.regeneration(amount,f.stamina,f.maxStamina)??amount;
  if(state(f)?.role!=='guard'||state(f).kind!=='gladiator')return chef;
  let rate=has(f,'guard_010')?.002:0;if(f.maxStamina>0&&f.stamina/f.maxStamina<.25&&has(f,'guard_011'))rate+=.004;
  return chef+amount*rate;
 }
 root.StaffCombatV288=Object.freeze({attachArena,attachDefense,attackCost,specialCost,cost,criticalChance,damage,regeneration,covered,weapon,trainerIds:[...TRAINER],guardIds:[...GUARD]});
 if(typeof module!=='undefined')module.exports=root.StaffCombatV288;
})(globalThis);
