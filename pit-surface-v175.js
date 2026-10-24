/* Bounded, decorative surface motion; never changes combat or reward state. */
var PitSurface=(()=>{
 function install(root,floor,sand){
  const T=THREE;root.userData.surfaceTime={value:0};root.userData.trailLast=new Map();
  // Photographed sand remains the base; broad non-repeating variation prevents a tiled carpet.
  sand.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 pitGround;').replace('#include <begin_vertex>','#include <begin_vertex>\npitGround=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 pitGround;').replace('#include <color_fragment>','#include <color_fragment>\nfloat macro=.96+.035*sin(pitGround.x*.57+sin(pitGround.y*.31))+.025*cos(pitGround.y*.81+pitGround.x*.2);diffuseColor.rgb*=macro;');};sand.customProgramCacheKey=()=> 'pit-sand-v175';
  const m=new T.MeshBasicMaterial({color:0x806446,transparent:true,opacity:.18,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 pitMarkUv;').replace('#include <begin_vertex>','#include <begin_vertex>\npitMarkUv=uv;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 pitMarkUv;').replace('#include <color_fragment>','#include <color_fragment>\nvec2 mark=pitMarkUv*2.-1.;float d=length(mark);diffuseColor.a*=1.-smoothstep(.55,1.,d);');};m.customProgramCacheKey=()=> 'pit-footprint-v175';
  const geometry=new T.PlaneGeometry(1,1),marks=new T.InstancedMesh(geometry,m,300),dummy=new T.Object3D();marks.name='Kumda ayak ve sürtünme izleri';marks.frustumCulled=false;marks.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(marks);root.userData.trails={mesh:marks,dummy,next:220};
  for(let i=0;i<300;i++){
   if(i<220){const route=i%5,step=Math.floor(i/5),a=route*1.13-.7,x=-7.5+step*.34+Math.sin(route*2.3)*1.4,z=-5+route*2.2+Math.sin(step*.12)*.45;stamp(root,x,z,a,i%2?-.10:.10,i);}else{dummy.scale.setScalar(0);dummy.updateMatrix();marks.setMatrixAt(i,dummy.matrix);}
  }
  marks.instanceMatrix.needsUpdate=true;
 }
 function stamp(root,x,z,angle,offset,index,scuff=false){
  const {mesh,dummy}=root.userData.trails;dummy.position.set(x+Math.cos(angle)*offset,.014,z-Math.sin(angle)*offset);dummy.rotation.set(-Math.PI/2,0,-angle);dummy.scale.set(scuff?.27:.09,scuff?.48:.24,1);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
 }
 function crowd(root){
  const T=THREE,time={value:0},focus={value:new T.Vector2()};root.userData.crowdTime=time;root.userData.crowdFocus=focus;
  root.traverse(o=>{if(!o.isInstancedMesh||!o.name.startsWith('Giyimli'))return;o.material=o.material.clone();o.material.onBeforeCompile=s=>{
   s.uniforms.pitCrowdTime=time;s.uniforms.pitCrowdFocus=focus;const common='\nuniform float pitCrowdTime;\nuniform vec2 pitCrowdFocus;\n';
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>'+common).replace('#include <begin_vertex>',`#include <begin_vertex>
    float phase=instanceMatrix[3].x*2.13+instanceMatrix[3].z*.91;
    float head=smoothstep(1.34,1.55,position.y);
    vec2 toFight=pitCrowdFocus-instanceMatrix[3].xz;
    float tracking=clamp(atan(dot(toFight,normalize(instanceMatrix[0].xz)),dot(toFight,normalize(instanceMatrix[2].xz))),-.32,.32);
    float angle=(tracking+sin(pitCrowdTime*.23+phase)*.035)*head;
    vec2 neck=transformed.xz;transformed.x=cos(angle)*neck.x+sin(angle)*neck.y;transformed.z=-sin(angle)*neck.x+cos(angle)*neck.y;
    transformed.x+=sin(pitCrowdTime*.43+phase)*.007*smoothstep(.2,1.2,position.y);
    transformed.y+=sin(pitCrowdTime*1.3+phase)*.002*smoothstep(.8,1.4,position.y);
   `);};o.material.customProgramCacheKey=()=> 'pit-crowd-v175';o.material.needsUpdate=true;
  });
  const spots=root.userData.crowdSpots||[],material=new T.MeshBasicMaterial({color:0x2c261e,transparent:true,opacity:.16,depthWrite:false});
  material.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 contactUV;').replace('#include <begin_vertex>','#include <begin_vertex>\ncontactUV=uv;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 contactUV;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=1.-smoothstep(.2,.5,length(contactUV-.5));');};material.customProgramCacheKey=()=> 'pit-crowd-contact-v175';
  const shadows=new T.InstancedMesh(new T.PlaneGeometry(.75,.5),material,spots.length),dummy=new T.Object3D();shadows.name='Seyirci ayak temas gölgeleri';spots.forEach((p,i)=>{dummy.position.set(p.x,3.553,p.z);dummy.rotation.set(-Math.PI/2,0,-p.a);dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);});root.add(shadows);
 }
 function update(root,time,camera,fighters){
  if(root.userData.crowdTime)root.userData.crowdTime.value=time;
  if(root.userData.crowdFocus&&fighters){const alive=fighters.filter(f=>f.hp>0);if(alive.length)root.userData.crowdFocus.value.set(alive.reduce((s,f)=>s+f.x,0)/alive.length,alive.reduce((s,f)=>s+f.z,0)/alive.length);}
  if(root.userData.trails&&fighters){let dirty=false;for(const f of fighters){const old=root.userData.trailLast.get(f.id),d=old?Math.hypot(f.x-old.x,f.z-old.z):1,fall=f.hp<=0&&!old?.dead;if(d>.48||fall){const data=root.userData.trails,scuff=fall||(old&&Math.abs(Math.atan2(Math.sin(f.angle-old.angle),Math.cos(f.angle-old.angle)))>.9);stamp(root,f.x,f.z,f.angle,old?.side===1?-.1:.1,data.next,scuff);data.next=data.next>=299?220:data.next+1;root.userData.trailLast.set(f.id,{x:f.x,z:f.z,angle:f.angle,side:old?.side===1?-1:1,dead:f.hp<=0});dirty=true;}}if(dirty)root.userData.trails.mesh.instanceMatrix.needsUpdate=true;}
  if(camera&&(!root.userData.lastDetailTime||time-root.userData.lastDetailTime>.3)){
   root.userData.lastDetailTime=time;for(const o of root.userData.detailGroups||[])o.visible=camera.position.distanceTo(o.position)<19;
   for(const row of root.userData.crowdLods||[]){let near=0,far=0;row.spots.forEach((p,i)=>{if(Math.hypot(camera.position.x-p.x,camera.position.z-p.z)<9)row.near.setMatrixAt(near++,row.matrices[i]);else row.far.setMatrixAt(far++,row.matrices[i]);});row.near.count=near;row.far.count=far;row.near.instanceMatrix.needsUpdate=row.far.instanceMatrix.needsUpdate=true;}
  }
 }
 return {install,crowd,update};
})();
