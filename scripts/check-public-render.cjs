require('./load-local-env.cjs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {handler}=require('../netlify/functions/cms-public.cjs');
const {handler:apiHandler}=require('../netlify/functions/cms-blog.cjs');
const {configuration}=require('../lib/supabase.cjs');
const {publicData}=require('../lib/public-data.cjs');
function event(path){const url=new URL(path,'https://preview.example');return {httpMethod:'GET',rawUrl:url.href,path:url.pathname,headers:{host:url.host},queryStringParameters:Object.fromEntries(url.searchParams)};}
(async()=>{
 const config=configuration();const summary=await publicData(config).overview();
 assert.equal(summary.categories.length,5);assert(summary.total>=2);
 for(const path of ['/','/blog/','/blog/?category=implant','/blog/?category=orthodontics']){
  const result=await handler(event(path));assert.equal(result.statusCode,200,path);assert.equal(result.headers['Cache-Control'],'no-store');
  const dom=new JSDOM(result.body);const d=dom.window.document;
  assert.equal(d.querySelectorAll('[data-category-filter]').length,6);
  assert(d.querySelector('[data-category-filter="'+(path.includes('category=')?event(path).queryStringParameters.category:'all')+'"]').getAttribute('aria-pressed')==='true');
  for(const text of d.querySelectorAll('.card-description'))assert([...text.textContent].length>=120&&[...text.textContent].length<=130);
  assert(d.querySelector('link[rel="canonical"]').href.startsWith(new URL(config.siteUrl).origin));dom.window.close();
 }
 for(const slug of ['임플란트-교체-시기와-수명','임플란트-잇몸-출혈']){
  const result=await handler(event('/blog/'+slug));assert.equal(result.statusCode,200);
  const dom=new JSDOM(result.body),d=dom.window.document,meta=JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);
  assert.equal(meta['@type'],'BlogPosting');assert.equal(meta.datePublished.slice(0,10),'2026-10-08');assert(meta.articleBody.length>500);
  assert(d.querySelector('article').textContent.includes(d.querySelector('h1').textContent));assert.equal(d.querySelectorAll('article .card-description').length,0);
  assert(d.querySelector('article img'));assert(d.querySelector('aside .sidetoc'));
  for(const link of d.querySelectorAll('a[href^="#"]')){const id=link.getAttribute('href').slice(1);assert(d.getElementById(id),id);}
  dom.window.close();
  const alias=await handler(event('/blog/'+slug+'.html'));assert.equal(alias.statusCode,301);assert.equal(decodeURI(alias.headers.Location),'/blog/'+slug);
 }
 for(const [path,slug] of [['/implant-lifespan.html','임플란트-교체-시기와-수명'],['/implant-gum-bleeding','임플란트-잇몸-출혈']]){const result=await handler(event(path));assert.equal(result.statusCode,301);assert.equal(decodeURI(result.headers.Location),'/blog/'+slug);}
 assert.equal((await handler(event('/blog/cms-preview-검증-20261014'))).statusCode,404,'Private test post must not be served');
 assert.equal((await handler(event('/blog/no-such-post'))).statusCode,404);
 const sitemap=await handler(event('/sitemap.xml'));assert.equal(sitemap.statusCode,200);assert(!sitemap.body.includes('cms-preview-'));
 const api=await apiHandler(event('/api/blog?category=implant'));assert.equal(api.statusCode,200);const data=JSON.parse(api.body);assert(data.posts.every(p=>p.category_id==='implant'));assert.equal(data.allTotal,summary.total);
 console.log('PASS: live DB SSR cards, category filtering/counts, original articles/TOCs, Korean URLs, publication dates, canonical/schema metadata, protected drafts, compatibility redirects, and dynamic sitemap.');
})().catch(error=>{console.error(error);process.exitCode=1;});
