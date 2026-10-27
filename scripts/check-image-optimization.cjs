const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),sharp=require('sharp');
const {JSDOM}=require('jsdom'),M=require('../content/images.manifest.json'),{convert,optimize}=require('../lib/animated-image.cjs');
const {imageAttributes,optimizeHtml}=require('../lib/images.cjs');
async function main(){
 for(const [src,image]of Object.entries(M)){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(src.slice(1))).digest('hex'),image.originalSha256,'Image originals must remain intact');
  for(const variant of [image.full,image.card]){const meta=await sharp(variant.src.slice(1)).metadata();assert.equal(meta.format,'webp');assert(Math.max(meta.width,meta.height)<=1600);}
 }
 assert(imageAttributes('/images/lifespan.png',true).includes('srcset='));assert(optimizeHtml('<img src="/images/lifespan.png" alt="원본 설명">').includes('alt="원본 설명"'));assert.equal(optimizeHtml('<img src="https://other.invalid/a.png">'),'<img src="https://other.invalid/a.png">');
 const frames=Buffer.concat([Buffer.alloc(12*8*3,60),Buffer.alloc(12*8*3,180)]);
 const gif=await sharp(frames,{raw:{width:12,height:16,channels:3,pageHeight:8}}).gif({loop:3,delay:[100,250]}).toBuffer();
 fs.mkdirSync('.netlify/qa',{recursive:true});fs.writeFileSync('.netlify/qa/animated-test.gif',gif);
 const before=await sharp(gif,{animated:true}).metadata(),converted=await convert(gif),after=await sharp(converted.buffer,{animated:true}).metadata();
 assert.equal(after.format,'webp');assert.equal(after.pages,before.pages);assert.equal(after.loop,before.loop);assert.deepEqual(after.delay,before.delay);
 await assert.rejects(()=>convert(Buffer.alloc(20*1024*1024+1)),e=>e.status===413);
 const auth={user:{id:'11111111-1111-4111-8111-111111111111'},token:'fixture',api:{request:async()=>{throw new Error('Must not request external data');}}};
 for(const src of ['https://evil.invalid/a.gif','/media/production/'+auth.user.id+'/22222222-2222-4222-8222-222222222222.gif','/media/preview/33333333-3333-4333-8333-333333333333/22222222-2222-4222-8222-222222222222.gif'])await assert.rejects(()=>optimize(auth,{environment:'preview',url:'https://cms-test.invalid'},src),e=>e.status===400);
 let uploaded;const transport={...auth,api:{request:async(path,options)=>{assert.equal(options.token,'fixture');return {data:path.includes('/upload/sign/')?{url:'/object/upload/sign/cms-images/output.webp?token=fixture'}:{signedURL:'/object/sign/cms-images/input.gif?token=fixture'}};}}};
 const stored=await optimize(transport,{environment:'preview',url:'https://cms-test.invalid'},'/media/preview/'+auth.user.id+'/22222222-2222-4222-8222-222222222222.gif',async(url,options)=>{
  assert(url.startsWith('https://cms-test.invalid/storage/v1/'));if(options.method==='PUT'){assert.equal(options.headers['Content-Type'],'image/webp');uploaded=options.body;return {ok:true};}
  return {ok:true,headers:new Headers({'content-length':String(gif.length)}),arrayBuffer:async()=>gif};
 });
 assert(stored.src.endsWith('.webp'));assert.equal(stored.frames,2);assert.equal((await sharp(uploaded,{animated:true}).metadata()).pages,2);
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;let revoked=0,read=0;
 w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>revoked++;
 w.Image=class{naturalWidth=3200;naturalHeight=2400;set src(value){read++;queueMicrotask(()=>this.onload());}};
 w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toBlob=function(callback,type){callback(new w.Blob(['fixture'],{type}));};
 w.eval(fs.readFileSync('admin/images.js','utf8'));
 const input=new w.File(['source'],'image.png',{type:'image/png'}),result=await w.WonderfulImages.prepare(input);assert.equal(result.file.type,'image/webp');assert.equal(result.width,1600);assert.equal(result.height,1200);assert.equal(revoked,1);
 const server=await w.WonderfulImages.prepare(new w.File(['gif'],'animation.gif',{type:'image/gif'}));assert.equal(server.server,true);assert.equal(read,1,'GIF must not be flattened by canvas');
 await assert.rejects(()=>w.WonderfulImages.prepare({type:'image/png',size:20*1024*1024+1}));
 w.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new w.Blob(['png'],{type:'image/png'}));};await assert.rejects(()=>w.WonderfulImages.prepare(input),/WebP/);assert.equal(revoked,2);w.close();
 await require('./check-gif-cleanup.cjs').checkGifCleanup();
 console.log('PASS: repository original preservation, conditional GIF cleanup, smaller WebP assets/srcsets, browser resize/codec failures/20MB, animated timing/loops, and ownership/SSRF checks.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
