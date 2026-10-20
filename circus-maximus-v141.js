/* Standalone, read-only architectural preview. No game state or auth requests. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('stadium'), pointers = new Map();
  const buttons = [...document.querySelectorAll('[data-view]')];
  let renderer, scene, camera, model, ready = false, lost = false, frame = 0, view = 'overview', orbit, look, pinch = 0;
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
  canvas.addEventListener('webglcontextrestored', () => { lost = false; if (model) { ready = true; renderer.shadowMap.needsUpdate = true; render(); $('loading').hidden = true; } });
  async function texture(file, color = true) {
    return new Promise(resolve => {
      let done = false;
      const timer = setTimeout(() => { done = true; resolve(null); }, 15000);
      new THREE.TextureLoader().load('assets/textures/' + file, t => {
        if (done) { t.dispose(); return; } clearTimeout(timer); t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); if (color) t.colorSpace = THREE.SRGBColorSpace; resolve(t);
      }, undefined, () => { clearTimeout(timer); done = true; resolve(null); });
    });
  }
  function roofTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#dbd5ca'; ctx.fillRect(0,0,256,256);
    for(let x=0;x<256;x+=32){
      const g=ctx.createLinearGradient(x,0,x+32,0);g.addColorStop(0,'#847d71');g.addColorStop(.3,'#e8e2d6');g.addColorStop(.65,'#d7cfc0');g.addColorStop(1,'#aea595');
      ctx.fillStyle=g;ctx.fillRect(x,0,32,256);
      for(let y=0;y<256;y+=64){ctx.fillStyle='#756e6250';ctx.fillRect(x,y,32,2);ctx.fillStyle='#f6f1e570';ctx.fillRect(x,y+2,32,1);}
    }
    const t = new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
  }
  async function boot() {
    if (!window.THREE || !window.createCircusMaximus) throw Error('Sahne dosyaları yüklenemedi. Yeniden dene.');
    const T = THREE;
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.5 : 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    scene = new T.Scene(); scene.background = new T.Color(0xd3dedb); scene.fog = new T.Fog(0xd3dedb, 1400, 3000);
    camera = new T.PerspectiveCamera(43, innerWidth / innerHeight, .3, 4000);
    scene.add(new T.HemisphereLight(0xd9e6ee, 0x9e8c68, 1.55));
    const sun = new T.DirectionalLight(0xffe9c6, 2.8); sun.position.set(-210, 310, -170); sun.target.position.set(0,0,0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -360, right: 360, top: 370, bottom: -370, near: 10, far: 950 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = .24; sun.shadow.bias = -.00018; scene.add(sun, sun.target);
    resize(); status('Taş ve kum dokuları hazırlanıyor…');
    const [stone, sand, sandNormal] = await Promise.all([
      texture('white_sandstone_blocks_02-diff-291a56b4ab78.webp'),
      texture('sand_01-diff-8aecb3769d72.webp'), texture('sand_01-nor_gl-6616ebcba18d.webp', false)
    ]);
    status('Tribünler ve anıtlar yerleştiriliyor…');
    await new Promise(resolve => requestAnimationFrame(resolve));
    model = createCircusMaximus(T, { textures: { stone, sand, sandNormal, roof: roofTexture() } }); scene.add(model.group);
    ready = true; setView('overview'); renderer.shadowMap.needsUpdate = true;
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    // Keep one opaque fullscreen loader until the first complete scene has been drawn.
    render(); $('loading').hidden = true;
    for (const b of [...buttons, $('crowd'), $('zoomIn'), $('zoomOut')]) b.disabled = false;
    if (!stone || !sand) $('hint').textContent = 'Bazı dokular yüklenemedi. Sahneyi keşfedebilir veya sayfayı yenileyebilirsin.';
    window.CircusPreview = {
      renderer, scene, camera, model, setView, render,
      get ready() { return ready; }, get view() { return view; }, get activePointers() { return pointers.size; },
      get stats() { return { ...renderer.info.render, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, spectators: model.metadata.spectators }; }
    };
  }
  boot().catch(error => { console.error('Circus Maximus:', error); fail(error.message || 'Hipodrom açılamadı. Yeniden dene.'); });
})();
