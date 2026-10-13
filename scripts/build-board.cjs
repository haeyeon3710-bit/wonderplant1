// Rebuild the blog from the original HTML article sources.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const write = (name, value) => {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
};
const rootLinks = html => html.replace(/\b(href|src)="([^"]+)"/g, (attribute, name, url) =>
  /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url) ? attribute : `${name}="/${url}"`);
const origin = 'https://beautiful-semolina-aa2c94.netlify.app';
const summaries = JSON.parse(read('content/card-descriptions.json'));
const posts = [
  { id: '1', file: 'implant-lifespan.html', slug: '임플란트-교체-시기와-수명', image: 'lifespan.png', alt: '임플란트 수명과 상태 평가를 표현한 설명용 이미지' },
  { id: '2', file: 'implant-gum-bleeding.html', slug: '임플란트-잇몸-출혈', image: 'bleeding.png', alt: '임플란트 주변 잇몸 상태를 확인하는 설명용 이미지' },
].map(post => {
  const html = read(post.file);
  const summary = summaries[post.id];
  if (!summary || [...summary].length < 120 || [...summary].length > 130) throw new Error('Card description must be 120–130 characters: ' + post.id);
  return { ...post, html, summary, url: `/blog/${post.slug}`, title: html.match(/<h1>(.*?)<\/h1>/s)[1] };
});
function mapLinks(html) {
  for (const post of posts) {
    for (const old of [post.file, `implant#${post.id}`, `/implant/#${post.id}`]) {
      html = html.replaceAll(`href="${old}"`, `href="${post.url}"`);
    }
  }
  return html.replaceAll('href="index.html">치과정보', 'href="/blog/">치과정보')
    .replaceAll('href="implant"', 'href="/blog/"').replaceAll('href="/implant/"', 'href="/blog/"');
}
const cards = `<div class="cards">${[...posts].reverse().map(post => `<a class="card" href="${post.url}"><div class="home-thumbnail"><img src="images/${post.image}" width="1536" height="1024" alt="${post.alt}"></div><div class="card-body"><small>원더플치과의원 · 임플란트</small><h3>${post.title}</h3><p class="card-description">${post.summary}</p><span class="more">작성 2026-10-08 · 더 읽기 →</span></div></a>`).join('\n')}</div>`;
for (const post of posts) {
  const other = posts.find(item => item.id !== post.id);
  const navigation = `<nav class="board-post-nav" aria-label="게시글 이동"><a class="board-back" href="/blog/">← 목록으로</a><a href="${other.url}">${post.id === '1' ? '다음' : '이전'} 글 →</a></nav>`;
  const html = mapLinks(post.html)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${origin}${post.url}">`)
    .replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_, json) => {
      const data = JSON.parse(json);
      data['@id'] = `${origin}${post.url}#article`;
      data.url = `${origin}${post.url}`;
      data.mainEntityOfPage = data.url;
      return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
    })
    .replace('</head>', '<link rel="stylesheet" href="/board.css"></head>')
    .replace('<main id="main" class="wrap">', `<main id="main" class="wrap">${navigation}`)
    .replace('</main>', `${navigation}</main>`)
    .replace(' / 치과 건강정보 / 임플란트', ' / <a href="/blog/">치과 건강정보</a> / 임플란트');
  write(`blog/${post.slug}.html`, rootLinks(html));
}
const home = read('index.html');
const header = home.match(/<header>[\s\S]*?<\/header>/)[0];
const footer = home.slice(home.indexOf('<section class="consultation"'), home.indexOf('</body>'));
const structured = {
  '@context': 'https://schema.org', '@type': 'CollectionPage',
  name: '임플란트 건강정보 게시판', url: `${origin}/blog/`,
  hasPart: posts.map(post => ({ '@type': 'BlogPosting', headline: post.title, url: `${origin}${post.url}` })),
};
write('blog.html', rootLinks(mapLinks(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><link rel="canonical" href="${origin}/blog/"><meta name="description" content="임플란트 교체 시기와 수명, 잇몸 출혈과 관리에 관한 원더플치과의원 건강정보 게시판입니다."><title>임플란트 건강정보 게시판 | 원더플치과의원</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="board.css"><script type="application/ld+json">${JSON.stringify(structured)}</script></head>
<body><a class="skip" href="#main">본문으로 건너뛰기</a>${header}<main id="main" class="wrap"><section class="journal home-journal"><div class="eyebrow">DENTAL HEALTH JOURNAL</div><h1>임플란트 건강정보 게시판</h1><p>임플란트 치료와 관리에 대해 자주 물어보시는 질문을 정리했습니다.</p>${cards}</section></main>${footer}</body></html>\n`)));
let updatedHome = mapLinks(home).replace(/<section class="journal home-journal">[\s\S]*?<\/section>/, `<section class="journal home-journal"><div class="eyebrow">DENTAL HEALTH JOURNAL</div><h1>원더플치과 건강정보</h1><p>임플란트 치료와 관리에 대해 자주 물어보시는 질문을 정리했습니다.</p>${cards}<a class="board-all" href="/blog/">임플란트 게시판 전체 보기 →</a></section>`);
if (!updatedHome.includes('href="board.css"')) updatedHome = updatedHome.replace('</head>', '<link rel="stylesheet" href="board.css"></head>');
write('index.html', updatedHome);
write('policy.html', mapLinks(read('policy.html')));
const urls = ['/', '/policy.html', '/blog/', ...posts.map(post => post.url)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${encodeURI(origin + url)}</loc><lastmod>2026-10-13</lastmod></url>`).join('')}</urlset>\n`);
const rules = posts.flatMap(post => [
  `/${post.file} ${post.url} 301!`,
  `/${post.file.replace('.html', '')} ${post.url} 301!`,
  `${post.url} ${post.url}.html 200`,
]);
// Netlify matches paths with and without trailing slashes as the same route.
// A redirect between those variants loops; serve both with one internal rewrite.
write('_redirects', [...rules, '/blog /blog.html 200', '/implant /implant.html 200', '/login /login.html 200', '/adm/new /editor.html 200', '/adm/edit /editor.html 200', '/adm /adm.html 200'].map(rule => rule.split(' ').map(encodeURI).join(' ')).join('\n') + '\n');
const seed = posts.map(post => {
  const data = JSON.parse(post.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  return { id: post.id, title: post.title, slug: post.slug, summary: post.summary, thumbnail: `/images/${post.image}`, thumbnailAlt: post.alt, updatedAt: '2026-10-08T00:00:00Z', status: 'sample', blocks: [
    { type: 'image', src: `/images/${post.image}`, alt: post.alt, caption: '' },
    ...data.articleBody.split(/\n\n/).map(text => ({ type: 'text', text }))
  ] };
});
write('admin/seed.js', 'window.WonderfulSeed = ' + JSON.stringify(seed).replaceAll('<', '\\u003c') + ';\n');
// URL fragments never reach the server; resolve old #n links in a compatibility page.
write('implant.html', `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="${origin}/blog/"><title>새 글 주소 안내 | 원더플치과의원</title><script src="/board.js" defer></script></head><body><h1>건강정보 글 주소가 변경되었습니다</h1><p><a href="/blog/">게시판 목록으로 이동</a></p>${posts.map(post => `<p><a data-legacy-id="${post.id}" href="${post.url}">${post.title}</a></p>`).join('')}</body></html>\n`);
console.log('Built card lists, independent Korean blog URLs, legacy redirects, and sitemap.');
