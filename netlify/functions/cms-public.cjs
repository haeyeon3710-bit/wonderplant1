const {configuration}=require('../../lib/supabase.cjs');
const {publicData}=require('../../lib/public-data.cjs');
const {HttpError}=require('../../lib/http.cjs');
const R=require('../../lib/render.cjs');
const M=require('../../admin/model.js');
exports.handler=async event=>{
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};let config;
 try{
  if(!['GET','HEAD'].includes(event.httpMethod))return {statusCode:405,headers,body:''};
  config=configuration();if(config.environment==='preview')headers['X-Robots-Tag']='noindex, nofollow';
  const data=publicData(config),url=new URL(event.rawUrl||`https://${event.headers.host}${event.path}`),pathname=decodeURIComponent(url.pathname).replace(/\/+$/,'')||'/';
  const redirect=target=>({statusCode:301,headers:{...headers,Location:encodeURI(target)},body:''});
  if(pathname==='/robots.txt')return {statusCode:200,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'},body:config.environment==='preview'?'User-agent: *\nDisallow: /\n':`User-agent: *\nAllow: /\nDisallow: /adm\nDisallow: /login\nDisallow: /api/\nSitemap: ${R.siteOrigin(config)}/sitemap.xml\n`};
  if(pathname==='/sitemap.xml'){
   const posts=await data.sitemap(),origin=R.siteOrigin(config);const urls=[{url:'/'},{url:'/blog/'},{url:'/policy.html'},...posts.map(p=>({url:R.postUrl(p),updated:p.updated_at}))];
   return {statusCode:200,headers:{...headers,'Content-Type':'application/xml; charset=utf-8'},body:`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${R.escape(encodeURI(origin+u.url))}</loc>${u.updated?`<lastmod>${new Date(u.updated).toISOString()}</lastmod>`:''}</url>`).join('')}</urlset>`};
  }
  if(pathname==='/index.html')return redirect('/');
  if(pathname==='/implant'||pathname==='/implant.html'){headers['X-Robots-Tag']='noindex, follow';return {statusCode:200,headers,body:R.compatibilityPage(await data.legacyLinks(),config)};}
  const legacy={'/implant-lifespan':'1','/implant-lifespan.html':'1','/implant-gum-bleeding':'2','/implant-gum-bleeding.html':'2'}[pathname];
  if(legacy)return redirect('/blog/'+(await data.legacy(legacy)).slug);
  if(['/','/blog','/blog.html'].includes(pathname)){
   if(pathname==='/blog.html')return redirect('/blog/');
   const board=await data.board(event.queryStringParameters||{});return {statusCode:200,headers,body:R.boardPage(board,config,pathname==='/')};
  }
  if(pathname.startsWith('/blog/')){
   const original=pathname.slice(6),slug=original.replace(/\.html$/,'');
   if(!slug||slug!==M.slugify(slug))throw new HttpError(404,'게시글을 찾을 수 없습니다.');
   const result=await data.post(slug);
   if(result.redirect||original!==result.post.slug)return redirect('/blog/'+result.post.slug);
   return {statusCode:200,headers,body:R.articlePage(result.post,result.overview,config)};
  }
  throw new HttpError(404,'게시글을 찾을 수 없습니다.');
 }catch(error){const status=error instanceof HttpError?error.status:503;headers['X-Robots-Tag']='noindex, nofollow';let body='관리 서버 설정을 확인해 주세요.';try{if(config)body=R.errorPage(status,config);}catch{}return {statusCode:status,headers,body};}
};
