// Real skinned gladiators: a roll must visibly invert, remain close to the floor,
// recover to standing and preserve the authoritative action and equipped grips.
const test=require('node:test'),assert=require('node:assert/strict');
const {rigRuntime}=require('./performance-v84.cjs');
function make(c,type='murmillo'){
 const f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0],m=c.ImportedGladiator.create(293,type);
 Object.assign(f,{x:0,z:0,angle:.37,hp:100,motionVersion:163,move:0,walk:0,action:'idle',timer:0,reaction:0,guardFlash:0,passiveEvade:0,blocking:false,absoluteBlockUntil:0,shieldHeldBy:null});
 for(let n=0;n<20;n++)c.ImportedGladiator.animate(f,m,n/60,1/60);
 return {f,m};
}
function skinBounds(T,m,step=71){
 let low=Infinity,high=-Infinity,samples=0;const point=new T.Vector3();
 m.root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible||mesh.userData.wornEquipment164)return;
  for(let i=0;i<mesh.geometry.attributes.position.count;i+=step){
   mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
   assert.ok(point.toArray().every(Number.isFinite),'finite rendered skin');
   low=Math.min(low,point.y);high=Math.max(high,point.y);samples++;
  }
 });return {low,high,samples};
}
function equipmentFloor(T,group){
 let low=Infinity;const p=new T.Vector3();
 group.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||!mesh.geometry?.attributes.position)return;for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);low=Math.min(low,p.y);}});
 return low;
}
test('equipped rolls tuck near the floor, invert and recover in the unchanged action time',async()=>{
 const c=await rigRuntime('arena.html'),T=c.THREE,p=new T.Vector3(),q=new T.Vector3(),s=new T.Vector3();
 let cases=0,skinSamples=0;
 for(const type of Object.keys(c.ArenaClasses))for(const [dx,dz]of [[0,1],[0,-1],[1,0],[-1,0]]){
  const {f,m}=make(c,type),initial=m.bones.Head.getWorldPosition(p).y;let inverted=0;
  for(let frame=0;frame<=60;frame++){
   const u=frame/60;Object.assign(f,{action:'dodge',duration:.46,timer:u*.46,dx,dz});
   const before=JSON.stringify([f.x,f.z,f.angle,f.hp,f.stamina,f.action,f.timer,f.duration,f.dx,f.dz]);
   c.ImportedGladiator.animate(f,m,f.timer,.46/60);
   assert.equal(JSON.stringify([f.x,f.z,f.angle,f.hp,f.stamina,f.action,f.timer,f.duration,f.dx,f.dz]),before,'rendering cannot change roll rules');
   assert.equal(m.authoredRoll,'Roll');
   const head=m.bones.Head.getWorldPosition(p).y,hips=m.bones.Hips.getWorldPosition(q).y;
   if(head<hips-.2)inverted++;
   if(frame===0)assert.ok(Math.abs(head-initial)<.015,'entry retains the previous standing height');
   if(frame===12){
    const foot=Math.min(m.bones.LeftFoot.getWorldPosition(p).y,m.bones.RightFoot.getWorldPosition(q).y);
    assert.ok(foot<.30,`${type}: roll preparation must stay grounded instead of leaping with both feet: ${foot}`);
   }
   if(frame%6===0){const bounds=skinBounds(T,m);skinSamples+=bounds.samples;assert.ok(bounds.low>-.07,`${type} ${u}: body penetrated floor by ${-bounds.low}`);}
   for(const [side,kind,anchor]of [['Right',f.weapon,m.weaponAnchor],['Left',f.offhand,m.offhandAnchor]]){
    if(!kind||!anchor.children.length)continue;
    const hand=m.bones[side+'Hand'],offset=['spear','trident','trident_gladiator','halberd'].includes(kind)?-.16:anchor.children[0]?.userData.asset==='roman_spatha.glb'?-.065:0;
    hand.localToWorld(p.set(0,.075,.025).divideScalar(hand.getWorldScale(s).x));anchor.localToWorld(q.set(0,offset,0));
    assert.ok(p.distanceTo(q)<.006,`${type} ${u}: ${side} handle detached during roll`);
   }
  }
  assert.ok(inverted>=13,`${type}: visible inversion must occupy enough of the roll, got ${inverted} of 61 samples`);
  assert.ok(m.bones.Head.getWorldPosition(p).y>1.6,'roll completes its recovery');
  f.action='idle';f.timer=0;c.ImportedGladiator.animate(f,m,.48,1/60);assert.equal(m.authoredRoll,null);assert.equal(m.rollTransition,null);
  c.ImportedGladiator.dispose(m);cases++;
 }
 assert.equal(cases,28);console.log(JSON.stringify({cases,skinSamples,simulationUnchanged:true}));
});
test('large and small shields, gladius and polearms stay carried above the floor across frame rates',async()=>{
 const c=await rigRuntime('arena.html'),T=c.THREE,p=new T.Vector3();let frames=0,minClearance=Infinity,maxHandSpeed=0;
 for(const type of ['murmillo','thraex','hoplomachus','retiarius'])for(const fps of [30,60,120]){
  const {f,m}=make(c,type),count=Math.ceil(.46*fps),dt=.46/count,previous={};let shieldCache,weaponCache;
  for(let n=0;n<=count;n++){
   Object.assign(f,{action:'dodge',duration:.46,timer:n*dt,dx:.6,dz:.8});c.ImportedGladiator.animate(f,m,f.timer,dt);frames++;
   for(const name of ['LeftHand','RightHand']){
    const current=m.bones[name].getWorldPosition(p).clone();if(previous[name]){const speed=current.distanceTo(previous[name])/dt;maxHandSpeed=Math.max(maxHandSpeed,speed);assert.ok(speed<35,`${type} ${fps} ${n}: ${name} snapped at ${speed}m/s`);}previous[name]=current;
   }
   for(const group of [m.weaponAnchor,...(f.shield?[m.gear.shield.group]:[])]){const height=equipmentFloor(T,group);minClearance=Math.min(minClearance,height);assert.ok(height>-.025,`${type} ${fps} ${n}: carried equipment penetrates ground by ${-height}m`);}
   if(n>1&&n<count-1){
    if(weaponCache)assert.equal(m.weaponAnchor.userData.rollBounds293,weaponCache,'weapon bounds stay cached');weaponCache=m.weaponAnchor.userData.rollBounds293;
    if(f.shield){if(shieldCache)assert.equal(m.gear.shield.anchor.userData.rollBounds293,shieldCache,'shield bounds stay cached');shieldCache=m.gear.shield.anchor.userData.rollBounds293;}
   }
  }
  const rested=make(c,type);
  Object.assign(f,{action:'idle',timer:0});
  for(let n=0;n<Math.ceil(.35*fps);n++){c.ImportedGladiator.animate(f,m,.46+n/fps,1/fps);c.ImportedGladiator.animate(rested.f,rested.m,.46+n/fps,1/fps);}
  for(const side of ['Right','Left']){
   const a=side==='Right'?m.weaponAnchor:m.gear.shield?.anchor,b=side==='Right'?rested.m.weaponAnchor:rested.m.gear.shield?.anchor;
   if(!a||!b)continue;assert.ok(a.getWorldPosition(p).distanceTo(b.getWorldPosition(new T.Vector3()))<.03,`${type} ${fps}: ${side} carry does not recover after roll`);
  }
  c.ImportedGladiator.dispose(rested.m);c.ImportedGladiator.dispose(m);
 }
 console.log(JSON.stringify({equipmentFrames:frames,minClearance,maxHandSpeed}));
});
test('roll support follows a raised or lowered scene floor',async()=>{
 const c=await rigRuntime('arena.html',{skipEquipment:true}),T=c.THREE,p=new T.Vector3(),q=new T.Vector3();
 for(const height of [-1.5,2.75])for(const u of [.2,.4,.6,.8]){
  const ground=make(c),raised=make(c);
  const deck=new T.Group();deck.position.y=height;deck.add(raised.m.root);deck.updateMatrixWorld(true);
  for(const {f,m}of [ground,raised]){Object.assign(f,{action:'dodge',duration:.46,timer:u*.46,dx:0,dz:1});c.ImportedGladiator.animate(f,m,f.timer,1/60);}
  for(const name of ['Head','Hips','LeftFoot','RightFoot','LeftHand','RightHand']){
   ground.m.bones[name].getWorldPosition(p);raised.m.bones[name].getWorldPosition(q);q.y-=height;
   assert.ok(p.distanceTo(q)<1e-5,`${height}m ${u}: ${name} grounded against a global floor`);
  }
  c.ImportedGladiator.dispose(ground.m);c.ImportedGladiator.dispose(raised.m);
 }
});
test('asynchronously loading empty equipment cannot corrupt a roll pose',async()=>{
 const c=await rigRuntime('arena.html',{skipEquipment:true}),T=c.THREE;
 for(const part of ['weapon','shield']){
  const {f,m}=make(c),anchor=part==='weapon'?m.weaponAnchor:m.gear.shield.anchor,original=part==='weapon'?anchor.children[0]:m.gear.shield.group,placeholder=new T.Group();
  placeholder.name='Ekipman yükleniyor';anchor.remove(original);anchor.add(placeholder);if(part==='shield')m.gear.shield.group=placeholder;
  Object.assign(f,{action:'dodge',duration:.46,timer:.2,dx:0,dz:1});c.ImportedGladiator.animate(f,m,.2,1/60);
  for(const [name,bone]of m.boneEntries)assert.ok(bone.matrixWorld.elements.every(Number.isFinite),`${part} placeholder corrupted ${name}`);
  anchor.remove(placeholder);anchor.add(original);if(part==='shield')m.gear.shield.group=original;
  f.timer=.21;c.ImportedGladiator.animate(f,m,.21,1/60);
  assert.equal(anchor.userData.rollBounds293?.group,original,'loaded equipment receives finite bounds');
  for(const [name,bone]of m.boneEntries)assert.ok(bone.matrixWorld.elements.every(Number.isFinite),`${part} loaded equipment corrupted ${name}`);
  c.ImportedGladiator.dispose(m);
 }
});
