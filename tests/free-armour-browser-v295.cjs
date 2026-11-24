// Render the models loaded by the real single-player arena and fit both Officer items to its live rigs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function checkArenaArmour(page, output) {
 const manifest = await page.evaluate(async () => {
  const response = await fetch('assets/armor-v295/source-manifest.json');
  if (!response.ok) throw Error('Missing V295 model manifest');
  return response.json();
 });
 const expectedBots = manifest.models.filter(row => row.use === 'whole_character_special_enemy' && row.ready);
 const officer = manifest.models.find(row => row.id === 'officer_chest');
 assert.ok(officer?.ready, 'The two Officer items must be ready in this release');
 const result = await page.evaluate(async ({expectedBots, officer}) => {
  const {renderer, combat, models} = __arena, T = THREE;
  const directory = [], metrics = [], shots = [];
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(31, 1, 0.01, 25);
  scene.background = new T.Color(0xdcd9d0);
  scene.environment = __arena.scene.environment;
  scene.add(new T.HemisphereLight(0xffffff, 0x897b70, 2.6));
  const light = new T.DirectionalLight(0xfff6df, 3);
  light.position.set(-3,4,5);
  scene.add(light);
  const size = renderer.getSize(new T.Vector2()), ratio = renderer.getPixelRatio();
  const check = (value, message) => { if (!value) throw Error(message); };
  const gl = renderer.getContext();
  const pixels = () => {
   renderer.render(scene,camera);
   const bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
   gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
   return bytes;
  };
  const changed = (a,b) => {
   let count = 0;
   for (let i=0; i<a.length; i+=4) {
    if (Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>10) count++;
   }
   return count;
  };
  const capture = name => shots.push({name, png:renderer.domElement.toDataURL('image/png').split(',')[1]});
  function putOnStage(m) {
   directory.push({m,parent:m.root.parent,visible:m.root.visible});
   scene.add(m.root);
   m.root.visible=true;
  }
  function pose(m, fighter, action) {
   const profile=ArenaMotion.profile(fighter.weapon || 'gladius');
   const f={...fighter,x:0,z:0,angle:0,hp:fighter.maxHp,move:action==='walk'?1:0,blocking:false,
    absoluteBlockUntil:0,guardFlash:0,reaction:0,action:action==='attack'?'attack':'idle',
    attackRegion:'chest',attackKind:'light',attackLeft:false,attackWeapon:fighter.weapon,
    attackProfile:profile,duration:profile.duration};
   for (let i=0;i<28;i++) {
    f.timer=action==='attack'?(profile.wind+profile.active*0.5)*(i+1)/28:0;
    f.walk=action==='walk'?(i+1)*0.13:0;
    // The locomotion solver measures real travel. Finish at the idle location
    // so the deformed vertex comparison cannot pass from root translation.
    f.z=action==='walk'?(i-27)*1.6/60:0;
    ImportedGladiator.animate(f,m,(i+1)/60,1/60);
   }
   m.teamMark.visible=false;
   m.root.updateMatrixWorld(true);
  }
  function measure(label,m,meshes) {
   const points=[], box=new T.Box3(), v=new T.Vector3();
   for (const mesh of meshes) {
    check(mesh.isSkinnedMesh && mesh.skeleton.bones.includes(m.bones.Hips),label+' must use its actor skeleton');
    mesh.skeleton.update();
    const count=mesh.geometry.attributes.position.count;
    for (let i=0;i<count;i+=Math.max(1,Math.floor(count/180))) {
     mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);
     check(Number.isFinite(v.lengthSq()),label+' has a non-finite skinned vertex');
     points.push(v.toArray());box.expandByPoint(v);
    }
   }
   return {points,box};
  }
  function capturePose(label,m,meshes,action,baseline) {
   const {points,box}=measure(label,m,meshes);
   const present=pixels();capture(label+'-'+action);
   for (const mesh of meshes) mesh.visible=false;
   const visiblePixels=changed(present,pixels());
   for (const mesh of meshes) mesh.visible=true;
   check(visiblePixels>100,label+' '+action+' is not visible on its fighter');
   let maxMovement=0;
   if (baseline) for (let i=0;i<points.length;i++) maxMovement=Math.max(maxMovement,Math.hypot(...points[i].map((v,k)=>v-baseline[i][k])));
   check(!baseline || maxMovement>0.002,label+' '+action+' mesh did not move with the animation');
   metrics.push({label,action,visiblePixels,maxMovement,bounds:[box.min.toArray(),box.max.toArray()]});
   return {points,present,box};
  }
  const skins = group => {
   const meshes=[];
   group.traverseVisible(o=>{if(o.isSkinnedMesh) meshes.push(o);});
   return meshes;
  };
  function geometryTriangles(meshes) {
   return meshes.reduce((sum,m)=>sum+(m.geometry.index?.count ?? m.geometry.attributes.position.count)/3,0);
  }
  try {
   renderer.setPixelRatio(1);renderer.setSize(480,480,false);
   camera.position.set(0.4,1.42,4.35);camera.lookAt(0,1.05,0);
   const active=combat.fighters.filter(f=>f.eliteBotV295);
   check(active.length===expectedBots.length,'Arena activated '+active.length+' special opponents, expected '+expectedBots.length);
   for (const spec of expectedBots) {
    const matches=active.filter(f=>f.eliteBotV295.key===spec.id);
    check(matches.length===1 && matches[0].team!==combat.fighters[0].team,spec.id+' is not one enemy');
    // These opponents start with whatever gear their existing bot slot owns.
    // Equip a real arena weapon for the motion comparison, including empty slots.
    const fighter={...matches[0],weapon:spec.id==='hoplomachus'?'spear':'gladius',
     shield:true,shieldStyle:'hoplomachus',offhand:null,leftGear:null}, m=models[fighter.id];
    check(m.eliteModelV295===spec.id,spec.id+' fell back to the usual body');
    putOnStage(m);
    let baseline;
    for (const action of ['idle','walk','attack']) {
     pose(m,fighter,action);
     const body=skins(m.visual).filter(o=>!o.userData.wornEquipment164);
     check(body.length && geometryTriangles(body)<=spec.actualOutputTriangles,spec.id+' geometry exceeds its released model');
     const view=capturePose(spec.id,m,body,action,baseline);
     baseline ??= view.points;
    }
    if(spec.id==='aegis'){
     // View the shield arm from the side through the spear lunge. Leave the shield
     // equipped for IK and hide its render group only while taking the inspection image.
     const shield=m.gear.shield.group,visible=shield.visible;
     const spear={...fighter,weapon:'spear',blocking:false,attackKind:'light',attackLeft:false,attackRegion:'chest',attackWeapon:'spear',attackProfile:ArenaMotion.profile('spear')};
     const body=skins(m.visual).filter(o=>!o.userData.wornEquipment164);
     const elbow=m.bones.LeftForeArm,upper=m.bones.LeftArm,wrist=m.bones.LeftHand;
     const skin=body[0],rest=skin.geometry.attributes.position;
     const index=skin.geometry.attributes.skinIndex,weight=skin.geometry.attributes.skinWeight;
     const elbowIndex=skin.skeleton.bones.indexOf(m.bones.LeftElbowTwist);
     const ring=[];
     for(let i=0;i<rest.count;i++){
      for(let k=0;k<4;k++)if(index.getComponent(i,k)===elbowIndex && weight.getComponent(i,k)>.55){
       ring.push(i);break;
      }
     }
     check(ring.length>=12,'Missing elbow skin on Aegis');
     const area=(pts)=>{
      const lengths=[];
      // Use the two tangent directions around the hinge, independent of camera and root travel.
      let a=pts[0],b=a;
      for(const v of pts)if(v.distanceToSquared(a)>b.distanceToSquared(a))b=v;
      const axis=b.clone().sub(a).normalize();
      for(const v of pts)lengths.push(v.clone().sub(a).cross(axis).length());
      return b.distanceTo(a)*Math.max(...lengths);
     };
     const base=area(ring.map(i=>new T.Vector3().fromBufferAttribute(rest,i)))*skin.getWorldScale(new T.Vector3()).x**2;
     let minArea=Infinity;
     for(let frame=0;frame<=36;frame++){
      const profile=spear.attackProfile;
      Object.assign(spear,{x:0,z:0,angle:0,hp:spear.maxHp,action:'attack',move:0,duration:profile.duration,timer:frame*profile.duration/36});
      ImportedGladiator.animate(spear,m,frame/60,1/60);
      m.root.updateMatrixWorld(true);skin.skeleton.update();
      minArea=Math.min(minArea,area(ring.map(i=>skin.getVertexPosition(i,new T.Vector3()).applyMatrix4(skin.matrixWorld)))/base);
      if([6,18,24,30].includes(frame)){
       const target=elbow.getWorldPosition(new T.Vector3()).multiplyScalar(.5)
        .addScaledVector(upper.getWorldPosition(new T.Vector3()),.25).addScaledVector(wrist.getWorldPosition(new T.Vector3()),.25);
       camera.position.copy(target).add(new T.Vector3(1.1,.1,.65));camera.lookAt(target);
       shield.visible=false;pixels();capture('aegis-spear-'+frame);shield.visible=visible;
      }
     }
     metrics.push({label:'aegis-spear',elbowMinAreaRatio:minArea,frames:37});
     check(minArea>.65,'Aegis elbow collapsed during the spear lunge, ratio '+minArea);
     camera.position.set(0.4,1.42,4.35);camera.lookAt(0,1.05,0);
    }
    m.root.visible=false;
   }
   await ArenaEquipmentFit.officer.load('officer_chest_black');
   const standard=combat.fighters.filter(f=>!f.eliteBotV295).slice(0,2);
   const variants=['officer_chest','officer_chest_black'],materials=['OfficerBronze','OfficerBlack'];
   const instances=standard.map(f=>models[f.id]),worn=[];
   // Pin all other equipment and the camera when comparing colour on the same actor.
   const equipped=(f,variant)=>({...f,chest:true,chestModel:variant,helmet:false,shoulders:false,greaves:false,shield:false,
    leftGear:null,offhand:null,weapon:'gladius'});
   for (const [i,m] of instances.entries()) {
    putOnStage(m);pose(m,equipped(standard[i],variants[i]),'idle');
    const meshes=skins(m.gear.chest.group);
    check(m.chestModel===variants[i] && meshes.length===1,variants[i]+' did not replace the equipped chest');
    check(geometryTriangles(meshes)===officer.actualOutputTriangles,variants[i]+' contains the wrong armour geometry');
    check(meshes[0].material.name===materials[i],variants[i]+' uses the wrong material');
    worn.push(meshes[0]);m.root.visible=false;
   }
   check(worn[0].geometry===worn[1].geometry,'Officer colours must reuse fitted geometry');
   check(worn[0].material!==worn[1].material && worn[0].skeleton!==worn[1].skeleton,'Separate actors must retain distinct colour and pose');
   const m=instances[0];m.root.visible=true;
   camera.position.set(0.25,1.48,2.45);camera.lookAt(0,1.25,0);
   for (const variant of variants) {
    const fighter=equipped(standard[0],variant);
    let baseline;
    for (const action of ['idle','walk','attack']) {
     pose(m,fighter,action);
     const meshes=skins(m.gear.chest.group);
     const view=capturePose(variant,m,meshes,action,baseline);
     const centre=view.box.getCenter(new T.Vector3()),torso=m.bones.Spine2.getWorldPosition(new T.Vector3());
     check(centre.distanceTo(torso)<0.8,variant+' is displaced from the chest during '+action);
     baseline ??= view.points;
     if (action==='idle' && variant===variants[0]) {
      const original=meshes[0].material;
      meshes[0].material=worn[1].material;
      const difference=changed(view.present,pixels());
      meshes[0].material=original;
      check(difference>100,'Original and black Officer colours look identical at the same pose');
      metrics.push({variant,colourDifferencePixels:difference});
     }
    }
   }
   return {metrics,shots};
  } catch(error) {
   return {metrics,shots,error:String(error.stack || error)};
  } finally {
   for (const {m,parent,visible} of directory) {parent.add(m.root);m.root.visible=visible;}
   renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);
  }
 },{expectedBots,officer});
 const out=path.join(output,'armour-v295');
 fs.mkdirSync(out,{recursive:true});
 for (const shot of result.shots) fs.writeFileSync(path.join(out,shot.name+'.png'),Buffer.from(shot.png,'base64'));
 fs.writeFileSync(path.join(out,'poses.json'),JSON.stringify(result.metrics,null,2));
 assert.ifError(result.error ? Error(result.error) : null);
 console.log('V295 verified real arena poses and Officer colours:',result.shots.length,'screenshots');
};
