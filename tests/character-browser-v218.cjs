/* Textured throw-release checks in the real arena renderer.
 * Simulation time and inventory remain authoritative; browser images are not
 * physical-device performance measurements. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

module.exports=async(page,out)=>{
 fs.mkdirSync(out,{recursive:true});
 const viewport=page.viewportSize();
 const rendererState=await page.evaluate(()=>({pixelRatio:__arena.renderer.getPixelRatio(),size:__arena.renderer.getSize(new THREE.Vector2()).toArray()}));
 let result;
 try{
  await page.setViewportSize({width:480,height:600});
  result=await page.evaluate(()=>{
   const check=(ok,message)=>{if(!ok)throw Error(message);};
   const T=THREE,api=__arena,renderer=api.renderer,shots=[],cases=[];
   check(typeof ArenaAnatomy.pendingThrow==='function'&&typeof ArenaAnatomy.throwPose==='function','V218 visual adapter loaded');
   const stable=f=>JSON.stringify([f.weapon,f.offhand,f.hp,f.stamina,f.action,f.timer,f.skillReady,f.equipment]);
   const meshes=anchor=>{let count=0;anchor.traverseVisible(o=>{if(o.isMesh)count++;});return count;};
   // angleTo assumes unit quaternions. The unchanged source rest rotation can
   // differ in length by 5e-11, giving a false angle even for identical values.
   const fingers=(m,left)=>[1,2,3].map(i=>m.bones[(left?'Left':'Right')+'HandIndex'+i].quaternion.clone().normalize());
   const fingerGap=(m,left,closed)=>Math.max(...fingers(m,left).map((q,i)=>q.angleTo(closed[i])));
   const quiet=(combat,f,target)=>{
    for(const other of combat.fighters)if(other!==f)Object.assign(other,{x:40+other.id*3,z:40,stunUntil:100,action:'idle',blocking:false});
    Object.assign(target,{x:f.x,z:f.z+3,hp:10000,maxHp:10000,stunUntil:100});
    f.target=target.id;combat.lockedTarget=target.id;
   };
   let integrationCases=0,lateModelChecks=0,maxFingerDifference=0,maxPalmGap=0,textureImages=0;

   // Exercise the production scheduler and projectile renderer, including a
   // release frame that would otherwise be skipped by a distant actor's budget.
   const combat=api.combat,savedCombat={...combat};
   try{
    for(const left of [false,true])for(const distance of [2,12]){
     combat.reset('normal','murmillo');
     const f=combat.fighters[1],target=combat.fighters.find(other=>other.id!==0&&other.team!==f.team);
     Object.assign(f,{x:distance,z:0,angle:0,hp:100,weapon:'spear',offhand:'trident',shield:false,leftGear:null,pickupHand:left?'offhand':'weapon',action:'idle',timer:0,move:0,walk:0,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,stunUntil:0,skillReady:[0,0]});
     quiet(combat,f,target);Object.assign(combat.fighters[0],{x:0,z:0,stunUntil:100});
     check(Math.hypot(f.x-combat.fighters[0].x,f.z-combat.fighters[0].z)===distance,'requested scheduler distance');
     const m=ImportedGladiator.create(f.id,f.type),anchor=left?m.offhandAnchor:m.weaponAnchor,other=left?m.weaponAnchor:m.offhandAnchor;
     m.root.visible=true;
     try{
      api.animateCharacter(f,m,combat.time,1/30);
      const closed=fingers(m,left),otherMeshes=meshes(other);
      check(combat.special(f.id,left?1:0),'production throw starts '+left+':'+distance);
      check(combat.projectiles.length===1,'exactly one queued projectile');
      const n=combat.projectiles[0],beforeChildren=new Set(api.scene.children);
      api.animateCharacter(f,m,combat.time,1/120);api.renderWeapons();
      const projectile=api.scene.children.find(o=>!beforeChildren.has(o));
      check(projectile,'production projectile mesh exists');
      check(!projectile.visible&&meshes(anchor)>0,'wind-up has held mesh only');
      for(let frame=0;frame<16;frame++){
       combat.tick(1/60,{});api.animateCharacter(f,m,combat.time,1/60);api.renderWeapons();
       check(!n.launched&&meshes(anchor)>0&&!projectile.visible,'production pre-release visibility '+frame);
      }
      const gap=fingerGap(m,left,closed);maxFingerDifference=Math.max(maxFingerDifference,gap);check(gap<1e-6,'production fingers stay closed before release');
      check(meshes(other)===otherMeshes,'other hand remains equipped before release');
      // Preserve an interpolated visual timer from before release, while the
      // actual projectile crosses its launch boundary in this simulation tick.
      const stale={...f,timer:f.timer};combat.tick(1/60,{});
      check(n.launched,'actual projectile launched');
      m.poseBudget=0;m.poseDelta=0;
      api.animateCharacter(stale,m,combat.time,1/120);api.renderWeapons();
      check(meshes(anchor)===0&&projectile.visible,'release bypasses pose throttling and stale visual timer');
      check(meshes(other)===otherMeshes,'other hand remains equipped after release');
      integrationCases++;
     }finally{
      combat.projectiles=[];api.renderWeapons();ImportedGladiator.dispose(m);
     }
    }
   }finally{Object.assign(combat,savedCombat);}

   const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,.8,.01,30),palm=new T.Vector3(),scale=new T.Vector3();
   renderer.setPixelRatio(1);renderer.setSize(480,600,false);scene.background=new T.Color('#ece9e1');
   scene.add(new T.HemisphereLight(0xffffff,0x766c60,2.5));
   const key=new T.DirectionalLight(0xfff3e5,3);key.position.set(-3,5,4);scene.add(key);
   const fill=new T.DirectionalLight(0xe2eaff,.8);fill.position.set(4,2,-3);scene.add(fill);
   for(const type of Object.keys(ArenaClasses)){
    const sim=new ArenaCombat(()=>.999).reset('normal',type),f=sim.fighters[0],target=sim.fighters.find(other=>other.team!==f.team),m=ImportedGladiator.create(218,type);
    const kind=['spear','trident','trident_gladiator'].includes(f.weapon)?f.weapon:'spear';
    Object.assign(f,{x:0,z:0,angle:0,hp:100,weapon:kind,action:'idle',timer:0,move:0,walk:0,motionVersion:163,blocking:false,absoluteBlockUntil:0,shieldHeldBy:null,reaction:0,guardFlash:0,passiveEvade:0,skillReady:[0,0]});
    quiet(sim,f,target);scene.add(m.root);
    try{
     for(let frame=0;frame<30;frame++)ImportedGladiator.animate(f,m,frame/60,1/60);
     const closed=fingers(m,false),shield=!!f.shield,leftGear=!!f.leftGear,offhandMeshes=meshes(m.offhandAnchor);
     check(sim.special(0,0),type+' actual throw starts');
     const n=sim.projectiles[0];check(n&&f.weapon===null,type+' real inventory removes thrown weapon');
     for(let frame=0;frame<=17;frame++){
      if(frame)sim.tick(1/60,{});
      const held=ArenaAnatomy.pendingThrow(f,sim.projectiles),before=stable(f),visual=ArenaAnatomy.throwPose(f,held);
      ImportedGladiator.animate(visual,m,sim.time,1/60);
      check(stable(f)===before,type+' visual adapter does not mutate combat');
      check((meshes(m.weaponAnchor)>0)===!n.launched,type+' held visibility agrees with launch '+frame);
      if(frame!==16&&frame!==17)continue;
      const phase=n.launched?'released':'windup';
      if(!n.launched){
       const gap=fingerGap(m,false,closed);maxFingerDifference=Math.max(maxFingerDifference,gap);check(gap<1e-6,type+' fingers remain closed');
       // Loading/unculling in the middle of a cast must not require a cached
       // previously equipped model to recover the correct thrown weapon.
       const late=ImportedGladiator.create(218,type);
       try{ImportedGladiator.animate(visual,late,sim.time,1/60);check(meshes(late.weaponAnchor)>0&&late.equippedWeapon===kind,type+' late first pose retains throwing weapon');lateModelChecks++;}
       finally{ImportedGladiator.dispose(late);}
      }
      check(m.gear.shield.group.visible===shield,type+' shield unchanged');
      check(m.gear.left.group.visible===leftGear,type+' class left attachment unchanged');
      check(meshes(m.offhandAnchor)===offhandMeshes,type+' offhand unchanged');
      m.teamMark.visible=false;m.root.updateMatrixWorld(true);
      for(const [name,bone]of m.boneEntries)check(bone.matrixWorld.elements.every(Number.isFinite),type+' invalid bone '+name);
      const hand=m.bones.RightHand;hand.localToWorld(palm.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));
      if(!n.launched&&m.grip166?.Right?.active){const gap=palm.distanceTo(m.grip166.Right.target);maxPalmGap=Math.max(maxPalmGap,gap);check(gap<.005,type+' palm contact '+gap);}
      let decoded=0;
      m.visual.traverseVisible(o=>{if(!o.isSkinnedMesh||o.userData.wornEquipment164)return;for(const material of Array.isArray(o.material)?o.material:[o.material])if(material.map){check(material.map.image?.width>0&&material.map.image?.height>0,type+' body texture decoded');decoded++;}});
      check(decoded>0,type+' real body texture required');textureImages+=decoded;
      for(const view of ['full','hand']){
       if(view==='full'){camera.position.set(-1.1,1.45,4.8);camera.lookAt(0,1.15,0);}
       else{camera.position.copy(palm).add(new T.Vector3(-.45,.2,.72));camera.lookAt(palm);}
       renderer.render(scene,camera);shots.push({name:type+'-'+phase+'-'+view,type,phase,view,data:renderer.domElement.toDataURL('image/png').split(',')[1]});
      }
      cases.push({type,kind,phase,age:n.age,launched:n.launched,heldMeshes:meshes(m.weaponAnchor),decodedTextures:decoded});
     }
    }finally{ImportedGladiator.dispose(m);m.root.removeFromParent();}
   }
   return {shots,cases,integrationCases,lateModelChecks,maxFingerDifference,maxPalmGap,textureImages,classes:Object.keys(ArenaClasses).length};
  });
 }finally{
  await page.setViewportSize(viewport);
  await page.evaluate(state=>{__arena.renderer.setPixelRatio(state.pixelRatio);__arena.renderer.setSize(...state.size,false);__arena.renderer.render(__arena.scene,__arena.camera);},rendererState);
 }
 const sharp=require('sharp'),occupancy=[];
 for(const shot of result.shots){
  const bytes=Buffer.from(shot.data,'base64');fs.writeFileSync(path.join(out,shot.name+'.png'),bytes);
  const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});let occupied=0;
  for(let i=0;i<data.length;i+=info.channels)if(Math.abs(data[i]-236)+Math.abs(data[i+1]-233)+Math.abs(data[i+2]-225)>24)occupied++;
  const occupiedFraction=occupied/(info.width*info.height);assert.ok(occupiedFraction>.01,'empty rendered view '+shot.name);occupancy.push({name:shot.name,occupiedFraction});
 }
 assert.equal(result.shots.length,result.classes*4,'two phases and two views per class');
 assert.equal(result.integrationCases,4,'both hands near and distant release boundaries');
 assert.equal(result.lateModelChecks,result.classes,'late first pose for every class');
 // Four columns per class: wind-up/full, wind-up/hand, released/full, released/hand.
 const tiles=[];
 for(let i=0;i<result.shots.length;i++){
  const shot=result.shots[i],left=i%4*240,top=Math.floor(i/4)*324;
  tiles.push({input:await sharp(Buffer.from(shot.data,'base64')).resize(240,300).toBuffer(),left,top});
  tiles.push({input:Buffer.from(`<svg width="240" height="24"><rect width="240" height="24" fill="#f4f1eb"/><text x="5" y="17" font-family="sans-serif" font-size="11" fill="#4d202b">${shot.name}</text></svg>`),left,top:top+300});
 }
 await sharp({create:{width:960,height:result.classes*324,channels:3,background:'#f4f1eb'}}).composite(tiles).png().toFile(path.join(out,'throw-contact-sheet-v218.png'));
 const summary={classes:result.classes,renderedViews:result.shots.length,integrationCases:result.integrationCases,lateModelChecks:result.lateModelChecks,maxFingerDifference:result.maxFingerDifference,maxPalmGap:result.maxPalmGap,textureImages:result.textureImages,cases:result.cases,occupancy,note:'Real browser textures and production release scheduler. Software rendering does not measure physical iPhone FPS.'};
 fs.writeFileSync(path.join(out,'throw-browser-v218.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({characterV218:{...summary,cases:undefined,occupancy:undefined},out}));
};
