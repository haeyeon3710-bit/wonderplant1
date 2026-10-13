(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WonderfulAdmin = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const STORE_KEY = 'wonderful-admin-demo-v1';
  const SESSION_KEY = 'wonderful-admin-demo-session';
  const count = value => [...String(value || '')].length;
  const slugify = value => String(value).normalize('NFC').toLowerCase().trim()
    .replace(/[^가-힣a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
  const validImage = value => /^\/(?!\/)[^\s<>]*$/.test(value) || /^https:\/\/[^\s<>]+$/i.test(value) || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value);
  const sessionValid = (session, now = Date.now()) => Boolean(session && session.mode === 'demo' && Number.isFinite(session.expiresAt) && session.expiresAt > now);
  function validate(post, others) {
    if (!post.title.trim() || count(post.title) > 100) return '제목을 1~100자로 입력해 주세요.';
    if (!post.slug || post.slug !== slugify(post.slug)) return '슬러그는 한글·영문 소문자·숫자와 하이픈으로 80자 이내로 입력해 주세요.';
    if (others.some(item => item.id !== post.id && item.slug === post.slug)) return '이미 사용 중인 슬러그입니다. 다른 주소를 입력해 주세요.';
    if (count(post.summary) < 120 || count(post.summary) > 130) return '카드 설명글은 공백 포함 120~130자로 입력해 주세요.';
    if (!validImage(post.thumbnail) || !post.thumbnailAlt.trim()) return '대표 이미지와 이미지 설명을 입력해 주세요.';
    if (!post.blocks.length || !post.blocks.some(block => block.type !== 'image' && block.text.trim())) return '본문에 글 블록을 하나 이상 추가해 주세요.';
    for (const block of post.blocks) {
      if (!['heading', 'text', 'image'].includes(block.type)) return '지원하지 않는 본문 블록입니다.';
      if (block.type === 'image' && (!validImage(block.src) || !block.alt.trim())) return '모든 이미지 블록에 이미지와 설명을 입력해 주세요.';
      if (block.type !== 'image' && !block.text.trim()) return '빈 글 블록을 채우거나 삭제해 주세요.';
    }
    return '';
  }
  function repository(storage, seed) {
    return {
      all() {
        const raw = storage.getItem(STORE_KEY);
        const value = raw === null ? seed : JSON.parse(raw);
        if (!Array.isArray(value) || value.some(post => !post || typeof post.id !== 'string' || typeof post.title !== 'string' || typeof post.slug !== 'string' || typeof post.summary !== 'string' || !Array.isArray(post.blocks))) throw new Error('저장된 체험 데이터를 읽을 수 없습니다. 브라우저 저장소를 확인해 주세요.');
        return JSON.parse(JSON.stringify(value));
      },
      save(post) {
        const items = this.all();
        const error = validate(post, items);
        if (error) throw new Error(error);
        const saved = { ...post, status: 'draft', updatedAt: new Date().toISOString() };
        const index = items.findIndex(item => item.id === post.id);
        if (index === -1) items.unshift(saved); else items[index] = saved;
        storage.setItem(STORE_KEY, JSON.stringify(items));
        return saved;
      },
      remove(id) { storage.setItem(STORE_KEY, JSON.stringify(this.all().filter(post => post.id !== id))); }
    };
  }
  return { STORE_KEY, SESSION_KEY, count, slugify, validImage, sessionValid, validate, repository };
});
