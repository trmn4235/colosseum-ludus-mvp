/* Walkable west gallery, with real counters and a clear spectator terrace. */
var CircusGallery=(()=>{
 function create(T,scene,sourceMaterials){
  const materials=Object.fromEntries(Object.entries(sourceMaterials).map(([key,value])=>{const m=value.clone();m.vertexColors=false;m.envMapIntensity=.65;return [key,m];}));
  const root=new T.Group();root.name='Batı seyirci galerisi';scene.add(root);for(const z of [-62,-82]){const fill=new T.PointLight(0xfff4de,220,48,2);fill.position.set(-62,18,z);root.add(fill);}const fill=new T.PointLight(0xe5efff,400,45,2);fill.position.set(-50,18,-72);root.add(fill);const batches=new Map(),columnPositions=[];
  const stone=materials.marble.clone(),wood=materials.wood.clone();stone.emissive.setHex(0x5f594d);stone.emissiveIntensity=.04;wood.emissive.setHex(0x2b2117);wood.emissiveIntensity=.04;const red=new T.MeshStandardMaterial({color:0x762638,roughness:.85}),gold=new T.MeshStandardMaterial({color:0xb08c46,metalness:.6,roughness:.45});
  function box(m,x,y,z,w,h,d){if(!batches.has(m))batches.set(m,[]);batches.get(m).push([x,y,z,w,h,d]);}
  box(materials.stone,-61.8,6.9,-72,26,13.8,43);box(stone,-61.8,13.9,-72,26,.2,43);
  box(stone,-74,17,-72,.6,6,43);box(stone,-61.8,16,-93.5,25.5,4,.5);box(stone,-61.8,16,-50.5,25.5,4,.5);
  for(let x=-73;x<=-50;x+=2)box(gold,x,14.015,-72,.025,.012,42);for(let z=-92;z<=-52;z+=2)box(gold,-61.8,14.015,z,25,.012,.025);
  for(const z of [-91,-53])box(red,-61.8,14.02,z,23,.02,.4);for(const x of [-72.5,-50.5])box(red,x,14.02,-72,.4,.02,38);
  for(let z=-90;z<=-52;z+=4){box(stone,-61,18.85,z,25,.25,.25);box(gold,-61,18.7,z,24,.04,.04);}
  for(const z of [-88,-80,-64,-56]){box(red,-73.65,15.15,z,.06,1.8,5.2);box(gold,-73.59,16.15,z,.04,.06,5.3);}
  // Continuous front railing, lower than seated eye height.
  box(stone,-49.2,14.2,-72,.6,.4,43);box(stone,-49.2,15.05,-72,.55,.18,43);
  for(let z=-92;z<-51;z+=1.4)box(stone,-49.2,14.65,z,.22,.8,.22);
  for(const z of [-92,-51])for(const x of [-72,-61,-50])columnPositions.push([x,14,z]);
  box(stone,-61,19.2,-72,26,.4,44);box(materials.roof||red,-61,19.5,-72,27,.2,45);
  for(const z of [-57,-85]){box(wood,-67,14.55,z,3.5,1.1,4.4);box(stone,-67,15.15,z,3.8,.16,4.7);box(red,-65.22,14.7,z,.04,.65,3.6);box(gold,-65.18,14.7,z,.05,.05,3.4);box(wood,-72.9,15.2,z,.8,2.4,6);for(const y of [14.5,15.3,16.1])box(gold,-72.4,y,z,.06,.06,5.6);}
  for(const z of [-78,-74,-70,-66]){box(wood,-51.2,14.48,z,1.2,.15,2.8);for(const dz of [-1,1])box(stone,-51.2,14.23,z+dz,.65,.46,.3);box(red,-51.2,14.58,z,1.05,.08,2.6);}
  for(const z of [-62,-82]){box(stone,-57,14.18,z,1.3,.36,1.3);box(gold,-57,14.45,z,.8,.18,.8);}
  const geometry=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
  for(const [m,list]of batches){const mesh=new T.InstancedMesh(geometry,m,list.length);list.forEach(([x,y,z,w,h,d],i)=>{dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);}
  const columns=new T.InstancedMesh(new T.CylinderGeometry(.25,.32,5,16),stone,columnPositions.length);columnPositions.forEach(([x,y,z],i)=>{dummy.position.set(x,y+2.5,z);dummy.scale.set(1,1,1);dummy.updateMatrix();columns.setMatrixAt(i,dummy.matrix);});columns.castShadow=true;columns.receiveShadow=true;root.add(columns);
  function sign(text,x,y,z,w=4){const cv=document.createElement('canvas');cv.width=768;cv.height=192;const c=cv.getContext('2d');c.fillStyle='#f3ead4';c.fillRect(0,0,768,192);c.strokeStyle='#b28a45';c.lineWidth=10;c.strokeRect(10,10,748,172);c.fillStyle='#702b3d';c.textAlign='center';c.textBaseline='middle';c.font='bold 66px Georgia';c.fillText(text,384,98);const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=Math.PI/2;root.add(mesh);}
  sign('GİŞE',-72.3,17,-57);sign('YARIŞA KATILIM',-72.3,17,-85,5.5);sign('BATI TRİBÜNÜ',-73.6,17.7,-72,6);
  return {root,spawn:{x:-61,z:-72},floor:14,seat:{x:-52,z:-70},points:[{id:'ticket',x:-64.4,z:-57,label:'Gişe memuruyla konuş'},{id:'entry',x:-64.4,z:-85,label:'Katılım görevlisiyle konuş'},{id:'seat',x:-53.5,z:-70,label:'Tribüne otur'}],colliders:[{x:-67,z:-57,w:4.4,d:5.2},{x:-67,z:-85,w:4.4,d:5.2},{x:-57,z:-62,w:2,d:2},{x:-57,z:-82,w:2,d:2}],bounds:{minX:-71.5,maxX:-53.3,minZ:-90,maxZ:-54}};
 }
 return {create};
})();
