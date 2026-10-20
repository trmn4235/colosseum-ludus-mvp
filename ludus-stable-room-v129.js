/* One cached horse, one groom, and static furniture. No second WebGL renderer. */
var LudusStableRoom=(()=>{
 function create({T,props,colliders,wood,stone,onError}){
  let root=null,horse=null,mixer=null,modelPromise=null,groomPromise=null,groom=null,active=false,selected=null;
  const bounds=[{kind:'stable-horse',minX:-2.1,maxX:2.1,minZ:-3.2,maxZ:-.8},{kind:'stable-feed',minX:4.8,maxX:6.8,minZ:-3.7,maxZ:-1.9},{kind:'stable-rack',minX:-6.9,maxX:-5.2,minZ:-3.8,maxZ:1.5}];
  function build(){
   root=new T.Group();root.name='Ahır · 15 metre';root.userData.width=15;
   const box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,10),white=new T.MeshStandardMaterial({color:0xf0ece2,roughness:.9}),red=new T.MeshStandardMaterial({color:0x762f42,roughness:.9}),gold=new T.MeshStandardMaterial({color:0xb49b62,metalness:.35,roughness:.6}),hay=new T.MeshStandardMaterial({color:0xb5a56d,roughness:1});
   const put=(mat,x,y,z,w,h,d,g=box)=>{const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.receiveShadow=true;root.add(m);return m;};
   put(white,0,2.45,-4.29,14.65,4.85,.05);put(red,0,.6,-4.23,14.6,1.2,.06);put(gold,0,1.23,-4.18,14.6,.04,.04);
   for(const x of [-7.3,7.3]){put(white,x,2.45,0,.07,4.85,8.6);put(red,x,.6,0,.08,1.2,8.5);}
   for(const x of [-4,4]){put(white,x,2.05,-4.04,.28,4.1,.28,cyl);put(gold,x,4.13,-4.04,.48,.13,.48);}
   put(hay,0,.025,-2.1,4.1,.04,2.6);
   for(const x of [-2.6,2.6]){for(const z of [-3.85,-.4])put(wood,x,.65,z,.15,1.3,.15);for(const y of [.4,.95])put(wood,x,y,-2.1,.09,.10,3.6);}
   put(wood,5.7,.48,-2.9,1.7,.9,.9);put(hay,5.7,.95,-2.9,1.5,.08,.72);
   for(const x of [5.05,6.35])put(gold,x,.48,-2.42,.08,.9,.03);
   for(const y of [.35,1.3,2.25]){put(wood,-6.2,y,-1.05,1.2,.12,4.6);for(const z of [-2.8,-1.3,.2])put(hay,-6.2,y+.35,z,.8,.6,.9);}
   for(const z of [-3.45,1.3])put(wood,-6.8,1.4,z,.16,2.8,.16);
   const batches=new Map();root.updateMatrixWorld(true);for(const m of [...root.children]){const k=m.geometry.uuid+':'+m.material.uuid;if(!batches.has(k))batches.set(k,[]);batches.get(k).push(m);}
   for(const list of batches.values())if(list.length>1){const batch=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);for(let i=0;i<list.length;i++){batch.setMatrixAt(i,list[i].matrix);root.remove(list[i]);}batch.receiveShadow=true;batch.computeBoundingSphere();root.add(batch);}
  }
  function loadHorse(){return modelPromise||(modelPromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('assets/caravan-field-v125/horse.glb',g=>{
   horse=new T.Group();const animal=g.scene,b=new T.Box3().setFromObject(animal),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3()),scale=2.25/size.y;
   animal.scale.setScalar(scale);animal.position.set(-center.x*scale,-b.min.y*scale,-center.z*scale);animal.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
   horse.add(animal);horse.name='Seçili at';horse.position.set(0,.045,-2.05);horse.rotation.y=Math.PI/2;
   mixer=new T.AnimationMixer(animal);const idle=g.animations.find(a=>a.name==='idle_loop');if(idle)mixer.clipAction(idle).play();root.add(horse);sync();resolve(horse);
  },undefined,reject)).catch(e=>{modelPromise=null;onError?.('At modeli yüklenemedi. Ahıra yeniden girdiğinde tekrar denenecek.');throw e;}));}
  function loadGroom(){return groomPromise||(groomPromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('assets/caravan-v128/driver.glb',g=>{
   groom=new T.Group();const person=g.scene,b=new T.Box3().setFromObject(person),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3()),scale=1.75/size.y;
   person.scale.setScalar(scale);person.position.set(-c.x*scale,-b.min.y*scale,-c.z*scale);person.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});groom.add(person);groom.position.set(4,.03,.25);groom.rotation.y=-.45;groom.name='Seyis';root.add(groom);resolve(groom);
  },undefined,reject)).catch(e=>{groomPromise=null;throw e;}));}
  function sync(){if(horse){horse.visible=!!selected;horse.scale.setScalar(selected?.stage==='foal'?.55:selected?.stage==='young'?.8:1);horse.userData.horseId=selected?.id||null;}}
  function enter(){active=true;if(!root)build();props.add(root);colliders.push(...bounds.map(b=>({...b})));loadHorse().catch(()=>{});loadGroom().catch(()=>{});}
  function leave(){active=false;root?.removeFromParent();}
  return {enter,leave,select(h){selected=h;sync();},tick(dt){if(active&&horse?.visible)mixer?.update(Math.min(.06,dt));},get root(){return root;},get horse(){return horse;},get groom(){return groom;}};
 }
 return {create};
})();
