const assert=require('node:assert/strict');
module.exports=async(page,out)=>{
 const result=await page.evaluate(()=>{
  const a=__arena;a.freeze();
  a.camera.position.set(0,6,12);a.camera.lookAt(0,1,0);
  for(let i=0;i<a.combat.fighters.length;i++){
   const f=a.combat.fighters[i];f.x=(i%5-2)*2;f.z=(Math.floor(i/5)-2)*2;f.hp=100;f.action='idle';f.move=0;f.angle=0;f.gearBase=null;f.weapon='gladius';f.shield=true;f.helmet=true;f.chest=true;f.greaves=true;f.shoulders=true;
   a.models[i].root.visible=true;ImportedGladiator.animate(f,a.models[i],0,1/60);
  }
  const attacker=a.combat.fighters[0];for(let i=3;i<20;i++){const f=a.combat.fighters[i];f.hp=1;a.combat.damage(attacker,f,1000,'chest');}
  for(let n=0;n<150;n++)for(let i=3;i<20;i++){const f=a.combat.fighters[i];f.deadTime=n/60;a.animateCharacter(f,a.models[i],n/60,1/60);}
  a.renderWeapons();a.renderer.render(a.scene,a.camera);const batched=a.renderer.info.render.calls;
  const batches=a.dropBatch.meshes;for(const m of batches)m.visible=false;
  const legacy=[];for(const d of a.combat.drops){const o=ClassEquipment.item(d).clone(true);o.rotation.set(Math.PI/2,d.id*.71,0);o.position.set(d.x,.16,d.z);o.traverse(m=>{if(m.isMesh)m.castShadow=false;});a.scene.add(o);legacy.push(o);}
  a.renderer.render(a.scene,a.camera);const individual=a.renderer.info.render.calls;for(const o of legacy)a.scene.remove(o);for(const m of batches)m.visible=true;
  const settled=a.models.slice(3).filter(m=>m.corpseSettled).length;
  const heights=a.models.slice(3).map(m=>m.bones.Head.getWorldPosition(new THREE.Vector3()).y);
  return{batched,individual,settled,maxCorpseHead:Math.max(...heights),drops:a.combat.drops.length,batches:batches.length};
 });
 console.log(JSON.stringify({lootComparison:result}));
 assert.equal(result.settled,17);assert.ok(result.maxCorpseHead<.7);assert.ok(result.batched<result.individual,'accumulated drops must cost fewer GPU draws');
 await page.evaluate(()=>{document.querySelector('#pauseMenu').hidden=false;});
 await page.locator('#cameraPerspective').selectOption('right');assert.equal(await page.evaluate(()=>localStorage.getItem('ludus-camera-perspective')),'right');
 await page.evaluate(()=>{document.querySelector('#pauseMenu').hidden=true;__arena.step(1/60,true);});
 const camera=await page.evaluate(()=>{const p=__arena.combat.fighters[0],c=__arena.camera.position;return{distance:Math.hypot(c.x-p.x,c.z-p.z),y:c.y};});assert.ok(camera.distance>1.5&&camera.distance<3);assert.ok(camera.y>1);
 await page.screenshot({path:out+'/right-shoulder-844.png'});
 for(const view of ['first','third','right'])await page.locator('#cameraPerspective').evaluate((select,value)=>{select.value=value;select.dispatchEvent(new Event('change'));},view);
 console.log(JSON.stringify({stability115:result,camera}));
};
