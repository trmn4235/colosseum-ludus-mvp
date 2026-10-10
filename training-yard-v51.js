/* Courtyard training uses the original V50 rig and motion. No award or account writes. */
(function(root){
 'use strict';
 const definitions={
  attack_technique:{name:'Saldırı tekniği',mode:'pair',description:'Tahta rudislerle eşli çalışma'},
  defense_technique:{name:'Savunma tekniği',mode:'pair',description:'Tahta rudislerle eşli çalışma'},
  tactics:{name:'Taktik',mode:'pair',description:'Tahta rudislerle eşli çalışma'},
  conditioning:{name:'Kondisyon',mode:'carry',description:'Ahşap kirişi omuzlarında taşıyarak yürüyüş'},
  muscle:{name:'Kas gücü',mode:'squat',description:'Omuzdaki ahşap kirişle çömelip kalkma'},
  speed:{name:'Hız',mode:'post',description:'Ahşap vuruş direğine seri rudis saldırıları'},
  reflex:{name:'Refleks',mode:'reflex',description:'Sallanan torbadan kaçınma · Görsel taslak',preview:true}
 };
 const pairProfile={wind:.26,active:.18,recover:.28,duration:.72,pole:false,length:.67};
 const speedProfile={wind:.18,active:.13,recover:.21,duration:.52,pole:false,length:.67};
 const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
 const loop=(t,n)=>(t%n+n)%n;
 function reset(f){f.action='idle';f.timer=0;f.move=0;f.blocking=false;f.trainingGuard=false;f.trainingPose=null;f.attackKind='light';f.attackRegion='chest';f.attackLeft=false;f.chain=1;f.attackWeapon='gladius';f.attackProfile=pairProfile;f.reaction=0;f.flash=0;f.guardFlash=0;}
 function pose(f,stat,time,role,origin){
  reset(f);const mode=definitions[stat]?.mode||'pair';f.x=origin.x;f.z=origin.z;f.angle=origin.angle||0;
  if(mode==='pair'){
   f.angle=origin.angle??(role? -Math.PI/2:Math.PI/2);
   const phase=loop(time,4.6),turn=phase<2.3?0:1,p=phase%2.3;
   if(role===turn&&p<.72){f.action='attack';f.timer=p;f.duration=.72;const step=Math.sin(p/.72*Math.PI)*.08;f.x+=Math.sin(f.angle)*step;f.z+=Math.cos(f.angle)*step;}
   else if(role!==turn&&p<.92){f.trainingGuard=true;f.trainingPose={poses:{Spine2:[-.035,0,0],LeftArm:[-.55,0,-.12]},drop:0,lean:0};}
  }else if(mode==='post'){
   f.angle=origin.angle??Math.PI/2;const p=loop(time,2.25);
   f.attackProfile=speedProfile;
   if(p<1.56){f.action='attack';f.timer=p%.52;f.duration=.52;f.chain=1+Math.floor(p/.52);const step=Math.sin(f.timer/.52*Math.PI)*.055;f.x+=Math.sin(f.angle)*step;f.z+=Math.cos(f.angle)*step;}
   else{f.trainingGuard=true;}
  }else if(mode==='carry'||mode==='squat'){
   const depth=mode==='squat'?smooth((1-Math.cos(loop(time,3.8)/3.8*Math.PI*2))/2):0;
   const step=mode==='carry'?loop(time,9)/9*Math.PI*2:0;
   if(mode==='carry'){f.x+=Math.sin(step)*.60;f.z+=Math.cos(step)*.52;f.angle=Math.atan2(Math.cos(step)*.60,-Math.sin(step)*.52);f.walk=time*6;f.move=.55;}
   const w=Math.sin(f.walk)*f.move;
   f.trainingPose={poses:{Spine:[.025+depth*.08,0,w*.01],Spine1:[depth*.08,0,0],Spine2:[depth*.10,0,0],Head:[-depth*.12,0,0],LeftUpLeg:[-.85*depth+w*.32,0,0],RightUpLeg:[-.85*depth-w*.32,0,0],LeftLeg:[1.55*depth+Math.max(0,-w)*.48,0,0],RightLeg:[1.55*depth+Math.max(0,w)*.48,0,0],LeftFoot:[-.65*depth,0,0],RightFoot:[-.65*depth,0,0]},drop:-.52*depth,lean:.055+depth*.06,beam:true};
  }else if(mode==='reflex'){
   const p=loop(time,3.6),duck=Math.sin(Math.PI*smooth((p-.35)/.9))*(p<1.25?1:0),side=p>1.8?Math.sin(Math.PI*smooth((p-1.8)/1.2)):0;
   f.x+=side*.58;f.trainingPose={poses:{Spine2:[duck*.34,0,side*.12],LeftUpLeg:[-.45*duck,0,0],RightUpLeg:[-.45*duck,0,0],LeftLeg:[duck*.9,0,0],RightLeg:[duck*.9,0,0],LeftArm:[-.5,0,-.1],RightArm:[-.5,0,.1]},drop:-duck*.33,lean:duck*.14};
  }
  return f;
 }
 function practiceState(base,stat){return {...base,trainingPractice:true,weapon:['carry','squat','reflex'].includes(definitions[stat]?.mode)?null:'gladius',offhand:null,leftGear:null,shield:false,helmet:false,chest:false,greaves:true,shoulders:false,shieldHeldBy:null};}
 function equip(model,f,stat,props,animate){
  animate(f,model,0,1);
  model.trainingFloor=Math.min(...['LeftToeBase','RightToeBase'].map(k=>model.bones[k].getWorldPosition(new THREE.Vector3()).y));
  model.trainingHandSides=Object.fromEntries(['Left','Right'].map(side=>[side,Math.sign(model.root.worldToLocal(model.bones[side+'Arm'].getWorldPosition(new THREE.Vector3())).x)||1]));
  if(f.weapon){model.weaponAnchor.clear();model.weaponAnchor.add(props.rudis());}
  const beam=['carry','squat'].includes(definitions[stat]?.mode)?props.beam():null;
  if(beam){beam.name='Omuz kirişi';beam.rotation.z=Math.PI;beam.position.set(0,1.77,.02);beam.castShadow=false;beam.receiveShadow=true;model.body.add(beam);}
  model.teamMark.visible=false;model.trail.visible=false;return beam;
 }
 function create(options){
  const {T,scene,camera,props}=options,entries=new Map(),frustum=new T.Frustum(),matrix=new T.Matrix4(),sphere=new T.Sphere(new T.Vector3(),1.65);let signature='',instructor=null,metrics={active:0,hidden:0,pairs:0};
  const layout=props.layout;
  function bound(point,padding=1.25){if(!layout)return point;const b=layout.bounds;point.x=Math.max(b.minX+padding,Math.min(b.maxX-padding,point.x));point.z=Math.max(b.minZ+padding,Math.min(b.maxZ-padding,point.z));return point;}
  function route(g,at){if(layout){const p=bound({x:g.body.position.x,z:g.body.position.z});g.body.position.set(p.x,0,p.z);}g.path=[{x:g.body.position.x,z:at.z},{x:at.x,z:at.z}];}
  function isVisible(x,z){sphere.center.set(x,1,z);return frustum.intersectsSphere(sphere);}
  function beginFrame(){camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);metrics.active=metrics.hidden=0;}
  function clear(){for(const [g,e]of entries){e.beam?.removeFromParent();g.model.equippedWeapon=undefined;const position=g.body.position.clone(),rotation=g.body.quaternion.clone();delete g.model.trainingFloor;delete g.model.trainingHandSides;options.restore(g);g.body.position.copy(position);g.body.quaternion.copy(rotation);delete g.trainingEntry;}entries.clear();if(instructor){scene.remove(instructor.model.root);options.dispose(instructor.model);instructor=null;}props.setPosts([]);}
  function reconcile(){
   const roster=options.roster();if(props.postPoints&&props.setRudis(roster.filter(g=>g.record?.id).length))options.onLayout?.();const trainees=roster.filter(g=>g.model&&options.phase(g)==='training'&&!definitions[g.record?.session?.exercise_stat]?.preview);
   const key=trainees.map(g=>g.record.id+':'+g.record.session?.id+':'+g.record.session?.exercise_stat).join('|');if(key===signature)return;signature=key;clear();
   const paired=trainees.filter(g=>definitions[g.record.session.exercise_stat]?.mode==='pair'),solo=trainees.filter(g=>definitions[g.record.session.exercise_stat]?.mode!=='pair');let cell=0;const posts=[];
   const origin=()=>{const i=cell++;return{x:-8+i%5*4,z:-8+Math.floor(i/5)*2.25,angle:0};};
   function add(g,stat,role,at,group){const f=practiceState(g.state,stat),beam=equip(g.model,f,stat,props,options.animate),entry={g,stat,role,origin:at,group,state:f,beam};entries.set(g,entry);g.trainingEntry=entry;g.order=null;route(g,at);return entry;}
   if(layout){
    // Fixed practice stations share their twenty-second visual turns. Sessions and awards remain server-owned.
    const pairLanes=layout.pairs.map(()=>({members:[]})),weightLanes=layout.weights.map(()=>({members:[]})),postLanes=layout.posts.map(()=>({members:[]}));
    const reserved=[...layout.pairs.flatMap(p=>[-.82,.82].map(d=>({x:p.x,z:p.z+d,r:1.15}))),...layout.weights.map(p=>({...p,r:1.65})),...layout.posts.map(p=>({x:p.x-1.2,z:p.z,r:1.15}))];
    const waiting=[];for(let z=layout.bounds.maxZ-1.10;z>layout.bounds.minZ+1.04;z-=1.08)for(let x=layout.bounds.minX+1.10;x<layout.bounds.maxX-1.04;x+=1.08){
     if(z< -9.55&&(x<5.2||x>9.9)||reserved.some(p=>Math.hypot(x-p.x,z-p.z)<p.r))continue;waiting.push({x,z,angle:Math.PI});
    }
    let waitingIndex=0;
    function queue(entry,lane,index,at){const wait=bound({...(waiting[waitingIndex++%waiting.length]||{x:0,z:-4.3}),angle:at.angle});at=bound({...at});entry.queue={lane,index,at,waiting:wait};entry.waiting=index>0;entry.origin=entry.waiting?wait:at;route(entry.g,entry.origin);}
    for(let i=0;i<paired.length;i+=2){const laneIndex=(i/2)%pairLanes.length,lane=pairLanes[laneIndex],at=layout.pairs[laneIndex],group={timeOffset:i*.17,members:[],queue:{lane,index:lane.members.length}};lane.members.push(group);
     for(let role=0;role<2;role++){const g=paired[i+role],position={x:at.x,z:at.z+(role?.82:-.82),angle:role?Math.PI:0};if(g){group.members.push(g);const e=add(g,g.record.session.exercise_stat,role,position,group);queue(e,lane,group.queue.index,position);}else{const model=options.makeInstructor(paired[i]),state=practiceState(paired[i].state,'attack_technique');instructor={model,state,stat:'attack_technique',role:1,origin:position,group};equip(model,state,'attack_technique',props,options.animate);model.root.position.set(position.x,0,position.z);scene.add(model.root);}}
    }
    const weights=solo.filter(g=>['carry','squat'].includes(definitions[g.record.session.exercise_stat]?.mode)),speed=solo.filter(g=>g.record.session.exercise_stat==='speed');
    for(const g of solo){const stat=g.record.session.exercise_stat,isPost=stat==='speed',i=(isPost?speed:weights).indexOf(g),lanes=isPost?postLanes:weightLanes,n=i%lanes.length,lane=lanes[n],index=lane.members.length,at=isPost?{x:layout.posts[n].x-1.2,z:layout.posts[n].z,angle:Math.PI/2}:{...layout.weights[n],angle:0},group={timeOffset:i*.43,members:[g]};lane.members.push(g);queue(add(g,stat,0,at,group),lane,index,at);}
    metrics.pairs=Math.ceil(paired.length/2);props.setPosts([]);options.onLayout?.();return;
   }
   for(let i=0;i<paired.length;i+=2){const at=origin(),group={timeOffset:cell*.37,members:[]};
    for(let role=0;role<2;role++){const g=paired[i+role],position={x:at.x+(role?.75:-.75),z:at.z,angle:role?-Math.PI/2:Math.PI/2};
     if(g){add(g,g.record.session.exercise_stat,role,position,group);group.members.push(g);}
     else{const model=options.makeInstructor(paired[i]),state=practiceState(paired[i].state,'attack_technique');instructor={model,state,stat:'attack_technique',role:1,origin:position,group};equip(model,state,'attack_technique',props,options.animate);scene.add(model.root);}
    }
   }
   metrics.pairs=Math.ceil(paired.length/2);
   const speed=solo.filter(g=>g.record.session.exercise_stat==='speed'),lanes=props.postPoints?.map((post,lane)=>({post,members:speed.filter((g,i)=>i%props.postPoints.length===lane),turn:0}));
   for(const g of solo){const stat=g.record.session.exercise_stat;if(stat==='speed'&&lanes){const lane=lanes[speed.indexOf(g)%lanes.length],index=lane.members.indexOf(g),at={x:lane.post.x,z:lane.post.z+1.20,angle:Math.PI},waiting={x:at.x,z:-8.15+index*1.05,angle:Math.PI};const e=add(g,stat,0,index?waiting:at,{timeOffset:0,members:[g]});e.queue={lane,index,at,waiting};e.waiting=!!index;continue;}
    const at=origin();if(stat==='speed'){at.x-=.48;posts.push({x:at.x+1.20,z:at.z,angle:Math.PI/2});}add(g,stat,0,at,{timeOffset:cell*.43,members:[g]});}
   props.setPosts(posts);options.onLayout?.();
  }
  function render(g,time,dt){const e=entries.get(g);if(!e)return false;
   if(e.queue){const q=e.queue,waiting=Math.floor(time/20)%q.lane.members.length!==q.index;if(waiting!==e.waiting){e.waiting=waiting;e.origin=waiting?q.waiting:q.at;route(g,e.origin);}}
   if(e.beam)e.beam.visible=!e.waiting;
   const moving=g.path.length>0,ready=e.group.members.every(m=>!m.path.length);const f=e.state;
   if(moving||!ready||e.waiting){reset(f);f.x=g.body.position.x;f.z=g.body.position.z;f.angle=moving?g.body.rotation.y:e.origin.angle||0;f.move=moving?1:0;f.walk=g.phase;f.trainingGuard=!!e.waiting&&!moving;if(e.beam&&!e.waiting)f.trainingPose={poses:{},drop:0,lean:.05,beam:true};}
   else pose(f,e.stat,time+e.group.timeOffset,e.role,e.origin);
   bound(f);g.body.position.set(f.x,0,f.z);g.body.rotation.y=f.angle;g.body.visible=isVisible(f.x,f.z);
   if(g.body.visible){options.animate(f,g.model,time,dt);g.model.teamMark.visible=false;g.model.trail.visible=false;metrics.active++;}else metrics.hidden++;
   return true;
  }
  function finishFrame(time,dt){if(!instructor)return;const e=instructor;if(e.group.queue&&Math.floor(time/20)%e.group.queue.lane.members.length!==e.group.queue.index){e.model.root.visible=false;return;}pose(e.state,e.stat,time+e.group.timeOffset,e.role,e.origin);if(!e.group.members.every(g=>!g.path.length)){reset(e.state);e.state.x=e.origin.x;e.state.z=e.origin.z;e.state.angle=e.origin.angle??-Math.PI/2;}bound(e.state);
   e.model.root.position.set(e.state.x,0,e.state.z);e.model.root.visible=isVisible(e.state.x,e.state.z);if(e.model.root.visible){options.animate(e.state,e.model,time,dt);e.model.teamMark.visible=false;e.model.trail.visible=false;metrics.active++;}else metrics.hidden++;
  }
  return {reconcile,beginFrame,render,finishFrame,isVisible,entries,get instructor(){return instructor;},get metrics(){return {...metrics,posts:props.postPoints?Math.min(2,[...entries.values()].filter(e=>e.stat==='speed').length):props.activePosts.count/5};},dispose:clear};
 }
 root.LudusTraining={definitions,pose,practiceState,equip,create,pairProfile,speedProfile};
 if(typeof module!=='undefined')module.exports=root.LudusTraining;
})(globalThis);
