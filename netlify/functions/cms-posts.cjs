const {configuration}=require('../../lib/supabase.cjs');
const {requireAdmin,clearCookies}=require('../../lib/auth.cjs');
const {HttpError,response,requireMutation,jsonBody,failure}=require('../../lib/http.cjs');
const {service}=require('../../lib/posts.cjs');
exports.handler=async event=>{
  let auth;
  try {
    auth=await requireAdmin(event); const posts=service(auth,configuration().environment);
    if(event.httpMethod==='GET') {
      const id=event.queryStringParameters?.id;
      return response(200,id?{post:await posts.get(id)}:{posts:await posts.list()},auth.cookies);
    }
    requireMutation(event); const body=jsonBody(event);
    if(body.action==='save') return response(200,{post:await posts.save(body.post)},auth.cookies);
    if(body.action==='copy') return response(201,{post:await posts.copy(body.id)},auth.cookies);
    if(body.action==='delete') return response(200,await posts.remove(body.id,body.version),auth.cookies);
    throw new HttpError(400,'지원하지 않는 게시글 작업입니다.');
  } catch(error){return failure(error,error.status===401||error.status===403?clearCookies():auth?.cookies||[]);}
};
