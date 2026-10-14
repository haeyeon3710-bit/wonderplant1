(()=>{
 const Auth=window.WonderfulAuth,M=window.WonderfulAdmin,$=id=>document.getElementById(id);
 let current,statistics,changed=()=>{};
 const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
 const number=value=>Number(value||0).toLocaleString('ko-KR');
 function ranking(){
  const list=$('admin-popular');list.replaceChildren();
  for(const post of statistics[$('ranking-period').value]||[]){const li=node('li'),link=node('a',post.title);link.href='/adm/edit?id='+encodeURIComponent(post.id);li.append(link,node('small','조회 '+number(post.period_views??post.view_count)));list.append(li);}
  if(!list.children.length)list.append(node('li','발행된 글이 없습니다.'));
 }
 function categories(){
  const list=$('category-list');list.replaceChildren();
  for(const category of M.categories){const row=node('tr');row.append(node('td',category.name),node('td',category.slug),node('td',String(category.sort_order)),node('td',category.is_active?'활성':'비활성'));const td=node('td'),edit=node('button','수정');edit.type='button';edit.className='button';edit.addEventListener('click',()=>openCategory(category));td.append(edit);row.append(td);list.append(row);}
 }
 function openCategory(category){
  current=category||null;$('category-form').reset();$('category-heading').textContent=category?'카테고리 수정':'새 카테고리';
  $('category-name').value=category?.name||'';$('category-slug').value=category?.slug||'';$('category-order').value=category?.sort_order??M.categories.length+1;$('category-active').checked=category?.is_active??true;$('category-message').textContent='';$('category-dialog').showModal();
 }
 async function refresh(){
  try{
   const data=await Auth.request('/api/manage');statistics=data.statistics;
   M.categories.splice(0,M.categories.length,...data.categories);categories();changed();
   for(const key of ['totalPosts','totalViews','todayViews','weekViews','monthViews'])$('stat-'+key).textContent=number(statistics[key]);
   $('stats-message').textContent='한국 시간 기준 · 최근 7일/30일은 오늘을 포함합니다. 관리자 열람은 집계에서 제외합니다.';
   $('admin-recent').replaceChildren();for(const post of statistics.recent||[]){const li=node('li'),link=node('a',post.title);link.href='/adm/edit?id='+encodeURIComponent(post.id);li.append(link,node('small',new Date(post.published_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})));$('admin-recent').append(li);}
   ranking();$('daily-stats').replaceChildren();for(const day of [...statistics.daily].reverse()){const tr=node('tr');tr.append(node('td',day.day),node('td',number(day.views)));$('daily-stats').append(tr);}
  }catch(error){$('stats-message').textContent='통계를 불러오지 못했습니다. '+error.message;throw error;}
 }
 async function initialize(onChanged){
  changed=onChanged;$('ranking-period').addEventListener('change',ranking);$('refresh-stats').addEventListener('click',()=>refresh().catch(()=>{}));$('new-category').addEventListener('click',()=>openCategory());$('close-category').addEventListener('click',()=>$('category-dialog').close());
  $('category-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('category-save');button.disabled=true;try{
   await Auth.request('/api/manage',{action:'save-category',category:{id:current?.id,name:$('category-name').value.trim(),slug:$('category-slug').value.trim(),sort_order:Number($('category-order').value),is_active:$('category-active').checked}});
   await refresh();$('category-dialog').close();
  }catch(error){$('category-message').textContent=error.message;}finally{button.disabled=false;}});
  await refresh().catch(()=>{});
 }
 window.WonderfulManagement={initialize,refresh};
})();
