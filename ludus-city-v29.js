/* Downloaded distant monument LODs and photographed sky. Credits in CITY_ASSETS.md. */
var LudusCity=(()=>{
 'use strict';
 const diagonal=2000/Math.sqrt(2);
 // Metres, east = +X, north = -Z. The Pantheon's entrance faces north.
 const landmarks={colosseum:{position:[320,0,-300],height:48,footprint:[188,156],file:'colosseum-city-v29.glb',yaw:0},pantheon:{position:[320-diagonal,0,-300-diagonal],height:43.3,file:'pantheon-city-v29.glb',yaw:0}};
 function create(scene,renderer,sun){
  const T=THREE,root=new T.Group();root.name='Rome city';scene.add(root);
  scene.fog=new T.FogExp2('#bac3c7',.00027);
  const groundMaterial=new T.MeshStandardMaterial({color:0xc1b39a,roughness:1});RomanVisualAssets.material(groundMaterial,'stone_wall_02',.18,.08,true);groundMaterial.color.set('#c9bda5');const ground=new T.Mesh(new T.PlaneGeometry(5500,5500),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.25;root.add(ground);
  const models={};
  const skyReady=new Promise(resolve=>{new T.TextureLoader().load('rome-sky-v29.jpg?v=revision29',texture=>{texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.SRGBColorSpace;scene.background=texture;scene.backgroundIntensity=1.15;scene.environment=texture;scene.userData.skyLoaded=true;resolve();},undefined,()=>resolve());});
  sun.color.set('#fff0d7');sun.intensity=2.1;
  const modelReady=Promise.all(Object.entries(landmarks).map(([name,landmark])=>new Promise(resolve=>{
   new T.GLTFLoader().load(landmark.file+'?v=revision29',g=>{
    const group=new T.Group();group.name=name;const model=g.scene;group.add(model);
    const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
    const scale=landmark.height/size.y;model.position.set(-center.x,-box.min.y,-center.z);group.scale.set(landmark.footprint?landmark.footprint[0]/size.x:scale,scale,landmark.footprint?landmark.footprint[1]/size.z:scale);group.rotation.y=landmark.yaw;group.position.set(...landmark.position);
    const monumentMaterial=new T.MeshStandardMaterial({roughness:1,metalness:0});RomanVisualAssets.material(monumentMaterial,'white_sandstone_blocks_02',.35,.07,true);monumentMaterial.color.set(name==='colosseum'?'#dfd3b9':'#c8bead');
    model.traverse(o=>{if(o.isMesh){o.material=monumentMaterial;o.castShadow=false;o.receiveShadow=false;const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list){m.roughness=1;m.metalness=0;m.envMapIntensity=.3;}}});
    root.add(group);models[name]=group;scene.userData[name+'Loaded']=true;resolve();
   },undefined,()=>{scene.userData[name+'LoadError']=true;resolve();});
  })));
  return{root,models,ready:Promise.all([skyReady,modelReady]),landmarks};
 }
 return{landmarks,create};
})();
