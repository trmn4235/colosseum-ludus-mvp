/* A shared cloth outfit; no extra character downloads or animation loop. */
var LudusCaravanOutfit=(()=>{
 let cached;
 function get(T){
  if(cached)return cached;
  const cloth=new T.MeshStandardMaterial({color:0x111317,roughness:1,side:T.DoubleSide}),fold=new T.MeshStandardMaterial({color:0x1b1c20,roughness:1,side:T.DoubleSide}),g=new T.Group();g.name='Siyah peçe başlık';g.userData.outfit='black_veil';
  function add(geo,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=false;g.add(m);return m;}
  // The cap and layered wraps cover the forehead; the front eye slit stays open.
  add(new T.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI*.5),cloth,0,.055,0,.125,.145,.145);
  for(let i=0;i<6;i++){const band=add(new T.TorusGeometry(.119,.014,5,24),i%2?cloth:fold,0,.064+i*.018,.006,1,1.17,1);band.rotation.x=Math.PI/2;band.rotation.z=(i%2?1:-1)*.06;}
  // Sculpted, closed veil around nose, mouth and neck; folds widen toward the shoulders.
  const geo=new T.CylinderGeometry(.132,.19,.24,24,10,true),a=geo.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),angle=Math.atan2(z,x),wave=Math.sin(angle*8+y*45)*.006;a.setXYZ(i,x+Math.cos(angle)*wave,y,z+Math.sin(angle)*wave+(z>0?.018:0));}geo.computeVertexNormals();add(geo,cloth,0,-.12,.006);
  for(const side of [-1,1])add(new T.SphereGeometry(1,12,8),cloth,side*.116,.025,.005,.023,.075,.13);
  const drape=add(new T.ConeGeometry(.18,.22,20,4,true),fold,0,-.27,0);drape.rotation.z=Math.PI;
  cached=g;return g;
 }
 function prop(T){
  const group=new T.Group();group.name='Kervan avı mızrağı';group.userData.huntEntrance=true;group.position.set(4.12,.055,2.05);group.rotation.z=-.14;
  const wood=new T.MeshStandardMaterial({color:0x79542e,roughness:.86}),metal=new T.MeshStandardMaterial({color:0xb49c69,metalness:.65,roughness:.5});
  const pole=new T.Mesh(new T.CylinderGeometry(.025,.032,3.5,10),wood);pole.position.y=1.75;group.add(pole);
  const tip=new T.Mesh(new T.ConeGeometry(.10,.42,4),metal);tip.position.y=3.66;tip.scale.z=.24;group.add(tip);
  const support=new T.Mesh(new T.CylinderGeometry(.022,.022,.5,8),wood);support.rotation.z=Math.PI/2;support.position.set(0,1.82,.03);group.add(support);
  const hood=get(T).clone(true);hood.position.set(0,1.97,.06);hood.scale.setScalar(1);hood.rotation.y=-Math.PI/2;group.add(hood);return group;
 }
 function portrait({T,renderer,make,animate,states},ids){
  const width=1000,height=850,scene=new T.Scene();scene.background=new T.Color(0xeee9df);const camera=new T.PerspectiveCamera(31,width/height,.05,30);camera.position.set(0,1.35,4.7);camera.lookAt(0,1.12,0);
  scene.add(new T.HemisphereLight(0xfff3dd,0x85858a,1.1));const key=new T.DirectionalLight(0xffedda,1.5);key.position.set(-2,4,3);scene.add(key);const rim=new T.DirectionalLight(0xffffff,.8);rim.position.set(3,3,-2);scene.add(rim);
  const owned=[],models=[];function mesh(geo,mat,x,y,z){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);scene.add(m);owned.push(geo,mat);return m;}
  mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:0xe4ddd0,roughness:1}),0,-.025,0).rotation.x=-Math.PI/2;
  for(const x of [-1.3,1.3]){mesh(new T.CylinderGeometry(.09,.12,3,12),new T.MeshStandardMaterial({color:0xf9f4e9,roughness:.85}),x,1.3,-.4);mesh(new T.BoxGeometry(.35,.13,.4),new T.MeshStandardMaterial({color:0xb69759,metalness:.4,roughness:.5}),x,2.82,-.4);}
  for(let i=0;i<2;i++){
   const x=i===0?-.50:.50;mesh(new T.CylinderGeometry(.43,.46,.055,32),new T.MeshStandardMaterial({color:0x6b2533,roughness:.8}),x,.005,0);
   const source=states(ids[i]);if(!source)continue;const m=make('hunt-preview-'+ids[i],source.type);models.push(m);
   const state={...source,x,z:0,angle:i===0?.09:-.09,action:'idle',timer:0,move:0,walk:0,deadTime:0,hp:100,helmet:true};animate(state,m,0,.04);m.gear.helmet.group.clear();m.gear.helmet.group.add(get(T).clone(true));m.teamMark.visible=false;m.root.position.x=x;m.root.rotation.y=i===0?.09:-.09;scene.add(m.root);
  }
  const target=new T.WebGLRenderTarget(width,height),pixels=new Uint8Array(width*height*4),canvas=document.createElement('canvas');target.texture.colorSpace=T.SRGBColorSpace;canvas.width=width;canvas.height=height;
  const previous={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new T.Vector4()),scissor:renderer.getScissor(new T.Vector4()),test:renderer.getScissorTest(),auto:renderer.autoClear};
  try{renderer.setRenderTarget(target);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.autoClear=true;renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);const data=canvas.getContext('2d').createImageData(width,height);for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);canvas.getContext('2d').putImageData(data,0,0);}
  finally{renderer.setRenderTarget(previous.target);renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.test);renderer.autoClear=previous.auto;target.dispose();for(const x of owned)x.dispose();for(const m of models){for(const material of m.materials)material.dispose();const skeletons=new Set();m.visual.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});for(const skeleton of skeletons)skeleton.dispose();m.shadow.geometry.dispose();m.shadow.material.dispose();m.trail.geometry.dispose();m.trail.material.dispose();}}
  canvas.className='supply-hunt-models';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Seçilen gladyatörler siyah peçe başlıkla; yalnızca gözleri açık');canvas.dataset.outfit='black_veil';canvas.dataset.rendered=String(models.length);canvas.dataset.count=String(ids.filter(Boolean).length);return canvas;
 }
 return{get,prop,portrait};
})();
