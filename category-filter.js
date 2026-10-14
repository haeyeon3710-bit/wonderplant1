(() => {
  document.querySelectorAll('[data-category-list]').forEach(list => {
    if(list.dataset?.dynamic==='true'){
      let state={category:list.dataset.category,sort:list.dataset.sort,page:Number(list.dataset.page)},requestId=0;
      const status=list.querySelector('[data-category-status]'),empty=list.querySelector('[data-category-empty]');
      async function load(next){
        const id=++requestId;state={...state,...next};status.textContent='게시글을 불러오고 있습니다.';list.setAttribute('aria-busy','true');
        try{
          const params=new URLSearchParams({category:state.category,sort:state.sort,page:String(state.page)});
          const response=await fetch('/api/blog?'+params,{cache:'no-store'}),data=await response.json();
          if(!response.ok)throw new Error(data.message||'게시글을 불러오지 못했습니다.');if(id!==requestId)return;
          list.querySelector('.cards').innerHTML=data.cards;list.querySelector('.board-pagination').outerHTML=data.pagination;
          list.querySelector('.category-filters').outerHTML=data.filters;
          const buttons=[...list.querySelectorAll('[data-category-filter]')];
          buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.categoryFilter===state.category)));
          const label=buttons.find(button=>button.dataset.categoryFilter===state.category)?.dataset.categoryName||'전체보기';
          status.textContent=`${label} · ${data.total}개의 글`;empty.hidden=data.posts.length>0;empty.textContent=label+' 카테고리에 등록된 글이 없습니다.';
          const url=new URL(location.href);url.searchParams.set('category',state.category);url.searchParams.set('sort',state.sort);url.searchParams.set('page',String(state.page));history.replaceState(null,'',url.pathname+url.search);
        }catch(error){if(id===requestId){list.querySelector('.cards').replaceChildren();empty.hidden=true;status.textContent=error.message;}}
        finally{if(id===requestId)list.removeAttribute('aria-busy');}
      }
      list.querySelector('[data-board-sort]').addEventListener('change',event=>load({sort:event.target.value,page:1}));
      list.addEventListener('click',event=>{const button=event.target.closest('[data-category-filter]');if(button){load({category:button.dataset.categoryFilter,page:1});return;}const link=event.target.closest('[data-page]');if(link){event.preventDefault();load({page:Number(link.dataset.page)});}});
      return;
    }
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
