const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ArenaFrameState=require('../arena-frame-v65.js');
const fighter=()=>({id:0,x:0,z:0,angle:Math.PI-.1,walk:0,timer:0,deadTime:0,action:'idle',hp:100,stamina:63});
test('120 Hz display gets continuous root motion from unchanged 60 Hz simulation',()=>{
 const f=fighter(),states=new ArenaFrameState(),positions=[];let simulated=0;
 for(let frame=0;frame<12;frame++){if(frame%2===0){states.capture([f]);f.x+=.05;simulated++;}positions.push(states.sample(f,frame%2*.5).x);}
 for(let i=1;i<positions.length;i++)assert.ok(Math.abs(positions[i]-positions[i-1]-.025)<1e-10);
 assert.equal(simulated,6);assert.equal(f.x,.3);assert.equal(f.stamina,63);
});
test('presentation uses shortest angle path and never mutates authoritative combat',()=>{
 const f=fighter(),states=new ArenaFrameState();states.capture([f]);Object.assign(f,{x:.2,angle:-Math.PI+.1,timer:.2,walk:.4});
 const copy={...f},v=states.sample(f,.5);assert.ok(Math.abs(v.angle-Math.PI)<1e-10);assert.equal(v.timer,.1);assert.equal(v.walk,.2);assert.equal(v.x,.1);assert.deepEqual(f,copy);
});
test('new attacks, reset timers, teleports, death and reset do not replay old poses',()=>{
 const f=fighter(),states=new ArenaFrameState();states.capture([f]);Object.assign(f,{action:'attack',timer:.1});assert.equal(states.sample(f,.1).timer,.1);
 states.capture([f]);f.timer=0;assert.equal(states.sample(f,.1).timer,0);
 f.x=5;assert.equal(states.sample(f,0).x,5);f.hp=0;f.deadTime=.2;assert.equal(states.sample(f,0).deadTime,.2);
 states.reset();assert.equal(states.sample(f,0).x,5);
});
test('arena renders held equipment once and keeps corpse appearance intact',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../arena.html'),'utf8'),render=source.slice(source.indexOf('function renderWeapons(){'),source.indexOf('const projected=new THREE.Vector3()'));
 assert.ok(!render.includes('ClassEquipment.sync'),'the animation owns live/corpse equipment synchronization');
 assert.ok(source.includes('frameState.capture(combat.fighters)'));
 assert.ok(source.includes('frameState.sample(combat.fighters[i],renderAlpha)'));
});

// Exercise the production arena wrapper separately from the rig implementation:
// this catches scheduling/culling bugs that isolated animation tests cannot see.
function wrapperFixture({visible=true}={}){
 const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../arena.html'),'utf8');
 const start=source.indexOf('function animateCharacter('),end=source.indexOf('// Reusable rope geometry:',start),calls=[];
 const point=()=>({x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});return this;}});
 const ctx=vm.createContext({combat:{fighters:[{x:0,z:0}]},renderBound:{center:point()},renderFrustum:{intersectsSphere(){return visible;}},ImportedEquipment:{loaded:1},ImportedGladiator:{animate(f,m,t,dt){calls.push({f,t,dt});m.hasRendered=true;const gear=f.hp<=0&&f.corpseEquipment?f.corpseEquipment:f;
  if(m.equippedWeapon!==gear.weapon){m.equippedWeapon=gear.weapon;m.meshes=[{isMesh:true,material:{isMeshBasicMaterial:false},castShadow:true}];}
  m.assetRevision=1;m.offhandKind=gear.offhand;m.leftKind=gear.leftGear;m.shieldStyle=gear.shieldStyle;m.helmetStyle=gear.helmetStyle;m.chestModel=gear.chestModel;m.shoulderModel=gear.shoulderModel;m.team=f.team;
  if(f.hp<=0){if(m.fallTransition?.kind!=='dead')m.fallTransition={kind:'dead',started:f.deadTime,lastElapsed:f.deadTime};else m.fallTransition.lastElapsed=f.deadTime;m.lastFall={state:m.fallTransition};}
 }}});
 vm.runInContext(source.slice(start,end),ctx);
 const m={hasRendered:true,meshes:[{isMesh:true,material:{isMeshBasicMaterial:false},castShadow:true}],root:{position:point(),rotation:{y:0},visible:true,traverse(fn){for(const mesh of m.meshes)fn(mesh);}}};
 return {m,calls,setVisible(value){visible=value;},animate(f,dt=1/60){ctx.animateCharacter(f,m,0,dt);}};
}

test('distant root motion runs every display frame while poses retain 30 Hz cadence',()=>{
 const fixture=wrapperFixture(),f={...fighter(),id:1,x:20,weapon:'gladius'};
 for(let i=0;i<12;i++){f.x+=.01;fixture.animate(f,1/120);assert.equal(fixture.m.root.position.x,f.x);}
 assert.equal(fixture.calls.length,3);assert.ok(fixture.calls.every(c=>Math.abs(c.dt-1/30)<1e-10));
});

test('a frozen rendered rig keeps pending pose time without consuming it',()=>{
 const fixture=wrapperFixture(),f={...fighter(),x:1,weapon:'gladius'};
 fixture.m.poseDelta=.02;fixture.m.poseCadence=.02;fixture.animate(f,0);
 assert.equal(fixture.calls.length,0,'pause and hitstop must not reapply guard blending or IK');
 assert.equal(fixture.m.poseDelta,.02);assert.equal(fixture.m.poseCadence,.02);assert.equal(fixture.m.root.position.x,1);
});

test('an unrendered nearby rig may initialize with a zero delta',()=>{
 const fixture=wrapperFixture();fixture.m.hasRendered=false;fixture.animate({...fighter(),weapon:'gladius'},0);assert.equal(fixture.calls.length,1);
});

test('offscreen death captures its entry once and settles at the original death age',()=>{
 const fixture=wrapperFixture({visible:false}),f={...fighter(),id:1,x:20,weapon:'gladius'};
 fixture.animate(f);assert.equal(fixture.calls.length,0);
 Object.assign(f,{hp:0,action:'down',deadTime:.02,weapon:null,corpseEquipment:{weapon:'gladius'}});fixture.animate(f);
 assert.equal(fixture.calls.length,1,'death entry must be captured even while culled');assert.equal(fixture.m.fallTransition.started,.02);
 f.deadTime=3.1;fixture.animate(f);assert.equal(fixture.calls.length,1,'offscreen corpse does not run a full rig every frame');
 fixture.setVisible(true);fixture.animate(f);assert.equal(fixture.calls.length,2);assert.equal(fixture.m.lastFall.state.started,.02);assert.equal(fixture.m.lastFall.state.lastElapsed,3.1);
 fixture.animate(f);assert.equal(fixture.calls.length,2,'the genuinely settled corpse now skips rig work');assert.equal(fixture.m.equippedWeapon,'gladius','corpse presentation keeps its captured weapon');
});

test('new equipment receives the far-shadow policy after a skipped pose frame',()=>{
 const fixture=wrapperFixture(),f={...fighter(),id:1,x:20,weapon:'gladius'};
 fixture.animate(f,1/30);assert.equal(fixture.m.meshes[0].castShadow,false);
 f.weapon='spear';fixture.animate(f,1/120);assert.equal(fixture.m.equippedWeapon,'gladius','equipment sync waits for the next pose');
 fixture.animate(f,1/30);assert.equal(fixture.m.equippedWeapon,'spear');assert.equal(fixture.m.meshes[0].castShadow,false,'new meshes must receive the same distance policy');
});
