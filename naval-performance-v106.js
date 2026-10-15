/* Naval rendering budget. Simulation and collision stay at 60 Hz for all 20 actors. */
var NavalPerformance=(()=>{
 const cache=new WeakMap();let data=null,pending=null,detailBudget=false;const shadowIds=new Set([0]),fullIds=new Set([0]);
 function decode(buffer){
  const h=new Uint32Array(buffer,0,5);
  if(h[0]!==0x10610d||buffer.byteLength!==20+(h[3]+h[4])*4||h[3]%3||h[4]%3)throw Error('Invalid naval LOD data');
  const levels=[new Uint32Array(buffer,20,h[3]),new Uint32Array(buffer,20+h[3]*4,h[4])];
  for(const level of levels)for(const index of level)if(index>=h[1])throw Error('Invalid naval LOD index');
  return{vertices:h[1],indices:h[2],levels};
 }
 async function fetchDetail(name){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(new URL(name,document.baseURI),{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.arrayBuffer();}finally{clearTimeout(timer);}
 }
 function load(fetchAsset=fetchDetail){
  return pending||(pending=fetchAsset('assets/naval/gladiator-lod-v106.bin').then(buffer=>{data=decode(buffer);}).catch(error=>{
   // The original body remains usable if an old/offline cache lacks this optional asset.
   console.warn('Naval detail fallback:',error.message);
  }));
 }
 function level(distance,previous=0){
  // Hysteresis prevents repeated geometry swaps at a moving distance boundary.
  if(distance<(previous===0?6.5:5.5))return 0;
  return distance<(previous===2?17:19)?1:2;
 }
 function prepare(model){
  if(model.navalBodies||!data)return;
  model.navalBodies=[];
  model.visual.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;const source=mesh.geometry;
   if(source.attributes.position.count!==data.vertices||source.index?.count!==data.indices)return;
   let geometries=cache.get(source);
   if(!geometries){
    geometries=[source,...data.levels.map(indices=>{
     const g=new THREE.BufferGeometry();
     // Original positions, UVs, normals and bone weights are shared verbatim.
     for(const [key,attribute] of Object.entries(source.attributes))g.setAttribute(key,attribute);
     g.setIndex(new THREE.BufferAttribute(indices,1));g.boundingBox=source.boundingBox;g.boundingSphere=source.boundingSphere;return g;
    })];cache.set(source,geometries);
   }
   model.navalBodies.push({mesh,geometries});
  });
 }
 function character(model,fighter,distance){
  if(fighter.id===0)return;prepare(model);
  const next=Math.max(detailBudget&&!fullIds.has(fighter.id)?1:0,level(distance,model.navalBodyLevel||0));if(next===model.navalBodyLevel)return;
  for(const body of model.navalBodies||[])body.mesh.geometry=body.geometries[next];model.navalBodyLevel=next;
 }
 function beginFrame(fighters,player,detailed=false,targetId=null){
  shadowIds.clear();shadowIds.add(0);
  const nearby=fighters.filter(f=>f.id!==0&&f.hp>0&&Math.hypot(f.x-player.x,f.z-player.z)<7);
  nearby.sort((a,b)=>(a.x-player.x)**2+(a.z-player.z)**2-(b.x-player.x)**2-(b.z-player.z)**2);
  for(const f of nearby.slice(0,detailed?7:3))shadowIds.add(f.id);
  detailBudget=!detailed;fullIds.clear();fullIds.add(0);
  // Boarding can put all 20 actors on one deck. Keep the focus opponent and
  // two closest bodies at original detail; the others retain the 18k body.
  const target=nearby.find(f=>f.id===targetId);if(target)fullIds.add(target.id);
  for(const f of nearby){if(fullIds.size>=4)break;fullIds.add(f.id);}
 }
 function shadow(id){return shadowIds.has(id);}
 function interval(distance,detailed=false){return !detailed&&distance>24?1/20:1/30;}
 function phase(id,interval){return ((id*.61803398875)%1)*interval;}
 function shadowInterval(mode,dpr){return mode==='high'?1000/30:dpr<=1?1000/15:1000/20;}
 function uniforms(scene,models){
  const states=new Map(),batches=new Map(),previous=scene.onBeforeRender;
  const metrics={sources:0,instances:0,draws:0};
  function restore(state){for(const row of state.parts)row.mesh.layers.mask=row.mask;}
  function update(){
   metrics.sources=metrics.instances=metrics.draws=0;
   for(const batch of batches.values())batch.count=0;
   const current=models();
   for(const [model,state] of states)if(!current.includes(model)){restore(state);states.delete(model);}
   for(const model of current){
    if(model.id===0)continue;let state=states.get(model);
    if(!state||state.revision!==model.gearRevisionV84){
     if(state)restore(state);state={revision:model.gearRevisionV84,parts:[]};states.set(model,state);
     for(const slot of Object.values(model.gear||{}))if(slot.group?.userData.navalUniform)slot.group.traverse(mesh=>{
      if(mesh.isMesh&&!mesh.isSkinnedMesh&&!Array.isArray(mesh.material))state.parts.push({mesh,mask:mesh.layers.mask});
     });
    }
    for(const row of state.parts){
     const mesh=row.mesh;metrics.sources++;
     // Keep mirrored pieces on their original draw path (negative instance
     // scales change front-face winding). Equipment visibility stays semantic.
     if(mesh.matrixWorld.determinant()<0){mesh.layers.mask=row.mask;continue;}
     mesh.layers.mask=0;let visible=true;
     for(let node=mesh;node;node=node.parent)if(!node.visible){visible=false;break;}
     if(!visible)continue;
     const key=mesh.geometry.uuid+':'+mesh.material.uuid+':'+Number(mesh.castShadow)+':'+Number(mesh.receiveShadow);
     let batch=batches.get(key);
     if(!batch){batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,128);batch.name='Naval shared uniform';batch.castShadow=mesh.castShadow;batch.receiveShadow=mesh.receiveShadow;batch.frustumCulled=false;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.count=0;scene.add(batch);batches.set(key,batch);}
     if(batch.count===128){mesh.layers.mask=row.mask;continue;}
     batch.setMatrixAt(batch.count++,mesh.matrixWorld);metrics.instances++;
    }
   }
   for(const batch of batches.values()){batch.visible=batch.count>0;if(batch.visible){batch.instanceMatrix.needsUpdate=true;metrics.draws++;}}
  }
  // Three updates world matrices before this callback, then builds its draw
  // lists. This also keeps direct renders, pause and camera previews correct.
  const callback=function(...args){previous?.apply(this,args);update();};scene.onBeforeRender=callback;
  return{update,metrics,batches,dispose(){if(scene.onBeforeRender===callback)scene.onBeforeRender=previous;for(const state of states.values())restore(state);for(const batch of batches.values()){batch.removeFromParent();batch.dispose();}states.clear();batches.clear();}};
 }
 return{load,decode,level,character,beginFrame,shadow,interval,phase,shadowInterval,uniforms,get ready(){return!!data;}};
})();
if(typeof module!=='undefined')module.exports=NavalPerformance;
