const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function checkCommanders(page, output) {
 const result = await page.evaluate(async () => {
  const {combat, models, renderer} = __arena, T = THREE;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const elite = combat.fighters.filter(f => f.eliteBotV295);
  const commander = LudusBattle.ticket.snapshot.elite_v296.commander;
  check(elite.length === (commander ? 2 : 1), 'Wrong number of special opponents');
  const victor = elite.find(f => f.eliteBotV295.key === 'hoplomachus');
  check(victor?.name === 'Victor', 'Victor is missing');
  check(elite.every(f => f.team !== combat.fighters[0].team), 'An ally became a special opponent');
  if (!commander) return {commander, active:elite.map(f => f.name), shots:[]};
  const enemy = elite.find(f => f.eliteBotV295.key === 'aegis');
  check(enemy.name === (commander === 'legatus' ? 'Legatus legionis' : 'Imperator'), 'Wrong commander name');
  const model = models[enemy.id], ordinary = models[0];
  const originalMaterials = [];
  ordinary.root.traverse(o => { if (o.isMesh) originalMaterials.push([o,o.material]); });
  const parent = model.root.parent, size = renderer.getSize(new T.Vector2()), ratio = renderer.getPixelRatio();
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(31,1,.01,25), shots = [];
  scene.background = new T.Color(0xdcd9d0);
  scene.environment = __arena.scene.environment;
  scene.add(new T.HemisphereLight(0xffffff,0x897b70,2.6));
  const light = new T.DirectionalLight(0xfff6df,3);
  light.position.set(-3,4,5);scene.add(light);scene.add(model.root);
  renderer.setPixelRatio(1);renderer.setSize(480,480,false);
  camera.position.set(.4,1.45,4.35);camera.lookAt(0,1.05,0);
  const f = {...enemy,x:0,z:0,angle:0,hp:enemy.maxHp,weapon:'gladius',shield:true,shieldStyle:'hoplomachus',
   offhand:null,leftGear:null,action:'idle',move:0,blocking:false,absoluteBlockUntil:0,guardFlash:0,reaction:0};
  const gl = renderer.getContext();
  function paint(variant, weapon = 'gladius') {
   f.eliteBotV295 = {...enemy.eliteBotV295,variant};f.weapon = weapon;
   for (let i=0;i<90;i++) ImportedGladiator.animate(f,model,1,1/60);
   model.teamMark.visible = false;
   // The staged actor was teleported out of its arena position. Refresh skinned
   // bounds before the comparison so first-frame culling cannot hide its body.
   model.root.updateMatrixWorld(true);
   model.visual.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update();o.computeBoundingSphere(); } });
   renderer.render(scene,camera);
   const pixels = new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
   gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   shots.push({name:shots.length+'-'+variant+'-'+weapon,png:renderer.domElement.toDataURL('image/png').split(',')[1]});
   return pixels;
  }
  try {
   const blue = paint('imperator');
   const blueMaterials = [];
   model.visual.traverse(o => { if (o.isMesh) blueMaterials.push([o,o.material]); });
   const black = paint('legatus');
   let changed = 0,darker = 0;
   for (let i=0;i<blue.length;i+=4) {
    if (Math.max(...[0,1,2].map(k=>Math.abs(blue[i+k]-black[i+k]))) > 12) changed++;
    if (black[i]+black[i+1]+black[i+2] < blue[i]+blue[i+1]+blue[i+2]-25) darker++;
   }
   check(changed>2000 && darker>1500,'Legatus armour is not visibly black');
   const checkGear = () => {
    const gear = [model.weaponAnchor,model.offhandAnchor,model.gear.shield.group];
    let count = 0;
    for (const group of gear) group.traverseVisible(o => {
     if (!o.isMesh) return;count++;
     const mats = Array.isArray(o.material) ? o.material : [o.material];
     check(mats.every(m=>m.userData.legatusFinish296),'A Legatus weapon or shield kept its original colour');
    });
    check(count>0,'No held equipment rendered');
   };
   checkGear();paint('legatus','spear');checkGear();
   const restored = paint('imperator');
   for (const [o,material] of blueMaterials) check(o.material === material,'Imperator material was mutated');
   for (const [o,material] of originalMaterials) check(o.material === material,'Ordinary actor material changed');
   let restorationError = 0;
   for (let i=0;i<restored.length;i++) restorationError += Math.abs(restored[i]-blue[i]);

   check(renderer.info.programs.every(p=>p.diagnostics?.runnable!==false),'Commander shader did not compile');
   return {commander,active:elite.map(f=>f.name),changed,darker,restorationError:restorationError/restored.length,shots};
  } finally {
   parent.add(model.root);ImportedGladiator.animate(enemy,model,0,1/60);
   renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);
  }
 });
 const out = path.join(output,'commanders-v296');fs.mkdirSync(out,{recursive:true});
 for (const shot of result.shots) fs.writeFileSync(path.join(out,shot.name+'.png'),Buffer.from(shot.png,'base64'));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...result,shots:result.shots.map(s=>s.name)},null,2));
 assert.ok(result.active.includes('Victor'));
 if (result.restorationError !== undefined) assert.ok(result.restorationError < 2, 'Original blue appearance did not restore, error '+result.restorationError);
 console.log('V296 commanders rendered',JSON.stringify({...result,shots:result.shots.length}));
};
