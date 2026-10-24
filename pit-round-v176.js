/* Şan Avlusu: ten entrants, either a four-person rolling fight or five pairs. */
var PitRound=(()=>{
 'use strict';
 function install(combat,ticket,arena,loadout){
  const snap=ticket.snapshot,mode=snap.pit_mode;
  if(!['1x10','2x5'].includes(mode))throw Error('Avlu müsabakası tanınamadı.');
  const pairs=mode==='2x5',roster=snap.pit_roster;
  if(!Array.isArray(roster)||roster.length!==10)throw Error('Müsabaka listesi tamamlanamadı.');
  combat.fighters=combat.fighters.slice(0,10);combat.mode='solo20';combat.allowDrops=false;combat.bound=arena.clamp;
  combat.pitRound={mode,total:10,entered:pairs?10:4,nextEntryAt:0};
  combat.fighters.forEach((f,i)=>{
   const entry=roster[i],g=i===0?snap.gladiator:pairs&&i===1?snap.teammate:entry;
   f.type=g.class;f.gearBase=g;f.team=pairs?Math.floor(i/2):i;
   f.house=entry.house;f.pitAttackRate=1.2;f.equipment={};
   for(const loan of ticket.loot||[])if(loan.actor===i)f.equipment.weapon=loan;
   loadout.refresh(f,true);arena.equip(f,f.equipment.weapon?.item);
   f.name=g.name;f.pitWaiting=!pairs&&i>=4;
   const angle=(pairs?Math.floor(i/2)/5:i/4)*Math.PI*2,side=pairs?(i%2?1:-1)*1.05:0;
   f.x=Math.sin(angle)*arena.half.x*.64+Math.cos(angle)*side;
   f.z=Math.cos(angle)*arena.half.z*.64-Math.sin(angle)*side;
   f.angle=Math.atan2(-f.x,-f.z);arena.clamp(f);
   if(f.pitWaiting){f.hp=0;f.x=0;f.z=-arena.half.z;}
  });
  combat.advancePit=()=>{
   const round=combat.pitRound;
   if(pairs||combat.fighters[0].hp<=0||round.entered===10||combat.time<round.nextEntryAt)return;
   if(combat.fighters.filter(f=>!f.pitWaiting&&f.hp>0).length>=4)return;
   const f=combat.fighters[round.entered],living=combat.fighters.filter(v=>!v.pitWaiting&&v.hp>0);
   const gates=[{x:0,z:-arena.bounds.z+.2},{x:0,z:arena.bounds.z-.2}];
   gates.sort((a,b)=>Math.min(...living.map(v=>Math.hypot(b.x-v.x,b.z-v.z)),100)-Math.min(...living.map(v=>Math.hypot(a.x-v.x,a.z-v.z)),100));
   Object.assign(f,gates[0],{hp:f.maxHp,stamina:f.maxStamina,deadTime:0,pitWaiting:false,action:'idle',timer:0,cooldown:.5,target:null,think:0});
   f.angle=Math.atan2(-f.x,-f.z);round.entered++;round.nextEntryAt=combat.time+.65;
   combat.emit('pitentry',{id:f.id,name:f.name,entered:round.entered,total:10});
  };
  if(combat.fighters.some(f=>f.pitBow))PitArchery.install(combat,arena.bounds);
  return combat;
 }
 function score(combat){
  const r=combat.pitRound;if(!r)return combat.fighters.length+' KİŞİ · '+combat.fighters.filter(f=>f.hp>0).length+' AYAKTA';
  const living=combat.fighters.filter(f=>!f.pitWaiting&&f.hp>0);
  return r.mode==='1x10'?`1x10 · ${r.entered}/10 · ${living.length} ayakta`:`2x5 · ${new Set(living.map(f=>f.team)).size}/5 takım · ${living.length}/10 ayakta`;
 }
 function stats(combat){
  const r=combat.pitRound;
  return {opponents_defeated:combat.fighters.filter(f=>f.team!==0&&!f.pitWaiting&&f.hp<=0).length,...(r?{pit_mode:r.mode,entrants:r.entered,team_alive:combat.alive(0),team_members:combat.fighters.filter(f=>f.team===0).map(f=>({id:f.gearBase.id,alive:f.hp>0}))}:{})};
 }
 return {install,score,stats};
})();
if(typeof module!=='undefined')module.exports=PitRound;
