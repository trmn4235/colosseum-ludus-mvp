/* Ready Kenney/Quaternius furniture and food, shared and loaded only on room entry. */
(function(root){
 'use strict';
 function create({T,load,wood}){
  let pending=null,generation=0,templates=null;
  async function prepare(){if(templates)return templates;if(pending)return pending;
   pending=(async()=>{const bytes=await load('assets/dining/dining-kit-v53.glb',()=>{},'Yemekhane');const gltf=await new T.GLTFLoader().parseAsync(bytes,'');templates=Object.fromEntries(gltf.scene.children.map(o=>[o.name,o]));for(const name of ['table','bench','shelf'])templates[name].traverse(o=>{if(o.isMesh)o.material=wood;});return templates;})().catch(e=>{pending=null;throw e;});return pending;
  }
  async function enter(parent,colliders){const ticket=++generation;await prepare();if(ticket!==generation)return false;
   const group=new T.Group();group.name='Yemekhane · Hazır modeller';parent.add(group);const counts={tables:2,benches:4,cauldrons:1,shelves:2};group.userData.counts=counts;
   function prop(name,label,size,x,y,z,angle=0){const source=templates[name].clone(true),bounds=new T.Box3().setFromObject(source),dimensions=bounds.getSize(new T.Vector3()),centre=bounds.getCenter(new T.Vector3()),wrapper=new T.Group();source.position.x-=centre.x;source.position.y-=bounds.min.y;source.position.z-=centre.z;wrapper.add(source);wrapper.scale.set(size[0]/dimensions.x,size[1]/dimensions.y,size[2]/dimensions.z);wrapper.position.set(x,y,z);wrapper.rotation.y=angle;wrapper.name=label;wrapper.userData.model=name;wrapper.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});group.add(wrapper);wrapper.updateMatrixWorld(true);return wrapper;}
   function block(kind,x,z,w,d){colliders.push({kind,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});}
   for(const x of [-2.55,2.55]){prop('table','Yemek masası',[2.55,1.02,.90],x,0,1.15,Math.PI/2);block('dining-table',x,1.15,.90,2.55);
    for(const side of [-1,1]){prop('bench','Ahşap yemek bankı',[2.55,.48,.40],x+side*.90,0,1.15,Math.PI/2);block('dining-bench',x+side*.90,1.15,.40,2.55);}
    for(const z of [.55,1.6])prop('bowl','Sofra kâsesi',[.24,.10,.24],x,1.02,z);
   }
   prop('cauldron','Mutfak kazanı',[1.05,1.12,1.05],-3.55,0,-2.9);block('dining-cauldron',-3.55,-2.9,1.15,1.15);
   prop('table','Mutfak hazırlık tezgâhı',[1.65,.92,.65],-1.72,0,-3.45);block('dining-kitchen',-1.72,-3.45,1.65,.65);prop('bowl','Kazan servis kâsesi',[.36,.16,.36],-1.8,.92,-3.45);
   const rear=prop('shelf','Arka malzeme rafı',[2.8,2.55,.6],2.85,0,-3.94),side=prop('shelf','Sağ köşe malzeme rafı',[2.8,2.55,.6],4.35,0,-1.98,Math.PI/2);block('dining-shelf',2.85,-3.94,2.8,.6);block('dining-shelf',4.35,-1.98,.6,2.8);
   const ray=new T.Raycaster();function shelfY(shelf,x,z,maximum){ray.set(new T.Vector3(x,maximum,z),new T.Vector3(0,-1,0));return ray.intersectObject(shelf,true)[0]?.point.y??0;}
   for(const x of [1.9,2.8])prop('sack','Tahıl çuvalı',[.50,.65,.48],x,shelfY(rear,x,-3.86,.95),-3.86);
   prop('barrel','Şarap fıçısı',[.56,.66,.56],3.75,shelfY(rear,3.75,-3.87,1.0),-3.87);
   prop('meat','Et erzağı',[.55,.30,.38],2.2,shelfY(rear,2.2,-3.87,1.85),-3.87);
   prop('apples','Elma kasası',[.72,.30,.42],4.30,shelfY(side,4.30,-1.65,1.85),-1.65,Math.PI/2);
   for(const x of [3.25,3.75]){const fish=prop('fish','Asılı kurutulmuş balık',[.65,.24,.12],x,1.70,-3.57);fish.rotation.z=Math.PI/2;fish.position.x+=.12;}
   group.userData.ready=true;return true;
  }
  return {enter,leave(){generation++;},get ready(){return !!templates;}};
 }
 root.LudusDining={create};
})(globalThis);
