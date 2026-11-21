/* Approved care papyri. Values come only from the server's learned snapshot.
 * This module does not infer ownership from catalogue/loot rows. Create one
 * controller per fighter/race; never share event history between combatants.
 */
(function(root){
 'use strict';
 const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function learnedIndex(rows,prefix){
  const map=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
   const id=row.content_id||row.id;
   if(typeof id!=='string'||!id.startsWith(prefix+'_')||row.learned===false||(!row.learned_at&&row.learned!==true))continue;
   const e=row.effect;
   if(!e||e.unit!=='fraction'||!Number.isFinite(Number(e.value))||e.value<0||e.value>1)continue;
   map.set(id,Object.freeze({...e,value:Number(e.value)}));
  }
  const amount=(n)=>map.get(prefix+'_'+String(n).padStart(3,'0'))?.value||0;
  return {amount,has:n=>map.has(prefix+'_'+String(n).padStart(3,'0')),ids:[...map.keys()]};
 }
 function createChef(rows){
  const {amount:v,ids}=learnedIndex(rows,'chef');
  const once=new Set(),specials=new Map();let normalHits=0,blocks=[];
  // Distinct chef knowledge adds its fractional contribution once to the base;
  // duplicate copies were already removed by learnedIndex.
  const combined=(...ns)=>ns.reduce((sum,n)=>sum+v(n),0);
  const max=f=>Math.max(0,finite(f?.maxStamina,100));
  const low=(stamina,maximum)=>maximum>0&&stamina<maximum*.25;
  const single=(id,condition)=>{if(!condition||!v(id)||once.has(id))return 0;once.add(id);return v(id);};
  return {
   ids,
   maximum:base=>Math.max(0,finite(base))*(1+combined(1,9)),
   cost(kind,base){const n={running:[2,13],normal_attack:[3,11],successful_block:[4,10],roll:[5,12],special:[6,15],slide:[16]}[kind]||[];return Math.max(0,finite(base))*(1-combined(...n));},
   regeneration(base,stamina,maximum){return Math.max(0,finite(base))*(1+combined(7,14,...(low(stamina,maximum)?[8]:[])));},
   delay:base=>Math.max(0,finite(base))*(1-v(17)),
   event(kind,data={},fighter={}){
    if(!(finite(fighter.hp,1)>0))return 0;
    const maximum=max(fighter),time=finite(data.time);let fraction=0;
    if(kind==='stand_up')fraction=single(18,data.enemyKnockdown===true);
    if(kind==='kill')fraction=single(19,data.enemy===true);
    if(kind==='assist')fraction=single(24,data.recorded===true);
    if(kind==='clock')fraction=single(25,finite(data.previousTime)<60&&time>=60);
    if(kind==='normal_attack_resolved'){
     normalHits=data.hit===true?normalHits+1:0;
     fraction=single(21,normalHits>=3);
    }
    if(kind==='special_hit'&&data.specialId!==undefined&&data.targetId!==undefined&&data.enemy===true){
     let record=specials.get(data.specialId);if(!record){record={targets:new Set(),used:false};specials.set(data.specialId,record);}
     record.targets.add(data.targetId);
     if(!record.used&&record.targets.size>=2&&v(22)){record.used=true;fraction=v(22);}
    }
    if(kind==='successful_block'){
     fraction+=single(20,low(finite(data.preStamina,maximum),maximum));
     blocks=blocks.filter(b=>time-b.time<=5&&time>=b.time);
     if(data.enemy===true&&data.attackerId!==undefined){
      fraction+=single(23,blocks.some(b=>b.attacker!==data.attackerId));
      blocks.push({time,attacker:data.attackerId});
     }
    }
    return Math.min(Math.max(0,maximum-finite(fighter.stamina)),maximum*fraction);
   },
   reset(){once.clear();specials.clear();normalHits=0;blocks=[];}
  };
 }
 function createGroom(rows){
  const {amount:v,ids}=learnedIndex(rows,'groom');let fifthLapChecked=false;
  const best=(...ns)=>Math.max(0,...ns.map(v));
  const low=c=>finite(c.maxStamina)>0&&finite(c.stamina)<finite(c.maxStamina)*.25;
  return {
   ids,
   nutritionContribution:base=>Math.max(0,finite(base))*(1+v(1)),
   trainingGain:(stat,base)=>Math.max(0,finite(base))*(1+(stat==='stamina'?v(2):stat==='speed'?v(20):0)),
   trainingFatigue:base=>Math.max(0,finite(base))*(1-v(21)),
   raceFatigue:base=>Math.max(0,finite(base))*(1-v(24)),
   stableRecovery:(base,c={})=>Math.max(0,finite(base))*(1+(c.postRace===true&&c.resting===true?v(3):0)),
   acceleration:(base,c={})=>Math.max(0,finite(base))*(1+(v(16)&&c.firstAcceleration===true&&v(22)?0:c.firstAcceleration===true?v(22)||v(16):v(16))),
   turningLoss:(base,c={})=>Math.max(0,finite(base))*(1-(c.curve===true?v(17):0)),
   collisionLoss:base=>Math.max(0,finite(base))*(1-v(18)),
   directionRate:(base,c={})=>Math.max(0,finite(base))*(1+(c.curve===true?v(19):0)),
   maximumSpeed:(base,c={})=>Math.max(0,finite(base))*(1+(c.lap===5?v(23):0)),
   regeneration(base,c={}){const rates=[c.speedTier==='low'?v(10):0,low(c)?v(13):0].filter(Boolean);return Math.max(0,finite(base))*(1+(rates.length===1?rates[0]:0));},
   cost(base,c={}){
    const eligible=[];
    if(c.accelerating===true){
     if(c.firstAcceleration===true)eligible.push(4);
     if(c.firstAccelerationAfterCurve===true)eligible.push(8);
     if(c.curve===false&&c.followingWithinCart===true)eligible.push(11);
     if(c.recoveringCollisionSpeed===true)eligible.push(12);
     if(c.lap===5&&low(c))eligible.push(25);
    }
    if(c.lap===1&&c.speedTier==='medium')eligible.push(5);
    if(c.curve===false&&c.speedTier==='high')eligible.push(6);
    if(c.curve===true&&c.enteredCurveAtMedium===true)eligible.push(7);
    if(finite(c.sameTierSeconds)>=5)eligible.push(9);
    if(c.lap===5&&c.lastStraight===true&&c.speedTier==='high')eligible.push(15);
    return Math.max(0,finite(base))*(1-best(...eligible));
   },
   enterLap(lap,stamina,maximum){
    if(lap!==5||fifthLapChecked)return 0;fifthLapChecked=true;
    return finite(stamina)>=finite(maximum)*.5?Math.min(Math.max(0,maximum-stamina),Math.max(0,maximum)*v(14)):0;
   }
  };
 }
 function installCombat(Combat){
  const p=Combat?.prototype;if(!p||p._chefEventsV288)return;
  Object.defineProperty(p,'_chefEventsV288',{value:true});
  const emit=p.emit,guard=p.guard,hit=p.hit,tick=p.tick;
  const restore=(f,kind,data)=>{if(f?.staffChefV288)f.stamina+=f.staffChefV288.event(kind,data,f);};
  const settleAttack=f=>{
   const attack=f?._chefAttackV288;if(!attack)return;
   restore(f,'normal_attack_resolved',{hit:attack.hit});f._chefAttackV288=null;
  };
  p.emit=function(type,data={}){
   const result=emit.call(this,type,data),f=this.fighters[data.id];
   if(type==='swing'&&f?.staffChefV288){settleAttack(f);f._chefAttackV288={hit:false};}
   if(type==='down'){
    const killer=this.fighters[data.killer];
    restore(killer,'kill',{enemy:!!f&&!!killer&&f!==killer&&f.team!==killer.team});
   }
   if((type==='block'||type==='parry'&&data.perfect===true)&&f?.staffChefV288){
    const attacker=this.fighters[data.source];
    restore(f,'successful_block',{preStamina:f._chefBlockPreV288,time:this.time,attackerId:data.source,enemy:!!attacker&&attacker.team!==f.team});
   }
   // Every live knockdown emission in this engine follows an opponent's hit,
   // shield bash or weapon pull; recovery itself is checked after the full tick.
   if(type==='knockdown'&&f?.staffChefV288)f._chefKnockedV288=true;
   return result;
  };
  p.guard=function(attacker,victim,...args){
   const previous=victim?._chefBlockPreV288;if(victim)victim._chefBlockPreV288=victim.stamina;
   try{return guard.call(this,attacker,victim,...args);}
   finally{if(victim)victim._chefBlockPreV288=previous;}
  };
  p.hit=function(attacker,victim,...args){
   const before=victim?.hp,result=hit.call(this,attacker,victim,...args);
   if(attacker?._chefAttackV288&&Number.isFinite(before)&&victim.hp<before)attacker._chefAttackV288.hit=true;
   return result;
  };
  p.tick=function(...args){
   const before=this.time,result=tick.apply(this,args);
   for(const f of this.fighters){
    if(!f.staffChefV288)continue;
    if(f._chefAttackV288&&(f.action!=='attack'||f.attackSettled))settleAttack(f);
    if(f._chefKnockedV288&&f.hp>0&&f.action!=='knocked'&&!(f.knockedUntil>this.time)&&!(f.stunUntil>this.time)){
     restore(f,'stand_up',{enemyKnockdown:true});f._chefKnockedV288=false;
    }
    if(this.time>before)restore(f,'clock',{previousTime:before,time:this.time});
   }
   return result;
  };
 }
 const api=Object.freeze({learnedIndex,createChef,createGroom,installCombat});
 root.SpecialStaffCareV288=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
