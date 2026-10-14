// Uses an ignored local bridge credential and a disposable preview post only.
require('./load-local-env.cjs');
const fs=require('node:fs');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {configuration,client}=require('../lib/supabase.cjs');
(async()=>{
 const id=process.argv[2];assert(/^[a-f0-9-]{36}$/.test(id),'Provide the disposable fixture UUID');
 const config=configuration();assert.equal(config.environment,'preview');
 const key=fs.readFileSync('.netlify/qa/view-secret','utf8').trim();
 const nonce=crypto.randomUUID();
 const hash=n=>crypto.createHmac('sha256',key).update('cms-disposable-test:'+nonce+':'+n).digest('hex');
 const send=async(visitorHash,secret=key)=>{
  const response=await fetch(config.url+'/functions/v1/cms-view',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json','x-cms-view-secret':secret},body:JSON.stringify({environment:'preview',id,visitorHash}),signal:AbortSignal.timeout(20000)});
  return {status:response.status,data:await response.json()};
 };
 const row=(await client(config).request('/rest/v1/posts?id=eq.'+id+'&select=id,title,status,view_count,version,updated_at')).data[0];
 assert(row?.title.startsWith('[프리뷰 테스트] 조회수'),'Refuse to modify original posts');assert.equal(row.status,'published');
 const original=Number(row.view_count);
 assert.equal((await send(hash('bad'),'')).status,403);
 assert.equal((await send(hash('bad'),'w'.repeat(43))).status,403);
 const duplicates=await Promise.all(Array.from({length:8},()=>send(hash('same'))));
 assert(duplicates.every(r=>r.status===200));assert.equal(duplicates.filter(r=>r.data.counted).length,1,'Concurrent identical visits must count exactly once');
 const distinct=await Promise.all(Array.from({length:8},(_,n)=>send(hash('visitor-'+n))));
 assert(distinct.every(r=>r.status===200&&r.data.counted));
 const saved=(await client(config).request('/rest/v1/posts?id=eq.'+id+'&select=view_count,version,updated_at')).data[0];
 assert.equal(Number(saved.view_count),original+9,'Concurrent distinct visits must not lose increments');assert.equal(saved.version,row.version);assert.equal(saved.updated_at,row.updated_at);
 await assert.rejects(client(config).request('/rest/v1/rpc/cms_record_post_view',{method:'POST',body:{p_environment:'preview',p_post_id:id,p_visitor_hash:hash('anon'),p_secret:key}}),e=>e.status===401||e.status===403);
 console.log('PASS: live Edge credential rejection, service-only RPC, eight simultaneous duplicates counted once, eight distinct visits preserved, and unchanged edit metadata (preview fixture only).');
})().catch(error=>{console.error('View integration check failed: '+error.message);process.exitCode=1;});
