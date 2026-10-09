/* Isolated, account-free experiment. Reuses the current model, rig and courtyard. */
(function(root){
 'use strict';const $=id=>document.getElementById(id),ui={train:$('train'),view:$('view'),count:$('count'),smart:$('smart'),compare:$('compare'),loading:$('loading'),live:$('live'),measurement:$('measurement'),report:$('report'),exercise:$('exercise')};
 function inject(text){const s=document.createElement('script');let fault;const capture=e=>{fault=e.error||Error(e.message);};root.addEventListener('error',capture);s.textContent=text;document.head.append(s);s.remove();root.removeEventListener('error',capture);if(fault)throw fault;}
 function script(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error('Dosya yüklenemedi: '+url));document.head.append(s);});}
 async function boot(){
  const response=await fetch('ludus.html?v=revision51');if(!response.ok)throw Error('Avlu dosyası alınamadı.');const html=await response.text(),doc=new DOMParser().parseFromString(html,'text/html'),scripts=[...doc.scripts];
  const lib=scripts.find(s=>s.textContent.includes('Copyright © 2010-2023 three.js authors'))?.textContent;
  const source=scripts.find(s=>s.textContent.includes('var ImportedGladiator='))?.textContent;
  const marker="(function(){\n'use strict';const T=THREE,$=id=>document.getElementById(id),canvas=$('scene');let renderer;";
  const start=source?.indexOf('var ARENA_ASSET_BASE='),sceneStart=source?.indexOf(marker),end=source?.indexOf('const player={x:0,z:7',sceneStart);
  if(!lib||start<0||sceneStart<start||end<sceneStart)throw Error('Avlu sürümü bu denemeyle uyumlu değil.');
  inject(lib);inject(scripts.find(s=>s.textContent.includes('var LudusClanEmblems='))?.textContent||'');
  await script('training-motion-v50.js?v=50');await script('arena-fall-motion-v39.js?v=revision39');await script('arena-ground-fall-v39.js?v=revision41');await script('ludus-city-v29.js?v=revision39');
  let core=source.slice(start,sceneStart);
  // The existing rig's hand solver also plants the wooden practice blade in guard.
  const guardPoint='m.trail.material.opacity=strike?.active?.2:0;';
  if(!core.includes(guardPoint))throw Error('Gladyatör hareket sürümü değişti.');
  if(!core.includes("if(f.trainingGuard)"))core=core.replace(guardPoint,"if(f.trainingGuard){const grip={x:.24,y:1.40,z:.28},dir={x:-.55,y:.72,z:.42};strike={phase:.5,active:false,grip,dir,tip:{x:grip.x+dir.x*.67,y:grip.y+dir.y*.67,z:grip.z+dir.z*.67}};poses.Spine2=[-.035,0,0];poses.LeftArm=[-.55,0,-.12];}"+guardPoint);
  inject(core);inject(source.slice(sceneStart,end)+'\nTrainingTest.readyPromise=TrainingTest.start({T,scene,camera,renderer,materials,ready,city});\n})();');await root.TrainingTest.readyPromise;
 }
 let current=null;
 async function start(world){
  const {T,scene,camera,renderer,materials}=world,canvas=$('scene'),props=LudusTrainingProps.create(T,materials.wood);scene.add(props.group);
  const pool=[],frustum=new T.Frustum(),projection=new T.Matrix4(),sphere=new T.Sphere(new T.Vector3(),1.5);let count=2,training=false,smart=true,clock=0,last=0,raf=0,measuring=false,disposed=false,lost=false,collect=null,loading=true,prepared=false,liveAt=0,metrics={active:0,hidden:0,calls:0,triangles:0},frames=[];
  let exercise=ui.exercise?.value||'attack_technique';
  let wide=new URLSearchParams(location.search).get('view')==='wide';
  function setView(value){wide=!!value;camera.position.set(wide?0:3,wide?11:2.5,wide?15:4.2);camera.lookAt(0,wide?0:1,-.5);camera.updateMatrixWorld();ui.view.textContent=wide?'Yakın görünüm':'Genel görünüm';resize();}
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);}
  const observer=new ResizeObserver(resize);observer.observe(canvas);setView(wide);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;lock(true);ui.live.textContent='Grafik görünümü durdu';ui.measurement.textContent='Grafik görünümü durdu. Sayfayı yenileyip yeniden dene.';},{once:true});
  const lock=value=>{for(const el of [ui.train,ui.view,ui.count,ui.smart,ui.compare,ui.exercise].filter(Boolean))el.disabled=value||!prepared||lost;};
  function state(i){return{id:200+i,type:'murmillo',team:0,x:i===0?-.75:i===1?.75:(i%7-3)*2.2,z:i<2?2.2:4.4-Math.floor(i/7)*2.5,angle:i===0?Math.PI/2:-Math.PI/2,hp:100,maxHp:100,action:'idle',timer:0,duration:.65,walk:0,move:0,blocking:false,guardFlash:0,reaction:0,flash:0,deadTime:0,shieldHeldBy:null,weapon:'gladius',offhand:null,leftGear:null,shield:false,shieldStyle:'murmillo',helmet:false,chest:false,greaves:true,shoulders:false,netBusy:false,attackKind:'light',attackRegion:'chest',chain:1};}
  function practiceOrigin(i){const mode=LudusTraining.definitions[exercise].mode,role=i%2;
   if(i<2)return mode==='post'?{x:-1.10,z:-.4+i*2.2,angle:Math.PI/2}:{x:(role?1:-1)*(['carry','squat','reflex'].includes(mode)?1.15:.75),z:-.4};
   if(mode==='pair'){const pair=Math.floor(i/2)-1;return{x:(pair%5-2)*3.2+(role?.75:-.75),z:3-Math.floor(pair/5)*2.6};}
   return{x:(i%7-3)*2.2-(mode==='post'?.35:0),z:4.4-Math.floor(i/7)*2.5,angle:mode==='post'?Math.PI/2:0};
  }
  function pose(g,time,dt){
   if(ui.exercise&&training){if(g.bag)g.bag.userData.swing.rotation.x=Math.sin(clock/3.6*Math.PI*2)*.58;const i=g.index,mode=LudusTraining.definitions[exercise].mode,origin=practiceOrigin(i);
    LudusTraining.pose(g.state,exercise,clock+(i<2?0:Math.floor(i/2)*.37),i%2,origin);ImportedGladiator.animate(g.state,g.model,time,dt);g.model.teamMark.visible=false;g.model.trail.visible=false;return;
   }
   if(ui.exercise)LudusTraining.pose(g.state,'attack_technique',1.5,0,{x:g.index===0?-.75:g.index===1?.75:(g.index%7-3)*2.2,z:g.index<2?2.2:4.4-Math.floor(g.index/7)*2.5});
const f=g.state;f.action='idle';f.trainingGuard=false;f.move=0;f.blocking=false;
   if(g.index<2){const approach=measuring?1:training?Math.min(1,clock/1.6):0;f.z=2.2-approach*2.6;f.x=g.index===0?-.75:.75;f.angle=g.index===0?Math.PI/2:-Math.PI/2;
    if(training&&approach<1){f.move=1;f.walk+=dt*7;f.angle=Math.PI;}
    else if(training){const phase=(clock-1.6)%4.6,turn=phase<2.3?0:1,p=phase%2.3;
     if(g.index===turn&&p<.72){f.action='attack';f.timer=p;f.duration=.72;f.x+=(g.index===0?1:-1)*Math.sin(p/.72*Math.PI)*.08;}
     else if(g.index!==turn&&p<.92)f.trainingGuard=true;
    }
   }
   ImportedGladiator.animate(f,g.model,time,dt);g.model.teamMark.visible=false;g.model.trail.visible=false;
  }
  function visible(g){sphere.center.set(g.state.x,1,g.state.z);return frustum.intersectsSphere(sphere);}
  function draw(now){if(disposed)return;raf=requestAnimationFrame(draw);if(document.hidden||lost){last=0;return;}const elapsed=last?now-last:0,dt=Math.min(.06,elapsed/1000||1/60);last=now;if(training)clock+=dt;
   const before=performance.now();let active=0,hidden=0;
   for(const g of pool){if(g.index>=count){g.model.root.visible=false;continue;}const show=!smart||visible(g);g.model.root.visible=show;if(show){pose(g,now/1000,dt);active++;}else hidden++;}
   const animationMs=performance.now()-before;renderer.render(scene,camera);const submitMs=performance.now()-before;
   metrics={active,hidden,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,animationMs,submitMs};
   if(collect&&elapsed>0)collect.push({interval:elapsed,animationMs,submitMs});
   if(elapsed>0){frames.push(elapsed);if(frames.length>90)frames.shift();}
   if(now>liveAt){const fps=frames.length?1000/(frames.reduce((a,b)=>a+b,0)/frames.length):0;ui.live.textContent=(training?(ui.exercise?LudusTraining.definitions[exercise].name:'Eşli antrenman'):'Avluda bekleme')+' · '+fps.toFixed(0)+' FPS · '+active+' hareketli / '+hidden+' kamera dışında';liveAt=now+700;}
  }
  function setTraining(value){training=!!value;clock=0;ui.train.textContent=training?'Antrenmanı durdur':'Antrenmana başla';}
  async function setCount(value){loading=true;lock(true);count=Math.min(30,Math.max(2,Number(value)||2));ui.count.value=String(count);
   ui.report.replaceChildren();while(pool.length<count){const i=pool.length,model=ImportedGladiator.create(200+i,'murmillo'),f=state(i);model.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});ImportedGladiator.animate(f,model,0,1);model.teamMark.visible=false;model.trail.visible=false;
    // Replace the cached metal weapon once. Subsequent syncs keep the same anchor.
    model.weaponAnchor.clear();const rudis=props.rudis();rudis.rotation.set(0,0,0);model.weaponAnchor.add(rudis);scene.add(model.root);pool.push({index:i,state:f,model});
    if(pool.length%3===0){ui.measurement.textContent=pool.length+' gladyatör hazırlanıyor…';await new Promise(resolve=>requestAnimationFrame(resolve));}
   }
   if(ui.exercise)setExercise(exercise);loading=false;lock(measuring);ui.measurement.textContent=count+' gladyatör hazır · Antrenmanı başlat veya akıcılığı ölç.';return count;
  }
  function setExercise(value){if(!LudusTraining.definitions[value])throw Error('Antrenman bulunamadı.');exercise=value;if(ui.exercise)ui.exercise.value=value;clock=0;for(const g of pool){g.beam?.removeFromParent();g.bag?.removeFromParent();delete g.model.trainingFloor;g.state=LudusTraining.practiceState(state(g.index),exercise);g.model.equippedWeapon=undefined;g.beam=LudusTraining.equip(g.model,g.state,exercise,props,ImportedGladiator.animate);g.bag=exercise==='reflex'?props.bag():null;if(g.bag){const at=practiceOrigin(g.index);g.bag.position.set(at.x,0,at.z+.76);scene.add(g.bag);}}props.setPosts(exercise==='speed'?pool.slice(0,count).map((g,i)=>{const at=practiceOrigin(i);return{x:at.x+1.20,z:at.z,angle:Math.PI/2};}):[]);ui.report.replaceChildren();return exercise;}
  function summary(samples){const values=samples.map(s=>s.interval).sort((a,b)=>a-b),mean=values.reduce((a,b)=>a+b,0)/values.length,p95=values[Math.min(values.length-1,Math.floor(values.length*.95))];return {samples:values.length,fps:1000/mean,frameMs:mean,p95Ms:p95,over50:values.filter(v=>v>50).length,animationMs:samples.reduce((a,s)=>a+s.animationMs,0)/values.length,submitMs:samples.reduce((a,s)=>a+s.submitMs,0)/values.length};}
  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  async function measure(options={}){if(measuring||loading||!prepared||lost)throw Error('Sahne henüz hazır değil.');measuring=true;lock(true);const saved=training,groups={idle:[],training:[]},warm=options.warmMs??1000,duration=options.sampleMs??3500;
   ui.report.replaceChildren();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const viewport=[canvas.clientWidth,canvas.clientHeight];let interrupted=false;
   const onVisibility=()=>{if(document.hidden)interrupted=true;};document.addEventListener('visibilitychange',onVisibility);const onLost=()=>{interrupted=true;};canvas.addEventListener('webglcontextlost',onLost);
   try{for(const [index,mode]of ['idle','training','training','idle'].entries()){
     setTraining(mode==='training');if(training)clock=1.6;ui.measurement.textContent='Ölçüm '+(index+1)+'/4 · '+(mode==='training'?(ui.exercise?LudusTraining.definitions[exercise].name:'Tahta kılıçla çalışma'):'Avluda bekleme')+' · Bu sayfayı açık tut.';await delay(warm);if(interrupted)throw Error('Ölçüm kesildi; sayfayı açık tutarak yeniden dene.');const samples=[];collect=samples;await delay(duration);collect=null;if(interrupted||!samples.length)throw Error('Ölçüm kesildi; yeniden dene.');if(canvas.clientWidth!==viewport[0]||canvas.clientHeight!==viewport[1])throw Error('Ekran boyutu değişti. Ölçümü yeniden başlat.');groups[mode].push(...samples);
    }
    const result={count,smart,viewport:{width:canvas.clientWidth,height:canvas.clientHeight,dpr:renderer.getPixelRatio()},idle:summary(groups.idle),training:summary(groups.training),metrics:{...metrics},userAgent:navigator.userAgent};result.changeMs=result.training.frameMs-result.idle.frameMs;result.animationChangeMs=result.training.animationMs-result.idle.animationMs;
    for(const [key,name]of [['idle','Bekleme'],['training',ui.exercise?LudusTraining.definitions[exercise].name:'Eşli antrenman']]){const panel=document.createElement('div');panel.className='result';for(const [label,value]of [[name,result[key].fps.toFixed(1)+' FPS'],['Yavaş kareler',result[key].over50+' / '+result[key].samples]]){const a=document.createElement('span'),b=document.createElement('b');a.textContent=label;b.textContent=value;panel.append(a,b);}ui.report.append(panel);}
    ui.measurement.textContent='Tamamlandı · '+count+' gladyatör · Antrenmanda ortalama kare süresi '+(result.changeMs>=0?'+':'')+result.changeMs.toFixed(2)+' ms değişti.';current.lastResult=result;return result;
   }finally{collect=null;document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('webglcontextlost',onLost);measuring=false;setTraining(saved);lock(false);}
  }
  function profileAnimation(iterations=16){const modes=[];for(const enabled of [true,false]){const before=performance.now();let poses=0;for(let n=0;n<iterations;n++)for(const g of pool){if(g.index<count&&(!enabled||visible(g))){pose(g,performance.now()/1000,1/60);poses++;}}modes.push({smart:enabled,poses,msPerFrame:(performance.now()-before)/iterations});}return{count,iterations,modes};}
  current={world,pool,props,seek(value){clock=Math.max(0,Number(value)||0);},setCount,setTraining,setView,setExercise,get exercise(){return exercise;},setSmart(value){smart=!!value;ui.smart.checked=smart;},measure,profileAnimation,get metrics(){return metrics;},get ready(){return prepared&&!loading&&!lost;},get training(){return training;},lastResult:null,dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();for(const g of pool)ImportedGladiator.dispose(g.model);props.dispose();world.city?.dispose?.();renderer.dispose();}};root.TrainingTest.current=current;
  if(ui.exercise)ui.exercise.onchange=()=>setExercise(ui.exercise.value);
  ui.train.onclick=()=>setTraining(!training);ui.view.onclick=()=>{setView(!wide);ui.report.replaceChildren();};ui.count.onchange=()=>setCount(ui.count.value).catch(fail);ui.smart.onchange=()=>{smart=ui.smart.checked;ui.report.replaceChildren();};ui.compare.onclick=()=>measure().catch(fail);
  raf=requestAnimationFrame(draw);ui.loading.textContent='Gerçek gladyatör yükleniyor…';await ImportedGladiator.load(text=>ui.loading.textContent=text);await setCount(count);await Promise.allSettled([...world.ready,RomanVisualAssets.ready()]);prepared=true;ui.loading.hidden=true;ui.measurement.textContent='Antrenmanı başlat; ardından aynı sahnede akıcılığı ölç.';lock(false);root.dispatchEvent(new Event('training-test-ready'));
 }
 function fail(error){ui.loading.hidden=true;ui.measurement.textContent=error.message;ui.live.textContent='Deneme tamamlanamadı';console.error(error);}
 root.TrainingTest={start,current:null};boot().catch(fail);
})(globalThis);
