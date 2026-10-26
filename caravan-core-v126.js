/* Arena V115 simulation, frozen for deterministic caravan replay. */
(function(root){

var ArenaClasses={
 murmillo:{name:'Murmillo',weapon:'gladius',shield:'large',color:0x792a24,crest:true,armor:true},
 thraex:{name:'Thraex',weapon:'sica',shield:'small',color:0x862e26,crest:true},
 hoplomachus:{name:'Hoplomachus',weapon:'spear',shield:'round',color:0x413e32,feathers:true},
 secutor:{name:'Secutor',weapon:'gladius',shield:'large',color:0x292c29,closed:true},
 retiarius:{name:'Retiarius',weapon:'trident',shield:null,color:0x6a5033,net:true},
 provocator:{name:'Provocator',weapon:'gladius',shield:'large',color:0x8b3029,crest:true},
 scissor:{name:'Scissor',weapon:'gladius',shield:null,color:0x594534,armor:true,scissor:true}
};
var ArenaWeapons={gladius:{name:'Gladius',range:2.25},sica:{name:'Eğri kılıç',range:2.25},spear:{name:'Mızrak',range:2.85},trident_gladiator:{name:'Gladyatör tridenti',range:2.75},trident:{name:'Üç dişli mızrak',range:2.75},heavy_mace:{name:'Ağır gürz',range:1.95},warhammer:{name:'Savaş çekici',range:1.95},halberd:{name:'Halberd',range:2.75},mace:{name:'Zincirli gürz',range:2.25},whip:{name:'Kırbaç',range:2}};
// Master v7: six stats total 300; Overall is their mean, not character level.
var ArenaBasicStats={murmillo:[60,55,50,60,35,40],thraex:[45,50,60,35,60,50],hoplomachus:[50,55,50,45,45,55],secutor:[55,55,50,55,40,45],retiarius:[40,55,45,30,65,65],provocator:[65,60,45,65,30,35],scissor:[50,50,60,40,55,45]};
for(const [key,values] of Object.entries(ArenaBasicStats))ArenaClasses[key].stats=Object.fromEntries(['health','stamina','strength','defense','agility','speed'].map((s,i)=>[s,values[i]]));
if(false)module.exports={ArenaClasses,ArenaWeapons,ArenaBasicStats};

/* Shared attack geometry for the simulation, held weapon and arm poses. Metres/seconds. */
var ArenaMotion=(function(){
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const regions={head:{name:'BAŞ',y:1.9,r:.25},chest:{name:'GÖVDE',y:1.38,r:.36},leftArm:{name:'SOL KOL',y:1.35,r:.24},rightArm:{name:'SAĞ KOL',y:1.35,r:.24},rightLeg:{name:'SAĞ BACAK',y:.65,r:.23},leftLeg:{name:'SOL BACAK',y:.65,r:.23},legs:{name:'BACAK',y:.65,r:.33}};
 const smooth=t=>{t=clamp(t);return t*t*(3-2*t);},mix=(a,b,t)=>a+(b-a)*t;
 // V114: preserve a readable preparation and a deliberate return to guard.
 function profile(kind,heavy=false,bot=false){const pole=kind==='spear'||(kind==='trident'||kind==='trident_gladiator')||kind==='halberd',timings={gladius:[.25,.20,.45],sica:[.23,.19,.40],spear:[.32,.22,.48],trident_gladiator:[.36,.24,.52],trident:[.36,.24,.52],heavy_mace:[.40,.26,.56],warhammer:[.44,.26,.60],halberd:[.36,.24,.52],mace:[.40,.26,.56],whip:[.32,.24,.48]},v=timings[kind]||[.22,.18,.35],wind=v[0]*(heavy?1.35:bot?1.15:1),active=v[1],recover=v[2]*(heavy?1.2:1);return {wind,active,recover,duration:wind+active+recover,pole,length:pole?1.7:kind==='heavy_mace'?.86:kind==='warhammer'?1.02:kind==='mace'?1.02:kind==='whip'?1.65:kind?.78:.18};}
 function speedFactor(f){return Math.min(1.18,(.9+.002*clamp(Number(f.agility??50),0,100))*(1+clamp(Number(f.itemStats?.attack_speed||0)/100,0,.25)));}
 function pace(f){const p={...f.attackProfile},factor=speedFactor(f);for(const key of ['wind','active','recover'])p[key]/=factor;p.duration=p.wind+p.active+p.recover;return p;}
 function impactQuality(f,v){return ['spear','trident','trident_gladiator','halberd'].includes(f.attackWeapon??f.weapon)?clamp((Math.hypot(f.x-v.x,f.z-v.z)-.75)/1.05,.28,1):1;}
 function shieldResponse(f){const w=Math.sin(Math.PI*clamp((f.guardFlash||0)/.20))*(f.guardImpact||.65),x=f.guardImpactX||0,y=f.guardImpactY||0;return {x:x*.025*w,y:y*.018*w,z:-.105*w,pitch:-y*.12*w,yaw:x*.17*w,roll:-x*.04*w};}
 function reaction(f){
  const poses={};if(!(f.reaction>0)||f.hp<=0||['knocked','stunned'].includes(f.action))return {poses,drop:0};
  const u=clamp(1-f.reaction/.32),envelope=u<.16?smooth(u/.16):Math.pow(1-(u-.16)/.84,2),force=(f.impactStrength??.65)/.65,w=envelope*force,side=Math.sin(f.impactDirection||0),front=Math.cos(f.impactDirection||0);let drop=0;
  if(f.lastRegion==='head'){poses.Head=[-.21*front*w,-.07*side*w,.13*side*w];poses.Spine2=[-.06*front*w,.04*side*w,.04*side*w];}
  else if(f.lastRegion==='chest'){poses.Spine2=[-.22*front*w,.08*side*w,.14*side*w];poses.Spine=[-.035*front*w,0,.035*side*w];}
  else if(['leftArm','rightArm'].includes(f.lastRegion)){const arm=f.lastRegion==='leftArm'?'Left':'Right',sign=arm==='Left'?-1:1;poses[arm+'Arm']=[.04*w,.04*side*w,sign*.12*w];poses.Spine2=[-.06*front*w,.06*side*w,.06*side*w];}
  else{const leg=f.lastRegion==='rightLeg'?'Right':'Left';poses[leg+'Leg']=[.13*w,0,0];poses.Spine2=[.035*w,.035*side*w,.04*side*w];drop=-.018*w;}
  return {poses,drop};
 }
 // Local curves are shared by the visible chain/whip and swept collision tests.
 function flexible(kind,phase=.5,effort=0){const pts=[];
  if(kind==='mace'){const angle=.28+effort*Math.sin((phase-.55)*Math.PI)*1.05;for(let i=0;i<=7;i++){const u=i/7;pts.push({x:Math.sin(angle)*.55*u,y:.43+Math.cos(angle)*.55*u,z:0});}}
  else if(kind==='whip'){for(let i=0;i<=8;i++){const u=i/8,wave=Math.sin(u*Math.PI*2-phase*Math.PI*2);pts.push({x:wave*.22*u*effort,y:.14+u*1.51,z:Math.sin(u*Math.PI)*.055*effort});}}
  return pts;
 }
 function orient(v,d){const k={x:d.z,y:0,z:-d.x},cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),a=cross(k,v),b=cross(k,a),den=Math.max(.001,1+d.y);return{x:v.x+a.x+b.x/den,y:v.y+a.y+b.y/den,z:v.z+a.z+b.z/den};}
 function sample(f,time=f.timer){
   if(['recoil','stagger'].includes(f.action)&&f.recoilSample){
    const a=f.recoilSample,p=f.attackProfile||profile(f.attackWeapon||f.weapon),u=smooth(clamp(time/Math.max(.01,f.duration)));
    const b=sample({...f,action:'attack',recoilSample:null},p.duration),lerp=(v,w)=>({x:mix(v.x,w.x,u),y:mix(v.y,w.y,u),z:mix(v.z,w.z,u)});
    const grip=lerp(a.grip,b.grip),dir=lerp(a.dir,b.dir),len=Math.hypot(dir.x,dir.y,dir.z)||1;for(const k of ['x','y','z'])dir[k]/=len;
    const local=flexible(f.attackWeapon||f.weapon,.5,1-u),points=(local.length?local:[{x:0,y:0,z:0},{x:0,y:p.length,z:0}]).map(v=>{const r=orient(v,dir);return{x:grip.x+r.x,y:grip.y+r.y,z:grip.z+r.z};});
    return {grip,dir,local,points,tip:points.at(-1),phase:1,wind:1,recovery:u,weight:1-u,cut:a.cut*(1-u),active:false};
   }
   const kind=f.attackWeapon??f.weapon,p=f.attackProfile||profile(kind,f.attackKind==='heavy',f.id!==0),side=f.attackLeft?1:-1,region=regions[f.attackRegion]||regions.chest;
  const phase=clamp((time-p.wind)/p.active),wind=clamp(time/p.wind),recovery=clamp((time-p.wind-p.active)/p.recover),ready=time<p.wind,returning=time>p.wind+p.active;
  const weight=ready?smooth(wind):1-smooth(recovery),swing=(f.chain===2?-1:1)*(f.attackLeft?-1:1),cut=ready?mix(-.25,-1.05,smooth(wind)):returning?mix(1.05,-.25,smooth(recovery)):mix(-1.05,1.05,smooth(phase));
  const height=f.attackRegion==='head'?1.62:['legs','leftLeg','rightLeg'].includes(f.attackRegion)?1.12:1.43;
  let grip,dir;
  if(p.pole){
   // Chamber at the ribs, drive the point forward, then withdraw along the shaft.
   // The guard is also used at rest, so neither wrist nor weapon snaps on attack.
   const rest={x:side*.30,y:1.32,z:.23},chamber={x:side*.36,y:height-.035,z:.03},contact={x:side*.24,y:height,z:.54};
   const travel=ready?smooth(wind):returning?smooth(recovery/.78):smooth(phase/.82),a=ready?rest:returning?contact:chamber,b=ready?chamber:returning?rest:contact;
   grip={x:mix(a.x,b.x,travel),y:mix(a.y,b.y,travel),z:mix(a.z,b.z,travel)};
   const aim=ready?smooth(wind):returning?1-smooth((recovery-.42)/.58):1;
   const dx=mix(side*.035,-grip.x/p.length,aim),dy=mix(.18,(region.y-grip.y)/p.length,aim);
   dir={x:dx,y:dy,z:Math.sqrt(Math.max(.01,1-dx*dx-dy*dy))};
  }
  else{const a=cut*swing;grip={x:side*.21+Math.sin(a)*.1,y:mix(1.32,height,weight),z:.23+Math.cos(a)*.18};dir={x:Math.sin(a),y:mix(.12,(region.y-height)/p.length,weight),z:Math.cos(a)};const len=Math.hypot(dir.x,dir.y,dir.z);for(const k of ['x','y','z'])dir[k]/=len;}
  if(!p.pole&&['gladius','sica'].includes(kind)&&f.chain===3){
    const a=ready?mix(.15,-1.03,smooth(wind)):returning?mix(.82,.15,smooth(recovery)):mix(-1.03,.82,smooth(phase));
    grip={x:side*.20,y:mix(1.32,height+.06,weight),z:.28+Math.cos(a)*.12};dir={x:side*.04,y:-Math.sin(a),z:Math.cos(a)};const len=Math.hypot(dir.x,dir.y,dir.z);for(const k of ['x','y','z'])dir[k]/=len;
   }

  // V24: the shoulder carries the hand through a broad cut; the wrist follows it.
  if(!p.pole&&['gladius','sica'].includes(kind)){
    const thrust=kind==='gladius'&&f.chain===3&&f.attackKind!=='heavy',reverse=f.chain===2,overhead=!thrust&&(f.chain===3||f.attackKind==='heavy'),hand=f.attackLeft?-1:1;
    const resting={x:-.24,y:1.32,z:.29,yaw:-.25,pitch:.12};
    const chamber=overhead?{x:-.22,y:1.99,z:.02,yaw:-.10,pitch:1.35}:reverse?{x:.30,y:1.61,z:.07,yaw:.98,pitch:.32}:{x:-.57,y:1.68,z:-.09,yaw:-1.12,pitch:.55};
    const contactPose={x:-.12,y:height+(overhead?.05:0),z:.43,yaw:0,pitch:Math.asin(clamp((region.y-height)/p.length,-.8,.8))};
    const finish=overhead?{x:-.17,y:1.09,z:.47,yaw:.08,pitch:-.70}:reverse?{x:-.52,y:1.31,z:.09,yaw:-1.12,pitch:-.25}:{x:.30,y:1.22,z:.13,yaw:1.12,pitch:-.42};
    const lerpPose=(a,b,u)=>Object.fromEntries(Object.keys(a).map(k=>[k,mix(a[k],b[k],u)]));
    const cutEase=u=>u*u*(2-u);let pose;
    if(ready)pose=lerpPose(resting,chamber,smooth(wind));
    else if(returning)pose=lerpPose(finish,resting,smooth(recovery));
    else pose=phase<.48?lerpPose(chamber,contactPose,cutEase(phase/.48)):lerpPose(contactPose,finish,1-cutEase(1-(phase-.48)/.52));
    if(thrust){
     const chamber={x:-.30,y:height-.04,z:.035,yaw:0,pitch:.08},tip={x:-.15,y:height,z:.60,yaw:0,pitch:0};
     pose=ready?lerpPose(resting,chamber,smooth(wind)):returning?lerpPose(tip,resting,smooth(recovery)):lerpPose(chamber,tip,smooth(phase/.85));
    }
    grip={x:pose.x*hand,y:pose.y,z:pose.z};
    dir={x:Math.sin(pose.yaw)*Math.cos(pose.pitch)*hand,y:Math.sin(pose.pitch),z:Math.cos(pose.yaw)*Math.cos(pose.pitch)};
    if(thrust){const aim=ready?smooth(wind):returning?1-smooth(recovery):1,dx=mix(dir.x,-grip.x/p.length,aim),dy=mix(dir.y,(region.y-grip.y)/p.length,aim);dir={x:dx,y:dy,z:Math.sqrt(Math.max(.01,1-dx*dx-dy*dy))};}
  }
   const local=flexible(kind,phase,weight),points=(local.length?local:[{x:0,y:0,z:0},{x:0,y:p.length,z:0}]).map(v=>{const r=orient(v,dir);return{x:grip.x+r.x,y:grip.y+r.y,z:grip.z+r.z};});
  return {grip,tip:points[points.length-1],points,local,dir,phase,wind,recovery,weight,pole:p.pole,left:!!f.attackLeft,cut:cut*swing,active:!ready&&!returning};
 }
 function poleGuard(f,left=false){const kind=left?f.offhand:f.weapon;if(!['spear','trident','trident_gladiator','halberd'].includes(kind))return null;return sample({...f,action:'idle',attackWeapon:kind,attackProfile:profile(kind),attackRegion:'chest',attackLeft:left},0);}
 function body(f){const poses={},attack=f.action==='attack';let drop=0,lean=0,shift=0,step=null;
  if(attack){
   const s=sample(f),p=f.attackProfile||profile(f.attackWeapon||f.weapon),side=f.attackLeft?-1:1,reverse=f.chain===2,overhead=(f.chain===3&&(f.attackWeapon||f.weapon)!=='gladius')||f.attackKind==='heavy';
   const returning=s.recovery>0,w=returning?1-smooth(s.recovery):smooth(s.wind),sweep=smooth(s.phase),direction=side*(reverse?-1:1);
   const turn=(p.pole?mix(-.24,.30,sweep):overhead?mix(-.18,.22,sweep):mix(-.64,.66,sweep))*direction*w;
   poses.Hips=[0,turn*.48,-direction*.025*w];poses.Spine=[.035*w,turn*.30,0];poses.Spine1=[.045*w,turn*.20,0];poses.Spine2=[(overhead?mix(-.13,.19,sweep):.075)*w,turn*.33,-direction*.07*w];poses.Head=[-.035*w,-turn*.50,0];
   poses.LeftUpLeg=[-.13*w,0,0];poses.RightUpLeg=[.09*w,0,0];poses.LeftLeg=[.23*w,0,0];poses.RightLeg=[.17*w,0,0];
   // Keep the free hand near the ribs and the shield protecting the shoulder.
   const free=f.attackLeft?'Right':'Left';poses[free+'Arm']=[-.48*w,0,(free==='Left'?-.22:.22)*w];poses[free+'ForeArm']=[-.75*w,0,0];
   lean=(p.pole?.12:.075)*sweep*w;drop=-.065*w;shift=mix(-.045,.10,sweep)*w;
   if(p.pole){
    const drive=s.recovery>0?1-smooth(s.recovery/.8):smooth(s.phase/.82),load=w,turn=side*(-.22*load+.40*drive);
    poses.Hips=[0,turn*.45,0];poses.Spine=[.025*drive,turn*.22,0];poses.Spine1=[.035*drive,turn*.18,0];poses.Spine2=[.07*drive,turn*.32,-side*.025*load];poses.Head=[-.025*drive,-turn*.55,0];
    const front=f.attackLeft?'Right':'Left',back=f.attackLeft?'Left':'Right';
    poses[front+'UpLeg']=[-.14*load-.10*drive,0,0];poses[front+'Leg']=[.28*load+.17*drive,0,0];poses[back+'UpLeg']=[.07*load,0,0];poses[back+'Leg']=[.13*load,0,0];
    lean=.12*drive-.025*load;shift=.075*drive-.025*load;drop=-.045*load-.025*drive;
    const advance=clamp(s.wind/.72),withdraw=clamp((s.recovery-.38)/.62);
    step={side:front,forward:.23*smooth(advance)*(1-smooth(withdraw)),lift:s.wind<.72?Math.sin(Math.PI*advance)*.055:withdraw>0?Math.sin(Math.PI*withdraw)*.045:0};
   }
   if(!p.pole){const advance=clamp(s.wind/.85),withdraw=clamp((s.recovery-.40)/.60);step={side:f.attackLeft?'Right':'Left',forward:(f.attackKind==='heavy'?.18:.14)*smooth(advance)*(1-smooth(withdraw)),lift:s.wind<.85?Math.sin(Math.PI*advance)*.04:withdraw>0?Math.sin(Math.PI*withdraw)*.035:0};}
   if(['legs','leftLeg','rightLeg'].includes(f.attackRegion)){drop-=.14*w;poses.LeftLeg[0]+=.25*w;poses.RightLeg[0]+=.25*w;}
  }else if(['recoil','stagger'].includes(f.action)){
   const u=clamp(f.timer/Math.max(.01,f.duration)),w=1-smooth(u),side=f.attackLeft?-1:1;
   const hit=f.recoilBody||{poses:{},drop:0,lean:0,shift:0};
   for(const [name,value] of Object.entries(hit.poses))poses[name]=value.map(n=>n*w);
   // Continue from the actual contact posture instead of snapping to a new pose.
   const kick=Math.sin(Math.PI*clamp(u/.52))*(f.action==='stagger'?1:.60);
   const add=(name,v)=>{const a=poses[name]||[0,0,0];poses[name]=a.map((n,i)=>n+v[i]*kick);};
   add('Spine2',[-.20,side*.13,side*.04]);add('Head',[.065,-side*.05,0]);add('RightLeg',[.14,0,0]);
   drop=(hit.drop||0)*w-.035*kick;lean=(hit.lean||0)*w-.07*kick;shift=(hit.shift||0)*w-.065*kick;
   if(hit.step)step={side:hit.step.side,forward:hit.step.forward*w,lift:hit.step.lift*w+Math.sin(Math.PI*u)*.035};
  }else if(['netcast','spearcast','bash','hook'].includes(f.action)){
   const t=clamp(f.timer/f.duration),wind=smooth(t/.34),release=smooth((t-.34)/.23),recover=smooth((t-.57)/.43),w=1-recover,side=f.attackLeft?'Left':'Right';
   poses.Hips=[0,(-.18*wind+.3*release)*w,0];poses.Spine2=[(.03*wind+.16*release)*w,(-.22*wind+.32*release)*w,0];poses.Head=[-.05*w,0,0];poses.LeftUpLeg=[-.18*w,0,0];poses.RightLeg=[.2*w,0,0];drop=-.025*w;
   const arm=f.action==='bash'||f.action==='netcast'?'Left':side;poses[arm+'Arm']=[(-.5*wind-1.05*release)*w,0,(arm==='Left'?-.18:.18)*w];poses[arm+'ForeArm']=[(-.75*wind+.62*release)*w,0,0];lean=.07*release*w;
  }
  return {poses,drop,lean,shift,step};
 }
 function world(f,v){const c=Math.cos(f.angle),s=Math.sin(f.angle);return{x:f.x+v.x*c+v.z*s,y:v.y+(f.navHeight||0),z:f.z-v.x*s+v.z*c};}
 function target(f,region){const r=regions[region]||regions.chest,side=region==='leftArm'?-.3:region==='rightArm'?.3:region==='leftLeg'?-.17:region==='rightLeg'?.17:0;return {...world(f,{x:side,y:r.y,z:0}),r:r.r};}
 function guardPoint(f){const region=f.guardRegion,r=shieldResponse(f);return {x:(region==='rightArm'?.3:region==='leftArm'?-.3:region==='rightLeg'?.17:region==='leftLeg'?-.17:.26)+r.x,y:(regions[region]?.y||1.42)+r.y,z:.29+r.z};}
 function segmentDistance(a,b,p){const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,d=x*x+y*y+z*z,t=d?clamp(((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/d):0;return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t,p.z-a.z-z*t);}
 function contact(f,v,from,to){const p=target(v,f.attackRegion),a=sample(f,from),b=sample(f,to);if(f.attackWeapon==='mace')return segmentDistance(world(f,a.tip),world(f,b.tip),p)<p.r+.14;
  for(let i=1;i<b.points.length;i++){if(Math.min(segmentDistance(world(f,a.points[i-1]),world(f,a.points[i]),p),segmentDistance(world(f,b.points[i-1]),world(f,b.points[i]),p),segmentDistance(world(f,a.points[i]),world(f,b.points[i]),p))<p.r+.07)return true;}return false;}
 // Test the same shield face used by the hand IK, before the body is reached.
  function shieldContact(f,v,from,to){
   if(!v.blocking||!v.shield||v.shieldHeldBy!==null)return null;
   const c=Math.cos(v.angle),s=Math.sin(v.angle),halfWidth=['thraex','hoplomachus','shield_parma','shield_celtic','shield_azure'].includes(v.shieldStyle)?.34:.40;
   const halfHeight=['thraex','hoplomachus','shield_parma','shield_celtic','shield_azure'].includes(v.shieldStyle)?.39:.56;
   const guard=guardPoint(v);
   const rotation=shieldResponse(v),cp=Math.cos(rotation.pitch),sp=Math.sin(rotation.pitch),cy=Math.cos(rotation.yaw),sy=Math.sin(rotation.yaw),cr=Math.cos(rotation.roll),sr=Math.sin(rotation.roll);
   const local=p=>{const x=(p.x-v.x)*c-(p.z-v.z)*s-guard.x,y=p.y-(v.navHeight||0)-guard.y,z=(p.x-v.x)*s+(p.z-v.z)*c-guard.z,yy=y*cp+z*sp,zz=-y*sp+z*cp,xx=x*cy-zz*sy;return{x:xx*cr+yy*sr,y:-xx*sr+yy*cr,z:x*sy+zz*cy};};
   function cross(a,b){const aa=local(a),bb=local(b),dz=bb.z-aa.z;if(Math.abs(dz)<1e-7)return null;const u=-aa.z/dz;if(u<0||u>1)return null;
    const x=mix(aa.x,bb.x,u),y=mix(aa.y,bb.y,u);return Math.abs(x)<=halfWidth+.08&&Math.abs(y)<=halfHeight+.08?{x:mix(a.x,b.x,u),y:mix(a.y,b.y,u),z:mix(a.z,b.z,u)}:null;}
   const a=sample(f,from),b=sample(f,to);
   for(let i=1;i<b.points.length;i++){const aa=world(f,a.points[i-1]),ab=world(f,a.points[i]),ba=world(f,b.points[i-1]),bb=world(f,b.points[i]);const p=cross(aa,ab)||cross(ba,bb)||cross(aa,ba)||cross(ab,bb);if(p)return p;}
   return null;
  }
  return {version:114,regions,profile,speedFactor,pace,impactQuality,shieldResponse,reaction,sample,poleGuard,world,target,contact,shieldContact,guardPoint,segmentDistance,flexible,body,smooth};
})();
if(false)module.exports=ArenaMotion;

Object.assign(root,{ArenaClasses,ArenaWeapons,ArenaMotion});
/* Arena simulation: teams, shared strike geometry, body damage and transferable equipment. */
(function(root){
'use strict';
const {ArenaClasses:Classes,ArenaWeapons:Weapons}=false?require('./class-data.js'):root;
const Motion=false?require('./combat-motion.js'):root.ArenaMotion;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
class ArenaCombat {
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(difficulty='normal',playerType='secutor',mode='4x5'){
  Object.assign(this,{mode,equipmentVersion:168,allowDrops:true,difficulty,time:0,events:[],finished:false,result:null,combo:0,comboUntil:0,lockedTarget:null,nets:[],netSequence:0,projectiles:[],projectileSequence:0,drops:[],dropSequence:0});
  this.stats={hits:0,blocks:0,dodges:0,damage:0,damageTaken:0,kills:0,parries:0,knockdowns:0,nets:0};
  const names=['Cassius','Varro','Felix','Drusus','Marcus','Titus','Lucius','Cato','Brutus','Aulus','Flavius','Decimus','Gaius','Quintus','Severus','Nero','Octavius','Rufus','Maximus','Silvanus'];
  this.fighters=names.map((name,id)=>{const team=mode==='solo20'?id:Math.floor(id/5),k=id%5,col=[0,-1,1,-2,2][k],row=0,type=id===0&&Classes[playerType]?playerType:Object.keys(Classes)[id%7],c=Classes[type];return {
   id,name,team,type,x:col*2.5,z:(team===0?1:-1)*(10+row*2.7),angle:team===0?Math.PI:0,hp:id===0?120:100,maxHp:id===0?120:100,stamina:100,
   action:'idle',guardPressedAt:-99,guardInput:false,parryReadyAt:0,counterUntil:0,counterTarget:null,recoilSample:null,timer:0,duration:0,cooldown:id%10*.07,think:0,target:null,blocking:false,blockAge:99,chain:0,lastAttack:-99,regenDelay:0,move:0,walk:0,flash:0,deadTime:0,dx:0,dz:0,attackKind:'light',attackRegion:'chest',lastRegion:'chest',reaction:0,
   weapon:c.weapon,offhand:null,leftGear:c.net?'net':c.scissor?'scissor':null,shield:!!c.shield,shieldStyle:type,helmet:true,helmetStyle:type,chest:!!c.armor,greaves:true,shoulders:true,
   body:{head:100,chest:100,leftArm:100,rightArm:100,rightLeg:100,leftLeg:100,legs:100},wear:{helmet:45,shield:65,chest:65,greaves:55,shoulders:45,weapon:40,offhand:40,leftGear:40},
   pickupHand:c.weapon==='spear'?'weapon':c.shield||c.net||c.scissor?'offhand':'weapon',spareSword:true,dualMode:false,nextNet:0,specialUntil:0,shieldHeldBy:null,hookTarget:null,stunUntil:0,netBusy:false,hitVictims:new Set()
  };});this.fighters.forEach((f,i)=>{const a=mode==='solo20'?i*Math.PI*2/20:f.team*Math.PI/2;const side=mode==='solo20'?0:([0,-1,1,-2,2][i%5])*1.7;f.x=Math.sin(a)*12+Math.cos(a)*side;f.z=Math.cos(a)*12-Math.sin(a)*side;f.angle=a+Math.PI;});return this;
 }
 enemy(a,b){return !!a&&!!b&&a!==b&&a.team!==b.team&&b.hp>0;}
 alive(team){return this.fighters.filter(f=>f.team===team&&f.hp>0).length;}
 emit(type,data={}){this.events.push({type,time:this.time,...data});}
 nearest(f,max=Infinity){let best=null,d=max;for(const v of this.fighters)if(this.enemy(f,v)&&distance(f,v)<d){best=v;d=distance(f,v);}return best;}
 bound(f,r=17.1){const d=Math.hypot(f.x,f.z);if(d>r){f.x*=r/d;f.z*=r/d;}}
 dropEquipment(f,slot,broken=false){
  if(!this.allowDrops||!f[slot])return null;
  const kind=slot==='weapon'||slot==='offhand'?f[slot]:slot==='leftGear'?f.leftGear:slot;
  const style=slot==='shield'?f.shieldStyle:slot==='helmet'?f.helmetStyle:f.type;
  const d={id:++this.dropSequence,kind,style,slot,team:f.team,itemEntry:f.equipment?.[slot],helmetColor:f.helmetColor,shieldBreakerHits:slot==='shield'?(f.shieldBreakerHits||0):0,durability:broken?Math.max(18,slot==='shield'?30:20):Math.max(1,f.wear[slot]||35),x:f.x+(slot==='weapon'?.6:-.6),z:f.z};this.bound(d,16.8);this.drops.push(d);
  f[slot]=['weapon','offhand','leftGear'].includes(slot)?null:false;
  if(slot==='shield'){f.blocking=false;f.shieldHeldBy=null;}
  if(f.equipment)delete f.equipment[slot];root.LudusLoadout?.refresh(f);this.emit('equipmentdrop',{id:f.id,drop:d.id,kind,broken});return d;
 }
 dropWeapon(f,slot='weapon'){return this.dropEquipment(f,slot);}
 canPickup(f,d){return this.allowDrops&&!!d&&!d.shattered&&!(f.netBusy&&(d.kind==='net'||d.kind==='scissor'||d.kind==='shield'||(Weapons[d.kind]&&f.pickupHand==='offhand')));}
 nearestDrop(id=0,range=1.8,missing=false){const f=this.fighters[id];if(!f||f.hp<=0)return null;let best=null;for(const d of this.drops)if(this.canPickup(f,d)&&(!missing||this.needsDrop(f,d))&&distance(f,d)<range){best=d;range=distance(f,d);}return best;}
 needsDrop(f,d){return Weapons[d.kind]?!f.weapon:d.kind==='shield'||d.kind==='net'||d.kind==='scissor'?!f.shield&&!f.offhand&&!f.leftGear:!f[d.kind];}
 clearLeft(f){f.brokenShield=null;this.dropEquipment(f,'shield');this.dropEquipment(f,'offhand');this.dropEquipment(f,'leftGear');}
 pickup(id,dropId){
  const f=this.fighters[id],index=this.drops.findIndex(d=>d.id===dropId),d=this.drops[index];
  if(this.finished||!f||f.hp<=0||f.action!=='idle'||f.stunUntil>this.time||!this.canPickup(f,d)||distance(f,d)>1.8)return false;
  this.drops.splice(index,1);let slot;
  if(Weapons[d.kind]){slot=f.pickupHand;if(slot==='offhand'){this.clearLeft(f);f.dualMode=true;}else this.dropWeapon(f);f[slot]=d.kind;}
  else if(d.kind==='net'||d.kind==='scissor'){this.clearLeft(f);slot='leftGear';f.leftGear=d.kind;f.pickupHand='offhand';}
  else if(d.kind==='shield'){this.clearLeft(f);slot='shield';f.shieldBreakerHits=d.shieldBreakerHits||0;f.shield=true;f.shieldStyle=d.style;f.pickupHand='offhand';}
  else{slot=d.kind;this.dropEquipment(f,slot);f[slot]=true;if(slot==='helmet')f.helmetStyle=d.style;}
  if(f.equipment&&d.itemEntry)f.equipment[slot]=d.itemEntry;if(slot==='helmet'){f.helmetColor=d.helmetColor;f.helmetModel=d.itemEntry?.item?.model||d.helmetModel||d.helmetColor||d.style;}root.LudusLoadout?.refresh(f);f.wear[slot]=d.durability||40;this.emit('pickup',{id,kind:d.kind,drop:dropId,slot});return true;
 }
 switchHand(id=0,draw=false){const f=this.fighters[id];if(this.finished||!f||f.hp<=0||f.action!=='idle'||f.netBusy)return false;
  if(draw&&f.spareSword){this.clearLeft(f);f.offhand='gladius';f.wear.offhand=40;f.spareSword=false;f.dualMode=true;f.pickupHand='offhand';}
  else if(draw)return false;else f.pickupHand=f.pickupHand==='weapon'?'offhand':'weapon';
  this.emit('hands',{id,hand:f.pickupHand});return true;
 }
 canBlock(f){return (!!f.shield&&f.shieldHeldBy===null)||!!(f.guardRegion&&(f.weapon||f.offhand));}
 specialKind(f){const left=f.pickupHand==='offhand',weapon=left?f.offhand:f.weapon;if(left){if(f.leftGear==='net')return 'net';if(f.leftGear==='scissor')return 'hook';if(f.shield)return 'bash';}if(weapon==='spear'||(weapon==='trident'||weapon==='trident_gladiator'))return 'throw';return weapon?'lunge':null;}
 special(id=0){
  const f=this.fighters[id];if(this.finished||!f||f.hp<=0||f.action!=='idle'||f.stunUntil>this.time)return false;
  const kind=this.specialKind(f);if(!kind||(kind==='net'?f.nextNet:f.specialUntil)>this.time)return false;
  const range=kind==='net'?6.2:kind==='throw'?9:kind==='lunge'?3:2.2,locked=id===0?this.fighters[this.lockedTarget]:null,t=this.enemy(f,locked)&&distance(f,locked)<=range?locked:this.nearest(f,range);
  if(!t)return false;if(kind==='net')return this.throwNet(id,t.id);if(f.stamina<20)return false;
  f.angle=Math.atan2(t.x-f.x,t.z-f.z);
  if(kind==='throw'){const slot=f.pickupHand;this.projectiles.push({id:++this.projectileSequence,owner:id,kind:f[slot],itemEntry:f.equipment?.[slot],durability:f.wear[slot],x:f.x,z:f.z,dx:Math.sin(f.angle),dz:Math.cos(f.angle),age:0,launched:false});f[slot]=null;if(f.equipment)delete f.equipment[slot];root.LudusLoadout?.refresh(f);f.action='spearcast';f.attackLeft=slot==='offhand';f.duration=.7;}
  else if(kind==='hook'){if(!t.shield||t.shieldHeldBy!==null||t.action==='dodge')return false;f.hookTarget=t.id;t.shieldHeldBy=f.id;t.blocking=false;f.action='hook';f.duration=2;}
  else if(kind==='bash'){if(!f.shield||!this.canBlock(f))return false;f.action='bash';f.duration=.6;f.specialTarget=t.id;f.specialDone=false;}
  else{if(!this.attack(id,true,'chest'))return false;f.lunging=true;f.specialUntil=this.time+6;return true;}
  f.timer=0;f.blocking=false;f.stamina-=20;f.regenDelay=.9;f.specialUntil=this.time+6;this.emit('special',{id,target:t.id,kind});return true;
 }
 wearEquipment(f,slot,amount){if(!f[slot])return;f.wear[slot]=Math.max(0,f.wear[slot]-amount);if(f.wear[slot]===0)this.dropEquipment(f,slot,true);}
 damage(attacker,victim,base,region='chest',heavy=false,point=null){
  if(!this.enemy(attacker,victim))return false;base*=(attacker.team===0?.5:.55)*(attacker.attackBonus??1)/(victim.defenseBonus??1);const slot=region==='head'?'helmet':region==='chest'?'chest':['legs','leftLeg','rightLeg'].includes(region)?'greaves':null,protectedPart=slot&&victim[slot],weak=victim.body[region]<30;
  const damage=Math.max(1,Math.round(base*(protectedPart?.8:1.12)*(weak?1.5:1)));victim.lastRegion=region;victim.reaction=.32;
  victim.body[region]=Math.max(0,(victim.body[region]??100)-base*(heavy?1.7:1.1));if(region==='leftLeg'||region==='rightLeg')victim.body.legs=Math.min(victim.body.leftLeg,victim.body.rightLeg);
  if(protectedPart)this.wearEquipment(victim,slot,base*(heavy?1.8:.65));
  if(region==='rightArm')this.wearEquipment(victim,'weapon',base*(heavy?1.65:.5));
  if(region==='leftArm'){for(const item of ['shield','offhand','leftGear'])this.wearEquipment(victim,item,base*(heavy?1.65:.5));}
  if(attacker.id===0){this.stats.hits++;this.stats.damage+=Math.min(victim.hp,damage);this.combo=this.time<this.comboUntil?this.combo+1:1;this.comboUntil=this.time+2.6;}
  if(victim.id===0)this.stats.damageTaken+=Math.min(victim.hp,damage);
  victim.impactDirection=delta(Math.atan2(attacker.x-victim.x,attacker.z-victim.z),victim.angle);victim.impactStrength=(heavy?1:.65)*(attacker._impactQuality??1);victim.hp=Math.max(0,victim.hp-damage);victim.flash=.2;victim.regenDelay=.8;victim.blocking=false;
  const aim=Math.atan2(victim.x-attacker.x,victim.z-attacker.z);victim.x+=Math.sin(aim)*(heavy?.22:.1);victim.z+=Math.cos(aim)*(heavy?.22:.1);this.bound(victim);
  if(victim.hp===0){
   if(attacker.id===0)this.stats.kills++;
   if(victim.id===0&&this.mode==='solo20')this.stats.placement=this.fighters.filter(f=>f.hp>0).length+1;
   // Preserve appearance only; ownership and pickup still use the real dropped items.
   victim.corpseEquipment=Object.fromEntries(['weapon','offhand','leftGear','shield','helmet','chest','greaves','shoulders','shieldStyle','helmetStyle','helmetColor','helmetModel','chestModel','shoulderModel','netBusy'].map(key=>[key,victim[key]]));
   victim.deadTime=0;victim.knockOrigin=null;victim.knockAngle=null;victim.knockedUntil=0;victim.skillMotion=null;
   for(const item of ['weapon','offhand','leftGear','shield','helmet','chest','greaves','shoulders'])this.dropEquipment(victim,item);victim.action='down';victim.timer=0;this.emit('down',{id:victim.id,killer:attacker.id});}
  else if(victim.stunUntil>this.time)victim.action='stunned';
  else{const knock=heavy&&['legs','leftLeg','rightLeg'].includes(region)||attacker.chain===3&&heavy;victim.action=knock?'knocked':'hurt';victim.timer=0;victim.duration=knock?1.25:.25;if(knock){victim.knockOrigin=null;victim.knockAngle=null;if(attacker.id===0)this.stats.knockdowns++;this.emit('knockdown',{id:victim.id});}}
  this.emit('hit',{id:victim.id,source:attacker.id,damage,region,point:point||Motion.target(victim,region),metal:!!protectedPart,direction:delta(aim+Math.PI,victim.angle)});return true;
 }
 prepareGuard(f,pressed){
  const rising=pressed&&!f.guardInput;f.guardInput=pressed;
  if(rising){f.guardPressedAt=f.action==='idle'&&this.time>=f.parryReadyAt?this.time:-99;f.parryReadyAt=Math.max(f.parryReadyAt,this.time+.42);}
  f.blocking=pressed&&f.action==='idle'&&f.stamina>0&&this.canBlock(f);f.blockAge=f.blocking?this.time-f.guardPressedAt:99;
 }
 deflectAttack(attacker,victim,perfect=false){
  if(attacker.action!=='attack')return;
  attacker.recoilBody=Motion.body(attacker);attacker.recoilSample=Motion.sample(attacker);attacker.action=perfect?'stagger':'recoil';attacker.timer=0;attacker.duration=perfect?.62:attacker.attackKind==='heavy'?.30:.23;attacker.hitDone=true;
  if(perfect){victim.counterTarget=attacker.id;victim.counterUntil=this.time+.70;victim.parryReadyAt=Math.max(victim.parryReadyAt,this.time+.42);}
 }
 shieldBreakerHit(attacker,victim){
  if(this.equipmentVersion<168||!victim.shield||victim.guardRegion||!['mace','heavy_mace','warhammer'].includes(attacker.attackWeapon??attacker.weapon))return false;
  victim.shieldBreakerHits=(victim.shieldBreakerHits||0)+1;
  if(victim.shieldBreakerHits>=2){victim.brokenShield=victim.equipment?.shield;const d=this.dropEquipment(victim,'shield',true);if(d)d.shattered=true;victim.shield=false;victim.blocking=false;victim.shieldHeldBy=null;victim.wear.shield=0;this.emit('break',{id:victim.id,source:attacker.id,shield:true});}
  return true;
 }
 guard(attacker,victim,heavy=false,point=null){
  const source=Math.atan2(attacker.x-victim.x,attacker.z-victim.z),front=Math.abs(delta(source,victim.angle))<1.35;
  if(!victim.blocking||!this.canBlock(victim)||!front)return false;
  if(victim.guardRegion&&!victim._automaticGuard&&victim.guardRegion!==attacker.attackRegion)return false;
  if(!victim.guardRegion&&attacker._meleeContact&&!attacker._shieldContact&&!victim._automaticGuard)return false;
  const perfect=attacker.action==='attack'&&!victim._automaticGuard&&victim.id===0&&this.time-victim.guardPressedAt<=.20&&victim.guardPressedAt>=0;
  const cost=perfect?6:heavy?34:20;if(victim.stamina<cost){victim.stamina=0;victim.blocking=false;victim.guardPressedAt=-99;this.wearEquipment(victim,'shield',25);this.emit('break',{id:victim.id,source:attacker.id});return false;}
  const breaker=this.shieldBreakerHit(attacker,victim);
  victim.stamina-=cost;victim.regenDelay=.9;victim.guardFlash=.20;victim.guardImpact=heavy?1:.65;if(victim.id===0)this.stats.blocks++;
  const gp=Motion.guardPoint(victim),c=Math.cos(victim.angle),s=Math.sin(victim.angle);victim.guardImpactX=point?clamp(((point.x-victim.x)*c-(point.z-victim.z)*s-gp.x)/.4,-1,1):0;victim.guardImpactY=point?clamp((point.y-(victim.navHeight||0)-gp.y)/.56,-1,1):0;
  attacker.strikeConnected=true;this.deflectAttack(attacker,victim,perfect);
  if(perfect){victim.guardPressedAt=-99;this.stats.parries++;this.wearEquipment(attacker,attacker.attackLeft?'offhand':'weapon',heavy?26:15);this.emit('parry',{id:victim.id,source:attacker.id,point,perfect:true});}
  else{if(!breaker)this.wearEquipment(victim,'shield',heavy?29:10);this.emit('block',{id:victim.id,source:attacker.id,point,heavy});}return true;
 }
 hit(attacker,victim,geometric=false,guardPoint=null){
  if(!this.enemy(attacker,victim)||victim.action==='knocked'&&victim.timer<.8)return false;
  const kind=attacker.attackWeapon??attacker.weapon,range=Weapons[kind]?.range||1.2,aim=Math.atan2(victim.x-attacker.x,victim.z-attacker.z);
  if(!geometric&&(distance(attacker,victim)>range||Math.abs(delta(aim,attacker.angle))>1.05))return false;
  if(victim.action==='dodge'&&victim.timer<.37){if(victim.id===0)this.stats.dodges++;this.emit('evade',{id:victim.id});return true;}
  const point=guardPoint||Motion.target(victim,attacker.attackRegion);let blocked;
  attacker._meleeContact=geometric;attacker._shieldContact=!!guardPoint;
  try{blocked=this.guard(attacker,victim,attacker.attackKind==='heavy',point);}finally{attacker._meleeContact=false;attacker._shieldContact=false;}
  if(blocked)return true;
  const base=(attacker.id===0?20:this.difficulty==='easy'?11:15.5)*(attacker.attackKind==='heavy'?1.65:1)*(kind?1:.35)*(attacker.body[attacker.attackLeft?'leftArm':'rightArm']<30?.8:1);
  const counter=attacker.attackCounterTarget===victim.id,before=victim.hp;
  const quality=Motion.impactQuality(attacker,victim);let hit;
  attacker._impactQuality=quality;try{hit=this.damage(attacker,victim,base*(counter?1.20:1)*quality,attacker.attackRegion,attacker.attackKind==='heavy',point);}finally{delete attacker._impactQuality;}
  if(victim.hp<before)attacker.strikeConnected=true;
  if(counter&&victim.hp<before){if(attacker.id===0)this.stats.counters=(this.stats.counters||0)+1;this.emit('counter',{id:attacker.id,target:victim.id});}return hit;
 }
 attack(id,heavy=false,region='chest'){
  const f=this.fighters[id];if(this.finished||!f||f.hp<=0||f.action!=='idle'||f.cooldown>0||f.stunUntil>this.time)return false;
  const counterTarget=this.fighters[f.counterTarget],lockedTarget=id===0?this.fighters[this.lockedTarget]:null;
  const counter=!heavy&&f.counterUntil>this.time&&this.enemy(f,counterTarget)&&distance(f,counterTarget)<=(Weapons[f.weapon]?.range||1.2)+.15&&(!this.enemy(f,lockedTarget)||lockedTarget.id===counterTarget.id);
  const cost=heavy?27:13;if(f.stamina<cost){if(id===0)this.emit('tired');return false;}
  f.chain=!heavy&&this.time-f.lastAttack<1.4?f.chain%3+1:1;f.lastAttack=this.time;f.attackLeft=!!f.offhand&&(f.chain===2||!f.weapon);f.attackWeapon=f.attackLeft?f.offhand:f.weapon;
  f.attackRegion=Motion.regions[region]?region:'chest';f.attackProfile=Motion.profile(f.attackWeapon,heavy,id!==0);
  f.attackCounterTarget=counter?counterTarget.id:null;f.recoilSample=null;
  if(counter){f.attackProfile.wind*=.55;f.attackProfile.recover*=.85;f.attackProfile.duration=f.attackProfile.wind+f.attackProfile.active+f.attackProfile.recover;f.counterUntil=0;f.counterTarget=null;}
  f.duration=f.attackProfile.duration;f.hitTime=f.attackProfile.wind;f.hitDone=false;f.hitVictims=new Set();f.strikeConnected=false;f.attackSettled=false;f.lunging=false;
  f.stamina-=cost;f.regenDelay=.9;f.blocking=false;f.action='attack';f.attackKind=heavy?'heavy':'light';f.timer=0;
  const locked=id===0?this.fighters[this.lockedTarget]:null,target=counter?counterTarget:this.enemy(f,locked)&&distance(f,locked)<3.5?locked:this.nearest(f,3.5);if(target)f.angle=Math.atan2(target.x-f.x,target.z-f.z);
  this.emit('swing',{id,heavy,kind:f.attackWeapon});return true;
 }
 dodge(id,x,z){const f=this.fighters[id];if(this.finished||!f||f.hp<=0||f.action!=='idle'||f.stamina<25||f.stunUntil>this.time)return false;
  f.stamina-=25;f.regenDelay=.8;f.blocking=false;f.action='dodge';f.timer=0;f.duration=.46;const len=Math.hypot(x,z);f.dx=len>.01?x/len:-Math.sin(f.angle);f.dz=len>.01?z/len:-Math.cos(f.angle);this.emit('dodge',{id});return true;
 }
 throwNet(id,targetId){const f=this.fighters[id],t=this.fighters[targetId];if(this.finished||!this.enemy(f,t)||f.hp<=0||f.leftGear!=='net'||f.action!=='idle'||f.stunUntil>this.time||this.time+1e-8<f.nextNet||f.netBusy||distance(f,t)>6.2)return false;
  f.angle=Math.atan2(t.x-f.x,t.z-f.z);f.action='netcast';f.timer=0;f.duration=.9;f.blocking=false;f.nextNet=this.time+5;f.netBusy=true;
  const n={id:++this.netSequence,owner:id,target:targetId,age:0,x:f.x,z:f.z,ox:f.x,oz:f.z,dx:Math.sin(f.angle),dz:Math.cos(f.angle),victim:null,retractAt:1.02,ignored:[],holdUntil:0};this.nets.push(n);this.emit('netthrow',{id,target:targetId,net:n.id});return true;
 }
 updateNets(dt){for(let k=this.nets.length-1;k>=0;k--){const n=this.nets[k],owner=this.fighters[n.owner];n.age+=dt;
  if(owner.hp<=0||owner.leftGear!=='net'||n.age<.3&&owner.action!=='netcast'){this.nets.splice(k,1);owner.netBusy=false;continue;}
  const px=n.x,pz=n.z;if(n.victim!==null&&this.time<n.holdUntil&&this.fighters[n.victim].hp>0){const v=this.fighters[n.victim];n.x=v.x;n.z=v.z;}
  else if(n.age<n.retractAt){const travel=Math.max(0,n.age-.3)*7.5;n.x=n.ox+n.dx*travel;n.z=n.oz+n.dz*travel;}
  else{n.rx??=[n.x,n.z];const u=clamp((n.age-n.retractAt)/.55,0,1);n.x=n.rx[0]+(owner.x-n.rx[0])*u;n.z=n.rx[1]+(owner.z-n.rx[1])*u;}
  if(n.age>=.3&&n.age<n.retractAt&&n.victim===null)for(const v of this.fighters){if(!this.enemy(owner,v)||v.stunUntil>this.time||(v.navHeight||0)>.65||n.ignored.includes(v.id))continue;
   if(Motion.segmentDistance({x:px,y:0,z:pz},{x:n.x,y:0,z:n.z},{x:v.x,y:0,z:v.z})>.65)continue;
   if(v.action==='dodge'&&v.timer<.37){n.ignored.push(v.id);this.emit('evade',{id:v.id});continue;}
   n.victim=v.id;n.x=v.x;n.z=v.z;n.holdUntil=this.time+3;n.retractAt=n.age+3;v.stunUntil=this.time+3;v.action='stunned';v.timer=0;v.duration=3;v.blocking=false;if(owner.id===0)this.stats.nets++;this.emit('netcatch',{id:v.id,source:owner.id,until:v.stunUntil});break;
  }
  if(n.age>=n.retractAt+.55){owner.netBusy=false;this.nets.splice(k,1);this.emit('netreturn',{id:n.owner});}
 }}
 updateSpecials(dt){
  for(const f of this.fighters)if(f.shieldHeldBy!==null){const o=this.fighters[f.shieldHeldBy];if(!o||!f.shield||o.hp<=0||f.hp<=0||o.action!=='hook'||o.timer>=o.duration||o.leftGear!=='scissor'||distance(o,f)>2.6){f.shieldHeldBy=null;if(o)o.hookTarget=null;}}
  for(let i=this.projectiles.length-1;i>=0;i--){const n=this.projectiles[i],owner=this.fighters[n.owner];n.age+=dt;
   if(!n.launched){if(owner.action!=='spearcast'||owner.hp<=0){this.landProjectile(n);this.projectiles.splice(i,1);continue;}if(n.age<.27){n.x=owner.x;n.z=owner.z;continue;}n.launched=true;}
   const px=n.x,pz=n.z;n.x+=n.dx*12*dt;n.z+=n.dz*12*dt;let done=n.age>=(n.maxAge||1.02)||Math.hypot(n.x,n.z)>(this.naval?this.naval.arenaRadius:17);
   for(const v of this.fighters){if(!this.enemy(owner,v)||v.action==='dodge')continue;if(Motion.segmentDistance({x:px,y:1.38,z:pz},{x:n.x,y:1.38,z:n.z},Motion.target(v,'chest'))>.42)continue;
    if(!this.guard(owner,v,false,Motion.target(v,'chest'))){const bonus=owner.attackBonus;owner.attackBonus=n.attackBonus??bonus;this.damageProjectileV10(owner,v,n,n.baseDamage??(owner.id===0?30:20),'chest',false);owner.attackBonus=bonus;}done=true;break;}
   if(done){this.landProjectile(n);this.projectiles.splice(i,1);}
  }
 }
 landProjectile(n){if(!this.allowDrops)return;const d={id:++this.dropSequence,kind:n.kind,itemEntry:n.itemEntry,slot:'weapon',durability:n.durability,x:n.x,z:n.z};this.bound(d,16.8);this.drops.push(d);}
 botTactics(f){return clamp(Number(f.tactics??50)/100,0,1);}
 botAttackRegion(f,target){
  const regions=['chest','head','leftArm','rightArm','leftLeg','rightLeg'];
  if(this.random()<this.botTactics(f)*.8){
   const protection={chest:target.chest,head:target.helmet,leftLeg:target.greaves,rightLeg:target.greaves,leftArm:target.shoulders,rightArm:target.shoulders};
   const score=r=>(100-(target.body?.[r]??100))+(protection[r]?0:20)-(target.blocking&&target.guardRegion===r?45:0);
   return regions.reduce((best,r)=>score(r)>score(best)?r:best,regions[0]);
  }
  return regions[Math.min(regions.length-1,Math.floor(this.random()*regions.length))];
 }
 botThreat(f){
  let found=null,score=Infinity;
  for(const t of this.fighters){
   if(!this.enemy(f,t)||t.action!=='attack'||!t.attackProfile)continue;
   const p=t.attackProfile,d=distance(f,t),range=Weapons[t.attackWeapon||t.weapon]?.range||1.2;
   if(t.timer>p.wind+p.active||d>range+.4)continue;
   const incoming=Math.atan2(f.x-t.x,f.z-t.z),visible=Math.atan2(t.x-f.x,t.z-f.z);
   if(Math.abs(delta(incoming,t.angle))>1.2||Math.abs(delta(visible,f.angle))>2.05)continue;
   const urgency=Math.max(0,p.wind-t.timer)+d*.025;
   if(urgency<score){found=t;score=urgency;}
  }return found;
 }
 botRoll(f,t){
  const a=Math.atan2(t.x-f.x,t.z-f.z),side=f.id%2?1:-1;
  let best=null,bestScore=-Infinity;
  for(const s of [side,-side,0,side*2,-side*2]){
   const sign=Math.sign(s),away=Math.abs(s)===1?.28:0;
   let x=s?Math.cos(a)*sign-Math.sin(a)*away:-Math.sin(a),z=s?-Math.sin(a)*sign-Math.cos(a)*away:-Math.cos(a);
   const length=Math.hypot(x,z);x/=length;z/=length;
   const end={x:f.x+x*3.7,z:f.z+z*3.7};
   if(this.naval?!this.naval.canStand(f,end):Math.hypot(end.x,end.z)>16.7)continue;
   let clearance=4;for(const other of this.fighters)if(other!==f&&other.hp>0)clearance=Math.min(clearance,distance(end,other));
   const value=clearance-(s===0?.25:0);if(value>bestScore){bestScore=value;best={x,z};}
  }
  if(!best||bestScore<.72)return false;
  const ok=this.dodge(f.id,best.x,best.z);
  if(ok){f.aiEvadeAt=this.time+(this.difficulty==='easy'?2.6:1.65)+this.random()*.65;}
  return ok;
 }
 botDefend(f,t){
  if(!t){f.aiThreat=null;return false;}
  const easy=this.difficulty==='easy',skill=this.botTactics(f),key=t.id+':'+t.lastAttack;
  if(f.aiThreat?.key!==key)f.aiThreat={key,noticed:this.time,delay:Math.max(.10,((easy?.22:.12)+this.random()*(easy?.15:.12))*(1.25-.5*skill)),choice:null,roll:this.random(),guard:this.random()};
  const threat=f.aiThreat;
  // Observe the visible wind-up first; no instantaneous input reading or repeated probability rolls.
  if(this.time-threat.noticed<threat.delay)return true;
  if(threat.choice===null){
   const shield=!!f.shield&&f.shieldHeldBy===null,heavy=t.attackKind==='heavy';
   const chance=Math.min(.9,(shield?(heavy?.48:.24):(heavy?.76:.59))*(easy?.64:1)*(.8+.4*skill));
   if(threat.roll<chance&&f.stamina>=33&&this.time>=(f.aiEvadeAt||0)&&this.botRoll(f,t)){threat.choice='roll';return true;}
   threat.choice=threat.guard<Math.min(.95,(easy?.53:.82)+.2*(skill-.5))?'guard':'miss';
  }
  if(threat.choice==='guard'&&f.stamina>=(t.attackKind==='heavy'?35:22)){
   f.angle+=delta(Math.atan2(t.x-f.x,t.z-f.z),f.angle)*.45;
   f.guardRegion=f.shield?null:t.attackRegion;
   f.blocking=this.canBlock(f);return f.blocking;
  }
  return false;
 }
 botStep(f,dt){
  f.guardRegion=null;f.think-=dt;
  let target=this.fighters[f.target];
  if(f.think<=0||!this.enemy(f,target)){target=this.nearest(f);f.target=target?.id??null;f.think=.45-.3*this.botTactics(f);}
  const drop=this.nearestDrop(f.id,1.8,true);
  if(drop){if(Weapons[drop.kind]&&!f.weapon)f.pickupHand='weapon';this.pickup(f.id,drop.id);}
  if(!target)return;
  const d=distance(f,target),a=Math.atan2(target.x-f.x,target.z-f.z),easy=this.difficulty==='easy';
  f.angle+=delta(a,f.angle)*Math.min(1,dt*9);
  const threat=this.botThreat(f);
  if(this.botDefend(f,threat))return;
  const weapon=f.weapon||f.offhand,range=Weapons[weapon]?.range||1.2;
  // Collision ranges are broad-phase limits; close to the actual blade arc before striking.
  const spacing=['spear','trident','trident_gladiator','halberd'].includes(weapon)?1.9:weapon==='whip'?1.3:weapon==='mace'?1.15:weapon?1.1:.85;
  if(['spear','trident','trident_gladiator','halberd'].includes(weapon)&&d<1.45&&f.stamina>=20){
   f.x-=Math.sin(a)*1.2*dt;f.z-=Math.cos(a)*1.2*dt;f.move=.32;
  }else if(f.stamina<20+16*this.botTactics(f)&&d<3.3){
   const side=f.id%2?1:-1;f.x+=(-Math.sin(a)*1.7+Math.cos(a)*side*.5)*dt;f.z+=(-Math.cos(a)*1.7-Math.sin(a)*side*.5)*dt;f.move=.5;
  }else if(d>spacing){
   const speed=(easy?1.9:2.45)*(f.body.legs<30?.75:1)*(f.speedBonus||1);
   f.x+=Math.sin(a)*speed*dt;f.z+=Math.cos(a)*speed*dt;f.move=.75;
  }else if(f.cooldown>0&&d<spacing+.15){
   const side=f.id%2?1:-1;f.x+=Math.cos(a)*side*.32*dt;f.z-=Math.sin(a)*side*.32*dt;f.move=.12;
  }else if(!f.blocking&&f.cooldown===0&&f.stamina>=19){
   const heavy=f.stamina>40+16*this.botTactics(f)&&target.action!=='attack'&&this.random()<(easy?.12:.20);
   this.attack(f.id,heavy,this.botAttackRegion(f,target));
  }
  // Keep a melee weapon in hand at close range; the old random throw left bots unarmed.
  if(f.action==='idle'&&f.stamina>42&&this.time>=(f.aiSpecialAt||0)){
   f.aiSpecialAt=this.time+.85+this.random();
   for(const index of [1,0]){
    const kind=this.specialKind(f,index),use=kind==='net'&&d>2.3&&d<5.5||kind==='bash'&&d<1.85||kind==='disarm'&&d<1.9||kind==='pull'&&d>2.5&&d<5||kind==='throw'&&d>range+1.2&&d<6;
    if(use&&this.random()<(easy?.14:.27)&&this.special(f.id,index))break;
   }
  }
 }
 tick(dt,input={}){
  if(this.finished)return;dt=clamp(dt,0,.05);this.time+=dt;this.fighters[0].guardRegion=Motion.regions[input.guardRegion]?input.guardRegion:null;this.prepareGuard(this.fighters[0],!!input.block);this.updateNets(dt);this.updateSpecials(dt);
  for(const f of this.fighters){f.cooldown=Math.max(0,f.cooldown-dt);f.regenDelay=Math.max(0,f.regenDelay-dt);f.flash=Math.max(0,f.flash-dt);f.reaction=Math.max(0,f.reaction-dt);f.passiveEvade=Math.max(0,(f.passiveEvade||0)-dt);f.guardFlash=Math.max(0,(f.guardFlash||0)-dt);f.move=0;
   if(f.hp<=0){f.deadTime+=dt;continue;}if(f.stunUntil>this.time){f.action='stunned';f.blocking=false;continue;}if(f.action==='stunned'){f.action='idle';f.timer=0;}
   if(f.navJump){f.blocking=false;continue;}
   if(f.action!=='idle'){const before=f.timer;f.timer+=dt;
    if(f.action==='attack'){const p=f.attackProfile;if(f.lunging&&f.timer<p.wind){f.x+=Math.sin(f.angle)*dt*2;f.z+=Math.cos(f.angle)*dt*2;}
     if(f.timer>=p.wind&&before<=p.wind+p.active){const from=Math.max(before,p.wind),to=Math.min(f.timer,p.wind+p.active);for(const v of this.fighters){if(f.action!=='attack')break;if(this.enemy(f,v)&&!f.hitVictims.has(v.id)){const shield=Motion.shieldContact(f,v,from,to);if(shield||Motion.contact(f,v,from,to)){if(this.hit(f,v,true,shield))f.hitVictims.add(v.id);if(p.pole)break;}}}}
     if(f.action==='attack'&&!f.attackSettled&&f.timer>p.wind+p.active){f.attackSettled=true;if(!f.strikeConnected){const extra=f.attackKind==='heavy'?.22:.14;f.attackProfile={...p,recover:p.recover+extra,duration:p.duration+extra};f.duration=f.attackProfile.duration;}}
     f.hitDone=f.timer>p.wind+p.active;
    }
    if(f.action==='bash'&&!f.specialDone&&f.timer>=.25){f.specialDone=true;const t=this.fighters[f.specialTarget];if(this.enemy(f,t)&&this.canBlock(f)&&distance(f,t)<=2.3&&t.action!=='dodge'){const a=Math.atan2(t.x-f.x,t.z-f.z),origin={x:t.x,z:t.z};t.x+=Math.sin(a)*.85;t.z+=Math.cos(a)*.85;this.bound(t);this.knock(t,1.5);t.knockOrigin=origin;t.knockAngle=a+Math.PI;t.reaction=.3;t.lastRegion='chest';this.emit('bashhit',{id:t.id,source:f.id,point:Motion.target(t,'chest')});}}
    if(f.action==='dodge'){const speed=f.body.legs<30?6:8;f.x+=f.dx*speed*dt;f.z+=f.dz*speed*dt;}
    if(f.timer>=f.duration){f.action='idle';f.cooldown=f.id===0?.06:this.difficulty==='easy'?.42+this.random()*.3:.28+this.random()*.24;}
   }
   const wasBlocking=f.blocking;f.blocking=f.id===0?!!input.block&&f.action==='idle'&&f.stamina>0&&this.canBlock(f):false;
   if(f.id===0&&f.action==='idle'){const mx=input.x||0,mz=input.z||0,len=Math.hypot(mx,mz);if(len>.03){const speed=(f.blocking?1.8:4.2)*(f.body.legs<30?.75:1)*(f.speedBonus||1);f.x+=mx/Math.max(1,len)*speed*dt;f.z+=mz/Math.max(1,len)*speed*dt;if(!f.blocking&&input.faceAngle===undefined)f.angle+=delta(Math.atan2(mx,mz),f.angle)*Math.min(1,dt*16);f.move=Math.min(1,len);}if(input.faceAngle!==undefined)f.angle+=delta(input.faceAngle,f.angle)*Math.min(1,dt*12);}
   else if(f.id!==0&&f.action==='idle')this.botStep(f,dt);
   f.blockAge=f.id===0?(f.blocking?this.time-f.guardPressedAt:99):f.blocking?(wasBlocking?f.blockAge+dt:0):99;if(f.regenDelay===0&&f.action==='idle')f.stamina=Math.min(f.maxStamina||100,f.stamina+dt*(f.blocking?4:21)*.75*.65*(1+Math.min(12,Math.max(0,Number(f.combatStaminaBonus)||0))/100)*(1+(Math.min(100,Math.max(0,Number(f.combatMorale??50)))-50)/1000));if(f.blocking)f.stamina=Math.max(0,f.stamina-dt*3);f.walk+=dt*f.move*9;this.bound(f);
  }
  for(let i=0;i<this.fighters.length;i++)for(let j=i+1;j<this.fighters.length;j++){const a=this.fighters[i],b=this.fighters[j];if(a.hp<=0||b.hp<=0||a.navJump?.airborne||b.navJump?.airborne)continue;const d=distance(a,b);if(d<.82){const x=d>.001?(a.x-b.x)/d:1,z=d>.001?(a.z-b.z)/d:0,k=(.82-d)*.5;a.x+=x*k;a.z+=z*k;b.x-=x*k;b.z-=z*k;this.bound(a);this.bound(b);}}
  if(this.alive(0)===0||(this.mode!=='survival'&&!this.fighters.some(f=>f.team!==0&&f.hp>0))){this.finished=true;this.result=this.alive(0)>0?'win':'loss';this.emit('finish',{result:this.result});}
 }
 drain(){return this.events.splice(0);}
}
if(false){require('./equipment-skills.js')(ArenaCombat,Classes);module.exports={ArenaCombat,delta,distance};}else root.ArenaCombat=ArenaCombat;
})(root);

/* Equipment specials: class affects base stats, never access to a weapon skill. */
(function(root){
'use strict';
const install=(Combat,Classes)=>{
 const p=Combat.prototype,reset=p.reset,tick=p.tick,attack=p.attack,net=p.throwNet;
 const Motion=false?require('./combat-motion.js'):root.ArenaMotion;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 p.attack=function(...args){const ok=attack.apply(this,args);if(ok){const f=this.fighters[args[0]];f.attackProfile=Motion.pace(f);f.duration=f.attackProfile.duration;f.hitTime=f.attackProfile.wind;}return ok;};
 p.reset=function(...args){const r=reset.apply(this,args);for(const f of this.fighters){const s=Classes[f.type].stats;f.skillReady=[0,0];f.overall=50;f.maxHp=f.hp=s.health*2;f.maxStamina=f.stamina=s.stamina*2;f.attackBonus=s.strength/50;f.defenseBonus=s.defense/50;f.speedBonus=s.speed/50;f.agility=s.agility;f.spareSword=false;}return r;};
 p.specialKind=function(f,index){const left=index===undefined?f.pickupHand==='offhand':index===1,w=left?f.offhand:f.weapon;if(left){if(f.leftGear==='net')return 'net';if(f.leftGear==='scissor')return 'disarm';if(f.shield)return 'bash';}if(['spear','trident','trident_gladiator','gladius','sica'].includes(w))return 'throw';if(w==='whip')return 'pull';return null;};
 p.skillNames=function(f){return [0,1].map(i=>({net:'AĞ AT',disarm:'SİLAH DÜŞÜR',bash:'KALKAN VUR',throw:'FIRLAT',pull:'ÇEK'}[this.specialKind(f,i)]||'ÖZEL YOK'));};
 p.knock=function(t,seconds){t.stunUntil=this.time+seconds;t.knockedUntil=t.stunUntil;t.action='knocked';t.timer=0;t.duration=seconds;t.knockOrigin=null;t.knockAngle=null;t.blocking=false;this.emit('knockdown',{id:t.id});};
 p.special=function(id=0,index){
  const f=this.fighters[id];if(this.finished||!f||f.hp<=0||f.action!=='idle'||f.stunUntil>this.time)return false;
  index=index===undefined?(f.pickupHand==='offhand'?1:0):index;if(index!==0&&index!==1)return false;
  const kind=this.specialKind(f,index),slot=index?'offhand':'weapon',w=f[slot];
  if(!kind||f.stamina<26||(f.skillReady?.[index]||0)>this.time)return false;
  const range=kind==='net'?6.2:kind==='throw'?(['gladius','sica'].includes(w)?4.5:9):kind==='pull'?Infinity:2.2;
  const locked=this.fighters[id===0?this.lockedTarget:f.target];
  const t=this.enemy(f,locked)&&distance(f,locked)<=range?locked:kind==='pull'?null:this.nearest(f,range);
  if(!t||t.action==='dodge'||kind==='net'&&f.netBusy||kind==='disarm'&&!t.weapon&&!t.offhand)return false;
  f.angle=Math.atan2(t.x-f.x,t.z-f.z);
  if(kind==='net'){if(!net.call(this,id,t.id))return false;f.nextNet=this.time+8;}
  else if(kind==='throw'){
   // Pay before removing stamina-granting gear changes the capacity.
   f.stamina=Math.max(0,f.stamina-26);
   const sword=['gladius','sica'].includes(w),base=(id===0?20:this.difficulty==='easy'?11:15.5)*(f.body[index?'leftArm':'rightArm']<30?.8:1);
   this.projectiles.push({id:++this.projectileSequence,owner:id,kind:w,itemEntry:f.equipment?.[slot],durability:f.wear[slot],x:f.x,z:f.z,dx:Math.sin(f.angle),dz:Math.cos(f.angle),age:0,launched:false,maxAge:.27+range/12,baseDamage:sword?base:(id===0?30:20),attackBonus:f.attackBonus});
   f[slot]=null;if(f.equipment)delete f.equipment[slot];root.LudusLoadout?.refresh(f);f.action='spearcast';f.timer=0;f.duration=.7;f.attackLeft=!!index;
  }else if(kind==='bash'){f.action='bash';f.timer=0;f.duration=.6;f.specialTarget=t.id;f.specialDone=false;}
  else {f.action='hook';f.timer=0;f.duration=kind==='pull'?4:.45;f.attackLeft=!!index;f.skillMotion={kind,target:t.id,age:0,slot,done:false};}
  f.blocking=false;if(kind!=='throw')f.stamina=Math.max(0,f.stamina-26);f.regenDelay=.9;f.skillReady??=[0,0];f.skillReady[index]=this.time+8;this.emit('special',{id,target:t.id,kind});return true;
 };
 p.throwNet=function(id,target){const f=this.fighters[id];if(!f||f.leftGear!=='net')return false;if(id===0)this.lockedTarget=target;else f.target=target;return this.special(id,1);};
 p.tick=function(dt,input={}){
  dt=Math.max(0,Math.min(.05,dt));if(this.finished)return;
  for(const f of this.fighters){const m=f.skillMotion;if(!m)continue;const t=this.fighters[m.target];
   if(f.hp<=0||f.stunUntil>this.time||f.action!=='hook'||!this.enemy(f,t)||(m.kind==='pull'?f[m.slot]!=='whip':f.leftGear!=='scissor')){f.skillMotion=null;continue;}
   m.age+=dt;
   if(!m.done&&m.age>=.18){m.done=true;const r=m.kind==='pull'?Infinity:2.2;if(m.kind!=='pull'&&(distance(f,t)>r||t.action==='dodge'||this.guard(f,t,false))){f.skillMotion=null;continue;}
    if(m.kind==='disarm')this.dropEquipment(t,t.weapon?'weapon':'offhand');else this.knock(t,.62,'pull');
   }
   if(m.kind==='pull'&&m.done){const d=distance(f,t),step=Math.min(Math.max(0,d-.85),dt*Math.max(6,d*3));if(d){t.x+=(f.x-t.x)/d*step;t.z+=(f.z-t.z)/d*step;this.bound(t);}t.knockedUntil=this.time+.18;if(d<=.91){f.skillMotion=null;f.action='idle';f.timer=0;}}
   if(m.age>=f.duration)f.skillMotion=null;
  }
  tick.call(this,dt,input);
  for(const f of this.fighters)if(f.hp>0){if(f.knockedUntil>this.time){f.action='knocked';f.timer=Math.min(f.duration,Math.max(0,f.duration-(f.knockedUntil-this.time)));}else if(f.knockedUntil){if(f.action==='knocked'){f.action='idle';f.timer=0;}f.knockedUntil=0;}}
 };
};
if(false)module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);
})(root);


/* Character attributes are independent of equipment. Awards and time come from the server. */
(function(root){
 'use strict';
 const attributes=[['attack_technique','Saldırı tekniği'],['defense_technique','Savunma tekniği'],['muscle','Kas gücü'],['speed','Hız'],['reflex','Refleks'],['conditioning','Kondisyon'],['tactics','Taktik']];
 const profiles={murmillo:[51,53,52,47,48,51,48],thraex:[53,48,49,52,52,48,48],hoplomachus:[51,51,49,48,50,49,52],secutor:[50,53,52,48,49,51,47],retiarius:[49,47,48,53,53,49,51],provocator:[49,53,51,47,48,53,49],scissor:[53,48,53,49,51,48,48]};
 const format=n=>Number(n??0).toLocaleString('tr-TR',{maximumFractionDigits:2});
 function profile(type){return Object.fromEntries(attributes.map(([key],i)=>[key,(profiles[type]||Array(7).fill(50))[i]]));}
 function mean(stats){return attributes.reduce((sum,[key])=>sum+Number(stats[key]||0),0)/7;}
 const baseRecovery=10;
 function recoveryRate(){return baseRecovery;}
 function energy(g,now=Date.now()){
  const value=Number(g.fatigue_value??g.fatigue??0),from=Date.parse(g.fatigue_rest_from);
  const hours=Number.isFinite(from)?Math.max(0,now-from)/3600000:0;
  return Math.min(100,Math.max(0,100-value+hours*baseRecovery));
 }
 function combatStats(g){
  const s=g.base_stats||profile(g.class),v=key=>Number(s[key]??50);
  return {health:v('conditioning'),stamina:v('conditioning'),strength:.6*v('muscle')+.25*v('attack_technique')+.15*v('tactics'),defense:.75*v('defense_technique')+.25*v('tactics'),agility:v('reflex'),speed:v('speed')};
 }
 function create(options){
  const panel=options.panel||document.getElementById('orders');let selected=null,stat=attributes[0][0],busy=false,bulk=false,message='',selectedIDs=new Set(),previewCleanup=null,previewCanvas=null,previewFighter=null,previewReady=false,previousFocus=null,rosterPage=0,bulkPage=0,gearSlot=null,gearPage=0,gearMessage='';
  const roster=()=>options.roster(),record=g=>g.record||g,now=()=>options.now?.()||Date.now();
  const combatValues=root.LudusCombatValues?.create({client:options.client,getUser:options.getUser,getSelected:()=>selected,host:panel});
  const phase=g=>options.phase?.(g)||(Date.parse(record(g).injured_until)>now()?'injured':record(g).status==='available'?'available':record(g).status);
  const canDress=g=>phase(g)==='available'&&record(g).status==='available'&&!record(g).clan_roster_id;
  const fits=(item,slot)=>slot==='main_hand'?item.kind==='weapon'&&['gladius','sica','spear','trident','trident_gladiator','mace','whip','heavy_mace','warhammer','halberd'].includes(item.model):slot==='off_hand'?['weapon','shield'].includes(item.kind):item.kind===slot;
  const itemName=item=>item.name||({gladius:'Gladius',sica:'Sica',spear:'Mızrak',trident_gladiator:'Gladyatör tridenti',trident:'Üç dişli mızrak',heavy_mace:'Ağır gürz',halberd:'Halberd',warhammer:'Savaş çekici',mace:'Zincirli gürz',whip:'Kırbaç',net:'Ağ',scissor:'Kol bıçağı',shield_dura:'Dura Europos oval kalkanı',shield_parma:'Ahşap Parma kalkanı',shield_celtic:'Yeşil motifli kalkan',shield_azure:'Mavi demir kuşaklı kalkan',shield_viridis:'Yeşil Roma kule kalkanı',shield_aquila:'Kartal işlemeli kule kalkanı',large:'Büyük kalkan',round:'Yuvarlak kalkan',small:'Küçük kalkan',gold:'Gladyatör miğferi',silver:'Şövalye miğferi',starter:'Başlangıç ekipmanı'})[item.model]||item.model;
  const candidates=()=> (options.inventory?.()||[]).filter(i=>fits(i,gearSlot)&&!i.locked_battle_id&&!i.clan_vault_id&&!i.clan_roster_id&&(!i.equipped_by||i.equipped_by===record(selected).id)&&!(i.equipped_by===record(selected).id&&i.equipped_slot===gearSlot));
  const eligible=g=>{const r=record(g);return phase(g)==='available'&&r.status==='available'&&!r.clan_roster_id&&!r.trained_today&&!r.exercise_completed&&energy(r,now())>0&&Number(r.base_stats?.[stat]??50)<100;};
  function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,fn,disabled=false,cls=''){const n=node('button',cls,text);n.type='button';n.disabled=disabled;n.onclick=fn;return n;}
  function meter(label,value,kind,sub){const wrap=node('div','exercise-meter '+kind),head=node('div','exercise-meter-heading');head.append(node('span','',label),node('strong','',format(value)+'%'));const track=node('div','exercise-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(value));const fill=node('div','exercise-fill');fill.style.width=value+'%';track.append(fill);wrap.append(head,track,node('small','',sub));return wrap;}
  function pageSize(){return Math.max(2,Math.min(6,Math.floor(((panel.clientWidth||innerWidth)-88)/(innerHeight<450?145:210))));}
  function bulkSize(){return Math.max(3,Math.min(10,Math.floor((panel.clientHeight*.69-75)/(innerHeight<450?24:34))));}
  function pager(page,pages,change,label){const nav=node('div','exercise-pagination');const prev=button('‹',()=>change(page-1),page===0),next=button('›',()=>change(page+1),page>=pages-1);prev.setAttribute('aria-label','Önceki '+label);next.setAttribute('aria-label','Sonraki '+label);nav.append(prev,node('span','',(page+1)+' / '+pages),next);return nav;}
  function render(){
   if(!selected||panel.hidden)return;
   const g=selected,r=record(g),p=phase(g),stats=r.stat_version===46?r.base_stats:profile(g.type||r.class),e=energy(r,now()),units=Number(r.exercise_units||0);
   const shell=node('div','exercise-panel');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Gladyatör detay');
   const top=node('div','exercise-top');top.append(node('span','','Colosseum&Magnus'),node('h1','','GLADYATÖR DETAY'),button('Kapat',close));shell.append(top);
   const layout=node('div','exercise-layout'),stage=node('div','exercise-stage'),portrait=node('div','exercise-character'),summary=node('div','exercise-summary'),details=node('div','exercise-details');
   const slots=[['main_hand','Silah'],['off_hand','Kalkan / İkinci el'],['helmet','Miğfer'],['chest','Göğüs zırhı'],['gloves','Kolluk'],['legs','Bacaklık']];
   for(let side=0;side<2;side++){const column=node('div','exercise-equipment');for(const [key,label]of slots.slice(side*3,side*3+3)){const item=(g.items||[]).find(i=>i.equipped_slot===key),tile=button('',()=>{gearSlot=gearSlot===key?null:key;gearPage=0;gearMessage='';bulk=false;render();},busy||!canDress(g)||!options.equip,'exercise-item'+(item?' equipped':'')+(gearSlot===key?' selecting':'')),art=node('div','exercise-item-art');tile.dataset.slot=key;tile.setAttribute('aria-label',label+(item?' · '+itemName(item):' · Eşya tak'));tile.setAttribute('aria-expanded',String(gearSlot===key));tile.title=item?.name||label+' · Boş';art.innerHTML=root.LudusIcons?.svg(item)||'<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M48 30v36M30 48h36" stroke="#bca16d" stroke-width="2"/></svg>';tile.append(node('span','',label),art,node('small','',item?itemName(item)+(Number(item.enhancement)>0?' +'+item.enhancement:''):'Boş'));column.append(tile);}stage.append(column);if(side===0)stage.append(portrait);}
   if(gearSlot){const entries=candidates(),pages=Math.max(1,Math.ceil(entries.length/6));gearPage=Math.min(gearPage,pages-1);const picker=node('div','exercise-picker'+(['main_hand','off_hand','helmet'].includes(gearSlot)?' from-left':' from-right'));picker.setAttribute('aria-label','Takılabilir eşyalar');const pickerHead=node('div','exercise-picker-head');pickerHead.append(node('strong','',slots.find(([key])=>key===gearSlot)[1]),button('×',()=>{gearSlot=null;gearMessage='';render();},busy,'exercise-picker-close'));picker.append(pickerHead,pager(gearPage,pages,p=>{if(!busy){gearPage=p;gearMessage='';render();}},'eşya sayfası'));const items=node('div','exercise-picker-items');for(const item of entries.slice(gearPage*6,gearPage*6+6)){const choice=button('',()=>equip(item),busy,'exercise-picker-item'),icon=node('span','exercise-picker-icon'),name=node('span','exercise-picker-name');icon.innerHTML=root.LudusIcons?.svg(item)||'';name.append(node('span','',itemName(item)),node('small','','+'+Number(item.enhancement||0)));choice.setAttribute('aria-label',itemName(item)+' +'+Number(item.enhancement||0)+' · Tak');choice.dataset.item=item.id;choice.append(icon,name);items.append(choice);}if(!entries.length)items.append(node('p','exercise-picker-empty','Bu yuvaya uygun eşyan yok.'));const status=node('p','exercise-picker-status',gearMessage||(busy?'Takılıyor…':entries.length+' uygun eşya'));status.setAttribute('role','status');picker.append(items,status);stage.append(picker);}
   const figure=node('img','exercise-portrait');figure.src='imperial-portrait-'+(g.type||r.class)+'-v31.webp';figure.alt=g.name||r.name;portrait.append(figure);
   layout.append(summary,stage,details);shell.append(layout);
   const header=node('div','exercise-header');
   const identity=node('div','exercise-identity'),title=node('h2','',g.name||r.name);title.id='ordersTitle';identity.append(title,node('span','exercise-class',options.className?.(g)||g.type||r.class));
   const overall=node('div','exercise-overall');overall.append(node('small','','OVERALL'),node('strong','',format(r.overall??mean(stats))));
   header.append(identity,overall);summary.append(header);
   const state=node('p','exercise-status');state.id='ordersText';state.setAttribute('role','status');
   const labels={available:'Hazır',training:'Antrenmanda',resting:'Dinleniyor',injured:'Sakat · İyileşiyor',mission:'İmparator görevinde',clanlocked:'Klan kadrosunda'};
   state.textContent=message||(labels[p]||'Kullanımda')+(options.time?.(g)?' · '+options.time(g):'');summary.append(state);
   const bars=node('div','exercise-bars');bars.append(meter('Günlük Egzersiz Barı',units/3*100,'daily',r.exercise_completed?'Bugünkü gelişim tamamlandı':'3 maç · 1 antrenman · 1 kolay görev'));
   bars.append(meter('Yorgunluk Barı',e,'energy'+(e<30?' danger':''),(e<30?'%25 sakatlık riski':'Kalan enerji')+' · +'+format(recoveryRate(r,now()))+'/saat'));summary.append(bars);
   const list=node('div','exercise-attributes');list.setAttribute('aria-label','Gladyatör istatistikleri');
   for(const [key,label]of attributes){const b=button('',()=>{stat=key;message='';render();root.LudusQuestEvents?.record(options.client,'training_review',record(selected).id,key).catch(()=>{});},busy,'exercise-attribute'+(stat===key?' selected':''));b.setAttribute('aria-pressed',String(stat===key));if(key==='tactics')b.title='Saldırı ve savunma hesabına katılır. Bot kontrolünde tepki süresini, dayanıklılık yönetimini ve açık bölge seçimini geliştirir.';b.append(node('span','',label),node('strong','',format(stats[key])));list.append(b);}const attributeHead=node('div','exercise-attribute-heading');attributeHead.append(node('h3','exercise-section-title','ÖZELLİKLER'));if(combatValues){const inspect=button('',()=>combatValues.open(),false,'exercise-combat-values');inspect.innerHTML=root.LudusCombatValues.icon;inspect.title='Savaş Değerleri';inspect.setAttribute('aria-label','Savaş Değerleri');inspect.setAttribute('aria-haspopup','dialog');attributeHead.append(inspect);}details.append(attributeHead,list);
   const actions=node('div','exercise-actions');actions.id='orderButtons';
   actions.append(button(busy?'Kaydediliyor…':attributes.find(a=>a[0]===stat)[1]+' çalış',()=>send([record(g).id]),busy||!options.loaded()||!eligible(g),'exercise-primary'));
   actions.append(button(bulk?'Tek gladyatöre dön':'Toplu antrenman',()=>{bulk=!bulk;gearSlot=null;bulkPage=0;selectedIDs=new Set(roster().filter(eligible).slice(0,30).map(g=>record(g).id));message='';render();},busy||!options.loaded()));summary.append(actions);
   if(bulk){const group=node('div','exercise-bulk'),per=bulkSize(),pages=Math.max(1,Math.ceil(roster().length/per));bulkPage=Math.min(bulkPage,pages-1);for(const fighter of roster().slice(bulkPage*per,(bulkPage+1)*per)){const row=node('label','exercise-bulk-row'),checkbox=node('input');checkbox.type='checkbox';checkbox.value=record(fighter).id;checkbox.disabled=busy||!eligible(fighter)||(!selectedIDs.has(checkbox.value)&&selectedIDs.size>=30);checkbox.checked=eligible(fighter)&&selectedIDs.has(checkbox.value);checkbox.onchange=()=>{checkbox.checked?selectedIDs.add(checkbox.value):selectedIDs.delete(checkbox.value);render();};row.append(checkbox,node('span','',fighter.name||record(fighter).name),node('small','',eligible(fighter)?format(record(fighter).overall):'Meşgul'));group.append(row);}const nav=pager(bulkPage,pages,p=>{bulkPage=p;render();},'antrenman gladyatörleri'),submit=button('Seçilenleri çalıştır · '+selectedIDs.size,()=>send([...selectedIDs]),busy||!selectedIDs.size,'exercise-primary');details.replaceChildren(node('h3','exercise-section-title','TOPLU ANTRENMAN'),node('p','exercise-bulk-stat',attributes.find(a=>a[0]===stat)[1]),group,nav,submit);}
   const note=node('p','exercise-note','Yalnızca seçilen özellik gelişir. 1 sa çalışma · 1 sa dinlenme.');summary.append(note);
   const footer=node('div','exercise-footer');footer.append(button('Yenile',async()=>{message='';await options.refresh();render();},busy),button('Ekipman',()=>{location.href='savas.html?v=48';}));summary.append(footer);
   const others=node('div','exercise-others'),strip=node('div','exercise-roster'),per=pageSize(),pages=Math.max(1,Math.ceil(roster().length/per));rosterPage=Math.min(rosterPage,pages-1);const rosterHead=node('div','exercise-roster-heading');rosterHead.append(node('h3','','GLADYATÖRLERİN'),pager(rosterPage,pages,p=>{rosterPage=p;render();},'gladyatörler'));others.append(rosterHead);strip.style.setProperty('--roster-columns',String(per));for(const fighter of roster().slice(rosterPage*per,(rosterPage+1)*per)){const rr=record(fighter),card=button('',()=>open(fighter),busy,'exercise-roster-card'+(fighter===g?' active':'')),img=node('img');img.src='imperial-portrait-'+(fighter.type||rr.class)+'-v31.webp';img.alt='';const info=node('div');const meta=node('div','exercise-roster-meta'),score=node('span','',format(rr.overall??50)+' OVR');score.setAttribute('aria-label','Overall '+format(rr.overall??50));meta.append(node('strong','',fighter.name||rr.name),score);info.append(meta,node('small','',(options.className?.(fighter)||fighter.type||rr.class)+' · '+(labels[phase(fighter)]||'Kullanımda')));const track=node('div','exercise-track'),fill=node('div','exercise-fill');fill.style.width=energy(rr,now())+'%';track.append(fill);info.append(track);card.setAttribute('aria-pressed',String(fighter===g));card.append(img,info);strip.append(card);}others.append(strip);shell.append(others);panel.replaceChildren(shell);combatValues?.sync();
   if(options.preview){if(previewFighter!==g){previewCleanup?.();previewReady=false;previewFighter=g;previewCanvas=node('canvas','exercise-preview');previewCanvas.setAttribute('aria-label',(g.name||r.name)+' · Kuşanılmış ekipman');portrait.append(previewCanvas);previewCleanup=options.preview(g,previewCanvas,()=>{previewReady=true;const photo=panel.querySelector('.exercise-character>.exercise-portrait');if(photo)photo.hidden=true;});}else portrait.append(previewCanvas);figure.hidden=previewReady;}

  }
  async function send(ids){
   if(busy)return;busy=true;message='';render();
   const key='ludus-exercise-v46-'+stat+'-'+[...ids].sort().join(',');let request;
   try{request=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,request);}catch(_){request=crypto.randomUUID();}
   try{const result=await options.client.rpc('ludus_train_exercise',{p_gladiators:ids,p_stat:stat,p_request:request});if(result.error)throw result.error;try{localStorage.removeItem(key);}catch(_){}options.apply(result.data);bulk=false;message=ids.length+' gladyatör antrenmana başladı.';}
   catch(error){if(error.code==='P0001')try{localStorage.removeItem(key);}catch(_){}message='Antrenman başlatılamadı: '+error.message;}
   finally{busy=false;render();}
  }
  async function equip(item){if(busy||!selected||!gearSlot)return;const fighter=selected,slot=gearSlot;busy=true;gearMessage='';render();try{await options.equip(fighter,slot,item);if(selected===fighter){previewCleanup?.();previewCleanup=null;previewFighter=null;previewCanvas=null;previewReady=false;gearSlot=null;message='';}}catch(error){gearMessage=error.message||'Eşya takılamadı.';}finally{busy=false;render();}}
  function open(g,view={}){if(panel.hidden){previousFocus=document.activeElement;options.onOpen?.();}selected=g;options.onInspect?.(g);gearSlot=canDress(g)&&['main_hand','off_hand','helmet','chest','gloves','legs'].includes(view.slot)?view.slot:null;gearMessage='';rosterPage=Math.floor(Math.max(0,roster().indexOf(g))/pageSize());bulk=false;message='';panel.hidden=false;render();if(!options.loaded())options.refresh().then(render);}
  function close(){combatValues?.close(false);gearSlot=null;gearMessage='';previewCleanup?.();previewCleanup=null;previewFighter=null;previewCanvas=null;previewReady=false;panel.hidden=true;selected=null;options.onClose?.();previousFocus?.focus?.();}
  function tick(){
   if(!selected||panel.hidden||busy)return;
   const value=energy(record(selected),now()),wrap=panel.querySelector('.exercise-meter.energy');
   if(!wrap)return;wrap.classList.toggle('danger',value<30);wrap.querySelector('strong').textContent=format(value)+'%';wrap.querySelector('.exercise-fill').style.width=value+'%';wrap.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(value));
   wrap.querySelector('small').textContent=(value<30?'%25 sakatlık riski':'Kalan enerji')+' · +'+format(recoveryRate(record(selected),now()))+'/saat';
  }
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(selected&&!panel.hidden){rosterPage=Math.floor(Math.max(0,roster().indexOf(selected))/pageSize());render();}},80);});
  document.addEventListener('keydown',event=>{if(panel.hidden||combatValues?.isOpen)return;if(event.key==='Escape'){event.preventDefault();if(gearSlot&&!busy){gearSlot=null;gearMessage='';render();}else close();}if(event.key==='Tab'){const buttons=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n=>n.getClientRects().length),first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
  return {open,close,render,tick,get selected(){return selected;}};
 }
 root.LudusExercise={attributes,profiles,profile,mean,energy,recoveryRate,baseRecovery,combatStats,format,create};
 if(false)module.exports=root.LudusExercise;
})(typeof window!=='undefined'?window:globalThis);



