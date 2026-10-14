const assert = require('node:assert/strict');
const { configuration, client } = require('../lib/supabase.cjs');
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', CMS_ENVIRONMENT: 'preview' };
assert.equal(configuration(env).environment, 'preview');
assert.throws(() => configuration({}), /missing/);
assert.throws(() => configuration({ ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_allowed' }), /secret/);
assert.throws(() => configuration({ ...env, CMS_ENVIRONMENT: 'anything' }), /CMS_ENVIRONMENT/);
assert.throws(() => configuration({ ...env, SUPABASE_URL: 'https://name:password@example.supabase.co' }), /Invalid/);
const fake = async url => new Response(JSON.stringify(url.includes('/categories') ? [{ id: 'implant' }] : {}), { status: 200 });
(async () => {
  const health = await client(configuration(env), fake).health();
  assert.equal(health.connected, true); assert.equal(health.schemaReady, true);
  const fresh = async url => new Response(JSON.stringify(url.includes('/categories') ? { code: 'PGRST205' } : {}), { status: url.includes('/categories') ? 404 : 200 });
  assert.equal((await client(configuration(env), fresh).health()).schemaReady, false);
  const failure = async () => new Response('{}', { status: 401 });
  await assert.rejects(() => client(configuration(env), failure).health(), /401/);
  console.log('PASS: environment validation, no secret keys, existing/fresh schema checks, and connection failures.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
