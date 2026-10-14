(() => {
  'use strict';
  const M = window.WonderfulAdmin;
  const Auth = window.WonderfulAuth;
  const $ = id => document.getElementById(id);
  const view = document.body.dataset.view;
  let repo, current, dirty = false, authState = null, originalBlocks = [], saving = false;
  const statusNames = {draft:'임시저장',published:'발행',private:'비공개'};
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
    return Boolean(authState?.user);
  }
  function confirmAction(text){
    const dialog=$('confirm-dialog');$('confirm-question').textContent=text;dialog.returnValue='cancel';
    return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});dialog.showModal();});
  }
  async function refreshSession() {
    try { authState = await Auth.session(); }
    catch (error) {
      if (error.status === 401 || error.status === 403) { authState = null; guard(); }
      else message(error.message, true);
    }
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
    $('login-form').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const button = $('login-form').querySelector('button'); button.disabled = true;
        await Auth.login($('login-username').value.trim().toLowerCase(), $('login-password').value);
        $('login-password').value = '';
        const next = new URLSearchParams(location.search).get('next') || '/adm';
        location.assign(/^\/adm(?:\/(?:new|edit))?\/?(?:\?[^#]*)?$/.test(next) ? next : '/adm');
      } catch (error) { message(error.message || '로그인하지 못했습니다.', true); }
      finally { $('login-form').querySelector('button').disabled = false; }
    });
  }
  function renderList() {
    if (!guard()) return;
    const query = $('search').value.trim().toLowerCase();
    const all = repo.all();
    const category = $('category-filter').value;
    const selectedStatus=$('status-filter')?.value||'all';
    const items = all.filter(post => (selectedStatus==='all'||post.status===selectedStatus)&&(category === 'all' || post.category === category) && (post.title + ' ' + post.slug + ' ' + M.categoryName(post.category)).toLowerCase().includes(query));
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
      status.append(node('span', statusNames[post.status], 'badge ' + (post.status === 'published' ? '' : 'draft')));
      const date = new Date(post.updatedAt);
      const dateCell = node('td', Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }));
      const actions = node('td', undefined, 'row-actions');
      const edit = node('a', '수정'); edit.href = editUrl; edit.setAttribute('aria-label', post.title + ' 수정');
      const remove = node('button', '삭제'); remove.type = 'button'; remove.setAttribute('aria-label', post.title + ' 삭제');
      remove.addEventListener('click', async () => {
        if (!guard()) return;
        if (!await confirmAction(`“${post.title}”을 삭제할까요? 발행된 글은 공개 목록에서도 삭제됩니다. JSON 백업을 먼저 내려받습니다.`)) return;
        try { downloadJson(post,post.slug+'-삭제전-백업'); await repo.remove(post.id,post.version); renderList(); refreshStatistics();message('게시글을 삭제했습니다. 이미지 파일은 보존됩니다.'); }
        catch (error) { message(error.message, true); }
      });
      const copy=node('button','사본');copy.type='button';copy.addEventListener('click',async()=>{try{await repo.copy(post.id);renderList();refreshStatistics();message('별도 주소의 초안 사본을 생성했습니다.');}catch(error){message(error.message,true);}});
      const state=node('button',post.status==='published'?'비공개':'발행');state.type='button';state.addEventListener('click',async()=>{try{await repo.save({...post,status:post.status==='published'?'private':'published'});renderList();refreshStatistics();message('게시 상태를 변경했습니다.');}catch(error){message(error.message,true);}});
      actions.append(edit, copy, state, remove); row.append(titleCell, categoryCell, status,node('td',Number(post.viewCount||0).toLocaleString('ko-KR')),dateCell, actions); $('post-list').append(row);
    });
  }
  function refreshStatistics(){window.WonderfulManagement?.refresh().catch(error=>message(error.message,true));}
  function workingKey(){return 'wonderful-cms-working-v1:'+authState.user.id+':'+(/\/new\/?$/.test(location.pathname)?'new':current.id);}
  function preserveWorking(){try{localStorage.setItem(workingKey(),JSON.stringify(readForm()));}catch(error){message('복구본을 브라우저에 저장하지 못했습니다. JSON으로 내보내 주세요.',true);}}
  function markDirty() { dirty = true; if(view==='editor'&&current)preserveWorking(); }
  function downloadJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download=(name||'게시글-백업')+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function importDrafts(items){
    if(!Array.isArray(items))items=[items];
    if(!items.length){message('가져올 초안이 없습니다.');return;}
    downloadJson(items,'가져오기-전-원본-백업');
    let success=0;const failed=[];
    for(const post of items){try{if(!post||typeof post.title!=='string'||!Array.isArray(post.blocks))throw new Error('지원하는 초안 형식이 아닙니다.');await repo.importDraft(post);success++;}catch(error){failed.push((post?.title||'제목 없음')+': '+error.message);}}
    renderList();refreshStatistics();message(`${success}개를 새 초안으로 가져왔습니다.${failed.length?' 실패 '+failed.length+'개: '+failed.join(' / '):''}`,failed.length>0);
  }
  function categoryOptions(select, firstValue, firstLabel) {
    select.replaceChildren();
    const first = node('option', firstLabel); first.value = firstValue; select.append(first);
    M.categories.forEach(category => { const option = node('option', category.name+(category.is_active===false?' (비활성)':'')); option.value = category.id; select.append(option); });
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
    return { ...current, legacyHtml:JSON.stringify(current.blocks)===JSON.stringify(originalBlocks)?current.legacyHtml:'',title: $('title').value.trim(), category: $('category').value, slug: $('slug').value.trim(), summary: $('summary').value.trim(), thumbnail: $('thumbnail').value.trim(), thumbnailAlt: $('thumbnail-alt').value.trim(),status:$('post-status').value };
  }
  async function readImage(file) {
    if (!file) return null;
    message('이미지를 업로드하고 있습니다.');
    const src=await repo.upload(file);message('이미지를 업로드했습니다. 글을 저장해 연결해 주세요.');return src;
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
        button.addEventListener('click', async () => {
          if (!guard()) return;
          if (!delta) {
            if (!await confirmAction('이 블록을 삭제할까요? 저장 전 변경사항에도 반영됩니다.')) return;
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
        const uploadLabel = node('label', undefined, 'field'); uploadLabel.append(node('span', '이미지 파일 선택 · 20MB 이하'));
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
    if(post.legacyHtml && JSON.stringify(post.blocks)===JSON.stringify(originalBlocks)){
      const original=node('div');original.innerHTML=post.legacyHtml;original.querySelector('h1')?.remove();const crumb=original.querySelector('.crumb');if(crumb)crumb.textContent='치과 건강정보 / '+M.categoryName(post.category);
      root.append(original);$('preview').showModal();return;
    }
    post.blocks.forEach(block => {
      if (block.type === 'image') {
        const figure = node('figure'); const image = node('img'); safeImage(image, block.src, block.alt); figure.append(image);
        if (block.caption) figure.append(node('figcaption', block.caption)); root.append(figure);
      } else root.append(node(block.type === 'heading' ? 'h2' : 'p', block.text));
    });
    $('preview').showModal();
  }
  async function setupEditor() {
    const id = new URLSearchParams(location.search).get('id');
    const editing = /\/edit\/?$/.test(location.pathname) || Boolean(id);
    current = editing ? await repo.get(id) : {
      id: crypto.randomUUID(), title: '', slug: '', category: '', summary: '', thumbnail: '', thumbnailAlt: '', status: 'draft', blocks: [{ type: 'text', text: '' }]
    };
    if (!current) { $('editor-form').hidden = true; message('글을 찾을 수 없습니다. 게시글 관리 목록에서 다시 선택해 주세요.', true); return; }
    originalBlocks=JSON.parse(JSON.stringify(current.blocks));
    const recovery=localStorage.getItem(workingKey());
    if(recovery){try{const recovered=JSON.parse(recovery);if(await confirmAction('이 브라우저에 저장하지 않은 변경사항의 복구본이 있습니다. 불러올까요?')){current={...current,...recovered,legacyHtml:current.legacyHtml};dirty=true;}}catch{message('복구본을 읽지 못했습니다. 기존 데이터는 보존됩니다.',true);}}
    $('editor-title').textContent = editing ? '글 수정' : '새 글 쓰기';
    categoryOptions($('category'), '', '카테고리 선택');
    $('category').value = current.category;
    $('post-status').value=current.status;
    $('post-status').addEventListener('change',markDirty);
    const dates=()=>{$('post-dates').textContent=`작성: ${current.createdAt?new Date(current.createdAt).toLocaleString('ko-KR'):'저장 전'} · 최초 발행: ${current.publishedAt?new Date(current.publishedAt).toLocaleString('ko-KR'):'아직 발행되지 않음'}`;};dates();
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
    const savePost=async status=>{
      if(!guard()||saving)return;
      if(status)$('post-status').value=status;
      const submitted=JSON.parse(JSON.stringify(readForm())); const fingerprint=JSON.stringify(submitted);const recoveryKey=workingKey();
      preserveWorking();saving=true;$('save-post').disabled=true;$('publish-post').disabled=true;
      try {
        const saved=await repo.save(submitted);
        const unchanged=JSON.stringify(readForm())===fingerprint;
        if(unchanged){current=saved;dirty=false;localStorage.removeItem(recoveryKey);originalBlocks=JSON.parse(JSON.stringify(saved.blocks));$('thumbnail').value=saved.thumbnail;renderBlocks();updateThumbnail();}
        else{current={...current,id:saved.id,version:saved.version,createdAt:saved.createdAt,publishedAt:saved.publishedAt,legacyHtml:saved.legacyHtml};dirty=true;}
        history.replaceState(null, '', '/adm/edit?id=' + encodeURIComponent(current.id));
        $('editor-title').textContent = '글 수정';
        manualSlug = true;
        dates();$('copy-post').disabled=false;
        if(dirty)preserveWorking();
        message(statusNames[saved.status]+' 상태로 DB에 저장했습니다.'+(dirty?' 저장 요청 중 추가한 변경은 복구본에 보존되어 있습니다. 다시 저장해 주세요.':''));
      } catch (error) { message(error.message,true); }
      finally{saving=false;$('save-post').disabled=false;$('publish-post').disabled=false;}
    };
    $('editor-form').addEventListener('submit',event=>{event.preventDefault();savePost();});
    $('publish-post').addEventListener('click',()=>savePost('published'));
    $('copy-post').disabled=!current.version;
    $('copy-post').addEventListener('click',async()=>{try{const copied=await repo.copy(current.id);location.assign('/adm/edit?id='+encodeURIComponent(copied.id));}catch(error){message(error.message,true);}});
    $('download').addEventListener('click', () => {
      if (!guard()) return;
      const post=readForm();downloadJson(post,M.slugify(post.slug||post.title)||'draft');
    });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  }
  async function start() { try {
    if (!M) throw new Error('관리 화면 파일을 불러오지 못했습니다. 폴더 전체를 다시 업로드해 주세요.');
    if (!Auth) throw new Error('인증 파일을 불러오지 못했습니다.');
    if (view === 'login') { setupLogin(); return; }
    try { authState = await Auth.session(); }
    catch (error) { if (error.status === 401 || error.status === 403) { guard(); return; } throw error; }
    if (!guard()) return;
    repo = window.WonderfulDatabase;
    if(!repo)throw new Error('게시글 DB 연결 파일을 불러오지 못했습니다.');
    await repo.load();
    $('app').hidden = false; $('logout').hidden = false;
    $('logout').addEventListener('click', async () => {
      if (dirty && !await confirmAction('저장하지 않은 변경사항은 브라우저 복구본으로 유지됩니다. 로그아웃할까요?')) return;
      try { await Auth.logout(); authState = null; dirty = false; $('app').hidden = true; location.replace('/login'); }
      catch (error) { message(error.message || '로그아웃하지 못했습니다.', true); }
    });
    $('close-preview').addEventListener('click', () => $('preview').close());
    $('change-password').addEventListener('click', () => { $('password-form').reset(); $('password-message').textContent = ''; $('password-dialog').showModal(); });
    $('close-password').addEventListener('click', () => { $('password-form').reset(); $('password-dialog').close(); });
    $('password-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = $('password-form').querySelector('button[type="submit"]');
      if ($('new-password').value !== $('confirm-password').value) { $('password-message').textContent = '새 비밀번호와 확인이 다릅니다.'; return; }
      button.disabled = true;
      try { await Auth.changePassword($('current-password').value, $('new-password').value); $('password-form').reset(); $('password-message').textContent = '비밀번호를 변경했습니다.'; }
      catch (error) { $('password-message').textContent = error.message; }
      finally { button.disabled = false; }
    });
    window.addEventListener('pageshow', refreshSession);
    window.addEventListener('cms-auth-expired',()=>{authState=null;guard();});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSession(); });
    document.addEventListener('click', event => { if (!hasSession()) { event.preventDefault(); event.stopImmediatePropagation(); guard(); } }, true);
    if (view === 'list') {
      categoryOptions($('category-filter'), 'all', '전체보기');
      renderList(); $('search').addEventListener('input', renderList);
      $('category-filter').addEventListener('change', renderList);
      $('status-filter')?.addEventListener('change',renderList);
      $('backup-local').addEventListener('click',()=>{try{const raw=localStorage.getItem(M.STORE_KEY);downloadJson(raw===null?[]:JSON.parse(raw),'기존-브라우저-초안-백업');message('기존 저장 데이터를 수정하지 않고 백업했습니다.');}catch(error){message('기존 데이터를 읽지 못했습니다. 저장소는 보존했습니다.',true);}});
      $('import-local').addEventListener('click',async()=>{try{const raw=localStorage.getItem(M.STORE_KEY);if(raw===null){message('이 브라우저에 이전 초안이 없습니다. 원래 작성한 주소에서 JSON으로 내보내 가져올 수 있습니다.');return;}if(await confirmAction('기존 초안을 별도 주소의 새 DB 초안으로 가져올까요? 원본은 그대로 보존됩니다.'))await importDrafts(JSON.parse(raw));}catch(error){message(error.message,true);}});
      $('backup-db').addEventListener('click',()=>downloadJson(repo.all(),'DB-게시글-백업'));
      $('import-json').addEventListener('change',async()=>{try{const file=$('import-json').files[0];if(!file)return;if(file.size>100*1024*1024)throw new Error('JSON 파일은 100MB 이하로 선택해 주세요.');await importDrafts(JSON.parse(await file.text()));}catch(error){message(error.message,true);}finally{$('import-json').value='';}});
      if(window.WonderfulManagement)await window.WonderfulManagement.initialize(()=>{const selected=$('category-filter').value;categoryOptions($('category-filter'),'all','전체보기');$('category-filter').value=selected;renderList();});
    } else await setupEditor();
  } catch (error) {
    $('app').hidden = true; $('fatal').textContent = error.message || '관리 화면을 열 수 없습니다.'; $('fatal').hidden = false;
  } }
  start();
})();
