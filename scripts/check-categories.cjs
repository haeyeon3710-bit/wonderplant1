const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const taxonomy = require('../categories.js');
const M = require('../admin/model.js');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const expected = ['전체보기', '임플란트', '고난도 임플란트', '전체 임플란트', '의식하진정법', '치아교정'];
for (const file of ['index.html', 'blog.html']) {
  const html = read(file);
  const buttons = [...html.matchAll(/data-category-filter="([^"]+)" aria-pressed="([^"]+)">([^<]+)<\/button>/g)];
  assert.deepEqual(buttons.map(button => button[3]), expected);
  assert.deepEqual(buttons.map(button => button[2]), ['true', 'false', 'false', 'false', 'false', 'false']);
  assert(html.includes('class="card" data-category="implant" href="/blog/임플란트-교체-시기와-수명"'));
  assert(html.includes('class="card" data-category="complex-implant" href="/blog/임플란트-잇몸-출혈"'));
  assert(html.includes('src="/category-filter.js"'));
}
// Execute the real public event handlers, including empty categories and
// returning to All, on two independent lists without navigation/reload.
const makeList = () => {
  const buttons = [{ id: 'all', name: '전체보기' }, ...taxonomy.categories].map(category => ({
    dataset: { categoryFilter: category.id }, textContent: category.name,
    setAttribute(key, value) { this[key] = value; },
    addEventListener(event, callback) { this[event] = callback; },
  }));
  const cards = ['implant', 'complex-implant'].map(category => ({ dataset: { category }, hidden: false }));
  const empty = { hidden: true };
  const status = {};
  return { buttons, cards, empty, status,
    querySelectorAll: selector => selector === '[data-category-filter]' ? buttons : cards,
    querySelector: selector => selector === '[data-category-empty]' ? empty : status,
  };
};
const lists = [makeList(), makeList()];
vm.runInNewContext(read('category-filter.js'), { document: { querySelectorAll: () => lists } });
for (const list of lists) {
  assert(list.cards.every(card => !card.hidden));
  list.buttons[1].click();
  assert.deepEqual(list.cards.map(card => card.hidden), [false, true]);
  list.buttons[2].click();
  assert.deepEqual(list.cards.map(card => card.hidden), [true, false]);
  for (const index of [3, 4, 5]) {
    list.buttons[index].click();
    assert(list.cards.every(card => card.hidden));
    assert.equal(list.empty.hidden, false);
    assert.equal(list.buttons.filter(button => button['aria-pressed'] === 'true').length, 1);
    assert(list.status.textContent.includes('0개의 글'));
  }
  list.buttons[0].click();
  assert(list.cards.every(card => !card.hidden));
  assert.equal(list.empty.hidden, true);
}
const context = { window: {} }; vm.runInNewContext(read('admin/seed.js'), context);
const seed = JSON.parse(JSON.stringify(context.window.WonderfulSeed));
assert.deepEqual(seed.map(post => post.category), ['implant', 'complex-implant']);
let raw = JSON.stringify(seed.map(({ category, ...post }) => post));
const storage = { getItem: () => raw, setItem: (key, value) => { raw = value; } };
const repo = M.repository(storage, seed);
assert.deepEqual(repo.all().map(post => post.category), ['implant', 'complex-implant'], 'Old browser drafts get original categories');
const first = repo.all()[0];
for (const category of taxonomy.categories) {
  repo.save({ ...first, category: category.id });
  assert.equal(M.repository(storage, seed).all()[0].category, category.id);
}
assert.throws(() => repo.save({ ...first, category: 'unknown' }), /카테고리/);
assert.throws(() => repo.save({ ...first, category: '' }), /카테고리/);
assert(read('editor.html').includes('id="category" required'));
assert(read('adm.html').includes('id="category-filter"'));
assert(read('adm.html').includes('<th scope="col">카테고리</th>'));
for (const file of ['login.html', 'adm.html', 'editor.html']) {
  assert(read(file).indexOf('src="/categories.js"') < read(file).indexOf('src="/admin/model.js"'));
}
for (const [slug, category] of [['임플란트-교체-시기와-수명', '임플란트'], ['임플란트-잇몸-출혈', '고난도 임플란트']]) {
  const html = read('blog/' + slug + '.html');
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.articleSection, category);
}
console.log('PASS: ordered category toggles, default All, matching/empty/reset filters, correct post assignments, admin category edits/persistence, and old draft migration.');
