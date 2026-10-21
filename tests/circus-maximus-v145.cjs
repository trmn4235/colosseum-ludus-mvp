const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = process.env.LUDUS_TEST_OUTPUT || '/tmp/circus-maximus-v145';
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
  if (!file.startsWith(root + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' })[path.extname(file)] || 'text/plain');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 932, height: 430 }, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [], requests = [], url = 'http://127.0.0.1:' + server.address().port + '/circus-maximus.html';
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()));
  page.on('console', message => { if(message.type()==='error')errors.push(message.text()); });
  const ready = p => p.waitForFunction(() => window.CircusPreview?.ready, null, { timeout: 90000 });
  const shot = async name => { await page.evaluate(() => CircusPreview.render()); await page.screenshot({ path: out + '/' + name + '.png' }); };
  async function fit() {
    for (const selector of ['.identity', '.tools', '.zoom', '.views']) {
      const b = await page.locator(selector).boundingBox(), v = page.viewportSize();
      assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1, selector + ' fits viewport');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight), false, 'Single screen, no overflow');
    const b = await page.locator('canvas').boundingBox(); assert.deepEqual(b, { x: 0, y: 0, ...page.viewportSize() }, 'Canvas covers the entire viewport');
  }
  try {
    await page.goto(url); await ready(page); await fit(); await shot('overview-932');
    const stats = await page.evaluate(() => CircusPreview.stats);
    assert.ok(stats.calls <= 32 && stats.calls > 5, 'Architecture is batched'); assert.ok(stats.triangles < 720000, 'Mobile triangle budget');
    assert.ok(stats.spectators > 8000 && stats.spectators < 18000); assert.equal(await page.locator('#loading').isVisible(), false);
    assert.equal(await page.evaluate(() => CircusPreview.model.metadata.startingGates), 12);
    assert.equal(await page.evaluate(() => CircusPreview.model.metadata.photoCrowd), true, 'Spectator atlas actually loaded');
    assert.deepEqual(await page.evaluate(()=>CircusPreview.model.metadata.sculptures.sort()),['bust','figure','horse'],'All three optimized 3D sculptures loaded');
    assert.equal(await page.evaluate(()=>CircusPreview.model.crowd.children[0].material.map.image.width),1536,'New sixteen-person atlas loaded');
    assert.equal(await page.evaluate(()=>document.body.classList.contains('asset-warning')),false,'No missing production assets');
    const logeClear=await page.evaluate(()=>{const m=CircusPreview.model,T=THREE,r=new T.Raycaster(new T.Vector3(48,14,-72),new T.Vector3(1,0,0));m.group.updateMatrixWorld(true);return r.intersectObjects(m.group.children,true).filter(h=>h.distance>1&&h.distance<24.9).map(h=>h.object.name);});
    assert.deepEqual(logeClear,[],'No seating rows or spectators intersect the imperial chamber');
    const arcadeDepth=await page.evaluate(()=>{const r=new THREE.Raycaster(new THREE.Vector3(-85,1.5,120),new THREE.Vector3(1,0,0));return r.intersectObjects(CircusPreview.model.group.children,true)[0]?.distance;});
    assert.ok(arcadeDepth>14,'Exterior ground-floor arcade is open at walking height');
    assert.equal(await page.evaluate(() => CircusPreview.model.materials.relief.map?.image?.width),1280,'Stone relief atlas actually loaded');
    assert.equal(await page.evaluate(() => CircusPreview.model.materials.marble.map?.image?.width),1024,'Honed marble texture actually loaded');
    assert.equal(await page.evaluate(() => CircusPreview.model.materials.sand.map?.image?.width),1280,'New arena sand loaded');
    const sandSurface=await page.evaluate(()=>{
      const T=THREE,m=CircusPreview.model,mesh=m.group.children.find(o=>o.material===m.materials.sand),ray=new T.Raycaster();
      m.group.updateMatrixWorld(true);
      const height=(x,z)=>{ray.set(new T.Vector3(x,4,z),new T.Vector3(0,-1,0));return ray.intersectObject(mesh)[0]?.point.y;};
      return {heights:[-35,-20,20,35].map(x=>height(x,120)),join:[height(-30,231.99),height(-30,232.01)]};
    });
    assert.ok(sandSurface.heights.every(Number.isFinite)&&Math.max(...sandSurface.heights)-Math.min(...sandSurface.heights)>.005,'Sand has actual uneven geometry');
    assert.ok(Math.abs(sandSurface.join[0]-sandSurface.join[1])<.025,'Straight and turn join without a visible height gap');
    assert.equal(await page.evaluate(() => Object.values(CircusPreview.model.materials).filter(m=>m.normalMap && m.roughnessMap).length>=5),true,'PBR assets actually loaded');
    const enclosure=await page.evaluate(()=>{
      const {model}=CircusPreview,T=THREE,ray=new T.Raycaster(),wall=model.group.children.find(o=>o.material===model.materials.ashlar),roof=model.group.children.find(o=>o.material===model.materials.roof);
      model.group.updateMatrixWorld(true);const misses=[];
      for(let i=1;i<60;i++){const a=Math.PI*i/60;ray.set(new T.Vector3(0,17,-244),new T.Vector3(Math.cos(a),0,-Math.sin(a)));if(!ray.intersectObject(wall).some(h=>h.distance>73&&h.distance<78))misses.push(i);}
      const joins=[-1,1].map(side=>{ray.set(new T.Vector3(side*70,17,-244),new T.Vector3(side,0,0));return ray.intersectObject(wall).some(h=>h.distance<8);});
      const heights=[[.1,-320],[76,0]].map(([x,z])=>{ray.set(new T.Vector3(x,40,z),new T.Vector3(0,-1,0));return ray.intersectObject(roof)[0]?.point.y;});
      return {misses,joins,heights};
    });
    assert.deepEqual(enclosure.misses,[],'Rear wall is solid across the semicircle');assert.deepEqual(enclosure.joins,[true,true],'Both rear-wall joins are closed');
    assert.ok(enclosure.heights.every(y=>y>28&&y<29)&&Math.abs(enclosure.heights[0]-enclosure.heights[1])<.4,'Rear roof matches the existing stands');
    const camera = () => page.evaluate(() => CircusPreview.camera.position.toArray());
    const before = await camera(); await page.mouse.move(450, 200); await page.mouse.down(); await page.mouse.move(510, 220, { steps: 3 }); await page.mouse.up();
    assert.notDeepEqual(await camera(), before, 'Dragging orbits'); assert.equal(await page.evaluate(() => CircusPreview.activePointers), 0);
    const distance = await page.evaluate(() => CircusPreview.camera.position.length()); await page.getByRole('button', { name: 'Yakınlaş', exact: true }).click();
    assert.ok(await page.evaluate(() => CircusPreview.camera.position.length()) < distance, 'Zoom button works');
    await page.getByRole('button', { name: 'Seyirci', exact: true }).click(); assert.equal(await page.evaluate(() => CircusPreview.model.crowd.visible), false);
    await page.getByRole('button', { name: 'Seyirci', exact: true }).click();
    for (const view of ['loge', 'track', 'gates']) {
      await page.locator('[data-view=' + view + ']').click(); assert.equal(await page.evaluate(() => CircusPreview.view), view);
      await shot(view + '-932'); assert.equal(await page.locator('#loading').isVisible(), false, 'Camera switch never exposes a loading frame');
    }
    await page.locator('[data-view=overview]').click();
    const cdp = await context.newCDPSession(page), d0 = await page.evaluate(() => CircusPreview.camera.position.length());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: 180 }, { x: 500, y: 180 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 370, y: 180 }, { x: 530, y: 180 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.ok(await page.evaluate(() => CircusPreview.camera.position.length()) < d0, 'Two-finger pinch zooms');
    assert.equal(await page.evaluate(() => CircusPreview.activePointers), 0, 'Cancelled touches release');
    for (const [width, height] of [[390, 844], [667, 375], [1440, 900]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await fit(); await page.evaluate(() => CircusPreview.setView('overview')); await shot('overview-' + width);
      const visible = await page.evaluate(() => {
        const p = new THREE.Vector3(0,20,22), c = CircusPreview.camera, distance = c.position.distanceTo(p); p.project(c);
        return { x:p.x,y:p.y,z:p.z,distance,fogNear:CircusPreview.scene.fog.near,visible:Math.abs(p.x)<.9 && Math.abs(p.y)<.9 && distance<CircusPreview.scene.fog.near && p.z<1 };
      });
      assert.ok(visible.visible, 'Stadium visibility after rotation: '+JSON.stringify({width,height,...visible}));
    }
    for (const view of ['loge', 'track', 'gates']) { await page.evaluate(v => CircusPreview.setView(v), view); await shot(view + '-1440'); }
    await page.evaluate(()=>CircusPreview.setView('track'));
    const closeups={statue:[[38,14,-48],[42,13,-53]],basin:[[-9,7,148],[0,3,161]],metae:[[-12,6,223],[0,5,215]],logeRoom:[[48,15,-76],[70,13,-70]],palace:[[48,42,-230],[135,29,-30]],town:[[-76,32,92],[-145,10,100]],outside:[[-86,5,120],[-75,6,80]],obelisk:[[-15,15,47],[0,20,22]]};
    await page.locator('#cinema').click();
    for(const [name,[eye,target]] of Object.entries(closeups)){
      await page.evaluate(({eye,target})=>{const p=CircusPreview;p.camera.position.set(...eye);p.camera.lookAt(...target);p.camera.fov=55;p.camera.updateProjectionMatrix();},{eye,target});
      await shot(name+'-detail');
    }
    await page.locator('#cinema').click();await page.evaluate(()=>CircusPreview.setView('gates'));
    const unobstructed=await page.evaluate(()=>{
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),CircusPreview.camera);
      return ray.intersectObjects(CircusPreview.model.group.children,true)[0]?.distance>25;
    });assert.equal(unobstructed,true,'Gate camera is clear of the nearby turning markers');
    await page.getByRole('button',{name:'Arayüzü gizle',exact:true}).click();
    assert.equal(await page.locator('.identity').isVisible(),false);assert.equal(await page.locator('.views').isVisible(),false);
    assert.equal(await page.getByRole('button',{name:'Arayüzü göster',exact:true}).getAttribute('aria-pressed'),'true');
    await shot('gates-cinema-1440');await page.keyboard.press('h');assert.equal(await page.locator('.views').isVisible(),true);
    await page.setViewportSize({width:932,height:430});await fit();await page.evaluate(()=>CircusPreview.setView('gates'));
    await page.locator('#cinema').click();await shot('gates-cinema-932');await page.locator('#cinema').click();await fit();
    await page.evaluate(()=>{CircusPreview.setView('track');CircusPreview.camera.position.set(-23,1.5,120);CircusPreview.camera.lookAt(-23,0,113);});
    await page.locator('#cinema').click();await shot('sand-close');await page.locator('#cinema').click();
    await page.getByRole('button', { name: 'Kontroller ve sahne bilgisi' }).click(); assert.equal(await page.locator('#info').isVisible(), true);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#info').isVisible(), false);
    await page.keyboard.press('1'); assert.equal(await page.evaluate(() => CircusPreview.view), 'overview');
    await page.evaluate(()=>{
      const gl=CircusPreview.renderer.getContext(),ext=gl.getExtension('WEBGL_lose_context');
      if(!ext)throw Error('Context-loss extension unavailable');
      window._oldSky=CircusPreview.scene.background;
      document.querySelector('canvas').addEventListener('webglcontextlost',()=>setTimeout(()=>ext.restoreContext(),120),{once:true});
      ext.loseContext();
    });
    await page.waitForFunction(()=>CircusPreview.ready && CircusPreview.scene.background!==window._oldSky,null,{timeout:90000});
    assert.equal(await page.locator('#loading').isVisible(),false,'Context restoration draws a complete scene before revealing it');
    await shot('context-restored');
    const failure = await context.newPage(); await failure.route('**/assets/**', r => r.abort()); await failure.goto(url); await ready(failure);
    assert.match(await failure.locator('#hint').textContent(), /Bazı dokular/); assert.equal(await failure.locator('#loading').isVisible(), false, 'Texture failure still leaves a usable scene'); await failure.close();
    assert.deepEqual(errors, []); assert.equal(requests.some(u => /\/rest\/v1|\/auth\/v1/.test(u)), false, 'No game-state or auth requests');
    const idleFrame = await page.evaluate(() => CircusPreview.stats.frame); await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => CircusPreview.stats.frame), idleFrame, 'No rendering loop while idle');
    fs.writeFileSync(out + '/result.json', JSON.stringify({ passed: true, stats, enclosure, sandSurface, sandTexture:true, reliefAtlas:true, cinemaControls:true, gateCameraClear:true, errors, viewportTests: ['932x430', '390x844', '667x375', '1440x900'] }, null, 2));
    console.log('V145 PASS: four viewpoints, PBR assets, mouse/touch/keyboard, fullscreen loading, context restoration, failed texture fallback, idle rendering, read-only isolation.', stats);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
