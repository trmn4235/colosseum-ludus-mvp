const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {rigRuntime} = require('./performance-v84.cjs');
const visuals = require('../item-visuals-v199.js');
const production = require('../ludus-production-v119.js');

const ids = ['officer_chest', 'officer_chest_black'];
const skus = ['chest-officer', 'chest-officer-black'];

test('Officer color, icon, recipe and stored item identity survive inventory round trips', () => {
  for (const [i,model] of ids.entries()) {
    const item = JSON.parse(JSON.stringify({id:'owned-'+i,kind:'chest',model,sku:'chest-plate',enhancement:7,emeralds:[{id:2,value:80}]}));
    const record = visuals.entry(item);
    assert.equal(record.sku,skus[i]);
    assert.ok(fs.existsSync(record.icon));
    assert.ok(visuals.artwork(item).includes(record.icon));
    assert.ok(visuals.artwork(item).includes('+7'));
    assert.equal(production.skuForItem(item),skus[i]);
    const recipe = production.recipes.find(r=>r.sku===skus[i]);
    assert.equal(recipe.kind,'chest');
    assert.equal(recipe.model,model);
    assert.deepEqual(recipe.ingredients,production.recipes.find(r=>r.sku==='chest-plate').ingredients);
  }
  assert.notEqual(visuals.photo(skus[0]),visuals.photo(skus[1]));
});

function chestMesh(m) {
  const meshes=[];
  m.gear.chest.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.equal(meshes.length,1);
  return meshes[0];
}

const entries = [
  ['arena.html'], ['savas.html'], ['multiplayer.html'], ['ludus.html'],
  ['arena.html','caravan-rig-v126.js'], ['arena.html','ranked-gladiator-runtime-v253.js']
];
for (const [page,rigFile] of entries) test((rigFile||page)+' equips and swaps both colors on the same fitted mesh',async()=>{
  const c=await rigRuntime(page,rigFile?{rigFile}:{});
  const api=c.ArenaEquipmentFit.officer;
  const makeFighter=(model)=>Object.assign(
    new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0],
    {x:0,z:0,angle:0,hp:100,chest:true,chestModel:model,shield:false,weapon:'gladius',motionVersion:163}
  );
  const models=[c.ImportedGladiator.create(10,'murmillo'),c.ImportedGladiator.create(11,'murmillo')];
  const fighters=ids.map(makeFighter);
  // Distant characters can switch body geometry after capture. The fitted
  // template cache must keep using the reference mesh from the common bind pose.
  const body=models[1].equipmentFit164.body;
  body.geometry=body.geometry.clone();
  // Cold equip triggers lazy loads. Sync the same fighters again without changing their loadout.
  models.forEach((m,i)=>c.ClassEquipment.sync(m,fighters[i]));
  await Promise.all(ids.map(id=>api.load(id)));
  models.forEach((m,i)=>c.ClassEquipment.sync(m,fighters[i]));
  const [original,black]=models.map(chestMesh);
  assert.equal(original.geometry.index.count,2999*3);
  assert.equal(original.geometry,black.geometry);
  assert.notEqual(original.skeleton,black.skeleton);
  assert.equal(original.skeleton,models[0].equipmentFit164.body.skeleton);
  assert.equal(black.skeleton,models[1].equipmentFit164.body.skeleton);
  assert.equal(original.material.name,'OfficerBronze');
  assert.equal(black.material.name,'OfficerBlack');
  assert.notEqual(original.material.map,black.material.map);
  assert.equal(black.material.map.flipY,false);
  assert.equal(black.material.map.colorSpace,c.THREE.SRGBColorSpace);
  assert.equal(original.material.normalMap,black.material.normalMap);
  assert.equal(original.material.metalnessMap,black.material.metalnessMap);
  const point=new c.THREE.Vector3(),chest=new c.THREE.Vector3();
  for(const pose of ['idle','walk','run','attack','guard','duck','jump','roll','fall']){
    const f=fighters[0],m=models[0];
    Object.assign(f,{action:'idle',move:0,blocking:false,deadTime:0,hp:100,walk:0,timer:0});
    if(pose==='walk'||pose==='run') {f.move=pose==='walk'?.55:1;f.walk=1.2;}
    if(pose==='attack')Object.assign(f,{action:'attack',attackWeapon:'gladius',attackProfile:c.ArenaMotion.profile('gladius'),attackKind:'light',attackRegion:'chest',attackLeft:false,duration:.65});
    if(pose==='guard')f.blocking=true;
    if(['duck','jump','roll'].includes(pose))Object.assign(f,{action:pose==='roll'?'dodge':'evade',evadeKind:pose,duration:.65});
    if(pose==='fall')Object.assign(f,{action:'down',hp:0});
    for(let n=0;n<=24;n++){
      f.walk+=.07;f.timer=n/40;f.deadTime=n/40;
      c.ImportedGladiator.animate(f,m,n/60,1/60);
      m.root.updateMatrixWorld(true);
      assert.equal(chestMesh(m).geometry,original.geometry);
      m.bones.Spine2.getWorldPosition(chest);
      for(let j=0;j<original.geometry.attributes.position.count;j+=47) {
        original.getVertexPosition(j,point).applyMatrix4(original.matrixWorld);
        assert.ok(point.distanceTo(chest)<.8,pose+' displaced worn chest');
      }
    }
  }
  const f=fighters[0],m=models[0];
  Object.assign(f,{hp:100,action:'idle',chest:false});
  c.ClassEquipment.sync(m,f);assert.equal(m.gear.chest.group.visible,false);
  f.chest=true;
  for (const [model,material] of [[ids[1],black.material],[ids[0],original.material]]) {
    f.chestModel=model;c.ClassEquipment.sync(m,f);
    assert.equal(chestMesh(m).material,material);assert.equal(m.gear.chest.group.visible,true);
    const drop=c.ClassEquipment.item({kind:'chest',itemEntry:{item:{kind:'chest',model}}});
    assert.equal(drop.userData.armourModel,model);
  }
  assert.equal(chestMesh(models[1]).material,black.material);
  models.forEach(m=>c.ImportedGladiator.dispose(m));
});

