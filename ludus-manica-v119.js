/* Shared, batched forearm guards. No extra model download or per-frame allocation. */
var LudusManica=(()=>{
 let cached;const caps196=new WeakMap();
 function get(T){
  if(cached)return cached;
  const bronze=new T.MeshStandardMaterial({color:0xa77d39,metalness:.72,roughness:.42,side:T.DoubleSide});
  const leather=new T.MeshStandardMaterial({color:0x4a2d1c,roughness:.9,side:T.DoubleSide});
  const guard=new T.Group(),plates=[],straps=[];
  for(let i=0;i<7;i++){
   const r=.047+i*.0025,g=new T.CylinderGeometry(r,r+.002,.035,12,1,true,.25,Math.PI*1.8);
   g.translate(0,-.108+i*.036,0);plates.push(g);
  }
  for(const y of [-.075,.075]){const g=new T.CylinderGeometry(.067,.067,.015,12,1,true);g.translate(0,y,0);straps.push(g);}
  for(const [parts,material]of [[plates,bronze],[straps,leather]]){
   const joined=typeof ArenaGeometryUtils!=='undefined'?ArenaGeometryUtils.mergeGeometries(parts,false):null;
   for(const geometry of joined?[joined]:parts){const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;guard.add(mesh);}
   if(joined)parts.forEach(g=>g.dispose());
  }
  guard.userData.armourModel='manica';
  const whole=new T.Group();for(const x of [-.085,.085]){const g=guard.clone(true);g.position.x=x;whole.add(g);}
  whole.userData.armourModel='manica';cached={single:guard,whole};return cached;
 }
 // V196: two permanent bind-pose mounts; imported segments share catalog buffers.
 function imported(id){return !!globalThis.LudusEquipmentCatalog?.entry(id)?.armour;}
 function mount(T,m,fitLimb){
  for(const [key,start,end]of [['armUpper','RightArm','RightForeArm'],['armFore','RightForeArm','RightHand']]){
   const slot=fitLimb(m,start,end,new T.Group(),.25);slot.group.scale.y/=.84;slot.group.userData.bindScaleY=slot.group.scale.y;slot.group.visible=false;m.gear[key]=slot;
  }
 }
 function sync(T,m,f){
  const id=imported(f.shoulderModel)?f.shoulderModel:null,visible=f.shoulders!==false&&!!id;
  const catalog=globalThis.LudusEquipmentCatalog;if(visible)catalog.request(T,id);const loaded=id&&catalog.get(id),revision=catalog?.revision||0;
  if(m.manicaId196!==id||m.manicaRevision196!==revision||m.manicaLoaded196!==!!loaded){
   m.manicaId196=id;m.manicaRevision196=revision;m.manicaLoaded196=!!loaded;
   for(const [key,name]of [['armUpper','upper'],['armFore','fore']]){
    const group=m.gear[key].group;group.clear();group.userData.catalogId=id;group.scale.set(1,group.userData.bindScaleY,1);
    const part=loaded?.getObjectByName(name);if(part){const clone=part.clone(true);clone.position.set(0,0,0);clone.traverse(o=>{if(o.isMesh)o.frustumCulled=false});group.add(clone);}
   }
  }
  for(const key of ['armUpper','armFore'])m.gear[key].group.visible=visible&&m.gear[key].group.children.length>0;
 }
 function cap(T,id){const template=globalThis.LudusEquipmentCatalog?.get(id),part=template?.getObjectByName('cap');if(!part)return null;if(!caps196.has(template)){const g=new T.Group(),clone=part.clone(true);clone.position.set(0,0,-.05);g.add(clone);g.userData.rigidArmour196=true;caps196.set(template,g);}return caps196.get(template);}
 return{get,imported,mount,sync,cap};
})();
