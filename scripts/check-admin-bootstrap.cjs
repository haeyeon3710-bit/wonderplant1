const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const {initialData,embed}=require('../lib/admin-bootstrap.cjs'),M=require('../admin/model.js');
const clone=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(resolve=>setImmediate(resolve));
const row={id:'11111111-1111-4111-8111-111111111111',title:'초기 데이터 </script><img src=x onerror=alert(1)>',slug:'bootstrap-test',category_id:'implant',status:'draft',version:3,view_count:0,created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z',content:[{type:'text',text:'반드시 보존할 본문'}],legacy_article_html:'<article><h1>원본</h1><p>보존할 HTML</p></article>',summary:'설명',thumbnail:'/images/lifespan.png',thumbnail_alt:'설명'};
const categories=M.categories.map((c,i)=>({...c,slug:c.id,sort_order:i,is_active:true}));
const statistics={totalPosts:1,totalViews:0,todayViews:0,weekViews:0,monthViews:0,recent:[],popular:[],weekly:[],monthly:[],daily:[{day:'2026-10-01',views:0}]};
let paths=[],active=0,concurrent=0;
const auth={user:{id:'22222222-2222-4222-8222-222222222222',username:'fixture_admin'},token:'DO_NOT_EMBED_ACCESS_TOKEN',email:'private@example.invalid',api:{request:async(path,options)=>{
 assert.equal(options.token,auth.token);paths.push(path);active++;concurrent=Math.max(concurrent,active);await tick();active--;
 if(path.startsWith('/rest/v1/categories'))return {data:clone(categories)};
 if(path.includes('/rpc/cms_admin_statistics'))return {data:clone(statistics)};
 const url=new URL(path,'https://fixture.invalid'),fields=url.searchParams.get('select').split(',');return {data:[Object.fromEntries(fields.filter(k=>row[k]!==undefined).map(k=>[k,clone(row[k])]))]};
}}};
async function ui(data,url){
 const template=fs.readFileSync(data.view==='list'?'adm.html':'editor.html','utf8').replace('</body>',embed(data)+'</body>');
 const w=new JSDOM(template,{url:'https://fixture.invalid'+url,runScripts:'outside-only'}).window;
 w.WonderfulAdmin={...M,categories:clone(categories)};w.HTMLElement.prototype.scrollIntoView=function(){};w.crypto.randomUUID=()=> '33333333-3333-4333-8333-333333333333';
 const requests=[];w.WonderfulAuth={session:async()=>{requests.push('session');throw Error('Duplicate initial session');},request:async path=>{requests.push(path);if(path.includes('?id='))return {post:{...clone(data.posts[0]),version:4,blocks:clone(row.content),legacyHtml:row.legacy_article_html}};return {posts:[{id:row.id,blocks:clone(row.content),legacyHtml:row.legacy_article_html}]};}};
 w.eval(fs.readFileSync('admin/database.js','utf8'));
 if(data.view==='list'){w.eval(fs.readFileSync('admin/daily-chart.js','utf8'));w.eval(fs.readFileSync('admin/management.js','utf8'));}
 w.eval(fs.readFileSync('admin/app.js','utf8'));await tick();await tick();
 assert.equal(w.document.getElementById('app').hidden,false);assert.deepEqual(requests,[],'Verified initial HTML must not make another auth/posts request');
 if(data.view==='list'){
  assert.equal(w.document.querySelectorAll('#post-list tr').length,1);
  await assert.rejects(()=>w.WonderfulDatabase.complete(data.posts[0]),/다른 화면/,'A summary action must detect concurrent changes');
  const backup=await w.WonderfulDatabase.exportAll();assert.equal(backup[0].blocks[0].text,row.content[0].text);assert.equal(backup[0].legacyHtml,row.legacy_article_html);
 }else if(data.post){assert.equal(w.document.getElementById('title').value,row.title);assert.equal(w.document.getElementById('blocks').querySelector('textarea').value,row.content[0].text);}
 w.close();
}
(async()=>{
 const config={environment:'preview'},list=await initialData(auth,config,new URL('https://fixture.invalid/adm'));
 assert(concurrent>=3,'Initial categories/list/statistics must load concurrently');assert.equal(list.posts[0].blocks,undefined);assert.equal(list.statistics.daily,undefined);
 assert(!paths.find(p=>p.startsWith('/rest/v1/posts')).includes('legacy_article_html'),'List query excludes full article HTML');
 const serialized=embed(list);assert(!serialized.includes(auth.token));assert(!serialized.includes(auth.email));
 const parsed=new JSDOM(serialized);assert.equal(parsed.window.document.querySelectorAll('script').length,1);assert.equal(parsed.window.document.querySelectorAll('img').length,0);assert.equal(JSON.parse(parsed.window.document.querySelector('script').textContent).posts[0].title,row.title);parsed.window.close();
 await ui(list,'/adm');paths=[];
 const fresh=await initialData(auth,config,new URL('https://fixture.invalid/adm/new'));assert.equal(paths.length,1,'New editor loads categories only');await ui(fresh,'/adm/new');paths=[];
 const edit=await initialData(auth,config,new URL('https://fixture.invalid/adm/edit?id='+row.id));assert.equal(paths.length,2,'Editor loads only requested post and categories');assert(paths.find(p=>p.includes('id=eq.'+row.id)));await ui(edit,'/adm/edit?id='+row.id);
 console.log('PASS: parallel private bootstrap, minimal lists, one selected editor post, no repeated initial auth/data requests, safe JSON escaping/no credentials, full backups and concurrent-edit protection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
