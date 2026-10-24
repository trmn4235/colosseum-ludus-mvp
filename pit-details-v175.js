/* Photographed CC0 surfaces and a closed, human-scale Roman gallery. */
var PitDetails=(()=>{
 const outerHeight=7.34;
 async function build(api){
  const {T,root,half,width,depth,galleryY,box,rod,texture,stone,timber,iron,sand}=api;
  const pbr=(prefix,color)=>new T.MeshStandardMaterial({map:texture('assets/pit-v175/'+prefix+'-color.webp',true),normalMap:texture('assets/pit-v175/'+prefix+'-normal.webp'),roughnessMap:texture('assets/pit-v175/'+prefix+'-rough.webp'),normalScale:new T.Vector2(.22,.22),roughness:.94,color,vertexColors:true});
  const plaster=pbr('plaster',0xf0e8d7),red=pbr('plaster',0xb47769),recess=pbr('plaster',0xc5bb9f);
  red.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 pitFresco;').replace('#include <begin_vertex>','#include <begin_vertex>\npitFresco=(modelMatrix*vec4(position,1.)).xyz;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 pitFresco;').replace('#include <color_fragment>',`#include <color_fragment>
   float n=sin(pitFresco.x*17.+pitFresco.z*13.+sin(pitFresco.y*33.))*sin(pitFresco.y*19.+pitFresco.x*2.);
   float edge=pitFresco.y>2.?4.37:.7;
   float flake=smoothstep(.38,.8,n)*.32+smoothstep(edge-.06,edge,pitFresco.y+n*.03);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.45,2.0,2.1),clamp(flake,0.,1.));`);};red.customProgramCacheKey=()=> 'pit-fresco-v175';
  const contact=new T.MeshBasicMaterial({color:0x302a24,transparent:true,opacity:.13,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  contact.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 pitContactUv;').replace('#include <begin_vertex>','#include <begin_vertex>\npitContactUv=uv;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 pitContactUv;').replace('#include <color_fragment>','#include <color_fragment>\nvec2 fade=smoothstep(vec2(0.),vec2(.28),pitContactUv)*smoothstep(vec2(0.),vec2(.28),1.-pitContactUv);diffuseColor.a*=fade.x*fade.y;');};contact.customProgramCacheKey=()=> 'pit-contact-v175';
  const staticShadows=new T.Group();staticShadows.name='Yüzeye bağlı temas gölgeleri';root.add(staticShadows);
  function shadow(x,y,z,sx,sz){const g=new T.PlaneGeometry(1,1),o=new T.Mesh(g,contact);o.rotation.x=-Math.PI/2;o.position.set(x,y+.015,z);o.scale.set(sx,sz,1);o.userData.detail=true;staticShadows.add(o);return o;}
  // World-space bands and geometry colours break the short photographic tile repeat.
  for(const sign of [-1,1]){
   for(const axis of ['x','z']){
    const long=axis==='x'?width+8:depth+8,edge=sign*((axis==='x'?half.z:half.x)+4),count=Math.ceil(long/4.6),span=long/count;
    const at=(a,y,inset=0)=>axis==='x'?[a,y,edge-sign*inset]:[edge-sign*inset,y,a];
    const part=(name,a,y,w,h,d,mat,inset=0)=>{const [x,yy,z]=at(a,y,inset);return box(name,x,yy,z,axis==='x'?w:d,h,axis==='x'?d:w,mat,root,3.8);};
    for(let i=0;i<count;i++){
     const a=-long/2+span*(i+.5);
     part('Yüksek sıvalı dış duvar',a,outerHeight/2,span+.01,outerHeight,.46,plaster);
     part('Aşınmış bordo duvar eteği',a,galleryY+.42,span,.83,.035,red,.245);
     part('Duvar dibi toz kuşağı',a,galleryY+.055,span,.11,.04,recess,.27);
     if(i%3===1){ // A blind recess: a closed back with a projecting frame, never an exterior opening.
      part('Kapalı niş sırtı',a,galleryY+1.9,.88,1.3,.04,recess,.25);
      for(const dx of [-.49,.49])part('Niş yan taşı',a+dx,galleryY+1.9,.12,1.48,.13,stone,.30);
      for(const dy of [-.73,.73])part('Niş yatay taşı',a,galleryY+1.9+dy,1.1,.12,.22,stone,.32);
     }
     const pilaster=a-span/2;
     part('Dış duvar taş dikmesi',pilaster,(galleryY+outerHeight)/2,.3,outerHeight-galleryY,.25,stone,.24);
     part('Dikme tabanı',pilaster,galleryY+.15,.46,.3,.34,stone,.29);
     part('Dikme başlığı',pilaster,outerHeight-.17,.48,.18,.36,stone,.29);
     // Two roof-shaped halves form an actual sloping weather cap.
     const cap=part('Eğimli dış duvar üst taşı',a,outerHeight+.04,span+.02,.16,.65,stone);
     const pos=cap.geometry.attributes.position;for(let v=0;v<pos.count;v++)if(pos.getY(v)>0){const across=axis==='x'?pos.getZ(v):pos.getX(v);pos.setY(v,pos.getY(v)+.07*(1-Math.abs(across)/.325));}pos.needsUpdate=true;cap.geometry.computeVertexNormals();
    }
   }
  }
  for(const x of [-1,1])for(const z of [-1,1]){
   box('Kapalı yüksek dış köşe',x*(half.x+4),outerHeight/2,z*(half.z+4),.62,outerHeight,.62,stone);
   box('Yüksek köşe başlığı',x*(half.x+4),outerHeight+.08,z*(half.z+4),.77,.21,.77,stone);
  }
  // Low red fresco skirting on the arena walls; no stone border on the sand.
  for(const sign of [-1,1]){
   box('Avlu bordo sıva eteği',sign*(half.x-.013),.35,0,.025,.7,depth,red);
   for(const side of [-1,1])box('Avlu bordo sıva eteği',side*(half.x+1.3)/2,.35,sign*(half.z-.013),half.x-1.3,.7,.025,red);
   for(let x=-half.x+3;x<half.x;x+=4.6){box('Avlu sıva pilastırı',x,1.66,sign*(half.z-.07),.24,3.32,.18,stone);}
  }
  // Small sand shoulders soften the exact ninety-degree wall/floor seam.
  const sandEdge=sand.clone();sandEdge.vertexColors=false;
  for(const axis of ['x','z'])for(const sign of [-1,1]){
   const along=axis==='x'?width:depth,edge=axis==='x'?half.z:half.x,g=new T.PlaneGeometry(along,.22,64,2),p=g.attributes.position;
   for(let i=0;i<p.count;i++){const x=p.getX(i),v=(p.getY(i)+.11)/.22;p.setZ(i,.004+v*.045*(.7+.3*Math.sin(x*2.3)));}
   g.computeVertexNormals();const o=new T.Mesh(g,sandEdge);o.rotation.x=-Math.PI/2;if(axis==='z')o.rotation.z=Math.PI/2;o.position.set(axis==='x'?0:sign*(edge-.11),.002,axis==='x'?sign*(edge-.11):0);o.receiveShadow=true;o.name='Duvar dibinde ince kum birikimi';root.add(o);
  }
  // Cloth hems, stitches and real wall anchors. They remain present when approached.
  for(const c of root.userData.cloths){if(!c.awning)continue;
   const a=c.mesh,x=a.position.x,z=a.position.z,w=a.geometry.parameters.width,h=a.geometry.parameters.height;
   for(const end of [-1,1]){
    rod('Gölgelik duvar bağlantısı',new T.Vector3(x+end*(w/2-.06),6.09,z+Math.sign(z)*1.3),new T.Vector3(x+end*(w/2-.06),6.09,Math.sign(z)*(half.z+3.77)),.024,iron);
    const hem=box('Katlanmış kumaş kenarı',x+end*(w/2-.018),6.085,z,.032,.032,h,a.material);hem.userData.clothTrim=true;
   }
   box('Gölgelik ön etek dikişi',x,6.055,z-Math.sign(z)*h/2,w,.055,.035,a.material);
   a.material=a.material.clone();a.material.color.setHex(0x8b3f49);a.material.roughness=1;
   a.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb*=.86;');};a.material.customProgramCacheKey=()=> 'pit-linen-side-v175';
  }
  // Authored CC0 630-triangle bench, retaining its worn paint and joinery.
  const benchScene=(await new T.GLTFLoader().loadAsync('assets/pit-v175/bench.glb')).scene;
  for(const sign of [-1,1])for(const x of [-half.x*.7,half.x*.7]){
   const o=benchScene.clone(true),b=new T.Box3().setFromObject(o),size=b.getSize(new T.Vector3());o.scale.setScalar(.47/size.y);o.position.set(x,galleryY-b.min.y*o.scale.y,sign*(half.z+3.36));o.rotation.y=sign<0?Math.PI:0;o.name='Hazır aşınmış ahşap sıra';o.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true;});root.add(o);root.userData.detailGroups.push(o);shadow(x,galleryY,sign*(half.z+3.36),1.25,.54);root.userData.obstacles.push({x,z:sign*(half.z+3.36),r:.67});
  }
  // Writing desk and wax tablet next to the keeper, clear of the centre promenade.
  const dx=2.55,dz=half.z+3.15;
  box('Görevli yazı masası',dx,galleryY+.79,dz,1.12,.085,.53,timber);
  for(const x of [-.46,.46])for(const z of [-.19,.19])box('Masa ayağı',dx+x,galleryY+.38,dz+z,.07,.76,.07,timber);
  box('Masa alt kaydı',dx,galleryY+.25,dz,.94,.065,.055,timber);
  const wax=new T.MeshStandardMaterial({color:0x47332c,roughness:.8});
  box('Balmumu tablet ahşabı',dx-.17,galleryY+.85,dz,.34,.035,.23,timber);
  box('Balmumu yazı yüzeyi',dx-.17,galleryY+.87,dz,.29,.012,.18,wax);
  rod('Bronz yazı kalemi',new T.Vector3(dx+.10,galleryY+.848,dz-.09),new T.Vector3(dx+.31,galleryY+.848,dz+.05),.006,iron);
  const leather=new T.MeshStandardMaterial({map:texture('assets/stable-v161/brown_leather_diff_1k.webp',true),roughness:1,color:0xa38b70});
  const purse=new T.Mesh(new T.SphereGeometry(.085,10,8),leather);purse.position.set(dx+.35,galleryY+.9,dz+.06);purse.scale.set(1,.9,.8);purse.castShadow=true;purse.name='Görevli deri kesesi';root.add(purse);shadow(dx,galleryY,dz,1.1,.48);root.userData.obstacles.push({x:dx,z:dz,r:.63});
  // Pointed amphorae now rest in small timber cradles instead of floating tips.
  for(const side of [-1,1]){const x=side*(half.x-1.2),z=-half.z-3.4;for(const offset of [-.24,.24]){box('Amfora sehpa ayağı',x+offset,galleryY+.15,z,.055,.3,.38,timber);box('Amfora taşıyıcı',x,galleryY+.25,z+offset*.5,.62,.06,.055,timber);}shadow(x,galleryY,z,.68,.5);}
  // Weapon rack uses the same two downloaded, licensed models as the match.
  const rackX=-3,rackZ=half.z+3.35;
  for(const x of [-.5,.5])box('Silah dayanağı ayağı',rackX+x,galleryY+.55,rackZ,.075,1.1,.075,timber);
  for(const y of [.13,.85])box('Silah dayanağı kaydı',rackX,galleryY+y,rackZ,1.15,.085,.085,timber);
  if(typeof LudusEquipmentCatalog!=='undefined')for(const [i,id] of ['pit_stone_mace','pit_wood_mace'].entries()){
   const m=(await LudusEquipmentCatalog.load(T,id)).clone(true),b=new T.Box3().setFromObject(m),s=b.getSize(new T.Vector3());m.scale.multiplyScalar(.95/Math.max(s.x,s.y,s.z));const q=new T.Box3().setFromObject(m),center=q.getCenter(new T.Vector3());m.position.set(rackX+(i? .23:-.23)-center.x,galleryY-q.min.y+.08,rackZ-center.z-.08);m.name='Sergilenen avlu gürzü';m.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});root.add(m);
  }
  shadow(rackX,galleryY,rackZ,1.2,.3);root.userData.obstacles.push({x:rackX,z:rackZ,r:.65});
  root.userData.outerHeight=outerHeight;
 }
 function actorShadow(T,root){
  // Concentric translucent discs make a soft, ground-anchored contact patch.
  const g=new T.Group();g.name='Yumuşak ayak temas gölgesi';for(let i=0;i<4;i++){const m=new T.Mesh(new T.CircleGeometry(.24+i*.055,24),new T.MeshBasicMaterial({color:0x28221e,transparent:true,opacity:.055,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.012+i*.0004;m.scale.y=.7;g.add(m);}root.add(g);return g;
 }
 return {build,actorShadow,outerHeight};
})();
