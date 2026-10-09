/* Shared low-detail timber props. Static kit: three draw calls; held rudis: one. */
(function(root){
 'use strict';
 function create(T,material,options={}){
  const parts=[],box=new T.BoxGeometry(1,1,1),transform=new T.Object3D(),back=options.back?-6:0;
  function piece(geometry,x,y,z,sx,sy,sz,rz=0,ry=0){transform.position.set(x,y,z);transform.rotation.set(0,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);parts.push(g);}
  const sword=new T.Shape();sword.moveTo(-.055,.04);sword.lineTo(-.057,.52);sword.lineTo(0,.67);sword.lineTo(.057,.52);sword.lineTo(.055,.04);sword.closePath();
  const blade=new T.ExtrudeGeometry(sword,{depth:.027,bevelEnabled:false,curveSegments:2});blade.translate(0,0,-.0135);
  piece(blade,0,0,0,1,1,1);piece(box,0,0,0,.21,.042,.06);piece(box,0,-.085,0,.043,.14,.046);piece(box,0,-.167,0,.076,.044,.065);
  const position=[],normal=[],uv=[];
  for(const g of parts){position.push(...g.attributes.position.array);normal.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);g.dispose();}
  const rudisGeometry=new T.BufferGeometry();rudisGeometry.setAttribute('position',new T.Float32BufferAttribute(position,3));rudisGeometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));rudisGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));rudisGeometry.computeBoundingSphere();blade.dispose();
  const group=new T.Group(),matrices=[];
  function timber(x,y,z,w,h,d,ry=0){transform.position.set(x,y,z);transform.rotation.set(0,ry,0);transform.scale.set(w,h,d);transform.updateMatrix();matrices.push(transform.matrix.clone());}
  for(const x of [-4,-2.5]){timber(x,.89,-3.4+back,.24,1.65,.24);timber(x,1.31,-3.4+back,.74,.12,.12);for(const a of [0,Math.PI/3,-Math.PI/3])timber(x,.075,-3.4+back,1.05,.15,.14,a);}
  const posts=new T.InstancedMesh(box,material,matrices.length);matrices.forEach((m,i)=>posts.setMatrixAt(i,m));posts.castShadow=true;posts.receiveShadow=true;posts.computeBoundingSphere();group.add(posts);
  const leaning=new T.InstancedMesh(rudisGeometry,material,4);
  for(let i=0;i<4;i++){transform.position.set(-.55+(i>>1)*.45+(i%2)*.20,.67,-3.85+back);transform.rotation.set(0,0,Math.PI+(i%2?-.16:.16));transform.scale.set(1,1,1);transform.updateMatrix();leaning.setMatrixAt(i,transform.matrix);}
  leaning.castShadow=true;leaning.receiveShadow=true;leaning.computeBoundingSphere();group.add(leaning);
  const outline=new T.Shape();outline.moveTo(-.88,0);outline.lineTo(.88,0);outline.lineTo(.88,.20);outline.lineTo(.25,.20);outline.quadraticCurveTo(0,.06,-.25,.20);outline.lineTo(-.88,.20);outline.closePath();
  const beamGeometry=new T.ExtrudeGeometry(outline,{depth:.23,bevelEnabled:false,curveSegments:6});beamGeometry.translate(0,0,-.115);const beams=new T.InstancedMesh(beamGeometry,material,3);
  for(let i=0;i<3;i++){transform.position.set(2.45,.015,-3.9+back+i*.52);transform.rotation.set(0,.06,0);transform.updateMatrix();beams.setMatrixAt(i,transform.matrix);}
  beams.castShadow=true;beams.receiveShadow=true;beams.computeBoundingSphere();group.add(beams);
  group.userData.counts={posts:2,leaningRudis:4,shoulderBeams:3};
  const activePosts=new T.InstancedMesh(box,material,150);activePosts.count=0;activePosts.castShadow=false;activePosts.receiveShadow=true;group.add(activePosts);
  function setPosts(points){let i=0;for(const p of points.slice(0,30)){
   const pieces=[[0,.89,0,.24,1.65,.24,0],[0,1.31,0,.74,.12,.12,0],...[0,Math.PI/3,-Math.PI/3].map(a=>[0,.075,0,1.05,.15,.14,a])];
   for(const [x,y,z,w,h,d,a]of pieces){transform.position.set(p.x+x,y,p.z+z);transform.rotation.set(0,a+(p.angle||0),0);transform.scale.set(w,h,d);transform.updateMatrix();activePosts.setMatrixAt(i++,transform.matrix);}
  }activePosts.count=i;activePosts.instanceMatrix.needsUpdate=true;activePosts.computeBoundingSphere();}
  let bagGeometry,ropeGeometry,linen;
  function bag(){
   if(!bagGeometry){bagGeometry=new T.LatheGeometry([[0,0],[.11,.025],[.19,.10],[.21,.40],[.16,.53],[.075,.60],[0,.62]].map(([r,y])=>new T.Vector2(r,y)),12);ropeGeometry=new T.CylinderGeometry(.012,.012,.68,6);linen=new T.MeshStandardMaterial({color:0xb99971,roughness:1});}
   const frame=new T.Group(),bars=new T.InstancedMesh(box,material,3);for(const [i,v]of [[-.65,1.2,0,.10,2.4,.10],[.65,1.2,0,.10,2.4,.10],[0,2.4,0,1.5,.12,.12]].entries()){transform.position.set(...v.slice(0,3));transform.rotation.set(0,0,0);transform.scale.set(...v.slice(3));transform.updateMatrix();bars.setMatrixAt(i,transform.matrix);}bars.computeBoundingSphere();frame.add(bars);
   const pivot=new T.Group();pivot.position.y=2.35;frame.add(pivot);const rope=new T.Mesh(ropeGeometry,material);rope.position.y=-.34;pivot.add(rope);const sack=new T.Mesh(bagGeometry,linen);sack.position.y=-1.30;pivot.add(sack);frame.userData.swing=pivot;return frame;
  }
  return {group,rudis:()=>{const m=new T.Mesh(rudisGeometry,material);m.name='Ahşap rudis';return m;},beam:()=>new T.Mesh(beamGeometry,material),bag,rudisGeometry,beamGeometry,activePosts,setPosts,dispose(){posts.dispose();leaning.dispose();beams.dispose();activePosts.dispose();box.dispose();rudisGeometry.dispose();beamGeometry.dispose();bagGeometry?.dispose();ropeGeometry?.dispose();linen?.dispose();}};
 }
 root.LudusTrainingProps={create};
})(globalThis);
