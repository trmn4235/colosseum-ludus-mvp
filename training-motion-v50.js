/* Existing arena strike and pose runtime, extracted for the isolated training experiment. */
var ArenaMotion=(function(){
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const regions={head:{name:'BAŞ',y:1.9,r:.25},chest:{name:'GÖVDE',y:1.38,r:.36},leftArm:{name:'SOL KOL',y:1.35,r:.24},rightArm:{name:'SAĞ KOL',y:1.35,r:.24},rightLeg:{name:'SAĞ BACAK',y:.65,r:.23},leftLeg:{name:'SOL BACAK',y:.65,r:.23},legs:{name:'BACAK',y:.65,r:.33}};
 const smooth=t=>{t=clamp(t);return t*t*(3-2*t);},mix=(a,b,t)=>a+(b-a)*t;
 function profile(kind,heavy=false,bot=false){const pole=kind==='spear'||kind==='trident',timings={gladius:[.26,.22,.32],sica:[.22,.2,.28],spear:[.3,.22,.34],trident:[.34,.23,.37],mace:[.4,.26,.43],whip:[.32,.24,.36]},v=timings[kind]||[.24,.2,.28],wind=v[0]*(heavy?1.35:bot?1.15:1),active=v[1],recover=v[2]*(heavy?1.2:1);return {wind,active,recover,duration:wind+active+recover,pole,length:pole?1.7:kind==='mace'?1.02:kind==='whip'?1.65:kind?.78:.18};}
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
  if(p.pole){const reach=ready?mix(.3,.1,smooth(wind)):returning?mix(.65,.3,smooth(recovery)):mix(.1,.65,smooth(phase));grip={x:side*.2,y:mix(1.38,height,weight),z:reach};const y=(region.y-grip.y)/p.length;dir={x:side*.025,y,z:Math.sqrt(Math.max(.01,1-y*y-.025*.025))};}
  else{const a=cut*swing;grip={x:side*.21+Math.sin(a)*.1,y:mix(1.32,height,weight),z:.23+Math.cos(a)*.18};dir={x:Math.sin(a),y:mix(.12,(region.y-height)/p.length,weight),z:Math.cos(a)};const len=Math.hypot(dir.x,dir.y,dir.z);for(const k of ['x','y','z'])dir[k]/=len;}
  if(!p.pole&&['gladius','sica'].includes(kind)&&f.chain===3){
    const a=ready?mix(.15,-1.03,smooth(wind)):returning?mix(.82,.15,smooth(recovery)):mix(-1.03,.82,smooth(phase));
    grip={x:side*.20,y:mix(1.32,height+.06,weight),z:.28+Math.cos(a)*.12};dir={x:side*.04,y:-Math.sin(a),z:Math.cos(a)};const len=Math.hypot(dir.x,dir.y,dir.z);for(const k of ['x','y','z'])dir[k]/=len;
   }

  // V24: the shoulder carries the hand through a broad cut; the wrist follows it.
  if(!p.pole&&['gladius','sica'].includes(kind)){
    const reverse=f.chain===2,overhead=f.chain===3||f.attackKind==='heavy',hand=f.attackLeft?-1:1;
    const resting={x:-.24,y:1.32,z:.29,yaw:-.25,pitch:.12};
    const chamber=overhead?{x:-.22,y:1.99,z:.02,yaw:-.10,pitch:1.35}:reverse?{x:.30,y:1.61,z:.07,yaw:.98,pitch:.32}:{x:-.57,y:1.68,z:-.09,yaw:-1.12,pitch:.55};
    const contactPose={x:-.12,y:height+(overhead?.05:0),z:.51,yaw:0,pitch:Math.asin(clamp((region.y-height)/p.length,-.8,.8))};
    const finish=overhead?{x:-.17,y:1.09,z:.47,yaw:.08,pitch:-.70}:reverse?{x:-.52,y:1.31,z:.09,yaw:-1.12,pitch:-.25}:{x:.30,y:1.22,z:.13,yaw:1.12,pitch:-.42};
    const lerpPose=(a,b,u)=>Object.fromEntries(Object.keys(a).map(k=>[k,mix(a[k],b[k],u)]));
    const cutEase=u=>u*u*(2-u);let pose;
    if(ready)pose=lerpPose(resting,chamber,smooth(wind));
    else if(returning)pose=lerpPose(finish,resting,smooth(recovery));
    else pose=phase<.48?lerpPose(chamber,contactPose,cutEase(phase/.48)):lerpPose(contactPose,finish,1-cutEase(1-(phase-.48)/.52));
    grip={x:pose.x*hand,y:pose.y,z:pose.z};
    dir={x:Math.sin(pose.yaw)*Math.cos(pose.pitch)*hand,y:Math.sin(pose.pitch),z:Math.cos(pose.yaw)*Math.cos(pose.pitch)};
  }
   const local=flexible(kind,phase,weight),points=(local.length?local:[{x:0,y:0,z:0},{x:0,y:p.length,z:0}]).map(v=>{const r=orient(v,dir);return{x:grip.x+r.x,y:grip.y+r.y,z:grip.z+r.z};});
  return {grip,tip:points[points.length-1],points,local,dir,phase,wind,recovery,weight,cut:cut*swing,active:!ready&&!returning};
 }
 function body(f){const poses={},attack=f.action==='attack';let drop=0,lean=0,shift=0;
  if(attack){
   const s=sample(f),p=f.attackProfile||profile(f.attackWeapon||f.weapon),side=f.attackLeft?-1:1,reverse=f.chain===2,overhead=f.chain===3||f.attackKind==='heavy';
   const returning=s.recovery>0,w=returning?1-smooth(s.recovery):smooth(s.wind),sweep=smooth(s.phase),direction=side*(reverse?-1:1);
   const turn=(p.pole?mix(-.24,.30,sweep):overhead?mix(-.18,.22,sweep):mix(-.64,.66,sweep))*direction*w;
   poses.Hips=[0,turn*.48,-direction*.025*w];poses.Spine=[.035*w,turn*.30,0];poses.Spine1=[.045*w,turn*.20,0];poses.Spine2=[(overhead?mix(-.13,.19,sweep):.075)*w,turn*.33,-direction*.07*w];poses.Head=[-.035*w,-turn*.50,0];
   poses.LeftUpLeg=[-.13*w,0,0];poses.RightUpLeg=[.09*w,0,0];poses.LeftLeg=[.23*w,0,0];poses.RightLeg=[.17*w,0,0];
   // Keep the free hand near the ribs and the shield protecting the shoulder.
   const free=f.attackLeft?'Right':'Left';poses[free+'Arm']=[-.48*w,0,(free==='Left'?-.22:.22)*w];poses[free+'ForeArm']=[-.75*w,0,0];
   lean=(p.pole?.12:.075)*sweep*w;drop=-.065*w;shift=mix(-.045,.10,sweep)*w;
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
  }else if(['netcast','spearcast','bash','hook'].includes(f.action)){
   const t=clamp(f.timer/f.duration),wind=smooth(t/.34),release=smooth((t-.34)/.23),recover=smooth((t-.57)/.43),w=1-recover,side=f.attackLeft?'Left':'Right';
   poses.Hips=[0,(-.18*wind+.3*release)*w,0];poses.Spine2=[(.03*wind+.16*release)*w,(-.22*wind+.32*release)*w,0];poses.Head=[-.05*w,0,0];poses.LeftUpLeg=[-.18*w,0,0];poses.RightLeg=[.2*w,0,0];drop=-.025*w;
   const arm=f.action==='bash'||f.action==='netcast'?'Left':side;poses[arm+'Arm']=[(-.5*wind-1.05*release)*w,0,(arm==='Left'?-.18:.18)*w];poses[arm+'ForeArm']=[(-.75*wind+.62*release)*w,0,0];lean=.07*release*w;
  }
  return {poses,drop,lean,shift};
 }
 function world(f,v){const c=Math.cos(f.angle),s=Math.sin(f.angle);return{x:f.x+v.x*c+v.z*s,y:v.y,z:f.z-v.x*s+v.z*c};}
 function target(f,region){const r=regions[region]||regions.chest,side=region==='leftArm'?-.3:region==='rightArm'?.3:region==='leftLeg'?-.17:region==='rightLeg'?.17:0;return {...world(f,{x:side,y:r.y,z:0}),r:r.r};}
 function guardPoint(f){const region=f.guardRegion;return {x:region==='rightArm'?.3:region==='leftArm'?-.3:region==='rightLeg'?.17:region==='leftLeg'?-.17:.26,y:regions[region]?.y||1.42,z:.29};}
 function segmentDistance(a,b,p){const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,d=x*x+y*y+z*z,t=d?clamp(((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/d):0;return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t,p.z-a.z-z*t);}
 function contact(f,v,from,to){const p=target(v,f.attackRegion),a=sample(f,from),b=sample(f,to);if(f.attackWeapon==='mace')return segmentDistance(world(f,a.tip),world(f,b.tip),p)<p.r+.14;
  for(let i=1;i<b.points.length;i++){if(Math.min(segmentDistance(world(f,a.points[i-1]),world(f,a.points[i]),p),segmentDistance(world(f,b.points[i-1]),world(f,b.points[i]),p),segmentDistance(world(f,a.points[i]),world(f,b.points[i]),p))<p.r+.07)return true;}return false;}
 // Test the same shield face used by the hand IK, before the body is reached.
  function shieldContact(f,v,from,to){
   if(!v.blocking||!v.shield||v.shieldHeldBy!==null)return null;
   const c=Math.cos(v.angle),s=Math.sin(v.angle),halfWidth=['thraex','hoplomachus'].includes(v.shieldStyle)?.34:.40;
   const halfHeight=['thraex','hoplomachus'].includes(v.shieldStyle)?.39:.56;
   const guard=guardPoint(v);
   const local=p=>({x:(p.x-v.x)*c-(p.z-v.z)*s-guard.x,y:p.y-guard.y,z:(p.x-v.x)*s+(p.z-v.z)*c-guard.z});
   function cross(a,b){const aa=local(a),bb=local(b),dz=bb.z-aa.z;if(Math.abs(dz)<1e-7)return null;const u=-aa.z/dz;if(u<0||u>1)return null;
    const x=mix(aa.x,bb.x,u),y=mix(aa.y,bb.y,u);return Math.abs(x)<=halfWidth+.08&&Math.abs(y)<=halfHeight+.08?{x:mix(a.x,b.x,u),y:mix(a.y,b.y,u),z:mix(a.z,b.z,u)}:null;}
   const a=sample(f,from),b=sample(f,to);
   for(let i=1;i<b.points.length;i++){const aa=world(f,a.points[i-1]),ab=world(f,a.points[i]),ba=world(f,b.points[i-1]),bb=world(f,b.points[i]);const p=cross(aa,ab)||cross(ba,bb)||cross(aa,ba)||cross(ab,bb);if(p)return p;}
   return null;
  }
  return {regions,profile,sample,world,target,contact,shieldContact,guardPoint,segmentDistance,flexible,body,smooth};
})();
