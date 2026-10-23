/* Visual exhibition only. Coupon winner and money remain server-authoritative. */
var PitExhibition=(()=>{
 const step=1/60,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function seed(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n|=0;n=n+0x6D2B79F5|0;let t=Math.imul(n^n>>>15,1|n);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 function create(bout){const c=PitArena.install(new ArenaCombat(seed(bout.id))),count=bout.participants||4; c.fighters=c.fighters.slice(0,count);let at=0,settled=false,winner=null,complete=false,finalTime=0;const hits=[];
  c.fighters.forEach((f,i)=>{f.x=[-4.3,3.8,-2.7,4.6][i];f.z=[2.5,1.1,-3.5,-3.1][i];f.maxHp=f.hp=160;f.maxStamina=f.stamina=200;f.cooldown=i*.23;f.speedBonus=.8;f.attackBonus=.8;f.defenseBonus=.8;f.spareSword=false;});
  const hit=c.hit.bind(c);c.hit=function(a,v,...args){if(settled&&v.id===winner)return false;const old=v.hp;if(!settled)v.hp=Math.max(v.hp,80);const landed=hit(a,v,...args);if(!settled&&v.hp<35)v.hp=35;if(landed&&v.hp<(settled?old:Math.max(old,80)))hits.push({source:a.id,target:v.id,distance:dist(a,v),time:at});return landed;};
  const ai=c.botStep.bind(c);c.botStep=function(f,dt){if(settled){const champion=this.fighters[winner];if(f.id!==winner){f.blocking=false;f.target=winner;const a=Math.atan2(champion.x-f.x,champion.z-f.z);f.angle+=Math.atan2(Math.sin(a-f.angle),Math.cos(a-f.angle))*Math.min(1,dt*6);return;}const t=this.nearest(f);if(!t)return;f.target=t.id;const a=Math.atan2(t.x-f.x,t.z-f.z),d=dist(f,t);f.angle+=Math.atan2(Math.sin(a-f.angle),Math.cos(a-f.angle))*Math.min(1,dt*9);if(d>1.05){f.x+=Math.sin(a)*1.9*dt;f.z+=Math.cos(a)*1.9*dt;f.move=.5;}else if(f.cooldown<=0){f.stamina=200;this.attack(f.id,true,'chest');}return;}ai(f,dt);};
  function tick(){c.finished=false;const p=c.fighters[0],old={x:p.x,z:p.z};let input={};if(p.hp>0&&p.action==='idle'){c.botStep(p,step);input={x:(p.x-old.x)/(4.2*step),z:(p.z-old.z)/(4.2*step),faceAngle:p.angle,block:p.blocking};p.x=old.x;p.z=old.z;}c.tick(step,input);c.drain();at+=step;if(settled){finalTime+=step;complete=c.fighters.filter(f=>f.hp>0).length===1;c.finished=complete;} }
  function update(b,elapsed,dt){if(b.status==='open')return;if(b.status==='settled'&&!settled){settled=true;winner=Number(b.winner);c.fighters.forEach(f=>{f.hp=f.id===winner?Math.max(60,f.hp):1;f.stunUntil=0;f.cooldown=0;f.action='idle';f.timer=0;f.blocking=false;});}
   if(complete){for(const f of c.fighters)if(f.hp<=0)f.deadTime+=dt;return;}
   const desired=settled?at+dt:Math.min(45,elapsed);let budget=90;while(at+step<=desired+1e-8&&budget-->0)tick();
  }
  return{combat:c,update,get hits(){return hits;},get complete(){return complete;},get settled(){return settled;},get elapsed(){return at;},get finalTime(){return finalTime;}};
 }
 return{create};
})();
