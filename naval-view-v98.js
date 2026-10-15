/* Herculaneum Boat by Opus Poly, CC BY 4.0. Enlarged and optimized V98; see asset credits. */
(function(root){
  'use strict';
  const T=root.THREE,C=root.NavalSimulation.constants;
  const palette=[0x315d94,0x8a2635,0x416a4f,0x704d83];
  const assetURL='assets/naval/herculaneum-v98.glb';
  let source=null,pending=null;
  function load(){
    if(pending)return pending;
    pending=(async()=>{
      const bytes=await root.ArenaAssetLoad(assetURL);
      const gltf=await new T.GLTFLoader().parseAsync(bytes,'');
      const model=gltf.scene;model.name='Herculaneum battle boat';
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.envMapIntensity=.65;}});
      source=model;return model;
    })().catch(error=>{pending=null;throw Error('Tekne modeli yüklenemedi. Sayfayı yeniden aç. '+error.message);});
    return pending;
  }
  function template(){
    if(!source)throw Error('Herculaneum modeli henüz hazır değil.');
    const group=source.clone(true);
    let originalWood;
    group.traverse(o=>{if(o.isMesh&&o.material.name==='Hull')originalWood=o.material;});
    const wood=originalWood.clone();wood.vertexColors=false;wood.color.setHex(0xb7a38a);
    const dark=wood.clone();dark.color.setHex(0x493728);
    const materials={wood,dark,bronze:new T.MeshStandardMaterial({color:0x9a773e,roughness:.65,metalness:.5}),paint:new T.MeshStandardMaterial({color:0xffffff,roughness:.95,side:T.DoubleSide})};
    // Small stern pennants identify the four teams without recolouring the
    // original hull. Every clone shares geometry and all eight source textures.
    const pole=new T.Mesh(new T.CylinderGeometry(.035,.045,2.8,6),dark);pole.position.set(1.7,1.35,-5.7);pole.castShadow=true;group.add(pole);
    const flagGeo=new T.PlaneGeometry(.85,1.2,2,3),pos=flagGeo.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)*4+pos.getY(i)*2)*.045);
    flagGeo.computeVertexNormals();const flag=new T.Mesh(flagGeo,materials.paint);flag.name='paint';flag.position.set(1.27,1.94,-5.7);flag.castShadow=true;group.add(flag);
    return {group,materials};
  }
  function create(naval,scene,camera,options){
    const {group:source,materials}=template(),views=[],bridgeViews=[];
    const bridgeGeometry=new T.BoxGeometry(C.bridgeLength,.12,C.bridgeWidth),bridgePlanks=[];
    for(let i=.12;i<C.bridgeLength;i+=.24){const g=new T.BoxGeometry(.025,.016,C.bridgeWidth).translate(i-C.bridgeLength/2,.069,0);bridgePlanks.push(g.toNonIndexed());}
    const seamGeometry=root.ArenaGeometryUtils.mergeGeometries(bridgePlanks,false);bridgePlanks.forEach(g=>g.dispose());
    for(const ship of naval.ships){
      const group=source.clone(true),paint=materials.paint.clone();paint.color.setHex(palette[ship.team]);group.getObjectByName('paint').material=paint;scene.add(group);
      const sides=[];
      for(const side of [-1,1]){
        const pivot=new T.Group();pivot.position.set(side*C.halfWidth,.03,0);group.add(pivot);
        const plank=new T.Mesh(bridgeGeometry,materials.wood);plank.position.x=side*C.bridgeLength/2;plank.castShadow=plank.receiveShadow=true;pivot.add(plank);
        const seams=new T.Mesh(seamGeometry,materials.dark);seams.position.x=side*C.bridgeLength/2;pivot.add(seams);
        const rail=new T.Mesh(new T.BoxGeometry(C.bridgeLength,.1,.07),materials.bronze);rail.position.set(side*C.bridgeLength/2,.1,C.bridgeWidth/2);pivot.add(rail);const second=rail.clone();second.position.z=-C.bridgeWidth/2;pivot.add(second);
        bridgeViews.push({ship,side,pivot});
        const role=side<0?'oars-port':'oars-starboard';
        const oars=group.children.find(o=>o.userData.navalRole===role);
        sides.push({side,oars});
      }
      views.push({ship,group,sides});
    }
    const water=new T.Mesh(new T.CircleGeometry(65,96),new T.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,fragmentShader:`uniform float time;varying vec3 vWorld;
      void main(){vec2 p=vWorld.xz;float a=sin(p.x*1.5+p.y*.8+time*.65+sin(p.y*.2+time*.12)),b=sin(p.y*2.4-p.x*.6+time*.9),c=sin(p.x*.36+p.y*.72-time*.42);
      vec3 normal=normalize(vec3((a+b)*.1,1.,(b+c)*.12));vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(normal,view),0.),3.);
      float shine=pow(max(dot(reflect(-normalize(vec3(-.5,1.,.3)),normal),view),0.),100.);
      vec3 color=mix(vec3(.025,.105,.14),vec3(.15,.30,.31),.48+.1*c+.06*a);color=mix(color,vec3(.35,.49,.53),fresnel*.35);color+=vec3(.8,.74,.5)*shine*.2;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }` }));
    water.rotation.x=-Math.PI/2;water.position.y=-.72;water.renderOrder=-1;scene.add(water);
    const wakeGeo=new T.RingGeometry(1,1.08,28,1,0,Math.PI),wakeMat=new T.MeshBasicMaterial({color:0xb6d6c9,transparent:true,opacity:.15,depthWrite:false,side:T.DoubleSide});
    const wakes=naval.ships.map(ship=>{const m=new T.Mesh(wakeGeo,wakeMat.clone());m.rotation.x=-Math.PI/2;m.scale.set(2.7,5,1);m.position.y=-.69;scene.add(m);return{ship,m};});
    const panel=document.createElement('div');panel.id='navalControls';panel.innerHTML=`<div id="navalStatus" role="status"></div><button id="navalHelm" title="Dümeni al / bırak · I" aria-label="Dümeni al"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="8"/><circle cx="16" cy="16" r="2"/><path d="M16 2v28M2 16h28M6 6l20 20M6 26 26 6"/></svg><span>Dümeni al</span></button><button id="navalBridge" title="Geçiş köprüsü · E" hidden aria-label="Köprüyü aç"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m6 29 28-18M6 23l28-18M8 24l3 5M14 20l3 5M20 16l3 5M26 12l3 5M32 8l3 5"/></svg><span>Köprüyü aç</span></button><div id="navalSailing" hidden><span>Yön ve hız: sol kontrol / WASD</span><button id="navalBrake">Yavaşla</button></div>`;
    document.getElementById('app').append(panel);
    const jumpButton=document.createElement('button');jumpButton.id='navalJump';jumpButton.hidden=true;jumpButton.title='Karşı gemiye atla · Boşluk';jumpButton.setAttribute('aria-label','Karşı gemiye atla');jumpButton.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="17" cy="5" r="2.6"/><path d="m10 10 7-1 4 6 6-3M17 9l-3 10-7 5M14 19l8 2-1 7M4 28h6M25 28h4"/></svg><span>ATLA</span>';panel.append(jumpButton);
    const landingMark=new T.Mesh(new T.RingGeometry(.36,.45,28),new T.MeshBasicMaterial({color:0xffd963,transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide}));landingMark.rotation.x=-Math.PI/2;landingMark.visible=false;scene.add(landingMark);
    const helm=panel.querySelector('#navalHelm'),bridge=panel.querySelector('#navalBridge'),status=panel.querySelector('#navalStatus'),sailing=panel.querySelector('#navalSailing');let braking=false;
    helm.onclick=()=>{if(!options.active())return;const changed=naval.manual?naval.releaseHelm():naval.takeHelm();if(changed){options.clearInput();options.toast(naval.manual?'Dümen sende.':naval.ships[0].helm!==null?'Takım arkadaşın dümeni devraldı.':'Dümeni alabilecek takım arkadaşın kalmadı.');}};
    bridge.onclick=()=>{if(!options.active())return;const interaction=naval.interaction();if(interaction?.blocked){options.toast('Köprüde bir gladyatör var.');return;}if(naval.operate())options.toast(interaction.kind==='open'?'Geçiş köprüsü açılıyor.':'Geçiş köprüsü toplanıyor.');};
    function jump(){
      if(!options.active()||!options.jumpEnabled||naval.manual||!naval.jump)return false;
      if(naval.jump()){options.clearInput();options.toast('Karşı güverteye atlıyorsun.');return true;}
      if(!naval.player().navJump)options.toast(naval.player().stamina<C.jumpCost?'Atlamak için 20 kondisyon gerekiyor.':'Yakın bir gemiye bakan kenara yaklaş.');
      return false;
    }
    jumpButton.onclick=jump;
    const brake=panel.querySelector('#navalBrake');brake.addEventListener('pointerdown',e=>{e.preventDefault();if(!options.active())return;braking=true;brake.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])brake.addEventListener(event,()=>{braking=false;});
    const point=new T.Vector3(),ui=root.GamePerformance,helmLabel=helm.querySelector('span'),bridgeLabel=bridge.querySelector('span');
    function update(time){
      water.material.uniforms.time.value=time;
      for(const v of views){v.group.position.set(v.ship.x,0,v.ship.z);v.group.rotation.y=v.ship.angle;for(const s of v.sides)s.oars.rotation.z=naval.linked(v.ship)?s.side*.45:Math.sin(time*3.2)*Math.min(.07,Math.abs(v.ship.speed)*.035);}
      for(const v of bridgeViews){const b=naval.bridges.find(b=>b.from===v.ship.id&&b.side===v.side&&b.phase!=='closed');const open=b?.progress||0;v.pivot.rotation.y=-v.side*(1-open)*Math.PI/2;}
      for(const v of wakes){const p=NavalSimulation.world(v.ship,0,-5.7);v.m.position.x=p.x;v.m.position.z=p.z;v.m.rotation.z=-v.ship.angle;v.m.material.opacity=Math.min(.22,Math.abs(v.ship.speed)*.08);}
      const p=naval.player(),active=options.active();ui.hidden(panel,!active||p.hp<=0);
      // A cached V98 page can finish with its old simulation and animation code.
      const target=active&&options.jumpEnabled&&p.hp>0?naval.jumpCandidate?.():null;
      ui.hidden(jumpButton,!target);landingMark.visible=!!target&&active;
      if(target)landingMark.position.set(target.end.x,.075,target.end.z);
      ui.toggle(document.body,'naval-helm',naval.manual&&active);
      helm.disabled=!naval.manual&&!naval.canTakeHelm();ui.text(helmLabel,naval.manual?'Dümeni bırak':'Dümeni al');ui.attr(helm,'aria-label',naval.manual?'Dümeni bırak':'Dümeni al');
      ui.hidden(sailing,!naval.manual);
      const captain=naval.combat.fighters[naval.ships[0].helm];
      const message=naval.manual?(naval.linked(naval.ships[0])?'Köprü açık · gemi sabit':'DÜMEN SENDE'):captain?'Dümen: '+captain.name:'Dümen boş';
      ui.text(status,message);
      const action=naval.interaction();ui.hidden(bridge,!action||!active);
      if(action){const ship=naval.ships[p.shipId],q=NavalSimulation.world(ship,action.side*(C.halfWidth-.2),0);point.set(q.x,1.25,q.z).project(camera);bridge.hidden=point.z<0||point.z>1;const w=innerWidth,h=innerHeight;bridge.style.left=Math.max(45,Math.min(w-45,(point.x*.5+.5)*w))+'px';bridge.style.top=Math.max(90,Math.min(h-102,(-point.y*.5+.5)*h))+'px';const label=action.kind==='open'?'Köprüyü aç':'Köprüyü topla';ui.text(bridgeLabel,label);ui.attr(bridge,'aria-label',label);ui.toggle(bridge,'occupied',!!action.blocked);ui.attr(bridge,'aria-disabled',String(!!action.blocked));}
      if(!active)braking=false;
    }
    return{update,views,water,panel,jump,landingMark,get braking(){return braking;}};
  }
  root.NavalView={create,load,assetURL};
})(window);
