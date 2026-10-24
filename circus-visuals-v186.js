/* Visual-only race detail. Existing licensed meshes/textures, shared geometry and bounded effects. */
var CircusVisuals=(()=>{
 'use strict';
 const colors=[0x762638,0x254b72,0x3b634b,0xb28a35],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function merge(T,root){
  const batches=new Map();root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
  root.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh)return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(inverse.clone().multiply(o.matrixWorld));const list=batches.get(o.material)||[];list.push(g);batches.set(o.material,list);});
  root.clear();for(const[material,parts]of batches){const g=new T.BufferGeometry();for(const[key,size]of[['position',3],['normal',3],['uv',2]]){const data=new Float32Array(parts.reduce((n,p)=>n+p.attributes.position.count*size,0));let offset=0;for(const p of parts){const a=p.attributes[key];if(a)data.set(a.array,offset);offset+=p.attributes.position.count*size;}g.setAttribute(key,new T.BufferAttribute(data,size));}g.computeBoundingSphere();const mesh=new T.Mesh(g,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);parts.forEach(p=>p.dispose());}
 }
 function grain(material,key){if(material.userData.race186Grain)return;material.userData.race186Grain=true;const before=material.onBeforeCompile;material.onBeforeCompile=s=>{before?.(s);s.vertexShader='varying vec3 raceDetail;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nraceDetail=position;');s.fragmentShader='varying vec3 raceDetail;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float n=fract(sin(dot(floor(raceDetail*120.0),vec3(12.9898,78.233,39.425)))*43758.5453);
  float visible=1.0-smoothstep(.3,1.0,length(fwidth(raceDetail*120.0)));diffuseColor.rgb*=1.0+(n-.5)*.12*visible;`);};material.customProgramCacheKey=()=>key;}
 function create(T,teams,root,scene){
  const lookup={};scene.traverse(o=>{if(o.material?.name)lookup[o.material.name]=o.material;});
  const wood=new T.MeshStandardMaterial({color:0xcab28a,roughness:.84,map:lookup['Cedar gates']?.map||null,normalMap:lookup['Cedar gates']?.normalMap||null,normalScale:new T.Vector2(.18,.18)});
  const bronze=new T.MeshStandardMaterial({color:0x9a7845,metalness:.78,roughness:.48}),iron=new T.MeshStandardMaterial({color:0x393b38,metalness:.75,roughness:.62}),leather=new T.MeshStandardMaterial({color:0x302821,roughness:.94}),pale=new T.MeshStandardMaterial({color:0xb8a17d,roughness:1});grain(leather,'race186-leather');grain(bronze,'race186-bronze');
  const sphere=new T.SphereGeometry(1,10,7),box=new T.BoxGeometry(1,1,1),torus=new T.TorusGeometry(1,.055,6,32),cylinder=new T.CylinderGeometry(1,1,1,12);
  function part(parent,g,mat,p,scale=[1,1,1],rot=[0,0,0]){const m=new T.Mesh(g,mat);m.position.set(...p);m.scale.set(...scale);m.rotation.set(...rot);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function rod(parent,a,b,r,mat=leather){const av=new T.Vector3(...a),bv=new T.Vector3(...b),m=part(parent,cylinder,mat,av.clone().add(bv).multiplyScalar(.5).toArray(),[r,av.distanceTo(bv),r]);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return m;}
  const shadowMaterial=new T.MeshBasicMaterial({color:0x21190f,transparent:true,opacity:.24,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  shadowMaterial.onBeforeCompile=s=>{s.vertexShader='varying vec2 groundUv;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngroundUv=uv;');s.fragmentShader='varying vec2 groundUv;\n'+s.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.a*=pow(max(0.0,1.0-length(groundUv*2.0-1.0)),1.5);');};
  const shadowGeo=new T.PlaneGeometry(1,1);shadowGeo.rotateX(-Math.PI/2);
  function rope(parent){const g=new T.BufferGeometry(),segments=14,sides=5,p=new Float32Array((segments+1)*sides*3),ix=[];for(let k=0;k<segments;k++)for(let j=0;j<sides;j++){const a=k*sides+j,b=k*sides+(j+1)%sides;ix.push(a,b,a+sides,b,b+sides,a+sides);}g.setAttribute('position',new T.BufferAttribute(p,3));g.setIndex(ix);const mesh=new T.Mesh(g,leather);mesh.frustumCulled=false;parent.add(mesh);return mesh;}
  function updateRope(mesh,a,b,speed){const p=mesh.geometry.attributes.position,dx=b.x-a.x,dz=b.z-a.z,len=Math.max(.01,Math.hypot(dx,dz)),rx=dz/len,rz=-dx/len,sag=.14-clamp(speed/250,0,.07);for(let k=0;k<=14;k++){const f=k/14,x=a.x+dx*f,y=a.y+(b.y-a.y)*f-Math.sin(f*Math.PI)*sag,z=a.z+dz*f;for(let j=0;j<5;j++){const ang=j/5*Math.PI*2,r=.012;p.setXYZ(k*5+j,x+Math.cos(ang)*r*rx,y+Math.sin(ang)*r,z+Math.cos(ang)*r*rz);}}p.needsUpdate=true;mesh.geometry.computeVertexNormals();}
  const details=[];
  teams.forEach((t,i)=>{
   t.cart.traverse(o=>{if(!o.isMesh)return;const m=o.material;if(m.name==='Wood'){if(!o.geometry.attributes.uv){const p=o.geometry.attributes.position,n=o.geometry.attributes.normal,uv=new Float32Array(p.count*2);for(let k=0;k<p.count;k++){const nx=Math.abs(n.getX(k)),ny=Math.abs(n.getY(k)),nz=Math.abs(n.getZ(k));uv[k*2]=(ny>=nx&&ny>=nz?p.getX(k):nx>=nz?p.getZ(k):p.getX(k))*.8;uv[k*2+1]=(ny>=nx&&ny>=nz?p.getZ(k):p.getY(k))*.8;}o.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));}m.map=wood.map;m.normalMap=wood.normalMap;m.normalScale=new T.Vector2(.13,.13);m.roughness=.84;m.color.setHex(0xc3a07a);m.needsUpdate=true;}if(m.name==='TeamLeather'){m.roughness=.94;grain(m,'race186-team-leather-'+i);}if(m.name==='Bronze'){m.color.setHex(0xab8a52);m.roughness=.52;}if(m.name==='Iron'){m.color.setHex(0x414440);m.roughness=.58;}});
   t.driver.traverse(o=>{if(o.isMesh&&/donitz_monk_robe|OwnerWhiteTunic/i.test(o.material.name+' '+o.name)){o.material.color.setHex(colors[i]);o.material.roughness=.95;}});
   const decor=new T.Group();decor.name='V186 cart fittings';t.cart.add(decor);
   // Floor seams, secure footbrace, low rear step, padded upper grips and axle bearings.
   for(const x of[-.48,-.24,0,.24,.48])part(decor,box,leather,[x,.735,-.22],[.012,.008,1.03]);
   rod(decor,[-.50,.86,.34],[.50,.86,.34],.035,iron);part(decor,box,wood,[0,.40,-.92],[.85,.065,.18]);for(const x of[-.32,.32])rod(decor,[x,.40,-.92],[x,.70,-.65],.025,iron);
   for(const side of[-1,1]){rod(decor,[side*.65,1.12,-.12],[side*.65,1.12,.32],.047,leather);part(decor,cylinder,bronze,[side*.88,.56,0],[.13,.15,.13],[0,0,Math.PI/2]);}
   // A team roundel sits on the front panel rather than floating over the vehicle.
   const badge=new T.MeshStandardMaterial({color:colors[i],roughness:.78});part(decor,cylinder,badge,[0,1.05,.78],[.16,.016,.16],[Math.PI/2,0,0]);part(decor,torus,bronze,[0,1.05,.796],[.16,.16,.16]);
   for(let k=0;k<8;k++){const a=k/8*Math.PI*2;part(decor,sphere,bronze,[Math.sin(a)*.125,1.05+Math.cos(a)*.125,.81],[.014,.014,.014]);}
   // A short yoke joins the two traces without projecting through the horses.
   rod(decor,[-.73,.96,1.35],[.73,.96,1.35],.04,wood);for(const x of[-.63,.63])part(decor,torus,iron,[x,.96,1.35],[.065,.065,.065],[Math.PI/2,0,0]);merge(T,decor);
   const wheelDetails=[];for(const [side,w]of t.wheels.entries()){const g=new T.Group();g.name='Iron tyre and riveted hub';w.add(g);part(g,torus,iron,[0,0,0],[.552,.552,.552],[0,Math.PI/2,0]);part(g,cylinder,bronze,[Math.sign(w.position.x)*.10,0,0],[.115,.055,.115],[0,0,Math.PI/2]);for(let k=0;k<8;k++){const a=k/8*Math.PI*2;part(g,sphere,iron,[Math.sign(w.position.x)*.135,Math.sin(a)*.085,Math.cos(a)*.085],[.012,.012,.012]);}merge(T,g);
    const scars=new T.Group();scars.name='Cirit impact · wheel';w.add(scars);for(let k=0;k<3;k++)part(scars,box,wood,[Math.sign(w.position.x)*.14,.18+k*.04,.15],[.018,.26,.035],[0,.3+k*.3,.4]);scars.visible=false;wheelDetails.push(scars);
   }
   const horseDetails=t.horses.map((h,j)=>{h.line.visible=false;const g=new T.Group();g.name='Breast collar and traces';t.group.add(g);const pts=[[-.27,1.47,.65],[-.33,1.15,.73],[0,1.04,.79],[.33,1.15,.73],[.27,1.47,.65]].map(p=>new T.Vector3(...p));part(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),16,.045,6,false),leather,[0,0,0]);for(const sign of[-1,1]){part(g,torus,bronze,[sign*.29,1.16,.77],[.045,.045,.045]);rod(g,[sign*.27,1.17,.70],[sign*.29,.87,-1.10],.018,leather);}merge(T,g);
    const bit=new T.Group();bit.name='Bridle bit rings';for(const sign of[-1,1])part(bit,torus,iron,[sign*.11,0,0],[.035,.035,.035],[0,Math.PI/2,0]);merge(T,bit);t.group.add(bit);
    const reins=rope(t.group),contact=part(t.group,shadowGeo,shadowMaterial,[h.horse.position.x,.078,2.05],[1.05,1,2.50]);contact.castShadow=false;
    h.idleAction.time=i*.47+j*.71;h.walkAction.time=i*.23+j*.38;h.gaitWeight=0;h.movingWeight=0;
    return{h,g,bit,reins,contact};});
   details.push({t,decor,wheelDetails,horseDetails});
  });
  const tempA=new T.Vector3(),tempB=new T.Vector3();
  function reins(t){t.group.updateMatrixWorld(true);if(t.contactShadow){const p=t.group.localToWorld(tempA.set(0,0,-.12));t.contactShadow.position.y=(window.CircusPreview?.model?.groundHeightAt?.(p.x,p.z)??.065)-t.group.position.y+.006;}const detail=details[teams.indexOf(t)];for(const {h,g,bit,reins,contact}of detail.horseDetails){g.position.copy(h.horse.position);g.rotation.copy(h.horse.rotation);h.mouth.getWorldPosition(tempA);t.group.worldToLocal(tempA);h.hand.getWorldPosition(tempB);t.group.worldToLocal(tempB);bit.position.copy(tempA);bit.rotation.y=h.horse.rotation.y;updateRope(reins,tempB,tempA,t.speed);contact.position.x=h.horse.position.x;const groundPoint=t.group.localToWorld(tempA.set(contact.position.x,0,contact.position.z));contact.position.y=(window.CircusPreview?.model?.groundHeightAt?.(groundPoint.x,groundPoint.z)??.065)-t.group.position.y+.006;contact.scale.x=1.05+Math.abs(h.horse.rotation.y)*.2;}}
  // One pooled dust draw, with smooth lifetime/size changes; no allocation per particle.
  const count=192,positions=new Float32Array(count*3).fill(-100),alpha=new Float32Array(count),sizes=new Float32Array(count),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('opacity',new T.BufferAttribute(alpha,1));geo.setAttribute('radius',new T.BufferAttribute(sizes,1));
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixel:{value:Math.min(devicePixelRatio||1,1.5)}},vertexShader:'attribute float opacity;attribute float radius;varying float fade;uniform float pixel;void main(){fade=opacity;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(radius*360.0*pixel/max(1.0,-p.z),1.0,48.0);}',fragmentShader:'precision mediump float;varying float fade;void main(){float d=length(gl_PointCoord*2.0-1.0);gl_FragColor=vec4(.65,.56,.43,fade*pow(max(0.0,1.0-d),2.0));}'}),dust=new T.Points(geo,mat);dust.name='Soft wheel and hoof dust';dust.frustumCulled=false;root.add(dust);
  const particles=Array.from({length:count},()=>({life:0}));let cursor=0,lastDust=0;
  function puff(p,speed,side,phase){const index=cursor++%count,q=particles[index];Object.assign(q,{life:.7+phase*.4,max:.7+phase*.4,x:p.x,y:p.y,z:p.z,dx:side*.2,dz:.13,size:.24+speed*.009+phase*.12});}
  // Recent tyre grooves fade behind the vehicles, aligned to their actual path.
  const markFade=new Float32Array(128),markGeometry=shadowGeo.clone();markGeometry.setAttribute('markFade',new T.InstancedBufferAttribute(markFade,1));const marks=new T.InstancedMesh(markGeometry,new T.MeshBasicMaterial({color:0x80684b,transparent:true,opacity:.16,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),128);marks.material.onBeforeCompile=s=>{s.vertexShader='attribute float markFade;varying float treadAlpha;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntreadAlpha=markFade;');s.fragmentShader='varying float treadAlpha;\n'+s.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.a*=treadAlpha;');};marks.name='Recent wheel grooves';marks.frustumCulled=false;root.add(marks);const stamp=new T.Object3D(),markLife=new Float32Array(128);let markCursor=0,lastMark=0;
  for(let k=0;k<128;k++){stamp.position.set(0,-100,0);stamp.updateMatrix();marks.setMatrixAt(k,stamp.matrix);}
  function update(time,dt,external){
   scene.userData.raceEnvironment?.update(time,teams[3].distance,external?7:5);
   details.forEach(({t,wheelDetails})=>{reins(t);wheelDetails.forEach((g,k)=>g.visible=!!external?.teams[teams.indexOf(t)]?.wheels[k]);});
   if(dt<=0)return;
   if(time<lastDust){lastDust=lastMark=0;particles.forEach(p=>p.life=0);markLife.fill(0);}
   if(time-lastDust>.09){lastDust=time;for(const t of teams){if(t.speed<4)continue;for(const w of t.wheels){const p=w.getWorldPosition(tempA);p.y=(window.CircusPreview?.model?.groundHeightAt?.(p.x,p.z)??.065)+.08;puff(p,t.speed,Math.sign(w.position.x),(cursor%7)/7);}for(const h of t.horses){const p=t.group.localToWorld(tempA.set(h.horse.position.x,0,1.25+Math.sin(h.action.time*8)*.25));p.y=(window.CircusPreview?.model?.groundHeightAt?.(p.x,p.z)??.065)+.08;puff(p,t.speed,Math.sign(h.horse.position.x),(cursor%5)/5);}}}
   for(let k=0;k<count;k++){const p=particles[k];p.life-=dt;if(p.life>0){p.y+=dt*.3;p.x+=p.dx*dt;p.z+=p.dz*dt;positions.set([p.x,p.y,p.z],k*3);alpha[k]=Math.sin(Math.PI*p.life/p.max)*.24;sizes[k]=p.size*(1.5-p.life/p.max*.5);}else{positions[k*3+1]=-100;alpha[k]=0;}}for(const a of Object.values(geo.attributes))a.needsUpdate=true;
   if(time-lastMark>.16){lastMark=time;for(const t of teams){if(t.speed<3)continue;for(const w of t.wheels){const k=markCursor++%128,p=w.getWorldPosition(tempA);stamp.position.set(p.x,(window.CircusPreview?.model?.groundHeightAt?.(p.x,p.z)??.065)+.008,p.z);stamp.rotation.set(0,t.group.rotation.y,0);stamp.scale.set(.055,1,.65);stamp.updateMatrix();marks.setMatrixAt(k,stamp.matrix);markLife[k]=3;}}}
   for(let k=0;k<128;k++)if(markLife[k]>0){markLife[k]-=dt;if(markLife[k]<=0){stamp.position.set(0,-100,0);stamp.scale.setScalar(0);stamp.updateMatrix();marks.setMatrixAt(k,stamp.matrix);}markFade[k]=Math.max(0,markLife[k]/3);}marks.instanceMatrix.needsUpdate=true;markGeometry.attributes.markFade.needsUpdate=true;
  }
  return{update,reins,details,materials:{wood,bronze,iron,leather,pale},particleCount:count};
 }
 function environment(T,model,scene){
  const clocks=[];
  for(const m of [model.materials.cream,model.materials.burgundy,model.materials.blue,model.materials.green]){const before=m.onBeforeCompile;m.onBeforeCompile=s=>{before(s);const clock={value:0};clocks.push(clock);s.uniforms.raceWind=clock;s.vertexShader='uniform float raceWind;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(position.z*.53+position.y*.4+raceWind*1.4)*.035;transformed.y+=sin(position.x*.41+raceWind*1.7)*.018;');};m.customProgramCacheKey=()=> 'circus186-linen-'+m.name;}
  const lines=new T.Group();lines.name='Worn chalk finish and starting slots';const chalk=new T.MeshBasicMaterial({color:0xe2d7b7,transparent:true,opacity:.38,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(let x=8;x<46;x+=.7){const g=new T.PlaneGeometry(.54,.13);g.rotateX(-Math.PI/2);const m=new T.Mesh(g,chalk);m.position.set(x,model.groundHeightAt(x,-98)+.008,-98);lines.add(m);}
  for(const x of[24,31,38,45])for(const side of[-1,1]){const g=new T.PlaneGeometry(.09,1.6);g.rotateX(-Math.PI/2);const m=new T.Mesh(g,chalk);m.position.set(x+side*1.1,model.groundHeightAt(x,-100)+.008,-100);lines.add(m);}
  model.group.add(lines);merge(T,lines);lines.children.forEach(m=>m.castShadow=false);
  const api={update(time,distance,laps){for(const c of clocks)c.value=time;const lap=Math.min(laps,1+Math.floor(Math.max(0,distance-100)/CircusRace.LENGTH));for(const [i,egg]of model.lapEggs.entries()){egg.visible=i<laps;egg.material.color.setHex(i<lap?0xe1ba68:0x6f6956);egg.material.roughness=i<lap?.46:.85;}},clocks};scene.userData.raceEnvironment=api;return api;
 }
 function dress(T,m,team){
  m.visual.traverse(o=>{if(!o.isMesh)return;for(const tex of [o.material.map,o.material.normalMap,o.material.roughnessMap])if(tex)tex.anisotropy=4;
   if(/loin_geo/i.test(o.name+' '+(o.userData.sourcePart||''))){o.material=o.material.clone();const color=new T.Color(colors[team]);o.material.onBeforeCompile=s=>{s.uniforms.teamCloth={value:color};s.fragmentShader='uniform vec3 teamCloth;\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat shade=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=teamCloth*clamp(shade*2.0,.28,1.2);');};o.material.customProgramCacheKey=()=> 'crew186-cloth-'+team;o.material.roughness=.96;}
  });
  const belt=new T.Mesh(new T.TorusGeometry(.195,.023,6,24),new T.MeshStandardMaterial({color:0x34291f,roughness:.95}));belt.rotation.x=Math.PI/2;belt.scale.y=.80;belt.position.y=.94;belt.name='Crew leather waist belt';m.root.add(belt);
  const clasp=new T.Mesh(new T.BoxGeometry(.08,.06,.025),new T.MeshStandardMaterial({color:0xb09057,roughness:.5,metalness:.7}));clasp.position.set(0,.94,.16);m.root.add(clasp);m.belt=belt;m.clasp=clasp;m.handTarget=new T.Vector3(-.3,1.03,.17);
 }
 return{create,dress,merge,environment,grain};
})();
