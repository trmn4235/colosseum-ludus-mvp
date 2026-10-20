/* Standalone, read-only architectural preview. No game state or auth requests. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('stadium'), pointers = new Map();
  const buttons = [...document.querySelectorAll('[data-view]')];
  let renderer, scene, camera, model, skyResources=[], ready = false, lost = false, frame = 0, view = 'overview', orbit, look, pinch = 0;
  const presets = {
    overview: { label: 'Hipodromun tamamı' },
    loge: { label: 'İmparator locası · Pulvinar', eye: [45.5, 15.8, -72], target: [-9, 7, 62] },
    track: { label: 'Kum pist · Spina boyunca', eye: [-28, 2.8, 162], target: [2, 8, -110] },
    gates: { label: 'On iki başlangıç kapısı · Carceres', eye: [19, 10, -205], target: [0, 7, -249] }
  };
  function status(text) { $('loadText').textContent = text; }
  function fail(message) { ready = false; $('loading').hidden = false; $('retry').hidden = false; $('loadBack').hidden = false; status(message); }
  $('retry').onclick = () => location.reload();
  $('help').onclick = () => $('info').showModal();
  $('info').querySelector('.close').onclick = $('info').querySelector('.continue').onclick = () => $('info').close();
  if (!matchMedia('(pointer:coarse)').matches) $('hint').innerHTML = 'Bakmak için sürükle <b>·</b> Yakınlaşmak için fare tekerleğini kullan';
  function render() {
    frame = 0;
    if (!renderer || lost || document.hidden) return;
    renderer.render(scene, camera);
  }
  function invalidate() { if (!frame && !lost) frame = requestAnimationFrame(render); }
  function placeCamera() {
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
    const T = THREE, target = new T.Vector3(24, 7, 6);
    const dir = (camera.aspect < .85 ? new T.Vector3(0, .95, .25) : new T.Vector3(-.78, .64, .53)).normalize();
    // Fit the actual stadium bounds to both portrait and landscape, including UI margins.
    const right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), dir).normalize(), up = new T.Vector3().crossVectors(dir, right);
    const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
    let distance = 0;
    for (const x of [-85, 182]) for (const y of [0, 51]) for (const z of [-265, 313]) {
      const p = new T.Vector3(x, y, z).sub(target), d = p.dot(dir);
      distance = Math.max(distance, Math.abs(p.dot(right)) / tanH + d, Math.abs(p.dot(up)) / tanV + d);
    }
    orbit = { target, distance: distance * 1.13, azimuth: Math.atan2(dir.x, dir.z), elevation: Math.asin(dir.y) };
  }
  function setView(name) {
    if (!ready || !presets[name]) return;
    view = name; camera.fov = name === 'overview' ? 43 : 62;
    // A metre-scale near plane keeps distant, close-together ground surfaces stable.
    camera.near = name === 'overview' ? 3 : .2; camera.updateProjectionMatrix();
    if (view === 'overview') overview();
    else {
      const p = presets[view], d = new THREE.Vector3(...p.target).sub(new THREE.Vector3(...p.eye)).normalize();
      camera.position.set(...p.eye); look = { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y) };
    }
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    $('viewName').textContent = presets[view].label; placeCamera();
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
    else if (e.key === '+' || e.key === '=') zoom(.85); else if (e.key === '-') zoom(1.18);
  });
  function resize() {
    if (!renderer) return;
    renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (ready && view === 'overview') overview(); if (ready) placeCamera();
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pointers.clear(); pinch = 0; } else invalidate(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; fail('3D görüntü durakladı. Yeniden deneyebilirsin.'); });
  canvas.addEventListener('webglcontextrestored', () => {
    // Let Three restore its GPU state first, then rebuild the sky render targets.
    requestAnimationFrame(()=>{lost=false;if(model){atmosphere(THREE);ready=true;renderer.shadowMap.needsUpdate=true;render();$('loading').hidden=true;}});
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
      uniforms:{sunDirection:{value:new T.Vector3(-210,310,-170).normalize()}},
      vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`
        precision highp float;varying vec3 skyDirection;uniform vec3 sunDirection;
        float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),f.x),f.y);}
        float fbm(vec2 p){float f=0.0,a=.5;for(int i=0;i<5;i++){f+=a*noise21(p);p=mat2(.8,-.6,.6,.8)*p*2.07;a*=.5;}return f;}
        void main(){
          vec3 d=normalize(skyDirection);float y=max(d.y,0.0);
          vec3 color=mix(vec3(.69,.76,.77),vec3(.14,.33,.56),pow(y,.43));
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
      const locations=model.treePlacements.filter((p,i)=>templates.every(Boolean)?i%3===(kind===0?0:1)||(kind===1&&i%3===2):true);
      root.traverse(o=>{
        if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(normalize),m=o.material.clone();
        m.roughness=1;m.metalness=0;m.envMapIntensity=.35;
        if(m.alphaTest||m.transparent){m.alphaTest=.42;m.transparent=false;m.side=T.DoubleSide;}
        const mesh=new T.InstancedMesh(geometry,m,locations.length);mesh.name='Mediterranean trees';mesh.castShadow=true;mesh.receiveShadow=true;
        locations.forEach((p,i)=>{d.position.set(p.x,-.28,p.z);d.rotation.set(0,p.angle,0);d.scale.setScalar(p.height);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);const tint=.78+(i%7)*.035;mesh.setColorAt(i,new T.Color().setRGB(tint,tint,tint));});
        mesh.computeBoundingSphere();model.group.add(mesh);
      });
    });
  }
  async function boot() {
    if (!window.THREE || !window.createCircusMaximus) throw Error('Sahne dosyaları yüklenemedi. Yeniden dene.');
    const T = THREE;
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.5 : 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    scene = new T.Scene(); scene.background = new T.Color(0xd3dedb); scene.fog = new T.Fog(0xd0d9d9, 1400, 2800);
    camera = new T.PerspectiveCamera(43, innerWidth / innerHeight, .3, 4000);
    scene.add(new T.HemisphereLight(0xd9e6ee, 0xa6987a, .65));
    const sun = new T.DirectionalLight(0xffefd8, 2.65); sun.position.set(-210, 310, -170); sun.target.position.set(0,0,0);
    sun.castShadow = true;const shadowSize=matchMedia('(pointer:coarse)').matches?2048:4096;sun.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(sun.shadow.camera, { left: -360, right: 360, top: 370, bottom: -370, near: 10, far: 950 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = .12; sun.shadow.bias = -.00008; scene.add(sun, sun.target);
    resize();atmosphere(T);status('Kum, taş ve kiremit yüzeyleri hazırlanıyor…');
    const files={
      stone:['textures/white_sandstone_blocks_02-diff-291a56b4ab78.webp',true],
      stoneNormal:['textures/white_sandstone_blocks_02-nor_gl-ca837027cc37.webp',false],
      stoneRough:['textures/white_sandstone_blocks_02-rough-4b0a136337d7.webp',false],
      plaster:['textures/white_plaster_02-diff-6aa57de97b10.webp',true],
      plasterNormal:['textures/white_plaster_02-nor_gl-dcd2b93a4cbb.webp',false],
      plasterRough:['textures/white_plaster_02-rough-1e05c5521169.webp',false],
      wood:['textures/wooden_gate-diff-67741a5af1f9.webp',true],
      woodNormal:['textures/wooden_gate-nor_gl-9c9095cd8a7d.webp',false],
      woodRough:['textures/wooden_gate-rough-f62304f04b81.webp',false],
      spectators:['circus-v142/spectators.webp',true],
      sand:['circus-v142/sand-diff.webp',true],sandNormal:['circus-v142/sand-nor_gl.webp',false],sandRough:['circus-v142/sand-rough.webp',false],
      roof:['circus-v142/roof-diff.webp',true],roofNormal:['circus-v142/roof-nor_gl.webp',false],roofRough:['circus-v142/roof-rough.webp',false]
    };
    const [maps,trees]=await Promise.all([
      Promise.all(Object.entries(files).map(async([name,args])=>[name,await texture(...args)])),
      Promise.all([treeModel('oak-a'),treeModel('pine')])
    ]);
    const textures=Object.fromEntries(maps);
    if(textures.spectators){textures.spectators.wrapS=textures.spectators.wrapT=T.ClampToEdgeWrapping;}
    status('Tribünler ve anıtlar yerleştiriliyor…');
    await new Promise(resolve => requestAnimationFrame(resolve));
    model = createCircusMaximus(T, { textures,trees:trees.some(Boolean) });scene.add(model.group);
    Object.values(model.materials).forEach(m=>m.envMapIntensity=.35);plantTrees(T,trees);
    ready = true; setView('overview'); renderer.shadowMap.needsUpdate = true;
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    // Keep one opaque fullscreen loader until the first complete scene has been drawn.
    render(); $('loading').hidden = true;
    for (const b of [...buttons, $('crowd'), $('zoomIn'), $('zoomOut')]) b.disabled = false;
    if(maps.some(([,value])=>!value))$('hint').textContent='Bazı dokular yüklenemedi. Sahneyi keşfedebilir veya sayfayı yenileyebilirsin.';
    window.CircusPreview = {
      renderer, scene, camera, model, setView, render,
      get ready() { return ready; }, get view() { return view; }, get activePointers() { return pointers.size; },
      get stats() { return { ...renderer.info.render, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, spectators: model.metadata.spectators }; }
    };
  }
  boot().catch(error => { console.error('Circus Maximus:', error); fail(error.message || 'Hipodrom açılamadı. Yeniden dene.'); });
})();
