/* Shared padded floor beds and three shadowless torches. No gameplay or recovery changes. */
var LudusRestRoom=(()=>{
 'use strict';
 const width=.95,length=2.35,gap=.50;
 function layout(count){
  count=Math.max(0,Math.floor(Number(count)||0));
  const rows=Math.ceil(count/2),span=rows?rows*width+(rows-1)*gap:0,depth=Math.max(9,span+2.6),centerZ=4.5-depth/2,beds=[];
  for(let i=0;i<count;i++){
   const side=i%2===0?-1:1,row=Math.floor(i/2),sideCount=side<0?Math.ceil(count/2):Math.floor(count/2);
   beds.push({id:i,x:side*2.55,z:centerZ+(row-(sideCount-1)/2)*(width+gap),angle:side<0?Math.PI/2:-Math.PI/2,width,length});
  }
  const spacing=(depth-4.8)/3;
  return {beds,depth,centerZ,gap,torches:[-spacing,0,spacing].map(z=>({x:0,z:centerZ+z}))};
 }
 function create(ctx){
  const {T,props,colliders}=ctx,group=new T.Group(),transform=new T.Object3D(),sleepers=new Map();group.name='Dinlenme · Kahverengi yer yatakları';
  let kit=null,bedMeshes=[],torchMeshes=[],flames=[],lights=[],current=null,signature='',active=false,time=0;
  function cushion(w,h,d){
   const g=new T.BoxGeometry(w,h,d,8,4,14),p=g.attributes.position,r=Math.min(.085,h*.46),v=new T.Vector3(),core=new T.Vector3();
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);core.set(Math.max(-w/2+r,Math.min(w/2-r,v.x)),Math.max(-h/2+r,Math.min(h/2-r,v.y)),Math.max(-d/2+r,Math.min(d/2-r,v.z)));
    v.sub(core).normalize().multiplyScalar(r).add(core);
    if(v.y>0){const edge=(1-Math.pow(v.x/(w/2),2))*(1-Math.pow(v.z/(d/2),2));v.y+=edge*(.012+.004*Math.sin(v.z*21+v.x*8));}
    p.setXYZ(i,v.x,v.y,v.z);
   }
   g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
  function assets(){
   if(kit)return kit;
   const c=document.createElement('canvas');c.width=c.height=128;const paint=c.getContext('2d');paint.fillStyle='#9d7652';paint.fillRect(0,0,128,128);
   for(let y=0;y<128;y+=2){paint.strokeStyle=y%4?'#95704d':'#a68059';paint.beginPath();paint.moveTo(0,y+.5);paint.lineTo(128,y+.5);paint.stroke();}
   for(let x=0;x<128;x+=3){paint.strokeStyle=x%6?'#ad86604a':'#76563b38';paint.beginPath();paint.moveTo(x+.5,0);paint.lineTo(x+.5,128);paint.stroke();}
   const fabric=new T.CanvasTexture(c);fabric.colorSpace=T.SRGBColorSpace;fabric.wrapS=fabric.wrapT=T.RepeatWrapping;fabric.repeat.set(3,6);fabric.anisotropy=2;
   const cloth=new T.MeshStandardMaterial({map:fabric,color:0xeee2cc,roughness:1}),piping=new T.MeshStandardMaterial({color:0x896348,roughness:1}),bronze=new T.MeshStandardMaterial({color:0x504236,metalness:.55,roughness:.65});
   const points=[];for(let i=0;i<48;i++){const a=i*Math.PI*2/48,ca=Math.cos(a),sa=Math.sin(a);points.push(new T.Vector3(Math.sign(ca)*Math.pow(Math.abs(ca),.24)*(width/2-.025),.05,Math.sign(sa)*Math.pow(Math.abs(sa),.24)*(length/2-.025)));}
   kit={cloth,piping,bronze,mattress:cushion(width,.20,length),pillow:cushion(.68,.19,.40),seam:new T.TubeGeometry(new T.CatmullRomCurve3(points,true),48,.006,3,true),shadow:new T.PlaneGeometry(width+.08,length+.08).rotateX(-Math.PI/2),shadowMat:new T.MeshBasicMaterial({color:0x3a2417,opacity:.12,transparent:true,depthWrite:false}),shaft:new T.CylinderGeometry(.038,.055,1.25,8),base:new T.CylinderGeometry(.23,.26,.10,10),bowl:new T.LatheGeometry([[.045,0],[.085,.02],[.17,.14],[.19,.18],[.16,.18],[.12,.09]].map(p=>new T.Vector2(...p)),10),flame:new T.SphereGeometry(1,8,6),outer:new T.MeshBasicMaterial({color:0xff8b28}),inner:new T.MeshBasicMaterial({color:0xffdf81})};
   return kit;
  }
  function batch(geometry,material,count,name){const m=new T.InstancedMesh(geometry,material,Math.max(1,count));m.name=name;m.count=count;m.castShadow=false;m.receiveShadow=true;group.add(m);return m;}
  function stamp(mesh,i,x,y,z,angle=0){transform.position.set(x,y,z);transform.rotation.set(0,angle,0);transform.scale.set(1,1,1);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);}
  function flush(mesh){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  function build(count){
   current=layout(count);ctx.setDepth(current.depth);const k=assets();
   for(const mesh of bedMeshes){mesh.removeFromParent();mesh.dispose();}
   bedMeshes=[batch(k.mattress,k.cloth,count,'Yer yatakları'),batch(k.pillow,k.cloth,count,'Kahverengi yastıklar'),batch(k.seam,k.piping,count,'Yatak kenar dikişleri'),batch(k.shadow,k.shadowMat,count,'Yatak temas gölgeleri')];
   for(const bed of current.beds){stamp(bedMeshes[0],bed.id,bed.x,.115,bed.z,bed.angle);stamp(bedMeshes[1],bed.id,bed.x-Math.sin(bed.angle)*.87,.303,bed.z-Math.cos(bed.angle)*.87,bed.angle);stamp(bedMeshes[2],bed.id,bed.x,.115,bed.z,bed.angle);stamp(bedMeshes[3],bed.id,bed.x,.005,bed.z,bed.angle);}
   bedMeshes.forEach(flush);
   if(!torchMeshes.length){
    torchMeshes=[batch(k.shaft,ctx.wood,3,'Meşale sapları'),batch(k.base,k.bronze,3,'Meşale ayakları'),batch(k.bowl,k.bronze,3,'Meşale çanakları')];
    for(let i=0;i<3;i++){const outer=new T.Mesh(k.flame,k.outer),inner=new T.Mesh(k.flame,k.inner),flame=new T.Group();outer.scale.set(.10,.25,.10);inner.scale.set(.053,.16,.053);inner.position.set(0,-.03,.012);flame.add(outer,inner);flame.name='Işık meşalesi '+(i+1);group.add(flame);flames.push(flame);const light=new T.PointLight(0xffb966,16,11,2);light.castShadow=false;group.add(light);lights.push(light);}
   }
   for(const [i,p]of current.torches.entries()){stamp(torchMeshes[0],i,0,.70,p.z);stamp(torchMeshes[1],i,0,.05,p.z);stamp(torchMeshes[2],i,0,1.30,p.z);flames[i].position.set(0,1.64,p.z);lights[i].position.set(0,1.77,p.z);}
   torchMeshes.forEach(flush);
   for(let i=colliders.length-1;i>=0;i--)if(colliders[i].kind?.startsWith('rest-'))colliders.splice(i,1);
   for(const bed of current.beds)colliders.push({kind:'rest-bed',minX:bed.x-length/2,maxX:bed.x+length/2,minZ:bed.z-width/2,maxZ:bed.z+width/2});
   for(const p of current.torches)colliders.push({kind:'rest-torch',minX:-.24,maxX:.24,minZ:p.z-.24,maxZ:p.z+.24});
   group.userData.counts={beds:count,pillows:count,torches:3};group.userData.layout=current;
  }
  function release(g){
   if(!sleepers.has(g))return;sleepers.delete(g);g.body.rotation.set(0,0,0);ctx.restore(g);g.model.shadow.visible=true;g.model.trail.visible=true;g.body.position.set(g.home.x,0,g.home.z);ctx.scene.add(g.body);g.body.visible=false;
  }
  function lie(g,bed){
   g.path=[];g.order=null;g.label.hidden=true;
   g.body.rotation.set(0,0,0);ctx.animate({...g.state,x:0,z:0,angle:0,action:'idle',move:0,walk:0,blocking:false,reaction:0,flash:0,weapon:null,offhand:null,leftGear:null,shield:false,helmet:false,chest:false,greaves:false,shoulders:false,trainingPractice:true,trainingPose:{poses:{LeftArm:[0,0,-.06],RightArm:[0,0,.06],LeftForeArm:[-.12,0,0],RightForeArm:[-.12,0,0],Head:[-.08,0,0]},drop:0,lean:0}},g.model,0,1);
   // Align both relaxed arms alongside the torso using this rig's actual bone directions.
   function align(bone,end,direction){const from=end.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize(),world=bone.getWorldQuaternion(new T.Quaternion()),parent=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();bone.quaternion.copy(parent.multiply(new T.Quaternion().setFromUnitVectors(from,direction.normalize())).multiply(world));bone.updateWorldMatrix(false,true);}
   for(const side of ['Left','Right']){const upper=g.model.bones[side+'Arm'],lower=g.model.bones[side+'ForeArm'],hand=g.model.bones[side+'Hand'],sign=Math.sign(upper.getWorldPosition(new T.Vector3()).x)||1;align(upper,lower,new T.Vector3(sign*.10,-1,.03));align(lower,hand,new T.Vector3(-sign*.06,-1,.08));}
   ctx.roomScene.add(g.body);g.body.rotation.set(-Math.PI/2,bed.angle,0,'YXZ');g.body.position.set(bed.x+Math.sin(bed.angle)*1.05,.40,bed.z+Math.cos(bed.angle)*1.05);g.body.visible=true;g.model.shadow.visible=false;g.model.trail.visible=false;g.model.teamMark.visible=false;sleepers.set(g,bed.id);
  }
  function prepare(roster){if(!active)return;for(const g of sleepers.keys())if(!roster.includes(g)||!['resting','injured'].includes(ctx.phase(g)))release(g);}
  function sync(roster){
   if(!active)return;
   const key=roster.map(g=>g.record?.id+':'+!!g.model+':'+ctx.phase(g)).join('|');if(key===signature){for(const [g,index]of sleepers){g.body.visible=true;g.body.rotation.set(-Math.PI/2,current.beds[index].angle,0,'YXZ');}return;}signature=key;
   for(const g of sleepers.keys())if(!roster.includes(g)||!['resting','injured'].includes(ctx.phase(g)))release(g);
   const resized=!current||current.beds.length!==roster.length;if(resized)build(roster.length);
   for(const [i,g]of roster.entries())if(g.model&&['resting','injured'].includes(ctx.phase(g))&&(resized||sleepers.get(g)!==i))lie(g,current.beds[i]);
  }
  function enter(roster){active=true;signature='';props.add(group);sync(roster);}
  function leave(){if(!active)return;for(const g of [...sleepers.keys()])release(g);active=false;signature='';current=null;group.removeFromParent();ctx.setDepth(9);}
  function tick(dt){if(!active||dt<=0)return;time+=dt;for(let i=0;i<3;i++){const flicker=Math.sin(time*5+i*2.3)*.045+Math.sin(time*8+i)*.018;flames[i].scale.set(1-flicker*.3,1+flicker,1-flicker*.3);lights[i].intensity=16+flicker*12;}}
  return {enter,leave,prepare,sync,tick,get layout(){return current;},get active(){return active;}};
 }
 return {create,layout};
})();
