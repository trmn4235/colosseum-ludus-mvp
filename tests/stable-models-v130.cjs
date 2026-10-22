const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const T=require('three'),root=path.resolve(__dirname,'..');
global.LudusStableEnvironment=require('../ludus-stable-environment-v131.js');
global.LudusHorseAppearance=require('../ludus-stable-appearance-v130.js');
const stable=require('../ludus-stable-room-v130.js');
(async()=>{
 const {GLTFLoader}=await import(pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js')).href);
 const requests=[];
 T.GLTFLoader=class {load(url,resolve,progress,reject){requests.push(url);const loader=new GLTFLoader();loader.register(parser=>({name:'geometry-test-no-image-decoder',beforeRoot(){parser.assignTexture=()=>Promise.resolve(null);}}));const data=fs.readFileSync(path.join(root,url));loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'').then(resolve,reject);}};
 const props=new T.Group(),colliders=[],shell={floor:new T.Mesh(),back:new T.Mesh(),front:new T.Mesh(),ceiling:new T.Mesh(),sides:[new T.Mesh(),new T.Mesh()]},ambient=new T.HemisphereLight(0xffffff,0x111111,2.5),light=new T.PointLight(0xffffff,65);let ownerHeight=1.93;
 const scene=new T.Scene(),outdoor=new T.Scene(),outdoorSun=new T.DirectionalLight(0xfff0d7,2.1);scene.background=new T.Color(0x28231e);const originalBackground=scene.background;outdoor.background=new T.Color(0xa6bdc8);outdoor.environment=new T.Texture();outdoorSun.position.set(-13,24,-16);outdoor.add(new T.HemisphereLight(0xe4efff,0x897654,1.35));
 const player={x:0,z:1},room=stable.create({T,props,colliders,shell,ambient,light,scene,outdoor,outdoorSun,wood:new T.MeshStandardMaterial(),stone:new T.MeshStandardMaterial(),getOwnerHeight:()=>ownerHeight,player,onError:e=>{throw Error(e);}});
 const horses=Array.from({length:12},(_,i)=>({id:'horse-'+i,name:'At '+i,coat:LudusHorseAppearance.coats[i%7].id,stage:i===11?'foal':'adult'}));
 room.setHerd(horses);room.select(horses[0]);room.enter();
 for(let i=0;i<500&&(!room.groom||room.horses.length<12);i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(room.horses.length,12);assert.ok(room.groom);assert.equal(room.root.userData.width,44);assert.equal(room.root.userData.depth,34);assert.equal(room.slots.length,12);assert.ok(room.root.userData.staticBatches<40);
 assert.equal(light.intensity,0,'interior lamp is off');assert.equal(ambient.intensity,1.35,'same skylight as the courtyard');assert.equal(scene.background,outdoor.background);assert.equal(scene.environment,outdoor.environment);
 const lamps=[];room.root.traverse(o=>{if(o.isLight)lamps.push(o);});assert.equal(lamps.length,1);assert.ok(lamps[0].isDirectionalLight,'sunlight is the only local light');assert.equal(room.root.userData.torchCount,0);assert.equal(room.root.userData.localLightLimit,0);assert.equal(room.root.userData.openAir,true);
 assert.equal(room.root.getObjectByName('Meşaleler · canlı alev'),undefined);
 room.root.updateMatrixWorld(true);const skyRay=new T.Raycaster();for(const z of [1,-6,-10,-17]){skyRay.set(new T.Vector3(0,2,z),new T.Vector3(0,1,0));assert.equal(skyRay.intersectObject(room.root,true).length,0,'uncovered training yard at '+z);}
 assert.equal(room.root.userData.wallHeight,5.6,'match the ludus courtyard side walls');
 assert.equal(new Set(room.slots.map(s=>s.z)).size,1,'all twelve rooms face the same training yard');
 for(const s of room.slots){const view=room.viewFor(horses[s.index].id);assert.ok(view.z>s.z+3,'inspection starts outside the half door');}
 outdoorSun.intensity=1.7;outdoorSun.color.set(0xfff5e6);room.tick(.04);assert.equal(lamps[0].intensity,1.7);assert.equal(lamps[0].color.getHex(),0xfff5e6,'courtyard light changes propagate');
 const uniqueMaterials=new Set();room.root.traverse(o=>{if(o.material&&!Array.isArray(o.material)&&o.material.isMeshStandardMaterial)uniqueMaterials.add(o.material);});
 for(const mat of uniqueMaterials){if(!/^stable-(surface|weather)-v131-/.test(mat.customProgramCacheKey()))continue;const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('vec2 stableSurfaceUv()'));assert.ok(shader.fragmentShader.includes('stableSurfaceUv() + dSTdx'),'bump sampling uses the same world coordinates as albedo');}
 for(const name of ['earth','timber','straw'])assert.ok(fs.statSync(path.join(root,'assets/stable-v131/'+name+'.webp')).size>10000);
 const size=o=>{props.updateMatrixWorld(true);o.updateMatrixWorld(true);o.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update();});return new T.Box3().setFromObject(o,true).getSize(new T.Vector3());};
 assert.ok(Math.abs(size(room.groom).y-ownerHeight)<.005,'actual skinned driver matches owner height');
 const bones={};room.groom.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});const hips=bones.Hips.getWorldPosition(new T.Vector3());
 for(const side of ['Left','Right']){const shoulder=bones[side+'Arm'].getWorldPosition(new T.Vector3()),elbow=bones[side+'ForeArm'].getWorldPosition(new T.Vector3()),hand=bones[side+'Hand'].getWorldPosition(new T.Vector3());assert.ok(elbow.y<shoulder.y-.2,'elbow rests below shoulder');assert.ok(hand.y<hips.y+.08,'hands hang naturally beside hips');assert.ok(Math.hypot(hand.x-shoulder.x,hand.z-shoulder.z)<.3,'arms remain close to the body');}
 ownerHeight=1.65;room.tick(.04);assert.ok(Math.abs(size(room.groom).y-ownerHeight)<.005,'owner height changes propagate without multiplying model scale');
 for(const h of room.horses){assert.ok(Math.abs(size(h).y-(h.userData.horseId==='horse-11'?2.12*.55:2.12))<.04);assert.ok(h.position.x<0?size(h).x<3.1:size(h).x<3.1);}
 assert.equal(new Set(room.horses.map(h=>h.userData.coat)).size,7);
 for(const h of room.horses){h.updateMatrixWorld(true);const head=h.getObjectByName('head'),pelvis=h.getObjectByName('pelvis');assert.ok(head.getWorldPosition(new T.Vector3()).z>pelvis.getWorldPosition(new T.Vector3()).z,'horse faces the open training yard');}
 // A clear route leads from the courtyard to every half door. The yard has no hidden old gate.
 for(let z=3;z>-20;z-=.25)assert.ok(!colliders.some(c=>0>=c.minX-.28&&0<=c.maxX+.28&&z>=c.minZ-.28&&z<=c.maxZ+.28));
 for(let x=-20;x<=20;x+=.25)assert.ok(!colliders.some(c=>x>=c.minX-.28&&x<=c.maxX+.28&&-18.2>=c.minZ-.28&&-18.2<=c.maxZ+.28));
 const selected=room.horse;room.leave();assert.equal(shell.floor.visible,true);assert.equal(ambient.intensity,2.5);assert.equal(light.intensity,65);assert.equal(scene.background,originalBackground);assert.equal(scene.environment,null);assert.equal(colliders.length,0);
 room.enter();await new Promise(r=>setTimeout(r,0));assert.equal(room.horse,selected);assert.equal(requests.filter(x=>x.endsWith('horse.glb')).length,1);assert.equal(requests.filter(x=>x.endsWith('driver.glb')).length,1);
 room.setHerd(horses.slice(0,2));assert.equal(room.horses.length,2);room.setHerd(horses);assert.equal(room.horses.length,12);assert.equal(requests.length,2);
 // Preserve an authored scaled parent, the regression that synthetic unit boxes miss.
 const scaled=new T.Group();scaled.scale.setScalar(.01);const m=new T.Mesh(new T.BoxGeometry(40,180,20));m.position.y=90;scaled.add(m);const normalized=stable.normalizeModel(T,scaled,1.78);assert.ok(Math.abs(size(normalized).y-1.78)<.001);assert.equal(scaled.scale.y,.01);
 for(const c of LudusHorseAppearance.coats){assert.ok(fs.existsSync(path.join(root,LudusHorseAppearance.photo(c.id))));const mat=LudusHorseAppearance.material(T,new T.MeshStandardMaterial(),c.id),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('stableRest = position'));assert.equal(shader.uniforms.stablePinto.value,c.id==='pinto'?1:0);}
 room.leave();console.log('PASS stable V159: actual horse/groom scale, 12 adjacent rooms facing the open sand yard, seven coats, clear door frontage, 5.6m walls, courtyard sunlight, no torches, relaxed groom arms and scene restoration.');
})().catch(e=>{console.error(e);process.exit(1)});
