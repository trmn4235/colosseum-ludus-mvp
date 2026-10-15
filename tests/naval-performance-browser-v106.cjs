/* Same real 20-actor scene for both revisions. CPU timings exclude rasterization.
   Software-GPU timings are comparative diagnostics, never physical-device FPS. */
module.exports=async function(page,out){
 await page.exposeFunction('__perfLog',value=>console.log('Performance:',JSON.stringify(value)));
 const result=await page.evaluate(async()=>{
  const a=__arena,T=THREE,groups={};
  const count=(name,root)=>{const g=groups[name]={meshes:0,triangles:0,casters:0,bones:0};const skeletons=new Set();root.traverse(o=>{if(!o.isMesh)return;g.meshes++;g.triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.castShadow)g.casters++;if(o.skeleton&&!skeletons.has(o.skeleton)){skeletons.add(o.skeleton);g.bones+=o.skeleton.bones.length;}});};
  count('scene',a.scene);count('player',a.models[0].root);count('npc',a.models[1].root);for(let i=0;i<4;i++)count('ship'+i,a.view.views[i].group);
  const objects=[];a.scene.traverse(o=>{if(o.isMesh)objects.push({name:o.name||o.type,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3,cast:o.castShadow,visible:o.visible,skinned:!!o.isSkinnedMesh});});objects.sort((a,b)=>b.triangles-a.triangles);
  const stats=values=>{const v=values.slice().sort((a,b)=>a-b);return{mean:v.reduce((a,b)=>a+b,0)/v.length,p50:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)]};};
  // Warm up the actual animation, simulation and HUD paths, excluding GPU submission.
  const savedRender=a.renderer.render,cpu={frame:[],simulation:[],animation:[],view:[]},originals=[];let current;
  function wrap(obj,key,bucket){const original=obj[key];originals.push(()=>obj[key]=original);obj[key]=function(...args){const start=performance.now();const r=original.apply(this,args);current[bucket]+=performance.now()-start;return r;};}
  wrap(a.combat,'tick','simulation');wrap(ImportedGladiator,'animate','animation');wrap(a.view,'update','view');a.renderer.render=()=>{};
  try{for(let i=0;i<360;i++){current={simulation:0,animation:0,view:0};const start=performance.now();a.step(1/60);if(i>=120){cpu.frame.push(performance.now()-start);for(const k of ['simulation','animation','view'])cpu[k].push(current[k]);}}}finally{a.renderer.render=savedRender;for(const restore of originals)restore();}
  await window.__perfLog({cpu:Object.fromEntries(Object.entries(cpu).map(([k,v])=>[k,stats(v)]))});
  // Identical wide framing, all four full crews visible. Force the expensive shadow pass.
  a.camera.position.set(24,19,-31);a.camera.lookAt(-1,2,0);for(const m of a.models)m.root.visible=true;
  const gl=a.renderer.getContext(),render={};
  async function sample(name,setup){await window.__perfLog({start:name});const restore=setup?.()||(()=>{});const v=[];try{for(let i=0;i<7;i++){a.renderer.shadowMap.needsUpdate=true;gl.finish();const start=performance.now();a.renderer.render(a.scene,a.camera);gl.finish();if(i>1)v.push(performance.now()-start);}render[name]={...stats(v),calls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles};}finally{restore();}await window.__perfLog({[name]:render[name]});}
  await sample('full');
  await sample('noWater',()=>{a.view.water.visible=false;return()=>a.view.water.visible=true;});
  await sample('noShadows',()=>{const v=a.renderer.shadowMap.enabled;a.renderer.shadowMap.enabled=false;return()=>a.renderer.shadowMap.enabled=v;});
  await sample('noCharacters',()=>{for(const m of a.models)m.root.visible=false;return()=>{for(const m of a.models)m.root.visible=true;};});
  // Worst boarding concentration: every fighter on one deck, still rendered.
  const ship=a.naval.ships[0],p=a.combat.fighters[0];
  for(let i=0;i<20;i++){const f=a.combat.fighters[i],q=NavalSimulation.world(ship,(i%5-2)*.9,(Math.floor(i/5)-1.5)*1.8);Object.assign(f,{x:q.x,z:q.z,hp:100,action:'idle',move:0,navJump:null,navHeight:0});}
  if(typeof NavalPerformance!=='undefined')NavalPerformance.beginFrame(a.combat.fighters,p,false,a.combat.lockedTarget);
  for(let i=0;i<20;i++){a.models[i].root.visible=true;a.animateCharacter(a.combat.fighters[i],a.models[i],a.combat.time,1/30);}
  a.camera.position.set(ship.x+5,6,ship.z-10);a.camera.lookAt(ship.x,1,ship.z);await sample('crowdedDeck');
  const detail={bodies:a.models.map(m=>m.navalBodyLevel??0),visible:a.models.filter(m=>m.root.visible).length,uniformBatch:a.view.uniformBatch?.metrics};
  a.renderer.render(a.scene,a.camera);
  return{groups,largest:objects.slice(0,12),cpu:Object.fromEntries(Object.entries(cpu).map(([k,v])=>[k,stats(v)])),render,detail,dpr:a.renderer.getPixelRatio(),memory:a.renderer.info.memory,note:'Headless Chromium, software WebGL; no device FPS claim.'};
 });
 await page.screenshot({path:out+'/performance-fleet.png'});return result;
};
