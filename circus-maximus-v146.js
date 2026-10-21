/* Standalone, read-only architectural preview. No game state or auth requests. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('stadium'), pointers = new Map();
  const buttons = [...document.querySelectorAll('[data-view]')];
  let race=null,racePromise=null,lastRaceTime=0;
  let renderer,scene,camera,model,sun,skyResources=[],ready=false,lost=false,frame=0,view='overview',orbit,look,pinch=0;
  const presets = {
    overview: { label: 'Hipodromun tamamı' },
    loge: { label: 'İmparator locası · Pulvinar', eye: [59, 15.6, -83], target: [-9, 7, 49] },
    track: { label: 'Kum pist · Spina boyunca', eye: [-28, 2.8, 162], target: [2, 8, -110] },
    gates: { label: 'Carceres · Sütunlu yarım daire', eye: [17,10,-198], target: [0,12.5,-278] }
  };
  function status(text) { $('loadText').textContent = text; }
  function fail(message) { ready = false; $('loading').hidden = false; $('retry').hidden = false; $('loadBack').hidden = false; status(message); }
  $('retry').onclick = () => location.reload();
  $('help').onclick = () => $('info').showModal();
  $('info').querySelector('.close').onclick = $('info').querySelector('.continue').onclick = () => $('info').close();
  function cinema(){const hidden=document.body.classList.toggle('cinema');$('cinema').setAttribute('aria-pressed',String(hidden));$('cinema').setAttribute('aria-label',hidden?'Arayüzü göster':'Arayüzü gizle');$('cinema').title=hidden?'Arayüzü göster (H)':'Arayüzü gizle (H)';}
  $('cinema').onclick=cinema;
  if (!matchMedia('(pointer:coarse)').matches) $('hint').innerHTML = 'Bakmak için sürükle <b>·</b> Yakınlaşmak için fare tekerleğini kullan';
  function render(now=performance.now()) {
    frame = 0;
    if (!renderer || lost || document.hidden) return;
    if(race?.active){const dt=lastRaceTime?Math.min((now-lastRaceTime)/1000,.05):0;lastRaceTime=now;race.update(dt);race.follow(camera);renderer.shadowMap.needsUpdate=true;raceUI();}
    // Cache the stadium shadow without freezing a moving team into it.
    if(race?.active&&sun.shadow.needsUpdate){race.root.visible=false;renderer.render(scene,camera);race.root.visible=true;}
    renderer.render(scene, camera);
    if(race?.active&&!race.paused&&!race.done)invalidate();
  }
  function invalidate() { if (!frame && !lost) frame = requestAnimationFrame(render); }
  function placeCamera() {
    if(race?.active){race.follow(camera);invalidate();return;}
    if (view === 'overview') {
      const c = Math.cos(orbit.elevation);
      camera.position.set(orbit.target.x + Math.sin(orbit.azimuth) * orbit.distance * c,
        orbit.target.y + Math.sin(orbit.elevation) * orbit.distance,
        orbit.target.z + Math.cos(orbit.azimuth) * orbit.distance * c);
      camera.lookAt(orbit.target);
    } else {
      const c = Math.cos(look.pitch);
      camera.lookAt(camera.position.x + Math.sin(look.yaw) * c, camera.position.y + Math.sin(look.pitch), camera.position.z + Math.cos(look.yaw) * c);
    }
    invalidate();
  }
  function overview() {
    const T = THREE, target = new T.Vector3(24,7,-10);
    const dir = (camera.aspect < .85 ? new T.Vector3(0, .95, .25) : new T.Vector3(-.78, .64, .53)).normalize();
    // Fit the actual stadium bounds to both portrait and landscape, including UI margins.
    const right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), dir).normalize(), up = new T.Vector3().crossVectors(dir, right);
    const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
    let distance = 0;
    for (const x of [-85,182]) for (const y of [0,51]) for (const z of [-325,313]) {
      const p = new T.Vector3(x, y, z).sub(target), d = p.dot(dir);
      distance = Math.max(distance, Math.abs(p.dot(right)) / tanH + d, Math.abs(p.dot(up)) / tanV + d);
    }
    orbit = { target, distance: distance * 1.13, azimuth: Math.atan2(dir.x, dir.z), elevation: Math.asin(dir.y) };
  }
  function setView(name) {
    if(name==='race'){startRace();return;}
    if (!ready || !presets[name]) return;
    if(race?.active){race.active=false;sun.intensity=2.8;lastRaceTime=0;document.body.classList.remove('racing');$('racePanel').hidden=true;}
    view=name;camera.fov=name==='overview'?43:56;
    // A metre-scale near plane keeps distant, close-together ground surfaces stable.
    camera.near = name === 'overview' ? 3 : .2; camera.updateProjectionMatrix();
    if (view === 'overview') overview();
    else {
      const p = presets[view], d = new THREE.Vector3(...p.target).sub(new THREE.Vector3(...p.eye)).normalize();
      camera.position.set(...p.eye); look = { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y) };
    }
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    scene.fog.near=view==='overview'?1400:250;scene.fog.far=view==='overview'?2800:1450;
    focusShadows();$('viewName').textContent=presets[view].label;placeCamera();
  }
  function focusShadows(){
    if(!sun)return;
    // Only the gate view narrows the shadow volume. Other views see the entire arena.
    const box=view==='gates'?{x:[-115,115],y:[0,55],z:[-340,-145]}:{x:[-280,280],y:[0,65],z:[-360,420]};
    sun.updateMatrixWorld(true);sun.target.updateMatrixWorld(true);sun.shadow.updateMatrices(sun);
    const c=sun.shadow.camera,p=new THREE.Vector3();let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity,near=Infinity,far=0;
    for(const x of box.x)for(const y of box.y)for(const z of box.z){p.set(x,y,z).applyMatrix4(c.matrixWorldInverse);left=Math.min(left,p.x);right=Math.max(right,p.x);bottom=Math.min(bottom,p.y);top=Math.max(top,p.y);near=Math.min(near,-p.z);far=Math.max(far,-p.z);}
    Object.assign(c,{left:left-8,right:right+8,bottom:bottom-8,top:top+8,near:Math.max(1,near-30),far:far+30});c.updateProjectionMatrix();sun.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
  }
  buttons.forEach(b => b.onclick = () => setView(b.dataset.view));
  function zoom(factor) {
    if (!ready) return;
    if (view === 'overview') orbit.distance = THREE.MathUtils.clamp(orbit.distance * factor, 125, 2400);
    else { camera.fov = THREE.MathUtils.clamp(camera.fov * factor, 28, 88); camera.updateProjectionMatrix(); }
    placeCamera();
  }
  $('zoomIn').onclick = () => zoom(.85); $('zoomOut').onclick = () => zoom(1.18);
  $('crowd').onclick = () => { if (!ready) return; model.crowd.visible = !model.crowd.visible; $('crowd').setAttribute('aria-pressed', String(model.crowd.visible)); invalidate(); };
  function pan(dx, dy) {
    if (view === 'overview') { orbit.azimuth -= dx * .005; orbit.elevation = THREE.MathUtils.clamp(orbit.elevation + dy * .004, .16, 1.49); }
    else { look.yaw -= dx * .004; look.pitch = THREE.MathUtils.clamp(look.pitch + dy * .0035, -1.15, 1.25); }
    placeCamera();
  }
  canvas.addEventListener('pointerdown', e => {
    if (!ready) return; canvas.focus({ preventScroll: true }); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x-b.x, a.y-b.y); }
  });
  canvas.addEventListener('pointermove', e => {
    const old = pointers.get(e.pointerId); if (!old || !ready) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) pan(e.clientX - old.x, e.clientY - old.y);
    else if (pointers.size === 2) { const [a, b] = [...pointers.values()], distance = Math.hypot(a.x-b.x, a.y-b.y); if (distance > 4 && pinch > 4) zoom(pinch / distance); pinch = distance; }
  });
  function release(e) { pointers.delete(e.pointerId); pinch = 0; }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, release);
  window.addEventListener('blur', () => { pointers.clear(); pinch = 0; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(e.deltaY * .001)); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (!ready || $('info').open || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const directions = { ArrowLeft: [-18, 0], ArrowRight: [18, 0], ArrowUp: [0, -18], ArrowDown: [0, 18] };
    if (directions[e.key]) { e.preventDefault(); pan(...directions[e.key]); }
    else if (/^[1-4]$/.test(e.key)) setView(Object.keys(presets)[Number(e.key)-1]);
    else if(e.key.toLowerCase()==='h')cinema();
    else if (e.key === '+' || e.key === '=') zoom(.85); else if (e.key === '-') zoom(1.18);
  });
  function resize() {
    if (!renderer) return;
    renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (ready && view === 'overview') overview(); if (ready) placeCamera();
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { lastRaceTime=0; if (document.hidden) { pointers.clear(); pinch = 0; } else invalidate(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; fail('3D görüntü durakladı. Yeniden deneyebilirsin.'); });
  canvas.addEventListener('webglcontextrestored', () => {
    // Let Three restore its GPU state first, then rebuild the sky render targets.
    requestAnimationFrame(()=>{lost=false;lastRaceTime=0;if(sun)sun.shadow.needsUpdate=true;if(model){atmosphere(THREE);ready=true;renderer.shadowMap.needsUpdate=true;render();$('loading').hidden=true;}});
  });
  async function texture(file, color = true) {
    return new Promise(resolve => {
      let done = false;
      const timer = setTimeout(() => { done = true; resolve(null); }, 15000);
      new THREE.TextureLoader().load('assets/' + file, t => {
        if (done) { t.dispose(); return; } clearTimeout(timer); t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); if (color) t.colorSpace = THREE.SRGBColorSpace; resolve(t);
      }, undefined, () => { clearTimeout(timer); done = true; resolve(null); });
    });
  }
  function atmosphere(T) {
    // A camera-independent sky cube also supplies filtered diffuse/specular light.
    const skyScene=new T.Scene(),g=new T.SphereGeometry(100,24,12);
    const mat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,toneMapped:false,
      uniforms:{sunDirection:{value:new T.Vector3(-260,235,180).normalize()}},
      vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`
        precision highp float;varying vec3 skyDirection;uniform vec3 sunDirection;
        float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),f.x),f.y);}
        float fbm(vec2 p){float f=0.0,a=.5;for(int i=0;i<5;i++){f+=a*noise21(p);p=mat2(.8,-.6,.6,.8)*p*2.07;a*=.5;}return f;}
        void main(){
          vec3 d=normalize(skyDirection);float y=max(d.y,0.0);
          vec3 color=mix(vec3(.77,.78,.75),vec3(.16,.34,.56),pow(y,.43));
          float sun=max(dot(d,sunDirection),0.0);
          color+=vec3(1.0,.79,.49)*pow(sun,32.0)*.23;
          color+=vec3(5.0,4.5,3.6)*pow(sun,5500.0);
          vec2 p=d.xz/(y+.16)*1.6+vec2(2.3,-.8);
          float n=fbm(p),cloud=smoothstep(.51,.72,n)*smoothstep(.02,.19,y);
          vec3 cloudColor=mix(vec3(.60,.65,.69),vec3(1.15,1.14,1.10),smoothstep(.49,.78,n));
          color=mix(color,cloudColor,cloud*.85);
          color=mix(vec3(.39,.37,.30),color,smoothstep(-.15,.03,d.y));
          gl_FragColor=vec4(color,1.0);
        }`});
    skyScene.add(new T.Mesh(g,mat));
    const cube=new T.WebGLCubeRenderTarget(256,{type:T.HalfFloatType,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});
    new T.CubeCamera(1,150,cube).update(renderer,skyScene);
    const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromCubemap(cube.texture);
    scene.background=cube.texture;scene.environment=environment.texture;
    skyResources.forEach(target=>target.dispose());skyResources=[cube,environment];
    g.dispose();mat.dispose();pmrem.dispose();
  }
  async function sculpture(name){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const r=await fetch('assets/circus-v145/'+name+'.glb',{signal:controller.signal});if(!r.ok)throw Error(name);
      const source=(await new THREE.GLTFLoader().parseAsync(await r.arrayBuffer(),'' )).scene;
      source.updateMatrixWorld(true);let geometry;
      source.traverse(o=>{if(o.isMesh&&!geometry){geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.deleteAttribute('color');if(!geometry.attributes.normal)geometry.computeVertexNormals();}});
      return [name,geometry];
    }catch{return [name,null];}finally{clearTimeout(timer);}
  }
  async function treeModel(file) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch('assets/caravan-field-v125/'+file+'.glb',{signal:controller.signal});
      if(!response.ok)throw Error('tree');
      return (await new THREE.GLTFLoader().parseAsync(await response.arrayBuffer(),'')).scene;
    }catch{return null;}finally{clearTimeout(timer);}
  }
  function plantTrees(T,templates) {
    const d=new T.Object3D();
    templates.forEach((root,kind)=>{
      if(!root)return;
      root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
      const normalize=new T.Matrix4().makeScale(1/size.y,1/size.y,1/size.y).multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
      const locations=model.treePlacements.filter((p,i)=>templates.every(Boolean)?(kind===0?i%6===0:i%6!==0):true);
      root.traverse(o=>{
        if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(normalize),m=o.material.clone();
        m.roughness=1;m.metalness=0;m.envMapIntensity=.35;
        if(m.alphaTest||m.transparent){m.alphaTest=.42;m.transparent=false;m.side=T.DoubleSide;}
        const mesh=new T.InstancedMesh(geometry,m,locations.length);mesh.name='Mediterranean trees';mesh.castShadow=true;mesh.receiveShadow=true;
        locations.forEach((p,i)=>{d.position.set(p.x,p.y??-.28,p.z);d.rotation.set(0,p.angle,0);d.scale.setScalar(p.height);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);const tint=.78+(i%7)*.035;mesh.setColorAt(i,new T.Color().setRGB(tint,tint,tint));});
        mesh.computeBoundingSphere();model.group.add(mesh);
      });
    });
  }
  async function boot() {
    if (!window.THREE || !window.createCircusMaximus) throw Error('Sahne dosyaları yüklenemedi. Yeniden dene.');
    const T = THREE;
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.5 : 1.75));
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    scene = new T.Scene(); scene.background = new T.Color(0xd3dedb); scene.fog = new T.Fog(0xd5d9d5, 1400, 2800);
    camera = new T.PerspectiveCamera(43, innerWidth / innerHeight, .3, 4000);
    scene.add(new T.HemisphereLight(0xd9e6ee,0xb6a891,.42));
    sun=new T.DirectionalLight(0xffebd2,2.8);sun.position.set(-260,235,180);sun.target.position.set(0,0,0);
    sun.castShadow = true;sun.shadow.autoUpdate=false;const shadowSize=matchMedia('(pointer:coarse)').matches?2048:4096;sun.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(sun.shadow.camera, { left: -360, right: 360, top: 370, bottom: -370, near: 10, far: 950 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = .12; sun.shadow.bias = -.00008; scene.add(sun, sun.target);
    resize();atmosphere(T);status('Kum, taş ve kiremit yüzeyleri hazırlanıyor…');
    const files={
      marble:['circus-v143/honed-marble.webp',true],
      stone:['textures/white_sandstone_blocks_02-diff-291a56b4ab78.webp',true],
      stoneNormal:['textures/white_sandstone_blocks_02-nor_gl-ca837027cc37.webp',false],
      stoneRough:['textures/white_sandstone_blocks_02-rough-4b0a136337d7.webp',false],
      plaster:['textures/white_plaster_02-diff-6aa57de97b10.webp',true],
      plasterNormal:['textures/white_plaster_02-nor_gl-dcd2b93a4cbb.webp',false],
      plasterRough:['textures/white_plaster_02-rough-1e05c5521169.webp',false],
      wood:['textures/wooden_gate-diff-67741a5af1f9.webp',true],
      woodNormal:['textures/wooden_gate-nor_gl-9c9095cd8a7d.webp',false],
      woodRough:['textures/wooden_gate-rough-f62304f04b81.webp',false],
      spectators:['circus-v145/spectators-16.webp',true],relief:['circus-v143/stone-reliefs.webp',true],
      sand:['circus-v144/arena-sand.webp',true],sandNormal:['circus-v142/sand-nor_gl.webp',false],sandRough:['circus-v142/sand-rough.webp',false],
      roof:['circus-v142/roof-diff.webp',true],roofNormal:['circus-v142/roof-nor_gl.webp',false],roofRough:['circus-v142/roof-rough.webp',false]
    };
    const [maps,trees,statues]=await Promise.all([
      Promise.all(Object.entries(files).map(async([name,args])=>[name,await texture(...args)])),
      Promise.all([treeModel('oak-a'),treeModel('pine')]),
      Promise.all(['bust','horse','figure'].map(sculpture))
    ]);
    const textures=Object.fromEntries(maps);
    if(textures.spectators){textures.spectators.wrapS=textures.spectators.wrapT=T.ClampToEdgeWrapping;}
    status('Tribünler ve anıtlar yerleştiriliyor…');
    await new Promise(resolve => requestAnimationFrame(resolve));
    model = createCircusMaximus(T, { textures,trees:trees.some(Boolean),sculptures:Object.fromEntries(statues.filter(([,g])=>g)) });
    statues.forEach(([,g])=>g?.dispose());scene.add(model.group);
    Object.values(model.materials).forEach(m=>m.envMapIntensity=m===model.materials.water ? 1.05 : .5);plantTrees(T,trees);
    ready = true; setView('overview'); renderer.shadowMap.needsUpdate = true;
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    // Keep one opaque fullscreen loader until the first complete scene has been drawn.
    render(); $('loading').hidden = true;
    for (const b of [...buttons, $('crowd'), $('zoomIn'), $('zoomOut')]) b.disabled = false;
    if(maps.some(([,value])=>!value)||statues.some(([,g])=>!g)){document.body.classList.add('asset-warning');$('hint').textContent='Bazı dokular yüklenemedi. Sahneyi keşfedebilir veya sayfayı yenileyebilirsin.';}
    window.CircusPreview = {
      renderer, scene, camera, model, setView, render, get race(){return race;}, startRace, exitRace,
      get ready() { return ready; }, get view() { return view; }, get activePointers() { return pointers.size; },
      get stats() { return { ...renderer.info.render, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, spectators: model.metadata.spectators }; }
    };
  }
  function raceUI(){
    if(!race)return;
    $('raceState').textContent=race.countdown>0?String(Math.ceil(race.countdown)):race.winner!==null?`${race.winner?'Mavi':'Bordo'} takım kazandı`:race.paused?'Yarış duraklatıldı':'Biga yarışı';
    $('racePositions').textContent=race.teams.map((t,i)=>`${i?'Mavi':'Bordo'} · ${t.rank}. · Tur ${Math.min(2,Math.floor(Math.max(0,t.distance-100)/race.length)+1)}/2`).join('     ');
    $('racePause').textContent=race.paused?'Devam':'Duraklat';
  }
  async function startRace(){
    if(!ready)return;
    $('raceOpen').disabled=true;$('raceOpen').textContent='Hazırlanıyor…';
    try{
      race=await(racePromise||(racePromise=CircusRace.create(THREE,scene).catch(e=>{racePromise=null;throw e;})));
      race.active=true;sun.intensity=1.8;lastRaceTime=0;document.body.classList.add('racing');$('racePanel').hidden=false;
      camera.fov=53;camera.near=.1;camera.updateProjectionMatrix();view='track';scene.fog.near=250;scene.fog.far=1450;focusShadows();race.follow(camera,true);invalidate();
    }catch(e){$('hint').textContent='Yarış modelleri yüklenemedi. Yarış düğmesiyle yeniden deneyebilirsin.';}
    finally{$('raceOpen').disabled=false;$('raceOpen').textContent='Yarış';}
  }
  function exitRace(){if(race)race.active=false;if(sun)sun.intensity=2.8;lastRaceTime=0;document.body.classList.remove('racing');$('racePanel').hidden=true;setView('overview');}
  $('raceExit').onclick=exitRace;
  $('racePause').onclick=()=>{if(race){race.paused=!race.paused;lastRaceTime=0;invalidate();}};
  $('raceReset').onclick=()=>{race?.reset();lastRaceTime=0;invalidate();};
  $('raceCamera').onclick=()=>{race?.nextCamera();invalidate();};
  for(let i=0;i<2;i++){const select=$('raceCoat'+i);LudusHorseAppearance.coats.forEach(c=>select.add(new Option(c.name,c.id)));select.value=i?'dark_brown':'white';select.onchange=()=>{race?.setCoat(i,select.value);invalidate();};}
  boot().then(()=>{if(new URLSearchParams(location.search).has('race'))startRace();}).catch(error => { console.error('Circus Maximus:', error); fail(error.message || 'Hipodrom açılamadı. Yeniden dene.'); });
})();
