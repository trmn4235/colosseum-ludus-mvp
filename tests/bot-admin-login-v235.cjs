const assert = require('node:assert/strict');

module.exports = async () => {
  const originalFetch = global.fetch;
  const originalDeno = global.Deno;
  const env = { SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'server-secret', SUPABASE_ANON_KEY: 'public-key' };
  global.Deno = { env: { get: key => env[key] }, serve: () => {} };
  const { handle } = require('../supabase/functions/bot-admin-login-v235/index.ts');
  const origin = 'https://colosseum-bot-yonetim.inf5535152.chatgpt.site';
  let scenario = 'ok';
  let calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/ludus_login_allow')) return answer(scenario !== 'limited');
    if (url.endsWith('/ludus_login_email')) return answer('admin@test.invalid');
    if (url.includes('/auth/v1/token')) return scenario === 'bad-password'
      ? answer({ error: 'bad credentials' }, 400)
      : answer({ access_token: 'fake-access', refresh_token: 'fake-refresh', user: { id: 'fake-user' } });
    if (url.endsWith('/ludus_bot_admin_v233')) return scenario === 'non-admin'
      ? answer({ error: 'denied' }, 403)
      : answer({ user_id: scenario === 'wrong-owner' ? 'another-user' : 'fake-user' });
    throw Error('Unexpected network request: ' + url);
  };
  const request = (body, source = origin, method = 'POST') => new Request('https://test.invalid/login', {
    method, headers: { Origin: source, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {})
  });
  try {
    let res = await handle(request({ username: 'admin', password: 'test' }, 'https://outside.invalid'));
    assert.equal(res.status, 403); assert.equal(calls.length, 0);
    res = await handle(request(null, origin, 'OPTIONS'));
    assert.equal(res.status, 204); assert.equal(res.headers.get('access-control-allow-origin'), origin);
    res = await handle(request({ username: '?', password: 'test' }));
    assert.equal(res.status, 400); assert.equal(calls.length, 0);
    scenario = 'limited'; res = await handle(request({ username: 'admin', password: 'test' }));
    assert.equal(res.status, 429); assert.equal(calls.length, 2);
    for (scenario of ['bad-password', 'non-admin', 'wrong-owner']) {
      calls = []; res = await handle(request({ username: 'admin', password: 'test' }));
      assert.equal(res.status, scenario === 'bad-password' ? 401 : 403);
      assert.equal((await res.text()).includes('fake-access'), false);
    }
    scenario = 'ok'; calls = []; res = await handle(request({ username: 'Admin', password: 'test' }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { access_token: 'fake-access', refresh_token: 'fake-refresh' });
    const admin = calls.find(call => call.url.endsWith('/ludus_bot_admin_v233'));
    assert.equal(admin.options.headers.Authorization, 'Bearer fake-access');
    const limits = calls.filter(call => call.url.endsWith('/ludus_login_allow'));
    assert.equal(limits.length, 2);
    assert.ok(limits.every(call => !call.options.body.includes('admin')));
    console.log('V235 bot admin login PASS: origin, rate limits, password, owner isolation and session.');
  } finally {
    global.fetch = originalFetch;
    if (originalDeno === undefined) delete global.Deno; else global.Deno = originalDeno;
  }
};
