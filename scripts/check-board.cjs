const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const handler = require('./preview.cjs');
const origin = 'https://beautiful-semolina-aa2c94.netlify.app';
const posts = [
  { id: '1', slug: '임플란트-교체-시기와-수명', original: 'implant-lifespan.html' },
  { id: '2', slug: '임플란트-잇몸-출혈', original: 'implant-gum-bleeding.html' },
];
const request = url => new Promise(resolve => {
  const result = {};
  handler({ url }, {
    writeHead(status, headers = {}) { Object.assign(result, { status, headers }); return this; },
    end(body = '') { result.body = body.toString(); resolve(result); },
  });
});
(async () => {
  for (const file of ['index.html', 'blog.html']) {
    const html = read(file);
    assert.equal((html.match(/class="card"/g) || []).length, 2);
    assert(!html.includes('board-table'));
    posts.forEach(post => assert(html.includes('href="/blog/' + post.slug + '"')));
  }
  for (const post of posts) {
    const url = '/blog/' + post.slug;
    const page = await request(encodeURI(url));
    assert.equal(page.status, 200);
    const html = page.body;
    const source = read(post.original);
    assert(html.includes(source.match(/<h1>.*?<\/h1>/s)[0]));
    assert(!html.includes(' hidden'));
    assert(!html.includes('board.js'));
    assert(html.includes('rel="canonical" href="' + origin + url + '"'));
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.url, origin + url);
    assert.equal(data.mainEntityOfPage, origin + url);
    const sourceData = JSON.parse(source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.articleBody, sourceData.articleBody);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const link = match[1];
      if (link.startsWith('#')) assert(ids.includes(link.slice(1)), link);
      else if (link.startsWith('/') && !link.startsWith('/blog/')) assert(fs.existsSync(path.join(root, link.slice(1))), link);
    }
    const trailingSlashPage = await request(encodeURI(url + '/'));
    assert.equal(trailingSlashPage.status, 200);
    assert.equal(trailingSlashPage.body, html);
    // Legacy redirects now resolve the current DB slug in cms-public. Their
    // actual handler is exercised by check-public-render.cjs --live.
    assert(read('sitemap.xml').includes(encodeURI(origin + url)));
  }
  assert.equal((await request('/blog/')).status, 200);
  assert.equal((await request('/blog')).status, 200);
  // Exercise every public route using Netlify's trailing-slash normalization.
  const rules = read('_redirects').trim().split(/\r?\n/).map(line => line.split(/\s+/));
  for (const [from, to] of rules) {
    if (to.startsWith('/.netlify/functions/')) continue; // Hosted Functions are tested separately.
    for (const start of [from.replace(/\/+$/, ''), from.replace(/\/+$/, '') + '/']) {
      const seen = new Set();
      let current = start;
      for (let hop = 0; ; hop++) {
        assert(hop < 5, 'Too many redirects from ' + start);
        const normalized = decodeURI(current).replace(/\/+$/, '');
        assert(!seen.has(normalized), 'Redirect loop from ' + start);
        seen.add(normalized);
        const response = await request(current);
        if (response.status >= 300 && response.status < 400) {
          current = response.headers.Location;
        } else {
          assert.equal(response.status, 200, current);
          break;
        }
      }
    }
  }
  for (const hash of ['', '#1', '#2', '#1-about', '#99']) {
    let destination;
    const match = /^#([12])/.exec(hash);
    const post = match && posts.find(post => post.id === match[1]);
    vm.runInNewContext(read('board.js'), {
      URL,
      location: { hash, href: origin + '/implant/' + hash, replace: value => { destination = new URL(value); } },
      document: { querySelector: () => post && ({ href: origin + '/blog/' + post.slug }) },
    });
    assert.equal(decodeURI(destination.pathname), post ? '/blog/' + post.slug : '/blog/');
    assert.equal(destination.hash, hash === '#1-about' ? '#about' : '');
  }
  console.log('PASS: card lists, Korean routes, article bodies, SEO metadata, assets, TOC, legacy redirects, and all redirect chains with Netlify slash normalization.');
})().catch(error => { console.error(error); process.exitCode = 1; });
