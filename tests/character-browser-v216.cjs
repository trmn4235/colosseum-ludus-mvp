const fs=require('node:fs'),path=require('node:path');

module.exports=async(page,out)=>{
 const source=require('./character-normals-v216.cjs').runNormalCases.toString();
 const normals=await page.evaluate(source=>new Function('return ('+source+')(window)')(),source);
 fs.writeFileSync(path.join(out,'character-normals-v216.json'),JSON.stringify(normals,null,2));
 // Keep the previous real-model contacts and action checks on the same source.
 await require('./character-browser-v215.cjs')(page,out);
 const shots=await page.evaluate(async()=>{
  const T=THREE,renderer=__arena.renderer,scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1.2,.01,30),shots=[];
  renderer.setPixelRatio(1);renderer.setSize(600,500,false);scene.background=new T.Color('#ece9e1');
  scene.add(new T.HemisphereLight(0xffffff,0x535365,1.5));
  const key=new T.DirectionalLight(0xfff3e5,3);key.position.set(-3,4,5);scene.add(key);
  const fill=new T.DirectionalLight(0xe2eaff,1);fill.position.set(4,2,-3);scene.add(fill);
  for(const type of Object.keys(ArenaClasses)){
   const m=ImportedGladiator.create(216,type),f=new ArenaCombat(()=>.999).reset('normal',type).fighters[0];scene.add(m.root);
   Object.assign(f,{x:0,z:0,angle:0,hp:100,action:'idle',timer:0,move:0,walk:0,motionVersion:163,blocking:false,reaction:0,guardFlash:0,passiveEvade:0});
   for(let frame=0;frame<30;frame++)ImportedGladiator.animate(f,m,frame/60,1/60);
   m.teamMark.visible=false;m.root.updateMatrixWorld(true);
   for(const side of ['Right','Left']){
    // Expose the hand surface for lighting review; equipment contact is verified
    // separately by the intact textured views and V215 numerical assertions.
    const hidden=[];m.root.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&o.visible){hidden.push(o);o.visible=false;}});
    const hand=m.bones[side+'Hand'],scale=hand.getWorldScale(new T.Vector3()).x;
    const target=hand.localToWorld(new T.Vector3(0,.115,.018).divideScalar(scale));
    camera.position.copy(target).add(new T.Vector3(side==='Right'?.16:-.16,-.015,.40).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion())));
    camera.up.set(0,-1,0).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()));camera.lookAt(target);
    renderer.render(scene,camera);shots.push({name:type+'-'+side.toLowerCase()+'-hand-v216',data:renderer.domElement.toDataURL('image/png').split(',')[1]});
    hidden.forEach(o=>{o.visible=true;});
   }
   ImportedGladiator.dispose(m);m.root.removeFromParent();
  }
  const board=document.createElement('canvas');board.width=1200;board.height=1160;const context=board.getContext('2d');context.fillStyle='#f4f1eb';context.fillRect(0,0,board.width,board.height);
  for(let i=0;i<shots.length;i++){
   const img=new Image();img.src='data:image/png;base64,'+shots[i].data;await img.decode();const x=i%4*300,y=Math.floor(i/4)*290;
   context.drawImage(img,x,y,300,250);context.fillStyle='#4d202b';context.font='14px sans-serif';context.fillText(shots[i].name,x+5,y+272);
  }
  shots.push({name:'hand-contact-sheet-v216',data:board.toDataURL('image/png').split(',')[1]});return shots;
 });
 for(const shot of shots)fs.writeFileSync(path.join(out,shot.name+'.png'),Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({characterV216:normals,handViews:shots.length-1,out}));
};
