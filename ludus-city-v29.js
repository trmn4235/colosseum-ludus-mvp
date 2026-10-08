/* Distant, spatial city image cards with the original 3D loader as a fallback.
   Images are baked from the same licensed geometry/materials. Credits in CITY_ASSETS.md. */
var LudusCity=(()=>{
 'use strict';
 const diagonal=2000/Math.sqrt(2);
 // Metres, east = +X, north = -Z. The Pantheon's entrance faces north.
 const landmarks={colosseum:{position:[1050,0,-100],height:48,footprint:[188,156],file:'colosseum-city-v29.glb',yaw:0},pantheon:{position:[1050-diagonal,0,-100-diagonal],height:43.3,file:'pantheon-city-v29.glb',yaw:0}};
 function foundation(scene,renderer,sun){
  const T=THREE,root=new T.Group();root.name='Rome city';scene.add(root);
  scene.fog=new T.FogExp2('#bac3c7',.00032);
  const groundMaterial=new T.MeshStandardMaterial({color:0xc1b39a,roughness:1});RomanVisualAssets.material(groundMaterial,'stone_wall_02',.18,.08,true);groundMaterial.color.set('#c9bda5');const ground=new T.Mesh(new T.PlaneGeometry(5500,5500),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.25;root.add(ground);
  const skyReady=new Promise(resolve=>{new T.TextureLoader().load('rome-sky-v29.jpg?v=revision30',texture=>{texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.SRGBColorSpace;scene.background=texture;scene.backgroundIntensity=1.15;scene.environment=texture;scene.userData.skyLoaded=true;resolve();},undefined,()=>resolve());});
  sun.color.set('#fff0d7');sun.intensity=2.1;
  return{root,skyReady};
 }
 function create3D(scene,renderer,sun){
  const T=THREE,{root,skyReady}=foundation(scene,renderer,sun),models={};
  const districtReady=Promise.all([
   {file:'rome-insula-v30.glb',height:12,count:160},
   {file:'rome-forum-v30.glb',height:13,count:3},
   {file:'rome-temple-v30.glb',height:17,count:4},
   {file:'rome-gateway-v30.glb',height:26,count:2}
  ].map((asset,kind)=>new Promise(resolve=>new T.GLTFLoader().load(asset.file+'?v=revision30',g=>{
   const box=new T.Box3().setFromObject(g.scene),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());g.scene.position.set(-center.x,-box.min.y,-center.z);
   g.scene.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.roughness=1;m.metalness=0;m.envMapIntensity=.25;}}});
   for(let i=0;i<asset.count;i++){
    const angle=i*2.39996323+kind*.73,radius=140+(i%13)*45+kind*40,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const towardPan=Math.atan2(landmarks.pantheon.position[0],landmarks.pantheon.position[2]),towardCol=Math.atan2(landmarks.colosseum.position[0],landmarks.colosseum.position[2]),bearing=Math.atan2(x,z),diff=a=>Math.abs(Math.atan2(Math.sin(bearing-a),Math.cos(bearing-a)));
    if(diff(towardPan)<.20||diff(towardCol)<.30||Math.hypot(x-landmarks.colosseum.position[0],z-landmarks.colosseum.position[2])<125)continue;
    const block=new T.Group();block.add(g.scene.clone(true));block.scale.setScalar((asset.height+(i%4)*.8)/size.y);block.position.set(x,0,z);block.rotation.y=(i%4)*Math.PI/2;root.add(block);
   }
   scene.userData[asset.file+'Loaded']=true;resolve();
  },undefined,()=>{scene.userData[asset.file+'LoadError']=true;resolve();}))));
  const modelReady=Promise.all(Object.entries(landmarks).map(([name,landmark])=>new Promise(resolve=>{
   new T.GLTFLoader().load(landmark.file+'?v=revision30',g=>{
    const group=new T.Group();group.name=name;const model=g.scene;group.add(model);
    const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
    const scale=landmark.height/size.y;model.position.set(-center.x,-box.min.y,-center.z);group.scale.set(landmark.footprint?landmark.footprint[0]/size.x:scale,scale,landmark.footprint?landmark.footprint[1]/size.z:scale);group.rotation.y=landmark.yaw;group.position.set(...landmark.position);
    const monumentMaterial=new T.MeshStandardMaterial({roughness:1,metalness:0});RomanVisualAssets.material(monumentMaterial,'white_sandstone_blocks_02',.35,.07,true);monumentMaterial.color.set(name==='colosseum'?'#dfd3b9':'#c8bead');
    model.traverse(o=>{if(o.isMesh){o.material=monumentMaterial;o.castShadow=false;o.receiveShadow=false;const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list){m.roughness=1;m.metalness=0;m.envMapIntensity=.3;}}});
    root.add(group);models[name]=group;scene.userData[name+'Loaded']=true;resolve();
   },undefined,()=>{scene.userData[name+'LoadError']=true;resolve();});
  })));
  return{root,models,ready:Promise.all([skyReady,modelReady,districtReady]),landmarks,mode:'3d'};
 }
 function create(scene,renderer,sun,options={}){
  if(options.mode==='3d')return create3D(scene,renderer,sun);
  const T=THREE,{root,skyReady}=foundation(scene,renderer,sun),models={};let current={root,models,mode:'backdrop'},texture=null;
  const ready=(async()=>{
   try{
    const response=await fetch('assets/city/rome-backdrop-v39.json?v=revision39');if(!response.ok)throw Error('City manifest unavailable');
    const data=await response.json(),atlas=data.atlas;
    if(data.version!==1||!Array.isArray(data.cards)||!data.cards.length||data.cards.length>512||!atlas||!/^assets\/city\/rome-backdrop-[a-f0-9]{12}\.webp$/.test(atlas.file)||atlas.width>renderer.capabilities.maxTextureSize||atlas.height>renderer.capabilities.maxTextureSize)throw Error('Unsupported city backdrop');
    texture=await new Promise((resolve,reject)=>new T.TextureLoader().load(atlas.file,resolve,undefined,reject));
    if(texture.image.width!==atlas.width||texture.image.height!==atlas.height)throw Error('Unexpected city atlas size');
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    const positions=[],uvs=[],indices=[];
    for(const card of data.cards){
     const rect=card.rect;if(!Array.isArray(card.vertices)||card.vertices.length!==4||card.vertices.some(v=>!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)))||!Array.isArray(rect)||rect.length!==4||rect.some(n=>!Number.isFinite(n))||rect[0]<0||rect[1]<0||rect[2]<1||rect[3]<1||rect[0]+rect[2]>atlas.width||rect[1]+rect[3]>atlas.height)throw Error('Invalid city card');
     const offset=positions.length/3;positions.push(...card.vertices.flat());
     const u0=(rect[0]+.5)/atlas.width,u1=(rect[0]+rect[2]-.5)/atlas.width,v0=1-(rect[1]+rect[3]-.5)/atlas.height,v1=1-(rect[1]+.5)/atlas.height;
     uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
    // Lighting, tone mapping and distance fog are already in the source pixels.
    const material=new T.MeshBasicMaterial({map:texture,alphaTest:.05,alphaToCoverage:true,toneMapped:false,fog:false,side:T.DoubleSide});
    const cards=new T.Mesh(geometry,material);cards.name='Rome backdrop cards';root.add(cards);
    for(const [name,landmark]of Object.entries(landmarks)){const marker=new T.Object3D();marker.name=name;marker.position.set(...landmark.position);marker.userData.backdrop=true;root.add(marker);models[name]=marker;}
    scene.userData.cityBackdropLoaded=true;scene.userData.cityBackdropCards=data.cards.length;
    await skyReady;
   }catch(error){
    // A missing/unsupported image must not leave the skyline empty.
    texture?.dispose();scene.remove(root);root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
    scene.userData.cityBackdropLoadError=true;current=create3D(scene,renderer,sun);await current.ready;
   }
  })();
  return{get root(){return current.root;},get models(){return current.models;},get mode(){return current.mode;},ready,landmarks};
 }
 return{landmarks,create};
})();
