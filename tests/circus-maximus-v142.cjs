const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = process.env.LUDUS_TEST_OUTPUT || '/tmp/circus-maximus-v142';
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
    assert.ok(stats.calls <= 30 && stats.calls > 5, 'Architecture is batched'); assert.ok(stats.triangles < 500000, 'Mobile triangle budget');
    assert.ok(stats.spectators > 8000 && stats.spectators < 18000); assert.equal(await page.locator('#loading').isVisible(), false);
    assert.equal(await page.evaluate(() => CircusPreview.model.metadata.startingGates), 12);
    assert.equal(await page.evaluate(() => CircusPreview.model.metadata.photoCrowd), true, 'Spectator atlas actually loaded');
    assert.equal(await page.evaluate(() => Object.values(CircusPreview.model.materials).filter(m=>m.normalMap && m.roughnessMap).length>=5),true,'PBR assets actually loaded');
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
    fs.writeFileSync(out + '/result.json', JSON.stringify({ passed: true, stats, errors, viewportTests: ['932x430', '390x844', '667x375', '1440x900'] }, null, 2));
    console.log('V142 PASS: four viewpoints, PBR assets, mouse/touch/keyboard, fullscreen loading, context restoration, failed texture fallback, idle rendering, read-only isolation.', stats);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
