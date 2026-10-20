/* Open-air stable yard. Shared textures and instanced fences; daylight comes from the courtyard. */
var LudusStableEnvironment=(()=>{
 'use strict';
 const WIDTH=30,DEPTH=54,POST_ROWS=[1,-6,-13,-20,-27,-34,-41,-48];
 function create(T){
  const root=new T.Group(),slots=[],bounds=[],textures=new Map(),batches=new Map(),dummy=new T.Object3D();
  root.name='Açık hava ahırı';root.userData={width:WIDTH,depth:DEPTH,stalls:12,features:['compacted-earth','timber-floorboards','weathered-plaster','stone-plinths','open-sky','low-paddock-fences','straw-bedding','mangers','water-troughs','feed-sacks','staved-barrels','bridles','buckets','hoofprints','courtyard-daylight','one-groom']};
  let seed=131;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  function texture(path){if(typeof Image==='undefined')return null;if(textures.has(path))return textures.get(path);const t=new T.TextureLoader().load(path);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;textures.set(path,t);return t;}
  function surface(color,file,scale=1,bump=.025){
   const map=file?texture(file):null,m=new T.MeshStandardMaterial({color,roughness:.94,map,bumpMap:map,bumpScale:bump});
   m.onBeforeCompile=s=>{
    s.uniforms.stableUvScale={value:scale};s.vertexShader='varying vec3 stableWorld; varying vec3 stableAxis;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`vec4 stablePoint=vec4(transformed,1.);vec3 stableNormal=objectNormal;
#ifdef USE_INSTANCING
stablePoint=instanceMatrix*stablePoint;stableNormal=mat3(instanceMatrix)*stableNormal;
#endif
stableWorld=(modelMatrix*stablePoint).xyz;stableAxis=normalize(mat3(modelMatrix)*stableNormal);
#include <project_vertex>`);
    s.fragmentShader='varying vec3 stableWorld;varying vec3 stableAxis;uniform float stableUvScale;vec2 stableSurfaceUv(){vec3 a=abs(stableAxis);return (a.y>a.x&&a.y>a.z?stableWorld.xz:a.x>a.z?stableWorld.zy:stableWorld.xy)*stableUvScale;}\n'+s.fragmentShader;
    for(const chunk of ['map_fragment','bumpmap_pars_fragment'])s.fragmentShader=s.fragmentShader.replace('#include <'+chunk+'>',T.ShaderChunk[chunk].replaceAll('vMapUv','stableSurfaceUv()').replaceAll('vBumpMapUv','stableSurfaceUv()'));
   };
   m.customProgramCacheKey=()=> 'stable-surface-v131-'+scale;return m;
  }
  const timber=surface(0xc4a37d,'assets/stable-v131/timber.webp',.65,.028),earth=surface(0xd4b693,'assets/stable-v131/earth.webp',.48,.045),hay=surface(0xc2ac76,'assets/stable-v131/straw.webp',1.4,.055);
  const plaster=surface(0xa99b80,'assets/textures/white_plaster_02-diff-6aa57de97b10.webp',.6,.025),stone=surface(0x867762,'assets/textures/stone_wall_02-diff-978ee90ff99a.webp',.6,.06);
  function weather(m,code,key){const apply=m.onBeforeCompile;m.onBeforeCompile=s=>{apply(s);s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',code+'\n#include <color_fragment>');};m.customProgramCacheKey=()=> 'stable-weather-v131-'+key;}
  weather(plaster,'float stableDamp=(1.-smoothstep(.25,1.7,stableWorld.y))*(.8+.2*sin(stableWorld.z*2.3+sin(stableWorld.z*5.)));diffuseColor.rgb*=1.-stableDamp*.26;','plaster');

  const plain=(color,roughness=.9)=>new T.MeshStandardMaterial({color,roughness});
  const iron=plain(0x322e28,.75),rope=plain(0x9a8158),leather=plain(0x4d3426),straw=plain(0xa18a55),grain=plain(0x9f8050),cloth=surface(0xa59472,'assets/textures/white_plaster_02-diff-6aa57de97b10.webp',4,.012),mud=plain(0x5a412b);
  iron.metalness=.45;
  const water=new T.MeshStandardMaterial({color:0x574e36,roughness:.19,metalness:.2});
  const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,12),sphere=new T.SphereGeometry(1,10,6),hoop=new T.TorusGeometry(1,.055,5,18),circle=new T.CircleGeometry(1,20),pebble=new T.IcosahedronGeometry(1,0),hoof=new T.TorusGeometry(1,.1,3,14,Math.PI*1.6);
  const bag=new T.LatheGeometry([[.02,0],[.24,.03],[.37,.18],[.39,.5],[.32,.82],[.15,1],[.12,1.1]].map(p=>new T.Vector2(...p)),12);
  const bagPos=bag.attributes.position;for(let i=0;i<bagPos.count;i++){const y=bagPos.getY(i),a=Math.atan2(bagPos.getZ(i),bagPos.getX(i)),k=1+.04*Math.sin(a*7+y*11);bagPos.setXYZ(i,bagPos.getX(i)*k,y,bagPos.getZ(i)*k);}bag.computeVertexNormals();
  function put(mat,x,y,z,w,h,d,geo=box,rx=0,ry=0,rz=0,tint=1){
   const key=mat.uuid+geo.uuid;if(!batches.has(key))batches.set(key,{mat,geo,items:[]});
   dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(w,h,d);dummy.updateMatrix();batches.get(key).items.push({matrix:dummy.matrix.clone(),tint});
  }
  function beam(a,b,w=.13,mat=timber){const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);dummy.position.copy(start).add(end).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().normalize());dummy.scale.set(w,dir.length(),w);dummy.updateMatrix();const key=mat.uuid+box.uuid;if(!batches.has(key))batches.set(key,{mat,geo:box,items:[]});batches.get(key).items.push({matrix:dummy.matrix.clone(),tint:.84+rand()*.16});}
  // Unbroken, granular earth; narrow board aprons and feed-store decking sit flush with it.
  put(earth,0,-.12,-22.5,30,.24,54);
  for(const side of [-1,1])for(let row=0;row<34;row++)for(let board=0;board<4;board++)put(timber,side*(2.75+board*.26),.015,3.7-row*1.55,.247,.045,1.52,box,0,0,0,.70+rand()*.28);
  for(const side of [-1,1])for(let i=0;i<28;i++)put(timber,side*(4.8+i*.34),.025,-46,.325,.065,6.7,box,0,0,0,.70+rand()*.28);
  for(let i=0;i<120;i++){const z=3-rand()*51,x=(rand()-.5)*4.8;put(mud,x,.008,z,.09+rand()*.04,.13,0.012,hoof,-Math.PI/2,0,rand()*Math.PI*2,.8+rand()*.2);}
  for(let i=0;i<180;i++){const side=i%2?1:-1;put(stone,side*(2.45+rand()*.22),.015,3.7-rand()*52,.018+rand()*.035,.02,.025+rand()*.03,pebble,rand(),rand(),0,.65+rand()*.3);}
  put(plaster,0,1.05,-49.5,30,2.1,.3);put(stone,0,2.13,-49.5,30.2,.14,.42);
  for(const side of [-1,1]){put(plaster,side*15,1.05,-22.5,.3,2.1,54);put(stone,side*15,2.13,-22.5,.42,.14,54);}
  // Individual irregular masonry joints give the wall base and supports depth.
  for(const side of [-1,1])for(let row=0;row<3;row++)for(let i=0;i<43;i++)put(stone,side*14.78,.16+row*.31,3.75-i*1.25+(row%2)*.3,.23,.29,1.21,box,0,0,0,.78+rand()*.22);
  for(const side of [-1,1]){put(plaster,side*8.45,.95,4.5,13.1,1.9,.3);for(let i=0;i<6;i++)put(timber,side*(.16+i*.285),1.5,4.46,.27,3,.14,box,0,0,0,.8+rand()*.2);for(const y of [.35,2.5])put(iron,side*.9,y,4.35,1.68,.085,.025);put(stone,side*1.9,1.62,4.2,.26,3.25,.42);}
  put(stone,0,3.18,4.2,4.1,.22,.42);
  // Low stone gateposts and rail dividers leave the whole aisle open to the sky.
  for(const z of POST_ROWS)for(const side of [-1,1]){
   const x=side*3.8;put(stone,x,.16,z,.55,.32,.55);put(timber,x,.96,z,.18,1.6,.18);put(stone,x,1.81,z,.29,.12,.29);
  }
  function bucket(x,z){
   put(timber,x,.22,z,.25,.4,.25,cylinder);put(iron,x,.39,z,.255,.255,.255,hoop,Math.PI/2);put(iron,x,.07,z,.25,.25,.25,hoop,Math.PI/2);put(water,x,.425,z,.217,.217,1,circle,-Math.PI/2);put(iron,x,.61,z,.27,.27,.27,hoop,0,0,0);
  }
  function trough(side,z){
   const x=side*4.7;
   // Slatted hay manger, not a closed cube: bedding is visible through the wooden rails.
   put(timber,x,.32,z-2.1,1.18,.12,1.3);put(hay,x,.67,z-2.1,1,.55,1.12,box,0,0,0,.88);
   for(const dx of [-.59,.59])for(const dz of [-.65,.65])put(timber,x+dx,.67,z-2.1+dz,.085,1.05,.085);
   for(const y of [.45,.95])for(const dx of [-.59,.59])put(timber,x+dx,y,z-2.1,.075,.08,1.35);
   for(let i=0;i<5;i++)for(const dx of [-.59,.59])put(timber,x+dx,.7,z-2.65+i*.27,.045,.5,.045);
   for(let n=0;n<25;n++)put(straw,x+(rand()-.5),1+rand()*.07,z-2.1+(rand()-.5),.012,.012,.21+rand()*.24,box,0,rand()*3,0);
   const wz=z+2.05;put(stone,x,.19,wz,1.25,.16,1.35);for(const dx of [-.56,.56])put(stone,x+dx,.42,wz,.14,.4,1.35);for(const dz of [-.61,.61])put(stone,x,.42,wz+dz,1.05,.4,.13);put(water,x,.58,wz,1.02,.018,1.08);
   put(mud,x,.009,wz+1,.75,.009,.4,cylinder,0,0,0,.88);
  }
  for(let row=0;row<6;row++)for(const side of [-1,1]){
   const z=-2.5-row*7,front=side*3.8;slots.push({index:slots.length,side,z,x:side*5.05});
   for(let i=0;i<22;i++)put(timber,front,.54,z-3.12+i*.297,.14,1.05,.279,box,0,0,0,.74+rand()*.25);
   for(const dz of [-3.34,3.34]){
    for(let i=0;i<30;i++)put(timber,side*(3.95+i*.325),.58,z+dz,.31,1.15,.14,box,0,0,0,.76+rand()*.24);
    put(timber,side*8.75,1.58,z+dz,9.75,.14,.16);for(let x=4.1;x<13.6;x+=1.9)put(timber,side*x,.83,z+dz,.13,1.66,.13);put(timber,front,.85,z+dz,.21,1.7,.21);
   }
   put(timber,front,1.58,z,.18,.14,6.9);put(timber,front,1.10,z,.2,.12,6.9);
   for(const dz of [-2.9,2.9])put(timber,front,.84,z+dz,.13,1.68,.13);
   for(const dz of [-.85,.85])put(timber,front,.84,z+dz,.16,1.68,.1);
   for(const dz of [-2.8,2.8])for(const y of [.45,1.1]){put(iron,front-side*.1,y,z+dz,.035,.075,.4);for(const offset of [-.13,.13])put(iron,front-side*.125,y,z+dz+offset,.025,.025,.025,sphere);}
   put(iron,front-side*.13,1.34,z+1.1,.04,.08,.46);put(iron,front-side*.15,1.19,z+1.1,.08,.13,.08,hoop,0,Math.PI/2);
   // Separate uneven straw islands instead of a featureless yellow rectangular floor.
   for(let i=0;i<10;i++)put(hay,side*(5.2+rand()*7.4),.025,z+(rand()-.5)*5.7,.55+rand()*1.15,.025,.4+rand()*.75,cylinder,0,rand()*Math.PI,0,.75+rand()*.25);
   for(let n=0;n<95;n++)put(straw,side*(3.5+rand()*9.5),.07+rand()*.025,z+(rand()-.5)*6.3,.009,.009,.13+rand()*.34,box,0,rand()*Math.PI,0,.7+rand()*.3);
   trough(side,z);bounds.push({kind:'stable-stall',minX:side<0?-14:3.62,maxX:side<0?-3.62:14,minZ:z-3.45,maxZ:z+3.45});

   // A bridle hangs outside each bay; iron rings and leather loops remain visibly separate.
   const hx=front-side*.18,hz=z+2.25;put(iron,hx,1.53,hz,.26,.045,.045);put(leather,hx-side*.12,1.13,hz,.16,.30,.16,hoop,0,Math.PI/2);put(iron,hx-side*.12,.83,hz,.065,.065,.065,hoop,0,Math.PI/2);
  }
  for(const side of [-1,1]){
   for(let i=0;i<5;i++){const x=side*(7+i*1.15),z=-46.5+(rand()-.5)*.3;put(cloth,x,.05,z,1.2,.85+rand()*.28,1.15,bag,0,rand()*3,0,.8+rand()*.2);put(rope,x,1.06,z,.15,.05,.15,cylinder);}
   for(let i=0;i<6;i++){const x=side*(5.5+(i%3)*1.55),y=.44+Math.floor(i/3)*.78;put(hay,x,y,-48.1,1.35,.72,1,box,0,.025*(rand()-.5),0,.78+rand()*.22);for(const dx of [-.43,.43]){put(rope,x+dx,y,-47.58,.028,.74,.025);put(rope,x+dx,y+.37,-48.1,.028,.02,1);}}
   const bx=side*11.8,bz=-43.8;for(let i=0;i<18;i++){const a=i*Math.PI/9;put(timber,bx+Math.cos(a)*.56,.67,bz+Math.sin(a)*.56,.19,1.26,.10,box,0,Math.PI/2-a,0,.65+rand()*.3);}for(const y of [.13,.65,1.19])put(iron,bx,y,bz,.62,.62,.62,hoop,Math.PI/2);put(grain,bx,1.25,bz,.54,.54,1,circle,-Math.PI/2);for(let i=0;i<65;i++)put(grain,bx+(rand()-.5)*.7,1.27,bz+(rand()-.5)*.7,.02,.012,.035,sphere,0,rand()*6,0);
   bucket(side*5,-43.6);bucket(side*6,-44.1);
   for(let i=0;i<3;i++){const x=side*(7.5+i*.5);beam([x,.2,-43.6],[x+side*.4,2.6,-44],.045);put(iron,x,.2,-43.6,.65,.06,.1);for(let n=0;n<5;n++)put(iron,x-.25+n*.12,.12,-43.6,.024,.21,.026);}
   for(let i=0;i<4;i++)put(rope,side*10,.13+i*.03,-45.7,.42-i*.055,.42-i*.055,.42-i*.055,hoop,Math.PI/2);
   bounds.push({kind:'stable-store',minX:side<0?-14:4.5,maxX:side<0?-4.5:14,minZ:-49,maxZ:-42.9});
  }
  for(const {mat,geo,items}of batches.values()){const b=new T.InstancedMesh(geo,mat,items.length);items.forEach((p,i)=>{b.setMatrixAt(i,p.matrix);b.setColorAt(i,new T.Color(p.tint,p.tint,p.tint));});b.name='Ahır · ortak mimari';b.receiveShadow=true;b.castShadow=mat===timber||mat===stone;b.computeBoundingSphere();root.add(b);}root.userData.staticBatches=batches.size;
  const shadowSize=64,shadowPixels=new Uint8Array(shadowSize*shadowSize*4);for(let y=0;y<shadowSize;y++)for(let x=0;x<shadowSize;x++){const r=Math.hypot((x+0.5)/shadowSize*2-1,(y+0.5)/shadowSize*2-1),i=(y*shadowSize+x)*4;shadowPixels[i+3]=Math.round(Math.max(0,1-r)**2*100);}const shadowMap=new T.DataTexture(shadowPixels,shadowSize,shadowSize);shadowMap.needsUpdate=true;
  const contactMaterial=new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  function contactShadow(w,d){const m=new T.Mesh(new T.PlaneGeometry(w,d),contactMaterial);m.rotation.x=-Math.PI/2;m.position.y=.008;m.name='Yumuşak temas gölgesi';return m;}
  root.userData.torchCount=0;root.userData.localLightLimit=0;root.userData.openAir=true;
  return {root,slots,bounds,tick(){},contactShadow};
 }
 return {create,width:WIDTH,depth:DEPTH};
})();
if(typeof module!=='undefined')module.exports=LudusStableEnvironment;
