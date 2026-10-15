/* Runs inside the existing real-asset browser fixture, before bridge/jump regression. */
const assert=require('node:assert/strict');
module.exports=async function exerciseRallyRope(page,out,perspective){
 await page.evaluate(()=>{
  const a=__arena,n=a.naval;window.__ropeOriginal={goal:n.goal,botStep:n.botStep};
  window.__ropeSetup=()=>{
   n.manual=false;n.rally=false;n.bridges=[];n.goal=s=>({...s});n.botStep=()=>{};
   for(const s of n.ships)Object.assign(s,{angle:0,speed:0,turn:0,vx:0,vz:0,boardingHoldUntil:0});
   Object.assign(n.ships[0],{x:0,z:0});Object.assign(n.ships[1],{x:11.4,z:0});Object.assign(n.ships[2],{x:-20,z:-15});Object.assign(n.ships[3],{x:20,z:18});
   for(const f of a.combat.fighters){Object.assign(f,{shipId:f.team===1?2:f.team,hp:f.maxHp,navBridge:null,navJump:null,navHeight:0,navJumpReady:0,navJavelin:false,stunUntil:0,knockedUntil:0,action:'idle',timer:0,stamina:f.maxStamina,move:0});Object.assign(f,NavalSimulation.world(n.ships[f.shipId],f.id%2?1:-1,f.id%5-2));}
   Object.assign(n.player(),{x:NavalSimulation.constants.ropeX,z:NavalSimulation.constants.ropeZ});a.combat.lockedTarget=null;
   a.step(1/60);a.setPaused(false);a.view.update(a.combat.time);
  };
  window.__ropeFrames=(frames,run=true)=>{const render=a.renderer.render;a.renderer.render=()=>{};try{for(let i=0;i<frames;i++)a.step(1/60,run);}finally{a.renderer.render=render;}a.renderer.render(a.scene,a.camera);};
  __ropeSetup();
 });
 assert.equal(await page.locator('#navalRope').isVisible(),true);
 assert.equal(await page.locator('#navalRope').getAttribute('aria-disabled'),'false');
 assert.equal(await page.locator('#navalJump').isVisible(),false,'the rope extends boarding beyond jump distance');
 assert.equal(await page.evaluate(()=>__arena.view.ropeLandingMark.visible),true);
 const mesh=await page.evaluate(()=>{const m=__arena.view.ropeMesh;return{instances:m.count,triangles:(m.geometry.index.count/3)*m.count};});assert.equal(mesh.instances,8);assert.ok(mesh.triangles<500);
 await page.screenshot({path:out+'/rope-ready.png'});
 const stamina=await page.evaluate(()=>__arena.naval.player().stamina);
 await page.locator('#navalRope').click();assert.equal(await page.evaluate(()=>__arena.naval.player().navJump?.kind),'rope');
 assert.equal(await page.evaluate(()=>__arena.naval.player().stamina),stamina-25);
 await page.evaluate(()=>__ropeFrames(55));
 const apex=await page.evaluate(()=>{
  const a=__arena,p=a.naval.player(),m=a.models[0],matrix=new THREE.Matrix4();a.view.ropeMesh.getMatrixAt(1,matrix);
  const end=new THREE.Vector3(0,.5,0).applyMatrix4(matrix),hands=m.bones.LeftHand.getWorldPosition(new THREE.Vector3()).add(m.bones.RightHand.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
  return{height:p.navHeight,elapsed:p.navJump.elapsed,gripError:end.distanceTo(hands),gear:[m.weaponAnchor,m.offhandAnchor,m.gear.shield?.group].filter(Boolean).map(o=>o.visible),renderHeight:m.root.position.y};
 });
 assert.ok(apex.height>2);assert.ok(apex.gripError<.001,'the visible rope ends at both animated hands');assert.ok(apex.gear.every(v=>!v),'equipment stays hidden for the entire grip');assert.ok(Math.abs(apex.height-apex.renderHeight)<1e-8);
 await page.evaluate(()=>{const a=__arena;a.camera.position.set(12,7,-8);a.camera.lookAt(5,3,4);document.getElementById('toast').style.opacity='0';a.renderer.render(a.scene,a.camera);});
 await page.screenshot({path:out+'/rope-swing.png'});
 await page.evaluate(()=>{__arena.setPaused(true);__ropeFrames(10,false);});assert.equal(await page.evaluate(()=>__arena.naval.player().navJump.elapsed),apex.elapsed);
 await page.evaluate(()=>{__arena.setPaused(false);__ropeFrames(60);});
 const landed=await page.evaluate(()=>{const a=__arena,p=a.naval.player(),m=a.models[0];return{ship:p.shipId,jump:p.navJump,height:p.navHeight,weaponVisible:m.weaponAnchor.visible,shieldVisible:m.gear.shield.group.visible,shield:!!p.shield,stowed:!!m.weaponAnchor.userData.ropeStowed};});
 assert.equal(landed.ship,1);assert.equal(landed.jump,null);assert.equal(landed.height,0);assert.equal(landed.weaponVisible,true);assert.equal(landed.shieldVisible,landed.shield);assert.equal(landed.stowed,false);
 // Keyboard boarding and eye view use the same flight and animation.
 await page.evaluate(()=>__ropeSetup());await perspective('first');await page.evaluate(()=>__arena.setPaused(false));await page.keyboard.press('KeyG');
 assert.equal(await page.evaluate(()=>__arena.naval.player().navJump?.kind),'rope');await page.evaluate(()=>__ropeFrames(55));
 assert.ok(await page.evaluate(()=>__arena.camera.position.y)>3.5);await page.screenshot({path:out+'/rope-first-person.png'});
 await page.evaluate(()=>__ropeFrames(60));await perspective('third');
 // Touch calls all four teammates; they use the actual simulation to cross water.
 await page.evaluate(()=>{__ropeSetup();const a=__arena,n=a.naval;Object.assign(n.player(),{shipId:1,x:11.4,z:2});n.botStep=(f,dt)=>{if(f.team===0)__ropeOriginal.botStep.call(n,f,dt,()=>{});};a.setPaused(false);a.view.update(a.combat.time);});
 await page.locator('#navalRally').click();assert.equal(await page.evaluate(()=>__arena.naval.rally),true);
 await page.evaluate(()=>{const a=__arena;for(let i=0;i<1800;i++)a.combat.tick(1/60,{});a.step(1/60);});
 const rally=await page.evaluate(()=>__arena.naval.rallyStatus());assert.deepEqual(rally,{active:true,total:4,near:4});
 assert.equal(await page.locator('#navalRally small').innerText(),'4/4');await page.screenshot({path:out+'/crew-rallied.png'});
 await page.evaluate(()=>__arena.setPaused(false));await page.keyboard.press('KeyT');assert.equal(await page.evaluate(()=>__arena.naval.rally),false);
 // A low-stamina or unreachable launch cannot spend energy or leave the deck.
 await page.evaluate(()=>{__ropeSetup();__arena.naval.player().stamina=24;__arena.view.update(__arena.combat.time+.2);});
 assert.equal(await page.locator('#navalRope').getAttribute('aria-disabled'),'true');await page.locator('#navalRope').click({force:true});assert.equal(await page.evaluate(()=>__arena.naval.player().navJump),null);assert.equal(await page.evaluate(()=>__arena.naval.player().stamina),24);
 await page.evaluate(()=>{__arena.naval.player().stamina=100;__arena.naval.ships[1].x=30;__arena.view.update(__arena.combat.time+.4);});
 assert.equal(await page.locator('#navalRope').getAttribute('aria-disabled'),'true');assert.equal(await page.evaluate(()=>__arena.view.ropeLandingMark.visible),false);
 const layouts=[];
 for(const [width,height] of [[667,375],[844,390],[932,430],[1024,768]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>{__ropeSetup();__arena.naval.ships[1].x=8;__arena.naval.player().navJavelin=true;__arena.view.update(__arena.combat.time+.2);});
  const overlaps=await page.evaluate(()=>{
   const ids=['navalRally','navalRope','navalJump','navalJavelin','navalHelm','navalBridge','teamScore','stick','attack','block','dodge','special','hand','target'];
   const visible=id=>{const e=document.getElementById(id),s=getComputedStyle(e);return !e.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().width;},hits=[];
   for(const id of ['navalRally','navalRope']){const a=document.getElementById(id).getBoundingClientRect();if(a.left<0||a.right>innerWidth||a.bottom>innerHeight)hits.push(id+' outside viewport');for(const other of ids){if(id===other||!visible(other))continue;const b=document.getElementById(other).getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)hits.push(id+'/'+other);}}
   return hits;
  });assert.deepEqual(overlaps,[],'new controls stay clear at '+width+'px');layouts.push({width,height,overlaps});await page.screenshot({path:out+'/rope-controls-'+width+'.png'});
 }
 await page.setViewportSize({width:844,height:390});
 await page.evaluate(()=>{__ropeSetup();Object.assign(__arena.naval,__ropeOriginal);__arena.naval.player().navJavelin=false;});
 return{mesh,apex,landed,rally,layouts};
};
