const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'arena.html'),'utf8');
function runtime(){
 const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(root,'owner-three-r160.js'),'utf8'),ctx);
 for(const name of ['ARENA_ANIMATION_FALLBACK','QUATERNIUS_COMBAT']){const start=html.indexOf('var '+name+'=');vm.runInContext(html.slice(start,html.indexOf('\n',start)),ctx);}
 vm.runInContext(fs.readFileSync(path.join(root,'arena-presentation-v65.js'),'utf8'),ctx);return ctx;
}
const c=runtime(),P=c.ArenaPresentation,T=c.THREE;
const fighter=(overrides={})=>({id:0,x:0,z:0,angle:0,hp:100,action:'idle',move:0,timer:0,blocking:false,weapon:'gladius',shield:true,...overrides});
const fallback={pose:()=>({poses:{untouched:[1,2,3]},bob:0,lean:0})};
function step(f,m,t,dt){return P.pose(f,m,t,dt,fallback);}
function finite(p){for(const a of Object.values(p.poses))for(const n of a)assert.ok(Number.isFinite(n));for(const k of ['bob','lean','roll'])if(k in p)assert.ok(Number.isFinite(p[k]));}
function rig(){
 const group=new T.Group(),bones={},rest=new Map();
 function bone(name,parent,x,y,z){const b=new T.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);bones[name]=b;return b;}
 const hips=bone('Hips',group,0,1,0),spine=bone('Spine',hips,0,.12,0),spine1=bone('Spine1',spine,0,.12,0),spine2=bone('Spine2',spine1,0,.12,0),neck=bone('Neck',spine2,0,.12,0);bone('Head',neck,0,.10,0);
 for(const [side,sign] of [['Left',1],['Right',-1]]){
  const shoulder=bone(side+'Shoulder',spine2,sign*.1,0,0),arm=bone(side+'Arm',shoulder,sign*.12,0,0),forearm=bone(side+'ForeArm',arm,sign*.24,-.08,0);bone(side+'Hand',forearm,sign*.22,-.08,0);
  const leg=bone(side+'UpLeg',hips,sign*.12,-.12,0),knee=bone(side+'Leg',leg,0,-.4,0),foot=bone(side+'Foot',knee,0,-.4,0);bone(side+'ToeBase',foot,0,-.04,.12);
 }
 group.updateMatrixWorld(true);for(const [n,b]of Object.entries(bones))rest.set(n,{q:b.quaternion.clone(),p:b.parent.getWorldQuaternion(new T.Quaternion())});
 const weaponAnchor=new T.Group(),offhandAnchor=new T.Group();bones.RightHand.add(weaponAnchor);bones.LeftHand.add(offhandAnchor);weaponAnchor.add(new T.Group());offhandAnchor.add(new T.Group());
 const anchor=new T.Group();bones.LeftHand.add(anchor);anchor.add(new T.Group());return{root:group,bones,rest,weaponAnchor,offhandAnchor,gear:{shield:{anchor}}};
}
function align(bone,end,target){const origin=bone.getWorldPosition(new T.Vector3()),current=end.getWorldPosition(new T.Vector3()).sub(origin).normalize(),desired=target.clone().sub(origin).normalize(),world=bone.getWorldQuaternion(new T.Quaternion()),parent=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();bone.quaternion.copy(parent.multiply(new T.Quaternion().setFromUnitVectors(current,desired)).multiply(world));bone.updateWorldMatrix(false,true);}