// Public browser configuration. Included in the arena build.
// Run supabase-kurulum.sql before enabling profile synchronization.
var ARENA_SUPABASE_CONFIG = Object.freeze({
  url: 'https://lryeeidutnlpgdesjxje.supabase.co',
  publishableKey: 'sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1'
});

// Shared snapshot -> combat equipment/stats. Never accepts currency/rewards from UI.
var LudusLoadout={apply(f,g,items){
 const slots=Object.fromEntries(items.map(i=>[i.equipped_slot,i]));
 f.combatStaminaBonus=Math.min(12,Math.max(0,Number(g.combat_stamina_bonus)||0));
 f.combatMorale=Math.min(100,Math.max(0,Number(g.combat_morale??50)));
 f.tactics=Math.min(100,Math.max(0,Number(g.stat_version===46?(g.base_stats?.tactics??50):(globalThis.LudusExercise?.profile(g.class)?.tactics??50))));
 f.name=g.name;f.weapon=slots.main_hand?.model||null;f.offhand=null;f.leftGear=null;f.shield=slots.off_hand?.kind==='shield';
 if(slots.off_hand?.kind==='weapon'){if(['net','scissor'].includes(slots.off_hand.model))f.leftGear=slots.off_hand.model;else f.offhand=slots.off_hand.model;}
 f.shieldStyle=({large:'murmillo',round:'hoplomachus',small:'thraex'})[slots.off_hand?.model]||(['shield_dura','shield_parma','shield_celtic','shield_azure','shield_viridis','shield_aquila'].includes(slots.off_hand?.model)?slots.off_hand.model:g.class);
 f.helmet=!!slots.helmet;f.helmetModel=slots.helmet?.model;f.helmetColor=['gold','silver'].includes(slots.helmet?.model)?slots.helmet.model:null;f.chest=!!slots.chest;f.chestModel=slots.chest?.model;f.greaves=!!slots.legs;f.shoulders=!!slots.gloves;f.shoulderModel=slots.gloves?.model;f.spareSword=false;
 f.pickupHand=f.leftGear||f.shield?'offhand':'weapon';f.dualMode=!!f.offhand;
 const native=ArenaClasses[g.class||f.type].stats,profile=g.stat_version===7?g.base_stats:native,overall=Number(g.overall??50);
 const stats=g.stat_version===46?LudusExercise.combatStats(g):Object.fromEntries(Object.entries(profile).map(([k,v])=>[k,Number(v)*overall/50]));f.overall=overall;
 for(const i of items){for(const [k,v] of Object.entries(i.base_stats||{}))stats[k]=(Number(stats[k])||0)+(Number(v)||0)*(1+.05*(Number(i.enhancement)||0));for(const stone of [...(i.sapphires||[]),...(i.rubies||[])])if(stone&&typeof stone==='object'&&stone.stat&&Number.isFinite(Number(stone.value))){const k=stone.stat;stats[k]=(Number(stats[k])||0)+(stone.percent?(Number(stats[k])||0)*Number(stone.value)/100:Number(stone.value));}}
 const level=1+.01*Math.max(0,(g.level||1)-1);f.hp=f.maxHp=Math.max(1,Math.round(stats.health*2*level));f.maxStamina=Math.max(1,Math.round(stats.stamina*2*level));f.stamina=f.maxStamina;
 f.attackBonus=level*stats.strength/50;f.defenseBonus=Math.max(.1,stats.defense/50);f.speedBonus=Math.max(.1,stats.speed/50);f.agility=stats.agility;return f;
}};
// Transfer immutable server item tokens with each physical piece of equipment.
LudusLoadout.combatSlot=function(slot,item){return slot==='main_hand'?'weapon':slot==='off_hand'?(item.kind==='shield'?'shield':['net','scissor'].includes(item.model)?'leftGear':'offhand'):({legs:'greaves',gloves:'shoulders'})[slot]||slot;};
LudusLoadout.inventorySlot=slot=>({weapon:'main_hand',shield:'off_hand',offhand:'off_hand',leftGear:'off_hand',greaves:'legs',shoulders:'gloves'})[slot]||slot;
LudusLoadout.initialize=function(combat,ticket){if(ticket.rule_version!==2){combat.allowDrops=false;return;}combat.allowDrops=true;for(const f of combat.fighters){f.equipment={};f.gearBase=f.id===0?ticket.snapshot.gladiator:{name:f.name,class:f.type,level:1,base_stats:{health:100,stamina:100,strength:10,defense:10,agility:10}};for(const entry of ticket.loot.filter(e=>e.actor===f.id))f.equipment[this.combatSlot(entry.slot,entry.item)]=entry;this.refresh(f,true);}};
LudusLoadout.refresh=function(f,initial=false){if(!f.equipment||!f.gearBase)return;const damage=f.maxHp-f.hp,hp=f.hp,stamina=f.stamina,hand=f.pickupHand;const items=Object.entries(f.equipment).map(([slot,entry])=>({...entry.item,equipped_slot:this.inventorySlot(slot)}));this.apply(f,f.gearBase,items);if(!initial){f.hp=hp<=0?0:Math.max(1,f.maxHp-damage);f.stamina=Math.max(0,Math.min(stamina,f.maxStamina));f.pickupHand=hand;}const h=items.find(i=>i.equipped_slot==='helmet');f.helmetModel=h?.model;f.helmetColor=['gold','silver'].includes(h?.model)?h.model:null;};
LudusLoadout.exitSlots=function(f){if(f.hp<=0)return {};return Object.fromEntries(Object.entries({...f.equipment,...(!f.shield&&!f.offhand&&!f.leftGear&&f.brokenShield?{shield:f.brokenShield}:{})}).filter(([slot])=>f[slot]||slot==='shield'&&f.brokenShield).map(([slot,entry])=>[this.inventorySlot(slot),entry.token]));};

