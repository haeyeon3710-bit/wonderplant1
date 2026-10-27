const assert=require('node:assert/strict'),sharp=require('sharp'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const {convert,optimize,cleanupGifOriginal}=require('../lib/animated-image.cjs');
async function checkGifCleanup(){
 const user='11111111-1111-4111-8111-111111111111',source='preview/'+user+'/22222222-2222-4222-8222-222222222222.gif',token='fixture-token';
 const raw=Buffer.concat([Buffer.alloc(12*8*3,60),Buffer.alloc(12*8*3,180)]),gif=await sharp(raw,{raw:{width:12,height:16,channels:3,pageHeight:8}}).gif({loop:3,delay:[100,250]}).toBuffer(),converted=await convert(gif);
 assert.equal(converted.animationVerified,true);
 let uploaded,deletes=0;
 const auth={user:{id:user},token,api:{request:async(path,options)=>{
  assert.equal(options.token,token);
  if(path.includes('/object/info/'))return {data:{created_at:new Date().toISOString(),size:uploaded?.length??converted.buffer.length,content_type:'image/webp'}};
  if(path.startsWith('/rest/v1/posts?')){assert(new URL(path,'https://fixture.invalid').searchParams.get('or').includes(source));return {data:[]};}
  if(path==='/storage/v1/object/cms-images'){assert(uploaded,'Never delete before upload');assert.deepEqual(options.body,{prefixes:[source]});deletes++;return {data:[{name:source}]};}
  return {data:path.includes('/upload/sign/')?{url:'/object/upload/sign/cms-images/output.webp?token=fixture'}:{signedURL:'/object/sign/cms-images/input.gif?token=fixture'}};
 }}};
 const transport=async(url,options)=>{assert(url.startsWith('https://fixture.invalid/storage/v1/'));if(options.method==='PUT'){uploaded=options.body;return {ok:true};}return {ok:true,headers:new Headers(),arrayBuffer:async()=>gif};};
 const result=await optimize(auth,{environment:'preview',url:'https://fixture.invalid'},'/media/'+source,transport);
 assert.equal(result.originalDeleted,true);assert.equal(deletes,1);assert.equal(result.frames,2);
 for(const [label,setting,expected]of [['referenced',{references:[{id:'existing-draft'}]},'referenced'],['old',{old:true},'older-upload'],['wrong-size',{size:1},'retained'],['delete-failed',{failure:true},'retained']]){
  let count=0;const guarded={...auth,api:{request:async(path)=>{
   if(path.includes('/object/info/'))return {data:{created_at:new Date(Date.now()-(setting.old?86400000:0)).toISOString(),size:setting.size??converted.buffer.length,content_type:'image/webp'}};
   if(path.startsWith('/rest/v1/posts?'))return {data:setting.references||[]};
   if(path==='/storage/v1/object/cms-images'){count++;if(setting.failure)throw Error('Unavailable');return {data:[{name:source}]};}
   throw Error('Unexpected cleanup call');
  }}};
  const kept=await cleanupGifOriginal(guarded,{},source,'preview/output.webp',converted);assert.equal(kept.originalDeleted,false,label);assert.equal(kept.originalCleanup,expected,label);assert(kept.cleanupWarning);if(!setting.failure)assert.equal(count,0,label);
 }
 const noRequests={...auth,api:{request:async()=>{throw Error('Must not request');}}};
 assert.equal((await cleanupGifOriginal(noRequests,{},source,'preview/output.webp',{...converted,animationVerified:false})).originalDeleted,false);
 assert.equal((await cleanupGifOriginal(noRequests,{},source.replace('.gif','.webp'),'preview/output.webp',converted)).originalCleanup,'not-gif');
 const before=deletes;await assert.rejects(()=>optimize(auth,{environment:'preview',url:'https://fixture.invalid'},'/media/'+source,async(url,options)=>options.method==='PUT'?{ok:false}:transport(url,options)),e=>e.status===503);assert.equal(deletes,before);
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
 w.WonderfulAuth={request:async path=>path==='/api/upload'?{uploadUrl:'https://fixture.invalid/upload',src:'/media/'+source}:{src:'/media/preview/output.webp',bytes:10,originalDeleted:true}};
 w.WonderfulImages={prepare:async file=>({file,server:true,converted:false,originalBytes:file.size})};w.fetch=async()=>({ok:true});w.eval(fs.readFileSync('admin/database.js','utf8'));
 await w.WonderfulDatabase.upload(new w.File(['gif'],'input.gif',{type:'image/gif'}));assert.equal(w.WonderfulDatabase.lastUpload.originalDeleted,true);w.close();
 console.log('PASS: GIF deletion only after verified WebP storage; retain old/referenced/failed/unverified originals, preserve animation and expose cleanup outcome.');
}
module.exports={checkGifCleanup};if(require.main===module)checkGifCleanup().catch(e=>{console.error(e);process.exitCode=1;});
