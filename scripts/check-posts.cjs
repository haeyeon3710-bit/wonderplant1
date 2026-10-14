const assert=require('node:assert/strict');
const {validate,service}=require('../lib/posts.cjs');
const {legacyHtml}=require('../lib/content.cjs');
const id='11111111-1111-4111-8111-111111111111';
const input={id,title:'테스트 글',slug:'테스트-글',summary:'가'.repeat(120),category:'implant',status:'draft',thumbnail:'/images/lifespan.png',thumbnailAlt:'이미지 설명',blocks:[{type:'text',text:'본문'}]};
let stored={id,environment:'preview',title:input.title,slug:input.slug,summary:input.summary,category_id:'implant',status:'draft',thumbnail:input.thumbnail,thumbnail_alt:input.thumbnailAlt,content:input.blocks,legacy_article_html:'<article><h1>기존 제목</h1><p>원본</p></article>',version:1,created_at:'2026-10-08',published_at:null,updated_at:'2026-10-08',view_count:0};
let conflict=false;
const auth={user:{id},token:'fixture-token',api:{async request(path,options={}){
  assert.equal(options.token,'fixture-token');
  if(path.includes('/categories?'))return {data:[{id:'implant'}]};
  assert(path.includes('environment=eq.preview')||options.method==='POST');
  if(options.method==='PATCH'){
    assert(!('view_count' in options.body));assert(!('created_at' in options.body));assert(!('published_at' in options.body));assert(!('environment' in options.body));
    if(conflict)return {data:[]};stored={...stored,...options.body,version:stored.version+1};return {data:[stored]};
  }
  if(options.method==='POST'){stored={...stored,...options.body,version:1};return {data:[stored]};}
  return {data:[stored]};
}}};
(async()=>{
  assert.equal(validate({...input,summary:'',thumbnail:'',thumbnailAlt:'',blocks:[]},'preview').status,'draft');
  assert.equal(validate({...input,status:'published',summary:''},'preview').summary,'');
  assert.equal(validate({...input,status:'published',summary:'짧은 설명'},'preview').summary,'짧은 설명');
  assert.throws(()=>validate({...input,status:'published',summary:'가'.repeat(131)},'preview'),e=>e.status===400);
  const scheduledAt=new Date(Date.now()+3600000).toISOString();
  assert.equal(validate({...input,status:'scheduled',scheduledAt},'preview').scheduled_at,scheduledAt);
  for(const scheduledAt of [null,'invalid',new Date(Date.now()-3600000).toISOString()])assert.throws(()=>validate({...input,status:'scheduled',scheduledAt},'preview'),e=>e.status===400);
  assert.throws(()=>validate({...input,status:'scheduled',scheduledAt,thumbnail:''},'preview'),e=>e.status===400);
  assert.equal(validate({...input,scheduledAt},'preview').scheduled_at,null,'Saving as a draft cancels the schedule');
  assert.throws(()=>validate({...input,thumbnail:'data:image/png;base64,abc'},'preview'),e=>e.status===400);
  assert.throws(()=>validate({...input,thumbnail:'/media/production/a.png'},'preview'),e=>e.status===400);
  const clean=legacyHtml('<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><h2>제목</h2><a href="javascript:alert(1)">링크</a>');
  assert(!clean.includes('script'));assert(!clean.includes('onerror'));assert(!clean.includes('javascript:'));assert(clean.includes('<h2>제목</h2>'));
  const posts=service(auth,'preview');
  const metadata=await posts.save({...input,version:1,title:'바뀐 제목',category:'complex-implant',viewCount:999999,createdAt:'1900-01-01',environment:'production'});
  assert(metadata.legacyHtml.includes('원본'));assert.equal(metadata.category,'complex-implant');
  const edited=await posts.save({...input,version:2,blocks:[{type:'text',text:'수정한 본문'}]});assert.equal(edited.legacyHtml,'');
  conflict=true;await assert.rejects(()=>posts.save({...input,version:3}),e=>e.status===409);
  const restored=await posts.save({...input,legacyHtml:'<article><h1>백업</h1><p>블록에 없는 원본 본문</p><script>alert(1)</script></article>'});
  assert(restored.legacyHtml.includes('블록에 없는 원본 본문'));assert(!restored.legacyHtml.includes('script'));
  console.log('PASS: draft/publish validation, safe HTML/media, protected metadata, original HTML preservation, body edits, and concurrent edit conflicts.');
})().catch(e=>{console.error(e);process.exitCode=1;});
