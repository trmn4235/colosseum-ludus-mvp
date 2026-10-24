/* Ready-made CC0 / credited 0 A.D. props; new masonry uses photographed stone. */
var PitDress=(()=>{
 async function build({T,root,half,width,depth,galleryY,box,rod,texture,timber,iron}){
  const material=(prefix,tint=0xffffff)=>new T.MeshStandardMaterial({map:texture('assets/pit-v177/'+prefix+'-color.webp',true),normalMap:texture('assets/pit-v177/'+prefix+'-normal.webp'),roughnessMap:texture('assets/pit-v177/'+prefix+'-rough.webp'),normalScale:new T.Vector2(.32,.32),roughness:1,metalness:0,color:tint});
  const masonry=material('large_sandstone_blocks',0xd6d0be),cap=material('old_sandstone_02',0xe1d9c7);
  cap.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),.72)*1.12;');};cap.customProgramCacheKey=()=> 'pit-neutral-stone-v177';
  const parts=[];const part=(...args)=>{parts.push(args[0]);return box(...args);};
  for(const sign of [-1,1])for(const axis of ['x','z']){
   const length=axis==='x'?width:depth,edge=sign*((axis==='x'?half.z:half.x)+.22);
   const at=(name,along,y,w,h,d,m)=>part(name,axis==='x'?along:edge,y,axis==='x'?edge:along,axis==='x'?w:d,h,axis==='x'?d:w,m,root,1.65);
   at('Masif taş parapet',0,galleryY+.43,length,.86,.44,masonry);
   const n=Math.ceil(length/1.35),span=length/n;
   for(let i=0;i<n;i++){
    const stone=at('Aşınmış taş parapet başlığı',-length/2+span*(i+.5),galleryY+.92,span-.014,.16,.58,cap);
    const p=stone.geometry.attributes.position;for(let k=0;k<p.count;k++)if(p.getY(k)>0)p.setY(k,p.getY(k)-.018*Math.abs((axis==='x'?p.getZ(k):p.getX(k))/.29));stone.geometry.computeVertexNormals();
   }
   const b=new T.Box3(new T.Vector3(axis==='x'?-length/2:edge-.36,galleryY,axis==='x'?edge-.36:-length/2),new T.Vector3(axis==='x'?length/2:edge+.36,galleryY+1.02,axis==='x'?edge+.36:length/2));root.userData.cameraObstacles.push(b);
  }
  for(const sx of [-1,1])for(const sz of [-1,1])part('Parapet köşe taşı',sx*(half.x+.2),galleryY+.49,sz*(half.z+.2),.61,.98,.61,cap);
  // Radial stone voussoirs provide depth above the existing wooden doors.
  for(const sign of [-1,1]){
   for(let i=0;i<11;i++){const a=(i+.5)/11*Math.PI,o=part('Kapı hafifletme kemer taşı',Math.cos(a)*1.43,2.27+Math.sin(a)*1.02,sign*(half.z-.12),.36,.27,.30,masonry);o.rotation.z=a-Math.PI/2;}
   part('Aşınmış kapı eşiği',0,.026,sign*(half.z-.16),2.38,.048,.48,cap);
   for(const x of [-half.x*.82,half.x*.82]){
    part('Duvar dibi taş tahliye ağzı',x,.17,sign*(half.z-.025),.48,.29,.08,cap);
    for(let n=0;n<3;n++)part('Tahliye gölge yarığı',x+(n-1)*.105,.17,sign*(half.z-.072),.047,.12,.02,iron);
   }
  }
  const paths={crate:'assets/pit-v177/wooden_crate_01.glb',bowl:'assets/pit-v177/wooden_bowl_01.glb',bucket:'assets/stable-v161/bucket.glb',basket:'assets/stable-v161/basket.glb',bench:'assets/pit-v175/bench.glb',bust:'assets/circus-v145/bust.glb',dining:'assets/dining/dining-kit-v54.glb'};
  const entries=await Promise.all(Object.entries(paths).map(async([key,path])=>[key,(await new T.GLTFLoader().loadAsync(path)).scene]));
  const models=Object.fromEntries(entries),props=[],contacts=[],bounds=[],plainMaterials=new Map();
  function place(key,name,x,y,z,height,angle=0,override){
   const source=key.includes(':')?models.dining.getObjectByName(key.split(':')[1]):models[key];if(!source)throw Error('Avlu nesnesi bulunamadı: '+key);
   const object=source.clone(true);object.position.set(0,0,0);object.rotation.set(0,angle,0);object.updateMatrixWorld(true);
   const b=new T.Box3().setFromObject(object),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3()),scale=height/size.y;object.scale.multiplyScalar(scale);object.position.set(x-center.x*scale,y-b.min.y*scale,z-center.z*scale);object.name=name;
   object.traverse(o=>{if(o.isMesh){if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();if(override){if(!plainMaterials.has(override)){const plain=override.clone();plain.vertexColors=false;plain.onBeforeCompile=override.onBeforeCompile;plain.customProgramCacheKey=override.customProgramCacheKey;plainMaterials.set(override,plain);}o.material=plainMaterials.get(override);}o.castShadow=o.receiveShadow=true;}});root.add(object);props.push(object);object.updateMatrixWorld(true);
   const real=new T.Box3().setFromObject(object),s=real.getSize(new T.Vector3());bounds.push(real);
   if(y<=galleryY+.03&&y>3){root.userData.obstacles.push({x,z,r:Math.max(s.x,s.z)*.48});root.userData.cameraObstacles.push(real.clone().expandByScalar(.12));}
   if(y<=galleryY+.03)contacts.push({x,z,y,sx:s.x*1.04,sz:s.z*1.04});return object;
  }
  for(const sign of [-1,1]){
   const x=sign*(half.x+3.15),z=-half.z+2.4;
   place('crate','Hazır kereste malzeme sandığı',x,galleryY,z,.59,sign*.08);
   place('dining:sack','Yedek donanım çuvalı',x,galleryY,z+1.05,.64,sign*.2);
   place('basket','Örgü teçhizat sepeti',x,galleryY,z+1.8,.38,sign*.4);
   place('bucket','Su istasyonu kovası',x,galleryY,-1.3,.43,sign*.15);
   place('bowl','Hazır ahşap su tası',x,galleryY+.59,z,.13,.2);
   place('bench','Yan galeri bekleme sırası',x,galleryY,half.z-2.5,.47,sign*Math.PI/2);
   place('dining:cauldron','Hazır avlu mangalı',sign*(half.x-.9),.015,-half.z+1,.58,0,iron);
   const water=new T.Mesh(new T.CircleGeometry(.14,24),new T.MeshStandardMaterial({color:0x708c86,transparent:true,opacity:.7,roughness:.22,metalness:.12}));water.name='Kovada durgun su';water.rotation.x=-Math.PI/2;water.position.set(x,galleryY+.32,-1.3);root.add(water);
   const cloth=new T.Mesh(new T.PlaneGeometry(.35,.43,8,8),new T.MeshStandardMaterial({map:texture('assets/pit-v174/linen-color.webp',true),normalMap:texture('assets/pit-v174/linen-normal.webp'),normalScale:new T.Vector2(.15,.15),color:0xd0c9b6,side:T.DoubleSide,roughness:1}));
   const cp=cloth.geometry.attributes.position;for(let i=0;i<cp.count;i++)cp.setZ(i,.014*Math.sin(cp.getX(i)*42));cloth.geometry.computeVertexNormals();cloth.rotation.x=-Math.PI/2;cloth.position.set(x,galleryY+.35,z+1.8);cloth.name='Sepette katlı keten bez';cloth.receiveShadow=true;root.add(cloth);
  }
  // The keeper's table now comes from the authored Kenney set rather than box legs.
  const remove=[];root.traverse(o=>{if(['Görevli yazı masası','Masa ayağı','Masa alt kaydı'].includes(o.name))remove.push(o);});remove.forEach(o=>o.removeFromParent());
  const deskWood=new T.MeshStandardMaterial({map:texture('assets/pit-v174/gate-color.webp',true),roughness:.94,color:0xffffff});
  const desk=place('dining:table','Hazır görevli yazı masası',2.55,galleryY,half.z+3.15,.83,0,deskWood);
  desk.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();const p=o.geometry.attributes.position,n=o.geometry.attributes.normal,uv=o.geometry.attributes.uv;for(let i=0;i<p.count;i++){const x=Math.abs(n.getX(i))>.5,y=Math.abs(n.getY(i))>.5;uv.setXY(i,(x?p.getZ(i):p.getX(i))*1.7,(y?p.getZ(i):p.getY(i))*1.7);}uv.needsUpdate=true;}});
  const carvedStone=new T.MeshStandardMaterial({color:0xb5b1a4,roughness:1,metalness:0});
  for(const sign of [-1,1]){
   part('Niş büst taşı',sign*5.5,galleryY+.48,-half.z-3.58,.52,.96,.48,cap);
   place('bust','Yontulmuş dekoratif büst',sign*5.5,galleryY+.96,-half.z-3.58,.65,sign*.12,carvedStone);
  }
  // Sagging cord replaces ruler-straight wooden-looking canopy ropes.
  const oldRopes=[];root.traverse(o=>{if(o.name==='Gölgelik gergi ipi')oldRopes.push(o);});
  const rope=new T.MeshStandardMaterial({color:0x9a8664,map:texture('assets/pit-v174/linen-color.webp',true),roughness:1});
  for(const old of oldRopes){old.updateMatrixWorld(true);const b=new T.Box3().setFromObject(old),mid=b.getCenter(new T.Vector3()),start=new T.Vector3(mid.x,b.max.y,b.min.z),end=new T.Vector3(mid.x,b.min.y,b.max.z);mid.y-=.09;const o=new T.Mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(start,mid,end),10,.012,5,false),rope);o.name='Sarkan keten gergi halatı';o.castShadow=true;root.add(o);old.removeFromParent();}
  for(const [i,c]of root.userData.cloths.filter(c=>c.awning).entries()){c.mesh.material=c.mesh.material.clone();c.mesh.material.color.setHex([0x925059,0x80444d,0x956068,0x873d4c][i%4]);const uv=c.mesh.geometry.attributes.uv;for(let n=0;n<uv.count;n++)uv.setXY(n,uv.getX(n)+i*.31,uv.getY(n)+i*.17);uv.needsUpdate=true;}
  // Wear patches use the downloaded stone photograph, with feathered edges.
  const wear=cap.clone();wear.vertexColors=false;wear.transparent=true;wear.opacity=.17;wear.depthWrite=false;wear.polygonOffset=true;wear.polygonOffsetFactor=-2;
  wear.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 wearUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nwearUv=uv;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 wearUv;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=1.-smoothstep(.2,.5,length(wearUv-.5));');};wear.customProgramCacheKey=()=> 'pit-stone-wear-v177';
  for(const sign of [-1,1])for(const x of [-6,0,6]){const o=new T.Mesh(new T.PlaneGeometry(1.3,.85),wear);o.name='Geçişte aşınmış taş yüzey';o.rotation.x=-Math.PI/2;o.rotation.z=x*.13;o.position.set(x,galleryY+.012,sign*(half.z+2.1));o.receiveShadow=true;root.add(o);}
  const shadowMaterial=new T.MeshBasicMaterial({color:0x29271f,transparent:true,opacity:.12,depthWrite:false});
  shadowMaterial.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 contact177;').replace('#include <begin_vertex>','#include <begin_vertex>\ncontact177=uv;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 contact177;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=1.-smoothstep(.18,.5,length(contact177-.5));');};shadowMaterial.customProgramCacheKey=()=> 'pit-prop-shadow-v177';
  const shadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),shadowMaterial,contacts.length),dummy=new T.Object3D();shadows.name='Hazır nesne temas gölgeleri';contacts.forEach((p,i)=>{dummy.position.set(p.x,p.y+.011,p.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(p.sx,p.sz,1);dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);});root.add(shadows);
  // Repeated authored geometry shares a mesh/material and one draw call.
  root.updateMatrixWorld(true);const groups=new Map();for(const prop of props)prop.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)){const k=o.geometry.uuid+o.material.uuid;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);}});
  for(const list of groups.values())if(list.length>1){const batch=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);batch.name='Örneklenmiş hazır avlu eşyaları';batch.castShadow=batch.receiveShadow=true;list.forEach((o,i)=>{batch.setMatrixAt(i,o.matrixWorld);o.removeFromParent();});batch.computeBoundingSphere();root.add(batch);}
  root.userData.dress177={props:props.map(o=>o.name),bounds:bounds.map(b=>({min:b.min.toArray(),max:b.max.toArray()})),parapet:true,parts};
 }
 return {build};
})();
