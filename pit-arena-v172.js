/* V173: rectangular 384 m² sand court, four walls and a walkable upper gallery. */
var PitArena=(()=>{
 const width=16*Math.SQRT2,depth=12*Math.SQRT2,half={x:width/2,z:depth/2},bounds=Object.freeze({x:half.x-.45,z:half.z-.45}),wallHeight=3.4,galleryY=3.54;
 const weapons=Object.freeze(['pit_stone_mace','pit_wood_mace']);
 function clamp(p){p.x=Math.max(-bounds.x,Math.min(bounds.x,p.x));p.z=Math.max(-bounds.z,Math.min(bounds.z,p.z));return p;}
 function galleryContains(x,z){return Math.abs(x)<=half.x+3.35&&Math.abs(z)<=half.z+3.35&&(Math.abs(x)>=half.x+1.25||Math.abs(z)>=half.z+1.25);}
 function moveGallery(p,dx,dz){if(galleryContains(p.x+dx,p.z))p.x+=dx;if(galleryContains(p.x,p.z+dz))p.z+=dz;return p;}
 function equip(f,item){f.weapon='heavy_mace';f.pitWeapon=weapons.includes(item?.pit_model)?item.pit_model:weapons[f.id%2];f.helmet=f.chest=f.shoulders=f.greaves=f.shield=false;f.offhand=f.leftGear=f.navalUniform=null;return f;}
 async function preload(){await Promise.all(weapons.map(id=>LudusEquipmentCatalog.load(THREE,id)));}
 async function load(scene,renderer){
  const T=THREE,root=new T.Group();root.name='Şan Avlusu · Dikdörtgen';root.userData.pit=true;root.userData.sandArea=width*depth;
  const loader=new T.TextureLoader();
  function texture(file,repeat,color=false){const t=loader.load('assets/textures/'+file);t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()||1);return t;}
  function material(diff,normal,rough,repeat,color){return new T.MeshStandardMaterial({map:texture(diff,repeat,true),normalMap:texture(normal,repeat),roughnessMap:texture(rough,repeat),normalScale:new T.Vector2(.65,.65),color,roughness:1});}
  const plaster=material('white_plaster_02-diff-6aa57de97b10.webp','white_plaster_02-nor_gl-dcd2b93a4cbb.webp','white_plaster_02-rough-1e05c5521169.webp',[5,1],0xe4d3b5),stone=material('white_sandstone_blocks_02-diff-291a56b4ab78.webp','white_sandstone_blocks_02-nor_gl-ca837027cc37.webp','white_sandstone_blocks_02-rough-4b0a136337d7.webp',[4,1],0xd6c8ad),sand=material('sand_01-diff-8aecb3769d72.webp','sand_01-nor_gl-6616ebcba18d.webp','sand_01-rough-13596e2e2ff4.webp',[9,7],0xe0c8a4),wood=material('wooden_gate-diff-67741a5af1f9.webp','wooden_gate-nor_gl-9c9095cd8a7d.webp','wooden_gate-rough-f62304f04b81.webp',[1,1],0xa48761),iron=new T.MeshStandardMaterial({color:0x393832,roughness:.76,metalness:.6}),red=new T.MeshStandardMaterial({color:0x72382f,roughness:1,side:T.DoubleSide});
  function box(name,x,y,z,w,h,d,m=plaster,parent=root){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  const geo=new T.PlaneGeometry(width,depth,48,36),pos=geo.attributes.position,colors=[];for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.009*Math.sin(x*3.1)*Math.cos(y*2.7));const shade=.94+.06*Math.sin(x*.36+Math.cos(y*.41));colors.push(shade,shade,shade);}geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();sand.vertexColors=true;
  const floor=new T.Mesh(geo,sand);floor.name='Kesintisiz dikdörtgen kum';floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;root.add(floor);
  const walls=new T.Group();walls.name='Dövüş alanının duvarları';root.add(walls);
  for(const sign of [-1,1]){
   box('İç sınır duvarı',sign*(half.x+.35),wallHeight/2,0,.7,wallHeight,depth+1.4,plaster,walls);
   // Opposite gate openings with recessed closed doors; sand meets the wall directly.
   const span=(width-2.5)/2;for(const side of [-1,1])box('İç sınır duvarı',side*(1.25+span/2),wallHeight/2,sign*(half.z+.35),span,wallHeight,.7,plaster,walls);
   box('Kapı üst duvarı',0,3.05,sign*(half.z+.35),2.5,.7,.7,plaster,walls);
   box('Üst galeri',0,galleryY-.12,sign*(half.z+2),width+8,.24,4,stone);
   box('Üst galeri',sign*(half.x+2),galleryY-.12,0,4,.24,depth,stone);
   box('Dış galeri duvarı',0,2.2,sign*(half.z+4),width+8,4.4,.45,plaster);
   box('Dış galeri duvarı',sign*(half.x+4),2.2,0,.45,4.4,depth+8,plaster);
   const gateZ=sign*(half.z+.13);for(let i=0;i<10;i++)box('Masif ahşap kapı kanadı',-1.125+i*.25,1.35,gateZ,.242,2.7,.2,wood);
   for(const y of [.43,1.37,2.34]){box('Dövme demir kapı kuşağı',0,y,gateZ-sign*.13,2.4,.09,.055,iron);for(let x=-1.05;x<=1.06;x+=.3)box('Kapı perçini',x,y,gateZ-sign*.17,.045,.045,.025,iron);}
   for(const x of [-1.4,1.4])box('Taş kapı sövesi',x,1.5,sign*(half.z-.06),.3,3,.25,stone);box('Taş kapı lentosu',0,2.9,sign*(half.z-.06),3.1,.25,.3,stone);
   for(const x of [-half.x*.58,half.x*.58])box('Bordo duvar sancağı',x,2.08,sign*(half.z-.035),.8,1.9,.04,red);
   for(let x=-half.x;x<=half.x;x+=2.15)box('Galeri korkuluk dikmesi',x,4.02,sign*(half.z+.2),.16,1,.16,stone);
   for(let z=-half.z;z<=half.z;z+=2.15)box('Galeri korkuluk dikmesi',sign*(half.x+.2),4.02,z,.16,1,.16,stone);
   box('Galeri korkuluğu',0,4.48,sign*(half.z+.2),width,.13,.2,stone);box('Galeri korkuluğu',sign*(half.x+.2),4.48,0,.2,.13,depth,stone);
   for(const x of [-half.x*.72,0,half.x*.72]){for(const edge of [-2.2,2.2])box('Gölgelik direği',x+edge,4.6,sign*(half.z+3.15),.09,2.2,.09,wood);const a=box('Bordo keten gölgelik',x,5.55,sign*(half.z+1.75),4.5,.04,3.1,red);a.rotation.x=sign*.08;}
  }
  try{let timer;const gltf=await Promise.race([new T.GLTFLoader().loadAsync('assets/circus-v145/figure.glb'),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Crowd timeout')),6000))]).finally(()=>clearTimeout(timer));
   const source=gltf.scene;source.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(source),size=bb.getSize(new T.Vector3()),center=bb.getCenter(new T.Vector3()),s=1.65/size.y,spots=[];
   for(let i=0;i<14;i++){const x=-half.x+1+i*(width-2)/13;spots.push({x,z:-half.z-.65,a:0},{x,z:half.z+.65,a:Math.PI});}for(let i=0;i<10;i++){const z=-half.z+1+i*(depth-2)/9;spots.push({x:-half.x-.65,z,a:Math.PI/2},{x:half.x+.65,z,a:-Math.PI/2});}
   source.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.translate(-center.x,-bb.min.y,-center.z);geometry.scale(s,s,s);geometry.computeVertexNormals();const people=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({color:0xe4cfaf,roughness:.92}),spots.length),dummy=new T.Object3D(),palette=[0xb6a27b,0x927258,0x995c42,0x5d6862,0xc4b28c,0x773d37];people.name='Duvar üzerinde ayakta seyirciler';spots.forEach((p,i)=>{dummy.position.set(p.x,galleryY,p.z);dummy.rotation.set(0,p.a+(i%3-1)*.12,0);dummy.scale.setScalar(.9+(i%5)*.035);dummy.updateMatrix();people.setMatrixAt(i,dummy.matrix);people.setColorAt(i,new T.Color(palette[i%palette.length]));});people.computeBoundingSphere();root.add(people);});
  }catch{/* Optional crowd must not block entry. */}
  scene.add(root);return root;
 }
 function install(combat,ticket){const legacy=!!ticket&&Number(ticket.snapshot?.pit_version||0)<173;combat.fighters=combat.fighters.slice(0,legacy?2:4);combat.mode='solo20';combat.fighters.forEach((f,i)=>{f.team=i;f.x=(i%2?1:-1)*half.x*.55;f.z=(i<2?1:-1)*half.z*.55;f.angle=Math.atan2(-f.x,-f.z);if(!legacy)equip(f,ticket?.loot?.find(l=>l.actor===i&&l.slot==='main_hand')?.item||ticket?.snapshot?.items?.[0]);});combat.allowDrops=false;combat.bound=clamp;return combat;}
 return {load,install,clamp,bounds,wallHeight,width,depth,half,galleryY,galleryContains,moveGallery,equip,weapons,preload};
})();
