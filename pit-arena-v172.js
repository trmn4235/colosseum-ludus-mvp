/* Original Şan Avlusu: pentagonal exterior, rectangular sand bounded by full-height walls. */
var PitArena=(()=>{
 const bounds=Object.freeze({x:7.55,z:5.55}),wallHeight=3.4;
 function clamp(p){p.x=Math.max(-bounds.x,Math.min(bounds.x,p.x));p.z=Math.max(-bounds.z,Math.min(bounds.z,p.z));return p;}
 async function load(scene,renderer){
  const T=THREE,root=new T.Group();root.name='Şan Avlusu · Beşgen dış yapı / dikdörtgen iç kum';root.userData.pit=true;
  const loader=new T.TextureLoader();
  function texture(file,repeat){const t=loader.load(file,()=>{t.needsUpdate=true;},undefined,()=>{});t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()||1);return t;}
  const plaster=new T.MeshStandardMaterial({map:texture('assets/textures/white_plaster_02-diff-6aa57de97b10.webp',[3,1]),color:0xe0c79f,roughness:.95}),stone=new T.MeshStandardMaterial({map:texture('assets/textures/stone_wall_02-diff-48c8a82a57aa.webp',[3,1]),color:0xcebea2,roughness:1}),sand=new T.MeshStandardMaterial({map:texture('assets/textures/sand_01-diff-05b825608ef2.webp',[7,5]),color:0xdfc59b,roughness:1}),wood=new T.MeshStandardMaterial({color:0x493222,roughness:1}),red=new T.MeshStandardMaterial({color:0x753c31,roughness:1,side:T.DoubleSide}),linen=new T.MeshStandardMaterial({color:0xd7bf93,roughness:1,side:T.DoubleSide});
  function box(name,x,y,z,w,h,d,m=plaster,angle=0){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.rotation.y=angle;o.castShadow=o.receiveShadow=true;root.add(o);return o;}
  // Sand meets vertical wall faces at x=±8,z=±6: no curbs, paving or inner boundary ring.
  const floor=new T.Mesh(new T.PlaneGeometry(16,12),sand);floor.name='Kesintisiz dikdörtgen kum';floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;root.add(floor);
  const walls=new T.Group();walls.name='Dövüş alanının duvarları';root.add(walls);
  for(const [x,z,w,d]of [[0,-6.35,16.7,.7],[0,6.35,16.7,.7],[-8.35,0,.7,12],[8.35,0,.7,12]]){
   const o=box('İç sınır duvarı',x,wallHeight/2,z,w,wallHeight,d);walls.attach(o);
   box('Duvar üstü seyirci platformu',x,3.45,z,w+.5,.18,d+.5,stone);
  }
  // A five-sided outer envelope surrounds the four-sided inner court, with elevated galleries between them.
  const vertices=Array.from({length:5},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/5;return {x:Math.cos(a)*13,z:Math.sin(a)*13};});
  const shape=new T.Shape();vertices.forEach((v,i)=>i?shape.lineTo(v.x,-v.z):shape.moveTo(v.x,-v.z));shape.closePath();
  const hole=new T.Path();hole.moveTo(-8,-6);hole.lineTo(-8,6);hole.lineTo(8,6);hole.lineTo(8,-6);hole.closePath();shape.holes.push(hole);
  const deck=new T.Mesh(new T.ShapeGeometry(shape),stone);deck.name='Beşgen üst galeri';deck.rotation.x=-Math.PI/2;deck.position.y=3.4;deck.receiveShadow=true;root.add(deck);
  vertices.forEach((a,i)=>{const b=vertices[(i+1)%5],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);box('Beşgen dış duvar '+(i+1),(a.x+b.x)/2,1.9,(a.z+b.z)/2,length,3.8,.55,plaster,angle);});
  // Tall gates remain collision boundaries during a bout.
  for(const z of [-5.97,5.97]){box('Ahşap arena kapısı',0,1.25,z,2.15,2.5,.08,wood);for(const x of [-1.2,1.2])box('Kapı sövesi',x,1.45,z, .24,2.9,.22,stone);box('Kapı lentosu',0,2.83,z,2.6,.25,.25,stone);for(const x of [-.7,0,.7])box('Demir kapı şeridi',x,1.3,z+(z<0?.06:-.06),.045,2.4,.02,wood);}
  for(const z of [-5.93,5.93])for(const x of [-5,5]){const banner=box('Bordo duvar sancağı',x,2.1,z,.72,1.9,.035,red);banner.castShadow=false;}
  for(const x of [-8.45,8.45])for(const z of [-4,0,4]){box('Gölgelik direği',x,4.35,z,.07,1.8,.07,wood);const awning=box('Keten gölgelik',x,5.2,z,2.2,.035,2.8,linen);awning.rotation.z=x<0?.09:-.09;}
  // Standing human mesh, shared geometry and per-instance tunic tint: 48 spectators without 48 rig updates.
  try{
   const gltf=await Promise.race([new T.GLTFLoader().loadAsync('assets/circus-v145/figure.glb'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Crowd timeout')),6000))]);
   const source=gltf.scene;source.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(source),size=bb.getSize(new T.Vector3()),center=bb.getCenter(new T.Vector3()),s=1.65/size.y,spots=[];
   for(let i=0;i<14;i++){const x=-7.4+i*14.8/13;spots.push({x,z:-6.5,a:0},{x,z:6.5,a:Math.PI});}
   for(let i=0;i<10;i++){const z=-5.4+i*10.8/9;spots.push({x:-8.5,z,a:Math.PI/2},{x:8.5,z,a:-Math.PI/2});}
   source.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.translate(-center.x,-bb.min.y,-center.z);geometry.scale(s,s,s);geometry.computeVertexNormals();const mat=new T.MeshStandardMaterial({color:0xe4cfaf,roughness:.92});const people=new T.InstancedMesh(geometry,mat,spots.length),dummy=new T.Object3D(),palette=[0xb6a27b,0x927258,0x995c42,0x5d6862,0xc4b28c,0x773d37];people.name='Duvar üzerinde ayakta seyirciler';spots.forEach((p,i)=>{dummy.position.set(p.x,3.54,p.z);dummy.rotation.set(0,p.a+(i%3-1)*.12,0);dummy.scale.setScalar(.9+(i%5)*.035);dummy.updateMatrix();people.setMatrixAt(i,dummy.matrix);people.setColorAt(i,new T.Color(palette[i%palette.length]));});people.computeBoundingSphere();root.add(people);});
  }catch{ /* Architecture remains playable if optional crowd asset is unavailable. */ }
  scene.add(root);return root;
 }
 function install(combat){combat.fighters=combat.fighters.slice(0,2);combat.fighters.forEach((f,i)=>{f.team=i;f.x=0;f.z=i?-3:3;f.angle=i?0:Math.PI;});combat.allowDrops=false;combat.bound=clamp;return combat;}
 return {load,install,clamp,bounds,wallHeight};
})();