test('all gait tracks have continuous value and velocity at the loop seam',()=>{
 for(const name of ['idle','walk','run'])for(const values of Object.values(c.ARENA_ANIMATION_FALLBACK.clips[name].tracks))for(let axis=0;axis<3;axis++){
  const h=1e-6,at=P.sampleTrack(values,0,axis),before=P.sampleTrack(values,1-h,axis),after=P.sampleTrack(values,h,axis);
  assert.ok(Math.abs(after-before)<.00005);assert.ok(Math.abs((at-before)/h-(after-at)/h)<.002);
 }
});
test('walk, run, reverse, strafe and stop stay finite and continuous',()=>{
 const f=fighter(),m={};let previous=null,maxStep=0,maxRun=0,sawSide=false;
 for(let i=0;i<840;i++){
  const time=i/120,speed=time<1?time*3:time<2?3:time<3?3*(3-time):time<5?1.6:0;
  f.move=speed?1:0;f.x+=time>=3&&time<4?speed/120:0;f.z+=time<3?speed/120:time>=4&&time<5?-speed/120:0;
  if(time>=3)f.angle=0;
  const p=step(f,m,time,1/120);finite(p);const now=Object.values(p.poses).flat();if(previous)for(let j=0;j<Math.min(now.length,previous.length);j++)maxStep=Math.max(maxStep,Math.abs(now[j]-previous[j]));previous=now;maxRun=Math.max(maxRun,m.presentationState.run);if(Math.abs(p.poses.LeftUpLeg[2])>.05)sawSide=true;
 }
 assert.ok(maxRun>.4);assert.ok(sawSide,'strafing requires lateral leg travel');assert.ok(maxStep<.1,'max joint target step '+maxStep);assert.ok(m.presentationState.weight<.001,'stop settles');
});
test('presentation does not mutate a fighter or authoritative action pose',()=>{
 const f=Object.freeze(fighter({action:'attack',timer:.3,move:1})),before=JSON.stringify(f),m={},source={poses:{Hips:[.1,.2,.3]},sword:true,bob:.01,lean:.04},fallback={pose:()=>source};
 assert.equal(step(f,m,0,0).poses.untouched[0],1);assert.equal(P.pose(f,m,.1,1/60,fallback),source);assert.equal(JSON.stringify(f),before);
});
test('a teleport cannot make a run or body lean impulse',()=>{
 const f=fighter({move:1}),m={};step(f,m,0,1/60);f.x=30;f.z=40;const p=step(f,m,1/60,1/60);assert.equal(m.presentationState.speed,0);assert.equal(m.presentationState.weight,0);assert.equal(p.lean,0);
});
test('held guard leaves all locomotion leg quaternions untouched',()=>{
 const f=fighter({blocking:true,move:1}),m=rig();for(let i=0;i<120;i++){f.z+=1.5/60;step(f,m,i/60,1/60);}
 const legs=Object.keys(m.bones).filter(n=>/(Leg|Foot|ToeBase)$/.test(n));legs.forEach((n,i)=>m.bones[n].rotation.set(.08+i*.015,.02,0));
 const before=Object.fromEntries(legs.map(n=>[n,m.bones[n].quaternion.toArray()]));let calls=0;
 assert.equal(P.applyAuthored(f,m,2,1/60,(...args)=>{calls++;align(...args);},{apply(){throw Error('Guard fallback must not run');}}),true);
 for(const n of legs)assert.deepEqual(m.bones[n].quaternion.toArray(),before[n]);assert.equal(calls,4);assert.equal(m.authoredClip,'guard');
});
test('guard entry and release weights do not jump, and settle fully',()=>{
 const f=fighter(),m={};step(f,m,0,1/120);let previous=0,maxStep=0;
 for(let i=1;i<=240;i++){f.blocking=i<90;step(f,m,i/120,1/120);maxStep=Math.max(maxStep,Math.abs(m.presentationState.guard-previous));previous=m.presentationState.guard;}
 assert.ok(maxStep<.19);assert.ok(m.presentationState.guard<1e-8);
});
test('strike wind-up starts from the last rendered hand; active contact is exact',()=>{
 const f=fighter(),m={};step(f,m,0,1/60);m.presentationState.hand.right={grip:{x:-.35,y:1.05,z:.02},dir:{x:0,y:-1,z:0}};
 f.action='attack';f.attackProfile={wind:.26};f.timer=0;const sample={grip:{x:-.24,y:1.32,z:.29},dir:{x:0,y:.12,z:.99277},active:false};
 const a=P.strike(f,m,sample);assert.deepEqual(JSON.parse(JSON.stringify(a.grip)),m.presentationState.hand.right.grip);
 f.timer=.06;const b=P.strike(f,m,sample);assert.ok(b.grip.y>a.grip.y&&b.grip.y<sample.grip.y);
 f.timer=.26;const active={...sample,active:true};assert.equal(P.strike(f,m,active),active);
 f.timer=.55;assert.equal(P.strike(f,m,sample),sample,'recovery preserves authored trajectory');
});
test('strike release blends back to the current locomotion arm and expires',()=>{
 const f=fighter({action:'attack',timer:.8}),m=rig();step(f,m,0,1/60);P.strike(f,m,{grip:{x:-.24,y:1.32,z:.29},dir:{x:0,y:0,z:1},active:false});f.action='idle';
 let sampled=0;for(let i=0;i<20;i++){step(f,m,i/60,1/60);const p=P.strike(f,m,null);if(p){sampled++;assert.equal(p.presentationOnly,true);assert.equal(p.active,false);assert.ok(Object.values(p.grip).every(Number.isFinite));}}
 assert.ok(sampled>0&&sampled<10);assert.equal(m.presentationState.lastStrike,null);
});
test('guard contact matches the authoritative point and release returns the anchor',()=>{
 c.ArenaMotion={guardPoint:()=>({x:.26,y:1.42,z:.29})};const f=fighter(),m=rig(),points=[];step(f,m,0,1/60);P.finish(f,m);
 f.blocking=true;for(let i=0;i<7;i++){step(f,m,i/60,1/60);P.shield(f,m,i/60,1/60,(_m,_left,p)=>points.push({...p}));}
 assert.ok(points[0].y<1.42);assert.deepEqual(points.at(-1),{x:.26,y:1.42,z:.29});
 f.blocking=false;for(let i=0;i<12;i++){step(f,m,i/60,1/60);P.shield(f,m,i/60,1/60,()=>{});}
 assert.deepEqual(Array.from(m.gear.shield.anchor.position.toArray()),[0,0,0]);assert.equal(m.presentationState.shieldPoint,null);
});
test('retargeting a non-guard special delegates unchanged',()=>{
 const f=fighter({action:'bash'}),m=rig();step(f,m,0,1/60);let called=false;
 assert.equal(P.applyAuthored(f,m,0,1/60,align,{apply(...args){called=true;assert.equal(args[0],f);assert.equal(args[1],m);return 7;}}),7);assert.ok(called);
});

