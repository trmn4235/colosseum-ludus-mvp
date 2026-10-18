/* Persistent, instanced room furnishing. Built on first entry, reused on re-entry. */
var LudusTradeRoom=(()=>{
 'use strict';
 function create({T,wood,stone}){
  let root=null,chest=null,lid=null,map=null,hunt=null;
  const bounds=[{kind:'trade-left-shelves',minX:-4.65,maxX:-3.15,minZ:-1.95,maxZ:.75},{kind:'trade-right-shelves',minX:3.15,maxX:4.65,minZ:-1.95,maxZ:.75},{kind:'trade-chest',minX:-.93,maxX:.93,minZ:-4.02,maxZ:-2.88},...[-1,1].map(side=>({kind:'trade-entry-jamb',minX:side*1.15-.125,maxX:side*1.15+.125,minZ:4.09,maxZ:4.33}))];
  function build(){
   root=new T.Group();root.name='Toplama odası V120';
   const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,16),sphere=new T.SphereGeometry(1,12,8),plane=new T.PlaneGeometry(1,1),ring=new T.TorusGeometry(1,.14,6,16);
   const mat=(color,more={})=>new T.MeshStandardMaterial({color,roughness:.86,...more});
   const m={wood,stone,marble:mat(0xe8ddc8),red:mat(0x632837),gold:mat(0xb9914b,{metalness:.6,roughness:.45}),clay:mat(0xb77048),darkClay:mat(0x824b38),linen:mat(0xc1ab7b),green:mat(0x616b42),iron:mat(0x595550,{metalness:.45}),copper:mat(0xb16c45,{metalness:.45}),dark:mat(0x2e2923),paper:mat(0xf0dfb6),flame:mat(0xffc16c,{emissive:0xffa448,emissiveIntensity:1.3})};
   function put(geo,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const o=new T.Mesh(geo,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(rx,ry,rz);o.receiveShadow=true;o.castShadow=false;root.add(o);return o;}
   const block=(material,x,y,z,w,h,d)=>put(box,material,x,y,z,w,h,d);
   function canvasMaterial(width,height,paint){const c=document.createElement('canvas');c.width=width;c.height=height;paint(c.getContext('2d'),width,height);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.MeshStandardMaterial({map:t,roughness:.94});}
   const mosaic=canvasMaterial(768,768,(c,w,h)=>{
    c.fillStyle='#d8ceba';c.fillRect(0,0,w,h);c.strokeStyle='#c4b8a0';c.lineWidth=1;
    for(let i=0;i<w;i+=24){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}
    for(const [pad,color,size]of [[20,'#633039',14],[43,'#b08e53',4],[57,'#eee2c9',8]]){c.strokeStyle=color;c.lineWidth=size;c.strokeRect(pad,pad,w-pad*2,h-pad*2);}
    c.strokeStyle='#633039';c.lineWidth=5;c.beginPath();c.arc(w/2,h/2,112,0,Math.PI*2);c.stroke();c.strokeStyle='#b08e53';c.beginPath();c.arc(w/2,h/2,102,0,Math.PI*2);c.stroke();
    c.fillStyle='#633039';c.font='bold 40px Georgia';c.textAlign='center';c.fillText('SPQR',w/2,h/2+12);
    for(const sign of [-1,1])for(let i=0;i<10;i++){const a=(i/10)*Math.PI*.82-.1;c.save();c.translate(w/2+sign*Math.sin(a)*86,h/2+Math.cos(a)*86);c.rotate(sign*a);c.fillStyle='#8b7446';c.beginPath();c.ellipse(0,0,5,12,sign*.5,0,Math.PI*2);c.fill();c.restore();}
   });
   put(plane,mosaic,0,.014,0,9.7,8.7,1,-Math.PI/2);
   // Red dado, pale pilasters and restrained bronze lines define the hall.
   block(m.red,0,.82,-4.30,9.8,1.6,.04);block(m.marble,0,1.65,-4.23,9.8,.13,.14);block(m.gold,0,1.77,-4.20,9.7,.035,.035);
   for(const x of [-4.83,4.83]){block(m.red,x,.82,0,.04,1.6,8.7);block(m.marble,x,1.65,0,.14,.13,8.7);block(m.gold,x,1.77,0,.03,.03,8.6);}
   for(const x of [-4.25,-1.88,1.88,4.25]){block(m.marble,x,.15,-4.08,.54,.3,.48);put(cylinder,m.marble,x,2.02,-4.10,.17,3.5,.17);block(m.marble,x,3.87,-4.1,.5,.18,.44);block(m.gold,x,3.97,-4.1,.5,.035,.44);}
   block(m.marble,0,4.28,-4.13,9.8,.25,.24);block(m.gold,0,4.11,-4.02,9.6,.04,.07);
   // A matching courtyard portal completes the front without adding another title plaque.
   for(const side of [-1,1]){block(m.marble,side*3.06,2.32,4.34,3.60,4.62,.035);block(m.red,side*3.08,.82,4.30,3.53,1.60,.035);block(m.marble,side*3.08,1.65,4.25,3.53,.13,.12);block(m.marble,side*1.15,1.48,4.23,.24,2.96,.22);}
   block(m.marble,0,3.84,4.34,2.55,1.61,.035);block(m.wood,0,1.43,4.34,2.02,2.86,.035);
   for(const x of [-.78,-.52,-.26,0,.26,.52,.78])block(m.dark,x,1.43,4.315,.009,2.82,.012);
   for(const side of [-1,1]){for(const y of [.55,2.25])block(m.iron,side*.54,y,4.29,.81,.075,.03);put(ring,m.gold,side*.66,1.37,4.25,.07,.10,.07);}
   block(m.marble,0,3.05,4.21,2.65,.22,.30);block(m.gold,0,3.19,4.16,2.67,.035,.30);block(m.marble,0,3.40,4.26,2.88,.14,.22);block(m.marble,0,4.67,4.28,9.67,.24,.22);
   // The original 2:1 Roma panorama faces the entry, with the same 16 source markers as the UI.
   function wallMap(){
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const c=canvas.getContext('2d');c.fillStyle='#e8ddc1';c.fillRect(0,0,canvas.width,canvas.height);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    const face=new T.MeshBasicMaterial({map:texture,toneMapped:false});
    const group=new T.Group();group.name='Roma çevresi kaynak haritası';group.position.set(0,2.70,-3.97);group.userData={source:'assets/supply-v91/rome-panorama.webp',width:7.6,height:3.8,pointCount:16,ready:false};map=group;
    function part(material,x,y,z,w,h,d){const mesh=new T.Mesh(box,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);}
    part(m.wood,0,0,0,7.82,4.02,.13);
    const artwork=new T.Mesh(plane,face);artwork.position.z=.08;artwork.scale.set(7.6,3.8,1);group.add(artwork);
    for(const x of [-3.89,3.89])part(m.gold,x,0,.10,.04,4.02,.04);
    for(const y of [-1.99,1.99])part(m.gold,0,y,.10,7.82,.04,.04);
    globalThis.LudusSupply.paintMap(canvas).then(()=>{texture.needsUpdate=true;group.userData.ready=true;}).catch(()=>{const img=new Image();img.onload=()=>{c.drawImage(img,0,0,canvas.width,canvas.height);texture.needsUpdate=true;};img.src=group.userData.source;});
    root.add(group);
   }
   wallMap();
   const jarGeo=new T.LatheGeometry([[.06,0],[.11,.06],[.20,.25],[.24,.48],[.20,.65],[.10,.78],[.08,.96],[.12,1.01],[.12,1.06],[.07,1.06]].map(([r,y])=>new T.Vector2(r,y)),16);
   function jar(x,y,z,scale=1,dark=false){put(jarGeo,dark?m.darkClay:m.clay,x,y,z,scale,scale,scale);for(const side of [-1,1])put(ring,dark?m.darkClay:m.clay,x+side*.15*scale,y+.82*scale,z,.10*scale,.17*scale,.10*scale);put(cylinder,m.dark,x,y+1.045*scale,z,.075*scale,.02*scale,.075*scale);put(cylinder,m.gold,x,y+.54*scale,z,.226*scale,.025*scale,.226*scale);}
   function crate(x,y,z,w=.75,h=.65,d=.65){block(m.wood,x,y+h/2,z,w,h,d);for(const a of [-1,1]){block(m.iron,x+a*w*.34,y+h/2,z+d*.51,.045,h,.03);block(m.iron,x+a*w*.34,y+h+.02,z,.045,.03,d);}for(let n=1;n<4;n++)block(m.dark,x,y+h*n/4,z+d*.51,w,.012,.015);}
   function sack(x,y,z,s=1){put(sphere,m.linen,x,y+.3*s,z,.28*s,.38*s,.25*s);put(cylinder,m.linen,x,y+.63*s,z,.11*s,.12*s,.1*s);put(cylinder,m.wood,x,y+.61*s,z,.115*s,.04*s,.105*s);}
   function shelf(x){for(const dx of [-1.02,1.02]){block(m.wood,x+dx,1.53,-3.55,.13,3.06,.17);block(m.gold,x+dx,.16,-3.55,.17,.06,.21);}for(const y of [.2,1.31,2.40]){block(m.wood,x,y,-3.53,2.18,.12,.92);block(m.gold,x,y+.035,-3.05,2.18,.025,.02);}block(m.wood,x,3.08,-3.57,2.30,.11,1.04);}
   const storageStart=root.children.length;shelf(-3.18);shelf(3.18);
   for(const [x,y,z,s,dark]of [[2.48,.27,-3.52,.84,false],[3.18,.27,-3.52,.9,true],[3.85,.27,-3.52,.76,false],[2.54,1.38,-3.52,.83,true],[3.34,1.38,-3.52,.86,false],[3.90,1.38,-3.52,.70,true]])jar(-x,y,z,s,dark);
   for(let i=0;i<4;i++){sack(-3.94+i*.51,2.47,-3.52,.8);put(cylinder,m.linen,3.88-i*.5,1.57,-3.55,.20,.54,.20,Math.PI/2);put(cylinder,m.red,3.88-i*.5,1.57,-3.55,.21,.06,.21,Math.PI/2);}
   for(let i=0;i<4;i++){block(i<2?m.iron:m.copper,3.91-i*.5,2.54,-3.55,.4,.14,.37);block(i<2?m.iron:m.copper,3.91-i*.5,2.69,-3.55,.32,.12,.31);}
   // Turn both storage banks onto the side walls, leaving the panorama unobstructed.
   for(const o of root.children.slice(storageStart)){const side=Math.sign(o.position.x),angle=-side*Math.PI/2,rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle);o.position.sub(new T.Vector3(side*3.18,0,-3.55)).applyQuaternion(rotation).add(new T.Vector3(side*4.15,0,-.6));o.quaternion.premultiply(rotation);}
   chest=new T.Group();chest.name='Toplama kasası';chest.position.set(0,.045,-3.45);root.add(chest);
   function chestPart(parent,material,x,y,z,w,h,d){const o=new T.Mesh(box,material);o.position.set(x,y,z);o.scale.set(w,h,d);o.receiveShadow=true;parent.add(o);return o;}
   chestPart(chest,m.wood,0,.32,0,1.7,.60,.88);chestPart(chest,m.dark,0,.635,0,1.54,.018,.72);
   for(const x of [-.65,.65]){chestPart(chest,m.gold,x,.33,.456,.085,.63,.035);chestPart(chest,m.gold,x,.33,-.456,.085,.63,.035);}
   for(const y of [.05,.60])chestPart(chest,m.gold,0,y,.457,1.72,.045,.035);
   for(const y of [.18,.33,.48])chestPart(chest,m.dark,0,y,.449,1.53,.012,.014);
   lid=new T.Group();lid.name='Açılır kasa kapağı';lid.position.set(0,.64,-.44);chest.add(lid);chestPart(lid,m.wood,0,.06,.44,1.76,.13,.94);
   for(const x of [-.65,.65])chestPart(lid,m.gold,x,.132,.44,.095,.025,.94);
   chestPart(lid,m.gold,0,.065,.925,1.77,.045,.025);chestPart(lid,m.gold,0,-.06,.925,.18,.22,.045);chestPart(lid,m.dark,0,-.05,.952,.035,.07,.02);
   for(const x of [-.82,.82]){chestPart(chest,m.gold,x,.28,0,.04,.18,.30);chestPart(chest,m.dark,x*1.025,.28,0,.02,.08,.16);}
   // Each chest part is cached; the hinged lid remains an independent transform.
   for(const node of [chest,lid]){const grouped=new Map();for(const o of [...node.children]){if(!o.isMesh)continue;o.updateMatrix();const k=o.material.uuid;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(o);}for(const list of grouped.values()){const inst=new T.InstancedMesh(box,list[0].material,list.length);for(let i=0;i<list.length;i++){inst.setMatrixAt(i,list[i].matrix);node.remove(list[i]);}inst.receiveShadow=true;inst.computeBoundingSphere();node.add(inst);}}

   for(const x of [-4.45,4.45]){block(m.gold,x,2.54,-3.98,.10,.43,.09);put(cylinder,m.gold,x,2.69,-3.83,.16,.07,.16);put(sphere,m.flame,x,2.80,-3.83,.045,.12,.045);}
   // Batch identical static geometry/material pairs; no frame-time animation or extra lights.
   root.updateMatrixWorld(true);const batches=new Map();for(const o of root.children){if(!o.isMesh)continue;const key=o.geometry.uuid+':'+o.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);}
   for(const list of batches.values()){if(list.length<2)continue;const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);mesh.name='Trade hall static details';mesh.receiveShadow=true;for(let i=0;i<list.length;i++){mesh.setMatrixAt(i,list[i].matrixWorld);root.remove(list[i]);}mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);}
   if(globalThis.LudusCaravanOutfit){hunt=LudusCaravanOutfit.prop(T);root.add(hunt);}
   root.userData.colliderCount=bounds.length;
  }
  function enter(props,colliders){if(!root)build();props.add(root);colliders.push(...bounds.map(b=>({...b})));}
  return {enter,setChestOpen(open){if(lid)lid.rotation.x=open?-1.10:0;},get chest(){return chest;},get map(){return map;},get hunt(){return hunt;},get root(){return root;}};
 }
 return {create};
})();
