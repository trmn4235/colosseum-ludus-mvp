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
test('roll support follows a raised or lowered scene floor',async()=>{
 const c=await rigRuntime('arena.html',{skipEquipment:true}),T=c.THREE,p=new T.Vector3(),q=new T.Vector3();
 for(const height of [-1.5,2.75])for(const u of [.2,.4,.6,.8]){
  const ground=make(c),raised=make(c);
  for(const {f,m}of [ground,raised]){Object.assign(f,{action:'dodge',duration:.46,timer:u*.46,dx:0,dz:1});c.ImportedGladiator.animate(f,m,f.timer,1/60);}
  raised.m.root.position.y=height;raised.m.root.updateMatrixWorld(true);c.ArenaRoll.apply(raised.f,raised.m);
  for(const name of ['Head','Hips','LeftFoot','RightFoot']){
   ground.m.bones[name].getWorldPosition(p);raised.m.bones[name].getWorldPosition(q);q.y-=height;
   assert.ok(p.distanceTo(q)<.025,`${height}m ${u}: ${name} grounded against a global floor`);
  }
  c.ImportedGladiator.dispose(ground.m);c.ImportedGladiator.dispose(raised.m);
 }
});
