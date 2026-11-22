/* V289: observation of authoritative replay only. No damage, RNG or timing changes. */
((root)=>{
 'use strict';
 const facts=new WeakMap(),contacts=new WeakMap();
 const contactWrappers=new WeakSet();
 function closest(a,b,p){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=dx*dx+dy*dy+dz*dz,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/d)):0;return{x:a.x+dx*t,y:a.y+dy*t,z:a.z+dz*t};}
 function watchContact(){
  const M=root.ArenaMotion;if(!M?.contact||contactWrappers.has(M.contact))return;const original=M.contact;
  const wrapped=function(a,v,from,to){const hit=original.call(this,a,v,from,to);contacts.delete(a);
   if(hit&&['leftArm','rightArm'].includes(a.attackRegion)){
    const target=M.target(v,a.attackRegion),one=M.sample(a,from),two=M.sample(a,to),segments=[],world=p=>M.world(a,p);let margin=.07;
    if(['spear','trident','trident_gladiator'].includes(a.attackWeapon)&&a.motionVersion===163){margin=.045;segments.push([world(one.tip),world(two.tip)],[world({x:two.tip.x-two.dir.x*.18,y:two.tip.y-two.dir.y*.18,z:two.tip.z-two.dir.z*.18}),world(two.tip)]);}
    else if(a.attackWeapon==='mace'||a.pitWeapon&&a.attackWeapon==='heavy_mace'){margin=.14;segments.push([world(one.tip),world(two.tip)]);}
    else for(let i=1;i<two.points.length;i++)segments.push([world(one.points[i-1]),world(one.points[i])],[world(two.points[i-1]),world(two.points[i])],[world(one.points[i]),world(two.points[i])]);
    if(segments.some(([p,q])=>{const c=closest(p,q,target),rise=c.y-target.y;return Math.hypot(c.x-target.x,c.y-target.y,c.z-target.z)<target.r+margin&&rise>=.10&&rise<=.24;}))contacts.set(a,{victim:v,time:to});
   }return hit;};contactWrappers.add(wrapped);M.contact=wrapped;
 }
 const entry=f=>{let x=facts.get(f);if(!x){x={};facts.set(f,x);}return x;};
 function install(Combat){
  const p=Combat.prototype;if(Object.prototype.hasOwnProperty.call(p,'injuryObservedV289'))return;
  if(root.ArenaAuthoredCombat){const authored=root.ArenaAuthoredCombat.install;root.ArenaAuthoredCombat.install=function(...args){const result=authored.apply(this,args);watchContact();return result;};}watchContact();
  Object.defineProperty(p,'injuryObservedV289',{value:true});
  const damage=p.damage,emit=p.emit,tick=p.tick;
  p.damage=function(attacker,victim,base,region='chest',heavy=false,point=null){
   const before=victim?.hp,contact=contacts.get(attacker),shoulder=attacker?.action==='attack'&&attacker.attackRegion===region&&contact?.victim===victim&&Math.abs(Number(attacker.timer)-contact.time)<.05,result=damage.call(this,attacker,victim,base,region,heavy,point);
   const loss=Number(before)-Number(victim?.hp);
   if(victim&&attacker&&attacker.team!==victim.team&&Number.isFinite(loss)&&loss>0){
    const f=entry(victim),hard=heavy===true||loss>=Math.max(1,Number(victim.maxHp||100)*.25);
    if(region==='head')f.head_hit=true;
    if(['leftArm','rightArm'].includes(region)){
     f.arm_hit=true;f[region==='leftArm'?'arm_left_hit':'arm_right_hit']=true;
     // The actual swept weapon intersects the upper band of the arm collider.
     // Generic arm targeting and animation height alone cannot establish this.
     if(shoulder)f.shoulder_hit=true;
    }
    if(region==='chest'){f.torso_hit=true;if(hard)f.heavy_torso_hit=true;}
    if(['legs','leftLeg','rightLeg'].includes(region)){f.leg_hit=true;if(region!=='legs')f[region==='leftLeg'?'leg_left_hit':'leg_right_hit']=true;if(hard)f.heavy_leg_hit=true;}
    if(victim.action==='knocked'){f.fall=true;if(hard)f.hard_fall=true;}
   }
   return result;
  };
  p.emit=function(type,data){
   if(type==='knockdown'&&this.fighters?.[data?.id]){const victim=this.fighters[data.id],f=entry(victim);f.fall=true;if(Number(victim.duration)>=1.5)f.hard_fall=true;}
   return emit.call(this,type,data);
  };
  p.tick=function(...args){
   const before=(this.fighters||[]).map(f=>[f,Number(f.x),Number(f.z)]),result=tick.apply(this,args);
   for(const[f,x,z]of before)if(Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(Number(f.x)-x,Number(f.z)-z)>.00001)entry(f).movement=true;
   return result;
  };
 }
 function participants(sim){return sim.ticket.team.map((g,i)=>({id:g.id,flags:{...(facts.get(sim.combat.fighters[i])||{})}}));}
 const api=Object.freeze({install,participants});root.InjuryEventsV289=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
