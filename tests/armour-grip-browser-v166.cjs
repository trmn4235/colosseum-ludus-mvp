const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async(page,out)=>{
 const viewport=page.viewportSize(),root=path.resolve(process.env.LUDUS_TEST_ROOT||path.join(__dirname,'..'));
 const html=fs.readFileSync(root+'/ludus.html','utf8');
 const graphics=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('var ImportedGladiator='))[1];
 const end=graphics.indexOf('})();',graphics.indexOf('return {load,create,animate,dispose,get loaded(){return !!template;}};'))+5;
 await page.setViewportSize({width:1100,height:800});
 const result=await page.evaluate(async({selectionSource,armour})=>{
  const T=THREE,a=__arena,scene=new T.Scene();a.renderer.setSize(1100,800,false);scene.background=new T.Color('#e9e6de');
  scene.add(new T.HemisphereLight(0xffffff,0x766c60,2.5));
  const sun=new T.DirectionalLight(0xfff3e5,3);sun.position.set(-3,5,4);scene.add(sun);
  const camera=new T.PerspectiveCamera(34,1100/800,.01,30);
  const f=new ArenaCombat(()=>.999).reset('normal','retiarius').fighters[0];
  Object.assign(f,{x:0,z:0,angle:0,hp:100,chest:true,chestModel:armour,helmet:true,helmetModel:'gladiator',shoulders:false,shield:false,weapon:'trident',offhand:null,leftGear:null,motionVersion:163,action:'idle',move:0});
  const m=ImportedGladiator.create(166,'retiarius');scene.add(m.root);m.teamMark.visible=false;
  let clock=0,maxGripGap=0,worst;const shots=[];
  const animate=()=>{clock+=1/60;ImportedGladiator.animate(f,m,clock,1/60);m.teamMark.visible=false;
   for(const side of ['Left','Right']){const h=m.bones[side+'Hand'],s=m.grip166?.[side];if(s?.active){const palm=h.localToWorld(new T.Vector3(0,.075,.025).divideScalar(h.getWorldScale(new T.Vector3()).x));const gap=palm.distanceTo(s.target);if(gap>maxGripGap){maxGripGap=gap;worst={weapon:f.weapon,action:f.action,move:f.move,blocking:f.blocking,side,clock,target:s.target.toArray(),palm:palm.toArray(),hand:h.quaternion.toArray(),root:m.root.position.toArray()};}}}
  };
  const shot=(name,x,y,z)=>{camera.position.set(x,y,z);camera.lookAt(0,1.34,.1);a.renderer.render(scene,camera);shots.push({name,data:a.renderer.domElement.toDataURL('image/png').split(',')[1]});};
  for(const pose of ['idle','walk','attack','guard','sword']){
   Object.assign(f,{action:'idle',timer:0,blocking:false,move:0,walk:1.2,weapon:pose==='sword'?'gladius':'trident'});
   if(pose==='walk')f.move=1;
   if(pose==='attack'){Object.assign(f,{action:'attack',attackWeapon:'trident',attackRegion:'chest',attackKind:'light',attackLeft:false,attackProfile:ArenaMotion.profile('trident')});f.duration=f.attackProfile.duration;f.timer=f.duration*.45;}
   if(pose==='guard'){f.blocking=true;f.shield=true;f.shieldStyle='hoplomachus';}else f.shield=false;
   for(let n=0;n<35;n++){if(pose==='walk'){f.x+=.004;f.z+=.006;f.walk+=.05;}if(pose==='attack')f.timer=Math.min(n/60,f.duration*.45);animate();}
   shot(pose+'-front',0,1.55,2.65);shot(pose+'-side',-2.05,1.6,1.35);shot(pose+'-back',1.75,1.6,-1.8);
  }
  ImportedGladiator.dispose(m);scene.remove(m.root);
  // Exercise the selection screen's own rig code, rather than another arena pose.
  const selection=new Function(selectionSource+';return ImportedGladiator;')();await selection.load(()=>{});
  const preview=selection.create(167,'retiarius');scene.add(preview.root);
  Object.assign(f,{x:0,z:0,action:'idle',timer:0,move:0,blocking:false,shield:false,weapon:'trident'});
  for(let n=0;n<35;n++){clock+=1/60;selection.animate(f,preview,clock,1/60);preview.teamMark.visible=false;}
  shot('selection-front',0,1.55,2.65);shot('selection-side',-2.05,1.6,1.35);
  selection.dispose(preview);scene.remove(preview.root);a.renderer.render(a.scene,a.camera);return {shots,maxGripGap,worst,importedEquipment:ImportedEquipment.loaded};
 },{selectionSource:graphics.slice(0,end),armour:process.env.LUDUS_FIT_ARMOUR||'chest_plate'});
 assert.ok(result.maxGripGap<.005,JSON.stringify({maxGripGap:result.maxGripGap,worst:result.worst}));
 for(const shot of result.shots)fs.writeFileSync(out+'/fit166-'+shot.name+'.png',Buffer.from(shot.data,'base64'));
 await page.setViewportSize(viewport);await page.evaluate(({width,height})=>__arena.renderer.setSize(width,height,false),viewport);
 console.log(JSON.stringify({anatomyViews:result.shots.map(s=>s.name),maxGripGap:result.maxGripGap,importedEquipment:result.importedEquipment,out}));
};
