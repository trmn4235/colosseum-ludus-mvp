/* Downloaded distant monument LODs and photographed sky. Credits in CITY_ASSETS.md. */
var LudusCity=(()=>{
 'use strict';
 const diagonal=2000/Math.sqrt(2);
 // Metres, east = +X, north = -Z. The Pantheon's entrance faces north.
 const landmarks={colosseum:{position:[820,0,650],height:48,footprint:[188,156],file:'colosseum-city-v29.glb',yaw:0},pantheon:{position:[820-diagonal,0,650-diagonal],height:43.3,file:'pantheon-city-v29.glb',yaw:0}};
 function create(scene,renderer,sun){
  const T=THREE,root=new T.Group();root.name='Rome city';scene.add(root);
  scene.fog=new T.FogExp2('#bac3c7',.00032);
  const groundMaterial=new T.MeshStandardMaterial({color:0xc1b39a,roughness:1});RomanVisualAssets.material(groundMaterial,'stone_wall_02',.18,.08,true);groundMaterial.color.set('#c9bda5');const ground=new T.Mesh(new T.PlaneGeometry(5500,5500),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.25;root.add(ground);
  const models={};
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
  const skyReady=new Promise(resolve=>{new T.TextureLoader().load('rome-sky-v29.jpg?v=revision30',texture=>{texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.SRGBColorSpace;scene.background=texture;scene.backgroundIntensity=1.15;scene.environment=texture;scene.userData.skyLoaded=true;resolve();},undefined,()=>resolve());});
  sun.color.set('#fff0d7');sun.intensity=2.1;
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
  return{root,models,ready:Promise.all([skyReady,modelReady,districtReady]),landmarks};
 }
 return{landmarks,create};
})();
