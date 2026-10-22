/* V159: one row of twelve stone horse rooms overlooking an open sand training courtyard. */
var LudusStableEnvironment=(()=>{
 'use strict';
 const WIDTH=44,DEPTH=34,WALL_HEIGHT=5.6,STALL_FRONT=-21,STALL_BACK=-28.8;
 const spawn={x:0,y:0,z:-10,yaw:0,pitch:.04},groomPosition={x:-2.8,y:.035,z:-10.6};
 function create(T){
  const root=new T.Group(),slots=[],bounds=[],textures=new Map(),batches=new Map(),dummy=new T.Object3D();
  root.name='Taş ahır ve kum antrenman avlusu';root.userData={version:159,width:WIDTH,depth:DEPTH,stalls:12,trainingYard:true,wallHeight:WALL_HEIGHT,features:['stone-horse-rooms','timber-half-doors','cobblestone-apron','sand-training-yard','open-sky','straw-bedding','mangers','water-troughs','bridles','hoofprints','courtyard-daylight','one-groom']};
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
  const timber=surface(0xc4a37d,'assets/stable-v131/timber.webp',.65,.028),earth=surface(0xf5e5c5,'assets/textures/sand_01-diff-05b825608ef2.webp',.32,.035),hay=surface(0xc2ac76,'assets/stable-v131/straw.webp',1.4,.055);
  const plaster=surface(0xeee6d5,'assets/textures/white_plaster_02-diff-6aa57de97b10.webp',.6,.025),stone=surface(0xcfc4b0,'assets/textures/stone_wall_02-diff-978ee90ff99a.webp',.6,.06);
  function weather(m,code,key){const apply=m.onBeforeCompile;m.onBeforeCompile=s=>{apply(s);s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',code+'\n#include <color_fragment>');};m.customProgramCacheKey=()=> 'stable-weather-v131-'+key;}
  weather(plaster,'float stableDamp=(1.-smoothstep(.25,1.7,stableWorld.y))*(.8+.2*sin(stableWorld.z*2.3+sin(stableWorld.z*5.)));diffuseColor.rgb*=1.-stableDamp*.26;','plaster');

  const plain=(color,roughness=.9)=>new T.MeshStandardMaterial({color,roughness});
  const paving=surface(0xb2a992,'assets/textures/white_sandstone_blocks_02-diff-291a56b4ab78.webp',.8,.02),roof=plain(0x91644c);
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

  // The playing surface is one uninterrupted courtyard, with the horse wing behind it.
  put(earth,0,-.12,4.5-DEPTH/2,WIDTH,.24,DEPTH);
  put(stone,0,-.03,-24.25,42,.1,9.1);
  // Individually laid, shallow cobbles: a flush apron at the fronts of every room.
  for(let r=0;r<9;r++)for(let c=0;c<91;c++){
   const x=-21+c*.465+(r%2)*.23,z=-21.6+r*.43;
   put(paving,x,.012+rand()*.006,z,.436,.035,.402,box,0,(rand()-.5)*.035,0,.78+rand()*.22);
  }
  // Enclosure height is the same 5.6m used by the ludus courtyard side walls.
  for(const side of [-1,1]){
   put(plaster,side*22,WALL_HEIGHT/2,-12.5,.48,WALL_HEIGHT,34);
   put(stone,side*21.88,.42,-12.5,.56,.84,34);
   put(paving,side*22,5.65,-12.5,.66,.18,34);
  }
  put(stone,0,2.8,-29.5,44,5.6,.48);put(paving,0,5.65,-29.5,44.5,.18,.65);
  for(const side of [-1,1]){
   put(plaster,side*12,2.8,4.5,20,5.6,.48);
   put(stone,side*2.05,2.8,4.35,.48,5.6,.7);
   put(paving,side*12,5.65,4.5,20,.18,.65);
   for(let i=0;i<7;i++)put(timber,side*(.14+i*.27),1.8,4.46,.25,3.6,.18,box,0,0,0,.75+rand()*.2);
   for(const y of [.5,2.7])put(iron,side*.97,y,4.3,1.83,.1,.04);
  }
  put(stone,0,4.65,4.5,4.1,1.9,.5);
  // Twelve adjacent rooms form a single readable frontage. No old aisle or gate hides them.
  const pitch=3.4;
  for(let i=0;i<12;i++){
   const x=(i-5.5)*pitch,front=STALL_FRONT;
   slots.push({index:i,x,z:-22.85,yaw:0,side:0,view:{x,z:-18.2,yaw:0,pitch:.08}});
   // Rough stone cheeks surround an actual open upper doorway and a half-height timber gate.
   for(const side of [-1,1]){
    put(stone,x+side*1.25,.73,front,.9,1.46,.42);
    put(timber,x+side*.83,1.82,front+.03,.18,3.64,.22);
   }
   for(let n=0;n<7;n++)put(timber,x-.69+n*.23,.62,front+.035,.215,1.24,.16,box,0,0,0,.7+rand()*.3);
   for(const y of [.26,.96]){
    put(timber,x,y,front+.14,1.58,.12,.075);
    put(iron,x-.48,y,front+.19,.55,.065,.035);
    for(const dx of [-.7,-.27])put(iron,x+dx,y,front+.213,.035,.035,.02,sphere);
   }
   beam([x-.7,.23,front+.17],[x+.7,1.04,front+.17],.08);
   put(timber,x,1.29,front+.05,1.7,.12,.24);
   put(iron,x+.66,1.03,front+.205,.3,.075,.04);
   put(iron,x+.63,.93,front+.24,.075,.09,.075,hoop);
   put(timber,x,3.6,front,pitch,.24,.27);
   // Each stall has a weathered stone rear wall, bedding, a manger and water.
   put(stone,x,1.8,STALL_BACK,pitch,3.6,.38);
   put(hay,x,.035,-25.8,2.9,.04,4.8,box,0,0,0,.83);
   for(let n=0;n<40;n++)put(straw,x+(rand()-.5)*2.9,.067,-27.8+rand()*5.8,.012,.012,.15+rand()*.25,box,0,rand()*Math.PI,0,.7+rand()*.3);
   const mx=x-1.05,mz=-26.9;
   put(timber,mx,.32,mz,.75,.12,1.05);put(hay,mx,.66,mz,.64,.5,.92);
   for(const dx of [-.38,.38])for(const dz of [-.52,.52])put(timber,mx+dx,.7,mz+dz,.07,1.05,.07);
   for(const y of [.5,1.07])put(timber,mx+.38,y,mz,.075,.075,1.1);
   for(let n=0;n<5;n++)put(timber,mx+.38,.8,mz-.45+n*.22,.055,.57,.055);
   const wx=x+1.0,wz=-27.0;
   put(stone,wx,.2,wz,.88,.14,1.05);
   for(const dx of [-.39,.39])put(stone,wx+dx,.4,wz,.1,.4,1.05);
   for(const dz of [-.47,.47])put(stone,wx,.4,wz+dz,.7,.4,.1);
   put(water,wx,.53,wz,.66,.02,.83);
   // Tack hanging on the outside post gives the rooms a used, human scale.
   put(iron,x+1.18,1.65,front+.28,.07,.07,.3);
   put(leather,x+1.18,1.28,front+.46,.16,.32,.16,hoop);
   put(iron,x+1.18,.96,front+.47,.065,.065,.065,hoop);
   bounds.push({kind:'stable-stall',minX:x-1.7,maxX:x+1.7,minZ:STALL_BACK-.2,maxZ:front+.25});
  }
  // Stone partitions and timber brackets carry a pitched terracotta roof over the rooms only.
  for(let i=0;i<=12;i++){
   const x=-20.4+i*3.4;
   put(stone,x,1.6,-24.9,.3,3.2,7.8);
   put(timber,x,1.83,-20.98,.25,3.66,.28);
   put(paving,x,.15,-20.98,.42,.3,.44);
   beam([x,3.56,-20.4],[x,4.45,-29.1],.17);
   beam([x,2.85,-21],[x,3.7,-22.2],.13);
  }
  put(timber,0,3.66,-20.55,41.4,.18,.22);
  const slope=Math.atan(.89/8.7);
  put(timber,0,4.05,-24.75,41.7,.12,8.9,box,slope);
  // One instanced tile geometry keeps the detailed roof inexpensive on phones.
  const tile=new T.CylinderGeometry(.16,.16,.82,6,1,true,0,Math.PI);
  for(let col=0;col<130;col++)for(let row=0;row<12;row++){
   const z=-20.35-row*.76,y=3.72+(-20.35-z)*Math.tan(slope);
   put(roof,-20.64+col*.32,y,z,1,1,1,tile,Math.PI/2+slope,0,Math.PI/2,.8+rand()*.2);
  }
  // A narrow stone kerb outlines the sand. The central riding space stays clear.
  for(const side of [-1,1])put(paving,side*20.9,.055,-7.7,.2,.11,22);
  put(paving,0,.055,-17.85,41.8,.11,.18);
  for(let i=0;i<160;i++){
   const a=i/160*Math.PI*2,x=Math.cos(a)*15.7,z=-7.8+Math.sin(a)*8.7;
   put(mud,x+(rand()-.5)*.35,.006,z+(rand()-.5)*.3,.07,.1,.009,hoof,-Math.PI/2,0,-a,.85);
  }
  // Training poles are stored at the edge, leaving a continuous walking route to every door.
  for(let i=0;i<4;i++)put(timber,20.5,.15+i*.13,-12, .11,3,.11,cylinder,0,0,Math.PI/2,.8);
  for(const x of [18.9,20.2])for(const z of [-8,-3]){
   beam([x-.35,.06,z],[x+.35,.62,z],.09);
   beam([x+.35,.06,z],[x-.35,.62,z],.09);
  }
  for(const z of [-8,-3])put(timber,19.55,.55,z,1.8,.12,.12);
  bounds.push({kind:'stable-training-props',minX:18.4,maxX:21,minZ:-12.5,maxZ:-2.4});
  // Feed sacks and a broom sit beside the wing rather than in the training area.
  for(let i=0;i<3;i++){
   put(cloth,-21.2,.03,-23.4-i*1.15,.9,.85,.9,bag,0,rand(),0,.85);
   put(rope,-21.2,.9,-23.4-i*1.15,.12,.05,.12,cylinder);
  }
  beam([-21.2,.12,-20],[-21.6,2.2,-21],.045);
  put(straw,-21.2,.17,-20,.36,.3,.13);
  root.userData.trainingYardBounds={minX:-20.5,maxX:18,minZ:-17.5,maxZ:3.8};
  root.userData.stallFront=STALL_FRONT;
  for(const {mat,geo,items}of batches.values()){const b=new T.InstancedMesh(geo,mat,items.length);items.forEach((p,i)=>{b.setMatrixAt(i,p.matrix);b.setColorAt(i,new T.Color(p.tint,p.tint,p.tint));});b.name='Ahır · ortak mimari';b.receiveShadow=true;b.castShadow=mat===timber||mat===stone||mat===roof||mat===plaster;b.computeBoundingSphere();root.add(b);}root.userData.staticBatches=batches.size;
  const shadowSize=64,shadowPixels=new Uint8Array(shadowSize*shadowSize*4);for(let y=0;y<shadowSize;y++)for(let x=0;x<shadowSize;x++){const r=Math.hypot((x+0.5)/shadowSize*2-1,(y+0.5)/shadowSize*2-1),i=(y*shadowSize+x)*4;shadowPixels[i+3]=Math.round(Math.max(0,1-r)**2*100);}const shadowMap=new T.DataTexture(shadowPixels,shadowSize,shadowSize);shadowMap.needsUpdate=true;
  const contactMaterial=new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  function contactShadow(w,d){const m=new T.Mesh(new T.PlaneGeometry(w,d),contactMaterial);m.rotation.x=-Math.PI/2;m.position.y=.008;m.name='Yumuşak temas gölgesi';return m;}
  root.userData.torchCount=0;root.userData.localLightLimit=0;root.userData.openAir=true;
  return {root,slots,bounds,spawn,groomPosition,tick(){},contactShadow};
 }
 return {create,width:WIDTH,depth:DEPTH,wallHeight:WALL_HEIGHT,spawn,groomPosition,version:159};
})();
if(typeof module!=='undefined')module.exports=LudusStableEnvironment;