test('a cold dropped cuirass recovers after an unavailable model without per-frame network retries',async()=>{
  const c=await rigRuntime();
  const assetLoad=c.ArenaAssetLoad,api=c.ArenaEquipmentFit.officer,T=c.THREE;
  let attempts=0,available=false;
  c.ArenaAssetLoad=async name=>{
    if(name.endsWith('officer_chest.glb')) {
      attempts++;
      if(!available)throw Error('offline');
    }
    return assetLoad(name);
  };
  c.testClock=100000;
  require('node:vm').runInContext('Date.now=()=>testClock',c);
  const scene=new T.Scene(),batch=new c.ArenaRuntime.DropBatch(T,scene);
  const drops=[{id:1,x:2,z:3,kind:'chest',itemEntry:{item:{kind:'chest',model:'officer_chest'}}}];
  const draw=()=>batch.update(drops,d=>c.ClassEquipment.item(d),true);
  draw();await assert.rejects(api.load('officer_chest'),/offline/);
  for(let i=0;i<300;i++)draw();
  assert.equal(attempts,1);
  assert.equal(scene.children.length,0);
  c.testClock+=5000;draw();await assert.rejects(api.load('officer_chest'),/offline/);
  assert.equal(attempts,2);
  c.testClock+=9900;available=true;draw();assert.equal(attempts,2);
  c.testClock+=100;draw();await api.load('officer_chest');draw();
  assert.equal(attempts,3);assert.equal(scene.children.length,1);
  assert.equal(scene.children[0].material.name,'OfficerBronze');
  const mesh=scene.children[0];draw();assert.equal(scene.children[0],mesh);
  batch.update([],d=>c.ClassEquipment.item(d),true);assert.equal(scene.children.length,0);
});
