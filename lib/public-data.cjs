const {HttpError}=require('./http.cjs');
const {configuration,client}=require('./supabase.cjs');
function parameters(query={}){
 const category=query.category||'all',sort=query.sort||'recent',page=Number(query.page||1);
 if(!/^[a-z0-9-]{1,80}$/.test(category)||!['recent','popular','weekly','monthly'].includes(sort)||!Number.isSafeInteger(page)||page<1||page>100000)throw new HttpError(400,'목록 조건을 확인해 주세요.');
 return {category,sort,page};
}
function publicData(config=configuration(),api=client(config)){
 const call=(name,body)=>api.request('/rest/v1/rpc/'+name,{method:'POST',body});
 return {
  async board(query={}){
   const state=parameters(query);
   const [summary,page]=await Promise.all([call('cms_public_overview',{p_environment:config.environment}),call('cms_public_posts',{p_environment:config.environment,p_category:state.category==='all'?null:state.category,p_sort:state.sort,p_page:state.page})]);
   if(state.category!=='all'&&!summary.data.categories.some(c=>c.id===state.category))throw new HttpError(404,'카테고리를 찾을 수 없습니다.');
   return {...summary.data,...page.data,...state,allTotal:summary.data.total};
  },
  async post(slug){
   const query=new URLSearchParams({environment:'eq.'+config.environment,status:'eq.published',slug:'eq.'+slug,select:'id,legacy_id,title,slug,summary,content,legacy_article_html,thumbnail,thumbnail_alt,category_id,published_at,updated_at,view_count',limit:'1'});
   const row=(await api.request('/rest/v1/posts?'+query)).data?.[0];
   if(row)return {post:row,redirect:false};
   const alias=(await api.request('/rest/v1/post_slug_aliases?'+new URLSearchParams({environment:'eq.'+config.environment,slug:'eq.'+slug,select:'post_id',limit:'1'}))).data?.[0];
   if(!alias)throw new HttpError(404,'게시글을 찾을 수 없습니다.');
   const post=(await api.request('/rest/v1/posts?'+new URLSearchParams({environment:'eq.'+config.environment,id:'eq.'+alias.post_id,status:'eq.published',select:'id,slug',limit:'1'}))).data?.[0];
   if(!post)throw new HttpError(404,'게시글을 찾을 수 없습니다.');return {post,redirect:true};
  },
  async legacy(id){
   const post=(await api.request('/rest/v1/posts?'+new URLSearchParams({environment:'eq.'+config.environment,legacy_id:'eq.'+id,status:'eq.published',select:'slug',limit:'1'}))).data?.[0];
   if(!post)throw new HttpError(404,'게시글을 찾을 수 없습니다.');return post;
  },
  async legacyLinks(){return (await api.request('/rest/v1/posts?'+new URLSearchParams({environment:'eq.'+config.environment,status:'eq.published',legacy_id:'not.is.null',select:'legacy_id,title,slug',order:'legacy_id'}))).data;},
  async sitemap(){
   const posts=[];
   for(let offset=0;;offset+=500){const rows=(await api.request('/rest/v1/posts?'+new URLSearchParams({environment:'eq.'+config.environment,status:'eq.published',select:'slug,updated_at',order:'id',limit:'500',offset:String(offset)}))).data;posts.push(...rows);if(rows.length<500)break;}
   return posts;
  },
  async overview(){return (await call('cms_public_overview',{p_environment:config.environment})).data;}
 };
}
module.exports={parameters,publicData};
