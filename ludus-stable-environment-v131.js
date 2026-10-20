/* Torch-lit stable architecture. Shared textures, instanced joinery and six local lights. */
var LudusStableEnvironment=(()=>{
 'use strict';
 const WIDTH=30,DEPTH=54,TORCH_ROWS=[1,-6,-13,-20,-27,-34,-41,-48];
 function create(T){
  const root=new T.Group(),slots=[],bounds=[],torches=[],lamps=[],textures=new Map(),batches=new Map(),dummy=new T.Object3D();let time=0;
  root.name='Ahır · toprak, ahşap ve meşaleler';root.userData={width:WIDTH,depth:DEPTH,stalls:12,features:['compacted-earth','timber-floorboards','weathered-plaster','stone-plinths','timber-trusses','stall-bars','straw-bedding','mangers','water-troughs','feed-sacks','staved-barrels','bridles','buckets','hoofprints','wall-torches','one-groom']};
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
  weather(stone,'float stableSoot=(1.-smoothstep(.16,.43,abs(mod(stableWorld.z-1.+3.5,7.)-3.5)))*(1.-smoothstep(3.60,3.85,abs(stableWorld.x)))*smoothstep(2.85,3.5,stableWorld.y)*(1.-smoothstep(4.35,4.8,stableWorld.y));diffuseColor.rgb*=1.-stableSoot*.42;','stone');
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
  put(plaster,0,2.5,-49.5,30,5,.3);
  for(const side of [-1,1]){put(plaster,side*15,2.5,-22.5,.3,5,54);put(plaster,side*7.5,5.15,-22.5,15.1,.18,54,box,0,0,-side*.055);}
  // Individual irregular masonry joints give the wall base and supports depth.
  for(const side of [-1,1])for(let row=0;row<3;row++)for(let i=0;i<43;i++)put(stone,side*14.78,.16+row*.31,3.75-i*1.25+(row%2)*.3,.23,.29,1.21,box,0,0,0,.78+rand()*.22);
  for(const side of [-1,1]){put(plaster,side*8.45,2.5,4.5,13.1,5,.3);for(let i=0;i<6;i++)put(timber,side*(.16+i*.285),1.5,4.46,.27,3,.14,box,0,0,0,.8+rand()*.2);for(const y of [.35,2.5])put(iron,side*.9,y,4.35,1.68,.085,.025);put(stone,side*1.9,1.62,4.2,.26,3.25,.42);}
  put(plaster,0,4.1,4.5,3.9,1.8,.3);put(stone,0,3.18,4.2,4.1,.22,.42);
  for(const z of TORCH_ROWS){
   put(timber,0,4.56,z,29.7,.24,.28);
   for(const side of [-1,1]){
    const x=side*3.8;put(stone,x,.16,z,.72,.32,.72);put(stone,x,2.34,z,.25,4.05,.25,cylinder);put(stone,x,4.44,z,.66,.19,.66);beam([x,3.7,z],[x+side*1.3,4.57,z],.15);
    put(timber,side*13.8,2.4,z,.25,4.8,.25);beam([side*13.8,3.6,z],[side*12.6,4.57,z],.15);beam([0,5.55,z],[side*14.8,4.73,z],.16);beam([side*7.2,4.57,z],[0,5.55,z],.12);
    const tx=side*3.13;put(iron,side*3.52,2.42,z,.07,.44,.23);beam([side*3.52,2.22,z],[tx,2.54,z],.065,iron);put(timber,tx,2.45,z,.055,.58,.055,cylinder);put(iron,tx,2.77,z,.16,.17,.16,cylinder);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;beam([tx+Math.cos(a)*.11,2.72,z+Math.sin(a)*.11],[tx+Math.cos(a)*.18,2.99,z+Math.sin(a)*.18],.025,iron);}
    torches.push({x:tx,y:3.12,z,phase:rand()*6.28});
   }
  }
  for(const x of [-13.8,-7.8,0,7.8,13.8])put(timber,x,5.50-Math.abs(x)*.055,-22.5,.16,.2,53.7);
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
   for(let i=0;i<22;i++)put(timber,front,.69,z-3.12+i*.297,.14,1.35,.279,box,0,0,0,.74+rand()*.25);
   for(const dz of [-3.34,3.34]){
    for(let i=0;i<30;i++)put(timber,side*(3.95+i*.325),.76,z+dz,.31,1.5,.14,box,0,0,0,.76+rand()*.24);
    put(timber,side*8.75,3.45,z+dz,9.75,.15,.16);for(let x=4.1;x<13.6;x+=.38)put(iron,side*x,2.48,z+dz,.038,1.77,.038);put(timber,front,1.8,z+dz,.21,3.6,.21);
   }
   put(timber,front,3.5,z,.22,.17,6.9);put(timber,front,1.43,z,.2,.12,6.9);
   for(let i=0;i<22;i++){const dz=-3.12+i*.297;if(Math.abs(dz)>.8)put(iron,front,2.45,z+dz,.037,1.96,.037);}
   for(const dz of [-.85,.85])put(timber,front,2.45,z+dz,.16,2,.1);
   for(const dz of [-2.8,2.8])for(const y of [.45,1.1]){put(iron,front-side*.1,y,z+dz,.035,.075,.4);for(const offset of [-.13,.13])put(iron,front-side*.125,y,z+dz+offset,.025,.025,.025,sphere);}
   put(iron,front-side*.13,1.34,z+1.1,.04,.08,.46);put(iron,front-side*.15,1.19,z+1.1,.08,.13,.08,hoop,0,Math.PI/2);
   // Separate uneven straw islands instead of a featureless yellow rectangular floor.
   for(let i=0;i<10;i++)put(hay,side*(5.2+rand()*7.4),.025,z+(rand()-.5)*5.7,.55+rand()*1.15,.025,.4+rand()*.75,cylinder,0,rand()*Math.PI,0,.75+rand()*.25);
   for(let n=0;n<95;n++)put(straw,side*(3.5+rand()*9.5),.07+rand()*.025,z+(rand()-.5)*6.3,.009,.009,.13+rand()*.34,box,0,rand()*Math.PI,0,.7+rand()*.3);
   trough(side,z);bounds.push({kind:'stable-stall',minX:side<0?-14:3.62,maxX:side<0?-3.62:14,minZ:z-3.45,maxZ:z+3.45});
   put(iron,side*14.77,3.35,z,.06,1.55,2.75);for(let i=0;i<9;i++)put(timber,side*14.70,3.35,z-1.2+i*.3,.09,1.45,.27,box,0,0,0,.68+rand()*.2);for(const y of [2.55,4.15])put(timber,side*14.64,y,z,.13,.12,2.85);
   // A bridle hangs outside each bay; iron rings and leather loops remain visibly separate.
   const hx=front-side*.18,hz=z+2.25;put(iron,hx,1.95,hz,.26,.045,.045);put(leather,hx-side*.12,1.55,hz,.16,.30,.16,hoop,0,Math.PI/2);put(iron,hx-side*.12,1.25,hz,.065,.065,.065,hoop,0,Math.PI/2);
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
  for(const {mat,geo,items}of batches.values()){const b=new T.InstancedMesh(geo,mat,items.length);items.forEach((p,i)=>{b.setMatrixAt(i,p.matrix);b.setColorAt(i,new T.Color(p.tint,p.tint,p.tint));});b.name='Ahır · ortak mimari';b.receiveShadow=true;b.computeBoundingSphere();root.add(b);}root.userData.staticBatches=batches.size;
  const flame=new T.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
   vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
uniform float time;varying vec2 uvFire;varying float phase;void main(){uvFire=uv;vec4 center=instanceMatrix*vec4(0.,0.,0.,1.);phase=center.z*.73+center.x;vec3 p=position;p.x+=sin(time*5.+phase+uv.y*4.)*.055*uv.y*uv.y;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);
#include <logdepthbuf_vertex>
}`,
   fragmentShader:`#include <logdepthbuf_pars_fragment>
uniform float time;varying vec2 uvFire;varying float phase;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){float y=uvFire.y;float n=noise(vec2(uvFire.x*5.+phase,y*7.-time*4.));float x=uvFire.x-.5+sin(y*8.-time*4.+phase)*.07*y;float width=(1.-y)*.40*(.72+.35*n);float a=(1.-smoothstep(width*.5,width,abs(x)))*smoothstep(0.,.1,y)*(1.-smoothstep(.76,1.,y+n*.1));float core=(1.-smoothstep(.02,.18,abs(x)))*(1.-smoothstep(.1,.6,y));vec3 c=mix(vec3(1.,.14,.012),vec3(1.,.63,.12),1.-y);c=mix(c,vec3(1.,.94,.64),core);if(a<.015)discard;
#include <logdepthbuf_fragment>
gl_FragColor=vec4(c,a*.88);}`});
  const fire=new T.InstancedMesh(new T.PlaneGeometry(.58,.90),flame,torches.length*2);let fi=0;for(const p of torches)for(const angle of [0,Math.PI/2]){dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,angle,0);dummy.scale.set(1,1,1);dummy.updateMatrix();fire.setMatrixAt(fi++,dummy.matrix);}fire.name='Meşaleler · canlı alev';fire.computeBoundingSphere();root.add(fire);
  const ember=new T.MeshBasicMaterial({color:0xfda43b,toneMapped:false});const embers=new T.InstancedMesh(new T.SphereGeometry(.13,8,5),ember,torches.length);torches.forEach((p,i)=>{dummy.position.set(p.x,2.82,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,.4,1);dummy.updateMatrix();embers.setMatrixAt(i,dummy.matrix);});embers.computeBoundingSphere();root.add(embers);
  // Lights are pooled at actual torch positions. The number is fixed as the camera moves.
  for(let i=0;i<6;i++){const l=new T.PointLight(0xffb85d,0,18,2);l.name='Meşale ışığı';l.castShadow=false;root.add(l);lamps.push(l);}
  const shadowSize=64,shadowPixels=new Uint8Array(shadowSize*shadowSize*4);for(let y=0;y<shadowSize;y++)for(let x=0;x<shadowSize;x++){const r=Math.hypot((x+0.5)/shadowSize*2-1,(y+0.5)/shadowSize*2-1),i=(y*shadowSize+x)*4;shadowPixels[i+3]=Math.round(Math.max(0,1-r)**2*100);}const shadowMap=new T.DataTexture(shadowPixels,shadowSize,shadowSize);shadowMap.needsUpdate=true;
  const contactMaterial=new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  function contactShadow(w,d){const m=new T.Mesh(new T.PlaneGeometry(w,d),contactMaterial);m.rotation.x=-Math.PI/2;m.position.y=.008;m.name='Yumuşak temas gölgesi';return m;}
  function tick(dt,player={x:0,z:1}){time+=Math.min(dt,.1);flame.uniforms.time.value=time;const near=torches.map(p=>({p,d:(p.x-(player.x||0))**2+(p.z-(player.z||0))**2})).sort((a,b)=>a.d-b.d);lamps.forEach((l,i)=>{const p=near[i].p;l.position.set(p.x,p.y,p.z);l.intensity=105*(.94+.045*Math.sin(time*6+p.phase)+.025*Math.sin(time*13.7+p.phase));});}
  tick(0);root.userData.torchCount=torches.length;root.userData.torchSpacing=7;root.userData.localLightLimit=lamps.length;
  return {root,slots,bounds,torches,lamps,tick,contactShadow};
 }
 return {create,width:WIDTH,depth:DEPTH};
})();
if(typeof module!=='undefined')module.exports=LudusStableEnvironment;
