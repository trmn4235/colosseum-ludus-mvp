/* Survival: one player, five seconds of preparation, unbounded decimal milestones. */
var LudusSurvival=(()=>{
 'use strict';
 function count(stage){
  if(!Number.isSafeInteger(stage)||stage<1)throw new RangeError('Stage pozitif bir tam sayı olmalı.');
  return stage%10===0?stage/10:1;
 }
 function total(stage){const n=Math.floor(stage/10);return stage+n*(n-1)/2;}
 function spawn(combat){
  const s=combat.survival,p=combat.fighters[0];
  s.stage++;s.count=count(s.stage);s.revision++;
  const retired=combat.fighters.slice(1);
  for(const e of combat.events){if(e.id!==undefined)e.survivalFighter=combat.fighters[e.id];if(e.target!==undefined)e.survivalTarget=combat.fighters[e.target];}
  combat.fighters=[p];combat.lockedTarget=null;
  // References to the retired wave must never attach to a newly reused fighter ID.
  combat.nets=[];combat.projectiles=[];combat.drops=[];
  p.counterTarget=null;p.counterUntil=0;p.specialTarget=null;p.hookTarget=null;
  p.shieldHeldBy=null;p.netBusy=false;p.hitVictims=new Set();
  if(p.skillMotion){p.skillMotion=null;if(p.action==='hook'){p.action='idle';p.timer=0;}}
  for(let i=0;i<s.count;i++){
   const template=s.templates[(s.stage-1+i)%s.templates.length],a=Math.PI*2*i/s.count+s.stage*.71;
   const f={...template,id:i+1,team:1,target:0,think:0,timer:0,cooldown:.25,
    x:Math.sin(a)*13,z:Math.cos(a)*13,body:{...template.body},wear:{...template.wear},hitVictims:new Set()};
   f.angle=Math.atan2(p.x-f.x,p.z-f.z);f.survivalActor=template.id;
   combat.configureSurvivalEnemy?.(f);combat.fighters.push(f);
  }
  combat.emit('survivalstage',{stage:s.stage,count:s.count,retired});
 }
 function install(Combat){
  if(Combat.prototype.survivalV83)return;const P=Combat.prototype;
  P.survivalV83=true;
  const reset=P.reset,tick=P.tick;
  P.reset=function(difficulty,playerType,mode){
   reset.call(this,difficulty,playerType,mode);this.survival=null;
   if(mode==='survival'){
    this.survival={stage:0,completed:0,count:0,revision:0,templates:this.fighters.slice(1)};
    this.fighters=[this.fighters[0]];this.allowDrops=false;
    Object.assign(this.fighters[0],{x:0,z:2,angle:Math.PI});
   }return this;
  };
  P.tick=function(dt,input){
   if(this.finished)return;
   tick.call(this,dt,input);
   if(!this.survival||this.finished)return;
   const s=this.survival;
   if(s.stage===0){if(this.time+1e-8>=5)spawn(this);}
   else if(!this.fighters.slice(1).some(f=>f.hp>0)){s.completed=s.stage;spawn(this);}
  };
 }
 function recordText(r){return r?'STAGE '+r.stage+' · '+r.ludus_name+' · '+r.gladiator_name+' ('+(typeof ArenaClasses!=='undefined'?ArenaClasses[r.gladiator_class]?.name||r.gladiator_class:r.gladiator_class)+')':'Henüz rekor yok · İlk rekoru sen yaz.';}
 return {count,total,install,recordText};
})();
if(typeof module!=='undefined')module.exports=LudusSurvival;
