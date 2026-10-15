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
  function template(outfitted){
    if(!source)throw Error('Herculaneum modeli henüz hazır değil.');
    const group=source.clone(true);
    let originalWood;
    group.traverse(o=>{if(o.isMesh&&o.material.name==='Hull')originalWood=o.material;});
    const wood=originalWood.clone();wood.vertexColors=false;wood.color.setHex(0xb7a38a);
    const dark=wood.clone();dark.color.setHex(0x493728);
    const materials={wood,dark,bronze:new T.MeshStandardMaterial({color:0x9a773e,roughness:.65,metalness:.5}),paint:new T.MeshStandardMaterial({color:0xffffff,roughness:.95,side:T.DoubleSide})};
    let outfit=null;
    if(outfitted){
      for(const o of [...group.children])if(['sail','mast','rigging'].includes(o.userData.navalRole))group.remove(o);
      outfit=root.NavalOutfit.create(T,group,materials);group.add(outfit.group);
    }
    // Small stern pennants identify the four teams without recolouring the
    // original hull. Every clone shares geometry and all eight source textures.
    if(!outfitted){const pole=new T.Mesh(new T.CylinderGeometry(.035,.045,2.8,6),dark);pole.position.set(1.7,1.35,-5.7);pole.castShadow=true;group.add(pole);
    const flagGeo=new T.PlaneGeometry(.85,1.2,2,3),pos=flagGeo.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)*4+pos.getY(i)*2)*.045);
    flagGeo.computeVertexNormals();const flag=new T.Mesh(flagGeo,materials.paint);flag.name='paint';flag.position.set(1.27,1.94,-5.7);flag.castShadow=true;group.add(flag);}
    return {group,materials,outfit};
  }
  function create(naval,scene,camera,options){
    const outfitted=!!(options.outfitEnabled&&root.NavalOutfit),{group:source,materials,outfit}=template(outfitted),views=[],bridgeViews=[];
    const bridgeGeometry=new T.BoxGeometry(C.bridgeLength,.12,C.bridgeWidth),bridgePlanks=[];
    for(let i=.12;i<C.bridgeLength;i+=.24){const g=new T.BoxGeometry(.025,.016,C.bridgeWidth).translate(i-C.bridgeLength/2,.069,0);bridgePlanks.push(g.toNonIndexed());}
    const seamGeometry=root.ArenaGeometryUtils.mergeGeometries(bridgePlanks,false);bridgePlanks.forEach(g=>g.dispose());
    for(const ship of naval.ships){
      const group=source.clone(true);
      if(outfitted)group.getObjectByName('Open sail').material=outfit.sailMaterials[ship.team];
      else{const paint=materials.paint.clone();paint.color.setHex(palette[ship.team]);group.getObjectByName('paint').material=paint;}scene.add(group);
      const sides=[];
      for(const side of [-1,1]){
        for(const station of C.bridgeStations){
        const pivot=new T.Group();pivot.position.set(side*C.halfWidth,.03,station);group.add(pivot);
        const plank=new T.Mesh(bridgeGeometry,materials.wood);plank.position.x=side*C.bridgeLength/2;plank.castShadow=plank.receiveShadow=true;pivot.add(plank);
        const seams=new T.Mesh(seamGeometry,materials.dark);seams.position.x=side*C.bridgeLength/2;pivot.add(seams);
        const rail=new T.Mesh(new T.BoxGeometry(C.bridgeLength,.1,.07),materials.bronze);rail.position.set(side*C.bridgeLength/2,.1,C.bridgeWidth/2);pivot.add(rail);const second=rail.clone();second.position.z=-C.bridgeWidth/2;pivot.add(second);
        bridgeViews.push({ship,side,station,pivot});
        }
        const role=side<0?'oars-port':'oars-starboard';
        const oars=group.children.find(o=>o.userData.navalRole===role);
        sides.push({side,oars});
      }
      const gates={value:Array.from({length:8},()=>new T.Vector3())};
      if(outfitted){
        const clip=shader=>{
          shader.uniforms.navalGates=gates;
          shader.vertexShader='varying vec3 vNavalHull;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvNavalHull=position;');
          shader.fragmentShader='varying vec3 vNavalHull;uniform vec3 navalGates[8];\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfor(int i=0;i<8;i++){vec3 gate=navalGates[i];if(gate.z>.5&&vNavalHull.x*gate.x>2.35&&abs(vNavalHull.z-gate.y)<1.34&&vNavalHull.y>-.045)discard;}');
        };
        group.traverse(o=>{if(!o.isMesh||!(o.userData.navalRole==='hull'||['Curved hull strakes','Raised gunwales and ribs','Bronze rubbing strakes'].includes(o.name)))return;
          const finish=o.material.onBeforeCompile,finishKey=o.material.customProgramCacheKey();o.material=o.material.clone();o.material.onBeforeCompile=shader=>{finish(shader);clip(shader);};o.material.customProgramCacheKey=()=> 'naval-boarding-gates-v105-'+finishKey;
          o.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});o.customDepthMaterial.onBeforeCompile=clip;o.customDepthMaterial.customProgramCacheKey=()=> 'naval-boarding-gates-v102';
        });
      }
      views.push({ship,group,sides,gates,rackShafts:group.getObjectByName('Rack shafts'),rackHeads:group.getObjectByName('Rack heads')});
    }
    // Shared ripple field; moving foam is shaded into the existing water surface.
    const rippleSize=256,rippleData=new Uint8Array(rippleSize*rippleSize*4);
    const waves=[[1,2,.085,.3],[3,-2,.065,1.8],[2,5,.055,2.7],[7,3,.045,.6],[-5,9,.035,4.1],[11,-9,.03,1.2],[17,11,.02,3.5],[-13,19,.018,2.2],[27,-19,.012,.8],[31,23,.009,5.3],[7,-27,.013,4.7],[-21,-11,.018,3.9]];
    for(let y=0;y<rippleSize;y++)for(let x=0;x<rippleSize;x++){
      let dx=0,dz=0,h=0;for(const [a,b,amp,phase] of waves){const phaseAt=(a*x+b*y)*Math.PI*2/rippleSize+phase,c=Math.cos(phaseAt)*amp,d=Math.hypot(a,b);dx+=a/d*c;dz+=b/d*c;h+=Math.sin(phaseAt)*amp;}
      const i=(y*rippleSize+x)*4;rippleData[i]=Math.round((dx*.5+.5)*255);rippleData[i+1]=Math.round((dz*.5+.5)*255);rippleData[i+2]=Math.round((h*.8+.5)*255);rippleData[i+3]=255;
    }
    const rippleMap=new T.DataTexture(rippleData,rippleSize,rippleSize);rippleMap.wrapS=rippleMap.wrapT=T.RepeatWrapping;rippleMap.magFilter=T.LinearFilter;rippleMap.minFilter=T.LinearMipmapLinearFilter;rippleMap.generateMipmaps=true;rippleMap.anisotropy=4;rippleMap.needsUpdate=true;
    const waterTime={value:0},waterShips={value:naval.ships.map(s=>new T.Vector4(s.x,s.z,s.angle,s.speed))},waterMaterial=new T.MeshPhysicalMaterial({color:0x214e53,roughness:.19,metalness:0,ior:1.333,specularIntensity:1,envMapIntensity:1.15});
    waterMaterial.uniforms={time:waterTime,ships:waterShips};
    waterMaterial.onBeforeCompile=shader=>{
      shader.uniforms.waterTime=waterTime;shader.uniforms.waterRipple={value:rippleMap};shader.uniforms.waterShips=waterShips;
      shader.vertexShader='varying vec3 navalWaterWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nnavalWaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader='uniform float waterTime;uniform sampler2D waterRipple;uniform vec4 waterShips[4];varying vec3 navalWaterWorld;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 waterP=navalWaterWorld.xz;
        float waterNoise=texture2D(waterRipple,waterP*.085+vec2(waterTime*.004,-waterTime*.002)).b;
        float waterFoam=0.;
        for(int i=0;i<4;i++){
          vec4 ship=waterShips[i];vec2 v=waterP-ship.xy;float c=cos(ship.z),s=sin(ship.z);vec2 q=vec2(v.x*c-v.y*s,v.x*s+v.y*c);
          if(dot(q,q)<520.){
            float speed=clamp(abs(ship.w)/2.2,0.,1.);float tail=-q.y*(ship.w<0.?-1.:1.)-5.8;
            float wake=(1.-smoothstep(.08,.7,abs(abs(q.x)-(.7+max(0.,tail)*.28))))*smoothstep(0.,1.,tail)*(1.-smoothstep(1.,13.,tail));
            float broken=smoothstep(.35,.63,waterNoise+sin(tail*2.6-waterTime*2.)*.10);
            float width=3.25*sqrt(max(.01,1.-pow(abs(q.y)/8.1,4.)));
            float rim=(1.-smoothstep(.025,.20,abs(abs(q.x)-width)))*(1.-smoothstep(7.3,8.1,abs(q.y)));
            waterFoam+=wake*broken*speed*.42+rim*(.025+.10*speed);
          }
        }
        waterFoam=clamp(waterFoam,0.,.6);
        diffuseColor.rgb*=.92+waterNoise*.16;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.40,.51,.48),waterFoam);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.17+waterNoise*.055,.48,waterFoam);');
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec2 p=navalWaterWorld.xz;float t=waterTime;
        mat2 rotation=mat2(.8,.6,-.6,.8);
        vec2 slope=(texture2D(waterRipple,p*.034+vec2(t*.0018,t*.0008)).rg*2.-1.)*.48;
        vec2 detail=texture2D(waterRipple,rotation*p*.13+vec2(-t*.003,t*.0013)).rg*2.-1.;
        slope+=vec2(.8*detail.x+.6*detail.y,-.6*detail.x+.8*detail.y)*.17;
        slope+=vec2(sin(p.x*.27+p.y*.18+t*.45),cos(p.y*.31-p.x*.14+t*.38))*.018;
        normal=normalize(mat3(viewMatrix)*normalize(vec3(-slope.x,1.,-slope.y)));
      `);
    };
    waterMaterial.customProgramCacheKey=()=> 'naval-water-surface-v105';
    const water=new T.Mesh(new T.CircleGeometry(naval.arenaRadius*1.5,96),waterMaterial);
    water.rotation.x=-Math.PI/2;water.position.y=-.72;water.renderOrder=-1;scene.add(water);
    const panel=document.createElement('div');panel.id='navalControls';panel.innerHTML=`<div id="navalStatus" role="status"></div><button id="navalHelm" title="Dümeni al / bırak · I" aria-label="Dümeni al"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="8"/><circle cx="16" cy="16" r="2"/><path d="M16 2v28M2 16h28M6 6l20 20M6 26 26 6"/></svg></button><button id="navalBridge" title="Geçiş köprüsü · E" hidden aria-label="Köprüyü aç"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m6 29 28-18M6 23l28-18M8 24l3 5M14 20l3 5M20 16l3 5M26 12l3 5M32 8l3 5"/></svg><span>Köprüyü aç</span></button><div id="navalSailing" hidden><span>Yön ve hız: sol kontrol / WASD</span><button id="navalBrake">Yavaşla</button></div>`;
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
    const rallyButton=document.createElement('button');rallyButton.id='navalRally';rallyButton.title='Takımını yanına çağır / serbest bırak · T';rallyButton.setAttribute('aria-label','Takımını yanına çağır');rallyButton.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="8" r="3"/><circle cx="6" cy="11" r="2.5"/><circle cx="26" cy="11" r="2.5"/><path d="M11 21v-4a5 5 0 0 1 10 0v4M2 22v-5a4 4 0 0 1 6-3m22 8v-5a4 4 0 0 0-6-3M6 27h7l-3-3m3 3-3 3m16-3h-7l3-3m-3 3 3 3"/></svg><small></small>';panel.append(rallyButton);
    function rally(){if(!options.active())return false;const changed=naval.toggleRally();if(changed)options.toast(naval.rally?'Takımın yanına geliyor. Tekrar bas: serbest bırak.':'Takımın serbest savaş düzenine döndü.');return changed;}
    rallyButton.onclick=rally;
    const ropeButton=document.createElement('button');ropeButton.id='navalRope';ropeButton.hidden=true;ropeButton.title='Halatla karşı gemiye geç · G';ropeButton.setAttribute('aria-label','Halatla karşı gemiye geç');ropeButton.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 3h22M17 3v8m-3 1 3 3 4-3M17 15l-2 8-6 4m6-4 7 5"/><circle cx="22" cy="17" r="2.5"/><path d="m15 20 5-1 3 3"/></svg>';panel.append(ropeButton);
    function swing(){
      if(!options.active()||naval.manual)return false;
      if(naval.swing()){options.clearInput();options.toast('Halatla karşı güverteye geçiyorsun.');return true;}
      options.toast(naval.player().stamina<C.ropeCost?'Halat için 25 kondisyon gerekiyor.':naval.nearRope()?'Halatın ulaşacağı boş bir güverte bekle.':'Direğin yanındaki halata yaklaş.');return false;
    }
    ropeButton.onclick=swing;
    // Eight shared ropes: one draw call, no physics chain or per-frame geometry.
    const ropeViews=naval.ships.flatMap(ship=>[-1,1].map(side=>({ship,side}))),ropeMesh=new T.InstancedMesh(new T.CylinderGeometry(.025,.025,1,6),new T.MeshStandardMaterial({color:0xbfa173,roughness:1}),ropeViews.length);
    ropeMesh.name='Boarding ropes';ropeMesh.frustumCulled=false;ropeMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(ropeMesh);
    const ropeStart=new T.Vector3(),ropeEnd=new T.Vector3(),ropeOtherHand=new T.Vector3(),ropeDirection=new T.Vector3(),ropeDummy=new T.Object3D(),ropeUp=new T.Vector3(0,1,0);
    const ropeLandingMark=new T.Mesh(new T.RingGeometry(.46,.55,24),landingMark.material),ropeLaunchMark=new T.Mesh(new T.RingGeometry(.25,.31,20),landingMark.material);for(const mark of [ropeLandingMark,ropeLaunchMark]){mark.rotation.x=-Math.PI/2;mark.visible=false;scene.add(mark);}
    let ropeTarget=null,ropeCheckAt=-Infinity,ropeNearKey='';
    function updateRopes(time){
      const f=naval.player(),near=naval.nearRope(),active=options.active(),crew=naval.rallyStatus();
      rallyButton.disabled=!crew.total;ui.attr(rallyButton,'aria-pressed',String(crew.active));ui.attr(rallyButton,'aria-label',crew.active?'Takım çağrısını bitir':'Takımını yanına çağır');ui.text(rallyButton.querySelector('small'),crew.active?crew.near+'/'+crew.total:'');
      const nearKey=near?near.ship.id+':'+near.side:'';if(nearKey!==ropeNearKey||time<ropeCheckAt||time>=ropeCheckAt+.1){ropeTarget=active?naval.ropeCandidate():null;ropeCheckAt=time;ropeNearKey=nearKey;}
      const ready=!!near&&!!ropeTarget&&f.action==='idle'&&f.stamina>=C.ropeCost;
      ui.hidden(ropeButton,!active||!near);ui.toggle(ropeButton,'ready',ready);ui.attr(ropeButton,'aria-disabled',String(!ready));
      ropeLandingMark.visible=active&&ready;ropeLaunchMark.visible=active&&!!near;
      if(ready){const end=NavalSimulation.world(naval.ships[ropeTarget.to],ropeTarget.landing.x,ropeTarget.landing.z);ropeLandingMark.position.set(end.x,.085,end.z);}
      if(near)ropeLaunchMark.position.set(near.point.x,.08,near.point.z);
      for(let i=0;i<ropeViews.length;i++){
        const v=ropeViews[i],anchor=naval.ropeAnchor(v.ship,v.side),rest=naval.ropePoint(v.ship,v.side);ropeStart.set(anchor.x,anchor.y,anchor.z);ropeEnd.set(rest.x,2.24,rest.z);
        const actor=naval.combat.fighters.find(o=>o.navJump?.kind==='rope'&&o.navJump.from===v.ship.id&&o.navJump.side===v.side&&!o.navJump.released),m=actor&&options.models?.()[actor.id];
        if(actor){if(m?.bones?.LeftHand&&m?.bones?.RightHand){m.bones.LeftHand.getWorldPosition(ropeEnd);m.bones.RightHand.getWorldPosition(ropeOtherHand);ropeEnd.add(ropeOtherHand).multiplyScalar(.5);}else ropeEnd.set(actor.x,(actor.navHeight||0)+2.24,actor.z);}
        ropeDirection.subVectors(ropeEnd,ropeStart);const length=ropeDirection.length();ropeDummy.position.copy(ropeStart).add(ropeEnd).multiplyScalar(.5);ropeDummy.quaternion.setFromUnitVectors(ropeUp,ropeDirection.normalize());ropeDummy.scale.set(1,length,1);ropeDummy.updateMatrix();ropeMesh.setMatrixAt(i,ropeDummy.matrix);
      }
      ropeMesh.instanceMatrix.needsUpdate=true;
    }
    const javelinButton=document.createElement('button');javelinButton.id='navalJavelin';javelinButton.hidden=true;javelinButton.title='Cirit al · F / Cirit at · Q';javelinButton.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 28 24 7M22 9l2-6 5-1-1 5-6 2M7 21l4 4"/></svg><span>CİRİT AL</span><small></small>';panel.append(javelinButton);
    function javelin(){
      if(!outfitted||!options.active()||naval.manual)return false;
      const held=naval.player().navJavelin,ok=held?naval.throwJavelin():naval.takeJavelin();
      if(ok){options.clearInput();options.toast(held?'Cirit fırlatıldı.':'Cirit hazır · Yakındaki rakibe fırlat.');}
      else if(held)options.toast(naval.player().stamina<C.javelinCost?'Cirit için 18 kondisyon gerekiyor.':'Atış için uygun bir rakip bekle.');
      return ok;
    }
    javelinButton.onclick=javelin;
    const javelinViews=new Map(),heldJavelin=outfit?.javelin.clone(true),flightDirection=new T.Vector3(),up=new T.Vector3(0,1,0);
    if(heldJavelin){heldJavelin.rotation.x=.25;heldJavelin.userData.restRotation=.25;}
    const aimGeometry=new T.BufferGeometry(),aimPositions=new Float32Array(25*3);
    aimGeometry.setAttribute('position',new T.BufferAttribute(aimPositions,3));
    const aimLine=new T.Line(aimGeometry,new T.LineBasicMaterial({color:0xffdf62,transparent:true,opacity:.48,depthWrite:false}));
    aimLine.name='Javelin aim trajectory';aimLine.frustumCulled=false;aimLine.visible=false;scene.add(aimLine);
    function updateJavelins(){
      if(!outfitted)return;
      const f=naval.player(),rack=naval.rack(),target=naval.javelinTarget(),held=f.navJavelin&&f.hp>0,m=options.models?.()[0];
      ui.hidden(javelinButton,(!rack&&!held)||!options.active()||naval.manual||f.hp<=0);
      const aim=held?naval.javelinAim():null;aimLine.visible=!!aim&&options.active()&&!naval.manual;
      if(aimLine.visible){for(let i=0;i<25;i++){const q=naval.javelinPoint(aim,aim.length*i/24);aimPositions.set([q.x,q.y,q.z],i*3);}aimGeometry.attributes.position.needsUpdate=true;}
      const canAct=f.action==='idle'&&f.stunUntil<=naval.combat.time&&!f.navJump;
      javelinButton.disabled=!canAct||(held?(!target||f.stamina<C.javelinCost):!rack?.javelins);
      ui.text(javelinButton.querySelector('span'),held?'CİRİT AT':'CİRİT AL');ui.text(javelinButton.querySelector('small'),held?'18 KON':rack?rack.javelins+' / '+C.javelinStock:'');
      ui.attr(javelinButton,'aria-label',held?'Cirit at':'Silahlıktan cirit al');
      if(m?.weaponAnchor){if(heldJavelin.parent!==m.weaponAnchor)m.weaponAnchor.add(heldJavelin);for(const child of m.weaponAnchor.children)child.visible=child===heldJavelin?held:!held;}
      const live=new Set(naval.javelins.map(n=>n.id));
      for(const [id,mesh] of javelinViews)if(!live.has(id)){scene.remove(mesh);javelinViews.delete(id);}
      for(const n of naval.javelins){let mesh=javelinViews.get(n.id);if(!mesh){mesh=outfit.javelin.clone(true);scene.add(mesh);javelinViews.set(n.id,mesh);}mesh.visible=n.launched;mesh.position.set(n.x,n.y,n.z);flightDirection.set(n.dx,.24*Math.PI/C.javelinRange*Math.cos(Math.PI*n.travel/C.javelinRange),n.dz).normalize();mesh.quaternion.setFromUnitVectors(up,flightDirection);}
    }
    const brake=panel.querySelector('#navalBrake');brake.addEventListener('pointerdown',e=>{e.preventDefault();if(!options.active())return;braking=true;brake.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])brake.addEventListener(event,()=>{braking=false;});
    const point=new T.Vector3(),ui=root.GamePerformance,bridgeLabel=bridge.querySelector('span');
    function update(time){
      water.material.uniforms.time.value=time;if(outfit?.wind)outfit.wind.value=time;
      for(const v of views){v.group.position.set(v.ship.x,0,v.ship.z);v.group.rotation.y=v.ship.angle;if(v.rackShafts){v.rackShafts.count=v.rackHeads.count=v.ship.javelins;}
        let gate=0;for(const g of v.gates.value)g.set(0,0,0);
        for(const b of naval.bridges)if((b.to===v.ship.id||b.from===v.ship.id)&&b.phase!=='closed'&&gate<v.gates.value.length){const landing=NavalSimulation.local(v.ship,naval.bridgeEntry(b,v.ship.id));v.gates.value[gate++].set(Math.sign(landing.x),landing.z,1);}
        for(const s of v.sides)s.oars.rotation.z=naval.linked(v.ship)?s.side*.45:Math.sin(time*3.2)*Math.min(.07,Math.abs(v.ship.speed)*.035);}
      for(const v of bridgeViews){const b=naval.bridges.find(b=>b.from===v.ship.id&&b.side===v.side&&(b.station||0)===v.station&&b.phase!=='closed');const open=b?.progress||0;v.pivot.visible=!!b;v.pivot.scale.x=(b?.length||C.bridgeLength)/C.bridgeLength;v.pivot.rotation.y=-v.side*(1-open)*Math.PI/2;}
      for(let i=0;i<naval.ships.length;i++){const s=naval.ships[i];waterShips.value[i].set(s.x,s.z,s.angle,s.speed);}
      // At a distance the uniform's small fittings occupy less than a few pixels.
      for(const f of naval.combat.fighters){const m=options.models?.()[f.id];if(!m||!f.navalUniform)continue;const near=Math.hypot(f.x-camera.position.x,f.z-camera.position.z)<18;
        for(const key of ['shoulder','otherShoulder','collar','Leftgreave','Rightgreave']){const slot=m.gear[key];if(slot?.group.userData.navalUniform)slot.group.visible=near&&(key!=='collar'||m.shoulderModel==='armor_shoulder');}
      }
      const p=naval.player(),active=options.active();ui.hidden(panel,!active||p.hp<=0);
      // A cached V98 page can finish with its old simulation and animation code.
      const target=active&&options.jumpEnabled&&p.hp>0?naval.jumpCandidate?.():null;
      ui.hidden(jumpButton,!target);landingMark.visible=!!target&&active;
      if(target)landingMark.position.set(target.end.x,.075,target.end.z);
      ui.toggle(document.body,'naval-helm',naval.manual&&active);
      helm.disabled=!naval.manual&&!naval.canTakeHelm();ui.attr(helm,'aria-pressed',String(naval.manual));ui.attr(helm,'title',(naval.manual?'Dümeni bırak':'Dümeni al')+' · I');ui.attr(helm,'aria-label',naval.manual?'Dümeni bırak':'Dümeni al');
      ui.hidden(sailing,!naval.manual);
      const captain=naval.combat.fighters[naval.ships[0].helm];
      const message=naval.manual?(naval.linked(naval.ships[0])?(naval.bridges.some(b=>(b.from===0||b.to===0)&&b.phase==='closing')?'Köprü toplanıyor':'Geçiş sürüyor · gemi sabit'):'DÜMEN SENDE'):captain?'Dümen: '+captain.name:'Dümen boş';
      ui.text(status,message);
      const action=naval.interaction();ui.hidden(bridge,!action||!active);
      if(action){const ship=naval.ships[p.shipId],q=action.point||NavalSimulation.world(ship,action.side*(C.halfWidth-.2),action.station||0);point.set(q.x,1.25,q.z).project(camera);bridge.hidden=point.z<0||point.z>1;const w=innerWidth,h=innerHeight;bridge.style.left=Math.max(45,Math.min(w-45,(point.x*.5+.5)*w))+'px';bridge.style.top=Math.max(90,Math.min(h-215,(-point.y*.5+.5)*h))+'px';const label=action.kind==='open'?'Köprüyü aç':'Köprüyü topla';ui.text(bridgeLabel,label);ui.attr(bridge,'aria-label',label);ui.toggle(bridge,'occupied',!!action.blocked);ui.attr(bridge,'aria-disabled',String(!!action.blocked));}
      updateJavelins();updateRopes(time);
      if(!active)braking=false;
    }
    return{update,views,water,panel,jump,rally,swing,javelin,javelinViews,heldJavelin,aimLine,bridgeViews,landingMark,ropeMesh,ropeLandingMark,ropeLaunchMark,get braking(){return braking;}};
  }
  root.NavalView={create,load,assetURL};
})(window);
