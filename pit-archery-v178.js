/* Courtyard-only archery. Preview and arrows share the same swept collision query. */
var PitArchery=(()=>{
 'use strict';const RANGE=20,SPEED=18,DRAW=.35,RECOVER=.30,COST=13;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function origin(f){const s=Math.sin(f.angle),c=Math.cos(f.angle);return{x:f.x+.28*c+.5*s,y:1.35,z:f.z-.28*s+.5*c};}
 function direction(f){return{x:Math.sin(f.angle),y:0,z:Math.cos(f.angle)};}
 function trace(combat,owner,start,dir,length,bounds){
  let distance=length,hit=null,region=null,wall=false;
  if(Math.abs(start.x)>bounds.x||Math.abs(start.z)>bounds.z)return{distance:0,hit:null,region:null,wall:true,enemy:false,point:{x:start.x,y:start.y,z:start.z}};
  for(const axis of ['x','z'])if(Math.abs(dir[axis])>1e-8){const t=((dir[axis]>0?bounds[axis]:-bounds[axis])-start[axis])/dir[axis];if(t>=0&&t<distance){distance=t;wall=true;}}
  for(const f of combat.fighters){if(f.id===owner||f.hp<=0||f.pitWaiting)continue;
   for(const part of ['head','chest','legs']){const p=ArenaMotion.target(f,part),x=start.x-p.x,y=start.y-p.y,z=start.z-p.z,b=x*dir.x+y*dir.y+z*dir.z,r=p.r+.025,d=b*b-(x*x+y*y+z*z-r*r);if(d<0)continue;const t=-b-Math.sqrt(d),far=-b+Math.sqrt(d);if(far<0)continue;const near=Math.max(0,t);if(near<distance){distance=near;hit=f;region=part;wall=false;}}
  }
  const shooter=combat.fighters[owner];return{distance,hit,region,wall,enemy:!!hit&&hit.team!==shooter.team,point:{x:start.x+dir.x*distance,y:start.y+dir.y*distance,z:start.z+dir.z*distance}};
 }
 function aim(combat,f,bounds){const start=origin(f),dir=direction(f);return{start,dir,...trace(combat,f.id,start,dir,RANGE,bounds)};}
 function install(combat,bounds){
  if(combat.pitArchery)return;combat.pitArchery={arrows:[],serial:0,bounds};
  const attack=combat.attack.bind(combat),bot=combat.botStep.bind(combat),tick=combat.tick.bind(combat),special=combat.special.bind(combat),canBlock=combat.canBlock.bind(combat);
  combat.attack=(id,...args)=>{const f=combat.fighters[id];if(!f?.pitBow)return attack(id,...args);
   if(combat.finished||f.hp<=0||f.pitWaiting||f.action!=='idle'||f.cooldown>0||f.stunUntil>combat.time||f.stamina<COST)return false;
   f.stamina-=COST;f.regenDelay=.9;f.action='bowshot';f.timer=0;f.duration=DRAW+RECOVER;f.blocking=false;f.bowDrawUntil=combat.time+DRAW;f.bowReleaseUntil=0;f.pitArrowPending=true;f.lastAttack=combat.time;return true;
  };
  combat.special=(id=0,...args)=>combat.fighters[id]?.pitBow?false:special(id,...args);
  combat.canBlock=f=>f.pitBow?false:canBlock(f);
  combat.botStep=(f,dt)=>{if(!f.pitBow)return bot(f,dt);const t=combat.nearest(f,RANGE);if(!t)return;f.target=t.id;const dx=t.x-f.x,dz=t.z-f.z,d=Math.hypot(dx,dz);f.angle=Math.atan2(dx,dz);
   // Offset the heading so the actual left-hand arrow line, not the body centre, aims at the opponent.
   f.angle-=Math.asin(clamp(.28/Math.max(.3,d),-1,1));
   if(d<4||d>15){const sign=d<4?-1:1,speed=2.1*(f.speedBonus||1);f.x+=dx/Math.max(.01,d)*speed*dt*sign;f.z+=dz/Math.max(.01,d)*speed*dt*sign;f.move=.5;}
   if(d<18&&aim(combat,f,bounds).enemy)combat.attack(f.id);
  };
  combat.tick=(dt,input={})=>{if(combat.finished)return;dt=clamp(dt,0,.05);tick(dt,input);const state=combat.pitArchery;
   for(const f of combat.fighters){if(!f.pitArrowPending)continue;if(f.hp<=0||f.action!=='bowshot'){f.pitArrowPending=false;f.bowDrawUntil=0;continue;}
    if(f.timer>=DRAW){const start=origin(f),dir=direction(f);state.arrows.push({id:++state.serial,owner:f.id,...start,dir,remaining:RANGE});f.pitArrowPending=false;f.bowReleaseUntil=combat.time+RECOVER;combat.emit('pitarrow',{id:f.id});}
   }
   for(const arrow of state.arrows){const step=Math.min(arrow.remaining,SPEED*dt),q=trace(combat,arrow.owner,arrow,arrow.dir,step,bounds);Object.assign(arrow,q.point);arrow.remaining-=step;
    if(q.hit||q.wall){arrow.remaining=0;if(q.enemy){const shooter=combat.fighters[arrow.owner],victim=q.hit;if(victim.action!=='dodge'&&!combat.guard(shooter,victim,false,q.point)){const prior=shooter.itemProjectile;shooter.itemProjectile=true;combat.damage(shooter,victim,22,q.region,false,q.point);shooter.itemProjectile=prior;}}}
   }
   state.arrows=state.arrows.filter(a=>a.remaining>0);
  };
 }
 function bowModel(T){const g=new T.Group(),points=[];for(let i=0;i<=28;i++){const y=-.63+i/28*1.26;points.push(new T.Vector3(0,y,-.16*Math.pow(y/.63,2)+.04*Math.sin(y/.63*Math.PI)));}
  const wood=new T.MeshStandardMaterial({color:0x865837,roughness:.86}),limbs=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.022,7,false),wood);limbs.castShadow=true;g.add(limbs);
  const grip=new T.Mesh(new T.CylinderGeometry(.029,.029,.20,10),new T.MeshStandardMaterial({color:0x3e3025,roughness:1}));g.add(grip);
  const string=new T.Line(new T.BufferGeometry().setFromPoints([points[0],new T.Vector3(),points.at(-1)]),new T.LineBasicMaterial({color:0xd9caa8}));g.add(string);g.userData.string=string;return g;
 }
 function pose(f,m,time,reach){if(!f.pitBow)return;const T=THREE;
  if(!m.pitBowModel){m.pitBowModel=bowModel(T);m.offhandAnchor.add(m.pitBowModel);}m.pitBowModel.visible=true;m.offhandAnchor.visible=true;
  if(f.hp<=0||['knocked','stunned','dodge','evade','hurt'].includes(f.action))return;
  const draw=f.action==='bowshot'?clamp(f.timer/DRAW,0,1)*(f.timer<DRAW?1:Math.max(0,1-(f.timer-DRAW)/.12)):0;
  const math=m.pitBowMath||(m.pitBowMath={q:new T.Quaternion(),root:new T.Quaternion(),axis:new T.Vector3(1,0,0)}),target={x:.28,y:1.35,z:.5},point=ArenaAnatomy.grip(m,true,{grip:target,dir:{x:0,y:1,z:0}},reach,0),anchor=m.offhandAnchor;
  anchor.position.copy(anchor.parent.worldToLocal(point));anchor.quaternion.copy(anchor.parent.getWorldQuaternion(math.q).invert().multiply(m.root.getWorldQuaternion(math.root)));
  reach(m,false,{x:.12,y:1.36,z:.47-.36*draw});
  const attr=m.pitBowModel.userData.string.geometry.attributes.position;attr.setXYZ(1,0,0,-.36*draw);attr.needsUpdate=true;
  for(const i of [1,2,3]){const bone=m.bones['LeftHandIndex'+i],rest=m.rest.get('LeftHandIndex'+i);if(bone&&rest)bone.quaternion.copy(rest.q).multiply(math.q.setFromAxisAngle(math.axis,.85));}
  m.root.updateMatrixWorld(true);
 }
 function view(scene){const T=THREE,line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0xe3c24d,transparent:true,opacity:.38,depthWrite:false}));line.name='Yay saydam nişan çizgisi';line.frustumCulled=false;line.visible=false;scene.add(line);const arrows=new Map(),shaft=new T.CylinderGeometry(.008,.008,.72,5),tip=new T.ConeGeometry(.027,.10,4),wood=new T.MeshStandardMaterial({color:0xb59461,roughness:.8}),iron=new T.MeshStandardMaterial({color:0x686e70,metalness:.6,roughness:.5});shaft.rotateX(Math.PI/2);tip.rotateX(Math.PI/2);tip.translate(0,0,.38);
  return{line,update(combat,visible=true){const state=combat.pitArchery,f=combat.fighters[0];line.visible=!!state&&!!f?.pitBow&&f.hp>0&&!combat.finished&&visible&&!['dodge','evade','knocked','stunned','hurt'].includes(f.action);
   if(line.visible){const q=aim(combat,f,state.bounds),p=line.geometry.attributes.position;p.setXYZ(0,q.start.x,q.start.y,q.start.z);p.setXYZ(1,q.point.x,q.point.y,q.point.z);p.needsUpdate=true;line.material.color.setHex(q.enemy?0x62d891:0xe3c24d);line.userData.hit=q.enemy;line.userData.target=q.hit?.id??null;}
   const alive=new Set((state?.arrows||[]).map(a=>a.id));for(const [id,o]of arrows)if(!alive.has(id)){o.removeFromParent();arrows.delete(id);}for(const a of state?.arrows||[]){let o=arrows.get(a.id);if(!o){o=new T.Group();o.add(new T.Mesh(shaft,wood),new T.Mesh(tip,iron));scene.add(o);arrows.set(a.id,o);}o.position.set(a.x,a.y,a.z);o.rotation.y=Math.atan2(a.dir.x,a.dir.z);}
  }};
 }
 return{install,aim,trace,origin,direction,pose,view,constants:{RANGE,SPEED,DRAW,RECOVER,COST}};
})();
if(typeof module!=='undefined')module.exports=PitArchery;
