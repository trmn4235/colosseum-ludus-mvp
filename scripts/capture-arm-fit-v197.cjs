/* Offline bind-pose body profile, used by the armour preparation step. */
const fs=require('node:fs'),{rigRuntime}=require('../tests/performance-v84.cjs');
(async()=>{const c=await rigRuntime('ludus.html'),T=c.THREE,m=c.ImportedGladiator.create(0,'murmillo'),body=m.equipmentFit164.body,p=new T.Vector3(),out={};m.root.updateMatrixWorld(true);
 for(const [part,key] of [['upper','armUpper'],['fore','armFore']]){
  const inverse=m.gear[key].group.matrixWorld.clone().invert(),array=new Float32Array(body.geometry.attributes.position.count*3);
  for(let i=0;i<body.geometry.attributes.position.count;i++){body.getVertexPosition(i,p).applyMatrix4(body.matrixWorld).applyMatrix4(inverse).toArray(array,i*3);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(array,3));geo.setIndex(body.geometry.index.clone());const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);const ray=new T.Raycaster(),radii=[];
  for(let row=0;row<=24;row++){const y=-.12+row*.01,ring=[];for(let col=0;col<48;col++){const a=col*Math.PI*2/48,d=new T.Vector3(Math.cos(a),0,Math.sin(a));ray.set(new T.Vector3(0,y,0),d);const hit=ray.intersectObject(mesh,false).find(h=>h.distance>.015&&h.distance<.12);ring.push(hit?.distance||(row?radii[row-1][col]:.075));}radii.push(ring);}
  out[part]={minY:-.12,step:.01,angles:48,radii};
 }fs.writeFileSync(process.argv[2]||'/tmp/arm-fit-v197.json',JSON.stringify(out));console.log('Captured anatomical arm radii from the game body.');})();
