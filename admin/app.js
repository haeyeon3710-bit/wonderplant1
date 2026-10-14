(() => {
  'use strict';
  const M = window.WonderfulAdmin;
  const $ = id => document.getElementById(id);
  const view = document.body.dataset.view;
  let repo, current, dirty = false;
  const node = (tag, text, className) => {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  };
  function message(text, error = false) {
    const target = $('message') || $('fatal');
    target.textContent = text;
    target.className = error ? 'error' : 'notice';
    target.hidden = false;
    if (error) target.scrollIntoView({ block: 'center' });
  }
  function hasSession() {
    try { return M.sessionValid(JSON.parse(sessionStorage.getItem(M.SESSION_KEY))); }
    catch { return false; }
  }
  function guard() {
    if (view === 'login' || hasSession()) return true;
    $('app').hidden = true;
    dirty = false;
    const next = location.pathname + location.search;
    location.replace('/login?next=' + encodeURIComponent(next));
    return false;
  }
  function setupLogin() {
    $('app').hidden = false;
    $('login-form').addEventListener('submit', event => {
      event.preventDefault();
      try {
        sessionStorage.setItem(M.SESSION_KEY, JSON.stringify({ mode: 'demo', expiresAt: Date.now() + 2 * 60 * 60 * 1000 }));
        const next = new URLSearchParams(location.search).get('next') || '/adm';
        location.assign(/^\/adm(?:\/(?:new|edit))?\/?(?:\?[^#]*)?$/.test(next) ? next : '/adm');
      } catch { message('브라우저에서 세션 저장을 허용해야 체험 화면을 열 수 있습니다.', true); }
    });
  }
  function renderList() {
    if (!guard()) return;
    const query = $('search').value.trim().toLowerCase();
    const all = repo.all();
    const category = $('category-filter').value;
    const items = all.filter(post => (category === 'all' || post.category === category) && (post.title + ' ' + post.slug + ' ' + M.categoryName(post.category)).toLowerCase().includes(query));
    $('post-list').replaceChildren();
    $('post-count').textContent = `전체 ${all.length}개 · 표시 ${items.length}개`;
    $('empty').hidden = items.length > 0;
    items.forEach((post, index) => {
      const row = node('tr');
      row.append(node('td', String(items.length - index)));
      const titleCell = node('td');
      const editUrl = '/adm/edit?id=' + encodeURIComponent(post.id);
      const title = node('a', post.title, 'post-title'); title.href = editUrl;
      titleCell.append(title, node('div', '/blog/' + post.slug, 'post-slug'));
      const categoryCell = node('td', M.categoryName(post.category), 'post-category');
      const status = node('td');
      status.append(node('span', post.status === 'sample' ? '기존 글 사본' : '체험 초안', 'badge ' + (post.status === 'sample' ? '' : 'draft')));
      const date = new Date(post.updatedAt);
      const dateCell = node('td', Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }));
      const actions = node('td', undefined, 'row-actions');
      const edit = node('a', '수정'); edit.href = editUrl; edit.setAttribute('aria-label', post.title + ' 수정');
      const remove = node('button', '삭제'); remove.type = 'button'; remove.setAttribute('aria-label', post.title + ' 삭제');
      remove.addEventListener('click', () => {
        if (!guard()) return;
        if (!confirm(`“${post.title}” 체험 사본을 삭제할까요? 공개 사이트의 글은 유지됩니다.`)) return;
        try { repo.remove(post.id); renderList(); message('체험 목록에서 삭제했습니다.'); }
        catch { message('삭제를 저장하지 못했습니다. 브라우저 저장소를 확인해 주세요.', true); }
      });
      actions.append(edit, remove); row.append(titleCell, categoryCell, status, dateCell, actions); $('post-list').append(row);
    });
  }
  function markDirty() { dirty = true; }
  function categoryOptions(select, firstValue, firstLabel) {
    select.replaceChildren();
    const first = node('option', firstLabel); first.value = firstValue; select.append(first);
    M.categories.forEach(category => { const option = node('option', category.name); option.value = category.id; select.append(option); });
  }
  function safeImage(image, src, alt = '') {
    image.alt = alt;
    image.hidden = !M.validImage(src);
    image.referrerPolicy = 'no-referrer';
    if (!image.hidden) image.src = src; else image.removeAttribute('src');
    image.onerror = () => { image.hidden = true; };
  }
  function countSummary() {
    const count = M.count($('summary').value);
    $('summary-count').textContent = `${count} / 120~130자`;
    $('summary-count').className = 'counter ' + (count >= 120 && count <= 130 ? 'valid' : 'invalid');
  }
  function readForm() {
    return { ...current, title: $('title').value.trim(), category: $('category').value, slug: $('slug').value.trim(), summary: $('summary').value.trim(), thumbnail: $('thumbnail').value.trim(), thumbnailAlt: $('thumbnail-alt').value.trim() };
  }
  async function readImage(file) {
    if (!file) return null;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('PNG, JPG, WebP, GIF 이미지만 선택해 주세요.');
    if (file.size > 1024 * 1024) throw new Error('체험 모드에서는 이미지당 1MB 이하 파일을 선택해 주세요.');
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
    });
    await new Promise((resolve, reject) => { const img = new Image(); img.onload = resolve; img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.')); img.src = data; });
    return data;
  }
  function field(parent, labelText, value, onInput, multiline = false) {
    const label = node('label', undefined, 'field'); label.append(node('span', labelText));
    const input = node(multiline ? 'textarea' : 'input');
    input.value = value || ''; input.required = true;
    input.addEventListener('input', () => { onInput(input.value); markDirty(); });
    label.append(input); parent.append(label); return input;
  }
  function renderBlocks(focusIndex) {
    $('blocks').replaceChildren();
    current.blocks.forEach((block, index) => {
      const box = node('section', undefined, 'block');
      const top = node('div', undefined, 'block-top');
      const typeName = { text: '글', heading: '소제목', image: '이미지' }[block.type];
      top.append(node('strong', `${String(index + 1).padStart(2, '0')} · ${typeName}`));
      const controls = node('div', undefined, 'block-tools');
      for (const [label, delta] of [['↑', -1], ['↓', 1], ['삭제', 0]]) {
        const button = node('button', label); button.type = 'button';
        button.setAttribute('aria-label', `${index + 1}번 ${typeName} 블록 ${delta === -1 ? '위로' : delta === 1 ? '아래로' : '삭제'}`);
        button.disabled = (delta === -1 && index === 0) || (delta === 1 && index === current.blocks.length - 1);
        button.addEventListener('click', () => {
          if (!guard()) return;
          if (!delta) {
            if (!confirm('이 블록을 삭제할까요? 저장 전 변경사항에도 반영됩니다.')) return;
            current.blocks.splice(index, 1);
          } else [current.blocks[index], current.blocks[index + delta]] = [current.blocks[index + delta], current.blocks[index]];
          markDirty(); renderBlocks(delta ? index + delta : Math.max(0, index - 1));
        });
        controls.append(button);
      }
      top.append(controls); box.append(top);
      if (block.type === 'image') {
        const image = node('img', undefined, 'image-preview'); safeImage(image, block.src, block.alt); box.append(image);
        field(box, '이미지 주소', block.src, value => { block.src = value; safeImage(image, value, block.alt); });
        const uploadLabel = node('label', undefined, 'field'); uploadLabel.append(node('span', '이미지 파일 선택 · 1MB 이하'));
        const upload = node('input'); upload.type = 'file'; upload.accept = 'image/png,image/jpeg,image/webp,image/gif';
        upload.addEventListener('change', async () => {
          try { const data = await readImage(upload.files[0]); if (data && current.blocks.includes(block)) { block.src = data; markDirty(); renderBlocks(index); } }
          catch (error) { message(error.message || '이미지를 읽지 못했습니다.', true); }
        });
        uploadLabel.append(upload); box.append(uploadLabel);
        field(box, '이미지 설명', block.alt, value => { block.alt = value; image.alt = value; });
        field(box, '캡션 (선택)', block.caption, value => { block.caption = value; }).required = false;
      } else field(box, typeName, block.text, value => { block.text = value; }, block.type === 'text');
      $('blocks').append(box);
    });
    if (Number.isInteger(focusIndex)) $('blocks').children[focusIndex]?.querySelector('input,textarea')?.focus();
  }
  function showPreview() {
    if (!guard()) return;
    const post = readForm();
    const root = $('preview-body'); root.replaceChildren();
    root.append(node('div', '카드 목록에서 보이는 모습', 'preview-label'));
    const card = node('div', undefined, 'preview-card');
    const thumbnail = node('img'); safeImage(thumbnail, post.thumbnail, post.thumbnailAlt);
    const cardBody = node('div'); cardBody.append(node('small', M.categoryName(post.category)), node('h3', post.title || '글 제목'), node('p', post.summary || '카드 설명글'));
    card.append(thumbnail, cardBody); root.append(card, node('div', '본문에서 보이는 모습', 'preview-label'), node('small', M.categoryName(post.category)), node('h1', post.title || '글 제목'));
    // The list summary is intentionally omitted from the article body.
    post.blocks.forEach(block => {
      if (block.type === 'image') {
        const figure = node('figure'); const image = node('img'); safeImage(image, block.src, block.alt); figure.append(image);
        if (block.caption) figure.append(node('figcaption', block.caption)); root.append(figure);
      } else root.append(node(block.type === 'heading' ? 'h2' : 'p', block.text));
    });
    $('preview').showModal();
  }
  function setupEditor() {
    const id = new URLSearchParams(location.search).get('id');
    const editing = /\/edit\/?$/.test(location.pathname) || Boolean(id);
    current = editing ? repo.all().find(post => post.id === id) : {
      id: crypto.randomUUID(), title: '', slug: '', category: '', summary: '', thumbnail: '', thumbnailAlt: '', status: 'draft', blocks: [{ type: 'text', text: '' }]
    };
    if (!current) { $('editor-form').hidden = true; message('글을 찾을 수 없습니다. 게시글 관리 목록에서 다시 선택해 주세요.', true); return; }
    $('editor-title').textContent = editing ? '글 수정' : '새 글 쓰기';
    categoryOptions($('category'), '', '카테고리 선택');
    $('category').value = current.category;
    $('category').addEventListener('change', markDirty);
    for (const [id, key] of [['title', 'title'], ['slug', 'slug'], ['summary', 'summary'], ['thumbnail', 'thumbnail'], ['thumbnail-alt', 'thumbnailAlt']]) $(id).value = current[key];
    let manualSlug = editing;
    $('slug').addEventListener('input', () => { manualSlug = true; });
    $('title').addEventListener('input', () => { if (!manualSlug) $('slug').value = M.slugify($('title').value); });
    $('summary').addEventListener('input', countSummary); countSummary();
    $('editor-form').addEventListener('input', markDirty);
    const updateThumbnail = () => safeImage($('thumbnail-preview'), $('thumbnail').value, $('thumbnail-alt').value);
    $('thumbnail').addEventListener('input', updateThumbnail); $('thumbnail-alt').addEventListener('input', updateThumbnail); updateThumbnail();
    $('thumbnail-file').addEventListener('change', async () => {
      try { const data = await readImage($('thumbnail-file').files[0]); if (data) { $('thumbnail').value = data; updateThumbnail(); markDirty(); } }
      catch (error) { message(error.message || '이미지를 읽지 못했습니다.', true); }
    });
    renderBlocks();
    document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => {
      if (!guard()) return;
      current.blocks.push(button.dataset.add === 'image' ? { type: 'image', src: '', alt: '', caption: '' } : { type: button.dataset.add, text: '' });
      markDirty(); renderBlocks(current.blocks.length - 1);
    }));
    $('open-preview').addEventListener('click', showPreview);
    $('editor-form').addEventListener('submit', event => {
      event.preventDefault(); if (!guard()) return;
      try {
        current = repo.save(readForm()); dirty = false;
        history.replaceState(null, '', '/adm/edit?id=' + encodeURIComponent(current.id));
        $('editor-title').textContent = '글 수정';
        manualSlug = true;
        message('체험 초안을 이 브라우저에 저장했습니다. 공개 사이트에는 반영되지 않습니다.');
      } catch (error) { message(error.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족합니다. 이미지 크기를 줄이거나 JSON으로 내보내 주세요.' : error.message, true); }
    });
    $('download').addEventListener('click', () => {
      if (!guard()) return;
      const post = readForm(); const url = URL.createObjectURL(new Blob([JSON.stringify(post, null, 2)], { type: 'application/json' }));
      const link = node('a'); link.href = url; link.download = (M.slugify(post.slug || post.title) || 'draft') + '.json';
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  }
  try {
    if (!M) throw new Error('관리 화면 파일을 불러오지 못했습니다. 폴더 전체를 다시 업로드해 주세요.');
    if (view === 'login') { setupLogin(); return; }
    if (!guard()) return;
    repo = M.repository(localStorage, window.WonderfulSeed);
    repo.all();
    $('app').hidden = false; $('logout').hidden = false;
    $('logout').addEventListener('click', () => {
      if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 체험 로그아웃할까요?')) return;
      sessionStorage.removeItem(M.SESSION_KEY); dirty = false; $('app').hidden = true; location.replace('/login');
    });
    $('close-preview').addEventListener('click', () => $('preview').close());
    window.addEventListener('pageshow', guard);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) guard(); });
    document.addEventListener('click', event => { if (!hasSession()) { event.preventDefault(); event.stopImmediatePropagation(); guard(); } }, true);
    if (view === 'list') {
      categoryOptions($('category-filter'), 'all', '전체보기');
      renderList(); $('search').addEventListener('input', renderList);
      $('category-filter').addEventListener('change', renderList);
      window.addEventListener('storage', event => { if (event.key === M.STORE_KEY) { try { renderList(); } catch (error) { message(error.message, true); } } });
    } else setupEditor();
  } catch (error) {
    $('app').hidden = true; $('fatal').textContent = error.message || '관리 화면을 열 수 없습니다.'; $('fatal').hidden = false;
  }
})();
