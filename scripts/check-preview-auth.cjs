const assert = require('node:assert/strict');
const base = process.argv[2];
if (!base || !base.startsWith('https://')) throw new Error('Supply the HTTPS preview origin.');
(async () => {
  const health = await fetch(base + '/api/health');
  if (health.status === 401 && (health.headers.get('content-type') || '').includes('text/html')) {
    throw new Error('Netlify team login protects this preview. Run the browser checks in an authorized Netlify session; this is not a CMS health result.');
  }
  assert.equal(health.status, 200, 'CMS health endpoint');
  assert((health.headers.get('content-type') || '').includes('application/json'), 'CMS health must return JSON');
  const data = await health.json();
  assert(data.connected && data.schemaReady);
  const session = await fetch(base + '/api/auth/session');
  assert.equal(session.status, 401);
  for (const path of ['/adm', '/adm/new', '/adm/edit?id=1', '/adm.html', '/editor.html']) {
    const result = await fetch(base + path, { redirect: 'manual' });
    assert.equal(result.status, 303, path);
    assert(result.headers.get('location').includes('/login?next='), path);
  }
  for (const path of ['/lib/auth.cjs','/docs/CMS_PROGRESS.md','/supabase/migrations/202610140001_cms_schema.sql']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  const login = await fetch(base + '/login');
  const html = await login.text();
  assert.equal(login.status, 200); assert(html.includes('id="login-username"')); assert(html.includes('id="login-password"'));
  console.log('PASS: preview Supabase health, unauthenticated admin/API rejection, private source exclusion, and live username login form.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
