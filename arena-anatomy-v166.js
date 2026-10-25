/* Correct the source gladiator's misplaced arm joints before recording rest poses.
 * Rebase inverse binds so the authored skin stays exactly in place at rest. */
var ArenaAnatomy=(()=>{
 const C=['getX','getY','getZ','getW'];
 const skins=new WeakMap();
 function prepare(root,visual,bones){
  const T=THREE,hand=bones.RightHand,index=bones.RightHandIndex1;
  // The caravan driver's independent rig must retain its authored joint layout.
  if(!hand||!index||index.position.length()<15)return;
  root.updateMatrixWorld(true);
  const meshes=[],old=new Map();visual.traverse(o=>{if(o.isSkinnedMesh){meshes.push(o);for(const b of o.skeleton.bones)if(!old.has(b))old.set(b,b.matrixWorld.clone());}});
  const body=meshes.find(o=>!o.userData.replaceGear),positions=new Map(),q=new T.Quaternion(),v=new T.Vector3();
  if(!body)return;
  // Save the rest surface before moving joints; the two hands have different,
  // incomplete source weights (the right fingers were all rigidly on Hand).
  const cached=skins.get(body.geometry);let skin=cached?.geometry,restVertices;
  if(!skin){restVertices=[];for(let i=0;i<body.geometry.attributes.position.count;i++)restVertices.push(body.getVertexPosition(i,new T.Vector3()).applyMatrix4(body.matrixWorld));}
  const center=cached?.center??restVertices.reduce((bounds,p)=>[Math.min(bounds[0],p.x),Math.max(bounds[1],p.x)],[Infinity,-Infinity]).reduce((a,b)=>(a+b)/2);
  for(const side of ['Left','Right'])for(const part of ['Arm','ForeArm','Hand','HandIndex1','HandIndex2','HandIndex3','HandIndex4']){
   const b=bones[side+part];if(!b)continue;
   const p=b.getWorldPosition(new T.Vector3());
   if(side==='Left'){p.copy(bones['Right'+part].getWorldPosition(v));p.x=2*center-p.x;}
   positions.set(b,p);
  }
  // Actual palm/finger pivots, in metres on the 2.08 m normalized character.
  for(const side of ['Left','Right']){
   const p=positions.get(bones[side+'Hand']),sign=side==='Left'?1:-1;
   for(const [i,offset] of [[1,[.012,-.097,.025]],[2,[.012,-.145,.030]],[3,[.012,-.180,.025]],[4,[.012,-.198,.018]]]){
    positions.get(bones[side+'HandIndex'+i]).copy(p).add(new T.Vector3(offset[0]*sign,offset[1],offset[2]));
   }
  }
  // Keep a consistent, anatomical local frame: Y along the limb, Z toward the palm.
  for(const side of ['Left','Right'])for(const [part,end] of [['Arm','ForeArm'],['ForeArm','Hand'],['Hand','HandIndex1'],['HandIndex1','HandIndex2'],['HandIndex2','HandIndex3'],['HandIndex3','HandIndex4'],['HandIndex4',null]]){
   const b=bones[side+part],p=positions.get(b);if(!b||!p)continue;
   b.position.copy(b.parent.worldToLocal(p.clone()));
   const y=end?positions.get(bones[side+end]).clone().sub(p).normalize():new T.Vector3(0,-1,0);
   const x=new T.Vector3().crossVectors(y,new T.Vector3(0,0,1)).normalize(),z=new T.Vector3().crossVectors(x,y).normalize();
   q.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));b.updateWorldMatrix(false,true);
  }
  for(const mesh of meshes)mesh.skeleton.boneInverses=mesh.skeleton.bones.map((b,i)=>b.matrixWorld.clone().invert().multiply(old.get(b)).multiply(mesh.skeleton.boneInverses[i]));
  if(!skin){
   skin=body.geometry.clone();const ids=skin.attributes.skinIndex,weights=skin.attributes.skinWeight;
   const sourceIds=body.geometry.attributes.skinIndex,sourceWeights=body.geometry.attributes.skinWeight,bins=new Map();
   const key=(x,y,z)=>[Math.round(x/.003),Math.round(y/.003),Math.round(z/.003)].join(':');
   restVertices.forEach((p,i)=>{if(p.x<center-.15){const k=key(p.x,p.y,p.z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(i);}});
   const mirror=body.skeleton.bones.map((b,i)=>{const name=b.name.replace(/^mixamorig:?/,'').replace(/_\d+$/,'').replace(/^Right/,'Left');return bones[name]?body.skeleton.bones.indexOf(bones[name]):i;});
   // The left source weights also used the displaced elbow/hand. Transfer the
   // matching right-arm weights across the mesh's exact bilateral symmetry.
   for(let i=0;i<restVertices.length;i++){
    const p=restVertices[i];if(p.x<center+.15||p.y<.9||p.y>1.75)continue;
    const target=new T.Vector3(2*center-p.x,p.y,p.z);let nearest=-1,distance=.006**2;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const j of bins.get(key(target.x+x*.003,target.y+y*.003,target.z+z*.003))||[]){const d=target.distanceToSquared(restVertices[j]);if(d<distance){nearest=j;distance=d;}}
    if(nearest<0)continue;
    for(let k=0;k<4;k++){ids.setComponent(i,k,mirror[sourceIds[C[k]](nearest)]);weights.setComponent(i,k,sourceWeights[C[k]](nearest));}
   }
   // Reassign only the finger area; the thumb and wrist keep the hand influence.
   // Store positions in the new inverse-bind spaces so reweighting is rest-neutral.
   const blend=new T.Matrix4(),inv=new T.Matrix4(),normal=new T.Matrix3(),n=new T.Vector3();
   for(let i=0;i<restVertices.length;i++){
    const p=restVertices[i],side=p.x>center?'Left':'Right',h=bones[side+'Hand'],hp=positions.get(h);
    if(p.y>hp.y-.075||p.y<hp.y-.23||Math.abs(p.x-hp.x)>.12)continue;
    let handWeight=0;for(let k=0;k<4;k++)if(/Hand/.test(body.skeleton.bones[ids[C[k]](i)]?.name||''))handWeight+=weights[C[k]](i);
    if(handWeight<.8)continue;
    const t=Math.max(0,Math.min(1,(hp.y-.078-p.y)/.035)),u=Math.max(0,Math.min(1,(hp.y-.132-p.y)/.033));
    const names=[side+'Hand',side+'HandIndex1',side+'HandIndex2'],w=[1-t,t*(1-u),t*u];
    blend.elements.fill(0);
    for(let k=0;k<3;k++){
     const id=body.skeleton.bones.indexOf(bones[names[k]]);ids.setComponent(i,k,id);weights.setComponent(i,k,w[k]);
     const mat=bones[names[k]].matrixWorld.clone().multiply(body.skeleton.boneInverses[id]);
     for(let j=0;j<16;j++)blend.elements[j]+=mat.elements[j]*w[k];
    }
    ids.setW(i,0);weights.setW(i,0);
    inv.copy(blend).invert();v.copy(p).applyMatrix4(inv);skin.attributes.position.setXYZ(i,v.x,v.y,v.z);
    // These vertices originally had an identity skin deformation in source space.
    normal.getNormalMatrix(inv.clone().multiply(body.matrixWorld));n.fromBufferAttribute(skin.attributes.normal,i).applyNormalMatrix(normal);skin.attributes.normal.setXYZ(i,n.x,n.y,n.z);
   }
   skins.set(body.geometry,{geometry:skin,center});
  }
  body.geometry=skin;
  root.updateMatrixWorld(true);bones.RightHand.userData.anatomy166=true;
  for(const side of ['Left','Right'])bones[side+'Arm'].userData.anatomyRestPosition=bones[side+'Arm'].position.clone();
 }
 function grip(m,left,strike,reach,holdOffset=strike.pole?-.16:((left?m.offhandAnchor:m.weaponAnchor).children[0]?.userData.asset==='roman_spatha.glb'?-.065:0),settled=false){
  const T=THREE,side=left?'Left':'Right',hand=m.bones[side+'Hand'],lower=m.bones[side+'ForeArm'],upper=m.bones[side+'Arm'];
  const states=m.grip166||(m.grip166={}),state=states[side]||(states[side]={x:new T.Vector3(-1,0,0).applyQuaternion(m.root.quaternion),v:Array.from({length:20},()=>new T.Vector3()),q:Array.from({length:6},()=>new T.Quaternion()),basis:new T.Matrix4()});
  const v=state.v,qs=state.q;
  const rootQ=m.root.getWorldQuaternion(qs[0]),collision=m.root.localToWorld(v[0].set(strike.grip.x,strike.grip.y,strike.grip.z));
  const dir=v[1].set(strike.dir.x,strike.dir.y,strike.dir.z).normalize().applyQuaternion(rootQ),g=v[2].copy(collision).addScaledVector(dir,holdOffset);
  const shoulder=upper.getWorldPosition(v[3]),oldElbow=lower.getWorldPosition(v[4]),oldWrist=hand.getWorldPosition(v[5]);
  const a=shoulder.distanceTo(oldElbow),b=oldElbow.distanceTo(oldWrist),target=v[6].copy(g),wrist=v[7],elbow=v[8],line=v[9],perp=v[10];
  const pole=v[11].set(left?.8:-.8,-.65,-.12).applyQuaternion(rootQ);
  const axis=v[12],x=v[13],z=v[14],palm=v[15],offset=v[16],next=v[17],q=qs[1],bend=qs[2],handQ=qs[3],identity=qs[4],basis=state.basis,plane=v[18],best=v[19];let bestError=Infinity;
  line.copy(g).sub(shoulder).normalize();pole.addScaledVector(line,-pole.dot(line));
  if(pole.lengthSq()<.04)pole.set(0,-1,0).applyQuaternion(rootQ).addScaledVector(line,-pole.dot(line));
  plane.crossVectors(line,pole).normalize();
  function orientation(){
   axis.copy(wrist).sub(elbow).normalize();x.copy(dir).addScaledVector(axis,-dir.dot(axis));
   if(x.lengthSq()<.02)x.copy(state.x).addScaledVector(axis,-state.x.dot(axis));
   x.normalize();if(x.dot(state.x)<0)x.negate();z.crossVectors(x,axis).normalize();
   q.setFromRotationMatrix(basis.makeBasis(x,axis,z));
   palm.copy(axis).addScaledVector(dir,-axis.dot(dir));if(palm.lengthSq()<.001)palm.copy(axis);palm.normalize();
   bend.setFromUnitVectors(axis,palm);const angle=2*Math.acos(Math.min(1,Math.abs(bend.w)));
   const limit=strike.pole?Math.PI/15:Math.PI/9;if(angle>limit)bend.slerp(identity,1-limit/angle);
   handQ.copy(bend).multiply(q);
  }
  // Damped geometric solve: iterations do not update the scene graph. Keep the
  // equivalent shaft-axis sign nearest the previous grip to avoid pronation flips.
  for(let i=0;i<28;i++){
   line.copy(target).sub(shoulder);const distance=Math.max(Math.abs(a-b)+.002,Math.min(a+b-.002,line.length()));line.normalize();
   perp.crossVectors(plane,line).normalize();
   const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
   wrist.copy(shoulder).addScaledVector(line,distance);elbow.copy(shoulder).addScaledVector(line,along).addScaledVector(perp,height);orientation();
   offset.set(0,.075,.025).applyQuaternion(handQ);const error=next.copy(wrist).add(offset).distanceToSquared(g);if(error<bestError){bestError=error;best.copy(target);}if(error<1e-8)break;
   target.lerp(next.copy(g).sub(offset),.35);
  }
  target.copy(best);line.copy(target).sub(shoulder).normalize();perp.crossVectors(plane,line).normalize();
  reach(m,left,m.root.worldToLocal(next.copy(target)),perp);hand.getWorldPosition(wrist);lower.getWorldPosition(elbow);orientation();
  lower.quaternion.copy(lower.parent.getWorldQuaternion(qs[5]).invert().multiply(q));lower.updateWorldMatrix(false,true);
  hand.quaternion.copy(lower.getWorldQuaternion(qs[5]).invert().multiply(handQ));hand.updateWorldMatrix(false,true);
  // A small shoulder-girdle reach handles short-blade poses at the arm limit.
  // Reset each frame; never stretch the elbow/forearm or move the contact segment.
  if(!settled){
   next.set(0,.075,.025).applyQuaternion(handQ).add(wrist).sub(g);
   if(next.lengthSq()>.004**2){
    next.multiplyScalar(-Math.min(1,.025/next.length())).add(shoulder);
    upper.position.copy(upper.parent.worldToLocal(next));upper.updateWorldMatrix(false,true);
    return grip(m,left,strike,reach,holdOffset,true);
   }
  }
  state.x.copy(x);state.holdOffset=holdOffset;state.target=g;state.active=true;
  return collision;
 }
 function carry(f,m,reach,active){
  if(!m.bones.RightHand.userData.anatomy166||f.hp<=0||f.action!=='idle'||f.navJump||f.archer)return;
  for(const left of [false,true]){
   const kind=left?f.offhand:f.weapon;if(!kind||active&&!!active.left===left)continue;
   const anchor=left?m.offhandAnchor:m.weaponAnchor;
   const strike=(['spear','trident','halberd'].includes(kind))?(typeof ArenaMotion.poleGuard==='function'?ArenaMotion.poleGuard(f,left):{grip:{x:left?.34:-.34,y:1.27,z:.25},dir:{x:0,y:.18,z:.98366661},pole:true}):{grip:{x:left?.34:-.34,y:1.23,z:.20},dir:{x:left?.15:-.15,y:.96,z:.2364}};if(!strike)continue;
   if(!strike.pole&&anchor.children[0]?.userData.asset==='roman_spatha.glb')for(const axis of ['x','y','z'])strike.grip[axis]+=strike.dir[axis]*.065;
   const point=grip(m,left,strike,reach);anchor.position.copy(anchor.parent.worldToLocal(point));
   const {v,q}=m.grip166[left?'Left':'Right'];
   anchor.quaternion.copy(anchor.parent.getWorldQuaternion(q[0]).invert().multiply(m.root.getWorldQuaternion(q[1])).multiply(q[2].setFromUnitVectors(v[0].set(0,1,0),v[1].set(strike.dir.x,strike.dir.y,strike.dir.z).normalize())));
   for(const g of anchor.children){g.rotation.set(0,0,0);g.position.y=-(strike.choke||0);}
  }
 }
 function begin(m){
  for(const state of Object.values(m.grip166||{}))state.active=false;
  for(const side of ['Left','Right']){const arm=m.bones[side+'Arm'];if(arm?.userData.anatomyRestPosition)arm.position.copy(arm.userData.anatomyRestPosition);}
 }
 return {prepare,grip,carry,begin};
})();
