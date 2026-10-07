/* Downloaded MakeHuman human and fitted assets; attribution in OWNER_ASSETS.md. */
var LudusOwner = (() => {
 'use strict';
 const defaults={version:2,hair:'short',beard:'clean',brows:'natural',hairColor:'#34251e',beardColor:'#34251e',browColor:'#34251e',skinTone:.25,weight:.5,muscle:.45,height:178,outfit:'tunic',cloth:'#eee4d0',accent:'#eee4d0'};
 const choices={hair:[['short','Kısa'],['crop','Kısa kesim'],['curls','Kıvırcık'],['long','Uzun'],['swept','Geri taranmış'],['parted','Yandan ayrık'],['bob','Küt kesim'],['waves','Dalgalı'],['ponytail','At kuyruğu'],['braid','Örgülü'],['bald','Kel']],beard:[['clean','Sakalsız'],['full','Dolgun sakal'],['goatee','Keçi sakalı'],['moustache','Bıyık'],['scruffy','Dağınık sakal'],['handlebar','Burma bıyık']],brows:[['natural','Doğal'],['fine','İnce'],['thick','Kalın'],['arched','Kavisli'],['straight','Düz'],['wide','Geniş'],['angled','Köşeli']],outfit:[['tunic','Beyaz tunik']]};
 const hairColors=[['#211b18','Siyah'],['#34251e','Koyu kahve'],['#74513b','Kahve'],['#b99a65','Kumral'],['#d6c59b','Sarı'],['#9e5636','Kızıl'],['#a8a3a0','Gri'],['#ded9d0','Beyaz']];
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function normalize(value){const v=value&&typeof value==='object'?value:{},r={...defaults};for(const key of Object.keys(choices))if(choices[key].some(([id])=>id===v[key]))r[key]=v[key];if(hairColors.some(([id])=>id===v.hairColor))r.hairColor=v.hairColor;r.beardColor=r.browColor=r.hairColor;
  for(const key of ['skinTone','weight','muscle'])if(v[key]!==undefined&&Number.isFinite(Number(v[key])))r[key]=clamp(Number(v[key]),0,1);
  if(v.version!==2){if(v.body)r.weight={slim:.15,athletic:.5,broad:.6,stocky:.85}[v.body]??.5;const old=['#edc7a8','#d9ae87','#bd8967','#99694b','#71503d'];if(old.includes(v.skin))r.skinTone=old.indexOf(v.skin)/4;}
  if(v.height!==undefined&&Number.isFinite(Number(v.height)))r.height=Math.round(clamp(Number(v.height),160,200));return r;
 }
 let template,pending,skinImages;
 function load(){if(template)return Promise.resolve(template);if(pending)return pending;
  const getImage=url=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Ten dokusu yüklenemedi.'));img.src=url;});
  pending=Promise.all([new Promise((resolve,reject)=>new THREE.GLTFLoader().load('owner-makehuman-v27.glb?v=revision28',resolve,undefined,reject)),getImage('owner-skin-light-v27.jpg?v=revision28'),getImage('owner-skin-dark-v27.jpg?v=revision28')]).then(([g,light,dark])=>{template=g.scene;template.userData.ownerClips=g.animations;skinImages=[light,dark];return template;}).catch(e=>{pending=null;throw e;});return pending;
 }
 function cloneRig(source){const copy=source.clone(true),map=new Map();const pair=(a,b)=>{map.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));};pair(source,copy);source.traverse(o=>{if(o.isSkinnedMesh){const c=map.get(o);c.skeleton=o.skeleton.clone();c.skeleton.bones=o.skeleton.bones.map(b=>map.get(b));c.bind(c.skeleton,o.bindMatrix);}});return copy;}
 function create(value){const T=THREE,a=normalize(value),root=new T.Group(),body=new T.Group();root.name='ludus-owner';root.userData.appearance=a;root.userData.owner=true;root.add(body);
  let disposed=false,ready=false,bones={},rests={},materials=[],ownGeometries=[],skinTexture=null,walk=0,speed=0,mixer=null,walkAction=null,idleAction=null;
  const promise=load().then(source=>{if(disposed)return;const imported=cloneRig(source);body.add(imported);imported.updateMatrixWorld(true);
   imported.traverse(o=>{
    if(o.isBone){const name=o.name.replace(/^mixamorig[:]?/,'');bones[name]=o;rests[name]=o.quaternion.clone();}
    if(!o.isMesh)return;
    const part=o.userData.part||o.name;
    if(part.startsWith('Hair_'))o.visible=part==='Hair_'+a.hair;
    if(part.startsWith('Beard_'))o.visible=part==='Beard_'+a.beard;
    if(part.startsWith('Brow_'))o.visible=part==='Brow_'+a.brows;
    o.frustumCulled=false;o.castShadow=false;o.receiveShadow=true;
    if(o.morphTargetDictionary){for(const [name,id]of Object.entries(o.morphTargetDictionary))o.morphTargetInfluences[id]=name==='Thin'?Math.max(0,1-a.weight*2):name==='Heavy'?Math.max(0,a.weight*2-1):name==='Muscular'?Math.max(0,(a.muscle-.45)/.55):name==='Soft'?Math.max(0,(.45-a.muscle)/.45):0;}
    const original=Array.isArray(o.material)?o.material:[o.material];const cloned=original.map(m=>{const c=m.clone();materials.push(c);c.roughness=Math.max(.65,c.roughness);c.metalness=0;
     if(/^(Hair_|Beard_|Brow_)/.test(part)){c.color.set(a.hairColor);c.alphaTest=.1;c.transparent=false;c.depthWrite=true;c.side=T.DoubleSide;}
     if(part==='OwnerSkin'){c.transparent=false;c.opacity=1;c.depthWrite=true;c.side=T.FrontSide;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const cx=canvas.getContext('2d');cx.drawImage(skinImages[0],0,0,1024,1024);cx.globalAlpha=a.skinTone;cx.drawImage(skinImages[1],0,0,1024,1024);skinTexture=new T.CanvasTexture(canvas);skinTexture.flipY=false;skinTexture.colorSpace=T.SRGBColorSpace;c.map=skinTexture;c.color.set(0xffffff);c.roughness=.85;
     }
     if(part==='OwnerEyes'){c.transparent=false;c.depthWrite=true;c.side=T.FrontSide;}
     if(part==='OwnerWhiteTunic'){c.color.set('#fffaf0');c.transparent=false;c.depthWrite=true;c.side=T.DoubleSide;}
     if(part==='OwnerSandals'){c.color.set('#756048');c.opacity=1;c.transparent=false;c.depthWrite=true;c.side=T.DoubleSide;}
     return c;});o.material=Array.isArray(o.material)?cloned:cloned[0];
   });
   // glTF uses metres. Normalize downloaded anatomy to the selected height.
   const box=new T.Box3().setFromObject(imported),h=box.max.y-box.min.y;body.scale.setScalar(a.height/100/h);imported.position.y-=box.min.y;
   // Downloaded normal-walk and idle clips drive the actual weighted rig.
   mixer=new T.AnimationMixer(imported);const clip=source.userData.ownerClips?.find(c=>c.name.includes('OwnerWalk'));
   if(clip){const keep=clip.tracks.map(track=>{const t=track.clone();t.times=new Float32Array([0]);t.values=track.values.slice(0,track.getValueSize());return t;});const idle=source.userData.ownerClips.find(c=>c.name.includes('OwnerIdle'))||new T.AnimationClip('OwnerIdle',1,keep);idleAction=mixer.clipAction(idle).play();walkAction=mixer.clipAction(clip).play();walkAction.setEffectiveWeight(0);mixer.update(0);}
   root.userData.loaded=true;ready=true;animate(0,false);
  }).catch(e=>{root.userData.loadError=e.message;throw e;});
  // Game callers can mount an empty group while loading; no primitive fallback.
  promise.catch(()=>{});
  function pose(name,x=0,y=0,z=0){const bone=bones[name];if(bone)bone.quaternion.copy(rests[name]).multiply(new T.Quaternion().setFromEuler(new T.Euler(x,y,z)));}
  function align(name,child,direction){const bone=bones[name],end=bones[child];if(!bone||!end)return;root.updateMatrixWorld(true);const current=end.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize(),target=new T.Vector3(...direction).normalize();target.applyQuaternion(root.getWorldQuaternion(new T.Quaternion()));const q=new T.Quaternion().setFromUnitVectors(current,target).multiply(bone.getWorldQuaternion(new T.Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);}
  function animate(dt,moving){if(!ready)return;speed+=(Number(!!moving)-speed)*(1-Math.exp(-Math.min(dt,.1)*9));
   if(walkAction){walkAction.setEffectiveWeight(speed);idleAction.setEffectiveWeight(1-speed);walkAction.setEffectiveTimeScale(1.5);mixer.update(Math.min(dt,.1));}else{for(const [name,bone]of Object.entries(bones))bone.quaternion.copy(rests[name]);for(const side of ['Left','Right']){const sign=side==='Left'?1:-1;align(side+'Arm',side+'ForeArm',[sign*.10,-1,0]);align(side+'ForeArm',side+'Hand',[sign*.02,-1,.1]);}}
  }
  function dispose(){disposed=true;mixer?.stopAllAction();if(mixer)mixer.uncacheRoot(body.children[0]);materials.forEach(m=>m.dispose());ownGeometries.forEach(g=>g.dispose());skinTexture?.dispose();root.removeFromParent();}
  return {root,body,get head(){return bones.Head||body;},appearance:a,ready:promise,animate,dispose};
 }
 function createEditor(){
  const overlay=document.createElement('section');overlay.className='owner-editor';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','ownerTitle');
  overlay.innerHTML='<div class="owner-sheet"><header><div><small>COLOSSEUM & LUDUS</small><h2 id="ownerTitle">Ludus sahibini oluştur</h2></div><button type="button" data-action="close" aria-label="Görünüm ekranını kapat">✕</button></header><div class="owner-layout"><div class="owner-preview"><canvas aria-label="Ludus sahibinin üç boyutlu önizlemesi"></canvas><div class="owner-preview-tools"><button type="button" data-action="left" aria-label="Karakteri sola döndür">↶</button><span>Sürükleyerek döndür</span><button type="button" data-action="right" aria-label="Karakteri sağa döndür">↷</button></div><p class="owner-caption"></p></div><div class="owner-custom"><nav aria-label="Görünüm kategorileri"></nav><div class="owner-fields"></div></div></div><footer><div class="owner-extra"><button type="button" data-action="random">Rastgele</button><button type="button" data-action="reset">Sıfırla</button></div><p class="owner-message" role="status" aria-live="polite"></p><button type="button" data-action="save" class="owner-save">BU GÖRÜNÜMÜ SEÇ</button></footer></div>';
  document.body.append(overlay);const canvas=overlay.querySelector('canvas'),fields=overlay.querySelector('.owner-fields'),nav=overlay.querySelector('nav'),message=overlay.querySelector('.owner-message'),caption=overlay.querySelector('.owner-caption');
  const tabs={face:{label:'Yüz',keys:['hair','beard','brows','hairColor']},body:{label:'Vücut',keys:['skinTone','height','weight','muscle']},dress:{label:'Kıyafet',keys:['outfit']}};
  const labels={hair:'Saç tipi',beard:'Sakal tipi',brows:'Kaş tipi',hairColor:'Saç, sakal ve kaş rengi',skinTone:'Ten: açık → koyu',height:'Boy',weight:'Vücut: zayıf → şişman',muscle:'Kas belirginliği',outfit:'Başlangıç kıyafeti'};
  let value=normalize(),tab='face',renderer=null,scene=null,camera=null,model=null,rotation=.24,frame=0,callbacks={},previousFocus=null,pointer=null,saving=false;
  function rebuild(){if(!renderer)return;if(model)model.dispose();model=create(value);model.root.rotation.y=rotation;scene.add(model.root);const current=model;overlay.querySelector('[data-action="save"]').disabled=true;message.textContent='Hazır model yükleniyor…';model.ready.then(()=>{if(model===current){message.textContent='';if(!saving)overlay.querySelector('[data-action="save"]').disabled=false;}}).catch(()=>{if(model===current)message.textContent='Hazır model yüklenemedi. İnternet bağlantını kontrol edip ekranı yeniden aç.';});caption.textContent=choices.outfit.find(([id])=>id===value.outfit)[1]+' · '+value.height+' cm';}
  function renderFields(){fields.replaceChildren();for(const key of tabs[tab].keys){const label=document.createElement('label');label.className='owner-field';const text=document.createElement('span');text.textContent=labels[key];label.append(text);let input;
   const list=key==='hairColor'?hairColors:choices[key];
   if(list){input=document.createElement('select');for(const [id,name]of list){const option=document.createElement('option');option.value=id;option.textContent=name;input.append(option);}input.value=value[key];}
   else{input=document.createElement('input');input.type='range';const height=key==='height';input.min=height?160:0;input.max=height?200:1;input.step=height?1:.01;input.value=value[key];const output=document.createElement('output');output.textContent=height?value[key]+' cm':Math.round(value[key]*100)+'%';label.append(output);}
   input.name=key;input.setAttribute('aria-label',labels[key]);input.addEventListener('input',()=>{value[key]=input.type==='range'?Number(input.value):input.value;value=normalize(value);const output=label.querySelector('output');if(output)output.textContent=key==='height'?value[key]+' cm':Math.round(value[key]*100)+'%';rebuild();});label.append(input);fields.append(label);}
   for(const button of nav.children){const active=button.dataset.tab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('active',active);}
  }
  nav.setAttribute('role','tablist');for(const [id,t]of Object.entries(tabs)){const b=document.createElement('button');b.type='button';b.textContent=t.label;b.dataset.tab=id;b.setAttribute('role','tab');b.onclick=()=>{tab=id;renderFields();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const ids=Object.keys(tabs),n=ids.indexOf(tab);tab=ids[(n+(e.key==='ArrowRight'?1:2))%3];renderFields();nav.querySelector('[data-tab="'+tab+'"]').focus();}};nav.append(b);}
  function resize(){if(!renderer||overlay.hidden)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
  function tick(){if(overlay.hidden)return;frame=requestAnimationFrame(tick);if(model){model.root.rotation.y=rotation;model.animate(1/60,false);}const close=tab==='face';const headY=value.height/100*.92,targetY=close?headY:.95;camera.position.set(close?.02:0,close?headY+.045:1.15,close?1.13:3.7);camera.lookAt(0,targetY,0);renderer.render(scene,camera);}
  function start(){if(!renderer){try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff0db,0x655444,2.1));const sun=new THREE.DirectionalLight(0xffedce,2.6);sun.position.set(-3,5,4);scene.add(sun);camera=new THREE.PerspectiveCamera(36,1,.03,20);}catch{message.textContent='3D önizleme açılamadı. Seçimlerini yapabilir veya Safari’de tekrar deneyebilirsin.';return;}}rebuild();resize();tick();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function close(){if(saving)return;overlay.hidden=true;cancelAnimationFrame(frame);callbacks.onClose?.();previousFocus?.focus();}
  overlay.querySelector('[data-action="close"]').onclick=close;
  overlay.querySelector('[data-action="left"]').onclick=()=>rotation-=.45;overlay.querySelector('[data-action="right"]').onclick=()=>rotation+=.45;
  canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(pointer?.id===e.pointerId){rotation+=(e.clientX-pointer.x)*.013;pointer.x=e.clientX;}});for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>pointer=null);
  overlay.querySelector('[data-action="reset"]').onclick=()=>{value=normalize();renderFields();rebuild();};
  overlay.querySelector('[data-action="random"]').onclick=()=>{for(const key of Object.keys(choices)){const list=choices[key];value[key]=list[Math.floor(Math.random()*list.length)][0];}value.hairColor=hairColors[Math.floor(Math.random()*hairColors.length)][0];value.skinTone=Math.random();value.weight=Math.random();value.muscle=Math.random();value.height=165+Math.floor(Math.random()*31);value=normalize(value);renderFields();rebuild();};
  overlay.querySelector('[data-action="save"]').onclick=async()=>{if(saving)return;saving=true;const buttons=[...overlay.querySelectorAll('button,input,select')];buttons.forEach(b=>b.disabled=true);message.textContent='';try{await callbacks.onSave?.(normalize(value));saving=false;close();}catch(e){message.textContent=e.message||'Görünüm kaydedilemedi. Tekrar dene.';}finally{saving=false;buttons.forEach(b=>b.disabled=false);}};
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const list=[...overlay.querySelectorAll('button,input,select')].filter(x=>!x.disabled&&x.tabIndex!==-1),first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  function open(options={}){callbacks=options;value=normalize(options.value);tab='face';rotation=.24;previousFocus=document.activeElement;overlay.hidden=false;message.textContent='';overlay.querySelector('h2').textContent=options.edit?'Ludus sahibinin görünümü':'Ludus sahibini oluştur';overlay.querySelector('[data-action="save"]').textContent=options.edit?'GÖRÜNÜMÜ KAYDET':'BU GÖRÜNÜMÜ SEÇ';renderFields();start();nav.querySelector('button').focus();}
  return {open,close,get value(){return normalize(value);}};
 }
 return {defaults,choices,hairColors,normalize,load,create,createEditor};
})();
