/* Shared deterministic combat geometry. Legacy caravan replays opt out by version. */
(function(root){
'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const enabled=f=>f?.motionVersion===163;
const pole=kind=>kind==='spear'||kind==='trident'||kind==='halberd';
function clipName(f){const kind=f.attackWeapon??f.weapon;if(f.pitWeapon&&kind==='heavy_mace')return f.attackKind==='heavy'||f.chain===3?'chop':f.chain===2?'swordB':'swordA';if(pole(kind))return 'pole';if(!kind)return f.chain===2?'cross':'jab';if(f.attackKind==='heavy')return 'chop';if(kind==='gladius'&&f.chain===3)return 'stab';if(kind==='sica')return f.chain===2?'swordB':'swordA';return f.chain===2?'swordB':'slash';}
function curve(name){return root.LUDUS_COMBAT_CURVES?.clips[name];}
function phase(f,time=f.timer,name=clipName(f)){
 const c=curve(name),p=f.attackProfile;if(!c||!p)return 0;
 return time<p.wind?c.wind*clamp(time/p.wind):time<p.wind+p.active?mix(c.wind,c.impact,clamp((time-p.wind)/p.active)):mix(c.impact,1,clamp((time-p.wind-p.active)/p.recover));
}
function vector(frames,u){const at=clamp(u)*(frames.length-1),a=Math.floor(at),b=Math.min(a+1,frames.length-1),t=at-a;return{x:mix(frames[a][0],frames[b][0],t),y:mix(frames[a][1],frames[b][1],t),z:mix(frames[a][2],frames[b][2],t)};}
function evadeOffset(f,time=f.timer){
 if(!enabled(f)||f.action!=='evade')return 0;
 const u=clamp(time/Math.max(.01,f.duration));
 if(f.evadeKind==='duck')return -.58*smooth(u/.23)*(1-smooth((u-.62)/.38));
 if(f.evadeKind==='jump'){const air=clamp((u-.16)/.63);return u<.16||u>.79?0:.52*Math.sin(Math.PI*air);}
 return -.08*Math.sin(Math.PI*u);
}
function install(A,M,options={}){
 if(!A||!M||A.prototype._authored163)return;
 const P=A.prototype;P._authored163=true;
 const base={sample:M.sample,body:M.body,target:M.target,contact:M.contact,shieldContact:M.shieldContact,poleGuard:M.poleGuard};
 const reset=P.reset,attack=P.attack,tick=P.tick,hit=P.hit,deflect=P.deflectAttack,dodge=P.dodge,botRoll=P.botRoll;
 P.reset=function(...args){const result=reset.apply(this,args);this.motionVersion=options.defaultVersion===0?0:163;for(const f of this.fighters)f.motionVersion=this.motionVersion;return result;};
 function reach(f,others){
  let best=null,distance=3.4;
  const sx=Math.sin(f.angle),cz=Math.cos(f.angle);
  for(const v of others){if(v===f||v.hp<=0||v.team===f.team)continue;const x=v.x-f.x,z=v.z-f.z,forward=x*sx+z*cz,lateral=x*cz-z*sx;
   if(forward>.15&&Math.abs(lateral)<.54&&forward<distance){distance=forward;best=v;}}
  const value=best?Math.max(.38,distance-.27):2.7;
  f.poleReach=value;f.poleChoke=clamp(2.24-value,0,1.25);return best;
 }
 P.attack=function(...args){const ok=attack.apply(this,args),f=this.fighters[args[0]];if(ok&&enabled(f)){f.authoredAttack=clipName(f);f.recoilPhase=null;reach(f,this.fighters);}return ok;};
 P.evade=function(id,x=0,z=0,kind='step'){
  const f=this.fighters[id];if(!enabled(f))return kind==='roll'?dodge.call(this,id,x,z):false;
  const cost=kind==='duck'?18:kind==='jump'?22:kind==='roll'?25:18;
  if(this.finished||!f||f.hp<=0||f.action!=='idle'||f.stamina<cost||f.stunUntil>this.time||(f.evadeReadyAt||0)>this.time)return false;
  if(kind==='roll'){const ok=dodge.call(this,id,x,z);if(ok)f.evadeReadyAt=this.time+.71;return ok;}
  let len=Math.hypot(x,z);if(len<.02&&kind==='step'){x=-Math.sin(f.angle);z=-Math.cos(f.angle);len=1;}
  f.dx=len>.02?x/len:0;f.dz=len>.02?z/len:0;
  const lateral=f.dx*Math.cos(f.angle)-f.dz*Math.sin(f.angle),forward=f.dx*Math.sin(f.angle)+f.dz*Math.cos(f.angle);
  f.evadeKind=kind==='duck'||kind==='jump'?kind:Math.abs(lateral)>Math.abs(forward)?lateral>0?'stepLeft':'stepRight':forward>0?'stepForward':'stepBack';
  f.action='evade';f.timer=0;f.duration=kind==='duck'?.65:kind==='jump'?.72:.42;f.evadeTravel=kind==='duck'?0:kind==='jump'?(len>.02?.65:0):1.15;
  f.evadeReadyAt=this.time+f.duration+.25;f.stamina-=cost;f.regenDelay=.85;f.blocking=false;f.guardInput=false;
  this.emit('evadeStart',{id,kind:f.evadeKind});return true;
 };
 P.dodge=function(id,x,z){const f=this.fighters[id];return enabled(f)?this.evade(id,x,z,'step'):dodge.apply(this,arguments);};
 P.botRoll=function(f,t){
  if(!enabled(f))return botRoll.apply(this,arguments);
  const angle=Math.atan2(t.x-f.x,t.z-f.z),side=f.id%2?1:-1;
  let kind=t.attackRegion==='head'&&f.id%3===0?'duck':['legs','leftLeg','rightLeg'].includes(t.attackRegion)&&f.id%3===1?'jump':'step';
  const x=kind==='step'?Math.cos(angle)*side-Math.sin(angle)*.25:0,z=kind==='step'?-Math.sin(angle)*side-Math.cos(angle)*.25:0;
  const end={x:f.x+x*1.2,z:f.z+z*1.2},limited={...end};this.bound(limited);
  if(kind==='step'&&(Math.hypot(end.x-limited.x,end.z-limited.z)>.15||this.fighters.some(v=>v!==f&&v.hp>0&&Math.hypot(end.x-v.x,end.z-v.z)<.7)))return false;
  const ok=this.evade(f.id,x,z,kind);if(ok)f.aiEvadeAt=this.time+(this.difficulty==='easy'?2.6:1.65)+this.random()*.65;return ok;
 };
 P.tick=function(dt,input={}){
  if(this.motionVersion!==163)return tick.apply(this,arguments);
  dt=clamp(dt,0,.05);
  for(const f of this.fighters){if(!enabled(f)||f.hp<=0)continue;
   if(pole(f.weapon)||pole(f.offhand)||pole(f.attackWeapon))reach(f,this.fighters);
   if(f.action==='evade'&&f.stunUntil<=this.time){const before=clamp(f.timer/f.duration),after=clamp((f.timer+dt)/f.duration),travel=(smooth(after)-smooth(before))*f.evadeTravel;f.x+=f.dx*travel;f.z+=f.dz*travel;this.bound(f);}
  }
  return tick.call(this,dt,input);
 };
 P.deflectAttack=function(f,v,perfect=false){if(enabled(f)&&f.action==='attack')f.recoilPhase=phase(f);return deflect.apply(this,arguments);};
 P.hit=function(f,v,...args){const hp=v.hp,p=f.attackProfile,elapsed=f.timer,result=hit.call(this,f,v,...args);
  if(enabled(f)&&pole(f.attackWeapon)&&v.hp<hp&&f.action==='attack'){this.deflectAttack(f,v,false);f.duration=Math.max(.28,p.recover);f.strikeConnected=true;f.authoredContactAt=elapsed;}
  return result;
 };
 function build(s,f,choke=0){
  const p=f.attackProfile||M.profile(f.attackWeapon||f.weapon),d=s.dir,g=s.grip;
  const at=n=>({x:g.x+d.x*n,y:g.y+d.y*n,z:g.z+d.z*n});
  if(p.pole){s.choke=choke;s.points=[at(-choke),at(p.length-choke)];s.tip=s.points[1];return s;}
  if(!s.local?.length){s.points=[{...g},at(p.length)];s.tip=s.points[1];return s;}
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),k={x:d.z,y:0,z:-d.x};
  s.points=s.local.map(v=>{const a=cross(k,v),b=cross(k,a),den=Math.max(.001,1+d.y);return{x:g.x+v.x+a.x+b.x/den,y:g.y+v.y+a.y+b.y/den,z:g.z+v.z+a.z+b.z/den};});s.tip=s.points.at(-1);return s;
 }
 M.sample=function(f,time=f.timer){
  if(!enabled(f))return base.sample(f,time);
  if(['recoil','stagger'].includes(f.action)&&f.recoilSample){
   const a=f.recoilSample,u=smooth(time/Math.max(.01,f.duration)),b=M.sample({...f,action:'idle',recoilSample:null},0),lerp=(v,w)=>({x:mix(v.x,w.x,u),y:mix(v.y,w.y,u),z:mix(v.z,w.z,u)});
   const s={...a,grip:lerp(a.grip,b.grip),dir:lerp(a.dir,b.dir),weight:1-u,recovery:u,active:false},length=Math.hypot(s.dir.x,s.dir.y,s.dir.z);for(const k of ['x','y','z'])s.dir[k]/=length;
   return build(s,f,mix(a.choke||0,b.choke||0,u));
  }
  const s=base.sample(f,time),kind=f.attackWeapon??f.weapon,isPole=pole(kind),active=f.action==='attack',id=active?clipName(f):isPole?'poleIdle':null,c=curve(id);
  if(!c)return s;
  const u=active?phase(f,time,id):0,hand=vector((c.rigHands||c.hands).Right,u),sign=f.attackLeft?-1:1;
  // Preserve captured weight transfer; hand IK only enforces the chosen weapon and target height.
  const region=M.regions[f.attackRegion]||M.regions.chest;
  const regionShift=clamp(region.y-1.38,-.46,.42)*(active?smooth(time/Math.max(.01,f.attackProfile.wind)):.15);
  s.grip=c.rigHands?{x:hand.x*sign,y:hand.y,z:hand.z}:{x:clamp(hand.x*sign,-.65,.65),y:clamp(hand.y*1.06+regionShift+(isPole?.26:.13),.72,1.95),z:clamp(hand.z*1.06,-.38,.72)};
  if(f.pitWeapon&&kind==='heavy_mace')s.grip.y=clamp(s.grip.y-Math.min(0,vector(c.hips,u).y)*.8,1.05,1.85);
  if(active){const entry=smooth(time/.085),rest=base.sample({...f,action:'idle'},0).grip;for(const k of ['x','y','z'])s.grip[k]=mix(rest[k],s.grip[k],entry);}
  if(isPole){
   const p=f.attackProfile||M.profile(kind),choke=clamp(Number(f.poleChoke)||0,0,p.length-.2),length=p.length-choke;
   s.grip.x=mix(s.grip.x,(f.attackLeft?1:-1)*.36,clamp(choke/1.2));
   const aimed=active?smooth(time/Math.max(.01,p.wind)):0,dx=mix((f.attackLeft?1:-1)*.035,-s.grip.x/Math.max(.35,length),aimed),dy=mix(.18,(region.y-s.grip.y)/Math.max(.35,length),aimed);
   s.dir={x:clamp(dx,-.70,.70),y:clamp(dy,-.70,.70),z:1};const horizontal=Math.hypot(s.dir.x,s.dir.y);if(horizontal>.85){s.dir.x*=.85/horizontal;s.dir.y*=.85/horizontal;}s.dir.z=Math.sqrt(1-s.dir.x*s.dir.x-s.dir.y*s.dir.y);
   // A moving target can shorten the remaining extension, without scaling the shaft.
   s.grip.z=Math.min(s.grip.z,(Number(f.poleReach)||2.7)-length*s.dir.z);
   return build(s,f,choke);
  }
  const dy=clamp((region.y-s.grip.y)/Math.max(.4,(f.attackProfile||M.profile(kind)).length),-.75,.75),horizontal=Math.hypot(s.dir.x,s.dir.z)||1,factor=Math.sqrt(1-dy*dy)/horizontal;s.dir={x:s.dir.x*factor,y:dy,z:s.dir.z*factor};return build(s,f);
 };
 M.poleGuard=function(f,left=false){const kind=left?f.offhand:f.weapon;if(!enabled(f))return base.poleGuard(f,left);if(!pole(kind))return null;return M.sample({...f,action:'idle',attackWeapon:kind,attackProfile:M.profile(kind),attackRegion:'chest',attackLeft:left},0);};
 M.target=function(f,region){const t=base.target(f,region),offset=evadeOffset(f);if(offset){const leg=['legs','leftLeg','rightLeg'].includes(region);t.y+=f.evadeKind==='duck'&&leg?offset*.25:offset;}return t;};
 M.contact=function(f,v,from,to){
  if(!enabled(f)&&!enabled(v))return base.contact(f,v,from,to);
  const target=M.target(v,f.attackRegion),a=M.sample(f,from),b=M.sample(f,to),world=p=>M.world(f,p);
  if(pole(f.attackWeapon))return Math.min(M.segmentDistance(world(a.tip),world(b.tip),target),M.segmentDistance(world({x:b.tip.x-b.dir.x*.18,y:b.tip.y-b.dir.y*.18,z:b.tip.z-b.dir.z*.18}),world(b.tip),target))<target.r+.045;
  if(f.attackWeapon==='mace'||f.pitWeapon&&f.attackWeapon==='heavy_mace')return M.segmentDistance(world(a.tip),world(b.tip),target)<target.r+.14;
  for(let i=1;i<b.points.length;i++)if(Math.min(M.segmentDistance(world(a.points[i-1]),world(a.points[i]),target),M.segmentDistance(world(b.points[i-1]),world(b.points[i]),target),M.segmentDistance(world(a.points[i]),world(b.points[i]),target))<target.r+.07)return true;return false;
 };
 M.shieldContact=function(f,v,from,to){
  if(!enabled(f))return base.shieldContact(f,v,from,to);
  if(!v.blocking||!v.shield||v.shieldHeldBy!==null)return null;
  const c=Math.cos(v.angle),s=Math.sin(v.angle),g=M.guardPoint(v),width=['thraex','hoplomachus'].includes(v.shieldStyle)?.34:.40,height=['thraex','hoplomachus'].includes(v.shieldStyle)?.39:.56;
  const r=M.shieldResponse(v),cp=Math.cos(r.pitch),sp=Math.sin(r.pitch),cy=Math.cos(r.yaw),sy=Math.sin(r.yaw),cr=Math.cos(r.roll),sr=Math.sin(r.roll);
  const local=p=>{const x=(p.x-v.x)*c-(p.z-v.z)*s-g.x,y=p.y-(v.navHeight||0)-g.y,z=(p.x-v.x)*s+(p.z-v.z)*c-g.z,yy=y*cp+z*sp,zz=-y*sp+z*cp,xx=x*cy-zz*sy;return{x:xx*cr+yy*sr,y:-xx*sr+yy*cr,z:x*sy+zz*cy};};
  const cross=(a,b)=>{const x=local(a),y=local(b),dz=y.z-x.z;if(Math.abs(dz)<1e-8)return null;const u=-x.z/dz;if(u<0||u>1)return null;return Math.abs(mix(x.x,y.x,u))<=width+.07&&Math.abs(mix(x.y,y.y,u))<=height+.07?{x:mix(a.x,b.x,u),y:mix(a.y,b.y,u),z:mix(a.z,b.z,u)}:null;};
  const a=M.sample(f,from),b=M.sample(f,to),world=p=>M.world(f,p);
  if(pole(f.attackWeapon))return cross(world(a.tip),world(b.tip))||cross(world(b.grip),world(b.tip));
  for(let i=1;i<b.points.length;i++){const p=cross(world(a.points[i-1]),world(a.points[i]))||cross(world(b.points[i-1]),world(b.points[i]))||cross(world(a.points[i]),world(b.points[i]));if(p)return p;}return null;
 };
 M.version=163;M.authored={clipName,phase,vector,enabled,evadeOffset,reach};
}
root.ArenaAuthoredCombat={version:163,install,clipName,phase,vector,enabled,evadeOffset};
})(globalThis);
