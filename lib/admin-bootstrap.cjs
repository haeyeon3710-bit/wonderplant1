const {service}=require('./posts.cjs');
const {management}=require('./admin-data.cjs');
async function initialData(auth,config,url){
 const editor=/\/adm\/(new|edit)\/?$/.test(url.pathname)||url.pathname==='/editor.html';
 const posts=service(auth,config.environment),admin=management(auth,config.environment),id=url.searchParams.get('id');
 const [categories,items,statistics]=await Promise.all([
  admin.categories(),editor?(id?posts.get(id):null):posts.list(true),editor?null:admin.statistics()
 ]);
 // Include only safe profile information, never access/refresh tokens or email.
 const result={version:1,user:auth.user,view:editor?'editor':'list',categories,posts:editor?[]:items,post:editor?items:null};
 if(statistics){const {daily,...overview}=statistics;result.statistics=overview;}
 return result;
}
function embed(data){
 const json=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return `<script id="cms-bootstrap" type="application/json">${json}</script>`;
}
module.exports={initialData,embed};
