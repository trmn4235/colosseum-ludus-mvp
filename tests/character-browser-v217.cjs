/* Real-texture comparison of the V216 model and the V217 clothing reduction.
 * Both versions use exactly the same current animation/lighting code.
 * This measures image differences in a browser, not physical-device FPS.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

module.exports=async(page,out)=>{
 const root=path.resolve(process.env.LUDUS_TEST_ROOT||path.join(__dirname,'..'));
 for(const version of [214,217])assert.ok(fs.existsSync(path.join(root,`gladiator-mobile-v${version}.glb`)),'comparison model '+version);
 const html=fs.readFileSync(path.join(root,'arena.html'),'utf8');
 const graphics=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('var ImportedGladiator='))?.[1];
 assert.ok(graphics,'inline rig source');
 const ending='return {load,create,animate,dispose,get loaded(){return !!template;}};',marker=graphics.indexOf(ending);
 assert.ok(marker>=0,'rig source end');
 const source=graphics.slice(0,graphics.indexOf('})();',marker)+5),viewport=page.viewportSize();
 const rendererState=await page.evaluate(()=>({pixelRatio:__arena.renderer.getPixelRatio(),size:__arena.renderer.getSize(new THREE.Vector2()).toArray()}));
 fs.mkdirSync(out,{recursive:true});
 let result;
 try{
  await page.setViewportSize({width:480,height:600});
  result=await page.evaluate(async source=>{
   const check=(ok,message)=>{if(!ok)throw Error(message);};
   const T=THREE,renderer=__arena.renderer,scene=new T.Scene(),camera=new T.PerspectiveCamera(34,.8,.01,30),shots=[],poses=[];
   const baseline=new Map(),types=Object.keys(ArenaClasses),palm=new T.Vector3(),scale=new T.Vector3();
   let maxBoneDifference=0,maxPalmGap=0,textureImages=0;
   renderer.setPixelRatio(1);renderer.setSize(480,600,false);scene.background=new T.Color('#ece9e1');
   scene.add(new T.HemisphereLight(0xffffff,0x766c60,2.5));
   const key=new T.DirectionalLight(0xfff3e5,3);key.position.set(-3,5,4);scene.add(key);
   const fill=new T.DirectionalLight(0xe2eaff,.8);fill.position.set(4,2,-3);scene.add(fill);
   const views={
    'full-front':{position:[0,1.3,4.5],target:[0,1.04,0]},
    'lower-front':{position:[.3,.72,2.5],target:[0,.65,0]},
    'lower-side':{position:[-2.5,.72,.3],target:[0,.65,0]},
    'lower-back':{position:[.3,.72,-2.5],target:[0,.65,0]}
   };
   for(const version of [214,217]){
    const selected=`gladiator-mobile-v${version}.glb`,versionSource=source.replace(/gladiator-mobile-v\d+\.glb/g,selected);
    const paths=versionSource.match(/gladiator-mobile-v\d+\.glb/g)||[];
    check(paths.length>=2&&paths.every(file=>file===selected),'comparison must load distinct source '+version);
    const runtime=new Function(versionSource+';return {rig:ImportedGladiator,ready:typeof RomanVisualAssets!=="undefined"?RomanVisualAssets.ready():Promise.resolve()};')();
    const rig=runtime.rig;await rig.load(()=>{});await runtime.ready;
    for(const type of types)for(const pose of ['idle','guard-side','attack']){
     const m=rig.create(217,type),f=new ArenaCombat(()=>.999).reset('normal',type).fighters[0],id=type+'-'+pose;
     scene.add(m.root);
     try{
      Object.assign(f,{x:0,z:0,angle:0,hp:100,action:'idle',timer:0,move:0,walk:0,motionVersion:163,blocking:false,absoluteBlockUntil:0,shieldHeldBy:null,reaction:0,guardFlash:0,passiveEvade:0});
      let time=0;
      for(let frame=0;frame<30;frame++){time+=1/60;rig.animate(f,m,time,1/60);}
      if(pose==='guard-side')Object.assign(f,{move:1,blocking:true});
      if(pose==='attack'){
       f.attackProfile=ArenaMotion.profile(f.weapon);
       Object.assign(f,{action:'attack',attackLeft:false,attackWeapon:f.weapon,attackKind:'light',attackRegion:'chest',duration:f.attackProfile.duration});
      }
      const steps=pose==='attack'?Math.ceil(f.duration*.45*60):24;
      for(let frame=0;frame<steps;frame++){
       time+=1/60;f.timer=(frame+1)/60;
       if(f.move){f.x+=1.6/60;f.walk+=7/60;}
       rig.animate(f,m,time,1/60);
      }
      m.teamMark.visible=false;m.root.updateMatrixWorld(true);
      for(const side of ['Left','Right']){
       const grip=m.grip166?.[side];if(!grip?.active)continue;
       const hand=m.bones[side+'Hand'];hand.localToWorld(palm.set(0,.075,.025).divideScalar(hand.getWorldScale(scale).x));
       const gap=palm.distanceTo(grip.target);maxPalmGap=Math.max(maxPalmGap,gap);check(gap<.005,id+' '+side+' grip gap '+gap);
      }
      m.root.position.set(0,0,0);m.root.updateMatrixWorld(true);
      const bones=Object.fromEntries(m.boneEntries.map(([name,bone])=>[name,Array.from(bone.matrixWorld.elements)]));
      check(Object.values(bones).every(values=>values.every(Number.isFinite)),id+' invalid bone matrix');
      if(version===214)baseline.set(id,bones);
      else for(const [name,values]of Object.entries(bones)){
       const previous=baseline.get(id)?.[name];check(previous?.length===values.length,id+' missing baseline bone '+name);
       for(let i=0;i<values.length;i++)maxBoneDifference=Math.max(maxBoneDifference,Math.abs(values[i]-previous[i]));
      }
      let bodyMeshes=0,wornMeshes=0;
      // Fitted chest armour is added below the rig's bones during animation;
      // it has its own skinned meshes and is not part of the merged body.
      m.visual.traverseVisible(mesh=>{
       if(!mesh.isSkinnedMesh)return;
       if(mesh.userData.wornEquipment164){wornMeshes++;return;}
       bodyMeshes++;
       for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        if(!material.map)continue;
        check(material.map.image?.width>0&&material.map.image?.height>0,id+' body texture must decode');textureImages++;
       }
      });
      check(bodyMeshes===1,id+' must use one merged visible body');
      const names=pose==='idle'?['full-front','lower-back']:pose==='guard-side'?['lower-front','lower-side']:['lower-side','lower-back'];
      for(const view of names){
       camera.position.set(...views[view].position);camera.lookAt(...views[view].target);renderer.render(scene,camera);
       shots.push({name:version+'-'+id+'-'+view,type,pose,view,version,data:renderer.domElement.toDataURL('image/png').split(',')[1]});
      }
      poses.push({version,type,pose,bodyMeshes,wornMeshes});
     }finally{rig.dispose(m);m.root.removeFromParent();}
    }
   }
   check(maxBoneDifference<1e-6,'model reduction changed animated bone matrices '+maxBoneDifference);
   check(textureImages>0,'real decoded textures are required');
   return {shots,poses,maxBoneDifference,maxPalmGap,textureImages,classes:types.length};
  },source);
 }finally{
  await page.setViewportSize(viewport);
  await page.evaluate(state=>{__arena.renderer.setPixelRatio(state.pixelRatio);__arena.renderer.setSize(...state.size,false);__arena.renderer.render(__arena.scene,__arena.camera);},rendererState);
 }
 const sharp=require('sharp'),comparisons=[],byName=new Map(result.shots.map(shot=>[shot.name,shot]));
 for(const shot of result.shots)fs.writeFileSync(path.join(out,shot.name+'.png'),Buffer.from(shot.data,'base64'));
 for(const before of result.shots.filter(shot=>shot.version===214)){
  const next=before.name.replace(/^214-/,'217-'),after=byName.get(next);assert.ok(after,'paired render '+next);
  const a=await sharp(Buffer.from(before.data,'base64')).removeAlpha().raw().toBuffer(),b=await sharp(Buffer.from(after.data,'base64')).removeAlpha().raw().toBuffer();
  assert.equal(a.length,b.length,'equal render dimensions');
  let sum=0,changed=0,occupied=0;
  for(let i=0;i<a.length;i++){
   const delta=Math.abs(a[i]-b[i]);sum+=delta;if(delta>20)changed++;
   if(i%3===0&&Math.abs(a[i]-a[0])+Math.abs(a[i+1]-a[1])+Math.abs(a[i+2]-a[2])>24)occupied++;
  }
  const mean=sum/a.length/255,fraction=changed/a.length,occupiedFraction=occupied/(a.length/3);
  assert.ok(occupiedFraction>.05,'empty or missing character '+next);
  comparisons.push({pose:next,meanAbsolutePixelDifference:mean,changedChannelFraction:fraction,occupiedFraction});
 }
 const summary={classes:result.classes,posedModels:result.poses.length,comparisonViews:comparisons.length,textureImages:result.textureImages,maxBoneDifference:result.maxBoneDifference,maxPalmGap:result.maxPalmGap,maxPixelDifference:Math.max(...comparisons.map(row=>row.meanAbsolutePixelDifference)),maxChangedChannelFraction:Math.max(...comparisons.map(row=>row.changedChannelFraction)),limits:{meanAbsolutePixelDifference:.012,changedChannelFraction:.025},comparisons,note:'Same animation and lighting in each pair; baseline V216 uses gladiator-mobile-v214.glb. Browser images and geometry counts do not measure physical iPhone FPS.'};
 fs.writeFileSync(path.join(out,'model-comparison-v217.json'),JSON.stringify(summary,null,2)+'\n');
 // One paired sheet per pose; rows are classes, columns are V216/V217 views.
 for(const pose of ['idle','guard-side','attack']){
  const selected=result.shots.filter(shot=>shot.version===214&&shot.pose===pose),tiles=[];
  for(let i=0;i<selected.length;i++)for(let versionIndex=0;versionIndex<2;versionIndex++){
   const before=selected[i],shot=versionIndex?byName.get(before.name.replace(/^214-/,'217-')):before;
   const left=(i%2*2+versionIndex)*240,top=Math.floor(i/2)*324;
   tiles.push({input:await sharp(Buffer.from(shot.data,'base64')).resize(240,300).toBuffer(),left,top});
   const label=(versionIndex?'V217 ':'V216 ')+shot.type+' / '+shot.view;
   tiles.push({input:Buffer.from(`<svg width="240" height="24"><rect width="240" height="24" fill="#f4f1eb"/><text x="5" y="17" font-family="sans-serif" font-size="11" fill="#4d202b">${label}</text></svg>`),left,top:top+300});
  }
  await sharp({create:{width:960,height:result.classes*324,channels:3,background:'#f4f1eb'}}).composite(tiles).png().toFile(path.join(out,'comparison-'+pose+'-v217.png'));
 }
 assert.equal(comparisons.length,result.classes*3*2,'all class / pose / view pairs');
 for(const row of comparisons)assert.ok(row.meanAbsolutePixelDifference<.012&&row.changedChannelFraction<.025,'large render change '+row.pose+' '+row.meanAbsolutePixelDifference+' '+row.changedChannelFraction);
 console.log(JSON.stringify({characterV217:{...summary,comparisons:undefined},out}));
};
