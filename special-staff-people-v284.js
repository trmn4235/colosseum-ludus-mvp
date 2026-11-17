/* Fixed, distinct staff appearances. Share the existing human download; bake
   the standing pose once so stationed staff do not run six animation rigs. */
(function(root){
 'use strict';
 const roles=[
  {id:'trainer',name:'Varro',title:'Doctore',profession:'Gladyatör eğitmeni',place:'Antrenman alanı',room:null,x:1.8,z:-7.9,yaw:.1,appearance:{skinTone:.9,hair:'bald',hairColor:'#a8a3a0',beard:'goatee',brows:'thick',height:185,weight:.57,muscle:.85},cloth:'#77745b'},
  {id:'cook',name:'Gaius',title:'Aşçı',profession:'Aşçı',place:'Mutfak · Kazanın yanı',room:'dining',x:-2.6,z:-2.1,yaw:.35,appearance:{skinTone:.22,hair:'curls',hairColor:'#74513b',beard:'moustache',brows:'natural',height:172,weight:.72,muscle:.3},cloth:'#c7bba2'},
  {id:'doctor',name:'Aulus',title:'Doktor',profession:'Doktor',place:'Revir',room:'infirmary',x:.9,z:-2.15,yaw:-.2,appearance:{skinTone:.08,hair:'parted',hairColor:'#ded9d0',beard:'clean',brows:'fine',height:177,weight:.36,muscle:.3},cloth:'#8caaa0'},
  {id:'smith',name:'Lucius',title:'Demirci',profession:'Demirci',place:'Geliştirmeler · Örsün yanı',room:'upgrades',x:-2.55,z:.55,yaw:.4,appearance:{skinTone:.43,hair:'swept',hairColor:'#34251e',beard:'scruffy',brows:'angled',height:182,weight:.65,muscle:.9},cloth:'#65686b'},
  {id:'guard',name:'Marcus',title:'Kapı muhafızı',profession:'Kapı muhafızı',place:'Roma çıkış kapısı',room:null,x:-4.25,z:-10.15,yaw:.35,appearance:{skinTone:.67,hair:'crop',hairColor:'#211b18',beard:'full',brows:'straight',height:190,weight:.56,muscle:.78},cloth:'#496571'},
  {id:'groom',name:'Titus',title:'Seyis',profession:'Seyis',place:'Ahır',room:'stable',x:-2.8,y:.035,z:-10.6,yaw:.5,appearance:{skinTone:.32,hair:'waves',hairColor:'#9e5636',beard:'handlebar',brows:'arched',height:174,weight:.4,muscle:.5},cloth:'#877f63'}
 ];
 const models=new Map();
 function definition(id){return roles.find(r=>r.id===id);}
 async function bake(id){
  const d=definition(id);if(!d)throw Error('Çalışan bulunamadı.');
  const T=root.THREE,source=root.LudusOwner.create({version:2,...d.appearance});
  try{
   await source.ready;source.animate(0,false);source.root.updateMatrixWorld(true);
   source.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
   const group=new T.Group(),v=new T.Vector3();group.name=d.title+' · '+d.name;
   source.root.traverseVisible(o=>{
    if(!o.isMesh)return;
    const geometry=o.geometry.clone(),positions=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<geometry.attributes.position.count;i++){o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld);v.toArray(positions,i*3);}
    geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.morphAttributes={};geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const copy=m=>{const n=m.clone();if((o.userData.part||o.name)==='OwnerWhiteTunic')n.color.set(d.cloth);if((o.userData.part||o.name)==='OwnerSkin'&&n.map){n.map=n.map.clone();n.map.needsUpdate=true;}return n;};
    const mesh=new T.Mesh(geometry,Array.isArray(o.material)?o.material.map(copy):copy(o.material));mesh.name=o.name;mesh.receiveShadow=true;mesh.castShadow=false;mesh.matrixAutoUpdate=false;mesh.updateMatrix();group.add(mesh);
   });
   group.userData={staffRole:id,pose:'relaxed-standing',height:d.appearance.height/100,appearance:{...d.appearance}};
   return group;
  }finally{source.dispose();}
 }
 function model(id){if(!models.has(id))models.set(id,bake(id).catch(e=>{models.delete(id);throw e;}));return models.get(id).then(group=>group.clone(true));}
 root.LudusSpecialPeople={roles,definition,model};
 if(typeof module!=='undefined')module.exports={roles,definition};
})(globalThis);
