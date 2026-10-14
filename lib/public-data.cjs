const {HttpError}=require('./http.cjs');
const {configuration,client}=require('./supabase.cjs');
const {publicCache}=require('./public-cache.cjs');
function parameters(query={}){
 const category=query.category||'all',sort=query.sort||'recent',page=Number(query.page||1);
 if(!/^[a-z0-9-]{1,80}$/.test(category)||!['recent','popular','weekly','monthly'].includes(sort)||!Number.isSafeInteger(page)||page<1||page>100000)throw new HttpError(400,'목록 조건을 확인해 주세요.');
 return {category,sort,page};
}
function publicData(config=configuration(),api=client(config),cache=publicCache){
 const call=(name,body)=>api.request('/rest/v1/rpc/'+name,{method:'POST',body});
 const snapshot=(kind,body={})=>cache.read(config.url+'|'+config.environment,{kind,...body},
  async()=> (await call('cms_public_revision',{p_environment:config.environment})).data,
  async()=> (await call('cms_public_snapshot',{p_environment:config.environment,p_kind:kind,...body})).data);
 return {
  async board(query={}){
   const state=parameters(query);
   const data=await snapshot('board',{p_category:state.category==='all'?null:state.category,p_sort:state.sort,p_page:state.page});
   if(state.category!=='all'&&!data.overview.categories.some(c=>c.id===state.category))throw new HttpError(404,'카테고리를 찾을 수 없습니다.');
   return {...data.overview,...data.page,...state,allTotal:data.overview.total};
  },
  async post(slug){
   const data=await snapshot('article',{p_slug:slug});if(!data.post)throw new HttpError(404,'게시글을 찾을 수 없습니다.');return data;
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
  async overview(){return snapshot('overview');}
 };
}
module.exports={parameters,publicData};
