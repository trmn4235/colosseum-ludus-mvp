/* Forest environment and battle host; encounter rules and rewards remain server-owned. */
(()=>{
 'use strict';
 const T=THREE,$=id=>document.getElementById(id),assets='assets/caravan-field-v125/';
 const coarse=matchMedia('(pointer:coarse)').matches,reduceMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const params=new URLSearchParams(location.search);let mode=params.get('mode')==='defense'?'defense':'ambush',walking=false,ready=false,lost=false,failed=false;
 const keys=new Set(),stick={x:0,y:0},mixers=[],collisions=[],clock={value:0},pointer={id:null,x:0,y:0},joystick={id:null};
 let renderer,scene,camera,ground,caravans=[],last=0,yaw=0,pitch=0,raf=0,frame=0,battle=null;
 let seed=125;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const roadX=z=>2.2*Math.sin(z*.055)+.5*Math.sin(z*.14);
 const height=(x,z)=>{const distance=Math.abs(x-roadX(z)),edge=T.MathUtils.smoothstep(distance,3.1,9);return edge*(.5+.32*Math.sin(x*.27+z*.17)+.15*Math.cos(z*.4))+.035*Math.sin(x*1.5+z*.5);};
 const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.9,...extra});
 let count=0,total=10;
 function progress(label){if(failed)return;count++;CaravanLoading.set('forest',count/total,label+' · '+count+' / '+total);}
 async function loadModel(name,label){
  const response=await fetch(assets+name+'.glb',{signal:AbortSignal.timeout(35000)});
  if(!response.ok)throw Error(label+' indirilemedi.');const buffer=await response.arrayBuffer();
  const gltf=await new T.GLTFLoader().parseAsync(buffer,'');progress(label);return gltf;
 }
 function texture(name,label){return new Promise((resolve,reject)=>{new T.TextureLoader().load(assets+name+'.webp',t=>{t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());if(name!=='road-normal')t.colorSpace=T.SRGBColorSpace;progress(label);resolve(t);},undefined,()=>reject(Error(label+' yüklenemedi.')));});}
 function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function segment(a,b,r,mat,parent){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),m=mesh(new T.CylinderGeometry(r,r,d.length(),7),mat,parent);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
 function cloneRig(source){const clone=source.clone(true),a=[],b=[];source.traverse(o=>a.push(o));clone.traverse(o=>b.push(o));const map=new Map(a.map((o,i)=>[o,b[i]]));source.traverse(o=>{if(o.isSkinnedMesh){const c=map.get(o);c.skeleton=o.skeleton.clone();c.skeleton.bones=o.skeleton.bones.map(bone=>map.get(bone));c.bindMatrix.copy(o.bindMatrix);c.bindMatrixInverse.copy(o.bindMatrixInverse);c.frustumCulled=false;}});return clone;}
 function wind(mat,threshold=2){
  mat.onBeforeCompile=shader=>{shader.uniforms.forestTime=clock;shader.vertexShader='uniform float forestTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat bend = clamp((position.y - '+threshold.toFixed(2)+') * 0.11, 0.0, 1.0);\ntransformed.x += sin(forestTime * 0.65 + position.y * 0.7 + position.z) * 0.045 * bend;\ntransformed.z += cos(forestTime * 0.5 + position.x) * 0.025 * bend;');};
  mat.customProgramCacheKey=()=> 'forest-wind-'+threshold;
 }
 function scatter(gltf,placements,{normalizeHeight=0,shadows=false,foliage=true}={}){
  const root=gltf.scene;root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const normalization=new T.Matrix4();if(normalizeHeight){const scale=normalizeHeight/size.y;normalization.makeScale(scale,scale,scale);normalization.multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));}
  const dummy=new T.Object3D();root.traverse(o=>{
   if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(normalization),mat=o.material.clone();mat.roughness=1;mat.metalness=0;
   if(foliage||mat.alphaTest>0||mat.transparent){mat.alphaTest=.42;mat.transparent=false;mat.side=T.DoubleSide;}
   if(foliage)wind(mat);const batch=new T.InstancedMesh(geometry,mat,placements.length);batch.name=o.name;batch.castShadow=shadows;batch.receiveShadow=true;
   placements.forEach((p,i)=>{dummy.position.set(p.x,height(p.x,p.z)+(p.y||0),p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,new T.Color().setRGB(p.tint||1,p.tint||1,p.tint||1));});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();scene.add(batch);
  });
 }
 function makeGround(road,floor,normal){
  floor.repeat.set(25,33);const mat=material(0xffffff,{map:floor,normalMap:normal,normalScale:new T.Vector2(.62,.62)});normal.repeat.set(25,33);
  mat.onBeforeCompile=s=>{s.uniforms.roadMap={value:road};s.vertexShader='varying vec3 vForestPosition;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvForestPosition=position;');s.fragmentShader='uniform sampler2D roadMap;\nvarying vec3 vForestPosition;\n'+s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float roadCenter=2.2*sin(vForestPosition.z*.055)+.5*sin(vForestPosition.z*.14);
    float noise=sin(vForestPosition.z*2.7+sin(vForestPosition.x*4.0))*.12+sin(vForestPosition.z*7.0)*.045;
    float roadWeight=1.0-smoothstep(2.45,3.5,abs(vForestPosition.x-roadCenter)+noise);
    vec4 roadColor=texture2D(roadMap,vec2((vForestPosition.x-roadCenter)*.24,vForestPosition.z*.24));
    float rut=1.0-.15*(1.0-smoothstep(.12,.28,abs(abs(vForestPosition.x-roadCenter)-.82)));
    diffuseColor.rgb=mix(diffuseColor.rgb*.76,roadColor.rgb*vec3(.98,.88,.76)*rut,roadWeight);
   `);};
  const g=new T.PlaneGeometry(128,164,128,164);g.rotateX(-Math.PI/2);const pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));g.computeVertexNormals();ground=mesh(g,mat,scene);ground.castShadow=false;
 }
 function makeForest(models){
  const kinds=['oak-a','oak-c','pine'],byKind=Object.fromEntries(kinds.map(k=>[k,[]]));
  for(const side of [-1,1])for(let row=0;row<4;row++)for(let i=0;i<18;i++){
   const z=-64+i*7.4+(random()-.5)*4,x=roadX(z)+side*(8.4+row*7+random()*3.5),scale=.78+random()*.45,kind=kinds[(i+row)%3];
   byKind[kind].push({x,z,angle:random()*Math.PI*2,scale,tint:.83+random()*.24});if(row<2)collisions.push({x,z,r:.5*scale});
  }
  for(const kind of kinds)scatter(models[kind],byKind[kind],{shadows:true});
  const near=[{x:-7.4,z:11,angle:1.1,scale:1.08},{x:11.5,z:4,angle:3,scale:1},{x:-15,z:-23,angle:2.3,scale:.93},{x:15,z:-30,angle:1.5,scale:1.15}];
  scatter(models['oak-near'],near.slice(0,2),{normalizeHeight:12,shadows:true});scatter(models['oak-umbrella'],near.slice(2),{normalizeHeight:12,shadows:true});
  near.forEach(p=>collisions.push({x:p.x,z:p.z,r:.8}));
 }
 function makeUnderstory(fern,bush,road,floor){
  const plants=[];for(let i=0;i<420;i++){const z=-45+random()*82,side=i%2?1:-1;let x=roadX(z)+side*(3.4+random()*10);if(z>3&&z<26&&Math.abs(x)<6.2)x=side*(7.7+random()*2);plants.push({x,z,angle:random()*6.28,scale:.65+random()*.8,tint:.8+random()*.3});}
  scatter(fern,plants,{normalizeHeight:.8,shadows:false});
  const shrubs=[];for(let i=0;i<170;i++){const z=-48+random()*86,side=i%2?1:-1;let x=roadX(z)+side*(3.8+random()*9);if(z>3&&z<26&&Math.abs(x)<7.5)x=side*(8.2+random()*3);shrubs.push({x,z,angle:random()*6.28,scale:.7+random()*.8,tint:.77+random()*.25});}scatter(bush,shrubs,{normalizeHeight:1.15,shadows:true});
  const geo=new T.IcosahedronGeometry(1,1),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const q=1+.13*Math.sin(pos.getX(i)*12+pos.getZ(i)*8);pos.setXYZ(i,pos.getX(i)*q,pos.getY(i)*q*.66,pos.getZ(i)*q);}geo.computeVertexNormals();
  const mat=material(0x858c74,{map:road}),rocks=new T.InstancedMesh(geo,mat,145),dummy=new T.Object3D();
  for(let i=0;i<145;i++){const z=-51+random()*94,side=i%2?1:-1,x=roadX(z)+side*(3.3+random()*9),scale=i<12?.55+random()*.75:.07+random()*.25;dummy.position.set(x,height(x,z)+scale*.24,z);dummy.rotation.set(random(),random()*6,random());dummy.scale.set(scale,scale*.65,scale*.9);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);rocks.setColorAt(i,new T.Color().setRGB(.73+random()*.25,.78+random()*.2,.66+random()*.2));if(scale>.7)collisions.push({x,z,r:scale*.7});}
  rocks.castShadow=true;rocks.receiveShadow=true;rocks.computeBoundingSphere();scene.add(rocks);
 }
 function clothTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const context=canvas.getContext('2d'),image=context.createImageData(256,256);let s=42;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){s=(Math.imul(s,1664525)+1013904223)>>>0;const grain=((s/4294967296)-.5)*14+(x%3===0?-9:0)+(y%3===0?-6:0),i=(y*256+x)*4;image.data[i]=220+grain;image.data[i+1]=205+grain;image.data[i+2]=174+grain;image.data[i+3]=255;}
  context.putImageData(image,0,0);const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,4);t.colorSpace=T.SRGBColorSpace;return t;
 }
 function makeCanopy(parent){
  const wood=material(0x63503a),rope=material(0x817251),cloth=material(0xffffff,{map:clothTexture(),side:T.DoubleSide}),n=40,m=30,positions=[],uv=[],indices=[];
  for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){const a=i/n*Math.PI,z=-1.95+j/m*3.8,wave=.015*Math.cos(j/m*Math.PI*12)*Math.sin(a)+.012*Math.sin(i*1.6+j*.7);positions.push(Math.cos(a)*(.90+wave),1.44+Math.sin(a)*(1.17+wave),z);uv.push(i/n,j/m);}
  for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();mesh(g,cloth,parent);
  for(let j=0;j<6;j++){const z=-1.94+j*.756;for(let i=0;i<18;i++){const a=i/18*Math.PI,b=(i+1)/18*Math.PI;segment([Math.cos(a)*.86,1.44+Math.sin(a)*1.13,z],[Math.cos(b)*.86,1.44+Math.sin(b)*1.13,z],.014,wood,parent);}}
  // Folded side curtains, tied to the bed rather than a solid cover over the opening.
  for(const side of [-1,1]){
   const curtain=new T.PlaneGeometry(3.8,.46,30,5),p=curtain.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*18)*.035);curtain.computeVertexNormals();const cm=mesh(curtain,cloth,parent,side*.91,1.24,-.05);cm.rotation.y=side*Math.PI/2;
   for(let j=0;j<6;j++)segment([side*.92,1.45,-1.9+j*.75],[side*.9,1.02,-1.9+j*.75],.008,rope,parent);
  }
 }
 function makeCargo(parent,wagon){
  let map;wagon.scene.traverse(o=>{if(o.isMesh&&!map)map=o.material.map;});const wood=material(0x857152,{map}),iron=material(0x433e32,{metalness:.55,roughness:.64}),sack=material(0xc0aa7c);
  for(const [x,y,z] of [[-.48,1.33,-1.25],[.4,1.33,-1.1]]){mesh(new T.CylinderGeometry(.22,.21,.59,16),wood,parent,x,y,z);for(const dy of [-.22,.22]){const hoop=mesh(new T.TorusGeometry(.22,.018,5,16),iron,parent,x,y+dy,z);hoop.rotation.x=Math.PI/2;}}
  mesh(new T.BoxGeometry(.55,.45,.64),wood,parent,.25,1.25,.3);const bag=mesh(new T.SphereGeometry(.3,12,8),sack,parent,-.4,1.25,.25);bag.scale.set(1,.65,1.2);
 }
 function mergeStatic(root,excluded){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),buckets=new Map(),remove=[];
  root.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh)return;for(let p=o;p;p=p.parent)if(p===excluded)return;
   let g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}
   for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
   if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   if(!buckets.has(o.material.uuid))buckets.set(o.material.uuid,{material:o.material,geometries:[]});buckets.get(o.material.uuid).geometries.push(g);remove.push(o);
  });
  for(const o of remove)o.removeFromParent();for(const {material,geometries}of buckets.values()){const geometry=ArenaGeometryUtils.mergeGeometries(geometries,false);if(geometry)mesh(geometry,material,root);for(const g of geometries)g.dispose();}
 }
 function makeCaravan(wagon,horse,z,scale=1){
  const root=new T.Group();root.position.set(roadX(z),height(roadX(z),z),z);root.scale.setScalar(scale);root.rotation.y=-.12;scene.add(root);
  const cart=wagon.scene.clone(true);cart.rotation.y=Math.PI;cart.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});root.add(cart);makeCanopy(root);makeCargo(root,wagon);
  const animal=cloneRig(horse.scene);animal.position.set(0,0,5.35);animal.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material=o.material.clone();o.material.emissiveMap=o.material.map;o.material.emissive.setHex(0xffffff);o.material.emissiveIntensity=.16;}});root.add(animal);
  const mixer=new T.AnimationMixer(animal),idleClip=horse.animations.find(c=>c.name==='idle_loop'),rearClip=horse.animations.find(c=>c.name==='rear'),idle=idleClip?mixer.clipAction(idleClip):null,rear=rearClip?mixer.clipAction(rearClip):null;
  if(idle){idle.play();mixer.setTime(random()*3);idle.timeScale=1.12;}if(rear){rear.setLoop(T.LoopOnce,1);rear.clampWhenFinished=true;}mixers.push(mixer);
  let startled=false,rearUntil=-1;
  function startle(){if(startled||!rear)return false;startled=true;rear.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.18).play();idle?.fadeOut(.18);rearUntil=mixer.time+rearClip.duration-.28;return true;}
  function settle(){if(rearUntil>=0&&mixer.time>=rearUntil){rear.fadeOut(.28);idle?.reset().fadeIn(.28).play();rearUntil=-1;}}
  const leather=material(0x342b20),wood=material(0x665037);
  for(const side of [-1,1]){
   segment([side*.6,.88,2.2],[side*.56,.84,5.55],.033,wood,root);
   const curve=new T.CatmullRomCurve3([new T.Vector3(side*.3,1.45,2.2),new T.Vector3(side*.42,1.28,4),new T.Vector3(side*.25,1.62,6.3)]);mesh(new T.TubeGeometry(curve,20,.009,5,false),leather,root);
  }
  mergeStatic(root,animal);caravans.push({root,animal,mixer,idle,rear,startle,settle,get startled(){return startled;}});return root;
 }
 function dust(){
  const pos=[];for(let i=0;i<90;i++)pos.push((random()-.5)*28,.5+random()*9,-25+random()*45);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  const points=new T.Points(g,new T.PointsMaterial({color:0xf1d899,size:.035,transparent:true,opacity:.27,depthWrite:false}));points.name='forest-dust';scene.add(points);return points;
 }
 function lookAtPoint(x,y,z){const delta=new T.Vector3(x,y,z).sub(camera.position);yaw=Math.atan2(-delta.x,-delta.z);pitch=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));applyLook();}
 function applyLook(){camera.rotation.set(pitch,yaw,0,'YXZ');}
 function setMode(next){
  mode=next;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  $('roleTitle').innerHTML=mode==='ambush'?'Gölgelerin<br>arasından.':'Kervanın<br>yanında.';
  $('roleCopy').innerHTML=mode==='ambush'?'Yolun kıyısında yerini al.<br>Kervanın geçeceği alanı keşfet.':'Yükü koruyacağın yolu tanı.<br>Kervanın çevresini keşfet.';
  $('locationName').textContent=mode==='ambush'?'Batı patikası':'Kervan hattı';$('locationDetail').textContent=mode==='ambush'?'Pusu başlangıç noktası':'Savunma başlangıç noktası';
  if(!ready)return;
  if(walking){const x=mode==='ambush'?-5:3.1,z=mode==='ambush'?7:4;camera.position.set(x,height(x,z)+1.72,z);lookAtPoint(0,1.5,1);}
  else{const portrait=innerHeight>innerWidth;if(portrait){camera.position.set(mode==='ambush'?4.6:-4.6,3.5,19.2);lookAtPoint(0,.35,2.4);}else{camera.position.set(mode==='ambush'?5.2:-4.8,mode==='ambush'?2.4:2.3,mode==='ambush'?10.6:11.2);lookAtPoint(-2.2,1.6,2.2);}}
 }
 function explore(value){if(!ready)return;walking=value;clearInput();document.body.classList.toggle('walking',walking);$('intro').hidden=walking;$('joystick').hidden=!walking||!coarse;$('overview').hidden=!walking;$('lookHint').textContent=walking?(coarse?'Sağı sürükle · Etrafa bak':'W A S D · Yürü / Sürükle · Bak'):'Etrafa bakmak için sürükle';setMode(mode);}
 function clearInput(){keys.clear();stick.x=stick.y=0;joystick.id=null;pointer.id=null;$('joystick').querySelector('span').style.transform='';}
 function move(dt){
  const x=stick.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),z=stick.y+(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),length=Math.max(1,Math.hypot(x,z));
  if(!x&&!z)return;const speed=3.5*dt/length,dx=(Math.cos(yaw)*x-Math.sin(yaw)*z)*speed,dz=(-Math.sin(yaw)*x-Math.cos(yaw)*z)*speed;
  const allowed=(px,pz)=>{
   if(Math.abs(px-roadX(pz))>15||pz< -32||pz>27)return false;
   if(collisions.some(c=>Math.hypot(c.x-px,c.z-pz)<c.r+.25))return false;
   for(const c of caravans){const p=c.root.worldToLocal(new T.Vector3(px,0,pz));if((Math.abs(p.x)<1.35&&p.z> -2.8&&p.z<3.85)||(Math.abs(p.x)<.75&&p.z>4&&p.z<6.9))return false;}
   return true;
  };
  if(allowed(camera.position.x+dx,camera.position.z))camera.position.x+=dx;
  if(allowed(camera.position.x,camera.position.z+dz))camera.position.z+=dz;
  camera.position.y=height(camera.position.x,camera.position.z)+1.72;
 }
 function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<innerHeight?56:53;camera.updateProjectionMatrix();if(!walking&&!battle)setMode(mode);renderRequired=true;}
 function fail(message){failed=true;CaravanLoading.fail(message);$('enter').disabled=true;}
 function bind(){
  $('enter').onclick=()=>explore(true);$('overview').onclick=()=>explore(false);$('retry').onclick=()=>location.reload();
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  for(const [button,id] of [['help','helpDialog'],['creditsOpen','creditsDialog']]){
   const d=$(id);$(button).onclick=()=>{clearInput();d.showModal();document.body.classList.add('dialog-open');};d.querySelectorAll('button').forEach(b=>b.onclick=()=>d.close());d.addEventListener('close',()=>{clearInput();document.body.classList.remove('dialog-open');});
  }
  addEventListener('keydown',e=>{if(battle||document.querySelector('dialog[open]'))return;if(e.code==='Escape'){explore(false);return;}if(walking&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',clearInput);
  const canvas=$('field');canvas.addEventListener('pointerdown',e=>{if(battle||!ready||pointer.id!==null||document.querySelector('dialog[open]'))return;pointer.id=e.pointerId;pointer.x=e.clientX;pointer.y=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;yaw-=dx*.0035;pitch=T.MathUtils.clamp(pitch-dy*.003,-.85,.85);applyLook();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(pointer.id===e.pointerId)pointer.id=null;});
  const pad=$('joystick');function padMove(e){const b=pad.getBoundingClientRect(),r=b.width*.36,dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2,l=Math.max(r,Math.hypot(dx,dy));stick.x=dx/l;stick.y=-dy/l;pad.querySelector('span').style.transform='translate('+stick.x*r+'px,'+-stick.y*r+'px)';}
  pad.addEventListener('pointerdown',e=>{if(joystick.id!==null)return;joystick.id=e.pointerId;pad.setPointerCapture(e.pointerId);padMove(e);});pad.addEventListener('pointermove',e=>{if(joystick.id===e.pointerId)padMove(e);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>{if(joystick.id===e.pointerId){joystick.id=null;stick.x=stick.y=0;pad.querySelector('span').style.transform='';}});
  document.addEventListener('visibilitychange',()=>{clearInput();last=0;if(!document.hidden&&!lost&&!raf)raf=requestAnimationFrame(tick);});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;fail('Görüntü bağlantısı kesildi. Alanı yeniden açabilirsin.');});
  addEventListener('resize',resize);addEventListener('pagehide',()=>{clearInput();cancelAnimationFrame(raf);raf=0;});addEventListener('pageshow',()=>{last=0;if(ready&&!lost&&!raf)raf=requestAnimationFrame(tick);});
  $('back').onclick=e=>{if(battle){e.preventDefault();battle.pause();return;}if(document.referrer&&new URL(document.referrer).origin===location.origin&&/\/ludus\.html$/.test(new URL(document.referrer).pathname)){e.preventDefault();history.back();}};
 }
 let quality,particles,detail,renderRequired=true;
 function tick(now){raf=0;if(document.hidden||lost)return;const dt=Math.min(last?(now-last)/1000:0,.05);last=now;
  const covered=document.querySelector('dialog[open],#loading:not([hidden]),.cb-overlay:not([hidden])');
  if(covered&&!renderRequired){quality.reset(now);raf=requestAnimationFrame(tick);return;}
  if(ready&&!document.querySelector('dialog[open]')){for(const mixer of mixers)mixer.update(dt);for(const c of caravans)c.settle();if(!reduceMotion){clock.value+=dt;if(particles)particles.position.y=Math.sin(clock.value*.2)*.18;}if(battle)battle.frame(dt);else if(walking)move(dt);}
  detail?.update(dt);renderer.render(scene,camera);renderRequired=false;frame++;
  const ratio=quality.sample(now,renderer.getPixelRatio());if(ratio!==null){renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);}
  raf=requestAnimationFrame(tick);
 }
 async function start(){
  bind();setMode(mode);
  try{
   renderer=new T.WebGLRenderer({canvas:$('field'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.75:2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=true;
   quality=new ArenaRuntime.AdaptiveQuality(Math.min(devicePixelRatio,coarse?1.75:2),1);scene=new T.Scene();scene.background=new T.Color(0xa2b3a0);scene.fog=new T.Fog(0xa4b3a8,35,104);camera=new T.PerspectiveCamera(53,innerWidth/innerHeight,.09,155);resize();
   scene.add(new T.HemisphereLight(0xc9dcec,0x67654b,1.6));const sun=new T.DirectionalLight(0xffe7c6,3.1);sun.position.set(-18,29,13);sun.target.position.set(0,0,-4);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;Object.assign(sun.shadow.camera,{left:-22,right:22,top:28,bottom:-25,near:1,far:80});sun.shadow.bias=-.00018;sun.shadow.normalBias=.035;
   const names=['horse','wagon','oak-a','oak-c','pine','fern','oak-near','oak-umbrella','bush'];total=names.length+3;
   let deadline;const loaded=await Promise.race([Promise.all([...names.map((name,i)=>loadModel(name,['At','Ahşap araba','Meşe ağaçları','Orman ağaçları','Çam ağaçları','Orman bitkileri','Yakın meşe','Geniş taçlı ağaç','Çalılıklar'][i])),texture('road','Toprak yol'),texture('forest-floor','Orman zemini'),texture('road-normal','Zemin ayrıntıları')]),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Yükleme zaman aşımına uğradı. Bağlantını kontrol edip yeniden dene.')),45000);})]).finally(()=>clearTimeout(deadline));
   const models=Object.fromEntries(names.map((name,i)=>[name,loaded[i]])),[road,floor,normal]=loaded.slice(names.length);
   makeGround(road,floor,normal);makeForest(models);makeUnderstory(models.fern,models.bush,road,floor);makeCaravan(models.wagon,models.horse,0);makeCaravan(models.wagon,models.horse,-14,.96);particles=dust();detail=CaravanDetail.create(T,scene,renderer,models.wagon,{height,mesh,segment,material,mergeStatic,collisions,coarse,reduceMotion});
   scene.updateMatrixWorld(true);renderer.shadowMap.needsUpdate=true;ready=true;setMode(mode);renderer.render(scene,camera);
   if(!params.has('raid'))CaravanLoading.finish();$('enter').disabled=false;$('enter').innerHTML='Alanı keşfet <span aria-hidden="true">↗</span>';document.body.dataset.ready='true';
   window.CaravanField={get ready(){return ready;},get mode(){return mode;},get walking(){return walking;},get stats(){return{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),position:camera.position.toArray(),instances:scene.children.filter(o=>o.isInstancedMesh).reduce((n,o)=>n+o.count,0)};},scene,camera,renderer,caravans,startleHorses(){return caravans.map(c=>c.startle());},setMode,explore,height,footDust:detail.footDust,get detail(){return detail;},attachBattle(controller){scene.traverse(o=>{if(o.isMesh)o.castShadow=false;});detail.battleShadow();for(const c of caravans)c.animal.traverse(o=>{if(o.isMesh)o.castShadow=true;});sun.intensity=2.65;clearInput();walking=false;battle=controller;document.body.classList.add('caravan-battle');$('intro').hidden=true;$('joystick').hidden=true;$('overview').hidden=true;}};
   if(!raf)raf=requestAnimationFrame(tick);
  }catch(e){console.error('Caravan field:',e);fail(e.name==='TimeoutError'?'Modeller zamanında yüklenemedi. Bağlantını kontrol edip yeniden dene.':e.message||'3D görüntü bu cihazda başlatılamadı.');}
 }
 start();
})();
