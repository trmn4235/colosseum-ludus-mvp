/* Shared low-detail timber props. Static kit: three draw calls; held rudis: one. */
(function(root){
 'use strict';
 function create(T,material){
  const parts=[],box=new T.BoxGeometry(1,1,1),transform=new T.Object3D();
  function piece(geometry,x,y,z,sx,sy,sz,rz=0,ry=0){transform.position.set(x,y,z);transform.rotation.set(0,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);parts.push(g);}
  const sword=new T.Shape();sword.moveTo(-.055,.04);sword.lineTo(-.057,.52);sword.lineTo(0,.67);sword.lineTo(.057,.52);sword.lineTo(.055,.04);sword.closePath();
  const blade=new T.ExtrudeGeometry(sword,{depth:.027,bevelEnabled:false,curveSegments:2});blade.translate(0,0,-.0135);
  piece(blade,0,0,0,1,1,1);piece(box,0,0,0,.21,.042,.06);piece(box,0,-.085,0,.043,.14,.046);piece(box,0,-.167,0,.076,.044,.065);
  const position=[],normal=[],uv=[];
  for(const g of parts){position.push(...g.attributes.position.array);normal.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);g.dispose();}
  const rudisGeometry=new T.BufferGeometry();rudisGeometry.setAttribute('position',new T.Float32BufferAttribute(position,3));rudisGeometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));rudisGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));rudisGeometry.computeBoundingSphere();blade.dispose();
  const group=new T.Group(),matrices=[];
  function timber(x,y,z,w,h,d,ry=0){transform.position.set(x,y,z);transform.rotation.set(0,ry,0);transform.scale.set(w,h,d);transform.updateMatrix();matrices.push(transform.matrix.clone());}
  for(const x of [-4,-2.5]){timber(x,.89,-3.4,.24,1.65,.24);timber(x,1.31,-3.4,.74,.12,.12);for(const a of [0,Math.PI/3,-Math.PI/3])timber(x,.075,-3.4,1.05,.15,.14,a);}
  const posts=new T.InstancedMesh(box,material,matrices.length);matrices.forEach((m,i)=>posts.setMatrixAt(i,m));posts.castShadow=true;posts.receiveShadow=true;posts.computeBoundingSphere();group.add(posts);
  const leaning=new T.InstancedMesh(rudisGeometry,material,4);
  for(let i=0;i<4;i++){transform.position.set(-.55+(i>>1)*.45+(i%2)*.20,.67,-3.85);transform.rotation.set(0,0,Math.PI+(i%2?-.16:.16));transform.scale.set(1,1,1);transform.updateMatrix();leaning.setMatrixAt(i,transform.matrix);}
  leaning.castShadow=true;leaning.receiveShadow=true;leaning.computeBoundingSphere();group.add(leaning);
  const outline=new T.Shape();outline.moveTo(-.88,0);outline.lineTo(.88,0);outline.lineTo(.88,.20);outline.lineTo(.25,.20);outline.quadraticCurveTo(0,.06,-.25,.20);outline.lineTo(-.88,.20);outline.closePath();
  const beamGeometry=new T.ExtrudeGeometry(outline,{depth:.23,bevelEnabled:false,curveSegments:6});beamGeometry.translate(0,0,-.115);const beams=new T.InstancedMesh(beamGeometry,material,3);
  for(let i=0;i<3;i++){transform.position.set(2.45,.015,-3.9+i*.52);transform.rotation.set(0,.06,0);transform.updateMatrix();beams.setMatrixAt(i,transform.matrix);}
  beams.castShadow=true;beams.receiveShadow=true;beams.computeBoundingSphere();group.add(beams);
  group.userData.counts={posts:2,leaningRudis:4,shoulderBeams:3};
  return {group,rudis:()=>new T.Mesh(rudisGeometry,material),rudisGeometry,dispose(){box.dispose();rudisGeometry.dispose();beamGeometry.dispose();}};
 }
 root.LudusTrainingProps={create};
})(globalThis);
