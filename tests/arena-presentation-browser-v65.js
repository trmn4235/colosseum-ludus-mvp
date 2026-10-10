/* Self-running companion for the approved cloud browser when a second Chromium
 * cannot be launched by the local sandbox. Loaded only by the QA fixture server. */
(async()=>{
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const report={rendererKind:'Supported cloud Chromium; actual WebGL renderer reported below',errors:[],snapshots:[],continuity:{},alignment:{},layouts:[]};
 addEventListener('error',e=>report.errors.push(e.message));
 function assert(ok,message){if(!ok)throw Error(message);}
 const stat=xs=>{const a=xs.slice().sort((a,b)=>a-b);return {count:a.length,mean:a.reduce((s,x)=>s+x,0)/Math.max(1,a.length),p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]||0,max:a.at(-1)||0,min:a[0]||0};};
 const delta=(samples,key)=>stat(samples.slice(1).map((s,i)=>Math.hypot(...s[key].map((v,k)=>v-samples[i][key][k]))));
 async function resizeTo(width,height){await new Promise(resolve=>{function done(e){if(e.data?.type==='qa-sized'){removeEventListener('message',done);resolve();}}addEventListener('message',done);parent.postMessage({type:'qa-size',width,height},location.origin);});__arena.resize();}
 try{
  for(let n=0;n<1200&&!(window.__arena?.models.length===20&&document.getElementById('intro').hidden);n++)await sleep(100);
  assert(window.__arena?.models.length===20,'20 real models ready');window.__qaManual=true;await sleep(150);
  const q=__arena,c=q.combat,f=c.fighters[0],m=q.models[0],dt=1/60,gl=q.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  report.noGPU=!!window.__qaNoGPU;report.renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);report.bones=Object.keys(m.bones).length;report.models=q.models.length;
  for(const model of q.models)model.root.visible=false;m.root.visible=true;
  Object.assign(f,{x:0,z:0,angle:0,hp:120,maxHp:120,stamina:100,action:'idle',timer:0,move:0,walk:0,weapon:'gladius',offhand:null,shield:true,shieldHeldBy:null,guardFlash:0,reaction:0,flash:0,absoluteBlockUntil:0,blocking:false,nettedUntil:0,cooldown:0});
  q.camera.position.set(3.5,2.7,5.4);q.camera.lookAt(0,1.1,0);q.camera.updateMatrixWorld();
  for(const id of ['hud','controls','enemyLabels','toast'])document.getElementById(id).style.visibility='hidden';q.renderer.shadowMap.enabled=false;
  const step=()=>{c.time+=dt;q.animateCharacter(f,m,c.time,dt);m.root.updateMatrixWorld(true);};
  const measure=()=>{
   const pos=o=>o.getWorldPosition(new THREE.Vector3()).toArray(),sample=f.action==='attack'?ArenaMotion.sample(f):null,anchor=f.attackLeft?m.offhandAnchor:m.weaponAnchor;
   const dir=new THREE.Vector3(0,1,0).applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion())),expected=sample?new THREE.Vector3(sample.dir.x,sample.dir.y,sample.dir.z).applyQuaternion(m.root.getWorldQuaternion(new THREE.Quaternion())):null;
   return {time:c.time,timer:f.timer,root:pos(m.root),leftHand:pos(m.bones.LeftHand),rightHand:pos(m.bones.RightHand),leftFoot:pos(m.bones.LeftFoot),rightFoot:pos(m.bones.RightFoot),shield:pos(m.gear.shield.anchor),weapon:pos(anchor),active:sample?.active||false,bladeAngle:expected?dir.angleTo(expected):null,gripOffset:sample?anchor.getWorldPosition(new THREE.Vector3()).distanceTo((f.attackLeft?m.bones.LeftHand:m.bones.RightHand).getWorldPosition(new THREE.Vector3())):null};
  };
  const snap=name=>{if(window.__qaNoGPU)return;q.camera.position.set(3.5,2.7,5.4+f.z);q.camera.lookAt(0,1.1,f.z);q.renderer.render(q.scene,q.camera);report.snapshots.push({name,data:q.renderer.domElement.toDataURL('image/png')});};
  for(let i=0;i<90;i++)step();snap('idle');
  const segments={};
  for(const [name,speed,count,block] of [['walk',1.45,60,false],['run',3.7,60,false],['stop',0,30,false],['guardWalk',1.45,60,true],['guardStrafe',1.45,60,true]]){
   const samples=[measure()];f.blocking=block;f.guardRegion=block?'head':null;
   for(let i=0;i<count;i++){f.move=speed?1:0;if(name==='guardStrafe')f.x+=speed*dt;else f.z+=speed*dt;f.walk+=speed*dt*4;step();samples.push(measure());if(['walk','run'].includes(name)&&[23,32].includes(i))snap(name+(i===23?'-contact':'-passing'));}segments[name]=samples;
  }
  Object.assign(f,{x:0,z:0,move:0,blocking:false,guardRegion:null});for(let i=0;i<90;i++)step();
  segments.guardEnter=[measure()];f.blocking=true;f.guardRegion='head';for(let i=0;i<18;i++){step();segments.guardEnter.push(measure());}snap('guard-head');
  segments.guardRelease=[measure()];f.blocking=false;f.guardRegion=null;for(let i=0;i<24;i++){step();segments.guardRelease.push(measure());}
  for(const [name,samples]of Object.entries(segments))report.continuity[name]=Object.fromEntries(['root','leftHand','rightHand','leftFoot','rightFoot','shield'].map(key=>[key,delta(samples,key)]));
  report.rawMotion=segments;
  for(const region of ['chest','head','leftLeg']){
   Object.assign(f,{action:'idle',move:0,blocking:false,guardRegion:null});for(let i=0;i<60;i++)step();
   Object.assign(f,{action:'attack',timer:0,attackWeapon:'gladius',attackKind:'light',attackLeft:false,attackRegion:region,attackProfile:ArenaMotion.profile('gladius',false,false),chain:1});f.duration=f.attackProfile.duration;
   const samples=[];for(let i=0;i<=Math.ceil(f.duration*60);i++){f.timer=Math.min(f.duration,i/60);step();samples.push(measure());if(region==='chest'){const target={11:'strike-windup',23:'strike-contact',38:'strike-recovery'}[i];if(target)snap(target);}}
   const active=samples.filter(s=>s.active);assert(active.length>0,'active strike '+region);
   report.alignment[region]={bladeActiveAngleRadians:stat(active.map(s=>s.bladeAngle)),gripOffsetMetres:stat(samples.map(s=>s.gripOffset)),leftFoot:delta(samples,'leftFoot'),rightFoot:delta(samples,'rightFoot')};
   assert(report.alignment[region].bladeActiveAngleRadians.max<1e-5,'active blade matches collision sample '+region);assert(report.alignment[region].gripOffsetMetres.max<1e-5,'blade remains attached to hand '+region);
   (report.rawAttack??={})[region]=samples;
  }
  Object.assign(f,{action:'idle',move:1,blocking:false});const cpu=[];
  for(let batch=0;batch<16;batch++){const start=performance.now();for(let i=0;i<60;i++){f.z+=2/60;f.walk+=2/60*4;step();}if(batch>2)cpu.push((performance.now()-start)/60);}report.animationCpuMsPerPose=stat(cpu);
  // Use the unchanged in-game 60Hz input state with twenty real rigs. Both builds
  // receive the same stationary fixture, camera, quality, size and pose work.
  c.finished=false;c.time=12;q.accumulator=0;c.fighters.forEach((v,i)=>{const a=i*Math.PI*2/20;Object.assign(v,{hp:120,maxHp:120,x:Math.sin(a)*5,z:Math.cos(a)*5,angle:a+Math.PI,action:'idle',move:.6,walk:i*.4,cooldown:999,blocking:false,reaction:0,guardFlash:0});q.models[i].root.visible=true;});f.x=f.z=0;
  const tick=c.tick;c.tick=function(d){this.time+=d;for(const v of this.fighters)v.walk+=d*3;};q.clearInput();q.setPaused(false);q.perfMeter.reset();q.last=performance.now();window.__qaManual=false;requestAnimationFrame(q.frame);await sleep(8000);window.__qaManual=true;await sleep(150);report.frameTiming=q.perfMeter.snapshot();c.tick=tick;
  for(const id of ['hud','controls','enemyLabels'])document.getElementById(id).style.visibility='';
  for(const [width,height]of [[667,375],[844,390],[932,430],[740,320],[1366,768]]){
   await resizeTo(width,height);const layout={width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,bodyHeight:document.body.scrollHeight,boxes:[...document.querySelectorAll('.body-target,#attack,#block,#dodge,#special')].map(e=>{const b=e.getBoundingClientRect();return{id:e.id||e.dataset.region,x:b.x,y:b.y,w:b.width,h:b.height};})};
   assert(layout.scrollHeight<=height+1&&layout.bodyHeight<=height+1,'no vertical scroll '+width);assert(layout.scrollWidth<=width+1,'no horizontal scroll '+width);
   for(const b of layout.boxes)assert(b.x>=-1&&b.y>=-1&&b.x+b.w<=width+1&&b.y+b.h<=height+1,'control visible '+b.id+'/'+width);
   for(let i=0;i<layout.boxes.length;i++)for(let j=i+1;j<layout.boxes.length;j++){const a=layout.boxes[i],b=layout.boxes[j];assert(a.x+a.w<=b.x+1||b.x+b.w<=a.x+1||a.y+a.h<=b.y+1||b.y+b.h<=a.y+1,'controls overlap '+a.id+'/'+b.id);}
   report.layouts.push(layout);
  }
  await resizeTo(844,390);
  q.joy={x:1,y:0};q.setPaused(true);const input=q.worldInput(),before=c.time;q.last=performance.now();q.frame(performance.now()+17);const stopped=c.time===before;q.setPaused(false);report.pause={stopped,cleared:input.x===0&&input.z===0&&!input.block,resumed:q.active()};assert(stopped&&report.pause.cleared&&report.pause.resumed,'pause resumes with input clear');
  report.repeatedInput='Requires external pointer runner; synthetic events are not claimed as physical pointer coverage.';
  report.limitations=(window.__qaNoGPU?'NO GPU: renderer is a QA-only matrix-update stub. Real GLB meshes, skeletons, materials and animation loaded. No rendered screenshots, GPU timings or full-frame performance claim. ':'')+'CPU/JS timing is not GPU timing or physical-device FPS. Loaded assets, continuity, strike alignment and DOM viewport tests are automated; naturalness remains a visual judgment. Frame fixture holds identical world positions for comparison.';
  report.resourceAudit={external:performance.getEntriesByType('resource').map(r=>r.name).filter(u=>/^https?:/.test(u)&&new URL(u).origin!==location.origin),glbCount:performance.getEntriesByType('resource').filter(r=>/\.glb(?:\?|$)/.test(r.name)).length};assert(report.resourceAudit.external.length===0,'no external asset requests');assert(report.errors.length===0,'no page exceptions');report.pass=true;
 }catch(e){report.pass=false;report.error=e.stack||e.message;}
 parent.postMessage({type:'qa-result',report},location.origin);
})();
