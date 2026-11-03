// Real source rig; CPU scene graph only. Browser verification is separate.
const {rigRuntime}=require('./performance-v84.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const c=await rigRuntime('savas.html'),T=c.THREE,v=new T.Vector3(),q=new T.Quaternion();
 let cases=0,maxPalmGap=0,maxTilt=0,minHead=Infinity;
 for(const type of Object.keys(c.ArenaClasses)){
  const m=c.ImportedGladiator.create(224,type),f=new c.ArenaCombat().reset('normal',type).fighters[0];
  for(const weapon of ['halberd','spear','mace','heavy_mace','gladius',null])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   Object.assign(f,{x:0,z:0,angle,weapon,shield:true,shieldStyle:'thraex',leftGear:null,offhand:null,presentation224:true,action:'idle',move:0,walk:0});
   const before=JSON.stringify(f);
   for(let i=0;i<3;i++)c.ImportedGladiator.animate(f,m,i/30,1/30);
   assert.equal(JSON.stringify(f),before,'preview must not mutate inventory or combat state');
   for(const [,bone]of m.boneEntries)assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
   const shield=m.gear.shield.group;
   const tilt=1-v.set(0,1,0).applyQuaternion(shield.getWorldQuaternion(q)).y;maxTilt=Math.max(maxTilt,tilt);assert.ok(tilt<1e-6,`${type}:${weapon}: shield upright`);
   const hand=m.bones.LeftHand,scale=hand.getWorldScale(new T.Vector3()).x;
   const palm=hand.localToWorld(new T.Vector3(0,.075,.025).divideScalar(scale)),handle=shield.localToWorld(new T.Vector3(0,0,-.075));
   const gap=palm.distanceTo(handle);maxPalmGap=Math.max(maxPalmGap,gap);assert.ok(gap<.005,'shield handle in palm');
   if(weapon==='mace'){
    const g=m.weaponAnchor.children[0],top=g.localToWorld(new T.Vector3(0,.43,0)),head=g.getObjectByName('flail-head').getWorldPosition(new T.Vector3());
    assert.ok(Math.abs(top.x-head.x)<1e-6&&Math.abs(top.z-head.z)<1e-6,'chain follows world gravity at every heading');
    assert.ok(Math.abs(top.y-head.y-.55)<1e-6,'chain length preserved');assert.ok(head.y>.18&&head.y<.30,'head spikes clear the floor');minHead=Math.min(minHead,head.y);
   }
   cases++;
  }
  c.ImportedGladiator.dispose(m);
 }
 console.log(JSON.stringify({cases,maxPalmGap,maxTilt,minHead,note:'CPU scene graph; no browser or physical phone claim'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
