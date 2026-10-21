/* Compact ticket office: one clerk, no queue visitors, an open spectator balcony. */
var CircusGallery=(()=>{
 function create(T,scene,source){
  const root=new T.Group();root.name='Hipodrom gişe odası';scene.add(root);
  const copy=(name,color)=>{const m=source[name].clone();m.vertexColors=false;m.color.setHex(color);m.envMapIntensity=.32;m.emissive?.setHex(0);return m;};
  const stone=copy('stone',0xd2cec1),plaster=copy('plaster',0xe3e0d6),wood=copy('wood',0xa88c69),floor=copy('marble',0xd1cec4);
  const red=new T.MeshStandardMaterial({color:0x692c3c,roughness:.9}),bronze=new T.MeshStandardMaterial({color:0x927044,metalness:.65,roughness:.5}),ink=new T.MeshStandardMaterial({color:0x342f29,roughness:.9});
  wood.roughness=.86;floor.roughness=.91;floor.normalScale?.set(.16,.16);let seed=151;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const batches=new Map();function box(m,x,y,z,w,h,d,rotation=0){if(!batches.has(m))batches.set(m,[]);batches.get(m).push([x,y,z,w,h,d,rotation]);}
  // Previous footprint: 26 × 43 m. New office: 12 × 12 m; walking bounds: 82 m² (previously 655 m²).
  box(stone,-59,6.9,-72,12,13.8,12);box(stone,-59,13.93,-72,12,.14,12);
  const tiles=Array.from({length:8},(_,i)=>{const m=floor.clone();m.color.multiplyScalar(.9+i*.019);if(m.map){m.map=m.map.clone();m.map.rotation=(i%4)*Math.PI/2;m.map.center.set(.5,.5);m.map.repeat.set(.65,.65);m.map.offset.set((i*.219)%1,(i*.337)%1);m.map.needsUpdate=true;}return m;});
  for(let i=0;i<12;i++)for(let j=0;j<12;j++)box(tiles[Math.floor(random()*tiles.length)],-64.5+i,14.015+(random()-.5)*.004,-77.5+j,.994,.03,.994,Math.floor(random()*4)*Math.PI/2);
  box(plaster,-65,16,-72,.35,4.1,12);for(const z of [-78,-66]){box(plaster,-59,16,z,12,4.1,.35);box(red,-59,14.85,z+(z===-78?.2:-.2),11.6,1.45,.06);box(stone,-59,15.6,z+(z===-78?.25:-.25),11.8,.12,.1);box(wood,-59,17.8,z,12,.22,.4);}
  // Timber ceiling and beams replace the bright, oversized white hall.
  box(wood,-59,18.15,-72,12.3,.24,12.3);for(let z=-77.5;z<=-66.5;z+=2.2)box(wood,-59,17.95,z,12.3,.28,.22);
  for(const x of [-64.4,-53.6])for(const z of [-77.4,-66.6]){box(stone,x,14.15,z,.6,.3,.6);box(stone,x,17.7,z,.6,.25,.6);const col=new T.Mesh(new T.CylinderGeometry(.19,.24,3.3,12),stone);col.position.set(x,15.95,z);col.castShadow=true;root.add(col);}
  // Enclosed single window with a counter and bronze grille. The central serving opening stays clear.
  box(wood,-62.2,14.52,-72,1.2,1.04,5.6);box(stone,-62.1,15.09,-72,1.55,.15,5.85);box(red,-61.58,14.55,-72,.04,.7,5.2);
  for(const z of [-74.85,-69.15]){box(wood,-62.25,16,z,.22,3.4,.25);box(plaster,-63.55,16,z,2.6,4,.2);}
  box(wood,-62.25,17.5,-72,.3,.25,6);box(wood,-64.75,15.6,-72,.25,3.1,5.6);
  for(const y of [14.45,15.4,16.3])box(wood,-64.48,y,-72,.38,.09,5.4);
  for(let z=-74.6;z<=-69.3;z+=.5){box(bronze,-62.17,16.75,z,.055,.92,.055);if(Math.abs(z+72)>1)box(bronze,-62.17,15.65,z,.055,1,.055);}
  for(const y of [16.2,17.22])box(bronze,-62.17,y,-72,.06,.06,5.5);
  // Ledger, rolled tickets and coin tray at human scale.
  box(ink,-62.0,15.2,-72.7,.44,.07,.6);box(bronze,-61.85,15.2,-71.6,.32,.035,.4);
  for(let i=0;i<5;i++)box(plaster,-62.05,15.22+i*.025,-73.7,.32,.02,.45);
  for(const z of [-77.3,-66.7]){box(wood,-58.1,14.55,z,3,.18,.7);for(const x of [-59.2,-57])box(wood,x,14.28,z,.16,.55,.5);}
  // Balcony rail and a seat reached directly from this room.
  box(stone,-52.9,14.15,-72,.35,.3,12);box(stone,-52.9,15,-72,.4,.15,12);
  for(let z=-77.5;z<-66;z+=.9)box(stone,-52.9,14.6,z,.12,.8,.12);
  box(wood,-53.8,14.5,-75.5,.8,.14,1.9);box(red,-53.8,14.6,-75.5,.72,.06,1.8);for(const z of [-76.2,-74.8])box(stone,-53.8,14.25,z,.6,.5,.18);
  // Subtle interior light; no giant high-intensity gallery fills.
  for(const z of [-75,-69]){const light=new T.PointLight(0xffefd5,20,9,2);light.position.set(-61.2,17.2,z);root.add(light);box(bronze,-61.3,17.35,z,.25,.13,.25);}
  const daylight=new T.PointLight(0xe7f0ff,35,14,2);daylight.position.set(-53.5,16.8,-72);root.add(daylight);
  // Raised plaster panels, worn skirting and a cedar ceiling with visible board joints.
  for(const z of [-77.78,-66.22]){
   box(stone,-59,14.17,z,11.4,.26,.15);box(stone,-59,15.64,z,11.4,.08,.1);
   for(const x of [-63.2,-60.4,-57.6,-54.8]){box(stone,x-1.27,14.94,z,.075,1.16,.10);box(stone,x+1.27,14.94,z,.075,1.16,.10);box(stone,x,14.4,z,2.55,.06,.1);box(stone,x,15.49,z,2.55,.06,.1);}
  }
  for(let x=-64.7;x<-53;x+=.56)box(wood,x,18.0,-72,.018,.08,11.8);
  // The counter gets real panel construction, stone edging and small bronze fittings.
  box(stone,-61.32,15.08,-72,.09,.12,5.9);box(wood,-61.56,14.12,-72,.13,.18,5.45);box(wood,-61.56,14.99,-72,.13,.1,5.45);
  for(let z=-74.5;z<-69.3;z+=.8){box(wood,-61.54,14.55,z,.11,.83,.07);for(const y of [14.2,14.9])box(bronze,-61.47,y,z,.025,.045,.045);}
  // Paper pages, wax tablet and a stylus replace featureless black slabs.
  box(plaster,-61.97,15.245,-72.7,.4,.018,.56);box(red,-61.98,15.265,-72.71,.035,.018,.5);
  const objects=new T.Group();root.add(objects);
  function cylinder(m,r,h,x,y,z,rotation=0){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,10),m);mesh.position.set(x,y,z);mesh.rotation.z=rotation;mesh.castShadow=true;mesh.receiveShadow=true;objects.add(mesh);}
  cylinder(wood,.018,.36,-61.85,15.29,-72.8,Math.PI/2);cylinder(red,.045,.018,-61.83,15.27,-72.38);
  for(const z of [-74,-73.7,-73.4])cylinder(plaster,.052,.43,-64.2,15.48,z,Math.PI/2);
  const clay=new T.MeshStandardMaterial({color:0xa87350,roughness:.98});
  const vase=new T.Mesh(new T.LatheGeometry([[0,0],[.16,0],[.24,.12],[.3,.38],[.19,.66],[.1,.72],[.1,.9],[.15,.93]].map(([x,y])=>new T.Vector2(x,y)),14),clay);vase.position.set(-63.9,14.04,-74.2);vase.castShadow=true;vase.receiveShadow=true;objects.add(vase);
  // Soft floor contact gradients ground the walls and counter without another shadow map.
  const cv=document.createElement('canvas');cv.width=32;cv.height=128;const c=cv.getContext('2d'),gradient=c.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'rgba(25,20,18,.22)');gradient.addColorStop(1,'rgba(25,20,18,0)');c.fillStyle=gradient;c.fillRect(0,0,32,128);const shadowTexture=new T.CanvasTexture(cv),shadowMat=new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});
  for(const z of [-77.82,-66.18]){const shadow=new T.Mesh(new T.PlaneGeometry(11.5,.6),shadowMat);shadow.rotation.x=-Math.PI/2;shadow.rotation.z=z<-72?Math.PI:0;shadow.position.set(-59,14.045,z+(z<-72?.29:-.29));root.add(shadow);}
  const geometry=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
  for(const [m,list]of batches){const mesh=new T.InstancedMesh(geometry,m,list.length);list.forEach(([x,y,z,w,h,d,rotation],i)=>{dummy.rotation.set(0,rotation,0);dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);}
  const colliders=[{x:-62.2,z:-72,w:1.8,d:6},{x:-58.1,z:-77.3,w:3.3,d:1},{x:-58.1,z:-66.7,w:3.3,d:1}];
  return {root,spawn:{x:-56.4,z:-73.5},floor:14.04,seat:{x:-53.8,z:-75.5},stand:{x:-55,z:-75.5},cameraBounds:{minX:-61.3,maxX:-53.2,minZ:-77.4,maxZ:-66.6},points:[{id:'office',x:-60.1,z:-72,label:'Gişe memuruyla konuş'},{id:'seat',x:-54.3,z:-75.5,label:'Tribüne otur'}],npcs:[{x:-63.15,z:-72,color:0x762638,yaw:Math.PI/2}],colliders,bounds:{minX:-61.5,maxX:-53.3,minZ:-77,maxZ:-67},areaRatio:82/655.2};
 }
 return {create};
})();
