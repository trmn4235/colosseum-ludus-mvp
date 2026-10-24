/* Roadside storytelling, soft footfall dust and a separate moving-shadow pass. */
var CaravanDetail=(()=>{
 function create(T,scene,renderer,wagon,{height,mesh,segment,material,mergeStatic,collisions,coarse,reduceMotion}){
  const props=new T.Group();props.name='Roman roadside details';scene.add(props);
  let map;wagon.scene.traverse(o=>{if(o.isMesh&&!map)map=o.material.map;});
  const wood=material(0x79664e,{map}),dark=material(0x4d4234),iron=material(0x383a33,{metalness:.55,roughness:.6}),stone=material(0xa6a18d),sack=material(0xb7a57f);
  const box=(g,x,y,z,w,h,d,mat=wood)=>mesh(new T.BoxGeometry(w,h,d),mat,g,x,y,z);
  function crate(x,z,broken=false){
   const g=new T.Group();g.name=broken?'Broken cargo crate':'Trade cargo';g.position.set(x,height(x,z),z);g.rotation.y=broken?.45:-.27;props.add(g);
   for(let i=0;i<5;i++){box(g,-.46+i*.23,.08,0,.215,.08,.93);for(const side of [-1,1])if(!broken||side===-1||i<2)box(g,side*.51,.18+i*.15,0,.055,.13,.94);}
   for(const z of [-.46,.46])for(let i=0;i<(broken?3:5);i++)box(g,0,.18+i*.15,z,.98,.13,.055);
   for(const x of [-.48,.48])for(const z of [-.44,.44])box(g,x,.43,z,.075,.85,.075,dark);
   if(!broken){for(let i=0;i<5;i++)box(g,-.46+i*.23,.84,0,.215,.06,.96);for(const z of [-.3,.3])box(g,0,.89,z,1.06,.035,.045,iron);}
   else for(let i=0;i<5;i++){const p=box(g,.7+i*.14,.07,.3-i*.19,.13,.05,.7);p.rotation.y=i*.7;p.rotation.z=i*.035;}
   return g;
  }
  crate(-8.1,17,true);crate(8.8,13);const upper=crate(9.8,14);upper.scale.setScalar(.72);
  const wreck=new T.Group();wreck.name='Overturned abandoned wagon';wreck.position.set(-9.9,height(-9.9,10.4)+.53,10.4);wreck.rotation.set(.08,.38,-1.12);wreck.scale.setScalar(.86);wreck.add(wagon.scene.clone(true));props.add(wreck);collisions.push({x:-9.9,z:10.4,r:2});
  for(const [x,z,a]of [[-8.4,14.7,.3],[-9.1,14,-.7],[9.3,12.1,.1]]){const g=new T.Group();g.position.set(x,height(x,z)+.22,z);g.rotation.y=a;props.add(g);const b=mesh(new T.SphereGeometry(.3,12,8),sack,g);b.scale.set(1,.68,1.3);segment([-.23,.02,0],[.23,.02,0],.014,dark,g);}
  const marker=new T.Group();marker.name='Roman road milestone';marker.position.set(8.6,height(8.6,20),20);marker.rotation.y=-.4;props.add(marker);mesh(new T.CylinderGeometry(.25,.29,1.42,12),stone,marker,0,.73);mesh(new T.CylinderGeometry(.3,.3,.09,12),stone,marker,0,1.47);box(marker,0,.12,0,.72,.24,.65,stone);
  // Small chips mark age without introducing text labels over the battlefield.
  for(let i=0;i<3;i++)box(marker,-.07+i*.07,1.07,.251,.014,.18,.008,dark);
  mergeStatic(props);props.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.55)');gradient.addColorStop(.4,'rgba(255,255,255,.23)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new T.CanvasTexture(canvas),positions=new Float32Array(64*3),ages=new Float32Array(64).fill(2);positions.fill(-1000);const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.BufferAttribute(positions,3));
  const dust=new T.Points(dustGeo,new T.PointsMaterial({map:texture,color:0xc9b897,size:.55,transparent:true,opacity:.23,depthWrite:false}));dust.name='Footfall dust';dust.frustumCulled=false;scene.add(dust);let cursor=0,shadow=null,shadowClock=0;
  function footDust(x,z,force=1){if(reduceMotion)return;for(let i=0;i<(force>1?3:1);i++){const n=cursor++%64;ages[n]=0;positions[n*3]=x+(i-1)*.1;positions[n*3+1]=height(x,z)+.09;positions[n*3+2]=z;}dustGeo.attributes.position.needsUpdate=true;}
  function battleShadow(){if(shadow)return;shadow=new T.DirectionalLight(0xffe8cd,.85);shadow.position.set(-18,29,13);shadow.target.position.set(0,0,13);scene.add(shadow,shadow.target);shadow.castShadow=true;shadow.shadow.mapSize.set(1024,1024);Object.assign(shadow.shadow.camera,{left:-12,right:12,top:14,bottom:-14,near:1,far:65});shadow.shadow.bias=-.0002;shadow.shadow.normalBias=.025;shadow.shadow.autoUpdate=false;shadow.shadow.needsUpdate=true;}
  function update(dt){for(let i=0;i<64;i++)if(ages[i]<1.5){ages[i]+=dt;positions[i*3]+=.10*dt;positions[i*3+1]+=.09*dt;if(ages[i]>=1.5)positions[i*3+1]=-1000;}dustGeo.attributes.position.needsUpdate=true;const interval=renderer.getPixelRatio()<=.875?1/15:1/20;if(shadow&&(shadowClock+=dt)>=interval){shadowClock%=interval;shadow.shadow.needsUpdate=true;}}
  return {footDust,battleShadow,update,props,get shadow(){return shadow;}};
 }
 return {create};
})();
