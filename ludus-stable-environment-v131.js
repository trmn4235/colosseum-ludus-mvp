/* V161: sourced PBR surfaces, irregular masonry and a working Roman-inspired stable. */
var LudusStableEnvironment=(()=>{
 'use strict';
 const WIDTH=44,DEPTH=34,WALL_HEIGHT=5.6,STALL_FRONT=-21,STALL_BACK=-28.8;
 const spawn={x:0,y:0,z:-10,yaw:0,pitch:.20},groomPosition={x:-2.8,y:.035,z:-10.6};
 function create(T,{ludusWall,onError}={}){
  const root=new T.Group(),slots=[],bounds=[],textures=new Map(),batches=new Map(),dummy=new T.Object3D();
  root.name='Taş ahır ve kum antrenman avlusu';root.userData={version:161,width:WIDTH,depth:DEPTH,stalls:12,trainingYard:true,wallHeight:WALL_HEIGHT,features:['irregular-dark-masonry','brown-timber-half-doors','distinct-cobblestone-apron','scanned-dense-sand','ludus-sandstone-wall','limewashed-stall-interiors','open-sky','loose-fodder','mangers','water-troughs','drainage','tack-shelter','four-horn-saddles','bronze-harness-fittings','sourced-roman-props','courtyard-daylight','one-groom'],propsReady:false,propErrors:[]};
  let seed=131;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  function texture(path,colorMap=true){if(typeof Image==='undefined')return null;const key=path+':'+colorMap;if(textures.has(key))return textures.get(key);const t=new T.TextureLoader().load(path);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=colorMap?T.SRGBColorSpace:T.NoColorSpace;t.anisotropy=4;textures.set(key,t);return t;}
  function surface(color,file,scale=1,bump=.025,detail={}){
   const map=file?texture(file):null,m=new T.MeshStandardMaterial({color,roughness:detail.roughness?1:.94,map,bumpMap:detail.height?texture(detail.height,false):map,bumpScale:bump,roughnessMap:detail.roughness?texture(detail.roughness,false):null});
   if(detail.source){m.name=detail.source;m.userData.source='https://polyhaven.com/a/'+detail.source;m.userData.license='CC0-1.0';}
   m.onBeforeCompile=s=>{
    s.uniforms.stableUvScale={value:scale};s.vertexShader='varying vec3 stableWorld; varying vec3 stableAxis; varying vec2 stableTimberUv; varying vec2 stableTileOffset;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`vec4 stablePoint=vec4(transformed,1.);vec3 stableNormal=objectNormal;
vec3 stableSize=vec3(1.);float stableBoardOffset=0.;
#ifdef USE_INSTANCING
stableSize=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
stableBoardOffset=dot(instanceMatrix[3].xyz,vec3(.17,.07,.13));
stablePoint=instanceMatrix*stablePoint;stableNormal=mat3(instanceMatrix)*stableNormal;
#endif
vec3 stableLocal=transformed*stableSize;vec3 stableFace=abs(objectNormal);
if(stableSize.y>=stableSize.x&&stableSize.y>=stableSize.z)stableTimberUv=vec2(stableLocal.y,stableFace.x>stableFace.z?stableLocal.z:stableLocal.x);
else if(stableSize.x>=stableSize.z)stableTimberUv=vec2(stableLocal.x,stableFace.y>stableFace.z?stableLocal.z:stableLocal.y);
else stableTimberUv=vec2(stableLocal.z,stableFace.x>stableFace.y?stableLocal.y:stableLocal.x);
stableTimberUv.x+=stableBoardOffset;
stableTileOffset=fract(sin(vec2(stableBoardOffset*17.13,stableBoardOffset*43.71))*43758.5453)*19.;
stableWorld=(modelMatrix*stablePoint).xyz;stableAxis=normalize(mat3(modelMatrix)*stableNormal);
#include <project_vertex>`);
    const projection=detail.timber?'return stableTimberUv*stableUvScale;':'vec3 a=abs(stableAxis);return (a.y>a.x&&a.y>a.z?stableWorld.xz:a.x>a.z?stableWorld.zy:stableWorld.xy)*stableUvScale'+(detail.masonry?'+stableTileOffset':'')+';';
    // Three randomized, continuously blended samples remove the square repeat in organic scans.
    const sample=detail.organic?`vec2 stableHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
vec4 stableSample(sampler2D tex,vec2 uv){vec2 skew=mat2(1.,0.,-.57735027,1.15470054)*uv*.7;vec2 cell=floor(skew),f=fract(skew);vec2 b,c;vec3 w;if(f.x+f.y<1.){b=cell+vec2(1.,0.);c=cell+vec2(0.,1.);w=vec3(1.-f.x-f.y,f.x,f.y);}else{cell+=vec2(1.);b=cell-vec2(1.,0.);c=cell-vec2(0.,1.);w=vec3(f.x+f.y-1.,1.-f.x,1.-f.y);}w=w*w*w;w/=dot(w,vec3(1.));return texture2D(tex,uv+stableHash(cell)*13.)*w.x+texture2D(tex,uv+stableHash(b)*13.)*w.y+texture2D(tex,uv+stableHash(c)*13.)*w.z;}`:'';
    s.fragmentShader='varying vec3 stableWorld;varying vec3 stableAxis;varying vec2 stableTimberUv;varying vec2 stableTileOffset;uniform float stableUvScale;vec2 stableSurfaceUv(){'+projection+'}\n'+sample+'\n'+s.fragmentShader;
    for(const chunk of ['map_fragment','bumpmap_pars_fragment','roughnessmap_fragment']){
     let code=T.ShaderChunk[chunk].replaceAll('vMapUv','stableSurfaceUv()').replaceAll('vBumpMapUv','stableSurfaceUv()').replaceAll('vRoughnessMapUv','stableSurfaceUv()');
     if(detail.organic)code=code.replace(/texture2D\( (map|bumpMap|roughnessMap),/g,'stableSample( $1,');
     if(chunk==='map_fragment'&&detail.weather)code+='\n diffuseColor.rgb*=mix(.87,1.04,.5+.25*sin(stableWorld.x*.29+stableWorld.z*.19)+.25*sin(stableWorld.y*.83+stableWorld.z*.37));';
     if(chunk==='map_fragment'&&detail.sand)code+='\n float stableWear=exp(-pow((stableWorld.z+17.15+.22*sin(stableWorld.x*.4))/.8,2.));diffuseColor.rgb*=1.-stableWear*.07;';
     s.fragmentShader=s.fragmentShader.replace('#include <'+chunk+'>',code);
    }
   };
   m.customProgramCacheKey=()=> 'stable-surface-v161-'+scale+'-'+JSON.stringify(detail);return m;
  }
  const materialPath='assets/stable-v160/',newPath='assets/stable-v161/';
  const pbr=(id,extra={})=>({source:id,height:newPath+id+'_disp_1k.webp',roughness:newPath+id+'_rough_1k.webp',...extra});
  const woodDetail={source:'wood_plank_wall',height:materialPath+'wood_plank_wall_disp_1k.webp',roughness:materialPath+'wood_plank_wall_rough_1k.webp',timber:true};
  const stoneDetail={source:'castle_wall_slates',height:materialPath+'castle_wall_slates_disp_1k.webp',roughness:materialPath+'castle_wall_slates_rough_1k.webp',masonry:true,weather:true};
  const timber=surface(0xffefd9,materialPath+'wood_plank_wall_diff_1k.webp',.55,.018,woodDetail);
  const earth=surface(0xfff6e8,newPath+'dense_sand_diff_1k.webp',.56,.018,pbr('dense_sand',{organic:true,sand:true}));
  const stone=surface(0x9da4aa,materialPath+'castle_wall_slates_diff_1k.webp',.46,.045,stoneDetail);
  const paving=surface(0xeee8df,newPath+'cobblestone_floor_08_diff_1k.webp',.5,.035,pbr('cobblestone_floor_08'));
  const plaster=surface(0xcac0a8,'assets/textures/white_plaster_02-diff-6aa57de97b10.webp',.65,.012,{organic:true,weather:true});
  const hay=surface(0xd6c59d,newPath+'wrld_hay_a.webp',1.7,.018,{organic:true});
  const leather=surface(0xc2a186,newPath+'brown_leather_diff_1k.webp',2.5,.006,pbr('brown_leather'));
  const plain=(color,roughness=.9)=>new T.MeshStandardMaterial({color,roughness});
  const coping=surface(0xaaa49a,'assets/textures/white_sandstone_blocks_02-diff-291a56b4ab78.webp',.22,.018,{masonry:true});
  const boundary=ludusWall||surface(0xffffff,'assets/textures/white_sandstone_blocks_02-diff-291a56b4ab78.webp',.5,.03);
  root.userData.sharedLudusWall=!!ludusWall;
  const roof=plain(0xa16d52),iron=plain(0x373530,.73),bronze=plain(0x887044,.57),rope=plain(0xa38e65),straw=plain(0xb7a171),grain=plain(0xb29a6c),redWash=plain(0x795345),mud=plain(0x5d5649),linen=plain(0x9e957c),blanket=plain(0x74685b);
  iron.metalness=.5;bronze.metalness=.64;
  const water=new T.MeshStandardMaterial({color:0x69766b,roughness:.28,metalness:0,transparent:true,opacity:.78});
  const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,12),sphere=new T.SphereGeometry(1,10,6),hoop=new T.TorusGeometry(1,.055,5,18),pebble=new T.IcosahedronGeometry(1,0);
  // A lightly chamfered stone silhouette, shared by every irregular masonry block.
  const outline=new T.Shape();[[-.45,-.5],[.45,-.5],[.5,-.45],[.5,.45],[.45,.5],[-.45,.5],[-.5,.45],[-.5,-.45]].forEach(([x,y],i)=>i?outline.lineTo(x,y):outline.moveTo(x,y));outline.closePath();
  const block=new T.ExtrudeGeometry(outline,{depth:.94,steps:1,bevelEnabled:true,bevelSize:.025,bevelThickness:.03,bevelSegments:1,curveSegments:1});block.translate(0,0,-.47);
  function put(mat,x,y,z,w,h,d,geo=box,rx=0,ry=0,rz=0,tint=1){
   const key=mat.uuid+geo.uuid;if(!batches.has(key))batches.set(key,{mat,geo,items:[]});
   dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(w,h,d);dummy.updateMatrix();batches.get(key).items.push({matrix:dummy.matrix.clone(),tint});
  }
  function beam(a,b,w=.13,mat=timber){const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);dummy.position.copy(start).add(end).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().normalize());dummy.scale.set(w,dir.length(),w);dummy.updateMatrix();const key=mat.uuid+box.uuid;if(!batches.has(key))batches.set(key,{mat,geo:box,items:[]});batches.get(key).items.push({matrix:dummy.matrix.clone(),tint:.88+rand()*.12});}
  function masonry(x,z,width,height,depth=.4,y0=0,angle=0){
   // Continuous mortar bed behind staggered courses. Each stone receives a unique scan offset.
   put(mud,x,y0+height/2,z,width,height,depth*.9,box,0,angle);
   let y=0;while(y<height-.02){const h=Math.min(.23+rand()*.13,height-y);let u=-width/2;
    while(u<width/2-.025){const w=Math.min(.4+rand()*.55,width/2-u),c=u+w/2;put(stone,x+Math.cos(angle)*c,y0+y+h/2,z-Math.sin(angle)*c,w-.018,h-.014,depth*(.96+rand()*.07),block,0,angle,0,.84+rand()*.16);u+=w;}y+=h;
   }
  }
  function strap(points,width=.035,mat=leather){for(let i=1;i<points.length;i++)beam(points[i-1],points[i],width,mat);}
  function bridle(x,y,z,angle=0){
   const point=(a,b,c=0)=>[x+Math.cos(angle)*a+Math.sin(angle)*c,y+b,z-Math.sin(angle)*a+Math.cos(angle)*c];
   strap([point(-.15,-.68),point(-.19,-.25),point(-.13,0),point(.12,.02),point(.18,-.25),point(.14,-.68)],.032);
   strap([point(-.18,-.25),point(.18,-.25)],.025);strap([point(-.14,-.65),point(.14,-.65)],.028);
   for(const dx of [-.15,.15]){const p=point(dx,-.62);put(bronze,...p,.055,.055,.055,hoop,0,angle);const q=point(dx,-.28,.015);put(bronze,...q,.038,.038,.015,sphere,0,angle);}
   const end=point(.12,-.68);strap([end,point(.26,-1.06),point(.08,-1.18),point(-.06,-1.02),point(-.13,-.67)],.02);
  }
  function saddle(x,y,z){
   // Four supports follow the Roman saddle silhouette; no stirrups or modern saddle horn.
   put(blanket,x,y-.035,z,.78,.09,1.0,box,0,0,0,.96);
   put(leather,x,y+.055,z,.34,.10,.43,sphere);
   for(const sx of [-1,1])for(const sz of [-1,1]){
    beam([x+sx*.25,y+.02,z+sz*.34],[x+sx*.21,y+.28,z+sz*.40],.12,leather);
    put(leather,x+sx*.21,y+.27,z+sz*.40,.085,.10,.085,sphere);
   }
   for(const sx of [-1,1])strap([[x+sx*.28,y,z-.05],[x+sx*.37,y-.29,z-.05],[x+sx*.36,y-.47,z-.02]],.055);
  }
  // Only centimetres of relief: enough to catch grazing light without an uneven riding floor.
  const sandGeometry=new T.PlaneGeometry(WIDTH,DEPTH,80,64);sandGeometry.rotateX(-Math.PI/2);const sandPos=sandGeometry.attributes.position;
  for(let i=0;i<sandPos.count;i++){const x=sandPos.getX(i),z=sandPos.getZ(i)-12.5;sandPos.setY(i,-.012+.009*Math.sin(x*.67+z*.41)+.006*Math.sin(x*1.72-z*.91));}sandGeometry.computeVertexNormals();
  const sandFloor=new T.Mesh(sandGeometry,earth);sandFloor.position.z=-12.5;sandFloor.receiveShadow=true;sandFloor.name='Hazır Dense Sand · düzensiz örnekleme';root.add(sandFloor);
  put(mud,0,-.07,-24.5,42,.13,8.5);
  put(paving,0,-.003,-19.75,41.5,.055,3.7);
  // A flush covered drainage run separates the stone apron from the sand.
  put(mud,0,.017,-17.82,41.8,.025,.23);
  for(let x=-20.8;x<20.8;x+=.54)put(coping,x,.028,-17.82,.49,.04,.27,block,0,0,0,.85+rand()*.15);
  for(const side of [-1,1])put(coping,side*21.6,.13,-10.7,.25,.26,28.8);

  // East and entrance walls use the actual shared Ludus sandstone material.
  put(boundary,22,2.8,-12.5,.48,5.6,34);
  put(coping,21.72,.34,-12.5,.3,.68,34);
  // West boundary: rubble base, aged limewash and a restrained ochre-red dado.
  masonry(-22,-12.5,34,1.18,.48,0,Math.PI/2);
  put(plaster,-22,3.37,-12.5,.48,4.46,34);
  put(redWash,-21.75,1.42,-12.5,.018,.38,34);
  put(plaster,0,2.8,-29.5,44,5.6,.48);
  for(const side of [-1,1]){
   for(let z=-28.8;z<4.5;z+=5.5){put(side===1?boundary:coping,side*21.72,2.8,z,.55,5.6,.65,block,0,0,0,.9+rand()*.1);put(coping,side*21.65,.28,z,.7,.56,.85,block);}
   for(let z=-29.2;z<4.5;z+=1.05)put(coping,side*22,5.67,z,.72,.22,1.0,block,0,0,0,.86+rand()*.14);
   put(boundary,side*12,2.8,4.5,20,5.6,.48);
   put(coping,side*12,.34,4.21,20,.68,.16);
   put(boundary,side*2.05,2.8,4.35,.48,5.6,.7);
   put(coping,side*12,5.67,4.5,20,.22,.7);
   for(let i=0;i<7;i++)put(timber,side*(.14+i*.27),1.8,4.46,.25,3.6,.18,box,0,0,0,.88+rand()*.12);
   for(const y of [.5,2.7])put(iron,side*.97,y,4.3,1.83,.1,.04);
   beam([side*.15,.45,4.32],[side*1.7,2.78,4.32],.12);
  }
  put(boundary,0,4.65,4.5,4.1,1.9,.5);put(coping,0,5.67,-29.5,44.5,.22,.7);
  const pitch=3.4;
  for(let i=0;i<12;i++){
   const x=(i-5.5)*pitch,front=STALL_FRONT;
   slots.push({index:i,x,z:-22.85,yaw:((i*7)%5-2)*.028,side:0,view:{x,z:-18.2,yaw:0,pitch:.08}});
   for(const side of [-1,1]){
    masonry(x+side*1.25,front,.9,1.4,.42);
    put(coping,x+side*1.25,1.43,front,.95,.12,.48,block);
    put(timber,x+side*.83,1.82,front+.03,.18,3.64,.22);
    put(iron,x+side*.83,.16,front+.16,.19,.23,.025);
   }
   put(coping,x,.03,front,1.65,.08,.44,block,0,0,0,.86);
   for(let n=0;n<7;n++)put(timber,x-.69+n*.23,.64+(n%3)*.003,front+.035,.215,1.20,.16,box,0,0,0,.83+rand()*.17);
   for(const y of [.28,.98]){
    put(timber,x,y,front+.14,1.58,.12,.075);
    put(iron,x-.48,y,front+.19,.55,.065,.035);
    for(const dx of [-.7,-.27])put(iron,x+dx,y,front+.213,.035,.035,.02,sphere);
    put(iron,x-.81,y,front+.18,.06,.12,.05,cylinder);
   }
   beam([x-.7,.25,front+.17],[x+.7,1.06,front+.17],.08);
   put(timber,x,1.29,front+.05,1.7,.12,.24);
   put(iron,x+.66,1.03,front+.205,.3,.075,.04);put(iron,x+.63,.93,front+.24,.075,.09,.075,hoop);
   put(timber,x,3.6,front,pitch,.24,.27);
   masonry(x,STALL_BACK,pitch,1.05,.38);put(plaster,x,2.32,STALL_BACK,pitch,2.54,.38);
   put(mud,x,-.005,-25.7,3.04,.06,5.6);
   // Loose bedding has a broken perimeter and varied depth, not identical rectangular mats.
   for(let n=0;n<5;n++)put(hay,x+(rand()-.5)*1.4,.025,-25.1+rand()*2.5,.7+rand()*.45,.035+rand()*.025,.9+rand()*.45,sphere,0,rand()*6.28,0,.86+rand()*.14);
   for(let n=0;n<55;n++)put(straw,x+(rand()-.5)*2.85,.055,-27.9+rand()*6.5,.007,.007,.09+rand()*.25,box,0,rand()*Math.PI,0,.8+rand()*.2);
   const mx=x-1.12,mz=-24.3;
   put(timber,mx,.43,mz,.64,.1,1.2);put(hay,mx,.67,mz,.55,.24,1.08);
   for(const dx of [-.33,.33])for(const dz of [-.6,.6])put(timber,mx+dx,.65,mz+dz,.065,1.2,.065);
   for(const y of [.5,1.13])put(timber,mx+.34,y,mz,.07,.07,1.25);
   for(let n=0;n<6;n++)beam([mx+.34,.55,mz-.52+n*.21],[mx+.46,1.14,mz-.52+n*.21],.045);
   const wx=x+1.0,wz=-25.0;
   put(coping,wx,.14,wz,.82,.26,.96,block);
   for(const dx of [-.36,.36])put(coping,wx+dx,.42,wz,.12,.38,.96,block);
   for(const dz of [-.42,.42])put(coping,wx,.42,wz+dz,.64,.38,.12,block);
   put(water,wx,.51,wz,.58,.012,.7);
   // Covered longitudinal drain beside the rear bedding: a functional use of Roman evidence.
   for(let n=0;n<7;n++)put(coping,x+.98,.025,-27.8+n*.34,.43,.055,.3,block,0,0,0,.87);
   if(i%3===1){put(iron,x+1.18,1.91,front+.28,.06,.06,.28);bridle(x+1.18,1.91,front+.43);}
   bounds.push({kind:'stable-stall',minX:x-1.7,maxX:x+1.7,minZ:STALL_BACK-.2,maxZ:front+.25});
  }
  slots.sort((a,b)=>Math.abs(a.x)-Math.abs(b.x)||a.x-b.x);slots.forEach((s,i)=>s.index=i);
  // Low masonry with limewashed upper partitions; open ventilation remains beneath the rafters.
  for(let i=0;i<=12;i++){
   const x=-20.4+i*3.4;
   masonry(x,-24.9,7.8,1.05,.3,0,Math.PI/2);put(plaster,x,1.96,-24.9,.3,1.82,7.8);
   put(timber,x,2.94,-24.9,.16,.14,7.8);
   for(let z=-22.2;z>-28.4;z-=1.1)put(timber,x,3.28,z,.055,.55,.055);
   put(timber,x,1.83,-20.98,.25,3.66,.28);put(coping,x,.15,-20.98,.42,.3,.44,block);
   beam([x,3.56,-20.4],[x,4.45,-29.1],.17);beam([x,2.85,-21],[x,3.7,-22.2],.13);
   for(const y of [3.12,3.53])put(iron,x+.13,y,-20.96,.025,.055,.2);
  }
  put(timber,0,3.66,-20.55,41.4,.18,.22);
  const slope=Math.atan(.89/8.7);put(timber,0,4.05,-24.75,41.7,.09,8.9,box,slope);
  for(let z=-21;z>-29;z-=1.15)put(timber,0,3.62+(-20.35-z)*Math.tan(slope),z,41.7,.11,.12);
  const tile=new T.CylinderGeometry(.16,.16,.82,6,1,true,0,Math.PI);
  for(let col=0;col<130;col++)for(let row=0;row<12;row++){
   const z=-20.35-row*.76,y=3.72+(-20.35-z)*Math.tan(slope);put(roof,-20.64+col*.32,y,z,1,1,1,tile,Math.PI/2+slope,0,Math.PI/2,.83+rand()*.17);
  }
  // A sheltered service strip on the east. The full 36m-wide riding area stays unobstructed.
  for(const x of [18.7,21.5])for(const z of [-14.5,-4.8]){
   put(timber,x,1.47,z,.17,2.94,.17);put(coping,x,.13,z,.35,.26,.35,block);
   beam([x,2.3,z],[x,2.9,z+(z<-10?.65:-.65)],.11);
  }
  for(const x of [18.7,21.5])put(timber,x,2.94,-9.65,.18,.2,10.2);
  put(timber,20.1,3.03,-9.65,3.25,.09,10.2,box,0,0,.09);
  for(let c=0;c<11;c++)for(let r=0;r<14;r++)put(roof,18.52+c*.32,2.91+(c*.32)*.09,-4.55-r*.76,1,1,1,tile,Math.PI/2,0,Math.PI/2,.83+rand()*.17);
  put(paving,20.1,.007,-9.65,3.0,.05,10.1);
  // Two real tack stands, correctly shaped saddles, hanging bridles and folded cloths.
  for(const z of [-7.2,-9.0]){
   for(const dx of [-.32,.32])for(const dz of [-.32,.32])beam([20+dx,.02,z+dz],[20+dx*.6,.95,z+dz*.9],.075);
   put(timber,20,.96,z,.24,.11,1.05);saddle(20,1.06,z);
  }
  put(timber,21.45,1.93,-8.5,.12,.15,4.8);
  for(let i=0;i<4;i++){put(iron,21.24,1.92,-6.9-i*1.13,.3,.05,.05);bridle(21.18,1.9,-6.9-i*1.13,-Math.PI/2);}
  put(timber,20.1,.69,-12.5,2.3,.12,.85);
  for(const x of [19.2,21])for(const z of [-12.8,-12.2])put(timber,x,.34,z,.1,.68,.1);
  for(let i=0;i<3;i++)put(i===1?blanket:linen,20.55,.8+i*.07,-12.5,.65,.065,.64,box,0,i*.04,0,.92+rand()*.08);
  // Shared drinking trough, broad stone rim, visible water and a clay gravity-feed spout.
  put(coping,20.25,.15,-2.65,2.7,.3,1.1,block);
  for(const z of [-3.17,-2.13])put(coping,20.25,.55,z,2.7,.65,.17,block);
  for(const x of [18.98,21.52])put(coping,x,.55,-2.65,.17,.65,.95,block);
  put(water,20.25,.72,-2.65,2.31,.015,.75);
  put(mud,21.38,.012,-3.65,.9,.02,.65,sphere);
  beam([21.7,1.01,-2.65],[21.35,.92,-2.65],.12,roof);
  put(iron,19.25,1.65,-2.7,.10,.10,.10,hoop,0,Math.PI/2);
  bounds.push({kind:'stable-service-shelter',minX:18.45,maxX:21.8,minZ:-14.9,maxZ:-4.45});
  bounds.push({kind:'stable-water-point',minX:18.8,maxX:21.7,minZ:-3.5,maxZ:-1.9});
  // West side: a dry raised fodder bay, storage baskets and a separate tethering rail.
  put(paving,-20,.015,-12.1,3.2,.07,4.3);
  for(const x of [-21.35,-18.65])for(const z of [-14.2,-10.0])put(timber,x,1.4,z,.14,2.8,.14);
  put(timber,-20,2.85,-12.1,3.2,.1,4.6,box,0,0,-.10);
  for(let c=0;c<11;c++)for(let r=0;r<7;r++)put(roof,-21.6+c*.32,3.04-c*.028,-9.85-r*.76,1,1,1,tile,Math.PI/2,0,Math.PI/2,.86+rand()*.14);
  for(let z=-13.6;z<-10.6;z+=.28)put(timber,-20.1,.15,z,2.5,.09,.23);
  for(const z of [-7.8,-4.0]){put(timber,-20.3,.75,z,.18,1.5,.18);put(coping,-20.3,.14,z,.34,.28,.34,block);}
  put(timber,-20.3,1.25,-5.9,.15,.15,4.1);
  for(const z of [-7.1,-5.7,-4.5]){put(iron,-20.15,1.12,z,.075,.075,.075,hoop,0,Math.PI/2);strap([[-20.1,1.1,z],[-19.95,.75,z+.12],[-19.96,.39,z+.25]],.018,rope);}
  beam([-21.2,.10,-9.6],[-21.55,1.9,-10.0],.038);
  for(let i=0;i<18;i++)beam([-21.2+(i-9)*.016,.06,-9.6+(rand()-.5)*.12],[-21.22,.42,-9.67],.011,straw);
  bounds.push({kind:'stable-fodder-shelter',minX:-21.65,maxX:-18.4,minZ:-14.6,maxZ:-9.7});
  bounds.push({kind:'stable-tether-rail',minX:-20.6,maxX:-20,minZ:-8.1,maxZ:-3.7});
  root.userData.trainingYardBounds={minX:-18,maxX:18,minZ:-17.5,maxZ:3.8};root.userData.stallFront=STALL_FRONT;
  for(const {mat,geo,items}of batches.values()){
   const b=new T.InstancedMesh(geo,mat,items.length);items.forEach((p,i)=>{b.setMatrixAt(i,p.matrix);b.setColorAt(i,new T.Color(p.tint,p.tint,p.tint));});
   b.name='Ahır · '+(mat.name||'işlevsel mimari');b.receiveShadow=true;b.castShadow=![water,mud,hay,straw].includes(mat);b.computeBoundingSphere();root.add(b);
  }
  root.userData.staticBatches=batches.size;
  const shadowSize=64,shadowPixels=new Uint8Array(shadowSize*shadowSize*4);for(let y=0;y<shadowSize;y++)for(let x=0;x<shadowSize;x++){const r=Math.hypot((x+0.5)/shadowSize*2-1,(y+0.5)/shadowSize*2-1),i=(y*shadowSize+x)*4;shadowPixels[i+3]=Math.round(Math.max(0,1-r)**2*100);}const shadowMap=new T.DataTexture(shadowPixels,shadowSize,shadowSize);shadowMap.needsUpdate=true;
  const contactMaterial=new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  function contactShadow(w,d){const m=new T.Mesh(new T.PlaneGeometry(w,d),contactMaterial);m.rotation.x=-Math.PI/2;m.position.y=.008;m.name='Yumuşak temas gölgesi';return m;}
  const sourcedProps=[
   ['fodder',[[-20.1,.21,-12.5,.72,.23],[-20.65,.21,-13.4,.43,-.5]]],
   ['basket',[[19.35,.05,-13.35,.53,.3],[19.5,.76,-12.5,.37,-.4],[-19.6,.05,-10.65,.59,.7]]],
   ['amphorae',[[-20.65,.05,-10.7,.50,.2],[20.55,.05,-13.75,.42,-.2]]],
   ['bucket',[[18.45,.015,-2.5,.43,.3],[20.85,.05,-11.3,.36,-.6]]]
  ];
  const ready=typeof T.GLTFLoader==='function'?Promise.all(sourcedProps.map(([name,placements])=>new Promise(resolve=>{
   new T.GLTFLoader().load(newPath+name+'.glb',g=>{
    for(const [x,y,z,h,angle]of placements){const prop=g.scene.clone(true);prop.name='0 A.D. · '+name;prop.userData.source='0 A.D. / Wildfire Games';prop.userData.license='CC-BY-SA-3.0';prop.position.set(x,y,z);prop.scale.setScalar(h);prop.rotation.y=angle;prop.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});root.add(prop);
     const shadow=contactShadow(h*(name==='fodder'||name==='amphorae'?2.7:1.45),h*(name==='fodder'||name==='amphorae'?2.7:1.45));shadow.position.set(x,y+.008,z);root.add(shadow);
    }resolve();
   },undefined,()=>{root.userData.propErrors.push(name);onError?.('Ahırdaki '+name+' modeli yüklenemedi.');resolve();});
  }))).then(()=>{root.userData.propsReady=root.userData.propErrors.length===0;}):Promise.resolve();
  root.userData.torchCount=0;root.userData.localLightLimit=0;root.userData.openAir=true;
  return {root,slots,bounds,spawn,groomPosition,ready,tick(){},contactShadow};
 }
 return {create,width:WIDTH,depth:DEPTH,wallHeight:WALL_HEIGHT,spawn,groomPosition,version:161};
})();
if(typeof module!=='undefined')module.exports=LudusStableEnvironment;
