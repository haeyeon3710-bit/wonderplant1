(()=>{
 const Auth=window.WonderfulAuth,M=window.WonderfulAdmin,$=id=>document.getElementById(id);
 let current,statistics,changed=()=>{},dailyRequest=0,dailyLoaded=false,dailyLoading=false;
 const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
 const number=value=>Number(value||0).toLocaleString('ko-KR');
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function monthLabel(month){const [year,value]=month.split('-');return Number(year)+'년 '+Number(value)+'월';}
 function monthControls(){
  const month=$('daily-month').value,currentMonth=today().slice(0,7);
  $('daily-month').max=currentMonth;
  $('daily-next').disabled=!month||month>=currentMonth;$('daily-prev').disabled=!month||month<='0001-01';
 }
 function moveMonth(delta){
  const month=$('daily-month').value;if(!month)return;
  const [year,value]=month.split('-').map(Number),index=year*12+value-1+delta;
  const next=String(Math.floor(index/12)).padStart(4,'0')+'-'+String(index%12+1).padStart(2,'0');
  if(index<12||next>today().slice(0,7))return;$('daily-month').value=next;refreshDaily();
 }
 async function refreshDaily(){
  const request=++dailyRequest,month=$('daily-month').value;monthControls();
  dailyLoaded=false;dailyLoading=true;
  $('daily-stats').replaceChildren();$('daily-chart').replaceChildren();$('daily-total').textContent='—';$('daily-visual').hidden=true;
  if(!month||month>today().slice(0,7)){$('daily-message').textContent='현재 월 또는 이전 월을 선택해 주세요.';dailyLoading=false;return;}
  $('daily-message').textContent=monthLabel(month)+' 조회수를 불러오고 있습니다.';
  try{
   const {dailyStats}=await Auth.request('/api/manage?month='+encodeURIComponent(month));
   if(request!==dailyRequest)return;
   if(dailyStats.month!==month||!Array.isArray(dailyStats.days))throw new Error('조회 통계 응답을 확인해 주세요.');
   for(const day of dailyStats.days){
    const tr=node('tr'),date=node('th',Number(day.day.slice(5,7))+'월 '+Number(day.day.slice(8))+'일');date.scope='row';
    tr.append(date,node('td',new Intl.DateTimeFormat('ko-KR',{weekday:'short',timeZone:'UTC'}).format(new Date(day.day+'T00:00:00Z'))),node('td',number(day.views)));
    if(day.day===today())tr.className='daily-today';$('daily-stats').append(tr);
   }
   $('daily-caption').textContent=monthLabel(month)+' 일별 조회수';$('daily-values-caption').textContent=monthLabel(month)+' 일별 조회수 상세';
   $('daily-total').textContent=number(dailyStats.total);$('daily-table-total').textContent=number(dailyStats.total);
   $('daily-visual').hidden=false;window.WonderfulDailyChart.render(dailyStats,today());
   $('daily-updated').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())+' 기준';
   $('daily-message').textContent='한국 시간 기준 · 이번 달은 오늘까지 표시합니다. 날짜를 가리키거나 선택하면 조회수를 확인할 수 있습니다.';
   dailyLoaded=true;
  }catch(error){if(request===dailyRequest)$('daily-message').textContent='일별 조회수를 불러오지 못했습니다. '+error.message;}finally{if(request===dailyRequest)dailyLoading=false;}
 }
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
 function applyStatistics(value){
   statistics=value;categories();changed();
   for(const key of ['totalPosts','totalViews','todayViews','weekViews','monthViews'])$('stat-'+key).textContent=number(statistics[key]);
   $('stats-message').textContent='한국 시간 기준 · 최근 7일/30일은 오늘을 포함합니다. 관리자 열람은 집계에서 제외합니다.';
   $('admin-recent').replaceChildren();for(const post of statistics.recent||[]){const li=node('li'),link=node('a',post.title);link.href='/adm/edit?id='+encodeURIComponent(post.id);li.append(link,node('small',new Date(post.published_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})));$('admin-recent').append(li);}
   ranking();
 }
 async function refresh(){
  try{
   const data=await Auth.request('/api/manage');M.categories.splice(0,M.categories.length,...data.categories);applyStatistics(data.statistics);
   dailyLoaded=false;if($('daily-section').open)await refreshDaily();
  }catch(error){$('stats-message').textContent='통계를 불러오지 못했습니다. '+error.message;throw error;}
 }
 async function initialize(onChanged,initialStatistics){
  $('daily-month').value=today().slice(0,7);$('daily-month').max=today().slice(0,7);
  $('daily-month').addEventListener('change',refreshDaily);$('daily-prev').addEventListener('click',()=>moveMonth(-1));$('daily-next').addEventListener('click',()=>moveMonth(1));
  $('daily-current').addEventListener('click',()=>{$('daily-month').value=today().slice(0,7);refreshDaily();});$('refresh-daily').addEventListener('click',refreshDaily);
  $('daily-section').addEventListener('toggle',()=>{if($('daily-section').open&&!dailyLoaded&&!dailyLoading)refreshDaily();});
  changed=onChanged;$('ranking-period').addEventListener('change',ranking);$('refresh-stats').addEventListener('click',()=>refresh().catch(()=>{}));$('new-category').addEventListener('click',()=>openCategory());$('close-category').addEventListener('click',()=>$('category-dialog').close());
  $('category-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('category-save');button.disabled=true;try{
   await Auth.request('/api/manage',{action:'save-category',category:{id:current?.id,name:$('category-name').value.trim(),slug:$('category-slug').value.trim(),sort_order:Number($('category-order').value),is_active:$('category-active').checked}});
   await refresh();$('category-dialog').close();
  }catch(error){$('category-message').textContent=error.message;}finally{button.disabled=false;}});
  if(initialStatistics)applyStatistics(initialStatistics);else await refresh().catch(()=>{});
 }
 window.WonderfulManagement={initialize,refresh};
})();
