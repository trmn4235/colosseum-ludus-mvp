/* One on-demand WebGL context; the exact selected fighters and equipped models. */
var RankedLineup=(()=>{
 'use strict';
 function create(canvas,status){
  let renderer,scene,camera,loading=null,stopped=false,frame=0,revision=0,members=[],slots=[],lastKey='';
  const models=new Map();
  function message(text){status.textContent=text;status.hidden=!text;}
  function invalidate(){if(!stopped&&!frame)frame=requestAnimationFrame(draw);}
  function bounds(model){
   const box=new THREE.Box3(),part=new THREE.Box3();model.root.updateMatrixWorld(true);
   model.root.traverseVisible(o=>{if(!o.isMesh||o===model.shadow||o===model.trail)return;
    if(o.isSkinnedMesh){o.computeBoundingBox();part.copy(o.boundingBox);}else{if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();part.copy(o.geometry.boundingBox);}
    box.union(part.applyMatrix4(o.matrixWorld));
   });return box;
  }
  function draw(){
   frame=0;if(stopped||document.hidden||!renderer)return;
   const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setSize(w,h,false);
   renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
   for(const entry of models.values())entry.model.root.visible=false;
   for(let i=0;i<slots.length;i++){
    const entry=models.get(slots[i]);if(!entry)continue;
    const left=Math.round(i*w/5),right=Math.round((i+1)*w/5),aspect=(right-left)/h;
    const b=entry.bounds,size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
    const height=Math.max(size.y,2.15,size.x/aspect)*1.09,width=height*aspect;
    camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;
    camera.position.set(center.x,center.y,10);camera.lookAt(center.x,center.y,0);camera.updateProjectionMatrix();
    renderer.setViewport(left,0,right-left,h);renderer.setScissor(left,0,right-left,h);
    entry.model.root.visible=true;renderer.render(scene,camera);entry.model.root.visible=false;
   }
   renderer.setScissorTest(false);
  }
  async function boot(){
   if(loading)return loading;
   loading=(async()=>{
    if(!renderer){renderer=ArenaCreateRenderer({canvas,alpha:true,antialias:true});renderer.setClearColor(0x000000,0);renderer.autoClear=false;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    scene=new THREE.Scene();RomanVisualAssets.environment(scene);camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,30);
    scene.add(new THREE.HemisphereLight(0xfff2e6,0x695860,1.6));
    const sun=new THREE.DirectionalLight(0xfff0dc,2.5);sun.position.set(-3,5,5);scene.add(sun);
    const fill=new THREE.DirectionalLight(0xdce9ff,.7);fill.position.set(4,2,2);scene.add(fill);}
    await ImportedGladiator.load(message);
   })().catch(e=>{loading=null;throw e;});return loading;
  }
  async function update(next){
   members=next.slice(0,5);
   const key=JSON.stringify(members.map(m=>[m.user_id,m.gladiator_id,m.appearance]));if(key===lastKey)return;
   lastKey=key;const version=++revision;
   // Remove departed/reselected fighters immediately, before any new asset awaits.
   slots=members.map(m=>m.user_id);
   for(const [id,entry]of models)if(!members.some(m=>m.user_id===id&&JSON.stringify(m.appearance)===entry.key)){
    scene.remove(entry.model.root);ImportedGladiator.dispose(entry.model);models.delete(id);
   }
   invalidate();if(!members.length){message('');return;}
   if(members.some(m=>!m.appearance?.gladiator||!Array.isArray(m.appearance.items))){message('Gladyatör ve ekipman bilgileri bekleniyor…');lastKey='';return;}
   message('Gladyatörler ve ekipmanları yükleniyor…');
   try{
    await boot();
    const ids=[...new Set(members.flatMap(m=>m.appearance.items.map(i=>i.model)).filter(id=>LudusEquipmentCatalog.entry(id)))];
    await Promise.all(ids.map(id=>LudusEquipmentCatalog.load(THREE,id)));
    if(stopped||version!==revision)return;
    for(const m of members){
     if(models.has(m.user_id))continue;
     const {gladiator,items}=m.appearance,model=ImportedGladiator.create(0,gladiator.class);
     const fighter=new ArenaCombat().reset('normal',gladiator.class).fighters[0];
     LudusLoadout.apply(fighter,gladiator,items);
     Object.assign(fighter,{x:0,z:0,angle:0,action:'idle',move:0,presentation224:true});
     scene.add(model.root);for(let n=0;n<3;n++)ImportedGladiator.animate(fighter,model,0,1/30);model.teamMark.visible=false;
     models.set(m.user_id,{model,fighter,key:JSON.stringify(m.appearance),bounds:bounds(model)});
    }
    message('');invalidate();
   }catch(e){if(version!==revision||stopped)return;lastKey='';message('Gladyatör görüntüsü yüklenemedi. Yeniden deneniyor…');console.warn('Ranked lineup:',e.message);}
  }
  const resize=new ResizeObserver(invalidate);resize.observe(canvas);
  const visible=()=>{if(!document.hidden)invalidate();};
  document.addEventListener('visibilitychange',visible);window.addEventListener('roman-texture-loaded',invalidate);
  function dispose(){stopped=true;revision++;cancelAnimationFrame(frame);resize.disconnect();document.removeEventListener('visibilitychange',visible);window.removeEventListener('roman-texture-loaded',invalidate);
   for(const entry of models.values())ImportedGladiator.dispose(entry.model);models.clear();renderer?.dispose();}
  return {update,dispose};
 }
 return {create};
})();
