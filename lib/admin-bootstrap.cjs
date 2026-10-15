const {dto,UUID}=require('./posts.cjs');
const {HttpError}=require('./http.cjs');
async function initialData(token,api,config,url){
 const editor=/\/adm\/(new|edit)\/?$/.test(url.pathname)||url.pathname==='/editor.html';
 const id=editor?url.searchParams.get('id'):null;
 if(id&&!UUID.test(id)&&!/^\d{1,10}$/.test(id))throw new HttpError(400,'게시글 ID를 확인해 주세요.');
 let snapshot;
 try{snapshot=(await api.request('/rest/v1/rpc/cms_admin_page_snapshot',{token,method:'POST',body:{p_environment:config.environment,p_view:editor?'editor':'list',p_post_id:id}})).data;}
 catch(error){if(error.code==='42501')throw new HttpError(403,'관리자 권한이 없습니다.');if(error.code==='P0002')throw new HttpError(404,'게시글을 찾을 수 없습니다.');throw error;}
 if(!snapshot?.user?.id||!Array.isArray(snapshot.categories)||!Array.isArray(snapshot.posts))throw new Error('Invalid admin snapshot');
 // Include only safe profile information, never access/refresh tokens or email.
 const result={version:1,user:{id:snapshot.user.id,username:snapshot.user.username||'admin'},view:editor?'editor':'list',categories:snapshot.categories,posts:snapshot.posts.map(dto),post:snapshot.post?dto(snapshot.post):null};
 if(snapshot.statistics)result.statistics=snapshot.statistics;
 return result;
}
function embed(data){
 const json=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return `<script id="cms-bootstrap" type="application/json">${json}</script>`;
}
module.exports={initialData,embed};
