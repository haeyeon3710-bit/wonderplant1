const assert=require('node:assert/strict'),{snapshotCache}=require('../lib/public-cache.cjs');
(async()=>{
 let time=0,version='1',loads=0,checks=0,title='Original',fail=false;
 const cache=snapshotCache({now:()=>time,maxEntries:2,maxBytes:2000});
 const revision=async()=>{checks++;if(fail)throw new Error('Database unavailable');return version;};
 const load=async()=>{loads++;return {revision:version,data:{post:{title},private:false}};};
 const read=(environment='preview',parameters={slug:'post'})=>cache.read(environment,parameters,revision,load);
 const first=await read();first.post.title='Client mutation';assert.equal(checks,0);assert.equal(loads,1);
 assert.equal((await read()).post.title,'Original');assert.equal(checks,1);assert.equal(loads,1);
 version='2';title='Edited';assert.equal((await read()).post.title,'Edited');assert.equal(loads,2,'Content changes must bypass old cache immediately');
 version='3';const hidden=await cache.read('preview',{slug:'post'},revision,async()=>({revision:version,data:{post:null}}));assert.equal(hidden.post,null,'Private/deleted posts must not reuse visible snapshots');
 fail=true;await assert.rejects(()=>read(),/Database unavailable/);fail=false;
 time=30001;await read();assert.equal(loads,3,'View rankings must refresh within 30 seconds');
 await read('production');assert.equal(loads,4,'Environments must not share cache contents');
 let resolve,concurrentLoads=0;const fresh=snapshotCache();const waiting=()=>fresh.read('fixture',{},revision,()=>{concurrentLoads++;return new Promise(r=>resolve=r);});
 const pending=[waiting(),waiting()];resolve({revision:'1',data:{result:'single'}});await Promise.all(pending);assert.equal(concurrentLoads,1);
 console.log('PASS: warm caching, clone isolation, immediate revision invalidation/private hiding, DB failures fail closed, statistics TTL, environment isolation and concurrent request coalescing.');
})().catch(error=>{console.error(error);process.exitCode=1;});