// C.docx master v1.0. Deterministic rules only: no client-side rolls or currency writes.
var LudusItemSystem = (() => {
 'use strict';
 const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
 const groups={offense:['weapon','shield'],defense:['helmet','chest'],mobility:['gloves','legs']};
 const naturalRows=[
  ['physical_power','Physical Power','Fiziksel Güç'],
  ['critical_rate','Critical Rate','Kritik Oranı'],
  ['critical_damage','Critical Damage','Kritik Hasarı'],
  ['block_rate','Block Rate','Blok Oranı'],
  ['block_power','Block Power','Blok Gücü'],
  ['armor_penetration','Armor Penetration','Zırh Delme'],
  ['physical_defense','Physical Defense','Fiziksel Savunma'],
  ['damage_reduction','Damage Reduction','Hasar Azaltma'],
  ['critical_resistance','Critical Resistance','Kritik Direnci'],
  ['pierce_resistance','Pierce Resistance','Delici Hasar Direnci'],
  ['slash_resistance','Slash Resistance','Kesici Hasar Direnci'],
  ['projectile_resistance','Projectile Resistance','Fırlatılan Silah Direnci'],
  ['acceleration','Acceleration','Hızlanma'],
  ['movement_speed','Movement Speed','Hareket Hızı'],
  ['dodge_rate','Dodge Rate','Kaçınma Oranı'],
  ['recovery_speed','Recovery Speed','Toparlanma Hızı'],
  ['turn_speed','Turn Speed','Dönüş Hızı'],
  ['dodge_distance','Dodge Distance','Kaçınma Mesafesi']
 ];
 const natural=naturalRows.map(([key,en,label],i)=>({id:i+1,key,en,label,group:['offense','defense','mobility'][Math.floor(i/6)]}));
 const sapphires=natural.map(s=>({id:s.id,family:'sapphire',roman:roman[s.id-1],name:'Safir '+roman[s.id-1],stat:s.key,label:s.label,description:s.label+' başlangıç değerine eklenir. %100 Safir bu statı iki katına çıkarır; yeni deneme mevcut yüzdeyi değiştirir.',asset:'sapphire-'+s.id+'.webp'}));
 const emeraldRows=[
  ['max_hp','Vita','Maksimum HP'],['hp_regeneration','Sanatio','HP Yenilenmesi'],
  ['max_stamina','Stamina','Maksimum Kondisyon'],['stamina_regeneration','Recuperatio','Kondisyon Yenilenmesi'],
  ['physical_power','Fortitudo','Fiziksel Saldırı Gücü'],['critical_rate','Critical','Kritik Vuruş Şansı'],
  ['critical_damage','Ferocia','Kritik Vuruş Hasarı'],['armor_penetration','Penetratio','Zırh Delme'],
  ['minimum_damage','Strike','Minimum Hasarı Maksimuma Yaklaştırma'],['physical_defense','Defensio','Fiziksel Savunma'],
  ['parry_rate','Parry','Silahla Savuşturma Şansı'],['block_rate','Block','Kalkanla Blok Oranı'],
  ['critical_damage_reduction','Aegis','Alınan Kritik Hasarı Azaltma'],['movement_speed','Agilitas','Hareket Hızı'],
  ['attack_speed','Celeritas','Saldırı Hızı']
 ];
 const emeralds=emeraldRows.map(([stat,title,label],i)=>({id:i+1,family:'emerald',roman:roman[i],name:'Zümrüt '+roman[i]+' · '+title,title,stat,label,description:label+' sağlar. Ekipman türü kısıtlaması yoktur; bir itemde en fazla dört farklı Zümrüt bulunur.',asset:'emerald-'+(i+1)+'.webp'}));
 const rubies=[
  {id:1,title:'FELIX',label:'Talih',description:'Elmasla + basarken başarı şansına +2 yüzde puan. Aynı denemede yalnızca bir tane; sonuç ne olursa olsun tüketilir.'},
  {id:2,title:'TENAX',label:'Direnç',description:'+6 ve üzerindeki itemi patladığında yok olmaktan korur. Yalnızca patlama gerçekleştiğinde tüketilir.'},
  {id:3,title:'VESPER',label:'Dönüş',description:'+6 ve üzerindeki item patladığında yok olmak yerine +4 seviyesine döner. Yalnızca patlama gerçekleştiğinde tüketilir.'},
  {id:4,title:'CERTUS',label:'Kesinlik',description:'+10–+15 geliştirme bandındaki tek bir + denemesini %100 başarılı yapar. Aynı itemde yalnızca bir kez kullanılabilir.'}
 ].map(s=>({...s,family:'ruby',roman:roman[s.id-1],name:'Yakut '+roman[s.id-1]+' · '+s.title,asset:'ruby-'+s.id+'.webp'}));
 const diamond={id:1,family:'diamond',name:'Elmas',label:'+ Geliştirme',description:'Itemin + seviyesini artırmak için kullanılır.',asset:null};
 const percentageChances=[[100,.1],[95,.5],[90,1],[85,3],[80,5],[75,8],[70,12],[65,16],[60,20],[50,30],[40,45],[30,60],[20,75],[10,90]].map(([value,weight])=>({value,weight,chance:weight/365.6*100}));
 const baseProfiles={weapon:[7,3,5,3,5,3],shield:[2,1,2,8,12,1],helmet:[4,2,3,4,4,4],chest:[8,4,4,6,6,6],gloves:[4,2,2,4,5,2],legs:[6,4,3,3,3,5]};
 const emeraldPower=[20,.5,20,3,7,3,8,5,10,5,4,4,8,4,4];
 function enhancementScale(level){return 1+.1*Math.max(0,Number(level)||0);}
 function baseStats(kind){return Object.fromEntries(statsFor(kind).map((s,i)=>[s.key,baseProfiles[kind][i]]));}
 function effectiveStats(item){const result={};if(item.stat_version!==10)return result;for(const [key,v] of Object.entries(naturalValues(item)))result[key]=v.effective||0;for(const socket of item.emeralds||[]){const s=stone('emerald',socket.id);if(s)result[s.stat]=(result[s.stat]||0)+emeraldPower[s.id-1]*socket.value/100;}return result;}
 const kinds=Object.values(groups).flat();
 function groupFor(kind){return Object.keys(groups).find(g=>groups[g].includes(kind))||null;}
 function statsFor(kind){const group=groupFor(kind);return natural.filter(s=>s.group===group);}
 function stone(family,id){const rows=({sapphire:sapphires,emerald:emeralds,ruby:rubies,diamond:[diamond]})[family];return rows?.find(s=>s.id===Number(id))||null;}
 function baseChance(level){if(!Number.isInteger(level)||level<0)throw Error('Geçersiz + seviyesi');return level<4?.70:level<6?.60:level<8?.50:level<10?.40:.30;}
 function enhancementChance(item,rubyId=null){
  const level=item.enhancement??0;const base=baseChance(level);
  if(rubyId!==null&&!stone('ruby',rubyId))throw Error('Yakut tanımlı değil');
  if(Number(rubyId)===4){if(level<10||level>=15||item.certus_used)throw Error('CERTUS bu itemde kullanılamaz');return 1;}
  if([2,3].includes(Number(rubyId))&&level<6)throw Error('Koruma Yakutu +6 ve üzerinde kullanılır');
  return Math.min(1,base+(Number(rubyId)===1?.02:0));
 }
 function validPercentage(value){return typeof value==='number'&&percentageChances.some(p=>p.value===value);}
 function validateItem(item){
  if(!kinds.includes(item.kind))throw Error('Geçersiz ekipman türü');
  if(item.stat_version!==10)throw Error('Item yeni stat sistemine henüz geçirilmedi');
  if(!Number.isInteger(item.enhancement)||item.enhancement<0)throw Error('Geçersiz + seviyesi');
  const allowed=statsFor(item.kind).map(s=>s.key);
  for(const [key,value] of Object.entries(item.natural_stats||{}))if(!allowed.includes(key)||typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Doğal stat bu item grubuna uygun değil');
  for(const [key,value] of Object.entries(item.natural_percentages||{}))if(!allowed.includes(key)||(value!==0&&!validPercentage(value)))throw Error('Safir yüzdesi geçersiz');
  const sockets=item.emeralds||[];
  if(!Array.isArray(sockets)||sockets.length>4)throw Error('En fazla dört Zümrüt basılabilir');
  const ids=new Set();for(const socket of sockets){if(!stone('emerald',socket.id)||ids.has(Number(socket.id))||!validPercentage(socket.value))throw Error('Zümrütler farklı ve geçerli olmalı');ids.add(Number(socket.id));}
  return true;
 }
 function canSocket(item,id){return kinds.includes(item.kind)&&!!stone('emerald',id)&&Array.isArray(item.emeralds||[])&&(item.emeralds||[]).length<4&&!(item.emeralds||[]).some(s=>Number(s.id)===Number(id));}
 function naturalValues(item){
  validateItem(item);
  return Object.fromEntries(statsFor(item.kind).map(s=>{
   const written=item.natural_stats?.[s.key],percent=item.natural_percentages?.[s.key]??0;
   return [s.key,{base:written??null,written:written!==undefined?written*enhancementScale(item.enhancement):null,percent,effective:written!==undefined?written*enhancementScale(item.enhancement)*(1+percent/100):null}];
  }));
 }
 function pouchSlots(family,counts={}){
  const catalog=({diamond:[diamond],sapphire:sapphires,emerald:emeralds,ruby:rubies})[family];
  if(!catalog)throw Error('Taş kategorisi bulunamadı');
  return Array.from({length:20},(_,i)=>catalog[i]?{stone:catalog[i],count:Math.max(0,Number.isSafeInteger(counts[catalog[i].id])?counts[catalog[i].id]:0)}:null);
 }
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 return freeze({version:10,source:'C.docx master v1.0',groups,natural,sapphires,emeralds,rubies,diamond,percentageChances,baseProfiles,emeraldPower,enhancementScale,baseStats,effectiveStats,groupFor,statsFor,stone,baseChance,enhancementChance,validateItem,canSocket,naturalValues,pouchSlots,
  destructionChanceOnFailure:.13,unresolved:[],transactionsEnabled:true});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=LudusItemSystem;

// Item-only effects, installed after the combat and loadout modules.
(()=>{
 const P=ArenaCombat.prototype,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const oldApply=LudusLoadout.apply;
 LudusLoadout.apply=function(f,g,items){
  oldApply.call(this,f,g,items.filter(i=>i.stat_version!==10));
  // Keep the visual equipment slots from all items; exclude new items from old stat math.
  const hp=f.hp,stamina=f.stamina,base={attack:f.attackBonus,defense:f.defenseBonus,speed:f.speedBonus,maxHp:f.maxHp,maxStamina:f.maxStamina,agility:f.agility};
  oldApply.call(this,f,g,items.map(i=>i.stat_version===10?{...i,base_stats:{},sapphires:[],rubies:[]}:i));
  Object.assign(f,{attackBonus:base.attack,defenseBonus:base.defense,speedBonus:base.speed,agility:base.agility});
  const s={};for(const i of items)for(const [key,v] of Object.entries(LudusItemSystem.effectiveStats(i)))s[key]=(s[key]||0)+v;
  f.itemStats=s;f.nativeAttackBonus=base.attack;f.itemPowerSlots=Object.fromEntries(items.filter(i=>i.stat_version===10).map(i=>[i.equipped_slot,i]));f.attackBonus+=Math.min(50,s.physical_power||0)/50;f.defenseBonus+=Math.min(50,s.physical_defense||0)/50;
  f.speedBonus*=1+clamp((s.movement_speed||0)/100,0,.3);
  f.maxHp=Math.round(base.maxHp+clamp(s.max_hp||0,0,120));f.hp=f.maxHp;
  f.maxStamina=Math.round(base.maxStamina+clamp(s.max_stamina||0,0,100));f.stamina=f.maxStamina;return f;
 };
 const damage=P.damage;
 P.damage=function(a,v,base,region,heavy,point){
  if(!this.enemy(a,v))return false;const s=a.itemStats||{},t=v.itemStats||{};
  const held=a.itemProjectile?a.projectileItemV10:a.itemPowerSlots?.[a.action==='bash'?'off_hand':a.attackLeft?'off_hand':'main_hand'];
  if(held?.stat_version===10){const power=LudusItemSystem.naturalValues(held).physical_power?.effective||0,reference=LudusItemSystem.baseStats(held.kind).physical_power||7;
   // Only natural weapon power (+ level and sapphire) forms the weapon multiplier.
   // Fortitudo from every slot stays in the same additive equipment-power pool.
   const otherPower=clamp((s.physical_power||0)-power,0,50),attack=(a.nativeAttackBonus??1)+otherPower/50;
   base*=attack/Math.max(.000001,a.attackBonus??1)*Math.max(.01,power/reference);
  }
  if(v.action==='idle'&&this.random()<clamp((t.dodge_rate||0)/100,0,.2)){v.passiveEvade=.36;this.emit('evade',{id:v.id,source:a.id,passive:true});if(v.id===0)this.stats.dodges++;return true;}
  const critical=this.random()<clamp(((s.critical_rate||0)-(t.critical_resistance||0))/100,0,.35);
  const piercing=['spear','trident','trident_gladiator','scissor','halberd'].includes(a.attackWeapon||a.weapon),projectile=['spearcast','swordcast','throw'].includes(a.action)||a.itemProjectile;
  let resistance=(t.damage_reduction||0)+(projectile?t.projectile_resistance||0:piercing?t.pierce_resistance||0:t.slash_resistance||0);
  base*=1-clamp(resistance/100,0,.55);
  // Penetration removes item defense, never the gladiator's class defense.
  const defense=v.defenseBonus||1,itemDefense=clamp(t.physical_defense||0,0,50)/50;
  base*=defense/Math.max(.1,defense-itemDefense*clamp((s.armor_penetration||0)/100,0,.6));
  base*=clamp(.8+this.random()*.2+(s.minimum_damage||0)/100,.8,1);
  if(critical){base*=1+clamp(.5+((s.critical_damage||0)-(t.critical_damage_reduction||0))/100,.1,1.2);this.emit('critical',{id:v.id,source:a.id});}
  const hit=damage.call(this,a,v,base,region,heavy,point);
  if(hit&&v.hp>0&&['hurt','knocked'].includes(v.action))v.duration/=1+clamp((v.itemStats?.recovery_speed||0)/100,0,.3);
  return hit;
 };
 const recovery=f=>1+clamp((f.itemStats?.recovery_speed||0)/100,0,.3);
 const knock=P.knock;
 P.knock=function(f,seconds,kind){return knock.call(this,f,kind==='pull'?seconds:seconds/recovery(f));};
 const deflect=P.deflectAttack;
 P.deflectAttack=function(a,v,perfect){const active=a.action==='attack',result=deflect.call(this,a,v,perfect);if(active&&['recoil','stagger'].includes(a.action))a.duration/=recovery(a);return result;};
 const guard=P.guard;
 P.guard=function(a,v,heavy,point){
  const s=v.itemStats||{};const facing=Math.abs(Math.atan2(Math.sin(Math.atan2(a.x-v.x,a.z-v.z)-v.angle),Math.cos(Math.atan2(a.x-v.x,a.z-v.z)-v.angle)))<1.1;
  const shieldGuard=()=>{const before=v.stamina,hadShield=v.shield,blocked=guard.call(this,a,v,heavy,point);if(blocked&&hadShield){const spent=Math.max(0,before-v.stamina);v.stamina=Math.min(v.maxStamina??100,v.stamina+spent*clamp((s.block_power||0)/100,0,.4));}return blocked;};
  if(!v.blocking&&v.action==='idle'&&facing){
   if((v.weapon||v.offhand||v.leftGear==='scissor')&&v.stamina>=6&&this.random()<clamp((s.parry_rate||0)/100,0,.2)){this.deflectAttack(a,v,false);this.emit('parry',{id:v.id,source:a.id,point,perfect:false});v.stamina=Math.max(0,v.stamina-6);return true;}
   if(v.shield&&this.random()<clamp((s.block_rate||0)/100,0,.3)){v.blocking=true;v._automaticGuard=true;try{return shieldGuard();}finally{v.blocking=false;v._automaticGuard=false;}}
  }
  return shieldGuard();
 };
 // V114: agility and Celeritas are combined once by ArenaMotion.pace.
 const tick=P.tick;
 P.tick=function(dt,input){
  const before=this.fighters.map(f=>({x:f.x,z:f.z,angle:f.angle,action:f.action,delay:f.regenDelay}));tick.call(this,dt,input);
  if(this.finished)return;
  for(const f of this.fighters){if(f.hp<=0)continue;const s=f.itemStats||{},b=before[f.id];
   if(f.action==='idle'&&f.regenDelay===0){f.hp=Math.min(f.maxHp,f.hp+dt*clamp(s.hp_regeneration||0,0,2));f.stamina=Math.min(f.maxStamina||100,f.stamina+dt*clamp(s.stamina_regeneration||0,0,8)*.65*(1+Math.min(12,Math.max(0,Number(f.combatStaminaBonus)||0))/100)*(1+(Math.min(100,Math.max(0,Number(f.combatMorale??50)))-50)/1000));}
   if(b.action==='dodge'&&f.action==='dodge'){const k=clamp((s.dodge_distance||0)/100,0,.25);f.x+=(f.x-b.x)*k;f.z+=(f.z-b.z)*k;}
   if(f.action==='idle'&&b.action==='idle'){const moving=Math.hypot(f.x-b.x,f.z-b.z)>.001;f.itemAcceleration=moving?Math.min(1,(f.itemAcceleration||0)+dt*(3+clamp(s.acceleration||0,0,30)/5)):0;
    if(moving){const k=.85+.15*f.itemAcceleration;f.x=b.x+(f.x-b.x)*k;f.z=b.z+(f.z-b.z)*k;}
    const turn=Math.atan2(Math.sin(f.angle-b.angle),Math.cos(f.angle-b.angle));f.angle=b.angle+turn*(1+clamp((s.turn_speed||0)/100,0,.3));
   }
   if(f.action==='recover')f.timer+=dt*clamp((s.recovery_speed||0)/100,0,.3);
   this.bound(f);
  }
 };
 P.damageProjectileV10=function(a,v,projectile,...args){
  const s=a.itemStats,weapon=a.attackWeapon,wasProjectile=a.itemProjectile,oldItem=a.projectileItemV10,item=projectile.itemEntry?.item;
  try{
   a.itemProjectile=true;a.projectileItemV10=item;a.itemStats={...s};
   // The thrown piece has already left the loadout. Add it once to the remaining gear.
   const stillEquipped=item&&Object.values(a.itemPowerSlots||{}).some(i=>i===item||(i.id&&i.id===item.id));
   if(item&&!stillEquipped)for(const [key,value]of Object.entries(LudusItemSystem.effectiveStats(item)))a.itemStats[key]=(a.itemStats[key]||0)+value;
   a.attackWeapon=projectile.kind;return this.damage(a,v,...args);
  }finally{a.itemProjectile=wasProjectile;a.projectileItemV10=oldItem;a.itemStats=s;a.attackWeapon=weapon;}
 };
})();


Object.assign(root,{LudusLoadout,LudusItemSystem,LudusExercise});

})(globalThis);
