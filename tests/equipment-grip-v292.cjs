/* Real GLB poses: heading-invariant grip choice and physical palm/handle contact. */
const test=require('node:test'),assert=require('node:assert/strict');
const {rigRuntime}=require('./performance-v84.cjs');
function fighter(c,weapon){return Object.assign(new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0],{x:0,z:0,angle:0,hp:100,weapon,offhand:weapon,leftGear:null,shield:false,move:1,action:'idle',motionVersion:163});}
function localRotation(T,m,node){return m.root.getWorldQuaternion(new T.Quaternion()).invert().multiply(node.getWorldQuaternion(new T.Quaternion())).normalize();}
function physicalGap(c,m,f,side){
 const T=c.THREE,left=side==='Left',hand=m.bones[side+'Hand'],anchor=left?m.offhandAnchor:m.weaponAnchor,group=anchor.children[0],kind=left?f.offhand:f.weapon;
 const offset=['spear','trident','trident_gladiator','halberd'].includes(kind)?-.16:group.userData.asset==='roman_spatha.glb'?-.065:0;
 const sample=f.action==='attack'&&!!f.attackLeft===left?c.ArenaMotion.sample(f):f.action==='idle'?c.ArenaMotion.poleGuard(f,left):null;
 const palm=hand.localToWorld(new T.Vector3(0,.075,.025).divideScalar(hand.getWorldScale(new T.Vector3()).x));
 // Read the rendered model's shaft contact, independently of solver metadata.
 // Polearm choke moves the model along its shaft while preserving palm contact.
 const handle=group.localToWorld(new T.Vector3(0,offset+(sample?.choke||0),0));
 return palm.distanceTo(handle);
}
test('walking and running equipment keeps its local orientation through heading reversals',async()=>{
 const c=await rigRuntime('arena.html'),T=c.THREE;
 for(const dt of [1/60,1/30,1/15])for(const speed of [1.4,4.8])for(const weapon of ['gladius','sica','trident','halberd']){
  const models=[c.ImportedGladiator.create(1,'murmillo'),c.ImportedGladiator.create(2,'murmillo')],fighters=[fighter(c,weapon),fighter(c,weapon)];
  for(let n=0;n<56;n++){
   for(let i=0;i<2;i++){
    const f=fighters[i];f.angle=i&&n>=20?(n<32?Math.PI:n<44?-Math.PI+.04:Math.PI*.48):0;
    f.x+=Math.sin(f.angle)*speed*dt;f.z+=Math.cos(f.angle)*speed*dt;f.walk=n*dt*8;
    c.ImportedGladiator.animate(f,models[i],n*dt,dt);
   }
   if(n<20)continue;
   for(const key of ['RightHand','LeftHand']){
    const angle=localRotation(T,models[0],models[0].bones[key]).angleTo(localRotation(T,models[1],models[1].bones[key]));
    assert.ok(angle<.003,`${weapon} ${speed}m/s ${1/dt}Hz ${key} changed by ${angle} rad after heading change`);
   }
   for(const key of ['helmet','chest','shoulder']){
    const angle=localRotation(T,models[0],models[0].gear[key].group).angleTo(localRotation(T,models[1],models[1].gear[key].group));
    assert.ok(angle<.003,`${weapon} ${key} orientation differs after heading change: ${angle}`);
   }
   for(const [i,m]of models.entries())for(const side of ['Right','Left'])assert.ok(physicalGap(c,m,fighters[i],side)<.005,`${weapon} ${side} handle detached while turning`);
  }
  models.forEach(m=>c.ImportedGladiator.dispose(m));
 }
});
test('attack-to-guard carry follows the reachable palm while active strikes keep their sweep',async()=>{
 const c=await rigRuntime('arena.html'),T=c.THREE,m=c.ImportedGladiator.create(166,'retiarius'),f=fighter(c,'trident');
 Object.assign(f,{move:0,chest:true,chestModel:'chest_plate',helmet:true,shoulders:false,offhand:null});
 let time=0,guardCases=0;
 for(const weapon of ['trident','spear','gladius','sica'])for(const left of [false,true])for(const pose of ['idle','walk','attack','guard']){
  Object.assign(f,{weapon,offhand:left?weapon:null,action:pose==='attack'?'attack':'idle',attackLeft:left,attackWeapon:weapon,attackKind:'light',attackRegion:'chest',attackProfile:c.ArenaMotion.profile(weapon),blocking:pose==='guard',shield:pose==='guard'&&!left,move:pose==='walk'?1:0,reaction:0,guardFlash:0,timer:0});
  f.duration=f.attackProfile.duration;
  for(let n=0;n<45;n++){
   time+=1/60;f.timer=n/44*f.duration;f.walk=n/8;if(pose==='walk'){f.x+=.012;f.z+=.018;}
   c.ImportedGladiator.animate(f,m,time,1/60);
   for(const side of ['Left','Right']){
    if(!(side==='Right'?f.weapon:f.offhand)||!m.grip166?.[side]?.active)continue;
    const gap=physicalGap(c,m,f,side);
    assert.ok(gap<.005,`${weapon} ${pose} frame ${n} ${side} actual palm/handle gap ${gap}`);
   }
   if(pose==='guard'&&left&&n===0)guardCases++;
   if(pose==='attack'){
    const sample=c.ArenaMotion.sample(f),anchor=left?m.offhandAnchor:m.weaponAnchor;
    const expected=m.root.localToWorld(new T.Vector3(sample.grip.x,sample.grip.y,sample.grip.z));
    assert.ok(anchor.getWorldPosition(new T.Vector3()).distanceTo(expected)<1e-5,'Active attack segment must stay authoritative');
   }
  }
 }
 assert.equal(guardCases,4);c.ImportedGladiator.dispose(m);
});
