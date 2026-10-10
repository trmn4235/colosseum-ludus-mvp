/* Shared low-detail timber props. Static kit: three draw calls; held rudis: one. */
(function(root){
 'use strict';
 const yard={bounds:{minX:-1.45,maxX:13.25,minZ:-11.15,maxZ:-3.10},posts:[{x:12,z:-8.80},{x:12,z:-6.00}],rudis:{x:11.35,z:-10.70},pairs:[{x:6.5,z:-7.4},{x:8.8,z:-7.4}],weights:[{x:.8,z:-6.7},{x:3.4,z:-6.7},{x:3,z:-8.75}]};
 function create(T,material,options={}){
  const parts=[],box=new T.BoxGeometry(1,1,1),transform=new T.Object3D(),back=options.back?-6:0,corner=!!options.back;
  function piece(geometry,x,y,z,sx,sy,sz,rz=0,ry=0){transform.position.set(x,y,z);transform.rotation.set(0,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(transform.matrix);parts.push(g);}
  const sword=new T.Shape();sword.moveTo(-.055,.04);sword.lineTo(-.057,.52);sword.lineTo(0,.67);sword.lineTo(.057,.52);sword.lineTo(.055,.04);sword.closePath();
  const blade=new T.ExtrudeGeometry(sword,{depth:.027,bevelEnabled:false,curveSegments:2});blade.translate(0,0,-.0135);
  piece(blade,0,0,0,1,1,1);piece(box,0,0,0,.21,.042,.06);piece(box,0,-.085,0,.043,.14,.046);piece(box,0,-.167,0,.076,.044,.065);
  const position=[],normal=[],uv=[];
  for(const g of parts){position.push(...g.attributes.position.array);normal.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);g.dispose();}
  const rudisGeometry=new T.BufferGeometry();rudisGeometry.setAttribute('position',new T.Float32BufferAttribute(position,3));rudisGeometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));rudisGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));rudisGeometry.computeBoundingSphere();blade.dispose();
  const group=new T.Group(),matrices=[];group.name='Antrenman aletleri';
  function timber(x,y,z,w,h,d,ry=0){transform.position.set(x,y,z);transform.rotation.set(0,ry,0);transform.scale.set(w,h,d);transform.updateMatrix();matrices.push(transform.matrix.clone());}
  const postPoints=corner?yard.posts:[-4,-2.5].map(x=>({x,z:-3.4+back}));
  for(const {x,z} of postPoints){timber(x,.89,z,.24,1.65,.24);timber(x,1.31,z,.74,.12,.12);for(const a of [0,Math.PI/3,-Math.PI/3])timber(x,.075,z,1.05,.15,.14,a);}
  const posts=new T.InstancedMesh(box,material,matrices.length);posts.name='Vurma kütükleri';matrices.forEach((m,i)=>posts.setMatrixAt(i,m));posts.castShadow=true;posts.receiveShadow=true;posts.computeBoundingSphere();group.add(posts);
  let leaning=new T.InstancedMesh(rudisGeometry,material,Math.max(4,options.rudisCount||0));
  function setRudis(value){const count=Math.max(0,Math.floor(Number(value)||0));if(leaning.count===count&&leaning.userData.placed)return false;
   if(count>leaning.instanceMatrix.count){group.remove(leaning);leaning.dispose();leaning=new T.InstancedMesh(rudisGeometry,material,count);}
   leaning.name='Tahta rudisler';leaning.castShadow=true;leaning.receiveShadow=true;leaning.count=count;
   for(let i=0;i<count;i++){const row=Math.floor(i/10),inRow=Math.min(10,count-row*10),pairCount=Math.ceil(inRow/2),pair=Math.floor(i%10/2),side=i%2;
    const x=corner?yard.rudis.x+(pair-(pairCount-1)/2)*.50+(side? .10:-.10)+(inRow%2?.10:0):-.55+(i>>1)*.45+side*.20;
    transform.position.set(x,.67,corner?yard.rudis.z+row*.42:-3.85+back);transform.rotation.set(0,0,Math.PI+(side?-.16:.16));transform.scale.set(1,1,1);transform.updateMatrix();leaning.setMatrixAt(i,transform.matrix);
   }leaning.instanceMatrix.needsUpdate=true;leaning.userData.placed=true;leaning.computeBoundingSphere();group.add(leaning);if(group.userData.counts)group.userData.counts.leaningRudis=count;return true;
  }
  setRudis(options.rudisCount??4);
  const outline=new T.Shape();outline.moveTo(-.88,0);outline.lineTo(.88,0);outline.lineTo(.88,.20);outline.lineTo(.25,.20);outline.quadraticCurveTo(0,.06,-.25,.20);outline.lineTo(-.88,.20);outline.closePath();
  const beamGeometry=new T.ExtrudeGeometry(outline,{depth:.23,bevelEnabled:false,curveSegments:6});beamGeometry.translate(0,0,-.115);const beams=new T.InstancedMesh(beamGeometry,material,3);
  for(let i=0;i<3;i++){transform.position.set(corner?4-i*2.15:2.45,.015,corner?-10.55:-3.9+back+i*.52);transform.rotation.set(0,corner?0:.06,0);transform.scale.set(1,1,1);transform.updateMatrix();beams.setMatrixAt(i,transform.matrix);}
  beams.name='Üç ağırlık kirişi';beams.castShadow=true;beams.receiveShadow=true;beams.computeBoundingSphere();group.add(beams);
  group.userData.counts={posts:2,leaningRudis:leaning.count,shoulderBeams:3};
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
  return {group,layout:corner?yard:null,postPoints:corner?postPoints:null,setRudis,rudis:()=>{const m=new T.Mesh(rudisGeometry,material);m.name='Ahşap rudis';return m;},beam:()=>new T.Mesh(beamGeometry,material),bag,rudisGeometry,beamGeometry,activePosts,setPosts,dispose(){posts.dispose();leaning.dispose();beams.dispose();activePosts.dispose();box.dispose();rudisGeometry.dispose();beamGeometry.dispose();bagGeometry?.dispose();ropeGeometry?.dispose();linen?.dispose();}};
 }
 root.LudusTrainingProps={create};
})(globalThis);
