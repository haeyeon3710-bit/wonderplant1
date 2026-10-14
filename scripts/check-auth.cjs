const assert = require('node:assert/strict');
const { requireAdmin, signIn, ACCESS, REFRESH } = require('../lib/auth.cjs');
const { HttpError, requireMutation } = require('../lib/http.cjs');
const userId = '11111111-1111-4111-8111-111111111111';
const session = { access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 3600 };
const api = (admin = true) => ({
  async request(path, options = {}) {
    if (path === '/auth/v1/user') {
      if (options.token === 'expired') { const error = new Error(); error.status = 401; throw error; }
      return { data: { id: userId, email: 'test@cms-test.invalid' } };
    }
    if (path.includes('/admin_users?')) return { data: admin ? [{ user_id: userId, role: 'admin', username: 'test_admin' }] : [] };
    if (path === '/functions/v1/cms-login' || path.includes('grant_type=refresh_token')) return { data: session };
    throw new Error('Unexpected API call ' + path);
  }
});
(async () => {
  await assert.rejects(() => requireAdmin({ headers: {} }, api()), error => error instanceof HttpError && error.status === 401);
  await assert.rejects(() => requireAdmin({ headers: { cookie: `${ACCESS}=valid` } }, api(false)), error => error.status === 403);
  assert.equal((await requireAdmin({ headers: { cookie: `${ACCESS}=valid` } }, api())).user.username, 'test_admin');
  const renewed = await requireAdmin({ headers: { cookie: `${ACCESS}=expired; ${REFRESH}=refresh` } }, api());
  assert.equal(renewed.cookies.length, 2);
  for (const cookie of renewed.cookies) for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert(cookie.includes(flag));
  const signed = await signIn('test_admin', 'fixture-only-password', api());
  assert.equal(signed.user.id, userId);
  await assert.rejects(() => requireAdmin({ headers: { cookie: `${ACCESS}=expired` } }, api()), error => error.status === 401);
  await assert.rejects(() => requireAdmin({ headers: { cookie: `${REFRESH}=expired-refresh` } }, {
    async request() { const error = new Error('Refresh rejected'); error.status = 400; throw error; }
  }), error => error.status === 401 && error.message.includes('만료'));
  await assert.rejects(() => requireAdmin({ headers: { cookie: `${ACCESS}=valid` } }, {
    async request() { const error = new Error('Temporary upstream outage'); error.status = 500; throw error; }
  }), error => error.status === 500);
  await assert.rejects(() => signIn('test_admin', 'fixture-only-password', api(false)), error => error.status === 403);
  await assert.rejects(() => signIn('../admin', 'fixture-only-password', api()), error => error.status === 400);
  const valid = { httpMethod: 'POST', rawUrl: 'https://preview.example/api/auth/login', headers: { origin: 'https://preview.example', 'content-type': 'application/json' } };
  requireMutation(valid);
  assert.throws(() => requireMutation({ ...valid, headers: { ...valid.headers, origin: 'https://attacker.example' } }), error => error.status === 403);
  assert.throws(() => requireMutation({ ...valid, httpMethod: 'GET' }), error => error.status === 405);
  console.log('PASS: unauthenticated/non-admin rejection, verified role checks, refresh, secure cookies, username login, and CSRF/method protection.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
