const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async(page,out)=>{
 const guardSource=require('./character-guard-v214.cjs').runGuardCases.toString(),poseSource=require('./character-pose-v214.cjs').runPoseCases.toString();
 const checks=await page.evaluate(({guardSource,poseSource})=>({guards:new Function('return ('+guardSource+')(window,{rates:[30,60],directions:8})')(),poses:new Function('return ('+poseSource+')(window)')()}),{guardSource,poseSource});
 fs.writeFileSync(out+'/character-v214.json',JSON.stringify(checks,null,2));
 const html=fs.readFileSync(path.join(process.env.LUDUS_TEST_ROOT||path.resolve(__dirname,'..'),'arena.html'),'utf8');
 const graphics=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('var ImportedGladiator='))[1];
 const end=graphics.indexOf('})();',graphics.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5,viewport=page.viewportSize();
 await page.setViewportSize({width:800,height:1000});
 const shots=await page.evaluate(async source=>{
  const T=THREE,renderer=__arena.renderer,scene=new T.Scene(),camera=new T.PerspectiveCamera(34,.8,.01,30),shots=[];
  renderer.setPixelRatio(1);renderer.setSize(800,1000,false);scene.background=new T.Color('#e9e6de');scene.add(new T.HemisphereLight(0xffffff,0x766c60,2.5));const sun=new T.DirectionalLight(0xfff3e5,3);sun.position.set(-3,5,4);scene.add(sun);
  for(const version of [213,214]){
   const rig=new Function(source.replaceAll('gladiator-mobile-v214.glb','gladiator-mobile-v'+version+'.glb')+';return ImportedGladiator;')();await rig.load(()=>{});
   for(const pose of ['idle','guard-back','guard-side','attack','spear','trident']){
    const m=rig.create(214,'murmillo'),f=new ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0],weapon=['spear','trident'].includes(pose)?pose:'gladius';scene.add(m.root);
    Object.assign(f,{x:0,z:0,angle:0,hp:100,action:pose==='attack'?'attack':'idle',move:pose.startsWith('guard-')?1:0,weapon,offhand:null,shield:true,shieldStyle:'murmillo',chest:true,chestModel:'chest_plate',helmet:true,motionVersion:163,blocking:pose.startsWith('guard-'),reaction:0,guardFlash:0,attackLeft:false,attackWeapon:weapon,attackKind:'light',attackRegion:'chest',attackProfile:ArenaMotion.profile(weapon),timer:0});f.duration=f.attackProfile.duration;
    for(let n=0;n<45;n++){if(pose==='guard-back')f.z-=1.6/60;if(pose==='guard-side')f.x+=1.6/60;f.walk+=7/60;f.timer=Math.min(n/60,f.duration*.45);rig.animate(f,m,(n+1)/60,1/60);}m.teamMark.visible=false;m.root.position.set(0,0,0);m.root.updateMatrixWorld(true);
    for(const [view,x,z]of [['front',0,4.5],['side',-4.2,1.6],['back',1.5,-4.2]]){camera.position.set(x,1.25,z);camera.lookAt(0,1.05,0);renderer.render(scene,camera);shots.push({name:version+'-'+pose+'-'+view,data:renderer.domElement.toDataURL('image/png').split(',')[1]});}
    rig.dispose(m);scene.remove(m.root);
   }
  }
  renderer.render(__arena.scene,__arena.camera);return shots;
 },graphics.slice(0,end));
 for(const shot of shots)fs.writeFileSync(out+'/'+shot.name+'.png',Buffer.from(shot.data,'base64'));
 const sharp=require('sharp'),comparisons=[];
 for(const shot of shots.filter(s=>s.name.startsWith('213-'))){
  const next=shot.name.replace('213-','214-'),a=await sharp(out+'/'+shot.name+'.png').removeAlpha().raw().toBuffer(),b=await sharp(out+'/'+next+'.png').removeAlpha().raw().toBuffer();assert.equal(a.length,b.length);let sum=0,changed=0;
  for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d;if(d>20)changed++;}
  const mean=sum/a.length/255,fraction=changed/a.length;assert.ok(mean<.012&&fraction<.025,'large render change '+next+' '+mean+' '+fraction);comparisons.push({pose:next,meanAbsolutePixelDifference:mean,changedChannelFraction:fraction});
 }
 fs.writeFileSync(out+'/model-comparison-v214.json',JSON.stringify(comparisons,null,2));
 await page.setViewportSize(viewport);await page.evaluate(({width,height})=>{__arena.renderer.setPixelRatio(1.25);__arena.renderer.setSize(width,height,false);},viewport);
 console.log(JSON.stringify({characterV214:checks,comparisonViews:comparisons.length,maxPixelDifference:Math.max(...comparisons.map(x=>x.meanAbsolutePixelDifference)),out}));
};
