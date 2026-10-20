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
 const player={x:0,z:1},room=stable.create({T,props,colliders,shell,ambient,light,wood:new T.MeshStandardMaterial(),stone:new T.MeshStandardMaterial(),getOwnerHeight:()=>ownerHeight,player,onError:e=>{throw Error(e);}});
 const horses=Array.from({length:12},(_,i)=>({id:'horse-'+i,name:'At '+i,coat:LudusHorseAppearance.coats[i%7].id,stage:i===11?'foal':'adult'}));
 room.setHerd(horses);room.select(horses[0]);room.enter();
 for(let i=0;i<500&&(!room.groom||room.horses.length<12);i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(room.horses.length,12);assert.ok(room.groom);assert.equal(room.root.userData.width,30);assert.equal(room.root.userData.depth,54);assert.equal(room.slots.length,12);assert.ok(room.root.userData.staticBatches<40);
 assert.equal(light.intensity,0,'ceiling light is off inside the stable');assert.ok(ambient.intensity<.5,'ambient light does not flatten the torch lighting');
 const lamps=[];room.root.traverse(o=>{if(o.isLight)lamps.push(o);});assert.equal(lamps.length,6);assert.ok(lamps.every(l=>l.isPointLight&&!l.castShadow));assert.equal(room.root.userData.torchCount,16);
 assert.ok(lamps.every(l=>l.position.z>=-13),'entrance illumination comes from nearby visible torches');
 const fire=room.root.getObjectByName('Meşaleler · canlı alev');assert.equal(fire.count,32);assert.ok(fire.material.vertexShader.includes('#include <logdepthbuf_vertex>'));assert.ok(fire.material.fragmentShader.includes('#include <logdepthbuf_fragment>'),'flames use the same logarithmic depth as the scene');
 player.z=-48;room.tick(.04);assert.ok(lamps.every(l=>l.position.z<=-34&&Math.abs(Math.abs(l.position.x)-3.13)<.001),'rear illumination moves to real rear torch positions');assert.ok(lamps.every(l=>l.intensity>90&&l.intensity<115));player.z=1;
 const uniqueMaterials=new Set();room.root.traverse(o=>{if(o.material&&!Array.isArray(o.material)&&o.material.isMeshStandardMaterial)uniqueMaterials.add(o.material);});
 for(const mat of uniqueMaterials){if(!/^stable-(surface|weather)-v131-/.test(mat.customProgramCacheKey()))continue;const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('vec2 stableSurfaceUv()'));assert.ok(shader.fragmentShader.includes('stableSurfaceUv() + dSTdx'),'bump sampling uses the same world coordinates as albedo');}
 for(const name of ['earth','timber','straw'])assert.ok(fs.statSync(path.join(root,'assets/stable-v131/'+name+'.webp')).size>10000);
 const size=o=>{props.updateMatrixWorld(true);o.updateMatrixWorld(true);o.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update();});return new T.Box3().setFromObject(o,true).getSize(new T.Vector3());};
 assert.ok(Math.abs(size(room.groom).y-ownerHeight)<.005,'actual skinned driver matches owner height');
 ownerHeight=1.65;room.tick(.04);assert.ok(Math.abs(size(room.groom).y-ownerHeight)<.005,'owner height changes propagate without multiplying model scale');
 for(const h of room.horses){assert.ok(Math.abs(size(h).y-(h.userData.horseId==='horse-11'?2.12*.55:2.12))<.04);assert.ok(h.position.x<0?size(h).x<3.1:size(h).x<3.1);}
 assert.equal(new Set(room.horses.map(h=>h.userData.coat)).size,7);
 for(const h of room.horses){h.updateMatrixWorld(true);const head=h.getObjectByName('head'),pelvis=h.getObjectByName('pelvis');assert.ok(Math.abs(head.getWorldPosition(new T.Vector3()).x)<Math.abs(pelvis.getWorldPosition(new T.Vector3()).x),'horse faces the central aisle');}
 // Every point down the central corridor remains traversable, including the new rear area.
 for(let z=3;z>-48;z-=.25)assert.ok(!colliders.some(c=>0>=c.minX-.28&&0<=c.maxX+.28&&z>=c.minZ-.28&&z<=c.maxZ+.28));
 const selected=room.horse;room.leave();assert.equal(shell.floor.visible,true);assert.equal(ambient.intensity,2.5);assert.equal(light.intensity,65);assert.equal(colliders.length,0);
 room.enter();await new Promise(r=>setTimeout(r,0));assert.equal(room.horse,selected);assert.equal(requests.filter(x=>x.endsWith('horse.glb')).length,1);assert.equal(requests.filter(x=>x.endsWith('driver.glb')).length,1);
 room.setHerd(horses.slice(0,2));assert.equal(room.horses.length,2);room.setHerd(horses);assert.equal(room.horses.length,12);assert.equal(requests.length,2);
 // Preserve an authored scaled parent, the regression that synthetic unit boxes miss.
 const scaled=new T.Group();scaled.scale.setScalar(.01);const m=new T.Mesh(new T.BoxGeometry(40,180,20));m.position.y=90;scaled.add(m);const normalized=stable.normalizeModel(T,scaled,1.78);assert.ok(Math.abs(size(normalized).y-1.78)<.001);assert.equal(scaled.scale.y,.01);
 for(const c of LudusHorseAppearance.coats){assert.ok(fs.existsSync(path.join(root,LudusHorseAppearance.photo(c.id))));const mat=LudusHorseAppearance.material(T,new T.MeshStandardMaterial(),c.id),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('stableRest = position'));assert.equal(shader.uniforms.stablePinto.value,c.id==='pinto'?1:0);}
 room.leave();console.log('PASS stable V131: actual horse/groom scale, 12 stalls, seven coats, clear 30×54 aisle, 16 torch fixtures, six reused lights, logarithmic flame depth, textured materials and scene restoration.');
})().catch(e=>{console.error(e);process.exit(1)});
