/* Visuals only: combat and rewards remain in the frozen replay simulation. */
var CaravanPresentation=(()=>{
 let driver;
 async function loadDriver(){
  const response=await fetch('assets/caravan-v128/driver.glb',{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error('Kervancı modeli yüklenemedi.');
  driver=(await new THREE.GLTFLoader().parseAsync(await response.arrayBuffer(),'')).scene;
  driver.traverse(o=>{if(o.isMesh){o.material.roughness=Math.max(.75,o.material.roughness);o.material.envMapIntensity=.45;}});
  CaravanLoading.set('driver',1,'Kervancı hazır');
 }
 function create(field,models){
  const T=THREE,scene=field.scene,ropeMat=new T.MeshStandardMaterial({color:0xc5ac78,roughness:1}),parts=[];
  const rope=(points,r=.014)=>{const g=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(4,points.length*3),r,4,false);parts.push(g);};
  const merged=()=>{const g=ArenaGeometryUtils.mergeGeometries(parts,false);for(const p of parts)p.dispose();parts.length=0;return new T.Mesh(g,ropeMat);};
  for(let i=-5;i<=5;i++){const a=i/5,b=Math.sqrt(Math.max(0,1-a*a));if(b<.01)continue;rope([[a,-b,0],[a,0,-.12],[a,b,0]]);rope([[-b,a,0],[0,a,-.12],[b,a,0]]);}
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;parts.push(new T.SphereGeometry(.042,6,4).translate(Math.cos(a),Math.sin(a),0));}
  const disk=merged();disk.name='Flying net';
  for(let j=0;j<9;j++){const points=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;points.push([Math.cos(a)*.47,.18+j*.19,Math.sin(a)*.36]);}rope(points);}
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;rope([[Math.cos(a)*.47,.15,Math.sin(a)*.36],[Math.cos(a+.18)*.47,1,Math.sin(a+.18)*.36],[Math.cos(a)*.37,1.85,Math.sin(a)*.31]]);}
  const wrap=merged();wrap.name='Captured net';
  const views=new Map(),hand=new T.Vector3(),targetPoint=new T.Vector3();
  const ring=new T.Mesh(new T.RingGeometry(.52,.59,48),new T.MeshBasicMaterial({color:0xffdc83,transparent:true,opacity:.95,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;ring.name='Locked target';scene.add(ring);
  const marker=document.createElement('div');marker.className='cb-target-marker';marker.hidden=true;marker.setAttribute('aria-live','polite');document.body.append(marker);
  function update(c){
   const live=new Set(c.nets.map(n=>n.id));for(const[id,v]of views)if(!live.has(id)){v.group.removeFromParent();v.line.geometry.dispose();v.line.material.dispose();views.delete(id);}
   for(const n of c.nets){
    let v=views.get(n.id);if(!v){const group=new T.Group(),d=disk.clone(),w=wrap.clone(),line=new T.Line(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(9),3)),new T.LineBasicMaterial({color:0xc8b283}));group.name='Caravan net '+n.id;group.add(d,w,line);scene.add(group);v={group,disk:d,wrap:w,line};views.set(n.id,v);}
    const holding=n.victim!==null&&c.time<n.holdUntil,returning=n.age>=n.retractAt,spread=returning?Math.max(.12,1-(n.age-n.retractAt)/.55):Math.min(1,Math.max(.1,(n.age-.3)*4));
    v.disk.visible=!holding&&n.age>=.3;v.wrap.visible=holding;v.disk.position.set(n.x,field.height(n.x,n.z)+1.25+Math.sin(Math.min(1,Math.max(0,n.age-.3)/.72)*Math.PI)*.35,n.z);v.disk.rotation.set(.2,Math.atan2(n.dx,n.dz),n.age*.8);v.disk.scale.setScalar(spread);
    if(holding){const f=c.fighters[n.victim];v.wrap.position.set(f.x,field.height(f.x,f.z),f.z);v.wrap.rotation.y=f.angle;}
    const m=models[n.owner];m.root.updateMatrixWorld(true);m.bones.LeftHand.getWorldPosition(hand);const a=v.line.geometry.attributes.position,h=field.height(n.x,n.z);a.setXYZ(0,hand.x,hand.y,hand.z);a.setXYZ(1,(hand.x+n.x)/2,h+.65,(hand.z+n.z)/2);a.setXYZ(2,n.x,holding?h+1.2:v.disk.position.y,n.z);a.needsUpdate=true;v.line.geometry.computeBoundingSphere();v.line.visible=n.age>=.3;
   }
   const p=c.fighters[0],target=c.fighters[c.lockedTarget],valid=c.enemy(p,target)&&!c.finished&&p.hp>0;
   ring.visible=valid;marker.hidden=true;
   if(valid){ring.position.set(target.x,field.height(target.x,target.z)+.045,target.z);targetPoint.set(target.x,field.height(target.x,target.z)+2.35,target.z).project(field.camera);
    if(Math.abs(targetPoint.x)<.92&&Math.abs(targetPoint.y)<.88&&targetPoint.z<1){marker.hidden=false;marker.style.left=(targetPoint.x*.5+.5)*innerWidth+'px';marker.style.top=(-targetPoint.y*.5+.5)*innerHeight+'px';const label=target.name+' · '+Math.ceil(Math.max(0,target.hp))+' CAN';if(marker.textContent!==label)marker.textContent=label;}
   }
  }
  return{update,ring,get netCount(){return views.size;}};
 }
 return{loadDriver,get driver(){return driver;},create};
})();
