const assert=require('node:assert/strict'),fs=require('node:fs');
module.exports=async function combatVisuals(page,out){
 const motion=await page.evaluate(()=>{
  const a=__arena,T=THREE,scene=new T.Scene();scene.background=new T.Color('#a7adb0');scene.add(new T.HemisphereLight(0xe9f5ff,0x806f53,2));const sun=new T.DirectionalLight(0xffefcc,2.5);sun.position.set(-3,7,4);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(50,50),new T.MeshStandardMaterial({color:0x89806a,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const camera=new T.PerspectiveCamera(39,innerWidth/innerHeight,.1,50);camera.position.set(3.1,2.25,3.8);camera.lookAt(0,1.1,.6);
  const metrics=[],shots=[];let clock=0;
  for(const [kind,type] of [['spear','hoplomachus'],['trident','retiarius']]){
   const m=ImportedGladiator.create(200,type),f=new ArenaCombat(()=>.999).reset('normal',type).fighters[0];scene.add(m.root);Object.assign(f,{x:0,z:0,angle:0,move:0,walk:0,reaction:0,navHeight:0});
   for(const left of [false,true])for(const region of ['chest','head','leftLeg']){
    Object.assign(f,{weapon:left?null:kind,offhand:left?kind:null,shield:!left&&kind==='spear'?'round':null,leftGear:!left&&kind==='trident'?'net':null,action:'idle',timer:0,attackWeapon:kind,attackLeft:left,attackRegion:region,chain:1});
    for(let i=0;i<30;i++){clock+=1/60;ImportedGladiator.animate(f,m,clock,1/60);}
    const p=ArenaMotion.profile(kind);Object.assign(f,{action:'attack',attackProfile:p,duration:p.duration});
    let gripError=0,tipError=0,footError=0,maxStep=0;const before=['Left','Right'].map(s=>m.bones[s+'Foot'].getWorldPosition(new T.Vector3())),captured=new Set();
    for(let i=0;i<=Math.ceil(p.duration*60);i++){
     f.timer=Math.min(p.duration,i/60);clock+=1/60;ImportedGladiator.animate(f,m,clock,1/60);m.root.updateMatrixWorld(true);
     const s=ArenaMotion.sample(f),anchor=left?m.offhandAnchor:m.weaponAnchor,hand=m.root.worldToLocal(anchor.getWorldPosition(new T.Vector3())),tip=m.root.worldToLocal(anchor.localToWorld(new T.Vector3(0,p.length,0)));
     gripError=Math.max(gripError,hand.distanceTo(new T.Vector3(s.grip.x,s.grip.y,s.grip.z)));tipError=Math.max(tipError,tip.distanceTo(new T.Vector3(s.tip.x,s.tip.y,s.tip.z)));
     const step=ArenaMotion.body(f).step;maxStep=Math.max(maxStep,step?.forward||0);
     for(const [k,side] of ['Left','Right'].entries()){const expected=before[k].clone();if(step?.side===side){expected.z+=step.forward;expected.y+=step.lift;}footError=Math.max(footError,m.bones[side+'Foot'].getWorldPosition(new T.Vector3()).distanceTo(expected));}
     if(!left&&region==='chest')for(const [name,t] of [['chamber',p.wind],['thrust',p.wind+p.active*.85],['recover',p.wind+p.active+p.recover*.5]])if(f.timer>=t&&!captured.has(name)){captured.add(name);a.renderer.render(scene,camera);shots.push({name:kind+'-'+name,data:a.renderer.domElement.toDataURL('image/png').split(',')[1]});}
    }
    metrics.push({kind,left,region,gripError,tipError,footError,maxStep});
   }
   scene.remove(m.root);ImportedGladiator.dispose(m);
  }
  floor.geometry.dispose();floor.material.dispose();a.renderer.render(a.scene,a.camera);return{metrics,shots};
 });
 for(const shot of motion.shots)fs.writeFileSync(out+'/'+shot.name+'.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({polearmMotion:motion.metrics}));
 assert.ok(motion.metrics.every(x=>x.gripError<.035),'the hand must reach the collision grip without a floating weapon');
 assert.ok(motion.metrics.every(x=>x.tipError<.035),'rendered spear and trident points must follow the hit geometry');
 assert.ok(motion.metrics.every(x=>x.footError<.04&&x.maxStep>.2),'the lead foot takes a short step; the rear foot stays planted');
 const feedback=await page.evaluate(()=>{
  const a=__arena;a.combat.events=[];document.getElementById('floaters').replaceChildren();
  a.combat.events.push({type:'hit',id:5,source:0,damage:17},{type:'hit',id:0,source:5,damage:9},{type:'hit',id:6,source:5,damage:21});a.events();a.toast('Cirit hazır · Uygun rakibe atabilirsin.');
  return [...document.querySelectorAll('#combatFeedback .float')].map(e=>({text:e.textContent,source:e.dataset.source,color:getComputedStyle(e).color}));
 });
 assert.deepEqual(feedback,[{text:'−17',source:'0',color:'rgb(137, 237, 164)'},{text:'−9',source:'5',color:'rgb(255, 128, 110)'}]);
 for(const [width,height] of [[667,375],[844,390],[932,430],[1024,768]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const layout=await page.evaluate(()=>{const a=__arena;a.setPaused(false);a.naval.player().navJavelin=true;a.view.update(a.combat.time);a.renderer.render(a.scene,a.camera);const ids=['toast','combo','floaters','regionHint'],messages=ids.map(id=>document.getElementById(id)).filter(e=>!e.hidden&&getComputedStyle(e).display!=='none'&&e.textContent).map(e=>({id:e.id,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}));const box=document.getElementById('navalJavelin').getBoundingClientRect();return{messages,javelin:{top:box.top,bottom:box.bottom},height:innerHeight};});
  assert.ok(layout.messages.every(x=>x.top>=0&&x.bottom<height*.38),'all combat text stays in the upper HUD');assert.ok(layout.javelin.top>height*.75&&layout.javelin.bottom<=height,'javelin pickup/throw stays in the bottom row');
  await page.screenshot({path:out+'/feedback-'+width+'.png'});
 }
 await page.setViewportSize({width:844,height:390});
 const water=await page.evaluate(()=>{const a=__arena;a.naval.player().navJavelin=false;const m=a.view.water.material;return{ior:m.ior,metalness:m.metalness,roughness:m.roughness,ships:m.uniforms.ships.value.length,programs:a.renderer.info.programs.length};});
 assert.equal(water.ior,1.333);assert.equal(water.metalness,0);assert.equal(water.ships,4);
 return{motion:motion.metrics,feedback,water};
};
