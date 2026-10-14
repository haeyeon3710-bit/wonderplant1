const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const esbuild=require('esbuild');
const source=esbuild.transformSync(fs.readFileSync('supabase/functions/cms-view/index.ts','utf8'),{loader:'ts',format:'cjs'}).code;
let handler,calls=[];let status=200;
const fixture=vm.createContext({Deno:{serve:fn=>{handler=fn;},env:{get:name=>name==='SUPABASE_URL'?'https://cms-test.invalid':'test-server-key'}},Response,AbortSignal,fetch:async(url,options)=>{calls.push({url,options});return {ok:status===200,status,json:async()=>({counted:true,viewCount:1})};}});
vm.runInContext(source,fixture);
const secret='v'.repeat(43),body={environment:'preview',id:'11111111-1111-4111-8111-111111111111',visitorHash:'a'.repeat(64)};
function request(value,credential=secret){return new Request('https://cms-test.invalid/cms-view',{method:'POST',headers:{'x-cms-view-secret':credential},body:typeof value==='string'?value:JSON.stringify(value)});}
(async()=>{
 assert.equal((await handler(request(body,''))).status,403);assert.equal(calls.length,0);
 assert.equal((await handler(request({...body,id:'invalid'}))).status,400);assert.equal(calls.length,0);
 assert.equal((await handler(request('x'.repeat(2049)))).status,413);
 assert.equal((await handler(request(body))).status,200);
 const payload=JSON.parse(calls[0].options.body);assert.equal(payload.p_environment,'preview');assert.equal(payload.p_secret,secret);assert.equal(payload.p_visitor_hash,body.visitorHash);assert.equal(payload.viewCount,undefined);
 status=403;assert.equal((await handler(request(body))).status,403,'Invalid bridge credentials must be rejected by the DB');
 status=500;assert.equal((await handler(request(body))).status,503);
 console.log('PASS: Edge bridge enforces credential format, validates input/size, delegates credential hash validation before DB writes, and returns safe errors.');
})().catch(error=>{console.error(error);process.exitCode=1;});
