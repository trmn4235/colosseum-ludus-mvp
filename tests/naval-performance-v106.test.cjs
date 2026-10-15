const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../naval-performance-v106.js'),{rigRuntime}=require('./performance-v84.cjs');
const bytes=fs.readFileSync(require.resolve('../assets/naval/gladiator-lod-v106.bin'));
const buffer=()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
test('baked detail data is bounded, smaller, and rejects corrupt indices',()=>{
 const d=P.decode(buffer());assert.equal(d.indices/3,55228);assert.ok(d.levels[0].length/3<=18000);assert.ok(d.levels[1].length/3<=7500);
 const broken=buffer();new Uint32Array(broken)[5]=d.vertices;assert.throws(()=>P.decode(broken),/index/);
 assert.throws(()=>P.decode(buffer().slice(0,40)),/data/);
});
test('moving across detail boundaries does not flicker',()=>{
 assert.equal(P.level(6.2,0),0);assert.equal(P.level(6.2,1),1);assert.equal(P.level(5.4,1),0);
 assert.equal(P.level(18,1),1);assert.equal(P.level(18,2),2);assert.equal(P.level(16.9,2),1);
});
test('naval shadow budget retains the player and nearest allies/enemies',()=>{
 const fighters=Array.from({length:20},(_,id)=>({id,x:id*.2,z:0,hp:100}));
 P.beginFrame(fighters,fighters[0]);assert.deepEqual(fighters.filter(f=>P.shadow(f.id)).map(f=>f.id),[0,1,2,3]);
 fighters[1].hp=0;P.beginFrame(fighters,fighters[0]);assert.deepEqual(fighters.filter(f=>P.shadow(f.id)).map(f=>f.id),[0,2,3,4]);
 P.beginFrame(fighters,fighters[0],true);assert.equal(fighters.filter(f=>P.shadow(f.id)).length,8);
 assert.equal(P.shadowInterval('high',1.5),1000/30);assert.equal(P.shadowInterval('auto',1.25),50);assert.equal(P.shadowInterval('auto',1),1000/15);
});
test('distant pose work is staggered while keeping the full update cadence',()=>{
 const interval=P.interval(30),clocks=Array.from({length:19},(_,i)=>P.phase(i+1,interval)),counts=clocks.map(()=>0),loads=[];
 for(let frame=0;frame<600;frame++){let load=0;for(let i=0;i<clocks.length;i++){clocks[i]+=1/60;if(clocks[i]+1e-6>=interval){clocks[i]-=interval;counts[i]++;load++;}}loads.push(load);}
 assert.ok(counts.every(n=>n===200));assert.ok(Math.max(...loads)<=8,'avoid all 19 far skeletons updating together');assert.equal(P.interval(10),1/30);assert.equal(P.interval(30,true),1/30);
});
test('real rig LODs share skin data, preserve animation and restore full geometry nearby',async()=>{
 const c=await rigRuntime();c.console=console;vm.runInContext(fs.readFileSync(require.resolve('../naval-performance-v106.js'),'utf8'),c);await c.NavalPerformance.load(async()=>buffer());
 const a=c.ImportedGladiator.create(1),b=c.ImportedGladiator.create(2),p=c.ImportedGladiator.create(0);
 let original;a.visual.traverse(o=>{if(o.isSkinnedMesh)original=o.geometry;});
 c.NavalPerformance.character(a,{id:1},30);c.NavalPerformance.character(b,{id:2},30);c.NavalPerformance.character(p,{id:0},30);
 const far=a.navalBodies[0].mesh.geometry;assert.equal(far,b.navalBodies[0].mesh.geometry,'one shared distant body');assert.equal(p.navalBodies,undefined,'player always keeps original detail');
 for(const [name,attribute] of Object.entries(original.attributes))assert.equal(far.attributes[name],attribute,name+' is shared exactly');
 const fighter=new c.ArenaCombat(()=>.999).reset('normal','secutor').fighters[0];fighter.id=1;
 for(const action of ['idle','attack','dodge']){fighter.action=action;fighter.duration=.8;fighter.attackProfile=c.ArenaMotion.profile('gladius');fighter.attackKind='light';fighter.timer=.2;c.ImportedGladiator.animate(fighter,a,1,1/60);for(const [,bone]of a.boneEntries)assert.ok(bone.matrixWorld.elements.every(Number.isFinite));}
 c.NavalPerformance.character(a,{id:1},1);assert.equal(a.navalBodies[0].mesh.geometry,original);
 const crew=Array.from({length:20},(_,id)=>({id,x:id*.2,z:0,hp:100}));
 c.NavalPerformance.beginFrame(crew,crew[0],false,19);
 c.NavalPerformance.character(a,{id:10},1);assert.equal(a.navalBodies[0].mesh.geometry.index.count/3,18000,'crowded deck retains medium detail for the rest of the crew');
 c.NavalPerformance.character(a,{id:19},1);assert.equal(a.navalBodies[0].mesh.geometry,original,'focused opponent retains original geometry');
 c.NavalPerformance.beginFrame(crew,crew[0],true);c.NavalPerformance.character(a,{id:10},1);assert.equal(a.navalBodies[0].mesh.geometry,original,'explicit Detailed retains close original bodies');
});
test('uniform batching preserves world poses, visibility, shadows and equipment changes',async()=>{
 const c=await rigRuntime(),T=c.THREE;vm.runInContext(fs.readFileSync(require.resolve('../naval-performance-v106.js'),'utf8'),c);
 const scene=new T.Scene(),geo=new T.BoxGeometry(1,1,1),mat=new T.MeshStandardMaterial(),models=[];
 for(let id=1;id<=20;id++){const root=new T.Group(),group=new T.Group(),mesh=new T.Mesh(geo,mat);group.userData.navalUniform=true;group.add(mesh);root.add(group);root.position.set(id,2,3);scene.add(root);models.push({id,root,gear:{chest:{group}},gearRevisionV84:1});}
 const batch=c.NavalPerformance.uniforms(scene,()=>models);scene.updateMatrixWorld(true);scene.onBeforeRender();assert.equal(batch.metrics.draws,1);assert.equal(batch.metrics.instances,20);
 const inst=[...batch.batches.values()][0],matrix=new T.Matrix4();inst.getMatrixAt(0,matrix);assert.deepEqual([...matrix.elements],[...models[0].gear.chest.group.children[0].matrixWorld.elements]);
 models[0].gear.chest.group.visible=false;models[1].root.visible=false;scene.onBeforeRender();assert.equal(batch.metrics.instances,18);
 const mesh=models[2].gear.chest.group.children[0];mesh.castShadow=true;scene.onBeforeRender();assert.equal(batch.metrics.draws,2,'shadow and colour batches retain separate budgets');
 models[3].root.scale.x=-1;scene.updateMatrixWorld(true);scene.onBeforeRender();assert.equal(models[3].gear.chest.group.children[0].layers.mask,1,'mirrored geometry stays on its original path');
 models[4].gear.chest.group.userData.navalUniform=false;models[4].gearRevisionV84++;scene.onBeforeRender();assert.equal(models[4].gear.chest.group.children[0].layers.mask,1,'real inventory gear returns to original draw path');
 batch.dispose();assert.ok(models.every(m=>m.gear.chest.group.children[0].layers.mask===1));assert.ok(!scene.children.some(o=>o.isInstancedMesh));
});
