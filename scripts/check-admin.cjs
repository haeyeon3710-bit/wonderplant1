const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../admin/model.js');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const seedContext = { window: {} };
vm.runInNewContext(read('admin/seed.js'), seedContext);
const seed = JSON.parse(JSON.stringify(seedContext.window.WonderfulSeed));
const values = new Map();
const storage = { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value) };
const repo = M.repository(storage, seed);
assert.equal(repo.all().length, 2);
assert.equal(M.slugify(' 임플란트  관리 / 방법! '), '임플란트-관리-방법');
const first = repo.all()[0];
assert.equal(M.validate(first, repo.all()), '');
assert.equal(M.count(first.summary), 126);
const saved = repo.save({ ...first, title: '수정한 제목' });
assert.equal(repo.all()[0].title, '수정한 제목');
assert.equal(saved.status, 'draft');
assert.notEqual(seed[0].title, saved.title, 'Original published data must not be mutated');
assert.throws(() => repo.save({ ...first, id: 'new' }), /슬러그/);
assert.throws(() => repo.save({ ...first, slug: '../login' }), /슬러그/);
assert.equal(M.validate({...first,summary:'짧은 설명'},repo.all()),'');
assert.equal(M.validate({...first,summary:''},repo.all()),'');
assert.throws(() => repo.save({ ...first, summary: '가'.repeat(131) }), /130자/);
assert.throws(() => repo.save({ ...first, thumbnail: 'javascript:alert(1)' }), /이미지/);
assert.throws(() => repo.save({ ...first, blocks: [{ type: 'image', src: 'javascript:alert(1)', alt: 'test' }, { type: 'text', text: '본문' }] }), /이미지/);
assert(!M.validImage('//external.example/test.png'));
assert(!M.validImage('data:image/svg+xml;base64,PHN2Zz4='));
assert(M.validImage('/images/lifespan.png'));
repo.save({ ...first, id: 'new-post', slug: '새로운-글', title: '새 글' });
assert.equal(M.repository(storage, seed).all().length, 3, 'Drafts survive repository reload');
repo.remove('new-post');
assert.equal(repo.all().length, 2);
repo.remove('1'); repo.remove('2');
assert.equal(repo.all().length, 0, 'An empty list must not restore deleted samples');
assert(!M.sessionValid(null));
assert(!M.sessionValid({ mode: 'demo', expiresAt: 99 }, 100));
assert(M.sessionValid({ mode: 'demo', expiresAt: 101 }, 100));
assert(!M.sessionValid({ mode: 'admin', expiresAt: 101 }, 100));

// Real authentication is now checked in the server tests, not by the old demo flag.
assert(!read('admin/app.js').includes('sessionStorage.setItem'));
for (const file of ['login.html', 'adm.html', 'editor.html']) {
  const html = read(file);
  assert(html.includes('content="noindex,nofollow"'));
  assert(html.includes('id="app" hidden'));
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/admin\/[^"?]+)"/g)) assert(fs.existsSync(path.join(root, asset.slice(1))));
}
const summaries = JSON.parse(read('content/card-descriptions.json'));
for (const summary of Object.values(summaries)) {
  assert(M.count(summary) >= 120 && M.count(summary) <= 130);
  for (const file of ['index.html', 'blog.html']) assert(read(file).includes('<p class="card-description">' + summary + '</p>'));
  for (const file of fs.readdirSync(path.join(root, 'blog'))) assert(!read('blog/' + file).includes(summary), 'Card summary must not appear inside article');
}
assert(!read('sitemap.xml').includes('/adm'));
console.log('PASS: local CRUD, persistence, original content isolation, slug/summary/image validation, session gate, private-page metadata, and card-only 126-character descriptions.');
