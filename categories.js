(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WonderfulCategories = api;
})(typeof window === 'object' ? window : globalThis, function () {
  const categories = [
    { id: 'implant', name: '임플란트' },
    { id: 'complex-implant', name: '고난도 임플란트' },
    { id: 'full-implant', name: '전체 임플란트' },
    { id: 'sedation', name: '의식하진정법' },
    { id: 'orthodontics', name: '치아교정' },
  ];
  const has = id => categories.some(category => category.id === id);
  const name = id => categories.find(category => category.id === id)?.name || '카테고리 미지정';
  return { categories, has, name };
});
