/* Camera preference and the player's eye view. Combat and other actors are unchanged. */
var ArenaPerspective=(()=>{
 const key='ludus-camera-perspective',modes={third:'3. şahıs · Yakın takip',first:'1. şahıs · Gladyatörün gözünden'};
 function load(){try{return localStorage.getItem(key)==='first'?'first':'third';}catch{return'third';}}
 function bind(select,change){select.replaceChildren();for(const [value,label] of Object.entries(modes)){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}select.value=load();select.addEventListener('change',()=>{try{localStorage.setItem(key,select.value);}catch{}change(select.value);});}
 function eye(T,model,fighter,yaw,out){
  model.root.updateMatrixWorld(true);model.bones.Head.getWorldPosition(out);
  const fit=model.helmetFit,offset=fit?.offset||[0,.1,.04],a=fighter.angle;
  out.x+=Math.cos(a)*offset[0]+Math.sin(a)*offset[2];out.z+=-Math.sin(a)*offset[0]+Math.cos(a)*offset[2];
  out.y+=offset[1]+(fit?.headSize?.[1]||.27)*.16;
  out.x+=Math.sin(yaw)*.04;out.z+=Math.cos(yaw)*.04;return out;
 }
 function desired(eye,yaw,pitch){const elevation=.57-pitch,c=Math.cos(elevation);return{pos:{x:eye.x,y:eye.y,z:eye.z},focus:{x:eye.x+Math.sin(yaw)*c*5,y:eye.y+Math.sin(elevation)*5,z:eye.z+Math.cos(yaw)*c*5}};}
 function prepare(T,model){
  if(model.eyeView)return model.eyeView;
  const enabled={value:0},geometries=[],materials=new Set();
  // Mask only the local player's head in the colour pass. Arms, weapons, body,
  // and the body/head shadow remain; all other gladiators keep their shared data.
  model.visual.traverse(o=>{
   if(!o.isSkinnedMesh||!o.visible||o.userData.replaceGear)return;
   const source=o.geometry,indices=source.attributes.skinIndex,weights=source.attributes.skinWeight;if(!indices||!weights)return;
   const geometry=source.clone(),mask=new Float32Array(indices.count);
   for(let i=0;i<indices.count;i++)for(let k=0;k<4;k++)if(/Head|Neck/.test(o.skeleton.bones[indices.getComponent(i,k)]?.name||''))mask[i]+=weights.getComponent(i,k);
   geometry.setAttribute('eyeHide',new T.BufferAttribute(mask,1));o.geometry=geometry;geometries.push({mesh:o,source,geometry});
   for(const material of Array.isArray(o.material)?o.material:[o.material])if(!materials.has(material)){
    materials.add(material);material.onBeforeCompile=shader=>{
     shader.uniforms.eyeView=enabled;
     shader.vertexShader='attribute float eyeHide;varying float vEyeHide;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeHide=eyeHide;');
     shader.fragmentShader='uniform float eyeView;varying float vEyeHide;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(eyeView>.5&&vEyeHide>.2)discard;');
    };material.customProgramCacheKey=()=> 'gladiator-eye-view-v101';material.needsUpdate=true;
   }
  });
  return model.eyeView={enabled,geometries,gearRevision:-1};
 }
 function apply(T,model,camera,first){
  if(!model)return;const view=prepare(T,model);view.enabled.value=first?1:0;
  // Helmet parts can change when equipment is picked up or lost.
  if(view.gearRevision!==model.gearRevisionV84){model.gear?.helmet?.anchor.traverse(o=>{if(o.isMesh)o.layers.set(1);});view.gearRevision=model.gearRevisionV84;}
  if(first)camera.layers.disable(1);else camera.layers.enable(1);
  const fov=first?68:53,near=first?.055:.1;if(camera.fov!==fov){camera.fov=fov;camera.near=near;camera.updateProjectionMatrix();}
 }
 function dispose(model){for(const item of model.eyeView?.geometries||[]){item.mesh.geometry=item.source;item.geometry.dispose();}model.eyeView=null;}
 return{load,bind,eye,desired,apply,dispose};
})();
