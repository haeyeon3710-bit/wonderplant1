(() => {
  document.querySelectorAll('[data-category-list]').forEach(list => {
    const buttons = [...list.querySelectorAll('[data-category-filter]')];
    const cards = [...list.querySelectorAll('.card[data-category]')];
    const empty = list.querySelector('[data-category-empty]');
    const status = list.querySelector('[data-category-status]');
    function select(category, label) {
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.categoryFilter === category)));
      let count = 0;
      cards.forEach(card => {
        card.hidden = category !== 'all' && card.dataset.category !== category;
        if (!card.hidden) count++;
      });
      empty.hidden = count > 0;
      empty.textContent = `${label} 카테고리에 등록된 글이 없습니다.`;
      status.textContent = `${label} · ${count}개의 글`;
    }
    buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.categoryFilter, button.textContent)));
    select('all', '전체보기');
  });
})();
