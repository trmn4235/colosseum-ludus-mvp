const fs=require('node:fs'),path=require('node:path');

module.exports=async(page,out)=>{
 const sources={classes:require('./character-classes-v215.cjs').runClassCases.toString(),actions:require('./character-actions-v215.cjs').runActionCases.toString(),grips:require('./character-grip-v215.cjs').runGripCases.toString()};
 const checks=await page.evaluate(sources=>({
  classes:new Function('return ('+sources.classes+')(window,{rates:[30,60],directions:4})')(),
  actions:new Function('return ('+sources.actions+')(window,{rates:[15,60]})')(),
  grips:new Function('return ('+sources.grips+')(window,{rates:[15,60]})')()
 }),sources);
 fs.writeFileSync(path.join(out,'character-v215.json'),JSON.stringify(checks,null,2));
 const shots=await page.evaluate(async()=>{
  const T=THREE,renderer=__arena.renderer,scene=new T.Scene(),camera=new T.PerspectiveCamera(34,.75,.01,30),shots=[];
  renderer.setPixelRatio(1);renderer.setSize(600,800,false);scene.background=new T.Color('#ece9e1');
  scene.add(new T.HemisphereLight(0xffffff,0x766c60,2.5));const sun=new T.DirectionalLight(0xfff3e5,3);sun.position.set(-3,5,4);scene.add(sun);
  const specs=Object.keys(ArenaClasses).flatMap(type=>[{type,pose:'idle'},{type,pose:type==='retiarius'?'net-windup':type==='scissor'?'hook':'guard-impact'}]);
  specs.push({type:'retiarius',pose:'net-released'},{type:'thraex',pose:'attack'});
  for(const {type,pose}of specs){
   const m=ImportedGladiator.create(215,type),f=new ArenaCombat(()=>.999).reset('normal',type).fighters[0];scene.add(m.root);
   Object.assign(f,{x:0,z:0,angle:0,hp:100,action:'idle',timer:0,move:0,walk:0,motionVersion:163,blocking:false,guardFlash:0,reaction:0,passiveEvade:0});
   let time=0;for(let i=0;i<30;i++){time+=1/60;ImportedGladiator.animate(f,m,time,1/60);}
   if(pose==='guard-impact')Object.assign(f,{blocking:true,guardFlash:.1,guardImpact:1,guardImpactX:.65,guardImpactY:.4});
   if(pose==='hook')Object.assign(f,{action:'hook',duration:.6});
   if(pose.startsWith('net-'))Object.assign(f,{action:'netcast',duration:.9,netBusy:true});
   if(pose==='attack'){f.attackProfile=ArenaMotion.profile(f.weapon);Object.assign(f,{action:'attack',attackLeft:false,attackWeapon:f.weapon,attackKind:'light',attackRegion:'chest',duration:f.attackProfile.duration});}
   const duration=pose==='net-windup'?.2:pose==='net-released'?.4:pose==='attack'?f.duration*.5:.25;
   for(let i=0;i<Math.ceil(duration*60);i++){time+=1/60;f.timer=(i+1)/60;ImportedGladiator.animate(f,m,time,1/60);}
   m.teamMark.visible=false;m.root.updateMatrixWorld(true);
   camera.position.set(pose==='idle'?0:-2.5,1.3,4.6);camera.lookAt(0,1.03,0);renderer.render(scene,camera);
   shots.push({name:type+'-'+pose,data:renderer.domElement.toDataURL('image/png').split(',')[1]});
   ImportedGladiator.dispose(m);m.root.removeFromParent();
  }
  const board=document.createElement('canvas');board.width=1440;board.height=2080;const context=board.getContext('2d');context.fillStyle='#f4f1eb';context.fillRect(0,0,board.width,board.height);
  for(let i=0;i<shots.length;i++){
   const img=new Image();img.src='data:image/png;base64,'+shots[i].data;await img.decode();const x=i%4*360,y=Math.floor(i/4)*520;
   context.drawImage(img,x,y,360,480);context.fillStyle='#4d202b';context.font='18px sans-serif';context.fillText(shots[i].name,x+10,y+505);
  }
  shots.push({name:'contact-sheet-v215',data:board.toDataURL('image/png').split(',')[1]});return shots;
 });
 for(const shot of shots)fs.writeFileSync(path.join(out,shot.name+'.png'),Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({characterV215:checks,renderedViews:shots.length-1,out}));
};
