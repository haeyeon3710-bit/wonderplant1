const fs=require('node:fs');
const path=require('node:path');
const {escape,legacyHtml,blocksHtml}=require('./content.cjs');
const {imageAttributes,optimizeHtml}=require('./images.cjs');
const read=name=>fs.readFileSync(path.join(process.cwd(),name),'utf8');
const rootLinks=html=>optimizeHtml(html.replace(/\b(href|src)="([^"]+)"/g,(match,attribute,url)=>/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(url)?match:`${attribute}="/${url}"`));
const date=value=>value?new Date(value).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'';
const publicationTime=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';
const postUrl=post=>'/blog/'+post.slug;
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
function siteOrigin(config){const url=new URL(config.siteUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Configure the HTTPS SITE_URL.');return url.origin;}
function cardsHTML(posts,categories){
 return posts.map(post=>`<a class="card" data-category="${escape(post.category_id)}" href="${escape(postUrl(post))}"><div class="home-thumbnail"><img ${imageAttributes(post.thumbnail,true)} alt="${escape(post.thumbnail_alt)}" width="1536" height="1024" loading="lazy"></div><div class="card-body"><small>원더플치과의원 · ${escape(categories.find(c=>c.id===post.category_id)?.name||'')}</small><h3>${escape(post.title)}</h3><p class="card-description">${escape(post.summary)}</p><span class="more">발행 ${date(post.published_at)} · 조회 ${Number(post.view_count).toLocaleString('ko-KR')} · 더 읽기 →</span></div></a>`).join('\n');
}
function filterHTML(data){return `<div class="category-filters" role="group" aria-label="글 카테고리">${[{id:'all',name:'전체보기',post_count:data.allTotal},...data.categories].map(c=>`<button type="button" data-category-filter="${escape(c.id)}" data-category-name="${escape(c.name)}" aria-pressed="${data.category===c.id}">${escape(c.name)} <small>${c.post_count}</small></button>`).join('')}</div>`;}
function paginationHTML(data){
 const link=page=>'/blog/?'+new URLSearchParams({category:data.category,sort:data.sort,page:String(page)});
 return `<nav class="board-pagination" aria-label="게시글 목록 페이지" ${data.pages<=1?'hidden':''}>${data.page>1?`<a href="${escape(link(data.page-1))}" data-page="${data.page-1}">← 이전</a>`:''}<span>${data.page} / ${Math.max(1,data.pages)}</span>${data.page<data.pages?`<a href="${escape(link(data.page+1))}" data-page="${data.page+1}">다음 →</a>`:''}</nav>`;
}
function journalHTML(data,home=false){
 const name=data.category==='all'?'전체보기':data.categories.find(c=>c.id===data.category).name;
 return `<section class="journal home-journal" data-category-list data-dynamic="true" data-category="${escape(data.category)}" data-sort="${data.sort}" data-page="${data.page}"><div class="eyebrow">DENTAL HEALTH JOURNAL</div><h1>${home?'원더플치과 건강정보':'치과 건강정보 게시판'}</h1><p>치과 치료와 관리에 대해 자주 물어보시는 질문을 정리했습니다.</p>${filterHTML(data)}<div class="board-sort"><p class="category-status" data-category-status role="status" aria-live="polite">${escape(name)} · ${data.total}개의 글</p><label>정렬 <select data-board-sort><option value="recent" ${data.sort==='recent'?'selected':''}>최근 발행순</option><option value="popular" ${data.sort==='popular'?'selected':''}>누적 조회순</option><option value="weekly" ${data.sort==='weekly'?'selected':''}>최근 7일 조회순</option><option value="monthly" ${data.sort==='monthly'?'selected':''}>최근 30일 조회순</option></select></label></div><div class="cards">${cardsHTML(data.posts,data.categories)}</div><p class="category-empty" data-category-empty ${data.posts.length?'hidden':''}>등록된 글이 없습니다.</p>${paginationHTML(data)}${home?'<a class="board-all" href="/blog/">건강정보 게시판 전체 보기 →</a>':''}</section>`;
}
function sideLists(data){return `<section class="sidebox"><div class="eyebrow">RECENT POSTS</div><h3>최근 글</h3><ul class="board-link-list">${data.recent.map(p=>`<li><a href="${escape(postUrl(p))}">${escape(p.title)}</a><small>${date(p.published_at)}</small></li>`).join('')}</ul></section><section class="sidebox"><div class="eyebrow">POPULAR POSTS</div><h3>인기 글</h3><ol class="board-link-list">${data.popular.map(p=>`<li><a href="${escape(postUrl(p))}">${escape(p.title)}</a><small>조회 ${Number(p.view_count).toLocaleString('ko-KR')}</small></li>`).join('')}</ol>${[[7,data.weekly||[]],[30,data.monthly||[]]].map(([days,posts])=>`<details><summary>최근 ${days}일 인기 글</summary><ol class="board-link-list">${posts.map(p=>`<li><a href="${escape(postUrl(p))}">${escape(p.title)}</a><small>기간 조회 ${Number(p.period_views).toLocaleString('ko-KR')}</small></li>`).join('')}</ol></details>`).join('')}</section><section class="sidebox"><h3>카테고리</h3><ul class="board-link-list">${data.categories.map(c=>`<li><a href="/blog/?category=${escape(c.id)}">${escape(c.name)} <small>${c.post_count}</small></a></li>`).join('')}</ul></section>`;}
function shell(body,{title,description,canonical,structured,config,extra=''}){
 const home=read('index.html');const header=rootLinks(home.match(/<header>[\s\S]*?<\/header>/)[0]);
 const footer=rootLinks(home.slice(home.indexOf('<section class="consultation"'),home.indexOf('</body>')));
 return optimizeHtml(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${config.environment==='preview'?'noindex,nofollow':'index,follow'}"><title>${escape(title)} | 원더플치과의원</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="${structured?.['@type']==='BlogPosting'?'article':'website'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/board.css"><link rel="stylesheet" href="/cms-public.css"><script src="/category-filter.js" defer></script>${structured?`<script type="application/ld+json">${json(structured)}</script>`:''}${extra}</head><body><a class="skip" href="#main">본문으로 건너뛰기</a>${header}${body}${footer}</body></html>`);
}
function boardPage(data,config,home=false){
 const origin=siteOrigin(config);const query=new URLSearchParams();if(data.category!=='all')query.set('category',data.category);if(data.page>1)query.set('page',String(data.page));const canonical=origin+(home?'/':'/blog/')+(query.size?'?'+query:'');
 const structured={'@context':'https://schema.org','@type':'CollectionPage',name:'치과 건강정보 게시판',url:canonical,hasPart:data.posts.map(p=>({'@type':'BlogPosting',headline:p.title,url:origin+postUrl(p),datePublished:p.published_at}))};
 const description='임플란트, 고난도 임플란트, 전체 임플란트, 의식하진정법, 치아교정에 관한 원더플치과의원 건강정보 게시판입니다.';
 if(!home)return shell(`<main id="main" class="wrap"><div class="layout board-list-layout"><div>${journalHTML(data)}</div><aside class="sidebar">${sideLists(data)}</aside></div></main>`,{title:'치과 건강정보 게시판',description,canonical,structured,config});
 let html=read('index.html').replace(/<section class="journal home-journal"(?: data-category-list)?>[\s\S]*?<\/section>/,journalHTML(data,true));
 html=html.replace(/<section class="clinic-sidecard clinic-recent">[\s\S]*?<\/section>/,`<section class="clinic-sidecard clinic-recent"><div class="eyebrow">RECENT</div><ol class="home-recent-list">${data.recent.slice(0,3).map(p=>`<li><a href="${escape(postUrl(p))}">${escape(p.title)}</a></li>`).join('')}</ol></section>`);
 html=html.replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="${escape(canonical)}">`).replace(/<meta name="robots"[^>]*>/,`<meta name="robots" content="${config.environment==='preview'?'noindex,nofollow':'index,follow'}">`);
 html=html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,`<script type="application/ld+json">${json(structured)}</script>`);
 return rootLinks(html.replace('</head>','<link rel="stylesheet" href="/cms-public.css"></head>'));
}
function articlePage(post,data,config){
 const origin=siteOrigin(config),canonical=origin+postUrl(post),category=data.categories.find(c=>c.id===post.category_id)?.name||'';
 const crumb=`<div class="crumb"><a href="/">홈</a> / <a href="/blog/">치과 건강정보</a> / <a href="/blog/?category=${escape(post.category_id)}">${escape(category)}</a></div>`;
 const metadata=`<div class="metadata">원더플치과의원 블로그${post.legacy_article_html?.includes('AI 작성 초안')?' · AI 작성 초안':''} · ${escape(category)} · 발행일 : <time datetime="${escape(post.published_at)}">${publicationTime(post.published_at)}</time> · 조회 <span data-view-count>${Number(post.view_count).toLocaleString('ko-KR')}</span></div>`;
 let article=post.legacy_article_html?legacyHtml(post.legacy_article_html):`<article>${crumb}<h1>${escape(post.title)}</h1>${metadata}${blocksHtml(post.content)}</article>`;
 if(post.legacy_article_html)article=article.replace(/<div class="crumb">[\s\S]*?<\/div>/,crumb).replace(/<h1[^>]*>[\s\S]*?<\/h1>/,`<h1>${escape(post.title)}</h1>`).replace(/<div class="metadata">[\s\S]*?<\/div>/,metadata);
 let sidebar='';
 const file={'1':'implant-lifespan.html','2':'implant-gum-bleeding.html'}[post.legacy_id];
 if(file&&post.legacy_article_html){const source=read(file).match(/<aside class="sidebar">([\s\S]*?)<\/aside>/)?.[1]||'';sidebar=legacyHtml(rootLinks(source));}
 else sidebar='<section class="sidebox"><div class="eyebrow">RESERVATION</div><h3>치과 상담 · 예약</h3><a class="action" href="tel:029862275">전화 상담 02.986.2275</a><a class="action lime" href="#contact">예약 안내 보기</a></section>';
 const nav='<nav class="board-post-nav" aria-label="게시글 이동"><a class="board-back" href="/blog/">← 목록으로</a></nav>';
 const text=post.content.filter(b=>b.type!=='image').map(b=>b.text).join('\n\n');
 const structured={'@context':'https://schema.org','@type':'BlogPosting','@id':canonical+'#article',headline:post.title,description:post.summary,articleBody:text,articleSection:category,datePublished:post.published_at,dateModified:post.updated_at,url:canonical,mainEntityOfPage:canonical,image:new URL(post.thumbnail,origin).href,author:{'@type':'Organization',name:'원더플치과의원'}};
 return shell(`<main id="main" class="wrap" data-post-id="${escape(post.id)}">${nav}<div class="layout article-layout">${article}<aside class="sidebar">${sidebar}${sideLists(data)}</aside></div>${nav}</main>`,{title:post.title,description:post.summary,canonical,structured,config,extra:`<script src="/post-views.js" defer></script><meta property="og:image" content="${escape(new URL(post.thumbnail,origin).href)}">`});
}
function errorPage(status,config){return shell(`<main id="main" class="wrap"><h1>${status===404?'게시글을 찾을 수 없습니다.':'목록을 불러오지 못했습니다.'}</h1><p><a href="/blog/">게시판 목록으로</a></p></main>`,{title:'게시판 안내',description:'치과 건강정보 게시판',canonical:siteOrigin(config)+'/blog/',config});}
function compatibilityPage(posts,config){return shell(`<main id="main" class="wrap"><h1>건강정보 글 주소가 변경되었습니다</h1><p><a href="/blog/">게시판 목록으로 이동</a></p>${posts.map(p=>`<p><a data-legacy-id="${escape(p.legacy_id)}" href="${escape(postUrl(p))}">${escape(p.title)}</a></p>`).join('')}</main>`,{title:'새 글 주소 안내',description:'새 게시글 주소 안내',canonical:siteOrigin(config)+'/blog/',config:{...config,environment:'preview'},extra:'<script src="/board.js" defer></script>'});}
module.exports={siteOrigin,cardsHTML,filterHTML,paginationHTML,boardPage,articlePage,errorPage,compatibilityPage,postUrl,escape};
