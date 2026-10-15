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
    if (path==='/rest/v1/rpc/cms_admin_identity') {
      if(!admin)throw Object.assign(new Error('Not an admin'),{code:'42501',status:403});
      return {data:{id:userId,username:'test_admin'}};
    }
    if (path === '/functions/v1/cms-login' || path.includes('grant_type=refresh_token')) return { data: session };
    throw new Error('Unexpected API call ' + path);
  }
});
(async () => {
  await assert.rejects(() => requireAdmin({ headers: {} }, api()), error => error instanceof HttpError && error.status === 401);
  await assert.rejects(() => requireAdmin({ headers: { cookie: `${ACCESS}=valid` } }, api(false)), error => error.status === 403);
  assert.equal((await requireAdmin({ headers: { cookie: `${ACCESS}=valid` } }, api())).user.username, 'test_admin');
  let active=0,parallel=0,verified=0;
  const parallelApi={request:async(path,options)=>{active++;parallel=Math.max(parallel,active);await new Promise(r=>setImmediate(r));active--;if(path==='/auth/v1/user')verified++;return api().request(path,options);}};
  const snapshot=async(token,db)=>{await db.request('/rest/v1/rpc/snapshot',{token});return {user:{id:userId,username:'test_admin'},data:{posts:[]}};};
  // Supply a DB stub, while requiring the independent real Auth check too.
  const originalRequest=parallelApi.request;
  parallelApi.request=async(path,options)=>{
    if(!path.includes('/rpc/snapshot'))return originalRequest(path,options);
    active++;parallel=Math.max(parallel,active);await new Promise(r=>setImmediate(r));active--;return {data:{}};
  };
  const batched=await requireAdmin({headers:{cookie:`${ACCESS}=valid`}},parallelApi,snapshot);
  assert(parallel>=2);assert.equal(verified,1);assert.deepEqual(batched.initial,{posts:[]});
  parallel=0;await requireAdmin({headers:{cookie:`${ACCESS}=valid`}},parallelApi);assert(parallel>=2,'All admin API authorization must also run Auth/DB checks concurrently');
  let anonymousCalls=0;
  await assert.rejects(()=>requireAdmin({headers:{}},api(),async()=>{anonymousCalls++;}),e=>e.status===401);assert.equal(anonymousCalls,0);
  await assert.rejects(()=>requireAdmin({headers:{cookie:`${ACCESS}=valid`}},api(),async()=>({user:{id:'22222222-2222-4222-8222-222222222222'}})),e=>e.status===403,'Auth and DB identity must match');
  await assert.rejects(()=>requireAdmin({headers:{cookie:`${ACCESS}=expired`}},api(),snapshot),e=>e.status===401,'A successful snapshot must not bypass expired Auth');
  const deniedSnapshot=async()=>{throw new HttpError(403,'관리자 권한이 없습니다.');};
  await assert.rejects(()=>requireAdmin({headers:{cookie:`${ACCESS}=valid; ${REFRESH}=refresh`}},api(),deniedSnapshot),e=>e.status===403,'DB role denial must remain forbidden, without refreshing');
  let attempts=[];
  const renewedSnapshot=await requireAdmin({headers:{cookie:`${ACCESS}=expired; ${REFRESH}=refresh`}},api(),async token=>{attempts.push(token);return {user:{id:userId,username:'test_admin'},data:{}};});
  assert.deepEqual(attempts,['expired',session.access_token]);assert.equal(renewedSnapshot.cookies.length,2);
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
