/* Less repeated work; simulation rate, geometry, textures and poses are unchanged. */
var GamePerformance=(()=>{
 let frameEpoch=0;const rectangles=new WeakMap();
 const metrics={domWrites:0,shadowTraversals:0,shadowChanges:0,culledCharacters:0};
 function beginFrame(time){frameEpoch=time;}
 function rect(node){const old=rectangles.get(node);if(old?.epoch===frameEpoch)return old.rect;const value=node.getBoundingClientRect();rectangles.set(node,{epoch:frameEpoch,rect:value});return value;}
 function hidden(node,value){const v=!!value;if(node.hidden!==v){node.hidden=v;metrics.domWrites++;}}
 function text(node,value){const v=value==null?'':String(value);if(node.textContent!==v){node.textContent=v;metrics.domWrites++;}}
 function html(node,value){const v=value==null?'':String(value);if(node.innerHTML!==v){node.innerHTML=v;metrics.domWrites++;}}
 function style(node,key,value){const v=String(value);if(node.style[key]!==v){node.style[key]=v;metrics.domWrites++;}}
 function attr(node,key,value){const v=String(value);if(node.getAttribute(key)!==v){node.setAttribute(key,v);metrics.domWrites++;}}
 function toggle(node,key,value){const v=!!value;if(node.classList.contains(key)!==v){node.classList.toggle(key,v);metrics.domWrites++;}}
 function characterShadows(model,enabled){
  const revision=model.gearRevisionV84||0;
  if(model.shadowRevisionV84===revision&&model.shadowEnabledV84===enabled)return;
  if(model.shadowRevisionV84!==revision){model.shadowMeshes=[];model.root.traverse(o=>{if(o.isMesh&&!o.material?.isMeshBasicMaterial)model.shadowMeshes.push(o);});model.shadowRevisionV84=revision;metrics.shadowTraversals++;}
  for(const mesh of model.shadowMeshes)mesh.castShadow=enabled;
  model.shadowEnabledV84=enabled;metrics.shadowChanges++;
 }
 let visibilityMath;
 function beginVisibility(camera){const T=THREE;if(!visibilityMath)visibilityMath={matrix:new T.Matrix4(),frustum:new T.Frustum(),sphere:new T.Sphere(new T.Vector3(),6)};camera.updateMatrixWorld();visibilityMath.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);visibilityMath.frustum.setFromProjectionMatrix(visibilityMath.matrix);metrics.culledCharacters=0;}
 function characterVisibility(model,keep=false,fighter=null){const s=visibilityMath;if(!s)return;if(fighter)s.sphere.center.set(fighter.x,0,fighter.z);else model.root.getWorldPosition(s.sphere.center);s.sphere.center.y+=1.1;s.sphere.radius=6;model.root.visible=keep||s.frustum.intersectsSphere(s.sphere);if(!model.root.visible)metrics.culledCharacters++;}
 return {beginFrame,rect,hidden,text,html,style,attr,toggle,characterShadows,beginVisibility,characterVisibility,metrics};
})();
if(typeof module!=='undefined')module.exports=GamePerformance;
