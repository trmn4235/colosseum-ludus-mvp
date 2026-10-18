/* Shared, batched forearm guards. No extra model download or per-frame allocation. */
var LudusManica=(()=>{
 let cached;
 function get(T){
  if(cached)return cached;
  const bronze=new T.MeshStandardMaterial({color:0xa77d39,metalness:.72,roughness:.42,side:T.DoubleSide});
  const leather=new T.MeshStandardMaterial({color:0x4a2d1c,roughness:.9,side:T.DoubleSide});
  const guard=new T.Group(),plates=[],straps=[];
  for(let i=0;i<7;i++){
   const r=.047+i*.0025,g=new T.CylinderGeometry(r,r+.002,.035,12,1,true,.25,Math.PI*1.8);
   g.translate(0,-.108+i*.036,0);plates.push(g);
  }
  for(const y of [-.075,.075]){const g=new T.CylinderGeometry(.067,.067,.015,12,1,true);g.translate(0,y,0);straps.push(g);}
  for(const [parts,material]of [[plates,bronze],[straps,leather]]){
   const joined=typeof ArenaGeometryUtils!=='undefined'?ArenaGeometryUtils.mergeGeometries(parts,false):null;
   for(const geometry of joined?[joined]:parts){const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;guard.add(mesh);}
   if(joined)parts.forEach(g=>g.dispose());
  }
  guard.userData.armourModel='manica';
  const whole=new T.Group();for(const x of [-.085,.085]){const g=guard.clone(true);g.position.x=x;whole.add(g);}
  whole.userData.armourModel='manica';cached={single:guard,whole};return cached;
 }
 return{get};
})();
