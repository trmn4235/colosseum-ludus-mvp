/* Original procedural Roman owner avatar and cosmetic editor. No external model assets. */
var LudusOwner = (() => {
 'use strict';
 const defaults={version:1,hair:'short',beard:'clean',brows:'natural',hairColor:'#34251e',beardColor:'#34251e',browColor:'#34251e',skin:'#bd8967',eyes:'#594737',height:178,body:'athletic',face:'oval',outfit:'tunic',cloth:'#eee4d0',accent:'#eee4d0',accessory:'none'};
 const choices={hair:[['short','Kısa'],['crop','Kesim'],['curls','Kıvırcık'],['waves','Dalgalı'],['long','Omuz hizası'],['bald','Kel']],beard:[['clean','Sakalsız'],['stubble','Kirli sakal'],['short','Kısa sakal'],['full','Dolgun sakal'],['goatee','Keçi sakalı'],['moustache','Bıyık']],brows:[['natural','Doğal'],['fine','İnce'],['thick','Kalın'],['arched','Kavisli'],['straight','Düz']],body:[['slim','İnce'],['athletic','Atletik'],['broad','Geniş omuzlu'],['stocky','İri']],face:[['oval','Oval'],['square','Köşeli'],['narrow','İnce']],outfit:[['tunic','Beyaz tunik']],accessory:[['none','Aksesuar yok'],['brooch','Omuz broşu'],['laurel','Defne tacı'],['pendant','Madalyon']]};
 const colorFields=['hairColor','beardColor','browColor','skin','eyes'];
 function normalize(value){const v=value&&typeof value==='object'?value:{};const result={...defaults};for(const key of Object.keys(choices))if(choices[key].some(([id])=>id===v[key]))result[key]=v[key];for(const key of colorFields)if(typeof v[key]==='string'&&/^#[a-f\d]{6}$/i.test(v[key]))result[key]=v[key];if(Number.isFinite(Number(v.height)))result.height=Math.round(Math.max(160,Math.min(200,Number(v.height))));return result;}
 function create(value){
  const T=THREE,a=normalize(value),root=new T.Group();root.name='ludus-owner';root.userData.owner=true;
  const body=new T.Group();root.add(body);const width={slim:.86,athletic:1,broad:1.15,stocky:1.23}[a.body];body.scale.set(width,a.height/198.5,1);root.userData.appearance=a;
  const mats={},geos={};function material(name,color,metal=0){return mats[name]||(mats[name]=new T.MeshStandardMaterial({color,roughness:metal?.38:.9,metalness:metal}));}
  const skin=material('skin',a.skin),hair=material('hair',a.hairColor),beard=material('beard',a.beardColor),brows=material('brows',a.browColor),cloth=material('cloth',a.cloth),accent=material('accent',a.accent),gold=material('gold',0xba9657,.65),leather=material('leather',0x483025),white=material('white',0xe9e3d8),iris=material('iris',a.eyes),pupil=material('pupil',0x1d1918),lip=material('lip',new T.Color(a.skin).multiplyScalar(.70));
  const sphere=geos.sphere=new T.SphereGeometry(1,20,14),box=geos.box=new T.BoxGeometry(1,1,1);
  function mesh(parent,geo,mat,x,y,z,sx,sy,sz){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=false;m.receiveShadow=true;parent.add(m);return m;}
  const smallSphere=geos.smallSphere=new T.SphereGeometry(1,12,8);
  function ball(parent,mat,x,y,z,sx,sy,sz){return mesh(parent,Math.max(sx,sy,sz)<.07?smallSphere:sphere,mat,x,y,z,sx,sy,sz);}
  function tube(parent,mat,points,r=.012){const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,r,5,false);return mesh(parent,geo,mat,0,0,0,1,1,1);}
  // Sandals and articulated limbs. The robe remains above the feet during walking.
  const legs=[],arms=[];
  for(const sign of [-1,1]){
   const leg=new T.Group();leg.position.set(sign*.105,.82,0);body.add(leg);legs.push(leg);
   ball(leg,skin,0,-.32,0,.075,.34,.075);ball(leg,skin,0,-.67,.01,.056,.15,.057);
   ball(leg,skin,0,-.74,.08,.066,.05,.14);mesh(leg,box,leather,0,-.79,.08,.14,.035,.30);
   for(const z of [.045,.13])mesh(leg,box,leather,0,-.715,z,.137,.03,.045);
   for(const y of [-.63,-.57])mesh(leg,box,leather,0,y,.035,.12,.026,.04);
   const arm=new T.Group();arm.position.set(sign*.28,1.49,0);arm.rotation.z=sign*.09;body.add(arm);arms.push(arm);
   ball(arm,skin,0,-.14,0,.081,.22,.083);ball(arm,skin,0,-.43,.015,.060,.16,.062);ball(arm,skin,0,-.60,.025,.065,.09,.039);
   for(let i=0;i<4;i++)ball(arm,skin,sign*(-.045+i*.028),-.66,.030,.013,.052,.018);
   ball(arm,skin,-sign*.055,-.58,.051,.027,.050,.02);
   // Short sleeves drape outside the shoulder, without covering the hand.
   const sleeveGeo=new T.CylinderGeometry(.11,.14,.25,16,1,true);mesh(arm,sleeveGeo,cloth,0,-.075,0,1,1,1);
   mesh(arm,new T.TorusGeometry(.136,.009,5,20),a.outfit==='tunic'?leather:gold,0,-.20,0,1,1,1).rotation.x=Math.PI/2;
  }
  const torsoGeo=new T.LatheGeometry([[.20,.82],[.19,.95],[.215,1.14],[.265,1.39],[.26,1.50],[.115,1.57]].map(p=>new T.Vector2(...p)),40);mesh(body,torsoGeo,cloth,0,0,0,1,1,.70);
  // Cloth folds are part of the skirt geometry rather than painted on a cylinder.
  const skirtGeo=new T.CylinderGeometry(.20,a.outfit==='tunic'?.30:.33,.89,64,12,true),p=skirtGeo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),angle=Math.atan2(z,x),r=Math.hypot(x,z),t=(p.getY(i)/.89+.5),fold=.010*(.4+1-t)*Math.cos(angle*16);p.setXYZ(i,x*(r+fold)/r,p.getY(i),z*(r+fold)/r);}
  skirtGeo.computeVertexNormals();const skirt=mesh(body,skirtGeo,cloth,0,.59,0,1,1,.82);
  const hemY=.145;mesh(body,new T.TorusGeometry(a.outfit==='tunic'?.30:.33,.008,5,64),a.outfit==='tunic'?leather:gold,0,hemY,0,1,1,.82).rotation.x=Math.PI/2;
  mesh(body,new T.CylinderGeometry(.202,.205,.05,40,1,true),a.outfit==='ceremony'?gold:leather,0,1.04,0,1,1,.74);ball(body,gold,0,1.04,.159,.035,.027,.012);
  if(a.outfit!=='tunic'){
   // Draped toga follows a sloped band around the torso, with sculpted hanging folds.
   const count=56,rows=12,positions=[],indices=[];
   for(let j=0;j<=rows;j++)for(let i=0;i<=count;i++){const angle=i/count*Math.PI*2,t=j/rows,front=Math.max(0,Math.cos(angle)),top=1.49+.11*Math.sin(angle),bottom=(a.outfit==='senator'?1.08:.68)+.20*Math.sin(angle),r=.273+.013*Math.cos(t*Math.PI*8)*front;positions.push(Math.sin(angle)*r,top*(1-t)+bottom*t,Math.cos(angle)*r*.76+.012*front);}
   for(let j=0;j<rows;j++)for(let i=0;i<count;i++){const n=j*(count+1)+i;indices.push(n,n+1,n+count+1,n+1,n+count+2,n+count+1);}
   const drapeGeo=new T.BufferGeometry();drapeGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));drapeGeo.setIndex(indices);drapeGeo.computeVertexNormals();const drapeMat=a.outfit==='toga'?cloth:accent;drapeMat.side=T.DoubleSide;mesh(body,drapeGeo,drapeMat,0,0,0,1,1,1);
   const border=[];for(let i=0;i<=count;i++){const angle=i/count*Math.PI*2;border.push([Math.sin(angle)*.279,(a.outfit==='senator'?1.08:.68)+.20*Math.sin(angle),Math.cos(angle)*.279*.76+.016*Math.max(0,Math.cos(angle))]);}tube(body,a.outfit==='toga'?accent:gold,border,.009);
   const hangingGeo=new T.CylinderGeometry(.10,.125,a.outfit==='senator'?.91:1.30,24,10,true,0,Math.PI);const hanging=mesh(body,hangingGeo,a.outfit==='toga'?cloth:accent,-.20,a.outfit==='senator'?1.04:.85,.06,1,1,.6);hanging.rotation.z=-.10;
  }
  // Human head, ears, nose, lids and separate eyebrow/beard materials.
  ball(body,skin,0,1.60,0,.073,.105,.075);const head=new T.Group();head.position.set(0,1.78,0);body.add(head);
  const faceWidth={oval:1,square:1.09,narrow:.91}[a.face];ball(head,skin,0,0,0,.145*faceWidth,.205,.143);
  ball(head,skin,0,-.105,.029,.107*faceWidth,.081,.096);for(const sign of [-1,1]){ball(head,skin,sign*.143,-.005,0,.035,.061,.022);ball(head,lip,sign*.153,-.005,.015,.012,.032,.009);}
  ball(head,skin,0,-.013,.142,.025,.052,.038);ball(head,skin,0,-.037,.167,.030,.021,.022);
  for(const sign of [-1,1]){ball(head,skin,sign*.061,.039,.128,.043,.026,.020);ball(head,white,sign*.061,.037,.144,.032,.015,.009);ball(head,iris,sign*.061,.037,.152,.011,.012,.004);ball(head,pupil,sign*.061,.037,.155,.005,.007,.002);ball(head,white,sign*.057,.042,.157,.0025,.0025,.001);tube(head,lip,[[sign*.029,.040,.148],[sign*.062,.053,.153],[sign*.094,.039,.14]],.0035);
   const thickness={fine:.004,natural:.007,thick:.012,arched:.007,straight:.008}[a.brows],rise=a.brows==='arched'?.017:a.brows==='straight'?0:.007;tube(head,brows,[[sign*.028,.078,.139],[sign*.064,.080+rise,.138],[sign*.100,.076,.123]],thickness);
  }
  tube(head,lip,[[-.034,-.079,.133],[0,-.083,.143],[.034,-.079,.133]],.005);
  if(a.beard!=='clean'){
   if(!['goatee','moustache'].includes(a.beard)){const g=new T.SphereGeometry(1,24,12,0,Math.PI*2,Math.PI*.51,Math.PI*.42);mesh(head,g,beard,0,.016,.004,.151,a.beard==='full'?.25:.202,.149);}
   if(a.beard==='goatee')ball(head,beard,0,-.116,.111,.044,.060,.025);
   if(a.beard!=='stubble')for(const sign of [-1,1])ball(head,beard,sign*.025,-.060,.144,.030,.012,.009);
  }
  if(a.hair!=='bald'){
   const hairGeo=new T.SphereGeometry(1,32,16,0,Math.PI*2,0,a.hair==='crop'?1.11:1.37);mesh(head,hairGeo,hair,0,.015,-.004,.150,a.hair==='crop'?.198:.220,.152);
   if(['curls','waves'].includes(a.hair))for(let row=0;row<3;row++)for(let i=0;i<16;i++){const angle=i/16*Math.PI*2,r=.115*Math.sin(.6+row*.35);ball(head,hair,Math.sin(angle)*r,.15-row*.042,Math.cos(angle)*r-.01,.039,a.hair==='curls'?.034:.021,.034);}
   if(a.hair==='long'){ball(head,hair,0,-.05,-.113,.151,.225,.06);for(const sign of [-1,1])ball(head,hair,sign*.139,-.09,-.031,.034,.177,.064);}
   if(a.hair==='short'){const wave=ball(head,hair,-.035,.18,.035,.105,.05,.104);wave.rotation.z=.16;}
  }
  if(a.accessory==='laurel'){for(let i=0;i<18;i++){const angle=(i/17)*Math.PI*1.65+.18;const leaf=ball(head,gold,Math.sin(angle)*.153,.124,Math.cos(angle)*.149,.023,.013,.012);leaf.rotation.z=angle*.5;}}
  if(a.accessory==='brooch')ball(body,gold,-.23,1.48,.155,.038,.038,.018);
  if(a.accessory==='pendant'){tube(body,gold,[[-.09,1.59,.03],[-.07,1.44,.185],[0,1.38,.212],[.07,1.44,.185],[.09,1.59,.03]],.004);ball(body,gold,0,1.36,.218,.030,.037,.008);}
  const shadow=mesh(root,new T.CircleGeometry(.39,24),new T.MeshBasicMaterial({color:0x30231b,transparent:true,opacity:.20,depthWrite:false}),0,.015,0,1,1,1);shadow.rotation.x=-Math.PI/2;
  // Batch rigid pieces by material inside each animated joint. Curly hair and
  // face details do not add a separate draw call per small mesh on mobile.
  const retiredGeometries=new Set();
  for(const parent of [body,head,...arms,...legs]){
   const batches=new Map();for(const child of [...parent.children]){if(!child.isMesh)continue;child.updateMatrix();const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.applyMatrix4(child.matrix);if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(g);retiredGeometries.add(child.geometry);parent.remove(child);}
   for(const [mat,list]of batches){const geo=new T.BufferGeometry();for(const name of ['position','normal']){const length=list.reduce((n,g)=>n+g.getAttribute(name).array.length,0),buffer=new Float32Array(length);let offset=0;for(const g of list){buffer.set(g.getAttribute(name).array,offset);offset+=g.getAttribute(name).array.length;}geo.setAttribute(name,new T.BufferAttribute(buffer,3));}geo.computeBoundingSphere();mesh(parent,geo,mat,0,0,0,1,1,1);list.forEach(g=>g.dispose());}
  }
  retiredGeometries.forEach(g=>g.dispose());
  let walk=0,speed=0;function animate(dt,moving){speed+=(Number(!!moving)-speed)*(1-Math.exp(-dt*12));walk+=dt*7.5*speed;legs.forEach((g,i)=>g.rotation.x=Math.sin(walk+i*Math.PI)*.25*speed);arms.forEach((g,i)=>g.rotation.x=-Math.sin(walk+i*Math.PI)*.20*speed);body.position.y=Math.abs(Math.sin(walk))*.010*speed;body.rotation.z=Math.sin(walk)*.010*speed;head.rotation.y=Math.sin(walk*.33)*.015*(1-speed);}
  function dispose(){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.isMesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());root.removeFromParent();}
  return {root,body,head,appearance:a,animate,dispose};
 }
 function createEditor(){
  const overlay=document.createElement('section');overlay.className='owner-editor';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','ownerTitle');
  overlay.innerHTML='<div class="owner-sheet"><header><div><small>COLOSSEUM & LUDUS</small><h2 id="ownerTitle">Ludus sahibini oluştur</h2></div><button type="button" data-action="close" aria-label="Görünüm ekranını kapat">✕</button></header><div class="owner-layout"><div class="owner-preview"><canvas aria-label="Ludus sahibinin üç boyutlu önizlemesi"></canvas><div class="owner-preview-tools"><button type="button" data-action="left" aria-label="Karakteri sola döndür">↶</button><span>Sürükleyerek döndür</span><button type="button" data-action="right" aria-label="Karakteri sağa döndür">↷</button></div><p class="owner-caption"></p></div><div class="owner-custom"><nav aria-label="Görünüm kategorileri"></nav><div class="owner-fields"></div></div></div><footer><div class="owner-extra"><button type="button" data-action="random">Rastgele</button><button type="button" data-action="reset">Sıfırla</button></div><p class="owner-message" role="status" aria-live="polite"></p><button type="button" data-action="save" class="owner-save">BU GÖRÜNÜMÜ SEÇ</button></footer></div>';
  document.body.append(overlay);const canvas=overlay.querySelector('canvas'),fields=overlay.querySelector('.owner-fields'),nav=overlay.querySelector('nav'),message=overlay.querySelector('.owner-message'),caption=overlay.querySelector('.owner-caption');
  const tabs={face:{label:'Yüz',keys:['hair','beard','brows','face','hairColor','beardColor','browColor','eyes']},body:{label:'Vücut',keys:['skin','height','body']},dress:{label:'Kıyafet',keys:['outfit','accessory']}};
  const labels={hair:'Saç tipi',beard:'Sakal tipi',brows:'Kaş tipi',face:'Yüz şekli',hairColor:'Saç rengi',beardColor:'Sakal rengi',browColor:'Kaş rengi',eyes:'Göz rengi',skin:'Ten rengi',height:'Boy',body:'Vücut tipi',outfit:'Kıyafet modeli',cloth:'Kumaş rengi',accent:'Örtü / şerit rengi',accessory:'Aksesuar'};
  let value=normalize(),tab='face',renderer=null,scene=null,camera=null,model=null,rotation=.24,frame=0,callbacks={},previousFocus=null,pointer=null,saving=false;
  function rebuild(){if(!renderer)return;if(model)model.dispose();model=create(value);model.root.rotation.y=rotation;scene.add(model.root);caption.textContent=choices.outfit.find(([id])=>id===value.outfit)[1]+' · '+value.height+' cm';}
  function renderFields(){fields.replaceChildren();for(const key of tabs[tab].keys){const label=document.createElement('label');label.className='owner-field';const text=document.createElement('span');text.textContent=labels[key];label.append(text);let input;
   if(choices[key]){input=document.createElement('select');for(const [id,name]of choices[key]){const option=document.createElement('option');option.value=id;option.textContent=name;input.append(option);}input.value=value[key];}
   else if(key==='height'){input=document.createElement('input');input.type='range';input.min=160;input.max=200;input.step=1;input.value=value.height;const output=document.createElement('output');output.textContent=value.height+' cm';label.append(output);}
   else{input=document.createElement('input');input.type='color';input.value=value[key];}
   input.name=key;input.setAttribute('aria-label',labels[key]);input.addEventListener('input',()=>{value[key]=key==='height'?Number(input.value):input.value;if(key==='height')label.querySelector('output').textContent=value.height+' cm';rebuild();});label.append(input);fields.append(label);}
   for(const button of nav.children){const active=button.dataset.tab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('active',active);}
  }
  nav.setAttribute('role','tablist');for(const [id,t]of Object.entries(tabs)){const b=document.createElement('button');b.type='button';b.textContent=t.label;b.dataset.tab=id;b.setAttribute('role','tab');b.onclick=()=>{tab=id;renderFields();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const ids=Object.keys(tabs),n=ids.indexOf(tab);tab=ids[(n+(e.key==='ArrowRight'?1:2))%3];renderFields();nav.querySelector('[data-tab="'+tab+'"]').focus();}};nav.append(b);}
  function resize(){if(!renderer||overlay.hidden)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
  function tick(){if(overlay.hidden)return;frame=requestAnimationFrame(tick);if(model){model.root.rotation.y=rotation;model.animate(1/60,false);}const close=tab==='face';const headY=1.78*value.height/198.5,targetY=close?headY:.95;camera.position.set(close?.02:0,close?headY+.045:1.15,close?1.13:3.7);camera.lookAt(0,targetY,0);renderer.render(scene,camera);}
  function start(){if(!renderer){try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff0db,0x655444,2.1));const sun=new THREE.DirectionalLight(0xffedce,2.6);sun.position.set(-3,5,4);scene.add(sun);camera=new THREE.PerspectiveCamera(36,1,.03,20);}catch{message.textContent='3D önizleme açılamadı. Seçimlerini yapabilir veya Safari’de tekrar deneyebilirsin.';return;}}rebuild();resize();tick();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function close(){if(saving)return;overlay.hidden=true;cancelAnimationFrame(frame);callbacks.onClose?.();previousFocus?.focus();}
  overlay.querySelector('[data-action="close"]').onclick=close;
  overlay.querySelector('[data-action="left"]').onclick=()=>rotation-=.45;overlay.querySelector('[data-action="right"]').onclick=()=>rotation+=.45;
  canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(pointer?.id===e.pointerId){rotation+=(e.clientX-pointer.x)*.013;pointer.x=e.clientX;}});for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>pointer=null);
  overlay.querySelector('[data-action="reset"]').onclick=()=>{value=normalize();renderFields();rebuild();};
  overlay.querySelector('[data-action="random"]').onclick=()=>{for(const key of Object.keys(choices)){const list=choices[key];value[key]=list[Math.floor(Math.random()*list.length)][0];}const colors=['#231b18','#543929','#86613d','#aaa39b'];value.hairColor=value.browColor=value.beardColor=colors[Math.floor(Math.random()*colors.length)];value.skin=['#edc7a8','#d9ae87','#bd8967','#99694b','#71503d'][Math.floor(Math.random()*5)];value.height=165+Math.floor(Math.random()*31);renderFields();rebuild();};
  overlay.querySelector('[data-action="save"]').onclick=async()=>{if(saving)return;saving=true;const buttons=[...overlay.querySelectorAll('button,input,select')];buttons.forEach(b=>b.disabled=true);message.textContent='';try{await callbacks.onSave?.(normalize(value));saving=false;close();}catch(e){message.textContent=e.message||'Görünüm kaydedilemedi. Tekrar dene.';}finally{saving=false;buttons.forEach(b=>b.disabled=false);}};
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const list=[...overlay.querySelectorAll('button,input,select')].filter(x=>!x.disabled&&x.tabIndex!==-1),first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  function open(options={}){callbacks=options;value=normalize(options.value);tab='face';rotation=.24;previousFocus=document.activeElement;overlay.hidden=false;message.textContent='';overlay.querySelector('h2').textContent=options.edit?'Ludus sahibinin görünümü':'Ludus sahibini oluştur';overlay.querySelector('[data-action="save"]').textContent=options.edit?'GÖRÜNÜMÜ KAYDET':'BU GÖRÜNÜMÜ SEÇ';renderFields();start();nav.querySelector('button').focus();}
  return {open,close,get value(){return normalize(value);}};
 }
 return {defaults,choices,normalize,create,createEditor};
})();
