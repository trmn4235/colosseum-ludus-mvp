/* Explicit hand actions. No mastery, kill XP, random procs or bonus charges. */
(function(root){
 'use strict';
 const labels={net:'AĞ AT',pull:'ÇEK',sweep:'ALAN VURUŞU',throw:'FIRLAT',double:'İKİ VURUŞ',bash:'İTTİR',breaker:'KALKAN KIR',disarm:'SİLAH DÜŞÜR'};
 function kind(item){
  if(!item)return null;if(item.kind==='shield')return 'bash';
  const w=item.pit_model||item.model;
  if(w==='net')return 'net';if(w==='whip')return 'pull';if(w==='scissor')return 'disarm';
  if(['axe','pit_axe','halberd'].includes(w))return 'sweep';
  if(['spear','trident','trident_gladiator'].includes(w))return 'throw';
  if(['gladius','sica','spatha'].includes(w))return 'double';
  if(['mace','heavy_mace','warhammer','pit_stone_mace','pit_wood_mace'].includes(w))return 'breaker';
  return null;
 }
 const cost=k=>k==='double'?19.5:26;
 const range=(k,w)=>k==='net'?6.2:k==='throw'?9:k==='pull'?2:k==='sweep'?(w==='halberd'?2.5:1.95):k==='double'?1.6:k==='bash'?2.2:1.95;
 function equipped(f,index){return index===1?(f.shield?{kind:'shield'}:f.leftGear?{model:f.leftGear}:f.offhand?{model:f.offhand}:null):f.weapon?{model:f.weapon,pit_model:f.pitWeapon}:null;}
 function install(Combat){
  const P=Combat.prototype;if(P._specials261)return;P._specials261=true;
  const special=P.special,tick=P.tick,breaker=P.shieldBreakerHit,updateNets=P.updateNets;
  P.specialKind=function(f,index=0){return kind(equipped(f,index));};
  P.skillNames=function(f){return [0,1].map(i=>labels[this.specialKind(f,i)]||'BOŞ');};
  P.shieldBreakerHit=function(a,v){if(a.handSpecial261?.kind!=='breaker')return false;v.shieldBreakerHits=1;return breaker.call(this,a,v);};
  P.special=function(id=0,index=0){
   const f=this.fighters[id];if(!f||![0,1].includes(index))return false;
   const k=this.specialKind(f,index);
   if(!['double','sweep','breaker'].includes(k)){
    if(k==='pull'){const target=this.fighters[id===0?this.lockedTarget:f.target];if(!this.enemy(f,target)||Math.hypot(target.x-f.x,target.z-f.z)>2)return false;}
    const left=f.leftGear;if(k==='net'&&index===0)f.leftGear='net';
    let ok;try{ok=special.call(this,id,index);}finally{if(k==='net'&&index===0)f.leftGear=left;}
    if(ok&&k==='net'){f.activeNetHand261=index;f.attackLeft=!!index;this.nets.at(-1).hand=index;}
    return ok;
   }
   if(this.finished||f.hp<=0||f.action!=='idle'||f.cooldown>0||f.stunUntil>this.time||f.stamina<cost(k)||(f.skillReady?.[index]||0)>this.time)return false;
   const w=index?f.offhand:f.weapon,r=range(k,w),locked=this.fighters[id===0?this.lockedTarget:f.target];
   const t=this.enemy(f,locked)&&Math.hypot(locked.x-f.x,locked.z-f.z)<=r?locked:this.nearest(f,r);if(!t)return false;
   if(!this.attack(id,false,'chest'))return false;
   f.stamina-=k==='double'?0:13;f.angle=Math.atan2(t.x-f.x,t.z-f.z);f.attackLeft=!!index;f.attackWeapon=w;f.attackCounterTarget=null;
   f.handSpecial261={kind:k,index,weapon:w,target:t.id,start:this.time,stage:0};
   f.skillReady??=[0,0];f.skillReady[index]=this.time+8;
   const p=root.ArenaMotion.profile(w,false,id!==0);f.attackProfile={...p,wind:k==='double'?.12:.30,active:.10,recover:.12,duration:k==='double'?.34:.52};
   f.duration=f.attackProfile.duration;f.hitVictims=new Set(this.fighters.map(v=>v.id));
   this.emit('special',{id,target:t.id,kind:k});return true;
  };
  P.updateNets=function(dt){const saved=[];for(const f of this.fighters)if(f.activeNetHand261===0&&f.netBusy){saved.push([f,f.leftGear]);f.leftGear=f.weapon==='net'?'net':null;}try{return updateNets.call(this,dt);}finally{for(const [f,left]of saved)f.leftGear=left;}};
  P.tick=function(dt,input){
   for(const a of this.fighters){const s=a.handSpecial261;if(!s)continue;
    if(a.hp<=0||a.stunUntil>this.time||!['attack','idle'].includes(a.action)||(s.index?a.offhand:a.weapon)!==s.weapon){delete a.handSpecial261;continue;}
    const elapsed=this.time-s.start;
    if(s.kind==='double'&&s.stage===1&&elapsed>=.34){
     if(a.stamina<6.5){delete a.handSpecial261;continue;}
     a.stamina-=6.5;a.action='attack';a.timer=0;a.chain=2;a.hitVictims=new Set(this.fighters.map(v=>v.id));a.hitDone=false;a.attackSettled=true;a.duration=.34;s.stage=2;
    }
    const due=s.kind==='double'?(s.stage===0?.17:s.stage===2?.51:Infinity):.35;
    if(elapsed>=due){
     const t=this.fighters[s.target],r=range(s.kind,s.weapon),targets=this.enemy(a,t)?[t]:[];
     if(s.kind==='sweep'&&t){const other=this.fighters.filter(v=>v!==t&&this.enemy(a,v)&&Math.hypot(v.x-t.x,v.z-t.z)<=1.8&&Math.hypot(v.x-a.x,v.z-a.z)<=r).sort((x,y)=>Math.hypot(x.x-t.x,x.z-t.z)-Math.hypot(y.x-t.x,y.z-t.z))[0];if(other)targets.push(other);}
     for(const v of targets){if(Math.hypot(v.x-a.x,v.z-a.z)>r)continue;this.hit(a,v,false);}
     if(s.kind!=='double'||s.stage===2)delete a.handSpecial261;else s.stage=1;
    }
   }
   return tick.call(this,dt,input);
  };
 }
 root.HandSpecials={kind,cost,range,labels,equipped,install};
 if(typeof module!=='undefined')module.exports=root.HandSpecials;
})(globalThis);
