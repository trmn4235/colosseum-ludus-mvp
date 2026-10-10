/* Object-mounted room actions. Gray is neutral; gold is reserved for pending work. */
var LudusRoomActions=(()=>{
 'use strict';
 const paths={hammer:['M14 3 21 10 17 14 10 7Z','m12 10-8 8a2 2 0 0 0 3 3l8-8'],chest:['M3 11V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v3','M3 11h18v10H3zM7 4v7M17 4v7','M10 10h4v5h-4zM7 15v6M17 15v6'],exit:['M15 8V3H3v18h12v-5','M10 12h12m-5-5 5 5-5 5']};
 function icon(kind){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[kind].map(d=>'<path d="'+d+'"/>').join('')+'</svg>';}
 function decorate(button,kind,label){button.type='button';button.classList.add('room-world-action');button.innerHTML=icon(kind);button.title=label;button.setAttribute('aria-label',label);button.dataset.state='idle';}
 function place(button,point,ctx,visible,maxDistance=3.5){
  button.hidden=!visible||ctx.blocked()||Math.hypot(ctx.player.x-point.x,ctx.player.z-point.z)>maxDistance;
  if(button.hidden)return;
  const p=point.clone().project(ctx.camera),r=ctx.canvas.getBoundingClientRect();
  button.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;
  if(!button.hidden){button.style.left=Math.max(24,Math.min(innerWidth-24,r.left+(p.x+1)*r.width/2))+'px';button.style.top=Math.max(26,Math.min(innerHeight-26,r.top+(1-p.y)*r.height/2))+'px';}
 }
 function create(ctx){
  const {T,enhance,pouch,exit}=ctx;decorate(enhance,'hammer','Ekipman geliştir');decorate(pouch,'chest','Taş envanterini aç');decorate(exit,'exit','Avluya dön');
  const hammerPoint=new T.Vector3(-.32,1.57,.06),chestPoint=new T.Vector3(2.5,1.55,0),exitPoint=new T.Vector3(0,1.72,4.30);
  let chest=null,chestPromise=null,epoch=0,attached=false;
  function loadChest(){
   return chestPromise||(chestPromise=new Promise((resolve,reject)=>new T.GLTFLoader().load('clan-chest-v35.glb?v=revision35',g=>{
    const source=g.scene,box=new T.Box3().setFromObject(source),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),scale=1.15/Math.max(size.x,size.z);
    source.scale.setScalar(scale);source.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
    chest=new T.Group();chest.name='Taş sandığı';chest.add(source);if(size.z>size.x)chest.rotation.y=-Math.PI/2;chest.position.set(2.5,.045,0);
    source.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.color)m.color.setHex(0xa78053);}});chestPoint.y=.045+size.y*scale+.35;resolve(chest);
   },undefined,reject)).catch(error=>{chestPromise=null;throw error;}));
  }
  function enter(){
   const token=++epoch;attached=false;
   // A real hammer rests flat on the existing workbench.
   const hammer=new T.Group();hammer.name='Geliştirme çekici';hammer.position.set(-.32,1.17,.04);hammer.rotation.y=.38;
   const handle=new T.Mesh(ctx.cylinder,ctx.wood);handle.scale.set(.035,.54,.035);handle.rotation.x=Math.PI/2;handle.position.z=.12;
   const head=new T.Mesh(ctx.box,ctx.iron);head.scale.set(.36,.15,.16);head.position.z=-.13;hammer.add(handle,head);ctx.props.add(hammer);
   loadChest().then(root=>{if(token!==epoch||!ctx.inUpgrades())return;ctx.props.add(root);attached=true;const box=new T.Box3().setFromObject(root);ctx.colliders.push({kind:'stone-chest',minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z});}).catch(error=>{if(token===epoch&&ctx.inUpgrades())ctx.onError?.(error);});
  }
  function leave(){epoch++;attached=false;enhance.hidden=pouch.hidden=exit.hidden=true;}
  function tick(){place(enhance,hammerPoint,ctx,ctx.inUpgrades());place(pouch,chestPoint,ctx,ctx.inUpgrades()&&attached);place(exit,exitPoint,ctx,ctx.inRoom(),4.5);}
  return {enter,leave,tick,get chestReady(){return loadChest();}};
 }
 return {icon,decorate,place,create};
})();
