/* Seven-lap local war race. World metres, fixed 50 ms steps, no persistent injuries. */
var CircusWarCore = (() => {
 'use strict';
 const DT=.05,LENGTH=792+70*Math.PI,LAPS=7,TOTAL=LENGTH*LAPS;
 const JAVELIN_SPEED=36,ARROW_SPEED=JAVELIN_SPEED,RANGE=44,GRAVITY=9.81;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const out=t=>t.eliminated||t.broken;
 function course(distance,lane=0){let s=((distance%LENGTH)+LENGTH)%LENGTH,r=35+lane;if(s<396)return{x:r,z:-198+s,yaw:0,curve:false};s-=396;if(s<Math.PI*35){const a=s/35;return{x:r*Math.cos(a),z:198+r*Math.sin(a),yaw:-a,curve:true};}s-=Math.PI*35;if(s<396)return{x:-r,z:198-s,yaw:Math.PI,curve:false};const a=(s-396)/35;return{x:-r*Math.cos(a),z:-198-r*Math.sin(a),yaw:Math.PI-a,curve:true};}
 const bounds=d=>globalThis.CircusPhysics.bounds(d);
 function initial(roster,seed=183){return{version:183,tick:0,time:0,seed:seed>>>0,serial:0,role:0,aimYaw:0,aimPitch:0,lock:null,lockKind:'crew',arrows:[],events:[],winner:null,done:false,teams:roster.map((r,i)=>({name:r.name,crew:r.crew.map(g=>({...g,maxHp:100,hp:100,duck:0})),horses:r.horses.map(h=>({...h})),distance:0,lane:[-11,-4,3,10][i],heading:0,turn:0,slip:0,speed:0,wall:0,impact:0,stamina:100,boostUntil:0,nextBoost:3,lastAttempt:-100,misses:0,lastHit:null,nextShot:i===3?3:7+i*2,drawUntil:0,shotYaw:0,shotPitch:0,lastShot:-10,nextWhip:0,whipStart:null,whip:null,driver:0,archer:1,wheels:[0,0],broken:false,finish:null,eliminated:false,rank:i+1,quality:r.quality||70}))};}
 function random(s){s.seed=(1664525*s.seed+1013904223)>>>0;return s.seed/4294967296;}
 function local(t,x,y,z){const p=course(100+t.distance,t.lane),yaw=p.yaw+t.heading;return{x:p.x+Math.sin(yaw)*z+Math.cos(yaw)*x,y,z:p.z+Math.cos(yaw)*z-Math.sin(yaw)*x};}
 function point(t,role){return local(t,0,2.05-(t.crew[role]?.duck||0)*.78,role===t.driver?.30:-.72);}
 function wheelPoint(t,side){return local(t,side?1.15:-1.15,.63,0);}
 function origin(t,role=t.archer){return local(t,-.23,2.23-(t.crew[role]?.duck||0)*.78,role===t.driver?.6:-.43);}
 function direction(yaw,pitch){return{x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};}
 function velocity(t){const p=course(100+t.distance,t.lane),y=p.yaw+t.heading;return{x:Math.sin(y)*t.speed,y:0,z:Math.cos(y)*t.speed};}
 function segmentSphere(a,b,c,r){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,mx=a.x-c.x,my=a.y-c.y,mz=a.z-c.z,A=dx*dx+dy*dy+dz*dz;if(A<1e-12)return null;const B=mx*dx+my*dy+mz*dz,C=mx*mx+my*my+mz*mz-r*r;if(C<=0)return 0;const d=B*B-A*C;if(d<0)return null;const u=(-B-Math.sqrt(d))/A;return u>=0&&u<=1?u:null;}
 function segmentCart(a,b,t){const pose=course(100+t.distance,t.lane),yaw=pose.yaw+t.heading;
  const toLocal=p=>({x:(p.x-pose.x)*Math.cos(yaw)-(p.z-pose.z)*Math.sin(yaw),y:p.y,z:(p.x-pose.x)*Math.sin(yaw)+(p.z-pose.z)*Math.cos(yaw)}),p=toLocal(a),q=toLocal(b);let lo=0,hi=1;
  for(const[k,min,max]of[['x',-.92,.92],['y',.3,1.38],['z',-1.32,.75]]){const d=q[k]-p[k];if(Math.abs(d)<1e-9){if(p[k]<min||p[k]>max)return null;}else{let u=(min-p[k])/d,v=(max-p[k])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return null;}}return lo;
 }
 function obstacle(p){if(p.y<=.08)return true;const x=Math.abs(p.x),z=p.z;if(x>48||z>295||z< -310)return true;return p.y<5&&x<6.3&&z> -205&&z<215;}
 function trace(s,owner,a,b,previous=null){let best=null;const accept=h=>{if(h.u!==null&&(!best||h.u<best.u))best=h;};
  for(let i=0;i<s.teams.length;i++){if(i===owner)continue;const t=s.teams[i];if(t.eliminated||t.finish!==null)continue;
   for(let j=0;j<2;j++){if(t.crew[j].hp<=0)continue;const c=point(t,j),old=previous?.[i]?.crew?.[j]||c,rel={x:a.x+c.x-old.x,y:a.y+c.y-old.y,z:a.z+c.z-old.z};accept({u:segmentSphere(rel,b,c,t.crew[j].duck>.5?.24:.34),team:i,role:j,kind:'crew'});}
   for(let side=0;side<2;side++){const c=wheelPoint(t,side),old=previous?.[i]?.wheels?.[side]||c,rel={x:a.x+c.x-old.x,y:a.y,z:a.z+c.z-old.z};accept({u:segmentSphere(rel,b,c,.48),team:i,side,kind:'wheel'});}
   for(const h of[-.75,.75])accept({u:segmentSphere(a,b,local(t,h,1.25,2.4),.73),blocked:'horse'});
   accept({u:segmentCart(a,b,t),blocked:'cart'});
  }
  const len=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),steps=Math.max(1,Math.ceil(len/.35));for(let k=1;k<=steps;k++){const u=k/steps;if(best&&u>=best.u)break;const p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};if(obstacle(p)){best={u,blocked:'wall'};break;}}return best;
 }
 function targetPoint(s,target){const t=s.teams[target?.team];if(!t||out(t)||t.finish!==null)return null;if(target.kind==='wheel')return wheelPoint(t,target.side);return t.crew[target.role]?.hp>0?point(t,target.role):null;}
 function targets(s,kind=s.lockKind){const t=s.teams[3],a=origin(t,s.role),yaw=course(100+t.distance,t.lane).yaw+t.heading+s.aimYaw,result=[];
  for(let i=0;i<3;i++){const q=s.teams[i];if(out(q)||q.finish!==null)continue;for(let r=0;r<2;r++){const item=kind==='wheel'?{team:i,kind,side:r}:{team:i,kind:'crew',role:r},p=targetPoint(s,item);if(!p)continue;const distance=Math.hypot(p.x-a.x,p.z-a.z);if(distance>RANGE)continue;const obstruction=trace(s,3,a,p);if(obstruction?.blocked)continue;result.push({...item,distance,score:Math.abs(angle(Math.atan2(p.x-a.x,p.z-a.z)-yaw))+distance*.015});}}
  return result.sort((a,b)=>a.score-b.score);
 }
 const sameTarget=(a,b)=>a&&b&&a.team===b.team&&a.kind===b.kind&&a.role===b.role&&a.side===b.side;
 function lockNext(s,changeKind=false){if(changeKind)s.lockKind=s.lockKind==='crew'?'wheel':'crew';const list=targets(s),idx=list.findIndex(t=>sameTarget(t,s.lock));s.lock=list.length?list[(idx+1)%list.length]:null;return s.lock;}
 function releaseLock(s){s.lock=null;}
 function firingSolution(t,p,q){const a=origin(t),v=velocity(t),v2=velocity(q);let flight=Math.hypot(p.x-a.x,p.z-a.z)/JAVELIN_SPEED,x,z,y;
  for(let k=0;k<5;k++){x=p.x-a.x+(v2.x-v.x)*flight;z=p.z-a.z+(v2.z-v.z)*flight;y=p.y-a.y+GRAVITY*flight*flight/2;flight=Math.hypot(x,y,z)/JAVELIN_SPEED;}
  return{yaw:Math.atan2(x,z),pitch:clamp(Math.atan2(y,Math.hypot(x,z)),-.65,.65)};
 }
 function aim(s){const t=s.teams[3],start=origin(t,s.role),yaw=course(100+t.distance,t.lane).yaw+t.heading+s.aimYaw,dir=direction(yaw,s.aimPitch),v=velocity(t);let a=start,hit=null,end=a;
  const points=[start];for(let k=1;k<=72;k++){const time=k*RANGE/JAVELIN_SPEED/72,b={x:start.x+(dir.x*JAVELIN_SPEED+v.x)*time,y:start.y+dir.y*JAVELIN_SPEED*time-GRAVITY*time*time/2,z:start.z+(dir.z*JAVELIN_SPEED+v.z)*time};hit=trace(s,3,a,b);end=hit?{x:a.x+(b.x-a.x)*hit.u,y:a.y+(b.y-a.y)*hit.u,z:a.z+(b.z-a.z)*hit.u}:b;points.push(end);if(hit)break;a=b;}return{start,end,hit,points,yaw,pitch:s.aimPitch};
 }
 function down(s,team,role,cause='javelin'){const t=s.teams[team],g=t.crew[role];g.downSlot=role===t.driver?'driver':'archer';g.hp=0;g.downAt=s.time;g.fallType=cause;t.drawUntil=0;t.whipStart=null;
  if(t.crew.every(g=>g.hp<=0)){t.eliminated=true;t.speed=0;s.events.push({kind:'out',team,time:s.time});}else{t.driver=t.crew.findIndex(g=>g.hp>0);t.archer=-1;if(team===3){s.role=t.driver;s.lock=null;}}
 }
 function damage(s,team,role){const t=s.teams[team],g=t?.crew[role];if(!g||g.hp<=0||out(t)||t.finish!==null)return false;g.hp=Math.max(0,g.hp-g.maxHp*.5);s.events.push({kind:'hit',team,role,time:s.time});if(!g.hp)down(s,team,role);return true;}
 function wheelDamage(s,team,side){const t=s.teams[team];if(!t||out(t)||t.finish!==null)return false;t.wheels[side]++;t.impact=.7;s.events.push({kind:'wheel',team,side,time:s.time});if(t.wheels[0]+t.wheels[1]>=2){t.broken=true;t.speed=0;t.slip=0;t.boostUntil=0;t.drawUntil=0;t.whipStart=null;s.events.push({kind:'broken',team,time:s.time});}return true;}
 function switchRole(s){const t=s.teams[3];if(s.done||out(t)||t.finish!==null||t.archer<0)return false;s.role=s.role===t.driver?t.archer:t.driver;t.drawUntil=0;t.whipStart=null;for(const g of t.crew)g.duck=0;s.lock=null;s.aimYaw=0;s.aimPitch=.015;return true;}
 function boost(s,t,at=s.time){if(at<t.nextBoost||at-t.lastAttempt<.8||t.stamina<25||out(t)||t.finish!==null||at<3)return false;const band=CircusDriving.target(t.misses),p=CircusDriving.needle(at-3);t.lastAttempt=at;t.lastHit=p>=band[0]&&p<=band[1];if(!t.lastHit){t.misses++;s.events.push({kind:'boost-miss',team:s.teams.indexOf(t),time:s.time});return false;}t.stamina-=25;t.boostUntil=s.time+4;t.nextBoost=s.time+5;s.events.push({kind:'boost',team:s.teams.indexOf(t),time:s.time});return true;}
 function draw(s,t,yaw,pitch){if(t.archer<0||t.crew[t.archer].hp<=0||t.crew[t.archer].duck>.15||s.time<t.nextShot||t.drawUntil||t.whipStart!==null||out(t)||t.finish!==null)return false;t.shotYaw=yaw;t.shotPitch=clamp(pitch,-.65,.65);t.drawUntil=s.time+.85;t.nextShot=s.time+2.1;return true;}
 function whip(s,team,role,yaw,pitch,charge){const t=s.teams[team];if(s.time<t.nextWhip||out(t)||t.crew[role]?.hp<=0||t.crew[role].duck>.15)return false;t.nextWhip=s.time+2.6;const a=origin(t,role),dir=direction(yaw,pitch),end={x:a.x+dir.x*3,y:a.y+dir.y*3,z:a.z+dir.z*3};t.whip={start:a,end,until:s.time+.45,hit:false};
  // A lock only points the camera. A narrow aim cone and a 120 ms release window are both required.
  if(charge<.42||charge>.54)return false;let best=null;
  for(let i=0;i<4;i++){if(i===team||out(s.teams[i]))continue;for(let j=0;j<2;j++){const g=s.teams[i].crew[j];if(g.hp<=0||g.duck>.25)continue;const p=point(s.teams[i],j),dx=p.x-a.x,dy=p.y-a.y,dz=p.z-a.z,d=Math.hypot(dx,dy,dz);if(d>3||d<.1)continue;const dot=(dx*dir.x+dy*dir.y+dz*dir.z)/d;if(dot<Math.cos(.065))continue;const hit=trace(s,team,a,p);if(hit?.blocked||hit?.team!==i||hit.role!==j)continue;if(!best||d<best.d)best={i,j,d,p};}}
  if(!best)return false;t.whip.end=best.p;t.whip.hit=true;down(s,best.i,best.j,'whip');s.teams[best.i].crew[best.j].pullFrom={x:a.x,z:a.z};s.events.push({kind:'pulled',team:best.i,role:best.j,time:s.time});return true;
 }
 function botShot(s,i){const t=s.teams[i];if(s.time<t.nextShot||t.archer<0||t.crew[t.archer].duck>.15)return;const a=origin(t),list=[];
  for(let j=0;j<4;j++){const q=s.teams[j];if(i===j||out(q)||q.finish!==null)continue;for(let r=0;r<2;r++){if(q.crew[r].hp<=0)continue;const p=point(q,r),d=Math.hypot(p.x-a.x,p.z-a.z);if(d>3&&d<36&&!trace(s,i,a,p)?.blocked)list.push({p,q,d});}}
  if(!list.length){t.nextShot=s.time+.7;return;}const target=list.sort((a,b)=>a.d-b.d)[0];if(random(s)<.2)target.p=wheelPoint(target.q,random(s)<.5?0:1);const shot=firingSolution(t,target.p,target.q);
  if(draw(s,t,shot.yaw+(random(s)-.5)*.11,shot.pitch+(random(s)-.5)*.045))t.nextShot=s.time+7+random(s)*6;
 }
 function autopilot(t,i){const p=course(100+t.distance,t.lane),lim=bounds(100+t.distance+15),desired=clamp([-10,-3,4,9][i],lim[0]+2,lim[1]-2),heading=clamp((desired-t.lane)*.12-(t.slip||0)/Math.max(5,t.speed),-.5,.5),curve=p.curve?t.speed/(35+t.lane):0,authority=.94/(1+Math.max(0,t.speed-12)*.025);return clamp((angle(heading-t.heading)*3.4-curve)/authority,-1,1);}
 function step(s,input={}){if(s.done)return s;s.tick++;s.time=s.tick*DT;s.events=[];if(s.time<3)return s;if(input.switch)switchRole(s);const own=s.teams[3];if(Number.isFinite(input.yaw))s.aimYaw=angle(input.yaw);if(Number.isFinite(input.pitch))s.aimPitch=clamp(input.pitch,-.65,.65);
  if(s.lock){const p=targetPoint(s,s.lock),a=origin(own,s.role);if(!p||Math.hypot(p.x-a.x,p.z-a.z)>RANGE+4||trace(s,3,a,p)?.blocked)s.lock=null;else{const shot=own.whipStart!==null?{yaw:Math.atan2(p.x-a.x,p.z-a.z),pitch:Math.atan2(p.y-a.y,Math.hypot(p.x-a.x,p.z-a.z))}:firingSolution(own,p,s.teams[s.lock.team]);const base=course(100+own.distance,own.lane).yaw+own.heading;s.aimYaw=angle(s.aimYaw+angle(shot.yaw-base-s.aimYaw)*.4);s.aimPitch+=(shot.pitch-s.aimPitch)*.4;}}
  const previous=s.teams.map(t=>({crew:t.crew.map((g,j)=>point(t,j)),wheels:[0,1].map(j=>wheelPoint(t,j))}));
  for(let i=0;i<4;i++){const t=s.teams[i];if(out(t)||t.finish!==null)continue;const manual=i===3&&s.role===t.driver;
   for(let r=0;r<2;r++){let duck=i===3&&r===s.role&&input.duck;if(i!==3&&t.crew[r].hp>0){const g=t.crew[r];if(s.time>=(g.nextDodge||0)&&s.arrows.some(a=>a.owner!==i&&Math.hypot(a.x-point(t,r).x,a.z-point(t,r).z)<7)){g.nextDodge=s.time+5;g.duckUntil=random(s)<.3?s.time+.65:0;}duck=s.time<(g.duckUntil||0);}t.crew[r].duck=clamp(t.crew[r].duck+(duck?DT*6:-DT*6),0,1);if(duck&&r===t.archer)t.drawUntil=0;}
   if(i===3&&input.boost)boost(s,t,clamp(input.boostAt??s.time,s.time-.15,s.time));
   else if(i!==3&&s.time>=t.nextBoost&&s.time-t.lastAttempt>.8){const b=CircusDriving.target(t.misses),p=CircusDriving.needle(s.time-3);if(p>b[0]&&p<b[1]&&random(s)<.8)boost(s,t);}
   const p=course(100+t.distance,t.lane),turn=manual?clamp(input.steer||0,-1,1):autopilot(t,i),target=(17.2+clamp(t.quality,0,100)*.018)*(s.time<t.boostUntil?1.5:1)*(t.archer<0?.94:1);
   const n=CircusMotion.advance(t,turn,p.curve,target,DT),lim=bounds(100+n.distance),lane=n.lane;t.heading=n.heading;t.turn=n.turn;t.slip=n.slip;t.speed=n.speed;t.stamina=Math.min(100,t.stamina+DT*2.5);t.impact=Math.max(0,t.impact-DT);
   if(lane<lim[0]+.35||lane>lim[1]-.35){if(t.wall===0){t.speed*=.58;t.impact=.7;}t.wall+=DT;t.slip*=.5;t.speed=Math.max(0,t.speed-(5+t.wall*7)*DT);if(t.wall>2.5)t.speed=0;}else t.wall=0;
   t.lane=clamp(lane,lim[0]+.35,lim[1]-.35);t.distance=n.distance;if(t.distance>=TOTAL){t.distance=TOTAL;t.finish=s.time;t.speed=0;t.drawUntil=0;}
  }
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=s.teams[i],b=s.teams[j];if(a.eliminated||b.eliminated||a.finish!==null||b.finish!==null)continue;if(Math.abs(a.distance-b.distance)<4.7&&Math.abs(a.lane-b.lane)<2.6){const sign=a.lane>=b.lane?1:-1;if(!a.broken)a.lane+=sign*.07;if(!b.broken)b.lane-=sign*.07;if(!a.impact&&!b.impact){a.speed*=.65;b.speed*=.65;a.impact=b.impact=.6;}for(const t of[a,b]){const lim=bounds(100+t.distance);t.lane=clamp(t.lane,lim[0]+.35,lim[1]-.35);}}}
  if(!out(own)){if(input.whipHeld&&own.whipStart===null&&s.time>=own.nextWhip&&own.crew[s.role].duck<.15){own.whipStart=s.time;own.drawUntil=0;}if(input.whipRelease&&own.whipStart!==null){const charge=(input.whipAt??s.time)-own.whipStart;whip(s,3,s.role,course(100+own.distance,own.lane).yaw+own.heading+s.aimYaw,s.aimPitch,charge);own.whipStart=null;}if(!input.whipHeld&&!input.whipRelease)own.whipStart=null;}
  for(let i=0;i<4;i++){const t=s.teams[i];if(out(t)||t.finish!==null)continue;if(i===3&&s.role===t.archer){if(input.fire)draw(s,t,course(100+t.distance,t.lane).yaw+t.heading+s.aimYaw,s.aimPitch);}else botShot(s,i);
   if(t.drawUntil&&i===3&&s.role===t.archer){t.shotYaw=course(100+t.distance,t.lane).yaw+t.heading+s.aimYaw;t.shotPitch=s.aimPitch;}
   if(t.drawUntil&&s.time>=t.drawUntil){const p=origin(t),dir=direction(t.shotYaw,t.shotPitch),v=velocity(t);s.arrows.push({id:++s.serial,bornTick:s.tick,owner:i,...p,vx:dir.x*JAVELIN_SPEED+v.x,vy:dir.y*JAVELIN_SPEED,vz:dir.z*JAVELIN_SPEED+v.z,remaining:RANGE});t.drawUntil=0;t.lastShot=s.time;s.events.push({kind:'shot',team:i,time:s.time});}
  }
  for(const a of s.arrows){if(a.bornTick===s.tick)continue;const b={x:a.x+a.vx*DT,y:a.y+a.vy*DT-GRAVITY*DT*DT/2,z:a.z+a.vz*DT},hit=trace(s,a.owner,a,b,previous);if(hit){if(hit.kind==='wheel')wheelDamage(s,hit.team,hit.side);else if(hit.kind==='crew')damage(s,hit.team,hit.role);a.remaining=0;}else{Object.assign(a,b);a.vy-=GRAVITY*DT;a.remaining-=JAVELIN_SPEED*DT;}}
  s.arrows=s.arrows.filter(a=>a.remaining>0);const order=s.teams.map((t,i)=>({t,i})).sort((a,b)=>Number(out(a.t))-Number(out(b.t))||(a.t.finish??Infinity)-(b.t.finish??Infinity)||b.t.distance-a.t.distance);order.forEach(({t},i)=>t.rank=i+1);
  const first=s.teams.map((t,i)=>({t,i})).filter(x=>x.t.finish!==null).sort((a,b)=>a.t.finish-b.t.finish)[0];if(first){s.winner=first.i;s.done=true;}else if(out(own)||s.time>900){s.done=true;s.winner=null;}return s;
 }
 return{DT,LENGTH,LAPS,TOTAL,JAVELIN_SPEED,ARROW_SPEED,RANGE,GRAVITY,course,initial,step,aim,trace,damage,wheelDamage,switchRole,point,wheelPoint,origin,direction,autopilot,lockNext,releaseLock,targetPoint,targets,boost,whip,draw,firingSolution};
})();
if(typeof module!=='undefined')module.exports=CircusWarCore;
