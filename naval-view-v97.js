/* Original Roman-inspired open-deck galley. Shared geometry; existing project wood texture. */
(function(root){
  'use strict';
  const T=root.THREE,C=root.NavalSimulation.constants;
  const palette=[0x315d94,0x8a2635,0x416a4f,0x704d83];
  function template(){
    const woodMap=new T.TextureLoader().load('assets/textures/wooden_gate-diff-67741a5af1f9.webp');
    woodMap.colorSpace=T.SRGBColorSpace;woodMap.wrapS=woodMap.wrapT=T.RepeatWrapping;woodMap.repeat.set(2,2);
    const materials={wood:new T.MeshStandardMaterial({map:woodMap,color:0x9c7950,roughness:.9}),dark:new T.MeshStandardMaterial({map:woodMap,color:0x473326,roughness:.95}),bronze:new T.MeshStandardMaterial({color:0x9a773e,roughness:.55,metalness:.65}),paint:new T.MeshStandardMaterial({color:0xffffff,roughness:.8})};
    const buckets={wood:[],dark:[],bronze:[],paint:[]};
    function add(g,type,x=0,y=0,z=0,rx=0,ry=0,rz=0){const m=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1));g.applyMatrix4(m);if(g.index)g=g.toNonIndexed();buckets[type].push(g);}
    function box(w,h,d,type,x,y,z,rx=0,ry=0,rz=0){add(new T.BoxGeometry(w,h,d),type,x,y,z,rx,ry,rz);}
    function beam(a,b,r,type){const av=new T.Vector3(...a),bv=new T.Vector3(...b),m=new T.Matrix4().compose(av.clone().add(bv).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),bv.clone().sub(av).normalize()),new T.Vector3(1,1,1));const g=new T.CylinderGeometry(r,r,av.distanceTo(bv),6).applyMatrix4(m);buckets[type].push(g.toNonIndexed());}
    const stations=[[-7.2,.08],[-6.5,.95],[-5.5,2.35],[-4.5,2.6],[4.5,2.6],[5.5,2.25],[6.7,.9],[7.5,.05]],vertices=[],uvs=[];
    function tri(a,b,c){vertices.push(...a,...b,...c);for(const p of [a,b,c])uvs.push(p[2]/6,p[1]+1.5);}
    for(let i=0;i<stations.length-1;i++)for(const side of [-1,1]){
      const [z0,w0]=stations[i],[z1,w1]=stations[i+1];
      for(let j=0;j<3;j++){const layers=[[1,-.08],[.93,-.7],[.65,-1.25],[.18,-1.6]],a=layers[j],b=layers[j+1];
        const p=[side*w0*a[0],a[1],z0],q=[side*w1*a[0],a[1],z1],r=[side*w1*b[0],b[1],z1],s=[side*w0*b[0],b[1],z0];
        if(side>0){tri(p,r,q);tri(p,s,r);}else{tri(p,q,r);tri(p,r,s);}
      }
      const a=[-w0,-.08,z0],b=[w0,-.08,z0],c=[w1,-.08,z1],d=[-w1,-.08,z1];if(side===1){tri(a,c,b);tri(a,d,c);}
      beam([side*w0,.18,z0],[side*w1,.18,z1],.075,'bronze');
      beam([side*w0*.93,-.7,z0],[side*w1*.93,-.7,z1],.07,'dark');
      beam([side*w0*.99,-.22,z0],[side*w1*.99,-.22,z1],.12,'paint');
    }
    const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(vertices,3));hull.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));hull.computeVertexNormals();buckets.wood.push(hull);
    // Deck planks, interrupted side rails at both boarding stations.
    for(let x=-2.45;x<2.5;x+=.31)box(.018,.018,10.9,'dark',x,-.025,0);
    for(const side of [-1,1])for(const z of [-4.7,-3.4,-2.1,2.1,3.4,4.7]){
      box(.1,.65,.1,'dark',side*2.56,.28,z);
      if(z!==-2.1&&z!==4.7)beam([side*2.56,.6,z],[side*2.56,.6,z+1.3],.06,'wood');
      if(Math.abs(z)>3){add(new T.CylinderGeometry(.43,.43,.08,14),'paint',side*2.68,.34,z,0,0,Math.PI/2);add(new T.SphereGeometry(.14,8,6),'bronze',side*2.75,.34,z);}
    }
    box(5.15,.12,.18,'dark',0,.01,-5.2);box(5.15,.12,.18,'dark',0,.01,5.2);
    beam([0,-.7,6.4],[0,-.65,8.6],.18,'bronze');
    beam([0,.1,-6.7],[0,1.5,-7.6],.13,'dark');beam([0,1.5,-7.6],[0,1.9,-7.1],.11,'bronze');
    // Steering tiller, with a clear standing area for the helmsman.
    beam([.8,.12,-4.7],[.8,.85,-4.7],.09,'dark');beam([.8,.85,-4.7],[0,.85,-3.6],.09,'wood');
    beam([1.75,.1,-4.8],[1.75,3.3,-4.8],.055,'dark');add(new T.SphereGeometry(.15,8,6),'bronze',1.75,3.35,-4.8);
    box(.85,1.1,.045,'paint',1.3,2.48,-4.8);box(.82,.035,.065,'bronze',1.3,1.93,-4.8);
    const group=new T.Group();group.name='Roman galley — original V97';
    for(const [type,geometries] of Object.entries(buckets)){
      if(!geometries.length)continue;
      const geometry=root.ArenaGeometryUtils.mergeGeometries(geometries,false),m=new T.Mesh(geometry,materials[type]);
      m.name=type;m.castShadow=type!=='bronze';m.receiveShadow=true;group.add(m);geometries.forEach(g=>g.dispose());
    }
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
        const oars=new T.Group();group.add(oars);
        for(const z of [-4.4,-3.1,-1.8,1.8,3.1,4.4]){
          const oar=new T.Mesh(new T.BoxGeometry(2.2,.07,.09),materials.dark);oar.position.set(side*3.1,-.15,z);oar.rotation.z=-side*.3;oars.add(oar);
          const blade=new T.Mesh(new T.BoxGeometry(.75,.07,.3),materials.wood);blade.position.set(side*4.1,-.45,z);blade.rotation.z=-side*.3;oars.add(blade);
        }
        // Batch each bank of oars into two meshes, keeping its rowing transform cheap.
        for(const material of [materials.dark,materials.wood]){const parts=oars.children.filter(m=>m.material===material),gs=parts.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix).toNonIndexed();});const geometry=root.ArenaGeometryUtils.mergeGeometries(gs,false),mesh=new T.Mesh(geometry,material);parts.forEach(m=>{oars.remove(m);m.geometry.dispose();});gs.forEach(g=>g.dispose());oars.add(mesh);}
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
    const helm=panel.querySelector('#navalHelm'),bridge=panel.querySelector('#navalBridge'),status=panel.querySelector('#navalStatus'),sailing=panel.querySelector('#navalSailing');let braking=false;
    helm.onclick=()=>{if(!options.active())return;const changed=naval.manual?naval.releaseHelm():naval.takeHelm();if(changed){options.clearInput();options.toast(naval.manual?'Dümen sende.':naval.ships[0].helm!==null?'Takım arkadaşın dümeni devraldı.':'Dümeni alabilecek takım arkadaşın kalmadı.');}};
    bridge.onclick=()=>{if(!options.active())return;const interaction=naval.interaction();if(interaction?.blocked){options.toast('Köprüde bir gladyatör var.');return;}if(naval.operate())options.toast(interaction.kind==='open'?'Geçiş köprüsü açılıyor.':'Geçiş köprüsü toplanıyor.');};
    const brake=panel.querySelector('#navalBrake');brake.addEventListener('pointerdown',e=>{e.preventDefault();if(!options.active())return;braking=true;brake.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])brake.addEventListener(event,()=>{braking=false;});
    const point=new T.Vector3(),ui=root.GamePerformance,helmLabel=helm.querySelector('span'),bridgeLabel=bridge.querySelector('span');
    function update(time){
      water.material.uniforms.time.value=time;
      for(const v of views){v.group.position.set(v.ship.x,0,v.ship.z);v.group.rotation.y=v.ship.angle;for(const s of v.sides)s.oars.rotation.z=naval.linked(v.ship)?s.side*.45:Math.sin(time*3.2)*Math.min(.07,Math.abs(v.ship.speed)*.035);}
      for(const v of bridgeViews){const b=naval.bridges.find(b=>b.from===v.ship.id&&b.side===v.side&&b.phase!=='closed');const open=b?.progress||0;v.pivot.rotation.y=-v.side*(1-open)*Math.PI/2;}
      for(const v of wakes){const p=NavalSimulation.world(v.ship,0,-5.7);v.m.position.x=p.x;v.m.position.z=p.z;v.m.rotation.z=-v.ship.angle;v.m.material.opacity=Math.min(.22,Math.abs(v.ship.speed)*.08);}
      const p=naval.player(),active=options.active();ui.hidden(panel,!active||p.hp<=0);
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
    return{update,views,water,panel,get braking(){return braking;}};
  }
  root.NavalView={create};
})(window);