test('guard region changes and quick re-raises preserve the last rendered pose',()=>{
 c.ArenaMotion={guardPoint:f=>({x:.26,y:f.guardRegion==='head'?1.9:1.42,z:.29})};const f=fighter({guardRegion:'chest'}),m=rig();step(f,m,0,1/120);P.finish(f,m);
 const targets=[];const reach=(_m,_left,p)=>targets.push({...p});
 for(let i=0;i<30;i++){f.blocking=true;step(f,m,i/120,1/120);P.shield(f,m,i/120,1/120,reach);P.finish(f,m);}
 const chest=targets.at(-1);f.guardRegion='head';step(f,m,1,1/120);P.shield(f,m,1,1/120,reach);P.finish(f,m);
 assert.ok(targets.at(-1).y-chest.y<.02,'target changes should not pop to the new region');
 f.blocking=false;for(let i=0;i<4;i++){step(f,m,1+i/120,1/120);P.shield(f,m,1+i/120,1/120,reach);P.finish(f,m);}
 const before=m.gear.shield.anchor.quaternion.clone();f.blocking=true;step(f,m,2,1/120);P.shield(f,m,2,1/120,reach);
 assert.ok(before.angleTo(m.gear.shield.anchor.quaternion)<.05,'interrupted raise starts from last orientation');
});
test('unshielded block smooths its hand and never overrides a new attack',()=>{
 const f=fighter({shield:false,guardRegion:'head'}),m=rig(),points=[];step(f,m,0,1/120);P.finish(f,m);f.blocking=true;
 for(let i=0;i<15;i++){step(f,m,i/120,1/120);P.block(f,m,i/120,1/120,(_m,left,p)=>{assert.equal(left,false);points.push({...p});});}
 assert.ok(points[0].y<1.9);assert.equal(points.at(-1).y,1.9);f.action='attack';step(f,m,1,1/120);P.block(f,m,1,1/120,()=>assert.fail('No defensive hand IK may overwrite a strike'));assert.equal(m.presentationState.blockPoint,null);
});

test('every weapon hand and chain keeps active collision samples verbatim',()=>{
 for(const weapon of ['gladius','sica','spear','trident','mace','whip',null])for(const left of [false,true])for(const chain of [1,2,3])for(const kind of ['light','heavy']){
  const f=fighter({weapon,action:'attack',attackLeft:left,chain,attackKind:kind,attackProfile:{wind:.3},timer:.31}),m={};step(f,m,0,1/60);
  m.presentationState.hand[left?'left':'right']={grip:{x:-.4,y:1,z:0},dir:{x:0,y:-1,z:0}};
  const sample={grip:{x:left?.24:-.24,y:1.5,z:.5},dir:{x:.2,y:.1,z:Math.sqrt(.95)},active:true,points:[{x:0,y:0,z:0}]};
  assert.equal(P.strike(f,m,sample),sample);assert.equal(sample.points.length,1);
 }
});

for(const page of ['savas.html','multiplayer.html'])test(page+': legacy motion without guardPoint supports shield and unshielded guard',()=>{
 const source=fs.readFileSync(path.join(root,page),'utf8'),start=source.indexOf('var ArenaMotion='),end=source.indexOf('})();',start)+5;
 const legacy=vm.createContext({});vm.runInContext(source.slice(start,end),legacy);assert.equal(typeof legacy.ArenaMotion.guardPoint,'undefined');
 const saved=c.ArenaMotion;c.ArenaMotion=legacy.ArenaMotion;
 try{
  for(const shield of [true,false]){const f=fighter({shield,blocking:true,guardRegion:'head'}),m=rig(),points=[];
   for(let i=0;i<20;i++){step(f,m,i/60,1/60);P[shield?'shield':'block'](f,m,i/60,1/60,(_m,_left,p)=>points.push({...p}));P.finish(f,m);}
   assert.deepEqual(points.at(-1),{x:.26,y:1.42,z:.29});assert.ok(points.every(p=>Object.values(p).every(Number.isFinite)));
  }
 }finally{c.ArenaMotion=saved;}
});
