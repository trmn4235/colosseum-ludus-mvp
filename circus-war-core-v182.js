/* Unranked Circus combat. Fixed-step, deterministic local simulation; no wallet or persistent damage. */
var CircusWarCore=(()=>{
 'use strict';
 const DT=.05,LENGTH=792+70*Math.PI,LAPS=7,TOTAL=LENGTH*LAPS,ARROW_SPEED=65,RANGE=48,GRAVITY=5;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
 function course(distance,lane=0){let s=((distance%LENGTH)+LENGTH)%LENGTH,r=35+lane;if(s<396)return{x:r,z:-198+s,yaw:0,curve:false};s-=396;if(s<Math.PI*35){const a=s/35;return{x:r*Math.cos(a),z:198+r*Math.sin(a),yaw:-a,curve:true};}s-=Math.PI*35;if(s<396)return{x:-r,z:198-s,yaw:Math.PI,curve:false};const a=(s-396)/35;return{x:-r*Math.cos(a),z:-198-r*Math.sin(a),yaw:Math.PI-a,curve:true};}
 function bounds(distance){return globalThis.CircusPhysics.bounds(distance);}
 function initial(roster,seed=182){return{version:182,tick:0,time:0,seed:seed>>>0,serial:0,role:0,aimYaw:0,aimPitch:0,arrows:[],events:[],winner:null,done:false,teams:roster.map((r,i)=>({name:r.name,crew:r.crew.map(g=>({...g,maxHp:100,hp:100})),horses:r.horses.map(h=>({...h})),distance:0,lane:[-11,-4,3,10][i],heading:0,speed:0,wall:0,impact:0,stamina:100,boostUntil:0,nextBoost:7+i*2,nextShot:9+i*2,drawUntil:0,shotYaw:0,shotPitch:0,driver:0,archer:1,finish:null,eliminated:false,rank:i+1,quality:r.quality||70}))};}
 function random(s){s.seed=(1664525*s.seed+1013904223)>>>0;return s.seed/4294967296;}
 function point(t,role){const p=course(100+t.distance,t.lane),yaw=p.yaw+t.heading,z=role===t.driver?.30:-.72;return{x:p.x+Math.sin(yaw)*z,y:2.05,z:p.z+Math.cos(yaw)*z};}
 function origin(t){const p=point(t,t.archer);p.y=2.12;return p;}
 function direction(yaw,pitch){return{x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};}
 function segmentSphere(a,b,c,r){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,mx=a.x-c.x,my=a.y-c.y,mz=a.z-c.z,A=dx*dx+dy*dy+dz*dz;if(A<1e-12)return null;const B=mx*dx+my*dy+mz*dz,C=mx*mx+my*my+mz*mz-r*r;if(C<=0)return 0;const d=B*B-A*C;if(d<0)return null;const u=(-B-Math.sqrt(d))/A;return u>=0&&u<=1?u:null;}
 function obstacle(p){if(p.y<=.08)return true;const x=Math.abs(p.x),z=p.z;if(x>48||z>295||z< -310)return true;return p.y<5&&x<6.3&&z> -205&&z<215;}
 // Only crew has damageable hit volumes. Horses and cart block a low shot without taking damage.
 function trace(s,owner,a,b,previous=null){let best=null;
  for(let i=0;i<s.teams.length;i++){if(i===owner)continue;const t=s.teams[i];if(t.eliminated||t.finish!==null)continue;
   for(let j=0;j<2;j++){if(t.crew[j].hp<=0)continue;const c=point(t,j),old=previous?.[i]?.[j]||c,rel={x:a.x+c.x-old.x,y:a.y+c.y-old.y,z:a.z+c.z-old.z};const u=segmentSphere(rel,b,c,.38);if(u!==null&&(!best||u<best.u))best={u,team:i,role:j};}
   const p=course(100+t.distance,t.lane),yaw=p.yaw+t.heading;
   for(const h of [-.75,.75]){const c={x:p.x+Math.sin(yaw)*2.4+Math.cos(yaw)*h,y:1.25,z:p.z+Math.cos(yaw)*2.4-Math.sin(yaw)*h};const u=segmentSphere(a,b,c,.73);if(u!==null&&(!best||u<best.u))best={u,blocked:'horse'};}
   const u=segmentSphere(a,b,{x:p.x,y:.65,z:p.z},1.05);if(u!==null&&(!best||u<best.u))best={u,blocked:'cart'};
  }
  const len=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),steps=Math.max(1,Math.ceil(len/.35));for(let k=1;k<=steps;k++){const u=k/steps;if(best&&u>=best.u)break;const p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};if(obstacle(p)){best={u,blocked:'wall'};break;}}
  return best;
 }
 function aim(s){const t=s.teams[3],start=origin(t),yaw=course(100+t.distance,t.lane).yaw+t.heading+s.aimYaw,dir=direction(yaw,s.aimPitch);let a=start,hit=null,end=a;for(let k=1;k<=64;k++){const time=k*RANGE/ARROW_SPEED/64,b={x:start.x+dir.x*ARROW_SPEED*time,y:start.y+dir.y*ARROW_SPEED*time-GRAVITY*time*time/2,z:start.z+dir.z*ARROW_SPEED*time};hit=trace(s,3,a,b);end=hit?{x:a.x+(b.x-a.x)*hit.u,y:a.y+(b.y-a.y)*hit.u,z:a.z+(b.z-a.z)*hit.u}:b;if(hit)break;a=b;}return{start,end,hit,yaw,pitch:s.aimPitch};}
 function damage(s,team,role){const t=s.teams[team],g=t?.crew[role];if(!g||g.hp<=0||t.eliminated||t.finish!==null)return false;g.hp=Math.max(0,g.hp-g.maxHp*.5);s.events.push({kind:'hit',team,role,time:s.time});if(g.hp===0){g.downAt=s.time;t.drawUntil=0;if(t.crew.every(g=>g.hp<=0)){t.eliminated=true;t.speed=0;s.events.push({kind:'out',team,time:s.time});}else{t.driver=t.crew.findIndex(g=>g.hp>0);t.archer=-1;if(team===3)s.role=t.driver;}}return true;}
 function switchRole(s){const t=s.teams[3];if(s.done||t.eliminated||t.finish!==null||t.archer<0)return false;s.role=s.role===t.driver?t.archer:t.driver;t.drawUntil=0;s.aimYaw=0;s.aimPitch=.015;return true;}
 function boost(s,t){if(s.time<t.nextBoost||t.stamina<25||t.eliminated||t.finish!==null)return false;t.stamina-=25;t.boostUntil=s.time+3.2;t.nextBoost=s.time+7;return true;}
 function draw(s,t,yaw,pitch){if(t.archer<0||t.crew[t.archer].hp<=0||s.time<t.nextShot||t.drawUntil||t.eliminated||t.finish!==null)return false;t.shotYaw=yaw;t.shotPitch=clamp(pitch,-.45,.5);t.drawUntil=s.time+.55;t.nextShot=s.time+1.65;return true;}
 function botShot(s,i){const t=s.teams[i];if(s.time<t.nextShot||t.archer<0)return;const a=origin(t),targets=[];for(let j=0;j<s.teams.length;j++){const q=s.teams[j];if(i===j||q.eliminated||q.finish!==null)continue;for(let r=0;r<2;r++){if(q.crew[r].hp<=0)continue;const p=point(q,r),d=Math.hypot(p.x-a.x,p.z-a.z);if(d>5&&d<40)targets.push({p,q,r,d});}}if(!targets.length){t.nextShot=s.time+.65;return;}
  const target=targets.sort((a,b)=>a.d-b.d)[0],p=target.p,q=target.q,pose=course(100+q.distance,q.lane),flight=target.d/ARROW_SPEED,error=(random(s)-.5)*.13;const x=p.x+Math.sin(pose.yaw+q.heading)*q.speed*flight-a.x,z=p.z+Math.cos(pose.yaw+q.heading)*q.speed*flight-a.z;
  if(draw(s,t,Math.atan2(x,z)+error,Math.atan2(p.y-a.y+GRAVITY*flight*flight/2,Math.hypot(x,z))+(random(s)-.5)*.035))t.nextShot=s.time+6+random(s)*5;
 }
 function autopilot(t,i){const p=course(100+t.distance,t.lane),lim=bounds(100+t.distance+14),desired=clamp([-10,-3,4,9][i],lim[0]+1.5,lim[1]-1.5),heading=clamp((desired-t.lane)*.14,-.55,.55),curve=p.curve?t.speed/(35+t.lane):0;return clamp((angle(heading-t.heading)*3.5-curve)/.85,-1,1);}
 function step(s,input={}){if(s.done)return s;s.tick++;s.time=s.tick*DT;s.events=[];if(s.time<3)return s;if(input.switch)switchRole(s);const own=s.teams[3];if(Number.isFinite(input.yaw))s.aimYaw=angle(input.yaw);if(Number.isFinite(input.pitch))s.aimPitch=clamp(input.pitch,-.45,.5);
  const previous=s.teams.map(t=>t.crew.map((g,j)=>point(t,j)));
  for(let i=0;i<4;i++){const t=s.teams[i];if(t.eliminated||t.finish!==null)continue;const manual=i===3&&s.role===t.driver;
   if((manual&&input.boost)||(!manual&&s.time>=t.nextBoost))boost(s,t);
   const p=course(100+t.distance,t.lane),turn=manual?clamp(input.steer||0,-1,1):autopilot(t,i),scale=p.curve?Math.max(.3,1+t.lane/35):1;
   t.heading=clamp(t.heading+(turn*.85+(p.curve?t.speed/(35*scale):0))*DT,-1.2,1.2);
   const target=(17.2+clamp(t.quality,0,100)*.018)*(s.time<t.boostUntil?1.35:1)*(t.archer<0?.94:1);t.speed+=clamp(target-t.speed,-8*DT,3.4*DT);t.stamina=Math.min(100,t.stamina+DT*2.5);t.impact=Math.max(0,t.impact-DT);
   const d=t.distance+Math.max(0,Math.cos(t.heading))*t.speed*DT/scale,lim=bounds(100+d),lane=t.lane+Math.sin(t.heading)*t.speed*DT;
   if(lane<lim[0]+.35||lane>lim[1]-.35){if(t.wall===0){t.speed*=.58;t.impact=.7;}t.wall+=DT;t.speed=Math.max(0,t.speed-(5+t.wall*7)*DT);if(t.wall>2.5)t.speed=0;}else t.wall=0;
   t.lane=clamp(lane,lim[0]+.35,lim[1]-.35);t.distance=d;
   if(t.distance>=TOTAL){t.distance=TOTAL;t.finish=s.time;t.speed=0;t.drawUntil=0;}
  }
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=s.teams[i],b=s.teams[j];if(a.eliminated||b.eliminated||a.finish!==null||b.finish!==null)continue;if(Math.abs(a.distance-b.distance)<4.7&&Math.abs(a.lane-b.lane)<2.6){const sign=a.lane>=b.lane?1:-1;a.lane+=sign*.07;b.lane-=sign*.07;if(!a.impact&&!b.impact){a.speed*=.65;b.speed*=.65;a.impact=b.impact=.6;}for(const t of[a,b]){const lim=bounds(100+t.distance);t.lane=clamp(t.lane,lim[0]+.35,lim[1]-.35);}}}
  for(let i=0;i<4;i++){const t=s.teams[i];if(t.eliminated||t.finish!==null)continue;if(i===3&&s.role===t.archer){if(input.fire)draw(s,t,course(100+t.distance,t.lane).yaw+t.heading+s.aimYaw,s.aimPitch);}else botShot(s,i);
   if(t.drawUntil&&s.time>=t.drawUntil){const p=origin(t),dir=direction(t.shotYaw,t.shotPitch);s.arrows.push({id:++s.serial,owner:i,...p,vx:dir.x*ARROW_SPEED,vy:dir.y*ARROW_SPEED,vz:dir.z*ARROW_SPEED,remaining:RANGE});t.drawUntil=0;s.events.push({kind:'shot',team:i,time:s.time});}
  }
  for(const a of s.arrows){const b={x:a.x+a.vx*DT,y:a.y+a.vy*DT-GRAVITY*DT*DT/2,z:a.z+a.vz*DT},hit=trace(s,a.owner,a,b,previous);if(hit){if(hit.team!==undefined)damage(s,hit.team,hit.role);a.remaining=0;}else{Object.assign(a,b);a.vy-=GRAVITY*DT;a.remaining-=ARROW_SPEED*DT;}}
  s.arrows=s.arrows.filter(a=>a.remaining>0);const order=s.teams.map((t,i)=>({t,i})).sort((a,b)=>a.t.eliminated-b.t.eliminated||(a.t.finish??Infinity)-(b.t.finish??Infinity)||b.t.distance-a.t.distance);order.forEach(({t},i)=>t.rank=i+1);
  const first=s.teams.map((t,i)=>({t,i})).filter(x=>x.t.finish!==null).sort((a,b)=>a.t.finish-b.t.finish)[0];if(first){s.winner=first.i;s.done=true;}else if(own.eliminated||s.time>900){s.done=true;s.winner=null;}return s;
 }
 return{DT,LENGTH,LAPS,TOTAL,ARROW_SPEED,RANGE,GRAVITY,course,initial,step,aim,trace,damage,switchRole,point,origin,direction,autopilot};
})();
if(typeof module!=='undefined')module.exports=CircusWarCore;
